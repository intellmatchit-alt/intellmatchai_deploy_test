/**
 * Organization Store
 *
 * Zustand store for organization/team state management.
 */

'use client';

import { create } from 'zustand';
import {
  Organization,
  OrgMember,
  OrgInvitation,
  organizationApi,
} from '@/lib/api/organization';

const ACTIVE_ORG_KEY = 'p2p_active_org';

export interface OrganizationState {
  organization: Organization | null;
  members: OrgMember[];
  pendingInvitations: OrgInvitation[];
  activeOrgId: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface OrganizationActions {
  fetchOrganization: () => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchPendingInvitations: () => Promise<void>;
  setOrganization: (org: Organization | null) => void;
  setActiveOrg: (orgId: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

export type OrganizationStore = OrganizationState & OrganizationActions;

export const useOrganizationStore = create<OrganizationStore>((set, get) => ({
  organization: null,
  members: [],
  pendingInvitations: [],
  activeOrgId: typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_ORG_KEY) : null,
  isLoading: false,
  error: null,

  fetchOrganization: async () => {
    set({ isLoading: true, error: null });
    try {
      const org = await organizationApi.getMyOrganization();
      // If user has no organization, clear any stale activeOrgId
      if (!org) {
        const currentActiveOrg = get().activeOrgId;
        if (currentActiveOrg) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(ACTIVE_ORG_KEY);
          }
          set({ organization: null, activeOrgId: null, isLoading: false });
          return;
        }
      }
      set({ organization: org, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch organization', isLoading: false });
    }
  },

  fetchMembers: async () => {
    const org = get().organization;
    if (!org) return;
    try {
      const members = await organizationApi.getMembers(org.id);
      set({ members });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch members' });
    }
  },

  fetchPendingInvitations: async () => {
    try {
      const invitations = await organizationApi.getPendingInvitations();
      set({ pendingInvitations: invitations });
    } catch {
      // Silently fail
    }
  },

  setOrganization: (org) => set({ organization: org }),

  setActiveOrg: (orgId: string | null) => {
    if (typeof window !== 'undefined') {
      if (orgId) {
        localStorage.setItem(ACTIVE_ORG_KEY, orgId);
      } else {
        localStorage.removeItem(ACTIVE_ORG_KEY);
      }
    }
    set({ activeOrgId: orgId });
  },

  clearError: () => set({ error: null }),

  reset: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACTIVE_ORG_KEY);
    }
    set({
      organization: null,
      members: [],
      pendingInvitations: [],
      activeOrgId: null,
      isLoading: false,
      error: null,
    });
  },
}));
