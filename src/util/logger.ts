export type LogMethod = 'error' | 'warn' | 'info' | 'debug'

const LOG_LEVELS: Record<LogMethod, number> = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
}

let globalLevel = LOG_LEVELS.error

export interface Logger {
	error(message: string, ...args: unknown[]): void
	warn(message: string, ...args: unknown[]): void
	info(message: string, ...args: unknown[]): void
	debug(message: string, ...args: unknown[]): void
}

const loggers = new Map<string, Logger>()

function shouldLog(method: LogMethod): boolean {
	return LOG_LEVELS[method] <= globalLevel
}

function format(name: string, level: LogMethod, message: string): string {
	const now = new Date().toISOString()
	return `${now} - ${level.toUpperCase()} - JobScout:${name} - ${message}`
}

export function createLogger(name: string): Logger {
	const existing = loggers.get(name)
	if (existing) {
		return existing
	}

	const logger: Logger = {
		error(message: string, ...args: unknown[]): void {
			if (!shouldLog('error')) {
				return
			}
			console.error(format(name, 'error', message), ...args)
		},
		warn(message: string, ...args: unknown[]): void {
			if (!shouldLog('warn')) {
				return
			}
			console.warn(format(name, 'warn', message), ...args)
		},
		info(message: string, ...args: unknown[]): void {
			if (!shouldLog('info')) {
				return
			}
			console.info(format(name, 'info', message), ...args)
		},
		debug(message: string, ...args: unknown[]): void {
			if (!shouldLog('debug')) {
				return
			}
			console.debug(format(name, 'debug', message), ...args)
		},
	}

	loggers.set(name, logger)
	return logger
}

export function setLoggerLevel(verbose: number | undefined | null): void {
	if (verbose === null || verbose === undefined) {
		return
	}

	const mapped = new Map<number, number>([
		[0, LOG_LEVELS.error],
		[1, LOG_LEVELS.warn],
		[2, LOG_LEVELS.info],
		[3, LOG_LEVELS.debug],
	])

	const level = mapped.get(verbose)
	if (level === undefined) {
		throw new Error(`Invalid log level: ${verbose}`)
	}

	globalLevel = level
}
