/**
 * CriterionExplanationModal Component
 *
 * Modal dialog showing detailed explanation of a criterion match.
 * Displays full breakdown with source/target values, matched items, and details.
 *
 * @module components/features/itemized-matching/CriterionExplanationModal
 */

'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
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
  Checkmark24Regular,
  Dismiss24Regular,
  ArrowRight24Regular,
} from '@fluentui/react-icons';
import { cn } from '@/lib/utils';
import {
  CriterionMatch,
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

function getCriterionIcon(criterionId: string): React.ComponentType<{ className?: string }> {
  const normalized = criterionId.toLowerCase().replace(/[_-]/g, '_');
  return CRITERION_ICONS[normalized] || Target24Regular;
}

interface CriterionExplanationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criterion: CriterionMatch | null;
  sourceName?: string;
  targetName?: string;
}

export function CriterionExplanationModal({
  open,
  onOpenChange,
  criterion,
  sourceName = 'You',
  targetName = 'Them',
}: CriterionExplanationModalProps) {
  if (!criterion) return null;

  const statusConfig = STATUS_CONFIG[criterion.status];
  const importanceConfig = IMPORTANCE_CONFIG[criterion.importance as CriterionImportance];
  const Icon = getCriterionIcon(criterion.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-th-bg-s border-th-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                statusConfig.bgColor
              )}
            >
              <Icon className={cn('w-6 h-6', statusConfig.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-th-text">{criterion.name}</span>
                {criterion.importance === 'CRITICAL' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400 rounded">
                    CRITICAL
                  </span>
                )}
                {criterion.importance === 'HIGH' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-yellow-500/20 text-yellow-400 rounded">
                    HIGH
                  </span>
                )}
              </div>
              <p className="text-sm text-th-text-t font-normal">{criterion.explanation.summary}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Score display */}
          <div className="flex items-center justify-between p-4 bg-th-surface rounded-xl">
            <div>
              <p className="text-sm text-th-text-t">Match Score</p>
              <p className={cn('text-3xl font-bold', statusConfig.color)}>
                {criterion.score}%
              </p>
            </div>
            <div
              className={cn(
                'px-4 py-2 rounded-lg font-medium',
                statusConfig.bgColor,
                statusConfig.color
              )}
            >
              {statusConfig.label}
            </div>
          </div>

          {/* Score bar */}
          <div>
            <div className="h-3 bg-th-surface-h rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  criterion.status === 'PERFECT' && 'bg-gradient-to-r from-emerald-600 to-emerald-400',
                  criterion.status === 'EXCELLENT' && 'bg-gradient-to-r from-green-600 to-green-400',
                  criterion.status === 'STRONG' && 'bg-gradient-to-r from-blue-600 to-blue-400',
                  criterion.status === 'MODERATE' && 'bg-gradient-to-r from-yellow-600 to-yellow-400',
                  criterion.status === 'WEAK' && 'bg-gradient-to-r from-yellow-600 to-yellow-400',
                  criterion.status === 'NO_MATCH' && 'bg-gradient-to-r from-neutral-600 to-neutral-400'
                )}
                style={{ width: `${criterion.score}%` }}
              />
            </div>
          </div>

          {/* Value comparison */}
          {(criterion.explanation.sourceValue || criterion.explanation.targetValue) && (
            <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center">
              <div className="bg-th-surface rounded-xl p-3">
                <p className="text-xs text-th-text-m mb-1">{sourceName}</p>
                <p className="text-sm text-th-text">
                  {criterion.explanation.sourceValue || 'Not specified'}
                </p>
              </div>
              <ArrowRight24Regular className="w-5 h-5 text-th-text-m" />
              <div className="bg-th-surface rounded-xl p-3">
                <p className="text-xs text-th-text-m mb-1">{targetName}</p>
                <p className="text-sm text-th-text">
                  {criterion.explanation.targetValue || 'Not specified'}
                </p>
              </div>
            </div>
          )}

          {/* Matched items */}
          {criterion.explanation.matchedItems && criterion.explanation.matchedItems.length > 0 && (
            <div>
              <p className="text-xs text-th-text-m mb-2">Matching Points</p>
              <div className="flex flex-wrap gap-2">
                {criterion.explanation.matchedItems.map((item, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5',
                      statusConfig.bgColor,
                      statusConfig.color
                    )}
                  >
                    <Checkmark24Regular className="w-4 h-4" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Details list */}
          {criterion.explanation.details && criterion.explanation.details.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-th-text-m">Details</p>
              {criterion.explanation.details.map((detail, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 bg-th-surface rounded-lg"
                >
                  {detail.startsWith('✅') ? (
                    <Checkmark24Regular className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : detail.startsWith('❌') ? (
                    <Dismiss24Regular className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <span className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span className="text-sm text-th-text-s">
                    {detail.replace(/^[✅❌]\s*/, '')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Complementary note */}
          {criterion.explanation.complementaryNote && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-sm text-emerald-300">
                <span className="font-semibold">Complementary Match: </span>
                {criterion.explanation.complementaryNote}
              </p>
            </div>
          )}

          {/* Match type */}
          <div className="flex items-center justify-between pt-2 border-t border-th-border">
            <span className="text-sm text-th-text-m">Match Type</span>
            <span
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-lg',
                criterion.matchType === 'EXACT' && 'bg-emerald-500/20 text-emerald-400',
                criterion.matchType === 'PARTIAL' && 'bg-blue-500/20 text-blue-400',
                criterion.matchType === 'COMPLEMENTARY' && 'bg-emerald-500/20 text-emerald-400',
                criterion.matchType === 'NONE' && 'bg-white/[0.03]0/20 text-th-text-t'
              )}
            >
              {criterion.matchType === 'EXACT' && 'Exact Match'}
              {criterion.matchType === 'PARTIAL' && 'Partial Match'}
              {criterion.matchType === 'COMPLEMENTARY' && 'Complementary'}
              {criterion.matchType === 'NONE' && 'No Match'}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CriterionExplanationModal;
