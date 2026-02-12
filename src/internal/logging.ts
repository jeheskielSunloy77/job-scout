import { setLoggerLevel } from "@/util/logger";

export type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_TO_VERBOSE: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

export function applyLogLevel(level: LogLevel): void {
  setLoggerLevel(LEVEL_TO_VERBOSE[level]);
}
