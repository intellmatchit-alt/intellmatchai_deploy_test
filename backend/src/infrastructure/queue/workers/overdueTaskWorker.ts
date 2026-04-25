/**
 * Overdue Task Worker
 *
 * Cron worker that checks for overdue tasks and creates notifications.
 *
 * @module infrastructure/queue/workers/overdueTaskWorker
 */

import { Job } from 'bullmq';
import { prisma } from '../../database/prisma/client';
import { logger } from '../../../shared/logger/index';
import { queueService, QueueName } from '../QueueService';

interface OverdueTaskJobData {
  type: 'check-overdue-tasks';
}

async function processOverdueTasks(): Promise<number> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find overdue tasks
  const overdueTasks = await prisma.contactTask.findMany({
    where: {
      dueDate: { lt: now, not: null },
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    select: {
      id: true,
      title: true,
      userId: true,
      dueDate: true,
    },
    take: 100,
  });

  if (overdueTasks.length === 0) return 0;

  let notifiedCount = 0;

  for (const task of overdueTasks) {
    try {
      // Check if we already sent an overdue notification today for this task
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: task.userId,
          type: 'task_overdue',
          data: { path: 'taskId', equals: task.id },
          createdAt: { gte: todayStart },
        },
      });

      if (existingNotification) continue;

      await prisma.notification.create({
        data: {
          userId: task.userId,
          type: 'task_overdue',
          title: 'Task overdue',
          message: `Task "${task.title}" is overdue`,
          data: { taskId: task.id },
        },
      });

      notifiedCount++;
    } catch (error) {
      logger.error('Failed to create overdue notification', { taskId: task.id, error });
    }
  }

  return notifiedCount;
}

export function startOverdueTaskWorker(): void {
  const worker = queueService.registerWorker<OverdueTaskJobData, number>(
    QueueName.OVERDUE_TASK,
    async (job: Job<OverdueTaskJobData>) => {
      logger.debug('Processing overdue task job', { type: job.data.type });
      const count = await processOverdueTasks();
      if (count > 0) {
        logger.info('Overdue task notifications created', { count });
      }
      return count;
    },
    { concurrency: 1 }
  );

  if (!worker) {
    logger.warn('Overdue task worker not started (queue unavailable)');
    return;
  }

  logger.info('Overdue task worker started');
}

export async function scheduleOverdueTaskCheck(): Promise<void> {
  const queue = queueService.getQueue(QueueName.OVERDUE_TASK);
  if (!queue) {
    logger.warn('Cannot schedule overdue task check (queue unavailable)');
    return;
  }

  await queue.add(
    'check-overdue-tasks',
    { type: 'check-overdue-tasks' },
    {
      repeat: { pattern: '0 * * * *' }, // Every hour
      jobId: 'overdue-task-cron',
    }
  );

  logger.info('Overdue task check scheduled (every hour)');
}
