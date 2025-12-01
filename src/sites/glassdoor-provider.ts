import { Site } from "../model.js";
import { GlassdoorScraper } from "../scrapers/glassdoor/index.js";

import { createSiteProvider } from "./provider-factory.js";

export const glassdoorProvider = createSiteProvider(Site.GLASSDOOR, GlassdoorScraper);
