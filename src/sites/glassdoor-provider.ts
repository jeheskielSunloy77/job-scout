import { Site } from "@/core/model";
import { GlassdoorScraper } from "@/scrapers/glassdoor/index";

import { createSiteProvider } from "@/sites/provider-factory";

export const glassdoorProvider = createSiteProvider(Site.GLASSDOOR, GlassdoorScraper);
