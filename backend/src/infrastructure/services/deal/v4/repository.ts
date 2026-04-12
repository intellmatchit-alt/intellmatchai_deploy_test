/**
 * Deal Matching Repository
 * v4.0.0 — strict final production
 *
 * Production repository contracts with ownership-aware lookups.
 * In-memory implementation is a DEVELOPMENT PLACEHOLDER ONLY.
 */

import { BuyRequest, SellOffering } from './types';

export interface BuyRequestRepository {
  create(data: BuyRequest): Promise<BuyRequest>;
  update(id: string, changes: Partial<BuyRequest>): Promise<BuyRequest | null>;
  getById(id: string): Promise<BuyRequest | null>;
  getByIdForOwner(id: string, ownerId: string, organizationId?: string): Promise<BuyRequest | null>;
  findAll(): Promise<BuyRequest[]>;
  findActive(limit?: number): Promise<BuyRequest[]>;
}

export interface SellOfferingRepository {
  create(data: SellOffering): Promise<SellOffering>;
  update(id: string, changes: Partial<SellOffering>): Promise<SellOffering | null>;
  getById(id: string): Promise<SellOffering | null>;
  getByIdForOwner(id: string, ownerId: string, organizationId?: string): Promise<SellOffering | null>;
  findAll(): Promise<SellOffering[]>;
  findActive(limit?: number): Promise<SellOffering[]>;
}

// ==========================================================================
// IN-MEMORY — DEVELOPMENT PLACEHOLDER ONLY (not for production)
// ==========================================================================

class InMemoryBuyRequestRepository implements BuyRequestRepository {
  private readonly store = new Map<string, BuyRequest>();
  async create(data: BuyRequest) { this.store.set(data.id, data); return data; }
  async update(id: string, changes: Partial<BuyRequest>) {
    const e = this.store.get(id); if (!e) return null;
    const u: BuyRequest = { ...e, ...changes, updatedAt: new Date() };
    this.store.set(id, u); return u;
  }
  async getById(id: string) { return this.store.get(id) || null; }
  async getByIdForOwner(id: string, ownerId: string, organizationId?: string) {
    const r = this.store.get(id); if (!r) return null;
    if (organizationId && r.organizationId === organizationId) return r;
    if (r.ownerId === ownerId) return r;
    return null;
  }
  async findAll() { return Array.from(this.store.values()); }
  async findActive(limit = 500) { return Array.from(this.store.values()).filter(r => r.isActive && !r.isDeleted).slice(0, limit); }
}

class InMemorySellOfferingRepository implements SellOfferingRepository {
  private readonly store = new Map<string, SellOffering>();
  async create(data: SellOffering) { this.store.set(data.id, data); return data; }
  async update(id: string, changes: Partial<SellOffering>) {
    const e = this.store.get(id); if (!e) return null;
    const u: SellOffering = { ...e, ...changes, updatedAt: new Date() };
    this.store.set(id, u); return u;
  }
  async getById(id: string) { return this.store.get(id) || null; }
  async getByIdForOwner(id: string, ownerId: string, organizationId?: string) {
    const r = this.store.get(id); if (!r) return null;
    if (organizationId && r.organizationId === organizationId) return r;
    if (r.ownerId === ownerId) return r;
    return null;
  }
  async findAll() { return Array.from(this.store.values()); }
  async findActive(limit = 500) { return Array.from(this.store.values()).filter(o => o.isActive && !o.isDeleted).slice(0, limit); }
}

export const defaultBuyRequestRepository: BuyRequestRepository = new InMemoryBuyRequestRepository();
export const defaultSellOfferingRepository: SellOfferingRepository = new InMemorySellOfferingRepository();
