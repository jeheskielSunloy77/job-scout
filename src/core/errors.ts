import type { Site } from '../model.js'

export class JobScoutError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'JobScoutError'
	}
}

export class JobScoutValidationError extends JobScoutError {
	constructor(message: string) {
		super(message)
		this.name = 'JobScoutValidationError'
	}
}

export class SiteExecutionError extends JobScoutError {
	constructor(
		public readonly site: Site,
		message: string,
		public readonly rootCause?: unknown,
	) {
		super(`[${site}] ${message}`)
		this.name = 'SiteExecutionError'
	}
}
