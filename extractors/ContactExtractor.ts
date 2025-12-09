import { Page, Locator } from 'playwright'
import { BaseExtractor } from '../base/BaseExtractor'

/**
 * ContactExtractor
 * 
 * Extracts contact/buyer information from complex contact sections.
 * 
 * Use this extractor when contact information is:
 * - In a separate section or modal
 * - In a structured table format
 * - Split across multiple contacts
 * - Requires special parsing logic
 * 
 * Returns contact data that can be merged into SOURCE_OPPORTUNITY:
 * - buyerName: string
 * - buyerEmail: string | null
 * - buyerPhone: string | null
 * 
 * If contact info is simple and on the main page, you can extract it
 * directly in OpportunityExtractor instead.
 */
export interface ContactData {
	buyerName: string
	buyerEmail: string | null
	buyerPhone: string | null
}

export class ContactExtractor extends BaseExtractor<ContactData> {
	/**
	 * Extract contact information from the page
	 * 
	 * TODO: Customize selectors based on your target website structure
	 * - Update CSS selectors to match your website's contact section
	 * - Adjust extraction logic for table-based contact info
	 * - Handle multiple contacts if needed (returns primary contact)
	 * - Add logic to click modals or expand sections if required
	 */
	public async extract(page: Page): Promise<ContactData> {
		// Wait for page to load
		await page.waitForLoadState('networkidle')

		// Try to find contact section first
		// Cherokee Bids: Look for "Buyer Contact Information" section
		const contactSectionSelectors = [
			':has-text("Buyer Contact Information")',
			':has-text("Contact Information")',
			'.contact-section',
			'.buyer-info',
			'.contact-information',
			'[data-contact]',
			'.procurement-officer',
			'.contact-details',
		]

		let contactContainer: Locator | null = null

		// Find contact container
		for (const selector of contactSectionSelectors) {
			try {
				const container = page.locator(selector).first()
				const count = await container.count()
				if (count > 0) {
					contactContainer = container
					break
				}
			} catch {
				continue
			}
		}

		// Extract from container or entire page
		const searchContext = contactContainer || page

		// Extract buyer name
		// Cherokee Bids: Look for "Name:" label followed by the name
		let buyerName = await this.extractLabeledValue(searchContext, ['Name', 'Contact Name', 'Buyer', 'Officer'])
		
		if (!buyerName) {
			buyerName = await this.extractFromMultipleSelectors(searchContext, [
				'.buyer-name',
				'.contact-name',
				'[data-buyer-name]',
				'[data-contact-name]',
				'.procurement-officer-name',
				'.officer-name',
				'label:has-text("Name") + *',
				'label:has-text("Contact") + *',
			]) || await this.extractFromTable(searchContext, ['Name', 'Contact Name', 'Buyer', 'Officer'])
		}

		// Extract buyer email
		let buyerEmail = await this.extractLabeledValue(searchContext, ['Email', 'E-mail', 'Contact Email'])
		
		if (!buyerEmail) {
			buyerEmail = await this.extractEmail(searchContext)
		}

		// Extract buyer phone
		let buyerPhone = await this.extractLabeledValue(searchContext, ['Phone', 'Telephone', 'Contact Phone', 'Phone Number'])
		
		if (!buyerPhone) {
			buyerPhone = await this.extractPhone(searchContext)
		}

		return {
			buyerName: buyerName || '',
			buyerEmail,
			buyerPhone,
		}
	}

