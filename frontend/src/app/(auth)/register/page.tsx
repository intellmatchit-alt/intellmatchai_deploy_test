/**
 * Register Page with i18n
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';
import { NameFields, NameFieldsValues, buildFullName } from '@/components/ui/NameFields';
import { Eye20Regular, EyeOff20Regular, Mail24Regular, LockClosed24Regular, Person24Regular, Checkmark20Regular, ArrowRight20Regular, Tag24Regular } from '@fluentui/react-icons';
import { validateAffiliateCode } from '@/lib/api/affiliate';

// LinkedIn icon component
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const [returnTo, setReturnTo] = useState<string | null>(null);

  const [nameFields, setNameFields] = useState<NameFieldsValues>({
    title: '', firstName: '', middleName: '', lastName: '',
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; email?: string; password?: string; confirmPassword?: string }>({});
  const [referralCode, setReferralCode] = useState('');
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralDiscount, setReferralDiscount] = useState<number | null>(null);

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const rt = params.get('returnTo');
      if (rt) setReturnTo(rt);
      const ref = params.get('ref');
      if (ref) {
        setReferralCode(ref);
        validateAffiliateCode(ref).then((res) => {
          if (res?.valid) {
            setReferralValid(true);
            setReferralDiscount(res?.discountPercent || null);
          } else {
            setReferralValid(false);
          }
        }).catch(() => setReferralValid(false));
      }
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const onboardingPath = returnTo ? `/onboarding?returnTo=${encodeURIComponent(returnTo)}` : '/onboarding';
      router.push(onboardingPath);
    }
  }, [authLoading, isAuthenticated, router, returnTo]);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!nameFields.firstName?.trim()) newErrors.firstName = 'First name is required';
    if (!nameFields.lastName?.trim()) newErrors.lastName = 'Last name is required';
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email address';
    if (!password) newErrors.password = 'Password is required';
    else if (!Object.values(passwordChecks).every(Boolean)) newErrors.password = 'Password does not meet requirements';
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const fullName = buildFullName(nameFields);
      await register({
        email, password, name: fullName,
        title: nameFields.title || undefined,
        firstName: nameFields.firstName,
        middleName: nameFields.middleName || undefined,
        lastName: nameFields.lastName,
        referralCode: referralCode || undefined,
      });
      toast({ title: 'Account created!', description: "Welcome to IntellMatch.", variant: 'success' });
      const onboardingPath = returnTo ? `/onboarding?returnTo=${encodeURIComponent(returnTo)}` : '/onboarding';
      router.push(onboardingPath);
    } catch (error: any) {
      toast({ title: 'Registration failed', description: error.message || 'Could not create account', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputBase = "w-full ps-12 pe-4 py-3 bg-white/[0.03] border rounded-xl text-white placeholder-[#56657a] focus:outline-none focus:ring-2 focus:ring-[#00d084]/30 focus:border-[#00d084]/50 transition-all";

  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-[radial-gradient(ellipse,rgba(0,208,132,0.08)_0%,transparent_70%)] rounded-3xl" />
      <div className="relative bg-[#0c1222]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t.auth.register.title}</h1>
          <p className="text-white/70">{t.auth.register.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Social Login Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID;
                const redirectUri = `${window.location.origin}/api/auth/linkedin/callback`;
                const scope = 'openid profile email';
                const state = Math.random().toString(36).substring(7);
                sessionStorage.setItem('linkedin_oauth_state', state);
                if (returnTo) sessionStorage.setItem('linkedin_oauth_returnTo', returnTo);
                const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;
                window.location.href = linkedInAuthUrl;
              }}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              <LinkedInIcon className="w-5 h-5" />
              {t.auth.register.continueWithLinkedIn || 'Continue with LinkedIn'}
            </button>

            <button
              type="button"
              onClick={() => toast({ title: 'Coming soon', description: 'Google sign-in will be available soon', variant: 'info' })}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-white/5 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t.auth.register.continueWithGoogle || 'Continue with Google'}
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#0c1222] text-white/50">{t.auth.register.orRegisterWith || 'or register with email'}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">{t.auth.register.name || 'Name'}</label>
            <NameFields
              values={nameFields}
              onChange={setNameFields}
              errors={{ firstName: errors.firstName, lastName: errors.lastName }}
              disabled={isLoading}
              compact
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">{t.auth.register.email}</label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none"><Mail24Regular className="w-5 h-5 text-white/50" /></div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.auth.register.emailPlaceholder} disabled={isLoading}
                className={`${inputBase} ${errors.email ? 'border-red-500' : 'border-white/10'}`} />
            </div>
            {errors.email && <p className="mt-2 text-sm text-red-400">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">{t.auth.register.password}</label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none"><LockClosed24Regular className="w-5 h-5 text-white/50" /></div>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.auth.register.passwordPlaceholder} disabled={isLoading}
                className={`${inputBase} !pe-12 ${errors.password ? 'border-red-500' : 'border-white/10'}`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 end-0 pe-4 flex items-center text-white/50 hover:text-white transition-colors">
                {showPassword ? <EyeOff20Regular className="w-5 h-5" /> : <Eye20Regular className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-2 text-sm text-red-400">{errors.password}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { check: passwordChecks.length, label: t.auth.register.passwordRequirements.length },
                { check: passwordChecks.uppercase, label: t.auth.register.passwordRequirements.uppercase },
                { check: passwordChecks.lowercase, label: t.auth.register.passwordRequirements.lowercase },
                { check: passwordChecks.number, label: t.auth.register.passwordRequirements.number },
              ].map((item) => (
                <div key={item.label} className={`flex items-center gap-2 text-xs ${item.check ? 'text-[#00d084]' : 'text-white/50'}`}>
                  <Checkmark20Regular className={`w-4 h-4 ${item.check ? 'opacity-100' : 'opacity-30'}`} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">{t.auth.register.confirmPassword}</label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none"><LockClosed24Regular className="w-5 h-5 text-white/50" /></div>
              <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.auth.register.confirmPasswordPlaceholder} disabled={isLoading}
                className={`${inputBase} ${errors.confirmPassword ? 'border-red-500' : 'border-white/10'}`} />
            </div>
            {errors.confirmPassword && <p className="mt-2 text-sm text-red-400">{errors.confirmPassword}</p>}
          </div>

          {/* Referral Code */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Referral Code (optional)</label>
            <div className="relative">
              <Tag24Regular className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#56657a]" />
              <input
                type="text"
                value={referralCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setReferralCode(val);
                  setReferralValid(null);
                  setReferralDiscount(null);
                }}
                onBlur={() => {
                  if (referralCode.trim()) {
                    validateAffiliateCode(referralCode).then((res) => {
                      setReferralValid(res?.valid || false);
                      setReferralDiscount(res?.discountPercent || null);
                    }).catch(() => setReferralValid(false));
                  }
                }}
                placeholder="Enter referral code"
                disabled={isLoading}
                className={`${inputBase} ${referralValid === true ? 'border-green-500' : referralValid === false ? 'border-red-500' : 'border-white/10'}`}
              />
            </div>
            {referralValid === true && referralDiscount && (
              <p className="mt-2 text-sm text-green-400">Valid code! You&apos;ll get {referralDiscount}% discount on your first purchase.</p>
            )}
            {referralValid === false && referralCode && (
              <p className="mt-2 text-sm text-red-400">Invalid referral code</p>
            )}
          </div>

          <button type="submit" disabled={isLoading} className="btn-accent w-full py-3.5 text-base disabled:opacity-50 mt-6 flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-[#060b18] border-t-transparent rounded-full animate-spin" />
                {t.auth.register.submitting}
              </>
            ) : email && password ? (
              <>
                {t.auth.register.continue || 'Continue'}
                <ArrowRight20Regular className="w-5 h-5" />
              </>
            ) : t.auth.register.submit}
          </button>

          <p className="text-center text-white/70 mt-6">
            {t.auth.register.hasAccount}{' '}
            <Link href={returnTo ? `/login?redirect=${encodeURIComponent(returnTo)}` : '/login'} className="text-[#00d084] hover:text-[#00e896] font-medium transition-colors">{t.auth.register.signIn}</Link>
          </p>

          <p className="text-center text-xs text-white/50 mt-4">
            {t.auth.register.terms}{' '}
            <Link href="/terms" className="text-[#00d084] hover:underline">{t.auth.register.termsLink}</Link>{' '}
            {t.auth.register.and}{' '}
            <Link href="/privacy" className="text-[#00d084] hover:underline">{t.auth.register.privacyLink}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
