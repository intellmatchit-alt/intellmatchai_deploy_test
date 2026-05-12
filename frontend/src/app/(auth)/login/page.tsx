/**
 * Login Page with i18n
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n";
import {
  Eye20Regular,
  EyeOff20Regular,
  Mail24Regular,
  LockClosed24Regular,
} from "@fluentui/react-icons";

// LinkedIn icon component
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [redirectPath, setRedirectPath] = useState("/dashboard");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      if (redirect) setRedirectPath(redirect);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) router.push(redirectPath);
  }, [authLoading, isAuthenticated, router, redirectPath]);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email))
      newErrors.email = "Invalid email address";
    if (!password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await login({ email, password });
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
        variant: "success",
      });
      router.push(redirectPath);
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const inputBase =
    "w-full ps-12 pe-4 py-3 bg-white/[0.05] border rounded-xl text-white placeholder-[#56657a] focus:outline-none focus:bg-white/[0.07] focus:ring-2 focus:ring-[#00d084]/30 focus:border-[#00d084]/60 transition-all duration-200";

  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-[radial-gradient(ellipse,rgba(0,208,132,0.08)_0%,transparent_70%)] rounded-3xl" />
      <div className="relative bg-[#131b2e]/85 backdrop-blur-xl border border-white/[0.10] rounded-2xl p-8 shadow-2xl ring-1 ring-[#00d084]/[0.06]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {t.auth.login.title}
          </h1>
          <p className="text-white/70">{t.auth.login.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Social Login Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID;
                if (!clientId) {
                  toast({ title: 'LinkedIn sign-in unavailable', description: 'LinkedIn OAuth is not configured', variant: 'error' });
                  return;
                }
                const redirectUri = `${window.location.origin}/auth/linkedin/callback`;
                const scope = 'openid profile email';
                const state = Math.random().toString(36).substring(7);
                sessionStorage.setItem('linkedin_oauth_state', state);
                if (redirectPath && redirectPath !== '/dashboard') {
                  sessionStorage.setItem('linkedin_oauth_returnTo', redirectPath);
                }
                const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;
                window.location.href = linkedInAuthUrl;
              }}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#0A66C2] hover:bg-[#004182] text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 shadow-[0_4px_14px_rgba(10,102,194,0.20)] hover:shadow-[0_8px_22px_rgba(10,102,194,0.40)] hover:-translate-y-0.5"
            >
              <LinkedInIcon className="w-5 h-5" />
              {t.auth.login.continueWithLinkedIn || 'Continue with LinkedIn'}
            </button>

            <button
              type="button"
              onClick={() => {
                const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
                if (!clientId) {
                  toast({ title: 'Google sign-in unavailable', description: 'Google OAuth is not configured', variant: 'error' });
                  return;
                }
                const redirectUri = `${window.location.origin}/auth/google/callback`;
                const scope = 'openid email profile';
                const state = Math.random().toString(36).substring(7);
                sessionStorage.setItem('google_oauth_state', state);
                if (redirectPath && redirectPath !== '/dashboard') {
                  sessionStorage.setItem('google_oauth_returnTo', redirectPath);
                }
                const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}&access_type=online&prompt=select_account`;
                window.location.href = googleAuthUrl;
              }}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 text-[#3c4043] font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:shadow-[0_8px_22px_rgba(0,0,0,0.25)] hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#0c1222] text-white/50">
                {t.auth.login.orContinueWith ? `${t.auth.login.orContinueWith} email` : 'or continue with email'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t.auth.login.email}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
                <Mail24Regular className="w-5 h-5 text-white/50" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.login.emailPlaceholder}
                disabled={isLoading}
                className={`${inputBase} ${errors.email ? "border-red-500" : "border-white/[0.08]"}`}
              />
            </div>
            {errors.email && (
              <p className="mt-2 text-sm text-red-400">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t.auth.login.password}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
                <LockClosed24Regular className="w-5 h-5 text-white/50" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth.login.passwordPlaceholder}
                disabled={isLoading}
                className={`${inputBase} !pe-12 ${errors.password ? "border-red-500" : "border-white/[0.08]"}`}
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
            {errors.password && (
              <p className="mt-2 text-sm text-red-400">{errors.password}</p>
            )}
          </div>

          <div className="text-end">
            <Link
              href="/forgot-password"
              className="text-sm text-[#00d084] hover:text-[#00e896] hover:underline underline-offset-4 transition-all duration-200"
            >
              {t.auth.login.forgotPassword}
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-5 flex items-center justify-center gap-2 rounded-xl font-semibold text-base text-[#051a12] bg-gradient-to-br from-[#00e896] via-[#00d084] to-[#00b870] shadow-[0_8px_24px_rgba(0,208,132,0.28),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_14px_36px_rgba(0,208,132,0.42),inset_0_1px_0_rgba(255,255,255,0.30)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#051a12] border-t-transparent rounded-full animate-spin" />
                {t.auth.login.submitting}
              </span>
            ) : (
              t.auth.login.submit
            )}
          </button>

          <p className="text-center text-white/70 mt-6">
            {t.auth.login.noAccount}{" "}
            <Link
              href="/register"
              className="text-[#00d084] hover:text-[#00e896] font-medium transition-colors"
            >
              {t.auth.login.createOne}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
