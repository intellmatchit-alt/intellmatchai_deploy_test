'use client';

import { create } from 'zustand';
import { getWallet } from '@/lib/api/wallet';

export interface WalletState {
  balance: number;
  isLoading: boolean;
  costs: { scan: number; import: number; collaboration: number };
}

export interface WalletActions {
  fetchBalance: () => Promise<void>;
  deductPoints: (amount: number) => void;
  setBalance: (balance: number) => void;
}

export type WalletStore = WalletState & WalletActions;

export const useWalletStore = create<WalletStore>((set) => ({
  balance: 0,
  isLoading: false,
  costs: { scan: 5, import: 2, collaboration: 0 },

  fetchBalance: async () => {
    set({ isLoading: true });
    try {
      const data = await getWallet();
      set({
        balance: data.balance,
        costs: data.costs,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  deductPoints: (amount: number) => {
    set((state) => ({ balance: Math.max(0, state.balance - amount) }));
  },

  setBalance: (balance: number) => {
    set({ balance });
  },
}));
