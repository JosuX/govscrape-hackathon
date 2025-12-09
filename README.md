# Hackathon: Build a Government Procurement Scraper

Welcome to the scraper hackathon! Your challenge is to build a production-quality web scraper and data intake system for a government procurement website.

## 🎯 Objectives

Build a complete scraping solution that:
1. **Scrapes** procurement opportunities from a government website
2. **Downloads** associated documents to local storage
3. **Transforms** raw data into a normalized format
4. **Follows** industry best practices and design patterns

## 📋 Requirements

### Functional Requirements

#### Scraper (`scraper.ts`)
- Scrape procurement opportunities from your assigned website
- Support CLI flags for date ranges:
  - Default: Previous day
  - `--today`: Scrape today's data
  - `--date-range=yyyy-MM-dd,yyyy-MM-dd`: Custom date range
- Save data incrementally in batches (JSON files)
- Download documents to local storage
- Handle pagination efficiently
- Implement polite scraping (delays between requests)

#### Intake (`intake.ts`)
- Read scraped data from JSON files
- Transform data using dedicated transformer classes
- Normalize dates, IDs, and other fields
- Deduplicate agencies and people
- Output final intake JSON file
- Validate data with Zod schemas

### Technical Requirements

#### Architecture & Patterns
You must demonstrate understanding of:
- **SOLID Principles**
  - Single Responsibility: Each class has one job
  - Open/Closed: Extensible without modification
  - Dependency Injection: Pass dependencies to constructors
  
- **Design Patterns**
  - Strategy Pattern: For document downloaders
  - Template Method: In BaseScraper
  - Factory Pattern: For ID generation
  
- **OOP Best Practices**
  - Inheritance: Extend base classes
  - Encapsulation: Private/protected members
  - Abstraction: Abstract methods for customization

#### Code Quality
- TypeScript with proper typing (avoid `any` except where necessary)
- Zod schemas for data validation
- Error handling with try-catch
- Logging with timestamps and context
- Clean, readable code with comments

## 📁 Project Structure

```
hackathon/
├── base/
│   ├── BaseScraper.ts           # Base scraper class (extend this)
│   ├── BaseExtractor.ts         # Base extractor class
│   └── BaseTransformer.ts       # Transformer base classes
├── schemas/
│   ├── source.schema.ts         # Raw data schemas (TODO: define)
│   └── intake.schema.ts         # Normalized data schemas (TODO: define)
├── utils/
│   ├── cli.ts                   # CLI argument parsing
│   ├── storage.ts               # File system operations
│   └── helpers.ts               # Utility functions
├── scripts/
│   ├── scraper.ts               # Scraper entry point (TODO: implement)
│   └── intake.ts                # Intake entry point (TODO: implement)
├── README.md                    # This file
└── ARCHITECTURE.md              # Architecture guide
```

## 🚀 Getting Started

### Step 1: Understand the Target Website
- Analyze the website structure
- Identify listing pages and detail pages
- Check if they use AJAX/API calls
- Note pagination mechanism
- Identify document download patterns

### Step 2: Define Your Schemas

**`schemas/source.schema.ts`**
```typescript
// Define SOURCE_OPPORTUNITY with all fields from the website
// Define SOURCE_DOCUMENT for document metadata
// Define SOURCE_TO_INTAKE for batch output
```

**`schemas/intake.schema.ts`**
```typescript
// Define INTAKE_CONTRACT for normalized contracts
// Define INTAKE_AGENCY for agencies
// Define INTAKE_DOCUMENT for documents
// Define INTAKE_PEOPLE for contacts
```

### Step 3: Implement Extractors

Create extractor classes that extend `BaseExtractor`:

```typescript
// examples/OpportunityExtractor.ts
export class OpportunityExtractor extends BaseExtractor<OpportunityData> {
  public async extract(page: Page): Promise<OpportunityData> {
    // Extract title, dates, description, etc.
  }
}
```

Create extractors for:
- Basic opportunity info (title, dates, agency)
- Detailed opportunity data
- Document metadata
- Contact information
- Any tabbed or modal content

### Step 4: Implement the Scraper

Complete `scripts/scraper.ts`:

1. **Extend BaseScraper**
   ```typescript
   class YourStateScraper extends BaseScraper {
     // Implement abstract methods
   }
   ```

2. **Implement fetchListings()**
   - Navigate to search page
   - Apply date filters
   - Extract listing data
   - Return array of listings

3. **Implement processOpportunity()**
   - Navigate to detail page
   - Use extractors to get data
   - Download documents
   - Return structured data

4. **Implement saveBatch()**
   - Create SOURCE_TO_INTAKE object
   - Save to JSON file
   - Increment batch counter

### Step 5: Implement Transformers

Complete the transformer classes in `scripts/intake.ts`:

```typescript
class YourStateContractTransformer extends ContractTransformer {
  public transform(opportunity: any, source: string): any {
    // Map SOURCE_OPPORTUNITY → INTAKE_CONTRACT
    // Normalize dates, generate IDs, clean data
  }
}
```

Implement transformers for:
- Contracts (required)
- Agencies (required)
- Documents (required)
- People (required)

### Step 6: Implement Utilities

