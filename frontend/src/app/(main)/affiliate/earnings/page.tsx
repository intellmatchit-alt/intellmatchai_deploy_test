'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { getAffiliatePayouts, requestAffiliatePayout, getMyAffiliate, getAffiliateStats } from '@/lib/api/affiliate';
import { Wallet24Regular, ArrowDownload24Regular } from '@fluentui/react-icons';

export default function AffiliateEarningsPage() {
  const { t } = useI18n();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [affiliate, setAffiliate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getAffiliatePayouts(),
      getAffiliateStats(),
      getMyAffiliate(),
    ]).then(([payRes, statsRes, affRes]) => {
      setPayouts(payRes?.payouts || []);
      setStats(statsRes);
      setAffiliate(affRes);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handlePayout = async () => {
    setRequesting(true);
    try {
      await requestAffiliatePayout();
      loadData();
    } catch {}
    setRequesting(false);
  };

  const paymentMode = affiliate?.settings?.paymentMode || 'points';
  const balance = paymentMode === 'cash' ? stats?.payoutBalance || 0 : stats?.payoutBalancePoints || 0;
  const hasBalance = balance > 0;

  if (loading) {
    return <div className="space-y-4 animate-pulse"><div className="h-32 bg-white/5 rounded-2xl" /><div className="h-48 bg-white/5 rounded-2xl" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-teal-500/10 to-emerald-500/10 p-6 text-center">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl" />
        <Wallet24Regular className="w-8 h-8 text-white font-bold mx-auto mb-2" />
        <p className="text-sm text-white font-bold mb-1">Available Balance</p>
        <p className="text-3xl font-bold text-white">
          {paymentMode === 'cash' ? `$${Number(balance).toFixed(2)}` : `${balance} pts`}
        </p>
        <p className="text-xs text-white font-bold mt-1">Payment Mode: {paymentMode === 'cash' ? 'Cash (USD)' : 'Points'}</p>

        <button
          onClick={handlePayout}
          disabled={!hasBalance || requesting}
          className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-400 text-[#042820] font-bold font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          <ArrowDownload24Regular className="w-4 h-4" />
          {requesting ? 'Requesting...' : 'Request Payout'}
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-xs text-white font-bold">Total Earned</p>
          <p className="text-lg font-bold text-white">
            {paymentMode === 'cash' ? `$${stats?.totalEarnings?.toFixed(2) || '0.00'}` : `${stats?.totalEarningsPoints || 0} pts`}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-xs text-white font-bold">Conversions</p>
          <p className="text-lg font-bold text-white">{stats?.conversions || 0}</p>
        </div>
      </div>

      {/* Payout History */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="font-bold text-white mb-3">Payout History</h3>
        {payouts.length === 0 ? (
          <p className="text-sm text-white font-bold text-center py-4">No payouts yet</p>
        ) : (
          <div className="space-y-2">
            {payouts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm text-white">
                    {p.paymentMode === 'cash' ? `$${Number(p.amount).toFixed(2)}` : `${p.points} pts`}
                  </p>
                  <p className="text-xs text-white font-bold">{new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.status === 'COMPLETED' ? 'bg-green-500 text-black font-bold' :
                  p.status === 'PENDING' ? 'bg-yellow-400 text-black font-bold' :
                  p.status === 'PROCESSING' ? 'bg-blue-400 text-black font-bold' :
                  'bg-red-400 text-black font-bold'
                }`}>{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
