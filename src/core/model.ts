import type { HttpClient, RetryPolicy } from "@/util/http";

export enum JobType {
  FULL_TIME = "fulltime",
  PART_TIME = "parttime",
  CONTRACT = "contract",
  TEMPORARY = "temporary",
  INTERNSHIP = "internship",
  PER_DIEM = "perdiem",
  NIGHTS = "nights",
  OTHER = "other",
  SUMMER = "summer",
  VOLUNTEER = "volunteer"
}

const JOB_TYPE_ALIASES: Record<JobType, string[]> = {
  [JobType.FULL_TIME]: [
    "fulltime",
    "períodointegral",
    "estágio/trainee",
    "cunormăîntreagă",
    "tiempocompleto",
    "vollzeit",
    "voltijds",
    "tempointegral",
    "全职",
    "plnýúvazek",
    "fuldtid",
    "دوامكامل",
    "kokopäivätyö",
    "tempsplein",
    "πλήρηςαπασχόληση",
    "teljesmunkaidő",
    "tempopieno",
    "heltid",
    "jornadacompleta",
    "pełnyetat",
    "정규직",
    "100%",
    "全職",
    "งานประจำ",
    "tamzamanlı",
    "повназайнятість",
    "toànthờigian"
  ],
  [JobType.PART_TIME]: ["parttime", "teilzeit", "částečnýúvazek", "deltid"],
  [JobType.CONTRACT]: ["contract", "contractor"],
  [JobType.TEMPORARY]: ["temporary"],
  [JobType.INTERNSHIP]: [
    "internship",
    "prácticas",
    "ojt(onthejobtraining)",
    "praktikum",
    "praktik"
  ],
  [JobType.PER_DIEM]: ["perdiem"],
  [JobType.NIGHTS]: ["nights"],
  [JobType.OTHER]: ["other"],
  [JobType.SUMMER]: ["summer"],
  [JobType.VOLUNTEER]: ["volunteer"]
};

interface CountrySpec {
  aliasesCsv: string;
  indeedDomain: string;
  glassdoorDomain?: string;
}

export class Country {
  private static readonly registry: Country[] = [];

  public readonly aliases: string[];

  private constructor(
    public readonly name: string,
    private readonly spec: CountrySpec
  ) {
    this.aliases = spec.aliasesCsv
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    Country.registry.push(this);
  }

  get displayName(): string {
    return this.aliases[0] ?? this.name.toLowerCase();
  }

  get indeedDomainValue(): [string, string] {
    const [subdomain, apiCountryCode] = this.spec.indeedDomain.split(":");
    if (subdomain && apiCountryCode) {
      return [subdomain, apiCountryCode.toUpperCase()];
    }
    return [this.spec.indeedDomain, this.spec.indeedDomain.toUpperCase()];
  }

  get glassdoorDomainValue(): string {
    if (!this.spec.glassdoorDomain) {
      throw new Error(`Glassdoor is not available for ${this.name}`);
    }
    const [subdomain, domain] = this.spec.glassdoorDomain.split(":");
    if (subdomain && domain) {
      return `${subdomain}.glassdoor.${domain}`;
    }
    return `www.glassdoor.${this.spec.glassdoorDomain}`;
  }

  getGlassdoorUrl(): string {
    return `https://${this.glassdoorDomainValue}/`;
  }

  static fromString(countryStr: string): Country {
    const normalized = countryStr.trim().toLowerCase();
    for (const country of Country.registry) {
      if (country.aliases.includes(normalized)) {
        return country;
      }
    }
    const validCountries = Country.registry.map((country) => country.displayName);
    throw new Error(
      `Invalid country string: '${countryStr}'. Valid countries are: ${validCountries.join(", ")}`
    );
  }

  static values(): Country[] {
    return [...Country.registry];
  }

