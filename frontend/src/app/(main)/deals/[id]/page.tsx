/**
 * Deal Detail Page
 *
 * View deal details and match results.
 * Uses same card + popup pattern as pitch matching.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  People24Regular,
  Copy24Regular,
  Checkmark24Regular,
  CheckmarkCircle24Regular,
  Dismiss24Regular,
  Send24Regular,
  ArrowSync24Regular,
  Briefcase24Regular,
  Building24Regular,
  ChevronRight24Regular,
  Sparkle24Regular,
  Mail24Regular,
  BookmarkAdd24Regular,
} from '@fluentui/react-icons';
import {
  getDealResults,
  calculateDealMatches,
  updateDealMatchStatus,
  Deal,
  DealMatchResult,
  DealMatchStatus,
  DealMatchCategory,
  getCategoryLabel,
  getCategoryColor,
  getModeColor,
} from '@/lib/api/deals';
import { toast } from '@/components/ui/Toast';
import CollaborateButton from '@/components/features/collaboration/CollaborateButton';
import { MatchActionBar, EditableIceBreakers, MatchCard as SharedMatchCard, type MatchCardData } from '@/components/features/matches';
import TeamMembersList from '@/components/features/collaboration/TeamMembersList';

/** Map DealMatchResult to MatchCardData for the shared MatchCard */
function dealMatchToCardData(result: DealMatchResult, dealTitle: string): MatchCardData {
  const contact = result.contact;
  return {
    id: result.id,
    source: 'deal',
    sourceTitle: dealTitle,
    score: result.score || 0,
    contactId: contact.id || '',
    name: contact.fullName || contact.name || 'Unknown',
    company: contact.company || undefined,
    jobTitle: contact.jobTitle || undefined,
    reasons: result.reasons?.map((r: any) => typeof r === 'string' ? r : r.text) || [],
    sharedSectors: [],
    sharedSkills: [],
    status: result.status,
    channels: {
      phone: contact.phone || null,
      email: contact.email || null,
      linkedinUrl: contact.linkedinUrl || null,
    },
  };
}

function DealMatchCard({
  result,
  onClick,
  index,
  dealTitle,
  onStatusChange,
}: {
  result: DealMatchResult;
  onClick: () => void;
  index: number;
  dealTitle: string;
  onStatusChange?: (id: string, status: string) => void;
}) {
  const { t } = useI18n();
  const cardData = dealMatchToCardData(result, dealTitle);
  const staggerClass = `stagger-${Math.min(index + 1, 10)}`;

  return (
    <div className={`animate-deal-card-enter ${staggerClass} ${result.status === 'IGNORED' ? 'opacity-50' : ''}`}>
      <SharedMatchCard match={cardData} onClick={onClick} onStatusChange={onStatusChange} hideSource t={t} />
    </div>
  );
}

/**
 * Deal Match Detail Modal — same style as PitchMatchDetailModal
 */
