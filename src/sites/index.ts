import type { SiteProvider } from "../core/contracts.js";

import { baytProvider } from "./bayt-provider.js";
import { bdjobsProvider } from "./bdjobs-provider.js";
import { glassdoorProvider } from "./glassdoor-provider.js";
import { googleProvider } from "./google-provider.js";
import { indeedProvider } from "./indeed-provider.js";
import { linkedInProvider } from "./linkedin-provider.js";
import { naukriProvider } from "./naukri-provider.js";
import { zipRecruiterProvider } from "./ziprecruiter-provider.js";

export const siteProviders: SiteProvider[] = [
  linkedInProvider,
  indeedProvider,
  zipRecruiterProvider,
  glassdoorProvider,
  googleProvider,
  baytProvider,
  naukriProvider,
  bdjobsProvider
];