  static readonly ARGENTINA = new Country("ARGENTINA", {
    aliasesCsv: "argentina",
    indeedDomain: "ar",
    glassdoorDomain: "com.ar"
  });
  static readonly AUSTRALIA = new Country("AUSTRALIA", {
    aliasesCsv: "australia",
    indeedDomain: "au",
    glassdoorDomain: "com.au"
  });
  static readonly AUSTRIA = new Country("AUSTRIA", {
    aliasesCsv: "austria",
    indeedDomain: "at",
    glassdoorDomain: "at"
  });
  static readonly BAHRAIN = new Country("BAHRAIN", {
    aliasesCsv: "bahrain",
    indeedDomain: "bh"
  });
  static readonly BANGLADESH = new Country("BANGLADESH", {
    aliasesCsv: "bangladesh",
    indeedDomain: "bd"
  });
  static readonly BELGIUM = new Country("BELGIUM", {
    aliasesCsv: "belgium",
    indeedDomain: "be",
    glassdoorDomain: "fr:be"
  });
  static readonly BULGARIA = new Country("BULGARIA", {
    aliasesCsv: "bulgaria",
    indeedDomain: "bg"
  });
  static readonly BRAZIL = new Country("BRAZIL", {
    aliasesCsv: "brazil",
    indeedDomain: "br",
    glassdoorDomain: "com.br"
  });
  static readonly CANADA = new Country("CANADA", {
    aliasesCsv: "canada",
    indeedDomain: "ca",
    glassdoorDomain: "ca"
  });
  static readonly CHILE = new Country("CHILE", {
    aliasesCsv: "chile",
    indeedDomain: "cl"
  });
  static readonly CHINA = new Country("CHINA", {
    aliasesCsv: "china",
    indeedDomain: "cn"
  });
  static readonly COLOMBIA = new Country("COLOMBIA", {
    aliasesCsv: "colombia",
    indeedDomain: "co"
  });
  static readonly COSTARICA = new Country("COSTARICA", {
    aliasesCsv: "costa rica",
    indeedDomain: "cr"
  });
  static readonly CROATIA = new Country("CROATIA", {
    aliasesCsv: "croatia",
    indeedDomain: "hr"
  });
  static readonly CYPRUS = new Country("CYPRUS", {
    aliasesCsv: "cyprus",
    indeedDomain: "cy"
  });
  static readonly CZECHREPUBLIC = new Country("CZECHREPUBLIC", {
    aliasesCsv: "czech republic,czechia",
    indeedDomain: "cz"
  });
  static readonly DENMARK = new Country("DENMARK", {
    aliasesCsv: "denmark",
    indeedDomain: "dk"
  });
  static readonly ECUADOR = new Country("ECUADOR", {
    aliasesCsv: "ecuador",
    indeedDomain: "ec"
  });
  static readonly EGYPT = new Country("EGYPT", {
    aliasesCsv: "egypt",
    indeedDomain: "eg"
  });
  static readonly ESTONIA = new Country("ESTONIA", {
    aliasesCsv: "estonia",
    indeedDomain: "ee"
  });
  static readonly FINLAND = new Country("FINLAND", {
    aliasesCsv: "finland",
    indeedDomain: "fi"
  });
  static readonly FRANCE = new Country("FRANCE", {
    aliasesCsv: "france",
    indeedDomain: "fr",
    glassdoorDomain: "fr"
  });
  static readonly GERMANY = new Country("GERMANY", {
    aliasesCsv: "germany",
    indeedDomain: "de",
    glassdoorDomain: "de"
  });
  static readonly GREECE = new Country("GREECE", {
    aliasesCsv: "greece",
    indeedDomain: "gr"
  });
  static readonly HONGKONG = new Country("HONGKONG", {
    aliasesCsv: "hong kong",
    indeedDomain: "hk",
    glassdoorDomain: "com.hk"
  });
  static readonly HUNGARY = new Country("HUNGARY", {
    aliasesCsv: "hungary",
    indeedDomain: "hu"
  });
  static readonly INDIA = new Country("INDIA", {
    aliasesCsv: "india",
    indeedDomain: "in",
    glassdoorDomain: "co.in"
  });
  static readonly INDONESIA = new Country("INDONESIA", {
    aliasesCsv: "indonesia",
    indeedDomain: "id"
  });
  static readonly IRELAND = new Country("IRELAND", {
    aliasesCsv: "ireland",
    indeedDomain: "ie",
    glassdoorDomain: "ie"
  });
  static readonly ISRAEL = new Country("ISRAEL", {
    aliasesCsv: "israel",
    indeedDomain: "il"
  });
  static readonly ITALY = new Country("ITALY", {
    aliasesCsv: "italy",
    indeedDomain: "it",
    glassdoorDomain: "it"
  });
  static readonly JAPAN = new Country("JAPAN", {
    aliasesCsv: "japan",
    indeedDomain: "jp"
  });
  static readonly KUWAIT = new Country("KUWAIT", {
    aliasesCsv: "kuwait",
    indeedDomain: "kw"
  });
  static readonly LATVIA = new Country("LATVIA", {
    aliasesCsv: "latvia",
    indeedDomain: "lv"
  });
  static readonly LITHUANIA = new Country("LITHUANIA", {
    aliasesCsv: "lithuania",
    indeedDomain: "lt"
  });
  static readonly LUXEMBOURG = new Country("LUXEMBOURG", {
    aliasesCsv: "luxembourg",
    indeedDomain: "lu"
  });
  static readonly MALAYSIA = new Country("MALAYSIA", {
    aliasesCsv: "malaysia",
    indeedDomain: "malaysia:my",
    glassdoorDomain: "com"
  });
  static readonly MALTA = new Country("MALTA", {
    aliasesCsv: "malta",
    indeedDomain: "malta:mt",
    glassdoorDomain: "mt"
  });
  static readonly MEXICO = new Country("MEXICO", {
    aliasesCsv: "mexico",
    indeedDomain: "mx",
    glassdoorDomain: "com.mx"
  });
  static readonly MOROCCO = new Country("MOROCCO", {
    aliasesCsv: "morocco",
    indeedDomain: "ma"
  });
  static readonly NETHERLANDS = new Country("NETHERLANDS", {
    aliasesCsv: "netherlands",
    indeedDomain: "nl",
    glassdoorDomain: "nl"
  });
  static readonly NEWZEALAND = new Country("NEWZEALAND", {
    aliasesCsv: "new zealand",
    indeedDomain: "nz",
    glassdoorDomain: "co.nz"
  });
  static readonly NIGERIA = new Country("NIGERIA", {
    aliasesCsv: "nigeria",
    indeedDomain: "ng"
  });
  static readonly NORWAY = new Country("NORWAY", {
    aliasesCsv: "norway",
    indeedDomain: "no"
  });
  static readonly OMAN = new Country("OMAN", {
    aliasesCsv: "oman",
    indeedDomain: "om"
  });
  static readonly PAKISTAN = new Country("PAKISTAN", {
    aliasesCsv: "pakistan",
    indeedDomain: "pk"
  });
  static readonly PANAMA = new Country("PANAMA", {
    aliasesCsv: "panama",
    indeedDomain: "pa"
  });
  static readonly PERU = new Country("PERU", {
    aliasesCsv: "peru",
    indeedDomain: "pe"
  });
  static readonly PHILIPPINES = new Country("PHILIPPINES", {
    aliasesCsv: "philippines",
    indeedDomain: "ph"
  });
  static readonly POLAND = new Country("POLAND", {
    aliasesCsv: "poland",
    indeedDomain: "pl"
  });
  static readonly PORTUGAL = new Country("PORTUGAL", {
    aliasesCsv: "portugal",
    indeedDomain: "pt"
  });
  static readonly QATAR = new Country("QATAR", {
    aliasesCsv: "qatar",
    indeedDomain: "qa"
  });
  static readonly ROMANIA = new Country("ROMANIA", {
    aliasesCsv: "romania",
    indeedDomain: "ro"
  });
  static readonly SAUDIARABIA = new Country("SAUDIARABIA", {
    aliasesCsv: "saudi arabia",
    indeedDomain: "sa"
  });
  static readonly SINGAPORE = new Country("SINGAPORE", {
    aliasesCsv: "singapore",
    indeedDomain: "sg",
    glassdoorDomain: "sg"
  });
  static readonly SLOVAKIA = new Country("SLOVAKIA", {
    aliasesCsv: "slovakia",
    indeedDomain: "sk"
  });
  static readonly SLOVENIA = new Country("SLOVENIA", {
    aliasesCsv: "slovenia",
    indeedDomain: "sl"
  });
  static readonly SOUTHAFRICA = new Country("SOUTHAFRICA", {
    aliasesCsv: "south africa",
    indeedDomain: "za"
  });
  static readonly SOUTHKOREA = new Country("SOUTHKOREA", {
    aliasesCsv: "south korea",
    indeedDomain: "kr"
  });
  static readonly SPAIN = new Country("SPAIN", {
    aliasesCsv: "spain",
    indeedDomain: "es",
    glassdoorDomain: "es"
  });
  static readonly SWEDEN = new Country("SWEDEN", {
    aliasesCsv: "sweden",
    indeedDomain: "se"
  });
  static readonly SWITZERLAND = new Country("SWITZERLAND", {
    aliasesCsv: "switzerland",
    indeedDomain: "ch",
    glassdoorDomain: "de:ch"
  });
  static readonly TAIWAN = new Country("TAIWAN", {
    aliasesCsv: "taiwan",
    indeedDomain: "tw"
  });
  static readonly THAILAND = new Country("THAILAND", {
    aliasesCsv: "thailand",
    indeedDomain: "th"
  });
  static readonly TURKEY = new Country("TURKEY", {
    aliasesCsv: "türkiye,turkey",
    indeedDomain: "tr"
  });
  static readonly UKRAINE = new Country("UKRAINE", {
    aliasesCsv: "ukraine",
    indeedDomain: "ua"
  });
  static readonly UNITEDARABEMIRATES = new Country("UNITEDARABEMIRATES", {
    aliasesCsv: "united arab emirates",
    indeedDomain: "ae"
  });
  static readonly UK = new Country("UK", {
    aliasesCsv: "uk,united kingdom",
    indeedDomain: "uk:gb",
    glassdoorDomain: "co.uk"
  });
  static readonly USA = new Country("USA", {
    aliasesCsv: "usa,us,united states",
    indeedDomain: "www:us",
    glassdoorDomain: "com"
  });
  static readonly URUGUAY = new Country("URUGUAY", {
    aliasesCsv: "uruguay",
    indeedDomain: "uy"
  });
  static readonly VENEZUELA = new Country("VENEZUELA", {
    aliasesCsv: "venezuela",
    indeedDomain: "ve"
  });
  static readonly VIETNAM = new Country("VIETNAM", {
    aliasesCsv: "vietnam",
    indeedDomain: "vn",
    glassdoorDomain: "com"
  });
  static readonly US_CANADA = new Country("US_CANADA", {
    aliasesCsv: "usa/ca",
    indeedDomain: "www"
  });
  static readonly WORLDWIDE = new Country("WORLDWIDE", {
    aliasesCsv: "worldwide",
    indeedDomain: "www"
  });
}

