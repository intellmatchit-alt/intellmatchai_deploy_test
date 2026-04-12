'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPlans, createPlan, updatePlan, deletePlan, type PlanConfig } from '@/lib/api/admin';
import { toast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';
import { Add24Regular, Edit24Regular, Delete24Regular, Dismiss24Regular } from '@fluentui/react-icons';

const emptyPlan: Partial<PlanConfig> = {
  name: '', displayName: '', monthlyPrice: '0', yearlyPrice: '0',
  pointsAllocation: 0, contactLimit: 100, minSeats: 1, isActive: true, sortOrder: 0,
};

export default function AdminPlansPage() {
  const { t } = useI18n();
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PlanConfig> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try { setPlans(await getPlans()); } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updatePlan(editing.id, editing);
      } else {
        await createPlan(editing);
      }
      toast({ title: 'Plan saved' });
      setEditing(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    try {
      await deletePlan(id);
      toast({ title: 'Plan deleted' });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-th-text">{t.admin?.plans || 'Plans'}</h2>
        <button onClick={() => setEditing({ ...emptyPlan })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Add24Regular className="w-4 h-4" /> {t.admin?.createPlan || 'Create Plan'}
        </button>
      </div>

      {/* Plans Table */}
      <div className="bg-th-surface border border-th-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-th-border text-th-text-s">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Display Name</th>
              <th className="text-right p-3">Monthly</th>
              <th className="text-right p-3">Yearly</th>
              <th className="text-right p-3">Points</th>
              <th className="text-right p-3">Contact Limit</th>
              <th className="text-center p-3">Active</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-th-border last:border-0 text-th-text">
                <td className="p-3 font-medium">{plan.name}</td>
                <td className="p-3">{plan.displayName}</td>
                <td className="p-3 text-right">${plan.monthlyPrice}</td>
                <td className="p-3 text-right">${plan.yearlyPrice}</td>
                <td className="p-3 text-right">{plan.pointsAllocation}</td>
                <td className="p-3 text-right">{plan.contactLimit}</td>
                <td className="p-3 text-center">{plan.isActive ? '✓' : '—'}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditing(plan)} className="p-1.5 hover:bg-th-surface-h rounded-lg transition-colors text-th-text-s">
                      <Edit24Regular className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(plan.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-red-400">
                      <Delete24Regular className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-th-surface rounded-2xl p-6 border border-th-border w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-th-text">{editing.id ? 'Edit Plan' : 'Create Plan'}</h3>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-th-surface-h rounded-lg"><Dismiss24Regular className="w-5 h-5 text-th-text-s" /></button>
            </div>
            {[
              { key: 'name', label: 'Plan Key (e.g. PRO)', type: 'text' },
              { key: 'displayName', label: 'Display Name', type: 'text' },
              { key: 'displayNameAr', label: 'Display Name (Arabic)', type: 'text' },
              { key: 'monthlyPrice', label: 'Monthly Price ($)', type: 'number' },
              { key: 'yearlyPrice', label: 'Yearly Price ($)', type: 'number' },
              { key: 'pointsAllocation', label: 'Points Allocation', type: 'number' },
              { key: 'contactLimit', label: 'Contact Limit', type: 'number' },
              { key: 'minSeats', label: 'Min Seats', type: 'number' },
              { key: 'maxSeats', label: 'Max Seats', type: 'number' },
              { key: 'sortOrder', label: 'Sort Order', type: 'number' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-sm text-th-text-s mb-1">{label}</label>
                <input
                  type={type}
                  value={(editing as any)[key] ?? ''}
                  onChange={(e) => setEditing({ ...editing, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                  className="w-full px-3 py-2 bg-th-bg border border-th-border rounded-lg text-th-text text-sm"
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
              <label className="text-sm text-th-text">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-th-text-s hover:text-th-text transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
