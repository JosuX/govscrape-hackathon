import { Page, Locator } from 'playwright'

/**
 * BaseExtractor
 * 
 * Base class for extracting data from web pages using Playwright.
 * 
 * Extractors follow the Single Responsibility Principle - each extractor
 * should handle one specific type of data extraction.
 * 
 * Example extractors:
 * - OpportunityExtractor: Extracts basic opportunity info (title, dates, description)
 * - DocumentExtractor: Extracts document metadata
 * - ContactExtractor: Extracts contact information
 * - TabDataExtractor: Extracts data from tabbed sections
 * 
 * Use Playwright locators for type-safe DOM querying.
 */
export abstract class BaseExtractor<T> {
	/**
	 * Main extraction method
	 * 
	 * This method should contain the logic to extract data from the page.
	 * 
	 * @param page - Playwright page instance
	 * @returns Extracted data of type T
	 * 
	 *  Implement extraction logic in your concrete extractor
	 * - Wait for page to load
	 * - Use locators to find elements
	 * - Extract text, attributes, or other data
	 * - Return structured data
	 */
	public abstract extract(page: Page): Promise<T>

	/**
	 * Extract text from a locator
	 * 
	 * Helper method to safely extract text content.
	 * 
	 * @param locator - Playwright locator
	 * @returns Extracted text or null if not found
	 * 
	 *  Implement text extraction
	 * - Check if locator exists (count > 0)
	 * - Get textContent
	 * - Trim whitespace
	 * - Return null if empty or not found
	 */
	protected async extractText(locator: Locator): Promise<string | null> {
		//  Implement text extraction
		throw new Error('Method not implemented')
	}

	/**
	 * Extract attribute from a locator
	 * 
	 * Helper method to safely extract element attributes.
	 * 
	 * @param locator - Playwright locator
	 * @param attribute - Attribute name (e.g., 'href', 'data-id')
	 * @returns Attribute value or null if not found
	 * 
	 *  Implement attribute extraction
	 * - Check if locator exists
	 * - Get attribute value
	 * - Return null if not found
	 */
	protected async extractAttribute(
		locator: Locator,
		attribute: string
	): Promise<string | null> {
		//  Implement attribute extraction
		throw new Error('Method not implemented')
	}

	/**
	 * Extract data from a table
	 * 
	 * Helper method to extract structured data from HTML tables.
	 * 
	 * @param page - Playwright page instance
	 * @param tableSelector - CSS selector for the table
	 * @returns Array of row data objects
	 * 
	 *  Implement table extraction
	 * - Locate the table
	 * - Extract headers from <th> elements
	 * - Iterate through <tr> rows
	 * - Extract cell data from <td> elements
	 * - Return array of objects (one per row)
	 */
	protected async extractTable(
		page: Page,
		tableSelector: string
	): Promise<Record<string, string>[]> {
		//  Implement table extraction
		throw new Error('Method not implemented')
	}

	/**
	 * Extract data from multiple possible selectors
	 * 
	 * Try multiple selectors in order until one returns data.
	 * Useful when the page structure varies.
	 * 
	 * @param page - Playwright page instance
	 * @param selectors - Array of CSS selectors to try
	 * @returns Extracted text or null
	 * 
	 *  Implement fallback selector logic
	 * - Loop through selectors
	 * - Try each one using extractText()
	 * - Return first non-null result
	 * - Return null if all fail
	 */
	protected async extractFromMultipleSelectors(
		page: Page,
		selectors: string[]
	): Promise<string | null> {
		//  Implement fallback selector logic
		throw new Error('Method not implemented')
	}

	/**
	 * Wait for and click a tab, then wait for content
	 * 
	 * Helper for extracting data from tabbed interfaces.
	 * 
	 * @param page - Playwright page instance
	 * @param tabSelector - CSS selector for the tab to click
	 * @returns True if tab was clicked successfully
	 * 
	 *  Implement tab clicking logic
	 * - Check if tab exists
	 * - Click the tab
	 * - Wait for tab content to load
	 * - Return success status
	 */
	protected async clickTab(page: Page, tabSelector: string): Promise<boolean> {
		//  Implement tab clicking logic
		throw new Error('Method not implemented')
	}
}

