import type { SiteProvider } from "@/core/contracts";

import { baytProvider } from "@/sites/bayt-provider";
import { bdjobsProvider } from "@/sites/bdjobs-provider";
import { glassdoorProvider } from "@/sites/glassdoor-provider";
import { googleProvider } from "@/sites/google-provider";
import { indeedProvider } from "@/sites/indeed-provider";
import { linkedInProvider } from "@/sites/linkedin-provider";
import { naukriProvider } from "@/sites/naukri-provider";
import { zipRecruiterProvider } from "@/sites/ziprecruiter-provider";

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
