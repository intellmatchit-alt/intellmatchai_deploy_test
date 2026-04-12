'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getSAUsers, banUser, unbanUser, deleteSAUser } from '@/lib/api/superadmin';

interface User {
  id: string;
  fullName: string;
  email: string;
  status: string;
  plan: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('status', filter === 'banned' ? 'BANNED' : 'ACTIVE');

      const data = await getSAUsers(params.toString());
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleBanToggle = async (user: User) => {
    setActionLoading(user.id);
    try {
      if (user.status === 'BANNED') {
        await unbanUser(user.id);
      } else {
        await banUser(user.id);
      }
      await fetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await deleteSAUser(id);
      setDeleteConfirm(null);
      await fetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  return (
    <div>
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white font-bold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#16161e] border border-[#2a2a35] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white font-bold placeholder-[#52525b] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] transition-colors"
            />
          </div>
        </form>
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value as 'all' | 'active' | 'banned'); setPage(1); }}
          className="bg-[#16161e] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-[#DC2626] cursor-pointer"
        >
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Results count */}
      <div className="text-sm text-white font-bold mb-4">
        {total} user{total !== 1 ? 's' : ''} found
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
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Plan</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Created</th>
                <th className="text-right text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white font-bold text-sm">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white font-bold text-sm">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#1a1a24] transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-white font-bold">{user.fullName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-white font-bold">{user.email}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium bg-[#0a0a0f] border border-[#2a2a35] text-white font-bold px-2 py-1 rounded">
                        {user.plan || 'Free'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        user.status === 'BANNED'
                          ? 'bg-red-400 text-black'
                          : 'bg-green-500 text-black'
                      }`}>
                        {user.status === 'BANNED' ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-white font-bold">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/superadmin/users/${user.id}`}
                          className="text-xs font-medium text-white font-bold hover:text-white font-bold bg-[#0a0a0f] border border-[#2a2a35] px-3 py-1.5 rounded-lg hover:border-[#52525b] transition-colors"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleBanToggle(user)}
                          disabled={actionLoading === user.id}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                            user.status === 'BANNED'
                              ? 'text-green-400 border-green-800/50 hover:bg-green-900/20'
                              : 'text-yellow-400 border-yellow-800/50 hover:bg-yellow-900/20'
                          }`}
                        >
                          {user.status === 'BANNED' ? 'Unban' : 'Ban'}
                        </button>
                        {deleteConfirm === user.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(user.id)}
                              disabled={actionLoading === user.id}
                              className="text-xs font-medium text-red-400 border border-red-800/50 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-50"
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
                            onClick={() => setDeleteConfirm(user.id)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-white font-bold">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="text-sm text-white font-bold hover:text-white font-bold bg-[#16161e] border border-[#2a2a35] px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="text-sm text-white font-bold hover:text-white font-bold bg-[#16161e] border border-[#2a2a35] px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
