/**
 * Use Case: Get Collaboration Settings
 * Gets user's collaboration preferences
 */

import { ICollaborationSettingsRepository } from '../../../domain/repositories/ICollaborationRepository';
import {
  CollaborationSourceType,
  PerTypeOverrides,
  DEFAULT_ALLOWED_SOURCE_TYPES,
} from '../../../domain/entities/Collaboration';

export interface GetCollaborationSettingsOutput {
  globalCollaborationEnabled: boolean;
  allowedSourceTypes: CollaborationSourceType[];
  blockedUserIds: string[];
  allowedUserIds: string[] | null;
  perTypeOverrides: PerTypeOverrides | null;
}

export class GetCollaborationSettingsUseCase {
  constructor(private readonly settingsRepository: ICollaborationSettingsRepository) {}

  async execute(userId: string): Promise<GetCollaborationSettingsOutput> {
    const settings = await this.settingsRepository.findByUserId(userId);

    // Return defaults if no settings exist
    if (!settings) {
      return {
        globalCollaborationEnabled: true,
        allowedSourceTypes: [...DEFAULT_ALLOWED_SOURCE_TYPES],
        blockedUserIds: [],
        allowedUserIds: null,
        perTypeOverrides: null,
      };
    }

    return {
      globalCollaborationEnabled: settings.globalCollaborationEnabled,
      allowedSourceTypes: settings.allowedSourceTypesJson,
      blockedUserIds: settings.blockedUserIdsJson,
      allowedUserIds: settings.allowedUserIdsJson,
      perTypeOverrides: settings.perTypeOverridesJson,
    };
  }
}
