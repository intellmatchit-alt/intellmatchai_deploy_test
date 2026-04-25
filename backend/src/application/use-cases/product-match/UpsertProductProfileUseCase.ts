/**
 * Use Case: Upsert Product Profile
 * Creates or updates a user's product profile for the Sell Smarter feature
 */

import { IProductProfileRepository } from '../../../domain/repositories/IProductMatchRepository';
import {
  ProductProfileEntity,
  ProductType,
  UpsertProductProfileInput,
} from '../../../domain/entities/ProductMatch';
import { ValidationError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';

export interface UpsertProductProfileInputDTO {
  productType: ProductType;
  productName?: string;
  targetIndustry: string;
  targetCompanySize: string;
  problemSolved: string;
  decisionMakerRole: string;
  additionalContext?: string;
}

export class UpsertProductProfileUseCase {
  constructor(
    private readonly profileRepository: IProductProfileRepository
  ) {}

  async execute(userId: string, input: UpsertProductProfileInputDTO): Promise<ProductProfileEntity> {
    // Validate required fields
    if (!input.productType) {
      throw new ValidationError('Product type is required');
    }

    if (!input.targetIndustry?.trim()) {
      throw new ValidationError('Target industry is required');
    }

    if (!input.targetCompanySize?.trim()) {
      throw new ValidationError('Target company size is required');
    }

    if (!input.problemSolved?.trim()) {
      throw new ValidationError('Problem solved is required');
    }

    if (!input.decisionMakerRole?.trim()) {
      throw new ValidationError('Decision maker role is required');
    }

    // Validate product type
    if (!Object.values(ProductType).includes(input.productType)) {
      throw new ValidationError('Invalid product type');
    }

    // Validate company size
    const validSizes = ['SMALL', 'MEDIUM', 'ENTERPRISE', 'ANY'];
    if (!validSizes.includes(input.targetCompanySize.toUpperCase())) {
      throw new ValidationError('Invalid target company size');
    }

    logger.info('Upserting product profile', { userId, productType: input.productType });

    const repositoryInput: UpsertProductProfileInput = {
      userId,
      productType: input.productType,
      productName: input.productName?.trim(),
      targetIndustry: input.targetIndustry.trim(),
      targetCompanySize: input.targetCompanySize.toUpperCase(),
      problemSolved: input.problemSolved.trim(),
      decisionMakerRole: input.decisionMakerRole.trim(),
      additionalContext: input.additionalContext?.trim(),
    };

    const profile = await this.profileRepository.upsert(repositoryInput);

    logger.info('Product profile upserted', { userId, profileId: profile.id });

    return profile;
  }
}
