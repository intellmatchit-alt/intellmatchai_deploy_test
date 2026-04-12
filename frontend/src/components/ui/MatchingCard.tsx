'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Person24Regular,
  Building24Regular,
  Briefcase24Regular,
  Location24Regular,
  Mail24Regular,
  Phone24Regular,
  Chat24Regular,
  PersonAdd24Regular,
  ChevronRight24Regular,
  Copy24Regular,
  Checkmark24Regular,
  Lightbulb24Regular,
  Star24Regular,
  BookmarkAdd24Regular,
  Dismiss24Regular,
  Eye24Regular,
} from '@fluentui/react-icons';

interface MatchingCardProps {
  id: string;
  name: string;
  avatarUrl?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  email?: string;
  phone?: string;
  // Matching data
  matchReasons?: string[];
  sharedSectors?: string[];
  sharedSkills?: string[];
  sharedInterests?: string[];
  iceBreakers?: string[];
  statusLabel?: string;
  statusColor?: 'green' | 'blue' | 'purple' | 'yellow' | 'orange' | 'red' | 'neutral';
  // Display options
  variant?: 'compact' | 'full';
  showContactInfo?: boolean;
  showIceBreakers?: boolean;
  // Actions
  onViewProfile?: () => void;
  onMessage?: () => void;
  onSave?: () => void;
  onDismiss?: () => void;
  onAddToContacts?: () => void;
  linkTo?: string;
}

const STATUS_COLORS = {
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  purple: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  orange: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  neutral: 'bg-white/[0.03]0/20 text-th-text-t border-neutral-500/30',
};

