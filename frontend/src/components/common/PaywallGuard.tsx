'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSubscription, type Subscription } from '@/lib/api/payments';
import { useAuthStore } from '@/stores/authStore';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';

interface PlanConfig {
  isFree: boolean;
  hasFreeTrial: boolean;
  freeTrialDays: number;
  paymentRequired: boolean;
  isUpgradable: boolean;
}

interface SubWithConfig extends Subscription {
  planConfig?: PlanConfig | null;
}

export function PaywallGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [checked, setChecked] = useState(false);
  const [locked, setLocked] = useState(false);
  const [trialExpired, setTrialExpired] = useState(false);
  const [sub, setSub] = useState<SubWithConfig | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setChecked(true); return; }

    getSubscription()
      .then((data: any) => {
        setSub(data);
        const config = data.planConfig as PlanConfig | null;

        // If plan config says payment is required
        if (config?.paymentRequired) {
          const isTrialing = data.status === 'TRIALING';
          const hasExpired = data.status === 'EXPIRED';
          const isPaidActive = data.status === 'ACTIVE' && data.plan !== 'FREE';

          // If trial expired or subscription expired → lock out
          if (hasExpired) {
            setLocked(true);
            setTrialExpired(true);
          }
          // If on FREE plan with a paymentRequired config (shouldn't happen normally, but edge case)
          else if (data.plan === 'FREE' && !isTrialing) {
            // Don't lock - they're on the free tier
          }
          // Actively trialing is OK
          else if (isTrialing) {
            // Trial still active, allow access
          }
          // Paid and active - OK
          else if (isPaidActive) {
            // All good
          }
        }

        setChecked(true);
      })
      .catch(() => {
        setChecked(true);
      });
  }, [isAuthenticated]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (locked) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full bg-th-surface border border-th-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-th-text mb-2">
            {trialExpired ? 'Your Trial Has Ended' : 'Subscription Required'}
          </h2>
          <p className="text-th-text-s text-sm mb-6">
            {trialExpired
              ? 'Your free trial has expired. Please subscribe to continue using IntellMatch.'
              : 'A paid subscription is required to access this feature. Please upgrade your plan.'}
          </p>

          {sub && (
            <div className="bg-th-bg rounded-lg p-3 mb-6 text-sm">
              <div className="flex justify-between text-th-text-s">
                <span>Current Plan</span>
                <span className="font-medium text-th-text">{sub.plan}</span>
              </div>
              <div className="flex justify-between text-th-text-s mt-1">
                <span>Status</span>
                <span className={`font-medium ${sub.status === 'EXPIRED' ? 'text-red-400' : 'text-th-text'}`}>{sub.status}</span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Link href="/checkout" className="block w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-colors text-center">
              Upgrade Now
            </Link>
            <button
              onClick={() => { logout(); router.push('/login'); }}
              className="block w-full py-3 border border-th-border text-th-text-s hover:text-th-text rounded-lg font-medium transition-colors text-center"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
