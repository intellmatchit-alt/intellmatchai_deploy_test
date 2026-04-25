/**
 * Use Case: Regenerate Outreach Message
 * Regenerates an outreach message for a specific pitch match using the OutreachGeneratorService.
 */

import {
  IPitchRepository,
  IPitchSectionRepository,
  IPitchMatchRepository,
  IContactProfileCacheRepository,
} from '../../../domain/repositories/IPitchRepository';
import { IOutreachGeneratorService } from '../../interfaces/IPitchAIService';
import { RegenerateOutreachRequestDTO, OutreachRegenerateResponseDTO } from '../../dto/pitch.dto';
import { NotFoundError, AuthorizationError } from '../../../shared/errors/index';
import { PitchMatchStatus } from '../../../domain/entities/Pitch';

export class RegenerateOutreachUseCase {
  constructor(
    private readonly pitchRepository: IPitchRepository,
    private readonly sectionRepository: IPitchSectionRepository,
    private readonly matchRepository: IPitchMatchRepository,
    private readonly profileCacheRepository: IContactProfileCacheRepository,
    private readonly outreachGeneratorService: IOutreachGeneratorService,
  ) {}

  async execute(
    userId: string,
    pitchId: string,
    sectionId: string,
    contactId: string,
    input: RegenerateOutreachRequestDTO,
  ): Promise<OutreachRegenerateResponseDTO> {
    // Verify pitch ownership
    const pitch = await this.pitchRepository.findById(pitchId);
    if (!pitch) {
      throw new NotFoundError('Pitch');
    }
    if (pitch.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    // Get section
    const section = await this.sectionRepository.findById(sectionId);
    if (!section || section.pitchId !== pitchId) {
      throw new NotFoundError('Pitch section');
    }

    // Find the match for this section + contact
    const matches = await this.matchRepository.findByPitchSectionId(sectionId, {
      pitchSectionId: sectionId,
    });
    const match = matches.find((m) => m.contactId === contactId);
    if (!match) {
      throw new NotFoundError('Pitch match');
    }

    // Get contact profile cache
    const profileCache = await this.profileCacheRepository.findByContactId(contactId);
    if (!profileCache) {
      throw new NotFoundError('Contact profile cache');
    }

    const contactProfile = {
      contactId: profileCache.contactId,
      userId: profileCache.userId,
      fullName: '', // Will be filled from profile summary
      company: null,
      jobTitle: null,
      profileSummary: profileCache.profileSummary,
      sectors: Array.isArray(profileCache.sectors) ? profileCache.sectors as string[] : [],
      skills: Array.isArray(profileCache.skills) ? profileCache.skills as string[] : [],
      interests: Array.isArray(profileCache.interests) ? profileCache.interests as string[] : [],
      relationshipStrength: profileCache.relationshipStrength,
      lastInteractionDays: profileCache.lastInteractionDays,
      interactionCount: profileCache.interactionCount,
    };

    const reasons = Array.isArray(match.reasonsJson)
      ? match.reasonsJson.map((r: any) => ({
          type: r.type || 'UNKNOWN',
          text: r.text || '',
          evidence: r.evidence || '',
        }))
      : [];

    // Generate new outreach message
    const outreachDraft = await this.outreachGeneratorService.generateOutreachMessage(
      section.content,
      contactProfile,
      reasons,
      input.tone || 'professional',
      pitch.language || 'en',
    );

    // Update the match with the new outreach draft
    await this.matchRepository.update(match.id, {
      outreachDraft,
    });

    return { outreachDraft };
  }
}
