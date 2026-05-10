/**
 * Deal Matching Engine — Main Entry
 * v4.1.0 — production bands, hybrid retrieval, effectiveRankScore,
 *          AI match validation (bounded ±10), helper sub-engine
 */

export * from './common';
export * from './types';
export * from './helper-types';

export { DealMatchingService, dealMatchingService } from './matching.service';
export { HelperMatchingService, helperMatchingService } from './helper-matching.service';
export type { HelperMatchInputs, HelperMatchResponse } from './helper-matching.service';
export { DealExtractionService, dealExtractionService } from './extraction.service';
export { DealAIValidator, dealAIValidator } from './ai-validator.service';
export type { DealMatchMode, AIValidationInput, AIValidationResult } from './ai-validator.service';

export {
  runDealHardFilters, calculateDealMatchScore,
  calculateCategoryScore, calculateIndustryScore, calculateBudgetScore,
  calculateRequirementsScore, calculateSizeFitScore, calculateTimelineScore,
  calculateLocationScore, calculateDeliveryScore, calculateSemanticScore,
  calculateProviderTypeScore, calculateBuyerPersonaScore, inferBuyerPersona,
} from './scoring.utils';

export {
  calculateNetworkRelevanceScore, NEUTRAL_NETWORK_CONTEXT,
} from './network.utils';
export type { NetworkContext } from './network.utils';

export {
  calculateRetrievalScore, RETRIEVAL_WEIGHTS,
} from './retrieval.utils';

export {
  calculateEffectiveRankScore, sortByEffectiveRank, dedupeByKeys,
  normalizeFallbackKey,
} from './ranking.utils';
export type { RankInputs, DedupeKeys } from './ranking.utils';

export {
  relationshipTrustScore, introPathScore, roleInfluenceScore,
  commercialPathRelevanceScore, helperNetworkStrengthScore, requesterNeedFitScore,
  classifyHelperType, helperHardFilterStatus, calculateHelperScore,
} from './helper-scoring.utils';

export { DealMatchingController, dealMatchingController } from './controller';
export { createDealMatchingRouter, dealMatchingRouter } from './routes';

export type {
  BuyRequestRepository, SellOfferingRepository,
} from './repository';
export {
  defaultBuyRequestRepository, defaultSellOfferingRepository,
} from './repository';

export const DEAL_ENGINE_VERSION = '4.1.0';
