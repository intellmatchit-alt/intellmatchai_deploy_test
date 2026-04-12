/**
 * Opportunities Index Page
 *
 * Lists all user's opportunities with actions to create, edit, delete, archive, and find matches.
 * Also shows v3 Hiring Profiles and Candidate Profiles in separate tabs.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  Add24Regular,
  PersonAdd24Regular,
  Briefcase24Regular,
  Star24Regular,
  PeopleTeam24Regular,
  Edit24Regular,
  Delete24Regular,
  Sparkle24Regular,
  ChevronRight24Regular,
  Filter24Regular,
  ArrowSync24Regular,
  Location24Regular,
  Clock24Regular,
  People24Regular,
  MoreVertical24Regular,
  Archive24Regular,
  ArrowUndo24Regular,
  Search24Regular,
} from '@fluentui/react-icons';
import {
  listOpportunities,
  deleteOpportunity,
  updateOpportunity,
  findOpportunityMatches,
  Opportunity,
  OpportunityIntentType,
  INTENT_TYPE_OPTIONS,
} from '@/lib/api/opportunities';
import {
  listHiringProfiles,
  listCandidateProfiles,
  deleteHiringProfile,
  deleteCandidateProfile,
  findJobMatches,
  HiringProfile,
  CandidateProfile,
  JOB_SENIORITY_OPTIONS,
  JOB_WORK_MODE_OPTIONS,
  JOB_EMPLOYMENT_TYPE_OPTIONS,
  JOB_AVAILABILITY_OPTIONS,
} from '@/lib/api/job-matching';
import { toast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';

/**
 * Intent type icon mapping
 */
const INTENT_ICONS: Record<OpportunityIntentType, React.ReactNode> = {
  HIRING: <PersonAdd24Regular className="w-5 h-5" />,
  OPEN_TO_OPPORTUNITIES: <Briefcase24Regular className="w-5 h-5" />,
  ADVISORY_BOARD: <Star24Regular className="w-5 h-5" />,
  REFERRALS_ONLY: <PeopleTeam24Regular className="w-5 h-5" />,
};

/**
 * Intent type colors
 */
const INTENT_COLORS: Record<OpportunityIntentType, string> = {
  HIRING: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
  OPEN_TO_OPPORTUNITIES: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
  ADVISORY_BOARD: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
  REFERRALS_ONLY: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
};

/**
 * Format date to relative time (i18n-aware)
 */
