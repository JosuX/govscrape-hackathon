import { Page, Locator } from 'playwright'
import { BaseExtractor } from '../base/BaseExtractor'
import type { SOURCE_OPPORTUNITY } from '../schemas/source.schema'

/**
 * OpportunityExtractor
 * 
 * Extracts opportunity/procurement data from detail pages.
 * 
 * This extractor handles all fields defined in SOURCE_OPPORTUNITY schema:
 * - Basic info: id, eventId, title, description
 * - Dates: openDate, closeDate, dueTime, createdAt, lastUpdated
 * - Agency info: entity, agencyNumber, department, division
 * - Classification: category, adType, codes (UNSPSC, NAICS, NIGP)
 * - Contact: buyerName, buyerEmail, buyerPhone
 * - Additional: location, bidSubmissionInstructions, notes, awards, contracts
 */
export class OpportunityExtractor extends BaseExtractor<SOURCE_OPPORTUNITY> {
	/**
	 * Extract opportunity data from the page
	 * 
	 * TODO: Customize selectors based on your target website structure
	 * - Update CSS selectors to match your website's HTML
	 * - Adjust field extraction logic as needed
	 * - Add website-specific handling if required
	 */
	public async extract(page: Page): Promise<SOURCE_OPPORTUNITY> {
		// Wait for page to load
		await page.waitForLoadState('networkidle')

		// Extract basic information
		const eventId = await this.extractFromMultipleSelectors(page, [
			'[data-event-id]',
			'.event-id',
			'#eventId',
			'.opportunity-id',
		]) || await this.extractText(page.locator('h1, h2, .title').first()) || ''

		const title = await this.extractFromMultipleSelectors(page, [
			'h1.title',
			'h1',
			'.opportunity-title',
			'[data-title]',
		]) || ''

		const description = await this.extractFromMultipleSelectors(page, [
			'.description',
			'.opportunity-description',
			'[data-description]',
			'.detail-content',
		]) || ''

		const detail = await this.extractFromMultipleSelectors(page, [
			'.detail',
			'.additional-details',
			'.full-description',
		])

		// Extract dates
		const openDate = await this.extractFromMultipleSelectors(page, [
			'[data-open-date]',
			'.open-date',
			'.posting-date',
			'.start-date',
		]) || ''

		const closeDate = await this.extractFromMultipleSelectors(page, [
			'[data-close-date]',
			'.close-date',
			'.closing-date',
			'.end-date',
			'.deadline',
		]) || ''

		const dueTime = await this.extractFromMultipleSelectors(page, [
			'[data-due-time]',
			'.due-time',
			'.closing-time',
		])

		const createdAt = await this.extractFromMultipleSelectors(page, [
			'[data-created-at]',
			'.created-at',
			'.posted-date',
		])

		const lastUpdated = await this.extractFromMultipleSelectors(page, [
			'[data-last-updated]',
			'.last-updated',
			'.updated-date',
		])

		// Extract status
		const status = await this.extractFromMultipleSelectors(page, [
			'.status',
			'[data-status]',
			'.opportunity-status',
			'.bid-status',
		]) || 'Unknown'

		// Extract agency information
		const entity = await this.extractFromMultipleSelectors(page, [
			'.entity',
			'.agency-name',
			'[data-entity]',
			'.issuing-agency',
		]) || ''

		const agencyNumber = await this.extractFromMultipleSelectors(page, [
			'[data-agency-number]',
			'.agency-number',
			'.agency-code',
		])

		const department = await this.extractFromMultipleSelectors(page, [
			'.department',
			'[data-department]',
			'.agency-department',
		])

		const division = await this.extractFromMultipleSelectors(page, [
			'.division',
			'[data-division]',
			'.agency-division',
		])

		// Extract location
		const location = await this.extractFromMultipleSelectors(page, [
			'.location',
			'[data-location]',
			'.procurement-location',
		])

		// Extract classification
		const category = await this.extractFromMultipleSelectors(page, [
			'.category',
			'[data-category]',
			'.procurement-category',
		])

		const adType = await this.extractFromMultipleSelectors(page, [
			'.ad-type',
			'[data-ad-type]',
			'.advertisement-type',
			'.solicitation-type',
		])

		// Extract codes (UNSPSC, NAICS, NIGP)
		// Try direct selectors first, then fallback to table extraction
		let unspscCodes = await this.extractCodeArray(page, [
			'.unspsc-codes',
			'[data-unspsc]',
			'.unspsc',
		])
		
		// If not found, try extracting from table
		if (!unspscCodes || unspscCodes.length === 0) {
			unspscCodes = await this.extractCodesFromTable(page, ['unspsc', 'unspsc code', 'unspsc codes'])
		}

		let naicsCodes = await this.extractCodeArray(page, [
			'.naics-codes',
			'[data-naics]',
			'.naics',
		])
		
		// If not found, try extracting from table
		if (!naicsCodes || naicsCodes.length === 0) {
			naicsCodes = await this.extractCodesFromTable(page, ['naics', 'naics code', 'naics codes'])
		}

		let nigpCodes = await this.extractCodeArray(page, [
			'.nigp-codes',
			'[data-nigp]',
			'.nigp',
		])
		
		// If not found, try extracting from table
		if (!nigpCodes || nigpCodes.length === 0) {
			nigpCodes = await this.extractCodesFromTable(page, ['nigp', 'nigp code', 'nigp codes'])
		}

		// Extract buyer/contact information
		const buyerName = await this.extractFromMultipleSelectors(page, [
			'.buyer-name',
			'.contact-name',
			'[data-buyer-name]',
			'.procurement-officer',
		]) || ''

		const buyerEmail = await this.extractFromMultipleSelectors(page, [
			'.buyer-email',
			'.contact-email',
			'[data-buyer-email]',
			'a[href^="mailto:"]',
		])

		const buyerPhone = await this.extractFromMultipleSelectors(page, [
			'.buyer-phone',
			'.contact-phone',
			'[data-buyer-phone]',
			'a[href^="tel:"]',
		])

		// Extract additional information
		const bidSubmissionInstructions = await this.extractFromMultipleSelectors(page, [
			'.bid-submission-instructions',
			'.submission-instructions',
			'[data-submission-instructions]',
		])

		const note = await this.extractFromMultipleSelectors(page, [
			'.note',
			'.notes',
			'[data-note]',
			'.additional-notes',
		])

		// Extract award information (if available)
		const awardeeName = await this.extractFromMultipleSelectors(page, [
			'.awardee-name',
			'[data-awardee]',
			'.awarded-to',
		])

		const awardAmount = await this.extractNumber(page, [
			'.award-amount',
			'[data-award-amount]',
			'.contract-amount',
		])

		const awardDate = await this.extractFromMultipleSelectors(page, [
			'.award-date',
			'[data-award-date]',
			'.awarded-date',
		])

		const contractStartDate = await this.extractFromMultipleSelectors(page, [
			'.contract-start-date',
			'[data-contract-start]',
			'.start-date',
		])

		const contractEndDate = await this.extractFromMultipleSelectors(page, [
			'.contract-end-date',
			'[data-contract-end]',
			'.end-date',
		])

		// Get source URL
		const sourceUrl = page.url()

		// Generate ID from eventId and source URL
		const id = this.generateId(eventId, sourceUrl)

		return {
			id,
			eventId,
			title,
			description,
			detail: detail || null,
			openDate,
			closeDate,
			dueTime: dueTime || null,
			createdAt: createdAt || null,
			lastUpdated: lastUpdated || null,
			status,
			entity,
			agencyNumber: agencyNumber || null,
			department: department || null,
			division: division || null,
			location: location || null,
			category: category || null,
			adType: adType || null,
			unspscCodes: unspscCodes && unspscCodes.length > 0 ? unspscCodes : null,
			naicsCodes: naicsCodes && naicsCodes.length > 0 ? naicsCodes : null,
			nigpCodes: nigpCodes && nigpCodes.length > 0 ? nigpCodes : null,
			buyerName,
			buyerEmail: buyerEmail || null,
			buyerPhone: buyerPhone || null,
			bidSubmissionInstructions: bidSubmissionInstructions || null,
			note: note || null,
			awardeeName: awardeeName || null,
			awardAmount: awardAmount || null,
			awardDate: awardDate || null,
			contractStartDate: contractStartDate || null,
			contractEndDate: contractEndDate || null,
			sourceUrl,
		}
	}

