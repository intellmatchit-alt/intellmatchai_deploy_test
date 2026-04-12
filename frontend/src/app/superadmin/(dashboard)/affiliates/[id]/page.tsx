'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSAAffiliateDetail, updateSAAffiliateStatus } from '@/lib/api/superadmin';

interface AffiliateDetail {
  id: string;
  userId: string;
  user?: { fullName: string; email: string; createdAt: string };
  status: string;
  totalEarnings: number;
  pendingBalance: number;
  codesCount: number;
  referralsCount: number;
  conversions: number;
  conversionRate: number;
  createdAt: string;
  codes: Array<{
    id: string;
    code: string;
    discountPercent: number;
    commissionPercent: number;
    usesCount: number;
    totalRevenue: number;
    isActive: boolean;
    createdAt: string;
  }>;
  recentReferrals: Array<{
    id: string;
    email: string;
    codeUsed: string;
    status: string;
    createdAt: string;
  }>;
}

export default function SuperAdminAffiliateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [affiliate, setAffiliate] = useState<AffiliateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSAAffiliateDetail(id) as AffiliateDetail;
      setAffiliate(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load affiliate');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleStatusChange = async (status: string) => {
    setActionLoading(true);
    try {
      await updateSAAffiliateStatus(id, status);
      await fetchDetail();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-500 text-black',
      APPROVED: 'bg-green-500 text-black',
      PENDING: 'bg-yellow-400 text-black',
      SUSPENDED: 'bg-red-400 text-black',
      REJECTED: 'bg-red-400 text-black',
      CONVERTED: 'bg-blue-400 text-black',
    };
    return map[status] || 'bg-gray-400 text-black';
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-white font-bold text-sm">Loading affiliate details...</div>
    );
  }

  if (error || !affiliate) {
    return (
      <div>
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-sm text-red-400 mb-4">
          {error || 'Affiliate not found'}
        </div>
        <button
          onClick={() => router.push('/superadmin/affiliates')}
          className="text-sm text-white font-bold hover:text-white font-bold transition-colors"
        >
          Back to Affiliates
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <Link
        href="/superadmin/affiliates"
        className="inline-flex items-center gap-2 text-sm text-white font-bold hover:text-white font-bold mb-6 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Affiliates
      </Link>

      {/* Affiliate Info */}
      <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white font-bold mb-1">{affiliate.user?.fullName || 'N/A'}</h2>
            <p className="text-sm text-white font-bold">{affiliate.user?.email || 'N/A'}</p>
            <div className="flex items-center gap-3 mt-3">
              <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusBadge(affiliate.status)}`}>
                {affiliate.status}
              </span>
              <span className="text-xs text-white font-bold">
                Joined {new Date(affiliate.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {affiliate.status === 'PENDING' && (
              <>
                <button
                  onClick={() => handleStatusChange('APPROVED')}
                  disabled={actionLoading}
                  className="text-xs font-medium text-green-400 border border-green-800/50 px-4 py-2 rounded-lg hover:bg-green-900/20 transition-colors disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleStatusChange('REJECTED')}
                  disabled={actionLoading}
                  className="text-xs font-medium text-red-400 border border-red-800/50 px-4 py-2 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            {(affiliate.status === 'ACTIVE' || affiliate.status === 'APPROVED') && (
              <button
                onClick={() => handleStatusChange('SUSPENDED')}
                disabled={actionLoading}
                className="text-xs font-medium text-yellow-400 border border-yellow-800/50 px-4 py-2 rounded-lg hover:bg-yellow-900/20 transition-colors disabled:opacity-50"
              >
                Suspend
              </button>
            )}
            {affiliate.status === 'SUSPENDED' && (
              <button
                onClick={() => handleStatusChange('APPROVED')}
                disabled={actionLoading}
                className="text-xs font-medium text-green-400 border border-green-800/50 px-4 py-2 rounded-lg hover:bg-green-900/20 transition-colors disabled:opacity-50"
              >
                Reactivate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Codes', value: affiliate.codesCount || 0, color: 'text-blue-400' },
          { label: 'Referrals', value: affiliate.referralsCount || 0, color: 'text-purple-400' },
          { label: 'Conversions', value: affiliate.conversions || 0, color: 'text-cyan-400' },
          { label: 'Conversion Rate', value: `${Number(affiliate.conversionRate || 0).toFixed(1)}%`, color: 'text-yellow-400' },
          { label: 'Total Earnings', value: `$${Number(affiliate.totalEarnings || 0).toFixed(2)}`, color: 'text-emerald-400' },
        ].map((card) => (
          <div key={card.label} className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-4">
            <p className="text-xs text-white font-bold uppercase tracking-wider mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Codes Table */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white font-bold uppercase tracking-wider mb-3">Affiliate Codes</h3>
        <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a35]">
                  <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Code</th>
                  <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Discount %</th>
                  <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Commission %</th>
                  <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Uses</th>
                  <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Revenue</th>
                  <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {!affiliate.codes || affiliate.codes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-white font-bold text-sm">No codes yet</td>
                  </tr>
                ) : (
                  affiliate.codes.map((code) => (
                    <tr key={code.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#1a1a24] transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-mono font-medium text-white font-bold bg-[#0a0a0f] px-2 py-0.5 rounded">{code.code}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-white font-bold">{code.discountPercent}%</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-white font-bold">{code.commissionPercent}%</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-white font-bold">{code.usesCount || 0}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-emerald-400 font-medium">${Number(code.totalRevenue || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${code.isActive ? 'bg-green-500 text-black' : 'bg-red-400 text-black'}`}>
                          {code.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Referrals Table */}
      <div>
        <h3 className="text-sm font-semibold text-white font-bold uppercase tracking-wider mb-3">Recent Referrals</h3>
        <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a35]">
                  <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Email</th>
                  <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Code Used</th>
                  <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {!affiliate.recentReferrals || affiliate.recentReferrals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-white font-bold text-sm">No referrals yet</td>
                  </tr>
                ) : (
                  affiliate.recentReferrals.map((ref) => (
                    <tr key={ref.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#1a1a24] transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-white font-bold">{ref.email}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-mono text-white font-bold">{ref.codeUsed}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusBadge(ref.status)}`}>
                          {ref.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-white font-bold">{new Date(ref.createdAt).toLocaleDateString()}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
