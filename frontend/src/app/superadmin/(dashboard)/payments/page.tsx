'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSAPayments, type SAPaymentEntry } from '@/lib/api/superadmin';

const statusColors: Record<string, string> = {
  APPROVED: 'bg-green-500 text-black border-green-500',
  PENDING: 'bg-yellow-400 text-black border-yellow-400',
  DECLINED: 'bg-red-400 text-black border-red-400',
  CANCELLED: 'bg-gray-400 text-black border-gray-400',
  REFUNDED: 'bg-blue-400 text-black border-blue-400',
  EXPIRED: 'bg-gray-400 text-black border-gray-400',
};

export default function SAPaymentsPage() {
  const [purchases, setPurchases] = useState<SAPaymentEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getSAPayments(page, 20, statusFilter || undefined);
      setPurchases(data.purchases);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
      date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white font-bold">Point Pack Purchases</h2>
          <p className="text-sm text-white font-bold mt-1">{total} total purchase{total !== 1 ? 's' : ''}</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-[#16161e] border border-[#2a2a35] rounded-lg text-white font-bold text-sm focus:border-[#DC2626] focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="DECLINED">Declined</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-16 text-white font-bold">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          No purchases found
        </div>
      ) : (
        <>
          <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a35] text-white font-bold">
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Pack</th>
                  <th className="text-right p-3 font-medium">Points</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#1a1a24] transition-colors">
                    <td className="p-3">
                      <div className="text-white font-bold font-medium">{p.user?.fullName || 'Unknown'}</div>
                      <div className="text-xs text-white font-bold">{p.user?.email || ''}</div>
                    </td>
                    <td className="p-3 text-white font-bold">{p.pointPack?.name || '—'}</td>
                    <td className="p-3 text-right text-white font-bold font-medium">{p.points}</td>
                    <td className="p-3 text-right text-white font-bold">${Number(p.amount).toFixed(2)} <span className="text-white font-bold">{p.currency}</span></td>
                    <td className="p-3 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded border ${statusColors[p.status] || statusColors.PENDING}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-white font-bold text-xs hidden md:table-cell">
                      {formatDate(p.createdAt)}
                      {p.paidAt && <div className="text-green-400 font-bold">Paid {formatDate(p.paidAt)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-white font-bold">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-[#2a2a35] rounded-lg text-white font-bold hover:text-white font-bold hover:bg-[#1a1a24] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm border border-[#2a2a35] rounded-lg text-white font-bold hover:text-white font-bold hover:bg-[#1a1a24] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
