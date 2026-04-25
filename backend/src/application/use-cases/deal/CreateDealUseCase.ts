/**
 * Use Case: Create Deal
 * Creates a new deal request (Sell or Buy mode)
 */

import { IDealRequestRepository } from '../../../domain/repositories/IDealRepository';
import {
  DealMode,
  DealCompanySize,
  DealTargetEntityType,
  DealRequestEntity,
} from '../../../domain/entities/Deal';
import { ValidationError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';

export interface CreateDealInput {
  mode: DealMode;
  title?: string;
  domain?: string;
  solutionType?: string;
  companySize?: DealCompanySize;
  problemStatement?: string;
  targetEntityType?: DealTargetEntityType;
  productName?: string;
  targetDescription?: string;
}

export interface CreateDealOutput {
  id: string;
  mode: DealMode;
  title: string | null;
  status: string;
  createdAt: string;
}

export class CreateDealUseCase {
  constructor(private readonly dealRepository: IDealRequestRepository) {}

  async execute(userId: string, input: CreateDealInput): Promise<CreateDealOutput> {
    // Validate input based on mode
    this.validateInput(input);

    logger.info('Creating deal request', { userId, mode: input.mode });

    // Create deal
    const deal = await this.dealRepository.create({
      userId,
      mode: input.mode,
      title: input.title,
      domain: input.domain,
      solutionType: input.solutionType,
      companySize: input.companySize,
      problemStatement: input.problemStatement,
      targetEntityType: input.targetEntityType,
      productName: input.productName,
      targetDescription: input.targetDescription,
    });

    logger.info('Deal request created', { dealId: deal.id, mode: deal.mode });

    return {
      id: deal.id,
      mode: deal.mode,
      title: deal.title,
      status: deal.status,
      createdAt: deal.createdAt.toISOString(),
    };
  }

  private validateInput(input: CreateDealInput): void {
    if (!input.mode) {
      throw new ValidationError('Mode is required');
    }

    if (input.mode === DealMode.SELL) {
      // Sell mode requires product name or solution type
      if (!input.solutionType && !input.productName) {
        throw new ValidationError('Sell mode requires at least one of: productName or solutionType');
      }
    } else {
      // Buy mode should have solution/problem info
      if (!input.solutionType && !input.problemStatement) {
        throw new ValidationError('Buy mode requires at least one of: solutionType or problemStatement');
      }
    }
  }
}
