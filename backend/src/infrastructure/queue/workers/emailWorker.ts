/**
 * Email Worker
 *
 * Background worker for sending emails.
 *
 * @module infrastructure/queue/workers/emailWorker
 */

import { Job } from 'bullmq';
import { logger } from '../../../shared/logger/index.js';
import { queueService, QueueName, EmailJobData } from '../QueueService.js';

/**
 * Email result
 */
interface EmailResult {
  to: string;
  subject: string;
  messageId?: string;
  sent: boolean;
}

/**
 * Process email job
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<EmailResult> {
  const { to, subject, template, data } = job.data;

  logger.info(`Processing email job: ${to}`, { jobId: job.id, template });

  try {
    await job.updateProgress(20);

    // Dynamic import of email service to avoid circular dependencies
    const { emailService } = await import('../../services/EmailService.js');

    await job.updateProgress(50);

    // Send email based on template
    let sent = false;

    switch (template) {
      case 'verification':
        sent = await emailService.sendVerificationEmail(to, {
          name: data.name as string,
          verificationUrl: data.verificationUrl as string,
          expiresIn: data.expiresIn as string || '24 hours',
        });
        break;

      case 'password-reset':
        sent = await emailService.sendPasswordResetEmail(to, {
          name: data.name as string,
          resetUrl: data.resetUrl as string,
          expiresIn: data.expiresIn as string || '1 hour',
        });
        break;

      case 'welcome':
        sent = await emailService.sendWelcomeEmail(to, {
          name: data.name as string,
          loginUrl: data.loginUrl as string || `${process.env.FRONTEND_URL}/login`,
        });
        break;

      default:
        logger.warn(`Unknown email template: ${template}`);
        throw new Error(`Unknown email template: ${template}`);
    }

    if (!sent) {
      throw new Error(`Failed to send ${template} email to ${to}`);
    }

    await job.updateProgress(100);

    logger.info(`Email sent: ${to}`, {
      jobId: job.id,
      template,
    });

    return {
      to,
      subject,
      sent: true,
    };
  } catch (error) {
    logger.error(`Email failed: ${to}`, error);
    throw error;
  }
}

/**
 * Start email worker
 */
export function startEmailWorker(): void {
  queueService.registerWorker<EmailJobData, EmailResult>(
    QueueName.EMAIL,
    processEmailJob,
    {
      concurrency: 10,
      limiter: {
        max: 30,
        duration: 60000, // 30 emails per minute
      },
    }
  );

  logger.info('Email worker started');
}

export default startEmailWorker;
