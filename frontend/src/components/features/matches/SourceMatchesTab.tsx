'use client';

import { useState, useCallback } from 'react';
import { MatchCard, type MatchCardData } from './MatchCard';
import { People24Regular } from '@fluentui/react-icons';
import type { Translations } from '@/lib/i18n/en';

const STORAGE_KEY = 'matches-local-statuses';

function getLocalStatuses(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveLocalStatuses(statuses: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
}

/** Apply local statuses to match array (mutates in place) */
export function applyLocalStatuses(matches: MatchCardData[]) {
  const localStatuses = getLocalStatuses();
  for (const m of matches) {
    if (localStatuses[m.id]) {
      m.status = localStatuses[m.id];
    }
  }
  return matches;
}

interface SourceMatchesTabProps {
  matches: MatchCardData[];
  setMatches: React.Dispatch<React.SetStateAction<any[]>>;
  t: Translations;
  isLoading?: boolean;
  emptyMessage?: string;
}

const DISMISSED_STATUSES = ['DISMISSED', 'IGNORED'];
const ARCHIVED_STATUSES = ['ARCHIVED'];
const ACTIVE_STATUSES_EXCLUDE = [...DISMISSED_STATUSES, ...ARCHIVED_STATUSES];

export function SourceMatchesTab({ matches, setMatches, t, isLoading, emptyMessage }: SourceMatchesTabProps) {
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'dismissed'>('active');

  const handleStatusChange = useCallback((matchId: string, status: string) => {
    const localStatuses = getLocalStatuses();

    if (status === 'ACTIVE') {
      delete localStatuses[matchId];
    } else {
      localStatuses[matchId] = status;
    }

    saveLocalStatuses(localStatuses);
    setMatches((prev: any[]) => prev.map((m: any) =>
      m.id === matchId ? { ...m, status: status === 'ACTIVE' ? 'PENDING' : status } : m
    ));
  }, [setMatches]);

  const activeMatches = matches.filter(m => !ACTIVE_STATUSES_EXCLUDE.includes(m.status));
  const archivedMatches = matches.filter(m => ARCHIVED_STATUSES.includes(m.status));
  const dismissedMatches = matches.filter(m => DISMISSED_STATUSES.includes(m.status));

  const statusMatches = statusFilter === 'archived' ? archivedMatches
    : statusFilter === 'dismissed' ? dismissedMatches
    : activeMatches;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-th-surface border border-th-border rounded-xl p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-th-surface-h" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-th-surface-h rounded" />
                <div className="h-3 w-24 bg-th-surface-h rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Active/Archived/Dismissed tabs */}
      <div className="flex gap-1 p-1 bg-th-surface rounded-xl">
        {([
          { id: 'active' as const, label: t.matchActions?.connect ? 'Active' : 'Active', count: activeMatches.length },
          { id: 'archived' as const, label: t.matchActions?.archived || 'Archived', count: archivedMatches.length },
          { id: 'dismissed' as const, label: t.matchActions?.dismissed || 'Dismissed', count: dismissedMatches.length },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === tab.id
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Match cards */}
      {statusMatches.length > 0 ? (
        <div className="space-y-3">
          {statusMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onStatusChange={handleStatusChange}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="bg-th-surface border border-th-border rounded-xl p-8 text-center">
          <People24Regular className="w-8 h-8 text-white/70 mx-auto mb-2" />
          <p className="text-th-text-t text-sm">
            {matches.length === 0
              ? (emptyMessage || 'No matches found yet. Run matching to find contacts.')
              : 'No matches with this filter'}
          </p>
        </div>
      )}
    </div>
  );
}
