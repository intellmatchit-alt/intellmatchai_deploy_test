/**
 * Enrichment Worker
 *
 * Background worker for contact enrichment jobs.
 *
 * @module infrastructure/queue/workers/enrichmentWorker
 */

import { Job } from 'bullmq';
import { prisma } from '../../database/prisma/client.js';
import { logger } from '../../../shared/logger/index.js';
import { emitEnrichmentProgress, emitEnrichmentComplete } from '../../websocket/index.js';
import { queueService, QueueName, EnrichmentJobData } from '../QueueService.js';

/**
 * Enrichment result
 */
interface EnrichmentResult {
  contactId: string;
  enrichedFields: string[];
  data: Record<string, unknown>;
}

/**
 * Process enrichment job
 */
async function processEnrichmentJob(job: Job<EnrichmentJobData>): Promise<EnrichmentResult> {
  const { contactId, userId, fields } = job.data;

  logger.info(`Processing enrichment job: ${contactId}`, { jobId: job.id });

  try {
    // Get contact data
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
      },
    });

    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    // Verify ownership
    if (contact.ownerId !== userId) {
      throw new Error('Unauthorized access to contact');
    }

    const enrichedData: Record<string, unknown> = {};
    const enrichedFields: string[] = [];
    const totalSteps = 4;
    let currentStep = 0;

    // Step 1: Email validation
    currentStep++;
    await job.updateProgress((currentStep / totalSteps) * 100);
    emitEnrichmentProgress(contactId, currentStep, totalSteps, 'Validating email...');

    if (contact.email) {
      // In production, use AbstractAPI or similar service
      enrichedData.emailValid = true;
      enrichedData.emailType = 'professional';
      enrichedFields.push('email');
    }

    // Step 2: Phone validation
    currentStep++;
    await job.updateProgress((currentStep / totalSteps) * 100);
    emitEnrichmentProgress(contactId, currentStep, totalSteps, 'Validating phone...');

    if (contact.phone) {
      // In production, use NumVerify or similar service
      enrichedData.phoneValid = true;
      enrichedData.phoneCarrier = 'Unknown';
      enrichedData.phoneType = 'mobile';
      enrichedFields.push('phone');
    }

    // Step 3: Company enrichment
    currentStep++;
    await job.updateProgress((currentStep / totalSteps) * 100);
    emitEnrichmentProgress(contactId, currentStep, totalSteps, 'Enriching company data...');

    if (contact.company) {
      // In production, use PDL or Clearbit
      enrichedData.companySize = '50-200';
      enrichedData.companyIndustry = contact.contactSectors[0]?.sector.name || 'Technology';
      enrichedData.companyLinkedIn = `https://linkedin.com/company/${contact.company.toLowerCase().replace(/\s+/g, '-')}`;
      enrichedFields.push('company');
    }

    // Step 4: Social profiles
    currentStep++;
    await job.updateProgress((currentStep / totalSteps) * 100);
    emitEnrichmentProgress(contactId, currentStep, totalSteps, 'Finding social profiles...');

    if (contact.fullName && contact.company) {
      // In production, use PDL or similar service
      const nameSlug = contact.fullName.toLowerCase().replace(/\s+/g, '-');
      enrichedData.linkedinUrl = contact.linkedinUrl || `https://linkedin.com/in/${nameSlug}`;
      enrichedFields.push('social');
    }

    // Update contact with enriched data
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        isEnriched: true,
        enrichedAt: new Date(),
        enrichmentData: {
          ...((contact.enrichmentData as Record<string, unknown>) || {}),
          ...enrichedData,
          enrichedAt: new Date().toISOString(),
          enrichedFields,
        },
        ...(enrichedData.linkedinUrl && !contact.linkedinUrl && {
          linkedinUrl: enrichedData.linkedinUrl as string,
        }),
      },
    });

    // Emit completion event
    emitEnrichmentComplete(contactId, {
      success: true,
      enrichedFields,
      data: enrichedData,
    });

    logger.info(`Enrichment completed: ${contactId}`, {
      jobId: job.id,
      enrichedFields,
    });

    return {
      contactId,
      enrichedFields,
      data: enrichedData,
    };
  } catch (error) {
    logger.error(`Enrichment failed: ${contactId}`, error);

    emitEnrichmentComplete(contactId, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Start enrichment worker
 */
export function startEnrichmentWorker(): void {
  queueService.registerWorker<EnrichmentJobData, EnrichmentResult>(
    QueueName.ENRICHMENT,
    processEnrichmentJob,
    {
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute
      },
    }
  );

  logger.info('Enrichment worker started');
}

export default startEnrichmentWorker;
