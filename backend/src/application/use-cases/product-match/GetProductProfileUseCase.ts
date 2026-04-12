/**
 * Use Case: Get Product Profile
 * Retrieves a user's product profile for the Sell Smarter feature
 */

import { IProductProfileRepository } from '../../../domain/repositories/IProductMatchRepository';
import { ProductProfileEntity } from '../../../domain/entities/ProductMatch';

export class GetProductProfileUseCase {
  constructor(
    private readonly profileRepository: IProductProfileRepository
  ) {}

  async execute(userId: string): Promise<ProductProfileEntity | null> {
    return this.profileRepository.findByUserId(userId);
  }
}
