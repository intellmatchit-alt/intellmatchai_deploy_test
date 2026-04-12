'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSAPointPacks, createSAPointPack, updateSAPointPack, deleteSAPointPack, type SAPointPack } from '@/lib/api/superadmin';

const emptyPack: Partial<SAPointPack> = {
  name: '', nameAr: '', points: 0, price: 0, currency: 'USD', isActive: true, sortOrder: 0,
};

export default function SAPointPacksPage() {
  const [packs, setPacks] = useState<SAPointPack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<SAPointPack> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try { setPacks(await getSAPointPacks()); } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updateSAPointPack(editing.id, editing);
      } else {
        await createSAPointPack(editing);
      }
      setEditing(null);
      load();
    } catch (err: any) {
      alert(err?.message || 'Error saving');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this point pack?')) return;
    try {
      await deleteSAPointPack(id);
      load();
    } catch (err: any) {
      alert(err?.message || 'Error deleting');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white font-bold">Point Packs</h2>
          <p className="text-sm text-white font-bold mt-1">Manage extra point bundles that users can purchase</p>
        </div>
        <button
          onClick={() => setEditing({ ...emptyPack })}
          className="flex items-center gap-2 px-4 py-2 bg-[#DC2626] hover:bg-[#EF4444] text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Pack
        </button>
      </div>

      {/* Pack Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packs.map((pack) => (
          <div key={pack.id} className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-5 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-white font-bold">{pack.name}</h3>
                {pack.nameAr && <p className="text-sm text-white font-bold" dir="rtl">{pack.nameAr}</p>}
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded ${pack.isActive ? 'bg-green-500 text-black border border-green-500' : 'bg-gray-400 text-black border border-gray-400'}`}>
                {pack.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white font-bold">{pack.points}</span>
              <span className="text-sm text-white font-bold">points</span>
            </div>

            <div className="text-xl font-semibold text-[#DC2626] mb-4">
              ${typeof pack.price === 'object' ? Number(pack.price) : pack.price} <span className="text-sm text-white font-bold">{pack.currency}</span>
            </div>

            <div className="mt-auto flex items-center gap-2 pt-3 border-t border-[#2a2a35]">
              <button
                onClick={() => setEditing(pack)}
                className="flex-1 px-3 py-2 text-sm text-white font-bold hover:text-white font-bold hover:bg-[#1a1a24] rounded-lg transition-colors text-center"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(pack.id)}
                className="flex-1 px-3 py-2 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-center"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {packs.length === 0 && (
          <div className="col-span-full text-center py-12 text-white font-bold">
            No point packs configured. Create one to get started.
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#16161e] rounded-2xl p-6 border border-[#2a2a35] w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white font-bold">{editing.id ? 'Edit Point Pack' : 'Create Point Pack'}</h3>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-[#2a2a35] rounded-lg text-white font-bold hover:text-white font-bold">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {[
              { key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Starter Pack' },
              { key: 'nameAr', label: 'Name (Arabic)', type: 'text', placeholder: 'e.g. باقة المبتدئين' },
              { key: 'points', label: 'Points', type: 'number', placeholder: '50' },
              { key: 'price', label: 'Price (USD)', type: 'number', placeholder: '4.99' },
              { key: 'currency', label: 'Currency', type: 'text', placeholder: 'USD' },
              { key: 'sortOrder', label: 'Sort Order', type: 'number', placeholder: '1' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm text-white font-bold mb-1">{label}</label>
                <input
                  type={type}
                  step={key === 'price' ? '0.01' : undefined}
                  placeholder={placeholder}
                  value={(editing as any)[key] ?? ''}
                  onChange={(e) => setEditing({ ...editing, [key]: type === 'number' ? (key === 'price' ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0) : e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#DC2626] focus:outline-none transition-colors"
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editing.isActive ?? true}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                className="rounded border-[#2a2a35] bg-[#0a0a0f]"
              />
              <label className="text-sm text-white font-bold">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-white font-bold hover:text-white font-bold transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#DC2626] hover:bg-[#EF4444] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
