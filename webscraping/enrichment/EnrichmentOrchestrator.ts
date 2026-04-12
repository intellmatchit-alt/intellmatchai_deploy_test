/**
 * Enrichment Orchestrator
 *
 * Combines multiple enrichment services (NumVerify, AbstractAPI, PDL)
 * to provide comprehensive contact data enrichment.
 *
 * @module infrastructure/external/enrichment/EnrichmentOrchestrator
 */

import { NumVerifyService, PhoneValidationResult } from './NumVerifyService';
import { AbstractAPIService, PhoneEnrichmentResult, EmailEnrichmentResult } from './AbstractAPIService';
import { PDLEnrichmentService } from './PDLEnrichmentService';
import {
  EnrichmentInput,
  EnrichmentResult,
  EnrichedPersonData,
} from '../../../domain/services/IEnrichmentService';
import { prisma } from '../../database/prisma/client';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Combined enrichment result with all data sources
 */
export interface CombinedEnrichmentResult {
  success: boolean;
  contact: {
    fullName?: string;
    phone?: string;
    phoneFormatted?: string;
    email?: string;
    company?: string;
    jobTitle?: string;
    location?: string;
    country?: string;
    carrier?: string;
    lineType?: string;
    linkedinUrl?: string;
    bio?: string;
    skills?: string[];
  };
  sources: string[];
  fieldsUpdated: string[];
  phoneValidation?: {
    valid: boolean;
    carrier?: string;
    lineType?: string;
    location?: string;
    countryCode?: string;
    countryName?: string;
  };
  emailValidation?: {
    deliverable: boolean;
    qualityScore?: number;
    isFreeEmail?: boolean;
    isDisposable?: boolean;
  };
  rawResponses?: {
    numverify?: PhoneValidationResult;
    abstractapi?: PhoneEnrichmentResult | EmailEnrichmentResult;
    pdl?: EnrichmentResult;
  };
  error?: string;
  processingTimeMs: number;
}

/**
 * Enrichment Orchestrator
 *
 * Orchestrates contact enrichment across multiple services.
 */
export class EnrichmentOrchestrator {
  private numVerifyService: NumVerifyService;
  private abstractAPIService: AbstractAPIService;
  private pdlService: PDLEnrichmentService;

  constructor() {
    this.numVerifyService = new NumVerifyService();
    this.abstractAPIService = new AbstractAPIService();
    this.pdlService = new PDLEnrichmentService();
  }

  /**
   * Check which services are available
   */
  async getAvailableServices(): Promise<{
    numverify: boolean;
    abstractapi: boolean;
    pdl: boolean;
  }> {
    const [numverify, abstractapi, pdl] = await Promise.all([
      this.numVerifyService.isAvailable(),
      this.abstractAPIService.isAvailable(),
      this.pdlService.isAvailable(),
    ]);

    return { numverify, abstractapi, pdl };
  }

