import {
  Compensation,
  CompensationInterval,
  getCompensationInterval,
  Location
} from "@/core/model";

export function parseCompensation(data: {
  payPeriod?: string | null;
  payPeriodAdjustedPay?: {
    p10?: number;
    p90?: number;
  } | null;
  payCurrency?: string | null;
}): Compensation | null {
  const payPeriod = data.payPeriod;
  const adjustedPay = data.payPeriodAdjustedPay;
  const currency = data.payCurrency ?? "USD";

  if (!payPeriod || !adjustedPay) {
    return null;
  }

  const interval =
    payPeriod === "ANNUAL"
      ? CompensationInterval.YEARLY
      : getCompensationInterval(payPeriod);

  if (!interval) {
    return null;
  }

  const minAmount = Math.trunc((adjustedPay.p10 ?? 0) / 1);
  const maxAmount = Math.trunc((adjustedPay.p90 ?? 0) / 1);

  return {
    interval,
    min_amount: minAmount,
    max_amount: maxAmount,
    currency
  };
}

export function parseLocation(locationName: string): Location | null {
  if (!locationName || locationName === "Remote") {
    return null;
  }
  const [city, state] = locationName.split(", ");
  return new Location({
    city: city ?? null,
    state: state ?? null
  });
}

export function getCursorForPage(
  paginationCursors: Array<{ pageNumber?: number; cursor?: string }> | null | undefined,
  pageNum: number
): string | null {
  if (!paginationCursors) {
    return null;
  }
  for (const cursorData of paginationCursors) {
    if (cursorData.pageNumber === pageNum) {
      return cursorData.cursor ?? null;
    }
  }
  return null;
}