export class Location {
  country: Country | string | null;
  city: string | null;
  state: string | null;

  constructor(input?: {
    country?: Country | string | null;
    city?: string | null;
    state?: string | null;
  }) {
    this.country = input?.country ?? null;
    this.city = input?.city ?? null;
    this.state = input?.state ?? null;
  }

  displayLocation(): string {
    const locationParts: string[] = [];
    if (this.city) {
      locationParts.push(this.city);
    }
    if (this.state) {
      locationParts.push(this.state);
    }

    if (typeof this.country === "string") {
      locationParts.push(this.country);
    } else if (
      this.country &&
      this.country !== Country.US_CANADA &&
      this.country !== Country.WORLDWIDE
    ) {
      let countryName = this.country.displayName;
      if (countryName.includes(",")) {
        countryName = countryName.split(",")[0] ?? countryName;
      }
      if (countryName === "usa" || countryName === "uk") {
        locationParts.push(countryName.toUpperCase());
      } else {
        locationParts.push(countryName.charAt(0).toUpperCase() + countryName.slice(1));
      }
    }

    return locationParts.join(", ");
  }
}

export enum CompensationInterval {
  YEARLY = "yearly",
  MONTHLY = "monthly",
  WEEKLY = "weekly",
  DAILY = "daily",
  HOURLY = "hourly"
}

