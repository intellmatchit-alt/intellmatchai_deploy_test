/**
 * Create Account Modal
 *
 * Prompts event guests to convert to full IntellMatch users.
 * Shows benefits and handles password creation.
 */

'use client';

import { useState } from 'react';
import {
  Dismiss24Regular,
  Shield24Regular,
  People24Regular,
  Lightbulb24Regular,
  Eye24Regular,
  EyeOff24Regular,
  Checkmark24Regular,
  ErrorCircle24Regular,
  Sparkle24Regular,
} from '@fluentui/react-icons';
import { useLanguage } from '@/hooks/useLanguage';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tokens: { accessToken: string; refreshToken: string }) => void;
  accessToken: string;
  guestName: string;
  guestEmail: string;
}

export function CreateAccountModal({
  isOpen,
  onClose,
  onSuccess,
  accessToken,
  guestName,
  guestEmail,
}: CreateAccountModalProps) {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;
  const canSubmit = isPasswordValid && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/guests/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create account');
      }

      onSuccess({
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const benefits = [
    {
      icon: <People24Regular className="w-5 h-5" />,
      title: t.events?.createAccount?.benefit1Title || 'Access Your Matches',
      description: t.events?.createAccount?.benefit1Desc || 'View your event matches anytime, anywhere',
    },
    {
      icon: <Lightbulb24Regular className="w-5 h-5" />,
      title: t.events?.createAccount?.benefit2Title || 'AI-Powered Networking',
      description: t.events?.createAccount?.benefit2Desc || 'Get smart connection recommendations',
    },
    {
      icon: <Shield24Regular className="w-5 h-5" />,
      title: t.events?.createAccount?.benefit3Title || 'Manage Your Network',
      description: t.events?.createAccount?.benefit3Desc || 'Keep all your contacts in one place',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="relative p-6 pb-4 bg-gradient-to-br from-emerald-600/20 to-emerald-600/20">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-th-text-t hover:text-th-text hover:bg-th-surface-h rounded-lg transition-all"
          >
            <Dismiss24Regular className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Sparkle24Regular className="w-6 h-6 text-th-text" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-th-text">
                {t.events?.createAccount?.title || 'Create Your Account'}
              </h2>
              <p className="text-sm text-emerald-200">
                {t.events?.createAccount?.subtitle || 'Save your connections permanently'}
              </p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="px-6 py-4 border-b border-th-border">
          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  {benefit.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-th-text">{benefit.title}</p>
                  <p className="text-xs text-th-text-t">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email display */}
          <div className="bg-th-surface rounded-lg p-3">
            <p className="text-xs text-th-text-m mb-1">
              {t.events?.createAccount?.creatingAccountFor || 'Creating account for'}
            </p>
            <p className="text-sm text-th-text font-medium">{guestName}</p>
            <p className="text-sm text-th-text-t">{guestEmail}</p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-th-text mb-1.5">
              {t.events?.createAccount?.password || 'Create Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2.5 pr-10 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-t hover:text-th-text"
              >
                {showPassword ? <EyeOff24Regular className="w-5 h-5" /> : <Eye24Regular className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-green-400' : 'text-th-text-m'}`}>
              {hasMinLength ? <Checkmark24Regular className="w-3 h-3" /> : <ErrorCircle24Regular className="w-3 h-3" />}
              8+ characters
            </div>
            <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-green-400' : 'text-th-text-m'}`}>
              {hasUppercase ? <Checkmark24Regular className="w-3 h-3" /> : <ErrorCircle24Regular className="w-3 h-3" />}
              Uppercase letter
            </div>
            <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-green-400' : 'text-th-text-m'}`}>
              {hasLowercase ? <Checkmark24Regular className="w-3 h-3" /> : <ErrorCircle24Regular className="w-3 h-3" />}
              Lowercase letter
            </div>
            <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-green-400' : 'text-th-text-m'}`}>
              {hasNumber ? <Checkmark24Regular className="w-3 h-3" /> : <ErrorCircle24Regular className="w-3 h-3" />}
              Number
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-th-text mb-1.5">
              {t.events?.createAccount?.confirmPassword || 'Confirm Password'}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className={`w-full px-4 py-2.5 pr-10 bg-th-surface border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  confirmPassword && !passwordsMatch ? 'border-red-500' : 'border-th-border'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-t hover:text-th-text"
              >
                {showConfirmPassword ? <EyeOff24Regular className="w-5 h-5" /> : <Eye24Regular className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
          >
            {loading ? (
              <span className="animate-pulse">Creating account...</span>
            ) : (
              t.events?.createAccount?.submit || 'Create Account'
            )}
          </button>

          {/* Skip */}
          <button
            type="button"
            onClick={onClose}
            className="w-full text-sm text-th-text-m hover:text-th-text-s transition-colors"
          >
            {t.events?.createAccount?.skip || 'Maybe Later'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
