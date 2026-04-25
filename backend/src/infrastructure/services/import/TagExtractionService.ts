/**
 * Tag Extraction Service
 *
 * Extracts sectors, skills, and interests from contact data
 * using rule-based extraction and optional enrichment data.
 *
 * @module infrastructure/services/import/TagExtractionService
 */

import { prisma } from '../../database/prisma/client';
import { logger } from '../../../shared/logger/index';
import { TaxonomyMappingService, ExtractedTags, taxonomyMappingService } from './TaxonomyMappingService';

/**
 * Contact data for tag extraction
 */
export interface ContactForTagging {
  id: string;
  fullName: string;
  jobTitle?: string | null;
  company?: string | null;
  bio?: string | null;
  location?: string | null;
  email?: string | null;
}

/**
 * Enrichment data (from PDL or similar)
 */
export interface EnrichmentData {
  industry?: string;
  skills?: string[];
  interests?: string[];
  likelihood?: number;
}

/**
 * Data confidence levels
 */
export type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Tag extraction result
 */
export interface TagExtractionResult {
  contactId: string;
  sectors: Array<{ id: string; name: string; confidence: number }>;
  skills: Array<{ id: string; name: string; confidence: number }>;
  interests: Array<{ id: string; name: string; confidence: number }>;
  keywords: string[];
  overallConfidence: number;
  confidenceLevel: DataConfidence;
}

/**
 * Tag Extraction Service
 */
export class TagExtractionService {
  private taxonomyService: TaxonomyMappingService;

  constructor(taxonomyService?: TaxonomyMappingService) {
    this.taxonomyService = taxonomyService || taxonomyMappingService;
  }

  /**
   * Initialize the service (load taxonomy cache)
   */
  async initialize(): Promise<void> {
    await this.taxonomyService.loadCache();
  }

  /**
   * Extract tags from a single contact
   */
  async extractTags(
    contact: ContactForTagging,
    enrichment?: EnrichmentData
  ): Promise<TagExtractionResult> {
    await this.initialize();

    const allSectors: Map<string, { id: string; name: string; confidence: number }> = new Map();
    const allSkills: Map<string, { id: string; name: string; confidence: number }> = new Map();
    const allInterests: Map<string, { id: string; name: string; confidence: number }> = new Map();
    const keywords: Set<string> = new Set();

    // 1. Extract from job title (rule-based)
    const titleExtraction = this.taxonomyService.mapJobTitle(contact.jobTitle);
    const titleResolved = await this.taxonomyService.resolveToIds(
      titleExtraction.sectors,
      titleExtraction.skills
    );

    for (const sector of titleResolved.sectorIds) {
      this.mergeTag(allSectors, sector, titleExtraction.confidence);
    }
    for (const skill of titleResolved.skillIds) {
      this.mergeTag(allSkills, skill, titleExtraction.confidence);
    }

    // Add job title keywords
    if (contact.jobTitle) {
      const titleKeywords = this.extractKeywords(contact.jobTitle);
      titleKeywords.forEach(k => keywords.add(k));
    }

    // 2. Extract from company (rule-based)
    const companyExtraction = this.taxonomyService.mapCompany(contact.company);
    const companyResolved = await this.taxonomyService.resolveToIds(
      companyExtraction.sectors,
      []
    );

    for (const sector of companyResolved.sectorIds) {
      this.mergeTag(allSectors, sector, companyExtraction.confidence);
    }

    // Add company as keyword
    if (contact.company) {
      keywords.add(contact.company);
    }

    // 3. Extract from enrichment data (if available)
    if (enrichment) {
      const enrichmentTags = this.taxonomyService.mapEnrichmentData(enrichment);

      if (enrichmentTags.sectors) {
        for (const sector of enrichmentTags.sectors) {
          this.mergeTag(allSectors, sector, sector.confidence);
        }
      }
      if (enrichmentTags.skills) {
        for (const skill of enrichmentTags.skills) {
          this.mergeTag(allSkills, skill, skill.confidence);
        }
      }
      if (enrichmentTags.interests) {
        for (const interest of enrichmentTags.interests) {
          this.mergeTag(allInterests, interest, interest.confidence);
        }
      }
    }

    // 4. Extract from bio (keyword-based)
    if (contact.bio) {
      const bioKeywords = this.extractKeywords(contact.bio);
      bioKeywords.forEach(k => keywords.add(k));

      // Try to match bio keywords to skills
      for (const keyword of bioKeywords) {
        const skill = this.taxonomyService.findSkill(keyword);
        if (skill) {
          this.mergeTag(allSkills, { ...skill, confidence: 0.5 }, 0.5);
        }
      }
    }

    // 5. Calculate overall confidence
    const { overallConfidence, confidenceLevel } = this.calculateConfidence(
      contact,
      allSectors.size,
      allSkills.size,
      !!enrichment
    );

    return {
      contactId: contact.id,
      sectors: Array.from(allSectors.values()).sort((a, b) => b.confidence - a.confidence).slice(0, 5),
      skills: Array.from(allSkills.values()).sort((a, b) => b.confidence - a.confidence).slice(0, 10),
      interests: Array.from(allInterests.values()).sort((a, b) => b.confidence - a.confidence).slice(0, 5),
      keywords: Array.from(keywords).slice(0, 20),
      overallConfidence,
      confidenceLevel,
    };
  }

