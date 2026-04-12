'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { getTransactions, getPointPacks, purchasePointPack } from '@/lib/api/wallet';
import type { WalletTransaction, PointPack } from '@/lib/api/wallet';
import { useWalletStore } from '@/stores/walletStore';
import { toast } from '@/components/ui/Toast';
import {
  ArrowUp24Regular,
  ArrowDown24Regular,
  Cart24Regular,
  Wallet24Regular,
} from '@fluentui/react-icons';

export default function WalletPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { balance, costs, fetchBalance } = useWalletStore();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pointPacks, setPointPacks] = useState<PointPack[]>([]);
  const [showPacks, setShowPacks] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const loadTransactions = useCallback(async (p: number) => {
    setIsLoading(true);
    try {
      const data = await getTransactions(p, 20);
      setTransactions(data.transactions);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    loadTransactions(1);
  }, [fetchBalance, loadTransactions]);

  // Handle return from payment gateway
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast({
        title: t.wallet?.purchaseSuccess || 'Payment completed!',
        description: t.wallet?.pointsWillBeAdded || 'Your points will be added shortly.',
      });
      // Refresh balance and transactions after a moment (callback may take a second)
      setTimeout(() => {
        fetchBalance();
        loadTransactions(1);
      }, 2000);
      // Clean URL
      window.history.replaceState({}, '', '/wallet');
    }
  }, [searchParams, t, fetchBalance, loadTransactions]);

  const loadPacks = async () => {
    if (pointPacks.length === 0) {
      try {
        const packs = await getPointPacks();
        setPointPacks(packs);
      } catch {
        // ignore
      }
    }
    setShowPacks(true);
  };

  const handlePurchase = async (packId: string) => {
    setPurchasing(packId);
    try {
      const result = await purchasePointPack(packId);

      // If we got a redirect URL, go to payment gateway
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }

      // Fallback: direct credit (if gateway not configured)
      if (result.balance !== undefined) {
        useWalletStore.getState().setBalance(result.balance);
        toast({
          title: t.wallet?.purchaseSuccess || 'Points purchased!',
          description: `+${result.pointsAdded} ${t.wallet?.points || 'points'}`,
        });
        setShowPacks(false);
        loadTransactions(1);
      }
    } catch (err: any) {
      toast({
        title: t.wallet?.purchaseFailed || 'Purchase failed',
        description: err?.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setPurchasing(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Balance Card */}
        <div className="bg-th-surface rounded-2xl p-6 border border-th-border text-center">
          <div className="flex items-center justify-center gap-2 text-th-text-s mb-2">
            <Wallet24Regular className="w-5 h-5" />
            <span className="text-sm">{t.wallet?.currentBalance || 'Current Balance'}</span>
          </div>
          <div className="text-5xl font-bold text-th-text">{Number.isInteger(balance) ? balance : balance.toFixed(2)}</div>
          <div className="text-sm text-th-text-t mt-1">{t.wallet?.points || 'points'}</div>

          <div className="flex gap-3 mt-4 justify-center text-xs text-th-text-s">
            <span>{t.wallet?.scanCost || 'Scan cost'}: {Number.isInteger(costs.scan) ? costs.scan : costs.scan.toFixed(2)} pts</span>
            <span>|</span>
            <span>{t.wallet?.importCost || 'Import cost'}: {Number.isInteger(costs.import) ? costs.import : costs.import.toFixed(2)} pts/contact</span>
            {costs.collaboration > 0 && (
              <>
                <span>|</span>
                <span>{(t.wallet as any)?.collaborationCost || 'Collaboration'}: {costs.collaboration} pts</span>
              </>
            )}
          </div>

          <button
            onClick={loadPacks}
            className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-medium transition-colors inline-flex items-center gap-2"
          >
            <Cart24Regular className="w-5 h-5" />
            {t.wallet?.buyPoints || 'Buy Points'}
          </button>
        </div>

        {/* Point Packs Modal */}
        {showPacks && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPacks(false)}>
            <div className="bg-th-bg-s rounded-2xl p-6 border border-emerald-500/30 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-th-text">{t.wallet?.pointPacks || 'Point Packs'}</h3>
              {pointPacks.map((pack) => (
                <div key={pack.id} className="flex items-center justify-between p-4 bg-th-bg-t rounded-xl border border-emerald-500/20">
                  <div>
                    <div className="font-semibold text-th-text">{pack.name}</div>
                    <div className="text-sm text-th-text-s">{pack.points} {t.wallet?.points || 'points'}</div>
                  </div>
                  <button
                    onClick={() => handlePurchase(pack.id)}
                    disabled={purchasing === pack.id}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {purchasing === pack.id ? '...' : `$${pack.price}`}
                  </button>
                </div>
              ))}
              {pointPacks.length === 0 && (
                <p className="text-th-text-s text-center py-4">{t.wallet?.noPacksAvailable || 'No point packs available'}</p>
              )}
              <button onClick={() => setShowPacks(false)} className="w-full py-2 text-th-text-s hover:text-th-text transition-colors">
                {t.common?.cancel || 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div>
          <h2 className="text-lg font-semibold text-th-text mb-3">{t.wallet?.transactionHistory || 'Transaction History'}</h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-th-surface rounded-xl animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-th-text-s">
              {t.wallet?.noTransactions || 'No transactions yet'}
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-3 bg-th-surface rounded-xl border border-th-border"
                >
                  <div className={`p-2 rounded-lg ${tx.type === 'CREDIT' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {tx.type === 'CREDIT' ? <ArrowUp24Regular className="w-5 h-5" /> : <ArrowDown24Regular className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-th-text truncate">{tx.description}</div>
                    <div className="text-xs text-th-text-t">{formatDate(tx.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${tx.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.type === 'CREDIT' ? '+' : ''}{Number.isInteger(tx.amount) ? tx.amount : tx.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-th-text-t">{t.wallet?.balanceAfter || 'Bal'}: {Number.isInteger(tx.balance) ? tx.balance : tx.balance.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => loadTransactions(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm bg-th-surface border border-th-border rounded-lg disabled:opacity-50 text-th-text hover:bg-th-surface-h transition-colors"
              >
                {t.common?.previous || 'Previous'}
              </button>
              <span className="px-3 py-1.5 text-sm text-th-text-s">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => loadTransactions(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm bg-th-surface border border-th-border rounded-lg disabled:opacity-50 text-th-text hover:bg-th-surface-h transition-colors"
              >
                {t.common?.next || 'Next'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
