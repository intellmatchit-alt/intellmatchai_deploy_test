'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { getAffiliateStats, getAffiliateReferrals } from '@/lib/api/affiliate';
import { getMyAffiliate } from '@/lib/api/affiliate';
import {
  People24Regular,
  ArrowTrending24Regular,
  Money24Regular,
  Wallet24Regular,
  Add24Regular,
  Copy24Regular,
} from '@fluentui/react-icons';

export default function AffiliateDashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<any>(null);
  const [recentReferrals, setRecentReferrals] = useState<any[]>([]);
  const [affiliate, setAffiliate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAffiliateStats(),
      getAffiliateReferrals({ limit: 5 }),
      getMyAffiliate(),
    ]).then(([statsRes, refsRes, affRes]) => {
      setStats(statsRes);
      setRecentReferrals(refsRes?.referrals || []);
      setAffiliate(affRes);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl" />)}
        </div>
        <div className="h-40 bg-white/5 rounded-2xl" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Referrals', value: stats?.totalReferrals || 0, Icon: People24Regular, color: 'from-blue-500 to-cyan-400' },
    { label: 'Conversions', value: stats?.conversions || 0, Icon: ArrowTrending24Regular, color: 'from-green-500 to-emerald-400' },
    { label: 'Total Earnings', value: affiliate?.settings?.paymentMode === 'cash' ? `$${stats?.totalEarnings?.toFixed(2) || '0.00'}` : `${stats?.totalEarningsPoints || 0} pts`, Icon: Money24Regular, color: 'from-amber-500 to-yellow-400' },
    { label: 'Pending Balance', value: affiliate?.settings?.paymentMode === 'cash' ? `$${stats?.payoutBalance?.toFixed(2) || '0.00'}` : `${stats?.payoutBalancePoints || 0} pts`, Icon: Wallet24Regular, color: 'from-purple-500 to-pink-400' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${card.color} opacity-10 blur-xl`} />
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-2`}>
              <card.Icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl font-bold text-white">{card.value}</p>
            <p className="text-xs text-white font-bold">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Conversion Rate */}
      {stats && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white font-bold mb-1">Conversion Rate</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" style={{ width: `${Math.min(Number(stats.conversionRate), 100)}%` }} />
            </div>
            <span className="text-sm font-medium text-white font-bold">{stats.conversionRate}%</span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/affiliate/codes" className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-teal-500/10 p-4 hover:bg-teal-500/15 transition-colors">
          <Add24Regular className="w-5 h-5 text-white font-bold" />
          <span className="text-sm font-medium text-white">Create Code</span>
        </Link>
        <Link href="/affiliate/referrals" className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 hover:bg-blue-500/15 transition-colors">
          <People24Regular className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium text-white">View Referrals</span>
        </Link>
      </div>

      {/* Recent Referrals */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="font-bold text-white mb-3">Recent Referrals</h3>
        {recentReferrals.length === 0 ? (
          <p className="text-sm text-white font-bold text-center py-4">No referrals yet. Share your codes to get started!</p>
        ) : (
          <div className="space-y-2">
            {recentReferrals.map((ref: any) => (
              <div key={ref.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm text-white">{ref.referredEmail?.replace(/(.{2})(.*)(@.*)/, '$1***$3')}</p>
                  <p className="text-xs text-white font-bold">{ref.code?.code} &bull; {new Date(ref.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  ref.commissionStatus === 'EARNED' || ref.commissionStatus === 'PAID' ? 'bg-green-500 text-black font-bold' :
                  ref.purchasedAt ? 'bg-blue-400 text-black font-bold' : 'bg-gray-400 text-black font-bold'
                }`}>
                  {ref.commissionStatus === 'EARNED' ? 'Earned' : ref.commissionStatus === 'PAID' ? 'Paid' : ref.purchasedAt ? 'Purchased' : 'Registered'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
