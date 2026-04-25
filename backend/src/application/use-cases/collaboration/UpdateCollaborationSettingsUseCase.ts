/**
 * Use Case: Update Collaboration Settings
 * Updates user's collaboration preferences
 */

import { ICollaborationSettingsRepository } from '../../../domain/repositories/ICollaborationRepository';
import {
  CollaborationSourceType,
  PerTypeOverrides,
} from '../../../domain/entities/Collaboration';
import { ValidationError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';

export interface UpdateCollaborationSettingsInput {
  globalCollaborationEnabled?: boolean;
  allowedSourceTypes?: CollaborationSourceType[];
  blockedUserIds?: string[];
  allowedUserIds?: string[];
  perTypeOverrides?: PerTypeOverrides;
}

export interface UpdateCollaborationSettingsOutput {
  globalCollaborationEnabled: boolean;
  allowedSourceTypes: CollaborationSourceType[];
  blockedUserIds: string[];
  allowedUserIds: string[] | null;
  perTypeOverrides: PerTypeOverrides | null;
}

export class UpdateCollaborationSettingsUseCase {
  constructor(private readonly settingsRepository: ICollaborationSettingsRepository) {}

  async execute(
    userId: string,
    input: UpdateCollaborationSettingsInput
  ): Promise<UpdateCollaborationSettingsOutput> {
    this.validateInput(input);

    logger.info('Updating collaboration settings', { userId });

    const settings = await this.settingsRepository.upsert({
      userId,
      globalCollaborationEnabled: input.globalCollaborationEnabled,
      allowedSourceTypesJson: input.allowedSourceTypes,
      blockedUserIdsJson: input.blockedUserIds,
      allowedUserIdsJson: input.allowedUserIds,
      perTypeOverridesJson: input.perTypeOverrides,
    });

    logger.info('Collaboration settings updated', { userId });

    return {
      globalCollaborationEnabled: settings.globalCollaborationEnabled,
      allowedSourceTypes: settings.allowedSourceTypesJson,
      blockedUserIds: settings.blockedUserIdsJson,
      allowedUserIds: settings.allowedUserIdsJson,
      perTypeOverrides: settings.perTypeOverridesJson,
    };
  }

  private validateInput(input: UpdateCollaborationSettingsInput): void {
    if (input.allowedSourceTypes) {
      for (const type of input.allowedSourceTypes) {
        if (!Object.values(CollaborationSourceType).includes(type)) {
          throw new ValidationError(`Invalid source type: ${type}`);
        }
      }
    }

    if (input.blockedUserIds) {
      // Validate UUIDs format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const id of input.blockedUserIds) {
        if (!uuidRegex.test(id)) {
          throw new ValidationError(`Invalid user ID format: ${id}`);
        }
      }
    }

    if (input.allowedUserIds) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const id of input.allowedUserIds) {
        if (!uuidRegex.test(id)) {
          throw new ValidationError(`Invalid user ID format: ${id}`);
        }
      }
    }
  }
}
