import * as cheerio from "cheerio";

import {
  CompensationInterval,
  Country,
  DescriptionFormat,
  JobPost,
  Location,
  type JobResponse,
  type ScraperInput,
  Scraper,
  Site
} from "@/core/model";
import {
  extractEmailsFromText,
  markdownConverter,
  removeAttributes
} from "@/util/format";
import { createLogger } from "@/util/logger";
import { addParams, getJobTypeEnum } from "@/scrapers/ziprecruiter/util";
import { getCookieData, headers } from "@/scrapers/ziprecruiter/constant";

const log = createLogger("ZipRecruiter");

interface ZipRecruiterJob {
  listing_key: string;
  name?: string;
  job_description?: string;
  buyer_type?: string;
  hiring_company?: { name?: string };
  job_country?: string;
  job_city?: string;
  job_state?: string;
  employment_type?: string;
  posted_time?: string;
  compensation_interval?: string;
  compensation_min?: number;
  compensation_max?: number;
  compensation_currency?: string;
}

export class ZipRecruiterScraper extends Scraper {
  private readonly baseUrl = "https://www.ziprecruiter.com";
  private readonly apiUrl = "https://api.ziprecruiter.com";
  private readonly delay = 5;
  private readonly jobsPerPage = 20;
  private cookiesBootstrapped = false;

  constructor(http: Scraper["http"], options: Scraper["options"] = {}) {
    super(Site.ZIP_RECRUITER, http, options);
  }

  override async scrape(scraperInput: ScraperInput): Promise<JobResponse> {
    if (!this.cookiesBootstrapped) {
      await this.getCookies();
      this.cookiesBootstrapped = true;
    }

    const jobList: JobPost[] = [];
    const seenUrls = new Set<string>();
    let continueToken: string | null = null;

    const maxPages = Math.ceil(scraperInput.resultsWanted / this.jobsPerPage);
    for (let page = 1; page <= maxPages; page += 1) {
      if (jobList.length >= scraperInput.resultsWanted) {
        break;
      }

      if (page > 1) {
        await this.sleep(this.delay);
      }

      log.info(`search page: ${page} / ${maxPages}`);
      const { jobs, nextContinueToken } = await this.findJobsInPage(scraperInput, continueToken, seenUrls);
      if (jobs.length === 0) {
        break;
      }

      jobList.push(...jobs);
      continueToken = nextContinueToken;
      if (!continueToken) {
        break;
      }
    }

    return { jobs: jobList.slice(0, scraperInput.resultsWanted) };
  }

  private async findJobsInPage(
    scraperInput: ScraperInput,
    continueToken: string | null,
    seenUrls: Set<string>
  ): Promise<{ jobs: JobPost[]; nextContinueToken: string | null }> {
    const params = addParams(scraperInput);
    if (continueToken) {
      params.continue_from = continueToken;
    }

    let responseText: string;
    let status: number;
    try {
      const response = await this.http.requestText(`${this.apiUrl}/jobs-app/jobs`, {
        method: "GET",
        query: params,
        headers: {
          ...headers,
          ...(this.options.userAgent ? { "user-agent": this.options.userAgent } : {})
        },
        site: Site.ZIP_RECRUITER,
        kind: "list"
      });
      status = response.status;
      responseText = response.text;
    } catch (error) {
      log.error(`ZipRecruiter: ${String(error)}`);
      return { jobs: [], nextContinueToken: null };
    }

    if (status < 200 || status >= 400) {
      if (status === 429) {
        log.error("429 Response - Blocked by ZipRecruiter for too many requests");
      } else {
        log.error(`ZipRecruiter response status code ${status} with response: ${responseText}`);
      }
      return { jobs: [], nextContinueToken: null };
    }

    const parsed = JSON.parse(responseText) as {
      jobs?: ZipRecruiterJob[];
      continue?: string | null;
    };

    const jobsList = parsed.jobs ?? [];
    const nextContinueToken = parsed.continue ?? null;

    const processed = await Promise.all(
      jobsList.map((job) => this.processJob(job, scraperInput, seenUrls))
    );

    return {
      jobs: processed.filter((job): job is JobPost => job !== null),
      nextContinueToken
    };
  }

