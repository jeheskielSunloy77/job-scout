import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import { LinkedInException } from "@/scrapers/exception";
import {
  CompensationInterval,
  Country,
  DescriptionFormat,
  type EnrichmentConfidence,
  type EnrichmentMeta,
  JobPost,
  type JobType,
  Location,
  type JobResponse,
  type ScraperInput,
  Scraper,
  Site
} from "@/core/model";
import {
  extractEmailsFromText,
  markdownConverter,
  plainConverter,
  removeAttributes
} from "@/util/format";
import { createLogger } from "@/util/logger";
import { currencyParser } from "@/util/salary";
import { headers } from "@/scrapers/linkedin/constant";
import {
  isJobRemote,
  jobTypeCode,
  parseCompanyIndustry,
  parseJobLevel,
  parseJobType
} from "@/scrapers/linkedin/util";
import { EnrichmentBudgetController } from "@/scrapers/linkedin/enrichment/budget-controller";
import { collectEnrichmentDocuments } from "@/scrapers/linkedin/enrichment/document-collector";
import {
  extractEnrichmentValues,
  mergeUniqueValues
} from "@/scrapers/linkedin/enrichment/extractors";
import type { EnrichmentDocument, EnrichmentFieldName } from "@/scrapers/linkedin/enrichment/types";

const log = createLogger("LinkedIn");

type LinkedInJobDetails = {
  description: string | null;
  description_text: string | null;
  page_text: string | null;
  page_html: string | null;
  job_type: JobType[] | null;
  job_level: string | null;
  company_industry: string | null;
  job_url_direct: string | null;
  company_logo: string | null;
  job_function: string | null;
};

function emptyJobDetails(): LinkedInJobDetails {
  return {
    description: null,
    description_text: null,
    page_text: null,
    page_html: null,
    job_type: null,
    job_level: null,
    company_industry: null,
    job_url_direct: null,
    company_logo: null,
    job_function: null
  };
}

export class LinkedInScraper extends Scraper {
  private readonly baseUrl = "https://www.linkedin.com";
  private readonly delay = 3;
  private readonly bandDelay = 4;
  private readonly companyPageCache = new Map<string, Promise<EnrichmentDocument[]>>();

  constructor(http: Scraper["http"], options: Scraper["options"] = {}) {
    super(Site.LINKEDIN, http, options);
  }

  override async scrape(scraperInput: ScraperInput): Promise<JobResponse> {
    const jobList: JobPost[] = [];
    const seenIds = new Set<string>();

    this.companyPageCache.clear();

    let start = scraperInput.offset ? Math.floor(scraperInput.offset / 10) * 10 : 0;
    let requestCount = 0;
    const secondsOld = scraperInput.hoursOld ? scraperInput.hoursOld * 3600 : null;

    const shouldContinue = (): boolean => {
      return jobList.length < scraperInput.resultsWanted && start < 1000;
    };

    while (shouldContinue()) {
      requestCount += 1;
      log.info(`search page: ${requestCount} / ${Math.ceil(scraperInput.resultsWanted / 10)}`);

      const params: Record<string, string | number | null | undefined> = {
        keywords: scraperInput.searchTerm,
        location: scraperInput.location,
        distance: scraperInput.distance,
        f_WT: scraperInput.isRemote ? 2 : null,
        f_JT: scraperInput.jobType ? jobTypeCode(scraperInput.jobType) : null,
        pageNum: 0,
        start,
        f_AL: scraperInput.easyApply ? "true" : null,
        f_C: scraperInput.linkedinCompanyIds?.length
          ? scraperInput.linkedinCompanyIds.join(",")
          : null
      };
      if (secondsOld != null) {
        params.f_TPR = `r${secondsOld}`;
      }

      let responseText: string;
      try {
        const response = await this.http.requestText(
          `${this.baseUrl}/jobs-guest/jobs/api/seeMoreJobPostings/search`,
          {
            method: "GET",
            query: params,
            headers: {
              ...headers,
              ...(this.options.userAgent ? { "user-agent": this.options.userAgent } : {})
            },
            timeoutMs: 10_000,
            site: Site.LINKEDIN,
            kind: "list"
          }
        );

        if (response.status < 200 || response.status >= 400) {
          if (response.status === 429) {
            log.error("429 Response - Blocked by LinkedIn for too many requests");
          } else {
            log.error(`LinkedIn response status code ${response.status} - ${response.text}`);
          }
          return { jobs: jobList };
        }

        responseText = response.text;
      } catch (error) {
        log.error(`LinkedIn: ${String(error)}`);
        return { jobs: jobList };
      }

      const $ = cheerio.load(responseText);
      const jobCards = $("div.base-search-card");
      if (jobCards.length === 0) {
        return { jobs: jobList };
      }

      for (const card of jobCards.toArray()) {
        const href = $(card).find("a.base-card__full-link").attr("href")?.split("?")[0];
        if (!href) {
          continue;
        }

        const jobId = href.split("-").at(-1);
        if (!jobId || seenIds.has(jobId)) {
          continue;
        }
        seenIds.add(jobId);

        try {
          const job = await this.processJob($, card, jobId, scraperInput);
          if (job) {
            jobList.push(job);
          }
          if (!shouldContinue()) {
            break;
          }
        } catch (error) {
          throw new LinkedInException(String(error));
        }
      }

      if (shouldContinue()) {
        await this.sleep(this.delay + Math.random() * this.bandDelay);
        start += jobCards.length;
      }
    }

    return { jobs: jobList.slice(0, scraperInput.resultsWanted) };
  }

