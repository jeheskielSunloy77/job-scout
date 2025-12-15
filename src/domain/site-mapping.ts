import { Site } from "../model.js";

import type { JobSite } from "./types.js";

const DOMAIN_TO_LEGACY_SITE: Record<JobSite, Site> = {
  linkedin: Site.LINKEDIN,
  indeed: Site.INDEED,
  zipRecruiter: Site.ZIP_RECRUITER,
  glassdoor: Site.GLASSDOOR,
  google: Site.GOOGLE,
  bayt: Site.BAYT,
  naukri: Site.NAUKRI,
  bdjobs: Site.BDJOBS
};

const LEGACY_TO_DOMAIN_SITE: Record<Site, JobSite> = {
  [Site.LINKEDIN]: "linkedin",
  [Site.INDEED]: "indeed",
  [Site.ZIP_RECRUITER]: "zipRecruiter",
  [Site.GLASSDOOR]: "glassdoor",
  [Site.GOOGLE]: "google",
  [Site.BAYT]: "bayt",
  [Site.NAUKRI]: "naukri",
  [Site.BDJOBS]: "bdjobs"
};

export const allJobSites: JobSite[] = [
  "linkedin",
  "indeed",
  "zipRecruiter",
  "glassdoor",
  "google",
  "bayt",
  "naukri",
  "bdjobs"
];

export function toLegacySite(site: JobSite): Site {
  return DOMAIN_TO_LEGACY_SITE[site];
}

export function toDomainSite(site: Site): JobSite {
  return LEGACY_TO_DOMAIN_SITE[site];
}
