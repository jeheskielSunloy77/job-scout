import { Site } from "@/core/model";
import { BDJobsScraper } from "@/scrapers/bdjobs/index";

import { createSiteProvider } from "@/sites/provider-factory";

export const bdjobsProvider = createSiteProvider(Site.BDJOBS, BDJobsScraper);
