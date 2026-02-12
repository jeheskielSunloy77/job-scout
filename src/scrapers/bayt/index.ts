import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import { Country, type JobPost, type JobResponse, Location, type ScraperInput, Scraper, Site } from "@/core/model";
import { createLogger } from "@/util/logger";
import { baseUrl } from "@/scrapers/bayt/constant";
import { extractJobUrl } from "@/scrapers/bayt/util";

const log = createLogger("Bayt");

export class BaytScraper extends Scraper {
  private readonly delay = 2;
  private readonly bandDelay = 3;
  private readonly country = "worldwide";

  constructor(http: Scraper["http"], options: Scraper["options"] = {}) {
    super(Site.BAYT, http, options);
  }

  override async scrape(scraperInput: ScraperInput): Promise<JobResponse> {
    const jobs: JobPost[] = [];
    let page = 1;
    const wanted = scraperInput.resultsWanted || 10;

    while (jobs.length < wanted) {
      log.info(`Fetching Bayt jobs page ${page}`);
      const cards = await this.fetchJobs(scraperInput.searchTerm ?? "", page);
      if (cards.length === 0) {
        break;
      }

      const initialCount = jobs.length;
      for (const card of cards) {
        const parsed = this.extractJob(card);
        if (parsed) {
          jobs.push(parsed);
          if (jobs.length >= wanted) {
            break;
          }
        }
      }

      if (jobs.length === initialCount) {
        log.info(`No new jobs found on page ${page}. Ending pagination.`);
        break;
      }

      page += 1;
      await this.sleep(this.delay + Math.random() * this.bandDelay);
    }

    return {
      jobs: jobs.slice(0, scraperInput.resultsWanted)
    };
  }

  private async fetchJobs(query: string, page: number): Promise<cheerio.Cheerio<Element>[]> {
    try {
      const url = `${baseUrl}/en/international/jobs/${query}-jobs/?page=${page}`;
      const response = await this.http.requestText(url, {
        site: Site.BAYT,
        kind: "list"
      });
      if (!response.ok) {
        return [];
      }
      const $ = cheerio.load(response.text);
      return $("li[data-js-job='']").toArray().map((node) => $(node));
    } catch (error) {
      log.error(`Bayt: Error fetching jobs - ${String(error)}`);
      return [];
    }
  }

  private extractJob(card: cheerio.Cheerio<Element>): JobPost | null {
    const title = card.find("h2").first().text().trim();
    if (!title) {
      return null;
    }

    const jobUrl = extractJobUrl(baseUrl, card);
    if (!jobUrl) {
      return null;
    }

    const companyName = card.find("div.t-nowrap.p10l span").first().text().trim() || null;
    const locationText = card.find("div.t-mute.t-small").first().text().trim() || null;

    const id = `bayt-${Math.abs(this.hashCode(jobUrl))}`;

    return {
      id,
      title,
      company_name: companyName,
      location: new Location({
        city: locationText,
        country: Country.fromString(this.country)
      }),
      job_url: jobUrl,
      site: Site.BAYT
    };
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