  /**
   * Extract tags from a batch of contacts
   */
  async extractTagsBatch(
    contacts: ContactForTagging[],
    enrichments?: Map<string, EnrichmentData>
  ): Promise<TagExtractionResult[]> {
    await this.initialize();

    const results: TagExtractionResult[] = [];

    for (const contact of contacts) {
      try {
        const enrichment = enrichments?.get(contact.id);
        const result = await this.extractTags(contact, enrichment);
        results.push(result);
      } catch (error) {
        logger.warn('Failed to extract tags for contact', {
          contactId: contact.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Return empty result for failed contacts
        results.push({
          contactId: contact.id,
          sectors: [],
          skills: [],
          interests: [],
          keywords: [],
          overallConfidence: 0.1,
          confidenceLevel: 'LOW',
        });
      }
    }

    return results;
  }

  /**
   * Save extracted tags to database
   */
  async saveTags(contactId: string, result: TagExtractionResult): Promise<void> {
    // Update or create ContactComputedProfile
    await prisma.contactComputedProfile.upsert({
      where: { contactId },
      create: {
        contactId,
        sectorsJson: result.sectors,
        skillsJson: result.skills,
        interestsJson: result.interests,
        keywordsJson: result.keywords,
        overallConfidence: result.overallConfidence,
        confidenceLevel: result.confidenceLevel,
        lastTaggedAt: new Date(),
      },
      update: {
        sectorsJson: result.sectors,
        skillsJson: result.skills,
        interestsJson: result.interests,
        keywordsJson: result.keywords,
        overallConfidence: result.overallConfidence,
        confidenceLevel: result.confidenceLevel,
        lastTaggedAt: new Date(),
      },
    });

    // Update Contact.dataConfidence
    await prisma.contact.update({
      where: { id: contactId },
      data: { dataConfidence: result.confidenceLevel },
    });

    // Create/update ContactSector associations
    for (const sector of result.sectors) {
      await prisma.contactSector.upsert({
        where: {
          contactId_sectorId: {
            contactId,
            sectorId: sector.id,
          },
        },
        create: {
          contactId,
          sectorId: sector.id,
          confidence: sector.confidence,
          source: 'ENRICHMENT',
        },
        update: {
          confidence: sector.confidence,
          source: 'ENRICHMENT',
        },
      });
    }

    // Create/update ContactSkill associations
    for (const skill of result.skills) {
      await prisma.contactSkill.upsert({
        where: {
          contactId_skillId: {
            contactId,
            skillId: skill.id,
          },
        },
        create: {
          contactId,
          skillId: skill.id,
          confidence: skill.confidence,
          source: 'ENRICHMENT',
        },
        update: {
          confidence: skill.confidence,
          source: 'ENRICHMENT',
        },
      });
    }

    // Create/update ContactInterest associations
    for (const interest of result.interests) {
      await prisma.contactInterest.upsert({
        where: {
          contactId_interestId: {
            contactId,
            interestId: interest.id,
          },
        },
        create: {
          contactId,
          interestId: interest.id,
        },
        update: {},
      });
    }
  }

  /**
   * Merge a tag into the map, keeping the highest confidence
   */
  private mergeTag(
    map: Map<string, { id: string; name: string; confidence: number }>,
    tag: { id: string; name: string; confidence: number },
    additionalConfidence: number
  ): void {
    const existing = map.get(tag.id);
    const newConfidence = Math.min(1, tag.confidence * additionalConfidence);

    if (!existing || existing.confidence < newConfidence) {
      map.set(tag.id, { ...tag, confidence: newConfidence });
    }
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful keywords
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
      'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how',
      'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'also', 'now', 'etc',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Get unique keywords
    return [...new Set(words)].slice(0, 30);
  }

  /**
   * Calculate overall confidence based on available data
   */
  private calculateConfidence(
    contact: ContactForTagging,
    sectorCount: number,
    skillCount: number,
    hasEnrichment: boolean
  ): { overallConfidence: number; confidenceLevel: DataConfidence } {
    let score = 0;

    // Base fields
    if (contact.email) score += 15;
    if (contact.jobTitle) score += 20;
    if (contact.company) score += 20;
    if (contact.bio && contact.bio.length > 50) score += 10;
    if (contact.location) score += 5;

    // Extracted data
    if (sectorCount > 0) score += 15;
    if (skillCount > 0) score += 15;

    // Enrichment boost
    if (hasEnrichment) score += 20;

    // Cap at 100
    const overallConfidence = Math.min(1, score / 100);

    // Determine level
    let confidenceLevel: DataConfidence;
    if (score >= 70) {
      confidenceLevel = 'HIGH';
    } else if (score >= 40) {
      confidenceLevel = 'MEDIUM';
    } else {
      confidenceLevel = 'LOW';
    }

    return { overallConfidence, confidenceLevel };
  }
}

// Export singleton instance
export const tagExtractionService = new TagExtractionService();
export default TagExtractionService;
