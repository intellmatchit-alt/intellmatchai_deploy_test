/**
 * Auth Layout with i18n
 *
 * Layout for authentication pages with dark navy theme and teal accents.
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { I18nProvider, useI18n } from '@/lib/i18n';

// Background decoration
const AuthBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    />
    {/* Teal glow top-right — slow drift */}
    <div className="auth-orb-drift-1 absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(0,208,132,0.1)_0%,transparent_70%)] will-change-transform" />
    {/* Blue glow bottom-left — slow drift */}
    <div className="auth-orb-drift-2 absolute -bottom-48 -left-48 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(56,97,251,0.06)_0%,transparent_70%)] will-change-transform" />
  </div>
);

// Language Switcher for Auth — pill-style segmented toggle
const AuthLanguageSwitcher = () => {
  const { lang, setLang } = useI18n();
  const baseBtn = "px-3.5 py-1 rounded-full text-xs font-semibold tracking-wide transition-all duration-200";
  const active = "bg-[#00d084]/15 text-[#00d084] shadow-[inset_0_0_0_1px_rgba(0,208,132,0.35)]";
  const inactive = "text-white/55 hover:text-white/85";
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.06] backdrop-blur-md" role="group" aria-label="Language">
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        className={`${baseBtn} ${lang === 'en' ? active : inactive}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang('ar')}
        aria-pressed={lang === 'ar'}
        className={`${baseBtn} ${lang === 'ar' ? active : inactive}`}
      >
        AR
      </button>
    </div>
  );
};

function AuthLayoutContent({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-[#060b18] text-white overflow-hidden relative" dir={dir}>
      <style jsx global>{`
        @keyframes slide-up-auth {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up-custom { animation: slide-up-auth 0.6s ease-out; }

        @keyframes auth-orb-drift-1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(40px, -32px); }
        }
        @keyframes auth-orb-drift-2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-32px, 40px); }
        }
        .auth-orb-drift-1 { animation: auth-orb-drift-1 28s ease-in-out infinite; }
        .auth-orb-drift-2 { animation: auth-orb-drift-2 34s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .auth-orb-drift-1, .auth-orb-drift-2 { animation: none; }
        }
      `}</style>

      <AuthBackground />

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))' }}>
        <Link href="/" className="inline-flex items-center group">
          <img src="/intelllogo.png" alt="IntellMatch" className="h-11 w-auto" />
        </Link>
        <AuthLanguageSwitcher />
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-slide-up-custom">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-6 text-center text-sm text-white/50">
        <p>&copy; 2026 IntellMatch. Made within Saudi Arabia.</p>
      </footer>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthLayoutContent>{children}</AuthLayoutContent>
    </I18nProvider>
  );
}