	/**
	 * Extract text from a locator
	 */
	protected async extractText(locator: Locator): Promise<string | null> {
		try {
			const count = await locator.count()
			if (count === 0) return null

			const text = await locator.first().textContent()
			return text ? text.trim() : null
		} catch {
			return null
		}
	}

	/**
	 * Extract attribute from a locator
	 */
	protected async extractAttribute(
		locator: Locator,
		attribute: string
	): Promise<string | null> {
		try {
			const count = await locator.count()
			if (count === 0) return null

			const value = await locator.first().getAttribute(attribute)
			return value ? value.trim() : null
		} catch {
			return null
		}
	}

	/**
	 * Extract data from multiple possible selectors
	 */
	protected async extractFromMultipleSelectors(
		page: Page,
		selectors: string[]
	): Promise<string | null> {
		for (const selector of selectors) {
			try {
				const locator = page.locator(selector).first()
				const count = await locator.count()
				if (count > 0) {
					const text = await this.extractText(locator)
					if (text) return text

					// Try getting href for links (email, phone)
					if (selector.includes('href')) {
						const href = await this.extractAttribute(locator, 'href')
						if (href) {
							// Extract email from mailto: links
							if (href.startsWith('mailto:')) {
								return href.replace('mailto:', '').split('?')[0]
							}
							// Extract phone from tel: links
							if (href.startsWith('tel:')) {
								return href.replace('tel:', '').replace(/\s+/g, '')
							}
						}
					}
				}
			} catch {
				continue
			}
		}
		return null
	}

