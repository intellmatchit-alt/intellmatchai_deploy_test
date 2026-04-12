'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { getProfileImprovements, type ProfileImprovementsResponse, type ImprovementSuggestion } from '@/lib/api/matches';

function ImpactBadge({ impact, t }: { impact: string; t: any }) {
  const colors: Record<string, string> = {
    HIGH: 'bg-red-500/20 text-red-400',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400',
    LOW: 'bg-blue-500/20 text-blue-400',
  };
  const labels: Record<string, string> = {
    HIGH: t.contacts.matchDetails.highImpact,
    MEDIUM: t.contacts.matchDetails.mediumImpact,
    LOW: t.contacts.matchDetails.lowImpact,
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[impact] || colors.LOW}`}>
      {labels[impact] || impact}
    </span>
  );
}

export default function ProfileImprovementCard() {
  const { t } = useI18n();
  const [data, setData] = useState<ProfileImprovementsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfileImprovements()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-dark-800 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-dark-700 rounded w-1/3 mb-3" />
        <div className="h-2 bg-dark-700 rounded w-full mb-4" />
        <div className="space-y-2">
          <div className="h-10 bg-dark-700 rounded" />
          <div className="h-10 bg-dark-700 rounded" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-dark-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3">
        {t.contacts.matchDetails.profileImprovements}
      </h3>

      {/* Completeness bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-dark-300 mb-1">
          <span>{t.contacts.matchDetails.profileCompleteness}</span>
          <span>{data.completeness}%</span>
        </div>
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              data.completeness >= 80 ? 'bg-green-500' : data.completeness >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${data.completeness}%` }}
          />
        </div>
      </div>

      {/* Suggestions */}
      {data.suggestions.length === 0 ? (
        <p className="text-sm text-dark-400">{t.contacts.matchDetails.noSuggestions}</p>
      ) : (
        <div className="space-y-2">
          {data.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 p-2 bg-dark-700/50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-dark-300">{s.category}</span>
                  <ImpactBadge impact={s.impact} t={t} />
                </div>
                <p className="text-xs text-dark-200">{s.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
