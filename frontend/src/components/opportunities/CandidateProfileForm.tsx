/**
 * Candidate Profile Form Component (v3 Job Matching)
 *
 * Reusable form for creating and editing candidate profiles.
 * Follows the same patterns as OpportunityForm.tsx.
 */

'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Briefcase24Regular,
  Star24Regular,
  Location24Regular,
  Person24Regular,
  Checkmark24Regular,
  ArrowSync24Regular,
  Sparkle24Regular,
  Dismiss16Regular,
  Add16Regular,
  Clock24Regular,
  BookGlobe24Regular,
  Certificate24Regular,
  HatGraduation24Regular,
  Settings24Regular,
} from '@fluentui/react-icons';
import {
  CreateCandidateProfileInput,
  CandidateProfile,
  JobSeniority,
  JobWorkMode,
  JobEmploymentType,
  JobAvailability,
  LanguageSkill,
  SalaryRange,
  EducationEntry,
  RelevantExperienceEntry,
  LanguageProficiency,
  JOB_SENIORITY_OPTIONS,
  JOB_WORK_MODE_OPTIONS,
  JOB_EMPLOYMENT_TYPE_OPTIONS,
  JOB_AVAILABILITY_OPTIONS,
  LANGUAGE_PROFICIENCY_OPTIONS,
  extractCandidateFromText,
} from '@/lib/api/job-matching';
import { getSectors, getSkills } from '@/lib/api/profile';
import { PillSelector } from '@/components/ui/PillSelector';
import { MultiPillSelector } from '@/components/ui/MultiPillSelector';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { AutocompleteTagInput } from '@/components/ui/AutocompleteTagInput';
import { FormSection } from '@/components/ui/FormSection';

// ============================================================================
// CONSTANTS
// ============================================================================

const LANGUAGE_SUGGESTIONS = [
  'English', 'Arabic', 'French', 'Spanish', 'German', 'Mandarin', 'Hindi',
  'Portuguese', 'Japanese', 'Korean', 'Russian', 'Italian', 'Turkish', 'Dutch', 'Urdu',
];

const CERTIFICATION_SUGGESTIONS = [
  'PMP', 'AWS Solutions Architect', 'AWS Developer', 'Google Cloud Professional',
  'Azure Administrator', 'CISSP', 'CPA', 'CFA', 'Six Sigma', 'Scrum Master',
  'ITIL', 'TOGAF', 'Kubernetes (CKA)', 'Terraform Associate', 'CCNA', 'CompTIA Security+',
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

// ============================================================================
// SHARED TAILWIND CLASSES
// ============================================================================

const inputClass = 'w-full px-4 py-[15px] bg-white/[0.04] border-2 border-white/[0.14] rounded-2xl text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.05] transition-all';
const selectClass = 'w-full px-4 py-[15px] bg-white/[0.04] border-2 border-white/[0.14] rounded-2xl text-th-text focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.05] appearance-none cursor-pointer transition-all';
const textareaClass = 'w-full px-4 py-[15px] bg-white/[0.04] border-2 border-white/[0.14] rounded-2xl text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.05] resize-vertical transition-all leading-relaxed';
const labelClass = 'block text-[0.96rem] font-extrabold text-th-text';
const requiredStar = <span className="text-[#8cffbf] ms-0.5">*</span>;

const selectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23d9e9fb'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  backgroundSize: '18px',
};

// ============================================================================
// HELPERS
// ============================================================================

/** Map job-matching option arrays ({ id, label }) to PillSelector format ({ value, label }) */
const toPillOptions = (opts: ReadonlyArray<{ id: string; label: string }>) =>
  opts.map((o) => ({ value: o.id, label: o.label }));

// ============================================================================
// COMPONENT
// ============================================================================

