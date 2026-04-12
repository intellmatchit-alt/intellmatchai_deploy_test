'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  getSAAffiliateStats,
  getSAAffiliates,
  getSAAffiliateCodes,
  getSAAffiliateReferrals,
  getSAAffiliatePayouts,
  updateSAAffiliateStatus,
  processSAAffiliatePayout,
} from '@/lib/api/superadmin';

type Tab = 'overview' | 'affiliates' | 'codes' | 'referrals' | 'payouts';

interface AffiliateStats {
  totalAffiliates: number;
  activeCodes: number;
  totalReferrals: number;
  conversions: number;
  totalEarnings: number;
  pendingPayouts: number;
  conversionRate: number;
}

interface Affiliate {
  id: string;
  userId: string;
  user?: { fullName: string; email: string };
  status: string;
  codesCount: number;
  referralsCount: number;
  totalEarnings: number;
  createdAt: string;
}

interface AffiliateCode {
  id: string;
  code: string;
  name?: string;
  affiliateId: string;
  affiliate?: { user?: { fullName: string; email: string } };
  discountPercent: number;
  commissionPercent: number;
  usesCount: number;
  totalRevenue: number;
  isActive: boolean;
  createdAt: string;
}

interface Referral {
  id: string;
  email: string;
  codeUsed: string;
  affiliateId: string;
  affiliate?: { user?: { fullName: string; email: string } };
  status: string;
  createdAt: string;
}

interface Payout {
  id: string;
  affiliateId: string;
  affiliate?: { user?: { fullName: string; email: string } };
  amount: number;
  currency: string;
  status: string;
  requestedAt: string;
  processedAt?: string;
  notes?: string;
}

