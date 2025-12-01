import { Site } from "../model.js";
import { BaytScraper } from "../scrapers/bayt/index.js";

import { createSiteProvider } from "./provider-factory.js";

export const baytProvider = createSiteProvider(Site.BAYT, BaytScraper);
