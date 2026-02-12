import { Site } from "@/core/model";
import { LinkedInScraper } from "@/scrapers/linkedin/index";

import { createSiteProvider } from "@/sites/provider-factory";

export const linkedInProvider = createSiteProvider(Site.LINKEDIN, LinkedInScraper);
