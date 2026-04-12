/**
 * Forgot Password Page with i18n
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from '@/components/ui/Toast';
import { forgotPassword } from '@/lib/api/auth';
import { useI18n } from '@/lib/i18n';
import { Mail24Regular, ArrowLeft24Regular, Checkmark24Regular } from '@fluentui/react-icons';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    if (!email) { setError('Email is required'); return false; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Invalid email address'); return false; }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await forgotPassword(email);
      setIsSubmitted(true);
      toast({ title: 'Email sent', description: 'Check your inbox for password reset instructions.', variant: 'success' });
    } catch (error: any) {
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="relative">
        <div className="absolute -inset-4 bg-[radial-gradient(ellipse,rgba(0,208,132,0.1)_0%,transparent_70%)] rounded-3xl" />
        <div className="relative bg-[#0c1222]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-2xl text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#00d084] flex items-center justify-center mb-6">
            <Checkmark24Regular className="w-8 h-8 text-[#060b18]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t.auth.forgotPassword.successTitle}</h1>
          <p className="text-white/70 mb-8">
            {t.auth.forgotPassword.successMessage} <span className="text-white font-medium">{email}</span>{t.auth.forgotPassword.successMessageEnd}
          </p>
          <div className="space-y-4">
            <button onClick={() => setIsSubmitted(false)} className="w-full py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white hover:bg-white/[0.06] transition-all">{t.auth.forgotPassword.tryAnother}</button>
            <Link href="/login" className="flex items-center justify-center gap-2 text-[#00d084] hover:text-[#00e896] transition-colors">
              <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
              {t.auth.forgotPassword.backToSignIn}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-[radial-gradient(ellipse,rgba(0,208,132,0.08)_0%,transparent_70%)] rounded-3xl" />
      <div className="relative bg-[#0c1222]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t.auth.forgotPassword.title}</h1>
          <p className="text-white/70">{t.auth.forgotPassword.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">{t.auth.forgotPassword.email}</label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none"><Mail24Regular className="w-5 h-5 text-white/50" /></div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.auth.forgotPassword.emailPlaceholder} disabled={isLoading} autoFocus
                className={`w-full ps-12 pe-4 py-3 bg-white/[0.03] border ${error ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-[#56657a] focus:outline-none focus:ring-2 focus:ring-[#00d084]/30 focus:border-[#00d084]/50 transition-all`} />
            </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>

          <button type="submit" disabled={isLoading} className="btn-accent w-full py-3.5 disabled:opacity-50">
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#060b18] border-t-transparent rounded-full animate-spin" />
                {t.auth.forgotPassword.submitting}
              </span>
            ) : t.auth.forgotPassword.submit}
          </button>

          <Link href="/login" className="flex items-center justify-center gap-2 text-[#00d084] hover:text-[#00e896] transition-colors mt-6">
            <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
            {t.auth.forgotPassword.backToSignIn}
          </Link>
        </form>
      </div>
    </div>
  );
}
