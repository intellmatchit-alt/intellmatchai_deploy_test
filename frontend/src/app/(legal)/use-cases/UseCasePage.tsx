/**
 * Shared Use Case Page Component
 * Matches the theme of privacy/terms pages
 */

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ArrowLeft24Regular, ArrowRight24Regular, Translate24Regular } from '@fluentui/react-icons';
import { I18nProvider, useI18n, languages, type LanguageCode } from '@/lib/i18n';

// Animated gradient orbs component
const GradientOrbs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
  </div>
);

// Floating particles
const FloatingParticles = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <div
        key={i}
        className="absolute w-2 h-2 bg-th-surface-h rounded-full animate-float"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${3 + Math.random() * 4}s`,
        }}
      />
    ))}
  </div>
);

// Language Switcher Component
const LanguageSwitcher = () => {
  const { lang, setLang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const current = languages[lang];

  const handleLanguageChange = (langCode: LanguageCode) => {
    setLang(langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative z-[100]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-th-text-s hover:text-th-text hover:bg-th-surface-h transition-colors cursor-pointer"
      >
        <Translate24Regular className="w-5 h-5" />
        <span className="hidden sm:inline">{current.flag} {current.name}</span>
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[150]"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-44 bg-th-bg-s border border-white/20 rounded-lg shadow-2xl z-[200] overflow-hidden">
            {Object.values(languages).map((language) => (
              <button
                type="button"
                key={language.code}
                onClick={() => handleLanguageChange(language.code as LanguageCode)}
                className={`w-full px-4 py-3 text-start flex items-center gap-3 hover:bg-th-surface-h transition-colors cursor-pointer ${lang === language.code ? 'bg-emerald-500/20 text-white' : 'text-th-text-s'}`}
              >
                <span className="text-xl">{language.flag}</span>
                <span className="font-medium">{language.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface UseCaseContentProps {
  useCaseKey: 'lookingForJob' | 'hiring' | 'haveProject' | 'entrepreneur' | 'buySell' | 'collaborate';
  icon: React.ReactNode;
  gradient: string;
}

function UseCaseContent({ useCaseKey, icon, gradient }: UseCaseContentProps) {
  const { t, dir } = useI18n();
  const [isScrolled, setIsScrolled] = useState(false);

  const useCaseData = t.useCases?.items?.[useCaseKey];

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!useCaseData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-th-bg text-th-text overflow-hidden" dir={dir}>
      {/* Custom styles */}
      <style jsx global>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -30px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(30px, 10px) scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
        .animate-blob { animation: blob 8s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>

      <GradientOrbs />
      <FloatingParticles />

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-th-nav-header backdrop-blur-xl border-b border-th-border' : 'bg-th-bg/50 backdrop-blur-sm'}`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <img src="/intelllogo.png" alt="IntellMatch" className="h-12 w-auto" />
            </Link>

            {/* Page Title - Center */}
            <div className="hidden md:block text-center">
              <h1 className="text-xl font-semibold text-th-text">{useCaseData.pageTitle}</h1>
              <p className="text-sm text-th-text-t">{useCaseData.pageSubtitle}</p>
            </div>

            {/* Language Switcher & Auth Buttons */}
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <Link href="/login" className="hidden sm:inline-flex text-th-text-s hover:text-th-text transition-colors font-medium px-4 py-2">{t.nav.signIn}</Link>
              <Link href="/register" className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
                <span className="relative flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-all text-sm sm:text-base whitespace-nowrap">{t.nav.getStarted}</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="relative pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          {/* Mobile Title */}
          <div className="md:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-th-text">{useCaseData.pageTitle}</h1>
            <p className="text-sm text-th-text-t mt-1">{useCaseData.pageSubtitle}</p>
          </div>

          {/* Icon Badge */}
          <div className="flex justify-center mb-8">
            <div className={`w-20 h-20 ${gradient} rounded-2xl flex items-center justify-center text-th-text shadow-lg`}>
              {icon}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-8">
            {useCaseData.sections?.map((section: { title: string; content: string }, index: number) => (
              <section key={index} className="bg-th-surface backdrop-blur-sm border border-th-border rounded-2xl p-6 sm:p-8 hover:bg-th-surface-h transition-colors">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {section.title}
                </h2>
                <div className="text-th-text-s leading-relaxed whitespace-pre-line">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

          {/* CTA Button */}
          <div className="mt-12 text-center">
            <Link href="/register" className="relative group inline-flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-xl hover:shadow-emerald-500/25 transition-all group-hover:-translate-y-0.5">
                {t.useCases?.getStarted || 'Get Started Now'}
                <ArrowRight24Regular className="w-5 h-5 group-hover:translate-x-1 transition-transform rtl:rotate-180" />
              </span>
            </Link>
          </div>

          {/* Back to Home */}
          <div className="mt-12 pt-8 border-t border-th-border">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors group"
            >
              <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180 group-hover:-translate-x-1 rtl:group-hover:translate-x-1 transition-transform" />
              {t.useCases?.backToHome || 'Back to Home'}
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-th-border py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/intelllogo.png" alt="IntellMatch" className="h-10 w-auto" />
              <p className="text-sm text-th-text-m">{t.footer.tagline}</p>
            </div>
            <div className="flex items-center gap-8 text-th-text-t">
              <Link href="/privacy" className="hover:text-th-text transition-colors">{t.footer.privacy}</Link>
              <Link href="/terms" className="hover:text-th-text transition-colors">{t.footer.terms}</Link>
              <a href="mailto:contact@intellmatch.com" className="hover:text-th-text transition-colors">{t.footer.contact}</a>
            </div>
            <p className="text-th-text-m text-sm">{t.footer.copyright}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export interface UseCasePageProps {
  useCaseKey: 'lookingForJob' | 'hiring' | 'haveProject' | 'entrepreneur' | 'buySell' | 'collaborate';
  icon: React.ReactNode;
  gradient: string;
}

export default function UseCasePage({ useCaseKey, icon, gradient }: UseCasePageProps) {
  return (
    <I18nProvider>
      <UseCaseContent useCaseKey={useCaseKey} icon={icon} gradient={gradient} />
    </I18nProvider>
  );
}
