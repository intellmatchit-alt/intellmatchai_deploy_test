/**
 * Use Case: Get PNME Preferences
 * Returns the user's PNME matching preferences (weights, limits, etc.)
 */

import { IUserPNMEPreferencesRepository } from '../../../domain/repositories/IPitchRepository';
import { PNMEPreferencesResponseDTO } from '../../dto/pitch.dto';

export class GetPNMEPreferencesUseCase {
  constructor(
    private readonly preferencesRepository: IUserPNMEPreferencesRepository,
  ) {}

  async execute(userId: string): Promise<PNMEPreferencesResponseDTO> {
    let prefs = await this.preferencesRepository.findByUserId(userId);

    // If no preferences exist, create defaults
    if (!prefs) {
      prefs = await this.preferencesRepository.upsert({ userId });
    }

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
