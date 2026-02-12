import {
  DescriptionFormat,
  type JobPost,
  type JobResponse,
  Location,
  type ScraperInput,
  Scraper,
  Site
} from "../../model.js";
import { extractEmailsFromText } from "../../util/format.js";
import { extractJobType } from "../../util/salary.js";
import { asyncParam, headersInitial, headersJobs } from "./constant.js";
import { findJobInfo, findJobInfoInitialPage, log } from "./util.js";

export class GoogleScraper extends Scraper {
  private readonly jobsPerPage = 10;
  private readonly url = "https://www.google.com/search";
  private readonly jobsUrl = "https://www.google.com/async/callback:550";

  constructor(http: Scraper["http"], options: Scraper["options"] = {}) {
    super(Site.GOOGLE, http, options);
  }

  override async scrape(scraperInput: ScraperInput): Promise<JobResponse> {
    const wanted = Math.min(900, scraperInput.resultsWanted);
    const seenUrls = new Set<string>();

    const { forwardCursor: initialCursor, jobs: initialJobs } = await this.getInitialCursorAndJobs(
      scraperInput,
      seenUrls
    );

    if (!initialCursor) {
      log.warn("initial cursor not found, try changing your query or there were at most 10 results");
      return {
        jobs: initialJobs.slice(scraperInput.offset, scraperInput.offset + scraperInput.resultsWanted)
      };
    }

    let forwardCursor: string | null = initialCursor;
    let page = 1;
    const jobs: JobPost[] = [...initialJobs];

    while (seenUrls.size < wanted + scraperInput.offset && forwardCursor) {
      log.info(`search page: ${page} / ${Math.ceil(wanted / this.jobsPerPage)}`);

      try {
        const { jobsOnPage, nextCursor } = await this.getJobsNextPage(forwardCursor, scraperInput, seenUrls);
        if (jobsOnPage.length === 0) {
          log.info(`found no jobs on page: ${page}`);
          break;
        }
        jobs.push(...jobsOnPage);
        forwardCursor = nextCursor;
        page += 1;
      } catch (error) {
        log.error(`failed to get jobs on page: ${page}, ${String(error)}`);
        break;
      }
    }

    return {
      jobs: jobs.slice(scraperInput.offset, scraperInput.offset + scraperInput.resultsWanted)
    };
  }

  private async getInitialCursorAndJobs(
    scraperInput: ScraperInput,
    seenUrls: Set<string>
  ): Promise<{ forwardCursor: string | null; jobs: JobPost[] }> {
    let query = `${scraperInput.searchTerm ?? ""} jobs`.trim();

    const getTimeRange = (hoursOld: number): string => {
      if (hoursOld <= 24) {
        return "since yesterday";
      }
      if (hoursOld <= 72) {
        return "in the last 3 days";
      }
      if (hoursOld <= 168) {
        return "in the last week";
      }
      return "in the last month";
    };

    const jobTypeMapping: Record<string, string> = {
      fulltime: "Full time",
      parttime: "Part time",
      internship: "Internship",
      contract: "Contract"
    };

    if (scraperInput.jobType && jobTypeMapping[scraperInput.jobType]) {
      query += ` ${jobTypeMapping[scraperInput.jobType]}`;
    }

    if (scraperInput.location) {
      query += ` near ${scraperInput.location}`;
    }

    if (scraperInput.hoursOld) {
      query += ` ${getTimeRange(scraperInput.hoursOld)}`;
    }

    if (scraperInput.isRemote) {
      query += " remote";
    }

    if (scraperInput.googleSearchTerm) {
      query = scraperInput.googleSearchTerm;
    }

    const response = await this.http.requestText(this.url, {
      method: "GET",
      headers: {
        ...headersInitial,
        ...(this.options.userAgent ? { "user-agent": this.options.userAgent } : {})
      },
      query: {
        q: query,
        udm: "8"
      },
      site: Site.GOOGLE,
      kind: "list"
    });

    const match = response.text.match(/<div jsname="Yust4d"[^>]+data-async-fc="([^"]+)"/);
    const forwardCursor = match?.[1] ?? null;

    const jobsRaw = findJobInfoInitialPage(response.text);
    const jobs: JobPost[] = [];
    for (const item of jobsRaw) {
      if (!Array.isArray(item)) {
        continue;
      }
      const parsed = this.parseJob(item, seenUrls);
      if (parsed) {
        jobs.push(parsed);
      }
    }

