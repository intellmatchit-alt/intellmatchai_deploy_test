'use client';

/**
 * useSubscription Hook
 *
 * Manages subscription state and provides helper functions.
 */

import { useState, useEffect, useCallback } from 'react';
import { paymentsApi, Subscription } from '@/lib/api/payments';

export interface UseSubscriptionReturn {
  subscription: Subscription | null;
  isLoading: boolean;
  error: Error | null;
  isPro: boolean;
  isTeam: boolean;
  isFree: boolean;
  isTrialing: boolean;
  isActive: boolean;
  trialDaysLeft: number;
  daysUntilExpiry: number | null;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await paymentsApi.getSubscription();
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch subscription'));
      // Set default free subscription on error
      setSubscription({
        plan: 'FREE',
        status: 'ACTIVE',
        billingInterval: null,
        seats: 1,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trialEndsAt: null,
        cancelAtPeriodEnd: false,
        payments: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Calculate derived values
  const isPro = subscription?.plan === 'PRO';
  const isTeam = subscription?.plan === 'TEAM';
  const isFree = subscription?.plan === 'FREE' || !subscription;
  const isTrialing = subscription?.status === 'TRIALING';
  const isActive = subscription?.status === 'ACTIVE' || subscription?.status === 'TRIALING';

  // Calculate trial days left
  const trialDaysLeft = subscription?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  // Calculate days until subscription expires
  const daysUntilExpiry = subscription?.currentPeriodEnd
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  return {
    subscription,
    isLoading,
    error,
    isPro,
    isTeam,
    isFree,
    isTrialing,
    isActive,
    trialDaysLeft,
    daysUntilExpiry,
    refetch: fetchSubscription,
  };
}
