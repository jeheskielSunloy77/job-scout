import type { JobSite } from '../src/index'
import { scoutJobs } from '../src/index'

async function typecheckJobSearchRequest() {
	await scoutJobs({
		sites: ['indeed'],
		query: 'backend engineer',
		indeed: { country: 'usa' },
	})

	await scoutJobs({
		sites: ['google'],
		query: 'software engineer',
		google: { query: 'software engineer jobs near Yogyakarta, Indonesia' },
	})

	await scoutJobs({
		sites: ['indeed'],
		query: 'software engineer',
		filters: { postedWithinHours: 24 },
	})

	await scoutJobs({
		sites: ['linkedin'],
		query: 'software engineer',
		filters: { easyApply: true },
	})

	const dynamicSites: JobSite[] = ['indeed', 'linkedin']

	await scoutJobs({
		sites: dynamicSites,
		query: 'software engineer',
		google: { query: 'software engineer jobs near Austin, TX' },
	})

	// @ts-expect-error sites is required.
	await scoutJobs({})

	// @ts-expect-error google.query is required when sites includes google.
	await scoutJobs({
		sites: ['google'],
		query: 'software engineer',
	})

	await scoutJobs({
		sites: ['indeed'],
		query: 'software engineer',
		// @ts-expect-error Indeed supports only one filter group at a time.
		filters: { postedWithinHours: 24, easyApply: true },
	})

	await scoutJobs({
		sites: ['linkedin'],
		query: 'software engineer',
		// @ts-expect-error LinkedIn cannot combine postedWithinHours + easyApply=true.
		filters: { postedWithinHours: 24, easyApply: true },
	})

	// @ts-expect-error Non-literal JobSite[] may include google, so google.query is required.
	await scoutJobs({
		sites: dynamicSites,
		query: 'software engineer',
	})
}

void typecheckJobSearchRequest
