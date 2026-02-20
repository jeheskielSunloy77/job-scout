import { describe, expect, it } from "bun:test";

import type { HttpResult } from "../src/util/http";
import { Country, DescriptionFormat, type ResolvedEnrichmentConfig } from "../src/core/model";
import { LinkedInScraper } from "../src/scrapers/linkedin";

const LIST_RESPONSE = `
<div class="base-search-card">
  <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/software-engineer-123?trk=public_jobs_jserp-result_search-card"></a>
  <span class="sr-only">Senior Software Engineer</span>
  <h4 class="base-search-card__subtitle">
    <a href="https://www.linkedin.com/company/acme">Acme</a>
  </h4>
  <div class="base-search-card__metadata">
    <span class="job-search-card__location">Austin, TX, USA</span>
    <time class="job-search-card__listdate" datetime="2026-02-10"></time>
  </div>
</div>
`;

const DETAIL_RESPONSE = `
<div class="show-more-less-html__markup">
  Senior role building TypeScript services with Node.js and AWS.
</div>
<h3 class="description__job-criteria-subheader">Employment type</h3>
<span class="description__job-criteria-text description__job-criteria-text--criteria">Full-time</span>
<h3>Job function</h3>
<span class="description__job-criteria-text">Engineering</span>
<code id="applyUrl">https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fapply.example%2Fjobs%2F123</code>
<img class="artdeco-entity-image" data-delayed-url="https://cdn.example/logo.png" />
`;

const APPLY_RESPONSE = `
<html>
  <body>
    Email us at talent [at] example [dot] com
    <a href="mailto:hiring@example.com">Apply</a>
  </body>
</html>
`;

const COMPANY_CAREERS_RESPONSE = `
<html>
  <body>
    Hybrid role. Company size: 51-200 employees.
  </body>
</html>
`;

class MockHttpClient {
  readonly requests: string[] = [];

  async requestText(url: string): Promise<HttpResult> {
    this.requests.push(url);

    if (url.includes("/jobs-guest/jobs/api/seeMoreJobPostings/search")) {
      return this.ok(url, LIST_RESPONSE);
    }

    if (url.includes("/jobs/view/123")) {
      return this.ok(url, DETAIL_RESPONSE);
    }

    if (url === "https://apply.example/jobs/123") {
      return this.ok(url, APPLY_RESPONSE);
    }

    if (url === "https://apply.example/careers") {
      return this.ok(url, COMPANY_CAREERS_RESPONSE);
    }

    if (url === "https://apply.example/about") {
      return this.ok(url, "<html><body>About us</body></html>");
    }

    if (url === "https://apply.example/contact") {
      return this.ok(url, "<html><body>Contact</body></html>");
    }

    return {
      status: 404,
      ok: false,
      text: "not found",
      headers: new Headers({ "content-type": "text/html" }),
      url
    };
  }

  private ok(url: string, text: string): HttpResult {
    return {
      status: 200,
      ok: true,
      text,
      headers: new Headers({ "content-type": "text/html" }),
      url
    };
  }
}

function enrichmentConfig(
  overrides: Partial<ResolvedEnrichmentConfig> = {}
): ResolvedEnrichmentConfig {
  return {
    enabled: false,
    mode: "off",
    budget: {
      maxExtraRequestsPerJob: 0,
      maxPagesPerDomain: 0,
      requestTimeoutMs: 0
    },
    sources: {
      jobDetailPage: false,
      externalApplyPage: false,
      companyPages: false
    },
    fields: {
      emails: false,
      skills: false,
      seniority: false,
      companyWebsite: false,
      workMode: false,
      companySize: false
    },
    exposeMeta: false,
    ...overrides
  };
}

function buildInput(overrides: Partial<ResolvedEnrichmentConfig> = {}) {
  return {
    siteType: [],
    country: Country.USA,
    searchTerm: "software engineer",
    googleSearchTerm: null,
    location: "Austin, TX",
    distance: 25,
    isRemote: false,
    jobType: null,
    easyApply: null,
    offset: 0,
    linkedinFetchDescription: false,
    linkedinCompanyIds: null,
    linkedinEnrichment: enrichmentConfig(overrides),
    descriptionFormat: DescriptionFormat.MARKDOWN,
    requestTimeout: 60,
    resultsWanted: 1,
    hoursOld: null
  };
}

