'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSAAuditLog } from '@/lib/api/superadmin';

interface AuditEntry {
  id: string;
  adminName: string;
  action: string;
  target: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

const ACTION_TYPES = [
  'All Actions',
  'LOGIN',
  'USER_BAN',
  'USER_UNBAN',
  'USER_DELETE',
  'WALLET_ADJUST',
  'PLAN_CREATE',
  'PLAN_UPDATE',
  'PLAN_DELETE',
  'ADMIN_CREATE',
  'ADMIN_UPDATE',
  'ADMIN_DELETE',
  'CONFIG_UPDATE',
];

function getActionColor(action: string): string {
  if (action.includes('DELETE') || action.includes('BAN')) return 'text-black font-bold bg-red-400';
  if (action.includes('CREATE')) return 'text-black font-bold bg-green-500';
  if (action.includes('UPDATE') || action.includes('ADJUST')) return 'text-black font-bold bg-yellow-400';
  if (action.includes('LOGIN')) return 'text-black font-bold bg-blue-400';
  if (action.includes('UNBAN')) return 'text-black font-bold bg-green-500';
  return 'text-white font-bold bg-[#0a0a0f]';
}

export default function SuperAdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('All Actions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '25');
      if (actionFilter !== 'All Actions') params.set('action', actionFilter);

      const data = await getSAAuditLog(params.toString());
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="bg-[#16161e] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-[#DC2626] cursor-pointer"
        >
          {ACTION_TYPES.map((type) => (
            <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <div className="flex-1" />
        <p className="text-sm text-white font-bold self-center">{total} entries</p>
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
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Admin</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Action</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Target</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3 hidden lg:table-cell">Details</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3 hidden md:table-cell">IP Address</th>
                <th className="text-right text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white font-bold text-sm">
                    Loading audit log...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white font-bold text-sm">
                    No audit entries found
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#1a1a24] transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-white font-bold">{entry.adminName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getActionColor(entry.action)}`}>
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-white font-bold">{entry.target || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-sm text-white font-bold max-w-xs truncate block">{entry.details || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-white font-bold font-mono">{entry.ipAddress || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm text-white font-bold" title={formatTime(entry.createdAt)}>
                        {formatRelativeTime(entry.createdAt)}
                      </span>
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
