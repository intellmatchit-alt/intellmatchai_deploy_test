/**
 * Recurring Task Worker
 *
 * Cron worker that checks for due recurring tasks and generates next occurrences.
 *
 * @module infrastructure/queue/workers/recurringTaskWorker
 */

import { Job } from 'bullmq';
import { prisma } from '../../database/prisma/client';
import { logger } from '../../../shared/logger/index';
import { queueService, QueueName } from '../QueueService';

interface RecurringTaskJobData {
  type: 'check-recurring-tasks';
}

function calculateNextDueDate(currentDueDate: Date, pattern: string, interval: number, daysOfWeek?: number[]): Date {
  const next = new Date(currentDueDate);

  switch (pattern) {
    case 'DAILY':
      next.setDate(next.getDate() + interval);
      break;
    case 'WEEKLY':
      if (daysOfWeek && daysOfWeek.length > 0) {
        const currentDay = next.getDay();
        const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
        const nextDay = sortedDays.find(d => d > currentDay);
        if (nextDay !== undefined) {
          next.setDate(next.getDate() + (nextDay - currentDay));
        } else {
          next.setDate(next.getDate() + (7 - currentDay + sortedDays[0]) + (interval - 1) * 7);
        }
      } else {
        next.setDate(next.getDate() + 7 * interval);
      }
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      next.setDate(next.getDate() + interval);
  }

  return next;
}

async function processRecurringTasks(): Promise<number> {
  const now = new Date();

  const dueRecurrences = await prisma.taskRecurrence.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
    },
    include: {
      tasks: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    take: 50,
  });

  if (dueRecurrences.length === 0) return 0;

  let generatedCount = 0;

  for (const recurrence of dueRecurrences) {
    try {
      // Check limits
      if (recurrence.endDate && now > recurrence.endDate) {
        await prisma.taskRecurrence.update({ where: { id: recurrence.id }, data: { isActive: false } });
        continue;
      }
      if (recurrence.maxOccurrences && recurrence.occurrenceCount >= recurrence.maxOccurrences) {
        await prisma.taskRecurrence.update({ where: { id: recurrence.id }, data: { isActive: false } });
        continue;
      }

      const latestTask = recurrence.tasks[0];
      if (!latestTask) continue;

      // Skip if latest task is still pending (not completed yet)
      if (['PENDING', 'IN_PROGRESS'].includes(latestTask.status)) continue;

      if (!latestTask.dueDate) continue;

      const daysOfWeek = recurrence.daysOfWeek as number[] | null;
      const nextDueDate = calculateNextDueDate(latestTask.dueDate, recurrence.pattern, recurrence.interval, daysOfWeek || undefined);

      // Calculate reminder offset
      let nextReminderAt: Date | null = null;
      if (latestTask.reminderAt && latestTask.dueDate) {
        const offset = latestTask.dueDate.getTime() - latestTask.reminderAt.getTime();
        nextReminderAt = new Date(nextDueDate.getTime() - offset);
      }

      await prisma.contactTask.create({
        data: {
          userId: recurrence.userId,
          contactId: latestTask.contactId,
          title: latestTask.title,
          description: latestTask.description,
          dueDate: nextDueDate,
          reminderAt: nextReminderAt,
          priority: latestTask.priority,
          status: 'PENDING',
          category: latestTask.category,
          categoryColor: latestTask.categoryColor,
          recurrenceId: recurrence.id,
        },
      });

      await prisma.taskRecurrence.update({
        where: { id: recurrence.id },
        data: {
          occurrenceCount: { increment: 1 },
          nextRunAt: nextDueDate,
        },
      });

      generatedCount++;
    } catch (error) {
      logger.error('Failed to process recurring task', { recurrenceId: recurrence.id, error });
    }
  }

  return generatedCount;
}

export function startRecurringTaskWorker(): void {
  const worker = queueService.registerWorker<RecurringTaskJobData, number>(
    QueueName.RECURRING_TASK,
    async (job: Job<RecurringTaskJobData>) => {
      logger.debug('Processing recurring task job', { type: job.data.type });
      const count = await processRecurringTasks();
      if (count > 0) {
        logger.info('Recurring tasks generated', { count });
      }
      return count;
    },
    { concurrency: 1 }
  );

  if (!worker) {
    logger.warn('Recurring task worker not started (queue unavailable)');
    return;
  }

  logger.info('Recurring task worker started');
}

export async function scheduleRecurringTaskCheck(): Promise<void> {
  const queue = queueService.getQueue(QueueName.RECURRING_TASK);
  if (!queue) {
    logger.warn('Cannot schedule recurring task check (queue unavailable)');
    return;
  }

  await queue.add(
    'check-recurring-tasks',
    { type: 'check-recurring-tasks' },
    {
      repeat: { pattern: '0 * * * *' }, // Every hour
      jobId: 'recurring-task-cron',
    }
  );

  logger.info('Recurring task check scheduled (every hour)');
}
