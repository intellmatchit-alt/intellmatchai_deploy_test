/**
 * CriterionScoreItem Component
 *
 * Displays a single criterion's score with expandable details.
 * Shows score bar, status badge, and explanation.
 *
 * @module components/features/itemized-matching/CriterionScoreItem
 */

'use client';

import { useState } from 'react';
import {
  ChevronDown24Regular,
  ChevronUp24Regular,
  Info16Regular,
  Target24Regular,
  Briefcase24Regular,
  Building24Regular,
  Wrench24Regular,
  Location24Regular,
  Lightbulb24Regular,
  PeopleTeam24Regular,
  Heart24Regular,
  Certificate24Regular,
  CalendarClock24Regular,
  Money24Regular,
  Rocket24Regular,
} from '@fluentui/react-icons';
import { cn } from '@/lib/utils';
import {
  CriterionScoreItemProps,
  STATUS_CONFIG,
  IMPORTANCE_CONFIG,
  CriterionImportance,
} from './types';

/**
 * Icon mapping for criteria
 */
const CRITERION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  industry: Building24Regular,
  sector: Building24Regular,
  skills: Wrench24Regular,
  goals: Target24Regular,
  location: Location24Regular,
  interests: Lightbulb24Regular,
  experience: Briefcase24Regular,
  education: Certificate24Regular,
  investment: Money24Regular,
  stage: Rocket24Regular,
  availability: CalendarClock24Regular,
  complementary_goals: PeopleTeam24Regular,
  network: PeopleTeam24Regular,
  hobbies: Heart24Regular,
};

/**
 * Get icon for criterion
 */
function getCriterionIcon(criterionId: string): React.ComponentType<{ className?: string }> {
  const normalized = criterionId.toLowerCase().replace(/[_-]/g, '_');
  return CRITERION_ICONS[normalized] || Target24Regular;
}

/**
 * CriterionScoreItem component
 */
export function CriterionScoreItem({
  criterion,
  expanded: controlledExpanded,
  onToggle,
  showDetails = true,
}: CriterionScoreItemProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded ?? internalExpanded;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  const statusConfig = STATUS_CONFIG[criterion.status];
  const importanceConfig = IMPORTANCE_CONFIG[criterion.importance as CriterionImportance];
  const Icon = getCriterionIcon(criterion.id);

  return (
    <div
      className={cn(
        'rounded-xl border transition-all',
        statusConfig.borderColor,
        expanded ? 'bg-th-surface' : 'bg-th-surface hover:bg-white/[0.05]'
      )}
    >
      {/* Main row */}
      <button
        onClick={showDetails ? handleToggle : undefined}
        className={cn(
          'w-full flex items-center gap-3 p-3 text-left',
          showDetails && 'cursor-pointer'
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            statusConfig.bgColor
          )}
        >
          <Icon className={cn('w-5 h-5', statusConfig.color)} />
        </div>

        {/* Name and importance */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-th-text truncate">{criterion.name}</span>
            {/* Only show CRITICAL badge when there's actual match data */}
            {criterion.importance === 'CRITICAL' && criterion.score > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400 rounded">
                CRITICAL
              </span>
            )}
          </div>
          <p className="text-xs text-th-text-s truncate mt-0.5">
            {criterion.explanation.summary}
          </p>
          {/* Taxonomy relationship evidence (e.g., "React → JavaScript (RELATED)") */}
          {criterion.explanation.details && (() => {
            const taxonomyDetail = criterion.explanation.details.find(
              (d) => /→/.test(d) && /RELATED|PARENT|CHILD|SIBLING/i.test(d)
            );
            return taxonomyDetail ? (
              <p className="text-[10px] text-th-text-m truncate mt-0.5 italic">
                {taxonomyDetail}
              </p>
            ) : null;
          })()}
        </div>

        {/* Status indicator (no score) */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Status label only */}
          <div className="text-right">
            <span className={cn('text-sm font-medium px-2 py-1 rounded-full', statusConfig.bgColor, statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>

          {/* Expand icon */}
          {showDetails && (
            <div className="text-th-text-m">
              {expanded ? (
                <ChevronUp24Regular className="w-5 h-5" />
              ) : (
                <ChevronDown24Regular className="w-5 h-5" />
              )}
            </div>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && showDetails && (
        <div className="px-3 pb-3 pt-0">
          {/* Value comparison */}
          {(criterion.explanation.sourceValue || criterion.explanation.targetValue) && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {criterion.explanation.sourceValue && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-emerald-300 font-semibold mb-1 uppercase tracking-wide">You</p>
                  <p className="text-sm text-th-text">{criterion.explanation.sourceValue}</p>
                </div>
              )}
              {criterion.explanation.targetValue && (
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-cyan-300 font-semibold mb-1 uppercase tracking-wide">Them</p>
                  <p className="text-sm text-th-text">{criterion.explanation.targetValue}</p>
                </div>
              )}
            </div>
          )}

          {/* Matched items */}
          {criterion.explanation.matchedItems && criterion.explanation.matchedItems.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-green-300 font-semibold mb-1.5 uppercase tracking-wide">Matched</p>
              <div className="flex flex-wrap gap-1.5">
                {criterion.explanation.matchedItems.map((item, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'px-2 py-1 text-xs rounded-full',
                      statusConfig.bgColor,
                      statusConfig.color
                    )}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Details list */}
          {criterion.explanation.details && criterion.explanation.details.length > 0 && (
            <div className="space-y-1.5">
              {criterion.explanation.details.map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Info16Regular className="w-3.5 h-3.5 text-th-text-t flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-th-text-s">{detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Complementary note */}
          {criterion.explanation.complementaryNote && (
            <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <p className="text-xs text-emerald-300">
                <span className="font-medium">Complementary: </span>
                {criterion.explanation.complementaryNote}
              </p>
            </div>
          )}

          {/* Match type indicator */}
          {criterion.matchType !== 'NONE' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] text-th-text-t font-medium">Match Type:</span>
              <span
                className={cn(
                  'px-2 py-0.5 text-[10px] font-medium rounded',
                  criterion.matchType === 'EXACT' && 'bg-emerald-500/20 text-emerald-400',
                  criterion.matchType === 'PARTIAL' && 'bg-blue-500/20 text-blue-400',
                  criterion.matchType === 'COMPLEMENTARY' && 'bg-emerald-500/20 text-emerald-400'
                )}
              >
                {criterion.matchType}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CriterionScoreItem;
