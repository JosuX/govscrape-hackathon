# Quick Start Guide

Get started building your scraper in 5 simple steps!

## 📦 Step 1: Install Dependencies

```bash
cd hackathon
npm install
```

This installs:
- `playwright` - Browser automation
- `zod` - Schema validation
- `tsx` - TypeScript execution
- `typescript` - TypeScript compiler

## 🔍 Step 2: Analyze Your Target Website

Before coding, spend time understanding the website:

### Questions to Answer:

1. **What's the base URL?**
   - Example: `https://procurement.yourstate.gov`

2. **How do you search for opportunities?**
   - Is there a search page?
   - Does it use forms or URL parameters?
   - Can you filter by date?

3. **How is pagination handled?**
   - Page numbers in URL?
   - Offset/limit parameters?
   - "Next" button only?
   - AJAX/API calls?

4. **What's on the listing page?**
   - Basic info (ID, title, agency, dates)
   - Link to detail page
   - How many items per page?

5. **What's on the detail page?**
   - Full description
   - Dates and deadlines
   - Contact information
   - Document attachments
   - Agency details
   - Any tabbed sections?

6. **How are documents provided?**
   - Direct download links?
   - External portal?
   - Multiple documents per opportunity?

### Tools to Help:

```bash
# Open Playwright in headed mode to inspect
npx playwright codegen https://procurement.yourstate.gov

# This opens a browser and records your actions
# Use it to understand the page structure and get selectors
```

## 📝 Step 3: Define Your Schemas

### 3a. Define SOURCE Schema

Edit `schemas/source.schema.ts`:

```typescript
// Example based on your website structure
export const SOURCE_OPPORTUNITY = z.object({
	id: z.string(),
	eventId: z.string(),
	title: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	startDate: z.string().nullable().optional(), // Store as string exactly as found
	endDate: z.string().nullable().optional(),
	status: z.string().nullable().optional(),
	agencyName: z.string().nullable().optional(),
	agencyCode: z.string().nullable().optional(),
	contactName: z.string().nullable().optional(),
	contactEmail: z.string().nullable().optional(),
	contactPhone: z.string().nullable().optional(),
	sourceUrl: z.string().nullable().optional(),
	// Add any website-specific fields
})

export const SOURCE_DOCUMENT = z.object({
	id: z.string(),
	fileName: z.string(),
	downloadUrl: z.string(), // Local path after download
	fileSize: z.number().nullable().optional(),
	createdAt: z.string(),
	contractId: z.string(),
})

export const SOURCE_TO_INTAKE = z.object({
	metadata: z.object({
		scrapedAt: z.string(),
		source: z.string(),
		sourceUrl: z.string(),
		dateRange: z.object({
			from: z.string(),
			to: z.string(),
		}),
		totalItems: z.number(),
	}),
	items: z.array(
		z.object({
			opportunity: SOURCE_OPPORTUNITY,
			documents: z.array(SOURCE_DOCUMENT),
		})
	),
})
```

### 3b. Define INTAKE Schema

Edit `schemas/intake.schema.ts`:

```typescript
export const INTAKE_CONTRACT = z.object({
	id: z.string(),
	externalId: z.string(),
	source: z.string(),
	title: z.string(),
	description: z.string().nullable().optional(),
	publishedAt: z.string().nullable().optional(), // ISO date
	closingAt: z.string().nullable().optional(), // ISO date
	status: z.string(), // Normalized: "open", "closed", "awarded"
	agencyId: z.string(),
	sourceUrl: z.string().nullable().optional(),
	scrapedAt: z.string(),
})

// Similar for INTAKE_AGENCY, INTAKE_DOCUMENT, INTAKE_PEOPLE
```

## 🔨 Step 4: Build Your Scraper

### 4a. Create Extractors

Create `extractors/OpportunityExtractor.ts`:

```typescript
import { Page } from 'playwright'
import { BaseExtractor } from '../base/BaseExtractor'

export class OpportunityExtractor extends BaseExtractor<any> {
	public async extract(page: Page): Promise<any> {
		// Wait for content
		await page.waitForSelector('.opportunity-detail')

		// Extract data using Playwright locators
		const title = await this.extractText(page.locator('h1.title'))
		const description = await this.extractText(page.locator('.description'))
		
		// ... extract more fields
		
		return {
			title,
			description,
			// ... more fields
		}
	}
}
```

Create similar extractors for:
- `DocumentExtractor.ts`
- `ContactExtractor.ts` (if contact info is complex)
- `TabDataExtractor.ts` (if data is in tabs)

### 4b. Implement Scraper

