import * as crypto from 'crypto'

/**
 * Helper Utilities
 * 
 * Common utility functions used throughout the scraper and intake.
 */

/**
 * Generate deterministic ID from string
 * 
 * Creates a unique, deterministic ID by hashing the input string.
 * Same input always produces same output.
 * 
 * @param input - Input string to hash
 * @param prefix - Optional prefix for the ID
 * @returns Deterministic ID
 * 
 * TODO: Implement ID generation
 * - Use crypto.createHash('sha256')
 * - Hash the input string
 * - Take first 16 characters of hex digest
 * - Add prefix if provided
 * - Return formatted ID
 * 
 * Example: generateId('GA-2024-001', 'contract') => 'contract-a1b2c3d4e5f6g7h8'
 */
export function generateId(input: string, prefix?: string): string {
	// TODO: Implement ID generation
	// - Use crypto.createHash('sha256')
	// - Hash the input string
	// - Take first 16 characters of hex digest
	// - Add prefix if provided
	// - Return formatted ID
	
	const hash = crypto.createHash('sha256')
		.update(input)
		.digest('hex')
		.substring(0, 16)
	
	return prefix ? `${prefix}-${hash}` : hash
}

/**
 * Delay execution for specified milliseconds
 * 
 * Use this to be polite to target servers (rate limiting).
 * 
 * @param ms - Milliseconds to delay
 * 
 * TODO: Implement delay
 * - Return a Promise that resolves after ms milliseconds
 * - Use setTimeout
 */
