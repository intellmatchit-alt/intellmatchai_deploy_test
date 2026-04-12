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

  // Password strength indicators
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

  if (!token) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-3xl blur-xl" />
        <div className="relative bg-th-surface backdrop-blur-xl border border-th-border rounded-2xl p-8 shadow-2xl text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center mb-6">
            <Dismiss24Regular className="w-10 h-10 text-th-text" />
          </div>
          <h1 className="text-3xl font-bold text-th-text mb-4">Invalid Link</h1>
          <p className="text-th-text-t mb-8">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
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
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-3xl blur-xl" />
        <div className="relative bg-th-surface backdrop-blur-xl border border-th-border rounded-2xl p-8 shadow-2xl text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center mb-6">
            <Checkmark24Regular className="w-10 h-10 text-th-text" />
          </div>
          <h1 className="text-3xl font-bold text-th-text mb-4">Password Reset!</h1>
          <p className="text-th-text-t mb-8">
            Your password has been successfully reset. You can now login with your new password.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
          >
            Continue to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 rounded-3xl blur-xl" />
      <div className="relative bg-th-surface backdrop-blur-xl border border-th-border rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-th-text mb-2">
            {t.auth?.resetPassword?.title || 'Reset Your Password'}
          </h1>
          <p className="text-th-text-t">
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
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.auth?.resetPassword?.newPassword || 'New Password'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
                <LockClosed24Regular className="w-5 h-5 text-th-text-m" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth?.resetPassword?.newPasswordPlaceholder || 'Enter new password'}
                disabled={isLoading}
                className={`w-full ps-12 pe-12 py-3 bg-th-surface border ${
                  errors.password ? 'border-red-500' : 'border-th-border'
                } rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 end-0 pe-4 flex items-center text-th-text-m hover:text-th-text transition-colors"
              >
                {showPassword ? (
                  <EyeOff20Regular className="w-5 h-5" />
                ) : (
                  <Eye20Regular className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.password && <p className="mt-2 text-sm text-red-400">{errors.password}</p>}

            {/* Password strength indicators */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    passwordStrength.hasMinLength ? 'bg-green-500' : 'bg-th-surface-h'
                  }`}
                >
                  {passwordStrength.hasMinLength && (
                    <Checkmark24Regular className="w-3 h-3 text-th-text" />
                  )}
                </div>
                <span className={passwordStrength.hasMinLength ? 'text-green-400' : 'text-th-text-m'}>
                  At least 8 characters
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    passwordStrength.hasUppercase ? 'bg-green-500' : 'bg-th-surface-h'
                  }`}
                >
                  {passwordStrength.hasUppercase && (
                    <Checkmark24Regular className="w-3 h-3 text-th-text" />
                  )}
                </div>
                <span className={passwordStrength.hasUppercase ? 'text-green-400' : 'text-th-text-m'}>
                  One uppercase letter
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    passwordStrength.hasLowercase ? 'bg-green-500' : 'bg-th-surface-h'
                  }`}
                >
                  {passwordStrength.hasLowercase && (
                    <Checkmark24Regular className="w-3 h-3 text-th-text" />
                  )}
                </div>
                <span className={passwordStrength.hasLowercase ? 'text-green-400' : 'text-th-text-m'}>
                  One lowercase letter
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    passwordStrength.hasNumber ? 'bg-green-500' : 'bg-th-surface-h'
                  }`}
                >
                  {passwordStrength.hasNumber && (
                    <Checkmark24Regular className="w-3 h-3 text-th-text" />
                  )}
                </div>
                <span className={passwordStrength.hasNumber ? 'text-green-400' : 'text-th-text-m'}>
                  One number
                </span>
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.auth?.resetPassword?.confirmPassword || 'Confirm Password'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
                <LockClosed24Regular className="w-5 h-5 text-th-text-m" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.auth?.resetPassword?.confirmPasswordPlaceholder || 'Confirm new password'}
                disabled={isLoading}
                className={`w-full ps-12 pe-12 py-3 bg-th-surface border ${
                  errors.confirmPassword ? 'border-red-500' : 'border-th-border'
                } rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 end-0 pe-4 flex items-center text-th-text-m hover:text-th-text transition-colors"
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

          <button type="submit" disabled={isLoading} className="relative w-full group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
            <span className="relative block w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t.auth?.resetPassword?.resetting || 'Resetting...'}
                </span>
              ) : (
                t.auth?.resetPassword?.submit || 'Reset Password'
              )}
            </span>
          </button>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-th-text-t hover:text-th-text transition-colors mt-6"
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
      <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
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
