import { GlassdoorException } from "../../exception.js";
import {
  DescriptionFormat,
  type JobPost,
  type JobResponse,
  type ScraperInput,
  Scraper,
  Site
} from "../../model.js";
import { extractEmailsFromText, markdownConverter } from "../../util/format.js";
import { createLogger } from "../../util/logger.js";
import { fallbackToken, headers, queryTemplate } from "./constant.js";
import { getCursorForPage, parseCompensation, parseLocation } from "./util.js";

const log = createLogger("Glassdoor");

interface GlassdoorLocation {
  locationId: number;
  locationType: string;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export class GlassdoorScraper extends Scraper {
  private readonly jobsPerPage = 30;
  private readonly maxPages = 30;

  constructor(http: Scraper["http"], options: Scraper["options"] = {}) {
    super(Site.GLASSDOOR, http, options);
  }

  override async scrape(scraperInput: ScraperInput): Promise<JobResponse> {
    const wanted = Math.min(900, scraperInput.resultsWanted);
    const country = scraperInput.country;
    if (!country) {
      return { jobs: [] };
    }

    const baseUrl = country.getGlassdoorUrl();
    const token = await this.getCsrfToken(baseUrl);

    const requestHeaders = {
      ...headers,
      "gd-csrf-token": token ?? fallbackToken,
      ...(this.options.userAgent ? { "user-agent": this.options.userAgent } : {})
    };

    const location = await this.getLocation(baseUrl, scraperInput.location ?? null, scraperInput.isRemote, requestHeaders);
    if (!location) {
      log.error("Glassdoor: location not parsed");
      return { jobs: [] };
    }

    const jobs: JobPost[] = [];
    const seenUrls = new Set<string>();
    let cursor: string | null = null;

    const rangeStart = 1 + Math.floor(scraperInput.offset / this.jobsPerPage);
    const totalPages = Math.floor(wanted / this.jobsPerPage) + 2;
    const rangeEnd = Math.min(totalPages, this.maxPages + 1);

    for (let page = rangeStart; page < rangeEnd; page += 1) {
      log.info(`search page: ${page} / ${rangeEnd - 1}`);
      try {
        const { jobsOnPage, nextCursor } = await this.fetchJobsPage(
          baseUrl,
          requestHeaders,
          scraperInput,
          location,
          page,
          cursor,
          seenUrls
        );
        jobs.push(...jobsOnPage);
        cursor = nextCursor;

        if (jobsOnPage.length === 0 || jobs.length >= wanted) {
          break;
        }
      } catch (error) {
        log.error(`Glassdoor: ${String(error)}`);
        break;
      }
    }

    return {
      jobs: jobs.slice(0, scraperInput.resultsWanted)
    };
  }

  private async fetchJobsPage(
    baseUrl: string,
    requestHeaders: Record<string, string>,
    scraperInput: ScraperInput,
    location: GlassdoorLocation,
    pageNum: number,
    cursor: string | null,
    seenUrls: Set<string>
  ): Promise<{ jobsOnPage: JobPost[]; nextCursor: string | null }> {
    const payload = this.addPayload(scraperInput, location.locationId, location.locationType, pageNum, cursor);

    const response = await this.http.requestText(joinUrl(baseUrl, "graph"), {
      method: "POST",
      headers: requestHeaders,
      body: payload,
      timeoutMs: 15_000,
      site: Site.GLASSDOOR,
      kind: "list"
    });

    if (response.status !== 200) {
      throw new GlassdoorException(`bad response status code: ${response.status}`);
    }

    const parsed = JSON.parse(response.text) as Array<{
      data?: {
        jobListings?: {
          jobListings?: Array<Record<string, unknown>>;
          paginationCursors?: Array<{ pageNumber?: number; cursor?: string }>;
        };
      };
      errors?: unknown;
    }>;

    const responseNode = parsed[0];
    if (!responseNode || responseNode.errors) {
      throw new GlassdoorException("Error encountered in API response");
    }

    const jobsData = responseNode.data?.jobListings?.jobListings ?? [];
    const jobsOnPage: JobPost[] = [];

    const processed = await Promise.all(
      jobsData.map((job) => this.processJob(baseUrl, requestHeaders, scraperInput, job, seenUrls))
    );

    for (const job of processed) {
      if (job) {
        jobsOnPage.push(job);
      }
    }

    return {
      jobsOnPage,
      nextCursor: getCursorForPage(responseNode.data?.jobListings?.paginationCursors, pageNum + 1)
    };
  }

  private async getCsrfToken(baseUrl: string): Promise<string | null> {
    const response = await this.http.requestText(joinUrl(baseUrl, "Job/computer-science-jobs.htm"), {
      method: "GET",
      site: Site.GLASSDOOR,
      kind: "detail"
    });

    const matches = [...response.text.matchAll(/"token":\s*"([^"]+)"/g)];
    return matches[0]?.[1] ?? null;
  }

  private async processJob(
    baseUrl: string,
    requestHeaders: Record<string, string>,
    scraperInput: ScraperInput,
    jobData: Record<string, unknown>,
    seenUrls: Set<string>
  ): Promise<JobPost | null> {
    const jobView = (jobData.jobview as Record<string, unknown> | undefined) ?? undefined;
    if (!jobView) {
      return null;
    }

    const header = (jobView.header as Record<string, unknown> | undefined) ?? {};
    const jobNode = (jobView.job as Record<string, unknown> | undefined) ?? {};
    const listingId = String(jobNode.listingId ?? "");
    if (!listingId) {
      return null;
    }

    const jobUrl = joinUrl(baseUrl, `job-listing/j?jl=${listingId}`);
    if (seenUrls.has(jobUrl)) {
      return null;
    }
    seenUrls.add(jobUrl);

    const ageInDays = Number(header.ageInDays ?? NaN);
    const datePosted = Number.isFinite(ageInDays)
      ? new Date(Date.now() - ageInDays * 24 * 3600 * 1000)
      : null;

    const locationType = String(header.locationType ?? "");
    const locationName = String(header.locationName ?? "");

    const isRemote = locationType === "S";
    const location = isRemote ? null : parseLocation(locationName);

    const description = await this.fetchJobDescription(
      baseUrl,
      requestHeaders,
      listingId,
      scraperInput.descriptionFormat
    );

    const employer = (header.employer as Record<string, unknown> | undefined) ?? {};
    const companyId = employer.id;
    const companyUrl = companyId ? joinUrl(baseUrl, `Overview/W-EI_IE${companyId}.htm`) : null;

    const overview = (jobView.overview as Record<string, unknown> | undefined) ?? {};

    return {
      id: `gd-${listingId}`,
      title: String(jobNode.jobTitleText ?? ""),
      company_url: companyUrl,
      company_name: String(header.employerNameFromSearch ?? ""),
      date_posted: datePosted,
      job_url: jobUrl,
      location,
      compensation: parseCompensation({
        payPeriod: typeof header.payPeriod === "string" ? header.payPeriod : null,
        payPeriodAdjustedPay:
          typeof header.payPeriodAdjustedPay === "object"
            ? (header.payPeriodAdjustedPay as { p10?: number; p90?: number })
            : null,
        payCurrency: typeof header.payCurrency === "string" ? header.payCurrency : null
      }),
      is_remote: isRemote,
      description,
      emails: extractEmailsFromText(description),
      company_logo: typeof overview.squareLogoUrl === "string" ? overview.squareLogoUrl : null,
      listing_type:
        typeof header.adOrderSponsorshipLevel === "string"
          ? header.adOrderSponsorshipLevel.toLowerCase()
          : null,
      site: Site.GLASSDOOR
    };
  }

  private async fetchJobDescription(
    baseUrl: string,
    requestHeaders: Record<string, string>,
    jobId: string,
    format: DescriptionFormat
  ): Promise<string | null> {
    const body = [
      {
        operationName: "JobDetailQuery",
        variables: {
          jl: jobId,
          queryString: "q",
          pageTypeEnum: "SERP"
        },
        query: `
                query JobDetailQuery($jl: Long!, $queryString: String, $pageTypeEnum: PageTypeEnum) {
                    jobview: jobView(
                        listingId: $jl
                        contextHolder: {queryString: $queryString, pageTypeEnum: $pageTypeEnum}
                    ) {
                        job {
                            description
                            __typename
                        }
                        __typename
                    }
                }
                `
      }
    ];

    const response = await this.http.requestText(joinUrl(baseUrl, "graph"), {
      method: "POST",
      headers: requestHeaders,
      json: body,
      site: Site.GLASSDOOR,
      kind: "detail"
    });

    if (!response.ok) {
      return null;
    }

    const parsed = JSON.parse(response.text) as Array<{
      data?: {
        jobview?: {
          job?: { description?: string };
        };
      };
    }>;

    let description = parsed[0]?.data?.jobview?.job?.description ?? null;
    if (!description) {
      return null;
    }

    if (format === DescriptionFormat.MARKDOWN) {
      description = markdownConverter(description);
    }

    return description;
  }

  private async getLocation(
    baseUrl: string,
    location: string | null,
    isRemote: boolean,
    requestHeaders: Record<string, string>
  ): Promise<GlassdoorLocation | null> {
    if (!location || isRemote) {
      return {
        locationId: 11047,
        locationType: "STATE"
      };
    }

    const response = await this.http.requestText(
      joinUrl(baseUrl, "findPopularLocationAjax.htm"),
      {
        method: "GET",
        query: {
          maxLocationsToReturn: 10,
          term: location
        },
        headers: requestHeaders,
        site: Site.GLASSDOOR,
        kind: "list"
      }
    );

    if (response.status !== 200) {
      if (response.status === 429) {
        log.error("429 Response - Blocked by Glassdoor for too many requests");
      } else {
        log.error(`Glassdoor response status code ${response.status}`);
      }
      return null;
    }

    const items = JSON.parse(response.text) as Array<{ locationType?: string; locationId?: number }>;
    if (items.length === 0) {
      throw new Error(`Location '${location}' not found on Glassdoor`);
    }

    const item = items[0];
    if (!item) {
      return null;
    }
    const mappedLocationType =
      item.locationType === "C"
        ? "CITY"
        : item.locationType === "S"
          ? "STATE"
          : item.locationType === "N"
            ? "COUNTRY"
            : item.locationType;

    if (!item.locationId || !mappedLocationType) {
      return null;
    }

    return {
      locationId: item.locationId,
      locationType: mappedLocationType
    };
  }

  private addPayload(
    scraperInput: ScraperInput,
    locationId: number,
    locationType: string,
    pageNum: number,
    cursor: string | null
  ): string {
    const fromAge = scraperInput.hoursOld ? Math.max(Math.floor(scraperInput.hoursOld / 24), 1) : null;
    const filterParams: Array<{ filterKey: string; values: string }> = [];

    if (scraperInput.easyApply) {
      filterParams.push({ filterKey: "applicationType", values: "1" });
    }

    if (fromAge) {
      filterParams.push({ filterKey: "fromAge", values: String(fromAge) });
    }

    if (scraperInput.jobType) {
      filterParams.push({ filterKey: "jobType", values: scraperInput.jobType });
    }

    return JSON.stringify([
      {
        operationName: "JobSearchResultsQuery",
        variables: {
          excludeJobListingIds: [],
          filterParams,
          keyword: scraperInput.searchTerm,
          numJobsToShow: 30,
          locationType,
          locationId,
          parameterUrlInput: `IL.0,12_I${locationType}${locationId}`,
          pageNumber: pageNum,
          pageCursor: cursor,
          fromage: fromAge,
          sort: "date"
        },
        query: queryTemplate
      }
    ]);
  }
}
