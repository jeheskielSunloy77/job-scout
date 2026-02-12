import type { Job, JobRow } from "@/domain/types";

function toDateString(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

export function toJobRow(job: Job): JobRow {
  return {
    id: job.id,
    site: job.site,
    jobUrl: job.jobUrl,
    jobUrlDirect: job.jobUrlDirect,
    title: job.title,
    company: job.companyName,
    location: job.location?.display ?? null,
    datePosted: toDateString(job.datePosted),
    employmentTypes: job.employmentTypes ? job.employmentTypes.join(", ") : null,
    salarySource: job.salarySource,
    interval: job.compensation?.interval ?? null,
    minAmount: job.compensation?.minAmount ?? null,
    maxAmount: job.compensation?.maxAmount ?? null,
    currency: job.compensation?.currency ?? null,
    isRemote: job.isRemote,
    jobLevel: job.jobLevel,
    jobFunction: job.jobFunction,
    listingType: job.listingType,
    emails: job.emails ? job.emails.join(", ") : null,
    description: job.description,
    companyIndustry: job.companyIndustry,
    companyUrl: job.companyUrl,
    companyLogo: job.companyLogo,
    companyUrlDirect: job.companyUrlDirect,
    companyAddresses: job.companyAddresses,
    companyNumEmployees: job.companyNumEmployees,
    companyRevenue: job.companyRevenue,
    companyDescription: job.companyDescription,
    skills: job.skills ? job.skills.join(", ") : null,
    experienceRange: job.experienceRange,
    companyRating: job.companyRating,
    companyReviewsCount: job.companyReviewsCount,
    vacancyCount: job.vacancyCount,
    workFromHomeType: job.workFromHomeType
  };
}

export function toJobRows(jobs: Job[]): JobRow[] {
  return jobs.map((job) => toJobRow(job));
}
