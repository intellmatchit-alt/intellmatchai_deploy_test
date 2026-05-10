'use client';

import { useState } from 'react';
import { MatchActionBar } from './MatchActionBar';
import {
  Star24Filled,
  Lightbulb24Regular,
  Rocket24Regular,
  Handshake24Regular,
  Briefcase24Regular,
} from '@fluentui/react-icons';
import type { Translations } from '@/lib/i18n/en';

/** Source visual config */
const SOURCE_STYLES: Record<string, { bg: string; text: string; border: string; icon: any; label: string }> = {
  project: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25', icon: Lightbulb24Regular, label: 'Project' },
  deal: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/25', icon: Handshake24Regular, label: 'Deal' },
  pitch: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25', icon: Rocket24Regular, label: 'Pitch' },
  job: { bg: 'bg-teal-500/15', text: 'text-teal-300', border: 'border-teal-500/25', icon: Briefcase24Regular, label: 'Job' },
};

/** Per-Looking-For detail shape rendered in the expandable section. */
export interface MatchCardLookingForDetail {
  id: string;
  label: string;
  score: number;
  finalScore: number;
  matchLevel: 'WEAK' | 'PARTIAL' | 'GOOD' | 'VERY_GOOD' | 'EXCELLENT';
  confidence?: number;
  hardFilterStatus?: 'PASS' | 'WARN' | 'FAIL';
  hardFilterReason?: string;
  isBestMatchType?: boolean;
  strengths?: string[];
  gaps?: string[];
  matchedSignals?: string[];
  missingSignals?: string[];
  greenFlags?: string[];
  redFlags?: string[];
  explanation?: string;
}

/** Props for a unified match card */
export interface MatchCardData {
  id: string;
  source: 'project' | 'deal' | 'pitch' | 'job';
  sourceTitle: string;
  sourceId?: string;
  score: number;
  contactId: string;
  name: string;
  company?: string;
  jobTitle?: string;
  reasons: string[];
  sharedSectors?: string[];
  sharedSkills?: string[];
  status: string;
  channels: {
    intellmatchUserId?: string | null;
    phone?: string | null;
    email?: string | null;
    linkedinUrl?: string | null;
  };
  /** Per-role lookingFor scores. When present, the card renders a row per
   *  role showing label + score; the headline `score` should already be the
   *  max of these (caller's responsibility). */
  lookingForScores?: Record<string, number> | null;
  /** Human-readable label for each role id in lookingForScores. */
  lookingForLabels?: Record<string, string> | null;
  /** Detailed per-Looking-For score objects. When present, takes priority
   *  over `lookingForScores` and renders bands + best-fit highlight. */
  lookingForScoreDetails?: MatchCardLookingForDetail[] | null;
  /** Best Looking For type id (lowercased / persistence form). */
  bestLookingForId?: string | null;
  /** Best Looking For type label (already humanized). */
  bestLookingForLabel?: string | null;
  /** Overall explanation summary, displayed under the per-type pills. */
  overallExplanationSummary?: string | null;
}

interface MatchCardProps {
  match: MatchCardData;
  onStatusChange?: (id: string, status: string) => void;
  t: Translations;
  /** Hide source tag if already in context (e.g. on project detail page) */
  hideSource?: boolean;
  /** @deprecated Card is no longer clickable as a whole. Use actionSlot instead. */
  href?: string;
  /** @deprecated Card is no longer clickable as a whole. Use actionSlot instead. */
  onClick?: () => void;
  /** Optional action element rendered below the score circle */
  actionSlot?: React.ReactNode;
}

/** Score tier helpers — standard across all matching (project, deal, pitch, job) */
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

/** Map source type to route prefix and expand section name */
const SOURCE_ROUTES: Record<string, { path: string; section: string }> = {
  project: { path: '/projects', section: 'project' },
  deal: { path: '/deals', section: 'deal' },
  pitch: { path: '/pitch', section: 'pitch' },
  job: { path: '/opportunities', section: 'opportunity' },
};

