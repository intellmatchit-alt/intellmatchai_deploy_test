/**
 * Edit Deal Page — Pre-populated SellForm or BuyForm based on deal.mode
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Money24Regular,
  Cart24Regular,
} from '@fluentui/react-icons';
import {
  getDeal,
  updateDeal,
  calculateDealMatches,
  Deal,
  CreateDealInput,
  UpdateDealInput,
} from '@/lib/api/deals';
import { toast } from '@/components/ui/Toast';
import { SellForm } from '@/components/deals/SellForm';
import { BuyForm } from '@/components/deals/BuyForm';

// ─── Loading Skeleton ───────────────────────────────────────────────
function FormSkeleton() {
  return (
    <div className="space-y-5 animate-pulse pb-20">
      <div className="h-24 rounded-2xl bg-th-surface border border-th-border" />
      <div className="h-48 rounded-xl bg-th-surface border border-th-border" />
      <div className="h-64 rounded-xl bg-th-surface border border-th-border" />
      <div className="h-48 rounded-xl bg-th-surface border border-th-border" />
      <div className="h-14 rounded-xl bg-th-surface border border-th-border" />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Edit Page
// ═════════════════════════════════════════════════════════════════════
export default function EditDealPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load deal data
  useEffect(() => {
    (async () => {
      try {
        const d = await getDeal(dealId);
        setDeal(d);
      } catch {
        toast({ title: t.deals?.dealNotFound || 'Deal not found', variant: 'error' });
        router.push('/deals');
      } finally {
        setLoading(false);
      }
    })();
  }, [dealId]);

  const handleSubmit = async (data: CreateDealInput | UpdateDealInput) => {
    setIsSubmitting(true);
    try {
      await updateDeal(dealId, data as UpdateDealInput);
      toast({ title: t.deals?.updated || 'Deal updated successfully', variant: 'success' });
      try { await calculateDealMatches(dealId); } catch {}
      router.push(`/deals/${dealId}`);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(`/deals/${dealId}`);
  };

  if (loading) return <FormSkeleton />;
  if (!deal) return null;

  const isSell = deal.mode === 'SELL';

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      {/* Header — matches FormHeader from create page */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${
        isSell ? 'from-emerald-900/30 via-th-bg-s to-green-900/20 border-emerald-500/20' : 'from-blue-900/30 via-th-bg-s to-cyan-900/20 border-blue-500/20'
      } border p-6`}>
        <div className={`absolute -top-10 -end-10 w-32 h-32 ${isSell ? 'bg-emerald-500/15' : 'bg-blue-500/15'} rounded-full blur-3xl`} />
        <div className="relative flex items-center gap-4">
          <Link
            href={`/deals/${dealId}`}
            className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
          >
            <ArrowLeft24Regular className="w-6 h-6" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {isSell
                ? <Money24Regular className="w-5 h-5 text-emerald-400" />
                : <Cart24Regular className="w-5 h-5 text-blue-400" />}
              <h1 className="text-xl font-bold text-th-text">
                {isSell ? (t.deals?.iWantToSell || 'I Want to Sell') : (t.deals?.iWantToBuy || 'I Want to Buy')}
              </h1>
            </div>
            <p className="text-sm text-th-text-t mt-1">
              {isSell
                ? (t.deals?.sellFormDesc || "Define what you're offering and who should buy it")
                : (t.deals?.buyFormDesc || "Describe what you need and we'll find the right people")}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      {isSell ? (
        <SellForm
          deal={deal}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      ) : (
        <BuyForm
          deal={deal}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
