/**
 * Queue Module
 *
 * Exports queue services and workers.
 *
 * @module infrastructure/queue
 */

export * from './QueueService.js';
export { startEnrichmentWorker } from './workers/enrichmentWorker.js';
export { startMatchingWorker } from './workers/matchingWorker.js';
export { startEmailWorker } from './workers/emailWorker.js';
export {
  startScheduledMatchingWorker,
  scheduleRecurringMatchingJobs,
  triggerUserRecalculation,
  triggerContactsRecalculation,
} from './workers/scheduledMatchingWorker.js';
export {
  startNotificationWorker,
  scheduleRecurringNotificationJobs,
  triggerMatchNotification,
} from './workers/notificationWorker.js';
export {
  startProjectMatchingWorker,
  scheduleProjectRematchJobs,
  triggerProjectMatching,
  getProjectMatchingJobStatus,
} from './workers/projectMatchingWorker.js';
export {
  startProductMatchWorker,
  triggerProductMatchAsync,
  getProductMatchJobStatus,
} from './workers/productMatchWorker.js';
export {
  startCollaborationMatchWorker,
  getCollaborationMatchJobStatus,
} from './workers/collaborationMatchWorker.js';
export {
  startImportWorker,
  getImportJobStatus,
} from './workers/importWorker.js';

import { queueService } from './QueueService.js';
import { startEnrichmentWorker } from './workers/enrichmentWorker.js';
import { startMatchingWorker } from './workers/matchingWorker.js';
import { startEmailWorker } from './workers/emailWorker.js';
import {
  startScheduledMatchingWorker,
  scheduleRecurringMatchingJobs,
} from './workers/scheduledMatchingWorker.js';
import {
  startNotificationWorker,
  scheduleRecurringNotificationJobs,
} from './workers/notificationWorker.js';
import {
  startProjectMatchingWorker,
  scheduleProjectRematchJobs,
} from './workers/projectMatchingWorker.js';
import {
  startProductMatchWorker,
} from './workers/productMatchWorker.js';
import {
  startCollaborationMatchWorker,
} from './workers/collaborationMatchWorker.js';
import {
  startImportWorker,
} from './workers/importWorker.js';
import {
  createPitchProcessingWorker,
} from './workers/pitch.worker.js';
import {
  createProfileBuildWorker,
} from './workers/pitchProfile.worker.js';
import {
  createMatchComputeWorker,
} from './workers/pitchMatch.worker.js';
import {
  createOutreachGenerateWorker,
} from './workers/pitchOutreach.worker.js';
import {
  startRecurringTaskWorker,
  scheduleRecurringTaskCheck,
} from './workers/recurringTaskWorker.js';
import {
  startOverdueTaskWorker,
  scheduleOverdueTaskCheck,
} from './workers/overdueTaskWorker.js';
import {
  startTaskReminderWorker,
  scheduleTaskReminderCheck,
} from './workers/taskReminderWorker.js';
import { logger } from '../../shared/logger/index.js';

/**
 * Initialize queue service and all workers
 */
export async function initializeQueues(): Promise<void> {
  try {
    await queueService.initialize();

    if (queueService.isAvailable()) {
      startEnrichmentWorker();
      startMatchingWorker();
      startEmailWorker();
      startScheduledMatchingWorker();
      startNotificationWorker();
      startProjectMatchingWorker();
      startProductMatchWorker();
      startCollaborationMatchWorker();
      startImportWorker();

      // Task workers
      startTaskReminderWorker();
      startRecurringTaskWorker();
      startOverdueTaskWorker();

      // PNME Pitch Processing Workers
      createPitchProcessingWorker();
      createProfileBuildWorker();
      createMatchComputeWorker();
      createOutreachGenerateWorker();
      logger.info('PNME pitch workers started');

      // Schedule recurring jobs
      await scheduleRecurringMatchingJobs();
      await scheduleRecurringNotificationJobs();
      await scheduleProjectRematchJobs();
      await scheduleTaskReminderCheck();
      await scheduleRecurringTaskCheck();
      await scheduleOverdueTaskCheck();

      logger.info('All queue workers started');
    } else {
      logger.warn('Queue service not available, workers not started');
    }
  } catch (error) {
    logger.error('Failed to initialize queues:', error);
  }
}

/**
 * Shutdown queue service
 */
export async function shutdownQueues(): Promise<void> {
  await queueService.close();
}

export default queueService;
