/**
 * Opportunity Form Component
 *
 * Reusable form for creating and editing opportunities.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  PersonAdd24Regular,
  Briefcase24Regular,
  Star24Regular,
  PeopleTeam24Regular,
  Location24Regular,
  Person24Regular,
  Building24Regular,
  Checkmark24Regular,
  ArrowSync24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  FullScreenMaximize24Regular,
  Document24Regular,
  DocumentPdf24Regular,
  DocumentText24Regular,
  Sparkle24Regular,
  ArrowUpload24Regular,
  Dismiss16Regular,
  Dismiss24Regular,
  CheckmarkCircle24Regular,
  Edit24Regular,
  Search24Regular,
  Add16Regular,
  Clock24Regular,
} from '@fluentui/react-icons';
import {
  Opportunity,
  OpportunityIntentType,
  OpportunityVisibility,
  SeniorityLevel,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  INTENT_TYPE_OPTIONS,
  SENIORITY_OPTIONS,
  VISIBILITY_OPTIONS,
  extractJobFromDocument,
} from '@/lib/api/opportunities';
import { getSectors, getSkills } from '@/lib/api/profile';
import { PillSelector } from '@/components/ui/PillSelector';
import { MultiPillSelector } from '@/components/ui/MultiPillSelector';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { AutocompleteTagInput } from '@/components/ui/AutocompleteTagInput';
import { FormSection } from '@/components/ui/FormSection';

/**
 * Intent type icon mapping
 */
const INTENT_ICONS: Record<OpportunityIntentType, React.ReactNode> = {
  HIRING: <PersonAdd24Regular className="w-5 h-5" />,
  OPEN_TO_OPPORTUNITIES: <Briefcase24Regular className="w-5 h-5" />,
  ADVISORY_BOARD: <Star24Regular className="w-5 h-5" />,
  REFERRALS_ONLY: <PeopleTeam24Regular className="w-5 h-5" />,
};

/**
 * Work mode options
 */
const WORK_MODE_OPTIONS = [
  { value: 'onsite', label: 'Onsite' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
];

/**
 * Employment type options
 */
const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'internship', label: 'Internship' },
];

/**
 * Hiring urgency options
 */
const HIRING_URGENCY_OPTIONS = [
  'Immediate',
  'Within 1 month',
  'Within 3 months',
  'No rush',
];

/**
 * Availability options (for candidates)
 */
const AVAILABILITY_OPTIONS = [
  'Immediately available',
  'Within 2 weeks',
  'Within 1 month',
  'Within 3 months',
  'Open to future opportunities',
  'Not actively looking',
];

/**
 * Suggestion lists for advanced fields
 */
const LANGUAGE_SUGGESTIONS = [
  'English', 'Arabic', 'French', 'Spanish', 'German', 'Mandarin', 'Hindi',
  'Portuguese', 'Japanese', 'Korean', 'Russian', 'Italian', 'Turkish', 'Dutch', 'Urdu',
];

const CERTIFICATION_SUGGESTIONS = [
  'PMP', 'AWS Solutions Architect', 'AWS Developer', 'Google Cloud Professional',
  'Azure Administrator', 'CISSP', 'CPA', 'CFA', 'Six Sigma', 'Scrum Master',
  'ITIL', 'TOGAF', 'Kubernetes (CKA)', 'Terraform Associate', 'CCNA', 'CompTIA Security+',
];

const EDUCATION_SUGGESTIONS = [
  "Bachelor's in Computer Science", "Master's in Computer Science",
  "Bachelor's in Engineering", "MBA", "PhD", "Bachelor's in Business",
  "Master's in Data Science", "Bachelor's in Finance", "Master's in Engineering",
  "High School Diploma", "Associate Degree",
];

const INDUSTRY_SUGGESTIONS = [
  'SaaS', 'FinTech', 'HealthTech', 'EdTech', 'E-commerce', 'Cybersecurity',
  'AI/ML', 'Cloud Computing', 'IoT', 'Blockchain', 'Gaming', 'Real Estate',
  'Enterprise Software', 'Developer Tools', 'MarTech', 'InsurTech', 'LegalTech',
];

const NOTICE_PERIOD_OPTIONS = [
  'Immediately',
  '2 weeks',
  '1 month',
  '2 months',
  '3 months',
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'SAR', label: 'SAR' },
  { value: 'AED', label: 'AED' },
  { value: 'EGP', label: 'EGP' },
  { value: 'INR', label: 'INR' },
];

/* ── shared Tailwind classes ────────────────────────────────────── */
const inputClass = 'w-full px-4 py-[15px] bg-white/[0.04] border-2 border-white/[0.14] rounded-2xl text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.05] transition-all';
const selectClass = 'w-full px-4 py-[15px] bg-white/[0.04] border-2 border-white/[0.14] rounded-2xl text-th-text focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.05] appearance-none cursor-pointer transition-all';
const textareaClass = 'w-full px-4 py-[15px] bg-white/[0.04] border-2 border-white/[0.14] rounded-2xl text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.05] resize-vertical transition-all leading-relaxed';
const labelClass = 'block text-[0.96rem] font-extrabold text-th-text';
const requiredStar = <span className="text-[#8cffbf] ms-0.5">*</span>;
const chipBoxClass = 'flex flex-wrap gap-2.5 overflow-y-auto p-3 bg-white/[0.025] rounded-2xl border-2 border-white/[0.12] transition-all';
const searchInputClass = 'w-full ps-10 pe-4 py-[11px] bg-white/[0.04] border-2 border-white/[0.14] rounded-2xl text-sm text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/60 transition-all';
const chipClass = (selected: boolean) =>
  `px-3.5 py-[10px] rounded-full text-[0.92rem] font-bold transition-all active:scale-95 border-2 inline-flex items-center justify-center gap-2 whitespace-nowrap ${
    selected
      ? 'bg-emerald-400 border-emerald-400/80 text-[#042820] shadow-[0_0_0_2px_rgba(24,210,164,0.12)_inset]'
      : 'bg-white/[0.04] border-white/[0.12] text-th-text hover:bg-white/[0.07] hover:border-white/[0.20]'
  }`;
const chipClassBlue = (selected: boolean) =>
  `px-3.5 py-[10px] rounded-full text-[0.92rem] font-bold transition-all active:scale-95 border-2 inline-flex items-center justify-center gap-2 whitespace-nowrap ${
    selected
      ? 'bg-emerald-400 border-emerald-400/80 text-[#042820] shadow-[0_0_0_2px_rgba(77,163,255,0.12)_inset]'
      : 'bg-white/[0.04] border-white/[0.12] text-th-text hover:bg-white/[0.07] hover:border-white/[0.20]'
  }`;

