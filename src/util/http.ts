import {
  Agent,
  ProxyAgent,
  fetch,
  type Dispatcher,
  type RequestInit,
  type Response
} from "undici";

import { Site } from "@/core/model";
import { createLogger } from "@/util/logger";

const log = createLogger("HTTP");

export interface RetryPolicy {
  listPages: number;
  detailPages: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface HttpClientConfig {
  proxies?: string[] | string | null;
  requestTimeoutMs?: number;
  maxGlobalConcurrency?: number;
  maxConcurrencyPerSite?: Partial<Record<Site, number>>;
  retryPolicy?: Partial<RetryPolicy>;
  enableAdaptiveConcurrency?: boolean;
  defaultHeaders?: Record<string, string>;
}

export interface HttpRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: string;
  json?: unknown;
  timeoutMs?: number;
  site?: Site;
  kind?: "list" | "detail" | "other";
}

export interface HttpResult {
  status: number;
  ok: boolean;
  text: string;
  headers: Headers;
  url: string;
}

interface SiteState {
  limiter: DynamicLimiter;
  minLimit: number;
  maxLimit: number;
  successWindow: number;
}

const DEFAULT_SITE_CONCURRENCY: Record<Site, number> = {
  [Site.INDEED]: 6,
  [Site.ZIP_RECRUITER]: 5,
  [Site.GOOGLE]: 4,
  [Site.LINKEDIN]: 2,
  [Site.GLASSDOOR]: 3,
  [Site.BAYT]: 3,
  [Site.NAUKRI]: 4,
  [Site.BDJOBS]: 3
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  listPages: 2,
  detailPages: 1,
  baseDelayMs: 250,
  maxDelayMs: 3000
};

const TRANSIENT_STATUS = new Set([429, 500, 501, 502, 503, 504]);

class DynamicLimiter {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private limit: number) {}

  getLimit(): number {
    return this.limit;
  }

  setLimit(newLimit: number): void {
    this.limit = Math.max(1, Math.floor(newLimit));
    this.drain();
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.running += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.running = Math.max(0, this.running - 1);
    this.drain();
  }

  private drain(): void {
    while (this.running < this.limit && this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(
  url: string,
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!query) {
    return url;
  }

  const parsed = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    parsed.searchParams.set(key, String(value));
  }
  return parsed.toString();
}

function withProxyProtocol(proxy: string): string {
  if (/^https?:\/\//.test(proxy) || proxy.startsWith("socks5://")) {
    return proxy;
  }
  return `http://${proxy}`;
}

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("reset") ||
    message.includes("socket") ||
    message.includes("aborted")
  );
}

export class HttpClient {
  private readonly retryPolicy: RetryPolicy;
  private readonly requestTimeoutMs: number;
  private readonly globalLimiter: DynamicLimiter;
  private readonly defaultHeaders: Record<string, string>;
  private readonly adaptive: boolean;
  private readonly siteStates = new Map<Site, SiteState>();
  private readonly originAgents = new Map<string, Agent>();
  private readonly proxies: string[];
  private proxyCursor = 0;
  private readonly proxyAgents = new Map<string, ProxyAgent>();

  constructor(config: HttpClientConfig = {}) {
    this.retryPolicy = {
      ...DEFAULT_RETRY_POLICY,
      ...config.retryPolicy
    };
    this.requestTimeoutMs = config.requestTimeoutMs ?? 20_000;
    this.globalLimiter = new DynamicLimiter(config.maxGlobalConcurrency ?? 24);
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.adaptive = config.enableAdaptiveConcurrency ?? true;

    this.proxies = Array.isArray(config.proxies)
      ? config.proxies
      : typeof config.proxies === "string"
        ? [config.proxies]
        : [];

    for (const site of Object.values(Site)) {
      const base = config.maxConcurrencyPerSite?.[site] ?? DEFAULT_SITE_CONCURRENCY[site];
      const maxLimit = Math.max(base, Math.ceil(base * 2));
      this.siteStates.set(site, {
        limiter: new DynamicLimiter(base),
        minLimit: 1,
        maxLimit,
        successWindow: 0
      });
    }
  }

  async requestText(url: string, options: HttpRequestOptions = {}): Promise<HttpResult> {
    return this.withRetry(url, options);
  }

