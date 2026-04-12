/**
 * Settings Page
 *
 * App settings and preferences.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Settings24Regular,
  Shield24Regular,
  Alert24Regular,
  Color24Regular,
  Translate24Regular,
  ChevronRight24Regular,
  ToggleLeft24Regular,
  ToggleRight24Filled,
  Money24Regular,
  Building24Regular,
  WeatherSunny24Regular,
  WeatherMoon24Regular,
  PeopleAudience24Regular,
} from '@fluentui/react-icons';
import { useOrganization } from '@/hooks/useOrganization';
import { useAffiliateStore } from '@/stores/affiliateStore';

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const { isTeamPlan, organization } = useOrganization();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? theme === 'dark' : true;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.profile?.settings || 'Settings'}</h1>
      </div>

      {/* Settings Groups */}
      <div className="space-y-4">
        {/* General Settings */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-th-border">
            <h2 className="text-sm font-medium text-th-text-t">{t.settings?.general || 'General'}</h2>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-th-surface-h flex items-center justify-center">
                <Alert24Regular className="w-5 h-5 text-th-text-s" />
              </div>
              <div>
                <p className="font-medium text-th-text">{t.settings?.notifications || 'Notifications'}</p>
                <p className="text-sm text-th-text-m">{t.settings?.notificationsDesc || 'Push notifications'}</p>
              </div>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className="text-emerald-400"
            >
              {notifications ? (
                <ToggleRight24Filled className="w-8 h-8" />
              ) : (
                <ToggleLeft24Regular className="w-8 h-8 text-th-text-m" />
              )}
            </button>
          </div>

          <div className="h-px bg-th-border-s" />

          {/* Appearance / Theme */}
          <div className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-th-surface-h flex items-center justify-center">
                {isDark ? (
                  <WeatherMoon24Regular className="w-5 h-5 text-th-text-s" />
                ) : (
                  <WeatherSunny24Regular className="w-5 h-5 text-th-text-s" />
                )}
              </div>
              <div>
                <p className="font-medium text-th-text">{isDark ? (t.settings?.darkMode || 'Dark Mode') : (t.settings?.lightMode || 'Light Mode')}</p>
                <p className="text-sm text-th-text-m">{isDark ? (t.settings?.darkModeDesc || 'Use dark theme') : (t.settings?.lightModeDesc || 'Use light theme')}</p>
              </div>
            </div>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="text-emerald-400"
            >
              {isDark ? (
                <ToggleRight24Filled className="w-8 h-8" />
              ) : (
                <ToggleLeft24Regular className="w-8 h-8 text-th-text-m" />
              )}
            </button>
          </div>

          <div className="h-px bg-th-border-s" />

          {/* Language */}
          <div className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-th-surface-h flex items-center justify-center">
                <Translate24Regular className="w-5 h-5 text-th-text-s" />
              </div>
              <div>
                <p className="font-medium text-th-text">{t.settings?.language || 'Language'}</p>
                <p className="text-sm text-th-text-m">{lang === 'ar' ? 'العربية' : 'English'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1.5 rounded-lg text-sm ${lang === 'en' ? 'bg-emerald-500 text-white' : 'bg-th-surface-h text-th-text-t'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('ar')}
                className={`px-3 py-1.5 rounded-lg text-sm ${lang === 'ar' ? 'bg-emerald-500 text-white' : 'bg-th-surface-h text-th-text-t'}`}
              >
                AR
              </button>
            </div>
          </div>
        </div>

        {/* Organization (TEAM plan only) */}
        {isTeamPlan && (
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-th-border">
              <h2 className="text-sm font-medium text-th-text-t">{t.organization?.title || 'Organization'}</h2>
            </div>

            <Link href="/settings/organization" className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 flex items-center justify-center">
                  <Building24Regular className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-th-text">{organization?.name || (t.organization?.title || 'Organization')}</p>
                  <p className="text-sm text-th-text-m">{t.organization?.manageTeam || 'Manage your team and settings'}</p>
                </div>
              </div>
              <ChevronRight24Regular className="w-5 h-5 text-th-text-m" />
            </Link>
          </div>
        )}

        {/* Subscription & Billing */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-th-border">
            <h2 className="text-sm font-medium text-th-text-t">{t.settings?.billing || 'Subscription & Billing'}</h2>
          </div>

          <Link href="/settings/billing" className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 flex items-center justify-center">
                <Money24Regular className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-th-text">{t.settings?.subscription || 'Subscription'}</p>
                <p className="text-sm text-th-text-m">{t.settings?.subscriptionDesc || 'Manage your plan and billing'}</p>
              </div>
            </div>
            <ChevronRight24Regular className="w-5 h-5 text-th-text-m" />
          </Link>
        </div>

        {/* Privacy & Security */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-th-border">
            <h2 className="text-sm font-medium text-th-text-t">{t.settings?.privacySecurity || 'Privacy & Security'}</h2>
          </div>

          <Link href="/settings/privacy" className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-th-surface-h flex items-center justify-center">
                <Shield24Regular className="w-5 h-5 text-th-text-s" />
              </div>
              <div>
                <p className="font-medium text-th-text">{t.profile?.privacySecurity || 'Privacy & Security'}</p>
                <p className="text-sm text-th-text-m">{t.profile?.manageData || 'Manage your data'}</p>
              </div>
            </div>
            <ChevronRight24Regular className="w-5 h-5 text-th-text-m" />
          </Link>
        </div>

        {/* Affiliate Program */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
          <Link href={useAffiliateStore.getState().isAffiliate ? '/affiliate' : '/affiliate/apply'} className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-th-surface-h flex items-center justify-center">
                <PeopleAudience24Regular className="w-5 h-5 text-th-text-s" />
              </div>
              <div>
                <p className="font-medium text-th-text">{(t as any).affiliate?.title || 'Affiliate Program'}</p>
                <p className="text-sm text-th-text-m">
                  {useAffiliateStore.getState().isAffiliate ? 'Manage your affiliate dashboard' : 'Join and earn commissions'}
                </p>
              </div>
            </div>
            <ChevronRight24Regular className="w-5 h-5 text-th-text-m" />
          </Link>
        </div>

        {/* About */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
          <Link href="/about" className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-th-surface-h flex items-center justify-center">
                <Settings24Regular className="w-5 h-5 text-th-text-s" />
              </div>
              <div>
                <p className="font-medium text-th-text">{t.profile?.about || 'About'}</p>
                <p className="text-sm text-th-text-m">{t.profile?.appInfo || 'App information'}</p>
              </div>
            </div>
            <ChevronRight24Regular className="w-5 h-5 text-th-text-m" />
          </Link>
        </div>
      </div>
    </div>
  );
}
