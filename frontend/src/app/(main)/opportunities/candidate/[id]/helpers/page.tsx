/**
 * Helper Matches — "People Who Can Help" page.
 *
 * Helper-framed results: the candidate is the SOURCE, the helpers are the
 * results. Each card answers "Why might this person help you get a job?"
 * — never "why is this person suitable for the job".
 *
 * Fetches stored helper matches on mount; "Refresh" runs the live pipeline.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft24Regular,
  ArrowSync24Regular,
  PeopleTeam24Regular,
  Person24Regular,
  Building24Regular,
  Sparkle24Regular,
  Star24Filled,
} from '@fluentui/react-icons';
import {
  getCandidateProfile,
  getHelperMatches,
  findHelperMatches,
  CandidateProfile,
  HelperMatchResult,
  HELPER_TYPE_LABELS,
  LIKELY_HELP_TYPE_LABELS,
} from '@/lib/api/job-matching';
import { toast } from '@/components/ui/Toast';

// Mirrors the standard tier system used by the project / pitch / job MatchCard
// so the helper page reads as part of the same family of matching engines.
function getScoreStyles(score: number) {
  if (score >= 90) return {
    level: 'Excellent Match',
    levelColor: 'bg-[#22C55E] text-black border-[#22C55E]',
    ringColor: 'from-[#22C55E]/30 to-[#22C55E]/30 border-[#22C55E]/40',
    textGradient: 'from-[#22C55E] to-[#22C55E]',
  };
  if (score >= 75) return {
    level: 'Very Good Match',
    levelColor: 'bg-[#84CC16] text-black border-[#84CC16]',
    ringColor: 'from-[#84CC16]/30 to-[#84CC16]/30 border-[#84CC16]/40',
    textGradient: 'from-[#84CC16] to-[#84CC16]',
  };
  if (score >= 60) return {
    level: 'Good Match',
    levelColor: 'bg-[#FACC15] text-black border-[#FACC15]',
    ringColor: 'from-[#FACC15]/30 to-[#FACC15]/30 border-[#FACC15]/40',
    textGradient: 'from-[#FACC15] to-[#FACC15]',
  };
  if (score >= 40) return {
    level: 'Partial Match',
    levelColor: 'bg-[#FB923C] text-black border-[#FB923C]',
    ringColor: 'from-[#FB923C]/30 to-[#FB923C]/30 border-[#FB923C]/40',
    textGradient: 'from-[#FB923C] to-[#FB923C]',
  };
  return {
    level: 'Weak Match',
    levelColor: 'bg-[#EF4444] text-black border-[#EF4444]',
    ringColor: 'from-[#EF4444]/30 to-[#EF4444]/30 border-[#EF4444]/40',
    textGradient: 'from-[#EF4444] to-[#EF4444]',
  };
}

export default function CandidateHelpersPage() {
  const router = useRouter();
  const params = useParams();
  const candidateId = params.id as string;

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [matches, setMatches] = useState<HelperMatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  // Load candidate + any stored helper matches.
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [p, stored] = await Promise.all([
          getCandidateProfile(candidateId),
          getHelperMatches(candidateId).catch(() => []),
        ]);
        setProfile(p);
        setMatches(stored);
      } catch (err: any) {
        const msg = err.message || 'Failed to load helpers';
        setError(msg);
        toast({ title: 'Error', description: msg, variant: 'error' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [candidateId]);

  const runHelperSearch = useCallback(async () => {
    try {
      setRunning(true);
      setError(null);
      const res = await findHelperMatches(candidateId, {
        includeAI: true,
        includeExplanations: true,
        limit: 50,
      });
      setMatches(res.matches);
      setLastRunAt(new Date().toISOString());
      toast({
        title: 'Helpers found',
        description: `${res.matches.length} helper${res.matches.length === 1 ? '' : 's'} ranked from ${res.helpersEvaluated} reviewed.`,
        variant: 'success',
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to find helpers';
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'error' });
    } finally {
      setRunning(false);
    }
  }, [candidateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-6">
        <button
          onClick={() => router.push(`/opportunities/candidate/${candidateId}`)}
          className="flex items-center gap-2 text-th-text-t hover:text-th-text transition-colors text-sm"
        >
          <ArrowLeft24Regular className="w-4 h-4" />
          Back to Profile
        </button>
        <div className="text-center py-16 bg-th-surface rounded-xl border border-th-border">
          <Person24Regular className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <p className="text-th-text-t">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-6">
      {/* Back */}
      <button
        onClick={() => router.push(`/opportunities/candidate/${candidateId}`)}
        className="flex items-center gap-2 text-th-text-t hover:text-th-text transition-colors text-sm"
      >
        <ArrowLeft24Regular className="w-4 h-4" />
        Back to Profile
      </button>

      {/* Header */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <PeopleTeam24Regular className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-th-text truncate">
              People Who Can Help
            </h1>
            {profile && (
              <p className="text-sm text-th-text-s truncate">
                For {profile.fullName || profile.title}
              </p>
            )}
          </div>
          <button
            onClick={runHelperSearch}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex-shrink-0"
          >
            <ArrowSync24Regular
              className={`w-4 h-4 ${running ? 'animate-spin' : ''}`}
            />
            {running ? 'Searching…' : matches.length === 0 ? 'Find Helpers' : 'Refresh'}
          </button>
        </div>
        <p className="text-xs text-th-text-t mt-2">
          We search your network for people who can refer, introduce, advise,
          or guide you toward roles. Ranked by deterministic signals + bounded
          AI validation. Score ≠ judgment of the person.
        </p>
      </div>

      {/* Empty state */}
      {matches.length === 0 && (
        <div className="text-center py-16 bg-th-surface rounded-xl border border-th-border">
          <PeopleTeam24Regular className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <p className="text-th-text-t">
            {running
              ? 'Searching your network…'
              : 'No helpers ranked yet. Run a search to see who in your network can help.'}
          </p>
        </div>
      )}

      {/* Helper cards */}
      {matches.length > 0 && (
        <div className="space-y-3">
          {matches.map((m) => (
            <HelperCard key={m.matchId} match={m} />
          ))}
        </div>
      )}

      {lastRunAt && (
        <p className="text-[10px] text-th-text-m text-center">
          Last refreshed {new Date(lastRunAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// HELPER CARD
// ============================================================================

function HelperCard({ match }: { match: HelperMatchResult }) {
  const score = Math.round(match.finalScore);
  const { level, levelColor, ringColor, textGradient } = getScoreStyles(score);
  const helperTypeLabel =
    HELPER_TYPE_LABELS[match.helperType] || match.helperTypeLabel;
  const likelyHelpLabel =
    LIKELY_HELP_TYPE_LABELS[match.likelyHelpType] || `Can ${match.likelyHelpType}`;
  const displayName = match.helperName?.trim() || 'Helper';

  // The 4 strongest reasons; first prefer rich strengths, fall back to
  // matched signals if the helper had no high-band components.
  const reasons = (
    match.strengths?.length ? match.strengths : match.matchedSignals || []
  ).slice(0, 4);

  return (
    <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden p-4">
      <div className="flex items-start gap-3">
        {/* Left column: score circle + helper-type tag */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div
            className={`w-12 h-12 rounded-full bg-gradient-to-br ${ringColor} flex items-center justify-center`}
          >
            <span
              className={`text-sm font-bold bg-gradient-to-r ${textGradient} bg-clip-text text-transparent`}
            >
              {score}%
            </span>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-teal-500/15 text-teal-300 border-teal-500/25 whitespace-nowrap">
            <PeopleTeam24Regular className="w-3 h-3" />
            Helper
          </span>
        </div>

        {/* Right column: content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{displayName}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${levelColor}`}
            >
              {level}
            </span>
          </div>

          {(match.helperTitle || match.helperOrganization) && (
            <p className="text-sm text-white truncate mt-0.5">
              {match.helperTitle}
              {match.helperTitle && match.helperOrganization ? ' · ' : ''}
              {match.helperOrganization}
            </p>
          )}

          {/* Helper-framed natural-language summary */}
          {match.helperExplanation && (
            <p className="text-xs text-white/85 mt-2 leading-relaxed line-clamp-3">
              {match.helperExplanation}
            </p>
          )}

          {/* Reasons (mirrors the project/pitch MatchCard layout) */}
          {reasons.length > 0 && (
            <div className="mt-2 space-y-1">
              {reasons.map((reason, i) => (
                <p
                  key={i}
                  className="text-xs text-white flex items-start gap-1.5"
                >
                  <Star24Filled className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{reason}</span>
                </p>
              ))}
            </div>
          )}

          {/* Pills row — helper type, likely help action, network relationship.
              Style matches the per-LookingFor pills used in the existing
              MatchCard so the visual language is consistent. */}
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] border font-bold bg-[#84CC16] border-[#84CC16]/80 text-[#042820]">
              {helperTypeLabel}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] border font-bold bg-emerald-500/15 text-emerald-300 border-emerald-500/30 inline-flex items-center gap-1">
              <Sparkle24Regular className="w-3 h-3" />
              {likelyHelpLabel}
            </span>
            {match.networkRelationship && (
              <span className="px-2 py-0.5 rounded-full text-[10px] border font-bold bg-th-surface-h text-white/80 border-th-border inline-flex items-center gap-1">
                <Building24Regular className="w-3 h-3" />
                {match.networkRelationship}
              </span>
            )}
          </div>

          {/* Cautions only — keeps the card honest without burying it */}
          {match.cautionFlags.length > 0 && (
            <p className="text-[11px] text-orange-300/90 mt-2 line-clamp-2">
              <span className="font-semibold">Heads-up:</span>{' '}
              {match.cautionFlags.slice(0, 2).join(' · ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
