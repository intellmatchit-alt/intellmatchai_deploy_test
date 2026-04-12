/**
 * SuggestedActionCard Component
 *
 * Displays suggested actions for follow-up with a match.
 * Shows action type, description, and optional message template.
 *
 * @module components/features/itemized-matching/SuggestedActionCard
 */

'use client';

import {
  Send24Regular,
  PersonAdd24Regular,
  Calendar24Regular,
  Chat24Regular,
  Share24Regular,
  Rocket24Regular,
  Copy24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SuggestedAction } from './types';

interface SuggestedActionCardProps {
  actions: SuggestedAction[];
  onAction?: (action: SuggestedAction) => void;
  messageTemplate?: string;
  targetName?: string;
  className?: string;
}

/**
 * Get icon for action type
 */
function getActionIcon(type: SuggestedAction['type']): React.ComponentType<{ className?: string }> {
  switch (type) {
    case 'APPROACH':
      return Rocket24Regular;
    case 'CONNECT':
      return PersonAdd24Regular;
    case 'MESSAGE':
      return Chat24Regular;
    case 'SCHEDULE':
      return Calendar24Regular;
    case 'SHARE':
      return Share24Regular;
    default:
      return Send24Regular;
  }
}

/**
 * Get priority styling
 */
function getPriorityStyles(priority: 'high' | 'medium' | 'low') {
  switch (priority) {
    case 'high':
      return {
        bg: 'bg-gradient-to-r from-emerald-600 to-teal-600',
        hover: 'hover:from-emerald-500 hover:to-emerald-500',
        badge: 'bg-red-500/20 text-red-400',
      };
    case 'medium':
      return {
        bg: 'bg-gradient-to-r from-blue-600 to-cyan-600',
        hover: 'hover:from-blue-500 hover:to-cyan-500',
        badge: 'bg-yellow-500/20 text-yellow-400',
      };
    case 'low':
      return {
        bg: 'bg-th-surface-h',
        hover: 'hover:bg-th-surface-h',
        badge: 'bg-white/[0.03]0/20 text-th-text-t',
      };
  }
}

export function SuggestedActionCard({
  actions,
  onAction,
  messageTemplate,
  targetName,
  className,
}: SuggestedActionCardProps) {
  const [copied, setCopied] = useState(false);

  if (!actions || actions.length === 0) {
    return null;
  }

  // Get primary action (highest priority)
  const sortedActions = [...actions].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const primaryAction = sortedActions[0];
  const secondaryActions = sortedActions.slice(1);

  const primaryStyles = getPriorityStyles(primaryAction.priority);
  const PrimaryIcon = getActionIcon(primaryAction.type);

  const handleCopyTemplate = async () => {
    if (messageTemplate) {
      await navigator.clipboard.writeText(messageTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Rocket24Regular className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-th-text">Suggested Actions</span>
      </div>

      {/* Primary action button */}
      <button
        onClick={() => onAction?.(primaryAction)}
        className={cn(
          'w-full flex items-center gap-3 p-4 rounded-xl text-th-text font-medium transition-all',
          primaryStyles.bg,
          primaryStyles.hover
        )}
      >
        <div className="w-10 h-10 bg-th-surface-h rounded-lg flex items-center justify-center">
          <PrimaryIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{primaryAction.label}</span>
            {primaryAction.priority === 'high' && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-th-surface-h rounded">
                RECOMMENDED
              </span>
            )}
          </div>
          {primaryAction.description && (
            <p className="text-sm text-th-text/70 mt-0.5">{primaryAction.description}</p>
          )}
        </div>
      </button>

      {/* Secondary actions */}
      {secondaryActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {secondaryActions.map((action, idx) => {
            const ActionIcon = getActionIcon(action.type);
            const styles = getPriorityStyles(action.priority);

            return (
              <button
                key={idx}
                onClick={() => onAction?.(action)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-th-text transition-all',
                  styles.bg,
                  styles.hover
                )}
              >
                <ActionIcon className="w-4 h-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Message template */}
      {messageTemplate && (
        <div className="mt-4 p-3 bg-th-surface border border-th-border rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-th-text-m">Message Template</span>
            <button
              onClick={handleCopyTemplate}
              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {copied ? (
                <>
                  <Checkmark24Regular className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy24Regular className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="text-sm text-th-text-s whitespace-pre-wrap">
            {messageTemplate.replace('{name}', targetName || 'them')}
          </p>
        </div>
      )}
    </div>
  );
}

export default SuggestedActionCard;
