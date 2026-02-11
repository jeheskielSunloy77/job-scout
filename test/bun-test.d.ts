declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const it: (name: string, fn: () => void | Promise<void>, timeoutMs?: number) => void;
  export const test: typeof it;

  type Matcher = {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toThrow(expected?: unknown): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toMatch(expected: RegExp | string): void;
    not: Matcher;
  };

  export const expect: (actual: unknown) => Matcher;
}