const GRADIENT_COLORS = {
  green: 'from-green-500 to-emerald-500',
  blue: 'from-blue-500 to-cyan-500',
  purple: 'from-emerald-500 to-teal-500',
  yellow: 'from-yellow-500 to-amber-400',
  orange: 'from-cyan-500 to-teal-500',
  red: 'from-red-500 to-emerald-500',
  neutral: 'from-neutral-500 to-neutral-400',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function MatchingCard({
  id,
  name,
  avatarUrl,
  jobTitle,
  company,
  location,
  email,
  phone,
  matchReasons = [],
  sharedSectors = [],
  sharedSkills = [],
  sharedInterests = [],
  iceBreakers = [],
  statusLabel,
  statusColor = 'purple',
  variant = 'full',
  showContactInfo = true,
  showIceBreakers = true,
  onViewProfile,
  onMessage,
  onSave,
  onDismiss,
  onAddToContacts,
  linkTo,
}: MatchingCardProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const isCompact = variant === 'compact';
  const hasSharedItems = sharedSectors.length > 0 || sharedSkills.length > 0 || sharedInterests.length > 0;
  const hasContactInfo = email || phone || location;

  const CardWrapper = linkTo ? Link : 'div';
  const cardProps = linkTo ? { href: linkTo } : {};

  return (
    <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden hover:border-emerald-500/30 hover:bg-th-surface-h transition-all">
      {/* Main Content */}
      <div className={`p-4 ${isCompact ? '' : 'pb-3'}`}>
        <div className="flex gap-4">
          {/* Left: Avatar */}
          <div className="flex-shrink-0">
            <div className={`relative w-14 h-14 rounded-full p-0.5 bg-gradient-to-br ${GRADIENT_COLORS[statusColor]}`}>
              <div className="w-full h-full rounded-full bg-th-bg-s flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-th-text">{getInitials(name)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-th-text truncate">{name}</h3>
              {statusLabel && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[statusColor]}`}>
                  {statusLabel}
                </span>
              )}
            </div>

            {(jobTitle || company) && (
              <p className="text-sm text-th-text-t truncate flex items-center gap-1">
                {jobTitle && <span>{jobTitle}</span>}
                {jobTitle && company && <span className="text-white/70">at</span>}
                {company && <span className="text-th-text-s">{company}</span>}
              </p>
            )}

            {/* Contact Info Row */}
            {showContactInfo && hasContactInfo && !isCompact && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-th-text-m">
                {location && (
                  <span className="flex items-center gap-1">
                    <Location24Regular className="w-3 h-3" />
                    {location}
                  </span>
                )}
                {email && (
                  <span className="flex items-center gap-1">
                    <Mail24Regular className="w-3 h-3" />
                    {email}
                  </span>
                )}
                {phone && (
                  <span className="flex items-center gap-1">
                    <Phone24Regular className="w-3 h-3" />
                    {phone}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Quick Actions or Arrow */}
          <div className="flex items-start gap-1 flex-shrink-0">
            {isCompact ? (
              <ChevronRight24Regular className="w-5 h-5 text-th-text-m" />
            ) : (
              <>
                {onSave && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(); }}
                    className="p-2 rounded-lg hover:bg-yellow-500/20 text-th-text-t hover:text-yellow-400 transition-colors"
                    title="Save"
                  >
                    <BookmarkAdd24Regular className="w-4 h-4" />
                  </button>
                )}
                {onMessage && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMessage(); }}
                    className="p-2 rounded-lg hover:bg-emerald-500/20 text-th-text-t hover:text-emerald-400 transition-colors"
                    title="Message"
                  >
                    <Chat24Regular className="w-4 h-4" />
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-th-text-t hover:text-red-400 transition-colors"
                    title="Dismiss"
                  >
                    <Dismiss24Regular className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Shared Items */}
        {hasSharedItems && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sharedSectors.slice(0, isCompact ? 2 : 4).map((sector, i) => (
              <span key={`sector-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {sector}
              </span>
            ))}
            {sharedSkills.slice(0, isCompact ? 2 : 4).map((skill, i) => (
              <span key={`skill-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                {skill}
              </span>
            ))}
            {sharedInterests.slice(0, isCompact ? 1 : 2).map((interest, i) => (
              <span key={`interest-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {interest}
              </span>
            ))}
            {!isCompact && (sharedSectors.length + sharedSkills.length + sharedInterests.length) > 10 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-th-surface-h text-th-text-t">
                +{(sharedSectors.length + sharedSkills.length + sharedInterests.length) - 10} more
              </span>
            )}
          </div>
        )}

        {/* Match Reasons */}
        {matchReasons.length > 0 && !isCompact && (
          <div className="mt-3 space-y-1">
            {matchReasons.slice(0, 3).map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-th-text-s">{reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ice Breakers */}
      {showIceBreakers && iceBreakers.length > 0 && !isCompact && (
        <div className="px-4 pb-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb24Regular className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Ice Breakers</span>
            </div>
            <div className="space-y-2">
              {iceBreakers.slice(0, 2).map((iceBreaker, idx) => (
                <div key={idx} className="group relative bg-th-surface rounded-lg p-2 pr-10">
                  <p className="text-xs text-th-text-s italic">&quot;{iceBreaker}&quot;</p>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopy(iceBreaker, idx); }}
                    className="absolute top-2 right-2 p-1 text-th-text-m hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {copiedIndex === idx ? (
                      <Checkmark24Regular className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy24Regular className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!isCompact && (onViewProfile || onAddToContacts || linkTo) && (
        <div className="px-4 pb-4 flex gap-2">
          {onViewProfile && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewProfile(); }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-th-surface border border-th-border text-th-text text-sm font-medium rounded-xl hover:bg-th-surface-h transition-colors"
            >
              <Eye24Regular className="w-4 h-4" />
              View Profile
            </button>
          )}
          {onAddToContacts && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToContacts(); }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium rounded-xl hover:bg-blue-500/30 transition-colors"
            >
              <PersonAdd24Regular className="w-4 h-4" />
              Add Contact
            </button>
          )}
          {linkTo && (
            <Link
              href={linkTo}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
            >
              View Details
              <ChevronRight24Regular className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default MatchingCard;
