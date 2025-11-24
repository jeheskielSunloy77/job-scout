export const headers: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Connection: "keep-alive",
  Referer: "https://jobs.bdjobs.com/",
  "Cache-Control": "max-age=0"
};

export const searchParams: Record<string, string> = {
  hidJobSearch: "jobsearch"
};

export const jobSelectors = [
  "div.job-item",
  "div.sout-jobs-wrapper",
  "div.norm-jobs-wrapper",
  "div.featured-wrap"
] as const;

export const dateFormats = ["%d %b %Y", "%d-%b-%Y", "%d %B %Y", "%B %d, %Y", "%d/%m/%Y"] as const;
