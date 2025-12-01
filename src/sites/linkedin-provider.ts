import { Site } from "../model.js";
import { LinkedInScraper } from "../scrapers/linkedin/index.js";

import { createSiteProvider } from "./provider-factory.js";

export const linkedInProvider = createSiteProvider(Site.LINKEDIN, LinkedInScraper);
