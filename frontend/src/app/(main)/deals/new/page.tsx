/**
 * New Deal Page — Mode Chooser + SellForm / BuyForm
 *
 * Flow: Mode Chooser -> Sell Form OR Buy Form
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Money24Regular,
  Cart24Regular,
  ArrowRight24Regular,
  CheckmarkCircle24Regular,
} from '@fluentui/react-icons';
import {
  createDeal,
  calculateDealMatches,
  CreateDealInput,
  UpdateDealInput,
  DealMode,
} from '@/lib/api/deals';
import { toast } from '@/components/ui/Toast';
import { SellForm } from '@/components/deals/SellForm';
import { BuyForm } from '@/components/deals/BuyForm';

// ═════════════════════════════════════════════════════════════════════
// Mode Chooser Screen
// ═════════════════════════════════════════════════════════════════════
function ModeChooserScreen({ onSelect }: { onSelect: (mode: DealMode) => void }) {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900/30 via-th-bg-s to-emerald-900/20 border border-th-border p-6">
        <div className="absolute -top-10 -end-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <Link
            href="/deals"
            className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
          >
            <ArrowLeft24Regular className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-th-text">{t.deals?.createDeal || 'Create Deal'}</h1>
            <p className="text-sm text-th-text-t mt-1">{t.deals?.chooseModeDesc || 'What would you like to do?'}</p>
          </div>
        </div>
      </div>

      {/* Two big cards */}
      <div className="space-y-4">
        {/* SELL Card */}
        <button
          type="button"
          onClick={() => onSelect('SELL')}
          className="group relative w-full overflow-hidden p-6 rounded-2xl text-start transition-all border border-th-border hover:border-emerald-500/40 bg-th-surface hover:bg-gradient-to-br hover:from-emerald-500/10 hover:to-green-500/5 hover:shadow-lg hover:shadow-emerald-500/5"
        >
          <div className="absolute -top-8 -end-8 w-24 h-24 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="relative flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/25 transition-colors">
              <Money24Regular className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-th-text">{t.deals?.iWantToSell || 'I Want to Sell'}</h2>
                <ArrowRight24Regular className="w-5 h-5 text-th-text-m group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-th-text-t mt-1">
                {t.deals?.sellChooserDesc || 'Find potential buyers, decision makers, and clients in your network'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  t.deals?.sellBullet1 || 'Define your product or service',
                  t.deals?.sellBullet2 || 'Describe your target market',
                  t.deals?.sellBullet3 || 'Set your ideal buyer profile',
                ].map((text) => (
                  <span key={text} className="inline-flex items-center gap-1 text-xs text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckmarkCircle24Regular className="w-3 h-3" />
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </button>

        {/* BUY Card */}
        <button
          type="button"
          onClick={() => onSelect('BUY')}
          className="group relative w-full overflow-hidden p-6 rounded-2xl text-start transition-all border border-th-border hover:border-blue-500/40 bg-th-surface hover:bg-gradient-to-br hover:from-blue-500/10 hover:to-cyan-500/5 hover:shadow-lg hover:shadow-blue-500/5"
        >
          <div className="absolute -top-8 -end-8 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all" />
          <div className="relative flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/25 transition-colors">
              <Cart24Regular className="w-7 h-7 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-th-text">{t.deals?.iWantToBuy || 'I Want to Buy'}</h2>
                <ArrowRight24Regular className="w-5 h-5 text-th-text-m group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-th-text-t mt-1">
                {t.deals?.buyChooserDesc || 'Find solution providers, consultants, and partners in your network'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  t.deals?.buyBullet1 || 'Describe what you need',
                  t.deals?.buyBullet2 || 'Set your requirements',
                  t.deals?.buyBullet3 || 'Define budget & timeline',
                ].map((text) => (
                  <span key={text} className="inline-flex items-center gap-1 text-xs text-blue-400/80 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    <CheckmarkCircle24Regular className="w-3 h-3" />
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Form Header
// ═════════════════════════════════════════════════════════════════════
function FormHeader({ mode, onBack }: { mode: DealMode; onBack: () => void }) {
  const { t } = useI18n();
  const isSell = mode === 'SELL';

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${
      isSell ? 'from-emerald-900/30 via-th-bg-s to-green-900/20 border-emerald-500/20' : 'from-blue-900/30 via-th-bg-s to-cyan-900/20 border-blue-500/20'
    } border p-6`}>
      <div className={`absolute -top-10 -end-10 w-32 h-32 ${isSell ? 'bg-emerald-500/15' : 'bg-blue-500/15'} rounded-full blur-3xl`} />
      <div className="relative flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
        >
          <ArrowLeft24Regular className="w-6 h-6" />
        </button>
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
  );
}

// ═════════════════════════════════════════════════════════════════════
// Main Page
// ═════════════════════════════════════════════════════════════════════
export default function NewDealPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<DealMode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: CreateDealInput | UpdateDealInput) => {
    setIsSubmitting(true);
    try {
      const deal = await createDeal(data as CreateDealInput);
      toast({ title: t.deals?.created || 'Deal created successfully', variant: 'success' });
      try { await calculateDealMatches(deal.id); } catch {}
      router.push(`/deals/${deal.id}`);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (selectedMode) {
      setSelectedMode(null);
    } else {
      router.push('/deals');
    }
  };

  if (!selectedMode) {
    return <ModeChooserScreen onSelect={setSelectedMode} />;
  }

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <FormHeader mode={selectedMode} onBack={() => setSelectedMode(null)} />
      {selectedMode === 'SELL' ? (
        <SellForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      ) : (
        <BuyForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
