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
		// Cherokee Bids: h1 contains "Procurement #164192"
		let eventId = ''
		try {
			// Wait for h1 to be visible with multiple attempts
			await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {})
			
			// Try multiple ways to get h1 text
			const h1Selectors = ['h1', 'section h1', 'h1.heading', '[role="heading"]']
			for (const selector of h1Selectors) {
				try {
					const h1Locator = page.locator(selector).first()
					const h1Count = await h1Locator.count()
					if (h1Count > 0) {
						const h1Text = await h1Locator.textContent()
						if (h1Text && h1Text.trim()) {
							eventId = h1Text.trim()
							break
						}
					}
				} catch {
					continue
				}
			}
			
			// If still not found, try using innerText as fallback
			if (!eventId) {
				try {
					const h1Locator = page.locator('h1').first()
					const h1Count = await h1Locator.count()
					if (h1Count > 0) {
						const h1Text = await h1Locator.innerText().catch(() => null)
						if (h1Text && h1Text.trim()) {
							eventId = h1Text.trim()
						}
					}
				} catch {
					// Ignore errors
				}
			}
		} catch (error) {
			console.warn('Error extracting h1 text:', error)
		}
		
		// Fallback if h1 extraction failed - extract from URL as last resort
		if (!eventId) {
			const url = page.url()
			const urlMatch = url.match(/\/Details\/(\d+)/)
			if (urlMatch && urlMatch[1]) {
				eventId = `Procurement #${urlMatch[1]}`
			} else {
				eventId = await this.extractFromMultipleSelectors(page, [
					'[data-event-id]',
					'.event-id',
					'#eventId',
					'.opportunity-id',
				]) || ''
			}
		}

		// For Cherokee Bids, title is in a table row with "Title" label
		let title = await this.extractLabeledValue(page, ['Title'])
		
		if (!title) {
			title = await this.extractFromMultipleSelectors(page, [
				'h1',
				'h1.title',
				'.opportunity-title',
				'[data-title]',
				'.title',
			]) || ''
		}

		// Description might be in a section or div, or could be the same as title
		let description = await this.extractLabeledValue(page, ['Description'])
		
		if (!description) {
			description = await this.extractFromMultipleSelectors(page, [
				'.description',
				'.opportunity-description',
				'[data-description]',
				'.detail-content',
				'section p',
				'.content p',
			]) || ''
		}

		const detail = await this.extractFromMultipleSelectors(page, [
			'.detail',
			'.additional-details',
			'.full-description',
		])

		// Extract dates
		// Cherokee Bids: Dates are in labeled table rows
		let openDate = await this.extractLabeledValue(page, ['Open Date', 'OpenDate', 'Opening Date', 'Posting Date', 'Start Date'])
		
		if (!openDate) {
			openDate = await this.extractFromMultipleSelectors(page, [
				'[data-open-date]',
				'.open-date',
				'.posting-date',
				'.start-date',
			]) || ''
		}

		let closeDate = await this.extractLabeledValue(page, ['Close Date', 'CloseDate', 'Closing Date', 'End Date', 'Deadline'])
		
		if (!closeDate) {
			closeDate = await this.extractFromMultipleSelectors(page, [
				'[data-close-date]',
				'.close-date',
				'.closing-date',
				'.end-date',
				'.deadline',
			]) || ''
		}

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
		// Cherokee Bids: Status is in a table row with "Status" label
		let status = await this.extractLabeledValue(page, ['Status'])
		
		if (!status) {
			status = await this.extractFromMultipleSelectors(page, [
				'.status',
				'[data-status]',
				'.opportunity-status',
				'.bid-status',
			]) || 'Unknown'
		}
		
		if (!status || status === '') {
			status = 'Unknown'
		}

		// Extract agency information
		// Cherokee Bids: Entity is in a section labeled "Entity"
		let entity = await this.extractLabeledValue(page, ['Entity', 'Agency', 'Organization'])
		
		if (!entity) {
			entity = await this.extractFromMultipleSelectors(page, [
				'.entity',
				'.agency-name',
				'[data-entity]',
				'.issuing-agency',
			]) || ''
		}
		
		// If still not found, try extracting from table or structured data
		if (!entity) {
			// Try to find entity in tables
			const tableSelectors = ['table', '.data-table', '[data-table]']
			for (const tableSelector of tableSelectors) {
				try {
					const table = page.locator(tableSelector).first()
					const count = await table.count()
					if (count > 0) {
						const tableData = await this.extractTable(page, tableSelector)
						for (const row of tableData) {
							for (const [key, value] of Object.entries(row)) {
								const keyLower = key.toLowerCase()
								if ((keyLower.includes('entity') || keyLower.includes('agency') || keyLower.includes('organization')) && value) {
									entity = value.trim()
									break
								}
							}
							if (entity) break
						}
					}
					if (entity) break
				} catch {
					continue
				}
			}
		}

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
		// Cherokee Bids: Contact info is in "Buyer Contact Information" section
		let buyerName = await this.extractLabeledValue(page, ['Name', 'Contact Name', 'Buyer', 'Officer'])
		
		if (!buyerName) {
			buyerName = await this.extractFromMultipleSelectors(page, [
				'.buyer-name',
				'.contact-name',
				'[data-buyer-name]',
				'.procurement-officer',
			]) || ''
		}
		
		// Try extracting from table if not found
		if (!buyerName) {
			// Try to find name in tables
			const tableSelectors = ['table', '.data-table', '[data-table]']
			for (const tableSelector of tableSelectors) {
				try {
					const table = page.locator(tableSelector).first()
					const count = await table.count()
					if (count > 0) {
						const tableData = await this.extractTable(page, tableSelector)
						for (const row of tableData) {
							for (const [key, value] of Object.entries(row)) {
								const keyLower = key.toLowerCase()
								if ((keyLower.includes('name') || keyLower.includes('buyer') || keyLower.includes('contact')) && value) {
									buyerName = value.trim()
									break
								}
							}
							if (buyerName) break
						}
					}
					if (buyerName) break
				} catch {
					continue
				}
			}
		}

		let buyerEmail = await this.extractLabeledValue(page, ['Email', 'E-mail', 'Contact Email'])
		
		if (!buyerEmail) {
			buyerEmail = await this.extractFromMultipleSelectors(page, [
				'a[href^="mailto:"]',
				'.buyer-email',
				'.contact-email',
				'[data-buyer-email]',
			])
		}
		
		// Try extracting from table if not found
		if (!buyerEmail) {
			// Try to find email in tables
			const tableSelectors = ['table', '.data-table', '[data-table]']
			for (const tableSelector of tableSelectors) {
				try {
					const table = page.locator(tableSelector).first()
					const count = await table.count()
					if (count > 0) {
						const tableData = await this.extractTable(page, tableSelector)
						for (const row of tableData) {
							for (const [key, value] of Object.entries(row)) {
								const keyLower = key.toLowerCase()
								if ((keyLower.includes('email') || keyLower.includes('e-mail')) && value) {
									buyerEmail = value.trim()
									break
								}
							}
							if (buyerEmail) break
						}
					}
					if (buyerEmail) break
				} catch {
					continue
				}
			}
		}

		let buyerPhone = await this.extractLabeledValue(page, ['Phone', 'Telephone', 'Contact Phone', 'Phone Number'])
		
		if (!buyerPhone) {
			buyerPhone = await this.extractFromMultipleSelectors(page, [
				'a[href^="tel:"]',
				'.buyer-phone',
				'.contact-phone',
				'[data-buyer-phone]',
			])
		}
		
		// Try extracting from table if not found
		if (!buyerPhone) {
			// Try to find phone in tables
			const tableSelectors = ['table', '.data-table', '[data-table]']
			for (const tableSelector of tableSelectors) {
				try {
					const table = page.locator(tableSelector).first()
					const count = await table.count()
					if (count > 0) {
						const tableData = await this.extractTable(page, tableSelector)
						for (const row of tableData) {
							for (const [key, value] of Object.entries(row)) {
								const keyLower = key.toLowerCase()
								if ((keyLower.includes('phone') || keyLower.includes('telephone')) && value) {
									buyerPhone = value.trim()
									break
								}
							}
							if (buyerPhone) break
						}
					}
					if (buyerPhone) break
				} catch {
					continue
				}
			}
		}

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
	 * Extract value from labeled sections (e.g., "Name: value", "Entity: value")
	 * Cherokee Bids uses this pattern
	 */
	private async extractLabeledValue(
		page: Page,
		labels: string[]
	): Promise<string | null> {
		try {
			// First, try to extract from tables (Cherokee Bids uses table structure)
			const tableSelectors = ['table', '.data-table', '[data-table]', 'dl', '.detail-list']
			for (const tableSelector of tableSelectors) {
				try {
					const table = page.locator(tableSelector).first()
					const count = await table.count()
					if (count > 0) {
						const tableData = await this.extractTable(page, tableSelector)
						for (const row of tableData) {
							for (const [key, value] of Object.entries(row)) {
								const keyLower = key.toLowerCase().trim()
								for (const label of labels) {
									if (keyLower === label.toLowerCase() || keyLower.includes(label.toLowerCase())) {
										if (value && value.trim()) {
											return value.trim()
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
			
			// Fallback: Look for text containing the label followed by a value
			for (const label of labels) {
				// Try to find element containing the label
				const labelElement = page.locator(`:has-text("${label}")`).first()
				const count = await labelElement.count()
				if (count > 0) {
					// Get the text content
					const text = await this.extractText(labelElement)
					if (text) {
						// Extract value after label (e.g., "Entity: Cherokee Nation" -> "Cherokee Nation")
						const match = text.match(new RegExp(`${label}[:\\s]+(.+)`, 'i'))
						if (match && match[1]) {
							return match[1].trim()
						}
					}
					
					// Try to get value from next sibling or following element
					const nextSibling = labelElement.locator('+ *').first()
					const siblingCount = await nextSibling.count()
					if (siblingCount > 0) {
						const siblingText = await this.extractText(nextSibling)
						if (siblingText && siblingText.trim()) {
							return siblingText.trim()
						}
					}
					
					// Try to get value from parent container's text
					const parent = labelElement.locator('..').first()
					const parentText = await this.extractText(parent)
					if (parentText) {
						const match = parentText.match(new RegExp(`${label}[:\\s]+(.+)`, 'i'))
						if (match && match[1]) {
							return match[1].trim()
						}
					}
					
					// Try to find the value in the same section/container
					// Look for text nodes or elements after the label
					const followingText = labelElement.locator('~ *').first()
					const followingCount = await followingText.count()
					if (followingCount > 0) {
						const followingTextContent = await this.extractText(followingText)
						if (followingTextContent && followingTextContent.trim()) {
							return followingTextContent.trim()
						}
					}
				}
			}
		} catch {
			// Ignore errors
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
		// If eventId is empty, extract from URL
		let idPart = eventId
		if (!idPart || idPart.trim() === '') {
			// Try to extract ID from URL (e.g., /Details/164192)
			const urlMatch = sourceUrl.match(/\/(\d+)$/)
			if (urlMatch && urlMatch[1]) {
				idPart = urlMatch[1]
			} else {
				// Fallback to full URL path
				idPart = sourceUrl.split('/').pop() || 'unknown'
			}
		}
		
		// Create a simple hash-like ID
		const source = sourceUrl.split('/').slice(0, 3).join('')
		return `${source}-${idPart}`.replace(/[^a-zA-Z0-9-]/g, '-')
	}
}

