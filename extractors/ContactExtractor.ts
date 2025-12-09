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
		const contactSectionSelectors = [
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
		const buyerName = await this.extractFromMultipleSelectors(searchContext, [
			'.buyer-name',
			'.contact-name',
			'[data-buyer-name]',
			'[data-contact-name]',
			'.procurement-officer-name',
			'.officer-name',
			'label:has-text("Name") + *',
			'label:has-text("Contact") + *',
		]) || await this.extractFromTable(searchContext, ['Name', 'Contact Name', 'Buyer', 'Officer'])

		// Extract buyer email
		const buyerEmail = await this.extractEmail(searchContext)

		// Extract buyer phone
		const buyerPhone = await this.extractPhone(searchContext)

		return {
			buyerName: buyerName || '',
			buyerEmail,
			buyerPhone,
		}
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
	 * Extract value from HTML table by label
	 * 
	 * Looks for a table row with matching label and returns the value
	 */
	private async extractFromTable(
		context: Page | Locator,
		labels: string[]
	): Promise<string | null> {
		try {
			// Find all table rows
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