interface CandidateProfileFormProps {
  initialData?: Partial<CandidateProfile>;
  onSubmit: (data: CreateCandidateProfileInput) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export default function CandidateProfileForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel,
}: CandidateProfileFormProps) {
  const { t } = useI18n();

  // ── Data loading ──────────────────────────────────────────────────
  const [sectors, setSectors] = useState<Array<{ id: string; name: string }>>([]);
  const [skillOptions, setSkillOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ── Section 1: Basic Info ─────────────────────────────────────────
  const [title, setTitle] = useState(initialData?.title || '');
  const [roleArea, setRoleArea] = useState(initialData?.roleArea || '');
  const [seniority, setSeniority] = useState<JobSeniority | ''>(initialData?.seniority || '');
  const [location, setLocation] = useState(initialData?.location || '');

  // ── Section 2: Preferences ────────────────────────────────────────
  const [desiredWorkMode, setDesiredWorkMode] = useState<string[]>(
    initialData?.desiredWorkMode || []
  );
  const [desiredEmploymentType, setDesiredEmploymentType] = useState<string[]>(
    initialData?.desiredEmploymentType || []
  );
  const [availability, setAvailability] = useState<JobAvailability | ''>(
    initialData?.availability || ''
  );
  const [yearsOfExperience, setYearsOfExperience] = useState<string>(
    initialData?.yearsOfExperience != null ? String(initialData.yearsOfExperience) : ''
  );
  const [noticePeriod, setNoticePeriod] = useState<string>(
    initialData?.noticePeriod != null ? String(initialData.noticePeriod) : ''
  );

  // ── Section 3: Skills ─────────────────────────────────────────────
  const [skills, setSkills] = useState<string[]>(initialData?.skills || []);
  const [skillInput, setSkillInput] = useState('');

  // ── Section 4: Summary ────────────────────────────────────────────
  const [profileSummary, setProfileSummary] = useState(initialData?.profileSummaryPreferences || '');

  // ── Section 5: Advanced ───────────────────────────────────────────
  const [languages, setLanguages] = useState<LanguageSkill[]>(initialData?.languages || []);
  const [certifications, setCertifications] = useState<string[]>(initialData?.certifications || []);
  const [certInput, setCertInput] = useState('');
  const [industries, setIndustries] = useState<string[]>(initialData?.industries || []);
  const [industryInput, setIndustryInput] = useState('');
  const [education, setEducation] = useState<EducationEntry[]>(initialData?.education || []);
  const [salaryMin, setSalaryMin] = useState<string>(
    initialData?.expectedSalary?.min != null ? String(initialData.expectedSalary.min) : ''
  );
  const [salaryMax, setSalaryMax] = useState<string>(
    initialData?.expectedSalary?.max != null ? String(initialData.expectedSalary.max) : ''
  );
  const [salaryCurrency, setSalaryCurrency] = useState<string>(
    initialData?.expectedSalary?.currency || 'USD'
  );
  const [relevantExperience, setRelevantExperience] = useState<RelevantExperienceEntry[]>(
    initialData?.relevantExperience || []
  );

  // ── Section 6: AI Upload ──────────────────────────────────────────
  const [aiText, setAiText] = useState('');
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Validation ────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Load sectors + skills ─────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        const [sectorsData, skillsData] = await Promise.all([getSectors(), getSkills()]);
        setSectors(sectorsData);
        setSkillOptions(skillsData);
      } catch (error) {
        console.error('Failed to load sectors/skills:', error);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  // ── Validation ────────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';
    if (!roleArea.trim()) newErrors.roleArea = 'Role Area is required';
    if (!seniority) newErrors.seniority = 'Seniority is required';
    if (!location.trim()) newErrors.location = 'Location is required';
    if (desiredWorkMode.length === 0) newErrors.desiredWorkMode = 'At least one Work Mode is required';
    if (desiredEmploymentType.length === 0) newErrors.desiredEmploymentType = 'At least one Employment Type is required';
    if (skills.length === 0) newErrors.skills = 'At least one skill is required';
    if (!profileSummary.trim()) newErrors.profileSummary = 'Profile Summary is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const salaryRange: SalaryRange | undefined =
      salaryMin || salaryMax
        ? {
            ...(salaryMin ? { min: Number(salaryMin) } : {}),
            ...(salaryMax ? { max: Number(salaryMax) } : {}),
            currency: salaryCurrency,
          }
        : undefined;

    const data: CreateCandidateProfileInput = {
      title: title.trim(),
      roleArea: roleArea.trim(),
      seniority: seniority as JobSeniority,
      location: location.trim(),
      desiredWorkMode: desiredWorkMode as JobWorkMode[],
      desiredEmploymentType: desiredEmploymentType as JobEmploymentType[],
      skills,
      profileSummaryPreferences: profileSummary.trim(),
      ...(yearsOfExperience ? { yearsOfExperience: Number(yearsOfExperience) } : {}),
      ...(availability ? { availability: availability as JobAvailability } : {}),
      ...(languages.length > 0 ? { languages } : {}),
      ...(certifications.length > 0 ? { certifications } : {}),
      ...(industries.length > 0 ? { industries } : {}),
      ...(education.length > 0 ? { education } : {}),
      ...(salaryRange ? { expectedSalary: salaryRange } : {}),
      ...(noticePeriod ? { noticePeriod: Number(noticePeriod) } : {}),
      ...(relevantExperience.length > 0 ? { relevantExperience } : {}),
    };

    await onSubmit(data);
  };

  // ── AI Extract handler ────────────────────────────────────────────
  const handleAiExtract = async () => {
    if (!aiText.trim()) return;
    setAiExtracting(true);
    setAiError(null);
    try {
      const data = await extractCandidateFromText(aiText.trim());

      if (data.title) setTitle(data.title);
      if (data.roleArea) setRoleArea(data.roleArea);
      if (data.seniority) setSeniority(data.seniority);
      if (data.location) setLocation(data.location);
      if (data.desiredWorkMode?.length) setDesiredWorkMode(data.desiredWorkMode);
      if (data.desiredEmploymentType?.length) setDesiredEmploymentType(data.desiredEmploymentType);
      if (data.skills?.length) setSkills(data.skills);
      if (data.profileSummaryPreferences) setProfileSummary(data.profileSummaryPreferences);
      if (data.yearsOfExperience != null) setYearsOfExperience(String(data.yearsOfExperience));
      if (data.availability) setAvailability(data.availability);
      if (data.languages?.length) setLanguages(data.languages);
      if (data.certifications?.length) setCertifications(data.certifications);
      if (data.industries?.length) setIndustries(data.industries);
      if (data.education?.length) setEducation(data.education);
      if (data.expectedSalary) {
        if (data.expectedSalary.min != null) setSalaryMin(String(data.expectedSalary.min));
        if (data.expectedSalary.max != null) setSalaryMax(String(data.expectedSalary.max));
        if (data.expectedSalary.currency) setSalaryCurrency(data.expectedSalary.currency);
      }
      if (data.noticePeriod != null) setNoticePeriod(String(data.noticePeriod));
    } catch (error: any) {
      console.error('AI extraction failed:', error);
      setAiError(error.message || 'Failed to extract data. Please try again.');
    } finally {
      setAiExtracting(false);
    }
  };

  // ── Dynamic list helpers ──────────────────────────────────────────

  const addLanguage = () => {
    setLanguages((prev) => [...prev, { language: '', proficiency: 'CONVERSATIONAL' }]);
  };

  const updateLanguage = (index: number, field: keyof LanguageSkill, value: string) => {
    setLanguages((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  };

  const removeLanguage = (index: number) => {
    setLanguages((prev) => prev.filter((_, i) => i !== index));
  };

  const addEducation = () => {
    setEducation((prev) => [...prev, { degree: '', field: '', institution: '', year: undefined }]);
  };

  const updateEducation = (index: number, field: keyof EducationEntry, value: string | number | undefined) => {
    setEducation((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  };

  const removeEducation = (index: number) => {
    setEducation((prev) => prev.filter((_, i) => i !== index));
  };

  const addRelevantExperience = () => {
    setRelevantExperience((prev) => [
      ...prev,
      { roleFamily: '', domain: '', skills: [], years: 0 },
    ]);
  };

  const updateRelevantExperience = (
    index: number,
    field: keyof RelevantExperienceEntry,
    value: string | string[] | number
  ) => {
    setRelevantExperience((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const removeRelevantExperience = (index: number) => {
    setRelevantExperience((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Tag add helpers for relevant experience skills ────────────────
  const addSkillToExperience = (index: number, skill: string) => {
    const entry = relevantExperience[index];
    if (!entry || entry.skills.includes(skill)) return;
    updateRelevantExperience(index, 'skills', [...entry.skills, skill]);
  };

  const removeSkillFromExperience = (index: number, skill: string) => {
    const entry = relevantExperience[index];
    if (!entry) return;
    updateRelevantExperience(
      index,
      'skills',
      entry.skills.filter((s) => s !== skill)
    );
  };

  // ── Loading state ─────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // ── Error helper ──────────────────────────────────────────────────
  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="text-red-400 text-xs mt-1.5 font-medium">{errors[key]}</p>
    ) : null;

  // ── Skill suggestions from loaded data ────────────────────────────
  const skillSuggestions = skillOptions.map((s) => s.name);
  const sectorSuggestions = sectors.map((s) => s.name);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6: AI Upload (placed first for convenience)
         ═══════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="AI Auto-Fill from CV"
        description="Paste your CV or resume text and let AI pre-fill the form"
        icon={<Sparkle24Regular className="w-5 h-5 text-emerald-400" />}
        headerColor="from-emerald-500 to-teal-400"
        borderColor="border-emerald-500/20"
      >
        <div className="space-y-3">
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            rows={6}
            placeholder="Paste your CV / resume text here..."
            className={textareaClass}
          />
          {aiError && (
            <p className="text-red-400 text-sm font-medium">{aiError}</p>
          )}
          <button
            type="button"
            onClick={handleAiExtract}
            disabled={aiExtracting || !aiText.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-[#042820] font-extrabold text-sm transition-all active:scale-[0.98]"
          >
            {aiExtracting ? (
              <>
                <ArrowSync24Regular className="w-4 h-4 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Sparkle24Regular className="w-4 h-4" />
                Extract & Fill Form
              </>
            )}
          </button>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: Basic Info
         ═══════════════════════════════════════════════════════════════ */}
      <FormSection
        title="Basic Info"
        description="Your professional headline and location"
        icon={<Person24Regular className="w-5 h-5" />}
        iconVariant="emerald"
      >
        {/* Title */}
        <div className="grid gap-2">
          <label className={labelClass}>
            Profile Title {requiredStar}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Full-Stack Developer"
            className={inputClass}
          />
          {fieldError('title')}
        </div>

        {/* Role Area */}
        <div className="grid gap-2">
          <label className={labelClass}>
            Role Area {requiredStar}
          </label>
          <input
            type="text"
            value={roleArea}
            onChange={(e) => setRoleArea(e.target.value)}
            placeholder="e.g. Engineering, Product Management, Marketing"
            className={inputClass}
          />
          {fieldError('roleArea')}
        </div>

        {/* Seniority */}
        <div className="grid gap-2">
          <label className={labelClass}>
            Seniority {requiredStar}
          </label>
          <PillSelector
            options={toPillOptions(JOB_SENIORITY_OPTIONS)}
            value={seniority}
            onChange={(v) => setSeniority(v as JobSeniority | '')}
          />
          {fieldError('seniority')}
        </div>

        {/* Location */}
        <div className="grid gap-2">
          <label className={labelClass}>
            Location {requiredStar}
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Dubai, UAE"
            className={inputClass}
          />
          {fieldError('location')}
        </div>
      </FormSection>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: Preferences
         ═══════════════════════════════════════════════════════════════ */}
      <FormSection
        title="Preferences"
        description="What you're looking for in your next role"
        icon={<Briefcase24Regular className="w-5 h-5" />}
        iconVariant="blue"
      >
        {/* Desired Work Mode */}
        <div className="grid gap-2">
          <label className={labelClass}>
            Desired Work Mode {requiredStar}
          </label>
          <MultiPillSelector
            options={toPillOptions(JOB_WORK_MODE_OPTIONS)}
            value={desiredWorkMode}
            onChange={setDesiredWorkMode}
          />
          {fieldError('desiredWorkMode')}
        </div>

        {/* Desired Employment Type */}
        <div className="grid gap-2">
          <label className={labelClass}>
            Desired Employment Type {requiredStar}
          </label>
          <MultiPillSelector
            options={toPillOptions(JOB_EMPLOYMENT_TYPE_OPTIONS)}
            value={desiredEmploymentType}
            onChange={setDesiredEmploymentType}
          />
          {fieldError('desiredEmploymentType')}
        </div>

        {/* Availability */}
        <div className="grid gap-2">
          <label className={labelClass}>Availability</label>
          <PillSelector
            options={toPillOptions(JOB_AVAILABILITY_OPTIONS)}
            value={availability}
            onChange={(v) => setAvailability(v as JobAvailability | '')}
          />
        </div>

        {/* Years of Experience + Notice Period (side by side) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className={labelClass}>Years of Experience</label>
            <input
              type="number"
              min={0}
              max={50}
              value={yearsOfExperience}
              onChange={(e) => setYearsOfExperience(e.target.value)}
              placeholder="e.g. 5"
              className={inputClass}
            />
          </div>
          <div className="grid gap-2">
            <label className={labelClass}>Notice Period (weeks)</label>
            <input
              type="number"
              min={0}
              max={52}
              value={noticePeriod}
              onChange={(e) => setNoticePeriod(e.target.value)}
              placeholder="e.g. 4"
              className={inputClass}
            />
          </div>
        </div>
      </FormSection>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: Skills
         ═══════════════════════════════════════════════════════════════ */}
      <FormSection
        title="Skills"
        description="Your core competencies and expertise"
        icon={<Star24Regular className="w-5 h-5" />}
        iconVariant="cyan"
        countBadge={skills.length > 0 ? `${skills.length} skill${skills.length !== 1 ? 's' : ''}` : undefined}
      >
        <div className="grid gap-2">
          <label className={labelClass}>
            Skills {requiredStar}
          </label>
          <AutocompleteTagInput
            value={skillInput}
            onChange={setSkillInput}
            onAdd={(val) => {
              if (!skills.includes(val)) setSkills((prev) => [...prev, val]);
            }}
            suggestions={skillSuggestions}
            existingTags={skills}
            placeholder="Type a skill and press Enter..."
          />
          {fieldError('skills')}

          {/* Skill tags */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                    className="hover:text-red-300 transition-colors"
                  >
                    <Dismiss16Regular className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </FormSection>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: Summary
         ═══════════════════════════════════════════════════════════════ */}
      <FormSection
        title="Profile Summary & Preferences"
        description="Describe your background, goals, and what you're looking for"
        icon={<Location24Regular className="w-5 h-5" />}
        iconVariant="indigo"
      >
        <div className="grid gap-2">
          <label className={labelClass}>
            Summary {requiredStar}
          </label>
          <textarea
            value={profileSummary}
            onChange={(e) => setProfileSummary(e.target.value)}
            rows={5}
            placeholder="Describe your professional background, career goals, preferred culture, tech stack, and what matters most to you in a role..."
            className={textareaClass}
          />
          {fieldError('profileSummary')}
        </div>
      </FormSection>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5: Advanced (Collapsible)
         ═══════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Advanced Details"
        description="Languages, education, certifications, salary, and experience"
        icon={<Settings24Regular className="w-5 h-5 text-cyan-400" />}
        headerColor="from-cyan-500 to-blue-400"
      >
        {/* ── Languages ──────────────────────────────────────────── */}
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <label className={labelClass}>
              <span className="flex items-center gap-2">
                <BookGlobe24Regular className="w-4 h-4 text-cyan-400" />
                Languages
              </span>
            </label>
            <button
              type="button"
              onClick={addLanguage}
              className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Add16Regular className="w-4 h-4" />
              Add
            </button>
          </div>

          {languages.map((lang, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={lang.language}
                onChange={(e) => updateLanguage(index, 'language', e.target.value)}
                placeholder="Language"
                className={`flex-1 ${inputClass}`}
                list="lang-suggestions"
              />
              <select
                value={lang.proficiency}
                onChange={(e) => updateLanguage(index, 'proficiency', e.target.value)}
                className={`w-40 ${selectClass}`}
                style={selectArrowStyle}
              >
                {LANGUAGE_PROFICIENCY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-[#0a1e34]">
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeLanguage(index)}
                className="p-2 text-red-400/70 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Dismiss16Regular className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Hidden datalist for language suggestions */}
          <datalist id="lang-suggestions">
            {LANGUAGE_SUGGESTIONS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>

        {/* ── Certifications ─────────────────────────────────────── */}
        <div className="grid gap-2">
          <label className={labelClass}>
            <span className="flex items-center gap-2">
              <Certificate24Regular className="w-4 h-4 text-cyan-400" />
              Certifications
            </span>
          </label>
          <AutocompleteTagInput
            value={certInput}
            onChange={setCertInput}
            onAdd={(val) => {
              if (!certifications.includes(val)) setCertifications((prev) => [...prev, val]);
            }}
            suggestions={CERTIFICATION_SUGGESTIONS}
            existingTags={certifications}
            placeholder="Add certification..."
            accentColor="cyan"
          />
          {certifications.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {certifications.map((cert) => (
                <span
                  key={cert}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25"
                >
                  {cert}
                  <button
                    type="button"
                    onClick={() => setCertifications((prev) => prev.filter((c) => c !== cert))}
                    className="hover:text-red-300 transition-colors"
                  >
                    <Dismiss16Regular className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Industries ─────────────────────────────────────────── */}
        <div className="grid gap-2">
          <label className={labelClass}>Industries</label>
          <AutocompleteTagInput
            value={industryInput}
            onChange={setIndustryInput}
            onAdd={(val) => {
              if (!industries.includes(val)) setIndustries((prev) => [...prev, val]);
            }}
            suggestions={sectorSuggestions}
            existingTags={industries}
            placeholder="Add industry..."
            accentColor="cyan"
          />
          {industries.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {industries.map((ind) => (
                <span
                  key={ind}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/25"
                >
                  {ind}
                  <button
                    type="button"
                    onClick={() => setIndustries((prev) => prev.filter((i) => i !== ind))}
                    className="hover:text-red-300 transition-colors"
                  >
                    <Dismiss16Regular className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Education ──────────────────────────────────────────── */}
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <label className={labelClass}>
              <span className="flex items-center gap-2">
                <HatGraduation24Regular className="w-4 h-4 text-cyan-400" />
                Education
              </span>
            </label>
            <button
              type="button"
              onClick={addEducation}
              className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Add16Regular className="w-4 h-4" />
              Add
            </button>
          </div>

          {education.map((edu, index) => (
            <div
              key={index}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={edu.degree}
                  onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                  placeholder="Degree (e.g. BSc, MSc, PhD)"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={edu.field}
                  onChange={(e) => updateEducation(index, 'field', e.target.value)}
                  placeholder="Field of study"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                <input
                  type="text"
                  value={edu.institution || ''}
                  onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                  placeholder="Institution"
                  className={inputClass}
                />
                <input
                  type="number"
                  value={edu.year || ''}
                  onChange={(e) =>
                    updateEducation(index, 'year', e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="Year"
                  min={1950}
                  max={2040}
                  className={`w-24 ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => removeEducation(index)}
                  className="p-2 text-red-400/70 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Dismiss16Regular className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Expected Salary ────────────────────────────────────── */}
        <div className="grid gap-2">
          <label className={labelClass}>Expected Salary</label>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
            <input
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="Min"
              min={0}
              className={inputClass}
            />
            <input
              type="number"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="Max"
              min={0}
              className={inputClass}
            />
            <select
              value={salaryCurrency}
              onChange={(e) => setSalaryCurrency(e.target.value)}
              className={`w-24 ${selectClass}`}
              style={selectArrowStyle}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value} className="bg-[#0a1e34]">
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Relevant Experience ────────────────────────────────── */}
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <label className={labelClass}>
              <span className="flex items-center gap-2">
                <Clock24Regular className="w-4 h-4 text-cyan-400" />
                Relevant Experience
              </span>
            </label>
            <button
              type="button"
              onClick={addRelevantExperience}
              className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Add16Regular className="w-4 h-4" />
              Add
            </button>
          </div>

          {relevantExperience.map((exp, index) => (
            <div
              key={index}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3"
            >
              <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-center">
                <input
                  type="text"
                  value={exp.roleFamily}
                  onChange={(e) => updateRelevantExperience(index, 'roleFamily', e.target.value)}
                  placeholder="Role family (e.g. Backend Dev)"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={exp.domain || ''}
                  onChange={(e) => updateRelevantExperience(index, 'domain', e.target.value)}
                  placeholder="Domain (e.g. FinTech)"
                  className={inputClass}
                />
                <input
                  type="number"
                  value={exp.years || ''}
                  onChange={(e) =>
                    updateRelevantExperience(index, 'years', e.target.value ? Number(e.target.value) : 0)
                  }
                  placeholder="Yrs"
                  min={0}
                  max={50}
                  className={`w-20 ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => removeRelevantExperience(index)}
                  className="p-2 text-red-400/70 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Dismiss16Regular className="w-4 h-4" />
                </button>
              </div>

              {/* Skills for this experience entry */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-th-text-m">Skills used</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add skill..."
                    className={`flex-1 ${inputClass}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                          addSkillToExperience(index, val);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                </div>
                {exp.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {exp.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/[0.06] text-th-text-s border border-white/[0.10]"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkillFromExperience(index, skill)}
                          className="hover:text-red-300 transition-colors"
                        >
                          <Dismiss16Regular className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════════
          SUBMIT BUTTON
         ═══════════════════════════════════════════════════════════════ */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2.5 px-6 py-[15px] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-[#042820] font-extrabold text-base transition-all active:scale-[0.98] shadow-[0_12px_28px_rgba(24,210,164,0.22)] min-h-[56px]"
        >
          {isLoading ? (
            <ArrowSync24Regular className="w-5 h-5 animate-spin" />
          ) : (
            <Checkmark24Regular className="w-5 h-5" />
          )}
          {submitLabel || (initialData ? 'Save Changes' : 'Create Candidate Profile')}
        </button>
      </div>
    </form>
  );
}
