/**
 * Introduction Consent Page
 *
 * Public page for contacts to view introduction details
 * and accept or decline being introduced.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Checkmark24Regular,
  Dismiss24Regular,
  Person24Regular,
  Building24Regular,
  Lightbulb24Regular,
  Briefcase24Regular,
  Handshake24Regular,
  SlideLayout24Regular,
  ArrowSync24Regular,
} from '@fluentui/react-icons';
import {
  getIntroductionByToken,
  acceptIntroductionByToken,
  declineIntroductionByToken,
  PublicIntroductionView,
  CollaborationSourceType,
} from '@/lib/api/collaboration';

function getSourceIcon(type: CollaborationSourceType) {
  switch (type) {
    case 'PROJECT': return <Lightbulb24Regular className="w-6 h-6" />;
    case 'OPPORTUNITY': return <Briefcase24Regular className="w-6 h-6" />;
    case 'PITCH': return <SlideLayout24Regular className="w-6 h-6" />;
    case 'DEAL': return <Handshake24Regular className="w-6 h-6" />;
    default: return <Lightbulb24Regular className="w-6 h-6" />;
  }
}

function getSourceLabel(type: CollaborationSourceType): string {
  switch (type) {
    case 'PROJECT': return 'Project';
    case 'OPPORTUNITY': return 'Opportunity';
    case 'PITCH': return 'Pitch';
    case 'DEAL': return 'Deal';
    default: return 'Collaboration';
  }
}

export default function IntroductionConsentPage() {
  const params = useParams();
  const token = params.token as string;

  const [introduction, setIntroduction] = useState<PublicIntroductionView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [responseStatus, setResponseStatus] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    const fetchIntroduction = async () => {
      try {
        const data = await getIntroductionByToken(token);
        setIntroduction(data);

        // Check if already responded
        if (data.status === 'ACCEPTED') {
          setResponseStatus('accepted');
        } else if (data.status === 'DECLINED') {
          setResponseStatus('declined');
        }
      } catch (err: any) {
        setError(err.message || 'Introduction not found or has expired');
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchIntroduction();
    }
  }, [token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await acceptIntroductionByToken(token);
      setResponseStatus('accepted');
    } catch (err: any) {
      setError(err.message || 'Failed to accept introduction');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await declineIntroductionByToken(token);
      setResponseStatus('declined');
    } catch (err: any) {
      setError(err.message || 'Failed to decline introduction');
    } finally {
      setIsDeclining(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-th-bg flex items-center justify-center">
        <div className="text-center">
          <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-th-text-t">Loading introduction details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !introduction) {
    return (
      <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Dismiss24Regular className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-th-text mb-2">Introduction Not Found</h1>
          <p className="text-th-text-t">{error}</p>
        </div>
      </div>
    );
  }

  if (!introduction) return null;

  // Already responded state
  if (responseStatus) {
    return (
      <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-th-bg-s border border-th-border rounded-2xl p-8 text-center">
            {responseStatus === 'accepted' ? (
              <>
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <Checkmark24Regular className="w-10 h-10 text-green-400" />
                </div>
                <h1 className="text-2xl font-bold text-th-text mb-3">Introduction Accepted!</h1>
                <p className="text-th-text-t leading-relaxed">
                  Thank you, {introduction.contactName}! {introduction.ownerName} has been notified that you're interested in collaborating on "{introduction.sourceTitle}".
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-th-bg-t flex items-center justify-center mx-auto mb-6">
                  <Dismiss24Regular className="w-10 h-10 text-th-text-t" />
                </div>
                <h1 className="text-2xl font-bold text-th-text mb-3">Introduction Declined</h1>
                <p className="text-th-text-t leading-relaxed">
                  No problem! We've let {introduction.collaboratorName} know you're not interested at this time.
                </p>
              </>
            )}

            {/* IntellMatch branding */}
            <div className="mt-8 pt-6 border-t border-th-border">
              <p className="text-xs text-th-text-m">Powered by IntellMatch</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main consent view
  return (
    <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-th-bg-s border border-th-border rounded-2xl overflow-hidden shadow-2xl">
          {/* Header gradient */}
          <div className="bg-gradient-to-r from-emerald-900/50 to-blue-900/50 p-8 text-center border-b border-th-border">
            <div className="w-16 h-16 rounded-2xl bg-th-surface-h flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🤝</span>
            </div>
            <h1 className="text-2xl font-bold text-th-text mb-2">You've Been Recommended</h1>
            <p className="text-th-text-s">
              <span className="text-emerald-300 font-medium">{introduction.collaboratorName}</span> would like to introduce you to{' '}
              <span className="text-th-text font-medium">{introduction.ownerName}</span>
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Personal message */}
            {introduction.message && (
              <div className="bg-emerald-500/10 border-l-4 border-emerald-500 rounded-r-xl p-4">
                <p className="text-sm text-th-text-s italic">"{introduction.message}"</p>
                <p className="text-xs text-th-text-m mt-2">— {introduction.collaboratorName}</p>
              </div>
            )}

            {/* Project details card */}
            <div className="bg-th-surface border border-th-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  {getSourceIcon(introduction.sourceType)}
                </div>
                <div>
                  <span className="text-xs text-emerald-400 uppercase tracking-wide font-medium">
                    {getSourceLabel(introduction.sourceType)}
                  </span>
                  <h2 className="text-lg font-bold text-th-text">{introduction.sourceTitle}</h2>
                </div>
              </div>

              {introduction.sourceDescription && (
                <p className="text-sm text-th-text-t leading-relaxed mb-4">
                  {introduction.sourceDescription.length > 400
                    ? `${introduction.sourceDescription.substring(0, 400)}...`
                    : introduction.sourceDescription}
                </p>
              )}

              {/* Owner info */}
              <div className="flex items-center gap-3 pt-4 border-t border-th-border">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Person24Regular className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-th-text">{introduction.ownerName}</p>
                  {introduction.ownerCompany && (
                    <div className="flex items-center gap-1 text-xs text-th-text-t">
                      <Building24Regular className="w-3 h-3" />
                      {introduction.ownerCompany}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Hi message */}
            <div className="text-center">
              <p className="text-sm text-th-text-t">
                Hi <span className="text-th-text font-medium">{introduction.contactName}</span>, would you like to be introduced?
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleDecline}
                disabled={isDeclining || isAccepting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-th-surface border border-th-border text-th-text-s font-medium rounded-xl hover:bg-th-surface-h transition-all disabled:opacity-50"
              >
                {isDeclining ? (
                  <ArrowSync24Regular className="w-5 h-5 animate-spin" />
                ) : (
                  <Dismiss24Regular className="w-5 h-5" />
                )}
                Decline
              </button>
              <button
                onClick={handleAccept}
                disabled={isAccepting || isDeclining}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
              >
                {isAccepting ? (
                  <ArrowSync24Regular className="w-5 h-5 animate-spin" />
                ) : (
                  <Checkmark24Regular className="w-5 h-5" />
                )}
                Accept
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-th-border text-center">
            <p className="text-xs text-th-text-m">
              This introduction was sent via <span className="text-emerald-400">IntellMatch</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
