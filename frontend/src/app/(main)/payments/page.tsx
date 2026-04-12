'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { paymentsApi, type Subscription, type Payment } from '@/lib/api/payments';
import { getTransactions, type WalletTransaction } from '@/lib/api/wallet';
import {
  Wallet24Regular,
  ArrowRight24Regular,
  Receipt24Regular,
  Premium24Regular,
  CalendarLtr24Regular,
} from '@fluentui/react-icons';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
    APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
    TRIALING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
    EXPIRED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    PAST_DUE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    DECLINED: 'bg-red-500/20 text-red-400 border-red-500/30',
    REFUNDED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
    >
      {status}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PaymentsPage() {
  const { t } = useI18n();
  const pt = (t as any).payments || {};

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pointPurchases, setPointPurchases] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sub, hist, txRes] = await Promise.all([
          paymentsApi.getSubscription().catch(() => null),
          paymentsApi.getPaymentHistory().catch(() => []),
          getTransactions(1, 100).catch(() => ({ transactions: [] })),
        ]);
        setSubscription(sub);
        setPayments(hist);
        // Filter for point pack purchases (CREDIT transactions from purchases)
        const packTxs = txRes.transactions.filter(
          (tx) => tx.type === 'CREDIT' && tx.referenceType === 'POINT_PURCHASE'
        );
        setPointPurchases(packTxs);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/20 mb-3">
          <Wallet24Regular className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          {pt.title || 'Payments & Billing'}
        </h1>
      </div>

      {/* Current Subscription Card */}
      <div className="mx-1 rounded-2xl border border-th-border bg-th-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <Premium24Regular className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-th-text">
            {pt.subscription || 'Subscription'}
          </h2>
        </div>

        <div className="space-y-3">
          {/* Plan + Status Row */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-th-text-s">{pt.currentPlan || 'Current Plan'}</span>
              <div className="text-xl font-bold text-white mt-0.5">
                {subscription?.plan === 'FREE'
                  ? pt.freePlan || 'Free'
                  : subscription?.plan || 'FREE'}
              </div>
            </div>
            <StatusBadge status={subscription?.status || 'ACTIVE'} />
          </div>

          {/* Billing Interval */}
          {subscription?.billingInterval && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-th-text-s">{pt.billingInterval || 'Billing Interval'}</span>
              <span className="text-th-text">
                {subscription.billingInterval === 'MONTHLY'
                  ? pt.monthly || 'Monthly'
                  : pt.yearly || 'Yearly'}
              </span>
            </div>
          )}

          {/* Period Dates */}
          {subscription?.currentPeriodStart && (
            <div className="flex items-center gap-2 text-sm text-th-text-s">
              <CalendarLtr24Regular className="w-4 h-4" />
              <span>
                {formatDate(subscription.currentPeriodStart)} — {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
          )}

          {/* Upgrade Button */}
          {subscription?.plan === 'FREE' && (
            <Link
              href="/checkout"
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-medium text-sm hover:opacity-90 transition-opacity"
            >
              {pt.upgradePlan || 'Upgrade Plan'}
              <ArrowRight24Regular className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Point Pack Purchases */}
      <div className="mx-1 rounded-2xl border border-th-border bg-th-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <Receipt24Regular className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-th-text">
            {pt.pointPurchases || 'Point Purchases'}
          </h2>
        </div>

        {pointPurchases.length === 0 ? (
          <p className="text-sm text-th-text-s text-center py-6">
            {pt.noPayments || 'No payments yet'}
          </p>
        ) : (
          <div className="space-y-3">
            {pointPurchases.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-th-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-th-text truncate">
                    {tx.description}
                  </p>
                  <p className="text-xs text-th-text-s mt-0.5">
                    +{tx.amount} {(t as any).wallet?.points || 'points'}
                  </p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <StatusBadge status="APPROVED" />
                  <p className="text-xs text-th-text-s mt-1">
                    {formatDate(tx.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscription Payments */}
      <div className="mx-1 rounded-2xl border border-th-border bg-th-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet24Regular className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-th-text">
            {pt.subscriptionPayments || 'Subscription Payments'}
          </h2>
        </div>

        {payments.length === 0 ? (
          <p className="text-sm text-th-text-s text-center py-6">
            {pt.noPayments || 'No payments yet'}
          </p>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-th-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-th-text">
                    {pt.plan || 'Plan'}: {payment.plan}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-th-text-s">
                      {payment.amount} {payment.currency}
                    </span>
                    <span className="text-xs text-th-text-s">
                      {payment.billingInterval === 'MONTHLY'
                        ? pt.monthly || 'Monthly'
                        : pt.yearly || 'Yearly'}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <StatusBadge status={payment.status} />
                  <p className="text-xs text-th-text-s mt-1">
                    {formatDate(payment.paidAt || payment.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
