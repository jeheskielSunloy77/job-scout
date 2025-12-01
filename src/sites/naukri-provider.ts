import { Site } from "../model.js";
import { NaukriScraper } from "../scrapers/naukri/index.js";

import { createSiteProvider } from "./provider-factory.js";

export const naukriProvider = createSiteProvider(Site.NAUKRI, NaukriScraper);
