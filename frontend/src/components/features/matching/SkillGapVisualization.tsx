'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { getSkillGap, type SkillGapResponse } from '@/lib/api/matches';

interface SkillGapVisualizationProps {
  contactId: string;
}

const MATCH_TYPE_COLORS: Record<string, string> = {
  EXACT: 'text-green-400',
  SYNONYM: 'text-green-300',
  CHILD: 'text-blue-400',
  IMPLIED: 'text-blue-300',
  RELATED: 'text-yellow-400',
  PARENT: 'text-yellow-300',
};

export default function SkillGapVisualization({ contactId }: SkillGapVisualizationProps) {
  const { t } = useI18n();
  const [data, setData] = useState<SkillGapResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSkillGap(contactId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-dark-700 rounded w-1/4" />
        <div className="h-20 bg-dark-700 rounded" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-white">
        {t.contacts.matchDetails.skillGapAnalysis}
      </h4>

      {/* Matched Skills */}
      {data.matchedSkills.length > 0 && (
        <div>
          <p className="text-xs text-dark-400 mb-1">{t.contacts.matchDetails.matchedSkills}</p>
          <div className="flex flex-wrap gap-1">
            {data.matchedSkills.map((m, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-0.5 bg-dark-700 rounded-full ${MATCH_TYPE_COLORS[m.matchType] || 'text-dark-300'}`}
                title={`${m.source} → ${m.target} (${m.matchType})`}
              >
                {m.target}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing Skills */}
      {data.missingSkills.length > 0 && (
        <div>
          <p className="text-xs text-dark-400 mb-1">{t.contacts.matchDetails.missingSkills}</p>
          <div className="flex flex-wrap gap-1">
            {data.missingSkills.map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Learnable Skills */}
      {data.learnableSkills.length > 0 && (
        <div>
          <p className="text-xs text-dark-400 mb-1">{t.contacts.matchDetails.learnableSkills}</p>
          <div className="flex flex-wrap gap-1">
            {data.learnableSkills.map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-full">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Complementary Skills */}
      {data.complementarySkills.length > 0 && (
        <div>
          <p className="text-xs text-dark-400 mb-1">{t.contacts.matchDetails.complementarySkills}</p>
          <div className="flex flex-wrap gap-1">
            {data.complementarySkills.slice(0, 6).map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
