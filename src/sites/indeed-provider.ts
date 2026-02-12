import { Site } from "@/core/model";
import { IndeedScraper } from "@/scrapers/indeed/index";

import { createSiteProvider } from "@/sites/provider-factory";

export const indeedProvider = createSiteProvider(Site.INDEED, IndeedScraper);
