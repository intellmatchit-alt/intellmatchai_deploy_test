/**
 * ProjectForm - Unified form for creating and editing projects.
 *
 * Used by both /projects/new and /projects/[id]/edit pages.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Lightbulb24Regular,
  DocumentText24Regular,
  Tag24Regular,
  People24Regular,
  Rocket24Regular,
  ArrowSync24Regular,
  FullScreenMaximize24Regular,
  Save24Regular,
  Dismiss16Regular,
  Globe24Regular,
  Sparkle24Regular,
} from '@fluentui/react-icons';
import {
  extractFromDocument,
  analyzeProjectText,
  STAGE_OPTIONS,
  LOOKING_FOR_OPTIONS,
  PARTNER_TYPE_OPTIONS,
  COMMITMENT_LEVEL_OPTIONS,
  TARGET_CUSTOMER_OPTIONS,
  ENGAGEMENT_MODEL_OPTIONS,
  MARKET_OPTIONS,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectStage,
  ProjectVisibility,
  SkillImportance,
  ExtractedProjectData,
} from '@/lib/api/projects';
import { FormSection } from '@/components/ui/FormSection';
import { DocumentUploadSection } from '@/components/ui/DocumentUploadSection';
import { SearchableChipSelector } from '@/components/ui/SearchableChipSelector';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { AutocompleteTagInput } from '@/components/ui/AutocompleteTagInput';
import { MultiPillSelector } from '@/components/ui/MultiPillSelector';
import { PillSelector } from '@/components/ui/PillSelector';
import { toast } from '@/components/ui/Toast';
import s from './ProjectForm.module.css';

interface Sector {
  id: string;
  name: string;
}

interface Skill {
  id: string;
  name: string;
}

export interface ProjectFormProps {
  project?: Project;
  onSubmit: (data: CreateProjectInput | UpdateProjectInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NEEDS_SUGGESTIONS = [
  'Funding', 'Technical Co-founder', 'Marketing Support', 'Partnership',
  'Mentorship', 'Legal Advice', 'Sales Strategy', 'Product Development',
  'Market Access', 'Team Hiring', 'Go-to-Market Strategy', 'Investment',
];

const TRACTION_SUGGESTIONS = [
  'Users', 'Revenue', 'Pilots', 'Partnerships', 'Letters of Intent',
  'Waitlist', 'Beta Users', 'MRR', 'Growth Rate', 'Paying Customers',
];

const ADVISORY_SUGGESTIONS = [
  'Fundraising', 'Product Strategy', 'Go-to-Market', 'Legal/IP',
  'Tech Architecture', 'Hiring', 'International Expansion', 'Board Governance',
  'Financial Planning', 'Market Research',
];

const MARKET_ALIASES: Record<string, string> = {
  'middle east': 'mena', 'mena region': 'mena', 'mena': 'mena',
  'gulf': 'gcc', 'gulf region': 'gcc', 'gulf states': 'gcc', 'gcc': 'gcc',
  'north america': 'north_america', 'us': 'usa', 'united states': 'usa',
  'united kingdom': 'uk', 'asia': 'asia_pacific', 'asia pacific': 'asia_pacific',
  'apac': 'asia_pacific', 'latam': 'latin_america', 'south america': 'latin_america',
  'latin america': 'latin_america', 'ksa': 'saudi_arabia', 'saudi': 'saudi_arabia',
  'worldwide': 'global', 'international': 'global', 'global': 'global',
  'africa': 'africa', 'europe': 'europe',
};

function mapMarketValue(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  // Direct match on value or label
  const direct = MARKET_OPTIONS.find(o => o.value === lower || o.label.toLowerCase() === lower || o.value === lower.replace(/[\s_-]+/g, '_'));
  if (direct) return direct.value;
  // Alias match
  if (MARKET_ALIASES[lower]) return MARKET_ALIASES[lower];
  return null;
}

const CATEGORY_SUGGESTIONS = [
  'HealthTech', 'FinTech', 'EdTech', 'SaaS', 'E-Commerce', 'AI/ML',
  'CleanTech', 'PropTech', 'AgriTech', 'FoodTech', 'LegalTech', 'HR Tech',
  'Marketing', 'InsurTech', 'Logistics', 'Gaming', 'Social', 'Media & Entertainment',
  'Cybersecurity', 'IoT', 'Blockchain',
];

const LOOKING_FOR_SUGGESTIONS = [
  'Marketing Consultant', 'Business Analyst', 'Product Designer', 'Growth Hacker',
  'Sales Representative', 'Operations Manager', 'Legal Counsel', 'CFO',
  'CTO', 'Data Scientist', 'Brand Strategist', 'Supply Chain Expert',
  'UX Researcher', 'Content Strategist', 'PR Specialist', 'Angel Investor',
];

const MARKET_SUGGESTIONS = [
  'Southeast Asia', 'Central Europe', 'East Africa', 'Central Asia',
  'Caribbean', 'Pacific Islands', 'Scandinavia', 'Benelux',
];

/** Sort items: selected first, then AI-suggested, then rest */
function smartSort<T>(items: T[], getId: (item: T) => string, selectedIds: string[], suggestedIds: string[]): T[] {
  return [...items].sort((a, b) => {
    const aS = selectedIds.includes(getId(a)), bS = selectedIds.includes(getId(b));
    if (aS !== bS) return aS ? -1 : 1;
    const aSug = suggestedIds.includes(getId(a)), bSug = suggestedIds.includes(getId(b));
    if (aSug !== bSug) return aSug ? -1 : 1;
    return 0;
  });
}

