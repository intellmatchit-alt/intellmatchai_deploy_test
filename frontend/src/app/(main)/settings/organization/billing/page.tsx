'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/hooks/useOrganization';
import { paymentsApi, Payment } from '@/lib/api/payments';
import {
  ArrowLeft24Regular,
  Money24Regular,
  People24Regular,
  Calendar24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';

export default function TeamBillingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { organization, isOwner } = useOrganization();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paymentsApi.getPaymentHistory().then((data) => {
      setPayments(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const subscription = organization?.subscription;
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.organization?.teamBilling || 'Team Billing'}</h1>
      </div>

      {/* Current Plan Card */}
      <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 border border-emerald-500/30 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="px-3 py-1 bg-emerald-500 text-white text-sm font-semibold rounded-full">{subscription?.plan || 'TEAM'}</div>
          <span className="text-sm text-th-text-t">{subscription?.billingInterval === 'YEARLY' ? 'Annual' : 'Monthly'}</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-2 text-th-text-t mb-1">
              <People24Regular className="w-4 h-4" />
              <span className="text-xs">{t.organization?.seats || 'Seats'}</span>
            </div>
            <p className="text-xl font-bold text-th-text">{subscription?.seats || 0}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-th-text-t mb-1">
              <Money24Regular className="w-4 h-4" />
              <span className="text-xs">{t.organization?.perSeat || 'Per Seat'}</span>
            </div>
            <p className="text-xl font-bold text-th-text">
              ${subscription?.billingInterval === 'YEARLY' ? '290' : '29'}
              <span className="text-sm text-th-text-t font-normal">/{subscription?.billingInterval === 'YEARLY' ? 'yr' : 'mo'}</span>
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-th-text-t mb-1">
              <Calendar24Regular className="w-4 h-4" />
              <span className="text-xs">{t.organization?.nextBilling || 'Next Billing'}</span>
            </div>
            <p className="text-sm font-medium text-th-text">{formatDate(subscription?.currentPeriodEnd || null)}</p>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-th-surface border border-th-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-th-border">
          <h2 className="text-sm font-medium text-th-text-t">{t.organization?.paymentHistory || 'Payment History'}</h2>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-th-text-m text-sm">{t.organization?.noPayments || 'No payments yet'}</div>
        ) : (
          <div className="divide-y divide-th-border-s">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-th-text">
                    {payment.plan} - {payment.billingInterval}
                    {payment.seats > 1 && ` (${payment.seats} seats)`}
                  </p>
                  <p className="text-xs text-th-text-m">{formatDate(payment.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-th-text">${payment.amount} {payment.currency}</p>
                  <div className="flex items-center gap-1">
                    {payment.status === 'APPROVED' && <Checkmark24Regular className="w-3 h-3 text-green-400" />}
                    <span className={`text-xs ${payment.status === 'APPROVED' ? 'text-green-400' : 'text-th-text-m'}`}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
