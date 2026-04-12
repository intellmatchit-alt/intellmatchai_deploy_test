'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Person24Regular,
  Building24Regular,
  Briefcase24Regular,
  Eye24Regular,
  EyeOff24Regular,
  Checkmark24Regular,
  ErrorCircle24Regular,
  ArrowLeft24Regular,
} from '@fluentui/react-icons';
import { useLanguage } from '@/hooks/useLanguage';

interface PreAccount {
  id: string;
  fullName: string;
  email: string;
  company?: string;
  jobTitle?: string;
  inviterName?: string;
}

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [preAccount, setPreAccount] = useState<PreAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/v1/invitations/verify/${token}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error?.message || 'Invalid or expired invitation');
          return;
        }

        setPreAccount(data.data);
      } catch {
        setError('Failed to verify invitation');
      } finally {
        setLoading(false);
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate passwords
    if (password.length < 8) {
      setFormError(t.invitation?.passwordTooShort || 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setFormError(t.invitation?.passwordMismatch || 'Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/v1/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setFormError(data.error?.message || 'Failed to activate account');
        return;
      }

      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch {
      setFormError('Failed to activate account');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading || verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-500/30 border-t-emerald-500" />
          <p className="mt-4 text-th-text-t">
            {t.invitation?.verifying || 'Verifying invitation...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !preAccount) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
            <ErrorCircle24Regular className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-th-text">
            {t.invitation?.invalidTitle || 'Invalid Invitation'}
          </h1>
          <p className="mb-8 text-th-text-t">
            {error || t.invitation?.invalidDescription || 'This invitation link is invalid or has expired.'}
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
          >
            {t.invitation?.signUpInstead || 'Sign up for a new account'}
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
            <Checkmark24Regular className="h-10 w-10 text-green-400" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-th-text">
            {t.invitation?.welcomeTitle || 'Welcome to IntellMatch!'}
          </h1>
          <p className="mb-4 text-th-text-t">
            {t.invitation?.accountActivated || 'Your account has been activated successfully.'}
          </p>
          {preAccount.inviterName && (
            <p className="mb-8 text-th-text-t">
              {t.invitation?.connectedWith?.replace('{name}', preAccount.inviterName) ||
                `You are now connected with ${preAccount.inviterName}.`}
            </p>
          )}
          <p className="text-sm text-th-text-m">
            {t.invitation?.redirecting || 'Redirecting to login...'}
          </p>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="flex min-h-screen items-center justify-center bg-th-bg px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-th-text-t transition-colors hover:text-th-text"
        >
          <ArrowLeft24Regular className="h-5 w-5" />
          <span>{t.common?.backToHome || 'Back to home'}</span>
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500">
            <span className="text-2xl font-bold text-th-text">IM</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-th-text">
            {t.invitation?.acceptTitle || "You're Invited!"}
          </h1>
          {preAccount.inviterName && (
            <p className="text-th-text-t">
              {t.invitation?.invitedBy?.replace('{name}', preAccount.inviterName) ||
                `${preAccount.inviterName} invited you to join IntellMatch`}
            </p>
          )}
        </div>

        {/* Pre-filled info card */}
        <div className="mb-8 rounded-2xl border border-th-border bg-th-surface p-6">
          <h2 className="mb-4 text-sm font-medium text-th-text-t">
            {t.invitation?.yourProfile || 'Your Profile'}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Person24Regular className="h-5 w-5 text-th-text-m" />
              <span className="text-th-text">{preAccount.fullName}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-5 w-5 text-center text-th-text-m">@</span>
              <span className="text-th-text">{preAccount.email}</span>
            </div>
            {preAccount.company && (
              <div className="flex items-center gap-3">
                <Building24Regular className="h-5 w-5 text-th-text-m" />
                <span className="text-th-text">{preAccount.company}</span>
              </div>
            )}
            {preAccount.jobTitle && (
              <div className="flex items-center gap-3">
                <Briefcase24Regular className="h-5 w-5 text-th-text-m" />
                <span className="text-th-text">{preAccount.jobTitle}</span>
              </div>
            )}
          </div>
        </div>

        {/* Password form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-th-text-s">
              {t.invitation?.createPassword || 'Create a password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full rounded-xl border border-th-border bg-th-surface px-4 py-3 pr-12 text-th-text placeholder-th-text-m focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-m hover:text-th-text-s"
              >
                {showPassword ? (
                  <EyeOff24Regular className="h-5 w-5" />
                ) : (
                  <Eye24Regular className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-th-text-m">
              {t.invitation?.passwordRequirement || 'At least 8 characters'}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-th-text-s">
              {t.invitation?.confirmPassword || 'Confirm password'}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full rounded-xl border border-th-border bg-th-surface px-4 py-3 text-th-text placeholder-th-text-m focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Error message */}
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-red-400">
              <ErrorCircle24Regular className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{formError}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>{t.invitation?.activating || 'Activating...'}</span>
              </div>
            ) : (
              t.invitation?.activateAccount || 'Activate Account'
            )}
          </button>

          {/* Terms */}
          <p className="text-center text-xs text-th-text-m">
            {t.invitation?.termsNotice || 'By activating your account, you agree to our'}{' '}
            <Link href="/terms" className="text-emerald-400 hover:underline">
              {t.common?.termsOfService || 'Terms of Service'}
            </Link>{' '}
            {t.common?.and || 'and'}{' '}
            <Link href="/privacy" className="text-emerald-400 hover:underline">
              {t.common?.privacyPolicy || 'Privacy Policy'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