export default function ProjectForm({ project, onSubmit, onCancel, isSubmitting }: ProjectFormProps) {
  const { t } = useI18n();
  const isEditMode = !!project;

  // Lookup data
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  // Custom entries
  const [customSkills, setCustomSkills] = useState<Skill[]>([]);

  // AI suggestion tracking
  const [suggestedSectorIds, setSuggestedSectorIds] = useState<string[]>([]);
  const [suggestedSkillIds, setSuggestedSkillIds] = useState<string[]>([]);
  const [suggestedLookingFor, setSuggestedLookingFor] = useState<string[]>([]);

  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [fundingSource, setFundingSource] = useState<'manual' | 'document' | 'ai'>('manual');
  const [marketsSource, setMarketsSource] = useState<'manual' | 'document' | 'ai'>('manual');

  // Form state
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [detailedDesc, setDetailedDesc] = useState('');
  const [categories, setCategories] = useState<string[]>(['other']);
  const [categorySearch, setCategorySearch] = useState('');
  const [marketSearch, setMarketSearch] = useState('');
  const [stage, setStage] = useState<ProjectStage>('IDEA');
  const [timeline, setTimeline] = useState('');
  const [selectedLookingFor, setSelectedLookingFor] = useState<string[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Array<{ skillId: string; importance: SkillImportance }>>([]);
  const [visibility, setVisibility] = useState<ProjectVisibility>('PRIVATE');
  const [isActive, setIsActive] = useState(true);

  // New structured fields
  const [needs, setNeeds] = useState<string[]>(project?.needs || []);
  const [needsInput, setNeedsInput] = useState('');
  const [markets, setMarkets] = useState<string[]>(project?.markets || []);
  const [fundingAskMin, setFundingAskMin] = useState<string>(
    project?.fundingAskMin != null ? String(project.fundingAskMin) : ''
  );
  const [fundingAskMax, setFundingAskMax] = useState<string>(
    project?.fundingAskMax != null ? String(project.fundingAskMax) : ''
  );
  const [tractionSignals, setTractionSignals] = useState<string[]>(project?.tractionSignals || []);
  const [tractionInput, setTractionInput] = useState('');
  const [advisoryTopics, setAdvisoryTopics] = useState<string[]>(project?.advisoryTopics || []);
  const [advisoryInput, setAdvisoryInput] = useState('');
  const [partnerTypeNeeded, setPartnerTypeNeeded] = useState<string[]>(project?.partnerTypeNeeded || []);
  const [commitmentLevelNeeded, setCommitmentLevelNeeded] = useState<string>(project?.commitmentLevelNeeded || '');
  const [idealCounterpartProfile, setIdealCounterpartProfile] = useState<string>(project?.idealCounterpartProfile || '');
  const [targetCustomerTypes, setTargetCustomerTypes] = useState<string[]>(project?.targetCustomerTypes || []);
  const [engagementModel, setEngagementModel] = useState<string[]>(project?.engagementModel || []);
  const [strictLookingFor, setStrictLookingFor] = useState<boolean>(project?.strictLookingFor || false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Expand states for textareas
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // Pre-populate form in edit mode
  useEffect(() => {
    if (!project) return;
    setTitle(project.title || '');
    setSummary(project.summary || '');
    setDetailedDesc(project.detailedDesc || '');
    setCategories(project.category ? project.category.split(',').map(c => c.trim()).filter(Boolean) : ['other']);
    setStage(project.stage || 'IDEA');
    setTimeline(project.timeline || '');
    setSelectedLookingFor(project.lookingFor || []);
    setSelectedSectorIds(project.sectors?.map(s => s.id) || []);
    setSelectedSkills(
      project.skillsNeeded?.map(s => ({
        skillId: s.id,
        importance: (s.importance || 'REQUIRED') as SkillImportance,
      })) || []
    );
    setVisibility(project.visibility || 'PUBLIC');
    setIsActive(project.isActive !== false);
    setNeeds(project.needs || []);
    setMarkets(project.markets || []);
    setFundingAskMin(project.fundingAskMin != null ? String(project.fundingAskMin) : '');
    setFundingAskMax(project.fundingAskMax != null ? String(project.fundingAskMax) : '');
    setTractionSignals(project.tractionSignals || []);
    setAdvisoryTopics(project.advisoryTopics || []);
    setPartnerTypeNeeded(project.partnerTypeNeeded || []);
    setCommitmentLevelNeeded(project.commitmentLevelNeeded || '');
    setIdealCounterpartProfile(project.idealCounterpartProfile || '');
    setTargetCustomerTypes(project.targetCustomerTypes || []);
    setEngagementModel(project.engagementModel || []);
    setStrictLookingFor(project.strictLookingFor || false);
  }, [project]);

  // Fetch sectors and skills
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [sectorsRes, skillsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/sectors`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('p2p_access_token')}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/skills`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('p2p_access_token')}` },
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

  // Combined items (real + custom)
  const allSectors = useMemo(() => [...sectors], [sectors]);
  const allSkills = useMemo(() => [...skills, ...customSkills], [skills, customSkills]);
  const allLookingForOptions = useMemo(() => {
    return LOOKING_FOR_OPTIONS.map(o => ({ id: o.id, name: o.label }));
  }, []);

  // Toggle helpers
  const toggleLookingFor = useCallback((id: string) => {
    setSelectedLookingFor(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const toggleSector = useCallback((id: string) => {
    setSelectedSectorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const toggleSkill = useCallback((id: string) => {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.skillId === id);
      if (exists) return prev.filter(s => s.skillId !== id);
      return [...prev, { skillId: id, importance: 'REQUIRED' as SkillImportance }];
    });
  }, []);

  // Custom entry handlers
  const handleAddCustomSkill = useCallback((name: string) => {
    const customId = `custom_${Date.now()}`;
    setCustomSkills(prev => [...prev, { id: customId, name }]);
    setSelectedSkills(prev => [...prev, { skillId: customId, importance: 'REQUIRED' as SkillImportance }]);
  }, []);

  // Document extraction handler (create mode only)
  const handleDocumentExtracted = useCallback((extracted: ExtractedProjectData) => {
    if (extracted.title) setTitle(extracted.title);
    if (extracted.summary) setSummary(extracted.summary);
    if (extracted.detailedDesc) setDetailedDesc(extracted.detailedDesc);
    if (extracted.category && extracted.category !== 'Other') {
      const cat = extracted.category;
      setCategories(prev => prev.includes(cat) ? prev : [...prev.filter(c => c === 'other' || c === 'Other' ? false : true), cat]);
    }
    if (extracted.stage) setStage(extracted.stage);
    if (extracted.needs?.length) setNeeds(extracted.needs);
    else if (extracted.whatYouNeed) setNeeds([extracted.whatYouNeed]); // backward compat
    if (extracted.timeline) setTimeline(extracted.timeline);
    if (extracted.markets?.length || extracted.operatingMarkets?.length) {
      const raw = extracted.markets?.length ? extracted.markets : extracted.operatingMarkets!;
      const mapped = raw.map(m => mapMarketValue(m)).filter(Boolean) as string[];
      if (mapped.length) { setMarkets(prev => [...new Set([...prev, ...mapped])]); setMarketsSource('document'); }
    }
    if (extracted.fundingAskMin || extracted.fundingAskMax) {
      if (extracted.fundingAskMin) setFundingAskMin(String(extracted.fundingAskMin));
      if (extracted.fundingAskMax) setFundingAskMax(String(extracted.fundingAskMax));
      setFundingSource('document');
    }
    if (extracted.tractionSignals?.length) setTractionSignals(extracted.tractionSignals);
    if (extracted.advisoryTopics?.length) setAdvisoryTopics(extracted.advisoryTopics);

    if (extracted.lookingFor?.length) {
      setSelectedLookingFor(prev => [...new Set([...prev, ...extracted.lookingFor])]);
      setSuggestedLookingFor(prev => [...new Set([...prev, ...extracted.lookingFor])]);
    }
    if (extracted.sectorIds?.length) {
      setSelectedSectorIds(prev => [...new Set([...prev, ...extracted.sectorIds])]);
      setSuggestedSectorIds(prev => [...new Set([...prev, ...extracted.sectorIds])]);
    }
    if (extracted.skills?.length) {
      setSelectedSkills(prev => {
        const existingIds = new Set(prev.map(s => s.skillId));
        return [...prev, ...extracted.skills.filter(s => !existingIds.has(s.skillId))];
      });
      setSuggestedSkillIds(prev => [...new Set([...prev, ...extracted.skills.map(s => s.skillId)])]);
    }
    if (extracted.idealCounterpartProfile) setIdealCounterpartProfile(extracted.idealCounterpartProfile);
    if (extracted.partnerTypeNeeded?.length) setPartnerTypeNeeded(extracted.partnerTypeNeeded);
    if (extracted.commitmentLevelNeeded) setCommitmentLevelNeeded(extracted.commitmentLevelNeeded);
    if (extracted.engagementModel?.length) setEngagementModel(extracted.engagementModel);
    if (extracted.targetCustomerTypes?.length) setTargetCustomerTypes(extracted.targetCustomerTypes);

    toast({
      title: 'Data Extracted',
      description: 'Project data has been extracted. AI-suggested items are highlighted.',
      variant: 'success',
    });
  }, []);

  // AI analyze
  const handleAIAnalyze = async () => {
    if (!title.trim() && !summary.trim()) {
      toast({ title: 'Info', description: 'Please fill in at least a title or summary first', variant: 'error' });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);
    try {
      const result = await analyzeProjectText({
        title: title.trim(),
        summary: summary.trim(),
        detailedDesc: detailedDesc.trim() || undefined,
      });
      setAnalysisProgress(100);

      if (result.category && result.category !== 'Other') {
        const cat = result.category;
        setCategories(prev => prev.includes(cat) ? prev : [...prev.filter(c => c === 'other' || c === 'Other' ? false : true), cat]);
      }
      if (result.stage) setStage(result.stage as ProjectStage);

      if (result.lookingFor?.length) {
        setSelectedLookingFor(prev => [...new Set([...prev, ...result.lookingFor])]);
        setSuggestedLookingFor(prev => [...new Set([...prev, ...result.lookingFor])]);
      }
      if (result.sectorIds?.length) {
        setSelectedSectorIds(prev => [...new Set([...prev, ...result.sectorIds])]);
        setSuggestedSectorIds(prev => [...new Set([...prev, ...result.sectorIds])]);
      }
      if (result.skills?.length) {
        setSelectedSkills(prev => {
          const existingIds = new Set(prev.map(s => s.skillId));
          return [...prev, ...result.skills.filter(s => !existingIds.has(s.skillId))];
        });
        setSuggestedSkillIds(prev => [...new Set([...prev, ...result.skills.map(s => s.skillId)])]);
      }
      if (result.needs?.length) setNeeds(result.needs);
      if (result.markets?.length) {
        const mapped = result.markets.map(m => mapMarketValue(m)).filter(Boolean) as string[];
        if (mapped.length) { setMarkets(prev => [...new Set([...prev, ...mapped])]); setMarketsSource('ai'); }
      }
      if (result.idealCounterpartProfile) setIdealCounterpartProfile(result.idealCounterpartProfile);
      if (result.partnerTypeNeeded?.length) setPartnerTypeNeeded(result.partnerTypeNeeded);
      if (result.commitmentLevelNeeded) setCommitmentLevelNeeded(result.commitmentLevelNeeded);
      if (result.engagementModel?.length) setEngagementModel(result.engagementModel);
      if (result.targetCustomerTypes?.length) setTargetCustomerTypes(result.targetCustomerTypes);
      if (result.tractionSignals?.length) setTractionSignals(result.tractionSignals);
      if (result.advisoryTopics?.length) setAdvisoryTopics(result.advisoryTopics);
      // Auto-open advanced section if AI filled any
      if (result.tractionSignals?.length || result.advisoryTopics?.length || result.partnerTypeNeeded?.length) setAdvancedOpen(true);

      setHasAnalyzed(true);
      toast({
        title: 'AI Analysis Complete',
        description: 'Category, sectors, skills, and more have been suggested.',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'AI analysis failed',
        variant: 'error',
      });
    } finally {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
    }
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !summary.trim() || !detailedDesc.trim()) {
      toast({
        title: t.common?.error || 'Error',
        description: t.projects?.requiredFields || 'Title, summary, and detailed description are required',
        variant: 'error',
      });
      return;
    }

    const validSectorIds = selectedSectorIds.filter(id => !id.startsWith('custom_') && UUID_RE.test(id));
    const validSkills = selectedSkills.filter(s => !s.skillId.startsWith('custom_') && UUID_RE.test(s.skillId));

    if (isEditMode) {
      const data: UpdateProjectInput = {
        title: title.trim(),
        summary: summary.trim(),
        detailedDesc: detailedDesc.trim() || undefined,
        category: categories.length > 0 ? categories[0] : undefined,
        stage,
        timeline: timeline.trim() || undefined,
        lookingFor: [...selectedLookingFor, ...customLookingFor],
        sectorIds: validSectorIds,
        skills: validSkills,
        visibility,
        isActive,
        ...(needs.length > 0 && { needs }),
        ...((markets.length > 0 || customMarkets.length > 0) && { markets: [...markets, ...customMarkets] }),
        ...(fundingAskMin && { fundingAskMin: Number(fundingAskMin) }),
        ...(fundingAskMax && { fundingAskMax: Number(fundingAskMax) }),
        ...(tractionSignals.length > 0 && { tractionSignals }),
        ...(advisoryTopics.length > 0 && { advisoryTopics }),
        ...(partnerTypeNeeded.length > 0 && { partnerTypeNeeded }),
        ...(commitmentLevelNeeded && { commitmentLevelNeeded }),
        ...(idealCounterpartProfile.trim() && { idealCounterpartProfile: idealCounterpartProfile.trim() }),
        ...(targetCustomerTypes.length > 0 && { targetCustomerTypes }),
        ...(engagementModel.length > 0 && { engagementModel }),
        strictLookingFor,
      };
      await onSubmit(data);
    } else {
      const data: CreateProjectInput = {
        title: title.trim(),
        summary: summary.trim(),
        detailedDesc: detailedDesc.trim() || undefined,
        category: categories.length > 0 ? categories[0] : 'other',
        stage,
        timeline: timeline.trim() || undefined,
        lookingFor: [...selectedLookingFor, ...customLookingFor],
        sectorIds: validSectorIds,
        skills: validSkills,
        visibility,
        ...(needs.length > 0 && { needs }),
        ...((markets.length > 0 || customMarkets.length > 0) && { markets: [...markets, ...customMarkets] }),
        ...(fundingAskMin && { fundingAskMin: Number(fundingAskMin) }),
        ...(fundingAskMax && { fundingAskMax: Number(fundingAskMax) }),
        ...(tractionSignals.length > 0 && { tractionSignals }),
        ...(advisoryTopics.length > 0 && { advisoryTopics }),
        ...(partnerTypeNeeded.length > 0 && { partnerTypeNeeded }),
        ...(commitmentLevelNeeded && { commitmentLevelNeeded }),
        ...(idealCounterpartProfile.trim() && { idealCounterpartProfile: idealCounterpartProfile.trim() }),
        ...(targetCustomerTypes.length > 0 && { targetCustomerTypes }),
        ...(engagementModel.length > 0 && { engagementModel }),
        strictLookingFor,
      };
      await onSubmit(data);
    }
  };

  /** Resets form to initial state (used by create page for "add another") */
  const resetForm = useCallback(() => {
    setTitle('');
    setSummary('');
    setDetailedDesc('');
    setCategories(['other']);
    setCategorySearch('');
    setStage('IDEA');
    setTimeline('');
    setSelectedLookingFor([]);
    setSelectedSectorIds([]);
    setSelectedSkills([]);
    setVisibility('PRIVATE');
    setIsActive(true);
    setNeeds([]);
    setNeedsInput('');
    setMarkets([]);
    setFundingAskMin('');
    setFundingAskMax('');
    setTractionSignals([]);
    setTractionInput('');
    setAdvisoryTopics([]);
    setAdvisoryInput('');
    setPartnerTypeNeeded([]);
    setCommitmentLevelNeeded('');
    setIdealCounterpartProfile('');
    setTargetCustomerTypes([]);
    setEngagementModel([]);
    setStrictLookingFor(false);
    setAdvancedOpen(false);
    setSuggestedSectorIds([]);
    setSuggestedSkillIds([]);
    setSuggestedLookingFor([]);
    setCustomSkills([]);
    setHasAnalyzed(false);
  }, []);

  // Expose resetForm via a ref-like pattern (attach to component)
  // The parent can call this via key prop remounting instead
  (ProjectForm as any).__resetForm = resetForm;

  // Helper: expandable textarea using CSS module classes
  const Textarea = ({ label: fl, value: fv, onChange: fo, placeholder: fp, expanded: fe, onToggle: ft, sm, lg, required: fr }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; expanded: boolean; onToggle: () => void; sm?: boolean; lg?: boolean; required?: boolean }) => (
    <div className={s.field}>
      <div className={s.fieldLabelRow}>
        <span className={s.lbl}>{fl}{fr && <span className={s.req}>*</span>}</span>
        <button type="button" onClick={ft} className={s.expLink}>{fe ? 'Less' : 'Expand'}</button>
      </div>
      <textarea value={fv} onChange={e => fo(e.target.value)} placeholder={fp} rows={fe ? 10 : (lg ? 6 : sm ? 3 : 4)} className={lg ? s.taLg : sm ? s.taSm : s.ta} required={fr} />
    </div>
  );


  // Extra search states for inline chip selectors
  const [sectorSearch, setSectorSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [lookingForSearch, setLookingForSearch] = useState('');
  const [customLookingFor, setCustomLookingFor] = useState<string[]>([]);
  const [customMarkets, setCustomMarkets] = useState<string[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState('');

  const filteredLF = useMemo(() => smartSort(allLookingForOptions.filter(o => selectedLookingFor.includes(o.id) || !lookingForSearch || o.name.toLowerCase().includes(lookingForSearch.toLowerCase())), o => o.id, selectedLookingFor, suggestedLookingFor), [allLookingForOptions, lookingForSearch, selectedLookingFor, suggestedLookingFor]);
  const filteredSec = useMemo(() => smartSort(allSectors.filter(o => selectedSectorIds.includes(o.id) || !sectorSearch || o.name.toLowerCase().includes(sectorSearch.toLowerCase())), o => o.id, selectedSectorIds, suggestedSectorIds), [allSectors, sectorSearch, selectedSectorIds, suggestedSectorIds]);
  const filteredSk = useMemo(() => smartSort(allSkills.filter(o => selectedSkills.some(sk => sk.skillId === o.id) || !skillSearch || o.name.toLowerCase().includes(skillSearch.toLowerCase())), o => o.id, selectedSkills.map(sk => sk.skillId), suggestedSkillIds), [allSkills, skillSearch, selectedSkills, suggestedSkillIds]);

  return (
    <form onSubmit={handleSubmit} className={`${s.formWrap} ${s.formStack}`}>

      {/* ════ Upload ═══════════════════════════════════════════════════ */}
      <DocumentUploadSection
        extractFn={extractFromDocument}
        onExtracted={handleDocumentExtracted}
        title="Upload Project Document"
        description="Upload a proposal or business plan. AI will extract details and suggest relevant options."
        accentColor="emerald"
      />

      {/* ════ Basic Information ═════════════════════════════════════════ */}
      <section className={s.card}>
        <div className={s.hdr}>
          <div className={s.hdrLeft}>
            <div className={s.ibE}><Lightbulb24Regular style={{width:20,height:20}} /></div>
            <div><h2 className={s.hTitle}>{t.projects?.basicInfo || 'Basic Information'}</h2><p className={s.hDesc}>Define the project clearly so AI and collaborators understand the opportunity quickly.</p></div>
          </div>
          <div className={s.meta}>Required</div>
        </div>
        <div className={s.fieldGrid}>
          <div className={s.field}>
            <span className={s.lbl}>{t.projects?.projectTitle || 'Project Title'}<span className={s.req}>*</span></span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t.projects?.titlePlaceholder || 'e.g. AI-Powered Health Monitoring App'} className={s.inp} required />
          </div>
          <Textarea label={t.projects?.summary || 'Summary'} value={summary} onChange={setSummary} placeholder={t.projects?.summaryPlaceholder || 'Describe the project idea in 2–3 clear sentences.'} expanded={summaryExpanded} onToggle={() => setSummaryExpanded(!summaryExpanded)} sm required />
          <Textarea label={t.projects?.detailedDescription || 'Detailed Description'} value={detailedDesc} onChange={setDetailedDesc} placeholder={t.projects?.detailedPlaceholder || 'Add more detail about your product, users, goals, business model, and requirements.'} expanded={detailsExpanded} onToggle={() => setDetailsExpanded(!detailsExpanded)} lg required />
        </div>
        {(title.trim() || summary.trim()) && (
          <>
            <div className={s.azBanner}>
              <div className={s.azCopy}><strong>{hasAnalyzed ? 'Re-analyze with AI' : 'Auto-fill with AI'}</strong><span>Analyze title and summary to suggest category, sectors, skills, needs, and matching preferences.</span></div>
              <button type="button" onClick={handleAIAnalyze} disabled={isAnalyzing} className={s.btnS}>
                {isAnalyzing ? <span style={{display:'flex',alignItems:'center',gap:8}}><ArrowSync24Regular style={{width:16,height:16,animation:'spin 1s linear infinite'}} /> Analyzing...</span> : (hasAnalyzed ? 'Re-analyze' : 'Auto-fill with AI')}
              </button>
            </div>
            {isAnalyzing && (
              <div style={{height:6,background:'rgba(255,255,255,0.06)',borderRadius:999,overflow:'hidden'}}>
                <div style={{height:'100%',background:'linear-gradient(90deg,#18d2a4,#1fc8c9)',borderRadius:999,transition:'width 0.5s',width:`${analysisProgress}%`}} />
              </div>
            )}
          </>
        )}
      </section>

      {/* ════ Stage & Category ══════════════════════════════════════════ */}
      <section className={s.card}>
        <div className={s.hdr}>
          <div className={s.hdrLeft}>
            <div className={s.ibB}><Rocket24Regular style={{width:20,height:20}} /></div>
            <div><h2 className={s.hTitle}>{t.projects?.stageCategory || 'Stage & Category'}</h2><p className={s.hDesc}>Set project maturity and themes so relevant matches are easier to find.</p></div>
          </div>
        </div>
        <div className={s.fieldGrid}>
          <div className={s.field}>
            <span className={s.lbl}>{t.projects?.stage || 'Project Stage'}</span>
            <div className={s.pillGrid}>
              {STAGE_OPTIONS.map(o => (
                <button key={o.id} type="button" onClick={() => setStage(o.id as ProjectStage)} className={stage === o.id ? s.pillSel : s.pill}>
                  {stage === o.id && '✓ '}{o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category — tag-select-box with autocomplete */}
          <div className={s.field}>
            <div className={s.fieldLabelRow}>
              <span className={s.lbl}>{t.projects?.category || 'Category'}<span className={s.req}>*</span></span>
              {categories.length > 0 && categories[0] !== 'other' && categories[0] !== 'Other' && <div className={s.count}>{categories.length} selected</div>}
            </div>
            <div className={s.ca}>
              {categories.length > 0 && categories[0] !== 'other' && categories[0] !== 'Other' && (
                <div className={s.cw}>
                  {categories.map(cat => (
                    <span key={cat} className={s.chipI}>{cat} <button type="button" onClick={() => setCategories(p => p.filter(c => c !== cat))} className={s.dismiss}>×</button></span>
                  ))}
                </div>
              )}
              <AutocompleteTagInput value={categorySearch} onChange={setCategorySearch} onAdd={v => { if (!categories.some(c => c.toLowerCase() === v.toLowerCase())) setCategories(p => [...p.filter(c => c !== 'other' && c !== 'Other'), v]); setCategorySearch(''); }} suggestions={CATEGORY_SUGGESTIONS} existingTags={categories} placeholder="Search or create category..." />
              <div className={s.ts}>
                {CATEGORY_SUGGESTIONS.filter(c => !categories.some(sel => sel.toLowerCase() === c.toLowerCase())).filter(c => !categorySearch || c.toLowerCase().includes(categorySearch.toLowerCase())).slice(0, 10).map(c => (
                  <button key={c} type="button" onClick={() => { setCategories(p => [...p.filter(x => x !== 'other' && x !== 'Other'), c]); setCategorySearch(''); }} className={s.tsg}>{c}</button>
                ))}
              </div>
            </div>
          </div>

          <Textarea label={t.projects?.timeline || 'Timeline & Milestones'} value={timeline} onChange={setTimeline} placeholder="e.g. Phase 1: MVP. Phase 2: Pilot. Phase 3: Launch." expanded={timelineExpanded} onToggle={() => setTimelineExpanded(!timelineExpanded)} sm />
        </div>
      </section>

      {/* ════ Looking For ═══════════════════════════════════════════════ */}
      <section className={s.card}>
        <div className={s.hdr}>
          <div className={s.hdrLeft}>
            <div className={s.ibB}><People24Regular style={{width:20,height:20}} /></div>
            <div><h2 className={s.hTitle}>{t.projects?.lookingFor || 'Looking For'}</h2><p className={s.hDesc}>Select or add the roles and partners you need.</p></div>
          </div>
          {(selectedLookingFor.length + customLookingFor.length) > 0 && <div className={s.count}>{selectedLookingFor.length + customLookingFor.length} selected</div>}
        </div>
        <div className={s.ca}>
          {(selectedLookingFor.length > 0 || customLookingFor.length > 0) && (
            <div className={s.cw}>
              {selectedLookingFor.map(id => {
                const opt = allLookingForOptions.find(o => o.id === id);
                return opt ? (
                  <span key={id} className={s.chipC}>
                    {suggestedLookingFor.includes(id) && <span className={s.star}>★</span>}
                    {opt.name} <button type="button" onClick={() => setSelectedLookingFor(p => p.filter(x => x !== id))} className={s.dismiss}>×</button>
                  </span>
                ) : null;
              })}
              {customLookingFor.map((v, i) => (
                <span key={`custom-${i}`} className={s.chipI}>{v} <button type="button" onClick={() => setCustomLookingFor(p => p.filter((_, j) => j !== i))} className={s.dismiss}>×</button></span>
              ))}
            </div>
          )}
          <AutocompleteTagInput value={lookingForSearch} onChange={setLookingForSearch} onAdd={v => { if (!customLookingFor.some(c => c.toLowerCase() === v.toLowerCase())) setCustomLookingFor(p => [...p, v]); setLookingForSearch(''); }} suggestions={LOOKING_FOR_SUGGESTIONS} existingTags={customLookingFor} placeholder="Search or add custom role..." />
          <div className={s.ts}>
            {allLookingForOptions.filter(o => !selectedLookingFor.includes(o.id)).filter(o => !lookingForSearch || o.name.toLowerCase().includes(lookingForSearch.toLowerCase())).map(o => (
              <button key={o.id} type="button" onClick={() => { toggleLookingFor(o.id); setLookingForSearch(''); }} className={s.tsg}>
                {suggestedLookingFor.includes(o.id) && <span className={s.star}>★</span>}
                {o.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ════ Project Needs ═════════════════════════════════════════════ */}
      <section className={s.card}>
        <div className={s.hdr}>
          <div className={s.hdrLeft}>
            <div className={s.ibC}><Tag24Regular style={{width:20,height:20}} /></div>
            <div><h2 className={s.hTitle}>{t.projects?.needs || 'Project Needs'}</h2><p className={s.hDesc}>Clarify what the project currently needs to succeed.</p></div>
          </div>
        </div>
        <div className={s.ca}>
          {needs.length > 0 && (
            <div className={s.cw}>
              {needs.map((n, i) => <span key={i} className={s.chipC}>{n} <button type="button" onClick={() => setNeeds(needs.filter((_, j) => j !== i))} className={s.dismiss}>×</button></span>)}
            </div>
          )}
          <AutocompleteTagInput value={needsInput} onChange={setNeedsInput} onAdd={v => { if (!needs.map(x => x.toLowerCase()).includes(v.toLowerCase())) setNeeds([...needs, v]); setNeedsInput(''); }} suggestions={NEEDS_SUGGESTIONS} existingTags={needs} placeholder="Add project need..." />
        </div>
      </section>

      {/* ════ Industry Sectors ══════════════════════════════════════════ */}
      <section className={s.card}>
        <div className={s.hdr}>
          <div className={s.hdrLeft}>
            <div className={s.ibC}><Tag24Regular style={{width:20,height:20}} /></div>
            <div><h2 className={s.hTitle}>{t.projects?.sectors || 'Industry Sectors'}</h2><p className={s.hDesc}>Choose the sectors most relevant to your project domain.</p></div>
          </div>
          {selectedSectorIds.length > 0 && <div className={s.count}>{allSectors.filter(o => selectedSectorIds.includes(o.id)).length} selected</div>}
        </div>
        <div className={s.fieldGrid}>
          <div className={s.srch}><span className={s.srchIco}>⌕</span><input type="text" value={sectorSearch} onChange={e => setSectorSearch(e.target.value)} placeholder="Search sectors..." className={s.inp} /></div>
          <div className={s.ca}>
            <div className={s.cw}>
              {filteredSec.slice(0, 30).map(o => (
                <button key={o.id} type="button" onClick={() => toggleSector(o.id)} className={selectedSectorIds.includes(o.id) ? s.chipC : s.chip}>
                  {suggestedSectorIds.includes(o.id) && <span className={s.star}>★</span>}
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════ Skills Needed ═════════════════════════════════════════════ */}
      <section className={s.card}>
        <div className={s.hdr}>
          <div className={s.hdrLeft}>
            <div className={s.ibC}><DocumentText24Regular style={{width:20,height:20}} /></div>
            <div><h2 className={s.hTitle}>{t.projects?.skillsNeeded || 'Skills Needed'}</h2><p className={s.hDesc}>Specify the capabilities the project needs now.</p></div>
          </div>
          {selectedSkills.length > 0 && <div className={s.count}>{allSkills.filter(o => selectedSkills.some(sk => sk.skillId === o.id)).length} selected</div>}
        </div>
        <div className={s.fieldGrid}>
          <div className={s.srch}><span className={s.srchIco}>⌕</span><input type="text" value={skillSearch} onChange={e => setSkillSearch(e.target.value)} placeholder="Search skills..." className={s.inp} /></div>
          <div className={s.ca}>
            <div className={s.cw}>
              {filteredSk.slice(0, 30).map(o => (
                <button key={o.id} type="button" onClick={() => toggleSkill(o.id)} className={selectedSkills.some(sk => sk.skillId === o.id) ? s.chipC : s.chip}>
                  {suggestedSkillIds.includes(o.id) && <span className={s.star}>★</span>}
                  {o.name}
                </button>
              ))}
            </div>
            <div className={s.te}>
              <input type="text" value={customSkillInput} onChange={e => setCustomSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customSkillInput.trim()) { e.preventDefault(); handleAddCustomSkill(customSkillInput.trim()); setCustomSkillInput(''); } }} placeholder="Add custom skill..." className={s.inp} />
              <button type="button" onClick={() => { if (customSkillInput.trim()) { handleAddCustomSkill(customSkillInput.trim()); setCustomSkillInput(''); } }} disabled={!customSkillInput.trim()} className={s.tp}>+</button>
            </div>
          </div>
        </div>
      </section>

      {/* ════ Target Markets ════════════════════════════════════════════ */}
      <section className={s.card}>
        <div className={s.hdr}>
          <div className={s.hdrLeft}>
            <div className={s.ibB}><Globe24Regular style={{width:20,height:20}} /></div>
            <div><h2 className={s.hTitle}>{t.projects?.markets || 'Target Markets'}</h2><p className={s.hDesc}>Select or add the regions you operate in or plan to target.</p></div>
          </div>
          {marketsSource === 'document' && <div className={s.meta} style={{background:'rgba(16,185,129,0.12)',borderColor:'rgba(16,185,129,0.25)',color:'#6ee7b7',fontSize:'0.78rem'}}>From Document</div>}
          {marketsSource === 'ai' && <div className={s.meta} style={{background:'rgba(109,140,255,0.12)',borderColor:'rgba(109,140,255,0.28)',color:'#c7d4ff',fontSize:'0.78rem'}}>AI Estimation</div>}
          {(MARKET_OPTIONS.filter(o => markets.includes(o.value)).length + customMarkets.length) > 0 && <div className={s.count}>{MARKET_OPTIONS.filter(o => markets.includes(o.value)).length + customMarkets.length} selected</div>}
        </div>
        <div className={s.ca}>
          {(markets.length > 0 || customMarkets.length > 0) && (
            <div className={s.cw}>
              {markets.map(v => { const opt = MARKET_OPTIONS.find(o => o.value === v); return opt ? <span key={v} className={s.chipC}>{opt.label} <button type="button" onClick={() => setMarkets(p => p.filter(x => x !== v))} className={s.dismiss}>×</button></span> : null; })}
              {customMarkets.map((v, i) => <span key={`cm-${i}`} className={s.chipI}>{v} <button type="button" onClick={() => setCustomMarkets(p => p.filter((_, j) => j !== i))} className={s.dismiss}>×</button></span>)}
            </div>
          )}
          <AutocompleteTagInput value={marketSearch} onChange={setMarketSearch} onAdd={v => { const mapped = mapMarketValue(v); if (mapped && !markets.includes(mapped)) { setMarkets(p => [...p, mapped]); } else if (!mapped && !customMarkets.some(c => c.toLowerCase() === v.toLowerCase())) { setCustomMarkets(p => [...p, v]); } setMarketSearch(''); }} suggestions={[...MARKET_OPTIONS.filter(o => !markets.includes(o.value)).map(o => o.label), ...MARKET_SUGGESTIONS]} existingTags={[...markets.map(v => MARKET_OPTIONS.find(o => o.value === v)?.label || v), ...customMarkets]} placeholder="Search or add market..." />
        </div>
        <div className={s.msr} style={{marginTop:12}}>
          {smartSort(MARKET_OPTIONS.filter(o => !marketSearch || o.label.toLowerCase().includes(marketSearch.toLowerCase())), o => o.value, markets, []).slice(0, 20).map(o => (
            <button key={o.value} type="button" onClick={() => { setMarkets(p => p.includes(o.value) ? p.filter(v => v !== o.value) : [...p, o.value]); setMarketsSource('manual'); }} className={markets.includes(o.value) ? s.pillBlu : s.pill}>
              {markets.includes(o.value) && '✓ '}{o.label}
            </button>
          ))}
        </div>
      </section>

      {/* ════ Funding Range ═════════════════════════════════════════════ */}
      <section className={s.card}>
        <div className={s.hdr}>
          <div className={s.hdrLeft}>
            <div className={s.ibE}><Lightbulb24Regular style={{width:20,height:20}} /></div>
            <div><h2 className={s.hTitle}>{t.projects?.fundingRange || 'Funding Range'}</h2><p className={s.hDesc}>Add a realistic budget range if funding is part of the criteria.</p></div>
          </div>
          {fundingSource === 'document' && <div className={s.meta} style={{background:'rgba(16,185,129,0.12)',borderColor:'rgba(16,185,129,0.25)',color:'#6ee7b7',fontSize:'0.78rem'}}>From Document</div>}
          {fundingSource === 'ai' && <div className={s.meta} style={{background:'rgba(109,140,255,0.12)',borderColor:'rgba(109,140,255,0.28)',color:'#c7d4ff',fontSize:'0.78rem'}}>AI Estimation</div>}
        </div>
        <div className={`${s.fieldGrid} ${s.twoCol}`}>
          <div className={s.field}>
            <span className={s.lbl}>{t.projects?.fundingAskMin || 'Minimum ($)'}</span>
            <input type="number" value={fundingAskMin} onChange={e => { setFundingAskMin(e.target.value); setFundingSource('manual'); }} placeholder="25000" className={s.inp} />
          </div>
          <div className={s.field}>
            <span className={s.lbl}>{t.projects?.fundingAskMax || 'Maximum ($)'}</span>
            <input type="number" value={fundingAskMax} onChange={e => { setFundingAskMax(e.target.value); setFundingSource('manual'); }} placeholder="150000" className={s.inp} />
          </div>
        </div>
      </section>

      {/* ════ Advanced / Matching Preferences ═══════════════════════════ */}
      <section className={s.advCard}>
        <div className={s.hdr} style={{padding:'18px 22px 0',marginBottom:0,cursor:'pointer'}} onClick={() => setAdvancedOpen(!advancedOpen)}>
          <div className={s.hdrLeft}>
            <div className={s.ibI}><Sparkle24Regular style={{width:20,height:20}} /></div>
            <div><h2 className={s.hTitle}>{t.projects?.advancedSection || 'Advanced / Matching Preferences'}</h2><p className={s.hDesc}>Optional settings for more precise matching.</p></div>
          </div>
          <div className={s.meta}>AI-assisted</div>
        </div>
        {(advancedOpen || tractionSignals.length > 0 || advisoryTopics.length > 0) && (
          <div style={{padding:22,display:'grid',gap:18}}>
            {/* Traction Signals */}
            <div className={s.field}>
              <span className={s.lbl}>Traction Signals</span>
              <div className={s.ca}>
                {tractionSignals.length > 0 && <div className={s.cw}>{tractionSignals.map((v, i) => <span key={i} className={s.chipI}>{v} <button type="button" onClick={() => setTractionSignals(tractionSignals.filter((_, j) => j !== i))} className={s.dismiss}>×</button></span>)}</div>}
                <AutocompleteTagInput value={tractionInput} onChange={setTractionInput} onAdd={v => { if (!tractionSignals.map(x => x.toLowerCase()).includes(v.toLowerCase())) setTractionSignals([...tractionSignals, v]); setTractionInput(''); }} suggestions={TRACTION_SUGGESTIONS} existingTags={tractionSignals} placeholder="Add traction signal..." />
              </div>
            </div>

            {/* Advisory Topics */}
            <div className={s.field}>
              <span className={s.lbl}>Advisory Topics</span>
              <div className={s.ca}>
                {advisoryTopics.length > 0 && <div className={s.cw}>{advisoryTopics.map((v, i) => <span key={i} className={s.chipI}>{v} <button type="button" onClick={() => setAdvisoryTopics(advisoryTopics.filter((_, j) => j !== i))} className={s.dismiss}>×</button></span>)}</div>}
                <AutocompleteTagInput value={advisoryInput} onChange={setAdvisoryInput} onAdd={v => { if (!advisoryTopics.map(x => x.toLowerCase()).includes(v.toLowerCase())) setAdvisoryTopics([...advisoryTopics, v]); setAdvisoryInput(''); }} suggestions={ADVISORY_SUGGESTIONS} existingTags={advisoryTopics} placeholder="Add advisory topic..." />
              </div>
            </div>

            {/* Ideal Counterpart */}
            <div className={s.field}>
              <span className={s.lbl}>Ideal Counterpart</span>
              <textarea value={idealCounterpartProfile} onChange={e => setIdealCounterpartProfile(e.target.value)} rows={3} placeholder="Describe the ideal partner, advisor, investor, or collaborator." className={s.taSm} />
            </div>

            {/* Matching Mode */}
            <div className={s.field}>
              <span className={s.lbl}>Matching Mode</span>
              <div className={s.segRow}>
                <button type="button" onClick={() => setStrictLookingFor(false)} className={!strictLookingFor ? s.segF : s.seg}>{t.projects?.flexibleMatching || 'Flexible'}</button>
                <button type="button" onClick={() => setStrictLookingFor(true)} className={strictLookingFor ? s.segS : s.seg}>{t.projects?.strictMatching || 'Strict'}</button>
              </div>
              <p className={s.note}>{t.projects?.strictLookingForDesc || 'Strict = only exact role matches. Flexible = broader matching.'}</p>
            </div>
          </div>
        )}
      </section>

      {/* ════ CTA ══════════════════════════════════════════════════════ */}
      <div className={s.cta}>
        <button type="submit" disabled={isSubmitting} className={s.btnP}>
          {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : isEditMode ? (t.projects?.saveChanges || 'Save Changes') : (t.projects?.createProject || 'Create Project')}
        </button>
        <button type="button" onClick={onCancel} className={s.btnO}>{t.common?.cancel || 'Cancel'}</button>
      </div>
    </form>
  );
}
