/**
 * MatchSummaryBadges Component
 *
 * Displays summary badges for match statistics.
 * Shows counts of perfect, excellent, strong, etc. matches.
 *
 * @module components/features/itemized-matching/MatchSummaryBadges
 */

'use client';

import {
  CheckmarkCircle24Filled,
  Star24Filled,
  Diamond24Filled,
  Circle24Filled,
  Warning24Filled,
  DismissCircle24Filled,
} from '@fluentui/react-icons';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { MatchSummaryBadgesProps, STATUS_CONFIG } from './types';

/**
 * MatchSummaryBadges component
 */
export function MatchSummaryBadges({ summary, matchQuality, compact = false }: MatchSummaryBadgesProps) {
  const { t } = useLanguage();
  const badges = [
    {
      count: summary.perfectMatches,
      label: 'Perfect',
      status: 'PERFECT' as const,
      Icon: CheckmarkCircle24Filled,
    },
    {
      count: summary.excellentMatches,
      label: 'Excellent',
      status: 'EXCELLENT' as const,
      Icon: Star24Filled,
    },
    {
      count: summary.strongMatches,
      label: 'Strong',
      status: 'STRONG' as const,
      Icon: Diamond24Filled,
    },
    {
      count: summary.moderateMatches,
      label: 'Moderate',
      status: 'MODERATE' as const,
      Icon: Circle24Filled,
    },
    {
      count: summary.weakMatches,
      label: 'Weak',
      status: 'WEAK' as const,
      Icon: Warning24Filled,
    },
    {
      count: summary.noMatches,
      label: 'No Match',
      status: 'NO_MATCH' as const,
      Icon: DismissCircle24Filled,
    },
  ].filter((badge) => badge.count > 0);

  const qualityBadge = matchQuality ? (
    <span
      className={cn(
        'px-2 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap',
        matchQuality === 'HIGH' && 'bg-emerald-500/20 text-emerald-400',
        matchQuality === 'MEDIUM' && 'bg-emerald-500/20 text-emerald-400',
        matchQuality === 'LOW' && 'bg-white/[0.03]0/20 text-white/50'
      )}
    >
      {matchQuality === 'HIGH' && t.matchDetails.highConfidence}
      {matchQuality === 'MEDIUM' && t.matchDetails.mediumConfidence}
      {matchQuality === 'LOW' && t.matchDetails.lowConfidence}
    </span>
  ) : null;

  if (compact) {
    // Compact view - just show counts
    return (
      <div className="flex items-center gap-2">
        {badges.slice(0, 3).map((badge) => {
          const config = STATUS_CONFIG[badge.status];
          return (
            <div
              key={badge.status}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                config.bgColor,
                config.color
              )}
              title={`${badge.count} ${badge.label}`}
            >
              <badge.Icon className="w-3.5 h-3.5" />
              <span className="font-medium">{badge.count}</span>
            </div>
          );
        })}
        {badges.length > 3 && (
          <span className="text-xs text-th-text-m">+{badges.length - 3} more</span>
        )}
        {qualityBadge}
      </div>
    );
  }

  // Check if critical criteria are met (criticalMet >= criticalTotal when criticalTotal > 0)
  const criticalAllMet = summary.criticalTotal > 0
    ? summary.criticalMet >= summary.criticalTotal
    : true; // No critical criteria means "met"

  return (
    <div className="space-y-3">
      {/* Critical status - only show if there are critical criteria */}
      {summary.criticalTotal > 0 && (
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg',
            criticalAllMet
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-red-500/10 border border-red-500/20'
          )}
        >
          {criticalAllMet ? (
            <CheckmarkCircle24Filled className="w-5 h-5 text-emerald-400" />
          ) : (
            <DismissCircle24Filled className="w-5 h-5 text-red-400" />
          )}
          <span
            className={cn(
              'text-sm font-medium',
              criticalAllMet ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {criticalAllMet
              ? `All ${summary.criticalTotal} critical criteria met`
              : `${summary.criticalMet}/${summary.criticalTotal} critical criteria met`}
          </span>
        </div>
      )}

      {/* Badge grid */}
      <div className="grid grid-cols-3 gap-2">
        {badges.map((badge) => {
          const config = STATUS_CONFIG[badge.status];
          return (
            <div
              key={badge.status}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg border',
                config.bgColor,
                config.borderColor
              )}
            >
              <badge.Icon className={cn('w-5 h-5', config.color)} />
              <span className={cn('text-lg font-bold', config.color)}>{badge.count}</span>
              <span className="text-[10px] text-th-text-t">{badge.label}</span>
            </div>
          );
        })}
      </div>

      {/* Total criteria */}
      {summary.totalCriteria && (
        <p className="text-xs text-th-text-m text-center">
          {summary.totalCriteria} criteria evaluated
        </p>
      )}

      {/* Match quality indicator */}
      {qualityBadge && (
        <div className="flex justify-center">
          {qualityBadge}
        </div>
      )}
    </div>
  );
}

export default MatchSummaryBadges;
