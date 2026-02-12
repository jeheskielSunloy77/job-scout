import type { JobSearchRequest, JobSite } from "../../../src/index";

export interface SiteScenario {
  site: JobSite;
  request: JobSearchRequest;
}

export const siteScenarios: SiteScenario[] = [
  {
    site: "indeed",
    request: {
      query: "software engineer",
      location: "San Francisco, CA",
      indeed: { country: "usa" }
    }
  },
  {
    site: "linkedin",
    request: {
      query: "software engineer",
      location: "San Francisco, CA",
      linkedin: { fetchDescription: false }
    }
  },
  {
    site: "zipRecruiter",
    request: {
      query: "software engineer",
      location: "San Francisco, CA"
    }
  },
  {
    site: "glassdoor",
    request: {
      query: "software engineer",
      location: "San Francisco, CA",
      indeed: { country: "usa" }
    }
  },
  {
    site: "google",
    request: {
      query: "software engineer",
      google: { query: "software engineer jobs near San Francisco, CA since yesterday" }
    }
  },
  {
    site: "bayt",
    request: {
      query: "software"
    }
  },
  {
    site: "naukri",
    request: {
      query: "software engineer",
      location: "Bengaluru"
    }
  },
  {
    site: "bdjobs",
    request: {
      query: "software"
    }
  }
];
