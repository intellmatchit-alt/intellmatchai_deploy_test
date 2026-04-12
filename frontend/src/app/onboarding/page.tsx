/**
 * Onboarding Page - 6 Step Flow
 *
 * Multi-step onboarding wizard with AI-powered profile enrichment.
 * Steps:
 * 1. Social & CV Collection (LinkedIn, X, CV upload)
 * 2. Profile (company, job title, location)
 * 3. Sectors
 * 4. Skills & Interests
 * 5. Projects (optional project ideas)
 * 6. Objectives
 */

'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDetectedCountry } from '@/hooks/useDetectedCountry';
import { toast } from '@/components/ui/Toast';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { api, getAccessToken } from '@/lib/api/client';
import { createProject, extractFromDocument, STAGE_OPTIONS, LOOKING_FOR_OPTIONS, ProjectStage, SkillImportance } from '@/lib/api/projects';
import { createDeal, getDeals, updateDeal, deleteDeal, extractDealFromDocument, CreateDealInput, DealMode, DealCompanySize, DealTargetEntityType, COMPANY_SIZE_OPTIONS, TARGET_ENTITY_OPTIONS, Deal } from '@/lib/api/deals';
import { uploadPitch, extractPitchFromDocument, listPitches, deletePitch, Pitch } from '@/lib/api/pitch';
import { createOpportunity, listOpportunities, updateOpportunity, deleteOpportunity, extractJobFromDocument, CreateOpportunityInput, Opportunity, SeniorityLevel } from '@/lib/api/opportunities';
import {
  Briefcase24Regular,
  Person24Regular,
  Location24Regular,
  ArrowRight24Regular,
  ArrowLeft24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  ArrowUpload24Regular,
  DocumentText24Regular,
  Sparkle24Regular,
  Edit16Regular,
  Edit24Regular,
  FullScreenMaximize24Regular,
  Lightbulb24Regular,
  Add24Regular,
  Delete24Regular,
  Rocket24Regular,
  Document24Regular,
  ArrowSync24Regular,
  Star24Filled,
  Tag24Regular,
  People24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  Save24Regular,
  Copy24Regular,
  Share24Regular,
  Handshake24Regular,
  SlideText24Regular,
  Info16Regular,
} from '@fluentui/react-icons';

// Editable indicator component - shows when field has content
const EditableIndicator = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="absolute -top-2 end-2 flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-[10px] text-emerald-400 z-10">
      <Edit16Regular className="w-3 h-3" />
      <span>Editable</span>
    </div>
  );
};

// LinkedIn icon component
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// X (Twitter) icon component
const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// Animated gradient orbs component
const GradientOrbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
  </div>
);

/**
 * Bio Preview Dialog - Full screen bio editor with tabs
 */
function BioPreviewDialog({
  isOpen,
  onClose,
  bioSummary,
  bioFull,
  activeBioTab,
  bioDirection = 'ltr',
  onBioSummaryChange,
  onBioFullChange,
  onBioTabChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  bioSummary: string;
  bioFull: string;
  activeBioTab: 'summary' | 'full';
  bioDirection?: 'rtl' | 'ltr';
  onBioSummaryChange: (bio: string) => void;
  onBioFullChange: (bio: string) => void;
  onBioTabChange: (tab: 'summary' | 'full') => void;
}) {
  const { t, lang } = useI18n();
  const [localSummary, setLocalSummary] = useState(bioSummary);
  const [localFull, setLocalFull] = useState(bioFull);
  const [localTab, setLocalTab] = useState(activeBioTab);

  // Detect RTL: check language setting, bioDirection prop, or Arabic content in bio
  const hasArabicContent = /[\u0600-\u06FF]/.test((localFull || localSummary || bioFull || bioSummary).slice(0, 100));
  const isRtl = lang === 'ar' || bioDirection === 'rtl' || hasArabicContent;

  useEffect(() => {
    setLocalSummary(bioSummary);
    setLocalFull(bioFull);
    setLocalTab(activeBioTab);
  }, [bioSummary, bioFull, activeBioTab]);

  const handleSave = () => {
    onBioSummaryChange(localSummary);
    onBioFullChange(localFull);
    onBioTabChange(localTab);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <div>
            <h3 className="text-lg font-semibold text-th-text">
              {t.onboarding.cvBio?.bio || 'Professional Bio'}
            </h3>
            <p className="text-sm text-th-text-s mt-0.5">
              {t.onboarding.bioPreview?.subtitle || 'Write a compelling summary of your professional background'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-th-text-t hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors"
          >
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Bio Tabs */}
          <div className={`flex gap-1 mb-4 p-1 bg-th-surface rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button
              type="button"
              onClick={() => setLocalTab('summary')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                localTab === 'summary'
                  ? 'bg-emerald-500 text-white'
                  : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
              }`}
            >
              {t.onboarding.cvBio?.summarized || 'Summarized'}
            </button>
            <button
              type="button"
              onClick={() => setLocalTab('full')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                localTab === 'full'
                  ? 'bg-emerald-500 text-white'
                  : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
              }`}
            >
              {t.onboarding.cvBio?.fullBio || 'Full Bio'}
            </button>
          </div>

          {localTab === 'summary' ? (
            <>
              <textarea
                value={localSummary}
                onChange={(e) => setLocalSummary(e.target.value)}
                placeholder={t.onboarding.cvBio?.summaryPlaceholder || 'Key highlights of your professional background...'}
                maxLength={300}
                dir={bioDirection}
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                className="w-full h-[280px] px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-base leading-relaxed"
                autoFocus
              />
              <div className={`flex items-center justify-between mt-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <p className="text-xs text-th-text-t">
                  {t.onboarding.cvBio?.summaryTipLong || 'Tip: Focus on key achievements and unique value proposition'}
                </p>
                <p className={`text-xs ${localSummary.length > 270 ? 'text-yellow-400' : 'text-th-text-m'}`}>
                  {localSummary.length}/300 {t.onboarding.bioPreview?.characters || 'characters'}
                </p>
              </div>
            </>
          ) : (
            <>
              <textarea
                value={localFull}
                onChange={(e) => setLocalFull(e.target.value)}
                placeholder={t.onboarding.cvBio?.fullPlaceholder || 'Detailed professional background, experience, and achievements...'}
                maxLength={2000}
                dir={bioDirection}
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                className="w-full h-[280px] px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-base leading-relaxed"
                autoFocus
              />
              <div className={`flex items-center justify-between mt-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <p className="text-xs text-th-text-t">
                  {t.onboarding.cvBio?.fullTipLong || 'Tip: Include detailed experience, education, and career highlights'}
                </p>
                <p className={`text-xs ${localFull.length > 1800 ? 'text-yellow-400' : 'text-th-text-m'}`}>
                  {localFull.length}/2000 {t.onboarding.bioPreview?.characters || 'characters'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-th-border bg-th-surface">
          <div className="flex items-center gap-2">
            {(localTab === 'summary' ? localSummary : localFull) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const text = localTab === 'summary' ? localSummary : localFull;
                    navigator.clipboard.writeText(text);
                    toast.success(t.onboarding.cvBio?.copiedToClipboard || 'Copied to clipboard');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-th-text-s hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors"
                >
                  <Copy24Regular className="w-4 h-4" />
                  {t.onboarding.cvBio?.copyBio || 'Copy'}
                </button>
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button
                    type="button"
                    onClick={() => {
                      const text = localTab === 'summary' ? localSummary : localFull;
                      navigator.share({ text }).catch(() => {});
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-th-text-s hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors"
                  >
                    <Share24Regular className="w-4 h-4" />
                    {t.onboarding.cvBio?.shareBio || 'Share'}
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-th-text-s hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors"
            >
              {t.common?.cancel || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
            >
              {t.common?.save || 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SuggestedItem {
  id: string;
  name: string;
  nameAr?: string;
  isCustom: boolean;
  confidence: number;
}

interface SuggestedGoal {
  id: string;
  name: string;
  description: string;
  confidence: number;
}

interface EnrichmentData {
  profile: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    jobTitle?: string;
    location?: string;
    email?: string;
    phone?: string;
  };
  generatedBio?: string;
  bioDirection?: 'rtl' | 'ltr';
  detectedLanguage?: string;
  suggestedSectors: SuggestedItem[];
  suggestedSkills: SuggestedItem[];
  suggestedInterests: SuggestedItem[];
  suggestedHobbies: SuggestedItem[];
  suggestedGoals?: SuggestedGoal[];
}

/**
 * Step indicator component
 */
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const { t } = useI18n();

  const STEPS = [
    { id: 'objectives', title: t.onboarding.steps.objectives?.title || 'Goals', description: t.onboarding.steps.objectives?.description || 'What you seek' },
    { id: 'social', title: t.onboarding.steps.socialMedia?.title || 'Social & CV', description: t.onboarding.steps.socialMedia?.description || 'Connect profiles' },
    { id: 'profile', title: t.onboarding.steps.profile?.title || 'Profile', description: t.onboarding.steps.profile?.description || 'Your details' },
    { id: 'sectors', title: t.onboarding.steps.sectors?.title || 'Sectors', description: t.onboarding.steps.sectors?.description || 'Your industry' },
    { id: 'skills', title: t.onboarding.steps.skills?.title || 'Skills', description: t.onboarding.steps.skills?.description || 'Your expertise' },
    { id: 'features', title: t.onboarding.featureCards?.sectionTitle || t.onboarding.steps.projects?.title || 'Features', description: t.onboarding.steps.projects?.description || 'Your tools' },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-1 mb-4">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                index <= currentStep
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : 'bg-th-surface-h'
              }`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-th-text">{STEPS[currentStep].title}</p>
          <p className="text-sm text-th-text-s">{STEPS[currentStep].description}</p>
        </div>
        <div className="text-sm text-th-text-s">
          {t.onboarding.stepOf?.replace('{current}', String(currentStep + 1)).replace('{total}', String(totalSteps)) || `Step ${currentStep + 1} of ${totalSteps}`}
        </div>
      </div>
    </div>
  );
}

/**
 * Step 1: Social & CV Collection
 */
function SocialCVStep({
  data,
  onChange,
  cvFile,
  onCVChange,
  isProcessing,
  showValidation,
  enhanceWithWebSearch,
  onEnhanceWithWebSearchChange,
}: {
  data: { linkedinUrl: string; twitterUrl: string; phone: string; bio: string };
  onChange: (data: any) => void;
  cvFile: File | null;
  onCVChange: (file: File | null) => void;
  isProcessing: boolean;
  showValidation?: boolean;
  enhanceWithWebSearch: boolean;
  onEnhanceWithWebSearchChange: (enabled: boolean) => void;
}) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const detectedCountry = useDetectedCountry();

  // Phone validation helper
  const isValidPhone = (phone: string) => {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  // Show error if touched OR if form was submitted (showValidation)
  const shouldShowError = phoneTouched || showValidation;
  const phoneError = shouldShowError && data.phone && !isValidPhone(data.phone);
  const phoneMissing = shouldShowError && !data.phone;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const isValidFileType = (file: File) => {
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', // Some browsers send this for unknown types
      '', // Some browsers don't set MIME type
    ];
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    const hasValidType = validTypes.includes(file.type);

    // Accept if either type or extension is valid
    return hasValidExtension || hasValidType;
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const validateFile = (file: File): string | null => {
    console.log('Validating file:', { name: file.name, size: file.size, type: file.type });

    if (!file.size || file.size === 0) {
      console.log('File size is 0 or undefined');
      return t.onboarding.cvBio?.emptyFileDesc || 'The selected file appears to be empty. Please try re-downloading or re-saving the file.';
    }
    if (file.size > MAX_FILE_SIZE) {
      console.log('File too large:', file.size);
      return t.onboarding.cvBio?.fileTooLarge || 'File is too large. Maximum size is 5MB';
    }
    if (!isValidFileType(file)) {
      console.log('Invalid file type:', file.type, file.name);
      return t.onboarding.cvBio?.invalidTypeDesc || 'Please upload a PDF, DOC, or DOCX file';
    }
    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      toast({
        title: t.onboarding.cvBio?.uploadError || 'Upload error',
        description: error,
        variant: 'error',
      });
      return;
    }

    onCVChange(file);
  }, [onCVChange, t]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    // Debug logging
    console.log('File selected:', {
      name: file?.name,
      size: file?.size,
      type: file?.type,
      lastModified: file?.lastModified,
    });

    if (!file) {
      console.log('No file in input');
      return;
    }

    const error = validateFile(file);
    if (error) {
      console.log('File validation error:', error);
      toast({
        title: t.onboarding.cvBio?.uploadError || 'Upload error',
        description: error,
        variant: 'error',
      });
      // Reset the input so the same file can be selected again
      e.target.value = '';
      return;
    }

    console.log('File passed validation, calling onCVChange');
    onCVChange(file);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-th-text-s mb-4">
        {t.onboarding.socialCVStep?.description || 'Add your social profiles and CV to auto-fill your profile with AI'}
      </p>

      {/* LinkedIn */}
      <div>
        <label className="block text-sm font-medium text-neutral-100 mb-2">
          {t.onboarding.socialMedia?.linkedinUrl || 'LinkedIn Profile URL'} <span className="text-th-text-t">{t.onboarding.socialMedia?.optional || '(Optional)'}</span>
        </label>
        <div className="relative">
          <EditableIndicator show={!!data.linkedinUrl} />
          <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
            <LinkedInIcon className="w-5 h-5 text-[#0A66C2]" />
          </div>
          <input
            type="url"
            placeholder={t.onboarding.socialMedia?.linkedinPlaceholder || 'https://linkedin.com/in/yourprofile'}
            value={data.linkedinUrl}
            onChange={(e) => onChange({ ...data, linkedinUrl: e.target.value })}
            disabled={isProcessing}
            className="w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all disabled:opacity-50"
          />
        </div>
        <p className="mt-1 text-xs text-th-text-t">{t.onboarding.socialMedia?.linkedinHelp || 'Helps us find relevant professional connections and verify your background'}</p>
        <p className="text-[10px] text-th-text-t">{t.onboarding.socialMedia?.linkedinTrust || '🔒 We only read public profile info. Never post on your behalf.'}</p>
      </div>

      {/* X (Twitter) */}
      <div>
        <label className="block text-sm font-medium text-neutral-100 mb-2">
          {t.onboarding.socialMedia?.twitterUrl || 'X (Twitter) Profile URL'} <span className="text-th-text-t">{t.onboarding.socialMedia?.optional || '(Optional)'}</span>
        </label>
        <div className="relative">
          <EditableIndicator show={!!data.twitterUrl} />
          <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
            <XIcon className="w-5 h-5 text-th-text" />
          </div>
          <input
            type="url"
            placeholder={t.onboarding.socialMedia?.twitterPlaceholder || 'https://x.com/yourhandle'}
            value={data.twitterUrl}
            onChange={(e) => onChange({ ...data, twitterUrl: e.target.value })}
            disabled={isProcessing}
            className="w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all disabled:opacity-50"
          />
        </div>
        <p className="mt-1 text-xs text-th-text-t">{t.onboarding.socialMedia?.twitterHelp || 'Helps us understand your interests and find like-minded professionals'}</p>
        <p className="text-[10px] text-th-text-t">{t.onboarding.socialMedia?.twitterTrust || '🔒 Read-only access. We never post or interact on your behalf.'}</p>
      </div>

      {/* Phone - Mandatory */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-neutral-100">
            {t.onboarding.profile?.phone || 'Phone Number'}
          </label>
          <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[10px] font-medium text-red-400">
            Required
          </span>
        </div>
        <div className="relative">
          <EditableIndicator show={!!data.phone && isValidPhone(data.phone)} />
          <PhoneInput
            value={data.phone}
            onChange={(phone) => onChange({ ...data, phone })}
            onBlur={() => setPhoneTouched(true)}
            disabled={isProcessing}
            error={phoneError || phoneMissing}
            placeholder="50 123 4567"
            defaultCountry={detectedCountry}
            required
          />
        </div>
        {phoneError && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            {t.onboarding.validation?.invalidPhone || 'Please enter a valid phone number'}
          </p>
        )}
        {phoneMissing && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            {t.onboarding.validation?.phoneRequired || 'Phone number is required'}
          </p>
        )}
        {!phoneError && !phoneMissing && (
          <>
            <p className="mt-1 text-xs text-th-text-t">{t.onboarding.profile?.phoneHelp || 'For account security and important notifications only'}</p>
            <p className="text-[10px] text-th-text-t">{t.onboarding.profile?.phoneTrust || '🔒 Never shared publicly. Used only for account verification.'}</p>
          </>
        )}
      </div>

      {/* CV Upload */}
      <div>
        <label className="block text-sm font-medium text-neutral-100 mb-2">
          {t.onboarding.cvBio?.uploadCv || 'Upload CV'} <span className="text-th-text-t">{t.onboarding.socialMedia?.optional || '(Optional)'}</span>
        </label>
        <p className="text-xs text-th-text-t mb-2">{t.onboarding.cvBio?.uploadCvHelp || 'AI extracts your info to save time. You can edit everything after.'}</p>
        <p className="text-[10px] text-th-text-t mb-3">{t.onboarding.cvBio?.uploadCvTrust || '🔒 Your CV is processed securely and never shared with anyone.'}</p>

        {!cvFile ? (
          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative cursor-pointer border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-white/20 hover:border-white/40 hover:bg-th-surface'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isProcessing}
            />
            <ArrowUpload24Regular className="w-7 h-7 mx-auto text-th-text-t mb-2" />
            <p className="text-th-text-s text-sm">{t.onboarding.cvBio?.dragDropCv || 'Drag and drop or click to browse'}</p>
            <p className="text-xs text-th-text-t mt-1">{t.onboarding.cvBio?.supportedFormats || 'PDF, DOC, DOCX (Max 5MB)'}</p>
          </div>
        ) : (
          <div className="bg-th-surface border border-th-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <DocumentText24Regular className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-th-text font-medium text-sm">{cvFile.name}</p>
                  <p className="text-xs text-th-text-t">
                    {cvFile.size < 1024
                      ? `${cvFile.size} B`
                      : cvFile.size < 1024 * 1024
                        ? `${(cvFile.size / 1024).toFixed(1)} KB`
                        : `${(cvFile.size / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                </div>
              </div>
              {!isProcessing && (
                <button
                  type="button"
                  onClick={() => onCVChange(null)}
                  className="p-2 text-th-text-t hover:text-red-400 transition-colors"
                >
                  <Dismiss24Regular className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Web Search Enhancement Toggle - appears when CV is uploaded */}
      {cvFile && (
        <div className="mt-3 p-3 bg-gradient-to-r from-emerald-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={enhanceWithWebSearch}
                onChange={(e) => onEnhanceWithWebSearchChange(e.target.checked)}
                disabled={isProcessing}
                className="sr-only"
              />
              <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${
                enhanceWithWebSearch ? 'bg-emerald-500' : 'bg-th-surface-h'
              } ${isProcessing ? 'opacity-50' : ''}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
                  enhanceWithWebSearch ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-th-text">
                  {t.onboarding.enhanceWithWebSearch?.title || 'Enhance with Online Search'}
                </span>
                <span className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-[10px] font-medium text-emerald-400">
                  Beta
                </span>
              </div>
              <p className="text-xs text-th-text-t mt-1">
                {t.onboarding.enhanceWithWebSearch?.description || 'Search the web for additional information about you to enrich your profile with the latest data'}
              </p>
            </div>
          </label>
        </div>
      )}

      <p className="text-xs text-th-text-t mt-4 flex items-center gap-1">
        <Sparkle24Regular className="w-4 h-4" />
        {t.onboarding.aiNote || 'AI will analyze your data and suggest profile information'}
      </p>
    </div>
  );
}

/**
 * Step 2: Profile Info
 */
function ProfileStep({
  profile,
  bioSummary,
  bioFull,
  activeBioTab,
  bioDirection = 'ltr',
  onProfileChange,
  onBioSummaryChange,
  onBioFullChange,
  onBioTabChange,
  errors = {},
}: {
  profile: { company: string; jobTitle: string; city: string; country: string };
  bioSummary: string;
  bioFull: string;
  activeBioTab: 'summary' | 'full';
  bioDirection?: 'rtl' | 'ltr';
  onProfileChange: (data: any) => void;
  onBioSummaryChange: (bio: string) => void;
  onBioFullChange: (bio: string) => void;
  onBioTabChange: (tab: 'summary' | 'full') => void;
  errors?: Record<string, string>;
}) {
  const { t, lang } = useI18n();
  const [isBioDialogOpen, setIsBioDialogOpen] = useState(false);

  // Detect RTL: check language setting, bioDirection prop, or Arabic content in bio
  const hasArabicContent = /[\u0600-\u06FF]/.test((bioFull || bioSummary).slice(0, 100));
  const isRtl = lang === 'ar' || bioDirection === 'rtl' || hasArabicContent;

  return (
    <div className="space-y-5">
      <p className="text-sm text-th-text-s mb-4 flex items-center gap-2">
        <Sparkle24Regular className="w-5 h-5 text-emerald-400" />
        {t.onboarding.reviewStep?.description || 'Review your profile information'}
      </p>

      <div className="relative">
        <EditableIndicator show={!!profile.company} />
        <AutocompleteInput
          value={profile.company}
          onChange={(value) => onProfileChange({ ...profile, company: value })}
          placeholder={t.onboarding.profile?.companyPlaceholder || 'Company name'}
          category="business"
          icon={<Briefcase24Regular className="w-5 h-5" />}
          label={`${t.onboarding.profile?.company || 'Company'} *`}
          error={errors.company}
          required
        />
        <p className="mt-1 text-xs text-th-text-t">{t.onboarding.profile?.companyHelp || 'Helps match you with people in similar or complementary industries'}</p>
      </div>

      <div className="relative">
        <EditableIndicator show={!!profile.jobTitle} />
        <AutocompleteInput
          value={profile.jobTitle}
          onChange={(value) => onProfileChange({ ...profile, jobTitle: value })}
          placeholder={t.onboarding.profile?.jobTitlePlaceholder || 'Your role'}
          category="jobTitles"
          icon={<Person24Regular className="w-5 h-5" />}
          label={`${t.onboarding.profile?.jobTitle || 'Job Title'} *`}
          error={errors.jobTitle}
          required
        />
        <p className="mt-1 text-xs text-th-text-t">{t.onboarding.profile?.jobTitleHelp || 'Used to find mentors, peers, or collaborators at the right level'}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-100 mb-2">{t.onboarding.profile?.location || 'Location'}</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <EditableIndicator show={!!profile.city} />
            <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
              <Location24Regular className="w-5 h-5 text-th-text-t" />
            </div>
            <input
              type="text"
              value={profile.city}
              onChange={(e) => onProfileChange({ ...profile, city: e.target.value })}
              placeholder={t.onboarding.profile?.cityPlaceholder || 'City'}
              className="w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="relative">
            <EditableIndicator show={!!profile.country} />
            <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
              <Location24Regular className="w-5 h-5 text-th-text-t" />
            </div>
            <input
              type="text"
              value={profile.country}
              onChange={(e) => onProfileChange({ ...profile, country: e.target.value })}
              placeholder={t.onboarding.profile?.countryPlaceholder || 'Country'}
              className="w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-th-text-t">{t.onboarding.profile?.locationHelp || 'Enables local networking and in-person meeting suggestions'}</p>
      </div>

      {/* Bio Section with Tabs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-neutral-100">{t.onboarding.cvBio?.bio || 'Professional Bio'}</label>
          <button
            type="button"
            onClick={() => setIsBioDialogOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
          >
            <FullScreenMaximize24Regular className="w-4 h-4" />
            {t.onboarding.bioPreview?.expand || 'Expand'}
          </button>
        </div>
        <p className="text-xs text-th-text-t mb-1">{t.onboarding.cvBio?.bioHelp || 'Your bio helps AI understand your background for better matching'}</p>
        <p className="text-[10px] text-th-text-t mb-2">{t.onboarding.cvBio?.bioTrust || '🔒 Visible only to your matches. You control who sees it.'}</p>

        {/* Bio Tabs */}
        <div className={`flex gap-1 mb-3 p-1 bg-th-surface rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}>
          <button
            type="button"
            onClick={() => onBioTabChange('summary')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeBioTab === 'summary'
                ? 'bg-emerald-500 text-white'
                : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
            }`}
          >
            {t.onboarding.cvBio?.summarized || 'Summarized'}
          </button>
          <button
            type="button"
            onClick={() => onBioTabChange('full')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeBioTab === 'full'
                ? 'bg-emerald-500 text-white'
                : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
            }`}
          >
            {t.onboarding.cvBio?.fullBio || 'Full Bio'}
          </button>
        </div>

        {/* Bio Content */}
        <div className="relative min-h-[220px]">
          {activeBioTab === 'summary' ? (
            <>
              <EditableIndicator show={!!bioSummary} />
              <textarea
                value={bioSummary}
                onChange={(e) => onBioSummaryChange(e.target.value)}
                placeholder={t.onboarding.cvBio?.summaryPlaceholder || 'Key highlights of your professional background...'}
                maxLength={300}
                dir={bioDirection}
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                className="w-full h-[180px] px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-sm leading-relaxed"
              />
              <div className={`flex justify-between items-center mt-1.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs text-th-text-t">{t.onboarding.cvBio?.summaryTip || 'Key points only'}</span>
                <div className="flex items-center gap-2">
                  {bioSummary && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(bioSummary);
                          toast.success(t.onboarding.cvBio?.copiedToClipboard || 'Copied to clipboard');
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-th-text-t hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title={t.onboarding.cvBio?.copyBio || 'Copy bio'}
                      >
                        <Copy24Regular className="w-3.5 h-3.5" />
                        <span>{t.onboarding.cvBio?.copyBio || 'Copy'}</span>
                      </button>
                      {typeof navigator !== 'undefined' && navigator.share && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.share({ text: bioSummary }).catch(() => {});
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-th-text-t hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title={t.onboarding.cvBio?.shareBio || 'Share bio'}
                        >
                          <Share24Regular className="w-3.5 h-3.5" />
                          <span>{t.onboarding.cvBio?.shareBio || 'Share'}</span>
                        </button>
                      )}
                    </>
                  )}
                  <span className={`text-xs ${bioSummary.length > 270 ? 'text-yellow-400' : 'text-th-text-m'}`}>
                    {bioSummary.length}/300
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <EditableIndicator show={!!bioFull} />
              <textarea
                value={bioFull}
                onChange={(e) => onBioFullChange(e.target.value)}
                placeholder={t.onboarding.cvBio?.fullPlaceholder || 'Detailed professional background, experience, and achievements...'}
                maxLength={2000}
                dir={bioDirection}
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                className="w-full h-[180px] px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-sm leading-relaxed"
              />
              <div className={`flex justify-between items-center mt-1.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs text-th-text-t">{t.onboarding.cvBio?.fullTip || 'Complete details'}</span>
                <div className="flex items-center gap-2">
                  {bioFull && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(bioFull);
                          toast.success(t.onboarding.cvBio?.copiedToClipboard || 'Copied to clipboard');
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-th-text-t hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title={t.onboarding.cvBio?.copyBio || 'Copy bio'}
                      >
                        <Copy24Regular className="w-3.5 h-3.5" />
                        <span>{t.onboarding.cvBio?.copyBio || 'Copy'}</span>
                      </button>
                      {typeof navigator !== 'undefined' && navigator.share && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.share({ text: bioFull }).catch(() => {});
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-th-text-t hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title={t.onboarding.cvBio?.shareBio || 'Share bio'}
                        >
                          <Share24Regular className="w-3.5 h-3.5" />
                          <span>{t.onboarding.cvBio?.shareBio || 'Share'}</span>
                        </button>
                      )}
                    </>
                  )}
                  <span className={`text-xs ${bioFull.length > 1800 ? 'text-yellow-400' : 'text-th-text-m'}`}>
                    {bioFull.length}/2000
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bio Preview Dialog */}
      <BioPreviewDialog
        isOpen={isBioDialogOpen}
        onClose={() => setIsBioDialogOpen(false)}
        bioSummary={bioSummary}
        bioFull={bioFull}
        activeBioTab={activeBioTab}
        bioDirection={bioDirection}
        onBioSummaryChange={onBioSummaryChange}
        onBioFullChange={onBioFullChange}
        onBioTabChange={onBioTabChange}
      />
    </div>
  );
}

