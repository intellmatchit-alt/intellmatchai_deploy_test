'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPointPacks, createPointPack, updatePointPack, deletePointPack, type PointPackAdmin } from '@/lib/api/admin';
import { toast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';
import { Add24Regular, Edit24Regular, Delete24Regular, Dismiss24Regular } from '@fluentui/react-icons';

const emptyPack: Partial<PointPackAdmin> = {
  name: '', points: 0, price: '0', currency: 'USD', isActive: true, sortOrder: 0,
};

export default function AdminPointPacksPage() {
  const { t } = useI18n();
  const [packs, setPacks] = useState<PointPackAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PointPackAdmin> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try { setPacks(await getPointPacks()); } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updatePointPack(editing.id, editing);
      } else {
        await createPointPack(editing);
      }
      toast({ title: 'Point pack saved' });
      setEditing(null);
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this point pack?')) return;
    try {
      await deletePointPack(id);
      toast({ title: 'Point pack deleted' });
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
        <h2 className="text-xl font-semibold text-th-text">{t.admin?.pointPacks || 'Point Packs'}</h2>
        <button onClick={() => setEditing({ ...emptyPack })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Add24Regular className="w-4 h-4" /> {t.admin?.createPack || 'Create Pack'}
        </button>
      </div>

      <div className="bg-th-surface border border-th-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-th-border text-th-text-s">
              <th className="text-left p-3">Name</th>
              <th className="text-right p-3">Points</th>
              <th className="text-right p-3">Price</th>
              <th className="text-center p-3">Currency</th>
              <th className="text-center p-3">Active</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((pack) => (
              <tr key={pack.id} className="border-b border-th-border last:border-0 text-th-text">
                <td className="p-3 font-medium">{pack.name}</td>
                <td className="p-3 text-right">{pack.points}</td>
                <td className="p-3 text-right">${pack.price}</td>
                <td className="p-3 text-center">{pack.currency}</td>
                <td className="p-3 text-center">{pack.isActive ? '✓' : '—'}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditing(pack)} className="p-1.5 hover:bg-th-surface-h rounded-lg transition-colors text-th-text-s">
                      <Edit24Regular className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(pack.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-red-400">
                      <Delete24Regular className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {packs.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-th-text-s">No point packs configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-th-surface rounded-2xl p-6 border border-th-border w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-th-text">{editing.id ? 'Edit Pack' : 'Create Pack'}</h3>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-th-surface-h rounded-lg"><Dismiss24Regular className="w-5 h-5 text-th-text-s" /></button>
            </div>
            {[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'nameAr', label: 'Name (Arabic)', type: 'text' },
              { key: 'points', label: 'Points', type: 'number' },
              { key: 'price', label: 'Price', type: 'number' },
              { key: 'currency', label: 'Currency', type: 'text' },
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