  private async processJob(
    $: cheerio.CheerioAPI,
    jobCard: Element,
    jobId: string,
    scraperInput: ScraperInput
  ): Promise<JobPost | null> {
    const card = $(jobCard);
    const salaryText = card.find("span.job-search-card__salary-info").text().trim();

    let compensation: JobPost["compensation"] = null;
    if (salaryText && salaryText.includes("-")) {
      const salaryValues = salaryText.split("-").map((part) => currencyParser(part));
      const minAmount = salaryValues[0] ?? Number.NaN;
      const maxAmount = salaryValues[1] ?? Number.NaN;
      const currency = salaryText.startsWith("$") ? "USD" : salaryText[0] ?? "USD";
      if (Number.isFinite(minAmount) && Number.isFinite(maxAmount)) {
        compensation = {
          min_amount: Math.trunc(minAmount),
          max_amount: Math.trunc(maxAmount),
          currency,
          interval: CompensationInterval.YEARLY
        };
      }
    }

    const title = card.find("span.sr-only").first().text().trim() || "N/A";
    const companyAnchor = card.find("h4.base-search-card__subtitle a").first();
    const companyHref = companyAnchor.attr("href");
    const companyUrl = companyHref ? new URL(companyHref).origin + new URL(companyHref).pathname : "";
    const company = companyAnchor.text().trim() || "N/A";

    const metadataCard = card.find("div.base-search-card__metadata").first();
    const location = this.getLocation(metadataCard);

    const datetimeValue = metadataCard.find("time.job-search-card__listdate").attr("datetime");
    const datePosted = datetimeValue ? new Date(datetimeValue) : null;

    const enrichmentConfig = scraperInput.linkedinEnrichment;
    const enrichmentBudget = enrichmentConfig.enabled
      ? new EnrichmentBudgetController(enrichmentConfig.budget)
      : null;

    const shouldFetchDescription = scraperInput.linkedinFetchDescription;
    const shouldFetchDetailForEnrichment =
      enrichmentConfig.enabled && enrichmentConfig.sources.jobDetailPage;

    let details = emptyJobDetails();
    let detailDocument: EnrichmentDocument | null = null;

    if (shouldFetchDescription) {
      details = await this.getJobDetails(jobId, scraperInput, 5_000);
      if (shouldFetchDetailForEnrichment) {
        detailDocument = this.buildDetailDocument(jobId, details);
      }
    } else if (shouldFetchDetailForEnrichment && enrichmentBudget?.consumeRequest("www.linkedin.com")) {
      details = await this.getJobDetails(
        jobId,
        scraperInput,
        enrichmentConfig.budget.requestTimeoutMs
      );
      detailDocument = this.buildDetailDocument(jobId, details);
      if (detailDocument) {
        enrichmentBudget.recordCollectedPage();
      }
    }

    const description = shouldFetchDescription ? details.description : null;
    const remote = isJobRemote(title, description, location);

    const job: JobPost = {
      id: `li-${jobId}`,
      title,
      company_name: company,
      company_url: companyUrl || null,
      location,
      is_remote: remote,
      date_posted: datePosted,
      job_url: `${this.baseUrl}/jobs/view/${jobId}`,
      compensation,
      job_type: details.job_type,
      job_level: details.job_level ? details.job_level.toLowerCase() : null,
      company_industry: details.company_industry,
      description,
      job_url_direct: details.job_url_direct,
      emails: extractEmailsFromText(description),
      company_logo: details.company_logo,
      job_function: details.job_function,
      site: Site.LINKEDIN
    };

    if (enrichmentConfig.enabled && enrichmentBudget) {
      let fieldConfidence: Partial<Record<EnrichmentFieldName, EnrichmentConfidence>> = {};
      let sourcesUsed: string[] = [];

      try {
        const documents = await collectEnrichmentDocuments({
          existingDetailDocument: detailDocument,
          jobUrlDirect: job.job_url_direct ?? null,
          companyUrl: job.company_url ?? null,
          sources: {
            externalApplyPage: enrichmentConfig.sources.externalApplyPage,
            companyPages: enrichmentConfig.sources.companyPages
          },
          timeoutMs: enrichmentConfig.budget.requestTimeoutMs,
          http: this.http,
          options: this.options,
          budget: enrichmentBudget,
          companyPageCache: this.companyPageCache
        });

        const extraction = extractEnrichmentValues(
          documents,
          `${title} ${location.displayLocation()} ${details.description_text ?? ""}`
        );

        if (enrichmentConfig.fields.emails && extraction.emails) {
          job.emails = mergeUniqueValues(job.emails, extraction.emails);
        }

        if (enrichmentConfig.fields.skills && extraction.skills) {
          job.skills = mergeUniqueValues(job.skills, extraction.skills);
        }

        if (enrichmentConfig.fields.seniority && !job.job_level && extraction.seniority) {
          job.job_level = extraction.seniority;
        }

        if (
          enrichmentConfig.fields.companyWebsite &&
          !job.company_url_direct &&
          extraction.companyWebsite
        ) {
          job.company_url_direct = extraction.companyWebsite;
        }

        if (enrichmentConfig.fields.workMode && !job.work_from_home_type && extraction.workMode) {
          job.work_from_home_type = extraction.workMode;
        }

        if (
          enrichmentConfig.fields.companySize &&
          !job.company_num_employees &&
          extraction.companySize
        ) {
          job.company_num_employees = extraction.companySize;
        }

        fieldConfidence = {
          ...(enrichmentConfig.fields.emails && extraction.fieldConfidence.emails
            ? { emails: extraction.fieldConfidence.emails }
            : {}),
          ...(enrichmentConfig.fields.skills && extraction.fieldConfidence.skills
            ? { skills: extraction.fieldConfidence.skills }
            : {}),
          ...(enrichmentConfig.fields.seniority && extraction.fieldConfidence.seniority
            ? { seniority: extraction.fieldConfidence.seniority }
            : {}),
          ...(enrichmentConfig.fields.companyWebsite && extraction.fieldConfidence.companyWebsite
            ? { companyWebsite: extraction.fieldConfidence.companyWebsite }
            : {}),
          ...(enrichmentConfig.fields.workMode && extraction.fieldConfidence.workMode
            ? { workMode: extraction.fieldConfidence.workMode }
            : {}),
          ...(enrichmentConfig.fields.companySize && extraction.fieldConfidence.companySize
            ? { companySize: extraction.fieldConfidence.companySize }
            : {})
        };

        sourcesUsed = Array.from(new Set(documents.map((document) => document.source)));
      } catch (error) {
        log.warn(`Enrichment failed for li-${jobId}: ${String(error)}`);
      }

      if (enrichmentConfig.exposeMeta) {
        job.enrichment_meta = {
          enabled: true,
          sources_used: sourcesUsed,
          budget_used: enrichmentBudget.usage(),
          field_confidence: fieldConfidence
        } satisfies EnrichmentMeta;
      }
    }

    return job;
  }

