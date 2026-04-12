/**
 * IntellMatch Job Matching Engine — Main Entry
 * @module job-matching
 */

export * from './job-matching.types';
export * from './job-scoring.utils';
export * from './matching-bands.constants';
export { JobMatchingService, createJobMatchingService } from './job-matching.service';
export { JobLLMService, getJobLLMService, createJobLLMService } from './job-llm.service';
export { JobMatchingController, createJobMatchingController, createJobMatchingRoutes } from './job-matching.controller';
export { JobMatchingWorker, createJobMatchingWorker } from './job-matching.worker';

export const JOB_ENGINE_VERSION = '2.2.0';