const SourceBadge = ({ source }: { source?: string }) => {
  if (!source) return null;
  const isDoc = source === 'DOCUMENT';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
      isDoc ? 'bg-emerald-400 text-[#042820]' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
    }`}>
      {isDoc ? 'From Document' : 'AI Estimate'}
    </span>
  );
};

const selectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23d9e9fb'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  backgroundSize: '18px',
};

interface OpportunityFormProps {
  opportunity?: Opportunity;
  defaultIntentType?: OpportunityIntentType;
  onSubmit: (data: CreateOpportunityInput | UpdateOpportunityInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function OpportunityForm({
  opportunity,
  defaultIntentType,
  onSubmit,
  onCancel,
  isSubmitting,
}: OpportunityFormProps) {
  const { t } = useI18n();
  const [sectors, setSectors] = useState<Array<{ id: string; name: string }>>([]);
  const [skills, setSkills] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form state
  const [title, setTitle] = useState(opportunity?.title || '');
  const [intentType, setIntentType] = useState<OpportunityIntentType>(
    opportunity?.intentType || defaultIntentType || 'OPEN_TO_OPPORTUNITIES'
  );
  const [roleArea, setRoleArea] = useState(opportunity?.roleArea || '');
  const [seniority, setSeniority] = useState<SeniorityLevel | ''>(opportunity?.seniority || '');
  const [locationPref, setLocationPref] = useState(opportunity?.locationPref || '');
  const [remoteOk, setRemoteOk] = useState(opportunity?.remoteOk ?? true);
  const [notes, setNotes] = useState(opportunity?.notes || '');
  const [visibility, setVisibility] = useState<OpportunityVisibility>(
    opportunity?.visibility || 'PRIVATE'
  );
  const [selectedSectors, setSelectedSectors] = useState<string[]>(
    opportunity?.sectors?.map((s) => s.id) || []
  );
  // Split skills: must-have (isRequired=true) vs preferred (isRequired=false)
  const [mustHaveSkills, setMustHaveSkills] = useState<string[]>(
    opportunity?.skills?.filter((s) => s.isRequired !== false).map((s) => s.id) || []
  );
  const [preferredSkills, setPreferredSkills] = useState<string[]>(
    opportunity?.skills?.filter((s) => s.isRequired === false).map((s) => s.id) || []
  );
  // Backward compat alias for internal usage
  const selectedSkills = [...mustHaveSkills, ...preferredSkills];

  // New structured fields
  const [workMode, setWorkMode] = useState<string>(
    opportunity?.workMode || (opportunity?.remoteOk && !opportunity?.workMode ? 'remote' : '') || ''
  );
  const [workModeMulti, setWorkModeMulti] = useState<string[]>(() => {
    if (opportunity?.workMode) {
      // workMode can be comma-separated for multi-select
      return opportunity.workMode.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (opportunity?.remoteOk && !opportunity?.workMode) return ['remote'];
    return [];
  });
  const [employmentType, setEmploymentType] = useState<string>(opportunity?.employmentType || '');
  const [employmentTypeMulti, setEmploymentTypeMulti] = useState<string[]>(() => {
    if (opportunity?.employmentType) {
      return opportunity.employmentType.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  });
  const [urgencyOrAvailability, setUrgencyOrAvailability] = useState<string>(
    opportunity?.urgencyOrAvailability || ''
  );
  const [minExperienceYears, setMinExperienceYears] = useState<string>(
    opportunity?.minExperienceYears != null ? String(opportunity.minExperienceYears) : ''
  );

  // Advanced / AI-enriched fields
  const [languages, setLanguages] = useState<string[]>(opportunity?.languages || []);
  const [certifications, setCertifications] = useState<string[]>(opportunity?.certifications || []);
  const [educationLevels, setEducationLevels] = useState<string[]>(opportunity?.educationLevels || []);
  const [industries, setIndustries] = useState<string[]>(opportunity?.industries || []);
  const [salaryMin, setSalaryMin] = useState<string>(
    opportunity?.salaryMin != null ? String(opportunity.salaryMin) : ''
  );
  const [salaryMax, setSalaryMax] = useState<string>(
    opportunity?.salaryMax != null ? String(opportunity.salaryMax) : ''
  );
  const [salaryCurrency, setSalaryCurrency] = useState<string>(opportunity?.salaryCurrency || 'USD');
  const [fieldSources, setFieldSources] = useState<Record<string, string>>({});
  const [salaryPeriod, setSalaryPeriod] = useState<'yearly' | 'monthly'>('monthly');
  const [noticePeriod, setNoticePeriod] = useState<string>(opportunity?.noticePeriod || '');
  const [relevantExperience, setRelevantExperience] = useState<string>(opportunity?.relevantExperience || '');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Tag input states
  const [langInput, setLangInput] = useState('');
  const [certInput, setCertInput] = useState('');
  const [eduInput, setEduInput] = useState('');
  const [industryInput, setIndustryInput] = useState('');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Expand states for option lists and textareas
  const [sectorsExpanded, setSectorsExpanded] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Search/autocomplete for tags
  const [sectorSearch, setSectorSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');

  // Fill method choice: null = choosing, 'upload' = document, 'manual' = manual entry
  const [fillMethod, setFillMethod] = useState<'upload' | 'manual' | null>(null);

  // File upload state
  const jobFileRef = useRef<HTMLInputElement>(null);
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [jobIsExtracting, setJobIsExtracting] = useState(false);
  const [jobExtractionProgress, setJobExtractionProgress] = useState(0);
  const [jobExtractedFromDoc, setJobExtractedFromDoc] = useState(false);
  const [jobExtractError, setJobExtractError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const isHiring = intentType === 'HIRING';

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') return <DocumentPdf24Regular className="w-8 h-8 text-red-400" />;
    if (file.type.includes('word') || file.type.includes('document')) return <Document24Regular className="w-8 h-8 text-blue-400" />;
    return <DocumentText24Regular className="w-8 h-8 text-th-text-t" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateAndSetFile = useCallback((file: File) => {
    setJobExtractError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setJobExtractError('Unsupported file type. Please upload PDF, DOCX, DOC, or TXT.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setJobExtractError('File is too large. Maximum size is 10MB.');
      return;
    }
    setJobFile(file);
    setJobExtractedFromDoc(false);
  }, []);

  const handleJobFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  }, [validateAndSetFile]);

  const handleRemoveFile = () => {
    setJobFile(null);
    setJobExtractedFromDoc(false);
    setJobExtractError(null);
    setJobExtractionProgress(0);
    if (jobFileRef.current) jobFileRef.current.value = '';
  };

  const handleJobExtract = async () => {
    if (!jobFile) return;
    setJobIsExtracting(true);
    setJobExtractionProgress(0);
    setJobExtractError(null);
    const interval = setInterval(() => {
      setJobExtractionProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);
    try {
      const data = await extractJobFromDocument(jobFile);
      setJobExtractionProgress(100);
      if (data.title) setTitle(data.title);
      if (data.intentType) setIntentType(data.intentType as OpportunityIntentType);
      if (data.roleArea) setRoleArea(data.roleArea);
      if (data.seniority) setSeniority(data.seniority as SeniorityLevel);
      if (data.locationPref) setLocationPref(data.locationPref);
      if (data.notes) setNotes(data.notes);
      if (data.workMode) {
        if (isHiring) {
          setWorkMode(data.workMode);
        } else {
          setWorkModeMulti(data.workMode.split(',').map(s => s.trim()).filter(Boolean));
        }
      }
      if (data.employmentType) {
        if (isHiring) {
          setEmploymentType(data.employmentType);
        } else {
          setEmploymentTypeMulti(data.employmentType.split(',').map(s => s.trim()).filter(Boolean));
        }
      }
      if (data.urgencyOrAvailability) setUrgencyOrAvailability(data.urgencyOrAvailability);
      if (data.minExperienceYears != null) setMinExperienceYears(String(data.minExperienceYears));
      // Set sectors & skills from extraction
      if (data.sectorIds?.length) {
        setSelectedSectors(data.sectorIds);
        setSectorsExpanded(true);
      }
      if (data.mustHaveSkillIds?.length) {
        setMustHaveSkills(data.mustHaveSkillIds);
        setSkillsExpanded(true);
      } else if (data.skillIds?.length) {
        setMustHaveSkills(data.skillIds);
        setSkillsExpanded(true);
      }
      if (data.preferredSkillIds?.length) setPreferredSkills(data.preferredSkillIds);
      // Advanced / AI-enriched fields
      if (data.languages?.length) setLanguages(data.languages);
      if (data.certifications?.length) setCertifications(data.certifications);
      if (data.educationLevels?.length) setEducationLevels(data.educationLevels);
      if (data.industries?.length) setIndustries(data.industries);
      if (data.salaryMin != null) setSalaryMin(String(data.salaryMin));
      if (data.salaryMax != null) setSalaryMax(String(data.salaryMax));
      if (data.salaryCurrency) setSalaryCurrency(data.salaryCurrency);
      if (data.fieldSources) setFieldSources(data.fieldSources);
      if (data.salaryPeriod) setSalaryPeriod(data.salaryPeriod as 'yearly' | 'monthly');
      if (data.noticePeriod) setNoticePeriod(data.noticePeriod);
      if (data.relevantExperience) setRelevantExperience(data.relevantExperience);
      // Auto-open advanced section if any advanced field was filled
      if (data.languages?.length || data.certifications?.length || data.educationLevels?.length || data.industries?.length || data.salaryMin || data.salaryMax || data.noticePeriod || data.relevantExperience) {
        setAdvancedOpen(true);
      }
      // Reload skills/sectors so auto-created ones appear in the selector
      try {
        const [freshSectors, freshSkills] = await Promise.all([getSectors(), getSkills()]);
        setSectors(freshSectors);
        setSkills(freshSkills);
      } catch (e) { /* ignore reload errors */ }
      setJobExtractedFromDoc(true);
    } catch (error: any) {
      console.error('Job extraction failed:', error);
      setJobExtractError(error.message || 'Failed to extract data from document. Please try again or fill the form manually.');
    } finally {
      clearInterval(interval);
      setJobIsExtracting(false);
    }
  };

  // Load sectors and skills
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        const [sectorsData, skillsData] = await Promise.all([getSectors(), getSkills()]);
        setSectors(sectorsData);
        setSkills(skillsData);
      } catch (error) {
        console.error('Failed to load sectors/skills:', error);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = t.opportunities?.titleRequired || 'Title is required';
    }

    if (!intentType) {
      newErrors.intentType = t.opportunities?.intentTypeRequired || 'Please select an intent type';
    }

    // Validate required fields for HIRING and OPEN_TO_OPPORTUNITIES
    if (intentType === 'HIRING' || intentType === 'OPEN_TO_OPPORTUNITIES') {
      if (!roleArea.trim()) newErrors.roleArea = 'Role / Area is required';
      if (!seniority) newErrors.seniority = 'Seniority is required';
      if (!locationPref.trim()) newErrors.locationPref = 'Location is required';
      if (!notes.trim()) newErrors.notes = intentType === 'HIRING' ? 'Job Summary & Requirements is required' : 'Profile Summary & Preferences is required';
      if (mustHaveSkills.length === 0) newErrors.skills = intentType === 'HIRING' ? 'At least one must-have skill is required' : 'At least one skill is required';

      if (intentType === 'HIRING') {
        if (!workMode) newErrors.workMode = 'Work Mode is required';
        if (!employmentType) newErrors.employmentType = 'Employment Type is required';
      } else {
        if (workModeMulti.length === 0) newErrors.workMode = 'At least one Work Mode is required';
        if (employmentTypeMulti.length === 0) newErrors.employmentType = 'At least one Employment Type is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Resolve work mode and employment type based on intent type
    const resolvedWorkMode = isHiring ? workMode : workModeMulti.join(',');
    const resolvedEmploymentType = isHiring ? employmentType : employmentTypeMulti.join(',');

    const data: CreateOpportunityInput = {
      title: title.trim(),
      intentType,
      roleArea: roleArea.trim() || undefined,
      seniority: seniority || undefined,
      locationPref: locationPref.trim() || undefined,
      remoteOk,
      notes: notes.trim() || undefined,
      visibility,
      sectorIds: selectedSectors,
      mustHaveSkillIds: mustHaveSkills,
      preferredSkillIds: isHiring ? preferredSkills : [],
      workMode: resolvedWorkMode || undefined,
      employmentType: resolvedEmploymentType || undefined,
      urgencyOrAvailability: urgencyOrAvailability || undefined,
      minExperienceYears: minExperienceYears ? Number(minExperienceYears) : undefined,
      ...(languages.length > 0 && { languages }),
      ...(certifications.length > 0 && { certifications }),
      ...(educationLevels.length > 0 && { educationLevels }),
      ...(industries.length > 0 && { industries }),
      ...(salaryMin && { salaryMin: Number(salaryMin) }),
      ...(salaryMax && { salaryMax: Number(salaryMax) }),
      ...((salaryMin || salaryMax) && salaryCurrency && { salaryCurrency }),
      ...(noticePeriod && { noticePeriod }),
      ...(relevantExperience.trim() && { relevantExperience: relevantExperience.trim() }),
    };

    await onSubmit(data);
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Whether the intent type selector should be shown
  const showIntentTypeSelector = !defaultIntentType;

  // Notes label based on intent type
  const notesLabel = isHiring
    ? 'Job Summary & Requirements'
    : intentType === 'OPEN_TO_OPPORTUNITIES'
      ? 'Profile Summary & Preferences'
      : (t.opportunities?.notes || 'Additional Notes');

  // Urgency/availability label and options based on intent type
  const urgencyLabel = isHiring ? 'Hiring Urgency' : 'Availability';
  const urgencyOptions = isHiring ? HIRING_URGENCY_OPTIONS : AVAILABILITY_OPTIONS;

  // Experience label based on intent type
  const experienceLabel = isHiring ? 'Min. Experience (years)' : 'Years of Experience';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Method Choice / File Upload Section */}
      {!opportunity && fillMethod !== 'manual' && !jobExtractedFromDoc && (
        <div className="space-y-3">
          {/* Choice screen - pick method */}
          {fillMethod === null && (
            <>
              <h3 className="text-sm font-medium text-th-text">How would you like to fill in the details?</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Upload document option */}
                <button
                  type="button"
                  onClick={() => setFillMethod('upload')}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-th-border bg-th-surface hover:border-emerald-400/50 hover:bg-emerald-500/[0.06] transition-all active:scale-[0.98]"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
                    <ArrowUpload24Regular className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-th-text">Upload Document</p>
                    <p className="text-[11px] text-th-text-m mt-1">Upload a job description and AI fills the form</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sparkle24Regular className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">AI Powered</span>
                  </div>
                </button>

                {/* Manual entry option */}
                <button
                  type="button"
                  onClick={() => setFillMethod('manual')}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-th-border bg-th-surface hover:border-cyan-400/50 hover:bg-cyan-500/[0.06] transition-all active:scale-[0.98]"
                >
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 flex items-center justify-center group-hover:bg-cyan-500/25 transition-colors">
                    <Edit24Regular className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-th-text">Fill Manually</p>
                    <p className="text-[11px] text-th-text-m mt-1">Type in the details yourself step by step</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wide">Quick & Easy</span>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Upload flow */}
          {fillMethod === 'upload' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpload24Regular className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-medium text-th-text text-sm">Upload Document</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setFillMethod(null); handleRemoveFile(); }}
                  className="text-xs text-th-text-m hover:text-th-text transition-colors"
                >
                  Change method
                </button>
              </div>

              <input
                ref={jobFileRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleJobFileSelect}
                className="hidden"
              />

              {/* Drop zone */}
              {!jobFile && !jobIsExtracting && (
                <div
                  onClick={() => jobFileRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 ${
                    isDragOver
                      ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                      : 'border-th-border bg-th-surface hover:border-emerald-400/50 hover:bg-th-surface'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                      isDragOver ? 'bg-emerald-500/20' : 'bg-th-surface'
                    }`}>
                      <ArrowUpload24Regular className={`w-6 h-6 transition-colors ${isDragOver ? 'text-emerald-400' : 'text-th-text-t'}`} />
                    </div>
                    <p className="text-sm font-medium text-th-text mb-1">
                      {isDragOver ? 'Drop your file here' : 'Drag & drop your document'}
                    </p>
                    <p className="text-xs text-th-text-m mb-3">or click to browse</p>
                    <div className="flex items-center gap-2">
                      {['PDF', 'DOCX', 'DOC', 'TXT'].map((ext) => (
                        <span key={ext} className="px-2 py-0.5 text-[10px] font-medium bg-th-surface text-th-text-t rounded-md border border-th-border">
                          {ext}
                        </span>
                      ))}
                      <span className="text-[10px] text-th-text-m">Max 10MB</span>
                    </div>
                  </div>
                </div>
              )}

              {/* File selected */}
              {jobFile && !jobIsExtracting && (
                <div className="rounded-2xl border border-th-border bg-white/[0.05] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-th-surface flex items-center justify-center flex-shrink-0">
                      {getFileIcon(jobFile)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-th-text truncate">{jobFile.name}</p>
                      <p className="text-xs text-th-text-m mt-0.5">{formatFileSize(jobFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="w-7 h-7 rounded-lg bg-th-surface hover:bg-red-500/20 flex items-center justify-center text-th-text-m hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Dismiss16Regular className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleJobExtract}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
                  >
                    <Sparkle24Regular className="w-4 h-4" />
                    Extract with AI
                  </button>
                </div>
              )}

              {/* Extracting progress */}
              {jobIsExtracting && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <ArrowSync24Regular className="w-5 h-5 text-emerald-400 animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-th-text">Analyzing document...</p>
                      <p className="text-xs text-th-text-t mt-0.5">AI is reading and extracting details</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">{Math.round(jobExtractionProgress)}%</span>
                  </div>
                  <div className="h-2 bg-th-surface-h rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${jobExtractionProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {jobExtractError && (
                <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <span className="text-red-400 text-xs mt-0.5">!</span>
                  <p className="text-xs text-red-300">{jobExtractError}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Extraction success banner (shows above the form fields) */}
      {jobExtractedFromDoc && !jobIsExtracting && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <CheckmarkCircle24Regular className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-th-text">Fields populated from document</p>
              <p className="text-xs text-th-text-t mt-0.5">Review and edit the details below.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleJobExtract}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
            >
              <ArrowSync24Regular className="w-3.5 h-3.5" />
              Re-extract
            </button>
            <button
              type="button"
              onClick={() => { handleRemoveFile(); setFillMethod(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-th-text-t bg-th-surface hover:bg-th-surface-h rounded-lg transition-colors"
            >
              <Dismiss16Regular className="w-3.5 h-3.5" />
              Start over
            </button>
          </div>
        </div>
      )}

      {/* Form fields - shown for manual entry, after extraction, or when editing */}
      {(fillMethod === 'manual' || jobExtractedFromDoc || !!opportunity) && (
      <>
      {/* Progress steps */}
      {!opportunity && (
        <div className="grid grid-cols-4 gap-3.5 pb-1">
          {[
            { label: 'Basics', done: !!title.trim() && !!intentType },
            { label: 'Details', done: !!roleArea || !!seniority },
            { label: 'Tags', done: selectedSectors.length > 0 || selectedSkills.length > 0 },
            { label: 'Submit', done: false },
          ].map((step) => (
            <div key={step.label} className="grid gap-2">
              <div className="h-1 rounded-full overflow-hidden bg-white/[0.10]">
                <span className={`block h-full rounded-full transition-all ${step.done ? `w-full ${isHiring ? 'bg-gradient-to-r from-blue-500 to-emerald-500' : 'bg-gradient-to-r from-emerald-500 to-blue-500'}` : 'w-0'}`} />
              </div>
              <span className="text-[0.82rem] font-extrabold text-th-text-s text-center">{step.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Section 1: Role / Opportunity Basics ─────────────────── */}
      <FormSection
        title={isHiring ? 'Role Basics' : 'Opportunity Basics'}
        description={isHiring
          ? 'Define the role clearly so matching can prioritize the most relevant candidates and specialists.'
          : 'Set your target role, work preferences, and employment type to improve match quality.'
        }
        icon={<Briefcase24Regular className="w-5 h-5" />}
        iconVariant="emerald"
      >
        {/* Title */}
        <div className="grid gap-2">
          <label className={labelClass}>
            Opportunity Title{requiredStar}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Senior React Developer, CTO Role, Marketing Lead"
            className={`${inputClass} ${errors.title ? 'border-red-500' : ''}`}
          />
          {errors.title && <p className="text-sm text-red-400">{errors.title}</p>}
        </div>

        {/* Intent Type Selection - only when no defaultIntentType */}
        {showIntentTypeSelector && (
        <div className="grid gap-2.5">
          <label className={labelClass}>
            {t.opportunities?.whatLookingFor || 'What are you looking for?'}{requiredStar}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {INTENT_TYPE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setIntentType(option.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                  intentType === option.id
                    ? 'bg-emerald-400 border-emerald-400/80 text-[#042820] shadow-lg shadow-emerald-500/10'
                    : 'bg-white/[0.04] border-white/[0.12] text-th-text-s hover:bg-white/[0.07] hover:border-white/25'
                }`}
              >
                {INTENT_ICONS[option.id]}
                <span className="text-sm font-semibold">{option.label}</span>
                <span className={`text-xs text-center ${intentType === option.id ? 'text-emerald-300/70' : 'text-th-text-m'}`}>{option.description}</span>
              </button>
            ))}
          </div>
          {errors.intentType && <p className="text-sm text-red-400">{errors.intentType}</p>}
        </div>
        )}

        {/* Role/Area and Seniority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className={labelClass}>
              {t.opportunities?.roleArea || 'Role / Area'}{requiredStar}
            </label>
            <input
              type="text"
              value={roleArea}
              onChange={(e) => setRoleArea(e.target.value)}
              placeholder="e.g., Software Engineer, Marketing"
              className={inputClass}
            />
          </div>

          <div className="grid gap-2">
            <label className={labelClass}>
              {t.opportunities?.seniority || 'Seniority Level'}{requiredStar}
            </label>
            <select
              value={seniority}
              onChange={(e) => setSeniority(e.target.value as SeniorityLevel | '')}
              className={selectClass}
              style={selectArrowStyle}
            >
              <option value="" className="bg-[#0a1e34]">{t.opportunities?.anySeniority || 'Any level'}</option>
              {SENIORITY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id} className="bg-[#0a1e34]">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Location */}
        <div className="grid gap-2">
          <label className={labelClass}>
            {t.opportunities?.location || 'Location Preference'}{requiredStar}
          </label>
          <input
            type="text"
            value={locationPref}
            onChange={(e) => setLocationPref(e.target.value)}
            placeholder="e.g., San Francisco, London, Remote"
            className={inputClass}
          />
        </div>

        {/* Work Mode */}
        {(intentType === 'HIRING' || intentType === 'OPEN_TO_OPPORTUNITIES') && (
        <div className="grid gap-2">
          <label className={`${labelClass} flex items-center gap-2`}>
            Work Mode{requiredStar} <SourceBadge source={fieldSources.workMode} />
          </label>
          {isHiring ? (
            <PillSelector
              options={WORK_MODE_OPTIONS}
              value={workMode}
              onChange={setWorkMode}
              accentColor="emerald"
            />
          ) : (
            <MultiPillSelector
              options={WORK_MODE_OPTIONS}
              value={workModeMulti}
              onChange={setWorkModeMulti}
              accentColor="emerald"
            />
          )}
          {!isHiring && (
            <p className="text-xs text-th-text-m font-bold">Select all that apply</p>
          )}
        </div>
        )}

        {/* Employment Type */}
        {(intentType === 'HIRING' || intentType === 'OPEN_TO_OPPORTUNITIES') && (
        <div className="grid gap-2">
          <label className={`${labelClass} flex items-center gap-2`}>
            Employment Type{requiredStar} <SourceBadge source={fieldSources.employmentType} />
          </label>
          {isHiring ? (
            <PillSelector
              options={EMPLOYMENT_TYPE_OPTIONS}
              value={employmentType}
              onChange={setEmploymentType}
              accentColor="blue"
            />
          ) : (
            <MultiPillSelector
              options={EMPLOYMENT_TYPE_OPTIONS}
              value={employmentTypeMulti}
              onChange={setEmploymentTypeMulti}
              accentColor="blue"
            />
          )}
          {!isHiring && (
            <p className="text-xs text-th-text-m font-bold">Select all that apply</p>
          )}
        </div>
        )}
      </FormSection>

      {/* ─── Section 2: Skills & Fit / Skills ──────────────────── */}
      <FormSection
        title={isHiring ? 'Skills & Fit' : 'Skills'}
        description={isHiring
          ? 'Separate essential skills from nice-to-have qualities to improve match quality and ranking.'
          : 'Highlight the skills you want opportunities to match against first.'
        }
        icon={<Star24Regular className="w-5 h-5" />}
        iconVariant="cyan"
      >
        {isHiring ? (
          <>
            {/* Must-Have Skills (HIRING) */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className={`${labelClass} flex items-center gap-1.5`}>
                  {t.opportunities?.mustHaveSkills || 'Must-Have Skills'}{requiredStar}
                  {mustHaveSkills.length > 0 && (
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 bg-emerald-400 text-[#042820] rounded-full">{mustHaveSkills.length}</span>
                  )}
                </label>
                <button type="button" onClick={() => setSkillsExpanded(!skillsExpanded)} className="text-[0.84rem] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                  {skillsExpanded ? <><ChevronUp24Regular className="w-4 h-4" />Less</> : <><ChevronDown24Regular className="w-4 h-4" />Show all</>}
                </button>
              </div>
              <div className="relative">
                <Search24Regular className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-m pointer-events-none" />
                <input type="text" value={skillSearch} onChange={(e) => { setSkillSearch(e.target.value); if (e.target.value) setSkillsExpanded(true); }} placeholder="Search must-have skills..." className={searchInputClass} />
                {skillSearch && (<button type="button" onClick={() => setSkillSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-m hover:text-th-text"><Dismiss16Regular className="w-3.5 h-3.5" /></button>)}
              </div>
              {/* Selected must-have skills strip */}
              {mustHaveSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {mustHaveSkills.map((id) => {
                    const skill = skills.find(s => s.id === id);
                    if (!skill) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-400 text-[#042820] text-xs font-bold rounded-lg border border-emerald-400/80">
                        {skill.name}
                        <button type="button" onClick={() => setMustHaveSkills(prev => prev.filter(sid => sid !== id))} className="hover:text-red-800">
                          <Dismiss16Regular className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className={`${chipBoxClass} ${skillsExpanded ? 'max-h-96' : 'max-h-[148px]'}`}>
                <div className="flex flex-wrap gap-2.5">
                  {skills.filter((s) => !skillSearch || s.name.toLowerCase().includes(skillSearch.toLowerCase())).filter((s) => !preferredSkills.includes(s.id)).filter((s) => !mustHaveSkills.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name)).map((skill) => (
                    <button key={skill.id} type="button" onClick={() => setMustHaveSkills((prev) => [...prev, skill.id])} className={chipClass(false)}>
                      {skill.name}
                    </button>
                  ))}
                  {skillSearch && skills.filter((s) => s.name.toLowerCase().includes(skillSearch.toLowerCase())).filter((s) => !mustHaveSkills.includes(s.id)).length === 0 && (<p className="text-xs text-th-text-m py-2 px-1">No skills match &quot;{skillSearch}&quot;</p>)}
                </div>
              </div>
              {errors.skills && <p className="text-xs text-red-400">{errors.skills}</p>}
            </div>

            {/* Preferred / Nice-to-Have Skills (HIRING) */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className={`${labelClass} flex items-center gap-1.5`}>
                  {t.opportunities?.preferredSkills || 'Nice-to-Have Skills'}
                  <span className="inline-flex items-center min-h-[24px] px-2 py-0.5 rounded-full border border-white/[0.14] bg-white/[0.03] text-th-text-s text-[0.74rem] font-extrabold">{t.opportunities?.optional || 'Optional'}</span>
                  {preferredSkills.length > 0 && (
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 bg-emerald-400 text-[#042820] rounded-full">{preferredSkills.length}</span>
                  )}
                </label>
              </div>
              {/* Selected preferred skills strip */}
              {preferredSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {preferredSkills.map((id) => {
                    const skill = skills.find(s => s.id === id);
                    if (!skill) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-400 text-[#042820] text-xs font-bold rounded-lg border border-emerald-400/80">
                        {skill.name}
                        <button type="button" onClick={() => setPreferredSkills(prev => prev.filter(sid => sid !== id))} className="hover:text-red-800">
                          <Dismiss16Regular className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className={`${chipBoxClass} max-h-[148px]`}>
                <div className="flex flex-wrap gap-2.5">
                  {skills.filter((s) => !mustHaveSkills.includes(s.id)).filter((s) => !preferredSkills.includes(s.id)).filter((s) => !skillSearch || s.name.toLowerCase().includes(skillSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map((skill) => (
                    <button key={skill.id} type="button" onClick={() => setPreferredSkills((prev) => [...prev, skill.id])} className={chipClassBlue(false)}>
                      {skill.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Single Skills section for Candidates */
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className={`${labelClass} flex items-center gap-1.5`}>
                {t.opportunities?.targetSkills || 'Skills'}{requiredStar}
                {mustHaveSkills.length > 0 && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 bg-emerald-400 text-[#042820] rounded-full">{mustHaveSkills.length} selected</span>
                )}
              </label>
              <button type="button" onClick={() => setSkillsExpanded(!skillsExpanded)} className="text-[0.84rem] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                {skillsExpanded ? <><ChevronUp24Regular className="w-4 h-4" />Less</> : <><ChevronDown24Regular className="w-4 h-4" />Show all</>}
              </button>
            </div>
            <div className="relative">
              <Search24Regular className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-m pointer-events-none" />
              <input type="text" value={skillSearch} onChange={(e) => { setSkillSearch(e.target.value); if (e.target.value) setSkillsExpanded(true); }} placeholder="Search skills..." className={searchInputClass} />
              {skillSearch && (<button type="button" onClick={() => setSkillSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-m hover:text-th-text"><Dismiss16Regular className="w-3.5 h-3.5" /></button>)}
            </div>
            {/* Selected skills strip */}
            {mustHaveSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {mustHaveSkills.map((id) => {
                  const skill = skills.find(s => s.id === id);
                  if (!skill) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-400 text-[#042820] text-xs font-bold rounded-lg border border-emerald-400/80">
                      {skill.name}
                      <button type="button" onClick={() => setMustHaveSkills(prev => prev.filter(sid => sid !== id))} className="hover:text-red-800">
                        <Dismiss16Regular className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className={`${chipBoxClass} ${skillsExpanded ? 'max-h-96' : 'max-h-[148px]'}`}>
              <div className="flex flex-wrap gap-2.5">
                {skills.filter((s) => !skillSearch || s.name.toLowerCase().includes(skillSearch.toLowerCase())).filter((s) => !mustHaveSkills.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name)).map((skill) => (
                  <button key={skill.id} type="button" onClick={() => setMustHaveSkills((prev) => [...prev, skill.id])} className={chipClass(false)}>
                    {skill.name}
                  </button>
                ))}
                {skillSearch && skills.filter((s) => s.name.toLowerCase().includes(skillSearch.toLowerCase())).filter((s) => !mustHaveSkills.includes(s.id)).length === 0 && (<p className="text-xs text-th-text-m py-2 px-1">No skills match &quot;{skillSearch}&quot;</p>)}
              </div>
            </div>
            {errors.skills && <p className="text-xs text-red-400">{errors.skills}</p>}
          </div>
        )}
      </FormSection>

      {/* ─── Section 3: Advanced / AI-Enriched ──────────────────── */}
      {(isHiring || intentType === 'OPEN_TO_OPPORTUNITIES') && (
        <CollapsibleSection
          title="Advanced / AI-Enriched"
          description={isHiring
            ? 'Optional details that help improve candidate fit, industry relevance, and urgency-based prioritization.'
            : 'Optional details that help the system understand fit, preferences, and industry direction more accurately.'
          }
          icon={<Sparkle24Regular className="w-5 h-5 text-emerald-400" />}
          defaultOpen={advancedOpen || languages.length > 0 || certifications.length > 0 || educationLevels.length > 0 || industries.length > 0 || !!salaryMin || !!salaryMax || !!noticePeriod || !!relevantExperience}
          headerColor="from-emerald-500 to-teal-400"
        >
          {/* Notes / Job Summary */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className={labelClass}>
                {notesLabel}{(isHiring || intentType === 'OPEN_TO_OPPORTUNITIES') && requiredStar}
              </label>
              <button type="button" onClick={() => setNotesExpanded(!notesExpanded)} className="text-[0.84rem] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                <FullScreenMaximize24Regular className="w-4 h-4" />{notesExpanded ? 'Less' : 'Expand'}
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isHiring
                ? 'Job description, responsibilities, required stack, team context, goals, and key expectations...'
                : intentType === 'OPEN_TO_OPPORTUNITIES'
                  ? 'Your experience, what you are looking for, ideal role...'
                  : 'Any additional details — requirements, preferences, expectations...'}
              rows={notesExpanded ? 10 : 4}
              className={`${textareaClass} min-h-[120px]`}
            />
            {errors.notes && <p className="text-xs text-red-400">{errors.notes}</p>}
          </div>

          {/* Min Experience + Urgency/Availability row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className={`${labelClass} flex items-center gap-2`}>
                {experienceLabel} <SourceBadge source={fieldSources.minExperienceYears} />
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={minExperienceYears}
                onChange={(e) => setMinExperienceYears(e.target.value)}
                placeholder="e.g., 3"
                className={inputClass}
              />
            </div>

            <div className="grid gap-2">
              <label className={`${labelClass} flex items-center gap-2`}>
                {urgencyLabel} <SourceBadge source={fieldSources.urgencyOrAvailability} />
              </label>
              <select
                value={urgencyOrAvailability}
                onChange={(e) => setUrgencyOrAvailability(e.target.value)}
                className={selectClass}
                style={selectArrowStyle}
              >
                <option value="" className="bg-[#0a1e34]">Select...</option>
                {urgencyOptions.map((option) => (
                  <option key={option} value={option} className="bg-[#0a1e34]">
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Sectors/Industries */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className={`${labelClass} flex items-center gap-1.5`}>
                {t.opportunities?.targetSectors || 'Target Industries'}
                {selectedSectors.length > 0 && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 bg-emerald-400 text-[#042820] rounded-full">{selectedSectors.length} selected</span>
                )}
              </label>
              <button type="button" onClick={() => setSectorsExpanded(!sectorsExpanded)} className="text-[0.84rem] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                {sectorsExpanded ? <><ChevronUp24Regular className="w-4 h-4" />Less</> : <><ChevronDown24Regular className="w-4 h-4" />Show all</>}
              </button>
            </div>

            {/* Search input for sectors */}
            <div className="relative">
              <Search24Regular className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-m pointer-events-none" />
              <input
                type="text"
                value={sectorSearch}
                onChange={(e) => { setSectorSearch(e.target.value); if (e.target.value) setSectorsExpanded(true); }}
                placeholder="Search industries..."
                className={searchInputClass}
              />
              {sectorSearch && (
                <button type="button" onClick={() => setSectorSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-m hover:text-th-text">
                  <Dismiss16Regular className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sector chips */}
            <div className={`${chipBoxClass} ${sectorsExpanded ? 'max-h-96' : 'max-h-[148px]'}`}>
              <div className="flex flex-wrap gap-2.5">
                {sectors
                  .filter((s) => !sectorSearch || s.name.toLowerCase().includes(sectorSearch.toLowerCase()))
                  .sort((a, b) => {
                    const aSelected = selectedSectors.includes(a.id) ? 1 : 0;
                    const bSelected = selectedSectors.includes(b.id) ? 1 : 0;
                    if (aSelected !== bSelected) return bSelected - aSelected;
                    return a.name.localeCompare(b.name);
                  })
                  .map((sector) => (
                  <button
                    key={sector.id}
                    type="button"
                    onClick={() =>
                      setSelectedSectors((prev) =>
                        prev.includes(sector.id)
                          ? prev.filter((id) => id !== sector.id)
                          : [...prev, sector.id]
                      )
                    }
                    className={chipClass(selectedSectors.includes(sector.id))}
                  >
                    {sector.name}
                  </button>
                ))}
                {sectorSearch && sectors.filter((s) => s.name.toLowerCase().includes(sectorSearch.toLowerCase())).length === 0 && (
                  <p className="text-xs text-th-text-m py-2 px-1">No industries match &quot;{sectorSearch}&quot;</p>
                )}
              </div>
            </div>
          </div>

          {/* Languages */}
          <div className="grid gap-2">
            <label className={`${labelClass} flex items-center gap-2`}>
              {t.opportunities?.languages || 'Languages'} <SourceBadge source={fieldSources.languages} />
            </label>
            <AutocompleteTagInput
              value={langInput}
              onChange={setLangInput}
              onAdd={(val) => {
                const normalized = val.trim();
                if (normalized && !languages.map(l => l.toLowerCase()).includes(normalized.toLowerCase())) {
                  setLanguages([...languages, normalized]);
                }
                setLangInput('');
              }}
              suggestions={LANGUAGE_SUGGESTIONS}
              existingTags={languages}
              placeholder={t.opportunities?.addLanguage || 'Add language...'}
              accentColor="amber"
            />
            {languages.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {languages.map((lang, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-400 text-[#042820] text-xs font-medium rounded-lg border border-emerald-400/80">
                    {lang}
                    <button type="button" onClick={() => setLanguages(languages.filter((_, j) => j !== i))} className="hover:text-th-text"><Dismiss16Regular className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Certifications */}
          <div className="grid gap-2">
            <label className={`${labelClass} flex items-center gap-2`}>
              {t.opportunities?.certifications || 'Certifications'} <SourceBadge source={fieldSources.certifications} />
            </label>
            <AutocompleteTagInput
              value={certInput}
              onChange={setCertInput}
              onAdd={(val) => {
                const normalized = val.trim();
                if (normalized && !certifications.map(c => c.toLowerCase()).includes(normalized.toLowerCase())) {
                  setCertifications([...certifications, normalized]);
                }
                setCertInput('');
              }}
              suggestions={CERTIFICATION_SUGGESTIONS}
              existingTags={certifications}
              placeholder={t.opportunities?.addCertification || 'Add certification...'}
              accentColor="amber"
            />
            {certifications.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {certifications.map((cert, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-400 text-[#042820] text-xs font-medium rounded-lg border border-emerald-400/80">
                    {cert}
                    <button type="button" onClick={() => setCertifications(certifications.filter((_, j) => j !== i))} className="hover:text-th-text"><Dismiss16Regular className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Education */}
          <div className="grid gap-2">
            <label className={`${labelClass} flex items-center gap-2`}>
              {t.opportunities?.educationLevels || 'Education'} <SourceBadge source={fieldSources.educationLevels} />
            </label>
            <AutocompleteTagInput
              value={eduInput}
              onChange={setEduInput}
              onAdd={(val) => {
                const normalized = val.trim();
                if (normalized && !educationLevels.map(e => e.toLowerCase()).includes(normalized.toLowerCase())) {
                  setEducationLevels([...educationLevels, normalized]);
                }
                setEduInput('');
              }}
              suggestions={EDUCATION_SUGGESTIONS}
              existingTags={educationLevels}
              placeholder={t.opportunities?.addEducation || 'Add education level...'}
              accentColor="amber"
            />
            {educationLevels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {educationLevels.map((edu, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-400 text-[#042820] text-xs font-medium rounded-lg border border-emerald-400/80">
                    {edu}
                    <button type="button" onClick={() => setEducationLevels(educationLevels.filter((_, j) => j !== i))} className="hover:text-th-text"><Dismiss16Regular className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Industries */}
          <div className="grid gap-2">
            <label className={`${labelClass} flex items-center gap-2`}>
              {t.opportunities?.industries || 'Industries'} <SourceBadge source={fieldSources.industries} />
            </label>
            <AutocompleteTagInput
              value={industryInput}
              onChange={setIndustryInput}
              onAdd={(val) => {
                const normalized = val.trim();
                if (normalized && !industries.map(ind => ind.toLowerCase()).includes(normalized.toLowerCase())) {
                  setIndustries([...industries, normalized]);
                }
                setIndustryInput('');
              }}
              suggestions={INDUSTRY_SUGGESTIONS}
              existingTags={industries}
              placeholder={t.opportunities?.addIndustry || 'Add industry...'}
              accentColor="amber"
            />
            {industries.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {industries.map((ind, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-400 text-[#042820] text-xs font-medium rounded-lg border border-emerald-400/80">
                    {ind}
                    <button type="button" onClick={() => setIndustries(industries.filter((_, j) => j !== i))} className="hover:text-th-text"><Dismiss16Regular className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Salary Range */}
          <div className="grid gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <label className={labelClass}>
                {isHiring ? (t.opportunities?.salaryRange || 'Salary Range') : (t.opportunities?.expectedSalary || 'Expected Salary')}
              </label>
              {/* Monthly / Yearly toggle */}
              <div className="flex items-center rounded-full border border-white/[0.12] bg-white/[0.04] overflow-hidden">
                <button type="button" onClick={() => {
                  if (salaryPeriod === 'yearly') {
                    // Convert yearly → monthly (÷ 12)
                    if (salaryMin) setSalaryMin(String(Math.round(Number(salaryMin) / 12)));
                    if (salaryMax) setSalaryMax(String(Math.round(Number(salaryMax) / 12)));
                    setSalaryPeriod('monthly');
                  }
                }} className={`px-2.5 py-0.5 text-[10px] font-bold transition-all ${salaryPeriod === 'monthly' ? 'bg-emerald-400 text-[#042820]' : 'text-th-text-s hover:text-th-text'}`}>Monthly</button>
                <button type="button" onClick={() => {
                  if (salaryPeriod === 'monthly') {
                    // Convert monthly → yearly (× 12)
                    if (salaryMin) setSalaryMin(String(Math.round(Number(salaryMin) * 12)));
                    if (salaryMax) setSalaryMax(String(Math.round(Number(salaryMax) * 12)));
                    setSalaryPeriod('yearly');
                  }
                }} className={`px-2.5 py-0.5 text-[10px] font-bold transition-all ${salaryPeriod === 'yearly' ? 'bg-emerald-400 text-[#042820]' : 'text-th-text-s hover:text-th-text'}`}>Yearly</button>
              </div>
              <SourceBadge source={fieldSources.salary} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder={salaryPeriod === 'monthly' ? 'Min / mo' : 'Min / yr'}
                className={inputClass}
              />
              <input
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder={salaryPeriod === 'monthly' ? 'Max / mo' : 'Max / yr'}
                className={inputClass}
              />
              <select
                value={salaryCurrency}
                onChange={(e) => setSalaryCurrency(e.target.value)}
                className={selectClass}
                style={selectArrowStyle}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value} className="bg-[#0a1e34]">{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notice Period (candidates only) */}
          {!isHiring && (
            <div className="grid gap-2">
              <label className={`${labelClass} flex items-center gap-2`}>
                {t.opportunities?.noticePeriod || 'Notice Period'} <SourceBadge source={fieldSources.noticePeriod} />
              </label>
              <select
                value={noticePeriod}
                onChange={(e) => setNoticePeriod(e.target.value)}
                className={selectClass}
                style={selectArrowStyle}
              >
                <option value="" className="bg-[#0a1e34]">Select notice period...</option>
                {NOTICE_PERIOD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-[#0a1e34]">{opt}</option>
                ))}
              </select>
            </div>
          )}

          {/* Relevant Experience (candidates only) */}
          {!isHiring && (
            <div className="grid gap-2">
              <label className={labelClass}>
                {t.opportunities?.relevantExperience || 'Relevant Experience'}
              </label>
              <textarea
                value={relevantExperience}
                onChange={(e) => setRelevantExperience(e.target.value)}
                rows={3}
                placeholder="AI-generated summary of relevant experience... You can edit this."
                className={textareaClass}
              />
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* ─── CTA Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto] gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2.5 px-6 py-[15px] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-[#042820] font-extrabold text-base transition-all active:scale-[0.98] shadow-[0_12px_28px_rgba(24,210,164,0.22)] min-h-[56px]"
        >
          {isSubmitting ? (
            <ArrowSync24Regular className="w-5 h-5 animate-spin" />
          ) : (
            <Checkmark24Regular className="w-5 h-5" />
          )}
          {opportunity
            ? t.common?.save || 'Save Changes'
            : t.opportunities?.createOpportunity || 'Create Opportunity'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center justify-center px-6 py-[15px] rounded-2xl bg-white/[0.03] hover:bg-emerald-500/[0.05] border-2 border-white/[0.14] hover:border-emerald-500/[0.38] text-th-text font-extrabold text-base transition-all min-h-[56px] min-w-[120px]"
        >
          {t.common?.cancel || 'Cancel'}
        </button>
      </div>
      </>
      )}
    </form>
  );
}
