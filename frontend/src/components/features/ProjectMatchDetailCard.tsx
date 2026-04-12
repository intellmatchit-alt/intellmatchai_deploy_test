/**
 * Project Match Detail Card
 *
 * A detailed card component for displaying project match information
 * with contact-like styling, match reasons, and action buttons.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n';
import { getMatchStrength } from '@/lib/utils/match-strength';
import {
  Sparkle24Regular,
  Checkmark20Regular,
  Call24Regular,
  Mail24Regular,
  PersonAdd24Regular,
  ChevronRight24Regular,
  Copy24Regular,
  BookmarkAdd24Regular,
  CheckmarkCircle24Regular,
  Dismiss24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  Person24Regular,
  Building24Regular,
  Briefcase24Regular,
} from '@fluentui/react-icons';
import { ProjectMatch, MatchStatus, updateMatchStatus } from '@/lib/api/projects';
import { createContact } from '@/lib/api/contacts';
import { toast } from '@/components/ui/Toast';

interface ProjectMatchDetailCardProps {
  match: ProjectMatch;
  projectId: string;
  onStatusChange?: (matchId: string, status: MatchStatus) => void;
  variant?: 'compact' | 'expanded';
}

/**
 * LinkedIn Icon
 */
const LinkedInIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

export function ProjectMatchDetailCard({
  match,
  projectId,
  onStatusChange,
  variant = 'compact',
}: ProjectMatchDetailCardProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(variant === 'expanded');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);

  const person = match.matchedUser || match.matchedContact;
  if (!person) return null;

  const isUser = !!match.matchedUser;
  const matchScore = Math.round(match.matchScore);

  // Score color based on match percentage
  const getScoreColor = () => {
    if (matchScore >= 70) return 'success';
    if (matchScore >= 50) return 'warning';
    return 'neutral';
  };

  const scoreColorClass =
    matchScore >= 70
      ? 'text-green-400'
      : matchScore >= 50
      ? 'text-yellow-400'
      : 'text-th-text-t';

  // Status badge styling
  const statusBadges: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-th-surface-h', text: 'text-th-text-t', label: t.projects?.pending || 'Pending' },
    CONTACTED: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: t.projects?.contacted || 'Contacted' },
    SAVED: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: t.projects?.saved || 'Saved' },
    DISMISSED: { bg: 'bg-white/[0.03]0/20', text: 'text-th-text-m', label: t.projects?.dismissed || 'Dismissed' },
    CONNECTED: { bg: 'bg-green-500/20', text: 'text-green-400', label: t.projects?.connected || 'Connected' },
  };

  const badge = statusBadges[match.status] || statusBadges.PENDING;

  // Handle status change
  const handleStatusChange = async (status: MatchStatus) => {
    setIsUpdating(true);
    try {
      await updateMatchStatus(projectId, match.id, status);
      onStatusChange?.(match.id, status);
      toast({ title: t.projects?.statusUpdated || 'Status updated', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Copy suggested message
  const copyMessage = () => {
    if (match.suggestedMessage) {
      navigator.clipboard.writeText(match.suggestedMessage);
      toast({ title: t.common?.copied || 'Copied to clipboard', variant: 'success' });
    }
  };

  // Navigate to user profile
  const handleViewProfile = () => {
    if (isUser && match.matchedUser?.id) {
      router.push(`/profile/${match.matchedUser.id}`);
    } else if (match.matchedContact?.id) {
      router.push(`/contacts/${match.matchedContact.id}`);
    }
  };

  // Add match as contact
  const handleAddContact = async () => {
    if (!person) return;

    setIsAddingContact(true);
    try {
      await createContact({
        name: person.fullName,
        email: person.email || undefined,
        company: person.company || undefined,
        jobTitle: person.jobTitle || undefined,
        source: 'MANUAL',
      });
      toast({
        title: t.projectMatches?.contactAdded || 'Contact added',
        description: `${person.fullName} ${t.projectMatches?.addedToContacts || 'has been added to your contacts'}`,
        variant: 'success',
      });
      // Update status to connected
      handleStatusChange('CONNECTED');
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsAddingContact(false);
    }
  };

  // Send email
  const handleSendEmail = () => {
    if (person.email) {
      const subject = encodeURIComponent(t.projectMatches?.emailSubject || 'Collaboration Opportunity');
      const body = encodeURIComponent(match.suggestedMessage || '');
      window.location.href = `mailto:${person.email}?subject=${subject}&body=${body}`;
    }
  };

  return (
    <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden hover:bg-th-surface-h transition-all duration-200">
      {/* Card Header - Clickable to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left"
      >
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-900/30 p-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <Avatar
              src={match.matchedUser?.avatarUrl}
              name={person.fullName}
              size="xl"
              className="ring-2 ring-white/20"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold text-th-text text-lg">{person.fullName}</h3>
                {isUser && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                    <Person24Regular className="w-3 h-3 inline me-1" />
                    {t.projectMatches?.user || 'User'}
                  </span>
                )}
              </div>

              {person.jobTitle && (
                <p className="text-sm text-th-text-s flex items-center gap-1">
                  <Briefcase24Regular className="w-4 h-4 text-th-text-m" />
                  {person.jobTitle}
                </p>
              )}

              {person.company && (
                <p className="text-sm text-th-text-t flex items-center gap-1">
                  <Building24Regular className="w-4 h-4 text-th-text-m" />
                  {person.company}
                </p>
              )}

              {/* Match Score & Status */}
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-2 group relative">
                  <ProgressRing value={matchScore} size="xs" showValue color={getScoreColor()} />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getMatchStrength(matchScore).badgeClass}`}>
                    {getMatchStrength(matchScore).label}
                  </span>
                  {/* Score calculation tooltip */}
                  <div className="absolute bottom-full left-0 mb-2 px-4 py-3 bg-th-bg-t border border-th-border rounded-xl text-xs text-th-text-s w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                    <p className="font-semibold text-th-text mb-2 text-sm">How Match Score is Calculated</p>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between"><span>Goals Alignment</span><span className="text-emerald-400">25%</span></div>
                      <div className="flex justify-between"><span>Sector Overlap</span><span className="text-blue-400">15%</span></div>
                      <div className="flex justify-between"><span>Skills Match</span><span className="text-cyan-400">12%</span></div>
                      <div className="flex justify-between"><span>AI Semantic Similarity*</span><span className="text-emerald-400">10%</span></div>
                      <div className="flex justify-between"><span>Network Proximity</span><span className="text-emerald-400">8%</span></div>
                      <div className="flex justify-between"><span>Complementary Skills</span><span className="text-green-400">7%</span></div>
                      <div className="flex justify-between"><span>Recency Bonus</span><span className="text-teal-400">7%</span></div>
                      <div className="flex justify-between"><span>Interaction History</span><span className="text-cyan-400">6%</span></div>
                      <div className="flex justify-between"><span>Shared Interests</span><span className="text-emerald-400">5%</span></div>
                      <div className="flex justify-between"><span>Hobbies</span><span className="text-red-400">5%</span></div>
                    </div>
                    <p className="mt-2 pt-2 border-t border-th-border text-th-text-t text-[10px]">Score = sum of (component score × weight)</p>
                    <p className="mt-1 text-th-text-m text-[9px]">*Requires contact profile data</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
              </div>
            </div>

            {/* Expand Toggle */}
            <div className="p-2 rounded-lg text-th-text-m">
              {isExpanded ? (
                <ChevronUp24Regular className="w-5 h-5" />
              ) : (
                <ChevronDown24Regular className="w-5 h-5" />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Shared Tags - Always visible */}
      {(match.sharedSectors.length > 0 || match.sharedSkills.length > 0) && (
        <div className="px-4 py-3 border-t border-th-border-s">
          <p className="text-xs text-th-text-m mb-2">{t.projectMatches?.sharedWith || 'In common'}</p>
          <div className="flex flex-wrap gap-1.5">
            {match.sharedSectors.slice(0, 3).map((s, i) => (
              <span
                key={`s-${i}`}
                className="px-2.5 py-1 rounded-full text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/25"
              >
                {s}
              </span>
            ))}
            {match.sharedSkills.slice(0, 3).map((s, i) => (
              <span
                key={`sk-${i}`}
                className="px-2.5 py-1 rounded-full text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/25"
              >
                {s}
              </span>
            ))}
            {(match.sharedSectors.length + match.sharedSkills.length) > 6 && (
              <span className="px-2.5 py-1 text-xs text-th-text-m">
                +{match.sharedSectors.length + match.sharedSkills.length - 6}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-th-border">
          {/* Quick Actions */}
          <div className="flex justify-center gap-3 p-4 bg-th-surface">
            {person.email && (
              <Button
                variant="secondary"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendEmail();
                }}
                title={t.projectMatches?.sendEmail || 'Send Email'}
              >
                <Mail24Regular className="w-5 h-5" />
              </Button>
            )}
            {!match.matchedContact && (
              <Button
                variant="secondary"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddContact();
                }}
                loading={isAddingContact}
                title={t.projectMatches?.addToContacts || 'Add to Contacts'}
              >
                <PersonAdd24Regular className="w-5 h-5" />
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleViewProfile();
              }}
              title={t.projectMatches?.viewProfile || 'View Profile'}
            >
              <ChevronRight24Regular className="w-5 h-5" />
            </Button>
          </div>

          {/* Match Reasons */}
          {Array.isArray(match.reasons) && match.reasons.length > 0 && (
            <div className="px-4 py-4 border-t border-th-border">
              <h4 className="text-sm font-medium text-th-text-s mb-3 flex items-center gap-2">
                <Sparkle24Regular className="w-4 h-4 text-emerald-400" />
                {t.projectMatches?.whyGoodMatch || 'Why this is a good match'}
              </h4>
              <div className="space-y-2">
                {match.reasons.map((reason, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-2 rounded-lg bg-th-surface"
                  >
                    <CheckmarkCircle24Regular className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-th-text-s">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ice Breaker Messages */}
          {match.suggestedMessage && (
            <div className="px-4 py-4 border-t border-th-border">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <Mail24Regular className="w-3 h-3 text-th-text" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-th-text">
                    {t.projectMatches?.iceBreakers || 'Ice Breakers'}
                  </h4>
                  <p className="text-[10px] text-th-text-m">
                    {match.sharedSectors?.length > 0
                      ? `Based on shared ${match.sharedSectors[0]} sector`
                      : match.sharedSkills?.length > 0
                        ? `Based on ${match.sharedSkills.length} shared skills`
                        : 'Tailored to this project'}
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {match.suggestedMessage.split('\n').filter(Boolean).map((message, index) => (
                  <div key={index} className="relative group">
                    <div className="bg-gradient-to-r from-white/5 to-white/[0.02] rounded-lg p-2.5 pe-10 border border-th-border hover:border-cyan-500/30 transition-all">
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-medium">{index + 1}</span>
                        <p className="text-xs text-th-text-s italic leading-relaxed">
                          "{message.trim()}"
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(message.trim());
                        toast({ title: t.common?.copied || 'Copied!', variant: 'success' });
                      }}
                      className="absolute top-1.5 end-1.5 p-1.5 text-th-text-m hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Copy this message"
                    >
                      <Copy24Regular className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Actions */}
          <div className="px-4 py-4 border-t border-th-border bg-th-surface">
            <p className="text-xs text-th-text-m mb-3">{t.projectMatches?.updateStatus || 'Update Status'}</p>
            <div className="flex flex-wrap gap-2">
              {match.status !== 'CONTACTED' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange('CONTACTED');
                  }}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                >
                  <Mail24Regular className="w-4 h-4" />
                  {t.projects?.markContacted || 'Mark Contacted'}
                </button>
              )}
              {match.status !== 'SAVED' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange('SAVED');
                  }}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                >
                  <BookmarkAdd24Regular className="w-4 h-4" />
                  {t.projects?.save || 'Save'}
                </button>
              )}
              {match.status !== 'CONNECTED' && match.status !== 'DISMISSED' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange('CONNECTED');
                  }}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                >
                  <CheckmarkCircle24Regular className="w-4 h-4" />
                  {t.projects?.markConnected || 'Connected'}
                </button>
              )}
              {match.status !== 'DISMISSED' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange('DISMISSED');
                  }}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-th-surface text-th-text-t hover:bg-th-surface-h transition-colors disabled:opacity-50"
                >
                  <Dismiss24Regular className="w-4 h-4" />
                  {t.projects?.dismiss || 'Dismiss'}
                </button>
              )}
            </div>
          </div>

          {/* View Full Profile Button */}
          <div className="p-4 border-t border-th-border">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewProfile();
              }}
              className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
            >
              {isUser ? (
                <>
                  <Person24Regular className="w-5 h-5" />
                  {t.projectMatches?.viewUserProfile || 'View Profile'}
                </>
              ) : (
                <>
                  <ChevronRight24Regular className="w-5 h-5" />
                  {t.projectMatches?.viewContactDetails || 'View Contact Details'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectMatchDetailCard;
