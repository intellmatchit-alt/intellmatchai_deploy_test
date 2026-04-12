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
    "w-full ps-12 pe-4 py-3 bg-white/[0.03] border rounded-xl text-white placeholder-[#56657a] focus:outline-none focus:ring-2 focus:ring-[#00d084]/30 focus:border-[#00d084]/50 transition-all";

  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-[radial-gradient(ellipse,rgba(0,208,132,0.08)_0%,transparent_70%)] rounded-3xl" />
      <div className="relative bg-[#0c1222]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {t.auth.login.title}
          </h1>
          <p className="text-white/70">{t.auth.login.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                className={`${inputBase} ${errors.email ? "border-red-500" : "border-white/10"}`}
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
                className={`${inputBase} !pe-12 ${errors.password ? "border-red-500" : "border-white/10"}`}
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
              className="text-sm text-[#00d084] hover:text-[#00e896] transition-colors"
            >
              {t.auth.login.forgotPassword}
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-accent w-full py-3.5 text-base disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#060b18] border-t-transparent rounded-full animate-spin" />
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
