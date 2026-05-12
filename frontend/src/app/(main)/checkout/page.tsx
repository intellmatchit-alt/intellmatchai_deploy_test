'use client';

/**
 * Checkout Page
 *
 * Allows users to select a plan (PRO or TEAM) and proceed to PayTabs payment.
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { paymentsApi } from '@/lib/api/payments';
import {
  Checkmark24Regular,
  ArrowLeft24Regular,
  Add24Regular,
  Subtract24Regular,
  People24Regular,
} from '@fluentui/react-icons';

// Pricing configuration (in USD)
const PRICING = {
  PRO: {
    MONTHLY: 28,
    YEARLY: 280,
  },
  TEAM: {
    MONTHLY: 45, // per user
    YEARLY: 450, // per user
    MIN_SEATS: 3,
  },
};

// Plan descriptions
const PLAN_INFO = {
  PRO: {
    name: 'Pro',
    tagline: 'Professional Relationship OS',
    description: 'The real IntellMatch — for founders, deal-makers, consultants, and connectors.',
  },
  TEAM: {
    name: 'Team',
    tagline: 'Shared Relationship Intelligence',
    description: 'Built for teams that rely on warm intros and shared context.',
  },
};

// Features by plan
const FEATURES = {
  PRO: [
    'Up to 5,000 contacts',
    'Unlimited card scans',
    'Unlimited imports',
    'Advanced auto-deduplication',
    'Unlimited projects, jobs, sell & buy',
    'Unlimited Explore',
    'Full IntellMatch AI model',
    'Saved filters & views',
    'Unlimited tasks & follow-ups',
    'Up to 20 events / month',
    'Up to 10 collaborations / month',
    'Priority email support',
  ],
  TEAM: [
    'Everything in Pro',
    'Shared team relationship graph',
    'Org-wide visibility (with privacy controls)',
    'Warm intro routing',
    'Unlimited shared workspaces',
    '30,000 org-wide contacts',
    'Unlimited events',
    'Admin console',
    'Roles & permissions',
    'Priority admin support',
    'Onboarding call or guided setup',
  ],
};

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [plan, setPlan] = useState<'PRO' | 'TEAM'>('PRO');
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');
  const [seats, setSeats] = useState(PRICING.TEAM.MIN_SEATS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get params from URL
  useEffect(() => {
    const urlPlan = searchParams.get('plan');
    const urlInterval = searchParams.get('interval');

    if (urlPlan === 'TEAM') setPlan('TEAM');
    if (urlPlan === 'PRO') setPlan('PRO');
    if (urlInterval === 'MONTHLY' || urlInterval === 'YEARLY') {
      setBillingInterval(urlInterval);
    }
  }, [searchParams]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      const currentUrl = `/checkout?plan=${plan}&interval=${billingInterval}`;
      router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
    }
  }, [authLoading, user, router, billingInterval, plan]);

  const calculateTotal = () => {
    if (plan === 'TEAM') {
      return PRICING.TEAM[billingInterval] * seats;
    }
    return PRICING.PRO[billingInterval];
  };

  const calculateSavings = () => {
    if (billingInterval === 'YEARLY') {
      if (plan === 'TEAM') {
        const monthlyTotal = PRICING.TEAM.MONTHLY * seats * 12;
        return monthlyTotal - calculateTotal();
      }
      const monthlyTotal = PRICING.PRO.MONTHLY * 12;
      return monthlyTotal - calculateTotal();
    }
    return 0;
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await paymentsApi.createCheckout({
        plan,
        billingInterval,
        ...(plan === 'TEAM' && { seats }),
      });

      // Redirect to PayTabs
      window.location.href = result.redirectUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to create checkout. Please try again.');
      setIsProcessing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const currentPlan = PLAN_INFO[plan];
  const currentFeatures = FEATURES[plan];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-th-text-t hover:text-th-text mb-8 transition-colors"
      >
        <ArrowLeft24Regular className="w-5 h-5" />
        Back to pricing
      </Link>

      <h1 className="text-3xl font-bold text-th-text mb-2">Complete your purchase</h1>
      <p className="text-th-text-t mb-8">
        Review your plan and proceed to secure payment
      </p>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - Options */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plan Selector */}
          <div className="bg-th-surface border border-th-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-th-text mb-4">Selected Plan</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['PRO', 'TEAM'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    plan === p
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-th-border hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-th-text">{PLAN_INFO[p].name}</span>
                    {p === 'TEAM' && (
                      <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/30">
                        Teams
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-emerald-400 font-medium">{PLAN_INFO[p].tagline}</div>
                  <div className="text-xs text-th-text-t mt-1">{PLAN_INFO[p].description}</div>
                  <div className="text-lg font-bold text-th-text mt-3">
                    ${p === 'TEAM' ? PRICING.TEAM[billingInterval] : PRICING.PRO[billingInterval]}
                    <span className="text-sm text-th-text-t font-normal">
                      /{billingInterval === 'MONTHLY' ? 'mo' : 'year'}
                      {p === 'TEAM' && '/seat'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Seat Selector (TEAM only) */}
          {plan === 'TEAM' && (
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <People24Regular className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-th-text">Team Size</h2>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSeats(Math.max(PRICING.TEAM.MIN_SEATS, seats - 1))}
                    disabled={seats <= PRICING.TEAM.MIN_SEATS}
                    className="w-10 h-10 rounded-xl bg-th-surface-h hover:bg-th-surface-h flex items-center justify-center text-th-text transition-colors disabled:opacity-30"
                  >
                    <Subtract24Regular className="w-5 h-5" />
                  </button>
                  <div className="text-center">
                    <span className="text-4xl font-bold text-th-text">{seats}</span>
                    <p className="text-xs text-th-text-t">seats</p>
                  </div>
                  <button
                    onClick={() => setSeats(seats + 1)}
                    className="w-10 h-10 rounded-xl bg-th-surface-h hover:bg-th-surface-h flex items-center justify-center text-th-text transition-colors"
                  >
                    <Add24Regular className="w-5 h-5" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-th-text">${calculateTotal()}</p>
                  <p className="text-sm text-th-text-t">
                    /{billingInterval === 'MONTHLY' ? 'month' : 'year'} total
                  </p>
                </div>
              </div>
              <p className="text-xs text-th-text-m mt-3">
                Minimum {PRICING.TEAM.MIN_SEATS} seats. You can add more seats later.
              </p>
            </div>
          )}

          {/* Billing interval */}
          <div className="bg-th-surface border border-th-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-th-text mb-4">Billing Cycle</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setBillingInterval('MONTHLY')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  billingInterval === 'MONTHLY'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-th-border hover:border-white/20'
                }`}
              >
                <div className="font-semibold text-th-text">Monthly</div>
                <div className="text-sm text-th-text-t">
                  Billed monthly
                </div>
              </button>
              <button
                onClick={() => setBillingInterval('YEARLY')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all relative ${
                  billingInterval === 'YEARLY'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-th-border hover:border-white/20'
                }`}
              >
                <span className="absolute -top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded-full">
                  2 months free
                </span>
                <div className="font-semibold text-th-text">Yearly</div>
                <div className="text-sm text-th-text-t">
                  Billed annually
                </div>
              </button>
            </div>
          </div>

          {/* Features included */}
          <div className="bg-th-surface border border-th-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-th-text mb-4">
              What&apos;s included in {currentPlan.name}
            </h2>
            <ul className="space-y-2">
              {currentFeatures.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 text-th-text-s text-sm"
                >
                  <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-th-text-m">
              Upgrade anytime. Cancel anytime.
            </p>
          </div>
        </div>

        {/* Right column - Order summary */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 border border-emerald-500/30 rounded-2xl p-6 sticky top-24">
            <h2 className="text-lg font-semibold text-th-text mb-4">
              Order Summary
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-th-text-s">
                <span>IntellMatch {currentPlan.name}</span>
                <span>
                  ${plan === 'TEAM' ? PRICING.TEAM[billingInterval] : PRICING.PRO[billingInterval]}
                  {plan === 'TEAM' && '/seat'}
                </span>
              </div>
              {plan === 'TEAM' && (
                <div className="flex justify-between text-th-text-s">
                  <span>Seats</span>
                  <span>{seats} seats</span>
                </div>
              )}
              <div className="flex justify-between text-th-text-s">
                <span>Billing</span>
                <span>{billingInterval === 'MONTHLY' ? 'Monthly' : 'Yearly'}</span>
              </div>
              {billingInterval === 'YEARLY' && calculateSavings() > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>You save</span>
                  <span>${calculateSavings()}/year</span>
                </div>
              )}
              <div className="border-t border-th-border pt-3 flex justify-between text-th-text font-semibold text-lg">
                <span>Total</span>
                <span>
                  ${calculateTotal()}
                  <span className="text-sm text-th-text-t font-normal">
                    /{billingInterval === 'MONTHLY' ? 'mo' : 'year'}
                  </span>
                </span>
              </div>
            </div>

            {/* Checkout button */}
            <button
              onClick={handleCheckout}
              disabled={isProcessing}
              className="w-full mt-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                `Start ${currentPlan.name} (7-day trial)`
              )}
            </button>

            <p className="text-center text-xs text-th-text-m mt-4">
              You won&apos;t be charged during your trial.
              <br />
              Upgrade anytime. Cancel anytime.
            </p>

            {/* Trust badges */}
            <div className="mt-6 pt-4 border-t border-th-border">
              <div className="flex items-center justify-center gap-4 text-th-text-m text-xs">
                <span>SSL Secure</span>
                <span>PCI Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
