'use client';

import { useState } from 'react';
import { MatchActionBar } from './MatchActionBar';
import {
  Star24Filled,
  Lightbulb24Regular,
  Rocket24Regular,
  Handshake24Regular,
  Briefcase24Regular,
} from '@fluentui/react-icons';
import type { Translations } from '@/lib/i18n/en';

/** Source visual config */
const SOURCE_STYLES: Record<string, { bg: string; text: string; border: string; icon: any; label: string }> = {
  project: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25', icon: Lightbulb24Regular, label: 'Project' },
  deal: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/25', icon: Handshake24Regular, label: 'Deal' },
  pitch: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25', icon: Rocket24Regular, label: 'Pitch' },
  job: { bg: 'bg-teal-500/15', text: 'text-teal-300', border: 'border-teal-500/25', icon: Briefcase24Regular, label: 'Job' },
};

/** Props for a unified match card */
export interface MatchCardData {
  id: string;
  source: 'project' | 'deal' | 'pitch' | 'job';
  sourceTitle: string;
  sourceId?: string;
  score: number;
  contactId: string;
  name: string;
  company?: string;
  jobTitle?: string;
  reasons: string[];
  sharedSectors?: string[];
  sharedSkills?: string[];
  status: string;
  channels: {
    intellmatchUserId?: string | null;
    phone?: string | null;
    email?: string | null;
    linkedinUrl?: string | null;
  };
}

interface MatchCardProps {
  match: MatchCardData;
  onStatusChange?: (id: string, status: string) => void;
  t: Translations;
  /** Hide source tag if already in context (e.g. on project detail page) */
  hideSource?: boolean;
  /** @deprecated Card is no longer clickable as a whole. Use actionSlot instead. */
  href?: string;
  /** @deprecated Card is no longer clickable as a whole. Use actionSlot instead. */
  onClick?: () => void;
  /** Optional action element rendered below the score circle */
  actionSlot?: React.ReactNode;
}

/** Score tier helpers — standard across all matching (project, deal, pitch, job) */
function getScoreStyles(score: number) {
  if (score >= 90) return {
    level: 'Excellent Match',
    levelColor: 'bg-[#22C55E] text-black border-[#22C55E]',
    ringColor: 'from-[#22C55E]/30 to-[#22C55E]/30 border-[#22C55E]/40',
    textGradient: 'from-[#22C55E] to-[#22C55E]',
  };
  if (score >= 75) return {
    level: 'Very Good Match',
    levelColor: 'bg-[#84CC16] text-black border-[#84CC16]',
    ringColor: 'from-[#84CC16]/30 to-[#84CC16]/30 border-[#84CC16]/40',
    textGradient: 'from-[#84CC16] to-[#84CC16]',
  };
  if (score >= 60) return {
    level: 'Good Match',
    levelColor: 'bg-[#FACC15] text-black border-[#FACC15]',
    ringColor: 'from-[#FACC15]/30 to-[#FACC15]/30 border-[#FACC15]/40',
    textGradient: 'from-[#FACC15] to-[#FACC15]',
  };
  if (score >= 40) return {
    level: 'Partial Match',
    levelColor: 'bg-[#FB923C] text-black border-[#FB923C]',
    ringColor: 'from-[#FB923C]/30 to-[#FB923C]/30 border-[#FB923C]/40',
    textGradient: 'from-[#FB923C] to-[#FB923C]',
  };
  return {
    level: 'Weak Match',
    levelColor: 'bg-[#EF4444] text-black border-[#EF4444]',
    ringColor: 'from-[#EF4444]/30 to-[#EF4444]/30 border-[#EF4444]/40',
    textGradient: 'from-[#EF4444] to-[#EF4444]',
  };
}

/** Map source type to route prefix and expand section name */
const SOURCE_ROUTES: Record<string, { path: string; section: string }> = {
  project: { path: '/projects', section: 'project' },
  deal: { path: '/deals', section: 'deal' },
  pitch: { path: '/pitch', section: 'pitch' },
  job: { path: '/opportunities', section: 'opportunity' },
};

export function MatchCard({ match, onStatusChange, t, hideSource, actionSlot, onClick }: MatchCardProps) {
  const [updating, setUpdating] = useState(false);
  const { level, levelColor, ringColor, textGradient } = getScoreStyles(match.score);
  const sourceStyle = SOURCE_STYLES[match.source] || SOURCE_STYLES.project;
  const SourceIcon = sourceStyle.icon;

  return (
    <div
      className={`bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden p-4${onClick ? ' cursor-pointer hover:border-white/20 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Left column: Score circle + action button + source tag */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${ringColor} flex items-center justify-center`}>
            <span className={`text-sm font-bold bg-gradient-to-r ${textGradient} bg-clip-text text-transparent`}>
              {Math.round(match.score)}%
            </span>
          </div>
          {/* Source tag */}
          {!hideSource && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${sourceStyle.bg} ${sourceStyle.text} ${sourceStyle.border}`}>
              <SourceIcon className="w-3 h-3" />
              {sourceStyle.label}
            </span>
          )}
          {/* Action button */}
          {actionSlot && <div className="flex-shrink-0">{actionSlot}</div>}
        </div>

        {/* Right column: Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{match.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${levelColor}`}>
              {level}
            </span>
          </div>
          {(match.jobTitle || match.company) && (
            <p className="text-sm text-white truncate">
              {match.jobTitle}{match.jobTitle && match.company ? ' · ' : ''}{match.company}
            </p>
          )}

          {/* Source title */}
          {!hideSource && match.sourceTitle && (
            <p className="text-xs text-white truncate mt-1">{match.sourceTitle}</p>
          )}

          {/* Reasons */}
          {match.reasons.length > 0 && (
            <div className="mt-2 space-y-1">
              {match.reasons.slice(0, 2).map((reason, i) => (
                <p key={i} className="text-xs text-white flex items-start gap-1.5">
                  <Star24Filled className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{reason}</span>
                </p>
              ))}
            </div>
          )}

          {/* Tags */}
          {((match.sharedSectors?.length || 0) > 0 || (match.sharedSkills?.length || 0) > 0) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {match.sharedSectors?.slice(0, 2).map((tag, i) => (
                <span key={`s-${i}`} className="px-2 py-0.5 bg-emerald-400 rounded-full text-[10px] text-[#042820] border border-emerald-400/80 font-bold">
                  {tag}
                </span>
              ))}
              {match.sharedSkills?.slice(0, 2).map((tag, i) => (
                <span key={`k-${i}`} className="px-2 py-0.5 bg-emerald-400 rounded-full text-[10px] text-[#042820] border border-emerald-400/80 font-bold">
                  {tag}
                </span>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Actions bar */}
      {onStatusChange && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <MatchActionBar
            currentStatus={match.status}
            contactName={match.name}
            channels={{
              intellmatchUserId: match.channels.intellmatchUserId,
              phone: match.channels.phone,
              email: match.channels.email,
              linkedinUrl: match.channels.linkedinUrl,
            }}
            onStatusChange={(status) => onStatusChange(match.id, status)}
            isUpdating={updating}
            dismissStatus={match.source === 'pitch' || match.source === 'deal' ? 'IGNORED' : 'DISMISSED'}
            t={t}
          />
        </div>
      )}
    </div>
  );
}
