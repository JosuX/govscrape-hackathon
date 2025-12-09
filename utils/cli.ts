/**
 * CLI Utilities
 * 
 * Parse command line arguments and provide date range utilities.
 * 
 * Supported flags:
 * - --today: Scrape data from today only
 * - --date-range=yyyy-MM-dd,yyyy-MM-dd: Scrape data from custom date range
 * - Default: Scrape data from previous day
 * 
 * Examples:
 * - npm run scraper (scrapes yesterday)
 * - npm run scraper --today (scrapes today)
 * - npm run scraper --date-range=2024-01-01,2024-01-31 (scrapes January 2024)
 */

export interface DateRange {
	from: Date
	to: Date
}

/**
 * Parse command line arguments
 * 
 * Extracts CLI flags from process.argv and returns parsed options.
 * 
 * @returns Parsed CLI options
 * 
 * TODO: Implement argument parsing
 * - Parse process.argv
 * - Look for --today flag
 * - Look for --date-range flag with format validation
 * - Return object with parsed options
 */
export function parseArgs(): {
	isToday: boolean
	dateRange: string | null
} {
	// TODO: Implement argument parsing
	// - Parse process.argv
	// - Look for --today flag
	// - Look for --date-range flag with format validation
	// - Return object with parsed options
	// Hint: process.argv contains command line arguments
	// Example: ['node', 'scraper.js', '--today']
	
	// process.argv contains: ['node', 'script.js', ...args]
	// When run via npm/tsx, it might be: ['tsx', 'script.ts', ...args] or ['node', 'script.js', ...args]
	// When run via npm run, arguments after -- should be passed through, but npm might consume some
	// Also check environment variables as fallback
	const args = process.argv.slice(2) // Skip executable and script name
	let isToday = false
	let dateRange: string | null = null
	
	// Check environment variables first (useful when npm consumes arguments)
	if (process.env.DATE_RANGE) {
		dateRange = process.env.DATE_RANGE
	} else if (process.env.SCRAPER_DATE_RANGE) {
		dateRange = process.env.SCRAPER_DATE_RANGE
	}
	
	if (process.env.TODAY === 'true' || process.env.SCRAPER_TODAY === 'true') {
		isToday = true
	}
	
	// Debug: log all arguments
	if (process.env.DEBUG_CLI || process.env.NODE_ENV === 'development') {
		console.log('[CLI Debug] process.argv:', process.argv)
		console.log('[CLI Debug] Parsed args array:', args)
		console.log('[CLI Debug] Environment variables:', {
			DATE_RANGE: process.env.DATE_RANGE,
			SCRAPER_DATE_RANGE: process.env.SCRAPER_DATE_RANGE,
			TODAY: process.env.TODAY,
			SCRAPER_TODAY: process.env.SCRAPER_TODAY,
		})
	}
	
	// Parse command line arguments (override env vars if provided)
	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		
		if (arg === '--today' || arg === 'today') {
			isToday = true
			dateRange = null // Clear date range if today is set
		} else if (arg.startsWith('--date-range=')) {
			let rawRange = arg.substring('--date-range='.length)
			// PowerShell may split comma-separated values, so check if next arg is a date
			if (i + 1 < args.length) {
				const nextArg = args[i + 1]
				// If next arg looks like a date (yyyy-MM-dd), combine them
				if (/^\d{4}-\d{2}-\d{2}$/.test(nextArg)) {
					rawRange = `${rawRange},${nextArg}`
					i++ // Skip the next argument since we consumed it
				}
			}
			// Normalize: replace spaces with commas (PowerShell may split on comma)
			rawRange = rawRange.replace(/\s+/g, ',')
			// Validate format: should be yyyy-MM-dd,yyyy-MM-dd
			const dateRangeRegex = /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/
			if (!dateRangeRegex.test(rawRange)) {
				console.warn(`[CLI] Invalid date range format: "${rawRange}". Expected: yyyy-MM-dd,yyyy-MM-dd`)
				dateRange = null
			} else {
				dateRange = rawRange
				if (process.env.DEBUG_CLI || process.env.NODE_ENV === 'development') {
					console.log('[CLI Debug] Found date-range argument:', dateRange)
				}
			}
		} else if (arg === '--date-range' && i + 1 < args.length) {
			// Handle --date-range as separate argument: --date-range 2025-12-04,2025-12-08
			// Or --date-range 2025-12-04 2025-12-08 (PowerShell may split on comma)
			let rawRange = args[i + 1]
			if (i + 2 < args.length) {
				const nextNextArg = args[i + 2]
				// If second arg looks like a date, combine them
				if (/^\d{4}-\d{2}-\d{2}$/.test(nextNextArg)) {
					rawRange = `${rawRange},${nextNextArg}`
					i++ // Skip the second date argument
				}
			}
			// Normalize: replace spaces with commas
			rawRange = rawRange.replace(/\s+/g, ',')
			if (rawRange && /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/.test(rawRange)) {
				dateRange = rawRange
				i++ // Skip the date range argument
			}
		} else if (arg.startsWith('date-range=')) {
			// Handle without -- prefix (in case npm strips it)
			let rawRange = arg.substring('date-range='.length)
			// Check if next arg is a date
			if (i + 1 < args.length) {
				const nextArg = args[i + 1]
				if (/^\d{4}-\d{2}-\d{2}$/.test(nextArg)) {
					rawRange = `${rawRange},${nextArg}`
					i++
				}
			}
			rawRange = rawRange.replace(/\s+/g, ',')
			const dateRangeRegex = /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/
			if (!dateRangeRegex.test(rawRange)) {
				console.warn(`[CLI] Invalid date range format: "${rawRange}". Expected: yyyy-MM-dd,yyyy-MM-dd`)
				dateRange = null
			} else {
				dateRange = rawRange
			}
		}
	}
	
	return { isToday, dateRange }
}

