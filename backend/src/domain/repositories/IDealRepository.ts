/**
 * Deal Repository Interfaces
 * Defines data access contracts for deal matching operations
 */

import {
  DealRequestEntity,
  DealMatchResultEntity,
  DealJobEntity,
  DealMode,
  DealStatus,
  DealMatchStatus,
  DealJobStep,
  DealJobStatus,
  CreateDealRequestInput,
  UpdateDealRequestInput,
  CreateDealMatchResultInput,
  UpdateDealMatchResultInput,
  CreateDealJobInput,
  UpdateDealJobInput,
} from '../entities/Deal';

// ============================================================================
// Deal Request Repository
// ============================================================================

export interface DealRequestListOptions {
  userId: string;
  mode?: DealMode;
  status?: DealStatus;
  page?: number;
  limit?: number;
}

export interface IDealRequestRepository {
  // CRUD
  create(input: CreateDealRequestInput): Promise<DealRequestEntity>;
  findById(id: string): Promise<DealRequestEntity | null>;
  findByUserId(options: DealRequestListOptions): Promise<{ deals: DealRequestEntity[]; total: number }>;
  update(id: string, input: UpdateDealRequestInput): Promise<DealRequestEntity>;
  delete(id: string): Promise<void>;

  // Queries
  countByUserId(userId: string): Promise<number>;
}

// ============================================================================
// Deal Match Result Repository
// ============================================================================

export interface DealMatchResultListOptions {
  dealRequestId?: string;
  contactId?: string;
  minScore?: number;
  status?: DealMatchStatus;
  limit?: number;
  offset?: number;
}

export interface IDealMatchResultRepository {
  // CRUD
  create(input: CreateDealMatchResultInput): Promise<DealMatchResultEntity>;
  createMany(inputs: CreateDealMatchResultInput[]): Promise<DealMatchResultEntity[]>;
  findById(id: string): Promise<DealMatchResultEntity | null>;
  findByDealRequestId(dealRequestId: string, options?: DealMatchResultListOptions): Promise<DealMatchResultEntity[]>;
  update(id: string, input: UpdateDealMatchResultInput): Promise<DealMatchResultEntity>;

  // Batch operations
  deleteByDealRequestId(dealRequestId: string): Promise<void>;

  // Stats
  countByDealRequestId(dealRequestId: string): Promise<number>;
  getAverageScoreByDealRequestId(dealRequestId: string): Promise<number>;
}

// ============================================================================
// Deal Job Repository
// ============================================================================

export interface IDealJobRepository {
  create(input: CreateDealJobInput): Promise<DealJobEntity>;
  createMany(inputs: CreateDealJobInput[]): Promise<DealJobEntity[]>;
  findByDealRequestId(dealRequestId: string): Promise<DealJobEntity[]>;
  findByDealRequestIdAndStep(dealRequestId: string, step: DealJobStep): Promise<DealJobEntity | null>;
  update(id: string, input: UpdateDealJobInput): Promise<DealJobEntity>;
  updateByDealRequestIdAndStep(dealRequestId: string, step: DealJobStep, input: UpdateDealJobInput): Promise<DealJobEntity>;
  incrementAttempts(id: string): Promise<DealJobEntity>;
}
