import { Page, Locator } from 'playwright'
import { BaseExtractor } from '../base/BaseExtractor'

/**
 * TabDataExtractor
 * 
 * Extracts data from tabbed interfaces where content is hidden until tabs are clicked.
 * 
 * Use this extractor when:
 * - The detail page uses tabs (e.g., "Overview", "Documents", "Requirements", "Contacts")
 * - Data is hidden until a tab is clicked
 * - You need to click multiple tabs to collect all data
 * 
 * This extractor can extract:
 * - Text content from tabs
 * - Documents from document tabs
 * - Contact info from contact tabs
 * - Any structured data from tabbed sections
 * 
 * Returns a map of tab names to their content.
 */
export interface TabData {
	[tabName: string]: string | null
}

export class TabDataExtractor extends BaseExtractor<TabData> {
	/**
	 * Extract data from all available tabs
	 * 
	 * @param page - Playwright page instance
	 * @param tabSelectors - Optional array of specific tab selectors to extract.
	 *                      If not provided, will attempt to find all tabs automatically.
	 * @returns Map of tab names to their content
	 * 
	 * TODO: Customize selectors based on your target website structure
	 * - Update CSS selectors to match your website's tab structure
	 * - Adjust tab clicking logic if tabs use different interaction patterns
	 * - Customize content extraction for each tab type
	 */
	public async extract(
		page: Page,
		tabSelectors?: string[]
	): Promise<TabData> {
		// Wait for page to load
		await page.waitForLoadState('networkidle')

		const tabData: TabData = {}

		// Find all tabs
		const tabs = await this.findTabs(page, tabSelectors)

		// Extract data from each tab
		for (const tab of tabs) {
			const tabName = await this.getTabName(tab)
			if (!tabName) continue

			// Click the tab
			const clicked = await this.clickTabLocator(page, tab)
			if (!clicked) continue

			// Wait for tab content to load
			await page.waitForTimeout(500) // Give time for content to load
			await page.waitForLoadState('networkidle')

			// Extract content from the active tab
			const content = await this.extractTabContent(page, tabName)
			tabData[tabName] = content
		}

		return tabData
	}

	/**
	 * Find all tabs on the page
	 */
	private async findTabs(
		page: Page,
		customSelectors?: string[]
	): Promise<Locator[]> {
		const tabs: Locator[] = []

		// Use custom selectors if provided
		if (customSelectors && customSelectors.length > 0) {
			for (const selector of customSelectors) {
				const locator = page.locator(selector)
				const count = await locator.count()
				if (count > 0) {
					const allTabs = await locator.all()
					tabs.push(...allTabs)
				}
			}
			return tabs
		}

		// Try common tab selectors
		const tabSelectors = [
			'.tab',
			'.nav-tab',
			'[role="tab"]',
			'.tab-button',
			'.tab-link',
			'button[data-tab]',
			'a[data-tab]',
			'.ui-tabs-nav li',
			'.tabs li a',
			'.tab-header',
		]

		for (const selector of tabSelectors) {
			try {
				const locator = page.locator(selector)
				const count = await locator.count()
				if (count > 0) {
					const allTabs = await locator.all()
					if (allTabs.length > 0) {
						return allTabs
					}
				}
			} catch {
				continue
			}
		}

		return tabs
	}

	/**
	 * Get the name/label of a tab
	 */
	private async getTabName(tab: Locator): Promise<string | null> {
		// Try to get text content
		const text = await this.extractText(tab)
		if (text) return text.trim().toLowerCase().replace(/\s+/g, '-')

		// Try data attribute
		const dataTab = await this.extractAttribute(tab, 'data-tab')
		if (dataTab) return dataTab.trim().toLowerCase()

		// Try aria-label
		const ariaLabel = await this.extractAttribute(tab, 'aria-label')
		if (ariaLabel) return ariaLabel.trim().toLowerCase().replace(/\s+/g, '-')

		// Try id
		const id = await this.extractAttribute(tab, 'id')
		if (id) return id.trim().toLowerCase()

		return null
	}

	/**
	 * Click a tab and wait for content to load
	 * 
	 * Overrides base class method to work with Locator instead of selector string
	 */
	private async clickTabLocator(page: Page, tab: Locator): Promise<boolean> {
		try {
			// Check if tab is already active
			const isActive = await this.isTabActive(tab)
			if (isActive) return true

			// Click the tab
			await tab.click({ timeout: 5000 })

			// Wait for tab content to appear
			await page.waitForTimeout(300)
			await page.waitForLoadState('networkidle')

			return true
		} catch (error) {
			console.warn('Failed to click tab:', error)
			return false
		}
	}

	/**
	 * Click a tab by selector (implements base class method)
	 */
	protected async clickTab(page: Page, tabSelector: string): Promise<boolean> {
		try {
			const tab = page.locator(tabSelector).first()
			const count = await tab.count()
			if (count === 0) return false

			return await this.clickTabLocator(page, tab)
		} catch {
			return false
		}
	}

	/**
	 * Check if a tab is currently active
	 */
	private async isTabActive(tab: Locator): Promise<boolean> {
		try {
			// Check for active class
			const hasActiveClass = await tab.evaluate((el) => {
				return el.classList.contains('active') ||
					el.classList.contains('selected') ||
					el.classList.contains('current') ||
					el.getAttribute('aria-selected') === 'true'
			})

			return hasActiveClass
		} catch {
			return false
		}
	}

	/**
	 * Extract content from the currently active tab
	 */
	private async extractTabContent(page: Page, tabName: string): Promise<string | null> {
		// Try to find tab content container
		const contentSelectors = [
			`.tab-content[data-tab="${tabName}"]`,
			`.tab-panel[data-tab="${tabName}"]`,
			`#${tabName}-content`,
			`#${tabName}-panel`,
			`.tab-content.active`,
			`.tab-panel.active`,
			'[role="tabpanel"]',
			'.tab-content',
			'.tab-panel',
		]

		for (const selector of contentSelectors) {
			try {
				const content = page.locator(selector).first()
				const count = await content.count()
				if (count > 0) {
					const text = await this.extractText(content)
					if (text) return text.trim()
				}
			} catch {
				continue
			}
		}

		// Fallback: extract from main content area
		const mainContent = page.locator('main, .content, .main-content, [role="main"]')
		const count = await mainContent.count()
		if (count > 0) {
			const text = await this.extractText(mainContent.first())
			if (text) return text.trim()
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
	 * 
	 * Note: This method is required by BaseExtractor but not used in TabDataExtractor.
	 * It's implemented for interface compliance.
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
				}
			} catch {
				continue
			}
		}
		return null
	}
}

