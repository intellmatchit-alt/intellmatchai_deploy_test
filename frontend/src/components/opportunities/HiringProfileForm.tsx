/**
 * Hiring Profile Form Component (v3 Job Matching)
 *
 * Reusable form for creating and editing hiring profiles.
 * Follows the same patterns as OpportunityForm.tsx.
 */

'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Briefcase24Regular,
  Location24Regular,
  Star24Regular,
  Person24Regular,
  Building24Regular,
  ArrowSync24Regular,
  Sparkle24Regular,
  Add16Regular,
  Dismiss16Regular,
  Document24Regular,
  Clock24Regular,
} from '@fluentui/react-icons';
import {
  CreateHiringProfileInput,
  HiringProfile,
  JobSeniority,
  JobWorkMode,
  JobEmploymentType,
  JobHiringUrgency,
  LanguageSkill,
  LanguageProficiency,
  SalaryRange,
  JOB_SENIORITY_OPTIONS,
  JOB_WORK_MODE_OPTIONS,
  JOB_EMPLOYMENT_TYPE_OPTIONS,
  JOB_HIRING_URGENCY_OPTIONS,
  LANGUAGE_PROFICIENCY_OPTIONS,
  extractHiringFromText,
} from '@/lib/api/job-matching';
import { getSectors, getSkills } from '@/lib/api/profile';
import { PillSelector } from '@/components/ui/PillSelector';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { AutocompleteTagInput } from '@/components/ui/AutocompleteTagInput';
import { FormSection } from '@/components/ui/FormSection';

// ============================================================================
// Suggestion lists for autocomplete fields
// ============================================================================

const CERTIFICATION_SUGGESTIONS = [
  'PMP', 'AWS Solutions Architect', 'AWS Developer', 'Google Cloud Professional',
  'Azure Administrator', 'CISSP', 'CPA', 'CFA', 'Six Sigma', 'Scrum Master',
  'ITIL', 'TOGAF', 'Kubernetes (CKA)', 'Terraform Associate', 'CCNA', 'CompTIA Security+',
];

const EDUCATION_SUGGESTIONS = [
  'High School Diploma', 'Associate Degree', 'Bachelor', 'Master', 'PhD',
  'MBA', 'Professional Certification', 'Bootcamp / Vocational',
];

const LANGUAGE_SUGGESTIONS = [
  'English', 'Arabic', 'French', 'Spanish', 'German', 'Mandarin', 'Hindi',
  'Portuguese', 'Japanese', 'Korean', 'Russian', 'Italian', 'Turkish', 'Dutch', 'Urdu',
];

// ============================================================================
// Shared Tailwind classes (matches OpportunityForm)
// ============================================================================

const inputClass =
  'w-full px-4 py-[15px] bg-white/[0.04] border-2 border-white/[0.14] rounded-2xl text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.05] transition-all';
const textareaClass =
  'w-full px-4 py-[15px] bg-white/[0.04] border-2 border-white/[0.14] rounded-2xl text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.05] resize-vertical transition-all leading-relaxed';
const labelClass = 'block text-[0.96rem] font-extrabold text-th-text';
const requiredStar = <span className="text-[#8cffbf] ms-0.5">*</span>;

// ============================================================================
// Helper: map {id, label} options to PillSelector format {value, label}
// ============================================================================

function toPillOptions(options: ReadonlyArray<{ id: string; label: string }>): { value: string; label: string }[] {
  return options.map((o) => ({ value: o.id, label: o.label }));
}

// ============================================================================
// Component Props
// ============================================================================

