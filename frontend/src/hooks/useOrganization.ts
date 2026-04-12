/**
 * Organization Hook
 *
 * Convenience hook for accessing organization state and actions.
 */

'use client';

import { useEffect } from 'react';
import { useOrganizationStore } from '@/stores/organizationStore';
import { useAuth } from '@/hooks/useAuth';

export function useOrganization() {
  const { isAuthenticated } = useAuth();
  const store = useOrganizationStore();

  useEffect(() => {
    if (isAuthenticated && !store.organization && !store.isLoading) {
      store.fetchOrganization();
    }
  }, [isAuthenticated]);

  const isTeamPlan = store.organization !== null;
  const myRole = store.organization?.myRole || null;
  const isOwner = myRole === 'OWNER';
  const isAdmin = myRole === 'ADMIN' || myRole === 'OWNER';

  return {
    organization: store.organization,
    members: store.members,
    pendingInvitations: store.pendingInvitations,
    isLoading: store.isLoading,
    error: store.error,
    isTeamPlan,
    myRole,
    isOwner,
    isAdmin,
    fetchOrganization: store.fetchOrganization,
    fetchMembers: store.fetchMembers,
    fetchPendingInvitations: store.fetchPendingInvitations,
    setOrganization: store.setOrganization,
    clearError: store.clearError,
    reset: store.reset,
  };
}
