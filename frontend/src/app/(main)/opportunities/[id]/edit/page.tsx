/**
 * Edit Opportunity Page
 *
 * Edit an existing opportunity.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  ArrowSync24Regular,
  PersonAdd24Regular,
  Briefcase24Regular,
} from '@fluentui/react-icons';
import {
  getOpportunity,
  updateOpportunity,
  Opportunity,
  UpdateOpportunityInput,
} from '@/lib/api/opportunities';
import OpportunityForm from '@/components/opportunities/OpportunityForm';
import { toast } from '@/components/ui/Toast';

export default function EditOpportunityPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const opportunityId = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load opportunity
  useEffect(() => {
    async function loadOpportunity() {
      try {
        setLoading(true);
        const data = await getOpportunity(opportunityId);
        setOpportunity(data);
      } catch (error: any) {
        toast({
          title: t.common?.error || 'Error',
          description: error.message || 'Failed to load opportunity',
          variant: 'error',
        });
        router.push('/opportunities');
      } finally {
        setLoading(false);
      }
    }
    loadOpportunity();
  }, [opportunityId, router, t]);

  const handleSubmit = async (data: UpdateOpportunityInput) => {
    try {
      setIsSubmitting(true);
      await updateOpportunity(opportunityId, data);
      toast({
        title: t.opportunities?.updated || 'Opportunity updated',
        description: t.opportunities?.updatedDesc || 'Your opportunity has been updated successfully',
        variant: 'success',
      });
      router.push('/opportunities');
    } catch (error: any) {
      toast({
        title: t.common?.error || 'Error',
        description: error.message || 'Failed to update opportunity',
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!opportunity) {
    return null;
  }

  const isHiring = opportunity.intentType === 'HIRING';

  return (
    <div className="max-w-[760px] mx-auto px-5 py-7 pb-32">
      {/* Hero Summary Card */}
      <div className={`relative border-2 border-white/[0.12] rounded-3xl shadow-lg overflow-hidden mb-5 ${
        isHiring
          ? 'bg-[radial-gradient(circle_at_right_center,rgba(77,163,255,0.10),transparent_34%),linear-gradient(180deg,rgba(10,30,52,0.96),rgba(8,24,42,0.98))]'
          : 'bg-[radial-gradient(circle_at_right_center,rgba(24,210,164,0.10),transparent_34%),linear-gradient(180deg,rgba(10,30,52,0.96),rgba(8,24,42,0.98))]'
      }`}>
        {/* Top gradient border line */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-3xl ${
          isHiring
            ? 'bg-gradient-to-r from-blue-500 to-emerald-500'
            : 'bg-gradient-to-r from-emerald-500 to-blue-500'
        }`} />

        <div className="p-5 pt-6">
          {/* Back link */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-th-text-s hover:text-th-text mb-3 transition-colors text-[0.95rem] font-bold"
          >
            <ArrowLeft24Regular className="w-4 h-4" />
            <span>{t.common?.back || 'Back'}</span>
          </button>

          {/* Header row */}
          <div className="flex items-start gap-3.5">
            <div className={`w-[42px] h-[42px] rounded-[14px] flex items-center justify-center flex-shrink-0 border ${
              isHiring
                ? 'bg-blue-500/[0.12] border-blue-500/25 text-blue-400'
                : 'bg-emerald-500/[0.12] border-emerald-500/25 text-emerald-400'
            }`}>
              {isHiring
                ? <PersonAdd24Regular className="w-5 h-5" />
                : <Briefcase24Regular className="w-5 h-5" />
              }
            </div>
            <div>
              <h1 className="text-[1.55rem] leading-tight tracking-tight font-extrabold text-th-text">
                {isHiring ? 'Edit Hiring' : 'Edit Opportunity'}
              </h1>
              <p className="text-[0.96rem] text-th-text-s mt-1.5 leading-relaxed font-medium">
                {opportunity.title}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form — no outer card wrapper, sections provide their own cards */}
      <OpportunityForm
        opportunity={opportunity}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
