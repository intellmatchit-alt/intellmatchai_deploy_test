/**
 * Image Preprocessing Module
 *
 * Provides image preprocessing capabilities for business card scanning.
 * Includes card detection, quality assessment, and image enhancement.
 *
 * @module infrastructure/external/preprocessing
 */

// Factory
export {
  getImagePreprocessor,
  createImagePreprocessor,
  resetImagePreprocessor,
  isPreprocessingAvailable,
} from './ImagePreprocessorFactory';

// Main service
export { SharpPreprocessorService } from './SharpPreprocessorService';
export type { EnhancementLevel, PreprocessorConfig } from './SharpPreprocessorService';

// Components
export { CardClassifier } from './CardClassifier';
export { QualityAssessor } from './QualityAssessor';
export { PerspectiveCorrector } from './PerspectiveCorrector';
export type { CorrectionResult } from './PerspectiveCorrector';
