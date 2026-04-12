/**
 * TeamMembersList Component
 *
 * Displays team members for a feature (Project, Opportunity, Pitch, Deal).
 * Shows member status, role, and allows removal by owner.
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Person24Regular,
  PersonDelete24Regular,
  Mail24Regular,
  Phone24Regular,
  Checkmark24Regular,
  Clock24Regular,
  Dismiss24Regular,
  Warning24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/Toast';
import {
  listTeamMembers,
  removeTeamMember,
  TeamMember,
  CollaborationSourceType,
  TeamMemberStatus,
  getTeamMemberStatusLabel,
  getTeamMemberStatusColor,
  getTeamMemberRoleLabel,
  getTeamMemberDisplayName,
} from '@/lib/api/collaboration';

interface TeamMembersListProps {
  sourceType: CollaborationSourceType;
  sourceId: string;
  isOwner?: boolean;
  className?: string;
}

export default function TeamMembersList({
  sourceType,
  sourceId,
  isOwner = false,
  className = '',
}: TeamMembersListProps) {
  const { t, isRTL } = useI18n();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [summary, setSummary] = useState<{ invited: number; accepted: number; declined: number; removed: number }>({
    invited: 0,
    accepted: 0,
    declined: 0,
    removed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      const data = await listTeamMembers(sourceType, sourceId);
      setMembers(data.members);
      setSummary(data.summary);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [sourceType, sourceId]);

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await removeTeamMember(sourceType, sourceId, memberId);
      toast.success('Collaborator removed');
      setShowRemoveConfirm(null);
      fetchMembers();
    } catch (error: any) {
      console.error('Failed to remove team member:', error);
      toast.error(error.message || 'Failed to remove collaborator');
    } finally {
      setRemovingId(null);
    }
  };

  const getStatusIcon = (status: TeamMemberStatus) => {
    switch (status) {
      case 'ACCEPTED':
        return <Checkmark24Regular className="w-4 h-4 text-green-400" />;
      case 'INVITED':
        return <Clock24Regular className="w-4 h-4 text-yellow-400" />;
      case 'DECLINED':
        return <Dismiss24Regular className="w-4 h-4 text-red-400" />;
      case 'REMOVED':
        return <Warning24Regular className="w-4 h-4 text-th-text-t" />;
      default:
        return null;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-th-bg-t rounded-lg animate-pulse">
            <div className="w-10 h-10 rounded-full bg-neutral-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-neutral-700 rounded w-1/3" />
              <div className="h-3 bg-neutral-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className={`text-center py-8 text-th-text-t ${className}`}>
        <Person24Regular className="w-12 h-12 mx-auto mb-3 text-white/70" />
        <p>No collaborators yet</p>
        <p className="text-sm mt-1">Send invitations to add collaborators</p>
      </div>
    );
  }

  // Filter out removed members for display
  const activeMembers = members.filter((m) => m.status !== 'REMOVED');

  return (
    <div className={className}>
      {/* Summary */}
      {(summary.accepted > 0 || summary.invited > 0) && (
        <div className="flex items-center gap-4 mb-4 text-sm">
          {summary.accepted > 0 && (
            <span className="flex items-center gap-1 text-green-400">
              <Checkmark24Regular className="w-4 h-4" />
              {summary.accepted} accepted
            </span>
          )}
          {summary.invited > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Clock24Regular className="w-4 h-4" />
              {summary.invited} pending
            </span>
          )}
        </div>
      )}

      {/* Member List */}
      <div className="space-y-2">
        {activeMembers.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-3 p-3 bg-th-bg-t rounded-lg group"
          >
            {/* Avatar */}
            {member.user?.avatarUrl ? (
              <img
                src={member.user.avatarUrl}
                alt={getTeamMemberDisplayName(member)}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-sm font-medium text-th-text-s">
                {getInitials(getTeamMemberDisplayName(member))}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-th-text truncate">
                  {getTeamMemberDisplayName(member)}
                </span>
                {getStatusIcon(member.status)}
              </div>
              <div className="text-sm text-th-text-t flex items-center gap-2 flex-wrap">
                {member.user?.jobTitle && (
                  <span>{member.user.jobTitle}</span>
                )}
                {member.user?.company && (
                  <span>at {member.user.company}</span>
                )}
                {!member.user && member.externalEmail && (
                  <span className="flex items-center gap-1">
                    <Mail24Regular className="w-3 h-3" />
                    {member.externalEmail}
                  </span>
                )}
                {!member.user && member.externalPhone && (
                  <span className="flex items-center gap-1">
                    <Phone24Regular className="w-3 h-3" />
                    {member.externalPhone}
                  </span>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <span
              className={`px-2 py-1 text-xs rounded-full ${getTeamMemberStatusColor(
                member.status
              )}`}
            >
              {getTeamMemberStatusLabel(member.status)}
            </span>

            {/* Remove Button */}
            {isOwner && member.status !== 'REMOVED' && (
              <button
                onClick={() => setShowRemoveConfirm(member.id)}
                className="p-2 text-th-text-t hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove member"
              >
                <PersonDelete24Regular className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 bg-th-bg-s rounded-xl shadow-xl border border-th-border p-4">
            <h3 className="text-lg font-semibold text-th-text mb-2">
              Remove Collaborator?
            </h3>
            <p className="text-th-text-t mb-4">
              Are you sure you want to remove this collaborator?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="px-4 py-2 text-th-text-t hover:text-th-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(showRemoveConfirm)}
                disabled={removingId === showRemoveConfirm}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-neutral-700 text-white rounded-lg transition-colors"
              >
                {removingId === showRemoveConfirm ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
