/**
 * Privacy Settings Page
 *
 * Manage privacy and data settings.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/Toast';
import { api } from '@/lib/api/client';
import {
  ArrowLeft24Regular,
  Shield24Regular,
  Eye24Regular,
  Database24Regular,
  Delete24Regular,
  ToggleLeft24Regular,
  ToggleRight24Filled,
  Save24Regular,
} from '@fluentui/react-icons';

export default function PrivacySettingsPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [consent, setConsent] = useState({
    enrichment: true,
    contacts: true,
    analytics: true,
  });

  // Fetch consent settings
  useEffect(() => {
    const fetchConsent = async () => {
      try {
        setIsLoading(true);
        const profile = await api.get<any>('/profile');
        if (profile.consent) {
          setConsent(profile.consent);
        }
      } catch (error) {
        console.error('Failed to fetch consent:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConsent();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/profile/consent', consent);
      toast({
        title: t.settings?.saved || 'Settings Saved',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: t.common?.error || 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm(t.settings?.confirmDelete || 'Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete('/profile');
      toast({
        title: t.settings?.accountDeleted || 'Account Deleted',
        variant: 'success',
      });
      localStorage.clear();
      router.push('/login');
    } catch (error: any) {
      toast({
        title: t.common?.error || 'Error',
        description: error.message || 'Failed to delete account',
        variant: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.profile?.privacySecurity || 'Privacy & Security'}</h1>
      </div>

      {/* Data Consent */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-th-border flex items-center gap-2">
          <Shield24Regular className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-medium text-th-text-s">{t.settings?.dataConsent || 'Data Consent'}</h2>
        </div>

        {/* AI Enrichment */}
        <div className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Eye24Regular className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-th-text">{t.settings?.aiEnrichment || 'AI Enrichment'}</p>
              <p className="text-sm text-th-text-m">{t.settings?.aiEnrichmentDesc || 'Allow AI to enrich contact profiles'}</p>
            </div>
          </div>
          <button
            onClick={() => setConsent(prev => ({ ...prev, enrichment: !prev.enrichment }))}
            className="text-emerald-400"
          >
            {consent.enrichment ? (
              <ToggleRight24Filled className="w-8 h-8" />
            ) : (
              <ToggleLeft24Regular className="w-8 h-8 text-th-text-m" />
            )}
          </button>
        </div>

        <div className="h-px bg-th-surface" />

        {/* Contact Data */}
        <div className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Database24Regular className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-th-text">{t.settings?.contactData || 'Contact Data'}</p>
              <p className="text-sm text-th-text-m">{t.settings?.contactDataDesc || 'Allow contact data usage for matching'}</p>
            </div>
          </div>
          <button
            onClick={() => setConsent(prev => ({ ...prev, contacts: !prev.contacts }))}
            className="text-emerald-400"
          >
            {consent.contacts ? (
              <ToggleRight24Filled className="w-8 h-8" />
            ) : (
              <ToggleLeft24Regular className="w-8 h-8 text-th-text-m" />
            )}
          </button>
        </div>

        <div className="h-px bg-th-surface" />

        {/* Analytics */}
        <div className="flex items-center justify-between p-4 hover:bg-th-surface transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Eye24Regular className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-th-text">{t.settings?.analytics || 'Analytics'}</p>
              <p className="text-sm text-th-text-m">{t.settings?.analyticsDesc || 'Help improve the app with usage data'}</p>
            </div>
          </div>
          <button
            onClick={() => setConsent(prev => ({ ...prev, analytics: !prev.analytics }))}
            className="text-emerald-400"
          >
            {consent.analytics ? (
              <ToggleRight24Filled className="w-8 h-8" />
            ) : (
              <ToggleLeft24Regular className="w-8 h-8 text-th-text-m" />
            )}
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {t.common?.saving || 'Saving...'}
          </>
        ) : (
          <>
            <Save24Regular className="w-5 h-5" />
            {t.settings?.saveSettings || 'Save Settings'}
          </>
        )}
      </button>

      {/* Danger Zone */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-red-500/20">
          <h2 className="text-sm font-medium text-red-400">{t.settings?.dangerZone || 'Danger Zone'}</h2>
        </div>

        <div className="p-4">
          <p className="text-sm text-th-text-t mb-4">
            {t.settings?.deleteWarning || 'Deleting your account will permanently remove all your data including contacts, projects, and settings.'}
          </p>
          <button
            onClick={handleDeleteAccount}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            <Delete24Regular className="w-5 h-5" />
            {t.settings?.deleteAccount || 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