	/**
	 * Extract value from labeled sections (e.g., "Name: value", "Email: value")
	 * Cherokee Bids uses this pattern
	 */
	private async extractLabeledValue(
		context: Page | Locator,
		labels: string[]
	): Promise<string | null> {
		try {
			// Look for text containing the label followed by a value
			for (const label of labels) {
				// Try to find element containing the label
				const labelElement = context.locator(`:has-text("${label}")`).first()
				const count = await labelElement.count()
				if (count > 0) {
					// Get the text content
					const text = await this.extractText(labelElement)
					if (text) {
						// Extract value after label (e.g., "Name: michelle parsons" -> "michelle parsons")
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
	 * Extract email from page or container
	 */
	private async extractEmail(context: Page | Locator): Promise<string | null> {
		// Try direct email selectors
		const email = await this.extractFromMultipleSelectors(context, [
			'.buyer-email',
			'.contact-email',
			'[data-buyer-email]',
			'[data-contact-email]',
			'a[href^="mailto:"]',
			'label:has-text("Email") + *',
		])

		if (email) {
			// Clean email (remove mailto: prefix if present)
			return email.replace(/^mailto:/i, '').split('?')[0].trim()
		}

		// Try extracting from table
		return await this.extractFromTable(context, ['Email', 'E-mail', 'Contact Email'])
	}

	/**
	 * Extract phone from page or container
	 */
	private async extractPhone(context: Page | Locator): Promise<string | null> {
		// Try direct phone selectors
		const phone = await this.extractFromMultipleSelectors(context, [
			'.buyer-phone',
			'.contact-phone',
			'[data-buyer-phone]',
			'[data-contact-phone]',
			'a[href^="tel:"]',
			'label:has-text("Phone") + *',
			'label:has-text("Telephone") + *',
		])

		if (phone) {
			// Clean phone (remove tel: prefix if present)
			return phone.replace(/^tel:/i, '').replace(/\s+/g, ' ').trim()
		}

		// Try extracting from table
		return await this.extractFromTable(context, ['Phone', 'Telephone', 'Contact Phone', 'Phone Number'])
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
	 * Extract value from HTML table by label
	 * 
	 * Looks for a table row with matching label and returns the value.
	 * Uses extractTable() internally for better table parsing when context is a Page.
	 */
	private async extractFromTable(
		context: Page | Locator,
		labels: string[]
	): Promise<string | null> {
		try {
			// Try using extractTable if context is a Page (check by checking for 'url' method)
			const isPage = 'url' in context && typeof (context as any).url === 'function'
			
			if (isPage) {
				// Find tables in the context
				const tableSelectors = ['table', '.data-table', '.contact-table', '[data-table]']
				const pageContext = context as Page
				
				for (const tableSelector of tableSelectors) {
					try {
						const table = pageContext.locator(tableSelector).first()
						const count = await table.count()
						if (count === 0) continue

						// Use extractTable if context is Page
						const tableData = await this.extractTable(pageContext, tableSelector)
						
						// Look for rows matching the labels
						for (const row of tableData) {
							for (const [key, value] of Object.entries(row)) {
								const keyLower = key.toLowerCase()
								for (const label of labels) {
									if (keyLower.includes(label.toLowerCase()) && value) {
										return value.trim()
									}
								}
							}
						}
					} catch {
						continue
					}
				}
			}

			// Fallback: Find all table rows
			const rows = context.locator('tr, .table-row, [data-row]')
			const rowCount = await rows.count()

			for (let i = 0; i < rowCount; i++) {
				const row = rows.nth(i)
				const rowText = await this.extractText(row)

				// Check if row contains any of the labels
				for (const label of labels) {
					if (rowText && rowText.toLowerCase().includes(label.toLowerCase())) {
						// Try to get value from next cell or sibling
						const valueCell = row.locator('td:last-child, .table-cell:last-child, [data-value]')
						const value = await this.extractText(valueCell)
						if (value) return value.trim()

						// Try getting text after label
						const match = rowText.match(new RegExp(`${label}[:\\s]+(.+)`, 'i'))
						if (match && match[1]) {
							return match[1].trim()
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
		context: Page | Locator,
		selectors: string[]
	): Promise<string | null> {
		for (const selector of selectors) {
			try {
				const locator = context.locator(selector).first()
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
								return href.replace('tel:', '').replace(/\s+/g, ' ')
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
}