    return {
      forwardCursor,
      jobs
    };
  }

  private async getJobsNextPage(
    forwardCursor: string,
    scraperInput: ScraperInput,
    seenUrls: Set<string>
  ): Promise<{ jobsOnPage: JobPost[]; nextCursor: string | null }> {
    const response = await this.http.requestText(this.jobsUrl, {
      method: "GET",
      headers: {
        ...headersJobs,
        ...(this.options.userAgent ? { "user-agent": this.options.userAgent } : {})
      },
      query: {
        fc: forwardCursor,
        fcv: "3",
        async: asyncParam
      },
      site: Site.GOOGLE,
      kind: "list"
    });

    return this.parseJobs(response.text, seenUrls, scraperInput);
  }

  private parseJobs(
    payload: string,
    seenUrls: Set<string>,
    _scraperInput: ScraperInput
  ): { jobsOnPage: JobPost[]; nextCursor: string | null } {
    const startIdx = payload.indexOf("[[[");
    const endIdx = payload.lastIndexOf("]]]") + 3;
    if (startIdx === -1 || endIdx === 2) {
      return { jobsOnPage: [], nextCursor: null };
    }

    const sliced = payload.slice(startIdx, endIdx);
    const parsed = JSON.parse(sliced) as unknown[];
    const outer = parsed[0];

    const match = payload.match(/data-async-fc="([^"]+)"/);
    const nextCursor = match?.[1] ?? null;

    const jobsOnPage: JobPost[] = [];
    if (!Array.isArray(outer)) {
      return { jobsOnPage, nextCursor };
    }

    for (const row of outer) {
      if (!Array.isArray(row) || row.length < 2) {
        continue;
      }
      const jobData = row[1];
      if (typeof jobData !== "string" || !jobData.startsWith("[[[")) {
        continue;
      }

      const parsedJobData = JSON.parse(jobData);
      const jobInfo = findJobInfo(parsedJobData);
      if (!Array.isArray(jobInfo)) {
        continue;
      }

      const parsedJob = this.parseJob(jobInfo, seenUrls);
      if (parsedJob) {
        jobsOnPage.push(parsedJob);
      }
    }

    return { jobsOnPage, nextCursor };
  }

  private parseJob(jobInfo: unknown[], seenUrls: Set<string>): JobPost | null {
    const url =
      Array.isArray(jobInfo[3]) &&
      Array.isArray((jobInfo[3] as unknown[])[0]) &&
      typeof ((jobInfo[3] as unknown[])[0] as unknown[])[0] === "string"
        ? (((jobInfo[3] as unknown[])[0] as unknown[])[0] as string)
        : null;

    if (!url || seenUrls.has(url)) {
      return null;
    }
    seenUrls.add(url);

    const title = typeof jobInfo[0] === "string" ? jobInfo[0] : "";
    const companyName = typeof jobInfo[1] === "string" ? jobInfo[1] : null;
    const locationRaw = typeof jobInfo[2] === "string" ? jobInfo[2] : null;

    let city: string | null = null;
    let state: string | null = null;
    let country: string | null = null;
    if (locationRaw && locationRaw.includes(",")) {
      const [cityPart, statePart, countryPart] = locationRaw.split(",").map((part) => part.trim());
      city = cityPart ?? null;
      state = statePart ?? null;
      country = countryPart ?? null;
    } else {
      city = locationRaw;
    }

    const daysAgoRaw = jobInfo[12];
    let datePosted: Date | null = null;
    if (typeof daysAgoRaw === "string") {
      const match = daysAgoRaw.match(/\d+/);
      const daysAgo = match ? Number.parseInt(match[0], 10) : null;
      if (daysAgo != null && Number.isFinite(daysAgo)) {
        datePosted = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
      }
    }

    const description = typeof jobInfo[19] === "string" ? jobInfo[19] : null;
    const idRaw = jobInfo[28];

    return {
      id: `go-${String(idRaw ?? "")}`,
      title,
      company_name: companyName,
      location: new Location({ city, state, country }),
      job_url: url,
      date_posted: datePosted,
      is_remote:
        (description?.toLowerCase().includes("remote") ?? false) ||
        (description?.toLowerCase().includes("wfh") ?? false),
      description:
        description && this.shouldNormalizeDescription() ? description : description,
      emails: extractEmailsFromText(description),
      job_type: extractJobType(description),
      site: Site.GOOGLE
    };
  }

  private shouldNormalizeDescription(): boolean {
    return true;
  }
}
