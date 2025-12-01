import { Site } from "../model.js";
import { BDJobsScraper } from "../scrapers/bdjobs/index.js";

import { createSiteProvider } from "./provider-factory.js";

export const bdjobsProvider = createSiteProvider(Site.BDJOBS, BDJobsScraper);
