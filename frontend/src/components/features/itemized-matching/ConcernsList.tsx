/**
 * ConcernsList Component
 *
 * Displays a list of concerns/warnings about a match.
 * Shows yellow/orange warnings for potential issues or gaps.
 *
 * @module components/features/itemized-matching/ConcernsList
 */

'use client';

import {
  Warning24Regular,
  Info24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ConcernsListProps {
  concerns: string[];
  maxVisible?: number;
  compact?: boolean;
  className?: string;
}

/**
 * Parse concern to determine severity
 */
function getConcernSeverity(concern: string): 'high' | 'medium' | 'low' {
  const lowerConcern = concern.toLowerCase();
  if (
    lowerConcern.includes('critical') ||
    lowerConcern.includes('no match') ||
    lowerConcern.includes('missing') ||
    lowerConcern.includes('required')
  ) {
    return 'high';
  }
  if (
    lowerConcern.includes('weak') ||
    lowerConcern.includes('limited') ||
    lowerConcern.includes('partial')
  ) {
    return 'medium';
  }
  return 'low';
}

/**
 * Get severity styling
 */
function getSeverityStyles(severity: 'high' | 'medium' | 'low') {
  switch (severity) {
    case 'high':
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: 'text-red-400',
        text: 'text-red-300',
      };
    case 'medium':
      return {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        icon: 'text-yellow-400',
        text: 'text-yellow-300',
      };
    case 'low':
      return {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        icon: 'text-yellow-400',
        text: 'text-yellow-300',
      };
  }
}

export function ConcernsList({
  concerns,
  maxVisible = 3,
  compact = false,
  className,
}: ConcernsListProps) {
  const [expanded, setExpanded] = useState(false);

  if (!concerns || concerns.length === 0) {
    return null;
  }

  const visibleConcerns = expanded ? concerns : concerns.slice(0, maxVisible);
  const hasMore = concerns.length > maxVisible;

  // Sort concerns by severity
  const sortedConcerns = [...visibleConcerns].sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[getConcernSeverity(a)] - severityOrder[getConcernSeverity(b)];
  });

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Warning24Regular className="w-4 h-4 text-yellow-400" />
        <span className="text-xs text-yellow-300">
          {concerns.length} concern{concerns.length !== 1 ? 's' : ''} to review
        </span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Warning24Regular className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-medium text-yellow-300">
          Potential Concerns ({concerns.length})
        </span>
      </div>

      <div className="space-y-2">
        {sortedConcerns.map((concern, idx) => {
          const severity = getConcernSeverity(concern);
          const styles = getSeverityStyles(severity);

          return (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-2 p-2.5 rounded-lg border',
                styles.bg,
                styles.border
              )}
            >
              {severity === 'high' ? (
                <Warning24Regular className={cn('w-4 h-4 flex-shrink-0 mt-0.5', styles.icon)} />
              ) : (
                <Info24Regular className={cn('w-4 h-4 flex-shrink-0 mt-0.5', styles.icon)} />
              )}
              <span className={cn('text-sm', styles.text)}>{concern}</span>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-th-text-t hover:text-th-text transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp24Regular className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown24Regular className="w-4 h-4" />
              Show {concerns.length - maxVisible} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default ConcernsList;