interface HiringProfileFormProps {
  initialData?: Partial<HiringProfile>;
  onSubmit: (data: CreateHiringProfileInput) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

// ============================================================================
// Component
// ============================================================================

export default function HiringProfileForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = 'Create Hiring Profile',
}: HiringProfileFormProps) {
  const { t } = useI18n();

  // Autocomplete data from API
  const [sectorsList, setSectorsList] = useState<Array<{ id: string; name: string }>>([]);
  const [skillsList, setSkillsList] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ── Section 1: Basic Info ──
  const [title, setTitle] = useState(initialData?.title || '');
  const [roleArea, setRoleArea] = useState(initialData?.roleArea || '');
  const [seniority, setSeniority] = useState<string>(initialData?.seniority || '');
  const [location, setLocation] = useState(initialData?.location || '');

  // ── Section 2: Work Details ──
  const [workMode, setWorkMode] = useState<string>(initialData?.workMode || '');
  const [employmentType, setEmploymentType] = useState<string>(initialData?.employmentType || '');
  const [hiringUrgency, setHiringUrgency] = useState<string>(initialData?.hiringUrgency || '');
  const [minimumYearsExperience, setMinimumYearsExperience] = useState<string>(
    initialData?.minimumYearsExperience != null ? String(initialData.minimumYearsExperience) : ''
  );

  // ── Section 3: Skills ──
  const [mustHaveSkills, setMustHaveSkills] = useState<string[]>(initialData?.mustHaveSkills || []);
  const [preferredSkills, setPreferredSkills] = useState<string[]>(initialData?.preferredSkills || []);
  const [mustHaveInput, setMustHaveInput] = useState('');
  const [preferredInput, setPreferredInput] = useState('');

  // ── Section 4: Job Description ──
  const [jobSummary, setJobSummary] = useState(initialData?.jobSummaryRequirements || '');

  // ── Section 5: Advanced ──
  const [industries, setIndustries] = useState<string[]>(initialData?.industries || []);
  const [industryInput, setIndustryInput] = useState('');
  const [requiredLanguages, setRequiredLanguages] = useState<LanguageSkill[]>(
    initialData?.requiredLanguages || []
  );
  const [certifications, setCertifications] = useState<string[]>(initialData?.requiredCertifications || []);
  const [certInput, setCertInput] = useState('');
  const [educationLevels, setEducationLevels] = useState<string[]>(initialData?.requiredEducationLevels || []);
  const [eduInput, setEduInput] = useState('');
  const [salaryMin, setSalaryMin] = useState<string>(
    initialData?.salaryRange?.min != null ? String(initialData.salaryRange.min) : ''
  );
  const [salaryMax, setSalaryMax] = useState<string>(
    initialData?.salaryRange?.max != null ? String(initialData.salaryRange.max) : ''
  );
  const [salaryCurrency, setSalaryCurrency] = useState<string>(
    initialData?.salaryRange?.currency || 'USD'
  );

  // ── Section 6: AI Upload ──
  const [aiText, setAiText] = useState('');
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState(false);

  // ── Validation ──
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Load sectors & skills for autocomplete ──
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        const [sectorsData, skillsData] = await Promise.all([getSectors(), getSkills()]);
        setSectorsList(sectorsData);
        setSkillsList(skillsData);
      } catch (error) {
        console.error('Failed to load sectors/skills:', error);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  // ── Pill-option arrays ──
  const seniorityPills = toPillOptions(JOB_SENIORITY_OPTIONS);
  const workModePills = toPillOptions(JOB_WORK_MODE_OPTIONS);
  const employmentTypePills = toPillOptions(JOB_EMPLOYMENT_TYPE_OPTIONS);
  const urgencyPills = toPillOptions(JOB_HIRING_URGENCY_OPTIONS);
  const proficiencyPills = toPillOptions(LANGUAGE_PROFICIENCY_OPTIONS);

  // Skill name suggestions
  const skillSuggestions = skillsList.map((s) => s.name);
  const sectorSuggestions = sectorsList.map((s) => s.name);

  // ── Language helpers ──
  const addLanguageRow = () => {
    setRequiredLanguages((prev) => [...prev, { language: '', proficiency: 'CONVERSATIONAL' as LanguageProficiency }]);
  };

  const removeLanguageRow = (index: number) => {
    setRequiredLanguages((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLanguageRow = (index: number, field: keyof LanguageSkill, value: string) => {
    setRequiredLanguages((prev) =>
      prev.map((lang, i) => (i === index ? { ...lang, [field]: value } : lang))
    );
  };

  // ── Tag helpers ──
  const addTag = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList((prev) => [...prev, trimmed]);
    }
  };

  const removeTag = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    setList((prev) => prev.filter((t) => t !== value));
  };

  // ── Validation ──
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';
    if (!roleArea.trim()) newErrors.roleArea = 'Role Area is required';
    if (!seniority) newErrors.seniority = 'Seniority is required';
    if (!location.trim()) newErrors.location = 'Location is required';
    if (!workMode) newErrors.workMode = 'Work Mode is required';
    if (!employmentType) newErrors.employmentType = 'Employment Type is required';
    if (mustHaveSkills.length === 0) newErrors.mustHaveSkills = 'At least one must-have skill is required';
    if (!jobSummary.trim()) newErrors.jobSummary = 'Job Summary / Requirements is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const salaryRange: SalaryRange | undefined =
      salaryMin || salaryMax
        ? {
            ...(salaryMin ? { min: Number(salaryMin) } : {}),
            ...(salaryMax ? { max: Number(salaryMax) } : {}),
            currency: salaryCurrency || 'USD',
          }
        : undefined;

    // Filter out incomplete language rows
    const validLanguages = requiredLanguages.filter((l) => l.language.trim());

    const data: CreateHiringProfileInput = {
      title: title.trim(),
      roleArea: roleArea.trim(),
      seniority: seniority as JobSeniority,
      location: location.trim(),
      workMode: workMode as JobWorkMode,
      employmentType: employmentType as JobEmploymentType,
      mustHaveSkills,
      jobSummaryRequirements: jobSummary.trim(),
      ...(preferredSkills.length > 0 && { preferredSkills }),
      ...(minimumYearsExperience && { minimumYearsExperience: Number(minimumYearsExperience) }),
      ...(hiringUrgency && { hiringUrgency: hiringUrgency as JobHiringUrgency }),
      ...(industries.length > 0 && { industries }),
      ...(validLanguages.length > 0 && { requiredLanguages: validLanguages }),
      ...(certifications.length > 0 && { requiredCertifications: certifications }),
      ...(educationLevels.length > 0 && { requiredEducationLevels: educationLevels }),
      ...(salaryRange && { salaryRange }),
    };

    await onSubmit(data);
  };

  // ── AI extraction ──
  const handleAiExtract = async () => {
    if (!aiText.trim()) return;
    setAiExtracting(true);
    setAiError(null);
    setAiSuccess(false);

    try {
      const data = await extractHiringFromText(aiText.trim());

      if (data.title) setTitle(data.title);
      if (data.roleArea) setRoleArea(data.roleArea);
      if (data.seniority) setSeniority(data.seniority);
      if (data.location) setLocation(data.location);
      if (data.workMode) setWorkMode(data.workMode);
      if (data.employmentType) setEmploymentType(data.employmentType);
      if (data.hiringUrgency) setHiringUrgency(data.hiringUrgency);
      if (data.minimumYearsExperience != null) setMinimumYearsExperience(String(data.minimumYearsExperience));
      if (data.mustHaveSkills?.length) setMustHaveSkills(data.mustHaveSkills);
      if (data.preferredSkills?.length) setPreferredSkills(data.preferredSkills);
      if (data.jobSummaryRequirements) setJobSummary(data.jobSummaryRequirements);
      if (data.industries?.length) setIndustries(data.industries);
      if (data.requiredLanguages?.length) setRequiredLanguages(data.requiredLanguages);
      if (data.requiredCertifications?.length) setCertifications(data.requiredCertifications);
      if (data.requiredEducationLevels?.length) setEducationLevels(data.requiredEducationLevels);

      setAiSuccess(true);
    } catch (error: any) {
      console.error('AI extraction failed:', error);
      setAiError(error.message || 'Failed to extract data. Please try again or fill the form manually.');
    } finally {
      setAiExtracting(false);
    }
  };

  // ── Loading state ──
  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // ── Error display helper ──
  const FieldError = ({ field }: { field: string }) =>
    errors[field] ? (
      <p className="text-red-400 text-xs mt-1.5 font-medium">{errors[field]}</p>
    ) : null;

  // ── Tag chips display ──
  const TagChips = ({
    tags,
    onRemove,
  }: {
    tags: string[];
    onRemove: (tag: string) => void;
  }) =>
    tags.length > 0 ? (
      <div className="flex flex-wrap gap-2 mt-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="hover:text-red-400 transition-colors"
            >
              <Dismiss16Regular className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>
    ) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ================================================================ */}
      {/* Section 1 — Basic Info                                          */}
      {/* ================================================================ */}
      <FormSection
        title="Basic Info"
        icon={<Briefcase24Regular className="w-5 h-5" />}
        iconVariant="emerald"
      >
        {/* Title */}
        <div>
          <label className={labelClass}>
            Title {requiredStar}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Frontend Developer"
            className={`${inputClass} mt-1.5`}
          />
          <FieldError field="title" />
        </div>

        {/* Role Area */}
        <div>
          <label className={labelClass}>
            Role Area {requiredStar}
          </label>
          <input
            type="text"
            value={roleArea}
            onChange={(e) => setRoleArea(e.target.value)}
            placeholder="e.g. Frontend Engineering"
            className={`${inputClass} mt-1.5`}
          />
          <FieldError field="roleArea" />
        </div>

        {/* Seniority */}
        <div>
          <label className={labelClass}>
            Seniority {requiredStar}
          </label>
          <div className="mt-2">
            <PillSelector
              options={seniorityPills}
              value={seniority}
              onChange={setSeniority}
            />
          </div>
          <FieldError field="seniority" />
        </div>

        {/* Location */}
        <div>
          <label className={labelClass}>
            Location {requiredStar}
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Dubai, UAE"
            className={`${inputClass} mt-1.5`}
          />
          <FieldError field="location" />
        </div>
      </FormSection>

      {/* ================================================================ */}
      {/* Section 2 — Work Details                                        */}
      {/* ================================================================ */}
      <FormSection
        title="Work Details"
        icon={<Building24Regular className="w-5 h-5" />}
        iconVariant="blue"
      >
        {/* Work Mode */}
        <div>
          <label className={labelClass}>
            Work Mode {requiredStar}
          </label>
          <div className="mt-2">
            <PillSelector
              options={workModePills}
              value={workMode}
              onChange={setWorkMode}
            />
          </div>
          <FieldError field="workMode" />
        </div>

        {/* Employment Type */}
        <div>
          <label className={labelClass}>
            Employment Type {requiredStar}
          </label>
          <div className="mt-2">
            <PillSelector
              options={employmentTypePills}
              value={employmentType}
              onChange={setEmploymentType}
            />
          </div>
          <FieldError field="employmentType" />
        </div>

        {/* Hiring Urgency */}
        <div>
          <label className={labelClass}>Hiring Urgency</label>
          <div className="mt-2">
            <PillSelector
              options={urgencyPills}
              value={hiringUrgency}
              onChange={setHiringUrgency}
            />
          </div>
        </div>

        {/* Minimum Years Experience */}
        <div>
          <label className={labelClass}>Minimum Years Experience</label>
          <input
            type="number"
            min={0}
            max={50}
            value={minimumYearsExperience}
            onChange={(e) => setMinimumYearsExperience(e.target.value)}
            placeholder="e.g. 3"
            className={`${inputClass} mt-1.5`}
          />
        </div>
      </FormSection>

      {/* ================================================================ */}
      {/* Section 3 — Skills                                              */}
      {/* ================================================================ */}
      <FormSection
        title="Skills"
        icon={<Star24Regular className="w-5 h-5" />}
        iconVariant="cyan"
      >
        {/* Must-Have Skills */}
        <div>
          <label className={labelClass}>
            Must-Have Skills {requiredStar}
          </label>
          <div className="mt-1.5">
            <AutocompleteTagInput
              value={mustHaveInput}
              onChange={setMustHaveInput}
              onAdd={(val) => {
                addTag(mustHaveSkills, setMustHaveSkills, val);
                setMustHaveInput('');
              }}
              suggestions={skillSuggestions}
              existingTags={[...mustHaveSkills, ...preferredSkills]}
              placeholder="Add a must-have skill..."
            />
          </div>
          <TagChips
            tags={mustHaveSkills}
            onRemove={(tag) => removeTag(mustHaveSkills, setMustHaveSkills, tag)}
          />
          <FieldError field="mustHaveSkills" />
        </div>

        {/* Preferred Skills */}
        <div>
          <label className={labelClass}>Preferred Skills</label>
          <div className="mt-1.5">
            <AutocompleteTagInput
              value={preferredInput}
              onChange={setPreferredInput}
              onAdd={(val) => {
                addTag(preferredSkills, setPreferredSkills, val);
                setPreferredInput('');
              }}
              suggestions={skillSuggestions}
              existingTags={[...mustHaveSkills, ...preferredSkills]}
              placeholder="Add a preferred skill..."
            />
          </div>
          <TagChips
            tags={preferredSkills}
            onRemove={(tag) => removeTag(preferredSkills, setPreferredSkills, tag)}
          />
        </div>
      </FormSection>

      {/* ================================================================ */}
      {/* Section 4 — Job Description                                     */}
      {/* ================================================================ */}
      <FormSection
        title="Job Description"
        icon={<Document24Regular className="w-5 h-5" />}
        iconVariant="indigo"
      >
        <div>
          <label className={labelClass}>
            Job Summary / Requirements {requiredStar}
          </label>
          <textarea
            value={jobSummary}
            onChange={(e) => setJobSummary(e.target.value)}
            placeholder="Describe the role responsibilities, requirements, team context, and what success looks like..."
            rows={6}
            className={`${textareaClass} mt-1.5`}
          />
          <FieldError field="jobSummary" />
        </div>
      </FormSection>

      {/* ================================================================ */}
      {/* Section 5 — Advanced (Collapsible)                              */}
      {/* ================================================================ */}
      <CollapsibleSection
        title="Advanced Details"
        description="Industries, languages, certifications, education, salary"
        icon={<Person24Regular className="w-5 h-5 text-white/60" />}
        defaultOpen={false}
      >
        {/* Industries */}
        <div>
          <label className={labelClass}>Industries</label>
          <div className="mt-1.5">
            <AutocompleteTagInput
              value={industryInput}
              onChange={setIndustryInput}
              onAdd={(val) => {
                addTag(industries, setIndustries, val);
                setIndustryInput('');
              }}
              suggestions={sectorSuggestions}
              existingTags={industries}
              placeholder="Add an industry..."
            />
          </div>
          <TagChips
            tags={industries}
            onRemove={(tag) => removeTag(industries, setIndustries, tag)}
          />
        </div>

        {/* Required Languages */}
        <div>
          <label className={labelClass}>Required Languages</label>
          <div className="mt-2 space-y-3">
            {requiredLanguages.map((lang, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.10] rounded-2xl p-3"
              >
                <input
                  type="text"
                  value={lang.language}
                  onChange={(e) => updateLanguageRow(index, 'language', e.target.value)}
                  placeholder="Language"
                  className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.14] rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/60 transition-all text-sm"
                  list={`lang-suggestions-${index}`}
                />
                <datalist id={`lang-suggestions-${index}`}>
                  {LANGUAGE_SUGGESTIONS.filter(
                    (s) => !requiredLanguages.some((l, i) => i !== index && l.language === s)
                  ).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <div className="flex-1">
                  <PillSelector
                    options={proficiencyPills}
                    value={lang.proficiency}
                    onChange={(val) => updateLanguageRow(index, 'proficiency', val)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLanguageRow(index)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                >
                  <Dismiss16Regular className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLanguageRow}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 transition-colors"
            >
              <Add16Regular className="w-4 h-4" />
              Add Language
            </button>
          </div>
        </div>

        {/* Required Certifications */}
        <div>
          <label className={labelClass}>Required Certifications</label>
          <div className="mt-1.5">
            <AutocompleteTagInput
              value={certInput}
              onChange={setCertInput}
              onAdd={(val) => {
                addTag(certifications, setCertifications, val);
                setCertInput('');
              }}
              suggestions={CERTIFICATION_SUGGESTIONS}
              existingTags={certifications}
              placeholder="Add a certification..."
            />
          </div>
          <TagChips
            tags={certifications}
            onRemove={(tag) => removeTag(certifications, setCertifications, tag)}
          />
        </div>

        {/* Required Education Levels */}
        <div>
          <label className={labelClass}>Required Education Levels</label>
          <div className="mt-1.5">
            <AutocompleteTagInput
              value={eduInput}
              onChange={setEduInput}
              onAdd={(val) => {
                addTag(educationLevels, setEducationLevels, val);
                setEduInput('');
              }}
              suggestions={EDUCATION_SUGGESTIONS}
              existingTags={educationLevels}
              placeholder="Add an education level..."
            />
          </div>
          <TagChips
            tags={educationLevels}
            onRemove={(tag) => removeTag(educationLevels, setEducationLevels, tag)}
          />
        </div>

        {/* Salary Range */}
        <div>
          <label className={labelClass}>Salary Range</label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="number"
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="Min"
              className={`${inputClass} flex-1`}
            />
            <span className="text-white/30 font-bold">—</span>
            <input
              type="number"
              min={0}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="Max"
              className={`${inputClass} flex-1`}
            />
            <input
              type="text"
              value={salaryCurrency}
              onChange={(e) => setSalaryCurrency(e.target.value.toUpperCase())}
              placeholder="USD"
              className={`${inputClass} w-24 text-center`}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* ================================================================ */}
      {/* Section 6 — AI Upload (Collapsible)                             */}
      {/* ================================================================ */}
      <CollapsibleSection
        title="AI Auto-Fill"
        description="Paste a job description and let AI fill in the form"
        icon={<Sparkle24Regular className="w-5 h-5 text-yellow-400" />}
        defaultOpen={false}
      >
        <div className="space-y-3">
          <textarea
            value={aiText}
            onChange={(e) => {
              setAiText(e.target.value);
              setAiError(null);
              setAiSuccess(false);
            }}
            placeholder="Paste the full job description text here..."
            rows={8}
            className={textareaClass}
          />

          {aiError && (
            <p className="text-red-400 text-sm font-medium">{aiError}</p>
          )}

          {aiSuccess && (
            <p className="text-emerald-400 text-sm font-medium">
              Form fields have been pre-filled from the job description. Review and adjust as needed.
            </p>
          )}

          <button
            type="button"
            onClick={handleAiExtract}
            disabled={aiExtracting || !aiText.trim()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-yellow-500/80 to-amber-500/80 text-white hover:from-yellow-500 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {aiExtracting ? (
              <>
                <ArrowSync24Regular className="w-5 h-5 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Sparkle24Regular className="w-5 h-5" />
                Extract & Fill Form
              </>
            )}
          </button>
        </div>
      </CollapsibleSection>

      {/* ================================================================ */}
      {/* Submit Button                                                    */}
      {/* ================================================================ */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <ArrowSync24Regular className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
