import { Site } from "@/core/model";
import { BaytScraper } from "@/scrapers/bayt/index";

import { createSiteProvider } from "@/sites/provider-factory";

export const baytProvider = createSiteProvider(Site.BAYT, BaytScraper);
