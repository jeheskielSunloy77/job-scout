export type LiveErrorClass = "transient_external" | "hard_regression";
const TRANSIENT_TAG = "[transient_external]";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTransientExternalError(message: string): Error {
  return new Error(`transient_external: ${message}`);
}

export function isTransientExternalFailure(error: unknown): boolean {
  return String(error).toLowerCase().includes(TRANSIENT_TAG);
}

export function classifyLiveError(error: unknown): LiveErrorClass {
  const message = String(error).toLowerCase();

  if (message.includes("assert") || message.includes("expected ")) {
    return "hard_regression";
  }

  const transientPatterns = [
    "429",
    "500",
    "501",
    "502",
    "503",
    "504",
    "timeout",
    "timed out",
    "etimedout",
    "socket",
    "econnreset",
    "fetch failed",
    "network",
    "403",
    "forbidden",
    "cf-waf",
    "blocked by",
    "location not parsed",
    "transient_external"
  ];

  if (transientPatterns.some((pattern) => message.includes(pattern))) {
    return "transient_external";
  }

  return "hard_regression";
}

export async function runWithRetries<T>(
  operationName: string,
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorClass = classifyLiveError(error);

      if (errorClass === "hard_regression") {
        throw new Error(`[hard_regression] ${operationName} failed: ${String(error)}`);
      }

      if (attempt < maxAttempts) {
        const delayMs = Math.min(3000, 300 * 2 ** (attempt - 1));
        await sleep(delayMs + Math.floor(Math.random() * 250));
        continue;
      }

      throw new Error(
        `${TRANSIENT_TAG} ${operationName} failed after ${maxAttempts} attempts: ${String(error)}`
      );
    }
  }

  throw new Error(`[hard_regression] ${operationName} failed with unknown error: ${String(lastError)}`);
}
