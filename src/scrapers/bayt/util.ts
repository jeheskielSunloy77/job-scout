import * as cheerio from "cheerio";
import type { Element } from "domhandler";

export function extractJobUrl(baseUrl: string, card: cheerio.Cheerio<Element>): string | null {
  const href = card.find("h2 a").attr("href");
  if (!href) {
    return null;
  }
  return `${baseUrl}${href.trim()}`;
}
