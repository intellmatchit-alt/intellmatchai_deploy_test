'use client';

import { useState, useEffect } from 'react';
import { getConfig, updateConfig, type SystemConfigItem } from '@/lib/api/admin';
import { toast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';
import { Save24Regular } from '@fluentui/react-icons';

export default function AdminSettingsPage() {
  const { t } = useI18n();
  const [configs, setConfigs] = useState<SystemConfigItem[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig()
      .then((data) => {
        setConfigs(data);
        const v: Record<string, string> = {};
        data.forEach((c) => { v[c.key] = c.value; });
        setValues(v);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(values).map(([key, value]) => ({ key, value }));
      await updateConfig(updates);
      toast({ title: t.admin?.settingsSaved || 'Settings saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-th-text">{t.admin?.systemSettings || 'System Settings'}</h2>

      <div className="bg-th-surface border border-th-border rounded-xl p-5 space-y-4">
        {configs.map((config) => (
          <div key={config.id} className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-th-text">{config.label || config.key}</label>
              {config.groupName && <span className="text-xs text-th-text-t">{config.groupName}</span>}
            </div>
            <input
              type={config.type === 'number' ? 'number' : 'text'}
              value={values[config.key] || ''}
              onChange={(e) => setValues({ ...values, [config.key]: e.target.value })}
              className="w-32 px-3 py-2 bg-th-bg border border-th-border rounded-lg text-th-text text-sm text-right"
            />
          </div>
        ))}

        {configs.length === 0 && (
          <p className="text-th-text-s text-center py-4">No system configs found</p>
        )}

        <div className="flex justify-end pt-4 border-t border-th-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save24Regular className="w-4 h-4" />
            {saving ? 'Saving...' : (t.admin?.saveSettings || 'Save Settings')}
          </button>
        </div>
      </div>
    </div>
  );
}
