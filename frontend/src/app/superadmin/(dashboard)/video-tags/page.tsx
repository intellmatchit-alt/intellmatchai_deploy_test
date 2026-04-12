'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getSAVideoTags,
  createSAVideoTag,
  updateSAVideoTag,
  deleteSAVideoTag,
  type SAVideoTag,
} from '@/lib/api/superadmin';

const emptyTag: Partial<SAVideoTag> = {
  name: '',
  nameAr: '',
  isActive: true,
};

export default function SAVideoTagsPage() {
  const [tags, setTags] = useState<SAVideoTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<SAVideoTag> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setTags(await getSAVideoTags());
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updateSAVideoTag(editing.id, editing);
      } else {
        await createSAVideoTag(editing);
      }
      setEditing(null);
      load();
    } catch (err: any) {
      alert(err?.message || 'Error saving');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video tag?')) return;
    try {
      await deleteSAVideoTag(id);
      load();
    } catch (err: any) {
      alert(err?.message || 'Error deleting');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#00d084] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white font-bold">Video Tags</h2>
          <p className="text-sm text-white font-bold mt-1">Manage tags for organizing videos</p>
        </div>
        <button
          onClick={() => setEditing({ ...emptyTag })}
          className="flex items-center gap-2 px-4 py-2 bg-[#00d084] hover:bg-[#00b872] text-black font-bold rounded-lg text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Tag
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#111118] border border-[#2a2a35] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a35]">
              <th className="text-left px-4 py-3 text-white font-bold font-medium">Name</th>
              <th className="text-left px-4 py-3 text-white font-bold font-medium">Arabic Name</th>
              <th className="text-center px-4 py-3 text-white font-bold font-medium">Active</th>
              <th className="text-center px-4 py-3 text-white font-bold font-medium">Videos</th>
              <th className="text-right px-4 py-3 text-white font-bold font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id} className="border-b border-[#2a2a35] last:border-b-0 hover:bg-[#16161e] transition-colors">
                <td className="px-4 py-3 text-white font-bold font-medium">{tag.name}</td>
                <td className="px-4 py-3 text-white font-bold" dir="rtl">{tag.nameAr || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${tag.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                </td>
                <td className="px-4 py-3 text-center text-white font-bold">{tag._count?.videos ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditing(tag)}
                      className="px-3 py-1.5 text-xs text-white font-bold hover:text-white font-bold hover:bg-[#1a1a24] rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id)}
                      className="px-3 py-1.5 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tags.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-white font-bold">
                  No video tags yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit/Create Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#16161e] rounded-2xl p-6 border border-[#2a2a35] w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white font-bold">{editing.id ? 'Edit Tag' : 'Create Tag'}</h3>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-[#2a2a35] rounded-lg text-white font-bold hover:text-white font-bold">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {[
              { key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Marketing' },
              { key: 'nameAr', label: 'Name (Arabic)', type: 'text', placeholder: 'e.g. تسويق' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm text-white font-bold mb-1">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={(editing as any)[key] ?? ''}
                  onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#00d084] focus:outline-none transition-colors"
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
                className="px-4 py-2 bg-[#00d084] hover:bg-[#00b872] disabled:opacity-50 text-black font-bold rounded-lg text-sm font-medium transition-colors"
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
