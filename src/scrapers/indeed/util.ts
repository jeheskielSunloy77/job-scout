import {
  Compensation,
  type CompensationInterval,
  getCompensationInterval,
  JobType,
  type Location
} from "@/core/model";
import { getEnumFromJobTypeValue } from "@/util/site";

interface JobAttribute {
  label?: string;
}

interface CompensationRange {
  min?: number | null;
  max?: number | null;
}

interface CompensationNode {
  unitOfWork?: string;
  range?: CompensationRange;
}

interface CompensationPayload {
  baseSalary?: CompensationNode | null;
  estimated?: {
    currencyCode?: string;
    baseSalary?: CompensationNode | null;
  } | null;
  currencyCode?: string;
}

export function getJobType(attributes: JobAttribute[]): JobType[] {
  const jobTypes: JobType[] = [];
  for (const attribute of attributes) {
    const raw = (attribute.label ?? "").replace(/-/g, "").replace(/\s+/g, "").toLowerCase();
    const parsed = getEnumFromJobTypeValue(raw);
    if (parsed) {
      jobTypes.push(parsed);
    }
  }
  return jobTypes;
}

export function getCompensation(compensation: CompensationPayload): Compensation | null {
  if (!compensation.baseSalary && !compensation.estimated) {
    return null;
  }

  const comp = compensation.baseSalary ?? compensation.estimated?.baseSalary;
  if (!comp?.unitOfWork || !comp.range) {
    return null;
  }

  const interval = getCompensationInterval(comp.unitOfWork);
  if (!interval) {
    throw new Error(`Unsupported interval: ${comp.unitOfWork}`);
  }

  const minRange = comp.range.min;
  const maxRange = comp.range.max;

  return {
    interval: interval as CompensationInterval,
    min_amount: minRange == null ? null : Math.trunc(minRange),
    max_amount: maxRange == null ? null : Math.trunc(maxRange),
    currency: compensation.estimated?.currencyCode ?? compensation.currencyCode ?? "USD"
  };
}

export function isJobRemote(
  job: {
    attributes?: Array<{ label?: string }>;
    location?: { formatted?: { long?: string } };
  },
  description: string
): boolean {
  const remoteKeywords = ["remote", "work from home", "wfh"];
  const attrs = job.attributes ?? [];

  const inAttributes = attrs.some((attr) => {
    const label = attr.label?.toLowerCase() ?? "";
    return remoteKeywords.some((keyword) => label.includes(keyword));
  });

  const loweredDescription = description.toLowerCase();
  const inDescription = remoteKeywords.some((keyword) => loweredDescription.includes(keyword));

  const locationLong = job.location?.formatted?.long?.toLowerCase() ?? "";
  const inLocation = remoteKeywords.some((keyword) => locationLong.includes(keyword));

  return inAttributes || inDescription || inLocation;
}

export function ensureLocation(
  location: { city?: string; admin1Code?: string; countryCode?: string } | undefined,
  LocationCtor: new (input?: { city?: string | null; state?: string | null; country?: string | null }) => Location
): Location {
  return new LocationCtor({
    city: location?.city ?? null,
    state: location?.admin1Code ?? null,
    country: location?.countryCode ?? null
  });
}
