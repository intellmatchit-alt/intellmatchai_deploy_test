'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building24Regular,
  Person24Regular,
  Checkmark24Regular,
  ErrorCircle24Regular,
  ArrowLeft24Regular,
} from '@fluentui/react-icons';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api/client';

interface InvitationInfo {
  email: string;
  role: string;
  status: string;
  isValid: boolean;
  organization: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
  invitedBy: {
    fullName: string;
    avatarUrl: string | null;
  };
  expiresAt: string;
}

export default function OrgInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/v1/organizations/invitations/${token}/info`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error?.message || 'Invitation not found');
          return;
        }
        setInvitation(data.data);
      } catch {
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      await api.post(`/organizations/invitations/${token}/accept`);
      setSuccess(true);
      setTimeout(() => {
        router.push('/contacts');
      }, 2000);
    } catch (err: any) {
      setAcceptError(err.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-500/30 border-t-emerald-500" />
          <p className="mt-4 text-th-text-t">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
            <ErrorCircle24Regular className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-th-text">Invalid Invitation</h1>
          <p className="mb-8 text-th-text-t">{error || 'This invitation link is invalid or has expired.'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!invitation.isValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
            <ErrorCircle24Regular className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-th-text">
            {invitation.status === 'EXPIRED' ? 'Invitation Expired' : `Invitation ${invitation.status}`}
          </h1>
          <p className="mb-8 text-th-text-t">
            {invitation.status === 'EXPIRED'
              ? 'This invitation has expired. Please ask the admin to send a new one.'
              : `This invitation has already been ${invitation.status.toLowerCase()}.`}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
            <Checkmark24Regular className="h-10 w-10 text-green-400" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-th-text">Welcome to {invitation.organization.name}!</h1>
          <p className="mb-4 text-th-text-t">You have successfully joined the organization.</p>
          <p className="text-sm text-th-text-m">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-th-bg px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-th-text-t transition-colors hover:text-th-text"
        >
          <ArrowLeft24Regular className="h-5 w-5" />
          <span>Back to home</span>
        </Link>

        {/* Organization Card */}
        <div className="mb-6 rounded-2xl border border-th-border bg-th-surface p-6 text-center">
          {invitation.organization.logoUrl ? (
            <img
              src={invitation.organization.logoUrl}
              alt=""
              className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover ring-2 ring-white/10"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500">
              <Building24Regular className="h-8 w-8 text-th-text" />
            </div>
          )}
          <h1 className="mb-1 text-2xl font-bold text-th-text">You&apos;re Invited!</h1>
          <p className="text-th-text-t">
            Join <span className="font-semibold text-th-text">{invitation.organization.name}</span>
          </p>
        </div>

        {/* Invitation Details */}
        <div className="mb-6 space-y-3 rounded-2xl border border-th-border bg-th-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-th-text-t">Invited by</span>
            <div className="flex items-center gap-2">
              {invitation.invitedBy.avatarUrl ? (
                <img src={invitation.invitedBy.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/30 text-[10px] font-bold text-emerald-300">
                  {invitation.invitedBy.fullName?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium text-th-text">{invitation.invitedBy.fullName}</span>
            </div>
          </div>
          <div className="h-px bg-th-surface" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-th-text-t">Your role</span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              {invitation.role}
            </span>
          </div>
          <div className="h-px bg-th-surface" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-th-text-t">Email</span>
            <span className="text-sm text-th-text">{invitation.email}</span>
          </div>
        </div>

        {/* Action */}
        {!isAuthenticated ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-th-text-t">You need to sign in to accept this invitation.</p>
            <Link
              href={`/login?redirect=/invite/org/${token}`}
              className="block w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-center font-medium text-white transition-opacity hover:opacity-90"
            >
              Sign In to Accept
            </Link>
            <p className="text-center text-sm text-th-text-m">
              Don&apos;t have an account?{' '}
              <Link href={`/register?redirect=/invite/org/${token}`} className="text-emerald-400 hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {user?.email?.toLowerCase() !== invitation.email.toLowerCase() && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-sm text-emerald-400">
                This invitation was sent to <span className="font-semibold">{invitation.email}</span>. You are signed in as <span className="font-semibold">{user?.email}</span>.
              </div>
            )}

            {acceptError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
                {acceptError}
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {accepting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Accepting...
                </span>
              ) : (
                'Accept Invitation'
              )}
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full rounded-xl border border-th-border bg-th-surface px-4 py-3 font-medium text-th-text-s transition-colors hover:bg-th-surface-h"
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
