'use client';

/**
 * FAQ Page - Premium Design matching Landing Page
 *
 * A stunning, modern FAQ page with animations and translations.
 */

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft24Regular,
  ChevronDown24Regular,
  QuestionCircle24Regular,
  Mail24Regular,
  Translate24Regular,
} from '@fluentui/react-icons';
import { I18nProvider, useI18n, languages, type LanguageCode } from '@/lib/i18n';

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
          {/* Backdrop to capture outside clicks */}
          <div
            className="fixed inset-0 z-[150]"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute end-0 top-full mt-2 w-44 bg-th-bg-s border border-white/20 rounded-lg shadow-2xl z-[200] overflow-hidden">
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

// Animated gradient orbs component
const GradientOrbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
  </div>
);

// FAQ Accordion Item
const FAQItem = ({
  question,
  answer,
  isOpen,
  onClick,
  index
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
  index: number;
}) => (
  <div
    className={`group border border-th-border rounded-2xl overflow-hidden transition-all duration-300 ${
      isOpen ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/10 border-emerald-500/30' : 'bg-th-surface hover:bg-th-surface-h hover:border-white/20'
    }`}
    style={{ animationDelay: `${index * 50}ms` }}
  >
    <button
      onClick={onClick}
      className="w-full px-6 py-5 flex items-center justify-between gap-4 text-start cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
          isOpen ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-th-surface-h'
        }`}>
          <QuestionCircle24Regular className={`w-5 h-5 ${isOpen ? 'text-th-text' : 'text-th-text-t'}`} />
        </div>
        <span className={`font-semibold text-lg transition-colors ${isOpen ? 'text-th-text' : 'text-neutral-200'}`}>
          {question}
        </span>
      </div>
      <ChevronDown24Regular
        className={`w-6 h-6 text-th-text-t transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`}
      />
    </button>
    <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
      <div className="px-6 pb-5 ps-20">
        <p className="text-th-text-t leading-relaxed">{answer}</p>
      </div>
    </div>
  </div>
);

// Main FAQ Page Content
function FAQPageContent() {
  const { t, dir } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Group FAQ items into categories for better organization
  const faqCategories = [
    {
      title: dir === 'rtl' ? 'حول IntellMatch' : 'About IntellMatch',
      items: t.faq.items.slice(0, 3),
      startIndex: 0,
    },
    {
      title: dir === 'rtl' ? 'البيانات والخصوصية' : 'Data & Privacy',
      items: t.faq.items.slice(3, 7),
      startIndex: 3,
    },
    {
      title: dir === 'rtl' ? 'حالات الاستخدام' : 'Use Cases',
      items: t.faq.items.slice(7, 10),
      startIndex: 7,
    },
    {
      title: dir === 'rtl' ? 'الأسعار والاشتراك' : 'Pricing & Subscription',
      items: t.faq.items.slice(10, 15),
      startIndex: 10,
    },
  ];

  return (
    <div className="min-h-screen bg-th-bg text-th-text" dir={dir}>
      {/* Custom styles */}
      <style jsx global>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -30px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(30px, 10px) scale(1.05); }
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-blob { animation: blob 8s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animate-gradient-x { background-size: 200% 200%; animation: gradient-x 3s ease infinite; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease forwards; }
      `}</style>

      {/* Header */}
      <header className="relative border-b border-th-border">
        <GradientOrbs />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/">
                <img src="/intelllogo.png" alt="IntellMatch" className="h-12 w-auto" />
              </Link>
            </div>

            {/* Language Switcher & Back Button */}
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <Link
                href="/"
                className="flex items-center gap-2 text-th-text-s hover:text-th-text transition-colors font-medium px-4 py-2 rounded-lg hover:bg-th-surface-h"
              >
                <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
                <span className="hidden sm:inline">{dir === 'rtl' ? 'الرئيسية' : 'Home'}</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <GradientOrbs />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 mb-6">
            <QuestionCircle24Regular className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">{t.faq.badge}</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="text-th-text">{t.faq.title} </span>
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent animate-gradient-x">
              {t.faq.titleHighlight}
            </span>
          </h1>

          <p className="text-xl text-th-text-t max-w-2xl mx-auto">
            {t.faq.subtitle}
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="relative py-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="mb-12">
              <h2 className="text-2xl font-bold text-th-text mb-6 flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full" />
                {category.title}
              </h2>
              <div className="space-y-4">
                {category.items.map((item, index) => (
                  <FAQItem
                    key={category.startIndex + index}
                    question={item.question}
                    answer={item.answer}
                    isOpen={openIndex === category.startIndex + index}
                    onClick={() => handleToggle(category.startIndex + index)}
                    index={index}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 to-emerald-900/30" />
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-th-border rounded-3xl p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-th-text mb-4">
              {t.faq.cta.title}
            </h2>
            <p className="text-lg text-th-text-t mb-8 max-w-xl mx-auto">
              {t.faq.cta.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="relative group inline-flex items-center justify-center"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-xl hover:shadow-emerald-500/25 transition-all group-hover:-translate-y-0.5">
                  {t.faq.cta.button}
                </span>
              </Link>

              <a
                href="mailto:support@intellmatch.com"
                className="flex items-center justify-center gap-2 text-th-text-s hover:text-th-text px-8 py-4 rounded-xl border border-white/20 hover:border-white/40 hover:bg-th-surface transition-all font-medium"
              >
                <Mail24Regular className="w-5 h-5" />
                {t.faq.contactUs}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Still Have Questions */}
      <section className="relative py-16 border-t border-th-border">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-th-text-m mb-2">{t.faq.stillHaveQuestions}</p>
          <a
            href="mailto:support@intellmatch.com"
            className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
          >
            support@intellmatch.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-th-border py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/intelllogo.png" alt="IntellMatch" className="h-8 w-auto" />
              <p className="text-sm text-th-text-m">{t.footer.tagline}</p>
            </div>
            <div className="flex items-center gap-6 text-th-text-t text-sm">
              <Link href="/privacy" className="hover:text-th-text transition-colors">{t.footer.privacy}</Link>
              <Link href="/terms" className="hover:text-th-text transition-colors">{t.footer.terms}</Link>
              <Link href="/" className="hover:text-th-text transition-colors">{dir === 'rtl' ? 'الرئيسية' : 'Home'}</Link>
            </div>
            <p className="text-th-text-m text-sm">{t.footer.copyright}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Export with I18n Provider
export default function FAQPage() {
  return (
    <I18nProvider>
      <FAQPageContent />
    </I18nProvider>
  );
}
