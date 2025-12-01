import { Site } from "../model.js";
import { GoogleScraper } from "../scrapers/google/index.js";

import { createSiteProvider } from "./provider-factory.js";

export const googleProvider = createSiteProvider(Site.GOOGLE, GoogleScraper);
