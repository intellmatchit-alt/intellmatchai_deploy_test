import { api } from './client';

export interface WalletData {
  balance: number;
  recentTransactions: WalletTransaction[];
  costs: { scan: number; import: number; collaboration: number };
}

export interface WalletTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balance: number;
  description: string;
  referenceId?: string;
  referenceType?: string;
  createdAt: string;
}

export interface TransactionListResponse {
  transactions: WalletTransaction[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PointPack {
  id: string;
  name: string;
  nameAr?: string;
  points: number;
  price: string;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

export function getWallet() {
  return api.get<WalletData>('/wallet');
}

export function getTransactions(page = 1, limit = 20) {
  return api.get<TransactionListResponse>(`/wallet/transactions?page=${page}&limit=${limit}`);
}

export function purchasePointPack(packId: string) {
  return api.post<{ redirectUrl?: string; cartId?: string; balance?: number; pointsAdded?: number }>('/wallet/purchase', { packId });
}

export function getPointPacks() {
  return api.get<PointPack[]>('/wallet/point-packs');
}
