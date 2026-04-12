/**
 * Product Match Repository Interfaces
 * Defines data access contracts for product match operations (Sell Smarter feature)
 */

import {
  ProductProfileEntity,
  ProductMatchRunEntity,
  ProductMatchResultEntity,
  ProductMatchRunStatus,
  ProductMatchBadge,
  UpsertProductProfileInput,
  CreateProductMatchRunInput,
  UpdateProductMatchRunInput,
  CreateProductMatchResultInput,
  UpdateProductMatchResultInput,
  ContactForMatching,
} from '../entities/ProductMatch';

// ============================================================================
// Product Profile Repository
// ============================================================================

export interface IProductProfileRepository {
  // CRUD
  upsert(input: UpsertProductProfileInput): Promise<ProductProfileEntity>;
  findByUserId(userId: string): Promise<ProductProfileEntity | null>;
  findById(id: string): Promise<ProductProfileEntity | null>;
  delete(id: string): Promise<void>;
}

// ============================================================================
// Product Match Run Repository
// ============================================================================

export interface ProductMatchRunListOptions {
  userId: string;
  status?: ProductMatchRunStatus;
  page?: number;
  limit?: number;
}

export interface IProductMatchRunRepository {
  // CRUD
  create(input: CreateProductMatchRunInput): Promise<ProductMatchRunEntity>;
  findById(id: string): Promise<ProductMatchRunEntity | null>;
  findByUserId(options: ProductMatchRunListOptions): Promise<{ runs: ProductMatchRunEntity[]; total: number }>;
  update(id: string, input: UpdateProductMatchRunInput): Promise<ProductMatchRunEntity>;
  delete(id: string): Promise<void>;

  // Queries
  findLatestByUserId(userId: string): Promise<ProductMatchRunEntity | null>;
  countByUserId(userId: string): Promise<number>;
}

// ============================================================================
// Product Match Result Repository
// ============================================================================

export interface ProductMatchResultListOptions {
  matchRunId: string;
  minScore?: number;
  badge?: ProductMatchBadge;
  excludeDismissed?: boolean;
  limit?: number;
  offset?: number;
}

export interface ProductMatchResultStats {
  totalMatches: number;
  avgScore: number;
  suitableCount: number;
  influencerCount: number;
  notSuitableCount: number;
}

export interface IProductMatchResultRepository {
  // CRUD
  create(input: CreateProductMatchResultInput): Promise<ProductMatchResultEntity>;
  createMany(inputs: CreateProductMatchResultInput[]): Promise<ProductMatchResultEntity[]>;
  findById(id: string): Promise<ProductMatchResultEntity | null>;
  findByMatchRunId(options: ProductMatchResultListOptions): Promise<ProductMatchResultEntity[]>;
  findByContactIdAndRunId(contactId: string, runId: string): Promise<ProductMatchResultEntity | null>;
  update(id: string, input: UpdateProductMatchResultInput): Promise<ProductMatchResultEntity>;

  // Batch operations
  deleteByMatchRunId(matchRunId: string): Promise<void>;

  // Stats
  countByMatchRunId(matchRunId: string): Promise<number>;
  getStatsByMatchRunId(matchRunId: string): Promise<ProductMatchResultStats>;
}

// ============================================================================
// Contact Repository Extension (for fetching contacts for matching)
// ============================================================================

export interface IContactMatchingRepository {
  // Fetch contacts with data needed for product matching
  findContactsForMatching(userId: string): Promise<ContactForMatching[]>;
  countContactsForMatching(userId: string): Promise<number>;
}