function formatRelativeTime(dateString: string, labels?: { today?: string; yesterday?: string; daysAgo?: string; weeksAgo?: string; monthsAgo?: string }): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return labels?.today || 'Today';
  if (diffDays === 1) return labels?.yesterday || 'Yesterday';
  if (diffDays < 7) return `${diffDays} ${labels?.daysAgo || 'days ago'}`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${labels?.weeksAgo || 'weeks ago'}`;
  return `${Math.floor(diffDays / 30)} ${labels?.monthsAgo || 'months ago'}`;
}

/**
 * Confirmation Modal Component
 */
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-th-surface border border-th-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-semibold text-th-text mb-2">{title}</h3>
        <p className="text-sm text-th-text-t mb-6">{message}</p>
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {loading ? (
              <ArrowSync24Regular className="w-4 h-4 animate-spin" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 3-dot dropdown menu for opportunity actions
 */
function CardMenu({
  onEdit,
  onArchive,
  onDelete,
  isArchived,
}: {
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isArchived: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
      >
        <MoreVertical24Regular className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-1 w-44 bg-[#1e1e2e] border border-th-border rounded-xl shadow-xl z-20 overflow-hidden">
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-th-text hover:bg-th-surface-h transition-colors"
          >
            <Edit24Regular className="w-4 h-4" />
            {t.common?.edit || 'Edit'}
          </button>
          <button
            onClick={() => { onArchive(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-th-text hover:bg-th-surface-h transition-colors"
          >
            {isArchived ? (
              <>
                <ArrowUndo24Regular className="w-4 h-4" />
                {t.common?.unarchive || 'Unarchive'}
              </>
            ) : (
              <>
                <Archive24Regular className="w-4 h-4" />
                {t.common?.archive || 'Archive'}
              </>
            )}
          </button>
          <div className="border-t border-th-border" />
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Delete24Regular className="w-4 h-4" />
            {t.common?.delete || 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Simple dropdown menu for profile cards (Edit + Delete only)
 */
function ProfileCardMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
      >
        <MoreVertical24Regular className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-1 w-44 bg-[#1e1e2e] border border-th-border rounded-xl shadow-xl z-20 overflow-hidden">
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-th-text hover:bg-th-surface-h transition-colors"
          >
            <Edit24Regular className="w-4 h-4" />
            {t.common?.edit || 'Edit'}
          </button>
          <div className="border-t border-th-border" />
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Delete24Regular className="w-4 h-4" />
            {t.common?.delete || 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Opportunity Card Component
 */
function OpportunityCard({
  opportunity,
  onEdit,
  onDelete,
  onArchive,
  onFindMatches,
  onViewMatches,
  isLoading,
}: {
  opportunity: Opportunity;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onFindMatches: (id: string) => void;
  onViewMatches: (id: string) => void;
  isLoading: boolean;
}) {
  const { t } = useI18n();
  const [finding, setFinding] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const handleFindMatches = async () => {
    setFinding(true);
    try {
      await onFindMatches(opportunity.id);
    } finally {
      setFinding(false);
    }
  };

  const intentLabel = INTENT_TYPE_OPTIONS.find(o => o.id === opportunity.intentType)?.label || opportunity.intentType;
  const isArchived = !opportunity.isActive;

  return (
    <div className={`bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden hover:border-white/20 transition-colors ${isArchived ? 'opacity-70' : ''}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${INTENT_COLORS[opportunity.intentType]}`}>
            {INTENT_ICONS[opportunity.intentType]}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-white truncate">{opportunity.title}</h3>
              {isArchived && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  {t.common?.archived || 'Archived'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-th-text-t">
              <span className={`px-2 py-0.5 rounded-full text-xs border font-bold ${INTENT_COLORS[opportunity.intentType]}`}>
                {intentLabel}
              </span>
              {opportunity.roleArea && (
                <span className="truncate">{opportunity.roleArea}</span>
              )}
            </div>
          </div>

          {/* Match Count Badge */}
          <button
            onClick={() => onViewMatches(opportunity.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 text-black font-bold hover:bg-green-600 transition-colors"
          >
            <People24Regular className="w-4 h-4" />
            <span className="font-medium">{opportunity.matchCount || 0}</span>
          </button>

          {/* 3-dot menu */}
          <CardMenu
            onEdit={() => onEdit(opportunity.id)}
            onArchive={() => onArchive(opportunity.id)}
            onDelete={() => onDelete(opportunity.id)}
            isArchived={isArchived}
          />
        </div>

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-th-text-m">
          {opportunity.locationPref && (
            <div className="flex items-center gap-1">
              <Location24Regular className="w-3.5 h-3.5" />
              <span>{opportunity.locationPref}</span>
              {opportunity.remoteOk && <span className="text-green-400">{t.opportunities?.remoteOk || '(Remote OK)'}</span>}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock24Regular className="w-3.5 h-3.5" />
            <span>{formatRelativeTime(opportunity.createdAt, t.opportunities)}</span>
          </div>
          {opportunity.lastMatchedAt && (
            <div className="flex items-center gap-1 text-emerald-400">
              <ArrowSync24Regular className="w-3.5 h-3.5" />
              <span>{t.opportunities?.matched || 'Matched'} {formatRelativeTime(opportunity.lastMatchedAt, t.opportunities)}</span>
            </div>
          )}
        </div>

        {/* Sectors & Skills */}
        {(opportunity.sectors.length > 0 || opportunity.skills.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(tagsExpanded ? opportunity.sectors : opportunity.sectors.slice(0, 3)).map((sector) => (
              <span
                key={sector.id}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold"
              >
                {sector.name}
              </span>
            ))}
            {(tagsExpanded ? opportunity.skills : opportunity.skills.slice(0, 3)).map((skill) => (
              <span
                key={skill.id}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold"
              >
                {skill.name}
              </span>
            ))}
            {(opportunity.sectors.length + opportunity.skills.length > 6) && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTagsExpanded(!tagsExpanded); }}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold cursor-pointer hover:bg-emerald-500 transition-colors"
              >
                {tagsExpanded ? 'Show less' : `+${opportunity.sectors.length + opportunity.skills.length - 6} ${t.opportunities?.moreSkills || 'more'}`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 bg-th-surface border-t border-th-border-s">
        <button
          onClick={handleFindMatches}
          disabled={finding || isLoading || isArchived}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#042820] text-sm font-bold transition-colors"
        >
          {finding ? (
            <ArrowSync24Regular className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkle24Regular className="w-4 h-4" />
          )}
          {t.opportunities?.findMatches || 'Find Matches'}
        </button>
        <button
          onClick={() => onViewMatches(opportunity.id)}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-th-surface hover:bg-th-surface-h text-th-text-s text-sm font-medium transition-colors"
        >
          <ChevronRight24Regular className="w-4 h-4" />
          {t.opportunities?.viewMatches || 'View'}
        </button>
      </div>
    </div>
  );
}

/**
 * Hiring Profile Card Component
 */
function HiringProfileCard({
  profile,
  onView,
  onEdit,
  onDelete,
  onFindMatches,
}: {
  profile: HiringProfile;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onFindMatches: (id: string) => void;
}) {
  const [finding, setFinding] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const seniorityLabel = JOB_SENIORITY_OPTIONS.find(o => o.id === profile.seniority)?.label || profile.seniority;
  const workModeLabel = JOB_WORK_MODE_OPTIONS.find(o => o.id === profile.workMode)?.label || profile.workMode;
  const employmentLabel = JOB_EMPLOYMENT_TYPE_OPTIONS.find(o => o.id === profile.employmentType)?.label || profile.employmentType;
  const matchCount = profile._count?.jobMatches || 0;

  const handleFindMatches = async () => {
    setFinding(true);
    try {
      await onFindMatches(profile.id);
    } finally {
      setFinding(false);
    }
  };

  return (
    <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden hover:border-white/20 transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-400 text-[#042820] border border-emerald-400/80">
            <PersonAdd24Regular className="w-5 h-5" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate mb-1">{profile.title}</h3>
            <div className="flex items-center gap-2 text-sm text-th-text-t flex-wrap">
              {profile.roleArea && (
                <span className="truncate">{profile.roleArea}</span>
              )}
              <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                {seniorityLabel}
              </span>
            </div>
          </div>

          {/* Match Count Badge */}
          <button
            onClick={() => onView(profile.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 text-black font-bold hover:bg-green-600 transition-colors"
          >
            <People24Regular className="w-4 h-4" />
            <span className="font-medium">{matchCount}</span>
          </button>

          {/* Menu */}
          <ProfileCardMenu
            onEdit={() => onEdit(profile.id)}
            onDelete={() => onDelete(profile.id)}
          />
        </div>

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-th-text-m">
          {profile.location && (
            <div className="flex items-center gap-1">
              <Location24Regular className="w-3.5 h-3.5" />
              <span>{profile.location}</span>
            </div>
          )}
          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
            {workModeLabel}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
            {employmentLabel}
          </span>
          <div className="flex items-center gap-1">
            <Clock24Regular className="w-3.5 h-3.5" />
            <span>{formatRelativeTime(profile.createdAt)}</span>
          </div>
        </div>

        {/* Skills preview */}
        {profile.mustHaveSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(tagsExpanded ? profile.mustHaveSkills : profile.mustHaveSkills.slice(0, 4)).map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold"
              >
                {skill}
              </span>
            ))}
            {profile.mustHaveSkills.length > 4 && (
              <button
                onClick={() => setTagsExpanded(!tagsExpanded)}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold cursor-pointer hover:bg-emerald-500 transition-colors"
              >
                {tagsExpanded ? 'Show less' : `+${profile.mustHaveSkills.length - 4} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 bg-th-surface border-t border-th-border-s">
        <button
          onClick={handleFindMatches}
          disabled={finding}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#042820] text-sm font-bold transition-colors"
        >
          {finding ? (
            <ArrowSync24Regular className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkle24Regular className="w-4 h-4" />
          )}
          Find Matches
        </button>
        <button
          onClick={() => onView(profile.id)}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-th-surface hover:bg-th-surface-h text-th-text-s text-sm font-medium transition-colors"
        >
          <ChevronRight24Regular className="w-4 h-4" />
          View
        </button>
      </div>
    </div>
  );
}

