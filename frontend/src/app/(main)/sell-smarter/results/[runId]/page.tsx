/**
 * Sell Smarter Results Page
 *
 * Displays match results for a product match run.
 * Uses same card/modal pattern as project matching.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  People24Regular,
  ChevronRight24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  Checkmark24Regular,
  CheckmarkCircle24Regular,
  Bookmark24Regular,
  BookmarkFilled,
  BookmarkAdd24Regular,
  Dismiss24Regular,
  DismissCircle24Regular,
  Chat24Regular,
  Copy24Regular,
  Send24Regular,
  Sparkle24Regular,
  Person24Regular,
  Building24Regular,
  Briefcase24Regular,
  Mail24Regular,
  Money24Regular,
} from '@fluentui/react-icons';
import {
  getMatchRun,
  getMatchResults,
  updateMatchResult,
  ProductMatchRun,
  ProductMatchResult,
  ProductMatchBadge,
  GetResultsResponse,
  getBadgeLabel,
  getBadgeColor,
  getExplanationTypeLabel,
} from '@/lib/api/productMatch';
import { toast } from '@/components/ui/Toast';

/**
 * Match Detail Card — same style as ProjectMatchDetailCard
 * Expandable card with gradient header, match reasons, openers, status actions
 */
function MatchDetailCard({
  result,
  onStatusChange,
}: {
  result: ProductMatchResult;
  onStatusChange: (resultId: string, updates: Partial<ProductMatchResult>) => void;
}) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const person = result.contact;

  const badgeConfig: Record<string, { bg: string; text: string; label: string }> = {
    SUITABLE: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Suitable' },
    INFLUENCER: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Influencer' },
    NOT_SUITABLE: { bg: 'bg-white/[0.03]0/20', text: 'text-th-text-m', label: 'Not Suitable' },
  };
  const badge = badgeConfig[result.badge] || badgeConfig.NOT_SUITABLE;

  const handleSave = async (saved: boolean) => {
    setIsUpdating(true);
    try {
      await updateMatchResult(result.id, { isSaved: saved });
      onStatusChange(result.id, { isSaved: saved, isDismissed: false });
      toast({ title: saved ? 'Saved' : 'Removed', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDismiss = async () => {
    setIsUpdating(true);
    try {
      await updateMatchResult(result.id, { isDismissed: true });
      onStatusChange(result.id, { isDismissed: true, isSaved: false });
      toast({ title: 'Dismissed', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleContacted = async () => {
    setIsUpdating(true);
    try {
      await updateMatchResult(result.id, { isContacted: true });
      onStatusChange(result.id, { isContacted: true });
      toast({ title: 'Marked as contacted', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleViewContact = () => {
    if (person.id) {
      router.push(`/contacts/${person.id}`);
    }
  };

  const openerLines = (result.openerEdited || result.openerMessage || '').split('\n').filter(Boolean);

  return (
    <div className={`bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden hover:bg-th-surface-h transition-all duration-200 ${result.isDismissed ? 'opacity-50' : ''}`}>
      {/* Card Header — Clickable to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left"
      >
        <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 p-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-br from-green-500 to-emerald-500">
                <div className="w-full h-full rounded-full bg-th-bg-s flex items-center justify-center overflow-hidden">
                  {person.avatarUrl ? (
                    <img src={person.avatarUrl} alt={person.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-th-text">
                      {person.fullName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold text-th-text text-lg">{person.fullName}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
                {result.isSaved && (
                  <BookmarkFilled className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                )}
                {result.isContacted && (
                  <CheckmarkCircle24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
                )}
              </div>

              {person.jobTitle && (
                <p className="text-sm text-th-text-s flex items-center gap-1">
                  <Briefcase24Regular className="w-4 h-4 text-th-text-m" />
                  {person.jobTitle}
                </p>
              )}

              {person.company && (
                <p className="text-sm text-th-text-t flex items-center gap-1">
                  <Building24Regular className="w-4 h-4 text-th-text-m" />
                  {person.company}
                </p>
              )}
            </div>

            {/* Expand Toggle */}
            <div className="p-2 rounded-lg text-th-text-m">
              {isExpanded ? (
                <ChevronUp24Regular className="w-5 h-5" />
              ) : (
                <ChevronDown24Regular className="w-5 h-5" />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* First reason — Always visible below header */}
      {result.explanationJson?.[0] && !isExpanded && (
        <div className="px-4 py-3 border-t border-th-border-s">
          <div className="flex items-start gap-2">
            <CheckmarkCircle24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-th-text-s line-clamp-1">{result.explanationJson[0].text}</p>
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-th-border">
          {/* Why This Is a Good Match */}
          {result.explanationJson.length > 0 && (
            <div className="px-4 py-4">
              <h4 className="text-sm font-medium text-th-text-s mb-3 flex items-center gap-2">
                <Sparkle24Regular className="w-4 h-4 text-green-400" />
                Why This Is a Good Match
              </h4>
              <div className="space-y-2">
                {result.explanationJson.map((exp, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-2 rounded-lg bg-th-surface"
                  >
                    <CheckmarkCircle24Regular className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-th-text-s">{exp.text}</span>
                      <span className="inline-block ms-2 px-2 py-0.5 rounded-full text-[10px] bg-th-surface text-th-text-m">
                        {getExplanationTypeLabel(exp.type)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Approach */}
          {result.talkAngle && (
            <div className="px-4 py-4 border-t border-th-border">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
                  <Sparkle24Regular className="w-4 h-4" />
                  Suggested Approach
                </h4>
                <p className="text-sm text-th-text-s leading-relaxed">{result.talkAngle}</p>
              </div>
            </div>
          )}

          {/* Ice Breaker / Opener Messages */}
          {openerLines.length > 0 && (
            <div className="px-4 py-4 border-t border-th-border">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <Mail24Regular className="w-3 h-3 text-th-text" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-th-text">Ice Breakers</h4>
                  <p className="text-[10px] text-th-text-m">Tailored to your product profile</p>
                </div>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {openerLines.map((line, idx) => (
                  <div key={idx} className="relative group">
                    <div className="bg-gradient-to-r from-white/5 to-white/[0.02] rounded-lg p-2.5 pe-10 border border-th-border hover:border-cyan-500/30 transition-all">
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-medium">{idx + 1}</span>
                        <p className="text-xs text-th-text-s italic leading-relaxed">
                          &ldquo;{line.trim()}&rdquo;
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(line.trim());
                        toast({ title: 'Copied!', variant: 'success' });
                      }}
                      className="absolute top-1.5 end-1.5 p-1.5 text-th-text-m hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Copy this message"
                    >
                      <Copy24Regular className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Actions */}
          <div className="px-4 py-4 border-t border-th-border bg-th-surface">
            <p className="text-xs text-th-text-m mb-3">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {!result.isContacted && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContacted();
                  }}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                >
                  <Send24Regular className="w-4 h-4" />
                  Mark Contacted
                </button>
              )}
              {result.isContacted && (
                <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-green-500/10 text-green-400">
                  <Checkmark24Regular className="w-4 h-4" />
                  Contacted
                </span>
              )}
              {!result.isSaved ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSave(true);
                  }}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                >
                  <BookmarkAdd24Regular className="w-4 h-4" />
                  Save
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSave(false);
                  }}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-yellow-500/20 text-yellow-400 transition-colors disabled:opacity-50"
                >
                  <BookmarkFilled className="w-4 h-4" />
                  Saved
                </button>
              )}
              {!result.isDismissed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss();
                  }}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-th-surface text-th-text-t hover:bg-th-surface-h transition-colors disabled:opacity-50"
                >
                  <Dismiss24Regular className="w-4 h-4" />
                  Dismiss
                </button>
              )}
            </div>
          </div>

          {/* View Contact Button */}
          <div className="p-4 border-t border-th-border">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewContact();
              }}
              className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-green-500/25 transition-all flex items-center justify-center gap-2"
            >
              <ChevronRight24Regular className="w-5 h-5" />
              View Contact Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Badge filter buttons
 */
function BadgeFilter({
  selected,
  onChange,
  counts,
}: {
  selected: ProductMatchBadge | 'ALL';
  onChange: (badge: ProductMatchBadge | 'ALL') => void;
  counts: { suitable: number; influencer: number; notSuitable: number };
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onChange('ALL')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          selected === 'ALL'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'
        }`}
      >
        All ({counts.suitable + counts.influencer + counts.notSuitable})
      </button>
      <button
        onClick={() => onChange('SUITABLE')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          selected === 'SUITABLE'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'
        }`}
      >
        Suitable ({counts.suitable})
      </button>
      <button
        onClick={() => onChange('INFLUENCER')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          selected === 'INFLUENCER'
            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'
        }`}
      >
        Influencer ({counts.influencer})
      </button>
      <button
        onClick={() => onChange('NOT_SUITABLE')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          selected === 'NOT_SUITABLE'
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'
        }`}
      >
        Not Suitable ({counts.notSuitable})
      </button>
    </div>
  );
}

export default function ResultsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<ProductMatchRun | null>(null);
  const [data, setData] = useState<GetResultsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [badgeFilter, setBadgeFilter] = useState<ProductMatchBadge | 'ALL'>('ALL');

  useEffect(() => {
    fetchData();
  }, [runId, badgeFilter]);

  useEffect(() => {
    if (run && (run.status === 'QUEUED' || run.status === 'RUNNING')) {
      const interval = setInterval(async () => {
        const updatedRun = await getMatchRun(runId);
        setRun(updatedRun);
        if (updatedRun.status === 'DONE') {
          fetchData();
          clearInterval(interval);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [run?.status]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const runData = await getMatchRun(runId);
      setRun(runData);
      if (runData.status === 'DONE') {
        const resultsData = await getMatchResults(runId, {
          badge: badgeFilter !== 'ALL' ? badgeFilter : undefined,
          limit: 100,
        });
        setData(resultsData);
      }
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (resultId: string, updates: Partial<ProductMatchResult>) => {
    setData((prev) =>
      prev ? {
        ...prev,
        results: prev.results.map((r) =>
          r.id === resultId ? { ...r, ...updates } : r
        ),
      } : null
    );
  };

  // Loading
  if (isLoading && !run) {
    return (
      <div className="space-y-4 animate-fade-in pb-20">
        <div className="h-8 bg-th-surface-h rounded w-48 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-th-surface border border-th-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Processing
  if (run && (run.status === 'QUEUED' || run.status === 'RUNNING')) {
    return (
      <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ms-2 hover:bg-th-surface-h rounded-lg transition-colors">
            <ArrowLeft24Regular className="w-5 h-5 text-th-text-t" />
          </button>
          <h1 className="text-xl font-bold text-th-text">Analyzing Contacts</h1>
        </div>
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="w-full h-full border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
            </div>
            <p className="text-lg font-medium text-th-text mb-2">
              {run.status === 'QUEUED' ? 'Queued' : 'Matching...'}
            </p>
            <p className="text-sm text-th-text-t mb-4">
              Analyzing {run.totalContacts} contacts
            </p>
            <div className="w-full h-2 bg-th-surface-h rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${run.progress}%` }}
              />
            </div>
            <p className="text-xs text-th-text-m mt-2">{run.progress}%</p>
          </div>
        </div>
      </div>
    );
  }

  // Failed
  if (run && run.status === 'FAILED') {
    return (
      <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ms-2 hover:bg-th-surface-h rounded-lg transition-colors">
            <ArrowLeft24Regular className="w-5 h-5 text-th-text-t" />
          </button>
          <h1 className="text-xl font-bold text-th-text">Matching Failed</h1>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 mb-4">{run.error || 'An unknown error occurred'}</p>
          <Link
            href="/sell-smarter"
            className="inline-flex items-center gap-2 px-4 py-2 bg-th-surface-h text-th-text rounded-lg hover:bg-th-surface-h transition-all"
          >
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/sell-smarter')} className="p-2 -ms-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-th-text flex items-center gap-2">
            <Money24Regular className="w-5 h-5 text-green-400" />
            Match Results
          </h1>
          <p className="text-sm text-th-text-t">
            {data?.summary.totalMatches} matches found
          </p>
        </div>
      </div>

      {/* Badge Filter */}
      {data && (
        <BadgeFilter
          selected={badgeFilter}
          onChange={setBadgeFilter}
          counts={{
            suitable: data.summary.suitableCount,
            influencer: data.summary.influencerCount,
            notSuitable: data.summary.notSuitableCount,
          }}
        />
      )}

      {/* Results List */}
      {data && data.results.length > 0 && (
        <div className="space-y-3">
          {data.results.map((result) => (
            <MatchDetailCard
              key={result.id}
              result={result}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {data && data.results.length === 0 && (
        <div className="bg-th-surface border border-th-border rounded-xl p-12 text-center">
          <People24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t text-lg">No matches found</p>
          <p className="text-sm text-th-text-m mt-1">
            {badgeFilter !== 'ALL' ? 'Try a different filter' : 'Add more contacts to your network'}
          </p>
        </div>
      )}
    </div>
  );
}