	/**
	 * Extract codes from table by label
	 */
	private async extractCodesFromTable(
		page: Page,
		labels: string[]
	): Promise<string[] | null> {
		// Try common table selectors
		const tableSelectors = [
			'table',
			'.data-table',
			'.codes-table',
			'[data-table]',
			'.classification-table',
		]

		for (const tableSelector of tableSelectors) {
			try {
				const table = page.locator(tableSelector).first()
				const count = await table.count()
				if (count === 0) continue

				const tableData = await this.extractTable(page, tableSelector)
				
				// Look for rows matching the labels
				for (const row of tableData) {
					for (const [key, value] of Object.entries(row)) {
						const keyLower = key.toLowerCase()
						for (const label of labels) {
							if (keyLower.includes(label.toLowerCase())) {
								// Extract codes from the value
								if (value) {
									const codes = value
										.split(/[,;\n]/)
										.map(code => code.trim())
										.filter(code => code.length > 0)
									if (codes.length > 0) {
										return codes
									}
								}
							}
						}
					}
				}
			} catch {
				continue
			}
		}

		return null
	}

	/**
	 * Extract array of codes (UNSPSC, NAICS, NIGP)
	 */
	private async extractCodeArray(
		page: Page,
		selectors: string[]
	): Promise<string[] | null> {
		for (const selector of selectors) {
			try {
				const locator = page.locator(selector)
				const count = await locator.count()
				if (count > 0) {
					// Try to extract from first element (could be comma-separated)
					const text = await this.extractText(locator.first())
					if (text) {
						// Split by comma, semicolon, or newline
						const codes = text
							.split(/[,;\n]/)
							.map(code => code.trim())
							.filter(code => code.length > 0)
						return codes.length > 0 ? codes : null
					}

					// Try to extract from multiple elements
					const allTexts: string[] = []
					for (let i = 0; i < count; i++) {
						const text = await this.extractText(locator.nth(i))
						if (text) allTexts.push(text.trim())
					}
					return allTexts.length > 0 ? allTexts : null
				}
			} catch {
				continue
			}
		}
		return null
	}

	/**
	 * Extract data from a table
	 * 
	 * Extracts structured data from HTML tables by reading headers and rows.
	 * Returns an array of objects where each object represents a row with column names as keys.
	 */
	protected async extractTable(
		page: Page,
		tableSelector: string
	): Promise<Record<string, string>[]> {
		try {
			const table = page.locator(tableSelector).first()
			const count = await table.count()
			if (count === 0) return []

			// Extract headers from <th> elements
			const headers: string[] = []
			const headerCells = table.locator('thead th, th, tr:first-child th, tr:first-child td')
			const headerCount = await headerCells.count()

			if (headerCount > 0) {
				for (let i = 0; i < headerCount; i++) {
					const headerText = await this.extractText(headerCells.nth(i))
					if (headerText) {
						headers.push(headerText.trim().toLowerCase().replace(/\s+/g, '_'))
					} else {
						headers.push(`column_${i + 1}`)
					}
				}
			}

			// If no headers found, try to infer from first row
			if (headers.length === 0) {
				const firstRow = table.locator('tr').first()
				const firstRowCells = firstRow.locator('td, th')
				const firstRowCount = await firstRowCells.count()
				for (let i = 0; i < firstRowCount; i++) {
					const cellText = await this.extractText(firstRowCells.nth(i))
					if (cellText && cellText.trim().length > 0) {
						headers.push(cellText.trim().toLowerCase().replace(/\s+/g, '_'))
					} else {
						headers.push(`column_${i + 1}`)
					}
				}
			}

			// Extract rows
			const rows: Record<string, string>[] = []
			const rowElements = table.locator('tbody tr, tr')
			const rowCount = await rowElements.count()

			// Start from row 1 if we used first row as headers, otherwise start from 0
			const startRow = headers.length > 0 && headerCount > 0 ? 1 : 0

			for (let i = startRow; i < rowCount; i++) {
				const row = rowElements.nth(i)
				const cells = row.locator('td, th')
				const cellCount = await cells.count()

				if (cellCount === 0) continue

				const rowData: Record<string, string> = {}

				for (let j = 0; j < cellCount; j++) {
					const cellText = await this.extractText(cells.nth(j))
					const header = headers[j] || `column_${j + 1}`
					rowData[header] = cellText ? cellText.trim() : ''
				}

				// Only add row if it has at least one non-empty value
				if (Object.values(rowData).some(val => val.length > 0)) {
					rows.push(rowData)
				}
			}

			return rows
		} catch (error) {
			console.warn(`Error extracting table with selector "${tableSelector}":`, error)
			return []
		}
	}

	/**
	 * Extract number from page
	 */
	private async extractNumber(
		page: Page,
		selectors: string[]
	): Promise<number | null> {
		const text = await this.extractFromMultipleSelectors(page, selectors)
		if (!text) return null

		// Remove currency symbols and commas
		const cleaned = text.replace(/[$,\s]/g, '')
		const number = parseFloat(cleaned)
		return isNaN(number) ? null : number
	}

	/**
	 * Generate deterministic ID from eventId and source URL
	 */
	private generateId(eventId: string, sourceUrl: string): string {
		// Create a simple hash-like ID
		const source = sourceUrl.split('/').slice(0, 3).join('')
		return `${source}-${eventId}`.replace(/[^a-zA-Z0-9-]/g, '-')
	}
}

