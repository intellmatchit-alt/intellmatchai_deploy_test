/**
 * New Opportunity Page
 *
 * Step 1: Choose intent type (Hiring / Open to Opportunities)
 * Step 2: OpportunityForm handles the rest (upload/manual + form fields)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  PersonAdd24Regular,
  Briefcase24Regular,
} from '@fluentui/react-icons';
import { createOpportunity, CreateOpportunityInput, UpdateOpportunityInput, OpportunityIntentType } from '@/lib/api/opportunities';
import { createHiringProfile, CreateHiringProfileInput, createCandidateProfile, CreateCandidateProfileInput } from '@/lib/api/job-matching';
import OpportunityForm from '@/components/opportunities/OpportunityForm';
import HiringProfileForm from '@/components/opportunities/HiringProfileForm';
import CandidateProfileForm from '@/components/opportunities/CandidateProfileForm';
import { toast } from '@/components/ui/Toast';

export default function NewOpportunityPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [intentType, setIntentType] = useState<OpportunityIntentType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLegacySubmit = async (data: CreateOpportunityInput | UpdateOpportunityInput) => {
    setIsSubmitting(true);
    try {
      await createOpportunity(data as CreateOpportunityInput);
      toast({ title: 'Opportunity created', variant: 'success' });
      router.push('/opportunities');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHiringSubmit = async (data: CreateHiringProfileInput) => {
    setIsSubmitting(true);
    try {
      await createHiringProfile(data);
      toast({ title: 'Hiring profile created', variant: 'success' });
      router.push('/opportunities');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCandidateSubmit = async (data: CreateCandidateProfileInput) => {
    setIsSubmitting(true);
    try {
      await createCandidateProfile(data);
      toast({ title: 'Candidate profile created', variant: 'success' });
      router.push('/opportunities');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Choose intent type
  if (!intentType) {
    return (
      <div className="max-w-[760px] mx-auto px-5 py-7">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-th-text-s hover:text-th-text mb-3 transition-colors text-[0.95rem] font-bold"
        >
          <ArrowLeft24Regular className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-th-text mb-2">Create New Opportunity</h1>
        <p className="text-th-text-t mb-8">What type of opportunity are you creating?</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setIntentType('HIRING')}
            className="group p-6 bg-th-surface border border-th-border rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-start"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
              <PersonAdd24Regular className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-th-text mb-1">Hiring</h3>
            <p className="text-sm text-th-text-t">Looking to hire talent for your team</p>
          </button>

          <button
            onClick={() => setIntentType('OPEN_TO_OPPORTUNITIES')}
            className="group p-6 bg-th-surface border border-th-border rounded-xl hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-start"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:bg-emerald-500/30 transition-colors">
              <Briefcase24Regular className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-th-text mb-1">Open to Opportunities</h3>
            <p className="text-sm text-th-text-t">Exploring new career opportunities</p>
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Form (powered by shared OpportunityForm)
  const isHiring = intentType === 'HIRING';

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
            onClick={() => setIntentType(null)}
            className="flex items-center gap-2 text-th-text-s hover:text-th-text mb-3 transition-colors text-[0.95rem] font-bold"
          >
            <ArrowLeft24Regular className="w-4 h-4" />
            <span>Back</span>
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
                {isHiring ? 'Hiring' : 'Open to Opportunities'}
              </h1>
              <p className="text-[0.96rem] text-th-text-s mt-1.5 leading-relaxed font-medium">
                {isHiring
                  ? 'Create a clear opportunity so the right candidates, collaborators, or specialists can be matched faster.'
                  : 'Share your role preferences, strengths, and availability so the right opportunities can find you faster.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {intentType === 'HIRING' ? (
        <HiringProfileForm
          onSubmit={handleHiringSubmit}
          isLoading={isSubmitting}
          submitLabel="Create Hiring Profile"
        />
      ) : intentType === 'OPEN_TO_OPPORTUNITIES' ? (
        <CandidateProfileForm
          onSubmit={handleCandidateSubmit}
          isLoading={isSubmitting}
          submitLabel="Create Candidate Profile"
        />
      ) : (
        <OpportunityForm
          defaultIntentType={intentType}
          onSubmit={handleLegacySubmit}
          onCancel={() => setIntentType(null)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
