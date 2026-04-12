'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useRequireAuth } from '@/hooks/useAuth';
import { getContacts, type Contact } from '@/lib/api/contacts';
import { getChartData } from '@/lib/api/dashboard';
import { getSectors } from '@/lib/api/profile';
import { Avatar } from '@/components/ui/Avatar';
import { DonutChart, BarChart } from '@/components/charts';
import {
  ArrowLeft24Regular,
  People24Regular,
  Briefcase24Regular,
  Sparkle24Regular,
  PersonAdd24Regular,
  ChevronRight24Regular,
  Star24Filled,
  ArrowTrendingLines24Regular,
  Building24Regular,
  Globe24Regular,
} from '@fluentui/react-icons';

interface SectorStats {
  totalContacts: number;
  avgMatchScore: number;
  highMatchCount: number;
  companiesCount: number;
  sourceBreakdown: { label: string; value: number }[];
  matchTierBreakdown: { label: string; value: number; color: string }[];
  topContacts: Contact[];
  favoriteCount: number;
  recentCount: number;
  enrichedCount: number;
}

export default function SectorStatsPage() {
  useRequireAuth();
  const { t, isRTL } = useI18n();
  const params = useParams();
  const router = useRouter();
  const sectorName = decodeURIComponent(params.name as string);

  const ts = t.dashboard.sectorStats;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allSectors, setAllSectors] = useState<{ sector: string; count: number; nameAr?: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setError(null);
      try {
        // Look up ALL sector IDs matching this name (duplicates may exist)
        const allSectorsList = await getSectors();
        const matchedSectors = allSectorsList.filter(s => s.name === sectorName);

        if (matchedSectors.length === 0) {
          // Sector not found in lookup — try fetching all contacts and filtering client-side
          const [chartData, allContactsRes] = await Promise.all([
            getChartData(30).catch(() => null),
            getContacts({ limit: 100, sort: 'matchScore', order: 'desc' }),
          ]);

          const filtered = allContactsRes.contacts.filter(c =>
            c.sectors?.some(s => s.name === sectorName)
          );

          setContacts(filtered);
          if (chartData) setAllSectors(chartData.contactsBySector);
          return;
        }

        const [chartData, ...contactResults] = await Promise.all([
          getChartData(30).catch(() => null),
          ...matchedSectors.map(s =>
            getContacts({ sector: s.id, limit: 100, sort: 'matchScore', order: 'desc' })
          ),
        ]);

        // Merge contacts from all matching sector IDs, deduplicate by ID
        const seen = new Set<string>();
        const merged: Contact[] = [];
        for (const res of contactResults) {
          for (const c of res.contacts) {
            if (!seen.has(c.id)) {
              seen.add(c.id);
              merged.push(c);
            }
          }
        }
        // Sort by match score desc
        merged.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

        setContacts(merged);
        if (chartData) setAllSectors(chartData.contactsBySector);
      } catch (e) {
        console.error('Failed to load sector data:', e);
        setError(e instanceof Error ? e.message : 'Failed to load sector data');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [sectorName]);

  // Resolve display name: API nameAr > static map > English name
  const apiNameAr = allSectors.find(s => s.sector === sectorName)?.nameAr;
  const staticNameAr = (t.dashboard.sectorNames as Record<string, string>)?.[sectorName];
  const displayName = isRTL ? (apiNameAr || staticNameAr || sectorName) : sectorName;

  const stats: SectorStats = useMemo(() => {
    if (!contacts.length) return {
      totalContacts: 0, avgMatchScore: 0, highMatchCount: 0, companiesCount: 0,
      sourceBreakdown: [], matchTierBreakdown: [], topContacts: [], favoriteCount: 0,
      recentCount: 0, enrichedCount: 0,
    };

    const scores = contacts.map(c => c.matchScore || 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const highMatch = contacts.filter(c => (c.matchScore || 0) >= 70).length;

    const companies = new Set(contacts.map(c => c.company).filter(Boolean));
    const favorites = contacts.filter(c => c.isFavorite).length;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const recent = contacts.filter(c => new Date(c.createdAt) >= thirtyDaysAgo).length;
    const enriched = contacts.filter(c => c.linkedInUrl || c.bioFull).length;

    // Source breakdown
    const sourceCounts: Record<string, number> = {};
    contacts.forEach(c => {
      const src = c.source || 'MANUAL';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    const sourceLabels: Record<string, string> = {
      MANUAL: ts?.sourceManual || 'Manual',
      CARD_SCAN: ts?.sourceScan || 'Card Scan',
      IMPORT: ts?.sourceImport || 'Import',
      LINKEDIN: ts?.sourceLinkedIn || 'LinkedIn',
    };
    const sourceBreakdown = Object.entries(sourceCounts).map(([key, val]) => ({
      label: sourceLabels[key] || key,
      value: val,
    }));

    // Match tier breakdown
    const tiers = { excellent: 0, strong: 0, veryGood: 0, good: 0, weak: 0 };
    contacts.forEach(c => {
      const s = c.matchScore || 0;
      if (s >= 90) tiers.excellent++;
      else if (s >= 75) tiers.strong++;
      else if (s >= 60) tiers.veryGood++;
      else if (s >= 40) tiers.good++;
      else tiers.weak++;
    });

    const tierLabels = t.dashboard.matchScoreTiers;
    const matchTierBreakdown = [
      { label: tierLabels?.excellent || 'Excellent', value: tiers.excellent, color: '#10b981' },
      { label: tierLabels?.strong || 'Strong', value: tiers.strong, color: '#22d3ee' },
      { label: tierLabels?.veryGood || 'Very Good', value: tiers.veryGood, color: '#3b82f6' },
      { label: tierLabels?.good || 'Good', value: tiers.good, color: '#f59e0b' },
      { label: tierLabels?.weak || 'Weak', value: tiers.weak, color: '#ef4444' },
    ].filter(t => t.value > 0);

    return {
      totalContacts: contacts.length,
      avgMatchScore: avgScore,
      highMatchCount: highMatch,
      companiesCount: companies.size,
      sourceBreakdown,
      matchTierBreakdown,
      topContacts: contacts.slice(0, 8),
      favoriteCount: favorites,
      recentCount: recent,
      enrichedCount: enriched,
    };
  }, [contacts, t, ts]);

  // This sector's rank among all sectors
  const sectorRank = allSectors.findIndex(s => s.sector === sectorName) + 1;
  const totalInAllSectors = allSectors.reduce((sum, s) => sum + s.count, 0);
  const sectorPercent = totalInAllSectors ? Math.round((stats.totalContacts / totalInAllSectors) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in pb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-th-surface-h rounded-lg animate-pulse" />
          <div className="h-7 w-48 bg-th-surface-h rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-th-surface rounded-xl p-4 animate-pulse h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-th-surface rounded-xl p-4 animate-pulse h-64" />
          <div className="bg-th-surface rounded-xl p-4 animate-pulse h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-th-surface border border-th-border hover:bg-th-surface-h transition-colors"
          >
            <ArrowLeft24Regular className="w-5 h-5 text-white/70 rtl:rotate-180" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{displayName}</h1>
            <p className="text-sm text-white/50">
              {sectorRank > 0 && `#${sectorRank} · `}{stats.totalContacts} {ts?.contacts || t.contacts?.title || 'Contacts'} · {sectorPercent}% {ts?.ofNetwork || 'of network'}
            </p>
          </div>
        </div>
        <Link
          href={`/contacts?sector=${encodeURIComponent(sectorName)}`}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
        >
          {ts?.viewContacts || t.common?.viewAll || 'View All'}
          <ChevronRight24Regular className="w-4 h-4 rtl:rotate-180" />
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          icon={<People24Regular className="w-5 h-5" />}
          label={ts?.totalContacts || 'Total Contacts'}
          value={stats.totalContacts}
          gradient="from-emerald-500 to-teal-500"
        />
        <StatTile
          icon={<Sparkle24Regular className="w-5 h-5" />}
          label={ts?.avgMatchScore || 'Avg Match Score'}
          value={`${stats.avgMatchScore}%`}
          gradient="from-blue-500 to-cyan-500"
        />
        <StatTile
          icon={<ArrowTrendingLines24Regular className="w-5 h-5" />}
          label={ts?.highMatches || 'High Matches'}
          value={stats.highMatchCount}
          sub={`≥70%`}
          gradient="from-violet-500 to-purple-500"
        />
        <StatTile
          icon={<Building24Regular className="w-5 h-5" />}
          label={ts?.companies || 'Companies'}
          value={stats.companiesCount}
          gradient="from-orange-500 to-amber-500"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label={ts?.favorites || 'Favorites'} value={stats.favoriteCount} icon="⭐" />
        <MiniStat label={ts?.addedLast30d || 'Added (30d)'} value={stats.recentCount} icon="📈" />
        <MiniStat label={ts?.enriched || 'Enriched'} value={stats.enrichedCount} icon="✨" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Match Score Distribution */}
        {stats.matchTierBreakdown.length > 0 && (
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/70 mb-1">
              {t.dashboard.matchScoreDistribution || 'Match Score Distribution'}
            </h3>
            <p className="text-xs text-white/40 mb-4">{ts?.matchDistDesc || 'Quality breakdown of contacts in this sector'}</p>
            <BarChart
              data={stats.matchTierBreakdown.map(t => ({ label: t.label, value: t.value }))}
              colors={stats.matchTierBreakdown.map(t => t.color)}
              height={200}
            />
          </div>
        )}

        {/* Source Breakdown */}
        {stats.sourceBreakdown.length > 0 && (
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <h3 className="text-sm font-medium text-white/70 mb-1">
              {ts?.sourceBreakdown || 'Contact Source'}
            </h3>
            <p className="text-xs text-white/40 mb-4">{ts?.sourceDesc || 'How contacts in this sector were added'}</p>
            <DonutChart
              data={stats.sourceBreakdown}
              height={200}
              showLegend={true}
              totalLabel={t.dashboard.chartTotal || 'Total'}
              colors={['#10b981', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#f59e0b']}
            />
          </div>
        )}
      </div>

      {/* Top Contacts */}
      {stats.topContacts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">
              {ts?.topContacts || 'Top Contacts'}
            </h2>
            <Link
              href={`/contacts?sector=${encodeURIComponent(sectorName)}`}
              className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {t.common?.viewAll || 'View All'}
              <ChevronRight24Regular className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stats.topContacts.map((contact, i) => (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="flex items-center gap-3 p-3 bg-th-surface border border-th-border rounded-xl hover:bg-th-surface-h transition-all duration-200 animate-slide-up-fade group"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="relative flex-shrink-0">
                  <Avatar src={contact.avatarUrl} name={contact.name} size="md" />
                  {contact.isFavorite && (
                    <Star24Filled className="absolute -top-1 -end-1 w-3.5 h-3.5 text-yellow-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-emerald-400 transition-colors">
                    {contact.name}
                  </p>
                  <p className="text-xs text-white/50 truncate">
                    {contact.jobTitle}{contact.jobTitle && contact.company ? ' · ' : ''}{contact.company}
                  </p>
                </div>
                {contact.matchScore != null && contact.matchScore > 0 && (
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    contact.matchScore >= 75 ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' :
                    contact.matchScore >= 50 ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' :
                    'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                  }`}>
                    {contact.matchScore}%
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <People24Regular className="w-16 h-16 text-red-400/40 mb-4" />
          <h3 className="text-lg font-semibold text-white/70 mb-2">
            {t.common?.error || 'Something went wrong'}
          </h3>
          <p className="text-sm text-white/40 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
          >
            {'Retry'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {stats.totalContacts === 0 && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <People24Regular className="w-16 h-16 text-white/20 mb-4" />
          <h3 className="text-lg font-semibold text-white/70 mb-2">
            {ts?.noContacts || 'No contacts in this sector'}
          </h3>
          <p className="text-sm text-white/40 mb-4">
            {ts?.noContactsDesc || 'Add contacts and assign them to this sector'}
          </p>
          <Link
            href="/contacts/add"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
          >
            <PersonAdd24Regular className="w-5 h-5" />
            {t.dashboard.addContact || 'Add Contact'}
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function StatTile({
  icon, label, value, sub, gradient,
}: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; gradient: string;
}) {
  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-4 animate-scale-in">
      <div className={`w-9 h-9 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center text-white mb-2`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/50 mt-0.5">{label}{sub && <span className="text-white/30 ms-1">{sub}</span>}</p>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-3 text-center animate-scale-in">
      <span className="text-lg">{icon}</span>
      <p className="text-lg font-bold text-white mt-1">{value}</p>
      <p className="text-[11px] text-white/50">{label}</p>
    </div>
  );
}
