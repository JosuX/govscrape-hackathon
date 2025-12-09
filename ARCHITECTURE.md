# Architecture Guide

This document explains the architectural patterns and principles you should use in your hackathon solution.

## 🏛️ Overall Architecture

The scraping system follows a **two-stage pipeline**:

```
┌─────────────┐
│   SOURCE    │  Raw website data
│   (Scrape)  │  
└──────┬──────┘
       │
       │  Batch JSON files
       │  (SOURCE schemas)
       │
       ▼
┌─────────────┐
│   INTAKE    │  Normalized data
│ (Transform) │  
└──────┬──────┘
       │
       │  Intake JSON file
       │  (INTAKE schemas)
       │
       ▼
    System DB
```

### Stage 1: Scraping (source)
- Extract raw data from website
- Save exactly as found (no transformation)
- Download documents to local storage
- Output: Batch JSON files

### Stage 2: Intake (transform)
- Read batch files
- Normalize and clean data
- Deduplicate entities
- Validate with schemas
- Output: Single intake JSON file

---

## 🏗️ Architecture Layers

### Layer 1: Base Classes (Framework)
```
┌─────────────────────────────┐
│     BaseScraper             │  Template Method
│     BaseExtractor           │  Strategy Interface
│     BaseTransformer         │  Abstract Classes
└─────────────────────────────┘
```

**Purpose:** Provide reusable framework and enforce patterns

### Layer 2: Concrete Implementations (Your Code)
```
┌─────────────────────────────┐
│  YourStateScraper           │  extends BaseScraper
│  OpportunityExtractor       │  extends BaseExtractor
│  DocumentExtractor          │  extends BaseExtractor
│  ContractTransformer        │  extends BaseTransformer
│  AgencyTransformer          │  extends BaseTransformer
└─────────────────────────────┘
```

**Purpose:** Implement specific scraping logic for your source

### Layer 3: Utilities (Helpers)
```
┌─────────────────────────────┐
│  CLI, Storage, Helpers      │  Pure functions
│  ID Generation, Parsing     │  Stateless utilities
│  Date/Phone/Email normalize │  Reusable helpers
└─────────────────────────────┘
```

**Purpose:** Provide shared utilities without state

### Layer 4: Schemas (Data Contracts)
```
┌─────────────────────────────┐
│  Source Schemas (Zod)       │  Raw data structure
│  Intake Schemas (Zod)       │  Normalized structure
└─────────────────────────────┘
```

**Purpose:** Define and validate data structures

---

## 📊 Data Flow Example

```typescript
// 1. Scraper fetches listing
const listings = await scraper.fetchListings(page, 1, 50)
// Output: [{ id: "123", title: "RFP...", agency: "DOT" }, ...]

// 2. Process each listing
for (const listing of listings) {
  // 3. Extract detail data
  const opportunity = await oppExtractor.extract(detailPage)
  // Output: { title: "...", startDate: "...", description: "..." }
  
  const documents = await docExtractor.extract(detailPage)
  // Output: [{ fileName: "doc.pdf", downloadUrl: "..." }, ...]
  
  // 4. Download documents
  for (const doc of documents) {
    const buffer = await downloader.download(doc.downloadUrl)
    const localPath = await saveLocally(buffer, doc.fileName)
    doc.localPath = localPath
  }
  
  // 5. Combine into source format
  items.push({
    opportunity: opportunity,
    documents: documents
  })
}

// 6. Save batch (SOURCE schema)
await saveBatchToFile({
  metadata: { scrapedAt: new Date(), source: "yourstate" },
  items: items
}, sessionDir, batchNum)

// 7. Later, in intake: Transform (INTAKE schema)
const contract = contractTransformer.transform(item.opportunity, "yourstate")
// Output: { id: "contract-abc", externalId: "123", publishedAt: "2024-01-01T00:00:00Z", ... }

const agency = agencyTransformer.transform(item.opportunity, "yourstate")
// Output: { id: "agency-xyz", name: "Department of Transportation", ... }
```

---

## ✅ Checklist: Architecture Review

Before submitting, verify:

### SOLID Principles
- [ ] Each class has a single, clear responsibility
- [ ] Base classes can be extended without modification
- [ ] Subclasses are truly substitutable for base classes
- [ ] Classes don't depend on methods they don't use
- [ ] Dependencies are injected, not instantiated internally

### Design Patterns
- [ ] Template Method pattern in scraper workflow
- [ ] Strategy pattern for document handling (if multiple sources)
- [ ] Factory pattern for ID generation
- [ ] Proper abstraction with base classes

### Code Organization
- [ ] Extractors separated by concern
- [ ] Transformers separated by entity type
- [ ] Utilities are stateless functions
- [ ] Schemas define clear data contracts
- [ ] No God classes doing everything

### Best Practices
- [ ] Dependency Injection throughout
- [ ] Error handling at appropriate levels
- [ ] Logging with context
- [ ] Type safety (minimal use of `any`)
- [ ] Clean separation between scraping and transformation

---

## 🎓 Learning Resources

### SOLID Principles
- [SOLID Principles Explained](https://www.digitalocean.com/community/conceptual_articles/s-o-l-i-d-the-first-five-principles-of-object-oriented-design)
- [Clean Code by Robert Martin](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)

### Design Patterns
- [Refactoring Guru - Design Patterns](https://refactoring.guru/design-patterns)
- [Design Patterns: Elements of Reusable Object-Oriented Software](https://www.amazon.com/Design-Patterns-Elements-Reusable-Object-Oriented/dp/0201633612)

### TypeScript & OOP
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Effective TypeScript](https://effectivetypescript.com/)

---

Good luck building your scraper with solid architecture! 🏗️