export default function SuperAdminAffiliatesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [codes, setCodes] = useState<AffiliateCode[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'affiliates', label: 'Affiliates' },
    { key: 'codes', label: 'Codes' },
    { key: 'referrals', label: 'Referrals' },
    { key: 'payouts', label: 'Payouts' },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'overview') {
        const data = await getSAAffiliateStats() as AffiliateStats;
        setStats(data);
      } else if (activeTab === 'affiliates') {
        const data = await getSAAffiliates({
          page,
          limit: 20,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        }) as { affiliates: Affiliate[]; totalPages: number };
        setAffiliates(data.affiliates || []);
        setTotalPages(data.totalPages || 1);
      } else if (activeTab === 'codes') {
        const data = await getSAAffiliateCodes(page) as { codes: AffiliateCode[]; totalPages: number };
        setCodes(data.codes || []);
        setTotalPages(data.totalPages || 1);
      } else if (activeTab === 'referrals') {
        const data = await getSAAffiliateReferrals(page) as { referrals: Referral[]; totalPages: number };
        setReferrals(data.referrals || []);
        setTotalPages(data.totalPages || 1);
      } else if (activeTab === 'payouts') {
        const data = await getSAAffiliatePayouts(page, statusFilter !== 'all' ? statusFilter : undefined) as { payouts: Payout[]; totalPages: number };
        setPayouts(data.payouts || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, statusFilter]);

  const handleStatusChange = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      await updateSAAffiliateStatus(id, status);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePayoutAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id);
    try {
      await processSAAffiliatePayout(id, action);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
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
      PAID: 'bg-green-500 text-black',
      PROCESSING: 'bg-yellow-400 text-black',
    };
    return map[status] || 'bg-gray-400 text-black';
  };

  const renderOverview = () => {
    if (!stats) return null;
    const cards = [
      { label: 'Total Affiliates', value: stats.totalAffiliates, color: 'text-blue-400' },
      { label: 'Active Codes', value: stats.activeCodes, color: 'text-green-400' },
      { label: 'Total Referrals', value: stats.totalReferrals, color: 'text-purple-400' },
      { label: 'Conversions', value: stats.conversions, color: 'text-cyan-400' },
      { label: 'Conversion Rate', value: `${Number(stats.conversionRate || 0).toFixed(1)}%`, color: 'text-yellow-400' },
      { label: 'Total Earnings', value: `$${Number(stats.totalEarnings || 0).toFixed(2)}`, color: 'text-emerald-400' },
      { label: 'Pending Payouts', value: `$${Number(stats.pendingPayouts || 0).toFixed(2)}`, color: 'text-orange-400' },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-5"
          >
            <p className="text-xs text-white font-bold uppercase tracking-wider mb-2">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderAffiliates = () => (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#16161e] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-[#DC2626] cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a35]">
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Email</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Codes</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Referrals</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Earnings</th>
                <th className="text-right text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-white font-bold text-sm">Loading affiliates...</td>
                </tr>
              ) : affiliates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-white font-bold text-sm">No affiliates found</td>
                </tr>
              ) : (
                affiliates.map((aff) => (
                  <tr key={aff.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#1a1a24] transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-white font-bold">{aff.user?.fullName || 'N/A'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-white font-bold">{aff.user?.email || 'N/A'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusBadge(aff.status)}`}>
                        {aff.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-white font-bold">{aff.codesCount || 0}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-white font-bold">{aff.referralsCount || 0}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-emerald-400 font-medium">${Number(aff.totalEarnings || 0).toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/superadmin/affiliates/${aff.id}`}
                          className="text-xs font-medium text-white font-bold hover:text-white font-bold bg-[#0a0a0f] border border-[#2a2a35] px-3 py-1.5 rounded-lg hover:border-[#52525b] transition-colors"
                        >
                          View
                        </Link>
                        {aff.status === 'PENDING' && (
                          <button
                            onClick={() => handleStatusChange(aff.id, 'APPROVED')}
                            disabled={actionLoading === aff.id}
                            className="text-xs font-medium text-green-400 border border-green-800/50 px-3 py-1.5 rounded-lg hover:bg-green-900/20 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {(aff.status === 'ACTIVE' || aff.status === 'APPROVED') && (
                          <button
                            onClick={() => handleStatusChange(aff.id, 'SUSPENDED')}
                            disabled={actionLoading === aff.id}
                            className="text-xs font-medium text-yellow-400 border border-yellow-800/50 px-3 py-1.5 rounded-lg hover:bg-yellow-900/20 transition-colors disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )}
                        {aff.status === 'SUSPENDED' && (
                          <button
                            onClick={() => handleStatusChange(aff.id, 'APPROVED')}
                            disabled={actionLoading === aff.id}
                            className="text-xs font-medium text-green-400 border border-green-800/50 px-3 py-1.5 rounded-lg hover:bg-green-900/20 transition-colors disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                        {aff.status === 'PENDING' && (
                          <button
                            onClick={() => handleStatusChange(aff.id, 'REJECTED')}
                            disabled={actionLoading === aff.id}
                            className="text-xs font-medium text-red-400 border border-red-800/50 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            Reject
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
    </div>
  );

  const renderCodes = () => (
    <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a35]">
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Code</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Name</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Owner</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Discount %</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Commission %</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Uses</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Revenue</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-white font-bold text-sm">Loading codes...</td>
              </tr>
            ) : codes.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-white font-bold text-sm">No codes found</td>
              </tr>
            ) : (
              codes.map((code) => (
                <tr key={code.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#1a1a24] transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-mono font-medium text-white font-bold bg-[#0a0a0f] px-2 py-0.5 rounded">{code.code}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-white font-bold">{code.name || '—'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-sm text-white font-bold">{code.affiliate?.user?.fullName || 'N/A'}</div>
                    <div className="text-xs text-white/70">{code.affiliate?.user?.email || ''}</div>
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
  );

  const renderReferrals = () => (
    <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a35]">
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Email</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Code Used</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Affiliate</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-white font-bold text-sm">Loading referrals...</td>
              </tr>
            ) : referrals.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-white font-bold text-sm">No referrals found</td>
              </tr>
            ) : (
              referrals.map((ref) => (
                <tr key={ref.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#1a1a24] transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-white font-bold">{ref.email}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-mono text-white font-bold">{ref.codeUsed}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-white font-bold">{ref.affiliate?.user?.fullName || 'N/A'}</span>
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
  );

  const renderPayouts = () => (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#16161e] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-[#DC2626] cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a35]">
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Affiliate</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Amount</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Requested</th>
                <th className="text-left text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Processed</th>
                <th className="text-right text-xs font-semibold text-white font-bold uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white font-bold text-sm">Loading payouts...</td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white font-bold text-sm">No payouts found</td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#1a1a24] transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-white font-bold">{payout.affiliate?.user?.fullName || 'N/A'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-emerald-400 font-medium">
                        ${Number(payout.amount || 0).toFixed(2)} {payout.currency}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusBadge(payout.status)}`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-white font-bold">{new Date(payout.requestedAt).toLocaleDateString()}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-white font-bold">
                        {payout.processedAt ? new Date(payout.processedAt).toLocaleDateString() : '-'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {payout.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePayoutAction(payout.id, 'approve')}
                            disabled={actionLoading === payout.id}
                            className="text-xs font-medium text-green-400 border border-green-800/50 px-3 py-1.5 rounded-lg hover:bg-green-900/20 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handlePayoutAction(payout.id, 'reject')}
                            disabled={actionLoading === payout.id}
                            className="text-xs font-medium text-red-400 border border-red-800/50 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-white font-bold">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'affiliates': return renderAffiliates();
      case 'codes': return renderCodes();
      case 'referrals': return renderReferrals();
      case 'payouts': return renderPayouts();
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-[#16161e] border border-[#2a2a35] rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setStatusFilter('all'); }}
            className={`flex-1 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-[#DC2626]/10 text-[#DC2626]'
                : 'text-white font-bold hover:text-white font-bold hover:bg-[#0a0a0f]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      {loading && activeTab === 'overview' ? (
        <div className="text-center py-12 text-white font-bold text-sm">Loading...</div>
      ) : (
        renderContent()
      )}

      {/* Pagination - only for non-overview tabs */}
      {activeTab !== 'overview' && totalPages > 1 && (
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