export async function delay(ms: number): Promise<void> {
	// TODO: Implement delay
	// - Return a Promise that resolves after ms milliseconds
	// - Use setTimeout
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Clean and normalize text
 * 
 * Removes extra whitespace, trims, and normalizes text.
 * 
 * @param text - Text to clean
 * @returns Cleaned text or null if empty
 * 
 * TODO: Implement text cleaning
 * - Trim whitespace
 * - Replace multiple spaces with single space
 * - Replace newlines with spaces
 * - Return null if empty after cleaning
 */
export function cleanText(text: string | null | undefined): string | null {
	// TODO: Implement text cleaning
	// - Trim whitespace
	// - Replace multiple spaces with single space
	// - Replace newlines with spaces
	// - Return null if empty after cleaning
	
	if (!text) return null
	
	let cleaned = text.trim()
		.replace(/\s+/g, ' ') // Replace multiple spaces with single space
		.replace(/\n+/g, ' ') // Replace newlines with spaces
		.trim()
	
	return cleaned.length > 0 ? cleaned : null
}

/**
 * Sanitize filename
 * 
 * Removes or replaces characters that are invalid in filenames.
 * 
 * @param fileName - Original filename
 * @returns Sanitized filename
 * 
 * TODO: Implement filename sanitization
 * - Replace invalid characters (/, \, :, *, ?, ", <, >, |) with underscore
 * - Trim whitespace
 * - Limit length if needed
 * - Ensure valid extension remains intact
 */
export function sanitizeFileName(fileName: string): string {
	// TODO: Implement filename sanitization
	// - Replace invalid characters (/, \, :, *, ?, ", <, >, |) with underscore
	// - Trim whitespace
	// - Limit length if needed
	// - Ensure valid extension remains intact
	
	// Extract extension before sanitization
	const lastDot = fileName.lastIndexOf('.')
	const hasExtension = lastDot > 0 && lastDot < fileName.length - 1
	const extension = hasExtension ? fileName.substring(lastDot) : ''
	const nameWithoutExt = hasExtension ? fileName.substring(0, lastDot) : fileName
	
	// Replace invalid characters with underscore
	let sanitized = nameWithoutExt
		.replace(/[/\\:*?"<>|]/g, '_') // Replace invalid characters
		.replace(/\s+/g, '_') // Replace spaces with underscores
		.trim()
	
	// Limit length (max 200 chars for name, keep extension)
	const maxLength = 200
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength)
	}
	
	// Remove trailing dots and underscores
	sanitized = sanitized.replace(/[._]+$/, '')
	
	return sanitized + extension
}

/**
 * Parse date string to Date object
 * 
 * Handles various date formats commonly found in procurement sites.
 * 
 * @param dateStr - Date string in various formats
 * @returns Date object or null if invalid
 * 
 * TODO: Implement date parsing
 * - Try parsing common formats:
 *   - ISO: 2024-01-15
 *   - US: 01/15/2024
 *   - Text: Jan 15, 2024
 *   - With time: Jan 15, 2024 @ 05:00 PM ET
 * - Return Date object if successful
 * - Return null if unable to parse
 * - Handle timezone indicators if present
 */
export function parseFlexibleDate(dateStr: string | null): Date | null {
	// TODO: Implement flexible date parsing
	// - Try parsing common formats:
	//   - ISO: 2024-01-15
	//   - US: 01/15/2024
	//   - Text: Jan 15, 2024
	//   - With time: Jan 15, 2024 @ 05:00 PM ET
	// - Return Date object if successful
	// - Return null if unable to parse
	// - Handle timezone indicators if present
	
	if (!dateStr) return null
	
	const cleaned = dateStr.trim()
	if (!cleaned) return null
	
	// Try ISO format: 2024-01-15
	const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|T|$)/)
	if (isoMatch) {
		const date = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`)
		if (!isNaN(date.getTime())) return date
	}
	
	// Try US format: 01/15/2024 or 1/15/2024
	const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
	if (usMatch) {
		const month = usMatch[1].padStart(2, '0')
		const day = usMatch[2].padStart(2, '0')
		const year = usMatch[3]
		const date = new Date(`${year}-${month}-${day}`)
		if (!isNaN(date.getTime())) return date
	}
	
	// Try text format: Jan 15, 2024 or January 15, 2024
	// Remove timezone indicators and time
	const textCleaned = cleaned
		.replace(/@\s*\d{1,2}:\d{2}\s*(AM|PM)?/gi, '') // Remove time
		.replace(/\s*(ET|EST|EDT|PT|PST|PDT|CT|CST|CDT|MT|MST|MDT|UTC|GMT)\s*/gi, '') // Remove timezone
		.trim()
	
	const date = new Date(textCleaned)
	if (!isNaN(date.getTime())) return date
	
	// Fallback: Try native Date parsing
	const fallbackDate = new Date(cleaned)
	if (!isNaN(fallbackDate.getTime())) return fallbackDate
	
	return null
}

/**
 * Extract monetary value from string
 * 
 * Parses monetary amounts from text.
 * 
 * @param text - Text containing monetary value
 * @returns Numeric value or null
 * 
 * TODO: Implement monetary parsing
 * - Remove currency symbols ($, etc.)
 * - Remove commas
 * - Parse to float
 * - Handle ranges (take first value)
 * - Return null if unable to parse
 * 
 * Examples:
 * - "$1,000.00" => 1000
 * - "$500K" => 500000
 * - "$1M - $5M" => 1000000
 */
export function parseMonetaryValue(text: string | null): number | null {
	// TODO: Implement monetary parsing
	// - Remove currency symbols ($, etc.)
	// - Remove commas
	// - Parse to float
	// - Handle ranges (take first value)
	// - Return null if unable to parse
	// 
	// Examples:
	// - "$1,000.00" => 1000
	// - "$500K" => 500000
	// - "$1M - $5M" => 1000000
	
	if (!text) return null
	
	// Extract first value if range (e.g., "$1M - $5M" => "$1M")
	const rangeMatch = text.match(/^([^-\s]+)/)
	const valueStr = rangeMatch ? rangeMatch[1] : text
	
	// Remove currency symbols and commas
	let cleaned = valueStr
		.replace(/[$,\s]/g, '')
		.trim()
	
	// Handle K (thousands) and M (millions)
	let multiplier = 1
	if (cleaned.toUpperCase().endsWith('K')) {
		multiplier = 1000
		cleaned = cleaned.slice(0, -1)
	} else if (cleaned.toUpperCase().endsWith('M')) {
		multiplier = 1000000
		cleaned = cleaned.slice(0, -1)
	} else if (cleaned.toUpperCase().endsWith('B')) {
		multiplier = 1000000000
		cleaned = cleaned.slice(0, -1)
	}
	
	// Parse to float
	const number = parseFloat(cleaned)
	if (isNaN(number)) return null
	
	return Math.round(number * multiplier)
}

/**
 * Deduplicate array of objects by key
 * 
 * Removes duplicate objects based on a unique key.
 * 
 * @param items - Array of objects
 * @param keyFn - Function to extract unique key from object
 * @returns Deduplicated array
 * 
 * TODO: Implement deduplication
 * - Use Map or Set to track seen keys
 * - Iterate through items
 * - Keep only first occurrence of each key
 * - Return deduplicated array
 */
export function deduplicateBy<T>(items: T[], keyFn: (item: T) => string): T[] {
	// TODO: Implement deduplication
	// - Use Map or Set to track seen keys
	// - Iterate through items
	// - Keep only first occurrence of each key
	// - Return deduplicated array
	
	const seen = new Map<string, T>()
	
	for (const item of items) {
		const key = keyFn(item)
		if (!seen.has(key)) {
			seen.set(key, item)
		}
	}
	
	return Array.from(seen.values())
}

/**
 * Retry async function with exponential backoff
 * 
 * Retries a function if it fails, with increasing delays between attempts.
 * 
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelay - Initial delay in ms (doubles each retry)
 * @returns Result of the function
 * 
 * TODO: Implement retry logic
 * - Try executing function
 * - If it fails, wait and retry
 * - Double delay after each attempt
 * - Throw error if all retries exhausted
 */
export async function retry<T>(
	fn: () => Promise<T>,
	maxRetries: number = 3,
	initialDelay: number = 1000
): Promise<T> {
	// TODO: Implement retry logic
	// - Try executing function
	// - If it fails, wait and retry
	// - Double delay after each attempt
	// - Throw error if all retries exhausted
	
	let lastError: Error | null = null
	let delay = initialDelay
	
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error))
			
			// Don't wait after last attempt
			if (attempt < maxRetries) {
				await new Promise(resolve => setTimeout(resolve, delay))
				delay *= 2 // Double delay for next retry
			}
		}
	}
	
	throw lastError || new Error('Retry failed: unknown error')
}

/**
 * Log message with timestamp
 * 
 * @param source - Source/module name
 * @param message - Log message
 * @param level - Log level ('info', 'warn', 'error')
 * 
 * TODO: Implement logging
 * - Get current timestamp
 * - Format: [TIMESTAMP] [SOURCE] [LEVEL] message
 * - Use console.log/warn/error based on level
 */
export function log(
	source: string,
	message: string,
	level: 'info' | 'warn' | 'error' = 'info'
): void {
	// TODO: Implement logging
	// - Get current timestamp
	// - Format: [TIMESTAMP] [SOURCE] [LEVEL] message
	// - Use console.log/warn/error based on level
	
	const timestamp = new Date().toISOString()
	const formatted = `[${timestamp}] [${source}] [${level.toUpperCase()}] ${message}`
	
	switch (level) {
		case 'error':
			console.error(formatted)
			break
		case 'warn':
			console.warn(formatted)
			break
		default:
			console.log(formatted)
	}
}

