/**
 * ProjectForm - Unified form for creating and editing projects.
 *
 * Used by both /projects/new and /projects/[id]/edit pages.
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  ArrowUpload24Regular,
  Document24Regular,
  Dismiss24Regular,
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

/**
 * Expandable textarea field. Hoisted to module scope so its component
 * identity is stable across ProjectForm renders — declaring it inside the
 * parent caused React to unmount and remount the <textarea> on every
 * keystroke, blowing away focus after one character.
 */
function Textarea({
  label,
  value,
  onChange,
  placeholder,
  expanded,
  onToggle,
  sm,
  lg,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  expanded: boolean;
  onToggle: () => void;
  sm?: boolean;
  lg?: boolean;
  required?: boolean;
}) {
  return (
    <div className={s.field}>
      <div className={s.fieldLabelRow}>
        <span className={s.lbl}>{label}{required && <span className={s.req}>*</span>}</span>
        <button type="button" onClick={onToggle} className={s.expLink}>{expanded ? 'Less' : 'Expand'}</button>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={expanded ? 10 : (lg ? 6 : sm ? 3 : 4)}
        className={lg ? s.taLg : sm ? s.taSm : s.ta}
        required={required}
      />
    </div>
  );
}

export default function ProjectForm({ project, onSubmit, onCancel, isSubmitting }: ProjectFormProps) {
  const { t } = useI18n();
  const isEditMode = !!project;

  // Lookup data
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  // Custom entries
  const [customSkills, setCustomSkills] = useState<Skill[]>([]);
  const [customSectors, setCustomSectors] = useState<Sector[]>([]);

  // Document state
  const [documentUrl, setDocumentUrl] = useState<string | null>(project?.documentUrl || null);
  const [documentName, setDocumentName] = useState<string | null>(project?.documentName || null);

  // Show all toggles for chip lists
  const [showAllSectors, setShowAllSectors] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllLookingFor, setShowAllLookingFor] = useState(false);

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

  // Unified top AI section state (create mode)
  const [ideaText, setIdeaText] = useState('');
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoadingMsgIdx, setAiLoadingMsgIdx] = useState(0);
  const [highlightDetails, setHighlightDetails] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);
  const basicInfoRef = useRef<HTMLElement>(null);

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
    {
      // Split stored lookingFor into predefined IDs vs free-text customs,
      // and fold any legacy project.needs values into the custom set so they
      // surface in the unified Looking For chip grid.
      const stored = (project.lookingFor as string[] | undefined) || [];
      const knownIds = new Set<string>(LOOKING_FOR_OPTIONS.map(o => o.id));
      const predefined = stored.filter(v => knownIds.has(v));
      const customFromLookingFor = stored.filter(v => !knownIds.has(v));
      const customFromNeeds = (project.needs as string[] | undefined) || [];
      setSelectedLookingFor(predefined);
      setCustomLookingFor(Array.from(new Set([...customFromLookingFor, ...customFromNeeds])));
    }
    setSelectedSectorIds(project.sectors?.map(s => s.id) || []);
    setSelectedSkills(
      project.skillsNeeded?.map(s => ({
        skillId: s.id,
        importance: (s.importance || 'REQUIRED') as SkillImportance,
      })) || []
    );
    setVisibility(project.visibility || 'PUBLIC');
    setIsActive(project.isActive !== false);
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
    setDocumentUrl(project.documentUrl || null);
    setDocumentName(project.documentName || null);
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
  const allSectors = useMemo(() => [...sectors, ...customSectors], [sectors, customSectors]);
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
  const handleAddCustomCategory = useCallback((name: string) => {
    setCategories(prev => prev.includes(name) ? prev : [...prev.filter(x => x !== 'other' && x !== 'Other'), name]);
  }, []);
  const handleAddCustomLookingForValue = useCallback((name: string) => {
    setCustomLookingFor(prev => prev.includes(name) ? prev : [...prev, name]);
  }, []);
  const handleAddCustomSector = useCallback((name: string) => {
    const customId = `custom_${Date.now()}`;
    setCustomSectors(prev => [...prev, { id: customId, name }]);
    setSelectedSectorIds(prev => [...prev, customId]);
  }, []);
  const handleAddCustomMarket = useCallback((name: string) => {
    setCustomMarkets(prev => prev.includes(name) ? prev : [...prev, name]);
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
    if (extracted.needs?.length) setCustomLookingFor(prev => Array.from(new Set([...prev, ...extracted.needs!])));
    else if (extracted.whatYouNeed) setCustomLookingFor(prev => Array.from(new Set([...prev, extracted.whatYouNeed!]))); // backward compat
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

    // Store document URL if returned from extraction
    if (extracted.documentUrl) {
      setDocumentUrl(extracted.documentUrl);
      setDocumentName(extracted.documentName || 'Project Document');
    }

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
      if (result.needs?.length) setCustomLookingFor(prev => Array.from(new Set([...prev, ...result.needs!])));
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

  // Rotating loading messages for the unified Generate Project Details flow
  const AI_LOADING_MESSAGES = ['Analyzing your project...', 'Generating project structure...', 'Matching categories and skills...'];
  useEffect(() => {
    if (!isAnalyzing) { setAiLoadingMsgIdx(0); return; }
    const id = setInterval(() => setAiLoadingMsgIdx(i => (i + 1) % AI_LOADING_MESSAGES.length), 1600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyzing]);

  // Validate uploaded file for the unified AI section
  const AI_ALLOWED_MIME = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'text/plain',
  ];
  const AI_MAX_SIZE_MB = 10;
  const handleAiFileSelect = useCallback((f: File) => {
    setAiError(null);
    if (!AI_ALLOWED_MIME.includes(f.type) && !/\.(pdf|docx|doc|pptx|ppt|txt)$/i.test(f.name)) {
      setAiError('Please upload PDF, DOCX, PPTX, or TXT files.');
      return;
    }
    if (f.size > AI_MAX_SIZE_MB * 1024 * 1024) {
      setAiError(`File size must be less than ${AI_MAX_SIZE_MB}MB.`);
      return;
    }
    setAiFile(f);
  }, []);

  // Unified Generate Project Details handler — routes to extractFromDocument or analyzeProjectText
  const handleGenerateDetails = async () => {
    if (!aiFile && !ideaText.trim()) return;
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAiError(null);
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);
    try {
      if (aiFile) {
        const data = await extractFromDocument(aiFile);
        handleDocumentExtracted(data);
      } else {
        const idea = ideaText.trim();
        const result = await analyzeProjectText({ title: title.trim(), summary: idea });
        // Title/summary/desc/timeline/funding now come from AI; fall back to idea text
        if (result.title && !title.trim()) setTitle(result.title);
        if (result.summary) setSummary(result.summary);
        else if (!summary.trim()) setSummary(idea);
        if (result.detailedDesc) setDetailedDesc(result.detailedDesc);
        else if (!detailedDesc.trim()) setDetailedDesc(idea);
        if (result.timeline) setTimeline(result.timeline);
        if (result.fundingAskMin != null) { setFundingAskMin(String(result.fundingAskMin)); setFundingSource('ai'); }
        if (result.fundingAskMax != null) { setFundingAskMax(String(result.fundingAskMax)); setFundingSource('ai'); }
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
            return [...prev, ...result.skills.filter((s: any) => !existingIds.has(s.skillId))];
          });
          setSuggestedSkillIds(prev => [...new Set([...prev, ...result.skills.map((s: any) => s.skillId)])]);
        }
        if (result.needs?.length) setCustomLookingFor(prev => Array.from(new Set([...prev, ...result.needs!])));
        if (result.markets?.length) {
          const mapped = result.markets.map((m: string) => mapMarketValue(m)).filter(Boolean) as string[];
          if (mapped.length) { setMarkets(prev => [...new Set([...prev, ...mapped])]); setMarketsSource('ai'); }
        }
        if (result.idealCounterpartProfile) setIdealCounterpartProfile(result.idealCounterpartProfile);
        if (result.partnerTypeNeeded?.length) setPartnerTypeNeeded(result.partnerTypeNeeded);
        if (result.commitmentLevelNeeded) setCommitmentLevelNeeded(result.commitmentLevelNeeded);
        if (result.engagementModel?.length) setEngagementModel(result.engagementModel);
        if (result.targetCustomerTypes?.length) setTargetCustomerTypes(result.targetCustomerTypes);
        if (result.tractionSignals?.length) setTractionSignals(result.tractionSignals);
        if (result.advisoryTopics?.length) setAdvisoryTopics(result.advisoryTopics);
        if (result.tractionSignals?.length || result.advisoryTopics?.length || result.partnerTypeNeeded?.length) setAdvancedOpen(true);
      }
      setAnalysisProgress(100);
      setHasAnalyzed(true);
      toast({ title: 'AI Generation Complete', description: 'Project details have been generated. Review and edit below.', variant: 'success' });
      setHighlightDetails(true);
      setTimeout(() => setHighlightDetails(false), 2500);
      setTimeout(() => basicInfoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    } catch (err: any) {
      setAiError(err.message || 'AI generation failed');
      toast({ title: 'Error', description: err.message || 'AI generation failed', variant: 'error' });
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
        markets: [...markets, ...customMarkets],
        fundingAskMin: fundingAskMin ? Number(fundingAskMin) : undefined,
        fundingAskMax: fundingAskMax ? Number(fundingAskMax) : undefined,
        tractionSignals,
        advisoryTopics,
        partnerTypeNeeded,
        commitmentLevelNeeded: commitmentLevelNeeded || undefined,
        idealCounterpartProfile: idealCounterpartProfile.trim() || undefined,
        targetCustomerTypes,
        engagementModel,
        strictLookingFor,
        ...(documentUrl !== undefined && { documentUrl }),
        ...(documentName !== undefined && { documentName }),
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
        ...(documentUrl && { documentUrl }),
        ...(documentName && { documentName }),
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
    setCustomSectors([]);
    setHasAnalyzed(false);
    setIdeaText('');
    setAiFile(null);
    setAiError(null);
    setAiLoadingMsgIdx(0);
    setHighlightDetails(false);
  }, []);

  // Expose resetForm via a ref-like pattern (attach to component)
  // The parent can call this via key prop remounting instead
  (ProjectForm as any).__resetForm = resetForm;


  // Extra search states for inline chip selectors
  const [sectorSearch, setSectorSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [lookingForSearch, setLookingForSearch] = useState('');
  const [customLookingFor, setCustomLookingFor] = useState<string[]>([]);
  const [customMarkets, setCustomMarkets] = useState<string[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [customLookingForInput, setCustomLookingForInput] = useState('');
  const [customSectorInput, setCustomSectorInput] = useState('');
  const [customMarketInput, setCustomMarketInput] = useState('');

  const filteredLF = useMemo(() => smartSort(allLookingForOptions.filter(o => selectedLookingFor.includes(o.id) || !lookingForSearch || o.name.toLowerCase().includes(lookingForSearch.toLowerCase())), o => o.id, selectedLookingFor, suggestedLookingFor), [allLookingForOptions, lookingForSearch, selectedLookingFor, suggestedLookingFor]);
  const filteredSec = useMemo(() => smartSort(allSectors.filter(o => selectedSectorIds.includes(o.id) || !sectorSearch || o.name.toLowerCase().includes(sectorSearch.toLowerCase())), o => o.id, selectedSectorIds, suggestedSectorIds), [allSectors, sectorSearch, selectedSectorIds, suggestedSectorIds]);
  const filteredSk = useMemo(() => smartSort(allSkills.filter(o => selectedSkills.some(sk => sk.skillId === o.id) || !skillSearch || o.name.toLowerCase().includes(skillSearch.toLowerCase())), o => o.id, selectedSkills.map(sk => sk.skillId), suggestedSkillIds), [allSkills, skillSearch, selectedSkills, suggestedSkillIds]);

  return (
    <form onSubmit={handleSubmit} className={`${s.formWrap} ${s.formStack}`}>

      {/* ════ Upload / Start with AI ═══════════════════════════════════ */}
      {isEditMode ? (
        <DocumentUploadSection
          extractFn={extractFromDocument}
          onExtracted={handleDocumentExtracted}
          title="Upload Project Document"
          description="Upload a proposal or business plan. AI will extract details and suggest relevant options."
          accentColor="emerald"
          existingDocumentUrl={documentUrl}
          existingDocumentName={documentName}
          onDocumentRemoved={() => { setDocumentUrl(null); setDocumentName(null); }}
        />
      ) : (
        <section className={s.card}>
          <div className={s.hdr}>
            <div className={s.hdrLeft}>
              <div className={s.ibE}><Sparkle24Regular style={{width:20,height:20}} /></div>
              <div>
                <h2 className={s.hTitle}>Start Your Project with AI</h2>
                <p className={s.hDesc}>Upload a document or describe your idea to automatically generate project details.</p>
              </div>
            </div>
          </div>
          <div className={s.fieldGrid}>
            {/* Upload dropzone */}
            <div
              onClick={() => { if (!aiFile) aiFileRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleAiFileSelect(f); }}
              className="group border-2 border-dashed border-white/[0.18] hover:border-emerald-500/60 hover:bg-emerald-500/[0.06] rounded-[20px] min-h-[148px] flex flex-col items-center justify-center gap-2 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] text-center p-5 cursor-pointer transition-all"
              tabIndex={0}
              role="button"
              aria-label="Upload project document"
            >
              <input
                ref={aiFileRef}
                type="file"
                accept=".pdf,.docx,.doc,.pptx,.ppt,.txt"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAiFileSelect(f); }}
                className="hidden"
              />
              {aiFile ? (
                <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] w-full max-w-md">
                  <Document24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1 text-start">
                    <p className="text-sm font-semibold text-th-text truncate">{aiFile.name}</p>
                    <p className="text-xs text-th-text-m">{(aiFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setAiFile(null); if (aiFileRef.current) aiFileRef.current.value = ''; }}
                    className="p-1.5 rounded-lg text-th-text-m hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label="Remove file"
                  >
                    <Dismiss24Regular className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-11 h-11 rounded-[14px] bg-emerald-500/[0.12] border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
                    <ArrowUpload24Regular className="w-5 h-5" />
                  </div>
                  <strong className="text-[1rem] font-extrabold text-th-text">Drop your file here or click to upload</strong>
                  <span className="text-th-text-s text-[0.94rem] leading-relaxed max-w-[620px]">
                    Supports PDF, DOCX, PPTX, TXT — up to {AI_MAX_SIZE_MB}MB
                  </span>
                </>
              )}
            </div>
            {aiError && <p className="text-xs text-red-400 font-medium">{aiError}</p>}

            {/* OR divider */}
            <div className="flex items-center gap-3 my-1" aria-hidden="true">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs font-extrabold text-th-text-m tracking-[0.2em]">OR</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Describe Your Idea */}
            <div className={s.field}>
              <span className={s.lbl}>Describe Your Idea</span>
              <textarea
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 420) + 'px';
                }}
                placeholder="Describe your project, startup, business idea, goals, or problem you are solving..."
                className={s.ta}
              />
            </div>

            {/* Single shared AI button */}
            <button
              type="button"
              onClick={handleGenerateDetails}
              disabled={isAnalyzing || (!aiFile && !ideaText.trim())}
              className={s.btnP}
            >
              {isAnalyzing ? (
                <span style={{display:'flex',alignItems:'center',gap:10}}>
                  <ArrowSync24Regular style={{width:18,height:18,animation:'spin 1s linear infinite'}} />
                  {AI_LOADING_MESSAGES[aiLoadingMsgIdx]}
                </span>
              ) : (
                <span style={{display:'flex',alignItems:'center',gap:10}}>
                  <Sparkle24Regular style={{width:18,height:18}} />
                  Generate Project Details
                </span>
              )}
            </button>

            {isAnalyzing && (
              <div style={{height:6,background:'rgba(255,255,255,0.06)',borderRadius:999,overflow:'hidden'}}>
                <div style={{height:'100%',background:'linear-gradient(90deg,#18d2a4,#1fc8c9)',borderRadius:999,transition:'width 0.5s',width:`${analysisProgress}%`}} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ════ Basic Information ═════════════════════════════════════════ */}
      <section
        ref={basicInfoRef}
        className={s.card}
        style={{
          boxShadow: highlightDetails ? '0 0 0 3px rgba(24,210,164,0.55), 0 0 32px rgba(24,210,164,0.25)' : undefined,
          transition: 'box-shadow 0.6s ease',
        }}
      >
        <div className={s.hdr}>
          <div className={s.hdrLeft}>
            <div className={s.ibE}><Lightbulb24Regular style={{width:20,height:20}} /></div>
            <div><h2 className={s.hTitle}>{isEditMode ? (t.projects?.basicInfo || 'Basic Information') : 'Project Details'}</h2><p className={s.hDesc}>Define the project clearly so AI and collaborators understand the opportunity quickly.</p></div>
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
        {isEditMode && (title.trim() || summary.trim()) && (
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
            <div className={s.cw}>
              {STAGE_OPTIONS.map(o => (
                <button key={o.id} type="button" onClick={() => setStage(o.id as ProjectStage)} className={stage === o.id ? 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-[#3b82f633] text-[#93c5fd]' : 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category — search + toggle chip grid (mirrors Industry Sectors flow) */}
          <div className={s.field}>
            <div className={s.fieldLabelRow}>
              <span className={s.lbl}>{t.projects?.category || 'Category'}<span className={s.req}>*</span></span>
              {categories.filter(c => c !== 'other' && c !== 'Other').length > 0 && <div className={s.count}>{categories.filter(c => c !== 'other' && c !== 'Other').length} selected</div>}
            </div>
            <div className={s.srch}><span className={s.srchIco}>⌕</span><input type="text" value={categorySearch} onChange={e => setCategorySearch(e.target.value)} placeholder="Search categories..." className={s.inp} /></div>
            <div className={s.ca}>
              <div className={s.cw}>
                {(() => {
                  const allCategoryChips = smartSort(
                    Array.from(new Set([...CATEGORY_SUGGESTIONS, ...categories.filter(c => c !== 'other' && c !== 'Other')]))
                      .filter(c => !categorySearch || c.toLowerCase().includes(categorySearch.toLowerCase())),
                    c => c,
                    categories,
                    []
                  );
                  const visibleCategoryChips = categorySearch ? allCategoryChips : allCategoryChips.slice(0, showAllCategories ? allCategoryChips.length : 5);
                  return (
                    <>
                      {visibleCategoryChips.map(c => {
                        const isSelected = categories.includes(c);
                        return (
                          <div key={c} className="relative">
                            <button
                              type="button"
                              onClick={() => setCategories(p => p.includes(c) ? p.filter(x => x !== c) : [...p.filter(x => x !== 'other' && x !== 'Other'), c])}
                              className={isSelected ? 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-[#3b82f633] text-[#93c5fd] pe-6' : 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'}
                            >
                              {c}
                            </button>
                            {isSelected && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setCategories(p => p.filter(x => x !== c)); }}
                                className="absolute top-1/2 -translate-y-1/2 end-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all"
                                aria-label={`Remove ${c}`}
                              >
                                <Dismiss16Regular className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {!categorySearch && allCategoryChips.length > 5 && (
                        <button type="button" onClick={() => setShowAllCategories(p => !p)} className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h">
                          {showAllCategories ? 'Show less' : `+${allCategoryChips.length - 5} more`}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className={s.te}>
                <input type="text" value={customCategoryInput} onChange={e => setCustomCategoryInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customCategoryInput.trim()) { e.preventDefault(); handleAddCustomCategory(customCategoryInput.trim()); setCustomCategoryInput(''); } }} placeholder="Add custom category..." className={s.inp} />
                <button type="button" onClick={() => { if (customCategoryInput.trim()) { handleAddCustomCategory(customCategoryInput.trim()); setCustomCategoryInput(''); } }} disabled={!customCategoryInput.trim()} className={s.tp}>+</button>
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
        <div className={s.fieldGrid}>
          <div className={s.srch}><span className={s.srchIco}>⌕</span><input type="text" value={lookingForSearch} onChange={e => setLookingForSearch(e.target.value)} placeholder="Search roles..." className={s.inp} /></div>
          <div className={s.ca}>
            <div className={s.cw}>
              {(() => {
                const predefinedLFSorted = smartSort(
                  allLookingForOptions.filter(o => !lookingForSearch || o.name.toLowerCase().includes(lookingForSearch.toLowerCase())),
                  o => o.id,
                  selectedLookingFor,
                  suggestedLookingFor
                );
                const selectedPredefLF = predefinedLFSorted.filter(o => selectedLookingFor.includes(o.id));
                const restPredefLF = predefinedLFSorted.filter(o => !selectedLookingFor.includes(o.id));
                const customLF = customLookingFor.filter(v => !lookingForSearch || v.toLowerCase().includes(lookingForSearch.toLowerCase()));
                type LFEntry = { kind: 'predef'; o: { id: string; name: string } } | { kind: 'custom'; v: string };
                const ordered: LFEntry[] = [
                  ...selectedPredefLF.map(o => ({ kind: 'predef' as const, o })),
                  ...customLF.map(v => ({ kind: 'custom' as const, v })),
                  ...restPredefLF.map(o => ({ kind: 'predef' as const, o })),
                ];
                const limit = 5;
                const expanded = !!lookingForSearch || showAllLookingFor;
                const visible = expanded ? ordered : ordered.slice(0, limit);
                return (
                  <>
                    {visible.map((entry, i) => {
                      if (entry.kind === 'predef') {
                        const o = entry.o;
                        const isSelected = selectedLookingFor.includes(o.id);
                        return (
                          <div key={o.id} className="relative">
                            <button type="button" onClick={() => toggleLookingFor(o.id)} className={isSelected ? 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-[#3b82f633] text-[#93c5fd] pe-6' : 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'}>
                              {suggestedLookingFor.includes(o.id) && <span className={s.star}>★</span>}
                              {o.name}
                            </button>
                            {isSelected && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); toggleLookingFor(o.id); }} className="absolute top-1/2 -translate-y-1/2 end-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all" aria-label={`Remove ${o.name}`}>
                                <Dismiss16Regular className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      }
                      const v = entry.v;
                      return (
                        <div key={`custom-${i}-${v}`} className="relative">
                          <span className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-[#3b82f633] text-[#93c5fd] pe-6 inline-flex items-center">{v}</span>
                          <button type="button" onClick={() => setCustomLookingFor(p => p.filter(x => x !== v))} className="absolute top-1/2 -translate-y-1/2 end-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all" aria-label={`Remove ${v}`}>
                            <Dismiss16Regular className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                    {!lookingForSearch && ordered.length > limit && (
                      <button type="button" onClick={() => setShowAllLookingFor(p => !p)} className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h">
                        {showAllLookingFor ? 'Show less' : `+${ordered.length - limit} more`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
            <div className={s.te}>
              <input type="text" value={customLookingForInput} onChange={e => setCustomLookingForInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customLookingForInput.trim()) { e.preventDefault(); handleAddCustomLookingForValue(customLookingForInput.trim()); setCustomLookingForInput(''); } }} placeholder="Add custom role..." className={s.inp} />
              <button type="button" onClick={() => { if (customLookingForInput.trim()) { handleAddCustomLookingForValue(customLookingForInput.trim()); setCustomLookingForInput(''); } }} disabled={!customLookingForInput.trim()} className={s.tp}>+</button>
            </div>
          </div>
        </div>
      </section>

      {/* Project Needs section removed; its options are now part of LOOKING_FOR_OPTIONS
          and any legacy project.needs values are folded into customLookingFor on load
          so they surface in the Looking For chip grid. */}

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
              {(sectorSearch ? filteredSec : filteredSec.slice(0, showAllSectors ? filteredSec.length : 5)).map(o => {
                const isSelected = selectedSectorIds.includes(o.id);
                return (
                  <div key={o.id} className="relative">
                    <button type="button" onClick={() => toggleSector(o.id)} className={isSelected ? 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-[#3b82f633] text-[#93c5fd] pe-6' : 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'}>
                      {suggestedSectorIds.includes(o.id) && <span className={s.star}>★</span>}
                      {o.name}
                    </button>
                    {isSelected && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleSector(o.id); }} className="absolute top-1/2 -translate-y-1/2 end-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all" aria-label={`Remove ${o.name}`}>
                        <Dismiss16Regular className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {!sectorSearch && filteredSec.length > 5 && (
                <button type="button" onClick={() => setShowAllSectors(p => !p)} className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h">
                  {showAllSectors ? 'Show less' : `+${filteredSec.length - 5} more`}
                </button>
              )}
            </div>
            <div className={s.te}>
              <input type="text" value={customSectorInput} onChange={e => setCustomSectorInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customSectorInput.trim()) { e.preventDefault(); handleAddCustomSector(customSectorInput.trim()); setCustomSectorInput(''); } }} placeholder="Add custom sector..." className={s.inp} />
              <button type="button" onClick={() => { if (customSectorInput.trim()) { handleAddCustomSector(customSectorInput.trim()); setCustomSectorInput(''); } }} disabled={!customSectorInput.trim()} className={s.tp}>+</button>
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
              {(skillSearch ? filteredSk : filteredSk.slice(0, showAllSkills ? filteredSk.length : 5)).map(o => {
                const isSelected = selectedSkills.some(sk => sk.skillId === o.id);
                return (
                  <div key={o.id} className="relative">
                    <button type="button" onClick={() => toggleSkill(o.id)} className={isSelected ? 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-[#3b82f633] text-[#93c5fd] pe-6' : 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'}>
                      {suggestedSkillIds.includes(o.id) && <span className={s.star}>★</span>}
                      {o.name}
                    </button>
                    {isSelected && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleSkill(o.id); }} className="absolute top-1/2 -translate-y-1/2 end-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all" aria-label={`Remove ${o.name}`}>
                        <Dismiss16Regular className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {!skillSearch && filteredSk.length > 5 && (
                <button type="button" onClick={() => setShowAllSkills(p => !p)} className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h">
                  {showAllSkills ? 'Show less' : `+${filteredSk.length - 5} more`}
                </button>
              )}
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
        <div className={s.fieldGrid}>
          <div className={s.srch}><span className={s.srchIco}>⌕</span><input type="text" value={marketSearch} onChange={e => setMarketSearch(e.target.value)} placeholder="Search markets..." className={s.inp} /></div>
          <div className={s.ca}>
            <div className={s.cw}>
              {(() => {
                const sortedMarkets = smartSort(MARKET_OPTIONS.filter(o => !marketSearch || o.label.toLowerCase().includes(marketSearch.toLowerCase())), o => o.value, markets, []);
                const visibleMarkets = marketSearch ? sortedMarkets : sortedMarkets.slice(0, showAllMarkets ? sortedMarkets.length : 5);
                return (
                  <>
                    {visibleMarkets.map(o => {
                      const isSelected = markets.includes(o.value);
                      return (
                        <div key={o.value} className="relative">
                          <button type="button" onClick={() => { setMarkets(p => p.includes(o.value) ? p.filter(v => v !== o.value) : [...p, o.value]); setMarketsSource('manual'); }} className={isSelected ? 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-[#3b82f633] text-[#93c5fd] pe-6' : 'px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'}>
                            {o.label}
                          </button>
                          {isSelected && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setMarkets(p => p.filter(v => v !== o.value)); }} className="absolute top-1/2 -translate-y-1/2 end-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all" aria-label={`Remove ${o.label}`}>
                              <Dismiss16Regular className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {customMarkets.filter(v => !marketSearch || v.toLowerCase().includes(marketSearch.toLowerCase())).map((v, i) => (
                      <div key={`cm-${i}`} className="relative">
                        <span className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-[#3b82f633] text-[#93c5fd] pe-6 inline-flex items-center">{v}</span>
                        <button type="button" onClick={() => setCustomMarkets(p => p.filter(x => x !== v))} className="absolute top-1/2 -translate-y-1/2 end-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all" aria-label={`Remove ${v}`}>
                          <Dismiss16Regular className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    {!marketSearch && sortedMarkets.length > 5 && (
                      <button type="button" onClick={() => setShowAllMarkets(p => !p)} className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h" style={{borderStyle:'dashed', opacity: 0.8}}>
                        {showAllMarkets ? 'Show less' : `+${sortedMarkets.length - 5} more`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
            <div className={s.te}>
              <input type="text" value={customMarketInput} onChange={e => setCustomMarketInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customMarketInput.trim()) { e.preventDefault(); handleAddCustomMarket(customMarketInput.trim()); setCustomMarketInput(''); setMarketsSource('manual'); } }} placeholder="Add custom market..." className={s.inp} />
              <button type="button" onClick={() => { if (customMarketInput.trim()) { handleAddCustomMarket(customMarketInput.trim()); setCustomMarketInput(''); setMarketsSource('manual'); } }} disabled={!customMarketInput.trim()} className={s.tp}>+</button>
            </div>
          </div>
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

      {/* Advanced / Matching Preferences section removed; underlying state
          (tractionSignals, advisoryTopics, idealCounterpartProfile,
          strictLookingFor, advancedOpen) is intentionally preserved so AI
          auto-fill and save payloads continue to work without UI editing. */}

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
