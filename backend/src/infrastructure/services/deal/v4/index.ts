/**
 * Deal Matching Engine — Main Entry
 * v4.0.0 — strict final production
 */

export * from './common';
export * from './types';

export { DealMatchingService, dealMatchingService } from './matching.service';
export { DealExtractionService, dealExtractionService } from './extraction.service';

export {
  runDealHardFilters, calculateDealMatchScore,
  calculateCategoryScore, calculateIndustryScore, calculateBudgetScore,
  calculateRequirementsScore, calculateSizeFitScore, calculateTimelineScore,
  calculateLocationScore, calculateDeliveryScore, calculateSemanticScore,
  calculateProviderTypeScore, calculateBuyerPersonaScore, inferBuyerPersona,
  sortDealMatches, assignDealRanks,
} from './scoring.utils';

export { DealMatchingController, dealMatchingController } from './controller';
export { createDealMatchingRouter, dealMatchingRouter } from './routes';

export type {
  BuyRequestRepository, SellOfferingRepository,
} from './repository';
export {
  defaultBuyRequestRepository, defaultSellOfferingRepository,
} from './repository';

export const DEAL_ENGINE_VERSION = '4.0.0';
