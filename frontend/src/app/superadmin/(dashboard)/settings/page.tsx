'use client';

import { useEffect, useState } from 'react';
import { getSAConfig, updateSAConfig } from '@/lib/api/superadmin';

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  group: string;
  description: string;
  label?: string;
  groupName?: string;
}

// Define which keys should use dropdowns
const BOOLEAN_KEYS = ['affiliate_auto_approve', 'affiliate_enabled', 'qa_reporting_enabled'];
const ENUM_KEYS: Record<string, Array<{ value: string; label: string }>> = {
  affiliate_payment_mode: [
    { value: 'cash', label: 'Cash' },
    { value: 'points', label: 'Points' },
  ],
};

// Human-readable labels for config keys
const KEY_LABELS: Record<string, string> = {
  affiliate_auto_approve: 'Auto-Approve Applications',
  affiliate_commission_percentage: 'Commission Percentage (%)',
  affiliate_enabled: 'Enable Affiliate System',
  affiliate_max_discount_percentage: 'Max Discount for Codes (%)',
  affiliate_min_discount_percentage: 'Min Discount for Codes (%)',
  affiliate_payment_mode: 'Payment Mode',
  affiliate_policy_content: 'Affiliate Policy Text',
  affiliate_terms_content: 'Terms & Conditions Text',
  contact_upload_cost: 'Points per Contact Import',
  scan_cost: 'Points per Card Scan',
  qa_reporting_enabled: 'QA Bug Reporting',
  collaboration_request_cost: 'Points per Collaboration Request',
  collaboration_platform_percentage: 'Platform Commission (%)',
};

// Keys that should use textarea
const TEXTAREA_KEYS = ['affiliate_policy_content', 'affiliate_terms_content'];

interface ConfigGroup {
  name: string;
  items: ConfigItem[];
  dirty: boolean;
  saving: boolean;
}

export default function SuperAdminSettingsPage() {
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    getSAConfig()
      .then((data) => {
        const items = Array.isArray(data) ? data : [];
        // Group by group name
        const groupMap: Record<string, ConfigItem[]> = {};
        items.forEach((item: any) => {
          const group = item.groupName || item.group || 'General';
          if (!groupMap[group]) groupMap[group] = [];
          groupMap[group].push({ ...item, group });
        });
        setGroups(
          Object.entries(groupMap).map(([name, items]) => ({
            name,
            items,
            dirty: false,
            saving: false,
          }))
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleValueChange = (groupIndex: number, itemIndex: number, newValue: string) => {
    setGroups((prev) => {
      const updated = [...prev];
      updated[groupIndex] = {
        ...updated[groupIndex],
        dirty: true,
        items: updated[groupIndex].items.map((item, i) =>
          i === itemIndex ? { ...item, value: newValue } : item
        ),
      };
      return updated;
    });
  };

  const handleSaveGroup = async (groupIndex: number) => {
    const group = groups[groupIndex];
    setGroups((prev) => {
      const updated = [...prev];
      updated[groupIndex] = { ...updated[groupIndex], saving: true };
      return updated;
    });
    setSuccessMsg('');
    setError('');

    try {
      const configs = group.items.map((item) => ({ key: item.key, value: item.value }));
      await updateSAConfig(configs);
      setGroups((prev) => {
        const updated = [...prev];
        updated[groupIndex] = { ...updated[groupIndex], dirty: false, saving: false };
        return updated;
      });
      setSuccessMsg(`"${group.name}" settings saved successfully.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      setGroups((prev) => {
        const updated = [...prev];
        updated[groupIndex] = { ...updated[groupIndex], saving: false };
        return updated;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-white font-bold">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4 text-sm text-green-400 mb-4">
          {successMsg}
        </div>
      )}

      {groups.length === 0 && !error && (
        <div className="text-center py-16 text-white font-bold">
          <p className="text-lg mb-2">No system configurations</p>
          <p className="text-sm">System settings will appear here once configured in the backend.</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((group, groupIndex) => (
          <div key={group.name} className="bg-[#16161e] border border-[#2a2a35] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2a2a35] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-bold uppercase tracking-wider">{group.name}</h3>
              <button
                onClick={() => handleSaveGroup(groupIndex)}
                disabled={!group.dirty || group.saving}
                className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                  group.dirty
                    ? 'bg-[#DC2626] hover:bg-[#EF4444] text-white'
                    : 'bg-[#0a0a0f] text-white font-bold border border-[#2a2a35] cursor-not-allowed'
                }`}
              >
                {group.saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <div className="p-6 space-y-5">
              {group.items.map((item, itemIndex) => {
                const label = KEY_LABELS[item.key] || item.label || item.key;
                const isBoolean = BOOLEAN_KEYS.includes(item.key);
                const enumOptions = ENUM_KEYS[item.key];
                const isTextarea = TEXTAREA_KEYS.includes(item.key);
                const isNumber = item.key.includes('percentage') || item.key.includes('cost');

                return (
                  <div key={item.id || item.key} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                    <div>
                      <p className="text-sm font-bold text-white">{label}</p>
                      <p className="text-xs text-white/70 mt-0.5 font-mono">{item.key}</p>
                    </div>
                    <div className="sm:col-span-2">
                      {isBoolean ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleValueChange(groupIndex, itemIndex, 'true')}
                            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                              item.value === 'true'
                                ? 'bg-green-500 text-black border border-green-500'
                                : 'bg-[#0a0a0f] text-white border border-[#2a2a35] hover:border-green-500/50'
                            }`}
                          >
                            Enabled
                          </button>
                          <button
                            type="button"
                            onClick={() => handleValueChange(groupIndex, itemIndex, 'false')}
                            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                              item.value === 'false'
                                ? 'bg-red-400 text-black border border-red-400'
                                : 'bg-[#0a0a0f] text-white border border-[#2a2a35] hover:border-red-400/50'
                            }`}
                          >
                            Disabled
                          </button>
                        </div>
                      ) : enumOptions ? (
                        <div className="flex gap-2 flex-wrap">
                          {enumOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleValueChange(groupIndex, itemIndex, opt.value)}
                              className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                                item.value === opt.value
                                  ? 'bg-emerald-400 text-black border border-emerald-400'
                                  : 'bg-[#0a0a0f] text-white border border-[#2a2a35] hover:border-emerald-400/50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : isTextarea ? (
                        <textarea
                          value={item.value}
                          onChange={(e) => handleValueChange(groupIndex, itemIndex, e.target.value)}
                          rows={4}
                          className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-lg px-4 py-3 text-sm text-white font-bold focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] transition-colors resize-vertical"
                        />
                      ) : (
                        <input
                          type={isNumber ? 'number' : 'text'}
                          value={item.value}
                          onChange={(e) => handleValueChange(groupIndex, itemIndex, e.target.value)}
                          className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] transition-colors"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
