import { z } from "zod";

import {
  DescriptionFormat,
  JobType,
  type JobPost,
  type JobResponse,
  Location,
  type ScraperInput,
  Scraper,
  Site
} from "@/core/model";
import { extractEmailsFromText, markdownConverter } from "@/util/format";
import { createLogger } from "@/util/logger";
import { apiHeaders, jobSearchQuery } from "@/scrapers/indeed/constant";
import { getCompensation, getJobType, isJobRemote } from "@/scrapers/indeed/util";

const log = createLogger("Indeed");

const indeedResponseSchema = z.object({
  data: z.object({
    jobSearch: z.object({
      results: z.array(z.object({ job: z.record(z.string(), z.unknown()) })),
      pageInfo: z.object({ nextCursor: z.string().nullable().optional() })
    })
  })
});

type IndeedApiResponse = z.infer<typeof indeedResponseSchema>;

export class IndeedScraper extends Scraper {
  private readonly apiUrl = "https://apis.indeed.com/graphql";
  private readonly jobsPerPage = 100;

  constructor(http: Scraper["http"], options: Scraper["options"] = {}) {
    super(Site.INDEED, http, options);
  }

  override async scrape(scraperInput: ScraperInput): Promise<JobResponse> {
    const [domain, apiCountryCode] = (scraperInput.country ?? null)?.indeedDomainValue ?? ["www", "US"];
    const baseUrl = `https://${domain}.indeed.com`;

    const seenUrls = new Set<string>();
    const jobs: JobPost[] = [];
    let cursor: string | null = null;
    let page = 1;

    while (seenUrls.size < scraperInput.resultsWanted + scraperInput.offset) {
      log.info(
        `search page: ${page} / ${Math.ceil(scraperInput.resultsWanted / this.jobsPerPage)}`
      );

      const { jobsOnPage, nextCursor } = await this.scrapePage(scraperInput, cursor, baseUrl, apiCountryCode, seenUrls);
      if (jobsOnPage.length === 0) {
        log.info(`found no jobs on page: ${page}`);
        break;
      }
      jobs.push(...jobsOnPage);
      cursor = nextCursor;
      page += 1;

      if (!cursor) {
        break;
      }
    }

    return {
      jobs: jobs.slice(scraperInput.offset, scraperInput.offset + scraperInput.resultsWanted)
    };
  }

