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

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/Toast';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { api, getAccessToken } from '@/lib/api/client';
import { createProject, extractFromDocument, STAGE_OPTIONS, LOOKING_FOR_OPTIONS, ProjectStage, SkillImportance } from '@/lib/api/projects';
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
} from '@fluentui/react-icons';

// Editable indicator component - shows when field has content
const EditableIndicator = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="absolute -top-2 end-2 flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-[10px] text-purple-400 z-10">
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
    <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
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
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t.onboarding.cvBio?.bio || 'Professional Bio'}
            </h3>
            <p className="text-sm text-neutral-400 mt-0.5">
              {t.onboarding.bioPreview?.subtitle || 'Write a compelling summary of your professional background'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Bio Tabs */}
          <div className={`flex gap-1 mb-4 p-1 bg-white/5 rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button
              type="button"
              onClick={() => setLocalTab('summary')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                localTab === 'summary'
                  ? 'bg-purple-500 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.onboarding.cvBio?.summarized || 'Summarized'}
            </button>
            <button
              type="button"
              onClick={() => setLocalTab('full')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                localTab === 'full'
                  ? 'bg-purple-500 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
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
                rows={6}
                maxLength={300}
                dir={bioDirection}
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none text-base leading-relaxed"
                autoFocus
              />
              <div className={`flex items-center justify-between mt-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <p className="text-xs text-neutral-500">
                  {t.onboarding.cvBio?.summaryTipLong || 'Tip: Focus on key achievements and unique value proposition'}
                </p>
                <p className={`text-xs ${localSummary.length > 270 ? 'text-amber-400' : 'text-neutral-500'}`}>
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
                rows={12}
                maxLength={2000}
                dir={bioDirection}
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none text-base leading-relaxed"
                autoFocus
              />
              <div className={`flex items-center justify-between mt-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <p className="text-xs text-neutral-500">
                  {t.onboarding.cvBio?.fullTipLong || 'Tip: Include detailed experience, education, and career highlights'}
                </p>
                <p className={`text-xs ${localFull.length > 1800 ? 'text-amber-400' : 'text-neutral-500'}`}>
                  {localFull.length}/2000 {t.onboarding.bioPreview?.characters || 'characters'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {t.common?.cancel || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all"
          >
            {t.common?.save || 'Save'}
          </button>
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
    { id: 'social', title: t.onboarding.steps.socialMedia?.title || 'Social & CV', description: t.onboarding.steps.socialMedia?.description || 'Connect profiles' },
    { id: 'profile', title: t.onboarding.steps.profile?.title || 'Profile', description: t.onboarding.steps.profile?.description || 'Your details' },
    { id: 'sectors', title: t.onboarding.steps.sectors?.title || 'Sectors', description: t.onboarding.steps.sectors?.description || 'Your industry' },
    { id: 'skills', title: t.onboarding.steps.skills?.title || 'Skills', description: t.onboarding.steps.skills?.description || 'Your expertise' },
    { id: 'projects', title: t.onboarding.steps.projects?.title || 'Projects', description: t.onboarding.steps.projects?.description || 'Your ideas' },
    { id: 'objectives', title: t.onboarding.steps.objectives?.title || 'Objectives', description: t.onboarding.steps.objectives?.description || 'What you seek' },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-1 mb-4">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                index <= currentStep
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                  : 'bg-white/10'
              }`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-white">{STEPS[currentStep].title}</p>
          <p className="text-sm text-neutral-400">{STEPS[currentStep].description}</p>
        </div>
        <div className="text-sm text-neutral-500">
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
      <p className="text-sm text-neutral-400 mb-4">
        {t.onboarding.socialCVStep?.description || 'Add your social profiles and CV to auto-fill your profile with AI'}
      </p>

      {/* LinkedIn */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          {t.onboarding.socialMedia?.linkedinUrl || 'LinkedIn Profile URL'} <span className="text-neutral-500">{t.onboarding.socialMedia?.optional || '(Optional)'}</span>
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
            className="w-full ps-12 pe-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all disabled:opacity-50"
          />
        </div>
      </div>

      {/* X (Twitter) */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          {t.onboarding.socialMedia?.twitterUrl || 'X (Twitter) Profile URL'} <span className="text-neutral-500">{t.onboarding.socialMedia?.optional || '(Optional)'}</span>
        </label>
        <div className="relative">
          <EditableIndicator show={!!data.twitterUrl} />
          <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
            <XIcon className="w-5 h-5 text-white" />
          </div>
          <input
            type="url"
            placeholder={t.onboarding.socialMedia?.twitterPlaceholder || 'https://x.com/yourhandle'}
            value={data.twitterUrl}
            onChange={(e) => onChange({ ...data, twitterUrl: e.target.value })}
            disabled={isProcessing}
            className="w-full ps-12 pe-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all disabled:opacity-50"
          />
        </div>
      </div>

      {/* Phone - Mandatory */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-neutral-300">
            {t.onboarding.profile?.phone || 'Phone Number'}
          </label>
          <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[10px] font-medium text-red-400">
            Required
          </span>
        </div>
        <div className="relative">
          <EditableIndicator show={!!data.phone && isValidPhone(data.phone)} />
          <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
            <svg className={`w-5 h-5 ${(phoneError || phoneMissing) ? 'text-red-400' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <input
            type="tel"
            placeholder={t.onboarding.profile?.phonePlaceholder || '+1 234 567 8900'}
            value={data.phone}
            onChange={(e) => onChange({ ...data, phone: e.target.value })}
            onBlur={() => setPhoneTouched(true)}
            disabled={isProcessing}
            className={`w-full ps-12 pe-4 py-3 bg-white/5 border rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
              (phoneError || phoneMissing)
                ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500 animate-pulse'
                : 'border-white/10 focus:ring-purple-500/50 focus:border-purple-500'
            }`}
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
      </div>

      {/* CV Upload */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          {t.onboarding.cvBio?.uploadCv || 'Upload CV'} <span className="text-neutral-500">{t.onboarding.socialMedia?.optional || '(Optional)'}</span>
        </label>

        {!cvFile ? (
          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative cursor-pointer border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200 ${
              isDragging
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-white/20 hover:border-white/40 hover:bg-white/5'
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
            <ArrowUpload24Regular className="w-7 h-7 mx-auto text-neutral-400 mb-2" />
            <p className="text-neutral-300 text-sm">{t.onboarding.cvBio?.dragDropCv || 'Drag and drop or click to browse'}</p>
            <p className="text-xs text-neutral-500 mt-1">{t.onboarding.cvBio?.supportedFormats || 'PDF, DOC, DOCX (Max 5MB)'}</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <DocumentText24Regular className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{cvFile.name}</p>
                  <p className="text-xs text-neutral-500">
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
                  className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
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
        <div className="mt-3 p-3 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl">
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
                enhanceWithWebSearch ? 'bg-purple-500' : 'bg-white/10'
              } ${isProcessing ? 'opacity-50' : ''}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
                  enhanceWithWebSearch ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {t.onboarding.enhanceWithWebSearch?.title || 'Enhance with Online Search'}
                </span>
                <span className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[10px] font-medium text-purple-400">
                  Beta
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {t.onboarding.enhanceWithWebSearch?.description || 'Search the web for additional information about you to enrich your profile with the latest data'}
              </p>
            </div>
          </label>
        </div>
      )}

      <p className="text-xs text-neutral-500 mt-4 flex items-center gap-1">
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
}: {
  profile: { company: string; jobTitle: string; location: string };
  bioSummary: string;
  bioFull: string;
  activeBioTab: 'summary' | 'full';
  bioDirection?: 'rtl' | 'ltr';
  onProfileChange: (data: any) => void;
  onBioSummaryChange: (bio: string) => void;
  onBioFullChange: (bio: string) => void;
  onBioTabChange: (tab: 'summary' | 'full') => void;
}) {
  const { t, lang } = useI18n();
  const [isBioDialogOpen, setIsBioDialogOpen] = useState(false);

  // Detect RTL: check language setting, bioDirection prop, or Arabic content in bio
  const hasArabicContent = /[\u0600-\u06FF]/.test((bioFull || bioSummary).slice(0, 100));
  const isRtl = lang === 'ar' || bioDirection === 'rtl' || hasArabicContent;

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
        <Sparkle24Regular className="w-5 h-5 text-purple-400" />
        {t.onboarding.reviewStep?.description || 'Review your profile information'}
      </p>

      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">{t.onboarding.profile?.company || 'Company'} *</label>
        <div className="relative">
          <EditableIndicator show={!!profile.company} />
          <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
            <Briefcase24Regular className="w-5 h-5 text-neutral-500" />
          </div>
          <input
            type="text"
            value={profile.company}
            onChange={(e) => onProfileChange({ ...profile, company: e.target.value })}
            placeholder={t.onboarding.profile?.companyPlaceholder || 'Company name'}
            className="w-full ps-12 pe-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">{t.onboarding.profile?.jobTitle || 'Job Title'} *</label>
        <div className="relative">
          <EditableIndicator show={!!profile.jobTitle} />
          <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
            <Person24Regular className="w-5 h-5 text-neutral-500" />
          </div>
          <input
            type="text"
            value={profile.jobTitle}
            onChange={(e) => onProfileChange({ ...profile, jobTitle: e.target.value })}
            placeholder={t.onboarding.profile?.jobTitlePlaceholder || 'Your role'}
            className="w-full ps-12 pe-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">{t.onboarding.profile?.location || 'Location'}</label>
        <div className="relative">
          <EditableIndicator show={!!profile.location} />
          <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
            <Location24Regular className="w-5 h-5 text-neutral-500" />
          </div>
          <input
            type="text"
            value={profile.location}
            onChange={(e) => onProfileChange({ ...profile, location: e.target.value })}
            placeholder={t.onboarding.profile?.locationPlaceholder || 'City, Country'}
            className="w-full ps-12 pe-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
      </div>

      {/* Bio Section with Tabs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-neutral-300">{t.onboarding.cvBio?.bio || 'Professional Bio'}</label>
          <button
            type="button"
            onClick={() => setIsBioDialogOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
          >
            <FullScreenMaximize24Regular className="w-4 h-4" />
            {t.onboarding.bioPreview?.expand || 'Expand'}
          </button>
        </div>

        {/* Bio Tabs */}
        <div className={`flex gap-1 mb-3 p-1 bg-white/5 rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}>
          <button
            type="button"
            onClick={() => onBioTabChange('summary')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeBioTab === 'summary'
                ? 'bg-purple-500 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.onboarding.cvBio?.summarized || 'Summarized'}
          </button>
          <button
            type="button"
            onClick={() => onBioTabChange('full')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeBioTab === 'full'
                ? 'bg-purple-500 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.onboarding.cvBio?.fullBio || 'Full Bio'}
          </button>
        </div>

        {/* Bio Content */}
        <div className="relative">
          {activeBioTab === 'summary' ? (
            <>
              <EditableIndicator show={!!bioSummary} />
              <textarea
                value={bioSummary}
                onChange={(e) => onBioSummaryChange(e.target.value)}
                placeholder={t.onboarding.cvBio?.summaryPlaceholder || 'Key highlights of your professional background...'}
                rows={4}
                maxLength={300}
                dir={bioDirection}
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              />
              <div className={`flex justify-between mt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs text-neutral-500">{t.onboarding.cvBio?.summaryTip || 'Key points only'}</span>
                <span className={`text-xs ${bioSummary.length > 270 ? 'text-amber-400' : 'text-neutral-500'}`}>
                  {bioSummary.length}/300
                </span>
              </div>
            </>
          ) : (
            <>
              <EditableIndicator show={!!bioFull} />
              <textarea
                value={bioFull}
                onChange={(e) => onBioFullChange(e.target.value)}
                placeholder={t.onboarding.cvBio?.fullPlaceholder || 'Detailed professional background, experience, and achievements...'}
                rows={8}
                maxLength={2000}
                dir={bioDirection}
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              />
              <div className={`flex justify-between mt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs text-neutral-500">{t.onboarding.cvBio?.fullTip || 'Complete details'}</span>
                <span className={`text-xs ${bioFull.length > 1800 ? 'text-amber-400' : 'text-neutral-500'}`}>
                  {bioFull.length}/2000
                </span>
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
}: {
  items: SuggestedItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  customItems: SuggestedItem[];
  onAddCustom: (name: string) => void;
  onDeleteCustom: (id: string) => void;
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
  const seenIds = new Set<string>();
  const allItems = [...items.filter(item => !item.isCustom), ...customItems].filter(item => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });

  return (
    <div>
      <p className="text-sm text-neutral-400 mb-4">
        {t.onboarding.selectRelevant || 'Select all that apply'} ({t.onboarding.selectedCount?.replace('{count}', String(selected.length)) || `${selected.length} selected`})
      </p>
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
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white pe-8'
                    : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10'
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
                  className="absolute top-1/2 -translate-y-1/2 end-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-all"
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
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={!customInput.trim()}
          className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
  // Also deduplicate by ID to prevent any duplicates
  const deduplicateItems = (items: SuggestedItem[], customItems: SuggestedItem[]) => {
    const seenIds = new Set<string>();
    return [...items.filter(item => !item.isCustom), ...customItems].filter(item => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
  };

  const allSkills = deduplicateItems(skills, customSkills);
  const allInterests = deduplicateItems(interests, customInterests);
  const allHobbies = deduplicateItems(hobbies, customHobbies);

  return (
    <div className="space-y-6 max-h-[55vh] overflow-y-auto pe-2">
      {/* Skills */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-3">
          {t.onboarding.steps?.skills?.title || 'Skills'}
          <span className="text-neutral-500 font-normal ms-2">({t.onboarding.selectedCount?.replace('{count}', String(selectedSkills.length)) || `${selectedSkills.length} selected`})</span>
        </label>
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
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white pe-6'
                      : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10'
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
                    className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-all"
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
              className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustomSkill}
            disabled={!customSkillInput.trim()}
            className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all disabled:opacity-50 text-xs"
          >
            {t.common?.add || 'Add'}
          </button>
        </div>
      </div>

      {/* Interests */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-3">
          {t.onboarding.steps?.interests?.title || 'Interests'}
          <span className="text-neutral-500 font-normal ms-2">({t.onboarding.selectedCount?.replace('{count}', String(selectedInterests.length)) || `${selectedInterests.length} selected`})</span>
        </label>
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
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white pe-6'
                      : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10'
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
                    className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-all"
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
              className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustomInterest}
            disabled={!customInterestInput.trim()}
            className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all disabled:opacity-50 text-xs"
          >
            {t.common?.add || 'Add'}
          </button>
        </div>
      </div>

      {/* Hobbies */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-3">
          {t.onboarding.steps?.hobbies?.title || 'Hobbies'}
          <span className="text-neutral-500 font-normal ms-2">({t.onboarding.selectedCount?.replace('{count}', String(selectedHobbies.length)) || `${selectedHobbies.length} selected`})</span>
        </label>
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
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white pe-6'
                      : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10'
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
                    className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-all"
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
              className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustomHobby}
            disabled={!customHobbyInput.trim()}
            className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all disabled:opacity-50 text-xs"
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
 * Step 5: Projects - Full form matching Create Project page
 */
function ProjectsStep({
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

  // Lookup data
  const [sectors, setSectors] = useState<ProjectSector[]>([]);
  const [skills, setSkills] = useState<ProjectSkill[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [detailedDesc, setDetailedDesc] = useState('');
  const [category, setCategory] = useState('');
  const [stage, setStage] = useState<ProjectStage>('IDEA');
  const [investmentRange, setInvestmentRange] = useState('');
  const [timeline, setTimeline] = useState('');
  const [selectedLookingFor, setSelectedLookingFor] = useState<string[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Array<{ skillId: string; importance: SkillImportance }>>([]);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'CONNECTIONS_ONLY' | 'PRIVATE'>('PUBLIC');

  // Document upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractedFromDoc, setExtractedFromDoc] = useState(false);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sectorsExpanded, setSectorsExpanded] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // Edit mode state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const isEditing = editingProjectId !== null;

  // Fetch sectors and skills
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

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
      setSelectedFile(file);
      // Show success toast with file size info
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast({
        title: 'File selected',
        description: `${file.name} (${fileSizeMB} MB) ready for extraction`,
        variant: 'success'
      });
    }
  };

  // Handle document extraction
  const handleExtractFromDocument = async () => {
    if (!selectedFile) return;
    setIsExtracting(true);
    setExtractionProgress(0);

    // Simulate progress while extracting
    const progressInterval = setInterval(() => {
      setExtractionProgress(prev => {
        if (prev >= 90) return prev; // Cap at 90% until complete
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const extracted = await extractFromDocument(selectedFile);
      setExtractionProgress(100);
      if (extracted.title) setTitle(extracted.title);
      if (extracted.summary) setSummary(extracted.summary);
      if (extracted.detailedDesc) setDetailedDesc(extracted.detailedDesc);
      if (extracted.category) setCategory(extracted.category);
      if (extracted.stage) setStage(extracted.stage);
      if (extracted.investmentRange) setInvestmentRange(extracted.investmentRange);
      if (extracted.timeline) setTimeline(extracted.timeline);
      if (extracted.lookingFor?.length) setSelectedLookingFor(extracted.lookingFor);
      if (extracted.sectorIds?.length) setSelectedSectorIds(extracted.sectorIds);
      if (extracted.skills?.length) setSelectedSkills(extracted.skills);
      setExtractedFromDoc(true);
      setShowAdvanced(true);
      toast({ title: 'Data Extracted', description: 'Project data has been extracted from your document.', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to extract data', variant: 'error' });
    } finally {
      clearInterval(progressInterval);
      setIsExtracting(false);
      setExtractionProgress(0);
    }
  };

  const handleClearFile = () => { setSelectedFile(null); setExtractedFromDoc(false); };
  const toggleLookingFor = (id: string) => setSelectedLookingFor(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSector = (id: string) => setSelectedSectorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSkill = (id: string) => {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.skillId === id);
      if (exists) return prev.filter(s => s.skillId !== id);
      return [...prev, { skillId: id, importance: 'REQUIRED' as SkillImportance }];
    });
  };

  const resetForm = () => {
    setTitle(''); setSummary(''); setDetailedDesc(''); setCategory(''); setStage('IDEA');
    setInvestmentRange(''); setTimeline(''); setSelectedLookingFor([]); setSelectedSectorIds([]);
    setSelectedSkills([]); setVisibility('PUBLIC'); setSelectedFile(null); setExtractedFromDoc(false);
    setShowAdvanced(false); setSectorsExpanded(false); setSkillsExpanded(false);
    setSummaryExpanded(false); setDetailsExpanded(false); setTimelineExpanded(false);
    setEditingProjectId(null); // Clear edit mode
  };

  // Handle editing an existing project
  const handleEditProject = (project: OnboardingProject) => {
    setEditingProjectId(project.id);
    setTitle(project.title);
    setSummary(project.summary);
    setDetailedDesc(project.detailedDesc || '');
    setCategory(project.category || '');
    setStage(project.stage || 'IDEA');
    setInvestmentRange(project.investmentRange || '');
    setTimeline(project.timeline || '');
    setSelectedLookingFor(project.lookingFor || []);
    setSelectedSectorIds(project.sectorIds || []);
    setSelectedSkills(project.skills || []);
    setVisibility(project.visibility || 'PUBLIC');
    setShowAdvanced(true); // Show all fields when editing
    // Scroll to top of form
    const formElement = document.getElementById('project-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Handle cancel editing
  const handleCancelEdit = () => {
    resetForm();
    toast({ title: 'Edit Cancelled', variant: 'info' });
  };

  const handleAddProject = () => {
    if (!title.trim() || !summary.trim()) {
      toast({ title: 'Error', description: 'Title and summary are required', variant: 'error' });
      return;
    }

    if (isEditing) {
      // Update existing project
      const updatedProject: OnboardingProject = {
        id: editingProjectId!,
        title: title.trim(),
        summary: summary.trim(),
        detailedDesc: detailedDesc.trim() || undefined,
        category: category || undefined,
        stage,
        investmentRange: investmentRange.trim() || undefined,
        timeline: timeline.trim() || undefined,
        lookingFor: selectedLookingFor.length > 0 ? selectedLookingFor : undefined,
        sectorIds: selectedSectorIds.length > 0 ? selectedSectorIds : undefined,
        skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        visibility,
      };
      onUpdateProject(updatedProject);
      resetForm();
      toast({ title: 'Project Updated', description: 'Your project has been updated.', variant: 'success' });
      // Scroll to top of form so user can add a new project
      setTimeout(() => {
        const formElement = document.getElementById('project-form');
        if (formElement) {
          formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      // Add new project
      const newProject: OnboardingProject = {
        id: `project_${Date.now()}`,
        title: title.trim(),
        summary: summary.trim(),
        detailedDesc: detailedDesc.trim() || undefined,
        category: category || undefined,
        stage,
        investmentRange: investmentRange.trim() || undefined,
        timeline: timeline.trim() || undefined,
        lookingFor: selectedLookingFor.length > 0 ? selectedLookingFor : undefined,
        sectorIds: selectedSectorIds.length > 0 ? selectedSectorIds : undefined,
        skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        visibility,
      };
      onAddProject(newProject);
      resetForm();
      toast({ title: 'Project Added', description: 'You can add more projects or continue.', variant: 'success' });
      // Scroll to top of form so user can add another project
      setTimeout(() => {
        const formElement = document.getElementById('project-form');
        if (formElement) {
          formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  const CATEGORIES = ['technology', 'healthcare', 'finance', 'education', 'ecommerce', 'social', 'entertainment', 'sustainability', 'other'];

  return (
    <div id="project-form" className="space-y-4 max-h-[60vh] overflow-y-auto pe-1">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-purple-400">
          <Lightbulb24Regular className="w-5 h-5" />
          <span className="font-medium">{t.onboarding?.projects?.title || 'Project Ideas'}</span>
          <span className="text-xs text-neutral-500">(Optional)</span>
        </div>
        {isEditing && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded-lg">
              Editing Project
            </span>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-neutral-400 mb-3">
        {isEditing
          ? 'Update your project details below.'
          : 'Add project ideas you\'d like to collaborate on. Upload a document or fill in manually.'}
      </p>

      {/* Document Upload */}
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-3">
        <div className="flex items-center gap-2 text-purple-400 mb-2">
          <Document24Regular className="w-4 h-4" />
          <span className="text-xs font-medium">Upload Project Document (Optional)</span>
        </div>
        {!selectedFile ? (
          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-purple-500/50 hover:bg-white/5 transition-all">
            <ArrowUpload24Regular className="w-5 h-5 text-neutral-400 mb-1" />
            <span className="text-[10px] text-neutral-500">PDF, DOCX, DOC, TXT (max 10MB)</span>
            <input type="file" className="hidden" accept=".pdf,.docx,.doc,.txt" onChange={handleFileSelect} />
          </label>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
              <Document24Regular className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-white truncate flex-1">{selectedFile.name}</span>
              <button type="button" onClick={handleClearFile} className="text-neutral-400 hover:text-white">
                <Dismiss24Regular className="w-4 h-4" />
              </button>
            </div>
            {!extractedFromDoc ? (
              <div className="space-y-2">
                <button type="button" onClick={handleExtractFromDocument} disabled={isExtracting}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
                  {isExtracting ? <><ArrowSync24Regular className="w-4 h-4 animate-spin" />Extracting...</> : <><Lightbulb24Regular className="w-4 h-4" />Extract with AI</>}
                </button>
                {isExtracting && (
                  <div className="space-y-1">
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(extractionProgress, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-neutral-400 text-center">
                      {extractionProgress < 30 ? 'Reading document...' :
                       extractionProgress < 60 ? 'Analyzing content...' :
                       extractionProgress < 90 ? 'Extracting data...' : 'Finishing up...'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-green-400 text-xs"><Checkmark24Regular className="w-3 h-3" />Data extracted!</div>
            )}
          </div>
        )}
      </div>

      {/* Project Form */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-3">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">Project Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., AI-Powered Health App"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm" />
        </div>

        {/* Summary */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-neutral-400">Summary *</label>
            <button type="button" onClick={() => setSummaryExpanded(!summaryExpanded)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
              <FullScreenMaximize24Regular className="w-3 h-3" />{summaryExpanded ? 'Less' : 'Expand'}
            </button>
          </div>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Brief description (2-3 sentences)" rows={summaryExpanded ? 6 : 2}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm resize-none transition-all" />
        </div>

        {/* Advanced Toggle */}
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
          {showAdvanced ? <ChevronUp24Regular className="w-4 h-4" /> : <ChevronDown24Regular className="w-4 h-4" />}
          {showAdvanced ? 'Hide details' : 'Show all fields'}
        </button>

        {showAdvanced && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            {/* Detailed Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-neutral-400">Detailed Description</label>
                <button type="button" onClick={() => setDetailsExpanded(!detailsExpanded)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  <FullScreenMaximize24Regular className="w-3 h-3" />{detailsExpanded ? 'Less' : 'Expand'}
                </button>
              </div>
              <textarea value={detailedDesc} onChange={(e) => setDetailedDesc(e.target.value)} placeholder="More details about your vision..." rows={detailsExpanded ? 8 : 3}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm resize-none transition-all" />
            </div>

            {/* Category & Stage Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                  <option value="" className="bg-neutral-900">Select...</option>
                  {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-neutral-900">{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Investment Range</label>
                <input type="text" value={investmentRange} onChange={(e) => setInvestmentRange(e.target.value)} placeholder="e.g., $50K - $100K"
                  className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
              </div>
            </div>

            {/* Stage */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Project Stage</label>
              <div className="flex flex-wrap gap-1">
                {STAGE_OPTIONS.map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setStage(opt.id as ProjectStage)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${stage === opt.id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-neutral-400">Timeline</label>
                <button type="button" onClick={() => setTimelineExpanded(!timelineExpanded)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  <FullScreenMaximize24Regular className="w-3 h-3" />{timelineExpanded ? 'Less' : 'Expand'}
                </button>
              </div>
              <textarea value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g., Phase 1: MVP (3 months)" rows={timelineExpanded ? 6 : 2}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm resize-none transition-all" />
            </div>

            {/* Looking For */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Looking For</label>
              <div className="flex flex-wrap gap-1">
                {LOOKING_FOR_OPTIONS.map((opt) => (
                  <button key={opt.id} type="button" onClick={() => toggleLookingFor(opt.id)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${selectedLookingFor.includes(opt.id) ? 'bg-green-500/20 text-green-300 border border-green-500/50' : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10'}`}>
                    {selectedLookingFor.includes(opt.id) && <Checkmark24Regular className="w-3 h-3 inline mr-1" />}{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sectors */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-neutral-400">Industry Sectors {selectedSectorIds.length > 0 && <span className="text-orange-400">({selectedSectorIds.length})</span>}</label>
                <button type="button" onClick={() => setSectorsExpanded(!sectorsExpanded)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  {sectorsExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                </button>
              </div>
              <div className={`flex flex-wrap gap-1 overflow-y-auto scrollbar-purple transition-all ${sectorsExpanded ? 'max-h-48' : 'max-h-16'}`}>
                {sectors.slice(0, sectorsExpanded ? 100 : 15).map((sector) => (
                  <button key={sector.id} type="button" onClick={() => toggleSector(sector.id)}
                    className={`px-2 py-1 rounded text-[10px] transition-all ${selectedSectorIds.includes(sector.id) ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50' : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10'}`}>
                    {sector.name}
                  </button>
                ))}
                {!sectorsExpanded && sectors.length > 15 && (
                  <span className="px-2 py-1 text-[10px] text-neutral-500">+{sectors.length - 15} more...</span>
                )}
              </div>
            </div>

            {/* Skills */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-neutral-400">Skills Needed {selectedSkills.length > 0 && <span className="text-cyan-400">({selectedSkills.length})</span>}</label>
                <button type="button" onClick={() => setSkillsExpanded(!skillsExpanded)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  {skillsExpanded ? <><ChevronUp24Regular className="w-3 h-3" />Less</> : <><ChevronDown24Regular className="w-3 h-3" />More</>}
                </button>
              </div>
              <div className={`flex flex-wrap gap-1 overflow-y-auto scrollbar-purple transition-all ${skillsExpanded ? 'max-h-48' : 'max-h-16'}`}>
                {skills.slice(0, skillsExpanded ? 100 : 15).map((skill) => (
                  <button key={skill.id} type="button" onClick={() => toggleSkill(skill.id)}
                    className={`px-2 py-1 rounded text-[10px] transition-all ${selectedSkills.find(s => s.skillId === skill.id) ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10'}`}>
                    {skill.name}
                  </button>
                ))}
                {!skillsExpanded && skills.length > 15 && (
                  <span className="px-2 py-1 text-[10px] text-neutral-500">+{skills.length - 15} more...</span>
                )}
              </div>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Visibility</label>
              <div className="grid grid-cols-3 gap-1">
                {[{ id: 'PUBLIC', label: 'Public' }, { id: 'CONNECTIONS_ONLY', label: 'Connections' }, { id: 'PRIVATE', label: 'Private' }].map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setVisibility(opt.id as typeof visibility)}
                    className={`px-2 py-1.5 rounded text-[10px] font-medium transition-all ${visibility === opt.id ? 'bg-pink-500/20 text-pink-300 border border-pink-500/50' : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add/Update Button */}
        <div className="flex gap-2 mt-2">
          {isEditing && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-neutral-300 rounded-lg hover:bg-white/10 transition-all text-sm font-medium"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleAddProject}
            disabled={!title.trim() || !summary.trim()}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 ${
              isEditing
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-purple-500 to-pink-500'
            } text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium`}
          >
            {isEditing ? (
              <>
                <Save24Regular className="w-4 h-4" />Update Project
              </>
            ) : (
              <>
                <Add24Regular className="w-4 h-4" />Add Project
              </>
            )}
          </button>
        </div>
      </div>

      {/* Projects List */}
      {projects.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500 font-medium">Your Projects ({projects.length})</p>
          {projects.map((project) => (
            <div
              key={project.id}
              className={`flex items-start gap-3 p-3 border rounded-xl transition-all ${
                editingProjectId === project.id
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/50'
                  : 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20'
              }`}
            >
              <Rocket24Regular className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm truncate">{project.title}</p>
                <p className="text-xs text-neutral-400 line-clamp-2 mt-0.5">{project.summary}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {project.stage && <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] rounded">{STAGE_OPTIONS.find(s => s.id === project.stage)?.label}</span>}
                  {project.category && <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded">{project.category}</span>}
                  {project.visibility && project.visibility !== 'PUBLIC' && <span className="px-1.5 py-0.5 bg-pink-500/20 text-pink-300 text-[10px] rounded">{project.visibility}</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleEditProject(project)}
                  disabled={isEditing && editingProjectId !== project.id}
                  className="p-1.5 rounded-lg hover:bg-amber-500/20 text-neutral-400 hover:text-amber-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Edit project"
                >
                  <Edit24Regular className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveProject(project.id)}
                  disabled={isEditing}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Delete project"
                >
                  <Delete24Regular className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {projects.length === 0 && (
        <p className="text-center text-xs text-neutral-500 py-3">
          No projects added yet. Add one above or continue to the next step.
        </p>
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
}: {
  items: { id: string; name: string; description: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  customObjectives: { id: string; name: string; description: string }[];
  onAddCustomObjective: (name: string) => void;
  onDeleteCustomObjective: (id: string) => void;
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
      <p className="text-sm text-neutral-400 mb-4">
        {t.onboarding.selectObjectives || 'Select your networking objectives'}
      </p>
      <div className="space-y-3 max-h-[40vh] overflow-y-auto pe-2 mb-4">
        {allItems.map((item) => (
          <div key={item.id} className="relative">
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              className={`w-full p-4 rounded-xl text-start transition-all duration-200 ${
                selected.includes(item.id)
                  ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50'
                  : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
              } ${item.id.startsWith('custom_') ? 'border-dashed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className={item.id.startsWith('custom_') ? 'pe-8' : ''}>
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-sm text-neutral-400 mt-1">{item.description}</p>
                </div>
                {selected.includes(item.id) && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                    <Checkmark24Regular className="w-4 h-4 text-white" />
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
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={!customInput.trim()}
          className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {t.common?.add || 'Add'}
        </button>
      </div>
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t, dir, locale } = useI18n();

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [step0Submitted, setStep0Submitted] = useState(false);
  const [hasEnriched, setHasEnriched] = useState(false); // Prevent re-enrichment when going back

  // Step 1 data
  const [socialData, setSocialData] = useState({ linkedinUrl: '', twitterUrl: '', phone: '', bio: '' });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [enhanceWithWebSearch, setEnhanceWithWebSearch] = useState(false); // Toggle for online search enhancement

  // Enrichment result
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentData | null>(null);

  // Step 2 data (profile)
  const [profile, setProfile] = useState({ company: '', jobTitle: '', location: '' });
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

  const OBJECTIVES = [
    { id: 'EXPAND_NETWORK', ...t.onboarding.objectives?.expandNetwork || { name: 'Expand Network', description: 'Grow your professional connections' } },
    { id: 'FIND_CLIENTS', ...t.onboarding.objectives?.findClients || { name: 'Find Clients', description: 'Acquire new business opportunities' } },
    { id: 'FIND_PARTNER', ...t.onboarding.objectives?.findPartner || { name: 'Find Business Partners', description: 'Collaborate on projects or ventures' } },
    { id: 'FIND_TALENT', ...t.onboarding.objectives?.findTalent || { name: 'Find Talent', description: 'Recruit skilled professionals' } },
    { id: 'FIND_MENTOR', ...t.onboarding.objectives?.findMentor || { name: 'Find a Mentor', description: 'Connect with experienced professionals' } },
    { id: 'LEARN_SKILLS', ...t.onboarding.objectives?.learnSkills || { name: 'Learn New Skills', description: 'Develop new abilities and knowledge' } },
    { id: 'FIND_INVESTOR', ...t.onboarding.objectives?.findInvestor || { name: 'Find Investors', description: 'Secure funding for your projects' } },
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
      router.push('/dashboard');
    }
  }, [user, router]);

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

            // If already completed, redirect to dashboard
            if (isCompleted) {
              router.push('/dashboard');
              return;
            }

            // Restore saved data if available
            if (savedData) {
              // Restore step
              if (currentStep > 0) {
                setCurrentStep(currentStep);
                setHasEnriched(true); // Already enriched if past step 0
              }

              // Restore social data
              if (savedData.socialData) {
                setSocialData(savedData.socialData);
              }

              // Restore profile
              if (savedData.profile) {
                setProfile(savedData.profile);
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
                setProfile({
                  company: profile.company || '',
                  jobTitle: profile.jobTitle || '',
                  location: profile.location || '',
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
              location: data.data.profile.location || '',
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

          toast({
            title: t.onboarding.enrichSuccess?.title || 'Profile analyzed!',
            description: t.onboarding.enrichSuccess?.description || 'We extracted your profile information',
            variant: 'success',
          });
        }
      }
    } catch (error) {
      console.error('Enrichment error:', error);
      toast({
        title: t.onboarding.enrichError?.title || 'Analysis failed',
        description: t.onboarding.enrichError?.description || 'Could not analyze profile, please fill manually',
        variant: 'error',
      });
    } finally {
      setIsEnriching(false);
      setHasEnriched(true); // Mark enrichment as done
      setCurrentStep(1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Social & CV - phone is mandatory
        return socialData.phone && isValidPhone(socialData.phone);
      case 1: // Profile - need company and job title
        return profile.company && profile.jobTitle;
      case 2: // Sectors
        return selectedSectors.length >= 1;
      case 3: // Skills & Interests
        return selectedSkills.length >= 1;
      case 4: // Projects - optional, can always proceed
        return true;
      case 5: // Objectives
        return selectedGoals.length >= 1;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      // Trigger validation display
      setStep0Submitted(true);

      // Check if phone is valid before proceeding
      if (!socialData.phone || !isValidPhone(socialData.phone)) {
        toast({
          title: t.onboarding.validation?.requiredFields || 'Required field missing',
          description: t.onboarding.validation?.phoneRequired || 'Phone number is required',
          variant: 'error',
        });
        return;
      }

      // Only enrich if not already done (prevents overwriting user selections when going back)
      if (!hasEnriched) {
        await handleEnrichProfile();
      } else {
        // Already enriched, just move to next step
        setCurrentStep(1);
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
        location: profile.location || undefined,
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

      router.push('/dashboard');
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
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="animate-spin h-10 w-10 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white overflow-hidden" dir={dir}>
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
            <h1 className="text-3xl font-bold text-white mb-2">{t.onboarding?.title || 'Set Up Your Profile'}</h1>
            <p className="text-neutral-400">{t.onboarding?.subtitle || 'Help us personalize your experience'}</p>
          </div>

          {/* Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-xl" />
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
              <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

              {/* Content */}
              <div className="min-h-[300px]">
                {currentStep === 0 && (
                  <SocialCVStep
                    data={socialData}
                    onChange={setSocialData}
                    cvFile={cvFile}
                    onCVChange={setCvFile}
                    isProcessing={isEnriching}
                    showValidation={step0Submitted}
                    enhanceWithWebSearch={enhanceWithWebSearch}
                    onEnhanceWithWebSearchChange={setEnhanceWithWebSearch}
                  />
                )}
                {currentStep === 1 && (
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
                  />
                )}
                {currentStep === 2 && (
                  <SectorsStep
                    items={enrichmentData?.suggestedSectors || []}
                    selected={selectedSectors}
                    onChange={setSelectedSectors}
                    customItems={customSectors}
                    onAddCustom={handleAddCustomSector}
                    onDeleteCustom={handleDeleteCustomSector}
                  />
                )}
                {currentStep === 3 && (
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
                  />
                )}
                {currentStep === 4 && (
                  <ProjectsStep
                    projects={onboardingProjects}
                    onAddProject={handleAddProject}
                    onRemoveProject={handleRemoveProject}
                    onUpdateProject={handleUpdateProject}
                  />
                )}
                {currentStep === 5 && (
                  <ObjectivesStep
                    items={OBJECTIVES}
                    selected={selectedGoals}
                    onChange={setSelectedGoals}
                    customObjectives={customGoals}
                    onAddCustomObjective={handleAddCustomGoal}
                    onDeleteCustomObjective={handleDeleteCustomGoal}
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
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-neutral-300 hover:bg-white/5 hover:border-white/20 transition-all disabled:opacity-50"
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
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
                    <span className="relative flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50">
                      {isEnriching ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {t.onboarding.buttons?.analyzing || 'Analyzing...'}
                        </>
                      ) : (
                        <>
                          {currentStep === 0 ? (t.onboarding.buttons?.analyzeProfile || 'Analyze Profile') : (t.onboarding.buttons?.continue || 'Continue')}
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
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
                    <span className="relative flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50">
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
              className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
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
      <OnboardingContent />
    </I18nProvider>
  );
}
