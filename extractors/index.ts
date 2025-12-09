/**
 * Extractors Index
 * 
 * Central export point for all extractor classes.
 * 
 * This allows importing all extractors from a single location:
 * import { OpportunityExtractor, DocumentExtractor, ContactExtractor, TabDataExtractor } from '../extractors'
 */

export { OpportunityExtractor } from './OpportunityExtractor'
export { DocumentExtractor } from './DocumentExtractor'
export { ContactExtractor } from './ContactExtractor'
export type { ContactData } from './ContactExtractor'
export { TabDataExtractor } from './TabDataExtractor'
export type { TabData } from './TabDataExtractor'

