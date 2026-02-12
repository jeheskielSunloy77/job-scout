import {
  CompensationInterval,
  Country,
  DescriptionFormat,
  type JobPost,
  type JobResponse,
  Location,
  type ScraperInput,
  Scraper,
  Site
} from "../../model.js";
import { NaukriException } from "../../exception.js";
import { extractEmailsFromText, markdownConverter } from "../../util/format.js";
import { createLogger } from "../../util/logger.js";
import { headers as naukriHeaders } from "./constant.js";
import { isJobRemote, parseCompanyIndustry, parseJobType } from "./util.js";

const log = createLogger("Naukri");

interface Placeholder {
  type?: string;
  label?: string;
}

interface NaukriApiJob {
  jobId?: string;
  title?: string;
  companyName?: string;
  staticUrl?: string;
  placeholders?: Placeholder[];
  footerPlaceholderLabel?: string;
  createdDate?: number;
  jdURL?: string;
  jobDescription?: string;
  logoPathV3?: string;
  logoPath?: string;
  tagsAndSkills?: string;
  experienceText?: string;
  ambitionBoxData?: {
    AggregateRating?: string;
    ReviewsCount?: number;
  };
  vacancy?: number;
}

export class NaukriScraper extends Scraper {
  private readonly baseUrl = "https://www.naukri.com/jobapi/v3/search";
  private readonly delay = 3;
  private readonly bandDelay = 4;
  private readonly jobsPerPage = 20;

  constructor(http: Scraper["http"], options: Scraper["options"] = {}) {
    super(Site.NAUKRI, http, options);
    log.info("Naukri scraper initialized");
  }

  override async scrape(scraperInput: ScraperInput): Promise<JobResponse> {
    const jobs: JobPost[] = [];
    const seenIds = new Set<string>();

    let start = scraperInput.offset || 0;
    let page = Math.floor(start / this.jobsPerPage) + 1;
    let requestCount = 0;
    const secondsOld = scraperInput.hoursOld ? scraperInput.hoursOld * 3600 : null;

    const shouldContinue = (): boolean => {
      return jobs.length < scraperInput.resultsWanted && page <= 50;
    };

    while (shouldContinue()) {
      requestCount += 1;
      log.info(
        `Scraping page ${requestCount} / ${Math.ceil(scraperInput.resultsWanted / this.jobsPerPage)} for search term: ${scraperInput.searchTerm}`
      );

      const params: Record<string, string | number | null | undefined> = {
        noOfResults: this.jobsPerPage,
        urlType: "search_by_keyword",
        searchType: "adv",
        keyword: scraperInput.searchTerm,
        pageNo: page,
        k: scraperInput.searchTerm,
        seoKey: `${(scraperInput.searchTerm ?? "").toLowerCase().replace(/\s+/g, "-")}-jobs`,
        src: "jobsearchDesk",
        latLong: "",
        location: scraperInput.location,
        remote: scraperInput.isRemote ? "true" : null
      };
      if (secondsOld) {
        params.days = Math.floor(secondsOld / 86_400);
      }

      let jobDetails: NaukriApiJob[] = [];
      try {
        const response = await this.http.requestText(this.baseUrl, {
          method: "GET",
          query: params,
          timeoutMs: 10_000,
          headers: {
            ...naukriHeaders,
            ...(this.options.userAgent ? { "user-agent": this.options.userAgent } : {})
          },
          site: Site.NAUKRI,
          kind: "list"
        });

        if (response.status < 200 || response.status >= 400) {
          log.error(`Naukri API response status code ${response.status} - ${response.text}`);
          return { jobs };
        }

        const parsed = JSON.parse(response.text) as {
          jobDetails?: NaukriApiJob[];
        };
        jobDetails = parsed.jobDetails ?? [];

        log.info(`Received ${jobDetails.length} job entries from API`);
        if (jobDetails.length === 0) {
          log.warn("No job details found in API response");
          break;
        }
      } catch (error) {
        log.error(`Naukri API request failed: ${String(error)}`);
        return { jobs };
      }

      for (const job of jobDetails) {
        const jobId = job.jobId;
        if (!jobId || seenIds.has(jobId)) {
          continue;
        }
        seenIds.add(jobId);

        try {
          const fetchDesc = scraperInput.linkedinFetchDescription;
          const parsed = this.processJob(job, jobId, fetchDesc, scraperInput);
          if (parsed) {
            jobs.push(parsed);
            log.info(`Added job: ${parsed.title} (ID: ${jobId})`);
          }
          if (!shouldContinue()) {
            break;
          }
        } catch (error) {
          log.error(`Error processing job ID ${jobId}: ${String(error)}`);
          throw new NaukriException(String(error));
        }
      }

      if (shouldContinue()) {
        await this.sleep(this.delay + Math.random() * this.bandDelay);
        page += 1;
      }
    }

    log.info(`Scraping completed. Total jobs collected: ${jobs.length}`);
    return {
      jobs: jobs.slice(0, scraperInput.resultsWanted)
    };
  }

