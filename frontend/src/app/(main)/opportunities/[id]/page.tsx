/**
 * Opportunity Detail Page
 *
 * Shows opportunity details and its matches with filtering options.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  ArrowSync24Regular,
  Edit24Regular,
  Sparkle24Regular,
  PersonAdd24Regular,
  Briefcase24Regular,
  Star24Regular,
  PeopleTeam24Regular,
  Location24Regular,
  Clock24Regular,
  People24Regular,
  Filter24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  BookmarkAdd24Regular,
  Chat24Regular,
  Search24Regular,
} from '@fluentui/react-icons';
import {
  getOpportunity,
  getOpportunityMatches,
  findOpportunityMatches,
  updateMatchStatus,
  Opportunity,
  OpportunityMatch,
  OpportunityMatchStatus,
  OpportunityIntentType,
  INTENT_TYPE_OPTIONS,
} from '@/lib/api/opportunities';
import MatchDetailModal from '@/components/opportunities/MatchDetailModal';
import { toast } from '@/components/ui/Toast';
import CollaborateButton from '@/components/features/collaboration/CollaborateButton';
import TeamMembersList from '@/components/features/collaboration/TeamMembersList';
import { MatchActionBar, MatchCard as SharedMatchCard, type MatchCardData, applyLocalStatuses } from '@/components/features/matches';

/**
 * Intent type icon mapping
 */
const INTENT_ICONS: Record<OpportunityIntentType, React.ReactNode> = {
  HIRING: <PersonAdd24Regular className="w-6 h-6" />,
  OPEN_TO_OPPORTUNITIES: <Briefcase24Regular className="w-6 h-6" />,
  ADVISORY_BOARD: <Star24Regular className="w-6 h-6" />,
  REFERRALS_ONLY: <PeopleTeam24Regular className="w-6 h-6" />,
};

/**
 * Intent type colors
 */
const INTENT_COLORS: Record<OpportunityIntentType, string> = {
  HIRING: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
  OPEN_TO_OPPORTUNITIES: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
  ADVISORY_BOARD: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
  REFERRALS_ONLY: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
};

/**
 * Format date to relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

/** Map OpportunityMatch to shared MatchCardData */
function opportunityMatchToCardData(match: OpportunityMatch, oppTitle: string): MatchCardData {
  return {
    id: `job-${match.id}`,
    source: 'job',
    sourceTitle: oppTitle,
    score: match.matchScore,
    contactId: match.candidate?.id || '',
    name: match.candidate.fullName,
    company: match.candidate.company || undefined,
    jobTitle: match.candidate.jobTitle || undefined,
    reasons: match.reasons || [],
    sharedSectors: match.sharedSectors || [],
    sharedSkills: match.sharedSkills || [],
    status: match.status,
    channels: {
      phone: (match.candidate as any).phone || null,
      email: (match.candidate as any).email || null,
      linkedinUrl: (match.candidate as any).linkedinUrl || null,
    },
  };
}

const STORAGE_KEY = 'matches-local-statuses';

