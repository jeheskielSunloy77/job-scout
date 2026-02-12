import type { RetryPolicy } from "@/util/http";

export function normalizeRetryPolicy(
  retry: {
    listPages?: number | undefined;
    detailPages?: number | undefined;
    baseDelayMs?: number | undefined;
    maxDelayMs?: number | undefined;
  } | undefined
): Partial<RetryPolicy> | undefined {
  if (!retry) {
    return undefined;
  }

  return {
    ...(retry.listPages !== undefined ? { listPages: retry.listPages } : {}),
    ...(retry.detailPages !== undefined ? { detailPages: retry.detailPages } : {}),
    ...(retry.baseDelayMs !== undefined ? { baseDelayMs: retry.baseDelayMs } : {}),
    ...(retry.maxDelayMs !== undefined ? { maxDelayMs: retry.maxDelayMs } : {})
  };
}
