/**
 * Task Reminder Worker
 *
 * Cron worker that checks for due task reminders and sends notifications
 * via WebSocket (in-app) and email.
 *
 * @module infrastructure/queue/workers/taskReminderWorker
 */

import { Job } from "bullmq";
import { prisma } from "../../database/prisma/client.js";
import { logger } from "../../../shared/logger/index.js";
import { queueService, QueueName } from "../QueueService.js";

interface TaskReminderJobData {
  type: "check-due-reminders";
}

/**
 * Process due reminders
 */
async function processDueReminders(): Promise<number> {
  const now = new Date();

  // Find all unsent reminders that are due (including snoozed ones that are now due)
  const dueReminders = await prisma.taskReminder.findMany({
    where: {
      isSent: false,
      OR: [
        { snoozeUntil: null, reminderAt: { lte: now } },
        { snoozeUntil: { lte: now } },
      ],
    },
    include: {
      task: {
        include: {
          user: {
            select: { id: true, email: true, firstName: true },
          },
          contact: {
            select: { id: true, fullName: true },
          },
        },
      },
    },
    take: 100,
  });

  if (dueReminders.length === 0) return 0;

  let sentCount = 0;

  for (const reminder of dueReminders) {
    try {
      // Skip if task is already completed or cancelled
      if (["COMPLETED", "CANCELLED"].includes(reminder.task.status)) {
        await prisma.taskReminder.update({
          where: { id: reminder.id },
          data: { isSent: true },
        });
        continue;
      }

      // Mark as sent
      await prisma.taskReminder.update({
        where: { id: reminder.id },
        data: { isSent: true },
      });

      // For email type, queue an email job
      if (reminder.type === "EMAIL" && reminder.task.user.email) {
        await queueService.addEmailJob({
          to: reminder.task.user.email,
          subject: `Task Reminder: ${reminder.task.title}`,
          template: "task-reminder",
          data: {
            userName: reminder.task.user.firstName || "User",
            taskTitle: reminder.task.title,
            taskDescription: reminder.task.description,
            dueDate: reminder.task.dueDate?.toISOString(),
            contactName: reminder.task.contact?.fullName,
          },
        });
      }

      // For IN_APP type, create a notification record
      if (reminder.type === "IN_APP") {
        await prisma.notification.create({
          data: {
            userId: reminder.task.user.id,
            type: "task_reminder",
            title: "Task Reminder",
            message: `Reminder: "${reminder.task.title}"${reminder.task.contact ? ` (${reminder.task.contact.fullName})` : ""}`,
            data: {
              taskId: reminder.task.id,
              contactId: reminder.task.contact?.id,
            },
          },
        });
      }

      // For PUSH type, send push notification
      if (reminder.type === "PUSH") {
        try {
          const { PushNotificationService } =
            await import("../../services/PushNotificationService.js");
          await PushNotificationService.sendPush(
            reminder.task.user.id,
            "Task Reminder",
            `Reminder: "${reminder.task.title}"`,
            { taskId: reminder.task.id },
          );
        } catch (e) {
          logger.error("Push notification failed for reminder", {
            reminderId: reminder.id,
            error: e,
          });
        }
      }

      sentCount++;
    } catch (error) {
      logger.error("Failed to process task reminder", {
        reminderId: reminder.id,
        error,
      });
    }
  }

  return sentCount;
}

/**
 * Start the task reminder worker
 */
export function startTaskReminderWorker(): void {
  const worker = queueService.registerWorker<TaskReminderJobData, number>(
    QueueName.TASK_REMINDER,
    async (job: Job<TaskReminderJobData>) => {
      logger.debug("Processing task reminder job", { type: job.data.type });
      const count = await processDueReminders();
      if (count > 0) {
        logger.info("Task reminders processed", { sentCount: count });
      }
      return count;
    },
    { concurrency: 1 },
  );

  if (!worker) {
    logger.warn("Task reminder worker not started (queue unavailable)");
    return;
  }

  logger.info("Task reminder worker started");
}

/**
 * Schedule recurring reminder check job (every minute)
 */
export async function scheduleTaskReminderCheck(): Promise<void> {
  const queue = queueService.getQueue(QueueName.TASK_REMINDER);
  if (!queue) {
    logger.warn("Cannot schedule task reminder check (queue unavailable)");
    return;
  }

  // Add repeatable job
  await queue.add(
    "check-due-reminders",
    { type: "check-due-reminders" },
    {
      repeat: {
        pattern: "* * * * *", // Every minute
      },
      jobId: "task-reminder-cron",
    },
  );

  logger.info("Task reminder check scheduled (every minute)");
}
