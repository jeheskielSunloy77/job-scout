import { CompensationInterval, JobPost, JobType } from "../model.js";

export function currencyParser(curStr: string): number {
  let normalized = curStr.replace(/[^-0-9.,]/g, "");
  if (normalized.length >= 3) {
    normalized = normalized.replace(/[.,]/g, (match, offset) => {
      return offset < normalized.length - 3 ? "" : match;
    });
  }

  let parsed: number;
  const trailing = normalized.slice(-3);
  if (trailing.includes(".")) {
    parsed = Number.parseFloat(normalized);
  } else if (trailing.includes(",")) {
    parsed = Number.parseFloat(normalized.replace(",", "."));
  } else {
    parsed = Number.parseFloat(normalized);
  }

  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : Number.NaN;
}

export interface ExtractedSalary {
  interval: CompensationInterval | null;
  minAmount: number | null;
  maxAmount: number | null;
  currency: string | null;
}

export function extractSalary(
  salaryStr: string | null | undefined,
  options?: {
    lowerLimit?: number;
    upperLimit?: number;
    hourlyThreshold?: number;
    monthlyThreshold?: number;
    enforceAnnualSalary?: boolean;
  }
): ExtractedSalary {
  if (!salaryStr) {
    return {
      interval: null,
      minAmount: null,
      maxAmount: null,
      currency: null
    };
  }

  const lowerLimit = options?.lowerLimit ?? 1000;
  const upperLimit = options?.upperLimit ?? 700000;
  const hourlyThreshold = options?.hourlyThreshold ?? 350;
  const monthlyThreshold = options?.monthlyThreshold ?? 30000;
  const enforceAnnualSalary = options?.enforceAnnualSalary ?? false;

  const minMaxPattern = /\$(\d+(?:,\d+)?(?:\.\d+)?)([kK]?)\s*[-—–]\s*(?:\$)?(\d+(?:,\d+)?(?:\.\d+)?)([kK]?)/;
  const match = salaryStr.match(minMaxPattern);
  if (!match) {
    return {
      interval: null,
      minAmount: null,
      maxAmount: null,
      currency: null
    };
  }

  const toInt = (value: string): number => Number.parseInt(String(Number.parseFloat(value.replace(/,/g, ""))), 10);

  const convertHourlyToAnnual = (hourly: number): number => hourly * 2080;
  const convertMonthlyToAnnual = (monthly: number): number => monthly * 12;

  let minSalary = toInt(match[1] ?? "0");
  let maxSalary = toInt(match[3] ?? "0");

  if ((match[2] ?? "").toLowerCase() === "k" || (match[4] ?? "").toLowerCase() === "k") {
    minSalary *= 1000;
    maxSalary *= 1000;
  }

  let interval: CompensationInterval;
  let annualMinSalary: number;
  let annualMaxSalary: number | null = null;

  if (minSalary < hourlyThreshold) {
    interval = CompensationInterval.HOURLY;
    annualMinSalary = convertHourlyToAnnual(minSalary);
    if (maxSalary < hourlyThreshold) {
      annualMaxSalary = convertHourlyToAnnual(maxSalary);
    }
  } else if (minSalary < monthlyThreshold) {
    interval = CompensationInterval.MONTHLY;
    annualMinSalary = convertMonthlyToAnnual(minSalary);
    if (maxSalary < monthlyThreshold) {
      annualMaxSalary = convertMonthlyToAnnual(maxSalary);
    }
  } else {
    interval = CompensationInterval.YEARLY;
    annualMinSalary = minSalary;
    annualMaxSalary = maxSalary;
  }

  if (!annualMaxSalary) {
    return {
      interval: null,
      minAmount: null,
      maxAmount: null,
      currency: null
    };
  }

  if (
    lowerLimit <= annualMinSalary &&
    annualMinSalary <= upperLimit &&
    lowerLimit <= annualMaxSalary &&
    annualMaxSalary <= upperLimit &&
    annualMinSalary < annualMaxSalary
  ) {
    if (enforceAnnualSalary) {
      return {
        interval,
        minAmount: annualMinSalary,
        maxAmount: annualMaxSalary,
        currency: "USD"
      };
    }

    return {
      interval,
      minAmount: minSalary,
      maxAmount: maxSalary,
      currency: "USD"
    };
  }

  return {
    interval: null,
    minAmount: null,
    maxAmount: null,
    currency: null
  };
}

export function extractJobType(description: string | null | undefined): JobType[] | null {
  if (!description) {
    return null;
  }

  const keywords: Record<JobType, RegExp> = {
    [JobType.FULL_TIME]: /full\s?time/i,
    [JobType.PART_TIME]: /part\s?time/i,
    [JobType.INTERNSHIP]: /internship/i,
    [JobType.CONTRACT]: /contract/i,
    [JobType.TEMPORARY]: /temporary/i,
    [JobType.PER_DIEM]: /per\s?diem/i,
    [JobType.NIGHTS]: /nights?/i,
    [JobType.OTHER]: /other/i,
    [JobType.SUMMER]: /summer/i,
    [JobType.VOLUNTEER]: /volunteer/i
  };

  const listingTypes: JobType[] = [];
  for (const [jobType, pattern] of Object.entries(keywords) as [JobType, RegExp][]) {
    if (pattern.test(description)) {
      listingTypes.push(jobType);
    }
  }

  return listingTypes.length > 0 ? listingTypes : null;
}

export function convertToAnnual(compensation: JobPost["compensation"]): void {
  if (!compensation || compensation.min_amount == null || compensation.max_amount == null) {
    return;
  }

  if (compensation.interval === CompensationInterval.HOURLY) {
    compensation.min_amount *= 2080;
    compensation.max_amount *= 2080;
  }
  if (compensation.interval === CompensationInterval.MONTHLY) {
    compensation.min_amount *= 12;
    compensation.max_amount *= 12;
  }
  if (compensation.interval === CompensationInterval.WEEKLY) {
    compensation.min_amount *= 52;
    compensation.max_amount *= 52;
  }
  if (compensation.interval === CompensationInterval.DAILY) {
    compensation.min_amount *= 260;
    compensation.max_amount *= 260;
  }

  compensation.interval = CompensationInterval.YEARLY;
}
