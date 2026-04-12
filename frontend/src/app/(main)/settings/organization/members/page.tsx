'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/hooks/useOrganization';
import { organizationApi, OrgMember, OrgInvitation } from '@/lib/api/organization';
import {
  ArrowLeft24Regular,
  PersonAdd24Regular,
  Dismiss24Regular,
  Mail24Regular,
  Shield24Regular,
  PersonDelete24Regular,
  Crown24Regular,
  Clock24Regular,
} from '@fluentui/react-icons';

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-emerald-500/20 text-indigo-300 border-emerald-500/30',
  ADMIN: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  MEMBER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  VIEWER: 'bg-white/[0.03]0/20 text-th-text-t border-neutral-500/30',
};

export default function MembersPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { organization, isAdmin, isOwner, fetchOrganization } = useOrganization();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [showRoleMenu, setShowRoleMenu] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadMembers = async () => {
    if (!organization) return;
    try {
      const data = await organizationApi.getMembers(organization.id);
      setMembers(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const loadInvitations = async () => {
    if (!organization || !isAdmin) return;
    setLoadingInvitations(true);
    try {
      const data = await organizationApi.getOrgInvitations(organization.id);
      setInvitations(data);
    } catch (err) {
      console.error(err);
    }
    setLoadingInvitations(false);
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!organization) return;
    if (!confirm(t.organization?.confirmCancelInvitation || 'Are you sure you want to cancel this invitation?')) return;
    setCancellingId(invitationId);
    try {
      await organizationApi.cancelOrgInvitation(organization.id, invitationId);
      loadInvitations();
    } catch (err) {
      console.error(err);
    }
    setCancellingId(null);
  };

  useEffect(() => {
    loadMembers();
    if (isAdmin) loadInvitations();
  }, [organization]);

  const totalSeats = organization?.subscription?.seats || 0;
  const usedSeats = members.length;
  const seatPercentage = totalSeats > 0 ? Math.round((usedSeats / totalSeats) * 100) : 0;

  const handleInvite = async () => {
    if (!organization || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    try {
      await organizationApi.inviteMember(organization.id, { email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      setShowInvite(false);
      loadMembers();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invite');
    }
    setInviting(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!organization) return;
    try {
      await organizationApi.updateMemberRole(organization.id, userId, newRole);
      loadMembers();
    } catch (err) {
      console.error(err);
    }
    setShowRoleMenu(null);
  };

  const handleRemove = async (userId: string) => {
    if (!organization) return;
    if (!confirm(t.organization?.confirmRemove || 'Are you sure you want to remove this member?')) return;
    try {
      await organizationApi.removeMember(organization.id, userId);
      loadMembers();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.organization?.members || 'Members'}</h1>
        {isAdmin && (
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
            <PersonAdd24Regular className="w-4 h-4" />
            {t.organization?.invite || 'Invite'}
          </button>
        )}
      </div>

      {/* Seat Progress */}
      <div className="bg-th-surface border border-th-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-th-text-t">{t.organization?.seatsUsed || 'Seats Used'}</span>
          <span className="text-sm font-medium text-th-text">{usedSeats} / {totalSeats}</span>
        </div>
        <div className="h-2 bg-th-surface-h rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(seatPercentage, 100)}%` }}
          />
        </div>
        {seatPercentage >= 90 && (
          <p className="text-xs text-amber-400 mt-2">{t.organization?.almostFull || 'Almost at capacity. Consider adding more seats.'}</p>
        )}
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div className="flex gap-1 bg-th-surface border border-th-border rounded-xl p-1">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'members'
                ? 'bg-th-surface-h text-th-text'
                : 'text-th-text-t hover:text-th-text-s'
            }`}
          >
            {t.organization?.members || 'Members'} ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'invitations'
                ? 'bg-th-surface-h text-th-text'
                : 'text-th-text-t hover:text-th-text-s'
            }`}
          >
            {t.organization?.pendingInvitations || 'Pending Invitations'}
            {invitations.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                {invitations.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Member Grid */}
      {activeTab === 'members' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {members.map((member, index) => (
            <div
              key={member.id}
              className="relative bg-th-surface border border-th-border rounded-2xl p-4 hover:bg-th-surface hover:border-white/[0.15] transition-all text-center"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Avatar */}
              {member.user.avatarUrl ? (
                <img src={member.user.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover mx-auto mb-3 ring-2 ring-white/10" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3 ring-2 ring-white/10">
                  {member.user.fullName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}

              {/* Name & Info */}
              <p className="font-semibold text-th-text text-sm truncate">{member.user.fullName}</p>
              {member.user.jobTitle && (
                <p className="text-xs text-th-text-m mt-0.5 truncate">{member.user.jobTitle}</p>
              )}
              <p className="text-xs text-white/70 mt-0.5 truncate">{member.user.email}</p>

              {/* Role Badge */}
              <div className="mt-2">
                <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full border ${ROLE_COLORS[member.role]}`}>
                  {member.role}
                </span>
              </div>

              {/* Action Buttons - always visible */}
              {isAdmin && member.role !== 'OWNER' && (
                <div className="mt-3 flex gap-2 justify-center relative">
                  {/* Change Role */}
                  <button
                    onClick={() => setShowRoleMenu(showRoleMenu === member.id ? null : member.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-th-surface border border-th-border rounded-lg text-xs text-th-text-s hover:bg-th-surface-h hover:border-white/20 transition-all"
                  >
                    <Shield24Regular className="w-3.5 h-3.5" />
                    {t.organization?.changeRole || 'Role'}
                  </button>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(member.userId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all"
                  >
                    <PersonDelete24Regular className="w-3.5 h-3.5" />
                    {t.organization?.remove || 'Remove'}
                  </button>

                  {/* Role Dropdown */}
                  {showRoleMenu === member.id && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-th-bg-s border border-th-border rounded-xl shadow-xl z-50 py-1">
                      {['ADMIN', 'MEMBER', 'VIEWER'].filter(r => r !== member.role).map((role) => (
                        <button key={role} onClick={() => handleRoleChange(member.userId, role)} className="w-full text-center px-3 py-2 text-sm text-th-text-s hover:bg-th-surface-h transition-colors">
                          {role}
                        </button>
                      ))}
                      {isOwner && (
                        <>
                          <div className="h-px bg-th-surface-h my-1" />
                          <button onClick={() => handleRoleChange(member.userId, 'OWNER')} className="w-full text-center px-3 py-2 text-sm text-indigo-300 hover:bg-th-surface-h transition-colors">
                            {t.organization?.transferOwnership || 'Transfer Ownership'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending Invitations */}
      {activeTab === 'invitations' && (
        <div className="space-y-3">
          {loadingInvitations ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-12">
              <Mail24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
              <p className="text-th-text-t">{t.organization?.noInvitations || 'No pending invitations'}</p>
            </div>
          ) : (
            invitations.map((inv) => (
              <div key={inv.id} className="bg-th-surface border border-th-border rounded-xl p-4 hover:bg-th-surface transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-th-text truncate">{inv.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${ROLE_COLORS[inv.role]}`}>
                        {inv.role}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 mt-2 text-xs text-th-text-m">
                      <span>{t.organization?.invitedBy || 'Invited by'} {inv.invitedBy?.fullName || 'Unknown'}</span>
                      <span className="flex items-center gap-1">
                        <Clock24Regular className="w-3 h-3" />
                        {t.organization?.expires || 'Expires'} {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelInvitation(inv.id)}
                    disabled={cancellingId === inv.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all disabled:opacity-50 shrink-0"
                  >
                    {cancellingId === inv.id ? (
                      <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Dismiss24Regular className="w-3.5 h-3.5" />
                    )}
                    {t.organization?.cancelInvitation || 'Cancel'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-th-bg-s border border-th-border rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-th-text">{t.organization?.inviteMember || 'Invite Member'}</h2>
              <button onClick={() => setShowInvite(false)} className="p-2 hover:bg-th-surface-h rounded-lg">
                <Dismiss24Regular className="w-5 h-5 text-th-text-t" />
              </button>
            </div>

            {inviteError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{inviteError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm text-th-text-t mb-1 block">{t.organization?.emailAddress || 'Email Address'}</label>
                <div className="relative">
                  <Mail24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full bg-th-surface border border-th-border rounded-xl pl-10 pr-4 py-3 text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-th-text-t mb-1 block">{t.organization?.role || 'Role'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {['MEMBER', 'ADMIN', 'VIEWER'].map((role) => (
                    <button
                      key={role}
                      onClick={() => setInviteRole(role)}
                      className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                        inviteRole === role
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="w-full mt-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
            >
              {inviting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t.organization?.sending || 'Sending...'}
                </span>
              ) : (
                t.organization?.sendInvite || 'Send Invitation'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