  private buildDetailDocument(jobId: string, details: LinkedInJobDetails): EnrichmentDocument | null {
    if (!details.page_text) {
      return null;
    }

    return {
      source: "jobDetailPage",
      url: `${this.baseUrl}/jobs/view/${jobId}`,
      domain: "www.linkedin.com",
      text: details.page_text,
      html: details.page_html
    };
  }

  private async getJobDetails(
    jobId: string,
    scraperInput: ScraperInput,
    timeoutMs: number
  ): Promise<LinkedInJobDetails> {
    let responseText: string;
    let finalUrl: string;

    try {
      const response = await this.http.requestText(`${this.baseUrl}/jobs/view/${jobId}`, {
        method: "GET",
        timeoutMs,
        headers: {
          ...headers,
          ...(this.options.userAgent ? { "user-agent": this.options.userAgent } : {})
        },
        site: Site.LINKEDIN,
        kind: "detail"
      });
      if (!response.ok) {
        return emptyJobDetails();
      }
      responseText = response.text;
      finalUrl = response.url;
    } catch {
      return emptyJobDetails();
    }

    if (finalUrl.includes("linkedin.com/signup")) {
      return emptyJobDetails();
    }

    const $ = cheerio.load(responseText);

    const descriptionNode = $("div.show-more-less-html__markup").first();
    let description: string | null = null;
    let descriptionText: string | null = null;
    if (descriptionNode.length > 0) {
      const cleanedHtml = removeAttributes($.html(descriptionNode));
      if (scraperInput.descriptionFormat === DescriptionFormat.MARKDOWN) {
        description = markdownConverter(cleanedHtml);
      } else if (scraperInput.descriptionFormat === DescriptionFormat.PLAIN) {
        description = plainConverter(cleanedHtml);
      } else {
        description = cleanedHtml;
      }
      descriptionText = plainConverter(cleanedHtml);
    }

    const jobFunctionHeader = $("h3")
      .filter((_idx, node) => $(node).text().trim() === "Job function")
      .first();
    const jobFunction =
      jobFunctionHeader
        .nextAll("span.description__job-criteria-text")
        .first()
        .text()
        .trim() || null;

    const logo = $("img.artdeco-entity-image").attr("data-delayed-url") ?? null;

    return {
      description,
      description_text: descriptionText,
      page_text: plainConverter(responseText),
      page_html: responseText,
      job_level: parseJobLevel(responseText),
      company_industry: parseCompanyIndustry(responseText),
      job_type: parseJobType(responseText),
      job_url_direct: this.parseJobUrlDirect($),
      company_logo: logo,
      job_function: jobFunction
    };
  }

  private getLocation(metadataCard: cheerio.Cheerio<Element>): Location {
    let location = new Location({ country: Country.WORLDWIDE });
    const locationString = metadataCard.find("span.job-search-card__location").text().trim();
    if (!locationString) {
      return location;
    }

    const parts = locationString.split(", ");
    if (parts.length === 2) {
      location = new Location({
        city: parts[0] ?? null,
        state: parts[1] ?? null,
        country: Country.WORLDWIDE
      });
    } else if (parts.length === 3) {
      const parsedCountry = Country.fromString(parts[2] ?? "worldwide");
      location = new Location({
        city: parts[0] ?? null,
        state: parts[1] ?? null,
        country: parsedCountry
      });
    }

    return location;
  }

  private parseJobUrlDirect($: cheerio.CheerioAPI): string | null {
    const codeContent = $("code#applyUrl").html()?.trim();
    if (!codeContent) {
      return null;
    }
    const match = codeContent.match(/\?url=([^\"]+)/);
    if (!match?.[1]) {
      return null;
    }
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  private async sleep(seconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
