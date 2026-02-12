import { Site } from "@/core/model";
import { NaukriScraper } from "@/scrapers/naukri/index";

import { createSiteProvider } from "@/sites/provider-factory";

export const naukriProvider = createSiteProvider(Site.NAUKRI, NaukriScraper);
