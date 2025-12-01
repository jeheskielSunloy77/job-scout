import { Site } from "../model.js";
import { IndeedScraper } from "../scrapers/indeed/index.js";

import { createSiteProvider } from "./provider-factory.js";

export const indeedProvider = createSiteProvider(Site.INDEED, IndeedScraper);
