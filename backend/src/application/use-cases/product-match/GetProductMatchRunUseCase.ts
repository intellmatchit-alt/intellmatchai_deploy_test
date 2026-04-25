/**
 * Use Case: Get Product Match Run
 * Retrieves a match run status and progress
 */

import { IProductMatchRunRepository } from '../../../domain/repositories/IProductMatchRepository';
import { ProductMatchRunEntity } from '../../../domain/entities/ProductMatch';
import { NotFoundError, AuthorizationError } from '../../../shared/errors/index';

export class GetProductMatchRunUseCase {
  constructor(
    private readonly runRepository: IProductMatchRunRepository
  ) {}

  async execute(userId: string, runId: string): Promise<ProductMatchRunEntity> {
    const run = await this.runRepository.findById(runId);

    if (!run) {
      throw new NotFoundError('Match run not found');
    }

    if (run.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    return run;
  }

  /**
   * Get the latest run for a user
   */
  async getLatest(userId: string): Promise<ProductMatchRunEntity | null> {
    return this.runRepository.findLatestByUserId(userId);
  }
}