function DealMatchDetailModal({
  result,
  deal,
  onClose,
  onStatusChange,
}: {
  result: DealMatchResult;
  deal: Deal | null;
  onClose: () => void;
  onStatusChange: (id: string, status: DealMatchStatus) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const contact = result.contact;
  const isSell = deal?.mode === 'SELL';

  const modalGradient = isSell
    ? 'from-emerald-900/50 to-green-900/50'
    : 'from-blue-900/50 to-cyan-900/50';

  const avatarRing = isSell
    ? 'from-emerald-500 to-green-400'
    : 'from-blue-500 to-cyan-400';

  const handleStatusChange = async (status: DealMatchStatus) => {
    setIsUpdating(true);
    try {
      await updateDealMatchStatus(result.id, { status });
      onStatusChange(result.id, status);
      toast({ title: t.deals?.matchStatusUpdated || 'Status updated', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleViewContact = () => {
    if (contact.id) {
      router.push(`/contacts/${contact.id}`);
    }
    onClose();
  };

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({ title: t.common?.copied || 'Copied!', variant: 'success' });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const openerLines = (result.openerEdited || result.openerMessage || '').split('\n').filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[calc(100%-2rem)] max-w-lg bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-th-border">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarRing} flex-shrink-0 flex items-center justify-center overflow-hidden`}>
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt={contact.fullName || contact.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-white">
                {(contact.fullName || contact.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-th-text truncate">{contact.fullName || contact.name || 'Unknown'}</h2>
            <p className="text-xs text-th-text-t truncate">
              {[contact.jobTitle, contact.company].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-th-surface-h text-th-text-t">
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Category Tag */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getCategoryColor(result.category)}`}>
            <Sparkle24Regular className="w-3.5 h-3.5" />
            {getCategoryLabel(result.category)}
          </span>

          {/* Deal Context */}
          {deal && (
            <div className={`${isSell ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-blue-500/10 border-blue-500/20'} border rounded-lg p-3`}>
              <p className="text-sm text-th-text-s">{deal.title || deal.productName || deal.solutionType || 'Deal'}</p>
              {deal.domain && (
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${isSell ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                  {deal.domain}
                </span>
              )}
            </div>
          )}

          {/* Why This Is a Good Match */}
          {result.reasons.length > 0 && (
            <div className="space-y-2">
              {result.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckmarkCircle24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-200">{reason.text}</p>
                    {reason.evidence && (
                      <p className="text-xs text-th-text-t mt-0.5">{reason.evidence}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ice Breaker / Opener Messages */}
          <EditableIceBreakers
            iceBreakers={openerLines}
            accentColor="sky"
            label="Suggested Outreach Messages"
            onSave={async (text) => {
              await updateDealMatchStatus(result.id, { status: result.status, openerEdited: text });
            }}
          />

          {/* Actions */}
          <MatchActionBar
            currentStatus={result.status}
            contactName={contact.fullName}
            channels={{ phone: contact.phone, email: contact.email, linkedinUrl: contact.linkedinUrl }}
            onStatusChange={(status) => handleStatusChange(status as DealMatchStatus)}
            isUpdating={isUpdating}
            dismissStatus="IGNORED"
            t={t}
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-th-border">
          <button
            onClick={handleViewContact}
            className={`w-full px-3 py-2 bg-gradient-to-r ${isSell ? 'from-emerald-500 to-green-500' : 'from-blue-500 to-cyan-500'} text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1.5`}
          >
            View Contact Details
            <ChevronRight24Regular className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [results, setResults] = useState<DealMatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [summary, setSummary] = useState<{ totalMatches: number; avgScore: number; topCategory: DealMatchCategory | null } | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<DealMatchResult | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'collaborators'>('matches');
  const [matchStatusFilter, setMatchStatusFilter] = useState<'active' | 'archived' | 'dismissed'>('active');

  const fetchData = async () => {
    if (!params.id) return;
    setIsLoading(true);
    try {
      const data = await getDealResults(params.id);
      setDeal(data.deal);
      setResults(data.results);
      setSummary(data.summary);

      // If still processing, poll for updates
      if (data.deal.status === 'PROCESSING') {
        setTimeout(fetchData, 3000);
      }
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const handleRecalculate = async () => {
    if (!params.id) return;
    setIsCalculating(true);
    try {
      await calculateDealMatches(params.id);
      toast({ title: 'Recalculating matches...', variant: 'success' });
      setTimeout(fetchData, 2000);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleStatusChange = (id: string, status: DealMatchStatus) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    // Also update selected match if open
    setSelectedMatch((prev) =>
      prev && prev.id === id ? { ...prev, status } : prev
    );
  };

  const isSell = deal?.mode === 'SELL';

  if (isLoading && !deal) {
    return (
      <div className="space-y-4 animate-fade-in pb-20">
        <div className="flex items-center gap-4">
          <Link
            href="/deals"
            className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
          >
            <ArrowLeft24Regular className="w-6 h-6" />
          </Link>
          <div className="h-8 bg-th-surface-h rounded w-48 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-th-surface border border-th-border rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-th-surface-h rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-th-surface-h rounded w-1/3" />
                  <div className="h-4 bg-th-surface-h rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-th-text-t">Deal not found</p>
        <Link href="/deals" className="text-emerald-400 hover:underline mt-2 inline-block">
          Back to deals
        </Link>
      </div>
    );
  }

  const heroGradient = isSell
    ? 'from-emerald-900/30 via-th-bg-s to-green-900/20'
    : 'from-blue-900/30 via-th-bg-s to-cyan-900/20';

  const heroGlow = isSell
    ? 'bg-emerald-500/20'
    : 'bg-blue-500/20';

  const modeBadge = isSell
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : 'bg-blue-500/20 text-blue-400 border-blue-500/30';

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Hero Header */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${heroGradient} border border-th-border p-6`}>
        {/* Glow orb */}
        <div className={`absolute -top-10 -end-10 w-32 h-32 ${heroGlow} rounded-full blur-3xl`} />

        <div className="relative space-y-3">
          <div className="flex items-start gap-3">
            <Link
              href="/deals"
              className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors flex-shrink-0"
            >
              <ArrowLeft24Regular className="w-6 h-6" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-th-text">
                  {deal.title || deal.productName || deal.solutionType || 'Deal'}
                </h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${modeBadge}`}>
                  {deal.mode === 'SELL' ? (t.deals?.sell || 'Sell') : (t.deals?.buy || 'Buy')}
                </span>
              </div>
              {deal.domain && (
                <p className="text-sm text-th-text-t mt-0.5">{deal.domain}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CollaborateButton
              sourceType="DEAL"
              sourceId={params.id}
              sourceTitle={deal.title || deal.productName || 'Deal'}
              variant="secondary"
              size="md"
            />
            <button
              onClick={handleRecalculate}
              disabled={isCalculating || deal.status === 'PROCESSING'}
              className="flex items-center gap-2 px-4 py-2 bg-th-surface border border-th-border text-th-text-s font-medium rounded-xl hover:bg-th-surface-h hover:text-th-text transition-all disabled:opacity-50"
            >
              <ArrowSync24Regular className={`w-5 h-5 ${isCalculating || deal.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
              {t.deals?.recalculate || 'Recalculate'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-th-surface rounded-xl p-1">
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'matches'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
          }`}
        >
          <Sparkle24Regular className="w-4 h-4" />
          {t.deals?.matches || 'Matches'}
          {results.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${activeTab === 'matches' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {results.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('collaborators')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'collaborators'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
          }`}
        >
          <People24Regular className="w-4 h-4" />
          Collaborators
        </button>
      </div>

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <>
          {/* Summary Stats */}

          {/* Processing State */}
          {deal.status === 'PROCESSING' && (
            <div className={`relative overflow-hidden ${isSell ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-blue-500/10 border-blue-500/30'} border rounded-xl p-4`}>
              {/* Shimmer bar at top */}
              <div className="absolute top-0 inset-x-0 h-1 overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${isSell ? 'from-transparent via-emerald-400 to-transparent' : 'from-transparent via-blue-400 to-transparent'} animate-gradient-shimmer`} />
              </div>

              <div className="flex items-center gap-3 mt-1">
                <ArrowSync24Regular className={`w-6 h-6 ${isSell ? 'text-emerald-400' : 'text-blue-400'} animate-spin`} />
                <div className="flex-1">
                  <p className={`${isSell ? 'text-emerald-400' : 'text-blue-400'} font-medium`}>{t.deals?.calculating || 'Calculating matches...'}</p>
                  {deal.progress && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`${isSell ? 'text-emerald-400/70' : 'text-blue-400/70'}`}>{deal.progress.currentStep}</span>
                        <span className={`${isSell ? 'text-emerald-400/70' : 'text-blue-400/70'}`}>{deal.progress.overall}%</span>
                      </div>
                      <div className="h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${isSell ? 'from-emerald-500 to-green-400' : 'from-blue-500 to-cyan-400'} rounded-full transition-all duration-500`}
                          style={{ width: `${deal.progress.overall}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Match Status Filter Counts */}
          {(() => {
            const activeResults = results.filter((r) => r.status !== 'IGNORED' && r.status !== 'ARCHIVED');
            const archivedResults = results.filter((r) => r.status === 'ARCHIVED');
            const dismissedResults = results.filter((r) => r.status === 'IGNORED');
            const filteredResults =
              matchStatusFilter === 'active' ? activeResults
              : matchStatusFilter === 'archived' ? archivedResults
              : dismissedResults;
            const activeResultsCount = activeResults.length;
            const archivedResultsCount = archivedResults.length;
            const dismissedResultsCount = dismissedResults.length;

            return (
              <>
                {/* Match Status Tabs */}
                <div className="flex gap-1 p-1 bg-th-surface rounded-xl">
                  {([
                    { id: 'active' as const, label: 'Active', count: activeResultsCount },
                    { id: 'archived' as const, label: 'Archived', count: archivedResultsCount },
                    { id: 'dismissed' as const, label: 'Dismissed', count: dismissedResultsCount },
                  ]).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setMatchStatusFilter(tab.id)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        matchStatusFilter === tab.id
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                          : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                {/* Results */}
                {filteredResults.length > 0 ? (
                  <div className="space-y-2">
                    {filteredResults.map((result, index) => (
                      <DealMatchCard
                        key={result.id}
                        result={result}
                        onClick={() => setSelectedMatch(result)}
                        index={index}
                        dealTitle={deal?.title || deal?.productName || 'Deal'}
                        onStatusChange={async (id, status) => {
                          try {
                            await updateDealMatchStatus(result.id, { status: status as DealMatchStatus });
                            handleStatusChange(result.id, status as DealMatchStatus);
                            toast({ title: t.deals?.matchStatusUpdated || 'Status updated', variant: 'success' });
                          } catch (error: any) {
                            toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : deal.status !== 'PROCESSING' && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-neutral-900/50 to-neutral-900/80 backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 ${heroGlow} rounded-full blur-3xl opacity-50`} />
                    <div className="relative">
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${isSell ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-blue-500/10 border-blue-500/30'} border flex items-center justify-center`}>
                        <Briefcase24Regular className={`w-8 h-8 ${isSell ? 'text-emerald-400' : 'text-blue-400'}`} />
                      </div>
                      <p className="text-th-text-s text-lg font-medium">{t.deals?.noMatches || 'No matches found'}</p>
                      <p className="text-sm text-th-text-m mt-1">
                        {t.deals?.noMatchesDesc || 'Try adding more contacts or adjusting your criteria'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* Collaborators Tab */}
      {activeTab === 'collaborators' && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
          <TeamMembersList
            sourceType="DEAL"
            sourceId={params.id}
            isOwner={true}
          />
        </div>
      )}

      {/* Match Detail Modal */}
      {selectedMatch && (
        <DealMatchDetailModal
          result={selectedMatch}
          deal={deal}
          onClose={() => setSelectedMatch(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