  private processJob(
    job: NaukriApiJob,
    jobId: string,
    fullDescription: boolean,
    scraperInput: ScraperInput
  ): JobPost {
    const title = job.title ?? "N/A";
    const company = job.companyName ?? "N/A";
    const companyUrl = job.staticUrl ? `https://www.naukri.com/${job.staticUrl}` : null;

    const location = this.getLocation(job.placeholders ?? []);
    const compensation = this.getCompensation(job.placeholders ?? []);
    const datePosted = this.parseDate(job.footerPlaceholderLabel ?? null, job.createdDate ?? null);

    const jobUrl = `https://www.naukri.com${job.jdURL ?? `/job/${jobId}`}`;
    const rawDescription = fullDescription ? job.jobDescription ?? null : null;

    const jobType = rawDescription ? parseJobType(rawDescription) : null;
    const companyIndustry = rawDescription ? parseCompanyIndustry(rawDescription) : null;

    let description = rawDescription;
    if (description && scraperInput.descriptionFormat === DescriptionFormat.MARKDOWN) {
      description = markdownConverter(description);
    }

    const remote = isJobRemote(title, description ?? "", location);
    const companyLogo = job.logoPathV3 ?? job.logoPath ?? null;

    const skills = job.tagsAndSkills
      ? job.tagsAndSkills
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : null;

    const experienceRange = job.experienceText ?? null;
    const ambitionBox = job.ambitionBoxData ?? {};
    const companyRating = ambitionBox.AggregateRating
      ? Number.parseFloat(ambitionBox.AggregateRating)
      : null;
    const companyReviewsCount = ambitionBox.ReviewsCount ?? null;
    const vacancyCount = job.vacancy ?? null;
    const workFromHomeType = this.inferWorkFromHomeType(
      job.placeholders ?? [],
      title,
      description ?? ""
    );

    return {
      id: `nk-${jobId}`,
      title,
      company_name: company,
      company_url: companyUrl,
      location,
      is_remote: remote,
      date_posted: datePosted,
      job_url: jobUrl,
      compensation: compensation ?? null,
      job_type: jobType,
      company_industry: companyIndustry,
      description,
      emails: extractEmailsFromText(description),
      company_logo: companyLogo,
      skills,
      experience_range: experienceRange,
      company_rating: companyRating,
      company_reviews_count: companyReviewsCount,
      vacancy_count: vacancyCount,
      work_from_home_type: workFromHomeType,
      site: Site.NAUKRI
    };
  }

  private getLocation(placeholders: Placeholder[]): Location {
    let location = new Location({ country: Country.INDIA });
    for (const placeholder of placeholders) {
      if (placeholder.type === "location") {
        const locationStr = placeholder.label ?? "";
        const parts = locationStr.split(", ");
        const city = parts[0] ?? null;
        const state = parts[1] ?? null;
        location = new Location({ city, state, country: Country.INDIA });
        log.debug(`Parsed location: ${location.displayLocation()}`);
        break;
      }
    }
    return location;
  }

  private getCompensation(placeholders: Placeholder[]): Exclude<JobPost["compensation"], undefined> {
    for (const placeholder of placeholders) {
      if (placeholder.type !== "salary") {
        continue;
      }

      const salaryText = (placeholder.label ?? "").trim();
      if (salaryText === "Not disclosed") {
        log.debug("Salary not disclosed");
        return null;
      }

      const match = salaryText.match(
        /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(Lacs|Lakh|Cr)\s*(P\.A\.)?/i
      );
      if (!match) {
        log.debug(`Could not parse salary: ${salaryText}`);
        return null;
      }

      let minSalary = Number.parseFloat(match[1] ?? "0");
      let maxSalary = Number.parseFloat(match[2] ?? "0");
      const unit = (match[3] ?? "").toLowerCase();

      if (unit === "lacs" || unit === "lakh") {
        minSalary *= 100000;
        maxSalary *= 100000;
      } else if (unit === "cr") {
        minSalary *= 10000000;
        maxSalary *= 10000000;
      }

      log.debug(`Parsed salary: ${minSalary} - ${maxSalary} INR`);
      return {
        min_amount: Math.trunc(minSalary),
        max_amount: Math.trunc(maxSalary),
        currency: "INR",
        interval: CompensationInterval.YEARLY
      };
    }

    return null;
  }

  private parseDate(label: string | null, createdDate: number | null): Date | null {
    const today = new Date();

    if (!label) {
      if (createdDate) {
        return new Date(createdDate);
      }
      return null;
    }

    const lowered = label.toLowerCase();
    if (
      lowered.includes("today") ||
      lowered.includes("just now") ||
      lowered.includes("few hours")
    ) {
      return today;
    }

    if (lowered.includes("ago")) {
      const match = lowered.match(/(\d+)\s*day/);
      if (match?.[1]) {
        const days = Number.parseInt(match[1], 10);
        return new Date(Date.now() - days * 24 * 3600 * 1000);
      }
    }

    if (createdDate) {
      return new Date(createdDate);
    }

    return null;
  }

  private inferWorkFromHomeType(
    placeholders: Placeholder[],
    title: string,
    description: string
  ): string | null {
    const locationString =
      placeholders.find((placeholder) => placeholder.type === "location")?.label?.toLowerCase() ?? "";

    const loweredTitle = title.toLowerCase();
    const loweredDescription = description.toLowerCase();

    if (
      locationString.includes("hybrid") ||
      loweredTitle.includes("hybrid") ||
      loweredDescription.includes("hybrid")
    ) {
      return "Hybrid";
    }

    if (
      locationString.includes("remote") ||
      loweredTitle.includes("remote") ||
      loweredDescription.includes("remote")
    ) {
      return "Remote";
    }

    if (
      loweredDescription.includes("work from office") ||
      (!loweredDescription.includes("remote") && !loweredDescription.includes("hybrid"))
    ) {
      return "Work from office";
    }

    return null;
  }

  private async sleep(seconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
