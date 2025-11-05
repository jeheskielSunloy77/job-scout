import { JobType, type ScraperInput } from "../../model.js";
import { getEnumFromJobTypeValue } from "../../util/site.js";

export function addParams(scraperInput: ScraperInput): Record<string, string | number> {
  const params: Record<string, string | number | null | undefined> = {
    search: scraperInput.search_term ?? "",
    location: scraperInput.location ?? ""
  };

  if (scraperInput.hours_old) {
    params.days = Math.max(Math.floor(scraperInput.hours_old / 24), 1);
  }

  const jobTypeMap: Partial<Record<JobType, string>> = {
    [JobType.FULL_TIME]: "full_time",
    [JobType.PART_TIME]: "part_time"
  };

  if (scraperInput.job_type) {
    params.employment_type = jobTypeMap[scraperInput.job_type] ?? scraperInput.job_type;
  }

  if (scraperInput.easy_apply) {
    params.zipapply = 1;
  }
  if (scraperInput.is_remote) {
    params.remote = 1;
  }
  if (scraperInput.distance) {
    params.radius = scraperInput.distance;
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined)
  ) as Record<string, string | number>;
}

export function getJobTypeEnum(jobTypeStr: string): JobType[] | null {
  const parsed = getEnumFromJobTypeValue(jobTypeStr);
  return parsed ? [parsed] : null;
}
