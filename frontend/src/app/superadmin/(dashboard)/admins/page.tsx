'use client';

import { useEffect, useState } from 'react';
import { getSAAdmins, createSAAdmin, updateSAAdmin, deleteSAAdmin } from '@/lib/api/superadmin';

interface Admin {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'] as const;

function getRoleBadge(role: string) {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-red-400 text-black border-red-400';
    case 'ADMIN':
      return 'bg-orange-400 text-black border-orange-400';
    case 'MODERATOR':
      return 'bg-blue-400 text-black border-blue-400';
    case 'SUPPORT':
      return 'bg-gray-400 text-black border-gray-400';
    default:
      return 'bg-gray-400 text-black border-gray-400';
  }
}

export default function SuperAdminAdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [form, setForm] = useState({ email: '', fullName: '', password: '', role: 'ADMIN' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [editRoleValue, setEditRoleValue] = useState('');

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const data = await getSAAdmins();
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createSAAdmin(form);
      setShowModal(false);
      setForm({ email: '', fullName: '', password: '', role: 'ADMIN' });
      await fetchAdmins();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleUpdate = async (id: string) => {
    try {
      await updateSAAdmin(id, { role: editRoleValue });
      setEditRoleId(null);
      await fetchAdmins();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSAAdmin(id);
      setDeleteConfirm(null);
      await fetchAdmins();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete admin');
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
          <span>Loading admins...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-white font-bold">{admins.length} admin account{admins.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#DC2626] hover:bg-[#EF4444] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Admin
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a35]">
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Email</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Last Login</th>
                <th className="text-right text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white font-bold text-sm">No admin accounts found</td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#1a1a24] transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-white font-bold">{admin.fullName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-white font-bold">{admin.email}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {editRoleId === admin.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={editRoleValue}
                            onChange={(e) => setEditRoleValue(e.target.value)}
                            className="bg-[#0a0a0f] border border-[#2a2a35] rounded text-xs text-white font-bold px-2 py-1 focus:outline-none focus:border-[#DC2626]"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r.replace('_', ' ')}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleRoleUpdate(admin.id)}
                            className="text-xs text-green-400 hover:text-green-300 px-1"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditRoleId(null)}
                            className="text-xs text-white font-bold hover:text-white font-bold px-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded border ${getRoleBadge(admin.role)}`}>
                          {admin.role.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        admin.isActive ? 'bg-green-500 text-black' : 'bg-gray-400 text-black'
                      }`}>
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-white font-bold">
                        {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Never'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditRoleId(admin.id); setEditRoleValue(admin.role); }}
                          className="text-xs font-medium text-white font-bold hover:text-white font-bold bg-[#0a0a0f] border border-[#2a2a35] px-3 py-1.5 rounded-lg hover:border-[#52525b] transition-colors"
                        >
                          Edit Role
                        </button>
                        {deleteConfirm === admin.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(admin.id)}
                              className="text-xs font-medium text-red-400 border border-red-800/50 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs font-medium text-white font-bold border border-[#2a2a35] px-3 py-1.5 rounded-lg hover:bg-[#0a0a0f] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(admin.id)}
                            className="text-xs font-medium text-red-400 border border-red-800/50 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#16161e] border border-[#2a2a35] rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white font-bold mb-4">Create Admin Account</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                  placeholder="John Doe"
                  className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white font-bold placeholder-[#52525b] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white font-bold mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="admin@intellmatch.com"
                  className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white font-bold placeholder-[#52525b] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white font-bold mb-1">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white font-bold placeholder-[#52525b] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white font-bold mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] cursor-pointer"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#DC2626] hover:bg-[#EF4444] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setForm({ email: '', fullName: '', password: '', role: 'ADMIN' }); }}
                  className="text-sm text-white font-bold hover:text-white font-bold px-4 py-2 rounded-lg border border-[#2a2a35] hover:bg-[#0a0a0f] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
