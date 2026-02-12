import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import { BDJobsException } from "@/scrapers/exception";
import {
  DescriptionFormat,
  type JobPost,
  type JobResponse,
  type ScraperInput,
  Scraper,
  Site
} from "@/core/model";
import { extractEmailsFromText, markdownConverter, removeAttributes } from "@/util/format";
import { createLogger } from "@/util/logger";
import { headers, searchParams } from "@/scrapers/bdjobs/constant";
import { findJobListings, isJobRemote, parseDate, parseLocation } from "@/scrapers/bdjobs/util";

const log = createLogger("BDJobs");

export class BDJobsScraper extends Scraper {
  private readonly baseUrl = "https://jobs.bdjobs.com";
  private readonly searchUrl = "https://jobs.bdjobs.com/jobsearch.asp";
  private readonly delay = 2;
  private readonly bandDelay = 3;
  private readonly country = "bangladesh";

  constructor(http: Scraper["http"], options: Scraper["options"] = {}) {
    super(Site.BDJOBS, http, options);
  }

  override async scrape(scraperInput: ScraperInput): Promise<JobResponse> {
    const jobs: JobPost[] = [];
    const seenIds = new Set<string>();

    let page = 1;
    let requestCount = 0;

    const params: Record<string, string | number> = {
      ...searchParams,
      txtsearch: scraperInput.searchTerm ?? ""
    };

    const shouldContinue = (): boolean => jobs.length < scraperInput.resultsWanted;

    while (shouldContinue()) {
      requestCount += 1;
      log.info(`search page: ${requestCount}`);

      try {
        if (page > 1) {
          params.pg = page;
        }

        const response = await this.http.requestText(this.searchUrl, {
          method: "GET",
          query: params,
          timeoutMs: scraperInput.requestTimeout * 1000,
          headers: {
            ...headers,
            ...(this.options.userAgent ? { "User-Agent": this.options.userAgent } : {})
          },
          site: Site.BDJOBS,
          kind: "list"
        });

        if (response.status !== 200) {
          log.error(`BDJobs response status code ${response.status}`);
          break;
        }

        const $ = cheerio.load(response.text);
        const jobCards = findJobListings($);

        if (jobCards.length === 0) {
          log.info("No more job listings found");
          break;
        }

        log.info(`Found ${jobCards.length} job cards on page ${page}`);

        for (const jobCard of jobCards) {
          try {
            const post = await this.processJob($, jobCard, scraperInput);
            if (post && post.id && !seenIds.has(post.id)) {
              seenIds.add(post.id);
              jobs.push(post);
              if (!shouldContinue()) {
                break;
              }
            }
          } catch (error) {
            log.error(`Error processing job card: ${String(error)}`);
          }
        }

        page += 1;
        await this.sleep(this.delay + Math.random() * this.bandDelay);
      } catch (error) {
        log.error(`Error during scraping: ${String(error)}`);
        break;
      }
    }

    return {
      jobs: jobs.slice(0, scraperInput.resultsWanted)
    };
  }

