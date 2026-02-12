import {
  Country,
  SalarySource,
  Site,
  type JobPost,
  type Country as CountryType
} from "@/core/model";
import { convertToAnnual, extractSalary } from "@/util/salary";

import type { SiteSearchResult } from "@/core/contracts";

interface PipelineOptions {
  country: CountryType;
  annualizeSalary: boolean;
  salaryFallback: "usOnly";
}

function dedupeJobs(jobs: JobPost[]): JobPost[] {
  const seen = new Set<string>();
  const deduped: JobPost[] = [];

  for (const job of jobs) {
    const key = `${job.site ?? Site.BAYT}|${job.job_url}|${job.id ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(job);
  }

  return deduped;
}

function sortJobs(jobs: JobPost[]): JobPost[] {
  return [...jobs].sort((left, right) => {
    const leftSite = left.site ?? Site.BAYT;
    const rightSite = right.site ?? Site.BAYT;

    if (leftSite < rightSite) {
      return -1;
    }

    if (leftSite > rightSite) {
      return 1;
    }

    const leftDate = left.date_posted ? left.date_posted.getTime() : Number.NEGATIVE_INFINITY;
    const rightDate = right.date_posted ? right.date_posted.getTime() : Number.NEGATIVE_INFINITY;

    return rightDate - leftDate;
  });
}

function normalizeJob(job: JobPost, site: Site, options: PipelineOptions): JobPost {
  const normalized: JobPost = {
    ...job,
    site
  };

  if (normalized.compensation?.min_amount != null) {
    normalized.salary_source = SalarySource.DIRECT_DATA;

    if (
      options.annualizeSalary &&
      normalized.compensation.interval &&
      normalized.compensation.interval !== "yearly"
    ) {
      convertToAnnual(normalized.compensation);
    }
  } else if (options.salaryFallback === "usOnly" && options.country === Country.USA) {
    const parsedSalary = extractSalary(normalized.description, {
      enforceAnnualSalary: options.annualizeSalary
    });

    if (parsedSalary.minAmount != null && parsedSalary.maxAmount != null) {
      normalized.compensation = {
        interval: parsedSalary.interval,
        min_amount: parsedSalary.minAmount,
        max_amount: parsedSalary.maxAmount,
        currency: parsedSalary.currency
      };
      normalized.salary_source = SalarySource.DESCRIPTION;
    }
  }

  if (!normalized.compensation?.min_amount) {
    normalized.salary_source = null;
  }

  return normalized;
}

export function runResultPipeline(results: SiteSearchResult[], options: PipelineOptions): JobPost[] {
  const normalized = results.flatMap((result) =>
    result.jobs.map((job) => normalizeJob(job, result.site, options))
  );

  const deduped = dedupeJobs(normalized);
  return sortJobs(deduped);
}
