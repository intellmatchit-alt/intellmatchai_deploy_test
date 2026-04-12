/**
 * Invitation Accept Page
 *
 * Public page for third parties to view and respond to
 * collaboration invitations.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Checkmark24Regular,
  Dismiss24Regular,
  Person24Regular,
  Building24Regular,
  Lightbulb24Regular,
  Briefcase24Regular,
  Handshake24Regular,
  ArrowRight24Regular,
  Warning24Regular,
  SlideLayout24Regular,
} from '@fluentui/react-icons';
import {
  getInvitationByToken,
  acceptInvitation,
  declineInvitation,
  PublicInvitationView,
  CollaborationSourceType,
} from '@/lib/api/collaboration';

export default function InvitationAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<PublicInvitationView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [responseStatus, setResponseStatus] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const data = await getInvitationByToken(token);
        setInvitation(data.invitation);

        // Check if already responded
        if (data.invitation.status !== 'INVITED') {
          setResponseStatus(data.invitation.status === 'ACCEPTED' ? 'accepted' : 'declined');
        }
      } catch (err: any) {
        console.error('Failed to fetch invitation:', err);
        setError(err.message || 'Invitation not found or has expired');
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchInvitation();
    }
  }, [token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const result = await acceptInvitation(token);
      if (result.success) {
        setResponseStatus('accepted');
      } else {
        setError(result.error || 'Failed to accept invitation');
      }
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      const result = await declineInvitation(token, declineReason || undefined);
      if (result.success) {
        setResponseStatus('declined');
      }
    } catch (err: any) {
      console.error('Failed to decline invitation:', err);
      setError(err.message || 'Failed to decline invitation');
    } finally {
      setIsDeclining(false);
      setShowDeclineReason(false);
    }
  };

  const getSourceTypeIcon = (type: CollaborationSourceType) => {
    switch (type) {
      case 'PROJECT':
        return <Lightbulb24Regular className="w-8 h-8" />;
      case 'OPPORTUNITY':
        return <Briefcase24Regular className="w-8 h-8" />;
      case 'PITCH':
        return <SlideLayout24Regular className="w-8 h-8" />;
      case 'DEAL':
        return <Handshake24Regular className="w-8 h-8" />;
      default:
        return <Lightbulb24Regular className="w-8 h-8" />;
    }
  };

  const getSourceTypeLabel = (type: CollaborationSourceType) => {
    const labels: Record<CollaborationSourceType, string> = {
      PROJECT: 'Project',
      OPPORTUNITY: 'Opportunity',
      PITCH: 'Pitch',
      DEAL: 'Deal',
    };
    return labels[type] || type;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-th-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00d084]/40/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-th-text-t">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Warning24Regular className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-th-text mb-2">
            Invitation Not Found
          </h1>
          <p className="text-th-text-t mb-6">
            {error || 'This invitation may have expired or been removed.'}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#00d084]/50 hover:bg-[#00b870] text-th-text rounded-lg transition-colors"
          >
            Go to IntellMatch
            <ArrowRight24Regular className="w-5 h-5" />
          </a>
        </div>
      </div>
    );
  }

  // Response success state
  if (responseStatus) {
    return (
      <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              responseStatus === 'accepted'
                ? 'bg-green-500/20'
                : 'bg-white/[0.03]0/20'
            }`}
          >
            {responseStatus === 'accepted' ? (
              <Checkmark24Regular className="w-8 h-8 text-green-400" />
            ) : (
              <Dismiss24Regular className="w-8 h-8 text-th-text-t" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-th-text mb-2">
            {responseStatus === 'accepted'
              ? 'Invitation Accepted!'
              : 'Invitation Declined'}
          </h1>
          <p className="text-th-text-t mb-6">
            {responseStatus === 'accepted'
              ? `You've joined the team for "${invitation.sourceTitle}". ${invitation.ownerName} will be notified.`
              : `You've declined the invitation. Thank you for letting us know.`}
          </p>
          <div className="space-y-3">
            {responseStatus === 'accepted' && (
              <a
                href="/register"
                className="block w-full px-6 py-3 bg-[#00d084]/50 hover:bg-[#00b870] text-th-text rounded-lg transition-colors"
              >
                Create an Account
              </a>
            )}
            <a
              href="/"
              className="block w-full px-6 py-3 bg-th-bg-t hover:bg-neutral-700 text-th-text rounded-lg transition-colors"
            >
              Visit IntellMatch
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Main invitation view
  return (
    <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-primary-400">IntellMatch</h2>
        </div>

        {/* Invitation Card */}
        <div className="bg-th-bg-s rounded-xl border border-th-border overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-gradient-to-br from-primary-500/10 to-transparent border-b border-th-border">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#00d084]/50/20 rounded-xl text-primary-400">
                {getSourceTypeIcon(invitation.sourceType)}
              </div>
              <div>
                <p className="text-sm text-th-text-t mb-1">
                  You're invited to join a {getSourceTypeLabel(invitation.sourceType).toLowerCase()}
                </p>
                <h1 className="text-2xl font-bold text-th-text">
                  {invitation.sourceTitle}
                </h1>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Greeting */}
            <div>
              <p className="text-lg text-th-text">
                Hi {invitation.recipientName},
              </p>
              <p className="text-th-text-t mt-2">
                <span className="text-th-text font-medium">{invitation.inviterName}</span>
                {' '}thinks you'd be a great fit for this{' '}
                {getSourceTypeLabel(invitation.sourceType).toLowerCase()} and has invited you to join the team.
              </p>
            </div>

            {/* Project Description */}
            {invitation.sourceDescription && (
              <div className="p-4 bg-th-bg-t rounded-lg">
                <p className="text-th-text-s text-sm">
                  {invitation.sourceDescription}
                </p>
              </div>
            )}

            {/* Owner Info */}
            <div className="flex items-center gap-3 p-4 bg-th-bg-t/50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center">
                <Person24Regular className="w-5 h-5 text-th-text-t" />
              </div>
              <div>
                <p className="text-sm text-th-text-t">
                  {getSourceTypeLabel(invitation.sourceType)} Owner
                </p>
                <p className="font-medium text-th-text">{invitation.ownerName}</p>
                {invitation.ownerCompany && (
                  <p className="text-sm text-th-text-t flex items-center gap-1">
                    <Building24Regular className="w-3 h-3" />
                    {invitation.ownerCompany}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-th-border space-y-3">
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="w-full px-6 py-3 bg-[#00d084]/50 hover:bg-[#00b870] disabled:bg-neutral-700 text-th-text rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isAccepting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <Checkmark24Regular className="w-5 h-5" />
                  Accept Invitation
                </>
              )}
            </button>

            {!showDeclineReason ? (
              <button
                onClick={() => setShowDeclineReason(true)}
                className="w-full px-6 py-3 text-th-text-t hover:text-th-text transition-colors"
              >
                Decline
              </button>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Reason (optional)"
                  rows={2}
                  className="w-full px-3 py-2 bg-th-bg-t border border-neutral-700 rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-[#00d084]/40 focus:border-transparent resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeclineReason(false)}
                    className="flex-1 px-4 py-2 text-th-text-t hover:text-th-text transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={isDeclining}
                    className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                  >
                    {isDeclining ? 'Declining...' : 'Confirm Decline'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-th-text-m text-sm mt-6">
          Powered by IntellMatch - Professional Networking & Collaboration
        </p>
      </div>
    </div>
  );
}
