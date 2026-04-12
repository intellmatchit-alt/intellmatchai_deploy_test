'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/hooks/useOrganization';
import { organizationApi } from '@/lib/api/organization';
import {
  ArrowLeft24Regular,
  Shield24Regular,
  Eye24Regular,
  EyeOff24Regular,
  Share24Regular,
} from '@fluentui/react-icons';

const SHARE_MODES = [
  { value: 'ALL', icon: Share24Regular, color: 'from-green-500/20 to-emerald-500/20 border-green-500/30' },
  { value: 'MANUAL', icon: Eye24Regular, color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30' },
  { value: 'NONE', icon: EyeOff24Regular, color: 'from-red-500/20 to-orange-500/20 border-red-500/30' },
];

export default function PrivacySettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { organization } = useOrganization();

  const [shareMode, setShareMode] = useState('MANUAL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organization) return;
    organizationApi.getPrivacySettings(organization.id).then((pref) => {
      setShareMode(pref.shareMode);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [organization]);

  const handleChange = async (mode: string) => {
    if (!organization) return;
    setShareMode(mode);
    setSaving(true);
    try {
      await organizationApi.updatePrivacySettings(organization.id, mode);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'ALL': return t.organization?.shareAll || 'Share All Contacts';
      case 'MANUAL': return t.organization?.shareManual || 'Manual Sharing Only';
      case 'NONE': return t.organization?.shareNone || 'Don\'t Share Any';
      default: return mode;
    }
  };

  const getModeDesc = (mode: string) => {
    switch (mode) {
      case 'ALL': return t.organization?.shareAllDesc || 'All your contacts are automatically visible to team members';
      case 'MANUAL': return t.organization?.shareManualDesc || 'You choose which contacts to share with your team';
      case 'NONE': return t.organization?.shareNoneDesc || 'None of your contacts will be visible to team members';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.organization?.privacySharing || 'Privacy & Sharing'}</h1>
      </div>

      <div className="bg-th-surface border border-th-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Shield24Regular className="w-6 h-6 text-emerald-400" />
          <div>
            <h2 className="font-semibold text-th-text">{t.organization?.contactSharing || 'Contact Sharing Mode'}</h2>
            <p className="text-sm text-th-text-m">{t.organization?.contactSharingDesc || 'Choose how your contacts are shared within the team'}</p>
          </div>
        </div>

        <div className="space-y-3">
          {SHARE_MODES.map(({ value, icon: Icon, color }) => (
            <button
              key={value}
              onClick={() => handleChange(value)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                shareMode === value
                  ? `bg-gradient-to-r ${color}`
                  : 'border-th-border hover:border-white/20 bg-th-surface'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${shareMode === value ? 'text-th-text' : 'text-th-text-t'}`} />
                <div>
                  <p className={`font-medium ${shareMode === value ? 'text-th-text' : 'text-th-text-s'}`}>{getModeLabel(value)}</p>
                  <p className={`text-sm ${shareMode === value ? 'text-th-text-s' : 'text-th-text-m'}`}>{getModeDesc(value)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {saving && (
          <p className="text-xs text-emerald-400 mt-3 animate-pulse">{t.common?.saving || 'Saving...'}</p>
        )}
      </div>

      {/* Visibility Preview */}
      <div className="bg-th-surface border border-th-border rounded-xl p-5">
        <h3 className="font-semibold text-th-text mb-3">{t.organization?.whatTeamSees || 'What Your Team Sees'}</h3>
        <div className="space-y-2">
          {shareMode === 'NONE' ? (
            <div className="flex items-center gap-2 text-th-text-m">
              <EyeOff24Regular className="w-4 h-4" />
              <span className="text-sm">{t.organization?.nothingShared || 'Your contacts are completely private'}</span>
            </div>
          ) : shareMode === 'ALL' ? (
            <div className="flex items-center gap-2 text-green-400">
              <Eye24Regular className="w-4 h-4" />
              <span className="text-sm">{t.organization?.allShared || 'All contacts visible with full details'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-blue-400">
              <Share24Regular className="w-4 h-4" />
              <span className="text-sm">{t.organization?.manualShared || 'Only contacts you explicitly share are visible'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
