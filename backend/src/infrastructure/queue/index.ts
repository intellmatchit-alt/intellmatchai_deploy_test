/**
 * Queue Module
 *
 * Exports queue services and workers.
 *
 * @module infrastructure/queue
 */

export * from './QueueService';
export { startEnrichmentWorker } from './workers/enrichmentWorker';
export { startMatchingWorker } from './workers/matchingWorker';
export { startEmailWorker } from './workers/emailWorker';
export {
  startScheduledMatchingWorker,
  scheduleRecurringMatchingJobs,
  triggerUserRecalculation,
  triggerContactsRecalculation,
} from './workers/scheduledMatchingWorker';
export {
  startNotificationWorker,
  scheduleRecurringNotificationJobs,
  triggerMatchNotification,
} from './workers/notificationWorker';
export {
  startProjectMatchingWorker,
  scheduleProjectRematchJobs,
  triggerProjectMatching,
  getProjectMatchingJobStatus,
} from './workers/projectMatchingWorker';
export {
  startProductMatchWorker,
  triggerProductMatchAsync,
  getProductMatchJobStatus,
} from './workers/productMatchWorker';
export {
  startCollaborationMatchWorker,
  getCollaborationMatchJobStatus,
} from './workers/collaborationMatchWorker';
export {
  startImportWorker,
  getImportJobStatus,
} from './workers/importWorker';

import { queueService } from './QueueService';
import { startEnrichmentWorker } from './workers/enrichmentWorker';
import { startMatchingWorker } from './workers/matchingWorker';
import { startEmailWorker } from './workers/emailWorker';
import {
  startScheduledMatchingWorker,
  scheduleRecurringMatchingJobs,
} from './workers/scheduledMatchingWorker';
import {
  startNotificationWorker,
  scheduleRecurringNotificationJobs,
} from './workers/notificationWorker';
import {
  startProjectMatchingWorker,
  scheduleProjectRematchJobs,
} from './workers/projectMatchingWorker';
import {
  startProductMatchWorker,
} from './workers/productMatchWorker';
import {
  startCollaborationMatchWorker,
} from './workers/collaborationMatchWorker';
import {
  startImportWorker,
} from './workers/importWorker';
import {
  createPitchProcessingWorker,
} from './workers/pitch.worker';
import {
  createProfileBuildWorker,
} from './workers/pitchProfile.worker';
import {
  createMatchComputeWorker,
} from './workers/pitchMatch.worker';
import {
  createOutreachGenerateWorker,
} from './workers/pitchOutreach.worker';
import {
  startRecurringTaskWorker,
  scheduleRecurringTaskCheck,
} from './workers/recurringTaskWorker';
import {
  startOverdueTaskWorker,
  scheduleOverdueTaskCheck,
} from './workers/overdueTaskWorker';
import {
  startTaskReminderWorker,
  scheduleTaskReminderCheck,
} from './workers/taskReminderWorker';
import { logger } from '../../shared/logger/index';

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
