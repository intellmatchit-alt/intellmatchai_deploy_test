'use client';

import { useEffect, useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { getAffiliateReferrals, getAffiliateCodes, getAffiliateStats, getMyAffiliate } from '@/lib/api/affiliate';
import { Chip } from '@/components/ui/Chip';
import {
  People24Regular,
  ArrowTrending24Regular,
  Money24Regular,
  CheckmarkCircle24Regular,
  Filter24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Code24Regular,
} from '@fluentui/react-icons';

export default function AffiliateReferralsPage() {
  const { t } = useI18n();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [affiliate, setAffiliate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = (codeId?: string, pg = 1) => {
    setLoading(true);
    getAffiliateReferrals({ codeId: codeId || undefined, page: pg, limit: 20 }).then((res) => {
      setReferrals(res?.referrals || []);
      setTotalPages(res?.totalPages || 1);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([
      getAffiliateCodes(),
      getAffiliateStats(),
      getMyAffiliate(),
    ]).then(([codesRes, statsRes, affRes]) => {
      setCodes(codesRes || []);
      setStats(statsRes);
      setAffiliate(affRes);
    });
    loadData();
  }, []);

  const handleCodeFilter = (codeId: string) => {
    const next = selectedCode === codeId ? '' : codeId;
    setSelectedCode(next);
    setPage(1);
    loadData(next, 1);
  };

  const isPoints = affiliate?.settings?.paymentMode === 'points';

  // Funnel counts derived from referrals
  const funnelCounts = useMemo(() => {
    const registered = referrals.length;
    const purchased = referrals.filter((r: any) => r.purchasedAt).length;
    const earned = referrals.filter((r: any) => r.commissionStatus === 'EARNED' || r.commissionStatus === 'PAID').length;
    const paid = referrals.filter((r: any) => r.commissionStatus === 'PAID').length;
    return { registered, purchased, earned, paid };
  }, [referrals]);

  const statusBadge = (ref: any) => {
    if (ref.commissionStatus === 'PAID') return { text: 'Paid', cls: 'bg-green-500/20 text-green-400 border border-green-500/30' };
    if (ref.commissionStatus === 'EARNED') return { text: 'Earned', cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
    if (ref.purchasedAt) return { text: 'Purchased', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' };
    return { text: 'Registered', cls: 'bg-white/10 text-white font-bold border border-white/10' };
  };

  const statCards = stats ? [
    { label: 'Total Referrals', value: stats.totalReferrals || 0, Icon: People24Regular, gradient: 'from-blue-500 to-cyan-400', bgGlow: 'bg-blue-500/[0.08]', borderColor: 'border-blue-500/20', hoverBorder: 'hover:border-blue-400/40' },
    { label: 'Conversions', value: stats.conversions || 0, Icon: ArrowTrending24Regular, gradient: 'from-emerald-500 to-teal-400', bgGlow: 'bg-emerald-500/[0.08]', borderColor: 'border-emerald-500/20', hoverBorder: 'hover:border-emerald-400/40' },
    { label: 'Total Earned', value: isPoints ? `${stats.totalEarningsPoints || 0} pts` : `$${(stats.totalEarnings || 0).toFixed(2)}`, Icon: Money24Regular, gradient: 'from-amber-500 to-yellow-400', bgGlow: 'bg-amber-500/[0.08]', borderColor: 'border-amber-500/20', hoverBorder: 'hover:border-amber-400/40' },
    { label: 'Conversion Rate', value: `${stats.conversionRate || 0}%`, Icon: CheckmarkCircle24Regular, gradient: 'from-purple-500 to-pink-400', bgGlow: 'bg-purple-500/[0.08]', borderColor: 'border-purple-500/20', hoverBorder: 'hover:border-purple-400/40' },
  ] : [];

  const funnelStages = [
    { label: 'Registered', count: funnelCounts.registered, color: 'bg-white/20', text: 'text-white/70', dot: 'bg-white/40' },
    { label: 'Purchased', count: funnelCounts.purchased, color: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
    { label: 'Earned', count: funnelCounts.earned, color: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    { label: 'Paid', count: funnelCounts.paid, color: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-400' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ─── Stat Cards ─── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <div
              key={card.label}
              className={`relative overflow-hidden rounded-2xl border ${card.borderColor} ${card.bgGlow} p-5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${card.hoverBorder} animate-slide-up-fade`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`absolute -top-10 -end-10 w-28 h-28 rounded-full bg-gradient-to-br ${card.gradient} opacity-[0.12] blur-2xl`} />
              <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4 shadow-lg shadow-black/20`}>
                <card.Icon className="w-7 h-7 text-white" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-white">{card.value}</p>
              <p className="text-sm font-bold text-white mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── Conversion Funnel ─── */}
      {stats && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-5">
          <h3 className="text-sm font-bold text-white mb-4">Conversion Funnel</h3>
          <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {funnelStages.map((stage, i) => (
              <div key={stage.label} className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`flex-1 rounded-lg ${stage.color} px-3 py-3 text-center min-w-[80px]`}>
                  <p className={`text-xl font-bold ${stage.text}`}>{stage.count}</p>
                  <p className="text-[11px] font-bold text-white mt-0.5">{stage.label}</p>
                </div>
                {i < funnelStages.length - 1 && (
                  <ChevronRight24Regular className="w-4 h-4 text-white flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Conversion Rate + Code Performance ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversion Rate Bar */}
        {stats && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white">Conversion Rate</span>
              <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                {stats.conversionRate || 0}%
              </span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(Number(stats.conversionRate || 0), 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[11px] font-bold text-white">0%</span>
              <span className="text-[11px] font-bold text-white">100%</span>
            </div>
          </div>
        )}

        {/* Code Performance */}
        {codes.length > 0 && (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.08] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Code24Regular className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">Code Performance</span>
            </div>
            <div className="space-y-2 max-h-[140px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {codes.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-cyan-500/10 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-400 text-[#042820] flex-shrink-0">
                      {c.code}
                    </span>
                    {c.name && <span className="text-xs font-bold text-white truncate">{c.name}</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-bold text-white">{c.usageCount || 0} refs</span>
                    <span className={`text-xs font-bold ${c.status === 'ACTIVE' ? 'text-emerald-400' : 'text-white/50'}`}>
                      {c.status === 'ACTIVE' ? 'Active' : 'Paused'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Code Filter Chips ─── */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.08] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter24Regular className="w-4 h-4 text-white" />
          <span className="text-sm font-bold text-white">Filter by Code</span>
          {selectedCode && (
            <button
              onClick={() => { setSelectedCode(''); setPage(1); loadData('', 1); }}
              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors ms-auto"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip
            clickable
            selected={!selectedCode}
            variant={!selectedCode ? 'primary' : 'outline'}
            size="sm"
            className={!selectedCode ? 'font-bold text-black' : 'font-bold text-white'}
            onClick={() => { setSelectedCode(''); setPage(1); loadData('', 1); }}
          >
            All
          </Chip>
          {codes.map((c: any) => (
            <Chip
              key={c.id}
              clickable
              selected={selectedCode === c.id}
              variant={selectedCode === c.id ? 'primary' : 'outline'}
              size="sm"
              className={selectedCode === c.id ? 'font-bold text-black' : 'font-bold text-white'}
              onClick={() => handleCodeFilter(c.id)}
            >
              {c.name || c.code}
            </Chip>
          ))}
        </div>
      </div>

      {/* ─── Referrals List ─── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-2xl border border-blue-500/20 bg-blue-500/[0.08] animate-pulse" />
          ))}
        </div>
      ) : referrals.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-blue-500/20 bg-blue-500/[0.08]">
          <People24Regular className="w-12 h-12 text-white/15 mx-auto mb-3" />
          <p className="text-lg font-bold text-white mb-1">No referrals yet</p>
          <p className="text-sm font-bold text-white">Share your codes to start getting referrals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {referrals.map((ref: any, i: number) => {
            const badge = statusBadge(ref);
            const steps = [
              { label: 'Registered', active: true },
              { label: 'Purchased', active: !!ref.purchasedAt },
              { label: 'Earned', active: ref.commissionStatus === 'EARNED' || ref.commissionStatus === 'PAID' },
              { label: 'Paid', active: ref.commissionStatus === 'PAID' },
            ];
            const stepColors = ['bg-white/40', 'bg-blue-400', 'bg-emerald-400', 'bg-green-400'];

            return (
              <div
                key={ref.id}
                className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-blue-500/[0.08] p-4 transition-all duration-300 hover:scale-[1.01] hover:border-blue-400/40 hover:shadow-lg animate-slide-up-fade"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-white">
                    {ref.referredEmail?.replace(/(.{2})(.*)(@.*)/, '$1***$3')}
                  </span>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-400 text-[#042820]">
                    {ref.code?.code}
                  </span>
                  {ref.code?.name && (
                    <span className="text-xs font-bold text-white">{ref.code.name}</span>
                  )}
                  <span className="text-xs font-bold text-white">
                    {new Date(ref.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                {/* Commission info */}
                {(ref.commissionAmount || ref.commissionPoints) && (
                  <div className="flex items-center gap-3 mb-3">
                    {ref.commissionAmount && (
                      <span className="text-sm font-bold text-emerald-400">${Number(ref.commissionAmount).toFixed(2)}</span>
                    )}
                    {ref.commissionPoints && (
                      <span className="text-sm font-bold text-emerald-400">{ref.commissionPoints} pts</span>
                    )}
                    {ref.purchaseAmount && (
                      <span className="text-xs font-bold text-white">from ${Number(ref.purchaseAmount).toFixed(2)} purchase</span>
                    )}
                  </div>
                )}

                {/* Progress steps */}
                <div className="flex items-center gap-1">
                  {steps.map((step, si) => (
                    <div key={step.label} className="flex items-center gap-1 flex-1">
                      <div className="flex items-center gap-1.5 flex-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${step.active ? stepColors[si] : 'bg-white/10'}`} />
                        <span className={`text-[10px] font-bold ${step.active ? 'text-white' : 'text-white/40'}`}>
                          {step.label}
                        </span>
                      </div>
                      {si < steps.length - 1 && (
                        <div className={`h-px flex-1 mx-1 ${step.active ? 'bg-white/20' : 'bg-white/5'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Pagination ─── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => { const p = page - 1; setPage(p); loadData(selectedCode, p); }}
            disabled={page <= 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-400 text-[#042820] font-bold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft24Regular className="w-4 h-4" />
            Prev
          </button>
          <span className="text-sm font-bold text-white">{page} / {totalPages}</span>
          <button
            onClick={() => { const p = page + 1; setPage(p); loadData(selectedCode, p); }}
            disabled={page >= totalPages}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-400 text-[#042820] font-bold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight24Regular className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
