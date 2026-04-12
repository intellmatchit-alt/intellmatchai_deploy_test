/**
 * Collaboration Settings Page
 *
 * Manage collaboration preferences and permissions.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Settings24Regular,
  Shield24Regular,
  Checkmark24Regular,
  ToggleLeft24Regular,
  ToggleRight24Filled,
  PersonProhibited24Regular,
  Target24Regular,
} from '@fluentui/react-icons';
import {
  getCollaborationSettings,
  updateCollaborationSettings,
  CollaborationSettings,
  CollaborationSourceType,
  SOURCE_TYPE_OPTIONS,
} from '@/lib/api/collaboration';
import { toast } from '@/components/ui/Toast';

export default function CollaborationSettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [settings, setSettings] = useState<CollaborationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Translated source type labels
  const getSourceTypeLabel = (type: CollaborationSourceType): string => {
    const labels: Record<CollaborationSourceType, string> = {
      PROJECT: t.settings?.sourceTypeProject || 'Project',
      OPPORTUNITY: t.settings?.sourceTypeOpportunity || 'Opportunity',
      PITCH: t.settings?.sourceTypePitch || 'Pitch',
      DEAL: t.settings?.sourceTypeDeal || 'Deal',
    };
    return labels[type] || type;
  };

  // Form state
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [allowedTypes, setAllowedTypes] = useState<CollaborationSourceType[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  // Fetch settings
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await getCollaborationSettings();
      setSettings(data);
      setGlobalEnabled(data.globalCollaborationEnabled);
      setAllowedTypes(data.allowedSourceTypes || []);
      setBlockedUserIds(data.blockedUserIds || []);
    } catch (error: any) {
      // If settings don't exist, create with defaults
      if (error.code === 'NOT_FOUND') {
        setGlobalEnabled(true);
        setAllowedTypes(['PROJECT', 'OPPORTUNITY', 'PITCH', 'DEAL']);
        setBlockedUserIds([]);
      } else {
        toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateCollaborationSettings({
        globalCollaborationEnabled: globalEnabled,
        allowedSourceTypes: allowedTypes,
        blockedUserIds,
      });
      setSettings(updated);
      toast({ title: t.settings?.saved || 'Settings saved', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSourceType = (type: CollaborationSourceType) => {
    setAllowedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleAllTypes = () => {
    if (allowedTypes.length === SOURCE_TYPE_OPTIONS.length) {
      setAllowedTypes([]);
    } else {
      setAllowedTypes(SOURCE_TYPE_OPTIONS.map((o) => o.id));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in pb-20 max-w-2xl mx-auto">
        <div className="h-8 bg-th-surface-h rounded w-1/4 animate-pulse" />
        <div className="bg-th-surface border border-th-border rounded-xl p-6 space-y-4">
          <div className="h-6 bg-th-surface-h rounded w-1/2 animate-pulse" />
          <div className="h-4 bg-th-surface-h rounded w-3/4 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
        >
          <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.settings?.collaborationSettings || 'Collaboration Settings'}</h1>
      </div>

      <div className="space-y-6">
        {/* Global Toggle */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Shield24Regular className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-th-text">
                  {t.settings?.allowCollaborationRequests || 'Allow Collaboration Requests'}
                </h3>
                <p className="text-sm text-th-text-t mt-1">
                  {t.settings?.allowCollaborationDesc || 'When enabled, other users can send you collaboration requests to find matches in your network.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setGlobalEnabled(!globalEnabled)}
              className="flex-shrink-0 ml-4"
            >
              {globalEnabled ? (
                <ToggleRight24Filled className="w-10 h-10 text-emerald-500" />
              ) : (
                <ToggleLeft24Regular className="w-10 h-10 text-th-text-m" />
              )}
            </button>
          </div>
        </div>

        {/* Source Types */}
        <div className={`bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6 transition-opacity ${!globalEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target24Regular className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-th-text">
                {t.settings?.allowedSourceTypes || 'Allowed Collaboration Types'}
              </h3>
            </div>
            <button
              onClick={toggleAllTypes}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {allowedTypes.length === SOURCE_TYPE_OPTIONS.length
                ? (t.settings?.deselectAll || 'Deselect All')
                : (t.settings?.selectAll || 'Select All')}
            </button>
          </div>
          <p className="text-sm text-th-text-t mb-4">
            {t.settings?.allowedSourceTypesDesc || 'Choose which types of collaboration requests you want to receive.'}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SOURCE_TYPE_OPTIONS.map((option) => {
              const isSelected = allowedTypes.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => toggleSourceType(option.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-300'
                      : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-neutral-500'
                  }`}>
                    {isSelected && <Checkmark24Regular className="w-3 h-3 text-th-text" />}
                  </div>
                  <span className="text-sm font-medium">{getSourceTypeLabel(option.id)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Blocked Users */}
        <div className={`bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6 transition-opacity ${!globalEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <PersonProhibited24Regular className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-th-text">
              {t.settings?.blockedUsers || 'Blocked Users'}
            </h3>
          </div>
          <p className="text-sm text-th-text-t mb-4">
            {t.settings?.blockedUsersDesc || 'Users in this list cannot send you collaboration requests.'}
          </p>

          {blockedUserIds.length > 0 ? (
            <div className="space-y-2">
              {blockedUserIds.map((userId) => (
                <div key={userId} className="flex items-center justify-between p-3 bg-th-surface rounded-lg">
                  <span className="text-sm text-th-text-s">{userId}</span>
                  <button
                    onClick={() => setBlockedUserIds((prev) => prev.filter((id) => id !== userId))}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    {t.common?.remove || 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-th-text-m text-sm">
              {t.settings?.noBlockedUsers || 'No blocked users'}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-12 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 text-center"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.common?.saving || 'Saving...'}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                {t.settings?.saveSettings || 'Save Settings'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