/**
 * Get date range based on CLI arguments
 * 
 * Returns date range object based on parsed CLI flags.
 * 
 * @returns DateRange object with from and to dates
 * 
 * TODO: Implement date range logic
 * - Call parseArgs() to get CLI options
 * - If --today flag: return today's date range
 * - If --date-range flag: parse and validate dates
 * - Default: return yesterday's date range
 * - Handle invalid date formats gracefully
 * - Use UTC dates to avoid timezone issues
 */
export function getDateRange(): DateRange {
	// TODO: Implement date range logic
	// - Call parseArgs() to get CLI options
	// - If --today flag: return today's date range
	// - If --date-range flag: parse and validate dates
	// - Default: return yesterday's date range
	// - Handle invalid date formats gracefully
	// - Use UTC dates to avoid timezone issues
	
	const { isToday, dateRange } = parseArgs()
	
	// Debug: log parsed arguments
	if (process.env.DEBUG_CLI || process.env.NODE_ENV === 'development') {
		console.log('[CLI Debug] Parsed args:', { isToday, dateRange })
	}
	
	if (isToday) {
		const today = getToday()
		return { from: today, to: today }
	}
	
	if (dateRange) {
		const parts = dateRange.split(',')
		if (parts.length !== 2) {
			console.warn(`[CLI] Invalid date range format: "${dateRange}". Expected: yyyy-MM-dd,yyyy-MM-dd. Falling back to yesterday.`)
			const yesterday = getYesterday()
			return { from: yesterday, to: yesterday }
		}
		
		const [fromStr, toStr] = parts.map(s => s.trim())
		
		if (process.env.DEBUG_CLI || process.env.NODE_ENV === 'development') {
			console.log('[CLI Debug] Split date range:', { fromStr, toStr })
		}
		
		const from = parseDate(fromStr)
		const to = parseDate(toStr)
		
		if (!from || !to) {
			console.warn(`[CLI] Invalid dates in date range: "${dateRange}" (from: "${fromStr}" -> ${from}, to: "${toStr}" -> ${to}). Falling back to yesterday.`)
			const yesterday = getYesterday()
			return { from: yesterday, to: yesterday }
		}
		
		if (from > to) {
			console.warn(`[CLI] Start date must be before end date: ${dateRange}. Falling back to yesterday.`)
			const yesterday = getYesterday()
			return { from: yesterday, to: yesterday }
		}
		
		return { from, to }
	}
	
	// Default: yesterday
	const yesterday = getYesterday()
	return { from: yesterday, to: yesterday }
}

/**
 * Format date to yyyy-MM-dd string
 * 
 * @param date - Date object to format
 * @returns Formatted date string
 * 
 * TODO: Implement date formatting
 * - Use UTC methods to avoid timezone issues
 * - Format as yyyy-MM-dd
 * - Pad month and day with zeros
 */
export function formatDate(date: Date): string {
	// TODO: Implement date formatting
	// - Use UTC methods to avoid timezone issues
	// - Format as yyyy-MM-dd
	// - Pad month and day with zeros
	
	const year = date.getUTCFullYear()
	const month = String(date.getUTCMonth() + 1).padStart(2, '0')
	const day = String(date.getUTCDate()).padStart(2, '0')
	
	return `${year}-${month}-${day}`
}

/**
 * Parse date string in yyyy-MM-dd format
 * 
 * @param dateStr - Date string to parse
 * @returns Date object or null if invalid
 * 
 * TODO: Implement date parsing
 * - Validate format (yyyy-MM-dd)
 * - Parse to Date object
 * - Use UTC to avoid timezone issues
 * - Return null for invalid dates
 */
export function parseDate(dateStr: string): Date | null {
	// TODO: Implement date parsing
	// - Validate format (yyyy-MM-dd)
	// - Parse to Date object
	// - Use UTC to avoid timezone issues
	// - Return null for invalid dates
	
	const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/
	const match = dateStr.match(dateRegex)
	
	if (!match) {
		return null
	}
	
	const year = parseInt(match[1], 10)
	const month = parseInt(match[2], 10) - 1 // Month is 0-indexed
	const day = parseInt(match[3], 10)
	
	// Validate month and day
	if (month < 0 || month > 11 || day < 1 || day > 31) {
		return null
	}
	
	const date = new Date(Date.UTC(year, month, day))
	
	// Verify the date is valid (handles invalid dates like Feb 30)
	if (date.getUTCFullYear() !== year || 
		date.getUTCMonth() !== month || 
		date.getUTCDate() !== day) {
		return null
	}
	
	return date
}

/**
 * Get yesterday's date
 * 
 * @returns Date object for yesterday
 * 
 * TODO: Implement yesterday calculation
 * - Get current date
 * - Subtract one day
 * - Return Date object
 */
export function getYesterday(): Date {
	// TODO: Implement yesterday calculation
	// - Get current date
	// - Subtract one day
	// - Return Date object
	
	const today = new Date()
	const yesterday = new Date(today)
	yesterday.setUTCDate(yesterday.getUTCDate() - 1)
	yesterday.setUTCHours(0, 0, 0, 0) // Set to start of day
	
	return yesterday
}

/**
 * Get today's date at start of day (00:00:00)
 * 
 * @returns Date object for today
 * 
 * TODO: Implement today calculation
 * - Get current date
 * - Set to start of day
 * - Return Date object
 */
export function getToday(): Date {
	// TODO: Implement today calculation
	// - Get current date
	// - Set to start of day
	// - Return Date object
	
	const today = new Date()
	today.setUTCHours(0, 0, 0, 0) // Set to start of day
	
	return today
}

