# job-scout &middot; ![npm version](https://img.shields.io/npm/v/job-scout)

TypeScript-first job scraping library for LinkedIn, Indeed, ZipRecruiter, Glassdoor, Google Jobs, Bayt, Naukri, and BDJobs.

## Install

```bash
npm install job-scout
```

Node `>=20` is required.

## Quick Start

```ts
import { scoutJobs } from 'job-scout'

const jobs = await scoutJobs(
	{
		sites: ['indeed', 'linkedin', 'zipRecruiter', 'google'],
		query: 'software engineer',
		location: 'San Francisco, CA',
		pagination: { limitPerSite: 20 },
		filters: { postedWithinHours: 72 },
		google: {
			query: 'software engineer jobs near San Francisco, CA since yesterday',
		},
		indeed: { country: 'usa' },
		linkedin: { fetchDescription: true },
	},
	{
		transport: {
			timeoutMs: 20_000,
		},
		logging: {
			level: 'warn',
		},
	},
)

console.log(jobs.length)
console.log(jobs[0])
```

## Client API

```ts
import { createClient } from 'job-scout'

const client = createClient({
	transport: { timeoutMs: 20_000 },
	logging: { level: 'warn' },
})

const jobs = await client.scoutJobs({
	sites: ['indeed'],
	query: 'backend engineer',
	location: 'Austin, TX',
	indeed: { country: 'usa' },
})
```

## Public API

- `createClient(config?: JobScoutConfig): JobScoutClient`
- `scoutJobs(request: JobSearchRequest, config?: JobScoutConfig): Promise<Job[]>`
- `scoutJobRows(request: JobSearchRequest, config?: JobScoutConfig): Promise<JobRow[]>`
- `toJobRows(jobs: Job[]): JobRow[]`

## Request Model

`JobSearchRequest` supports:

- `sites?: JobSite[]`
- `query?: string`
- `location?: string`
- `pagination?: { limitPerSite?: number; offset?: number }`
- `filters?: { distanceMiles?: number; remote?: boolean; easyApply?: boolean; employmentType?: ...; postedWithinHours?: number }`
- `linkedin?: { fetchDescription?: boolean; companyIds?: number[] }`
- `indeed?: { country?: string }`
- `google?: { query?: string }`

Constraint rules enforced at runtime:

- If `sites` includes `google`, `google.query` is required.
- For Indeed, use only one filter group at a time:
  - `filters.postedWithinHours`
  - `filters.easyApply`
  - `filters.employmentType`/`filters.remote`
- For LinkedIn, `filters.postedWithinHours` and `filters.easyApply` cannot both be enabled.

## Configuration

`JobScoutConfig`:

- `transport`: proxies, user agent, CA cert path, timeout
- `performance`: global/site concurrency, retry policy, adaptive concurrency
- `output`: description format, salary annualization, salary fallback behavior
- `logging`: `error | warn | info | debug`

## Testing

Unit tests:

```bash
bun run test
```

Live integration tests:

```bash
JOBSCOUT_TEST_PROXIES="host1:port1,host2:port2" \
bun run test:integration:live
```

Full suite:

```bash
bun run test:all
```

## Release

This package is published through GitHub Actions using npm trusted publishing (OIDC).

### Publish a new version

1. Update the version in `package.json`.
2. Commit and push the version change.
3. Create and push a matching tag:

```bash
git tag v<package-version>
git push origin v<package-version>
```

The publish workflow verifies that `v<package-version>` exactly matches `package.json` and then runs:

- `bun run typecheck`
- `bun run test`
- `bun run build`
- `npm publish --provenance --access public`
