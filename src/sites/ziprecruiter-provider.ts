import { Site } from "@/core/model";
import { ZipRecruiterScraper } from "@/scrapers/ziprecruiter/index";

import { createSiteProvider } from "@/sites/provider-factory";

export const zipRecruiterProvider = createSiteProvider(
  Site.ZIP_RECRUITER,
  ZipRecruiterScraper
);