export function MatchCard({ match, onStatusChange, t, hideSource, actionSlot, onClick }: MatchCardProps) {
  const [updating, setUpdating] = useState(false);
  // When per-LookingFor detail is present, the badge MUST reflect the same
  // max we'll render in the pills — otherwise the card score and the "Best"
  // pill disagree. Falls back to match.score for legacy callers.
  const displayScore = (() => {
    const details = match.lookingForScoreDetails;
    if (Array.isArray(details) && details.length > 0) {
      const maxFinal = details.reduce(
        (m, d) => (typeof d?.finalScore === 'number' && d.finalScore > m ? d.finalScore : m),
        -Infinity,
      );
      if (Number.isFinite(maxFinal)) return maxFinal;
    }
    return match.score;
  })();
  const { level, levelColor, ringColor, textGradient } = getScoreStyles(displayScore);
  const sourceStyle = SOURCE_STYLES[match.source] || SOURCE_STYLES.project;
  const SourceIcon = sourceStyle.icon;

  return (
    <div
      className={`bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden p-4${onClick ? ' cursor-pointer hover:border-white/20 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Left column: Score circle + action button + source tag */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${ringColor} flex items-center justify-center`}>
            <span className={`text-sm font-bold bg-gradient-to-r ${textGradient} bg-clip-text text-transparent`}>
              {Math.round(displayScore)}%
            </span>
          </div>
          {/* Source tag */}
          {!hideSource && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${sourceStyle.bg} ${sourceStyle.text} ${sourceStyle.border}`}>
              <SourceIcon className="w-3 h-3" />
              {sourceStyle.label}
            </span>
          )}
          {/* Action button */}
          {actionSlot && <div className="flex-shrink-0">{actionSlot}</div>}
        </div>

        {/* Right column: Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{match.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${levelColor}`}>
              {level}
            </span>
          </div>
          {(match.jobTitle || match.company) && (
            <p className="text-sm text-white truncate">
              {match.jobTitle}{match.jobTitle && match.company ? ' · ' : ''}{match.company}
            </p>
          )}

          {/* Source title */}
          {!hideSource && match.sourceTitle && (
            <p className="text-xs text-white truncate mt-1">{match.sourceTitle}</p>
          )}

          {/* Reasons */}
          {match.reasons.length > 0 && (
            <div className="mt-2 space-y-1">
              {match.reasons.slice(0, 2).map((reason, i) => (
                <p key={i} className="text-xs text-white flex items-start gap-1.5">
                  <Star24Filled className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{reason}</span>
                </p>
              ))}
            </div>
          )}

          {/* Best fit indicator — uses the same chip style as everywhere else
              in the app, with a Star icon to draw the eye. Only shown when
              the new per-type detail object is present. */}
          {match.bestLookingForLabel && (
            <p className="text-xs text-white flex items-start gap-1.5 mt-2">
              <Star24Filled className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-1">
                Best Fit: <span className="font-semibold">{match.bestLookingForLabel}</span>
              </span>
            </p>
          )}

          {/* Per-role lookingFor scores. When the rich detail array is
              available, render each detail with a band label and highlight
              the best-fit pill. Otherwise fall back to the legacy
              Record<id, score> pill renderer. */}
          {match.lookingForScoreDetails && match.lookingForScoreDetails.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {[...match.lookingForScoreDetails]
                .sort((a, b) => b.finalScore - a.finalScore)
                .map((detail) => {
                  const tier = detail.finalScore >= 85
                    ? 'bg-[#22C55E] border-[#22C55E]/80 text-[#042820]'
                    : detail.finalScore >= 70
                    ? 'bg-[#84CC16] border-[#84CC16]/80 text-[#042820]'
                    : detail.finalScore >= 55
                    ? 'bg-[#FACC15] border-[#FACC15]/80 text-[#042820]'
                    : detail.finalScore >= 40
                    ? 'bg-[#FB923C] border-[#FB923C]/80 text-[#042820]'
                    : 'bg-[#EF4444]/80 border-[#EF4444]/80 text-white';
                  const bestRing = detail.isBestMatchType ? ' ring-2 ring-emerald-300' : '';
                  const bandLabel = detail.matchLevel.replace('_', ' ').toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <span
                      key={detail.id}
                      className={`px-2 py-0.5 rounded-full text-[10px] border font-bold ${tier}${bestRing}`}
                      title={detail.explanation || `${detail.label}: ${detail.finalScore}/100 (${bandLabel})`}
                    >
                      {detail.label} {Math.round(detail.finalScore)}% · {bandLabel}
                      {detail.isBestMatchType ? ' · Best' : ''}
                    </span>
                  );
                })}
            </div>
          ) : match.lookingForScores && Object.keys(match.lookingForScores).length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(match.lookingForScores)
                .sort(([, a], [, b]) => b - a)
                .map(([roleId, roleScore]) => {
                  const label = match.lookingForLabels?.[roleId] || roleId;
                  const isBest = match.bestLookingForId === roleId;
                  const tier = roleScore >= 75
                    ? 'bg-[#84CC16] border-[#84CC16]/80 text-[#042820]'
                    : roleScore >= 60
                    ? 'bg-[#FACC15] border-[#FACC15]/80 text-[#042820]'
                    : roleScore >= 40
                    ? 'bg-[#FB923C] border-[#FB923C]/80 text-[#042820]'
                    : 'bg-[#EF4444]/80 border-[#EF4444]/80 text-white';
                  const bestRing = isBest ? ' ring-2 ring-emerald-300' : '';
                  return (
                    <span
                      key={roleId}
                      className={`px-2 py-0.5 rounded-full text-[10px] border font-bold ${tier}${bestRing}`}
                    >
                      {label} {Math.round(roleScore)}%
                      {isBest ? ' · Best' : ''}
                    </span>
                  );
                })}
            </div>
          ) : null}

          {/* Overall explanation summary — only when present. Same compact
              text style used elsewhere in the card. */}
          {match.overallExplanationSummary && (
            <p className="text-[11px] text-white/80 mt-2 line-clamp-2">
              {match.overallExplanationSummary}
            </p>
          )}

        </div>
      </div>

      {/* Actions bar */}
      {onStatusChange && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <MatchActionBar
            currentStatus={match.status}
            contactName={match.name}
            channels={{
              intellmatchUserId: match.channels.intellmatchUserId,
              phone: match.channels.phone,
              email: match.channels.email,
              linkedinUrl: match.channels.linkedinUrl,
            }}
            onStatusChange={(status) => onStatusChange(match.id, status)}
            isUpdating={updating}
            dismissStatus={match.source === 'pitch' || match.source === 'deal' ? 'IGNORED' : 'DISMISSED'}
            t={t}
          />
        </div>
      )}
    </div>
  );
}