  async requestJson<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    const result = await this.withRetry(url, options);
    return JSON.parse(result.text) as T;
  }

  async close(): Promise<void> {
    for (const agent of this.originAgents.values()) {
      const close = (agent as { close?: () => Promise<void> | void }).close;
      if (typeof close === "function") {
        await close.call(agent);
      }
    }
    for (const proxyAgent of this.proxyAgents.values()) {
      const close = (proxyAgent as { close?: () => Promise<void> | void }).close;
      if (typeof close === "function") {
        await close.call(proxyAgent);
      }
    }
  }

  private async withRetry(url: string, options: HttpRequestOptions): Promise<HttpResult> {
    const budget =
      options.kind === "list"
        ? this.retryPolicy.listPages
        : options.kind === "detail"
          ? this.retryPolicy.detailPages
          : this.retryPolicy.detailPages;

    let attempt = 0;
    // Includes initial attempt, then retries up to budget.
    while (attempt <= budget) {
      try {
        const siteLimiter = options.site ? this.siteStates.get(options.site)?.limiter : undefined;
        const result = await this.globalLimiter.run(async () => {
          if (!siteLimiter) {
            return this.singleRequest(url, options);
          }
          return siteLimiter.run(() => this.singleRequest(url, options));
        });

        if (options.site) {
          this.adjustConcurrency(options.site, result.status);
        }

        if (TRANSIENT_STATUS.has(result.status) && attempt < budget) {
          const delayMs = Math.random() * Math.min(this.retryPolicy.maxDelayMs, this.retryPolicy.baseDelayMs * 2 ** attempt);
          await sleep(delayMs);
          attempt += 1;
          continue;
        }

        return result;
      } catch (error) {
        if (options.site) {
          this.adjustConcurrency(options.site, 503);
        }

        const retryable = isTransientError(error);
        if (!retryable || attempt >= budget) {
          throw error;
        }

        const delayMs = Math.random() * Math.min(this.retryPolicy.maxDelayMs, this.retryPolicy.baseDelayMs * 2 ** attempt);
        await sleep(delayMs);
        attempt += 1;
      }
    }

    throw new Error("Retry loop terminated unexpectedly");
  }

  private async singleRequest(url: string, options: HttpRequestOptions): Promise<HttpResult> {
    const target = buildUrl(url, options.query);
    const dispatcher = this.getDispatcher(target);
    const headers = {
      ...this.defaultHeaders,
      ...options.headers
    };

    const requestInit: RequestInit = {
      dispatcher,
      method: options.method ?? "GET",
      headers
    };

    if (options.body !== undefined) {
      requestInit.body = options.body;
    }

    if (options.json !== undefined) {
      requestInit.body = JSON.stringify(options.json);
      if (!("content-type" in headers) && !("Content-Type" in headers)) {
        headers["content-type"] = "application/json";
      }
    }

    const timeout = options.timeoutMs ?? this.requestTimeoutMs;
    const signal = AbortSignal.timeout(timeout);
    requestInit.signal = signal;

    let response: Response;
    try {
      response = await fetch(target, requestInit);
    } catch (error) {
      log.debug(`request failure for ${target}: ${String(error)}`);
      throw error;
    }

    const text = await response.text();

    return {
      status: response.status,
      ok: response.ok,
      text,
      headers: response.headers,
      url: response.url
    };
  }

  private getDispatcher(url: string): Dispatcher {
    const selectedProxy = this.getNextProxy();
    if (selectedProxy) {
      let proxyAgent = this.proxyAgents.get(selectedProxy);
      if (!proxyAgent) {
        proxyAgent = new ProxyAgent(withProxyProtocol(selectedProxy));
        this.proxyAgents.set(selectedProxy, proxyAgent);
      }
      return proxyAgent;
    }

    const origin = new URL(url).origin;
    let agent = this.originAgents.get(origin);
    if (!agent) {
      agent = new Agent({
        connections: 8,
        pipelining: 1,
        keepAliveTimeout: 10_000,
        keepAliveMaxTimeout: 60_000,
        headersTimeout: 15_000,
        bodyTimeout: 20_000
      });
      this.originAgents.set(origin, agent);
    }
    return agent;
  }

  private getNextProxy(): string | null {
    if (this.proxies.length === 0) {
      return null;
    }

    const proxy = this.proxies[this.proxyCursor % this.proxies.length] ?? null;
    this.proxyCursor += 1;
    if (!proxy || proxy === "localhost") {
      return null;
    }
    return proxy;
  }

  private adjustConcurrency(site: Site, status: number): void {
    if (!this.adaptive) {
      return;
    }

    const state = this.siteStates.get(site);
    if (!state) {
      return;
    }

    if (status === 429 || (status >= 500 && status <= 599)) {
      const current = state.limiter.getLimit();
      const reduced = Math.max(state.minLimit, Math.floor(current / 2));
      state.limiter.setLimit(reduced);
      state.successWindow = 0;
      return;
    }

    state.successWindow += 1;
    if (state.successWindow >= 20) {
      const current = state.limiter.getLimit();
      if (current < state.maxLimit) {
        state.limiter.setLimit(current + 1);
      }
      state.successWindow = 0;
    }
  }
}
