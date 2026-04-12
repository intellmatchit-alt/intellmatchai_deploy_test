/**
 * Use Case: Update PNME Preferences
 * Updates the user's PNME matching preferences (weights, limits, etc.)
 */

import { IUserPNMEPreferencesRepository } from '../../../domain/repositories/IPitchRepository';
import { UpdatePNMEPreferencesRequestDTO, PNMEPreferencesResponseDTO } from '../../dto/pitch.dto';
import { DomainException } from '../../../shared/errors/index.js';

export class UpdatePNMEPreferencesUseCase {
  constructor(
    private readonly preferencesRepository: IUserPNMEPreferencesRepository,
  ) {}

  async execute(userId: string, input: UpdatePNMEPreferencesRequestDTO): Promise<PNMEPreferencesResponseDTO> {
    // Validate weights sum to ~1.0 if any are provided
    if (
      input.relevanceWeight !== undefined ||
      input.expertiseWeight !== undefined ||
      input.strategicWeight !== undefined ||
      input.relationshipWeight !== undefined
    ) {
      const existing = await this.preferencesRepository.findByUserId(userId);
      const weights = {
        relevance: input.relevanceWeight ?? existing?.relevanceWeight ?? 0.4,
        expertise: input.expertiseWeight ?? existing?.expertiseWeight ?? 0.3,
        strategic: input.strategicWeight ?? existing?.strategicWeight ?? 0.2,
        relationship: input.relationshipWeight ?? existing?.relationshipWeight ?? 0.1,
      };

      const total = weights.relevance + weights.expertise + weights.strategic + weights.relationship;
      if (Math.abs(total - 1.0) > 0.01) {
        throw new DomainException(`Weights must sum to 1.0 (currently ${total.toFixed(2)})`);
      }
    }

    // Upsert preferences (creates if doesn't exist)
    const prefs = await this.preferencesRepository.upsert({
      userId,
      ...input,
    });

    return {
      relevanceWeight: prefs.relevanceWeight,
      expertiseWeight: prefs.expertiseWeight,
      strategicWeight: prefs.strategicWeight,
      relationshipWeight: prefs.relationshipWeight,
      autoDeletePitchDays: prefs.autoDeletePitchDays,
      enableWhatsAppMetadata: prefs.enableWhatsAppMetadata,
      defaultLanguage: prefs.defaultLanguage,
      minMatchScore: prefs.minMatchScore,
      maxMatchesPerSection: prefs.maxMatchesPerSection,
      consentGiven: !!prefs.consentGivenAt,
    };
  }
}
