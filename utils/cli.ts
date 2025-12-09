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
	
	const args = process.argv.slice(2) // Skip 'node' and script name
	let isToday = false
	let dateRange: string | null = null
	
	for (const arg of args) {
		if (arg === '--today') {
			isToday = true
		} else if (arg.startsWith('--date-range=')) {
			dateRange = arg.substring('--date-range='.length)
			// Validate format: should be yyyy-MM-dd,yyyy-MM-dd
			const dateRangeRegex = /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/
			if (!dateRangeRegex.test(dateRange)) {
				throw new Error(`Invalid date range format: ${dateRange}. Expected: yyyy-MM-dd,yyyy-MM-dd`)
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
	
	if (isToday) {
		const today = getToday()
		return { from: today, to: today }
	}
	
	if (dateRange) {
		const [fromStr, toStr] = dateRange.split(',')
		const from = parseDate(fromStr)
		const to = parseDate(toStr)
		
		if (!from || !to) {
			throw new Error(`Invalid dates in date range: ${dateRange}`)
		}
		
		if (from > to) {
			throw new Error(`Start date must be before end date: ${dateRange}`)
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