  private async scrapePage(
    scraperInput: ScraperInput,
    cursor: string | null,
    baseUrl: string,
    apiCountryCode: string,
    seenUrls: Set<string>
  ): Promise<{ jobsOnPage: JobPost[]; nextCursor: string | null }> {
    const filters = this.buildFilters(scraperInput);
    const searchTerm = scraperInput.searchTerm ? scraperInput.searchTerm.replace(/"/g, '\\"') : "";

    const query = jobSearchQuery
      .replace("{what}", searchTerm ? `what: \"${searchTerm}\"` : "")
      .replace(
        "{location}",
        scraperInput.location
          ? `location: {where: \"${scraperInput.location}\", radius: ${scraperInput.distance ?? 50}, radiusUnit: MILES}`
          : ""
      )
      .replace("{cursor}", cursor ? `cursor: \"${cursor}\"` : "")
      .replace("{filters}", filters);

    const headers = {
      ...apiHeaders,
      "indeed-co": apiCountryCode,
      ...(this.options.userAgent ? { "user-agent": this.options.userAgent } : {})
    };

    const response = await this.http.requestText(this.apiUrl, {
      method: "POST",
      headers,
      json: { query },
      timeoutMs: 10_000,
      site: Site.INDEED,
      kind: "list"
    });

    if (!response.ok) {
      log.warn(`responded with status code: ${response.status}`);
      return { jobsOnPage: [], nextCursor: null };
    }

    let data: IndeedApiResponse;
    try {
      const parsed = JSON.parse(response.text);
      data = indeedResponseSchema.parse(parsed);
    } catch (error) {
      log.error(`failed to parse Indeed payload: ${String(error)}`);
      return { jobsOnPage: [], nextCursor: null };
    }

    const jobs = data.data.jobSearch.results;
    const nextCursor = data.data.jobSearch.pageInfo.nextCursor ?? null;
    const jobsOnPage: JobPost[] = [];

    for (const jobNode of jobs) {
      const parsedJob = this.processJob(jobNode.job, scraperInput, baseUrl, seenUrls);
      if (parsedJob) {
        jobsOnPage.push(parsedJob);
      }
    }

    return { jobsOnPage, nextCursor };
  }

  private buildFilters(scraperInput: ScraperInput): string {
    if (scraperInput.hoursOld) {
      return `
            filters: {
                date: {
                  field: \"dateOnIndeed\",
                  start: \"${scraperInput.hoursOld}h\"
                }
            }
            `;
    }

    if (scraperInput.easyApply) {
      return `
            filters: {
                keyword: {
                  field: \"indeedApplyScope\",
                  keys: [\"DESKTOP\"]
                }
            }
            `;
    }

    if (!scraperInput.jobType && !scraperInput.isRemote) {
      return "";
    }

    const jobTypeKeyMapping: Partial<Record<JobType, string>> = {
      [JobType.FULL_TIME]: "CF3CP",
      [JobType.PART_TIME]: "75GKK",
      [JobType.CONTRACT]: "NJXCK",
      [JobType.INTERNSHIP]: "VDTG7"
    };

    const keys: string[] = [];
    if (scraperInput.jobType) {
      const key = jobTypeKeyMapping[scraperInput.jobType];
      if (key) {
        keys.push(key);
      }
    }
    if (scraperInput.isRemote) {
      keys.push("DSQF7");
    }
    if (keys.length === 0) {
      return "";
    }

    return `
                filters: {
                  composite: {
                    filters: [{
                      keyword: {
                        field: \"attributes\",
                        keys: [\"${keys.join('", "')}\"]
                      }
                    }]
                  }
                }
                `;
  }

  private processJob(
    rawJob: Record<string, unknown>,
    scraperInput: ScraperInput,
    baseUrl: string,
    seenUrls: Set<string>
  ): JobPost | null {
    const key = String(rawJob.key ?? "");
    if (!key) {
      return null;
    }

    const jobUrl = `${baseUrl}/viewjob?jk=${key}`;
    if (seenUrls.has(jobUrl)) {
      return null;
    }
    seenUrls.add(jobUrl);

    const descriptionHtml = (rawJob.description as { html?: string } | undefined)?.html ?? "";
    const description =
      scraperInput.descriptionFormat === DescriptionFormat.MARKDOWN
        ? markdownConverter(descriptionHtml)
        : descriptionHtml;

    const timestampSeconds = Number(rawJob.datePublished ?? 0) / 1000;
    const datePosted = Number.isFinite(timestampSeconds) && timestampSeconds > 0
      ? new Date(timestampSeconds * 1000)
      : null;

    const employer = (rawJob.employer as Record<string, unknown> | undefined) ?? undefined;
    const dossier = (employer?.dossier as Record<string, unknown> | undefined) ?? undefined;
    const employerDetails =
      (dossier?.employerDetails as Record<string, unknown> | undefined) ?? undefined;

    const attributes = ((rawJob.attributes as Array<{ label?: string }> | undefined) ?? []);
    const compensationPayload =
      (rawJob.compensation as Parameters<typeof getCompensation>[0] | undefined) ?? {};

    const locationRaw = (rawJob.location as
      | { city?: string; admin1Code?: string; countryCode?: string; formatted?: { long?: string } }
      | undefined);

    const industryRaw = employerDetails?.industry;
    const companyIndustry = typeof industryRaw === "string"
      ? industryRaw.replace("Iv1", "").replace(/_/g, " ").trim().replace(/\b\w/g, (m) => m.toUpperCase())
      : null;

    const employerImages = (dossier?.images as Record<string, unknown> | undefined) ?? undefined;
    const employerLinks = (dossier?.links as Record<string, unknown> | undefined) ?? undefined;

    return {
      id: `in-${key}`,
      title: String(rawJob.title ?? ""),
      description,
      company_name: typeof employer?.name === "string" ? employer.name : null,
      company_url:
        typeof employer?.relativeCompanyPageUrl === "string"
          ? `${baseUrl}${employer.relativeCompanyPageUrl}`
          : null,
      company_url_direct:
        typeof employerLinks?.corporateWebsite === "string"
          ? employerLinks.corporateWebsite
          : null,
      location: new Location({
        city: locationRaw?.city ?? null,
        state: locationRaw?.admin1Code ?? null,
        country: locationRaw?.countryCode ?? null
      }),
      job_type: getJobType(attributes),
      compensation: getCompensation(compensationPayload),
      date_posted: datePosted,
      job_url: jobUrl,
      job_url_direct:
        typeof (rawJob.recruit as Record<string, unknown> | undefined)?.viewJobUrl === "string"
          ? String((rawJob.recruit as Record<string, unknown>).viewJobUrl)
          : null,
      emails: extractEmailsFromText(description),
      is_remote: isJobRemote(
        {
          attributes,
          location: { formatted: { long: locationRaw?.formatted?.long ?? "" } }
        },
        description ?? ""
      ),
      company_addresses: Array.isArray(employerDetails?.addresses)
        ? (employerDetails.addresses[0] as string | undefined) ?? null
        : null,
      company_industry: companyIndustry,
      company_num_employees:
        typeof employerDetails?.employeesLocalizedLabel === "string"
          ? employerDetails.employeesLocalizedLabel
          : null,
      company_revenue:
        typeof employerDetails?.revenueLocalizedLabel === "string"
          ? employerDetails.revenueLocalizedLabel
          : null,
      company_description:
        typeof employerDetails?.briefDescription === "string"
          ? employerDetails.briefDescription
          : null,
      company_logo:
        typeof employerImages?.squareLogoUrl === "string" ? employerImages.squareLogoUrl : null,
      site: Site.INDEED
    };
  }
}
