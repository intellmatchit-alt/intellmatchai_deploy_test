/**
 * Import Services
 *
 * Exports all import-related services.
 *
 * @module infrastructure/services/import
 */

export * from './NormalizationService';
export * from './DeduplicationService';
export * from './TaxonomyMappingService';
export * from './TagExtractionService';
export * from './ProfileSummaryService';

// Default exports
import { normalizationService } from './NormalizationService';
import { deduplicationService } from './DeduplicationService';
import { taxonomyMappingService } from './TaxonomyMappingService';
import { tagExtractionService } from './TagExtractionService';
import { profileSummaryService } from './ProfileSummaryService';

export default {
  normalizationService,
  deduplicationService,
  taxonomyMappingService,
  tagExtractionService,
  profileSummaryService,
};