  /**
   * Enrich a contact using all available services
   *
   * @param contactId - Contact ID to enrich
   * @param userId - Owner user ID (for authorization)
   * @returns Combined enrichment result
   */
  async enrichContact(contactId: string, userId: string): Promise<CombinedEnrichmentResult> {
    const startTime = Date.now();
    const sources: string[] = [];
    const fieldsUpdated: string[] = [];

    try {
      // Get contact data
      const contact = await prisma.contact.findFirst({
        where: {
          id: contactId,
          ownerId: userId,
        },
      });

      if (!contact) {
        return {
          success: false,
          contact: {},
          sources: [],
          fieldsUpdated: [],
          error: 'Contact not found',
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Initialize result with existing contact data
      const enrichedContact: CombinedEnrichmentResult['contact'] = {
        fullName: contact.fullName || undefined,
        phone: contact.phone || undefined,
        email: contact.email || undefined,
        company: contact.company || undefined,
        jobTitle: contact.jobTitle || undefined,
        location: contact.location || undefined,
        linkedinUrl: contact.linkedinUrl || undefined,
        bio: contact.bio || undefined,
      };

      const rawResponses: CombinedEnrichmentResult['rawResponses'] = {};
      let phoneValidation: CombinedEnrichmentResult['phoneValidation'];
      let emailValidation: CombinedEnrichmentResult['emailValidation'];

      // Step 1: Validate phone number with NumVerify or AbstractAPI
      if (contact.phone) {
        const numverifyAvailable = await this.numVerifyService.isAvailable();
        const abstractapiAvailable = await this.abstractAPIService.isAvailable();

        if (numverifyAvailable) {
          const phoneResult = await this.numVerifyService.validatePhone(contact.phone);
          rawResponses.numverify = phoneResult;

          if (phoneResult.success && phoneResult.data) {
            sources.push('numverify');
            phoneValidation = {
              valid: phoneResult.valid,
              carrier: phoneResult.data.carrier || undefined,
              lineType: phoneResult.data.lineType || undefined,
              location: phoneResult.data.location || undefined,
              countryCode: phoneResult.data.countryCode || undefined,
              countryName: phoneResult.data.countryName || undefined,
            };

            // Update contact with phone data
            if (phoneResult.data.internationalFormat && !enrichedContact.phoneFormatted) {
              enrichedContact.phoneFormatted = phoneResult.data.internationalFormat;
              fieldsUpdated.push('phoneFormatted');
            }
            if (phoneResult.data.location && !enrichedContact.location) {
              enrichedContact.location = phoneResult.data.location;
              fieldsUpdated.push('location');
            }
            if (phoneResult.data.countryName && !enrichedContact.country) {
              enrichedContact.country = phoneResult.data.countryName;
              fieldsUpdated.push('country');
            }
            if (phoneResult.data.carrier) {
              enrichedContact.carrier = phoneResult.data.carrier;
              fieldsUpdated.push('carrier');
            }
            if (phoneResult.data.lineType) {
              enrichedContact.lineType = phoneResult.data.lineType;
              fieldsUpdated.push('lineType');
            }
          }
        } else if (abstractapiAvailable) {
          // Fallback to AbstractAPI for phone validation
          const phoneResult = await this.abstractAPIService.enrichPhone(contact.phone);
          rawResponses.abstractapi = phoneResult;

          if (phoneResult.success && phoneResult.data) {
            sources.push('abstractapi');
            phoneValidation = {
              valid: phoneResult.data.valid,
              carrier: phoneResult.data.carrier || undefined,
              lineType: phoneResult.data.type || undefined,
              location: phoneResult.data.location || undefined,
              countryCode: phoneResult.data.countryCode || undefined,
              countryName: phoneResult.data.countryName || undefined,
            };

            if (phoneResult.data.internationalFormat && !enrichedContact.phoneFormatted) {
              enrichedContact.phoneFormatted = phoneResult.data.internationalFormat;
              fieldsUpdated.push('phoneFormatted');
            }
            if (phoneResult.data.location && !enrichedContact.location) {
              enrichedContact.location = phoneResult.data.location;
              fieldsUpdated.push('location');
            }
            if (phoneResult.data.countryName && !enrichedContact.country) {
              enrichedContact.country = phoneResult.data.countryName;
              fieldsUpdated.push('country');
            }
          }
        }
      }

      // Step 2: Validate email with AbstractAPI
      if (contact.email) {
        const abstractapiAvailable = await this.abstractAPIService.isAvailable();

        if (abstractapiAvailable) {
          const emailResult = await this.abstractAPIService.enrichEmail(contact.email);

          if (emailResult.success && emailResult.data) {
            if (!sources.includes('abstractapi')) {
              sources.push('abstractapi');
            }

            emailValidation = {
              deliverable: emailResult.data.deliverability === 'DELIVERABLE',
              qualityScore: emailResult.data.qualityScore,
              isFreeEmail: emailResult.data.isFreeEmail,
              isDisposable: emailResult.data.isDisposable,
            };

            // Use autocorrected email if available
            if (emailResult.data.autocorrect && emailResult.data.autocorrect !== contact.email) {
              enrichedContact.email = emailResult.data.autocorrect;
              fieldsUpdated.push('email');
            }
          }
        }
      }

      // Step 3: Try PDL for comprehensive person data
      const pdlAvailable = await this.pdlService.isAvailable();

      if (pdlAvailable) {
        const pdlInput: EnrichmentInput = {
          email: contact.email || undefined,
          phone: contact.phone || undefined,
          name: contact.fullName || undefined,
          company: contact.company || undefined,
          linkedInUrl: contact.linkedinUrl || undefined,
        };

        const pdlResult = await this.pdlService.enrichPerson(pdlInput);
        rawResponses.pdl = pdlResult;

        if (pdlResult.success && pdlResult.data) {
          sources.push('pdl');

          // Merge PDL data (only fill in missing fields)
          const pdlData = pdlResult.data;

          if (pdlData.fullName && !enrichedContact.fullName) {
            enrichedContact.fullName = pdlData.fullName;
            fieldsUpdated.push('fullName');
          }
          if (pdlData.jobTitle && !enrichedContact.jobTitle) {
            enrichedContact.jobTitle = pdlData.jobTitle;
            fieldsUpdated.push('jobTitle');
          }
          if (pdlData.company && !enrichedContact.company) {
            enrichedContact.company = pdlData.company;
            fieldsUpdated.push('company');
          }
          if (pdlData.location && !enrichedContact.location) {
            enrichedContact.location = pdlData.location;
            fieldsUpdated.push('location');
          }
          if (pdlData.country && !enrichedContact.country) {
            enrichedContact.country = pdlData.country;
            fieldsUpdated.push('country');
          }
          if (pdlData.linkedInUrl && !enrichedContact.linkedinUrl) {
            enrichedContact.linkedinUrl = pdlData.linkedInUrl;
            fieldsUpdated.push('linkedinUrl');
          }
          if (pdlData.bio && !enrichedContact.bio) {
            enrichedContact.bio = pdlData.bio;
            fieldsUpdated.push('bio');
          }
          if (pdlData.skills && pdlData.skills.length > 0) {
            enrichedContact.skills = pdlData.skills;
            fieldsUpdated.push('skills');
          }
        }
      }

      // Step 4: Update contact in database
      if (fieldsUpdated.length > 0) {
        const updateData: Record<string, any> = {};

        if (fieldsUpdated.includes('fullName') && enrichedContact.fullName) {
          updateData.fullName = enrichedContact.fullName;
        }
        if (fieldsUpdated.includes('jobTitle') && enrichedContact.jobTitle) {
          updateData.jobTitle = enrichedContact.jobTitle;
        }
        if (fieldsUpdated.includes('company') && enrichedContact.company) {
          updateData.company = enrichedContact.company;
        }
        if (fieldsUpdated.includes('location') && enrichedContact.location) {
          updateData.location = enrichedContact.location;
        }
        if (fieldsUpdated.includes('linkedinUrl') && enrichedContact.linkedinUrl) {
          updateData.linkedinUrl = enrichedContact.linkedinUrl;
        }
        if (fieldsUpdated.includes('bio') && enrichedContact.bio) {
          updateData.bio = enrichedContact.bio;
        }
        if (fieldsUpdated.includes('email') && enrichedContact.email) {
          updateData.email = enrichedContact.email;
        }

        // Store enrichment metadata
        updateData.enrichmentData = JSON.stringify({
          lastEnrichedAt: new Date().toISOString(),
          sources,
          phoneValidation,
          emailValidation,
        });
        updateData.enrichedAt = new Date();

        if (Object.keys(updateData).length > 0) {
          await prisma.contact.update({
            where: { id: contactId },
            data: updateData,
          });
        }
      }

      logger.info('Contact enrichment completed', {
        contactId,
        sources,
        fieldsUpdated,
        processingTimeMs: Date.now() - startTime,
      });

      return {
        success: true,
        contact: enrichedContact,
        sources,
        fieldsUpdated,
        phoneValidation,
        emailValidation,
        rawResponses,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Contact enrichment failed', { error, contactId });
      return {
        success: false,
        contact: {},
        sources,
        fieldsUpdated,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Quick phone validation without full enrichment
   */
  async validatePhone(phone: string): Promise<PhoneValidationResult> {
    // Prefer NumVerify for phone validation
    if (await this.numVerifyService.isAvailable()) {
      return this.numVerifyService.validatePhone(phone);
    }

    // Fallback to AbstractAPI
    if (await this.abstractAPIService.isAvailable()) {
      const result = await this.abstractAPIService.enrichPhone(phone);
      return {
        success: result.success,
        valid: result.data?.valid ?? false,
        data: result.data ? {
          number: result.data.phone,
          localFormat: result.data.localFormat,
          internationalFormat: result.data.internationalFormat,
          countryCode: result.data.countryCode,
          countryName: result.data.countryName,
          location: result.data.location,
          carrier: result.data.carrier,
          lineType: result.data.type,
        } : undefined,
        error: result.error,
        processingTimeMs: result.processingTimeMs,
      };
    }

    return {
      success: false,
      valid: false,
      error: 'No phone validation service available',
      processingTimeMs: 0,
    };
  }

  /**
   * Quick email validation without full enrichment
   */
  async validateEmail(email: string): Promise<EmailEnrichmentResult> {
    if (await this.abstractAPIService.isAvailable()) {
      return this.abstractAPIService.enrichEmail(email);
    }

    return {
      success: false,
      error: 'No email validation service available',
      processingTimeMs: 0,
    };
  }
}

// Export singleton instance
let orchestratorInstance: EnrichmentOrchestrator | null = null;

export function getEnrichmentOrchestrator(): EnrichmentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new EnrichmentOrchestrator();
  }
  return orchestratorInstance;
}
