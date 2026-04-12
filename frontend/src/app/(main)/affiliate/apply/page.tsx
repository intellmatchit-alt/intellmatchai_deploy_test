'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { getAffiliateTerms, applyAsAffiliate, getMyAffiliate } from '@/lib/api/affiliate';
import {
  Checkmark24Regular,
  Clock24Regular,
  Dismiss24Regular,
  Warning24Regular,
} from '@fluentui/react-icons';

export default function AffiliateApplyPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [terms, setTerms] = useState({ termsContent: '', policyContent: '', enabled: false });
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [affiliate, setAffiliate] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      getAffiliateTerms(),
      getMyAffiliate().catch(() => null),
    ]).then(([termsRes, affRes]) => {
      setTerms(termsRes || { termsContent: '', policyContent: '', enabled: false });
      const aff = affRes;
      if (aff?.status === 'APPROVED') {
        router.replace('/affiliate');
        return;
      }
      setAffiliate(aff);
    }).finally(() => setLoading(false));
  }, [router]);

  const handleApply = async () => {
    if (!accepted) return;
    setApplying(true);
    try {
      const res = await applyAsAffiliate();
      setAffiliate(res);
      if (res?.status === 'APPROVED') {
        router.replace('/affiliate');
      }
    } catch {
      // Error handled
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Already applied — show status
  if (affiliate) {
    const statusConfig: Record<string, { icon: any; color: string; title: string; desc: string }> = {
      PENDING: { icon: Clock24Regular, color: 'text-yellow-400', title: 'Application Pending', desc: 'Your affiliate application is under review. We will notify you once it is approved.' },
      REJECTED: { icon: Dismiss24Regular, color: 'text-red-400', title: 'Application Rejected', desc: 'Unfortunately, your affiliate application was not approved.' },
      SUSPENDED: { icon: Warning24Regular, color: 'text-orange-400', title: 'Account Suspended', desc: affiliate.suspendedReason || 'Your affiliate account has been suspended.' },
    };
    const config = statusConfig[affiliate.status];
    if (!config) return null;
    const StatusIcon = config.icon;

    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6 animate-fade-in">
        <div className={`w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 ${config.color}`}>
          <StatusIcon className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{config.title}</h2>
        <p className="text-white font-bold max-w-md">{config.desc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="text-center pt-2">
        <h1 className="text-2xl font-bold text-white">Join Affiliate Program</h1>
        <p className="text-white font-bold mt-2 max-w-md mx-auto">Earn commissions by referring new users to IntellMatch. Share your unique codes and track your earnings.</p>
      </div>

      {/* Terms */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="font-bold text-white mb-3">Terms & Conditions</h3>
        <div className="text-sm text-white font-bold leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto pr-2">
          {terms.termsContent || 'No terms available.'}
        </div>
      </div>

      {/* Policy */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="font-bold text-white mb-3">Affiliate Policy</h3>
        <div className="text-sm text-white font-bold leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto pr-2">
          {terms.policyContent || 'No policy available.'}
        </div>
      </div>

      {/* Accept Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer px-1">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 w-5 h-5 rounded border-white/20 bg-white/5 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
        />
        <span className="text-sm text-white/80">
          I have read and accept the affiliate terms & conditions and policy
        </span>
      </label>

      {/* Apply Button */}
      <button
        onClick={handleApply}
        disabled={!accepted || applying}
        className="w-full py-3.5 rounded-xl bg-emerald-400 text-[#042820] font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
      >
        {applying ? 'Submitting...' : 'Apply Now'}
      </button>
    </div>
  );
}