  private async processJob(
    $: cheerio.CheerioAPI,
    jobCard: Element,
    scraperInput: ScraperInput
  ): Promise<JobPost | null> {
    try {
      const card = $(jobCard);
      const jobLink = card
        .find("a")
        .filter((_idx, node) => ($(node).attr("href") ?? "").toLowerCase().includes("jobdetail"))
        .first();
      if (jobLink.length === 0) {
        return null;
      }

      let jobUrl = jobLink.attr("href") ?? "";
      if (!jobUrl.startsWith("http")) {
        jobUrl = new URL(jobUrl, this.baseUrl).toString();
      }

      const idMatch = jobUrl.match(/jobid=([^&]+)/i);
      const jobId = idMatch?.[1] ?? `bdjobs-${Math.abs(this.hashCode(jobUrl))}`;

      let title = jobLink.text().trim();
      if (!title) {
        title =
          card
            .find("h2, h3, h4, strong, div")
            .filter((_idx, node) => ($(node).attr("class") ?? "").includes("job-title-text"))
            .first()
            .text()
            .trim() || "N/A";
      }

      let companyName =
        card
          .find("span, div")
          .filter((_idx, node) => (($(node).attr("class") ?? "").toLowerCase().includes("comp-name-text")))
          .first()
          .text()
          .trim() || "";

      if (!companyName) {
        companyName =
          card
            .find("span, div")
            .filter((_idx, node) => {
              const className = ($(node).attr("class") ?? "").toLowerCase();
              return ["company", "org", "comp-name"].some((term) => className.includes(term));
            })
            .first()
            .text()
            .trim() ||
          "N/A";
      }

      let locationText =
        card
          .find("span, div")
          .filter((_idx, node) => (($(node).attr("class") ?? "").toLowerCase().includes("locon-text-d")))
          .first()
          .text()
          .trim() || "";

      if (!locationText) {
        locationText =
          card
            .find("span, div")
            .filter((_idx, node) => {
              const className = ($(node).attr("class") ?? "").toLowerCase();
              return ["location", "area", "locon"].some((term) => className.includes(term));
            })
            .first()
            .text()
            .trim() || "Dhaka, Bangladesh";
      }

      const location = parseLocation(locationText, this.country);

      const dateText =
        card
          .find("span, div")
          .filter((_idx, node) => {
            const className = ($(node).attr("class") ?? "").toLowerCase();
            return ["date", "deadline", "published"].some((term) => className.includes(term));
          })
          .first()
          .text()
          .trim();

      const datePosted = dateText ? parseDate(dateText) : null;
      const remote = isJobRemote(title, null, location);

      const details = await this.getJobDetails(jobUrl, scraperInput);

      return {
        id: jobId,
        title,
        company_name: companyName,
        location,
        date_posted: datePosted,
        job_url: jobUrl,
        is_remote: remote,
        description: details.description ?? "",
        job_type: details.jobType,
        company_industry: details.companyIndustry,
        emails: extractEmailsFromText(details.description),
        site: Site.BDJOBS
      };
    } catch (error) {
      throw new BDJobsException(`Error in processJob: ${String(error)}`);
    }
  }

  private async getJobDetails(
    jobUrl: string,
    scraperInput: ScraperInput
  ): Promise<{ description: string | null; jobType: null; companyIndustry: string | null }> {
    try {
      const response = await this.http.requestText(jobUrl, {
        method: "GET",
        timeoutMs: 60_000,
        headers: {
          ...headers,
          ...(this.options.userAgent ? { "User-Agent": this.options.userAgent } : {})
        },
        site: Site.BDJOBS,
        kind: "detail"
      });

      if (!response.ok) {
        return { description: null, jobType: null, companyIndustry: null };
      }

      const $ = cheerio.load(response.text);
      let description = "";

      const jobContentDiv = $("div.jobcontent").first();
      if (jobContentDiv.length > 0) {
        const heading =
          jobContentDiv.find("h4#job_resp").first().length > 0
            ? jobContentDiv.find("h4#job_resp").first()
            : jobContentDiv
                .find("h4, h5")
                .filter((_idx, node) => ($(node).text() ?? "").toLowerCase().includes("responsibilities"))
                .first();

        if (heading.length > 0) {
          const responsibilityElements: string[] = [];
          for (const sibling of heading.nextAll().toArray()) {
            if (["hr", "h4", "h5"].includes((sibling.tagName ?? "").toLowerCase())) {
              break;
            }
            const siblingNode = $(sibling);
            if (siblingNode.is("ul")) {
              siblingNode.find("li").each((_idx, li) => {
                const text = $(li).text().trim();
                if (text) {
                  responsibilityElements.push(text);
                }
              });
            } else if (siblingNode.is("p")) {
              const text = siblingNode.text().trim();
              if (text) {
                responsibilityElements.push(text);
              }
            }
          }

          description = responsibilityElements.join("\n");
        }
      }

      if (!description) {
        const descriptionElement =
          $("div, section")
            .filter((_idx, node) => {
              const className = ($(node).attr("class") ?? "").toLowerCase();
              return ["job-description", "details", "requirements"].some((term) => className.includes(term));
            })
            .first() ?? null;

        if (descriptionElement && descriptionElement.length > 0) {
          const cleaned = removeAttributes($.html(descriptionElement) ?? "");
          description =
            scraperInput.descriptionFormat === DescriptionFormat.MARKDOWN
              ? (markdownConverter(cleaned) ?? cleaned)
              : cleaned;
        }
      }

      let companyIndustry: string | null = null;
      const industryLabel =
        $("span, div")
          .filter((_idx, node) => ($(node).text() ?? "").toLowerCase().includes("industry"))
          .first() ?? null;
      if (industryLabel && industryLabel.length > 0) {
        companyIndustry = industryLabel.next("span, div").first().text().trim() || null;
      }

      return {
        description: description || null,
        jobType: null,
        companyIndustry
      };
    } catch (error) {
      log.error(`Error getting job details: ${String(error)}`);
      return { description: null, jobType: null, companyIndustry: null };
    }
  }

  private hashCode(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  private async sleep(seconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
