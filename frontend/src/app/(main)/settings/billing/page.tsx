/**
 * Billing & Subscription Page
 *
 * View subscription status and payment history.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { getSubscription, getPaymentHistory, type Subscription, type Payment } from '@/lib/api/payments';
import { useWalletStore } from '@/stores/walletStore';
import {
  ArrowLeft24Regular,
  Checkmark24Regular,
  Crown24Regular,
  Receipt24Regular,
  Calendar24Regular,
  Print24Regular,
  Dismiss24Regular,
  DocumentArrowDown24Regular,
  CheckmarkCircle24Filled,
  Clock24Regular,
  DismissCircle24Regular,
} from '@fluentui/react-icons';

// Wallet balance card component
function WalletBalanceCard() {
  const { balance, fetchBalance } = useWalletStore();
  useEffect(() => { fetchBalance(); }, [fetchBalance]);
  return (
    <Link href="/wallet" className="block bg-th-surface border border-th-border rounded-2xl p-5 hover:bg-th-surface-h transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-th-text-s">Points Balance</div>
          <div className="text-3xl font-bold text-th-text">{balance}</div>
        </div>
        <span className="text-sm text-blue-400">View Wallet →</span>
      </div>
    </Link>
  );
}

// Status badge component
const StatusBadge = ({ status, t }: { status: string; t: any }) => {
  const labels: Record<string, string> = {
    ACTIVE: t.settings?.statusApproved || 'Approved',
    TRIALING: t.settings?.statusTrial || 'Trial',
    PENDING: t.settings?.statusPending || 'Pending Approval',
    CANCELLED: t.settings?.statusCancelled || 'Cancelled',
    EXPIRED: t.settings?.statusExpired || 'Expired',
    PAST_DUE: t.settings?.statusPastDue || 'Past Due',
  };

  const config: Record<string, { color: string; icon: React.ReactNode }> = {
    ACTIVE: {
      color: 'bg-green-500/20 text-green-400 border-green-500/30',
      icon: <CheckmarkCircle24Filled className="w-4 h-4" />,
    },
    TRIALING: {
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      icon: <Clock24Regular className="w-4 h-4" />,
    },
    PENDING: {
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      icon: <Clock24Regular className="w-4 h-4" />,
    },
    CANCELLED: {
      color: 'bg-red-500/20 text-red-400 border-red-500/30',
      icon: <DismissCircle24Regular className="w-4 h-4" />,
    },
    EXPIRED: {
      color: 'bg-white/[0.03]0/20 text-th-text-t border-neutral-500/30',
      icon: <DismissCircle24Regular className="w-4 h-4" />,
    },
    PAST_DUE: {
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      icon: <Clock24Regular className="w-4 h-4" />,
    },
  };

  const statusConfig = config[status] || config.PENDING;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.color}`}>
      {statusConfig.icon}
      {labels[status] || labels.PENDING}
    </span>
  );
};

// Invoice Modal for printing
const InvoiceModal = ({
  payment,
  isOpen,
  onClose
}: {
  payment: Payment | null;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Invoice - IntellMatch</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                .invoice-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px; }
                .logo { font-size: 24px; font-weight: 700; color: #10b981; }
                .invoice-title { font-size: 32px; font-weight: 700; color: #333; }
                .invoice-number { color: #666; font-size: 14px; }
                .section { margin-bottom: 24px; }
                .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; }
                .table { width: 100%; border-collapse: collapse; margin: 24px 0; }
                .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                .table th { background: #f9f9f9; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
                .total-row { background: #f0fdf4; }
                .total-row td { font-weight: 700; font-size: 18px; color: #16a34a; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 14px; }
                @media print { body { padding: 20px; } }
              </style>
            </head>
            <body>${printContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  if (!isOpen || !payment) return null;

  const invoiceNumber = `INV-${payment.id.slice(0, 8).toUpperCase()}`;
  const invoiceDate = payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : new Date(payment.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0c1222] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-[#0c1222] border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{t.settings?.viewInvoice || 'Invoice'}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              <Print24Regular className="w-4 h-4" />
              {t.settings?.print || 'Print'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <Dismiss24Regular className="w-5 h-5 text-th-text-m" />
            </button>
          </div>
        </div>

        {/* Invoice Content (Printable) */}
        <div ref={printRef} className="p-8 bg-[#0c1222] text-white">
          {/* Header */}
          <div className="invoice-header flex justify-between items-start mb-10">
            <div>
              <div className="logo text-2xl font-bold text-emerald-600">IntellMatch</div>
              <p className="text-th-text-m text-sm mt-1">AI-Powered Professional Networking</p>
            </div>
            <div className="text-right">
              <div className="invoice-title text-3xl font-bold text-white">INVOICE</div>
              <div className="invoice-number text-th-text-m mt-1">#{invoiceNumber}</div>
              <div className="text-th-text-m text-sm mt-2">{invoiceDate}</div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="section mb-8">
            <div className="section-title text-xs uppercase tracking-wider text-th-text-m mb-2">{t.settings?.transactionRef || 'Transaction Reference'}</div>
            <p className="font-mono text-sm text-white/80">{payment.tranRef || payment.cartId}</p>
          </div>

          {/* Items Table */}
          <table className="table w-full border-collapse mb-8">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="text-left p-3 text-xs uppercase tracking-wider text-th-text-m border-b border-white/[0.08]">{t.settings?.description || 'Description'}</th>
                <th className="text-right p-3 text-xs uppercase tracking-wider text-th-text-m border-b border-white/[0.08]">{t.settings?.amount || 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 border-b border-neutral-100">
                  <p className="font-semibold text-white">{payment.plan} Plan</p>
                  <p className="text-sm text-th-text-m">{payment.billingInterval} subscription</p>
                </td>
                <td className="p-3 border-b border-neutral-100 text-right">
                  ${Number(payment.amount).toFixed(2)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="total-row bg-green-50">
                <td className="p-3 font-semibold">{t.settings?.total || 'Total'}</td>
                <td className="p-3 text-right font-bold text-lg text-green-600">
                  ${Number(payment.amount).toFixed(2)} {payment.currency}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer */}
          <div className="footer mt-10 pt-6 border-t border-white/[0.08] text-center text-th-text-m text-sm">
            <p>{t.settings?.thankYou || 'Thank you for your business!'}</p>
            <p className="mt-2">IntellMatch | support@intellmatch.com</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function BillingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [subData, paymentsData] = await Promise.all([
          getSubscription(),
          getPaymentHistory(),
        ]);
        setSubscription(subData);
        setPayments(paymentsData);
      } catch (err) {
        setError('Failed to load subscription data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleViewInvoice = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowInvoiceModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isPro = subscription?.plan === 'PRO';
  const isApproved = subscription?.status === 'ACTIVE';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.settings?.billing || 'Subscription & Billing'}</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Points Balance */}
      <WalletBalanceCard />

      {/* Current Plan Status Card */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Crown24Regular className="w-7 h-7 text-th-text" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-th-text">
                {subscription?.plan === 'PRO'
                  ? (t.settings?.proPlanTitle || 'Pro Plan')
                  : subscription?.plan === 'TEAM'
                  ? (t.settings?.teamPlanTitle || 'Team Plan')
                  : (t.settings?.freePlanTitle || 'Free Plan')}
              </h2>
              <p className="text-th-text-t text-sm">
                {subscription?.plan === 'PRO'
                  ? (t.settings?.proPlanDesc || 'Professional features for power users')
                  : subscription?.plan === 'TEAM'
                  ? (t.settings?.teamPlanDesc || 'Collaboration features for teams')
                  : (t.settings?.freePlanDesc || 'Basic features for getting started')}
              </p>
            </div>
          </div>
        </div>

        {/* Status Display */}
        <div className="bg-th-surface border border-th-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-th-text-s">{t.settings?.subscriptionStatus || 'Subscription Status'}</span>
            <StatusBadge status={subscription?.status || 'PENDING'} t={t} />
          </div>
        </div>

        {/* Billing Info */}
        {subscription?.billingInterval && (
          <div className="bg-th-surface border border-th-border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-th-text-s">{t.settings?.billingCycle || 'Billing Cycle'}</span>
              <span className="text-th-text font-medium">{subscription.billingInterval}</span>
            </div>
          </div>
        )}

        {/* Renewal/Expiry Date */}
        {subscription?.currentPeriodEnd && (
          <div className="bg-th-surface border border-th-border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-th-text-s">
                <Calendar24Regular className="w-4 h-4" />
                <span>
                  {subscription.cancelAtPeriodEnd
                    ? (t.settings?.expiresOn || 'Expires on')
                    : (t.settings?.renewsOn || 'Renews on')
                  }
                </span>
              </div>
              <span className="text-th-text font-medium">{formatDate(subscription.currentPeriodEnd)}</span>
            </div>
          </div>
        )}

        {/* Trial Info */}
        {subscription?.trialEndsAt && subscription.status === 'TRIALING' && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-emerald-300">{t.settings?.trialEnds || 'Trial ends'}</span>
              <span className="text-emerald-400 font-medium">{formatDate(subscription.trialEndsAt)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Plan Features */}
      <div className="bg-th-surface border border-th-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-th-text mb-4">{t.settings?.planFeatures || 'Plan Features'}</h3>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 text-th-text-s">
            <Checkmark24Regular className="w-5 h-5 text-green-400" />
            {t.settings?.unlimitedContacts || 'Unlimited contacts'}
          </li>
          <li className="flex items-center gap-3 text-th-text-s">
            <Checkmark24Regular className="w-5 h-5 text-green-400" />
            {t.settings?.unlimitedCardScans || 'Unlimited card scans'}
          </li>
          <li className="flex items-center gap-3 text-th-text-s">
            <Checkmark24Regular className="w-5 h-5 text-green-400" />
            {t.settings?.advancedAiMatching || 'Advanced AI matching'}
          </li>
          <li className="flex items-center gap-3 text-th-text-s">
            <Checkmark24Regular className="w-5 h-5 text-green-400" />
            {t.settings?.fullCollaborationFeatures || 'Full collaboration features'}
          </li>
          <li className="flex items-center gap-3 text-th-text-s">
            <Checkmark24Regular className="w-5 h-5 text-green-400" />
            {t.settings?.networkVisualization || 'Network visualization'}
          </li>
          <li className="flex items-center gap-3 text-th-text-s">
            <Checkmark24Regular className="w-5 h-5 text-green-400" />
            {t.settings?.prioritySupport || 'Priority support'}
          </li>
        </ul>
      </div>

      {/* Upgrade/Compare Plans Section */}
      <div className="bg-th-surface border border-th-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-th-text">{t.settings?.comparePlans || 'Compare Plans'}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Free Plan */}
          <div className={`relative p-5 rounded-xl border ${subscription?.plan === 'FREE' || !subscription?.plan ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-th-border bg-th-surface'}`}>
            {(subscription?.plan === 'FREE' || !subscription?.plan) && (
              <span className="absolute -top-2 start-4 px-2 py-0.5 bg-emerald-500 text-white text-xs font-medium rounded-full">
                {t.settings?.currentPlanBadge || 'Current'}
              </span>
            )}
            <h4 className="text-lg font-bold text-th-text mb-1">{t.pricing?.plans?.free?.name || 'Free'}</h4>
            <p className="text-th-text-t text-sm mb-3">{t.pricing?.plans?.free?.tagline || 'Personal Starter'}</p>
            <div className="mb-4">
              <span className="text-2xl font-bold text-th-text">$0</span>
              <span className="text-th-text-t text-sm">{t.settings?.perMonth || '/month'}</span>
            </div>
            <ul className="space-y-2 text-sm mb-4">
              <li className="flex items-center gap-2 text-th-text-s">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{t.pricing?.plans?.free?.features?.[1] || 'Up to 500 contacts'}</span>
              </li>
              <li className="flex items-center gap-2 text-th-text-s">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{t.pricing?.plans?.free?.features?.[2] || '10 card scans / month'}</span>
              </li>
              <li className="flex items-center gap-2 text-th-text-s">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{t.pricing?.plans?.free?.features?.[5] || 'Explore: 5 checks / day'}</span>
              </li>
            </ul>
          </div>

          {/* Pro Plan */}
          <div className={`relative p-5 rounded-xl border ${subscription?.plan === 'PRO' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-th-border bg-th-surface'}`}>
            {subscription?.plan === 'PRO' ? (
              <span className="absolute -top-2 start-4 px-2 py-0.5 bg-emerald-500 text-white text-xs font-medium rounded-full">
                {t.settings?.currentPlanBadge || 'Current'}
              </span>
            ) : (
              <span className="absolute -top-2 start-4 px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-medium rounded-full">
                {t.settings?.recommended || 'Recommended'}
              </span>
            )}
            <h4 className="text-lg font-bold text-th-text mb-1">{t.pricing?.plans?.pro?.name || 'Pro'}</h4>
            <p className="text-th-text-t text-sm mb-3">{t.pricing?.plans?.pro?.tagline || 'Professional Relationship OS'}</p>
            <div className="mb-4">
              <span className="text-2xl font-bold text-th-text">$28</span>
              <span className="text-th-text-t text-sm">{t.settings?.perMonth || '/month'}</span>
            </div>
            <ul className="space-y-2 text-sm mb-4">
              <li className="flex items-center gap-2 text-th-text-s">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{t.pricing?.plans?.pro?.features?.[0] || 'Up to 5,000 contacts'}</span>
              </li>
              <li className="flex items-center gap-2 text-th-text-s">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{t.pricing?.plans?.pro?.features?.[1] || 'Unlimited card scans'}</span>
              </li>
              <li className="flex items-center gap-2 text-th-text-s">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{t.pricing?.plans?.pro?.features?.[5] || 'Unlimited Explore'}</span>
              </li>
            </ul>
            {subscription?.plan !== 'PRO' && (
              <button
                onClick={() => router.push('/checkout?plan=pro')}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
              >
                {t.settings?.upgradeToPro || 'Upgrade to Pro'}
              </button>
            )}
          </div>

          {/* Team Plan */}
          <div className={`relative p-5 rounded-xl border ${subscription?.plan === 'TEAM' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-th-border bg-th-surface'}`}>
            {subscription?.plan === 'TEAM' && (
              <span className="absolute -top-2 start-4 px-2 py-0.5 bg-emerald-500 text-white text-xs font-medium rounded-full">
                {t.settings?.currentPlanBadge || 'Current'}
              </span>
            )}
            <h4 className="text-lg font-bold text-th-text mb-1">{t.pricing?.plans?.team?.name || 'Team'}</h4>
            <p className="text-th-text-t text-sm mb-3">{t.pricing?.plans?.team?.tagline || 'Shared Relationship Intelligence'}</p>
            <div className="mb-4">
              <span className="text-2xl font-bold text-th-text">$45</span>
              <span className="text-th-text-t text-sm">{t.settings?.perUser || '/user'}{t.settings?.perMonth || '/month'}</span>
            </div>
            <ul className="space-y-2 text-sm mb-4">
              <li className="flex items-center gap-2 text-th-text-s">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{t.pricing?.plans?.team?.features?.[0] || 'Everything in Pro'}</span>
              </li>
              <li className="flex items-center gap-2 text-th-text-s">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{t.pricing?.plans?.team?.features?.[1] || 'Shared team relationship graph'}</span>
              </li>
              <li className="flex items-center gap-2 text-th-text-s">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{t.pricing?.plans?.team?.features?.[5] || '30,000 org-wide contacts'}</span>
              </li>
            </ul>
            {subscription?.plan !== 'TEAM' && (
              <button
                onClick={() => router.push('/checkout?plan=team')}
                className="w-full py-2.5 bg-th-surface-h border border-white/20 text-th-text font-medium rounded-lg hover:bg-th-surface-h transition-all"
              >
                {t.settings?.upgradeToTeam || 'Upgrade to Team'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-th-surface border border-th-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-th-border">
          <h3 className="text-lg font-semibold text-th-text">{t.settings?.paymentHistory || 'Payment History'}</h3>
        </div>

        {payments.length === 0 ? (
          <div className="p-6 text-center">
            <Receipt24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
            <p className="text-th-text-t">{t.settings?.noPayments || 'No payments yet'}</p>
          </div>
        ) : (
          <div className="divide-y divide-th-border-s">
            {payments.map((payment) => (
              <div key={payment.id} className="p-4 hover:bg-th-surface transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      payment.status === 'APPROVED' ? 'bg-green-500/20' : 'bg-white/[0.03]0/20'
                    }`}>
                      <Receipt24Regular className={`w-5 h-5 ${
                        payment.status === 'APPROVED' ? 'text-green-400' : 'text-th-text-t'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-th-text">{payment.plan} - {payment.billingInterval}</p>
                      <p className="text-sm text-th-text-m">
                        {payment.paidAt ? formatDate(payment.paidAt) : formatDate(payment.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-semibold ${payment.status === 'APPROVED' ? 'text-green-400' : 'text-th-text-t'}`}>
                        ${Number(payment.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-th-text-m">{payment.status}</p>
                    </div>
                    {payment.status === 'APPROVED' && (
                      <button
                        onClick={() => handleViewInvoice(payment)}
                        className="p-2 hover:bg-th-surface-h rounded-lg transition-colors"
                        title={t.settings?.viewInvoice || 'View Invoice'}
                      >
                        <DocumentArrowDown24Regular className="w-5 h-5 text-emerald-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      <InvoiceModal
        payment={selectedPayment}
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setSelectedPayment(null);
        }}
      />
    </div>
  );
}
