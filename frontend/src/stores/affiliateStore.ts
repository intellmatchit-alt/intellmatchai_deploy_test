import { create } from 'zustand';
import { getMyAffiliate } from '@/lib/api/affiliate';

interface AffiliateState {
  isAffiliate: boolean;
  affiliate: any | null;
  isLoading: boolean;
  checked: boolean;
}

interface AffiliateActions {
  checkIsAffiliate: () => Promise<void>;
  setAffiliate: (affiliate: any) => void;
  reset: () => void;
}

export const useAffiliateStore = create<AffiliateState & AffiliateActions>((set) => ({
  isAffiliate: false,
  affiliate: null,
  isLoading: false,
  checked: false,

  checkIsAffiliate: async () => {
    try {
      set({ isLoading: true });
      const affiliate = await getMyAffiliate();
      set({
        affiliate,
        isAffiliate: affiliate?.status === 'APPROVED',
        isLoading: false,
        checked: true,
      });
    } catch {
      set({ isAffiliate: false, affiliate: null, isLoading: false, checked: true });
    }
  },

  setAffiliate: (affiliate) => set({
    affiliate,
    isAffiliate: affiliate?.status === 'APPROVED',
  }),

  reset: () => set({ isAffiliate: false, affiliate: null, isLoading: false, checked: false }),
}));
