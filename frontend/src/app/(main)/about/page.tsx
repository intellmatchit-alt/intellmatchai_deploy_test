/**
 * About Page
 *
 * App information and credits.
 */

'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Info24Regular,
  Document24Regular,
  Shield24Regular,
  Mail24Regular,
  Heart24Regular,
  Sparkle24Regular,
} from '@fluentui/react-icons';

export default function AboutPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.profile?.about || 'About'}</h1>
      </div>

      {/* App Logo & Info */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-8 text-center">
        <div className="relative inline-block mb-4">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-lg opacity-50" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Sparkle24Regular className="w-10 h-10 text-th-text" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-th-text mb-1">IntellMatch</h2>
        <p className="text-th-text-t mb-4">AI-Powered Professional Networking</p>
        <p className="text-sm text-th-text-m">{t.profile?.version || 'Version 1.0.0'}</p>
      </div>

      {/* Description */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info24Regular className="w-5 h-5 text-emerald-400" />
          <h3 className="font-medium text-th-text">{t.about?.description || 'About IntellMatch'}</h3>
        </div>
        <p className="text-th-text-t text-sm leading-relaxed">
          {t.about?.descriptionText || 'IntellMatch is a revolutionary professional networking platform that uses AI to help you build meaningful business relationships. Scan business cards, manage contacts, find perfect matches, and collaborate on projects - all powered by intelligent matching algorithms.'}
        </p>
      </div>

      {/* Features */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
        <h3 className="font-medium text-th-text mb-4">{t.about?.features || 'Features'}</h3>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 text-sm text-th-text-t">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            {t.about?.feature1 || 'AI-powered contact matching'}
          </li>
          <li className="flex items-center gap-3 text-sm text-th-text-t">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            {t.about?.feature2 || 'Business card scanning with OCR'}
          </li>
          <li className="flex items-center gap-3 text-sm text-th-text-t">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            {t.about?.feature3 || 'Project collaboration matching'}
          </li>
          <li className="flex items-center gap-3 text-sm text-th-text-t">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            {t.about?.feature4 || 'Network visualization'}
          </li>
          <li className="flex items-center gap-3 text-sm text-th-text-t">
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            {t.about?.feature5 || 'Multi-language support (EN/AR)'}
          </li>
        </ul>
      </div>

      {/* Links */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
        <Link href="/terms" className="flex items-center gap-4 p-4 hover:bg-th-surface transition-colors">
          <div className="w-10 h-10 rounded-xl bg-th-surface-h flex items-center justify-center">
            <Document24Regular className="w-5 h-5 text-th-text-s" />
          </div>
          <span className="text-th-text">{t.about?.termsOfService || 'Terms of Service'}</span>
        </Link>
        <div className="h-px bg-th-surface" />
        <Link href="/privacy" className="flex items-center gap-4 p-4 hover:bg-th-surface transition-colors">
          <div className="w-10 h-10 rounded-xl bg-th-surface-h flex items-center justify-center">
            <Shield24Regular className="w-5 h-5 text-th-text-s" />
          </div>
          <span className="text-th-text">{t.about?.privacyPolicy || 'Privacy Policy'}</span>
        </Link>
        <div className="h-px bg-th-surface" />
        <a href="mailto:support@intellmatch.com" className="flex items-center gap-4 p-4 hover:bg-th-surface transition-colors">
          <div className="w-10 h-10 rounded-xl bg-th-surface-h flex items-center justify-center">
            <Mail24Regular className="w-5 h-5 text-th-text-s" />
          </div>
          <span className="text-th-text">{t.about?.contactUs || 'Contact Support'}</span>
        </a>
      </div>

      {/* Credits */}
      <div className="text-center py-4">
        <p className="text-sm text-th-text-m flex items-center justify-center gap-1">
          {t.about?.madeWith || 'Made with'}
          <Heart24Regular className="w-4 h-4 text-red-500" />
          {t.about?.inSaudi || 'in Saudi Arabia'}
        </p>
        <p className="text-xs text-white/70 mt-2">
          &copy; 2026 IntellMatch. Made within Saudi Arabia.
        </p>
      </div>
    </div>
  );
}
