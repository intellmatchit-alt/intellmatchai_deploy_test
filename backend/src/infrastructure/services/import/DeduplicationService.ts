/**
 * Deduplication Service
 *
 * Handles contact deduplication using identity keys.
 * Supports merging duplicate contacts with field priority.
 *
 * @module infrastructure/services/import/DeduplicationService
 */

import { prisma } from '../../database/prisma/client';
import { logger } from '../../../shared/logger/index';
import { NormalizedContact } from './NormalizationService';

/**
 * Merge result for a contact
 */
export interface MergeResult {
  contactId: string;
  isNew: boolean;
  isMerged: boolean;
  mergedFromCount: number;
  identityKey: string;
}

/**
 * Deduplication statistics
 */
export interface DeduplicationStats {
  totalProcessed: number;
  newContacts: number;
  mergedContacts: number;
  updatedContacts: number;
  skippedContacts: number;
}

/**
 * Raw sources JSON structure stored in Contact
 */
export interface RawSourceEntry {
  source: string;
  importedAt: string;
  batchId?: string;
  data: Record<string, unknown>;
}

/**
 * Deduplication Service
 */
export class DeduplicationService {
  /**
   * Process a batch of normalized contacts and deduplicate/upsert them
   */
  async processBatch(
    userId: string,
    contacts: NormalizedContact[],
    batchId: string,
    source: string
  ): Promise<{ results: MergeResult[]; stats: DeduplicationStats }> {
    const stats: DeduplicationStats = {
      totalProcessed: 0,
      newContacts: 0,
      mergedContacts: 0,
      updatedContacts: 0,
      skippedContacts: 0,
    };

    const results: MergeResult[] = [];

    // Group contacts by identity key to handle duplicates within the batch
    const contactsByKey = new Map<string, NormalizedContact[]>();
    for (const contact of contacts) {
      const existing = contactsByKey.get(contact.identityKey) || [];
      existing.push(contact);
      contactsByKey.set(contact.identityKey, existing);
    }

    logger.debug('Processing batch for deduplication', {
      userId,
      batchId,
      totalContacts: contacts.length,
      uniqueKeys: contactsByKey.size,
    });

    // Process each unique identity key
    for (const [identityKey, contactGroup] of contactsByKey) {
      stats.totalProcessed++;

      try {
        // Merge contacts within the batch that share the same identity key
        const mergedContact = this.mergeContacts(contactGroup);

        // Check if contact already exists in database
        const existingContact = await prisma.contact.findFirst({
          where: {
            ownerId: userId,
            identityKey,
          },
        });

        if (existingContact) {
          // Update existing contact with new data
          const updatedContact = await this.updateExistingContact(
            existingContact,
            mergedContact,
            batchId,
            source
          );

          results.push({
            contactId: updatedContact.id,
            isNew: false,
            isMerged: contactGroup.length > 1,
            mergedFromCount: contactGroup.length,
            identityKey,
          });

          if (contactGroup.length > 1) {
            stats.mergedContacts++;
          } else {
            stats.updatedContacts++;
          }
        } else {
          // Create new contact
          const newContact = await this.createNewContact(
            userId,
            mergedContact,
            batchId,
            source
          );

          results.push({
            contactId: newContact.id,
            isNew: true,
            isMerged: contactGroup.length > 1,
            mergedFromCount: contactGroup.length,
            identityKey,
          });

          stats.newContacts++;
          if (contactGroup.length > 1) {
            stats.mergedContacts++;
          }
        }
      } catch (error) {
        logger.error('Failed to process contact for deduplication', {
          identityKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        stats.skippedContacts++;
      }
    }

    return { results, stats };
  }

  /**
   * Merge multiple contacts into one (for duplicates within a batch)
   */
  private mergeContacts(contacts: NormalizedContact[]): NormalizedContact {
    if (contacts.length === 1) {
      return contacts[0];
    }

    // Start with the first contact
    const merged: NormalizedContact = { ...contacts[0] };

    // Merge in subsequent contacts, preferring non-empty values
    for (let i = 1; i < contacts.length; i++) {
      const contact = contacts[i];

      // Merge each field, preferring existing non-empty values
      for (const key of Object.keys(contact)) {
        if (key === 'identityKey' || key === 'id') continue;

        const existingValue = merged[key];
        const newValue = contact[key];

        // Keep the longer/more complete value
        if (!existingValue && newValue) {
          merged[key] = newValue;
        } else if (
          typeof existingValue === 'string' &&
          typeof newValue === 'string' &&
          newValue.length > existingValue.length
        ) {
          merged[key] = newValue;
        }
      }
    }

    return merged;
  }

  /**
   * Update an existing contact with new data
   */
  private async updateExistingContact(
    existing: {
      id: string;
      fullName: string;
      title?: string | null;
      firstName?: string | null;
      middleName?: string | null;
      lastName?: string | null;
      email: string | null;
      phone: string | null;
      company: string | null;
      jobTitle: string | null;
      location: string | null;
      bio: string | null;
      notes: string | null;
      linkedinUrl: string | null;
      website?: string | null;
      rawSources?: unknown;
      [key: string]: unknown;
    },
    newData: NormalizedContact,
    batchId: string,
    source: string
  ) {
    // Build the raw sources array
    const existingRawSources = (existing.rawSources as RawSourceEntry[]) || [];
    const newRawSource: RawSourceEntry = {
      source,
      importedAt: new Date().toISOString(),
      batchId,
      data: { ...newData },
    };

    // Prepare update data - only update fields that are empty or have better data
    const updateData: Record<string, unknown> = {
      rawSources: [...existingRawSources, newRawSource],
      updatedAt: new Date(),
    };

    // Update fields if new data is better
    if (!existing.fullName || (newData.fullName && newData.fullName.length > existing.fullName.length)) {
      updateData.fullName = newData.fullName;
    }
    // Update name components if not present
    if (!existing.title && newData.title) {
      updateData.title = newData.title;
    }
    if (!existing.firstName && newData.firstName) {
      updateData.firstName = newData.firstName;
    }
    if (!existing.middleName && newData.middleName) {
      updateData.middleName = newData.middleName;
    }
    if (!existing.lastName && newData.lastName) {
      updateData.lastName = newData.lastName;
    }
    if (!existing.email && newData.normalizedEmail) {
      updateData.email = newData.normalizedEmail;
    }
    if (!existing.phone && newData.normalizedPhone) {
      updateData.phone = newData.normalizedPhone;
      updateData.normalizedPhone = newData.normalizedPhone;
    }
    if (!existing.company && newData.company) {
      updateData.company = newData.company;
    }
    if (!existing.jobTitle && newData.jobTitle) {
      updateData.jobTitle = newData.jobTitle;
    }
    if (!existing.location && newData.location) {
      updateData.location = newData.location;
    }
    if (!existing.bio && newData.bio) {
      updateData.bio = newData.bio;
    }
    if (newData.notes) {
      // Append notes instead of replacing
      updateData.notes = existing.notes
        ? `${existing.notes}\n---\n${newData.notes}`
        : newData.notes;
    }
    if (!existing.linkedinUrl && newData.linkedinUrl) {
      updateData.linkedinUrl = newData.linkedinUrl;
    }
    if (!existing.twitterUrl && newData.twitterUrl) {
      updateData.twitterUrl = newData.twitterUrl;
    }
    if (!existing.websiteUrl && newData.websiteUrl) {
      updateData.websiteUrl = newData.websiteUrl;
    }

    return prisma.contact.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  /**
   * Create a new contact
   */
  private async createNewContact(
    userId: string,
    data: NormalizedContact,
    batchId: string,
    source: string
  ) {
    const rawSource: RawSourceEntry = {
      source,
      importedAt: new Date().toISOString(),
      batchId,
      data: { ...data },
    };

    return prisma.contact.create({
      data: {
        ownerId: userId,
        fullName: data.fullName,
        title: data.title || null,
        firstName: data.firstName || null,
        middleName: data.middleName || null,
        lastName: data.lastName || null,
        email: data.normalizedEmail || null,
        phone: data.normalizedPhone || data.phone || null,
        normalizedPhone: data.normalizedPhone || null,
        normalizedEmail: data.normalizedEmail || null,
        company: data.company || null,
        jobTitle: data.jobTitle || null,
        location: data.location || null,
        bio: data.bio || null,
        notes: data.notes || null,
        linkedinUrl: data.linkedinUrl || null,
        website: data.websiteUrl || null,
        identityKey: data.identityKey,
        source: this.mapSourceToEnum(source),
        importBatchId: batchId,
        rawSources: [rawSource] as unknown as object,
        dataConfidence: 'LOW', // Initial confidence, will be updated after enrichment
      },
    });
  }

  /**
   * Map import source string to ContactSource enum
   */
  private mapSourceToEnum(source: string): 'MANUAL' | 'CARD_SCAN' | 'IMPORT' | 'LINKEDIN' {
    const sourceMap: Record<string, 'MANUAL' | 'CARD_SCAN' | 'IMPORT' | 'LINKEDIN'> = {
      PHONE_FULL: 'IMPORT',
      PHONE_PICKER: 'IMPORT',
      CONTACT_PICKER: 'IMPORT',
      CSV: 'IMPORT',
      CSV_UPLOAD: 'IMPORT',
      VCF: 'IMPORT',
      VCF_UPLOAD: 'IMPORT',
      GOOGLE_SYNC: 'IMPORT',
      LINKEDIN: 'LINKEDIN',
      MANUAL: 'MANUAL',
      CARD_SCAN: 'CARD_SCAN',
    };

    return sourceMap[source.toUpperCase()] || 'IMPORT';
  }

  /**
   * Find duplicates for a contact by identity key
   */
  async findDuplicates(userId: string, identityKey: string): Promise<string[]> {
    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: userId,
        identityKey,
      },
      select: { id: true },
    });

    return contacts.map(c => c.id);
  }

  /**
   * Get deduplication statistics for a batch
   */
  async getBatchStats(batchId: string): Promise<DeduplicationStats> {
    const contacts = await prisma.contact.findMany({
      where: { importBatchId: batchId },
      select: {
        id: true,
        rawSources: true,
      },
    });

    const stats: DeduplicationStats = {
      totalProcessed: contacts.length,
      newContacts: 0,
      mergedContacts: 0,
      updatedContacts: 0,
      skippedContacts: 0,
    };

    for (const contact of contacts) {
      const rawSources = (contact.rawSources as unknown as RawSourceEntry[]) || [];
      if (rawSources.length > 1) {
        stats.mergedContacts++;
      } else {
        stats.newContacts++;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const deduplicationService = new DeduplicationService();
export default DeduplicationService;
