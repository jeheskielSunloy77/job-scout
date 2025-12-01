import { Site } from "../model.js";
import { ZipRecruiterScraper } from "../scrapers/ziprecruiter/index.js";

import { createSiteProvider } from "./provider-factory.js";

export const zipRecruiterProvider = createSiteProvider(
  Site.ZIP_RECRUITER,
  ZipRecruiterScraper
);
