import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import TurndownService from "turndown";

const turndown = new TurndownService();

export function markdownConverter(descriptionHtml: string | null | undefined): string | null {
  if (!descriptionHtml) {
    return null;
  }
  return turndown.turndown(descriptionHtml).trim();
}

export function plainConverter(descriptionHtml: string | null | undefined): string | null {
  if (!descriptionHtml) {
    return null;
  }
  const $ = cheerio.load(descriptionHtml);
  return $.text().replace(/\s+/g, " ").trim();
}

export function extractEmailsFromText(text: string | null | undefined): string[] | null {
  if (!text) {
    return null;
  }
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(regex);
  return matches ?? null;
}

export function removeAttributes(html: string | null | undefined): string {
  if (!html) {
    return "";
  }
  const $ = cheerio.load(html);
  $("*").each((_idx, element) => {
    if (!("attribs" in element) || !element.attribs) {
      return;
    }
    for (const attributeName of Object.keys(element.attribs)) {
      $(element).removeAttr(attributeName);
    }
  });
  return $.root().html() ?? "";
}

export function pickText(node: cheerio.Cheerio<Element>): string | null {
  const text = node.text().trim();
  return text.length > 0 ? text : null;
}
