import {
  CompensationInterval,
  SalarySource,
  type JobPost as ScraperJobPost,
  type Location as ScraperLocation,
  type Compensation as ScraperCompensation,
  type JobType as ScraperJobType,
  Site
} from "../model.js";

import { toDomainEmploymentType } from "./employment-type.js";
import { toDomainSite } from "./site-mapping.js";
import type {
  CompensationInterval as DomainCompensationInterval,
  Job,
  JobCompensation,
  JobLocation,
  SalarySourceType
} from "./types.js";

function mapCompensationInterval(
  value: CompensationInterval | null | undefined
): DomainCompensationInterval | null {
  if (!value) {
    return null;
  }

  switch (value) {
    case CompensationInterval.YEARLY:
      return "yearly";
    case CompensationInterval.MONTHLY:
      return "monthly";
    case CompensationInterval.WEEKLY:
      return "weekly";
    case CompensationInterval.DAILY:
      return "daily";
    case CompensationInterval.HOURLY:
      return "hourly";
    default:
      return null;
  }
}

function mapCompensation(value: ScraperCompensation | null | undefined): JobCompensation | null {
  if (!value) {
    return null;
  }

  return {
    interval: mapCompensationInterval(value.interval),
    minAmount: value.min_amount ?? null,
    maxAmount: value.max_amount ?? null,
    currency: value.currency ?? null
  };
}

function mapLocation(value: ScraperLocation | null | undefined): JobLocation | null {
  if (!value) {
    return null;
  }

  const countryName =
    typeof value.country === "string"
      ? value.country
      : value.country
        ? value.country.displayName
        : null;

  return {
    country: countryName,
    city: value.city ?? null,
    state: value.state ?? null,
    display: value.displayLocation()
  };
}

function mapEmploymentTypes(value: ScraperJobType[] | null | undefined): Job["employmentTypes"] {
  if (!value) {
    return null;
  }
  return value.map((entry) => toDomainEmploymentType(entry));
}

function mapSalarySource(value: SalarySource | null | undefined): SalarySourceType | null {
  if (!value) {
    return null;
  }

  return value === SalarySource.DIRECT_DATA ? "directData" : "description";
}

export function toDomainJob(job: ScraperJobPost): Job {
  const scraperSite = job.site ?? Site.BAYT;

  return {
    id: job.id ?? null,
    site: toDomainSite(scraperSite),
    title: job.title,
    companyName: job.company_name ?? null,
    jobUrl: job.job_url,
    jobUrlDirect: job.job_url_direct ?? null,
    location: mapLocation(job.location),
    description: job.description ?? null,
    companyUrl: job.company_url ?? null,
    companyUrlDirect: job.company_url_direct ?? null,
    employmentTypes: mapEmploymentTypes(job.job_type),
    compensation: mapCompensation(job.compensation),
    salarySource: mapSalarySource(job.salary_source),
    datePosted: job.date_posted ?? null,
    emails: job.emails ?? null,
    isRemote: job.is_remote ?? null,
    listingType: job.listing_type ?? null,
    jobLevel: job.job_level ?? null,
    companyIndustry: job.company_industry ?? null,
    companyAddresses: job.company_addresses ?? null,
    companyNumEmployees: job.company_num_employees ?? null,
    companyRevenue: job.company_revenue ?? null,
    companyDescription: job.company_description ?? null,
    companyLogo: job.company_logo ?? null,
    bannerPhotoUrl: job.banner_photo_url ?? null,
    jobFunction: job.job_function ?? null,
    skills: job.skills ?? null,
    experienceRange: job.experience_range ?? null,
    companyRating: job.company_rating ?? null,
    companyReviewsCount: job.company_reviews_count ?? null,
    vacancyCount: job.vacancy_count ?? null,
    workFromHomeType: job.work_from_home_type ?? null
  };
}
