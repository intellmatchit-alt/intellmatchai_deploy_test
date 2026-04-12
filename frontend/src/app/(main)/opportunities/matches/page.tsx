/**
 * All Matches Page
 *
 * Shows all matches across all opportunities with comprehensive filtering.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  ArrowSync24Regular,
  PersonAdd24Regular,
  Briefcase24Regular,
  Star24Regular,
  PeopleTeam24Regular,
  Filter24Regular,
  Search24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  BookmarkAdd24Regular,
  Chat24Regular,
  ArrowSort24Regular,
  People24Regular,
} from '@fluentui/react-icons';
import {
  listOpportunities,
  getOpportunityMatches,
  updateMatchStatus,
  Opportunity,
  OpportunityMatch,
  OpportunityMatchStatus,
  OpportunityIntentType,
  INTENT_TYPE_OPTIONS,
} from '@/lib/api/opportunities';
import { toast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';
import { useItemizedMatch } from '@/hooks/itemized-matching';
import { Sparkle24Regular, Location24Regular, Mail24Regular, Lightbulb24Regular, Copy24Regular } from '@fluentui/react-icons';
import { MatchActionBar, EditableIceBreakers, MatchCard as SharedMatchCard, type MatchCardData } from '@/components/features/matches';
import { updateMatchIceBreakers as updateOpportunityMatchIceBreakers } from '@/lib/api/opportunities';

/**
 * Intent type colors
 */
