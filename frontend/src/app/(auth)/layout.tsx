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
    {/* Teal glow top-right */}
    <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(0,208,132,0.1)_0%,transparent_70%)]" />
    {/* Blue glow bottom-left */}
    <div className="absolute -bottom-48 -left-48 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(56,97,251,0.06)_0%,transparent_70%)]" />
  </div>
);

// Language Switcher for Auth
const AuthLanguageSwitcher = () => {
  const { lang, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className="flex items-center gap-1 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer font-medium text-sm"
    >
      <span className={lang === 'en' ? 'text-white' : 'text-white/50'}>EN</span>
      <span className="text-white/50">/</span>
      <span className={lang === 'ar' ? 'text-white' : 'text-white/50'}>AR</span>
    </button>
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
