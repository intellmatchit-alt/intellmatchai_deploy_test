/**
 * Use Case: Update Product Match Result
 * Updates result status (save, dismiss, contacted) or edited opener message
 */

import {
  IProductMatchRunRepository,
  IProductMatchResultRepository,
} from '../../../domain/repositories/IProductMatchRepository';
import { ProductMatchResultEntity, UpdateProductMatchResultInput } from '../../../domain/entities/ProductMatch';
import { NotFoundError, AuthorizationError, ValidationError } from '../../../shared/errors/index.js';
import { logger } from '../../../shared/logger';

export interface UpdateResultInput {
  isSaved?: boolean;
  isDismissed?: boolean;
  isContacted?: boolean;
  openerEdited?: string;
}

export class UpdateProductMatchResultUseCase {
  constructor(
    private readonly runRepository: IProductMatchRunRepository,
    private readonly resultRepository: IProductMatchResultRepository
  ) {}

  async execute(userId: string, resultId: string, input: UpdateResultInput): Promise<ProductMatchResultEntity> {
    // Find the result
    const result = await this.resultRepository.findById(resultId);

    if (!result) {
      throw new NotFoundError('Match result not found');
    }

    // Verify the run belongs to the user
    const run = await this.runRepository.findById(result.matchRunId);

    if (!run) {
      throw new NotFoundError('Match run not found');
    }

    if (run.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    // Validate input
    if (Object.keys(input).length === 0) {
      throw new ValidationError('No updates provided');
    }

    // Build update
    const updateInput: UpdateProductMatchResultInput = {};

    if (input.isSaved !== undefined) {
      updateInput.isSaved = input.isSaved;
      // If saving, ensure not dismissed
      if (input.isSaved) {
        updateInput.isDismissed = false;
      }
    }

    if (input.isDismissed !== undefined) {
      updateInput.isDismissed = input.isDismissed;
      // If dismissing, ensure not saved
      if (input.isDismissed) {
        updateInput.isSaved = false;
      }
    }

    if (input.isContacted !== undefined) {
      updateInput.isContacted = input.isContacted;
    }

    if (input.openerEdited !== undefined) {
      updateInput.openerEdited = input.openerEdited.trim() || null;
    }

    logger.info('Updating product match result', {
      resultId,
      userId,
      updates: Object.keys(updateInput),
    });

    return this.resultRepository.update(resultId, updateInput);
  }
}
