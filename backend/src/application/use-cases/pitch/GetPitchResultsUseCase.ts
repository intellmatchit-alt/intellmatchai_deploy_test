/**
 * Use Case: Get Pitch Results
 * Returns full pitch analysis results with sections, matches, and needs
 */

import {
  IPitchRepository,
  IPitchSectionRepository,
  IPitchNeedRepository,
  IPitchMatchRepository,
} from '../../../domain/repositories/IPitchRepository';
import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { PitchStatus, MatchAngleCategory } from '../../../domain/entities/Pitch';
import {
  PitchResultsResponseDTO,
  PitchSectionWithMatchesDTO,
  PitchMatchDTO,
  PitchNeedDTO,
  GetPitchResultsQueryDTO,
  ContactSummaryDTO,
  MatchBreakdownDTO,
} from '../../dto/pitch.dto';
import { NotFoundError, AuthorizationError, DomainException, ConflictError } from '../../../shared/errors/index';

export class GetPitchResultsUseCase {
  constructor(
    private readonly pitchRepository: IPitchRepository,
    private readonly sectionRepository: IPitchSectionRepository,
    private readonly needRepository: IPitchNeedRepository,
    private readonly matchRepository: IPitchMatchRepository,
    private readonly contactRepository: IContactRepository,
  ) {}

  async execute(userId: string, pitchId: string, query: GetPitchResultsQueryDTO): Promise<PitchResultsResponseDTO> {
    const { sectionType, minScore = 0, limit = 10 } = query;

    // Fetch pitch
    const pitch = await this.pitchRepository.findById(pitchId);

    if (!pitch) {
      throw new NotFoundError('Pitch');
    }

    if (pitch.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    if (pitch.deletedAt) {
      throw new DomainException('Pitch has been deleted');
    }

    // Check if processing is complete
    if (pitch.status !== PitchStatus.COMPLETED) {
      throw new ConflictError(
        `Pitch is still processing. Current status: ${pitch.status}`,
      );
    }

    // Fetch sections
    let sections = await this.sectionRepository.findByPitchId(pitchId);

    // Filter by section type if specified
    if (sectionType) {
      sections = sections.filter((s) => s.type === sectionType);
    }

    // Sort by order
    sections.sort((a, b) => a.order - b.order);

    // Fetch needs
    const needs = await this.needRepository.findByPitchId(pitchId);

    // Build sections with matches
    const sectionsWithMatches: PitchSectionWithMatchesDTO[] = [];
    let totalMatches = 0;
    let totalScore = 0;
    const angleCounts: Map<MatchAngleCategory, number> = new Map();

    for (const section of sections) {
      // Fetch matches for this section
      const matches = await this.matchRepository.findByPitchSectionId(section.id, {
        minScore,
        limit,
      });

      // Get contact details for each match
      const matchDTOs: PitchMatchDTO[] = [];

      for (const match of matches) {
        const contact = await this.contactRepository.findById(match.contactId);
        if (!contact) continue;

        const contactSummary: ContactSummaryDTO = {
          id: contact.id,
          fullName: contact.name,
          company: contact.company,
          jobTitle: contact.jobTitle,
          avatarUrl: contact.avatarUrl,
          matchScore: contact.matchScore ? Number(contact.matchScore) : null,
          email: contact.email,
          phone: contact.phone,
          linkedinUrl: contact.linkedInUrl,
        };

        const breakdown: MatchBreakdownDTO = {
          relevance: {
            score: (match.breakdownJson as any)?.relevance?.score || match.relevanceScore,
            weight: (match.breakdownJson as any)?.relevance?.weight || 0.40,
            weighted: (match.breakdownJson as any)?.relevance?.weighted || match.relevanceScore * 0.40,
          },
          expertise: {
            score: (match.breakdownJson as any)?.expertise?.score || match.expertiseScore,
            weight: (match.breakdownJson as any)?.expertise?.weight || 0.30,
            weighted: (match.breakdownJson as any)?.expertise?.weighted || match.expertiseScore * 0.30,
          },
          strategic: {
            score: (match.breakdownJson as any)?.strategic?.score || match.strategicScore,
            weight: (match.breakdownJson as any)?.strategic?.weight || 0.20,
            weighted: (match.breakdownJson as any)?.strategic?.weighted || match.strategicScore * 0.20,
          },
          relationship: {
            score: (match.breakdownJson as any)?.relationship?.score || match.relationshipScore,
            weight: (match.breakdownJson as any)?.relationship?.weight || 0.10,
            weighted: (match.breakdownJson as any)?.relationship?.weighted || match.relationshipScore * 0.10,
          },
        };

        const reasons = Array.isArray(match.reasonsJson)
          ? match.reasonsJson.map((r: any) => ({
              type: r.type || 'UNKNOWN',
              text: r.text || '',
              evidence: r.evidence || '',
            }))
          : [];

        matchDTOs.push({
          id: match.id,
          contact: contactSummary,
          score: match.score,
          breakdown,
          reasons,
          angleCategory: match.angleCategory,
          outreachDraft: match.outreachDraft,
          status: match.status,
        });

        // Track for summary
        totalMatches++;
        totalScore += match.score;
        if (match.angleCategory) {
          angleCounts.set(match.angleCategory, (angleCounts.get(match.angleCategory) || 0) + 1);
        }
      }

      sectionsWithMatches.push({
        id: section.id,
        type: section.type,
        order: section.order,
        title: section.title,
        content: section.content,
        confidence: section.confidence,
        matches: matchDTOs,
      });
    }

    // Find top angle
    let topAngle: MatchAngleCategory | null = null;
    let maxAngleCount = 0;
    for (const [angle, count] of angleCounts) {
      if (count > maxAngleCount) {
        maxAngleCount = count;
        topAngle = angle;
      }
    }

    // Build needs response
    const needsDTOs: PitchNeedDTO[] = needs.map((need) => ({
      key: need.key,
      label: need.label,
      description: need.description,
      confidence: need.confidence,
      amount: need.amount,
      timeline: need.timeline,
    }));

    return {
      pitch: {
        id: pitch.id,
        status: pitch.status,
        fileName: pitch.fileName,
        fileType: pitch.fileType,
        title: pitch.title,
        companyName: pitch.companyName,
        language: pitch.language,
        uploadedAt: pitch.uploadedAt.toISOString(),
        processedAt: pitch.processedAt?.toISOString() || null,
        sectionsCount: sections.length,
        needsCount: needs.length,
      },
      sections: sectionsWithMatches,
      needs: needsDTOs,
      summary: {
        totalMatches,
        avgScore: totalMatches > 0 ? Math.round(totalScore / totalMatches) : 0,
        topAngle,
      },
    };
  }
}
