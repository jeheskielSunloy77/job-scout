import { JobType, Site, getEnumFromJobType, getJobTypeAliases } from "@/core/model";

export function mapStrToSite(siteName: string): Site {
  const key = siteName.toUpperCase();
  if (!(key in Site)) {
    throw new Error(`Unsupported site: ${siteName}`);
  }
  return Site[key as keyof typeof Site];
}

export function getEnumFromValue(valueStr: string): JobType {
  const normalized = valueStr.trim().toLowerCase();
  for (const jobType of Object.values(JobType)) {
    const aliases = getJobTypeAliases(jobType);
    if (aliases.includes(normalized)) {
      return jobType;
    }
  }
  throw new Error(`Invalid job type: ${valueStr}`);
}

export function getEnumFromJobTypeValue(jobTypeStr: string): JobType | null {
  return getEnumFromJobType(jobTypeStr);
}

export function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}