Complete utility functions in:
- `utils/cli.ts`: Parse command line arguments
- `utils/storage.ts`: File system operations
- `utils/helpers.ts`: Common utilities

### Step 7: Test Your Solution

```bash
# Test with small batch
npm run scraper --date-range=2024-01-01,2024-01-02

# Check output
ls -la ./output/source/session_*/

# Run intake
npm run intake ./output/source/session_yourstate_2024-01-01_*/

# Check intake output
ls -la ./output/intake/
cat ./output/intake/intake_*.json
```

## 📊 Evaluation Criteria

Your submission will be evaluated on:

### 1. Functionality (30%)
- ✅ Scraper successfully extracts all required data
- ✅ Documents are downloaded correctly
- ✅ Intake transforms data properly
- ✅ CLI flags work as expected
- ✅ Batch saving works incrementally

### 2. Architecture & Design (30%)
- ✅ SOLID principles applied
- ✅ Design patterns used appropriately
- ✅ OOP concepts demonstrated
- ✅ Clean separation of concerns
- ✅ Proper use of inheritance and abstraction

### 3. Code Quality (25%)
- ✅ TypeScript best practices
- ✅ Proper error handling
- ✅ Zod schema validation
- ✅ Readable and maintainable code
- ✅ Appropriate comments and documentation

### 4. Data Quality (15%)
- ✅ Complete data extraction
- ✅ Proper normalization
- ✅ Correct deduplication
- ✅ Valid schema compliance
- ✅ No data loss in transformation

## 💡 Tips & Best Practices

### Scraping Tips
1. **Start small**: Test with one opportunity first
2. **Be polite**: Add delays between requests (1-2 seconds)
3. **Handle errors**: Wrap operations in try-catch
4. **Log everything**: Use the log utility for debugging
5. **Isolate pages**: Open new pages for each opportunity
6. **Clean up**: Close pages after use to prevent memory leaks

### Architecture Tips
1. **Single Responsibility**: One extractor per page section
2. **Dependency Injection**: Pass dependencies via constructor
3. **Strategy Pattern**: Use for document downloaders if multiple sources
4. **Fail gracefully**: Return null instead of crashing
5. **Validate early**: Use Zod schemas to catch issues

### Performance Tips
1. **Batch processing**: Save data after each page, not at the end
2. **Memory management**: Clear arrays after saving batches
3. **Concurrency**: Download documents in parallel (limit 3-5)
4. **Pagination**: Use offset/limit for efficient API calls

### Common Pitfalls to Avoid
- ❌ Don't use `any` everywhere (use proper types)
- ❌ Don't forget to close browser pages
- ❌ Don't save all data in memory (use batches)
- ❌ Don't skip error handling
- ❌ Don't forget to validate data with schemas
- ❌ Don't use synchronous file operations
- ❌ Don't hardcode values (use config)

## 📚 Reference Materials

- **Playwright Docs**: https://playwright.dev/docs/intro
- **Zod Docs**: https://zod.dev/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **SOLID Principles**: [See ARCHITECTURE.md](./ARCHITECTURE.md)

## 🎬 Example Workflow

```bash
# 1. Analyze target website
# 2. Define schemas
# 3. Implement extractors
# 4. Implement scraper
# 5. Test scraper
npm run scraper --date-range=2024-01-01,2024-01-01

# 6. Verify output
cat ./output/source/session_*/batch_1.json

# 7. Implement transformers
# 8. Implement intake
# 9. Test intake
npm run intake ./output/source/session_yourstate_2024-01-01_*/

# 10. Verify intake output
cat ./output/intake/intake_*.json

# 11. Run full test
npm run scraper --date-range=2024-01-01,2024-01-07
npm run intake ./output/source/session_*/
```

## ✅ Submission Checklist

Before submitting, ensure:

- [ ] All TODOs in base files are completed
- [ ] Schemas are fully defined
- [ ] Scraper successfully extracts all data
- [ ] Documents are downloaded
- [ ] Intake transforms data correctly
- [ ] All CLI flags work
- [ ] Error handling is implemented
- [ ] Code is well-commented
- [ ] No linter errors
- [ ] Tested with multiple date ranges
- [ ] Output JSON files are valid
- [ ] SOLID principles are demonstrated
- [ ] Design patterns are used appropriately

## 🏆 Bonus Points

Impress us with:
- 📸 **Screenshots**: Add screenshots of the target website with annotations
- 📝 **Documentation**: Add a SOLUTION.md explaining your approach
- 🧪 **Testing**: Add unit tests for transformers
- 🔄 **Retry Logic**: Implement exponential backoff for failed requests
- 🎨 **Pretty Output**: Format console output with colors and progress bars
- 🔍 **Data Validation**: Add extra validation beyond Zod schemas
- 📊 **Statistics**: Log scraping statistics (success rate, avg time, etc.)
- 🛡️ **Robustness**: Handle edge cases (missing fields, malformed HTML, etc.)

## 🤝 Support

If you have questions:
1. Check ARCHITECTURE.md for design pattern examples
2. Review the base classes for guidance
3. Look at the TODO comments for hints
4. Ask for clarification if requirements are unclear

Good luck! We're excited to see your solutions! 🚀