describe("LinkedIn enrichment integration", () => {
  it("keeps baseline behavior when enrichment is disabled", async () => {
    const mockHttp = new MockHttpClient();
    const scraper = new LinkedInScraper(mockHttp as any);

    const response = await scraper.scrape(buildInput());
    const first = response.jobs[0];

    expect(response.jobs.length).toBe(1);
    expect(first?.description).toBe(null);
    expect(first?.emails).toBe(null);
    expect(first?.skills).toBe(undefined);
    expect(first?.enrichment_meta).toBe(undefined);
    expect(
      mockHttp.requests.includes(
        "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
      )
    ).toBe(true);
  });

  it("enriches fields while keeping description null when fetchDescription is false", async () => {
    const mockHttp = new MockHttpClient();
    const scraper = new LinkedInScraper(mockHttp as any);

    const response = await scraper.scrape(
      buildInput({
        enabled: true,
        mode: "medium",
        budget: {
          maxExtraRequestsPerJob: 4,
          maxPagesPerDomain: 3,
          requestTimeoutMs: 4000
        },
        sources: {
          jobDetailPage: true,
          externalApplyPage: true,
          companyPages: true
        },
        fields: {
          emails: true,
          skills: true,
          seniority: true,
          companyWebsite: true,
          workMode: true,
          companySize: true
        }
      })
    );

    const first = response.jobs[0];
    expect(first?.description).toBe(null);
    expect(first?.emails?.includes("hiring@example.com")).toBe(true);
    expect(first?.skills?.includes("TypeScript")).toBe(true);
    expect(first?.skills?.includes("Node.js")).toBe(true);
    expect(first?.job_level).toBe("senior");
    expect(first?.work_from_home_type).toBe("Hybrid");
    expect(first?.company_num_employees).toBe("51-200");
    expect(first?.enrichment_meta).toBe(undefined);
  });

  it("exposes enrichment metadata only when requested", async () => {
    const mockHttp = new MockHttpClient();
    const scraper = new LinkedInScraper(mockHttp as any);

    const response = await scraper.scrape(
      buildInput({
        enabled: true,
        mode: "medium",
        exposeMeta: true,
        budget: {
          maxExtraRequestsPerJob: 4,
          maxPagesPerDomain: 3,
          requestTimeoutMs: 4000
        },
        sources: {
          jobDetailPage: true,
          externalApplyPage: true,
          companyPages: true
        },
        fields: {
          emails: true,
          skills: true,
          seniority: true,
          companyWebsite: true,
          workMode: true,
          companySize: true
        }
      })
    );

    const meta = response.jobs[0]?.enrichment_meta;
    expect(meta == null).toBe(false);
    expect(meta?.enabled).toBe(true);
    expect(meta?.sources_used.includes("jobDetailPage")).toBe(true);
    expect(meta?.sources_used.includes("externalApplyPage")).toBe(true);
    expect(meta?.sources_used.includes("companyPages")).toBe(true);
    expect(meta?.budget_used.requests).toBeGreaterThan(0);
  });

  it("is fail-soft when enrichment internals throw", async () => {
    const mockHttp = new MockHttpClient();
    const scraper = new LinkedInScraper(mockHttp as any);
    const rejectingCache = Promise.resolve().then(() => {
      throw new Error("cache failure");
    });
    rejectingCache.catch(() => {
      // Prevent unhandled rejection noise; scraper should handle the failure path.
    });
    (scraper as any).companyPageCache.set("apply.example", rejectingCache);

    const response = await scraper.scrape(
      buildInput({
        enabled: true,
        mode: "medium",
        exposeMeta: true,
        budget: {
          maxExtraRequestsPerJob: 4,
          maxPagesPerDomain: 3,
          requestTimeoutMs: 4000
        },
        sources: {
          jobDetailPage: true,
          externalApplyPage: true,
          companyPages: true
        },
        fields: {
          emails: true,
          skills: true,
          seniority: true,
          companyWebsite: true,
          workMode: true,
          companySize: true
        }
      })
    );

    expect(response.jobs.length).toBe(1);
    expect(response.jobs[0]?.title).toBe("Senior Software Engineer");
  });
});