/**
 * Step 3: Sectors Selection
 */
function SectorsStep({
  items,
  selected,
  onChange,
  customItems,
  onAddCustom,
  onDeleteCustom,
  error,
}: {
  items: SuggestedItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  customItems: SuggestedItem[];
  onAddCustom: (name: string) => void;
  onDeleteCustom: (id: string) => void;
  error?: string;
}) {
  const { t, locale } = useI18n();
  const [customInput, setCustomInput] = useState('');

  const toggleItem = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleAddCustom = () => {
    if (customInput.trim()) {
      onAddCustom(customInput.trim());
      setCustomInput('');
    }
  };

  const handleDeleteCustom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteCustom(id);
  };

  // Filter out custom items from enrichment data (they're already in customItems)
  // Also deduplicate by ID to prevent any duplicates
  // Sort so that AI-suggested (high confidence) items appear first, then selected, then non-selected
  const seenIds = new Set<string>();
  const allItems = [...items.filter(item => !item.isCustom), ...customItems]
    .filter(item => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    })
    .sort((a, b) => {
      // Items with high confidence (AI-suggested) come first, then by selection status
      const aScore = ((a.confidence || 0) > 0.4 ? 2 : 0) + (selected.includes(a.id) ? 1 : 0);
      const bScore = ((b.confidence || 0) > 0.4 ? 2 : 0) + (selected.includes(b.id) ? 1 : 0);
      return bScore - aScore;
    });

  return (
    <div>
      {/* Help text explaining why to fill this */}
      <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
        <p className="text-sm text-th-text-s">
          {t.onboarding.steps?.sectors?.help || 'Your sectors help us match you with people in relevant industries. Select all that apply.'}
        </p>
        <p className="text-xs text-th-text-t mt-1">
          {t.onboarding.steps?.sectors?.trust || '🔒 Only used for matching. Never shared publicly.'}
        </p>
      </div>
      <p className="text-sm text-th-text-s mb-4">
        {t.onboarding.selectRelevant || 'Select all that apply'} ({t.onboarding.selectedCount?.replace('{count}', String(selected.length)) || `${selected.length} selected`})
      </p>
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 max-h-[35vh] overflow-y-auto pe-2 mb-4">
        {allItems.map((item) => {
          const isSelected = selected.includes(item.id);
          return (
            <div key={item.id} className="relative group">
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white pe-8'
                    : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
                } ${item.isCustom && !isSelected ? 'border-dashed' : ''}`}
              >
                {locale === 'ar' && item.nameAr ? item.nameAr : item.name}
                {item.isCustom && !isSelected && <span className="ms-1 text-[10px] opacity-60">+</span>}
              </button>
              {isSelected && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.isCustom) {
                      handleDeleteCustom(e, item.id);
                    } else {
                      toggleItem(item.id);
                    }
                  }}
                  className="absolute top-1/2 -translate-y-1/2 end-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all"
                  title="Remove"
                >
                  <Dismiss24Regular className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom entry */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <EditableIndicator show={!!customInput} />
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
            placeholder={t.onboarding.addCustomSector || 'Add custom sector...'}
            className="w-full px-4 py-2 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={!customInput.trim()}
          className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {t.common?.add || 'Add'}
        </button>
      </div>
    </div>
  );
}

/**
 * Step 4: Skills, Interests & Hobbies Selection
 */
function SkillsInterestsStep({
  skills,
  interests,
  hobbies,
  selectedSkills,
  selectedInterests,
  selectedHobbies,
  onSkillsChange,
  onInterestsChange,
  onHobbiesChange,
  customSkills,
  customInterests,
  customHobbies,
  onAddCustomSkill,
  onAddCustomInterest,
  onAddCustomHobby,
  onDeleteCustomSkill,
  onDeleteCustomInterest,
  onDeleteCustomHobby,
  error,
}: {
  skills: SuggestedItem[];
  interests: SuggestedItem[];
  hobbies: SuggestedItem[];
  selectedSkills: string[];
  selectedInterests: string[];
  selectedHobbies: string[];
  onSkillsChange: (selected: string[]) => void;
  onInterestsChange: (selected: string[]) => void;
  onHobbiesChange: (selected: string[]) => void;
  customSkills: SuggestedItem[];
  customInterests: SuggestedItem[];
  customHobbies: SuggestedItem[];
  onAddCustomSkill: (name: string) => void;
  onAddCustomInterest: (name: string) => void;
  onAddCustomHobby: (name: string) => void;
  onDeleteCustomSkill: (id: string) => void;
  onDeleteCustomInterest: (id: string) => void;
  onDeleteCustomHobby: (id: string) => void;
  error?: string;
}) {
  const { t, locale } = useI18n();
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [customHobbyInput, setCustomHobbyInput] = useState('');

  const toggleSkill = (id: string) => {
    if (selectedSkills.includes(id)) {
      onSkillsChange(selectedSkills.filter((s) => s !== id));
    } else {
      onSkillsChange([...selectedSkills, id]);
    }
  };

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      onInterestsChange(selectedInterests.filter((s) => s !== id));
    } else {
      onInterestsChange([...selectedInterests, id]);
    }
  };

  const toggleHobby = (id: string) => {
    if (selectedHobbies.includes(id)) {
      onHobbiesChange(selectedHobbies.filter((s) => s !== id));
    } else {
      onHobbiesChange([...selectedHobbies, id]);
    }
  };

  const handleAddCustomSkill = () => {
    if (customSkillInput.trim()) {
      onAddCustomSkill(customSkillInput.trim());
      setCustomSkillInput('');
    }
  };

  const handleAddCustomInterest = () => {
    if (customInterestInput.trim()) {
      onAddCustomInterest(customInterestInput.trim());
      setCustomInterestInput('');
    }
  };

  const handleAddCustomHobby = () => {
    if (customHobbyInput.trim()) {
      onAddCustomHobby(customHobbyInput.trim());
      setCustomHobbyInput('');
    }
  };

  const handleDeleteCustomSkill = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteCustomSkill(id);
  };

  const handleDeleteCustomInterest = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteCustomInterest(id);
  };

  const handleDeleteCustomHobby = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteCustomHobby(id);
  };

  // Filter out custom items from enrichment data (they're already in custom arrays)
  // Also deduplicate by ID and sort so AI-suggested (high confidence) items appear first
  const deduplicateAndSort = (items: SuggestedItem[], customItems: SuggestedItem[], selected: string[]) => {
    const seenIds = new Set<string>();
    return [...items.filter(item => !item.isCustom), ...customItems]
      .filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      })
      .sort((a, b) => {
        // Items with high confidence (AI-suggested) come first, then by selection status
        const aScore = ((a.confidence || 0) > 0.4 ? 2 : 0) + (selected.includes(a.id) ? 1 : 0);
        const bScore = ((b.confidence || 0) > 0.4 ? 2 : 0) + (selected.includes(b.id) ? 1 : 0);
        return bScore - aScore;
      });
  };

  const allSkills = deduplicateAndSort(skills, customSkills, selectedSkills);
  const allInterests = deduplicateAndSort(interests, customInterests, selectedInterests);
  const allHobbies = deduplicateAndSort(hobbies, customHobbies, selectedHobbies);

  return (
    <div className="space-y-6 max-h-[55vh] overflow-y-auto pe-2">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {/* Skills */}
      <div>
        <label className="block text-sm font-medium text-neutral-100 mb-2">
          {t.onboarding.steps?.skills?.title || 'Skills'}
          <span className="text-th-text-t font-normal ms-2">({t.onboarding.selectedCount?.replace('{count}', String(selectedSkills.length)) || `${selectedSkills.length} selected`})</span>
        </label>
        {/* Help text */}
        <div className="mb-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-xs text-th-text-s">
            {t.onboarding.steps?.skills?.help || 'Skills are key to finding collaborators with complementary expertise. The more accurate, the better your matches.'}
          </p>
          <p className="text-[10px] text-th-text-t mt-0.5">
            {t.onboarding.steps?.skills?.trust || '🔒 Helps find people who need your skills or have skills you need.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {allSkills.map((item) => {
            const isSelected = selectedSkills.includes(item.id);
            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => toggleSkill(item.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white pe-6'
                      : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
                  } ${item.isCustom && !isSelected ? 'border-dashed' : ''}`}
                >
                  {locale === 'ar' && item.nameAr ? item.nameAr : item.name}
                </button>
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.isCustom) {
                        handleDeleteCustomSkill(e, item.id);
                      } else {
                        toggleSkill(item.id);
                      }
                    }}
                    className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all"
                    title="Remove"
                  >
                    <Dismiss24Regular className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <EditableIndicator show={!!customSkillInput} />
            <input
              type="text"
              value={customSkillInput}
              onChange={(e) => setCustomSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomSkill()}
              placeholder={t.onboarding.addCustomSkill || 'Add custom skill...'}
              className="w-full px-3 py-1.5 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustomSkill}
            disabled={!customSkillInput.trim()}
            className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all disabled:opacity-50 text-xs"
          >
            {t.common?.add || 'Add'}
          </button>
        </div>
      </div>

      {/* Interests */}
      <div>
        <label className="block text-sm font-medium text-neutral-100 mb-2">
          {t.onboarding.steps?.interests?.title || 'Interests'}
          <span className="text-th-text-t font-normal ms-2">({t.onboarding.selectedCount?.replace('{count}', String(selectedInterests.length)) || `${selectedInterests.length} selected`})</span>
        </label>
        {/* Help text */}
        <div className="mb-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-xs text-th-text-s">
            {t.onboarding.steps?.interests?.help || 'Interests help find like-minded professionals for meaningful connections.'}
          </p>
          <p className="text-[10px] text-th-text-t mt-0.5">
            {t.onboarding.steps?.interests?.trust || '🔒 Used to discover common ground with potential connections.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {allInterests.map((item) => {
            const isSelected = selectedInterests.includes(item.id);
            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => toggleInterest(item.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white pe-6'
                      : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
                  } ${item.isCustom && !isSelected ? 'border-dashed' : ''}`}
                >
                  {locale === 'ar' && item.nameAr ? item.nameAr : item.name}
                </button>
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.isCustom) {
                        handleDeleteCustomInterest(e, item.id);
                      } else {
                        toggleInterest(item.id);
                      }
                    }}
                    className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all"
                    title="Remove"
                  >
                    <Dismiss24Regular className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <EditableIndicator show={!!customInterestInput} />
            <input
              type="text"
              value={customInterestInput}
              onChange={(e) => setCustomInterestInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomInterest()}
              placeholder={t.onboarding.addCustomInterest || 'Add custom interest...'}
              className="w-full px-3 py-1.5 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustomInterest}
            disabled={!customInterestInput.trim()}
            className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all disabled:opacity-50 text-xs"
          >
            {t.common?.add || 'Add'}
          </button>
        </div>
      </div>

      {/* Hobbies */}
      <div>
        <label className="block text-sm font-medium text-neutral-100 mb-2">
          {t.onboarding.steps?.hobbies?.title || 'Hobbies'}
          <span className="text-th-text-t font-normal ms-2">({t.onboarding.selectedCount?.replace('{count}', String(selectedHobbies.length)) || `${selectedHobbies.length} selected`})</span>
        </label>
        {/* Help text */}
        <div className="mb-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-xs text-th-text-s">
            {t.onboarding.steps?.hobbies?.help || 'Hobbies create personal rapport and make networking more natural.'}
          </p>
          <p className="text-[10px] text-th-text-t mt-0.5">
            {t.onboarding.steps?.hobbies?.trust || '🔒 Optional but helps build authentic relationships.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {allHobbies.map((item) => {
            const isSelected = selectedHobbies.includes(item.id);
            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => toggleHobby(item.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white pe-6'
                      : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
                  } ${item.isCustom && !isSelected ? 'border-dashed' : ''}`}
                >
                  {locale === 'ar' && item.nameAr ? item.nameAr : item.name}
                </button>
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.isCustom) {
                        handleDeleteCustomHobby(e, item.id);
                      } else {
                        toggleHobby(item.id);
                      }
                    }}
                    className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all"
                    title="Remove"
                  >
                    <Dismiss24Regular className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <EditableIndicator show={!!customHobbyInput} />
            <input
              type="text"
              value={customHobbyInput}
              onChange={(e) => setCustomHobbyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomHobby()}
              placeholder={t.onboarding.addCustomHobby || 'Add custom hobby...'}
              className="w-full px-3 py-1.5 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustomHobby}
            disabled={!customHobbyInput.trim()}
            className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all disabled:opacity-50 text-xs"
          >
            {t.common?.add || 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Onboarding Project interface - Enhanced with all fields
 */
interface OnboardingProject {
  id: string;
  title: string;
  summary: string;
  detailedDesc?: string;
  category?: string;
  stage?: ProjectStage;
  investmentRange?: string;
  timeline?: string;
  lookingFor?: string[];
  sectorIds?: string[];
  skills?: Array<{ skillId: string; importance: SkillImportance }>;
  visibility?: 'PUBLIC' | 'CONNECTIONS_ONLY' | 'PRIVATE';
}

interface ProjectSector {
  id: string;
  name: string;
}

interface ProjectSkill {
  id: string;
  name: string;
}

/**
 * Step 5: Feature Cards Grid - Projects, Smart Deals, Pitch, Jobs
 */
type FeatureCardType = 'projects' | 'deals' | 'pitch' | 'jobs';

const SENIORITY_OPTIONS = [
  { id: '', label: 'Any level' },
  { id: 'ENTRY', label: 'Entry Level' },
  { id: 'MID', label: 'Mid Level' },
  { id: 'SENIOR', label: 'Senior' },
  { id: 'LEAD', label: 'Lead / Principal' },
  { id: 'DIRECTOR', label: 'Director' },
  { id: 'VP', label: 'VP / Vice President' },
  { id: 'C_LEVEL', label: 'C-Level Executive' },
  { id: 'BOARD', label: 'Board Member' },
];

function FeatureCardsStep({
  projects,
  onAddProject,
  onRemoveProject,
  onUpdateProject,
}: {
  projects: OnboardingProject[];
  onAddProject: (project: OnboardingProject) => void;
  onRemoveProject: (id: string) => void;
  onUpdateProject: (project: OnboardingProject) => void;
}) {
  const { t } = useI18n();
  const fc = t.onboarding.featureCards;

  // Which card form is expanded
  const [activeCard, setActiveCard] = useState<FeatureCardType | null>(null);
  // Which cards have been saved
  const [savedCards, setSavedCards] = useState<Set<string>>(new Set());
  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // ---- Projects form state (full form matching original) ----
  const [sectors, setSectors] = useState<ProjectSector[]>([]);
  const [skills, setSkills] = useState<ProjectSkill[]>([]);
  const [projTitle, setProjTitle] = useState('');
  const [projSummary, setProjSummary] = useState('');
  const [projDetailedDesc, setProjDetailedDesc] = useState('');
  const [projCategory, setProjCategory] = useState('');
  const [projStage, setProjStage] = useState<ProjectStage>('IDEA');
  const [projInvestmentRange, setProjInvestmentRange] = useState('');
  const [projTimeline, setProjTimeline] = useState('');
  const [projLookingFor, setProjLookingFor] = useState<string[]>([]);
  const [projSectorIds, setProjSectorIds] = useState<string[]>([]);
  const [projSkills, setProjSkills] = useState<Array<{ skillId: string; importance: SkillImportance }>>([]);
  const [projVisibility, setProjVisibility] = useState<'PUBLIC' | 'CONNECTIONS_ONLY' | 'PRIVATE'>('PUBLIC');
  const [projShowAdvanced, setProjShowAdvanced] = useState(false);
  const [projSummaryExpanded, setProjSummaryExpanded] = useState(false);
  const [projDetailedDescExpanded, setProjDetailedDescExpanded] = useState(false);
  const [projLookingForExpanded, setProjLookingForExpanded] = useState(false);
  const [projSectorsExpanded, setProjSectorsExpanded] = useState(false);
  const [projSkillsExpanded, setProjSkillsExpanded] = useState(false);
  // Document upload for project
  const [projFile, setProjFile] = useState<File | null>(null);
  const [projIsExtracting, setProjIsExtracting] = useState(false);
  const [projExtractionProgress, setProjExtractionProgress] = useState(0);
  const [projExtractedFromDoc, setProjExtractedFromDoc] = useState(false);
  // Edit mode
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // ---- Deals form state ----
  const [dealMode, setDealMode] = useState<DealMode>('SELL');
  const [dealTitle, setDealTitle] = useState('');
  const [dealSolutionType, setDealSolutionType] = useState('');
  const [dealDomain, setDealDomain] = useState('');
  const [dealCompanySize, setDealCompanySize] = useState<DealCompanySize | ''>('');
  const [dealProductName, setDealProductName] = useState('');
  const [dealTargetDesc, setDealTargetDesc] = useState('');
  const [dealProblem, setDealProblem] = useState('');
  const [dealEntityType, setDealEntityType] = useState<DealTargetEntityType | ''>('');
  // Expand state for deal textareas
  const [dealTargetDescExpanded, setDealTargetDescExpanded] = useState(false);
  const [dealProblemExpanded, setDealProblemExpanded] = useState(false);
  // Document upload for deal
  const [dealFile, setDealFile] = useState<File | null>(null);
  const [dealIsExtracting, setDealIsExtracting] = useState(false);
  const [dealExtractionProgress, setDealExtractionProgress] = useState(0);
  const [dealExtractedFromDoc, setDealExtractedFromDoc] = useState(false);

  // ---- Pitch form state ----
  const [pitchFile, setPitchFile] = useState<File | null>(null);
  const [pitchTitle, setPitchTitle] = useState('');
  const pitchFileRef = useRef<HTMLInputElement>(null);
  const [pitchCompanyName, setPitchCompanyName] = useState('');
  const [pitchDescription, setPitchDescription] = useState('');
  const [pitchDescExpanded, setPitchDescExpanded] = useState(false);
  const [pitchIndustry, setPitchIndustry] = useState('');
  const [pitchWhatYouNeed, setPitchWhatYouNeed] = useState('');
  const [pitchNeedExpanded, setPitchNeedExpanded] = useState(false);
  const [pitchIsExtracting, setPitchIsExtracting] = useState(false);
  const [pitchExtractionProgress, setPitchExtractionProgress] = useState(0);
  const [pitchExtractedFromDoc, setPitchExtractedFromDoc] = useState(false);

  // ---- Jobs form state ----
  const [jobTitle, setJobTitle] = useState('');
  const [jobIntentType, setJobIntentType] = useState<string>('');
  const [jobRoleArea, setJobRoleArea] = useState('');
  const [jobSeniority, setJobSeniority] = useState('');
  const [jobNotes, setJobNotes] = useState('');
  const [jobNotesExpanded, setJobNotesExpanded] = useState(false);
  // Document upload for job
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [jobIsExtracting, setJobIsExtracting] = useState(false);
  const [jobExtractionProgress, setJobExtractionProgress] = useState(0);
  const [jobExtractedFromDoc, setJobExtractedFromDoc] = useState(false);
  // Pass-through fields from AI extraction (not shown in simplified form but saved to API)
  const [jobSectorIds, setJobSectorIds] = useState<string[]>([]);
  const [jobSkillIds, setJobSkillIds] = useState<string[]>([]);
  const [jobLocationPref, setJobLocationPref] = useState('');
  const [jobRemoteOk, setJobRemoteOk] = useState(false);
  const [jobWorkMode, setJobWorkMode] = useState<string | undefined>();
  const [jobEmploymentType, setJobEmploymentType] = useState<string | undefined>();
  const [jobUrgency, setJobUrgency] = useState<string | undefined>();
  const [jobMinExperience, setJobMinExperience] = useState<number | undefined>();
  const [jobLanguages, setJobLanguages] = useState<string[]>([]);
  const [jobCertifications, setJobCertifications] = useState<string[]>([]);
  const [jobEducationLevels, setJobEducationLevels] = useState<string[]>([]);
  const [jobIndustries, setJobIndustries] = useState<string[]>([]);
  const [jobSalaryMin, setJobSalaryMin] = useState<number | undefined>();
  const [jobSalaryMax, setJobSalaryMax] = useState<number | undefined>();
  const [jobSalaryCurrency, setJobSalaryCurrency] = useState<string | undefined>();
  const [jobNoticePeriod, setJobNoticePeriod] = useState<string | undefined>();
  const [jobRelevantExperience, setJobRelevantExperience] = useState<string | undefined>();

  // ---- Saved items from API ----
  const [savedDeals, setSavedDeals] = useState<Deal[]>([]);
  const [savedPitches, setSavedPitches] = useState<Pitch[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<Opportunity[]>([]);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(true);


  // Fetch lookup data for projects
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const token = localStorage.getItem('p2p_access_token');
        const [sectorsRes, skillsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/sectors`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/skills`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const [sectorsData, skillsData] = await Promise.all([sectorsRes.json(), skillsRes.json()]);
        if (sectorsData.success) setSectors(sectorsData.data || []);
        if (skillsData.success) setSkills(skillsData.data || []);
      } catch (error) {
        console.error('Failed to fetch lookups:', error);
      }
    };
    fetchLookups();
  }, []);

  // Mark cards as saved if user already has projects
  useEffect(() => {
    if (projects.length > 0) {
      setSavedCards(prev => new Set([...prev, 'projects']));
    }
  }, [projects.length]);

  // Fetch existing deals, pitches, and opportunities on mount
  useEffect(() => {
    const fetchSavedItems = async () => {
      setIsLoadingItems(true);
      try {
        const [dealsRes, pitchesRes, oppsRes] = await Promise.all([
          getDeals().catch(() => ({ deals: [] })),
          listPitches().catch(() => ({ pitches: [] })),
          listOpportunities().catch(() => ({ opportunities: [] })),
        ]);
        const deals = dealsRes.deals || [];
        const pitches = pitchesRes.pitches || [];
        const opps = oppsRes.opportunities || [];
        setSavedDeals(deals);
        setSavedPitches(pitches);
        setSavedOpportunities(opps);
        const newSaved = new Set<string>();
        if (deals.length > 0) newSaved.add('deals');
        if (pitches.length > 0) newSaved.add('pitch');
        if (opps.length > 0) newSaved.add('jobs');
        if (newSaved.size > 0) {
          setSavedCards(prev => new Set([...prev, ...newSaved]));
        }
      } catch (error) {
        console.error('Failed to fetch saved items:', error);
      } finally {
        setIsLoadingItems(false);
      }
    };
    fetchSavedItems();
  }, []);

  const handleCardClick = (card: FeatureCardType) => {
    setActiveCard(activeCard === card ? null : card);
  };

  // ---- Save handlers for each card ----

  const CATEGORIES = ['technology', 'healthcare', 'finance', 'education', 'ecommerce', 'social', 'entertainment', 'sustainability', 'other'];

  const resetProjectForm = () => {
    setProjTitle(''); setProjSummary(''); setProjDetailedDesc(''); setProjCategory('');
    setProjStage('IDEA'); setProjInvestmentRange(''); setProjTimeline('');
    setProjLookingFor([]); setProjSectorIds([]); setProjSkills([]); setProjVisibility('PUBLIC');
    setProjShowAdvanced(false); setProjSummaryExpanded(false); setProjDetailedDescExpanded(false); setProjLookingForExpanded(false); setProjSectorsExpanded(false); setProjSkillsExpanded(false);
    setProjFile(null); setProjExtractedFromDoc(false); setEditingProjectId(null);
  };

  const handleEditProject = (project: OnboardingProject) => {
    setEditingProjectId(project.id);
    setProjTitle(project.title);
    setProjSummary(project.summary);
    setProjDetailedDesc(project.detailedDesc || '');
    setProjCategory(project.category || '');
    setProjStage(project.stage || 'IDEA');
    setProjInvestmentRange(project.investmentRange || '');
    setProjTimeline(project.timeline || '');
    setProjLookingFor(project.lookingFor || []);
    setProjSectorIds(project.sectorIds || []);
    setProjSkills(project.skills || []);
    setProjVisibility(project.visibility || 'PUBLIC');
    setProjShowAdvanced(true);
  };

  // Handle project document extraction
  const handleProjExtract = async () => {
    if (!projFile) return;
    setProjIsExtracting(true);
    setProjExtractionProgress(0);
    const progressInterval = setInterval(() => {
      setProjExtractionProgress(prev => prev >= 90 ? prev : prev + Math.random() * 15);
    }, 500);
    try {
      const extracted = await extractFromDocument(projFile);
      setProjExtractionProgress(100);
      if (extracted.title) setProjTitle(extracted.title);
      if (extracted.summary) setProjSummary(extracted.summary);
      if (extracted.detailedDesc) setProjDetailedDesc(extracted.detailedDesc);
      if (extracted.category) setProjCategory(extracted.category);
      if (extracted.stage) setProjStage(extracted.stage);
      if (extracted.investmentRange) setProjInvestmentRange(extracted.investmentRange);
      if (extracted.timeline) setProjTimeline(extracted.timeline);
      if (extracted.lookingFor?.length) setProjLookingFor(extracted.lookingFor);
      if (extracted.sectorIds?.length) setProjSectorIds(extracted.sectorIds);
      if (extracted.skills?.length) setProjSkills(extracted.skills);
      setProjExtractedFromDoc(true);
      setProjShowAdvanced(true);
      toast({ title: 'Data Extracted', description: 'Project data extracted from document.', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to extract data', variant: 'error' });
    } finally {
      clearInterval(progressInterval);
      setProjIsExtracting(false);
      setProjExtractionProgress(0);
    }
  };

  const handleProjFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!allowedTypes.includes(file.type) && !hasValidExt) {
      toast({ title: 'Error', description: 'Please upload a PDF, DOCX, DOC, or TXT file', variant: 'error' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 10MB', variant: 'error' });
      return;
    }
    setProjFile(file);
  };

  const toggleProjLookingFor = (id: string) => setProjLookingFor(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleProjSector = (id: string) => setProjSectorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleProjSkill = (id: string) => {
    setProjSkills(prev => {
      const exists = prev.find(s => s.skillId === id);
      if (exists) return prev.filter(s => s.skillId !== id);
      return [...prev, { skillId: id, importance: 'REQUIRED' as SkillImportance }];
    });
  };

  const handleSaveProject = () => {
    if (!projTitle.trim() || !projSummary.trim()) {
      toast({ title: 'Error', description: 'Title and summary are required', variant: 'error' });
      return;
    }
    const projectData: OnboardingProject = {
      id: editingProjectId || `project_${Date.now()}`,
      title: projTitle.trim(),
      summary: projSummary.trim(),
      detailedDesc: projDetailedDesc.trim() || undefined,
      category: projCategory || undefined,
      stage: projStage,
      investmentRange: projInvestmentRange.trim() || undefined,
      timeline: projTimeline.trim() || undefined,
      lookingFor: projLookingFor.length > 0 ? projLookingFor : undefined,
      sectorIds: projSectorIds.length > 0 ? projSectorIds : undefined,
      skills: projSkills.length > 0 ? projSkills : undefined,
      visibility: projVisibility,
    };
    if (editingProjectId) {
      onUpdateProject(projectData);
      toast({ title: 'Project Updated', variant: 'success' });
    } else {
      onAddProject(projectData);
      toast({ title: 'Project Added', variant: 'success' });
    }
    setSavedCards(prev => new Set([...prev, 'projects']));
    resetProjectForm();
    setActiveCard(null);
  };

  const handleDealFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!allowedTypes.includes(file.type) && !hasValidExt) {
      toast({ title: 'Error', description: 'Please upload a PDF, DOCX, DOC, or TXT file', variant: 'error' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 10MB', variant: 'error' });
      return;
    }
    setDealFile(file);
  };

  const handleDealExtract = async () => {
    if (!dealFile) return;
    setDealIsExtracting(true);
    setDealExtractionProgress(0);
    const progressInterval = setInterval(() => {
      setDealExtractionProgress(prev => prev >= 90 ? prev : prev + Math.random() * 15);
    }, 500);
    try {
      const extracted = await extractDealFromDocument(dealFile);
      setDealExtractionProgress(100);
      if (extracted.mode) setDealMode(extracted.mode);
      if (extracted.title) setDealTitle(extracted.title);
      if (extracted.solutionType) setDealSolutionType(extracted.solutionType);
      if (extracted.domain) setDealDomain(extracted.domain);
      if (extracted.companySize) setDealCompanySize(extracted.companySize as DealCompanySize);
      if (extracted.productName) setDealProductName(extracted.productName);
      if (extracted.targetDescription) setDealTargetDesc(extracted.targetDescription);
      if (extracted.problemStatement) setDealProblem(extracted.problemStatement);
      if (extracted.targetEntityType) setDealEntityType(extracted.targetEntityType as DealTargetEntityType);
      setDealExtractedFromDoc(true);
      toast({ title: 'Success', description: 'Deal data extracted from document', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Extraction Failed', description: error.message || 'Failed to extract data', variant: 'error' });
    } finally {
      clearInterval(progressInterval);
      setDealIsExtracting(false);
    }
  };

  const resetDealForm = () => {
    setDealMode('SELL'); setDealTitle(''); setDealSolutionType(''); setDealDomain('');
    setDealCompanySize(''); setDealProductName(''); setDealTargetDesc(''); setDealProblem('');
    setDealEntityType(''); setDealFile(null); setDealExtractedFromDoc(false); setEditingDealId(null);
    setDealTargetDescExpanded(false); setDealProblemExpanded(false);
  };

  const handleEditDeal = (deal: Deal) => {
    setEditingDealId(deal.id);
    setDealMode(deal.mode);
    setDealTitle(deal.title || '');
    setDealSolutionType(deal.solutionType || '');
    setDealDomain(deal.domain || '');
    setDealCompanySize(deal.companySize || '');
    setDealProductName(deal.productName || '');
    setDealTargetDesc(deal.targetDescription || '');
    setDealProblem(deal.problemStatement || '');
    setDealEntityType(deal.targetEntityType || '');
  };

  const handleDeleteDeal = async (id: string) => {
    try {
      await deleteDeal(id);
      setSavedDeals(prev => prev.filter(d => d.id !== id));
      if (editingDealId === id) resetDealForm();
      toast({ title: 'Deal Deleted', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete deal', variant: 'error' });
    }
  };

  const handleSaveDeal = async () => {
    if (!dealSolutionType.trim()) {
      toast({ title: 'Error', description: 'Solution type is required', variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const input: CreateDealInput = {
        mode: dealMode,
        title: dealTitle.trim() || undefined,
        solutionType: dealSolutionType.trim(),
        domain: dealDomain.trim() || undefined,
        companySize: dealCompanySize || undefined,
        productName: dealMode === 'SELL' ? dealProductName.trim() || undefined : undefined,
        targetDescription: dealMode === 'SELL' ? dealTargetDesc.trim() || undefined : undefined,
        problemStatement: dealMode === 'BUY' ? dealProblem.trim() || undefined : undefined,
        targetEntityType: dealMode === 'BUY' && dealEntityType ? dealEntityType : undefined,
      };
      if (editingDealId) {
        const updated = await updateDeal(editingDealId, input);
        setSavedDeals(prev => prev.map(d => d.id === editingDealId ? updated : d));
        toast({ title: 'Deal Updated', variant: 'success' });
      } else {
        const created = await createDeal(input);
        setSavedDeals(prev => [...prev, created]);
        toast({ title: 'Deal Created', variant: 'success' });
      }
      setSavedCards(prev => new Set([...prev, 'deals']));
      resetDealForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save deal', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle pitch document extraction (like project extraction)
  const handlePitchExtract = async () => {
    if (!pitchFile) return;
    setPitchIsExtracting(true);
    setPitchExtractionProgress(0);
    const progressInterval = setInterval(() => {
      setPitchExtractionProgress(prev => prev >= 90 ? prev : prev + Math.random() * 15);
    }, 500);
    try {
      const extracted = await extractPitchFromDocument(pitchFile);
      setPitchExtractionProgress(100);
      if (extracted.title) setPitchTitle(extracted.title);
      if (extracted.companyName) setPitchCompanyName(extracted.companyName);
      if (extracted.industry) setPitchIndustry(extracted.industry);
      if (extracted.description) setPitchDescription(extracted.description);
      if (extracted.whatYouNeed) setPitchWhatYouNeed(extracted.whatYouNeed);
      setPitchExtractedFromDoc(true);
      toast({ title: 'Data Extracted', description: 'Pitch data extracted from document. Review and save.', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to extract data', variant: 'error' });
    } finally {
      clearInterval(progressInterval);
      setPitchIsExtracting(false);
      setPitchExtractionProgress(0);
    }
  };

  const handleSavePitch = async () => {
    if (!pitchDescription.trim()) {
      toast({ title: 'Error', description: 'Please provide a description of your pitch', variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      // Build a text-based pitch document from the form fields
      const pitchText = [
        pitchTitle.trim() ? `Title: ${pitchTitle.trim()}` : '',
        pitchCompanyName.trim() ? `Company: ${pitchCompanyName.trim()}` : '',
        pitchIndustry.trim() ? `Industry: ${pitchIndustry.trim()}` : '',
        '',
        'Description:',
        pitchDescription.trim(),
        '',
        pitchWhatYouNeed.trim() ? `What We Need:\n${pitchWhatYouNeed.trim()}` : '',
      ].filter(Boolean).join('\n');

      // If we have the original PDF, upload that; otherwise create a text-based file
      let fileToUpload: File;
      if (pitchFile && pitchFile.type === 'application/pdf') {
        fileToUpload = pitchFile;
      } else {
        const textBlob = new Blob([pitchText], { type: 'application/pdf' });
        fileToUpload = new File([textBlob], `${(pitchTitle.trim() || pitchCompanyName.trim() || 'pitch').replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' });
      }

      const result = await uploadPitch(fileToUpload, pitchTitle.trim() || pitchCompanyName.trim() || undefined);
      if (result.pitch) setSavedPitches(prev => [...prev, result.pitch]);
      setSavedCards(prev => new Set([...prev, 'pitch']));
      setPitchFile(null); setPitchTitle(''); setPitchCompanyName(''); setPitchDescription(''); setPitchIndustry(''); setPitchWhatYouNeed('');
      setPitchExtractedFromDoc(false);
      toast({ title: 'Pitch Saved', description: 'Your pitch will be analyzed for matching.', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save pitch', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePitch = async (id: string) => {
    try {
      await deletePitch(id);
      setSavedPitches(prev => prev.filter(p => p.id !== id));
      toast({ title: 'Pitch Deleted', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete pitch', variant: 'error' });
    }
  };

  const handleJobFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!allowedTypes.includes(file.type) && !hasValidExt) {
      toast({ title: 'Error', description: 'Please upload a PDF, DOCX, DOC, or TXT file', variant: 'error' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 10MB', variant: 'error' });
      return;
    }
    setJobFile(file);
  };

  const handleJobExtract = async () => {
    if (!jobFile) return;
    setJobIsExtracting(true);
    setJobExtractionProgress(0);
    const progressInterval = setInterval(() => {
      setJobExtractionProgress(prev => prev >= 90 ? prev : prev + Math.random() * 15);
    }, 500);
    try {
      const extracted = await extractJobFromDocument(jobFile);
      setJobExtractionProgress(100);
      if (extracted.title) setJobTitle(extracted.title);
      if (extracted.intentType) setJobIntentType(extracted.intentType);
      if (extracted.roleArea) setJobRoleArea(extracted.roleArea);
      if (extracted.seniority) setJobSeniority(extracted.seniority);
      if (extracted.notes) setJobNotes(extracted.notes);
      // Pass-through fields from AI extraction
      if (extracted.sectorIds?.length) setJobSectorIds(extracted.sectorIds);
      if (extracted.skillIds?.length) setJobSkillIds(extracted.skillIds);
      if (extracted.locationPref) setJobLocationPref(extracted.locationPref);
      if (extracted.remoteOk !== undefined) setJobRemoteOk(extracted.remoteOk);
      if (extracted.workMode) setJobWorkMode(extracted.workMode);
      if (extracted.employmentType) setJobEmploymentType(extracted.employmentType);
      if (extracted.urgencyOrAvailability) setJobUrgency(extracted.urgencyOrAvailability);
      if (extracted.minExperienceYears != null) setJobMinExperience(extracted.minExperienceYears);
      if (extracted.languages?.length) setJobLanguages(extracted.languages);
      if (extracted.certifications?.length) setJobCertifications(extracted.certifications);
      if (extracted.educationLevels?.length) setJobEducationLevels(extracted.educationLevels);
      if (extracted.industries?.length) setJobIndustries(extracted.industries);
      if (extracted.salaryMin != null) setJobSalaryMin(extracted.salaryMin);
      if (extracted.salaryMax != null) setJobSalaryMax(extracted.salaryMax);
      if (extracted.salaryCurrency) setJobSalaryCurrency(extracted.salaryCurrency);
      if (extracted.noticePeriod) setJobNoticePeriod(extracted.noticePeriod);
      if (extracted.relevantExperience) setJobRelevantExperience(extracted.relevantExperience);
      setJobExtractedFromDoc(true);
      toast({ title: 'Success', description: 'Job data extracted from document', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Extraction Failed', description: error.message || 'Failed to extract data', variant: 'error' });
    } finally {
      clearInterval(progressInterval);
      setJobIsExtracting(false);
    }
  };

  const resetJobForm = () => {
    setJobTitle(''); setJobIntentType(''); setJobRoleArea(''); setJobSeniority('');
    setJobNotes(''); setJobNotesExpanded(false); setJobFile(null); setJobExtractedFromDoc(false); setEditingJobId(null);
    // Reset pass-through extraction fields
    setJobSectorIds([]); setJobSkillIds([]); setJobLocationPref(''); setJobRemoteOk(false);
    setJobWorkMode(undefined); setJobEmploymentType(undefined); setJobUrgency(undefined);
    setJobMinExperience(undefined); setJobLanguages([]); setJobCertifications([]);
    setJobEducationLevels([]); setJobIndustries([]); setJobSalaryMin(undefined);
    setJobSalaryMax(undefined); setJobSalaryCurrency(undefined); setJobNoticePeriod(undefined);
    setJobRelevantExperience(undefined);
  };

  const handleEditJob = (opp: Opportunity) => {
    setEditingJobId(opp.id);
    setJobTitle(opp.title);
    setJobIntentType(opp.intentType);
    setJobRoleArea(opp.roleArea || '');
    setJobSeniority(opp.seniority || '');
    setJobNotes(opp.notes || '');
  };

  const handleDeleteJob = async (id: string) => {
    try {
      await deleteOpportunity(id);
      setSavedOpportunities(prev => prev.filter(o => o.id !== id));
      if (editingJobId === id) resetJobForm();
      toast({ title: 'Opportunity Deleted', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete opportunity', variant: 'error' });
    }
  };

  const handleSaveJob = async () => {
    if (!jobTitle.trim() || !jobIntentType) {
      toast({ title: 'Error', description: 'Title and intent type are required', variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const input: CreateOpportunityInput = {
        title: jobTitle.trim(),
        intentType: jobIntentType as any,
        roleArea: jobRoleArea.trim() || undefined,
        seniority: (jobSeniority || undefined) as SeniorityLevel | undefined,
        notes: jobNotes.trim() || undefined,
        // Pass-through fields from AI extraction
        sectorIds: jobSectorIds.length > 0 ? jobSectorIds : undefined,
        skillIds: jobSkillIds.length > 0 ? jobSkillIds : undefined,
        locationPref: jobLocationPref || undefined,
        remoteOk: jobRemoteOk || undefined,
        workMode: jobWorkMode || undefined,
        employmentType: jobEmploymentType || undefined,
        urgencyOrAvailability: jobUrgency || undefined,
        minExperienceYears: jobMinExperience,
        languages: jobLanguages.length > 0 ? jobLanguages : undefined,
        certifications: jobCertifications.length > 0 ? jobCertifications : undefined,
        educationLevels: jobEducationLevels.length > 0 ? jobEducationLevels : undefined,
        industries: jobIndustries.length > 0 ? jobIndustries : undefined,
        salaryMin: jobSalaryMin,
        salaryMax: jobSalaryMax,
        salaryCurrency: jobSalaryCurrency || undefined,
        noticePeriod: jobNoticePeriod || undefined,
        relevantExperience: jobRelevantExperience || undefined,
      };
      if (editingJobId) {
        const updated = await updateOpportunity(editingJobId, input);
        setSavedOpportunities(prev => prev.map(o => o.id === editingJobId ? updated : o));
        toast({ title: 'Opportunity Updated', variant: 'success' });
      } else {
        const created = await createOpportunity(input);
        setSavedOpportunities(prev => [...prev, created]);
        toast({ title: 'Opportunity Created', variant: 'success' });
      }
      setSavedCards(prev => new Set([...prev, 'jobs']));
      resetJobForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save opportunity', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };


  const CARD_CONFIGS: Array<{
    id: FeatureCardType;
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string;
    activeColor: string;
    activeBg: string;
    activeBorder: string;
    activeGlow: string;
    accentBar: string;
    gradient: string;
    iconBg: string;
    countBg: string;
    countText: string;
  }> = [
    {
      id: 'projects',
      icon: <Lightbulb24Regular className="w-5 h-5" />,
      title: fc?.projects?.title || 'Projects',
      description: fc?.projects?.description || 'Collaboration ideas',
      color: 'text-emerald-100',
      activeColor: 'border-emerald-400',
      activeBg: 'bg-emerald-500/30',
      activeBorder: 'border-emerald-400',
      activeGlow: 'rgba(167, 139, 250, 0.7)',
      accentBar: 'bg-gradient-to-r from-emerald-500 via-fuchsia-500 to-emerald-500',
      gradient: 'from-emerald-600/50 via-fuchsia-500/40 to-emerald-500/50',
      iconBg: 'bg-emerald-500/40',
      countBg: 'bg-emerald-400',
      countText: 'text-th-text',
    },
    {
      id: 'deals',
      icon: <Handshake24Regular className="w-5 h-5" />,
      title: fc?.deals?.title || 'Smart Deals',
      description: fc?.deals?.description || 'Buy or sell solutions',
      color: 'text-emerald-100',
      activeColor: 'border-emerald-400',
      activeBg: 'bg-emerald-500/30',
      activeBorder: 'border-emerald-400',
      activeGlow: 'rgba(52, 211, 153, 0.7)',
      accentBar: 'bg-gradient-to-r from-emerald-500 via-green-400 to-teal-400',
      gradient: 'from-emerald-600/50 via-green-500/40 to-teal-500/50',
      iconBg: 'bg-emerald-500/40',
      countBg: 'bg-emerald-400',
      countText: 'text-th-text',
    },
    {
      id: 'pitch',
      icon: <SlideText24Regular className="w-5 h-5" />,
      title: fc?.pitch?.title || 'Pitch Deck',
      description: fc?.pitch?.description || 'AI pitch analysis',
      color: 'text-blue-100',
      activeColor: 'border-blue-400',
      activeBg: 'bg-blue-500/30',
      activeBorder: 'border-blue-400',
      activeGlow: 'rgba(96, 165, 250, 0.7)',
      accentBar: 'bg-gradient-to-r from-blue-500 via-cyan-400 to-sky-400',
      gradient: 'from-blue-600/50 via-cyan-500/40 to-sky-500/50',
      iconBg: 'bg-blue-500/40',
      countBg: 'bg-blue-400',
      countText: 'text-th-text',
    },
    {
      id: 'jobs',
      icon: <Briefcase24Regular className="w-5 h-5" />,
      title: fc?.jobs?.title || 'Jobs',
      description: fc?.jobs?.description || 'Job opportunities',
      color: 'text-rose-100',
      activeColor: 'border-red-400',
      activeBg: 'bg-red-500/30',
      activeBorder: 'border-red-400',
      activeGlow: 'rgba(251, 113, 133, 0.7)',
      accentBar: 'bg-gradient-to-r from-red-500 via-emerald-400 to-fuchsia-400',
      gradient: 'from-red-600/50 via-emerald-500/40 to-fuchsia-500/50',
      iconBg: 'bg-red-500/40',
      countBg: 'bg-red-400',
      countText: 'text-th-text',
    },
  ];

  const activeConfig = CARD_CONFIGS.find(c => c.id === activeCard);

  // Get item counts
  const getCount = (cardId: FeatureCardType) => {
    switch (cardId) {
      case 'projects': return projects.length;
      case 'deals': return savedDeals.length;
      case 'pitch': return savedPitches.length;
      case 'jobs': return savedOpportunities.length;
      default: return 0;
    }
  };

  return (
    <div className="flex flex-col h-[60vh]">
      {/* Section Title */}
      <div className="mb-3 flex-shrink-0">
        <p className="text-sm font-medium text-th-text">{fc?.sectionTitle || 'Set Up Your Features'}</p>
        <p className="text-xs text-th-text-t mt-1">{fc?.sectionDescription || 'Configure the tools you want to use. All are optional.'}</p>
      </div>

      {/* Feature Cards Grid - Always visible at top */}
      <div className="grid grid-cols-2 gap-2.5 mb-4 flex-shrink-0">
        {CARD_CONFIGS.map((card) => {
          const isActive = activeCard === card.id;
          const count = getCount(card.id);

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleCardClick(card.id)}
              className={`relative overflow-hidden rounded-xl p-3 text-start transition-all duration-300 ${
                isActive
                  ? `bg-gradient-to-br ${card.gradient} border-2 ${card.activeBorder} shadow-lg scale-[1.02]`
                  : 'bg-th-surface border border-white/[0.12] hover:bg-white/[0.1] hover:border-white/[0.2] hover:scale-[1.01]'
              }`}
              style={isActive ? { boxShadow: `0 4px 20px -2px ${card.activeGlow}` } : undefined}
            >
              {/* Glow effect when active */}
              {isActive && (
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-30 blur-sm`} />
              )}

              <div className="relative flex items-start gap-2.5">
                {/* Icon */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  isActive ? card.iconBg : 'bg-th-surface-h'
                }`}>
                  <span className={isActive ? card.color : 'text-th-text-s'}>
                    {card.icon}
                  </span>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isActive ? 'text-th-text' : 'text-neutral-200'}`}>
                    {card.title}
                  </p>
                  <p className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-th-text/70' : 'text-th-text-t'}`}>
                    {card.description}
                  </p>
                </div>

                {/* Count Badge */}
                {count > 0 && (
                  <span className={`absolute -top-1 -end-1 min-w-[20px] h-5 px-1.5 rounded-full ${card.countBg} ${card.countText} text-[10px] font-bold flex items-center justify-center shadow-md`}>
                    {count}
                  </span>
                )}
              </div>

              {/* Active indicator bar */}
              {isActive && (
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${card.accentBar}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Form Panel Area (below cards, scrollable) */}
      {activeCard && activeConfig ? (
        <div key={activeCard} className="flex-1 min-h-0 overflow-y-auto pe-1 scrollbar-thin animate-form-enter">
          {/* Accent bar at top */}
          <div className={`h-1 rounded-full mb-3 ${activeConfig.accentBar}`} />
          <div className="bg-th-surface border border-th-border rounded-xl p-4 space-y-3">

          {/* ---- PROJECTS FORM (full form matching original) ---- */}
          {activeCard === 'projects' && (
            <>
              {/* Existing projects list */}
              {projects.length > 0 && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-th-text-t font-medium">Your Projects ({projects.length})</p>
                  {projects.map((project) => (
                    <div key={project.id} className={`flex items-start gap-2 p-2 border rounded-lg transition-all ${
                      editingProjectId === project.id
                        ? 'bg-yellow-500/20 border-yellow-500/50'
                        : 'bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      <Rocket24Regular className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-th-text truncate">{project.title}</p>
                        {project.summary && <p className="text-[10px] text-th-text-t truncate">{project.summary}</p>}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {project.stage && <span className="px-1 py-0.5 bg-emerald-500/20 text-emerald-300 text-[8px] rounded">{STAGE_OPTIONS.find(s => s.id === project.stage)?.label}</span>}
                          {project.category && <span className="px-1 py-0.5 bg-blue-500/20 text-blue-300 text-[8px] rounded">{project.category}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button type="button" onClick={() => handleEditProject(project)}
                          className="p-1 rounded hover:bg-yellow-500/20 text-th-text-t hover:text-yellow-400 transition-colors">
                          <Edit24Regular className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => onRemoveProject(project.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-th-text-t hover:text-red-400 transition-colors">
                          <Delete24Regular className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editingProjectId && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded">Editing</span>
                  <button type="button" onClick={() => { resetProjectForm(); }}
                    className="text-xs text-th-text-t hover:text-th-text">Cancel Edit</button>
                </div>
              )}

              {/* Document Upload */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <Document24Regular className="w-4 h-4" />
                  <span className="text-xs font-medium">Upload Project Document (Optional)</span>
                </div>
                {!projFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-emerald-500/50 hover:bg-th-surface transition-all">
                    <ArrowUpload24Regular className="w-5 h-5 text-th-text-t mb-1" />
                    <span className="text-[10px] text-th-text-t">PDF, DOCX, DOC, TXT (max 10MB)</span>
                    <input type="file" className="hidden" accept=".pdf,.docx,.doc,.txt" onChange={handleProjFileSelect} />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-th-surface rounded-lg">
                      <Document24Regular className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-th-text truncate flex-1">{projFile.name}</span>
                      <button type="button" onClick={() => { setProjFile(null); setProjExtractedFromDoc(false); }} className="text-th-text-t hover:text-th-text">
                        <Dismiss24Regular className="w-4 h-4" />
                      </button>
                    </div>
                    {!projExtractedFromDoc ? (
                      <div className="space-y-2">
                        <button type="button" onClick={handleProjExtract} disabled={projIsExtracting}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
                          {projIsExtracting ? <><ArrowSync24Regular className="w-4 h-4 animate-spin" />Extracting...</> : <><Lightbulb24Regular className="w-4 h-4" />Extract with AI</>}
                        </button>
                        {projIsExtracting && (
                          <div className="w-full h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(projExtractionProgress, 100)}%` }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-400 text-xs"><Checkmark24Regular className="w-3 h-3" />Data extracted!</div>
                    )}
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-neutral-200 mb-1">Project Title *</label>
                <input type="text" value={projTitle} onChange={(e) => setProjTitle(e.target.value)}
                  placeholder={t.onboarding?.projects?.titlePlaceholder || 'e.g., AI-Powered Health App'}
                  className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" />
              </div>

              {/* Summary */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-200">Summary *</label>
                  <button type="button" onClick={() => setProjSummaryExpanded(!projSummaryExpanded)} className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                    {projSummaryExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                  </button>
                </div>
                <textarea value={projSummary} onChange={(e) => setProjSummary(e.target.value)}
                  placeholder={t.onboarding?.projects?.summaryPlaceholder || 'Brief description (2-3 sentences)'}
                  rows={projSummaryExpanded ? 5 : 2}
                  className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm resize-none transition-all" />
              </div>

              {/* Advanced Toggle */}
              <button type="button" onClick={() => setProjShowAdvanced(!projShowAdvanced)}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                {projShowAdvanced ? <ChevronUp24Regular className="w-4 h-4" /> : <ChevronDown24Regular className="w-4 h-4" />}
                {projShowAdvanced ? 'Hide details' : 'Show all fields'}
              </button>

              {projShowAdvanced && (
                <div className="space-y-3 pt-2 border-t border-th-border">
                  {/* Detailed Description */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-200">Detailed Description</label>
                      <button type="button" onClick={() => setProjDetailedDescExpanded(!projDetailedDescExpanded)} className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                        {projDetailedDescExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                      </button>
                    </div>
                    <textarea value={projDetailedDesc} onChange={(e) => setProjDetailedDesc(e.target.value)}
                      placeholder="More details about your vision..."
                      rows={projDetailedDescExpanded ? 8 : 3}
                      className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm resize-none transition-all" />
                  </div>

                  {/* Category & Investment Range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-200 mb-1">Category</label>
                      <select value={projCategory} onChange={(e) => setProjCategory(e.target.value)}
                        className="w-full px-2 py-2 bg-th-surface border border-th-border rounded-lg text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                        <option value="" className="bg-th-bg-s">Select...</option>
                        {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-th-bg-s">{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-200 mb-1">Investment Range</label>
                      <input type="text" value={projInvestmentRange} onChange={(e) => setProjInvestmentRange(e.target.value)}
                        placeholder="e.g., $50K - $100K"
                        className="w-full px-2 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                    </div>
                  </div>

                  {/* Stage */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-200 mb-1">Project Stage</label>
                    <div className="flex flex-wrap gap-1">
                      {STAGE_OPTIONS.map((opt) => (
                        <button key={opt.id} type="button" onClick={() => setProjStage(opt.id as ProjectStage)}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${projStage === opt.id ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-200 mb-1">Timeline</label>
                    <textarea value={projTimeline} onChange={(e) => setProjTimeline(e.target.value)}
                      placeholder="e.g., Phase 1: MVP (3 months)"
                      rows={2}
                      className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm resize-none" />
                  </div>

                  {/* Looking For - selected first */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-200">Looking For {projLookingFor.length > 0 && <span className="text-green-400">({projLookingFor.length})</span>}</label>
                      <button type="button" onClick={() => setProjLookingForExpanded(!projLookingForExpanded)} className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                        {projLookingForExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                      </button>
                    </div>
                    <div className={`flex flex-wrap gap-1 overflow-y-auto scrollbar-purple transition-all ${projLookingForExpanded ? 'max-h-48' : 'max-h-32'}`}>
                      {[...LOOKING_FOR_OPTIONS].sort((a, b) => {
                        const aSelected = projLookingFor.includes(a.id) ? 1 : 0;
                        const bSelected = projLookingFor.includes(b.id) ? 1 : 0;
                        return bSelected - aSelected;
                      }).map((opt) => (
                        <button key={opt.id} type="button" onClick={() => toggleProjLookingFor(opt.id)}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${projLookingFor.includes(opt.id) ? 'bg-green-500/20 text-green-300 border border-green-500/50' : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'}`}>
                          {projLookingFor.includes(opt.id) && <Checkmark24Regular className="w-3 h-3 inline mr-1" />}{opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sectors - selected first */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-200">Industry Sectors {projSectorIds.length > 0 && <span className="text-orange-400">({projSectorIds.length})</span>}</label>
                      <button type="button" onClick={() => setProjSectorsExpanded(!projSectorsExpanded)} className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                        {projSectorsExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                      </button>
                    </div>
                    <div className={`flex flex-wrap gap-1 overflow-y-auto scrollbar-purple transition-all ${projSectorsExpanded ? 'max-h-48' : 'max-h-32'}`}>
                      {[...sectors].sort((a, b) => {
                        const aSelected = projSectorIds.includes(a.id) ? 1 : 0;
                        const bSelected = projSectorIds.includes(b.id) ? 1 : 0;
                        return bSelected - aSelected;
                      }).slice(0, projSectorsExpanded ? 100 : 15).map((sector) => (
                        <button key={sector.id} type="button" onClick={() => toggleProjSector(sector.id)}
                          className={`px-2 py-1 rounded text-[10px] transition-all ${projSectorIds.includes(sector.id) ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50' : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'}`}>
                          {sector.name}
                        </button>
                      ))}
                      {!projSectorsExpanded && sectors.length > 15 && (
                        <span className="px-2 py-1 text-[10px] text-th-text-t">+{sectors.length - 15} more...</span>
                      )}
                    </div>
                  </div>

                  {/* Skills - selected first */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-200">Skills Needed {projSkills.length > 0 && <span className="text-cyan-400">({projSkills.length})</span>}</label>
                      <button type="button" onClick={() => setProjSkillsExpanded(!projSkillsExpanded)} className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                        {projSkillsExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                      </button>
                    </div>
                    <div className={`flex flex-wrap gap-1 overflow-y-auto scrollbar-purple transition-all ${projSkillsExpanded ? 'max-h-48' : 'max-h-32'}`}>
                      {[...skills].sort((a, b) => {
                        const aSelected = projSkills.find(s => s.skillId === a.id) ? 1 : 0;
                        const bSelected = projSkills.find(s => s.skillId === b.id) ? 1 : 0;
                        return bSelected - aSelected;
                      }).slice(0, projSkillsExpanded ? 100 : 15).map((skill) => (
                        <button key={skill.id} type="button" onClick={() => toggleProjSkill(skill.id)}
                          className={`px-2 py-1 rounded text-[10px] transition-all ${projSkills.find(s => s.skillId === skill.id) ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'}`}>
                          {skill.name}
                        </button>
                      ))}
                      {!projSkillsExpanded && skills.length > 15 && (
                        <span className="px-2 py-1 text-[10px] text-th-text-t">+{skills.length - 15} more...</span>
                      )}
                    </div>
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-200 mb-1">Visibility</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[{ id: 'PUBLIC', label: 'Public' }, { id: 'CONNECTIONS_ONLY', label: 'Connections' }, { id: 'PRIVATE', label: 'Private' }].map((opt) => (
                        <button key={opt.id} type="button" onClick={() => setProjVisibility(opt.id as typeof projVisibility)}
                          className={`px-2 py-1.5 rounded text-[10px] font-medium transition-all ${projVisibility === opt.id ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-th-text-t mt-1">
                      {projVisibility === 'PUBLIC' ? 'Anyone can discover and view your project' : projVisibility === 'CONNECTIONS_ONLY' ? 'Only your connections can see this project' : 'Only you can see it — useful for drafts'}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-2">
                {editingProjectId && (
                  <button type="button" onClick={resetProjectForm}
                    className="px-3 py-2 bg-th-surface border border-th-border text-th-text-s rounded-lg hover:bg-th-surface-h transition-all text-sm">
                    Cancel
                  </button>
                )}
                <button type="button" onClick={() => { resetProjectForm(); setActiveCard(null); }}
                  className={`${editingProjectId ? '' : 'flex-1'} px-3 py-2 bg-th-surface border border-th-border text-th-text-s rounded-lg hover:bg-th-surface-h transition-all text-sm`}>
                  {fc?.cancel || 'Close'}
                </button>
                <button type="button" onClick={handleSaveProject} disabled={!projTitle.trim() || !projSummary.trim()}
                  className={`flex-1 px-3 py-2 ${editingProjectId ? 'bg-gradient-to-r from-yellow-500 to-cyan-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'} text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 text-sm font-medium`}>
                  {editingProjectId ? <><Save24Regular className="w-4 h-4 inline me-1" />Update</> : <><Add24Regular className="w-4 h-4 inline me-1" />{fc?.saveAndClose || 'Save'}</>}
                </button>
              </div>
            </>
          )}

          {/* ---- DEALS FORM (same as /deals/new) ---- */}
          {activeCard === 'deals' && (
            <>
              {/* Existing deals list */}
              {savedDeals.length > 0 && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-th-text-t font-medium">Your Deals ({savedDeals.length})</p>
                  {savedDeals.map((deal) => (
                    <div key={deal.id} className={`flex items-start gap-2 p-2 border rounded-lg transition-all ${
                      editingDealId === deal.id
                        ? 'bg-yellow-500/20 border-yellow-500/50'
                        : 'bg-green-500/10 border-green-500/20'
                    }`}>
                      <Handshake24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-th-text truncate">{deal.title || deal.solutionType || 'Untitled Deal'}</p>
                        {deal.solutionType && deal.title && <p className="text-[10px] text-th-text-t truncate">{deal.solutionType}</p>}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          <span className={`px-1 py-0.5 text-[8px] rounded ${deal.mode === 'SELL' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>{deal.mode}</span>
                          <span className="px-1 py-0.5 bg-white/[0.03]0/20 text-th-text-s text-[8px] rounded">{deal.status}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button type="button" onClick={() => handleEditDeal(deal)}
                          className="p-1 rounded hover:bg-yellow-500/20 text-th-text-t hover:text-yellow-400 transition-colors">
                          <Edit24Regular className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteDeal(deal.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-th-text-t hover:text-red-400 transition-colors">
                          <Delete24Regular className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editingDealId && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded">Editing</span>
                  <button type="button" onClick={() => { resetDealForm(); }}
                    className="text-xs text-th-text-t hover:text-th-text">Cancel Edit</button>
                </div>
              )}

              {/* Document Upload */}
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Document24Regular className="w-4 h-4" />
                  <span className="text-xs font-medium">Upload Deal Document (Optional)</span>
                </div>
                {!dealFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-green-500/50 hover:bg-th-surface transition-all">
                    <ArrowUpload24Regular className="w-5 h-5 text-th-text-t mb-1" />
                    <span className="text-[10px] text-th-text-t">PDF, DOCX, DOC, TXT (max 10MB)</span>
                    <input type="file" className="hidden" accept=".pdf,.docx,.doc,.txt" onChange={handleDealFileSelect} />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-th-surface rounded-lg">
                      <Document24Regular className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-th-text truncate flex-1">{dealFile.name}</span>
                      <button type="button" onClick={() => { setDealFile(null); setDealExtractedFromDoc(false); }} className="text-th-text-t hover:text-th-text">
                        <Dismiss24Regular className="w-4 h-4" />
                      </button>
                    </div>
                    {!dealExtractedFromDoc ? (
                      <div className="space-y-2">
                        <button type="button" onClick={handleDealExtract} disabled={dealIsExtracting}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
                          {dealIsExtracting ? <><ArrowSync24Regular className="w-4 h-4 animate-spin" />Extracting...</> : <><Lightbulb24Regular className="w-4 h-4" />Extract with AI</>}
                        </button>
                        {dealIsExtracting && (
                          <div className="w-full h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(dealExtractionProgress, 100)}%` }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-400 text-xs"><Checkmark24Regular className="w-3 h-3" />Data extracted!</div>
                    )}
                  </div>
                )}
              </div>

              {/* Mode Toggle */}
              <div>
                <label className="block text-xs font-medium text-neutral-200 mb-2">{fc?.deals?.mode || 'Mode'}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDealMode('SELL')}
                    className={`p-3 rounded-xl text-start transition-all ${dealMode === 'SELL' ? 'bg-green-500/20 border-2 border-green-500/50' : 'bg-th-surface border border-th-border hover:bg-th-surface-h'}`}>
                    <p className={`text-sm font-medium ${dealMode === 'SELL' ? 'text-green-400' : 'text-th-text'}`}>{fc?.deals?.sellMode || 'Sell'}</p>
                    <p className="text-[10px] text-th-text-t mt-0.5">{fc?.deals?.sellDesc || 'Who can buy this?'}</p>
                  </button>
                  <button type="button" onClick={() => setDealMode('BUY')}
                    className={`p-3 rounded-xl text-start transition-all ${dealMode === 'BUY' ? 'bg-blue-500/20 border-2 border-blue-500/50' : 'bg-th-surface border border-th-border hover:bg-th-surface-h'}`}>
                    <p className={`text-sm font-medium ${dealMode === 'BUY' ? 'text-blue-400' : 'text-th-text'}`}>{fc?.deals?.buyMode || 'Buy'}</p>
                    <p className="text-[10px] text-th-text-t mt-0.5">{fc?.deals?.buyDesc || 'Who can provide this?'}</p>
                  </button>
                </div>
              </div>

              {/* Deal Title */}
              <div>
                <label className="block text-xs font-medium text-neutral-200 mb-1">{fc?.deals?.dealTitle || 'Deal Title (optional)'}</label>
                <input type="text" value={dealTitle} onChange={(e) => setDealTitle(e.target.value)}
                  placeholder={fc?.deals?.dealTitlePlaceholder || 'e.g., CRM Software for Sales Team'}
                  className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" />
              </div>

              {/* Solution Type */}
              <div>
                <label className="block text-xs font-medium text-neutral-200 mb-1">{fc?.deals?.solutionType || 'Solution Type *'}</label>
                <input type="text" value={dealSolutionType} onChange={(e) => setDealSolutionType(e.target.value)}
                  placeholder={fc?.deals?.solutionTypePlaceholder || 'e.g., CRM Software, Marketing Services'}
                  className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" />
              </div>

              {/* Industry & Company Size */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-200 mb-1">{fc?.deals?.industry || 'Industry / Domain'}</label>
                  <input type="text" value={dealDomain} onChange={(e) => setDealDomain(e.target.value)}
                    placeholder={fc?.deals?.industryPlaceholder || 'e.g., Technology'}
                    className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-200 mb-1">{fc?.deals?.companySize || 'Company Size'}</label>
                  <select value={dealCompanySize} onChange={(e) => setDealCompanySize(e.target.value as DealCompanySize)}
                    className="w-full px-2 py-2 bg-th-surface border border-th-border rounded-lg text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                    <option value="" className="bg-th-bg-s">Select...</option>
                    {COMPANY_SIZE_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id} className="bg-th-bg-s">{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sell mode specific fields */}
              {dealMode === 'SELL' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-200 mb-1">{fc?.deals?.productName || 'Product / Service Name'}</label>
                    <input type="text" value={dealProductName} onChange={(e) => setDealProductName(e.target.value)}
                      placeholder={fc?.deals?.productNamePlaceholder || 'e.g., CloudCRM Pro'}
                      className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-200">{fc?.deals?.targetCustomer || 'Target Customer Description'}</label>
                      <button type="button" onClick={() => setDealTargetDescExpanded(!dealTargetDescExpanded)} className="text-[10px] text-green-400 hover:text-green-300 flex items-center gap-1">
                        {dealTargetDescExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                      </button>
                    </div>
                    <textarea value={dealTargetDesc} onChange={(e) => setDealTargetDesc(e.target.value)}
                      placeholder={fc?.deals?.targetCustomerPlaceholder || 'Describe your ideal customer...'}
                      rows={dealTargetDescExpanded ? 6 : 2}
                      className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm resize-none transition-all" />
                  </div>
                </>
              )}

              {/* Buy mode specific fields */}
              {dealMode === 'BUY' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-neutral-200">{fc?.deals?.problemStatement || 'Problem Statement'}</label>
                      <button type="button" onClick={() => setDealProblemExpanded(!dealProblemExpanded)} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        {dealProblemExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                      </button>
                    </div>
                    <textarea value={dealProblem} onChange={(e) => setDealProblem(e.target.value)}
                      placeholder={fc?.deals?.problemStatementPlaceholder || 'Describe the problem you are trying to solve...'}
                      rows={dealProblemExpanded ? 6 : 2}
                      className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm resize-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-200 mb-1">{fc?.deals?.lookingFor || 'Looking For'}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {TARGET_ENTITY_OPTIONS.map(opt => (
                        <button key={opt.id} type="button" onClick={() => setDealEntityType(dealEntityType === opt.id ? '' : opt.id as DealTargetEntityType)}
                          className={`p-2 rounded-lg text-start transition-all text-xs ${
                            dealEntityType === opt.id
                              ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                              : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
                          }`}>
                          <p className="font-medium">{opt.label}</p>
                          <p className="text-[10px] text-th-text-t mt-0.5">{opt.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2 mt-2">
                {editingDealId && (
                  <button type="button" onClick={resetDealForm}
                    className="px-3 py-2 bg-th-surface border border-th-border text-th-text-s rounded-lg hover:bg-th-surface-h transition-all text-sm">
                    Cancel
                  </button>
                )}
                <button type="button" onClick={() => { resetDealForm(); setActiveCard(null); }}
                  className={`${editingDealId ? '' : 'flex-1'} px-3 py-2 bg-th-surface border border-th-border text-th-text-s rounded-lg hover:bg-th-surface-h transition-all text-sm`}>
                  {fc?.cancel || 'Close'}
                </button>
                <button type="button" onClick={handleSaveDeal} disabled={!dealSolutionType.trim() || isSaving}
                  className={`flex-1 px-3 py-2 ${editingDealId ? 'bg-gradient-to-r from-yellow-500 to-cyan-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'} text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 text-sm font-medium`}>
                  {isSaving ? (fc?.saving || 'Saving...') : editingDealId ? <><Save24Regular className="w-4 h-4 inline me-1" />Update</> : <><Add24Regular className="w-4 h-4 inline me-1" />{fc?.saveAndClose || 'Save'}</>}
                </button>
              </div>
            </>
          )}

          {/* ---- PITCH FORM ---- */}
          {activeCard === 'pitch' && (
            <>
              {/* Existing pitches list */}
              {savedPitches.length > 0 && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-th-text-t font-medium">Your Pitches ({savedPitches.length})</p>
                  {savedPitches.map((pitch) => (
                    <div key={pitch.id} className="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <SlideText24Regular className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-th-text truncate">{pitch.title || pitch.fileName || 'Untitled Pitch'}</p>
                        {pitch.companyName && <p className="text-[10px] text-th-text-t truncate">{pitch.companyName}</p>}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          <span className={`px-1 py-0.5 text-[8px] rounded ${
                            pitch.status === 'COMPLETED' ? 'bg-green-500/20 text-green-300'
                            : pitch.status === 'FAILED' ? 'bg-red-500/20 text-red-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                          }`}>{pitch.status}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button type="button" onClick={() => handleDeletePitch(pitch.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-th-text-t hover:text-red-400 transition-colors">
                          <Delete24Regular className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Document Upload */}
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <Document24Regular className="w-4 h-4" />
                  <span className="text-xs font-medium">Upload Pitch Document (Optional)</span>
                </div>
                {!pitchFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-blue-500/50 hover:bg-th-surface transition-all">
                    <ArrowUpload24Regular className="w-5 h-5 text-th-text-t mb-1" />
                    <span className="text-[10px] text-th-text-t">PDF, DOCX, DOC, TXT (max 10MB)</span>
                    <input
                      ref={pitchFileRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
                        const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
                        const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
                        if (!allowedTypes.includes(file.type) && !hasValidExt) {
                          toast({ title: 'Error', description: 'Please upload a PDF, DOCX, DOC, or TXT file', variant: 'error' });
                          return;
                        }
                        if (file.size > 10 * 1024 * 1024) {
                          toast({ title: 'Error', description: 'File size must be less than 10MB', variant: 'error' });
                          return;
                        }
                        setPitchFile(file);
                        setPitchExtractedFromDoc(false);
                      }}
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-th-surface rounded-lg">
                      <Document24Regular className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-th-text truncate flex-1">{pitchFile.name}</span>
                      <button type="button" onClick={() => { setPitchFile(null); setPitchExtractedFromDoc(false); }} className="text-th-text-t hover:text-th-text">
                        <Dismiss24Regular className="w-4 h-4" />
                      </button>
                    </div>
                    {!pitchExtractedFromDoc ? (
                      <div className="space-y-2">
                        <button type="button" onClick={handlePitchExtract} disabled={pitchIsExtracting}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
                          {pitchIsExtracting ? <><ArrowSync24Regular className="w-4 h-4 animate-spin" />Extracting...</> : <><Lightbulb24Regular className="w-4 h-4" />Extract with AI</>}
                        </button>
                        {pitchIsExtracting && (
                          <div className="w-full h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(pitchExtractionProgress, 100)}%` }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-400 text-xs"><Checkmark24Regular className="w-3 h-3" />Data extracted!</div>
                    )}
                  </div>
                )}
              </div>

              {/* Pitch Title */}
              <div>
                <label className="block text-xs font-medium text-neutral-200 mb-1">Pitch Title</label>
                <input type="text" value={pitchTitle} onChange={(e) => setPitchTitle(e.target.value)}
                  placeholder="e.g., AI-Powered Marketing Platform"
                  className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
              </div>

              {/* Company & Industry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-200 mb-1">Company Name</label>
                  <input type="text" value={pitchCompanyName} onChange={(e) => setPitchCompanyName(e.target.value)}
                    placeholder="e.g., Acme Inc."
                    className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-200 mb-1">Industry</label>
                  <input type="text" value={pitchIndustry} onChange={(e) => setPitchIndustry(e.target.value)}
                    placeholder="e.g., Technology, Healthcare"
                    className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-200">Description *</label>
                  <button type="button" onClick={() => setPitchDescExpanded(!pitchDescExpanded)} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    {pitchDescExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                  </button>
                </div>
                <textarea value={pitchDescription} onChange={(e) => setPitchDescription(e.target.value)}
                  placeholder="Describe your product/service, value proposition, and target market..."
                  rows={pitchDescExpanded ? 6 : 2}
                  className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm resize-none transition-all" />
              </div>

              {/* What You Need */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-200">What You Need</label>
                  <button type="button" onClick={() => setPitchNeedExpanded(!pitchNeedExpanded)} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    {pitchNeedExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                  </button>
                </div>
                <textarea value={pitchWhatYouNeed} onChange={(e) => setPitchWhatYouNeed(e.target.value)}
                  placeholder="e.g., Funding, technical co-founder, enterprise clients, marketing partners..."
                  rows={pitchNeedExpanded ? 5 : 2}
                  className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm resize-none transition-all" />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button type="button" onClick={() => setActiveCard(null)}
                  className="flex-1 px-3 py-2 bg-th-surface border border-th-border text-th-text-s rounded-lg hover:bg-th-surface-h transition-all text-sm">
                  {fc?.cancel || 'Cancel'}
                </button>
                <button type="button" onClick={handleSavePitch} disabled={!pitchDescription.trim() || isSaving}
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 text-sm font-medium">
                  {isSaving ? (fc?.saving || 'Saving...') : (fc?.saveAndClose || 'Save')}
                </button>
              </div>
            </>
          )}

          {/* ---- JOBS FORM (same as /opportunities/new) ---- */}
          {activeCard === 'jobs' && (
            <>
              {/* Existing opportunities list */}
              {savedOpportunities.length > 0 && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-th-text-t font-medium">Your Opportunities ({savedOpportunities.length})</p>
                  {savedOpportunities.map((opp) => (
                    <div key={opp.id} className={`flex items-start gap-2 p-2 border rounded-lg transition-all ${
                      editingJobId === opp.id
                        ? 'bg-yellow-500/20 border-yellow-500/50'
                        : 'bg-blue-500/10 border-blue-500/20'
                    }`}>
                      <Briefcase24Regular className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-th-text truncate">{opp.title}</p>
                        {opp.roleArea && <p className="text-[10px] text-th-text-t truncate">{opp.roleArea}</p>}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          <span className="px-1 py-0.5 bg-blue-500/20 text-blue-300 text-[8px] rounded">
                            {opp.intentType === 'HIRING' ? 'Hiring' : opp.intentType === 'OPEN_TO_OPPORTUNITIES' ? 'Open to Opps' : opp.intentType === 'ADVISORY_BOARD' ? 'Advisory' : 'Referrals'}
                          </span>
                          {opp.seniority && <span className="px-1 py-0.5 bg-white/[0.03]0/20 text-th-text-s text-[8px] rounded">{opp.seniority}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button type="button" onClick={() => handleEditJob(opp)}
                          className="p-1 rounded hover:bg-yellow-500/20 text-th-text-t hover:text-yellow-400 transition-colors">
                          <Edit24Regular className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteJob(opp.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-th-text-t hover:text-red-400 transition-colors">
                          <Delete24Regular className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editingJobId && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded">Editing</span>
                  <button type="button" onClick={() => { resetJobForm(); }}
                    className="text-xs text-th-text-t hover:text-th-text">Cancel Edit</button>
                </div>
              )}

              {/* Document Upload */}
              <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <Document24Regular className="w-4 h-4" />
                  <span className="text-xs font-medium">Upload Job Document (Optional)</span>
                </div>
                {!jobFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-blue-500/50 hover:bg-th-surface transition-all">
                    <ArrowUpload24Regular className="w-5 h-5 text-th-text-t mb-1" />
                    <span className="text-[10px] text-th-text-t">PDF, DOCX, DOC, TXT (max 10MB)</span>
                    <input type="file" className="hidden" accept=".pdf,.docx,.doc,.txt" onChange={handleJobFileSelect} />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-th-surface rounded-lg">
                      <Document24Regular className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-th-text truncate flex-1">{jobFile.name}</span>
                      <button type="button" onClick={() => { setJobFile(null); setJobExtractedFromDoc(false); }} className="text-th-text-t hover:text-th-text">
                        <Dismiss24Regular className="w-4 h-4" />
                      </button>
                    </div>
                    {!jobExtractedFromDoc ? (
                      <div className="space-y-2">
                        <button type="button" onClick={handleJobExtract} disabled={jobIsExtracting}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
                          {jobIsExtracting ? <><ArrowSync24Regular className="w-4 h-4 animate-spin" />Extracting...</> : <><Lightbulb24Regular className="w-4 h-4" />Extract with AI</>}
                        </button>
                        {jobIsExtracting && (
                          <div className="w-full h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(jobExtractionProgress, 100)}%` }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-400 text-xs"><Checkmark24Regular className="w-3 h-3" />Data extracted!</div>
                    )}
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-neutral-200 mb-1">{fc?.jobs?.opportunityTitle || 'Opportunity Title *'}</label>
                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                  placeholder={fc?.jobs?.opportunityTitlePlaceholder || 'e.g., Senior React Developer, CTO Role'}
                  className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" />
              </div>

              {/* Intent Type - 2x2 grid like original */}
              <div>
                <label className="block text-xs font-medium text-neutral-200 mb-2">{fc?.jobs?.intentType || 'What are you looking for? *'}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'HIRING', label: fc?.jobs?.hiring || 'Hiring', desc: fc?.jobs?.hiringDesc || 'Looking to hire talent' },
                    { id: 'OPEN_TO_OPPORTUNITIES', label: fc?.jobs?.openToOpportunities || 'Open to Opportunities', desc: fc?.jobs?.openToOpportunitiesDesc || 'Exploring new career opportunities' },
                    { id: 'ADVISORY_BOARD', label: fc?.jobs?.advisoryBoard || 'Advisory/Board', desc: fc?.jobs?.advisoryBoardDesc || 'Seeking advisory positions' },
                    { id: 'REFERRALS_ONLY', label: fc?.jobs?.referralsOnly || 'Referrals Only', desc: fc?.jobs?.referralsOnlyDesc || 'Happy to make introductions' },
                  ].map(opt => (
                    <button key={opt.id} type="button" onClick={() => setJobIntentType(jobIntentType === opt.id ? '' : opt.id)}
                      className={`p-2.5 rounded-xl text-start transition-all ${
                        jobIntentType === opt.id
                          ? 'bg-blue-500/20 border-2 border-blue-500/50'
                          : 'bg-th-surface border border-th-border hover:bg-th-surface-h'
                      }`}>
                      <p className={`text-xs font-medium ${jobIntentType === opt.id ? 'text-blue-400' : 'text-th-text'}`}>{opt.label}</p>
                      <p className="text-[10px] text-th-text-t mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Role Area & Seniority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-200 mb-1">{fc?.jobs?.roleArea || 'Role / Area'}</label>
                  <input type="text" value={jobRoleArea} onChange={(e) => setJobRoleArea(e.target.value)}
                    placeholder={fc?.jobs?.roleAreaPlaceholder || 'e.g., Software Engineer'}
                    className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-200 mb-1">{fc?.jobs?.seniority || 'Seniority'}</label>
                  <select value={jobSeniority} onChange={(e) => setJobSeniority(e.target.value)}
                    className="w-full px-2 py-2 bg-th-surface border border-th-border rounded-lg text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                    {SENIORITY_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id} className="bg-th-bg-s">{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-200">{fc?.jobs?.notes || 'Additional Notes'}</label>
                  <button type="button" onClick={() => setJobNotesExpanded(!jobNotesExpanded)} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    {jobNotesExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                  </button>
                </div>
                <textarea value={jobNotes} onChange={(e) => setJobNotes(e.target.value)}
                  placeholder={fc?.jobs?.notesPlaceholder || 'Any additional details...'}
                  rows={jobNotesExpanded ? 6 : 2}
                  className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm resize-none transition-all" />
              </div>

              <div className="flex gap-2 mt-2">
                {editingJobId && (
                  <button type="button" onClick={resetJobForm}
                    className="px-3 py-2 bg-th-surface border border-th-border text-th-text-s rounded-lg hover:bg-th-surface-h transition-all text-sm">
                    Cancel
                  </button>
                )}
                <button type="button" onClick={() => { resetJobForm(); setActiveCard(null); }}
                  className={`${editingJobId ? '' : 'flex-1'} px-3 py-2 bg-th-surface border border-th-border text-th-text-s rounded-lg hover:bg-th-surface-h transition-all text-sm`}>
                  {fc?.cancel || 'Close'}
                </button>
                <button type="button" onClick={handleSaveJob} disabled={!jobTitle.trim() || !jobIntentType || isSaving}
                  className={`flex-1 px-3 py-2 ${editingJobId ? 'bg-gradient-to-r from-yellow-500 to-cyan-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'} text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 text-sm font-medium`}>
                  {isSaving ? (fc?.saving || 'Saving...') : editingJobId ? <><Save24Regular className="w-4 h-4 inline me-1" />Update</> : <><Add24Regular className="w-4 h-4 inline me-1" />{fc?.saveAndClose || 'Save'}</>}
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4">
          <p className="text-sm text-th-text-s">{fc?.emptyState || 'Tap a card above to get started'}</p>
          <p className="text-xs text-th-text-m mt-1">{fc?.sectionDescription || 'All features are optional'}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Step 6: Objectives Selection
 */
function ObjectivesStep({
  items,
  selected,
  onChange,
  customObjectives,
  onAddCustomObjective,
  onDeleteCustomObjective,
  error,
}: {
  items: { id: string; name: string; description: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  customObjectives: { id: string; name: string; description: string }[];
  onAddCustomObjective: (name: string) => void;
  onDeleteCustomObjective: (id: string) => void;
  error?: string;
}) {
  const { t } = useI18n();
  const [customInput, setCustomInput] = useState('');

  const toggleItem = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleAddCustom = () => {
    if (customInput.trim()) {
      onAddCustomObjective(customInput.trim());
      setCustomInput('');
    }
  };

  const handleDeleteCustom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteCustomObjective(id);
  };

  const allItems = [...items, ...customObjectives];

  return (
    <div>
      {/* Help text explaining why objectives matter */}
      <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
        <p className="text-sm text-th-text-s">
          {t.onboarding.steps?.objectives?.help || 'Your goals drive who we recommend. Looking for investors? Mentors? Partners? Tell us.'}
        </p>
        <p className="text-xs text-th-text-t mt-1">
          {t.onboarding.steps?.objectives?.trust || '🔒 This directly affects your match quality. Be honest about what you need.'}
        </p>
      </div>
      <p className="text-sm text-th-text-s mb-4">
        {t.onboarding.selectObjectives || 'What are your main goals on IntellMatch? Select all that apply.'}
      </p>
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <div className="space-y-3 max-h-[40vh] overflow-y-auto pe-2 mb-4">
        {allItems.map((item) => (
          <div key={item.id} className="relative">
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              className={`w-full p-4 rounded-xl text-start transition-all duration-200 ${
                selected.includes(item.id)
                  ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 border-2 border-emerald-500/50'
                  : 'bg-th-surface border border-th-border hover:bg-th-surface-h hover:border-white/20'
              } ${item.id.startsWith('custom_') ? 'border-dashed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className={item.id.startsWith('custom_') ? 'pe-8' : ''}>
                  <p className="font-medium text-th-text">{item.name}</p>
                  <p className="text-sm text-th-text-s mt-1">{item.description}</p>
                </div>
                {selected.includes(item.id) && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                    <Checkmark24Regular className="w-4 h-4 text-th-text" />
                  </div>
                )}
              </div>
            </button>
            {item.id.startsWith('custom_') && (
              <button
                type="button"
                onClick={(e) => handleDeleteCustom(e, item.id)}
                className="absolute top-3 end-3 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 transition-all"
                title="Delete"
              >
                <Dismiss24Regular className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Custom goal input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <EditableIndicator show={!!customInput} />
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
            placeholder={t.onboarding.addCustomObjective || 'Add custom objective...'}
            className="w-full px-4 py-2 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-t focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={!customInput.trim()}
          className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {t.common?.add || 'Add'}
        </button>
      </div>
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t, dir, locale } = useI18n();

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [step0Submitted, setStep0Submitted] = useState(false);
  const [hasEnriched, setHasEnriched] = useState(false); // Prevent re-enrichment when going back
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);

  // Step 1 data
  const [socialData, setSocialData] = useState({ linkedinUrl: '', twitterUrl: '', phone: '', bio: '' });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [enhanceWithWebSearch, setEnhanceWithWebSearch] = useState(false); // Toggle for online search enhancement

  // Enrichment result
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentData | null>(null);

  // Step 2 data (profile)
  const [profile, setProfile] = useState({ company: '', jobTitle: '', city: '', country: '' });
  const [bioSummary, setBioSummary] = useState('');
  const [bioFull, setBioFull] = useState('');
  const [activeBioTab, setActiveBioTab] = useState<'summary' | 'full'>('summary');
  const [bioDirection, setBioDirection] = useState<'rtl' | 'ltr'>('ltr');

  // Step 3 data (sectors)
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [customSectors, setCustomSectors] = useState<SuggestedItem[]>([]);

  // Step 4 data (skills, interests & hobbies)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [customSkills, setCustomSkills] = useState<SuggestedItem[]>([]);
  const [customInterests, setCustomInterests] = useState<SuggestedItem[]>([]);
  const [customHobbies, setCustomHobbies] = useState<SuggestedItem[]>([]);

  // Step 5 data (projects)
  const [onboardingProjects, setOnboardingProjects] = useState<OnboardingProject[]>([]);

  // Step 6 data (objectives)
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [customGoals, setCustomGoals] = useState<{ id: string; name: string; description: string }[]>([]);

  // Handlers for adding custom items
  const handleAddCustomSector = (name: string) => {
    const id = `custom_${name.toLowerCase().replace(/\s+/g, '_')}`;
    if (!customSectors.find(s => s.id === id)) {
      setCustomSectors([...customSectors, { id, name, isCustom: true, confidence: 1 }]);
      setSelectedSectors([...selectedSectors, id]);
    }
  };

  const handleAddCustomSkill = (name: string) => {
    const id = `custom_${name.toLowerCase().replace(/\s+/g, '_')}`;
    if (!customSkills.find(s => s.id === id)) {
      setCustomSkills([...customSkills, { id, name, isCustom: true, confidence: 1 }]);
      setSelectedSkills([...selectedSkills, id]);
    }
  };

  const handleAddCustomInterest = (name: string) => {
    const id = `custom_${name.toLowerCase().replace(/\s+/g, '_')}`;
    if (!customInterests.find(s => s.id === id)) {
      setCustomInterests([...customInterests, { id, name, isCustom: true, confidence: 1 }]);
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const handleAddCustomHobby = (name: string) => {
    const id = `custom_${name.toLowerCase().replace(/\s+/g, '_')}`;
    if (!customHobbies.find(s => s.id === id)) {
      setCustomHobbies([...customHobbies, { id, name, isCustom: true, confidence: 1 }]);
      setSelectedHobbies([...selectedHobbies, id]);
    }
  };

  const handleAddCustomGoal = (name: string) => {
    const id = `custom_${name.toLowerCase().replace(/\s+/g, '_')}`;
    if (!customGoals.find(g => g.id === id)) {
      setCustomGoals([...customGoals, { id, name, description: 'Custom goal' }]);
      setSelectedGoals([...selectedGoals, id]);
    }
  };

  // Delete handlers for custom items
  const handleDeleteCustomSector = (id: string) => {
    setCustomSectors(customSectors.filter(s => s.id !== id));
    setSelectedSectors(selectedSectors.filter(s => s !== id));
  };

  const handleDeleteCustomSkill = (id: string) => {
    setCustomSkills(customSkills.filter(s => s.id !== id));
    setSelectedSkills(selectedSkills.filter(s => s !== id));
  };

  const handleDeleteCustomInterest = (id: string) => {
    setCustomInterests(customInterests.filter(s => s.id !== id));
    setSelectedInterests(selectedInterests.filter(s => s !== id));
  };

  const handleDeleteCustomHobby = (id: string) => {
    setCustomHobbies(customHobbies.filter(s => s.id !== id));
    setSelectedHobbies(selectedHobbies.filter(s => s !== id));
  };

  const handleDeleteCustomGoal = (id: string) => {
    setCustomGoals(customGoals.filter(g => g.id !== id));
    setSelectedGoals(selectedGoals.filter(g => g !== id));
  };

  // Project handlers
  const handleAddProject = (project: OnboardingProject) => {
    setOnboardingProjects([...onboardingProjects, project]);
  };

  const handleRemoveProject = (id: string) => {
    setOnboardingProjects(onboardingProjects.filter(p => p.id !== id));
  };

  const handleUpdateProject = (updatedProject: OnboardingProject) => {
    setOnboardingProjects(onboardingProjects.map(p =>
      p.id === updatedProject.id ? updatedProject : p
    ));
  };

  // Phone validation helper
  const isValidPhone = (phone: string) => {
    // Basic phone validation: at least 7 digits, allows +, spaces, dashes, parentheses
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  // GoalType enum values must match backend Prisma schema:
  // MENTORSHIP, INVESTMENT, PARTNERSHIP, HIRING, JOB_SEEKING, COLLABORATION, LEARNING, SALES, OTHER
  // Ordered: Expand Network, Business Partners, Investors, Talent, Clients, Find Mentor
  const OBJECTIVES = [
    { id: 'COLLABORATION', name: 'Expand Network', description: 'Grow your professional connections and meet new people' },
    { id: 'PARTNERSHIP', name: 'Find Business Partners', description: 'Looking for strategic business collaborations' },
    { id: 'INVESTMENT', name: 'Find Investors', description: 'Seeking funding for my project or startup' },
    { id: 'HIRING', name: 'Find Talent', description: 'Recruiting skilled professionals for my team' },
    { id: 'SALES', name: 'Find Clients', description: 'Looking for customers or business opportunities' },
    { id: 'MENTORSHIP', name: 'Find a Mentor', description: 'Seeking guidance from experienced professionals' },
  ];

  const TOTAL_STEPS = 6;

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Skip onboarding if already completed
  useEffect(() => {
    if (user?.hasCompletedOnboarding) {
      router.push(returnTo || '/dashboard');
    }
  }, [user, router, returnTo]);

  // Load saved onboarding progress on mount
  useEffect(() => {
    const loadSavedProgress = async () => {
      try {
        const token = getAccessToken();
        if (!token) return;

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profile/onboarding-progress`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const { currentStep, savedData, profile, isCompleted } = data.data;

            // If already completed, redirect
            if (isCompleted) {
              router.push(returnTo || '/dashboard');
              return;
            }

            // Restore saved data if available
            if (savedData) {
              // Restore step
              if (currentStep > 0) {
                setCurrentStep(currentStep);
                setHasEnriched(currentStep > 1); // Already enriched if past step 1 (Social & CV)
              }

              // Restore social data
              if (savedData.socialData) {
                setSocialData(savedData.socialData);
              }

              // Restore profile (handle migration from old location format)
              if (savedData.profile) {
                if ('location' in savedData.profile && !('city' in savedData.profile)) {
                  const locationParts = (savedData.profile.location || '').split(',').map((s: string) => s.trim());
                  setProfile({
                    company: savedData.profile.company || '',
                    jobTitle: savedData.profile.jobTitle || '',
                    city: locationParts[0] || '',
                    country: locationParts[1] || '',
                  });
                } else {
                  setProfile(savedData.profile);
                }
              }

              // Restore bio (support both old format and new dual bio format)
              if (savedData.bioSummary) {
                setBioSummary(savedData.bioSummary);
              }
              if (savedData.bioFull) {
                setBioFull(savedData.bioFull);
              }
              // Backward compatibility: if old bio exists, use it as full bio
              if (savedData.bio && !savedData.bioFull) {
                setBioFull(savedData.bio);
              }

              // Restore enrichment data
              if (savedData.enrichmentData) {
                setEnrichmentData(savedData.enrichmentData);
              }

              // Restore selections
              if (savedData.selectedSectors) setSelectedSectors(savedData.selectedSectors);
              if (savedData.selectedSkills) setSelectedSkills(savedData.selectedSkills);
              if (savedData.selectedInterests) setSelectedInterests(savedData.selectedInterests);
              if (savedData.selectedHobbies) setSelectedHobbies(savedData.selectedHobbies);
              if (savedData.selectedGoals) setSelectedGoals(savedData.selectedGoals);

              // Restore custom items
              if (savedData.customSectors) setCustomSectors(savedData.customSectors);
              if (savedData.customSkills) setCustomSkills(savedData.customSkills);
              if (savedData.customInterests) setCustomInterests(savedData.customInterests);
              if (savedData.customHobbies) setCustomHobbies(savedData.customHobbies);
              if (savedData.customGoals) setCustomGoals(savedData.customGoals);

              // Restore projects
              if (savedData.projects) setOnboardingProjects(savedData.projects);

              toast({
                title: t.onboarding.progressRestored?.title || 'Progress restored',
                description: t.onboarding.progressRestored?.description || 'Your previous progress has been loaded',
                variant: 'success',
              });
            } else if (profile) {
              // Load from existing profile if no saved progress but profile data exists
              if (profile.phone) setSocialData(prev => ({ ...prev, phone: profile.phone }));
              if (profile.linkedinUrl) setSocialData(prev => ({ ...prev, linkedinUrl: profile.linkedinUrl }));
              if (profile.twitterUrl) setSocialData(prev => ({ ...prev, twitterUrl: profile.twitterUrl }));
              if (profile.company || profile.jobTitle) {
                const locationParts = (profile.location || '').split(',').map((s: string) => s.trim());
                setProfile({
                  company: profile.company || '',
                  jobTitle: profile.jobTitle || '',
                  city: locationParts[0] || '',
                  country: locationParts[1] || '',
                });
              }
              // Restore bio from profile if available (use as full bio)
              if (profile.bio) setBioFull(profile.bio);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load onboarding progress:', error);
      }
    };

    if (isAuthenticated && !authLoading) {
      loadSavedProgress();
    }
  }, [isAuthenticated, authLoading, router, t]);

  // Save progress function
  const saveProgress = async (skipToast = false) => {
    try {
      const token = getAccessToken();
      if (!token) return;

      const progressData = {
        currentStep,
        socialData,
        profile,
        bioSummary,
        bioFull,
        enrichmentData,
        selectedSectors,
        selectedSkills,
        selectedInterests,
        selectedHobbies,
        selectedGoals,
        customSectors,
        customSkills,
        customInterests,
        customHobbies,
        customGoals,
        projects: onboardingProjects,
      };

      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profile/onboarding-progress`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(progressData),
      });

      if (!skipToast) {
        toast({
          title: t.onboarding.progressSaved?.title || 'Progress saved',
          description: t.onboarding.progressSaved?.description || 'You can continue later',
          variant: 'success',
        });
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  // Handle skip - save progress and go to dashboard
  const handleSkip = async () => {
    await saveProgress();
    router.push('/dashboard');
  };

  // Enrich profile when moving from step 1 to step 2
  // Priority: CV > LinkedIn (if CV exists, don't use LinkedIn)
  const handleEnrichProfile = async () => {
    setIsEnriching(true);
    setEnrichmentProgress(0);

    // Simulated progress timer
    const progressInterval = setInterval(() => {
      setEnrichmentProgress(prev => {
        if (prev >= 90) return prev;
        const increment = prev < 30 ? 8 : prev < 60 ? 5 : prev < 80 ? 3 : 1;
        return Math.min(prev + increment, 90);
      });
    }, 500);

    try {
      const formData = new FormData();

      // Debug: Log CV file details before sending
      if (cvFile) {
        console.log('CV file being sent:', {
          name: cvFile.name,
          size: cvFile.size,
          type: cvFile.type,
          lastModified: cvFile.lastModified,
        });
      }

      // If CV is uploaded, use CV only (don't use LinkedIn)
      // If no CV, then use LinkedIn URL
      if (cvFile) {
        formData.append('cv', cvFile);
      } else if (socialData.linkedinUrl) {
        formData.append('linkedInUrl', socialData.linkedinUrl);
      }

      if (socialData.twitterUrl) formData.append('twitterUrl', socialData.twitterUrl);
      if (socialData.bio) formData.append('bio', socialData.bio);
      formData.append('locale', locale); // Pass current locale for bio generation

      // Pass web search enhancement flag
      if (enhanceWithWebSearch) {
        formData.append('enhanceWithWebSearch', 'true');
      }

      const token = getAccessToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profile/enrich`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setEnrichmentData(data.data);

          // Pre-fill profile data
          if (data.data.profile) {
            setProfile({
              company: data.data.profile.company || '',
              jobTitle: data.data.profile.jobTitle || '',
              city: data.data.profile.city || '',
              country: data.data.profile.country || '',
            });
          }

          // Pre-fill bio and set direction
          // Use the new separate summary and full bio from the API
          const fullBio = data.data.generatedBioFull || data.data.generatedBio || socialData.bio || '';
          const summaryBio = data.data.generatedBioSummary || '';

          setBioFull(fullBio);

          // Use API-generated summary if available, otherwise create one from full bio
          if (summaryBio) {
            setBioSummary(summaryBio);
          } else if (fullBio) {
            let summary = fullBio.slice(0, 300);
            const lastPeriod = summary.lastIndexOf('.');
            if (lastPeriod > 150) {
              summary = summary.slice(0, lastPeriod + 1);
            } else if (summary.length === 300) {
              summary = summary.trim() + '...';
            }
            setBioSummary(summary);
          }
          setBioDirection(data.data.bioDirection || 'ltr');

          // Auto-select TOP 3 items from CV/LinkedIn (sorted by confidence)
          // Rest are shown but not selected - user can choose
          const sortedSectors = [...(data.data.suggestedSectors || [])]
            .filter((s: SuggestedItem) => s.confidence > 0.4)
            .sort((a: SuggestedItem, b: SuggestedItem) => b.confidence - a.confidence);
          const top3Sectors = sortedSectors.slice(0, 3).map((s: SuggestedItem) => s.id);
          setSelectedSectors(top3Sectors);

          // Also add custom sectors from enrichment to customSectors state
          const customSectorsFromEnrichment = data.data.suggestedSectors
            ?.filter((s: SuggestedItem) => s.isCustom) || [];
          if (customSectorsFromEnrichment.length > 0) {
            setCustomSectors(customSectorsFromEnrichment);
          }

          const sortedSkills = [...(data.data.suggestedSkills || [])]
            .filter((s: SuggestedItem) => s.confidence > 0.4)
            .sort((a: SuggestedItem, b: SuggestedItem) => b.confidence - a.confidence);
          const top3Skills = sortedSkills.slice(0, 3).map((s: SuggestedItem) => s.id);
          setSelectedSkills(top3Skills);

          // Also add custom skills from enrichment
          const customSkillsFromEnrichment = data.data.suggestedSkills
            ?.filter((s: SuggestedItem) => s.isCustom) || [];
          if (customSkillsFromEnrichment.length > 0) {
            setCustomSkills(customSkillsFromEnrichment);
          }

          const sortedInterests = [...(data.data.suggestedInterests || [])]
            .filter((s: SuggestedItem) => s.confidence > 0.4)
            .sort((a: SuggestedItem, b: SuggestedItem) => b.confidence - a.confidence);
          const top3Interests = sortedInterests.slice(0, 3).map((s: SuggestedItem) => s.id);
          setSelectedInterests(top3Interests);

          // Also add custom interests from enrichment
          const customInterestsFromEnrichment = data.data.suggestedInterests
            ?.filter((s: SuggestedItem) => s.isCustom) || [];
          if (customInterestsFromEnrichment.length > 0) {
            setCustomInterests(customInterestsFromEnrichment);
          }

          // Auto-select TOP 3 goals based on AI suggestion
          if (data.data.suggestedGoals && data.data.suggestedGoals.length > 0) {
            const sortedGoals = [...data.data.suggestedGoals]
              .filter((g: SuggestedGoal) => g.confidence > 0.4)
              .sort((a: SuggestedGoal, b: SuggestedGoal) => b.confidence - a.confidence);
            const top3Goals = sortedGoals.slice(0, 3).map((g: SuggestedGoal) => g.id);
            setSelectedGoals(top3Goals);
          }

          setEnrichmentProgress(100);

          toast({
            title: t.onboarding.enrichSuccess?.title || 'Profile analyzed!',
            description: t.onboarding.enrichSuccess?.description || 'We extracted your profile information',
            variant: 'success',
          });
        }
      }
    } catch (error) {
      setEnrichmentProgress(100);
      console.error('Enrichment error:', error);
      toast({
        title: t.onboarding.enrichError?.title || 'Analysis failed',
        description: t.onboarding.enrichError?.description || 'Could not analyze profile, please fill manually',
        variant: 'error',
      });
    } finally {
      clearInterval(progressInterval);
      setIsEnriching(false);
      setHasEnriched(true); // Mark enrichment as done
      setCurrentStep(2); // Move to Profile step after enrichment
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Objectives (Goals) - need at least 1
        return selectedGoals.length >= 1;
      case 1: // Social & CV - phone is mandatory
        return socialData.phone && isValidPhone(socialData.phone);
      case 2: // Profile - need company and job title
        return profile.company && profile.jobTitle;
      case 3: // Sectors
        return selectedSectors.length >= 1;
      case 4: // Skills & Interests
        return selectedSkills.length >= 1;
      case 5: // Projects - optional, can always proceed
        return true;
      default:
        return false;
    }
  };

  // Validation errors for each step
  const getStepErrors = (): Record<string, string> => {
    switch (currentStep) {
      case 0: // Objectives
        if (selectedGoals.length < 1) {
          return { goals: t.onboarding.validation?.selectGoal || 'Please select at least one goal' };
        }
        return {};
      case 1: // Social & CV
        const errors1: Record<string, string> = {};
        if (!socialData.phone) {
          errors1.phone = t.onboarding.validation?.phoneRequired || 'Phone number is required';
        } else if (!isValidPhone(socialData.phone)) {
          errors1.phone = t.onboarding.validation?.phoneInvalid || 'Please enter a valid phone number';
        }
        return errors1;
      case 2: // Profile
        const errors2: Record<string, string> = {};
        if (!profile.company) {
          errors2.company = t.onboarding.validation?.companyRequired || 'Company is required';
        }
        if (!profile.jobTitle) {
          errors2.jobTitle = t.onboarding.validation?.jobTitleRequired || 'Job title is required';
        }
        return errors2;
      case 3: // Sectors
        if (selectedSectors.length < 1) {
          return { sectors: t.onboarding.validation?.selectSector || 'Please select at least one sector' };
        }
        return {};
      case 4: // Skills
        if (selectedSkills.length < 1) {
          return { skills: t.onboarding.validation?.selectSkill || 'Please select at least one skill' };
        }
        return {};
      default:
        return {};
    }
  };

  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  const handleNext = async () => {
    // Check validation and show errors
    const errors = getStepErrors();
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      const firstError = Object.values(errors)[0];
      toast({
        title: t.onboarding.validation?.requiredFields || 'Required field missing',
        description: firstError,
        variant: 'error',
      });
      return;
    }
    setStepErrors({});

    if (currentStep === 1) {
      // Step 1 is Social & CV - trigger enrichment
      setStep0Submitted(true);

      // Only enrich if not already done (prevents overwriting user selections when going back)
      if (!hasEnriched) {
        await handleEnrichProfile();
      } else {
        // Already enriched, just move to next step
        setCurrentStep(2);
      }
    } else if (currentStep < TOTAL_STEPS - 1) {
      // Auto-save progress when moving to next step (silent save)
      saveProgress(true);
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      // Auto-save progress when going back (silent save)
      saveProgress(true);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);

    try {
      const goalTypeMapping: Record<string, string> = {
        'FIND_MENTOR': 'MENTORSHIP',
        'FIND_PARTNER': 'PARTNERSHIP',
        'FIND_INVESTOR': 'INVESTMENT',
        'FIND_TALENT': 'HIRING',
        'EXPAND_NETWORK': 'COLLABORATION',
        'FIND_CLIENTS': 'SALES',
        'LEARN_SKILLS': 'LEARNING',
      };

      // Separate standard and custom items
      const standardSectorIds = selectedSectors.filter(id => !id.startsWith('custom_'));
      const customSectorNames = customSectors.map(s => s.name);

      const standardSkillIds = selectedSkills.filter(id => !id.startsWith('custom_'));
      const customSkillNames = customSkills.map(s => s.name);

      const standardInterestIds = selectedInterests.filter(id => !id.startsWith('custom_'));
      const customInterestNames = customInterests.map(s => s.name);

      const standardHobbyIds = selectedHobbies.filter(id => !id.startsWith('custom_'));
      const customHobbyNames = customHobbies.map(s => s.name);

      const standardGoalIds = selectedGoals.filter(id => !id.startsWith('custom_'));
      const customGoalNames = customGoals.map(g => g.name);

      const onboardingData = {
        company: profile.company,
        jobTitle: profile.jobTitle,
        location: [profile.city, profile.country].filter(Boolean).join(', ') || undefined,
        phone: socialData.phone || undefined,
        bio: bioFull || bioSummary || undefined,
        linkedInUrl: socialData.linkedinUrl || undefined,
        twitterUrl: socialData.twitterUrl || undefined,
        sectors: standardSectorIds,
        skills: standardSkillIds,
        interests: standardInterestIds,
        hobbies: standardHobbyIds,
        goals: standardGoalIds.map(g => goalTypeMapping[g] || g),
        customSectors: customSectorNames.filter(Boolean),
        customSkills: customSkillNames.filter(Boolean),
        customInterests: customInterestNames.filter(Boolean),
        customHobbies: customHobbyNames.filter(Boolean),
        customGoals: customGoalNames.filter(Boolean),
      };

      await api.post('/profile/onboarding', onboardingData);

      // Save projects to backend if any were added
      if (onboardingProjects.length > 0) {
        for (const project of onboardingProjects) {
          try {
            await createProject({
              title: project.title,
              summary: project.summary,
              detailedDesc: project.detailedDesc,
              category: project.category,
              stage: project.stage,
              investmentRange: project.investmentRange,
              timeline: project.timeline,
              lookingFor: project.lookingFor,
              sectorIds: project.sectorIds,
              skills: project.skills,
              visibility: project.visibility,
            });
          } catch (projectError) {
            console.error('Failed to create project:', project.title, projectError);
            // Continue with other projects even if one fails
          }
        }
      }

      toast({
        title: t.onboarding.success?.title || 'Profile complete!',
        description: t.onboarding.success?.description || 'Welcome to IntellMatch',
        variant: 'success',
      });

      router.push(returnTo || '/dashboard');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast({
        title: t.onboarding.error?.title || 'Error',
        description: error.message || t.onboarding.error?.description || 'Could not save profile',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-th-bg">
        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-th-bg text-th-text overflow-hidden" dir={dir}>
      <style jsx global>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -30px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(30px, 10px) scale(1.05); }
        }
        .animate-blob { animation: blob 8s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>

      <GradientOrbs />

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />

      <div className="relative min-h-screen flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <img src="/intelllogo.png" alt="IntellMatch" className="h-16 w-auto mx-auto" />
            </div>
            <h1 className="text-3xl font-bold text-th-text mb-2">{t.onboarding?.title || 'Set Up Your Profile'}</h1>
            <p className="text-th-text-t">{t.onboarding?.subtitle || 'Help us personalize your experience'}</p>
          </div>

          {/* Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 rounded-3xl blur-xl" />
            <div className="relative bg-th-surface backdrop-blur-xl border border-th-border rounded-2xl p-8 shadow-2xl">
              <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

              {/* Content */}
              <div className="min-h-[300px]">
                {/* Step 0: Goals/Objectives */}
                {currentStep === 0 && (
                  <>
                    {/* Welcome message */}
                    <div className="mb-6 text-center">
                      <h2 className="text-2xl font-bold text-th-text mb-2">
                        {user?.firstName || user?.name
                          ? ((t.onboarding as any).welcome?.greeting || 'Welcome, {name}!').replace('{name}', user?.firstName || user?.name?.split(' ')[0] || '')
                          : (t.onboarding as any).welcome?.greetingGeneric || 'Welcome to IntellMatch!'}
                      </h2>
                      <p className="text-sm text-th-text-s max-w-md mx-auto">
                        {(t.onboarding as any).welcome?.subtitle || "We're excited to have you here. Let's set up your profile in a few quick steps so we can connect you with the right people."}
                      </p>
                    </div>
                  </>
                )}
                {currentStep === 0 && (
                  <ObjectivesStep
                    items={OBJECTIVES}
                    selected={selectedGoals}
                    onChange={setSelectedGoals}
                    customObjectives={customGoals}
                    onAddCustomObjective={handleAddCustomGoal}
                    onDeleteCustomObjective={handleDeleteCustomGoal}
                    error={stepErrors.goals}
                  />
                )}
                {/* Step 1: Social & CV */}
                {currentStep === 1 && (
                  <SocialCVStep
                    data={socialData}
                    onChange={setSocialData}
                    cvFile={cvFile}
                    onCVChange={(file) => {
                      setCvFile(file);
                      if (file) setHasEnriched(false);
                    }}
                    isProcessing={isEnriching}
                    showValidation={step0Submitted || !!stepErrors.phone}
                    enhanceWithWebSearch={enhanceWithWebSearch}
                    onEnhanceWithWebSearchChange={setEnhanceWithWebSearch}
                  />
                )}
                {/* Step 2: Profile */}
                {currentStep === 2 && (
                  <ProfileStep
                    profile={profile}
                    bioSummary={bioSummary}
                    bioFull={bioFull}
                    activeBioTab={activeBioTab}
                    bioDirection={bioDirection}
                    onProfileChange={setProfile}
                    onBioSummaryChange={setBioSummary}
                    onBioFullChange={setBioFull}
                    onBioTabChange={setActiveBioTab}
                    errors={stepErrors}
                  />
                )}
                {/* Step 3: Sectors */}
                {currentStep === 3 && (
                  <SectorsStep
                    items={enrichmentData?.suggestedSectors || []}
                    selected={selectedSectors}
                    onChange={setSelectedSectors}
                    customItems={customSectors}
                    onAddCustom={handleAddCustomSector}
                    onDeleteCustom={handleDeleteCustomSector}
                    error={stepErrors.sectors}
                  />
                )}
                {/* Step 4: Skills & Interests */}
                {currentStep === 4 && (
                  <SkillsInterestsStep
                    skills={enrichmentData?.suggestedSkills || []}
                    interests={enrichmentData?.suggestedInterests || []}
                    hobbies={enrichmentData?.suggestedHobbies || []}
                    selectedSkills={selectedSkills}
                    selectedInterests={selectedInterests}
                    selectedHobbies={selectedHobbies}
                    onSkillsChange={setSelectedSkills}
                    onInterestsChange={setSelectedInterests}
                    onHobbiesChange={setSelectedHobbies}
                    customSkills={customSkills}
                    customInterests={customInterests}
                    customHobbies={customHobbies}
                    onAddCustomSkill={handleAddCustomSkill}
                    onAddCustomInterest={handleAddCustomInterest}
                    onAddCustomHobby={handleAddCustomHobby}
                    onDeleteCustomSkill={handleDeleteCustomSkill}
                    onDeleteCustomInterest={handleDeleteCustomInterest}
                    onDeleteCustomHobby={handleDeleteCustomHobby}
                    error={stepErrors.skills}
                  />
                )}
                {/* Step 5: Features (Optional) */}
                {currentStep === 5 && (
                  <FeatureCardsStep
                    projects={onboardingProjects}
                    onAddProject={handleAddProject}
                    onRemoveProject={handleRemoveProject}
                    onUpdateProject={handleUpdateProject}
                  />
                )}
              </div>

              {/* Footer buttons */}
              <div className="flex gap-3 mt-8">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={isLoading || isEnriching}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-th-border text-th-text-s hover:bg-th-surface hover:border-white/20 transition-all disabled:opacity-50"
                  >
                    <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
                    {t.onboarding.buttons?.back || 'Back'}
                  </button>
                )}

                {currentStep < TOTAL_STEPS - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={isEnriching || (currentStep !== 0 && !canProceed())}
                    className="relative flex-1 group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
                    <span className="relative flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
                      {isEnriching ? (
                        <span className="w-full flex flex-col items-center gap-1">
                          <span className="text-sm">{enrichmentProgress < 100 ? (t.onboarding.buttons?.analyzing || 'Analyzing...') : 'Done!'}</span>
                          <span className="w-full max-w-[200px] bg-th-surface-h rounded-full h-1.5">
                            <span
                              className="block bg-white h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${enrichmentProgress}%` }}
                            />
                          </span>
                        </span>
                      ) : (
                        <>
                          {currentStep === 1 ? (t.onboarding.buttons?.analyzeProfile || 'Analyze Profile') : (t.onboarding.buttons?.continue || 'Continue')}
                          <ArrowRight24Regular className="w-5 h-5 rtl:rotate-180" />
                        </>
                      )}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={!canProceed() || isLoading}
                    className="relative flex-1 group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
                    <span className="relative flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {t.onboarding.buttons?.saving || 'Saving...'}
                        </>
                      ) : (
                        <>
                          {t.onboarding.buttons?.completeSetup || 'Complete Setup'}
                          <Checkmark24Regular className="w-5 h-5" />
                        </>
                      )}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Skip option */}
          <p className="text-center mt-6">
            <button
              onClick={handleSkip}
              className="text-sm text-th-text-m hover:text-th-text-s transition-colors"
            >
              {t.onboarding?.skipForNow || 'Skip for now'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <I18nProvider>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-th-bg">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <OnboardingContent />
      </Suspense>
    </I18nProvider>
  );
}
