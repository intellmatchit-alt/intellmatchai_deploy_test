/**
 * Reset Password Page
 */

'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/Toast';
import {
  LockClosed24Regular,
  Eye20Regular,
  EyeOff20Regular,
  Checkmark20Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  ArrowLeft24Regular,
} from '@fluentui/react-icons';

function ResetPasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
  });

  useEffect(() => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    });
  }, [password]);

  const validate = () => {
    const newErrors: { password?: string; confirmPassword?: string } = {};

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(password)) {
      newErrors.password = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = 'Password must contain at least one number';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
      return;
    }

    if (!validate()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (data.success) {
        setIsSuccess(true);
        toast({
          title: 'Password Reset Successful',
          description: 'You can now login with your new password.',
          variant: 'success',
        });
      } else {
        setError(data.error?.message || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBase =
    'w-full ps-12 pe-12 py-3 bg-white/[0.05] border rounded-xl text-white placeholder-[#56657a] focus:outline-none focus:bg-white/[0.07] focus:ring-2 focus:ring-[#00d084]/30 focus:border-[#00d084]/60 transition-all duration-200';

  if (!token) {
    return (
      <div className="relative">
        <div className="absolute -inset-4 bg-[radial-gradient(ellipse,rgba(0,208,132,0.08)_0%,transparent_70%)] rounded-3xl" />
        <div className="relative bg-[#131b2e]/85 backdrop-blur-xl border border-white/[0.10] rounded-2xl p-8 shadow-2xl ring-1 ring-[#00d084]/[0.06] text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-6">
            <Dismiss24Regular className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Link</h1>
          <p className="text-white/70 mb-8">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-5 rounded-xl font-semibold text-base text-[#051a12] bg-gradient-to-br from-[#00e896] via-[#00d084] to-[#00b870] shadow-[0_8px_24px_rgba(0,208,132,0.28),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_14px_36px_rgba(0,208,132,0.42),inset_0_1px_0_rgba(255,255,255,0.30)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all duration-200"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="relative">
        <div className="absolute -inset-4 bg-[radial-gradient(ellipse,rgba(0,208,132,0.10)_0%,transparent_70%)] rounded-3xl" />
        <div className="relative bg-[#131b2e]/85 backdrop-blur-xl border border-white/[0.10] rounded-2xl p-8 shadow-2xl ring-1 ring-[#00d084]/[0.06] text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#00d084] flex items-center justify-center mb-6">
            <Checkmark24Regular className="w-8 h-8 text-[#060b18]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Password Reset!</h1>
          <p className="text-white/70 mb-8">
            Your password has been successfully reset. You can now login with your new password.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-5 rounded-xl font-semibold text-base text-[#051a12] bg-gradient-to-br from-[#00e896] via-[#00d084] to-[#00b870] shadow-[0_8px_24px_rgba(0,208,132,0.28),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_14px_36px_rgba(0,208,132,0.42),inset_0_1px_0_rgba(255,255,255,0.30)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all duration-200"
          >
            Continue to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-[radial-gradient(ellipse,rgba(0,208,132,0.08)_0%,transparent_70%)] rounded-3xl" />
      <div className="relative bg-[#131b2e]/85 backdrop-blur-xl border border-white/[0.10] rounded-2xl p-8 shadow-2xl ring-1 ring-[#00d084]/[0.06]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {t.auth?.resetPassword?.title || 'Reset Your Password'}
          </h1>
          <p className="text-white/70">
            {t.auth?.resetPassword?.subtitle || 'Enter your new password below'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t.auth?.resetPassword?.newPassword || 'New Password'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
                <LockClosed24Regular className="w-5 h-5 text-white/50" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth?.resetPassword?.newPasswordPlaceholder || 'Enter new password'}
                disabled={isLoading}
                className={`${inputBase} ${errors.password ? 'border-red-500' : 'border-white/[0.08]'}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 end-0 pe-4 flex items-center text-white/50 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <EyeOff20Regular className="w-5 h-5" />
                ) : (
                  <Eye20Regular className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.password && <p className="mt-2 text-sm text-red-400">{errors.password}</p>}

            {/* Password strength indicators — matches Register screen */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { check: passwordStrength.hasMinLength, label: 'At least 8 characters' },
                { check: passwordStrength.hasUppercase, label: 'One uppercase letter' },
                { check: passwordStrength.hasLowercase, label: 'One lowercase letter' },
                { check: passwordStrength.hasNumber, label: 'One number' },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 text-xs ${item.check ? 'text-[#00d084]' : 'text-white/50'}`}
                >
                  <Checkmark20Regular
                    className={`w-4 h-4 ${item.check ? 'opacity-100' : 'opacity-30'}`}
                  />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t.auth?.resetPassword?.confirmPassword || 'Confirm Password'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
                <LockClosed24Regular className="w-5 h-5 text-white/50" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.auth?.resetPassword?.confirmPasswordPlaceholder || 'Confirm new password'}
                disabled={isLoading}
                className={`${inputBase} ${errors.confirmPassword ? 'border-red-500' : 'border-white/[0.08]'}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 end-0 pe-4 flex items-center text-white/50 hover:text-white transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff20Regular className="w-5 h-5" />
                ) : (
                  <Eye20Regular className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-2 text-sm text-red-400">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-5 flex items-center justify-center gap-2 rounded-xl font-semibold text-base text-[#051a12] bg-gradient-to-br from-[#00e896] via-[#00d084] to-[#00b870] shadow-[0_8px_24px_rgba(0,208,132,0.28),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_14px_36px_rgba(0,208,132,0.42),inset_0_1px_0_rgba(255,255,255,0.30)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#051a12] border-t-transparent rounded-full animate-spin" />
                {t.auth?.resetPassword?.resetting || 'Resetting...'}
              </span>
            ) : (
              t.auth?.resetPassword?.submit || 'Reset Password'
            )}
          </button>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-[#00d084] hover:text-[#00e896] hover:underline underline-offset-4 transition-all duration-200 mt-6"
          >
            <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
            {t.auth?.resetPassword?.backToLogin || 'Back to Login'}
          </Link>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin h-10 w-10 border-4 border-[#00d084] border-t-transparent rounded-full" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