const INTENT_COLORS: Record<OpportunityIntentType, string> = {
  HIRING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  OPEN_TO_OPPORTUNITIES: 'bg-green-500/20 text-green-400 border-green-500/30',
  ADVISORY_BOARD: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  REFERRALS_ONLY: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

/**
 * Score color based on value
 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-400 bg-green-500/20 border-green-500/30';
  if (score >= 75) return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
  if (score >= 60) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
  return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
}

/**
 * Extended match with opportunity info
 */
interface ExtendedMatch extends OpportunityMatch {
  opportunityTitle: string;
  opportunityType: OpportunityIntentType;
}

/** Map ExtendedMatch to MatchCardData for the shared MatchCard */
function opportunityMatchToCardData(match: ExtendedMatch): MatchCardData {
  return {
    id: match.id,
    source: 'job',
    sourceTitle: match.opportunityTitle,
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

function OpportunityMatchCard({
  match,
  onViewDetails,
  onStatusChange,
}: {
  match: ExtendedMatch;
  onViewDetails: () => void;
  onStatusChange: (matchId: string, opportunityId: string, status: OpportunityMatchStatus) => void;
}) {
  const { t } = useI18n();

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateMatchStatus(match.opportunityId, match.id, status as OpportunityMatchStatus);
      onStatusChange(match.id, match.opportunityId, status as OpportunityMatchStatus);
      toast({ title: t.common?.success || 'Success', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    }
  };

  const cardData = opportunityMatchToCardData(match);
  return (
    <SharedMatchCard
      match={cardData}
      onClick={onViewDetails}
      onStatusChange={handleStatusChange}
      t={t}
    />
  );
}

/**
 * Main All Matches Page
 */
export default function AllMatchesPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [allMatches, setAllMatches] = useState<ExtendedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<ExtendedMatch | null>(null);
  const [copiedIceBreaker, setCopiedIceBreaker] = useState<number | null>(null);

  // Itemized match for modal
  const { match: itemizedMatch, isLoading: isLoadingItemized, fetchMatch: fetchItemizedMatch, clearMatch } = useItemizedMatch();

  // Filters
  const [statusFilter, setStatusFilter] = useState<OpportunityMatchStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<OpportunityIntentType | 'ALL'>('ALL');
  const [opportunityFilter, setOpportunityFilter] = useState<string>('ALL');
  const [minScore, setMinScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');

  // Load all data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const oppResult = await listOpportunities({ status: 'all' });
        setOpportunities(oppResult.opportunities);

        // Load matches for each opportunity
        const matchPromises = oppResult.opportunities.map(async (opp) => {
          try {
            const matchesResult = await getOpportunityMatches(opp.id);
            return matchesResult.matches.map((match) => ({
              ...match,
              opportunityId: opp.id,
              opportunityTitle: opp.title,
              opportunityType: opp.intentType,
            }));
          } catch {
            return [];
          }
        });

        const allMatchesArrays = await Promise.all(matchPromises);
        const flatMatches = allMatchesArrays.flat();
        setAllMatches(flatMatches);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast({
          title: t.common?.error || 'Error',
          description: 'Failed to load matches',
          variant: 'error',
        });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [t]);

  // Fetch itemized match when modal opens
  useEffect(() => {
    if (selectedMatch?.candidate?.id) {
      fetchItemizedMatch(selectedMatch.candidate.id);
    } else {
      clearMatch();
    }
  }, [selectedMatch?.candidate?.id]);

  // Handle copy ice breaker
  const handleCopyIceBreaker = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIceBreaker(index);
    setTimeout(() => setCopiedIceBreaker(null), 2000);
  };

  // Handle status change
  const handleStatusChange = (matchId: string, opportunityId: string, status: OpportunityMatchStatus) => {
    setAllMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, status } : m))
    );
    if (selectedMatch?.id === matchId) {
      setSelectedMatch({ ...selectedMatch, status });
    }
  };

  // Apply filters and sorting
  const filteredMatches = allMatches
    .filter((m) => statusFilter === 'ALL' || m.status === statusFilter)
    .filter((m) => typeFilter === 'ALL' || m.opportunityType === typeFilter)
    .filter((m) => opportunityFilter === 'ALL' || m.opportunityId === opportunityFilter)
    .filter((m) => m.matchScore >= minScore)
    .sort((a, b) => {
      if (sortBy === 'score') {
        return b.matchScore - a.matchScore;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Calculate stats
  const stats = {
    total: allMatches.length,
    pending: allMatches.filter((m) => m.status === 'PENDING').length,
    contacted: allMatches.filter((m) => m.status === 'CONTACTED').length,
    saved: allMatches.filter((m) => m.status === 'SAVED').length,
    connected: allMatches.filter((m) => m.status === 'CONNECTED').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/opportunities')}
          className="flex items-center gap-2 text-th-text-t hover:text-th-text mb-4 transition-colors"
        >
          <ArrowLeft24Regular className="w-5 h-5" />
          {t.opportunities?.backToOpportunities || 'Back to Opportunities'}
        </button>
        <h1 className="text-2xl font-bold text-th-text">
          {t.opportunities?.allMatches || 'All Matches'}
        </h1>
        <p className="text-th-text-t mt-1">
          {t.opportunities?.allMatchesDesc || 'View and manage matches across all your opportunities'}
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-th-surface rounded-xl p-3 border border-th-border text-center">
          <div className="text-xl font-bold text-th-text">{stats.total}</div>
          <div className="text-xs text-th-text-t">Total</div>
        </div>
        <div className="bg-th-surface rounded-xl p-3 border border-th-border text-center">
          <div className="text-xl font-bold text-th-text-t">{stats.pending}</div>
          <div className="text-xs text-th-text-t">Pending</div>
        </div>
        <div className="bg-th-surface rounded-xl p-3 border border-th-border text-center">
          <div className="text-xl font-bold text-yellow-400">{stats.saved}</div>
          <div className="text-xs text-th-text-t">Saved</div>
        </div>
        <div className="bg-th-surface rounded-xl p-3 border border-th-border text-center">
          <div className="text-xl font-bold text-blue-400">{stats.contacted}</div>
          <div className="text-xs text-th-text-t">Contacted</div>
        </div>
        <div className="bg-th-surface rounded-xl p-3 border border-th-border text-center">
          <div className="text-xl font-bold text-green-400">{stats.connected}</div>
          <div className="text-xs text-th-text-t">Connected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-th-surface rounded-xl border border-th-border p-4 space-y-4">
        <div className="flex items-center gap-2 text-th-text-t">
          <Filter24Regular className="w-5 h-5" />
          <span className="font-medium">{t.common?.filter || 'Filters'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Status Filter */}
          <div>
            <label className="block text-xs text-th-text-m mb-1">Status</label>
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as OpportunityMatchStatus | 'ALL')}
              options={[
                { value: 'ALL', label: 'All Status' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'SAVED', label: 'Saved' },
                { value: 'CONTACTED', label: 'Contacted' },
                { value: 'CONNECTED', label: 'Connected' },
                { value: 'DISMISSED', label: 'Dismissed' },
              ]}
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs text-th-text-m mb-1">Opportunity Type</label>
            <Select
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as OpportunityIntentType | 'ALL')}
              options={[
                { value: 'ALL', label: 'All Types' },
                ...INTENT_TYPE_OPTIONS.map((option) => ({ value: option.id, label: option.label })),
              ]}
            />
          </div>

          {/* Opportunity Filter */}
          <div>
            <label className="block text-xs text-th-text-m mb-1">Opportunity</label>
            <Select
              value={opportunityFilter}
              onChange={(value) => setOpportunityFilter(value)}
              options={[
                { value: 'ALL', label: 'All Opportunities' },
                ...opportunities.map((opp) => ({ value: opp.id, label: opp.title })),
              ]}
            />
          </div>

          {/* Min Score */}
          <div>
            <label className="block text-xs text-th-text-m mb-1">Minimum Score</label>
            <Select
              value={minScore.toString()}
              onChange={(value) => setMinScore(parseInt(value))}
              options={[
                { value: '0', label: 'All scores' },
                { value: '50', label: '50%+' },
                { value: '70', label: '70%+' },
                { value: '85', label: '85%+' },
                { value: '95', label: '95%+' },
              ]}
            />
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center justify-between pt-2 border-t border-th-border">
          <span className="text-sm text-th-text-t">
            {filteredMatches.length} matches found
          </span>
          <div className="flex items-center gap-2">
            <ArrowSort24Regular className="w-4 h-4 text-th-text-m" />
            <Select
              value={sortBy}
              onChange={(value) => setSortBy(value as 'score' | 'date')}
              options={[
                { value: 'score', label: 'Best Match' },
                { value: 'date', label: 'Most Recent' },
              ]}
              className="w-36"
            />
          </div>
        </div>
      </div>

      {/* Matches List */}
      {filteredMatches.length > 0 ? (
        <div className="grid gap-3">
          {filteredMatches.map((match) => (
            <OpportunityMatchCard
              key={`${match.opportunityId}-${match.id}`}
              match={match}
              onViewDetails={() => setSelectedMatch(match)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : allMatches.length > 0 ? (
        <div className="text-center py-12 bg-th-surface rounded-xl border border-th-border">
          <Search24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t">
            {t.opportunities?.noMatchesFilter || 'No matches with current filters'}
          </p>
          <button
            onClick={() => {
              setStatusFilter('ALL');
              setTypeFilter('ALL');
              setOpportunityFilter('ALL');
              setMinScore(0);
            }}
            className="mt-4 text-sm text-emerald-400 hover:text-emerald-300"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="text-center py-12 bg-th-surface rounded-xl border border-th-border">
          <People24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t mb-4">
            {t.opportunities?.noMatchesYetGlobal || 'No matches yet. Create an opportunity and find matches!'}
          </p>
          <button
            onClick={() => router.push('/opportunities')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            {t.opportunities?.viewOpportunities || 'View Opportunities'}
          </button>
        </div>
      )}

      {/* Match Detail Modal - Using ItemizedMatchCard */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedMatch(null)}>
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto bg-th-bg-s border border-th-border rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-th-bg-s border-b border-th-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 p-0.5">
                    <div className="w-full h-full rounded-full bg-th-bg-s flex items-center justify-center overflow-hidden">
                      {selectedMatch.candidate.avatarUrl ? (
                        <img src={selectedMatch.candidate.avatarUrl} alt={selectedMatch.candidate.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-th-text">
                          {selectedMatch.candidate.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-th-text">{selectedMatch.candidate.fullName}</h2>
                    <p className="text-sm text-th-text-t">
                      {selectedMatch.candidate.jobTitle}
                      {selectedMatch.candidate.company && ` at ${selectedMatch.candidate.company}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
                >
                  <Dismiss24Regular className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content - Opportunity-specific matching data */}
            <div className="p-4 space-y-4">
              {/* Intent Alignment */}
              {selectedMatch.intentAlignment && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkle24Regular className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-medium text-emerald-400">Intent Alignment</h3>
                  </div>
                  <p className="text-sm text-th-text-s">{selectedMatch.intentAlignment}</p>
                </div>
              )}

              {/* Opportunity Info */}
              <div className="bg-th-surface rounded-xl p-4">
                <h3 className="text-sm font-medium text-th-text-t mb-3">Opportunity Details</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs border ${INTENT_COLORS[selectedMatch.opportunityType]}`}>
                    {INTENT_TYPE_OPTIONS.find(o => o.id === selectedMatch.opportunityType)?.label || selectedMatch.opportunityType}
                  </span>
                  <span className="text-sm text-th-text">{selectedMatch.opportunityTitle}</span>
                </div>
              </div>

              {/* Contact Info */}
              {(selectedMatch.candidate.location || selectedMatch.candidate.email) && (
                <div className="bg-th-surface rounded-xl p-4">
                  <h3 className="text-sm font-medium text-th-text-t mb-3">Contact Information</h3>
                  <div className="space-y-2">
                    {selectedMatch.candidate.location && (
                      <div className="flex items-center gap-2 text-sm text-th-text-s">
                        <Location24Regular className="w-4 h-4 text-th-text-m" />
                        {selectedMatch.candidate.location}
                      </div>
                    )}
                    {selectedMatch.candidate.email && (
                      <div className="flex items-center gap-2 text-sm text-th-text-s">
                        <Mail24Regular className="w-4 h-4 text-th-text-m" />
                        {selectedMatch.candidate.email}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Shared Items */}
              {(selectedMatch.sharedSectors.length > 0 || selectedMatch.sharedSkills.length > 0) && (
                <div className="bg-th-surface rounded-xl p-4">
                  <h3 className="text-sm font-medium text-th-text-t mb-3">Shared Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedMatch.sharedSectors.map((sector, i) => (
                      <span key={`s-${i}`} className="px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {sector}
                      </span>
                    ))}
                    {selectedMatch.sharedSkills.map((skill, i) => (
                      <span key={`sk-${i}`} className="px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-300 border border-green-500/30">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Match Reasons */}
              {selectedMatch.reasons && selectedMatch.reasons.length > 0 && (
                <div className="bg-th-surface rounded-xl p-4">
                  <h3 className="text-sm font-medium text-th-text-t mb-3">Why This Match</h3>
                  <div className="space-y-2">
                    {selectedMatch.reasons.map((reason, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-th-text-s">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Action */}
              {selectedMatch.suggestedAction && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-blue-400 mb-2">Suggested Action</h3>
                  <p className="text-sm text-th-text-s">{selectedMatch.suggestedAction}</p>
                </div>
              )}

              {/* Next Steps */}
              {selectedMatch.nextSteps && selectedMatch.nextSteps.length > 0 && (
                <div className="bg-th-surface rounded-xl p-4">
                  <h3 className="text-sm font-medium text-th-text-t mb-3">Next Steps</h3>
                  <div className="space-y-2">
                    {selectedMatch.nextSteps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-th-text-s">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Message */}
              {selectedMatch.suggestedMessage && (
                <EditableIceBreakers
                  iceBreakers={selectedMatch.suggestedMessage.split('\n').filter(Boolean)}
                  accentColor="purple"
                  label="Suggested Message"
                  onSave={async (text) => {
                    await updateOpportunityMatchIceBreakers(selectedMatch.opportunityId, selectedMatch.id, text);
                  }}
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-th-bg-s border-t border-th-border p-4 flex gap-3">
              {selectedMatch.candidate.id && (
                <button
                  onClick={() => router.push(`/contacts/${selectedMatch.candidate.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-th-surface border border-th-border text-th-text font-medium rounded-xl hover:bg-th-surface-h transition-colors"
                >
                  View Profile
                </button>
              )}
              <button
                onClick={() => {
                  // Navigate to messages or trigger message action
                  router.push(`/messages?contact=${selectedMatch.candidate.id}`);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
              >
                <Chat24Regular className="w-4 h-4" />
                Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
