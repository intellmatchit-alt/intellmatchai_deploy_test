/**
 * IntellMatch Pitch Matching Engine — Main Entry
 * v8.0.0 — production-hardened
 */

export * from './matching-bands.constants';
export type { DeterministicScoreBreakdown, MatchExplanation, ScoringComponent } from './pitch-matching.types';
export { PitchStage, BusinessModel, MatchIntent, HardFilterReason, SupportNeededTag } from './pitch-matching.types';
export type { HardFilterResult } from './pitch-scoring.utils';
export { runPitchHardFilters, calculatePitchDeterministicScore, extractKeyReasons, inferIntentsFromNeedText } from './pitch-scoring.utils';
export { PitchMatchingService, createPitchMatchingService } from './pitch-matching.service';
export { PitchLLMService, getPitchLLMService, createPitchLLMService } from './pitch-llm.service';
export { PitchMatchingController, createPitchMatchingController, createPitchMatchingRoutes } from './pitch-matching.controller';
export { PitchMatchingWorker, createPitchMatchingWorker } from './pitch-matching.worker';

export const PITCH_ENGINE_VERSION = '8.0.0';