/**
 * Candidate Profile Card Component
 */
function CandidateProfileCard({
  profile,
  onView,
  onEdit,
  onDelete,
}: {
  profile: CandidateProfile;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const seniorityLabel = JOB_SENIORITY_OPTIONS.find(o => o.id === profile.seniority)?.label || profile.seniority;
  const availabilityLabel = profile.availability
    ? JOB_AVAILABILITY_OPTIONS.find(o => o.id === profile.availability)?.label || profile.availability
    : null;

  return (
    <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden hover:border-white/20 transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-400 text-[#042820] border border-emerald-400/80">
            <Briefcase24Regular className="w-5 h-5" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate mb-1">{profile.title}</h3>
            <div className="flex items-center gap-2 text-sm text-th-text-t flex-wrap">
              {profile.roleArea && (
                <span className="truncate">{profile.roleArea}</span>
              )}
              <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                {seniorityLabel}
              </span>
            </div>
          </div>

          {/* Menu */}
          <ProfileCardMenu
            onEdit={() => onEdit(profile.id)}
            onDelete={() => onDelete(profile.id)}
          />
        </div>

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-th-text-m">
          {profile.location && (
            <div className="flex items-center gap-1">
              <Location24Regular className="w-3.5 h-3.5" />
              <span>{profile.location}</span>
            </div>
          )}
          {profile.skills.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
              {profile.skills.length} skill{profile.skills.length !== 1 ? 's' : ''}
            </span>
          )}
          {availabilityLabel && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
              {availabilityLabel}
            </span>
          )}
          <div className="flex items-center gap-1">
            <Clock24Regular className="w-3.5 h-3.5" />
            <span>{formatRelativeTime(profile.createdAt)}</span>
          </div>
        </div>

        {/* Skills preview */}
        {profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(tagsExpanded ? profile.skills : profile.skills.slice(0, 4)).map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold"
              >
                {skill}
              </span>
            ))}
            {profile.skills.length > 4 && (
              <button
                onClick={() => setTagsExpanded(!tagsExpanded)}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold cursor-pointer hover:bg-emerald-500 transition-colors"
              >
                {tagsExpanded ? 'Show less' : `+${profile.skills.length - 4} more`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 bg-th-surface border-t border-th-border-s">
        <button
          onClick={() => onView(profile.id)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-th-surface hover:bg-th-surface-h text-th-text-s text-sm font-medium transition-colors border border-th-border"
        >
          <ChevronRight24Regular className="w-4 h-4" />
          View
        </button>
      </div>
    </div>
  );
}

/**
 * Empty State Component
 */
function EmptyState({ onCreate, isArchiveTab }: { onCreate: () => void; isArchiveTab?: boolean }) {
  const { t } = useI18n();

  if (isArchiveTab) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-neutral-600/20 flex items-center justify-center">
          <Archive24Regular className="w-10 h-10 text-white/60" />
        </div>
        <h2 className="text-xl font-semibold text-th-text mb-2">{t.opportunities?.noArchivedOpportunities || 'No archived opportunities'}</h2>
        <p className="text-th-text-t max-w-md mx-auto">
          {t.opportunities?.noArchivedOpportunitiesDesc || 'Archived opportunities will appear here. You can archive an opportunity from the menu on each card.'}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-16 px-4">
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-600/20 flex items-center justify-center">
        <Briefcase24Regular className="w-10 h-10 text-emerald-400" />
      </div>
      <h2 className="text-xl font-semibold text-th-text mb-2">
        {t.opportunities?.noOpportunities || 'No opportunities yet'}
      </h2>
      <p className="text-th-text-t max-w-md mx-auto mb-6">
        {t.opportunities?.createFirstDesc ||
          'Create your first opportunity to start finding AI-powered matches with potential collaborators, jobs, or talent.'}
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-500 text-[#042820] font-bold transition-colors"
      >
        <Add24Regular className="w-5 h-5" />
        {t.opportunities?.createFirst || 'Create Your First Opportunity'}
      </button>
    </div>
  );
}

/**
 * Empty state for hiring/candidate profile tabs
 */
function ProfileEmptyState({ type }: { type: 'hiring' | 'candidate' }) {
  const router = useRouter();
  const isHiring = type === 'hiring';

  return (
    <div className="text-center py-16 px-4">
      <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${isHiring ? 'bg-blue-600/20' : 'bg-emerald-600/20'}`}>
        {isHiring ? (
          <PersonAdd24Regular className={`w-10 h-10 text-blue-400`} />
        ) : (
          <Briefcase24Regular className={`w-10 h-10 text-emerald-400`} />
        )}
      </div>
      <h2 className="text-xl font-semibold text-th-text mb-2">
        {isHiring ? 'No hiring profiles yet' : 'No candidate profiles yet'}
      </h2>
      <p className="text-th-text-t max-w-md mx-auto mb-6">
        {isHiring
          ? 'Create a hiring profile to describe the role you are looking to fill, then find AI-matched candidates.'
          : 'Create a candidate profile to describe your skills and preferences, so employers can find and match with you.'}
      </p>
      <button
        onClick={() => router.push(isHiring ? '/opportunities/hiring/new' : '/opportunities/candidate/new')}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-500 text-[#042820] font-bold transition-colors"
      >
        <Add24Regular className="w-5 h-5" />
        {isHiring ? 'Create Hiring Profile' : 'Create Candidate Profile'}
      </button>
    </div>
  );
}

// ============================================================================
// Top-level tab type
// ============================================================================

type TopTab = 'opportunities' | 'hiring' | 'candidates';

/**
 * Main Opportunities Index Page
 */
export default function OpportunitiesPage() {
  const { t } = useI18n();
  const router = useRouter();

  // Top-level tab
  const [topTab, setTopTab] = useState<TopTab>('opportunities');

  // --- Opportunities state (existing) ---
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [typeFilter, setTypeFilter] = useState<OpportunityIntentType | 'all'>('all');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Hiring profiles state ---
  const [hiringProfiles, setHiringProfiles] = useState<HiringProfile[]>([]);
  const [hiringLoading, setHiringLoading] = useState(false);
  const [hiringLoaded, setHiringLoaded] = useState(false);
  const [hiringDeleteTarget, setHiringDeleteTarget] = useState<string | null>(null);
  const [hiringDeleting, setHiringDeleting] = useState(false);

  // --- Candidate profiles state ---
  const [candidateProfiles, setCandidateProfiles] = useState<CandidateProfile[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateLoaded, setCandidateLoaded] = useState(false);
  const [candidateDeleteTarget, setCandidateDeleteTarget] = useState<string | null>(null);
  const [candidateDeleting, setCandidateDeleting] = useState(false);

  // Load opportunities on mount
  useEffect(() => {
    async function loadOpportunities() {
      try {
        setLoading(true);
        const result = await listOpportunities({ status: 'all' });
        setOpportunities(result.opportunities);
      } catch (error) {
        console.error('Failed to load opportunities:', error);
        toast({
          title: t.common?.error || 'Error',
          description: t.opportunities?.failedToLoad || 'Failed to load opportunities',
          variant: 'error',
        });
      } finally {
        setLoading(false);
      }
    }
    loadOpportunities();
  }, [t]);

  // Load hiring profiles when tab is selected (lazy)
  useEffect(() => {
    if (topTab === 'hiring' && !hiringLoaded) {
      async function load() {
        setHiringLoading(true);
        try {
          const data = await listHiringProfiles();
          setHiringProfiles(data);
          setHiringLoaded(true);
        } catch (error) {
          console.error('Failed to load hiring profiles:', error);
          toast({ title: 'Error', description: 'Failed to load hiring profiles', variant: 'error' });
        } finally {
          setHiringLoading(false);
        }
      }
      load();
    }
  }, [topTab, hiringLoaded]);

  // Load candidate profiles when tab is selected (lazy)
  useEffect(() => {
    if (topTab === 'candidates' && !candidateLoaded) {
      async function load() {
        setCandidateLoading(true);
        try {
          const data = await listCandidateProfiles();
          setCandidateProfiles(data);
          setCandidateLoaded(true);
        } catch (error) {
          console.error('Failed to load candidate profiles:', error);
          toast({ title: 'Error', description: 'Failed to load candidate profiles', variant: 'error' });
        } finally {
          setCandidateLoading(false);
        }
      }
      load();
    }
  }, [topTab, candidateLoaded]);

  // ---- Opportunities handlers (unchanged) ----
  const handleCreate = () => {
    router.push('/opportunities/new');
  };

  const handleEdit = (id: string) => {
    router.push(`/opportunities/${id}/edit`);
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteOpportunity(deleteTarget);
      setOpportunities((prev) => prev.filter((o) => o.id !== deleteTarget));
      toast({
        title: t.opportunities?.deleted || 'Opportunity deleted',
        variant: 'success',
      });
      setDeleteTarget(null);
    } catch (error: any) {
      toast({
        title: t.common?.error || 'Error',
        description: error.message,
        variant: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async (id: string) => {
    const opp = opportunities.find((o) => o.id === id);
    if (!opp) return;

    const newIsActive = !opp.isActive;
    try {
      await updateOpportunity(id, { isActive: newIsActive });
      setOpportunities((prev) =>
        prev.map((o) => (o.id === id ? { ...o, isActive: newIsActive } : o))
      );
      toast({
        title: newIsActive
          ? (t.opportunities?.opportunityUnarchived || 'Opportunity unarchived')
          : (t.opportunities?.opportunityArchived || 'Opportunity archived'),
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: t.common?.error || 'Error',
        description: error.message,
        variant: 'error',
      });
    }
  };

  const handleFindMatches = async (id: string) => {
    try {
      const result = await findOpportunityMatches(id);
      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, matchCount: result.matchCount, lastMatchedAt: new Date().toISOString() }
            : o
        )
      );
      toast({
        title: t.opportunities?.matchesFound || 'Matches found',
        description: `${result.matchCount} ${t.opportunities?.potentialMatches || 'potential matches'}`,
        variant: 'success',
      });
      router.push(`/opportunities/${id}`);
    } catch (error: any) {
      toast({
        title: t.common?.error || 'Error',
        description: error.message,
        variant: 'error',
      });
    }
  };

  const handleViewMatches = (id: string) => {
    router.push(`/opportunities/${id}`);
  };

  // ---- Hiring profile handlers ----
  const handleHiringView = (id: string) => {
    router.push(`/opportunities/hiring/${id}`);
  };

  const handleHiringEdit = (id: string) => {
    router.push(`/opportunities/hiring/${id}/edit`);
  };

  const handleHiringDeleteRequest = (id: string) => {
    setHiringDeleteTarget(id);
  };

  const handleHiringDeleteConfirm = async () => {
    if (!hiringDeleteTarget) return;
    setHiringDeleting(true);
    try {
      await deleteHiringProfile(hiringDeleteTarget);
      setHiringProfiles((prev) => prev.filter((p) => p.id !== hiringDeleteTarget));
      toast({ title: 'Hiring profile deleted', variant: 'success' });
      setHiringDeleteTarget(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setHiringDeleting(false);
    }
  };

  const handleHiringFindMatches = async (id: string) => {
    try {
      const result = await findJobMatches(id);
      const matchCount = result.total || result.matches?.length || 0;
      // Update the local count
      setHiringProfiles((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, _count: { jobMatches: matchCount } } : p
        )
      );
      toast({
        title: 'Matches found',
        description: `${matchCount} potential candidate match${matchCount !== 1 ? 'es' : ''}`,
        variant: 'success',
      });
      router.push(`/opportunities/hiring/${id}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    }
  };

  // ---- Candidate profile handlers ----
  const handleCandidateView = (id: string) => {
    router.push(`/opportunities/candidate/${id}`);
  };

  const handleCandidateEdit = (id: string) => {
    router.push(`/opportunities/candidate/${id}/edit`);
  };

  const handleCandidateDeleteRequest = (id: string) => {
    setCandidateDeleteTarget(id);
  };

  const handleCandidateDeleteConfirm = async () => {
    if (!candidateDeleteTarget) return;
    setCandidateDeleting(true);
    try {
      await deleteCandidateProfile(candidateDeleteTarget);
      setCandidateProfiles((prev) => prev.filter((p) => p.id !== candidateDeleteTarget));
      toast({ title: 'Candidate profile deleted', variant: 'success' });
      setCandidateDeleteTarget(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setCandidateDeleting(false);
    }
  };

  // Split opportunities by active/archived
  const activeOpportunities = opportunities.filter((o) => o.isActive);
  const archivedOpportunities = opportunities.filter((o) => !o.isActive);
  const currentOpportunities = tab === 'active' ? activeOpportunities : archivedOpportunities;

  // Filter by type
  const filteredOpportunities = typeFilter === 'all'
    ? currentOpportunities
    : currentOpportunities.filter((o) => o.intentType === typeFilter);

  // Calculate stats
  const stats = {
    total: activeOpportunities.length,
    totalMatches: activeOpportunities.reduce((sum, o) => sum + (o.matchCount || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-th-text">
            {t.opportunities?.title || 'Jobs'}
          </h1>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-500 text-[#042820] font-bold transition-colors"
          >
            <Add24Regular className="w-5 h-5" />
            <span className="hidden sm:inline">{t.opportunities?.create || 'Create'}</span>
          </button>
        </div>
        <p className="text-th-text-t mt-1">
          {t.opportunities?.subtitle || 'Manage your jobs and find AI-powered matches'}
        </p>
      </div>

      {/* Top-level Tabs: All Opportunities | Hiring Profiles | Candidate Profiles */}
      <div className="flex items-center gap-1 bg-th-surface rounded-lg p-1 w-fit overflow-x-auto">
        <button
          onClick={() => setTopTab('opportunities')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            topTab === 'opportunities'
              ? 'bg-emerald-400 text-[#042820] font-bold'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
          }`}
        >
          <Briefcase24Regular className="w-4 h-4" />
          All Opportunities
          {opportunities.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${topTab === 'opportunities' ? 'bg-white/20' : 'bg-th-surface-h'}`}>
              {opportunities.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTopTab('hiring')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            topTab === 'hiring'
              ? 'bg-emerald-400 text-[#042820] font-bold'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
          }`}
        >
          <PersonAdd24Regular className="w-4 h-4" />
          Hiring Profiles
          {hiringLoaded && hiringProfiles.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${topTab === 'hiring' ? 'bg-white/20' : 'bg-th-surface-h'}`}>
              {hiringProfiles.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTopTab('candidates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            topTab === 'candidates'
              ? 'bg-emerald-400 text-[#042820] font-bold'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
          }`}
        >
          <PeopleTeam24Regular className="w-4 h-4" />
          Candidate Profiles
          {candidateLoaded && candidateProfiles.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${topTab === 'candidates' ? 'bg-white/20' : 'bg-th-surface-h'}`}>
              {candidateProfiles.length}
            </span>
          )}
        </button>
      </div>

      {/* ================================================================== */}
      {/* TAB: All Opportunities (existing, unchanged) */}
      {/* ================================================================== */}
      {topTab === 'opportunities' && (
        <>
          {/* Sub-tabs: Active / Archived */}
          <div className="flex items-center gap-1 bg-th-surface rounded-lg p-1 w-fit">
            <button
              onClick={() => setTab('active')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === 'active'
                  ? 'bg-emerald-400 text-[#042820] font-bold'
                  : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
              }`}
            >
              <Briefcase24Regular className="w-4 h-4" />
              {t.common?.all || 'All'}
              {activeOpportunities.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'active' ? 'bg-white/20' : 'bg-th-surface-h'}`}>
                  {activeOpportunities.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('archived')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === 'archived'
                  ? 'bg-emerald-400 text-[#042820] font-bold'
                  : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
              }`}
            >
              <Archive24Regular className="w-4 h-4" />
              {t.common?.archived || 'Archived'}
              {archivedOpportunities.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'archived' ? 'bg-white/20' : 'bg-th-surface-h'}`}>
                  {archivedOpportunities.length}
                </span>
              )}
            </button>
          </div>

          {/* Stats Bar (only on active tab) */}
          {tab === 'active' && activeOpportunities.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-th-surface rounded-xl p-4 border border-th-border">
                <div className="text-2xl font-bold text-th-text">{stats.total}</div>
                <div className="text-sm text-th-text-t">{t.opportunities?.totalOpportunities || 'Total'}</div>
              </div>
              <div className="bg-th-surface rounded-xl p-4 border border-th-border">
                <div className="text-2xl font-bold text-emerald-400">{stats.totalMatches}</div>
                <div className="text-sm text-th-text-t">{t.opportunities?.totalMatches || 'Matches'}</div>
              </div>
            </div>
          )}

          {/* Filters */}
          {currentOpportunities.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter24Regular className="w-4 h-4 text-th-text-m" />
                <Select
                  value={typeFilter}
                  onChange={(value) => setTypeFilter(value as OpportunityIntentType | 'all')}
                  options={[
                    { value: 'all', label: t.opportunities?.allTypes || 'All Types' },
                    ...INTENT_TYPE_OPTIONS.map((option) => ({ value: option.id, label: option.label })),
                  ]}
                  className="w-40"
                />
              </div>
            </div>
          )}

          {/* Opportunities List */}
          {filteredOpportunities.length > 0 ? (
            <div className="space-y-4">
              {filteredOpportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  onEdit={handleEdit}
                  onDelete={handleDeleteRequest}
                  onArchive={handleArchive}
                  onFindMatches={handleFindMatches}
                  onViewMatches={handleViewMatches}
                  isLoading={loading}
                />
              ))}
            </div>
          ) : currentOpportunities.length > 0 ? (
            <div className="text-center py-12 bg-th-surface rounded-xl border border-th-border">
              <Search24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
              <p className="text-th-text-t">
                {t.opportunities?.noMatchingFilter || 'No opportunities match your filters'}
              </p>
            </div>
          ) : (
            <EmptyState onCreate={handleCreate} isArchiveTab={tab === 'archived'} />
          )}
        </>
      )}

      {/* ================================================================== */}
      {/* TAB: Hiring Profiles */}
      {/* ================================================================== */}
      {topTab === 'hiring' && (
        <>
          {hiringLoading ? (
            <div className="flex items-center justify-center py-20">
              <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : hiringProfiles.length > 0 ? (
            <div className="space-y-4">
              {hiringProfiles.map((profile) => (
                <HiringProfileCard
                  key={profile.id}
                  profile={profile}
                  onView={handleHiringView}
                  onEdit={handleHiringEdit}
                  onDelete={handleHiringDeleteRequest}
                  onFindMatches={handleHiringFindMatches}
                />
              ))}
            </div>
          ) : (
            <ProfileEmptyState type="hiring" />
          )}
        </>
      )}

      {/* ================================================================== */}
      {/* TAB: Candidate Profiles */}
      {/* ================================================================== */}
      {topTab === 'candidates' && (
        <>
          {candidateLoading ? (
            <div className="flex items-center justify-center py-20">
              <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : candidateProfiles.length > 0 ? (
            <div className="space-y-4">
              {candidateProfiles.map((profile) => (
                <CandidateProfileCard
                  key={profile.id}
                  profile={profile}
                  onView={handleCandidateView}
                  onEdit={handleCandidateEdit}
                  onDelete={handleCandidateDeleteRequest}
                />
              ))}
            </div>
          ) : (
            <ProfileEmptyState type="candidate" />
          )}
        </>
      )}

      {/* Delete Confirmation Modal — Opportunities */}
      <ConfirmModal
        open={!!deleteTarget}
        title={t.opportunities?.deleteOpportunityTitle || 'Delete Opportunity'}
        message={t.opportunities?.deleteOpportunityMessage || 'Are you sure you want to delete this opportunity? This action cannot be undone and all associated matches will be removed.'}
        confirmLabel={t.common?.delete || 'Delete'}
        cancelLabel={t.common?.cancel || 'Cancel'}
        confirmVariant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Delete Confirmation Modal — Hiring Profile */}
      <ConfirmModal
        open={!!hiringDeleteTarget}
        title="Delete Hiring Profile"
        message="Are you sure you want to delete this hiring profile? This action cannot be undone and all associated matches will be removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={hiringDeleting}
        onConfirm={handleHiringDeleteConfirm}
        onCancel={() => setHiringDeleteTarget(null)}
      />

      {/* Delete Confirmation Modal — Candidate Profile */}
      <ConfirmModal
        open={!!candidateDeleteTarget}
        title="Delete Candidate Profile"
        message="Are you sure you want to delete this candidate profile? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={candidateDeleting}
        onConfirm={handleCandidateDeleteConfirm}
        onCancel={() => setCandidateDeleteTarget(null)}
      />
    </div>
  );
}