Edit `scripts/scraper.ts`:

```typescript
class YourStateScraper extends BaseScraper {
	private oppExtractor = new OpportunityExtractor()
	private docExtractor = new DocumentExtractor()

	protected async fetchListings(
		page: Page,
		pageNumber: number,
		pageSize: number
	): Promise<any[]> {
		// Navigate to search page
		const url = `https://procurement.yourstate.gov/search?page=${pageNumber}`
		await page.goto(url)

		// Extract listing items
		const items = await page.locator('.listing-item').all()
		
		const listings = []
		for (const item of items) {
			const id = await item.locator('.id').textContent()
			const title = await item.locator('.title').textContent()
			const link = await item.locator('a').getAttribute('href')
			
			listings.push({ id, title, link })
		}

		return listings
	}

	protected async processOpportunity(
		browser: Browser,
		listing: any
	): Promise<any> {
		const page = await browser.newPage()
		
		try {
			await page.goto(listing.link)
			
			// Use extractors
			const opportunity = await this.oppExtractor.extract(page)
			const documents = await this.docExtractor.extract(page)
			
			// Download documents
			for (const doc of documents) {
				const localPath = await downloadFileLocally(
					doc.downloadUrl,
					listing.id,
					doc.fileName
				)
				doc.downloadUrl = localPath
			}
			
			return {
				opportunity,
				documents
			}
		} finally {
			await page.close()
		}
	}

	protected async saveBatch(items: any[]): Promise<void> {
		const output = {
			metadata: {
				scrapedAt: new Date().toISOString(),
				source: 'yourstate',
				sourceUrl: 'https://procurement.yourstate.gov',
				dateRange: {
					from: this.config.dateRange.from.toISOString(),
					to: this.config.dateRange.to.toISOString(),
				},
				totalItems: items.length,
			},
			items: items,
		}

		await saveBatchToFile(output, this.sessionDirName, this.batchNum)
		this.batchNum++
	}

	// Implement other abstract methods...
}
```

### 4c. Implement Utility Functions

Complete functions in:
- `utils/cli.ts` - Parse command line args
- `utils/storage.ts` - File operations
- `utils/helpers.ts` - Helper functions

## 🧪 Step 5: Test Your Scraper

### Test with small batch first:

```bash
# Scrape just one day
npm run scraper -- --date-range=2024-01-01,2024-01-01
```

Check the output:
```bash
ls ./output/source/
cat ./output/source/session_*/batch_1.json | head -50
```

### Test the intake:

```bash
npm run intake ./output/source/session_yourstate_2024-01-01_*/
```

Check intake output:
```bash
cat ./output/intake/intake_*.json | head -50
```

### Test with larger range:

```bash
npm run scraper -- --date-range=2024-01-01,2024-01-07
```

## 🐛 Debugging Tips

### Use headed mode to see what's happening:

```typescript
protected async launchBrowser(): Promise<Browser> {
	return await chromium.launch({
		headless: false, // ← Set to false
		slowMo: 100, // ← Slow down actions
	})
}
```

### Add console.log statements:

```typescript
console.log('[scraper] Fetching page', pageNumber)
console.log('[scraper] Found', listings.length, 'listings')
console.log('[scraper] Processing opportunity:', listing.id)
```

### Use Playwright's debugging tools:

```typescript
// Pause execution and inspect
await page.pause()

// Take screenshot
await page.screenshot({ path: 'debug.png' })

// Print page content
console.log(await page.content())
```

## ✅ Common Patterns

### Pattern: Extract from table

```typescript
const rows = await page.locator('table tbody tr').all()
for (const row of rows) {
	const cells = await row.locator('td').all()
	const col1 = await cells[0]?.textContent()
	const col2 = await cells[1]?.textContent()
}
```

### Pattern: Click tab and wait

```typescript
await page.click('#documents-tab')
await page.waitForSelector('.documents-content')
```

### Pattern: Handle pagination

```typescript
let currentPage = 1
while (currentPage <= maxPages) {
	const listings = await fetchListings(page, currentPage, 50)
	
	if (listings.length === 0) break
	
	// Process listings...
	
	currentPage++
}
```

### Pattern: Download file

```typescript
const response = await page.goto(downloadUrl)
const buffer = await response.body()
await fs.writeFile(localPath, buffer)
```

## 🚀 Ready to Build!

You now have everything you need to build a complete scraper. Follow these steps in order and you'll have a working solution.

Remember:
- Start simple, test often
- Use extractors for separation of concerns
- Add delays to be polite to servers
- Handle errors gracefully
- Validate data with Zod schemas

Good luck! 🎉

