/**
 * Extractors Index
 * 
 * Central export point for all extractor classes.
 * 
 * This allows importing all extractors from a single location:
 * import { OpportunityExtractor, DocumentExtractor, ContactExtractor } from '../extractors'
 */

export { OpportunityExtractor } from './OpportunityExtractor'
export { DocumentExtractor } from './DocumentExtractor'
export { ContactExtractor } from './ContactExtractor'
export type { ContactData } from './ContactExtractor'

