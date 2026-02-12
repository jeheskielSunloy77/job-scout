import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import { LinkedInException } from "@/scrapers/exception";
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

const log = createLogger("LinkedIn");

export class LinkedInScraper extends Scraper {
  private readonly baseUrl = "https://www.linkedin.com";
  private readonly delay = 3;
  private readonly bandDelay = 4;

  constructor(http: Scraper["http"], options: Scraper["options"] = {}) {
    super(Site.LINKEDIN, http, options);
  }

  override async scrape(scraperInput: ScraperInput): Promise<JobResponse> {
    const jobList: JobPost[] = [];
    const seenIds = new Set<string>();

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
          const job = await this.processJob($, card, jobId, scraperInput.linkedinFetchDescription, scraperInput);
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
    fullDescription: boolean,
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

    const details = fullDescription ? await this.getJobDetails(jobId, scraperInput) : {};
    const description = (details.description as string | null | undefined) ?? null;
    const remote = isJobRemote(title, description, location);

    return {
      id: `li-${jobId}`,
      title,
      company_name: company,
      company_url: companyUrl || null,
      location,
      is_remote: remote,
      date_posted: datePosted,
      job_url: `${this.baseUrl}/jobs/view/${jobId}`,
      compensation,
      job_type: (details.job_type as JobPost["job_type"]) ?? null,
      job_level: typeof details.job_level === "string" ? details.job_level.toLowerCase() : null,
      company_industry: (details.company_industry as string | null | undefined) ?? null,
      description,
      job_url_direct: (details.job_url_direct as string | null | undefined) ?? null,
      emails: extractEmailsFromText(description),
      company_logo: (details.company_logo as string | null | undefined) ?? null,
      job_function: (details.job_function as string | null | undefined) ?? null,
      site: Site.LINKEDIN
    };
  }

  private async getJobDetails(jobId: string, scraperInput: ScraperInput): Promise<Record<string, unknown>> {
    let responseText: string;
    let finalUrl: string;

    try {
      const response = await this.http.requestText(`${this.baseUrl}/jobs/view/${jobId}`, {
        method: "GET",
        timeoutMs: 5_000,
        headers: {
          ...headers,
          ...(this.options.userAgent ? { "user-agent": this.options.userAgent } : {})
        },
        site: Site.LINKEDIN,
        kind: "detail"
      });
      if (!response.ok) {
        return {};
      }
      responseText = response.text;
      finalUrl = response.url;
    } catch {
      return {};
    }

    if (finalUrl.includes("linkedin.com/signup")) {
      return {};
    }

    const $ = cheerio.load(responseText);

    const descriptionNode = $("div.show-more-less-html__markup").first();
    let description: string | null = null;
    if (descriptionNode.length > 0) {
      const cleanedHtml = removeAttributes($.html(descriptionNode));
      if (scraperInput.descriptionFormat === DescriptionFormat.MARKDOWN) {
        description = markdownConverter(cleanedHtml);
      } else if (scraperInput.descriptionFormat === DescriptionFormat.PLAIN) {
        description = plainConverter(cleanedHtml);
      } else {
        description = cleanedHtml;
      }
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
