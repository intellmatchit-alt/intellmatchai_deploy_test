'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSAUser, banUser, unbanUser, deleteSAUser, adjustWallet, getSAPointPacks, type SAPointPack } from '@/lib/api/superadmin';
import { saApi } from '@/lib/api/superadmin-client';

interface UserDetail {
  id: string;
  fullName: string;
  email: string;
  status: string;
  plan: string;
  walletBalance: number;
  contactsCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  avatarUrl: string | null;
  phone: string | null;
  sector: string | null;
}

export default function SuperAdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [showGrantPackModal, setShowGrantPackModal] = useState(false);
  const [pointPacks, setPointPacks] = useState<SAPointPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState('');
  const [walletConfirmStep, setWalletConfirmStep] = useState(false);
  const [planConfirmStep, setPlanConfirmStep] = useState(false);
  const [packConfirmStep, setPackConfirmStep] = useState(false);

  useEffect(() => {
    getSAUser(userId)
      .then(setUser)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    getSAPointPacks().then(setPointPacks).catch(() => {});
  }, [userId]);

  const handleBanToggle = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      if (user.status === 'BANNED') {
        await unbanUser(user.id);
      } else {
        await banUser(user.id);
      }
      const updated = await getSAUser(userId);
      setUser(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWalletAdjust = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setActionLoading(true);
    try {
      await adjustWallet(user.id, Math.round(parseFloat(walletAmount)), walletReason);
      const updated = await getSAUser(userId);
      setUser(updated);
      setShowWalletModal(false);
      setWalletAmount('');
      setWalletReason('');
      setWalletConfirmStep(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to adjust wallet');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!user || !selectedPlan) return;
    setActionLoading(true);
    try {
      await saApi.patch(`/users/${user.id}/plan`, { plan: selectedPlan });
      const updated = await getSAUser(userId);
      setUser(updated);
      setShowPlanModal(false);
      setSelectedPlan('');
      setPlanConfirmStep(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to change plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrantPack = async () => {
    if (!user || !selectedPackId) return;
    const pack = pointPacks.find(p => p.id === selectedPackId);
    if (!pack) return;
    setActionLoading(true);
    try {
      await adjustWallet(user.id, pack.points, `Granted point pack: ${pack.name} (${pack.points} points)`);
      const updated = await getSAUser(userId);
      setUser(updated);
      setShowGrantPackModal(false);
      setSelectedPackId('');
      setPackConfirmStep(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to grant pack');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      await deleteSAUser(user.id);
      router.push('/superadmin/users');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      setActionLoading(false);
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
          <span>Loading user...</span>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div>
        <Link href="/superadmin/users" className="text-sm text-white font-bold hover:text-white font-bold mb-4 inline-flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Users
        </Link>
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-red-400 mt-4">
          <p className="font-medium">Failed to load user</p>
          <p className="text-sm mt-1 text-red-400/70">{error || 'User not found'}</p>
        </div>
      </div>
    );
  }

  const infoCards = [
    { label: 'Subscription Plan', value: user.plan || 'Free' },
    { label: 'Wallet Balance', value: `${user.walletBalance ?? 0} pts` },
    { label: 'Total Contacts', value: (user.contactsCount ?? 0).toString() },
    { label: 'Last Login', value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never' },
  ];

  return (
    <div>
      {/* Back button */}
      <Link href="/superadmin/users" className="text-sm text-white font-bold hover:text-white font-bold mb-6 inline-flex items-center gap-1 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Users
      </Link>

      {/* User header */}
      <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-[#0a0a0f] border border-[#2a2a35] flex items-center justify-center text-xl font-bold text-white font-bold shrink-0">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              user.fullName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-white font-bold">{user.fullName}</h2>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                user.status === 'BANNED'
                  ? 'bg-red-400 text-black'
                  : 'bg-green-500 text-black'
              }`}>
                {user.status === 'BANNED' ? 'Banned' : 'Active'}
              </span>
            </div>
            <p className="text-sm text-white font-bold mt-1">{user.email}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-white font-bold">
              {user.phone && <span>{user.phone}</span>}
              {user.sector && <span>{user.sector}</span>}
              <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {infoCards.map((card) => (
          <div key={card.label} className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-5">
            <p className="text-xs text-white font-bold uppercase tracking-wider mb-1">{card.label}</p>
            <p className="text-lg font-bold text-white font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="bg-[#16161e] border border-[#2a2a35] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white font-bold uppercase tracking-wider mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleBanToggle}
            disabled={actionLoading}
            className={`text-sm font-medium px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
              user.status === 'BANNED'
                ? 'text-green-400 border-green-800/50 hover:bg-green-900/20'
                : 'text-yellow-400 border-yellow-800/50 hover:bg-yellow-900/20'
            }`}
          >
            {user.status === 'BANNED' ? 'Unban User' : 'Ban User'}
          </button>

          <button
            onClick={() => setShowWalletModal(true)}
            disabled={actionLoading}
            className="text-sm font-medium text-white font-bold border border-[#2a2a35] px-4 py-2 rounded-lg hover:bg-[#0a0a0f] transition-colors disabled:opacity-50"
          >
            Adjust Wallet
          </button>

          <button
            onClick={() => { setSelectedPlan(user.plan || 'FREE'); setShowPlanModal(true); }}
            disabled={actionLoading}
            className="text-sm font-medium text-blue-400 border border-blue-800/50 px-4 py-2 rounded-lg hover:bg-blue-900/20 transition-colors disabled:opacity-50"
          >
            Change Plan
          </button>

          <button
            onClick={() => setShowGrantPackModal(true)}
            disabled={actionLoading}
            className="text-sm font-medium text-emerald-400 border border-emerald-800/50 px-4 py-2 rounded-lg hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
          >
            Grant Point Pack
          </button>

          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="text-sm font-medium text-red-400 border border-red-800/50 px-4 py-2 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-sm font-medium text-white font-bold border border-[#2a2a35] px-4 py-2 rounded-lg hover:bg-[#0a0a0f] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm font-medium text-red-400 border border-red-800/50 px-4 py-2 rounded-lg hover:bg-red-900/20 transition-colors"
            >
              Delete User
            </button>
          )}
        </div>
      </div>

      {/* Change Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setShowPlanModal(false); setPlanConfirmStep(false); }}>
          <div className="bg-[#16161e] border border-[#2a2a35] rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            {!planConfirmStep ? (
              <>
                <h3 className="text-lg font-bold text-white mb-2">Change Subscription Plan</h3>
                <p className="text-sm text-gray-400 mb-4">Current plan: <span className="text-white font-medium">{user.plan || 'FREE'}</span></p>
                <div className="space-y-2 mb-6">
                  {['FREE', 'PRO', 'TEAM'].map((plan) => (
                    <button
                      key={plan}
                      onClick={() => setSelectedPlan(plan)}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                        selectedPlan === plan
                          ? 'border-[#DC2626] bg-[#DC2626]/10 text-white'
                          : 'border-[#2a2a35] text-gray-300 hover:text-white hover:bg-[#0a0a0f]'
                      }`}
                    >
                      {plan}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPlanConfirmStep(true)}
                    disabled={actionLoading || selectedPlan === user.plan}
                    className="bg-[#DC2626] hover:bg-[#EF4444] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Update Plan
                  </button>
                  <button onClick={() => { setShowPlanModal(false); setPlanConfirmStep(false); }} className="text-sm text-gray-300 hover:text-white px-4 py-2 rounded-lg border border-[#2a2a35] hover:bg-[#0a0a0f] transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-2">Confirm Plan Change</h3>
                <p className="text-sm text-yellow-400 font-semibold mb-4">Are you sure you want to change this user&apos;s plan?</p>
                <div className="bg-[#0a0a0f] border border-[#2a2a35] rounded-lg p-4 space-y-3 text-sm mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current plan</span>
                    <span className="text-white font-medium">{user.plan || 'FREE'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">New plan</span>
                    <span className="text-white font-medium">{selectedPlan}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleChangePlan}
                    disabled={actionLoading}
                    className="bg-[#DC2626] hover:bg-[#EF4444] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Updating...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setPlanConfirmStep(false)}
                    className="text-sm text-gray-300 hover:text-white px-4 py-2 rounded-lg border border-[#2a2a35] hover:bg-[#0a0a0f] transition-colors"
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Grant Point Pack Modal */}
      {showGrantPackModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setShowGrantPackModal(false); setPackConfirmStep(false); }}>
          <div className="bg-[#16161e] border border-[#2a2a35] rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            {!packConfirmStep ? (
              <>
                <h3 className="text-lg font-bold text-white mb-2">Grant Point Pack</h3>
                <p className="text-sm text-gray-400 mb-4">Select a pack to credit to this user&apos;s wallet.</p>
                <div className="space-y-2 mb-6">
                  {pointPacks.map((pack) => (
                    <button
                      key={pack.id}
                      onClick={() => setSelectedPackId(pack.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                        selectedPackId === pack.id
                          ? 'border-emerald-500 bg-emerald-900/20 text-white'
                          : 'border-[#2a2a35] text-gray-300 hover:text-white hover:bg-[#0a0a0f]'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{pack.name}</span>
                        <span className="text-emerald-400">{pack.points} pts</span>
                      </div>
                      <span className="text-xs text-gray-400">${pack.price} {pack.currency}</span>
                    </button>
                  ))}
                  {pointPacks.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No point packs configured</p>}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPackConfirmStep(true)}
                    disabled={actionLoading || !selectedPackId}
                    className="bg-emerald-400 hover:bg-emerald-500 text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Grant Pack
                  </button>
                  <button onClick={() => { setShowGrantPackModal(false); setPackConfirmStep(false); }} className="text-sm text-gray-300 hover:text-white px-4 py-2 rounded-lg border border-[#2a2a35] hover:bg-[#0a0a0f] transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-2">Confirm Grant</h3>
                <p className="text-sm text-yellow-400 font-semibold mb-4">Are you sure you want to grant this pack?</p>
                <div className="bg-[#0a0a0f] border border-[#2a2a35] rounded-lg p-4 space-y-3 text-sm mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pack</span>
                    <span className="text-white font-medium">{pointPacks.find(p => p.id === selectedPackId)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Points</span>
                    <span className="text-emerald-400 font-medium">+{pointPacks.find(p => p.id === selectedPackId)?.points} pts</span>
                  </div>
                  <div className="border-t border-[#2a2a35] pt-3 flex justify-between">
                    <span className="text-gray-400">Approx. new balance</span>
                    <span className="text-white font-medium">{(user.walletBalance ?? 0) + (pointPacks.find(p => p.id === selectedPackId)?.points ?? 0)} pts</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGrantPack}
                    disabled={actionLoading}
                    className="bg-emerald-400 hover:bg-emerald-500 text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Granting...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setPackConfirmStep(false)}
                    className="text-sm text-gray-300 hover:text-white px-4 py-2 rounded-lg border border-[#2a2a35] hover:bg-[#0a0a0f] transition-colors"
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#16161e] border border-[#2a2a35] rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">Adjust Wallet Balance</h3>
            {!walletConfirmStep ? (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  Current balance: <span className="text-white font-medium">{user.walletBalance ?? 0} pts</span>
                </p>
                <form onSubmit={(e) => { e.preventDefault(); setWalletConfirmStep(true); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
                    <input
                      type="number"
                      step="1"
                      value={walletAmount}
                      onChange={(e) => setWalletAmount(e.target.value)}
                      required
                      placeholder="e.g., 50 or -25"
                      className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#52525b] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                    />
                    <p className="text-xs text-gray-500 mt-1">Use negative values to deduct</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Reason</label>
                    <input
                      type="text"
                      value={walletReason}
                      onChange={(e) => setWalletReason(e.target.value)}
                      required
                      placeholder="Reason for adjustment"
                      className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#52525b] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="bg-[#DC2626] hover:bg-[#EF4444] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Apply Adjustment
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowWalletModal(false); setWalletAmount(''); setWalletReason(''); setWalletConfirmStep(false); }}
                      className="text-sm text-gray-300 hover:text-white px-4 py-2 rounded-lg border border-[#2a2a35] hover:bg-[#0a0a0f] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-yellow-400 font-semibold">Are you sure you want to adjust this user&apos;s wallet?</p>
                <div className="bg-[#0a0a0f] border border-[#2a2a35] rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount</span>
                    <span className={`font-medium ${parseFloat(walletAmount) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {parseFloat(walletAmount) >= 0 ? '+' : ''}{Math.round(parseFloat(walletAmount))} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reason</span>
                    <span className="text-white font-medium truncate ml-4">{walletReason}</span>
                  </div>
                  <div className="border-t border-[#2a2a35] pt-3 flex justify-between">
                    <span className="text-gray-400">Approx. new balance</span>
                    <span className="text-white font-medium">{(user.walletBalance ?? 0) + Math.round(parseFloat(walletAmount))} pts</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleWalletAdjust()}
                    disabled={actionLoading}
                    className="bg-[#DC2626] hover:bg-[#EF4444] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Applying...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletConfirmStep(false)}
                    className="text-sm text-gray-300 hover:text-white px-4 py-2 rounded-lg border border-[#2a2a35] hover:bg-[#0a0a0f] transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