  private async processJob(
    job: ZipRecruiterJob,
    scraperInput: ScraperInput,
    seenUrls: Set<string>
  ): Promise<JobPost | null> {
    const listingKey = job.listing_key;
    if (!listingKey) {
      return null;
    }

    const jobUrl = `${this.baseUrl}/jobs//j?lvk=${listingKey}`;
    if (seenUrls.has(jobUrl)) {
      return null;
    }
    seenUrls.add(jobUrl);

    let description = job.job_description?.trim() ?? "";
    if (scraperInput.descriptionFormat === DescriptionFormat.MARKDOWN) {
      description = markdownConverter(description) ?? description;
    }

    const countryValue = job.job_country === "US" ? "usa" : "canada";
    const countryEnum = Country.fromString(countryValue);

    const compIntervalRaw = job.compensation_interval;
    const compInterval = compIntervalRaw === "annual" ? "yearly" : compIntervalRaw;
    const interval =
      compInterval && Object.values(CompensationInterval).includes(compInterval as CompensationInterval)
        ? (compInterval as CompensationInterval)
        : null;

    const posted = job.posted_time ? new Date(job.posted_time) : null;

    const details = await this.getDescriptionAndDirectUrl(jobUrl, scraperInput);

    return {
      id: `zr-${listingKey}`,
      title: job.name ?? "",
      company_name: job.hiring_company?.name ?? null,
      location: new Location({
        city: job.job_city ?? null,
        state: job.job_state ?? null,
        country: countryEnum
      }),
      job_type: getJobTypeEnum((job.employment_type ?? "").replace(/_/g, "").toLowerCase()),
      compensation: {
        interval,
        min_amount: job.compensation_min != null ? Math.trunc(job.compensation_min) : null,
        max_amount: job.compensation_max != null ? Math.trunc(job.compensation_max) : null,
        currency: job.compensation_currency ?? null
      },
      date_posted: posted,
      job_url: jobUrl,
      description: details.description ?? description,
      emails: extractEmailsFromText(description),
      job_url_direct: details.jobUrlDirect,
      listing_type: job.buyer_type ?? null,
      site: Site.ZIP_RECRUITER
    };
  }

  private async getDescriptionAndDirectUrl(
    jobUrl: string,
    scraperInput: ScraperInput
  ): Promise<{ description: string | null; jobUrlDirect: string | null }> {
    try {
      const response = await this.http.requestText(jobUrl, {
        method: "GET",
        site: Site.ZIP_RECRUITER,
        kind: "detail"
      });
      if (!response.ok) {
        return { description: null, jobUrlDirect: null };
      }

      const $ = cheerio.load(response.text);
      const jobDescriptionDiv = $("div.job_description").first();
      const companyDescriptionSection = $("section.company_description").first();

      const jobDescriptionClean = jobDescriptionDiv.length
        ? removeAttributes($.html(jobDescriptionDiv) ?? "")
        : "";
      const companyDescriptionClean = companyDescriptionSection.length
        ? removeAttributes($.html(companyDescriptionSection) ?? "")
        : "";

      let descriptionFull = `${jobDescriptionClean}${companyDescriptionClean}`;
      if (scraperInput.descriptionFormat === DescriptionFormat.MARKDOWN) {
        descriptionFull = markdownConverter(descriptionFull) ?? descriptionFull;
      }

      let jobUrlDirect: string | null = null;
      const scriptTagText = $("script[type='application/json']").first().text();
      if (scriptTagText) {
        try {
          const jobJson = JSON.parse(scriptTagText) as {
            model?: { saveJobURL?: string };
          };
          const saveJobUrl = jobJson.model?.saveJobURL ?? "";
          const match = saveJobUrl.match(/job_url=(.+)/);
          if (match?.[1]) {
            jobUrlDirect = match[1];
          }
        } catch {
          jobUrlDirect = null;
        }
      }

      return {
        description: descriptionFull || null,
        jobUrlDirect
      };
    } catch {
      return { description: null, jobUrlDirect: null };
    }
  }

  private async getCookies(): Promise<void> {
    const form = new URLSearchParams();
    for (const [key, value] of getCookieData) {
      form.append(key, value);
    }

    await this.http.requestText(`${this.apiUrl}/jobs-app/event`, {
      method: "POST",
      headers,
      body: form.toString(),
      site: Site.ZIP_RECRUITER,
      kind: "other"
    });
  }

  private async sleep(seconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