export function getCompensationInterval(payPeriod: string): CompensationInterval | null {
  const intervalMapping: Record<string, CompensationInterval> = {
    YEAR: CompensationInterval.YEARLY,
    HOUR: CompensationInterval.HOURLY,
    WEEK: CompensationInterval.WEEKLY,
    DAY: CompensationInterval.DAILY,
    MONTH: CompensationInterval.MONTHLY,
    ANNUAL: CompensationInterval.YEARLY
  };

  const mapped = intervalMapping[payPeriod];
  if (mapped) {
    return mapped;
  }

  if (Object.values(CompensationInterval).includes(payPeriod as CompensationInterval)) {
    return payPeriod as CompensationInterval;
  }

  return null;
}

export interface Compensation {
  interval?: CompensationInterval | null;
  min_amount?: number | null;
  max_amount?: number | null;
  currency?: string | null;
}

export enum DescriptionFormat {
  MARKDOWN = "markdown",
  HTML = "html",
  PLAIN = "plain"
}

export interface JobPost {
  id?: string | null;
  title: string;
  company_name?: string | null;
  job_url: string;
  job_url_direct?: string | null;
  location?: Location | null;
  description?: string | null;
  company_url?: string | null;
  company_url_direct?: string | null;
  job_type?: JobType[] | null;
  compensation?: Compensation | null;
  salary_source?: SalarySource | null;
  date_posted?: Date | null;
  emails?: string[] | null;
  is_remote?: boolean | null;
  listing_type?: string | null;
  job_level?: string | null;
  company_industry?: string | null;
  company_addresses?: string | null;
  company_num_employees?: string | null;
  company_revenue?: string | null;
  company_description?: string | null;
  company_logo?: string | null;
  banner_photo_url?: string | null;
  job_function?: string | null;
  skills?: string[] | null;
  experience_range?: string | null;
  company_rating?: number | null;
  company_reviews_count?: number | null;
  vacancy_count?: number | null;
  work_from_home_type?: string | null;
  site?: Site | null;
}

