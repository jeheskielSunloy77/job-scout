import { Site } from "@/core/model";
import { GoogleScraper } from "@/scrapers/google/index";

import { createSiteProvider } from "@/sites/provider-factory";

export const googleProvider = createSiteProvider(Site.GOOGLE, GoogleScraper);
