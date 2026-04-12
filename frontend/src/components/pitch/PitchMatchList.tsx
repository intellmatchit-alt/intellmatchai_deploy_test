'use client';

/**
 * PNME Component: Pitch Match List
 * Right panel showing ranked contacts for a section
 */

import { useState } from 'react';
import { getMatchStrength } from '@/lib/utils/match-strength';
import {
  PersonRegular,
  BookmarkRegular,
  BookmarkAddRegular,
  DismissCircleRegular,
  MailRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  CheckmarkCircleRegular,
} from '@fluentui/react-icons';
import { useUpdateMatchStatus } from '@/hooks/pitch/useUpdateMatchStatus';
import { useI18n } from '@/lib/i18n';
import { MatchActionBar } from '@/components/features/matches';

interface Contact {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  matchScore: number | null;
}

interface MatchReason {
  type: string;
  text: string;
  evidence: string;
}

interface MatchBreakdown {
  relevance: { score: number; weight: number; weighted: number };
  expertise: { score: number; weight: number; weighted: number };
  strategic: { score: number; weight: number; weighted: number };
  relationship: { score: number; weight: number; weighted: number };
}

interface PitchMatch {
  id: string;
  contact: Contact;
  score: number;
  breakdown: MatchBreakdown;
  reasons: MatchReason[];
  angleCategory: string | null;
  outreachDraft: string | null;
  status: string;
}

interface PitchSection {
  id: string;
  type: string;
  title: string;
  content: string;
  matches: PitchMatch[];
}

interface PitchMatchListProps {
  section: PitchSection;
  onOpenOutreach: (matchId: string, contactId: string, contactName: string, outreachDraft: string) => void;
}

const angleLabels: Record<string, string> = {
  INVESTOR_FIT: 'Investor Fit',
  TECHNICAL_ADVISOR: 'Technical Advisor',
  MARKET_ACCESS: 'Market Access',
  STRATEGIC_PARTNER: 'Strategic Partner',
  DOMAIN_EXPERT: 'Domain Expert',
  TALENT_SOURCE: 'Talent Source',
  CUSTOMER_INTRO: 'Customer Intro',
  REGULATORY_HELP: 'Regulatory Help',
};

export function PitchMatchList({ section, onOpenOutreach }: PitchMatchListProps) {
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const { mutate: updateStatus } = useUpdateMatchStatus();
  const { t } = useI18n();

  const handleStatusChange = (matchId: string, status: string) => {
    updateStatus({ matchId, status: status as any });
  };

  if (!section.matches || section.matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <PersonRegular className="w-16 h-16 text-dark-500 mb-4" />
        <h3 className="text-th-text font-medium mb-2">No matches found</h3>
        <p className="text-dark-400 max-w-sm">
          We couldn't find any contacts that match well with this section.
          Try adding more contacts or enriching their profiles.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-th-text font-medium text-lg">{section.title}</h2>
        <p className="text-dark-400 text-sm mt-1 line-clamp-2">{section.content}</p>
      </div>

      {/* Match List */}
      <div className="space-y-4">
        {section.matches.map((match, index) => {
          const isExpanded = expandedMatch === match.id;
          const isSaved = match.status === 'SAVED';
          const isIgnored = match.status === 'IGNORED';

          return (
            <div
              key={match.id}
              className={`bg-dark-800 rounded-xl border transition-colors ${
                isIgnored
                  ? 'border-dark-700 opacity-50'
                  : isSaved
                  ? 'border-green-500/30'
                  : 'border-dark-700 hover:border-dark-600'
              }`}
            >
              {/* Main Card */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  {/* Contact Info */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {match.contact.avatarUrl ? (
                        <img
                          src={match.contact.avatarUrl}
                          alt={match.contact.fullName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center">
                          <PersonRegular className="w-6 h-6 text-dark-400" />
                        </div>
                      )}
                      {/* Rank Badge */}
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-th-text">
                        {index + 1}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-th-text font-medium">{match.contact.fullName}</h3>
                      {match.contact.jobTitle && (
                        <p className="text-dark-400 text-sm">
                          {match.contact.jobTitle}
                          {match.contact.company && ` at ${match.contact.company}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  {(() => {
                    const strength = getMatchStrength(match.score);
                    return (
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${strength.textClass}`}>
                          {match.score}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${strength.badgeClass}`}>{strength.label}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Angle Badge */}
                {match.angleCategory && (
                  <div className="mt-3">
                    <span className="inline-flex items-center px-2 py-1 bg-[#00d084]/50/20 text-primary-400 text-xs rounded-full">
                      {angleLabels[match.angleCategory] || match.angleCategory}
                    </span>
                  </div>
                )}

                {/* Top Reasons */}
                <div className="mt-3 space-y-2">
                  {match.reasons.slice(0, 3).map((reason, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckmarkCircleRegular className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-dark-200 text-sm">{reason.text}</p>
                        {reason.evidence && (
                          <p className="text-dark-500 text-xs mt-0.5">{reason.evidence}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                    className="flex items-center gap-1 text-dark-400 hover:text-th-text text-sm transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUpRegular className="w-4 h-4" />
                        Less details
                      </>
                    ) : (
                      <>
                        <ChevronDownRegular className="w-4 h-4" />
                        More details
                      </>
                    )}
                  </button>

                  <MatchActionBar
                    currentStatus={match.status}
                    contactName={match.contact.fullName}
                    channels={{ phone: (match.contact as any).phone, email: (match.contact as any).email, linkedinUrl: (match.contact as any).linkedinUrl }}
                    onStatusChange={(status) => handleStatusChange(match.id, status)}
                    dismissStatus="IGNORED"
                    t={t}
                  />
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-dark-700 p-4">
                  <h4 className="text-th-text font-medium mb-3">Score Breakdown</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <ScoreBar
                      label="Relevance"
                      score={match.breakdown.relevance.score}
                      weight={match.breakdown.relevance.weight}
                    />
                    <ScoreBar
                      label="Expertise"
                      score={match.breakdown.expertise.score}
                      weight={match.breakdown.expertise.weight}
                    />
                    <ScoreBar
                      label="Strategic"
                      score={match.breakdown.strategic.score}
                      weight={match.breakdown.strategic.weight}
                    />
                    <ScoreBar
                      label="Relationship"
                      score={match.breakdown.relationship.score}
                      weight={match.breakdown.relationship.weight}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-dark-400 text-xs">{label}</span>
        <span className="text-dark-300 text-xs">{Math.round(score)}</span>
      </div>
      <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#00d084]/50 rounded-full"
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-dark-500 text-xs mt-1">{(weight * 100).toFixed(0)}% weight</p>
    </div>
  );
}
