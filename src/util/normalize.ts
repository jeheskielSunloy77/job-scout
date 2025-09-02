import {
  CompensationInterval,
  JobPost,
  SalarySource,
  Site,
  type Location
} from "../model.js";

export const desiredOrder = [
  "id",
  "site",
  "job_url",
  "job_url_direct",
  "title",
  "company",
  "location",
  "date_posted",
  "job_type",
  "salary_source",
  "interval",
  "min_amount",
  "max_amount",
  "currency",
  "is_remote",
  "job_level",
  "job_function",
  "listing_type",
  "emails",
  "description",
  "company_industry",
  "company_url",
  "company_logo",
  "company_url_direct",
  "company_addresses",
  "company_num_employees",
  "company_revenue",
  "company_description",
  "skills",
  "experience_range",
  "company_rating",
  "company_reviews_count",
  "vacancy_count",
  "work_from_home_type"
] as const;

export interface JobRow {
  id: string | null;
  site: Site | null;
  job_url: string | null;
  job_url_direct: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  date_posted: string | null;
  job_type: string | null;
  salary_source: SalarySource | null;
  interval: CompensationInterval | null;
  min_amount: number | null;
  max_amount: number | null;
  currency: string | null;
  is_remote: boolean | null;
  job_level: string | null;
  job_function: string | null;
  listing_type: string | null;
  emails: string | null;
  description: string | null;
  company_industry: string | null;
  company_url: string | null;
  company_logo: string | null;
  company_url_direct: string | null;
  company_addresses: string | null;
  company_num_employees: string | null;
  company_revenue: string | null;
  company_description: string | null;
  skills: string | null;
  experience_range: string | null;
  company_rating: number | null;
  company_reviews_count: number | null;
  vacancy_count: number | null;
  work_from_home_type: string | null;
}

function toLocationString(location: Location | null | undefined): string | null {
  if (!location) {
    return null;
  }
  return location.displayLocation();
}

function toDateString(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

export function toRow(job: JobPost): JobRow {
  return {
    id: job.id ?? null,
    site: job.site ?? null,
    job_url: job.job_url ?? null,
    job_url_direct: job.job_url_direct ?? null,
    title: job.title ?? null,
    company: job.company_name ?? null,
    location: toLocationString(job.location),
    date_posted: toDateString(job.date_posted),
    job_type: job.job_type ? job.job_type.join(", ") : null,
    salary_source: job.salary_source ?? null,
    interval: job.compensation?.interval ?? null,
    min_amount: job.compensation?.min_amount ?? null,
    max_amount: job.compensation?.max_amount ?? null,
    currency: job.compensation?.currency ?? null,
    is_remote: job.is_remote ?? null,
    job_level: job.job_level ?? null,
    job_function: job.job_function ?? null,
    listing_type: job.listing_type ?? null,
    emails: job.emails ? job.emails.join(", ") : null,
    description: job.description ?? null,
    company_industry: job.company_industry ?? null,
    company_url: job.company_url ?? null,
    company_logo: job.company_logo ?? null,
    company_url_direct: job.company_url_direct ?? null,
    company_addresses: job.company_addresses ?? null,
    company_num_employees: job.company_num_employees ?? null,
    company_revenue: job.company_revenue ?? null,
    company_description: job.company_description ?? null,
    skills: job.skills ? job.skills.join(", ") : null,
    experience_range: job.experience_range ?? null,
    company_rating: job.company_rating ?? null,
    company_reviews_count: job.company_reviews_count ?? null,
    vacancy_count: job.vacancy_count ?? null,
    work_from_home_type: job.work_from_home_type ?? null
  };
}

export function toRows(jobs: JobPost[]): JobRow[] {
  return jobs.map(toRow);
}
