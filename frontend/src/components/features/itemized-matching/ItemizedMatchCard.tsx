/**
 * ItemizedMatchCard Component
 *
 * Main component for displaying itemized match results.
 * Shows target info, summary badges, all criteria, and actions.
 *
 * @module components/features/itemized-matching/ItemizedMatchCard
 */

'use client';

import { useState } from 'react';
import {
  Person24Regular,
  Chat24Regular,
  PersonAdd24Regular,
  ArrowRight24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  Warning24Regular,
  Lightbulb24Regular,
  Copy24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { ItemizedMatchCardProps, STATUS_CONFIG } from './types';
import { CriterionScoreItem } from './CriterionScoreItem';
import { MatchSummaryBadges } from './MatchSummaryBadges';

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get overall status color based on summary
 */
function getOverallStatusColor(summary: ItemizedMatchCardProps['match']['summary']): string {
  if (summary.perfectMatches > 0 || summary.excellentMatches > 0) {
    return 'from-emerald-500 to-green-500';
  }
  if (summary.strongMatches > 0) {
    return 'from-blue-500 to-cyan-500';
  }
  if (summary.moderateMatches > 0) {
    return 'from-yellow-500 to-amber-400';
  }
  return 'from-neutral-500 to-neutral-400';
}

/**
 * ItemizedMatchCard component
 */
export function ItemizedMatchCard({
  match,
  compact = false,
  showActions = true,
  onViewProfile,
  onConnect,
  onMessage,
}: ItemizedMatchCardProps) {
  const { t } = useLanguage();
  const [showAllCriteria, setShowAllCriteria] = useState(false);
  const [copiedIceBreaker, setCopiedIceBreaker] = useState<number | null>(null);

  // Sort criteria by importance then score
  const sortedCriteria = [...match.criteria].sort((a, b) => {
    const importanceOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const importanceDiff =
      importanceOrder[a.importance] - importanceOrder[b.importance];
    if (importanceDiff !== 0) return importanceDiff;
    return b.score - a.score;
  });

  const displayedCriteria = compact
    ? sortedCriteria.slice(0, 3)
    : showAllCriteria
    ? sortedCriteria
    : sortedCriteria.slice(0, 5);

  const hasMoreCriteria = sortedCriteria.length > (compact ? 3 : 5);

  const handleCopyIceBreaker = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIceBreaker(index);
    setTimeout(() => setCopiedIceBreaker(null), 2000);
  };

  return (
    <div className="bg-th-surface border border-th-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-th-border bg-th-surface">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <div
              className={cn(
                'w-14 h-14 rounded-full p-0.5 bg-gradient-to-br',
                getOverallStatusColor(match.summary)
              )}
            >
              <div className="w-full h-full rounded-full bg-th-bg-s flex items-center justify-center overflow-hidden">
                {match.target.avatarUrl ? (
                  <img
                    src={match.target.avatarUrl}
                    alt={match.target.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-th-text">
                    {getInitials(match.target.name)}
                  </span>
                )}
              </div>
            </div>
            {/* Critical met indicator */}
            {match.summary.criticalTotal > 0 && match.summary.criticalMet >= match.summary.criticalTotal && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                <Checkmark24Regular className="w-3 h-3 text-th-text" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-th-text truncate">
                {match.target.name}
              </h3>
              {match.matchQuality && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap',
                    match.matchQuality === 'HIGH' && 'bg-emerald-500/20 text-emerald-400',
                    match.matchQuality === 'MEDIUM' && 'bg-emerald-500/20 text-emerald-400',
                    match.matchQuality === 'LOW' && 'bg-white/[0.03]0/20 text-white/50'
                  )}
                >
                  {match.matchQuality === 'HIGH' && t.matchDetails.highConfidence}
                  {match.matchQuality === 'MEDIUM' && t.matchDetails.mediumConfidence}
                  {match.matchQuality === 'LOW' && t.matchDetails.lowConfidence}
                </span>
              )}
            </div>
            <p className="text-sm text-th-text-t truncate">
              {match.target.type.replace(/_/g, ' ')}
            </p>
          </div>

          {/* Quick summary */}
          {!compact && (
            <MatchSummaryBadges summary={match.summary} matchQuality={match.matchQuality} compact />
          )}
        </div>
      </div>

      {/* Summary badges (full view for compact) */}
      {compact && (
        <div className="px-4 py-3 border-b border-th-border">
          <MatchSummaryBadges summary={match.summary} matchQuality={match.matchQuality} compact />
        </div>
      )}

      {/* Criteria list */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-th-text">
            Match Criteria
          </h4>
          <span className="text-xs text-th-text-s bg-th-surface-h px-2 py-0.5 rounded-full">
            {match.summary.totalCriteria || match.criteria.length} criteria
          </span>
        </div>

        {displayedCriteria.map((criterion) => (
          <CriterionScoreItem
            key={criterion.id}
            criterion={criterion}
            showDetails={!compact}
          />
        ))}

        {hasMoreCriteria && !compact && (
          <button
            onClick={() => setShowAllCriteria(!showAllCriteria)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-th-text-t hover:text-th-text transition-colors"
          >
            {showAllCriteria ? (
              <>
                <ChevronUp24Regular className="w-4 h-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown24Regular className="w-4 h-4" />
                Show {sortedCriteria.length - 5} more criteria
              </>
            )}
          </button>
        )}
      </div>

      {/* Concerns */}
      {match.concerns && match.concerns.length > 0 && !compact && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Warning24Regular className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">
                Potential Concerns
              </span>
            </div>
            <ul className="space-y-1">
              {match.concerns.map((concern, idx) => (
                <li key={idx} className="text-xs text-th-text-t flex items-start gap-2">
                  <span className="text-yellow-400">•</span>
                  {concern}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Ice breakers */}
      {match.iceBreakers && match.iceBreakers.length > 0 && !compact && (
        <div className="px-4 pb-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb24Regular className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">
                Ice Breakers
              </span>
            </div>
            <div className="space-y-2">
              {match.iceBreakers.map((iceBreaker, idx) => {
                const text = typeof iceBreaker === 'string' ? iceBreaker : iceBreaker.text;
                return (
                  <div
                    key={idx}
                    className="group relative bg-th-surface rounded-lg p-2 pr-10"
                  >
                    <p className="text-xs text-th-text-s italic">
                      &quot;{text}&quot;
                    </p>
                    <button
                      onClick={() => handleCopyIceBreaker(text, idx)}
                      className="absolute top-2 right-2 p-1 text-th-text-m hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {copiedIceBreaker === idx ? (
                        <Checkmark24Regular className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy24Regular className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="p-4 pt-0 flex gap-2">
          {onViewProfile && (
            <button
              onClick={() => onViewProfile(match.target.id)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-th-surface border border-th-border text-th-text text-sm font-medium rounded-xl hover:bg-th-surface-h transition-colors"
            >
              <Person24Regular className="w-4 h-4" />
              Profile
            </button>
          )}
          {onConnect && (
            <button
              onClick={() => onConnect(match.target.id)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium rounded-xl hover:bg-blue-500/30 transition-colors"
            >
              <PersonAdd24Regular className="w-4 h-4" />
              Connect
            </button>
          )}
          {onMessage && (
            <button
              onClick={() => onMessage(match.target.id)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
            >
              <Chat24Regular className="w-4 h-4" />
              Message
              <ArrowRight24Regular className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ItemizedMatchCard;
