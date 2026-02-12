import { JobType, type ScraperInput } from "@/core/model";
import { getEnumFromJobTypeValue } from "@/util/site";

export function addParams(scraperInput: ScraperInput): Record<string, string | number> {
  const params: Record<string, string | number | null | undefined> = {
    search: scraperInput.searchTerm ?? "",
    location: scraperInput.location ?? ""
  };

  if (scraperInput.hoursOld) {
    params.days = Math.max(Math.floor(scraperInput.hoursOld / 24), 1);
  }

  const jobTypeMap: Partial<Record<JobType, string>> = {
    [JobType.FULL_TIME]: "full_time",
    [JobType.PART_TIME]: "part_time"
  };

  if (scraperInput.jobType) {
    params.employment_type = jobTypeMap[scraperInput.jobType] ?? scraperInput.jobType;
  }

  if (scraperInput.easyApply) {
    params.zipapply = 1;
  }
  if (scraperInput.isRemote) {
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
