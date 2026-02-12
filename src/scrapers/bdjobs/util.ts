import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import { Country, Location } from "@/core/model";
import { dateFormats, jobSelectors } from "@/scrapers/bdjobs/constant";

const monthShortMap: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11
};

const monthLongMap: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11
};

export function parseLocation(locationText: string, country = "bangladesh"): Location {
  const parts = locationText.split(",");
  if (parts.length >= 2) {
    return new Location({
      city: parts[0]?.trim() ?? null,
      state: parts[1]?.trim() ?? null,
      country: Country.fromString(country)
    });
  }
  return new Location({
    city: locationText.trim(),
    country: Country.fromString(country)
  });
}

function parseDateByFormat(dateText: string, format: string): Date | null {
  if (format === "%d %b %Y") {
    const match = dateText.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (!match) {
      return null;
    }
    const month = monthShortMap[match[2] ?? ""];
    if (month == null) {
      return null;
    }
    return new Date(Number(match[3]), month, Number(match[1]));
  }

  if (format === "%d-%b-%Y") {
    const match = dateText.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (!match) {
      return null;
    }
    const month = monthShortMap[match[2] ?? ""];
    if (month == null) {
      return null;
    }
    return new Date(Number(match[3]), month, Number(match[1]));
  }

  if (format === "%d %B %Y") {
    const match = dateText.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (!match) {
      return null;
    }
    const month = monthLongMap[match[2] ?? ""];
    if (month == null) {
      return null;
    }
    return new Date(Number(match[3]), month, Number(match[1]));
  }

  if (format === "%B %d, %Y") {
    const match = dateText.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
    if (!match) {
      return null;
    }
    const month = monthLongMap[match[1] ?? ""];
    if (month == null) {
      return null;
    }
    return new Date(Number(match[3]), month, Number(match[2]));
  }

  if (format === "%d/%m/%Y") {
    const match = dateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) {
      return null;
    }
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  }

  return null;
}

export function parseDate(dateText: string): Date | null {
  try {
    let cleaned = dateText.trim();
    if (cleaned.toLowerCase().startsWith("deadline:")) {
      cleaned = cleaned.replace(/deadline:/i, "").trim();
    }

    for (const format of dateFormats) {
      const parsed = parseDateByFormat(cleaned, format);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function findJobListings($: cheerio.CheerioAPI): Element[] {
  for (const selector of jobSelectors) {
    const matches = $(selector).toArray();
    if (matches.length > 0) {
      return matches;
    }
  }

  const links = $("a")
    .filter((_idx, node) => {
      const href = $(node).attr("href")?.toLowerCase() ?? "";
      return href.includes("jobdetail");
    })
    .toArray();

  if (links.length > 0) {
    return links
      .map((link) => link.parent)
      .filter((parent): parent is Element => Boolean(parent));
  }

  return [];
}

export function isJobRemote(title: string, description?: string | null, location?: Location | null): boolean {
  const remoteKeywords = ["remote", "work from home", "wfh", "home based"];

  let fullText = title.toLowerCase();
  if (description) {
    fullText += ` ${description.toLowerCase()}`;
  }
  if (location) {
    fullText += ` ${location.displayLocation().toLowerCase()}`;
  }

  return remoteKeywords.some((keyword) => fullText.includes(keyword));
}
