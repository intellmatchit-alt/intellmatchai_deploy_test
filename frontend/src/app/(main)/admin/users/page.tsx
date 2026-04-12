'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUsers, adjustUserWallet, type AdminUser } from '@/lib/api/admin';
import { toast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';
import { Search24Regular, Wallet24Regular, Dismiss24Regular } from '@fluentui/react-icons';

export default function AdminUsersPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [adjusting, setAdjusting] = useState<AdminUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: number, s: string) => {
    setIsLoading(true);
    try {
      const data = await getUsers(p, 20, s);
      setUsers(data.users);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(1, ''); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(1, search);
  };

  const handleAdjust = async () => {
    if (!adjusting || !adjustAmount || !adjustReason) return;
    setSaving(true);
    try {
      const result = await adjustUserWallet(adjusting.id, Number(adjustAmount), adjustReason);
      toast({ title: `Wallet adjusted. New balance: ${result.balance}` });
      setAdjusting(null);
      setAdjustAmount('');
      setAdjustReason('');
      load(page, search);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-th-text">{t.admin?.users || 'Users'}</h2>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-t" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.admin?.searchUsers || 'Search users...'}
              className="pl-9 pr-3 py-2 bg-th-bg border border-th-border rounded-lg text-th-text text-sm w-64"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            {t.common?.search || 'Search'}
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-th-surface border border-th-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-th-border text-th-text-s">
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Email</th>
                <th className="text-center p-3">Plan</th>
                <th className="text-right p-3">Balance</th>
                <th className="text-center p-3">Admin</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-th-border last:border-0 text-th-text">
                  <td className="p-3 font-medium">{user.fullName}</td>
                  <td className="p-3 text-th-text-s">{user.email}</td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">
                      {user.subscription?.plan || 'FREE'}
                    </span>
                  </td>
                  <td className="p-3 text-right">{user.wallet?.balance ?? 0}</td>
                  <td className="p-3 text-center">{user.isAdmin ? '✓' : ''}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setAdjusting(user)}
                      className="p-1.5 hover:bg-th-surface-h rounded-lg transition-colors text-th-text-s"
                      title="Adjust Wallet"
                    >
                      <Wallet24Regular className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => load(page - 1, search)} disabled={page <= 1} className="px-3 py-1.5 text-sm bg-th-surface border border-th-border rounded-lg disabled:opacity-50 text-th-text">
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-th-text-s">{page} / {totalPages}</span>
          <button onClick={() => load(page + 1, search)} disabled={page >= totalPages} className="px-3 py-1.5 text-sm bg-th-surface border border-th-border rounded-lg disabled:opacity-50 text-th-text">
            Next
          </button>
        </div>
      )}

      {/* Adjust Wallet Modal */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAdjusting(null)}>
          <div className="bg-th-surface rounded-2xl p-6 border border-th-border w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-th-text">{t.admin?.adjustWallet || 'Adjust Wallet'}</h3>
              <button onClick={() => setAdjusting(null)} className="p-1 hover:bg-th-surface-h rounded-lg"><Dismiss24Regular className="w-5 h-5 text-th-text-s" /></button>
            </div>
            <p className="text-sm text-th-text-s">{adjusting.fullName} ({adjusting.email})</p>
            <p className="text-sm text-th-text-s">Current balance: {adjusting.wallet?.balance ?? 0}</p>
            <div>
              <label className="block text-sm text-th-text-s mb-1">{t.admin?.amount || 'Amount'} (positive to add, negative to deduct)</label>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="w-full px-3 py-2 bg-th-bg border border-th-border rounded-lg text-th-text text-sm"
                placeholder="e.g. 100 or -50"
              />
            </div>
            <div>
              <label className="block text-sm text-th-text-s mb-1">{t.admin?.reason || 'Reason'}</label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3 py-2 bg-th-bg border border-th-border rounded-lg text-th-text text-sm"
                placeholder="Reason for adjustment"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setAdjusting(null)} className="px-4 py-2 text-sm text-th-text-s hover:text-th-text transition-colors">Cancel</button>
              <button onClick={handleAdjust} disabled={saving || !adjustAmount || !adjustReason} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Adjusting...' : 'Adjust'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