export interface JobResponse {
  jobs: JobPost[];
}

export enum Site {
  LINKEDIN = "linkedin",
  INDEED = "indeed",
  ZIP_RECRUITER = "zip_recruiter",
  GLASSDOOR = "glassdoor",
  GOOGLE = "google",
  BAYT = "bayt",
  NAUKRI = "naukri",
  BDJOBS = "bdjobs"
}

export enum SalarySource {
  DIRECT_DATA = "direct_data",
  DESCRIPTION = "description"
}

export interface ScraperInput {
  siteType: Site[];
  searchTerm?: string | null;
  googleSearchTerm?: string | null;
  location?: string | null;
  country?: Country;
  distance?: number | null;
  isRemote: boolean;
  jobType?: JobType | null;
  easyApply?: boolean | null;
  offset: number;
  linkedinFetchDescription: boolean;
  linkedinCompanyIds?: number[] | null;
  descriptionFormat: DescriptionFormat;
  requestTimeout: number;
  resultsWanted: number;
  hoursOld?: number | null;
}

export interface ScrapeJobsPerformanceConfig {
  maxConcurrencyPerSite?: Partial<Record<Site, number>>;
  maxGlobalConcurrency?: number;
  retryPolicy?: RetryPolicy;
  requestTimeoutMs?: number;
  enableAdaptiveConcurrency?: boolean;
}

export interface ScraperOptions {
  proxies?: string[] | string | null;
  caCert?: string | null;
  userAgent?: string | null;
}

export abstract class Scraper {
  constructor(
    public readonly site: Site,
    protected readonly http: HttpClient,
    protected readonly options: ScraperOptions = {}
  ) {}

  abstract scrape(scraperInput: ScraperInput): Promise<JobResponse>;
}

export function getEnumFromJobType(jobTypeStr: string): JobType | null {
  const normalized = jobTypeStr.trim().toLowerCase();
  for (const [jobType, aliases] of Object.entries(JOB_TYPE_ALIASES) as [JobType, string[]][]) {
    if (aliases.includes(normalized)) {
      return jobType;
    }
  }
  return null;
}

export function getJobTypeAliases(jobType: JobType): string[] {
  return JOB_TYPE_ALIASES[jobType];
}