function getLocalStatuses(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveLocalStatuses(statuses: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
}

function MatchCard({
  match,
  onViewDetails,
  onStatusChange,
}: {
  match: OpportunityMatch;
  onViewDetails: () => void;
  onStatusChange: (matchId: string, status: OpportunityMatchStatus) => void;
}) {
  const { t } = useI18n();

  const handleStatusChange = (id: string, status: string) => {
    const localStatuses = getLocalStatuses();
    if (status === 'ACTIVE') {
      delete localStatuses[id];
    } else {
      localStatuses[id] = status;
    }
    saveLocalStatuses(localStatuses);
    onStatusChange(match.id, (status === 'ACTIVE' ? 'PENDING' : status) as OpportunityMatchStatus);
  };

  const cardData = opportunityMatchToCardData(match, '');
  return (
    <SharedMatchCard
      match={cardData}
      onClick={onViewDetails}
      onStatusChange={handleStatusChange}
      hideSource
      t={t}
    />
  );
}

/**
 * Main Opportunity Detail Page
 */
export default function OpportunityDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const opportunityId = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [findingMatches, setFindingMatches] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<OpportunityMatch | null>(null);
  const [statusFilter, setStatusFilter] = useState<OpportunityMatchStatus | 'ALL'>('ALL');
  const [minScore, setMinScore] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'matches' | 'collaborators'>('matches');
  const [matchStatusFilter, setMatchStatusFilter] = useState<'active' | 'archived' | 'dismissed'>('active');

  // Load opportunity and matches
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [oppData, matchesData] = await Promise.all([
          getOpportunity(opportunityId),
          getOpportunityMatches(opportunityId),
        ]);
        setOpportunity(oppData);
        // Apply local statuses from localStorage
        const localStatuses = getLocalStatuses();
        const matchesWithStatus = matchesData.matches.map((m: OpportunityMatch) => {
          const localKey = `job-${m.id}`;
          if (localStatuses[localKey]) {
            return { ...m, status: localStatuses[localKey] as OpportunityMatchStatus };
          }
          return m;
        });
        setMatches(matchesWithStatus);
      } catch (error: any) {
        toast({
          title: t.common?.error || 'Error',
          description: error.message || 'Failed to load opportunity',
          variant: 'error',
        });
        router.push('/opportunities');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [opportunityId, router, t]);

  // Handle find matches
  const handleFindMatches = async () => {
    try {
      setFindingMatches(true);
      const result = await findOpportunityMatches(opportunityId);
      setMatches(result.matches);
      if (opportunity) {
        setOpportunity({
          ...opportunity,
          matchCount: result.matchCount,
          lastMatchedAt: new Date().toISOString(),
        });
      }
      toast({
        title: t.opportunities?.matchesFound || 'Matches found',
        description: `${result.matchCount} ${t.opportunities?.potentialMatches || 'potential matches'}`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: t.common?.error || 'Error',
        description: error.message,
        variant: 'error',
      });
    } finally {
      setFindingMatches(false);
    }
  };

  // Handle status change
  const handleStatusChange = (matchId: string, status: OpportunityMatchStatus) => {
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, status } : m))
    );
    if (selectedMatch?.id === matchId) {
      setSelectedMatch({ ...selectedMatch, status });
    }
  };

  // Compute match status category counts (before other filters)
  const activeMatchCount = matches.filter((m) => m.status !== 'DISMISSED' && (m.status as string) !== 'ARCHIVED').length;
  const archivedMatchCount = matches.filter((m) => (m.status as string) === 'ARCHIVED').length;
  const dismissedMatchCount = matches.filter((m) => m.status === 'DISMISSED').length;

  // Filter matches
  const filteredMatches = matches
    .filter((m) => {
      if (matchStatusFilter === 'active') return m.status !== 'DISMISSED' && (m.status as string) !== 'ARCHIVED';
      if (matchStatusFilter === 'archived') return (m.status as string) === 'ARCHIVED';
      if (matchStatusFilter === 'dismissed') return m.status === 'DISMISSED';
      return true;
    })
    .filter((m) => m.matchScore >= minScore);

  // Calculate stats
  const stats = {
    total: matches.length,
    byStatus: {
      PENDING: matches.filter((m) => m.status === 'PENDING').length,
      CONTACTED: matches.filter((m) => m.status === 'CONTACTED').length,
      SAVED: matches.filter((m) => m.status === 'SAVED').length,
      CONNECTED: matches.filter((m) => m.status === 'CONNECTED').length,
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!opportunity) {
    return null;
  }

  const intentLabel = INTENT_TYPE_OPTIONS.find(o => o.id === opportunity.intentType)?.label || opportunity.intentType;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/opportunities')}
        className="flex items-center gap-2 text-th-text-t hover:text-th-text transition-colors text-sm"
      >
        <ArrowLeft24Regular className="w-4 h-4" />
        {t.opportunities?.backToList || 'Back to Jobs'}
      </button>

      {/* Opportunity Header - mobile-friendly stacked layout */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          {/* Icon */}
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${INTENT_COLORS[opportunity.intentType]}`}>
            {INTENT_ICONS[opportunity.intentType]}
          </div>

          {/* Title + actions */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-th-text truncate">{opportunity.title}</h1>
              {!opportunity.isActive && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">
                  Inactive
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => router.push(`/opportunities/${opportunityId}/edit`)}
            className="p-2 rounded-lg bg-th-surface-h text-th-text-t hover:text-th-text transition-colors flex-shrink-0"
          >
            <Edit24Regular className="w-4 h-4" />
          </button>
        </div>

        {/* Meta info - wrapping tags */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-th-text-t">
          <span className={`px-2 py-0.5 rounded-full border ${INTENT_COLORS[opportunity.intentType]}`}>
            {intentLabel}
          </span>
          {opportunity.roleArea && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold text-xs">{opportunity.roleArea}</span>
          )}
          {opportunity.locationPref && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold text-xs">
              <Location24Regular className="w-3 h-3" />
              {opportunity.locationPref}
              {opportunity.remoteOk && ' (Remote)'}
            </span>
          )}
        </div>

        {opportunity.lastMatchedAt && (
          <p className="text-[10px] text-emerald-400 mt-2">
            Last matched: {formatRelativeTime(opportunity.lastMatchedAt)}
          </p>
        )}

        {/* Sectors & Skills */}
        {(opportunity.sectors.length > 0 || opportunity.skills.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-th-border">
            {opportunity.sectors.map((sector) => (
              <span
                key={sector.id}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold"
              >
                {sector.name}
              </span>
            ))}
            {opportunity.skills.filter((s) => s.isRequired !== false).map((skill) => (
              <span
                key={skill.id}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold"
              >
                ★ {skill.name}
              </span>
            ))}
            {opportunity.skills.filter((s) => s.isRequired === false).map((skill) => (
              <span
                key={skill.id}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold"
              >
                {skill.name}
              </span>
            ))}
          </div>
        )}

        {/* Advanced Fields */}
        {(opportunity.languages?.length || opportunity.certifications?.length || opportunity.educationLevels?.length || opportunity.industries?.length || opportunity.salaryMin || opportunity.salaryMax || opportunity.noticePeriod || opportunity.relevantExperience) && (
          <div className="mt-3 pt-3 border-t border-th-border space-y-2">
            {opportunity.languages && opportunity.languages.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Languages:</span>
                {opportunity.languages.map((lang: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{lang}</span>
                ))}
              </div>
            )}
            {opportunity.certifications && opportunity.certifications.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Certifications:</span>
                {opportunity.certifications.map((cert: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{cert}</span>
                ))}
              </div>
            )}
            {opportunity.educationLevels && opportunity.educationLevels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Education:</span>
                {opportunity.educationLevels.map((edu: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{edu}</span>
                ))}
              </div>
            )}
            {opportunity.industries && opportunity.industries.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Industries:</span>
                {opportunity.industries.map((ind: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{ind}</span>
                ))}
              </div>
            )}
            {(opportunity.salaryMin || opportunity.salaryMax) && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Salary:</span>
                <span className="text-xs text-white font-bold">
                  {opportunity.salaryMin && opportunity.salaryMax
                    ? `${opportunity.salaryMin.toLocaleString()} – ${opportunity.salaryMax.toLocaleString()}`
                    : opportunity.salaryMin
                      ? `From ${opportunity.salaryMin.toLocaleString()}`
                      : `Up to ${opportunity.salaryMax!.toLocaleString()}`}
                  {opportunity.salaryCurrency ? ` ${opportunity.salaryCurrency}` : ''}
                </span>
              </div>
            )}
            {opportunity.noticePeriod && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Notice:</span>
                <span className="text-xs text-white font-bold">{opportunity.noticePeriod}</span>
              </div>
            )}
            {opportunity.relevantExperience && (
              <div>
                <span className="text-xs text-white font-bold uppercase">Experience:</span>
                <p className="text-xs text-white font-bold mt-0.5 leading-relaxed">{opportunity.relevantExperience}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-th-surface border border-th-border rounded-xl p-1">
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'matches'
              ? 'bg-emerald-400 text-[#042820] font-bold'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
          }`}
        >
          <Sparkle24Regular className="w-4 h-4" />
          {t.opportunities?.matches || 'Matches'}
          {stats.total > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'matches' ? 'bg-white/20' : 'bg-th-surface-h'}`}>
              {stats.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('collaborators')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'collaborators'
              ? 'bg-emerald-400 text-[#042820] font-bold'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
          }`}
        >
          <PeopleTeam24Regular className="w-4 h-4" />
          Collabs
        </button>
      </div>

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          {/* Match Status Tabs */}
          <div className="flex gap-1 p-1 bg-th-surface border border-th-border rounded-xl">
            {([
              { id: 'active' as const, label: 'Active', count: activeMatchCount },
              { id: 'archived' as const, label: 'Archived', count: archivedMatchCount },
              { id: 'dismissed' as const, label: 'Dismissed', count: dismissedMatchCount },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMatchStatusFilter(tab.id)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  matchStatusFilter === tab.id
                    ? 'bg-emerald-400 text-[#042820] font-bold'
                    : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Matches Header */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-sm bg-green-500 text-black font-bold">
              {filteredMatches.length} of {stats.total}
            </span>
            <button
              onClick={handleFindMatches}
              disabled={findingMatches || !opportunity.isActive}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-500 disabled:opacity-50 text-[#042820] text-sm font-bold transition-colors"
            >
              {findingMatches ? (
                <ArrowSync24Regular className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkle24Regular className="w-4 h-4" />
              )}
              {t.opportunities?.findMatches || 'Find Matches'}
            </button>
            <CollaborateButton
              sourceType="OPPORTUNITY"
              sourceId={opportunityId}
              sourceTitle={opportunity.title}
              variant="secondary"
              size="sm"
            />
          </div>

          {/* Score Filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {([
              { value: 0, label: 'All', bg: 'bg-emerald-400', text: 'text-[#042820]', border: 'border-emerald-400' },
              { value: 90, label: 'Excellent 90%+', bg: 'bg-[#22C55E]', text: 'text-black', border: 'border-[#22C55E]' },
              { value: 75, label: 'Strong 75%+', bg: 'bg-[#84CC16]', text: 'text-black', border: 'border-[#84CC16]' },
              { value: 60, label: 'Very Good 60%+', bg: 'bg-[#FACC15]', text: 'text-black', border: 'border-[#FACC15]' },
              { value: 40, label: 'Good 40%+', bg: 'bg-[#FB923C]', text: 'text-black', border: 'border-[#FB923C]' },
            ]).map((tier) => (
              <button
                key={tier.value}
                onClick={() => setMinScore(minScore === tier.value ? 0 : tier.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 border ${
                  minScore === tier.value
                    ? `${tier.bg} ${tier.text} ${tier.border}`
                    : 'bg-th-surface border-th-border text-white hover:bg-th-surface-h'
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>

          {/* Matches List */}
          {filteredMatches.length > 0 ? (
            <div className="grid gap-3">
              {filteredMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onViewDetails={() => setSelectedMatch(match)}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          ) : matches.length > 0 ? (
            <div className="text-center py-12 bg-th-surface rounded-xl border border-th-border">
              <Search24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
              <p className="text-th-text-t">
                {t.opportunities?.noMatchesFilter || 'No matches with current filters'}
              </p>
            </div>
          ) : (
            <div className="text-center py-12 bg-th-surface rounded-xl border border-th-border">
              <People24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
              <p className="text-th-text-t mb-4">
                {t.opportunities?.noMatchesYet || 'No matches yet'}
              </p>
              <button
                onClick={handleFindMatches}
                disabled={findingMatches || !opportunity.isActive}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-500 disabled:opacity-50 text-[#042820] font-bold transition-colors"
              >
                {findingMatches ? (
                  <ArrowSync24Regular className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkle24Regular className="w-5 h-5" />
                )}
                {t.opportunities?.findMatches || 'Find Matches'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collaborators Tab */}
      {activeTab === 'collaborators' && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <TeamMembersList
            sourceType="OPPORTUNITY"
            sourceId={opportunityId}
            isOwner={true}
          />
        </div>
      )}

      {/* Match Detail Modal */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
