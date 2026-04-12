/**
 * PitchForm - Unified form for creating and editing pitches.
 *
 * Used by both /pitch/new and /pitch/[id]/edit pages.
 * Supports 19+ fields including metadata fields (businessModel,
 * targetCustomerType, operatingMarkets, tractionSummary, founderBackgroundSummary,
 * matchIntent, supportNeededTags, fundingAmountRequested, fundingCurrency).
 *
 * Features safe merge behavior: AI suggestions never overwrite user-entered values.
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
  Add24Regular,
  Star24Filled,
  FullScreenMaximize24Regular,
  Building24Regular,
  Money24Regular,
  Globe24Regular,
  Dismiss16Regular,
  Save24Regular,
  Target24Regular,
  Sparkle24Regular,
} from '@fluentui/react-icons';
import {
  extractPitchFromDocument,
  analyzePitchText,
  STAGE_OPTIONS,
  LOOKING_FOR_OPTIONS,
  MATCH_INTENT_OPTIONS,
  SUPPORT_NEEDED_OPTIONS,
  CURRENCY_OPTIONS,
  PitchStage,
  PitchVisibility,
  SkillImportance,
  CreatePitchInput,
  UpdatePitchInput,
  ExtractedPitchData,
  Pitch,
} from '@/lib/api/pitch';
import { toast } from '@/components/ui/Toast';
import p from './PitchForm.module.css';
import { Select } from '@/components/ui/Select';
import { FormSection } from '@/components/ui/FormSection';
import { DocumentUploadSection } from '@/components/ui/DocumentUploadSection';
import { SearchableChipSelector } from '@/components/ui/SearchableChipSelector';
import { MultiPillSelector } from '@/components/ui/MultiPillSelector';
import { AutocompleteTagInput } from '@/components/ui/AutocompleteTagInput';

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_MODEL_OPTIONS = [
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C', label: 'B2C' },
  { value: 'B2B2C', label: 'B2B2C' },
  { value: 'Marketplace', label: 'Marketplace' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'Subscription', label: 'Subscription' },
  { value: 'Freemium', label: 'Freemium' },
  { value: 'Pay-per-use', label: 'Pay-per-use' },
  { value: 'Licensing', label: 'Licensing' },
  { value: 'Other', label: 'Other' },
];

const TARGET_CUSTOMER_OPTIONS = [
  { value: 'Enterprise', label: 'Enterprise' },
  { value: 'SMB', label: 'SMB' },
  { value: 'Startup', label: 'Startup' },
  { value: 'Consumer', label: 'Consumer' },
  { value: 'Government', label: 'Government' },
  { value: 'Non-profit', label: 'Non-profit' },
];

const VISIBILITY_OPTIONS: Array<{ value: PitchVisibility; label: string }> = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'CONNECTIONS_ONLY', label: 'Connections Only' },
  { value: 'PRIVATE', label: 'Private' },
];

const CATEGORY_SUGGESTIONS = ['HealthTech','FinTech','EdTech','SaaS','E-Commerce','AI/ML','CleanTech','PropTech','AgriTech','FoodTech','LegalTech','HR Tech','Marketing','InsurTech','Logistics','Gaming','Social','Media & Entertainment','Cybersecurity','IoT','Blockchain'];

const MARKET_OPTIONS = [
  { value: 'mena', label: 'MENA' }, { value: 'gcc', label: 'GCC' }, { value: 'north_america', label: 'North America' },
  { value: 'europe', label: 'Europe' }, { value: 'asia_pacific', label: 'Asia Pacific' }, { value: 'latin_america', label: 'Latin America' },
  { value: 'africa', label: 'Africa' }, { value: 'saudi_arabia', label: 'Saudi Arabia' }, { value: 'uae', label: 'UAE' },
  { value: 'usa', label: 'USA' }, { value: 'uk', label: 'UK' }, { value: 'india', label: 'India' },
  { value: 'china', label: 'China' }, { value: 'egypt', label: 'Egypt' }, { value: 'jordan', label: 'Jordan' },
  { value: 'bahrain', label: 'Bahrain' }, { value: 'kuwait', label: 'Kuwait' }, { value: 'qatar', label: 'Qatar' },
  { value: 'oman', label: 'Oman' }, { value: 'turkey', label: 'Turkey' }, { value: 'germany', label: 'Germany' },
  { value: 'france', label: 'France' }, { value: 'canada', label: 'Canada' }, { value: 'australia', label: 'Australia' },
  { value: 'singapore', label: 'Singapore' }, { value: 'japan', label: 'Japan' }, { value: 'south_korea', label: 'South Korea' },
  { value: 'brazil', label: 'Brazil' }, { value: 'nigeria', label: 'Nigeria' }, { value: 'south_africa', label: 'South Africa' },
  { value: 'global', label: 'Global' },
];

const MARKET_ALIASES: Record<string, string> = {
  'middle east': 'mena', 'mideast': 'mena', 'me': 'mena', 'us': 'usa', 'united states': 'usa',
  'america': 'north_america', 'worldwide': 'global', 'international': 'global', 'uk': 'uk',
  'united kingdom': 'uk', 'ksa': 'saudi_arabia', 'saudi': 'saudi_arabia', 'emirates': 'uae',
  'apac': 'asia_pacific', 'asia': 'asia_pacific', 'eu': 'europe', 'latam': 'latin_america',
};

function mapMarketValue(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (MARKET_ALIASES[lower]) return MARKET_ALIASES[lower];
  const match = MARKET_OPTIONS.find(o => o.label.toLowerCase() === lower || o.value === lower);
  return match ? match.value : raw.trim();
}

const TRACTION_SUGGESTIONS = ['Users','Revenue','Pilots','Partnerships','Letters of Intent','Waitlist','Beta Users','MRR','Growth Rate','Paying Customers'];
const ADVISORY_SUGGESTIONS = ['Fundraising','Product Strategy','Go-to-Market','Legal/IP','Tech Architecture','Hiring','International Expansion','Board Governance','Financial Planning','Market Research'];

function smartSort<T>(items: T[], getId: (item: T) => string, selectedIds: string[], suggestedIds: string[]): T[] {
  return [...items].sort((a, b) => {
    const aId = getId(a), bId = getId(b);
    const aSelected = selectedIds.includes(aId), bSelected = selectedIds.includes(bId);
    const aSuggested = suggestedIds.includes(aId), bSuggested = suggestedIds.includes(bId);
    if (aSelected !== bSelected) return aSelected ? -1 : 1;
    if (aSuggested !== bSuggested) return aSuggested ? -1 : 1;
    return 0;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sector {
  id: string;
  name: string;
}

interface Skill {
  id: string;
  name: string;
}

export interface PitchFormProps {
  pitch?: Pitch;
  onSubmit: (data: CreatePitchInput | UpdatePitchInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

// ─── AI Suggestion Banner ─────────────────────────────────────────────────────

function AISuggestionBanner({
  suggestion,
  onAccept,
  onDismiss,
}: {
  suggestion: any;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  if (suggestion == null || suggestion === '') return null;
  const display = typeof suggestion === 'string'
    ? suggestion.substring(0, 100) + (suggestion.length > 100 ? '...' : '')
    : Array.isArray(suggestion) ? suggestion.join(', ') : String(suggestion);
  return (
    <div className="mt-1.5 flex items-start gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs">
      <Star24Filled className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
      <span className="text-emerald-300 flex-1 min-w-0 break-words">AI suggests: {display}</span>
      <button type="button" onClick={onAccept} className="text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap">Accept</button>
      <button type="button" onClick={onDismiss} className="text-th-text-m hover:text-th-text-t whitespace-nowrap">Dismiss</button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PitchForm({ pitch, onSubmit, onCancel, isSubmitting }: PitchFormProps) {
  const { t } = useI18n();
  const isEditMode = !!pitch;

  // Lookup data
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  // AI-suggested items (for SearchableChipSelector yellow stars)
  const [suggestedSectorIds, setSuggestedSectorIds] = useState<string[]>([]);
  const [suggestedSkillIds, setSuggestedSkillIds] = useState<string[]>([]);
  const [suggestedLookingFor, setSuggestedLookingFor] = useState<string[]>([]);

  // Custom entries
  const [customSectors, setCustomSectors] = useState<Sector[]>([]);
  const [customSkills, setCustomSkills] = useState<Skill[]>([]);
  const [customLookingFor, setCustomLookingFor] = useState<Array<{ id: string; label: string }>>([]);

  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Expand states
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [problemExpanded, setProblemExpanded] = useState(false);
  const [solutionExpanded, setSolutionExpanded] = useState(false);
  const [whatYouNeedExpanded, setWhatYouNeedExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [tractionExpanded, setTractionExpanded] = useState(false);
  const [founderExpanded, setFounderExpanded] = useState(false);

  // ─── Safe Merge State ─────────────────────────────────────────────────────

  const [userTouchedFields, setUserTouchedFields] = useState<Set<string>>(new Set());
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, any>>({});

  // ─── Metadata Tracking State ──────────────────────────────────────────────

  const [fieldSource, setFieldSource] = useState<Record<string, 'USER' | 'AI' | 'SYSTEM'>>({});
  const [fieldConfidence, setFieldConfidence] = useState<Record<string, number>>({});
  const [userConfirmedAIFields, setUserConfirmedAIFields] = useState<string[]>([]);
  const [lastAIExtractionAt, setLastAIExtractionAt] = useState<string | null>(null);
  const [lastHumanEditAt, setLastHumanEditAt] = useState<string | null>(null);

  // ─── Form state ───────────────────────────────────────────────────────────

  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [summary, setSummary] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [detailedDesc, setDetailedDesc] = useState('');
  const [whatYouNeed, setWhatYouNeed] = useState('');
  const [category, setCategory] = useState('other');
  const [categories, setCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [stage, setStage] = useState<PitchStage>('IDEA');
  const [investmentRange, setInvestmentRange] = useState('');
  const [timeline, setTimeline] = useState('');
  const [selectedLookingFor, setSelectedLookingFor] = useState<string[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Array<{ skillId: string; importance: SkillImportance }>>([]);
  const [visibility, setVisibility] = useState<PitchVisibility>('PRIVATE');
  const [isActive, setIsActive] = useState(true);

  // Metadata fields
  const [businessModel, setBusinessModel] = useState<string[]>([]);
  const [targetCustomerType, setTargetCustomerType] = useState<string[]>([]);
  const [operatingMarkets, setOperatingMarkets] = useState<string[]>([]);
  const [newMarket, setNewMarket] = useState('');
  const [marketsSource, setMarketsSource] = useState<'manual' | 'document' | 'ai'>('manual');
  const [fundingSource, setFundingSource] = useState<'manual' | 'document' | 'ai'>('manual');
  const [tractionSummary, setTractionSummary] = useState('');
  const [tractionSignals, setTractionSignals] = useState<string[]>([]);
  const [tractionInput, setTractionInput] = useState('');
  const [advisoryTopics, setAdvisoryTopics] = useState<string[]>([]);
  const [advisoryInput, setAdvisoryInput] = useState('');
  const [idealCounterpartProfile, setIdealCounterpartProfile] = useState('');
  const [strictLookingFor, setStrictLookingFor] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [founderBackgroundSummary, setFounderBackgroundSummary] = useState('');

  // NEW: 4 new fields
  const [matchIntent, setMatchIntent] = useState<string[]>([]);
  const [supportNeededTags, setSupportNeededTags] = useState<string[]>([]);
  const [fundingAmountRequested, setFundingAmountRequested] = useState<string>('');
  const [fundingCurrency, setFundingCurrency] = useState<string>('USD');

  // Conditional display: show funding fields when investor intent or investmentRange has content
  const showFundingFields = matchIntent.includes('INVESTOR') || investmentRange.trim().length > 0;

  // ─── Safe Merge Helpers ───────────────────────────────────────────────────

  const handleInputEdit = useCallback((fieldName: string, setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setUserTouchedFields(prev => new Set(prev).add(fieldName));
      setFieldSource(prev => ({ ...prev, [fieldName]: 'USER' }));
      setLastHumanEditAt(new Date().toISOString());
      setter(e.target.value);
    }, []);

  const markUserTouched = useCallback((fieldName: string) => {
    setUserTouchedFields(prev => new Set(prev).add(fieldName));
    setFieldSource(prev => ({ ...prev, [fieldName]: 'USER' }));
    setLastHumanEditAt(new Date().toISOString());
  }, []);

  const safeMergeText = useCallback((field: string, aiVal: string, current: string, setter: (v: string) => void) => {
    if (!aiVal) return;
    if (!current.trim() || !userTouchedFields.has(field)) {
      setter(aiVal);
      setFieldSource(prev => ({ ...prev, [field]: 'AI' }));
    } else {
      setAiSuggestions(prev => ({ ...prev, [field]: aiVal }));
    }
  }, [userTouchedFields]);

  const safeMergeMulti = useCallback((field: string, aiVals: string[], current: string[], setter: (v: string[]) => void) => {
    if (!aiVals?.length) return;
    const merged = [...new Set([...current, ...aiVals])];
    setter(merged);
  }, []);

  const safeMergeEnum = useCallback((field: string, aiVal: string, currentTouched: boolean, setter: (v: any) => void) => {
    if (!aiVal) return;
    if (!currentTouched) {
      setter(aiVal);
      setFieldSource(prev => ({ ...prev, [field]: 'AI' }));
    } else {
      setAiSuggestions(prev => ({ ...prev, [field]: aiVal }));
    }
  }, []);

  const acceptSuggestion = useCallback((field: string, setter: (v: any) => void) => {
    const val = aiSuggestions[field];
    if (val == null) return;
    setter(val);
    setFieldSource(prev => ({ ...prev, [field]: 'AI' }));
    setUserConfirmedAIFields(prev => [...new Set([...prev, field])]);
    setAiSuggestions(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, [aiSuggestions]);

  const dismissSuggestion = useCallback((field: string) => {
    setAiSuggestions(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  // ─── Fetch lookups ────────────────────────────────────────────────────────

  const fetchLookups = useCallback(async () => {
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
  }, []);

  useEffect(() => { fetchLookups(); }, [fetchLookups]);

  // ─── Pre-fill from pitch (edit mode) ─────────────────────────────────────

  useEffect(() => {
    if (!pitch) return;

    setTitle(pitch.title || '');
    setCompanyName(pitch.companyName || '');
    setSummary(pitch.summary || '');
    setProblemStatement(pitch.problemStatement || '');
    setDetailedDesc(pitch.detailedDesc || '');
    setWhatYouNeed(pitch.whatYouNeed || '');
    setCategory(pitch.category || 'other');
    if (pitch.category && pitch.category !== 'other') setCategories([pitch.category]);
    setStage((pitch.stage as PitchStage) || 'IDEA');
    setInvestmentRange(pitch.investmentRange || '');
    setTimeline(pitch.timeline || '');
    setSelectedLookingFor(pitch.lookingFor || []);
    setSelectedSectorIds(pitch.sectors?.map(s => s.id) || []);
    setSelectedSkills(
      pitch.skillsNeeded?.map(s => ({
        skillId: s.id,
        importance: (s.importance || 'REQUIRED') as SkillImportance,
      })) || []
    );
    setVisibility((pitch.visibility as PitchVisibility) || 'PUBLIC');
    setIsActive(pitch.isActive !== false);

    // Metadata fields
    const meta = pitch.metadata || {};
    setBusinessModel(meta.businessModel || []);
    setTargetCustomerType(meta.targetCustomerType || []);
    setOperatingMarkets(meta.operatingMarkets || []);
    setTractionSummary(meta.tractionSummary || '');
    setFounderBackgroundSummary(meta.founderBackgroundSummary || '');

    // New fields
    setMatchIntent(meta.matchIntent || []);
    setSupportNeededTags(meta.supportNeededTags || []);
    setFundingAmountRequested(meta.fundingAmountRequested ? String(meta.fundingAmountRequested) : '');
    setFundingCurrency(meta.fundingCurrency || 'USD');
    setTractionSignals(meta.tractionSignals || []);
    setAdvisoryTopics(meta.advisoryTopics || []);
    setIdealCounterpartProfile(meta.idealCounterpartProfile || '');
    setStrictLookingFor(meta.strictLookingFor || false);

    // Restore tracking metadata
    const tracking = meta._tracking || {};
    if (tracking.fieldSource) setFieldSource(tracking.fieldSource);
    if (tracking.fieldConfidence) setFieldConfidence(tracking.fieldConfidence);
    if (tracking.userConfirmedAIFields) setUserConfirmedAIFields(tracking.userConfirmedAIFields);
    if (tracking.lastAIExtractionAt) setLastAIExtractionAt(tracking.lastAIExtractionAt);
    if (tracking.lastHumanEditAt) setLastHumanEditAt(tracking.lastHumanEditAt);
  }, [pitch]);

  // ─── Sorted items ────────────────────────────────────────────────────────

  const allSectors = useMemo(() => [...sectors, ...customSectors], [sectors, customSectors]);
  const allSkills = useMemo(() => [...skills, ...customSkills], [skills, customSkills]);

  const lookingForItems = useMemo(() => {
    const base = LOOKING_FOR_OPTIONS.map(o => ({ id: o.id, name: o.label }));
    const custom = customLookingFor.map(o => ({ id: o.id, name: o.label }));
    return [...base, ...custom];
  }, [customLookingFor]);

  // ─── Toggle handlers ─────────────────────────────────────────────────────

  const toggleLookingFor = (id: string) => {
    markUserTouched('lookingFor');
    setSelectedLookingFor(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSector = (id: string) => {
    markUserTouched('sectors');
    setSelectedSectorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSkill = (id: string) => {
    markUserTouched('skills');
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.skillId === id);
      if (exists) return prev.filter(s => s.skillId !== id);
      return [...prev, { skillId: id, importance: 'REQUIRED' as SkillImportance }];
    });
  };

  // ─── Custom entry handlers ───────────────────────────────────────────────

  const handleAddCustomSector = (name: string) => {
    const customId = `custom_${Date.now()}`;
    setCustomSectors(prev => [...prev, { id: customId, name }]);
    setSelectedSectorIds(prev => [...prev, customId]);
  };

  const handleAddCustomSkill = (name: string) => {
    const customId = `custom_${Date.now()}`;
    setCustomSkills(prev => [...prev, { id: customId, name }]);
    setSelectedSkills(prev => [...prev, { skillId: customId, importance: 'REQUIRED' as SkillImportance }]);
  };

  const handleAddCustomLookingFor = (name: string) => {
    const customId = `custom_${Date.now()}`;
    setCustomLookingFor(prev => [...prev, { id: customId, label: name }]);
    setSelectedLookingFor(prev => [...prev, customId]);
  };

  // ─── Operating Markets tag input ─────────────────────────────────────────

  const handleAddMarket = (raw?: string) => {
    const trimmed = (raw || newMarket).trim();
    if (!trimmed) return;
    const mapped = mapMarketValue(trimmed);
    if (operatingMarkets.includes(mapped)) return;
    markUserTouched('operatingMarkets');
    setMarketsSource('manual');
    setOperatingMarkets(prev => [...prev, mapped]);
    setNewMarket('');
  };

  const handleRemoveMarket = (market: string) => {
    markUserTouched('operatingMarkets');
    setOperatingMarkets(prev => prev.filter(m => m !== market));
  };

  // ─── Document extraction handler (safe merge) ────────────────────────────

  const handleDocExtracted = async (extracted: ExtractedPitchData) => {
    setLastAIExtractionAt(new Date().toISOString());

    // Update confidence from AI response
    if (extracted.confidence) {
      setFieldConfidence(prev => ({ ...prev, ...extracted.confidence }));
    }

    // Text fields: safe merge (only auto-fill if user hasn't touched)
    safeMergeText('title', extracted.title, title, setTitle);
    safeMergeText('companyName', extracted.companyName, companyName, setCompanyName);
    safeMergeText('summary', extracted.description, summary, setSummary);
    safeMergeText('problemStatement', extracted.problemStatement || '', problemStatement, setProblemStatement);
    safeMergeText('whatYouNeed', extracted.whatYouNeed, whatYouNeed, setWhatYouNeed);
    safeMergeText('investmentRange', extracted.fundingAsk, investmentRange, setInvestmentRange);
    safeMergeText('timeline', extracted.timeline, timeline, setTimeline);
    safeMergeText('tractionSummary', extracted.tractionSummary || '', tractionSummary, setTractionSummary);
    safeMergeText('founderBackgroundSummary', extracted.founderBackgroundSummary || '', founderBackgroundSummary, setFounderBackgroundSummary);

    // Map detailedDesc with target market appended
    const descParts: string[] = [];
    if (extracted.detailedDesc) descParts.push(extracted.detailedDesc);
    if (extracted.targetMarket) descParts.push(`Target Market: ${extracted.targetMarket}`);
    if (descParts.length) safeMergeText('detailedDesc', descParts.join('\n\n'), detailedDesc, setDetailedDesc);

    // Enum fields: safe merge
    safeMergeEnum('stage', extracted.stage, userTouchedFields.has('stage'), (v) => setStage(v as PitchStage));
    safeMergeEnum('category', extracted.category, userTouchedFields.has('category'), setCategory);
    if (extracted.category && extracted.category !== 'other') {
      setCategories(prev => [...new Set([...prev.filter(c => c !== 'other' && c !== 'Other'), extracted.category])]);
    }

    // Multi-select fields: merge (add AI values, keep user values)
    if (extracted.businessModel?.length) safeMergeMulti('businessModel', extracted.businessModel, businessModel, setBusinessModel);
    if (extracted.targetCustomerType?.length) safeMergeMulti('targetCustomerType', extracted.targetCustomerType, targetCustomerType, setTargetCustomerType);
    if (extracted.operatingMarkets?.length) {
      const mapped = extracted.operatingMarkets.map(mapMarketValue);
      safeMergeMulti('operatingMarkets', mapped, operatingMarkets, setOperatingMarkets);
      setMarketsSource('document');
    }
    if (extracted.matchIntent?.length) safeMergeMulti('matchIntent', extracted.matchIntent, matchIntent, setMatchIntent);
    if (extracted.supportNeededTags?.length) safeMergeMulti('supportNeededTags', extracted.supportNeededTags, supportNeededTags, setSupportNeededTags);

    // Funding amount: safe merge
    if (extracted.fundingAmountRequested != null) {
      safeMergeText('fundingAmountRequested', String(extracted.fundingAmountRequested), fundingAmountRequested, setFundingAmountRequested);
      setFundingSource('document');
    }
    if (extracted.fundingCurrency) {
      safeMergeEnum('fundingCurrency', extracted.fundingCurrency, userTouchedFields.has('fundingCurrency'), setFundingCurrency);
    }

    // Refetch sectors/skills from DB (AI may have created new ones)
    await fetchLookups();

    // Selection fields with suggested tracking
    if (extracted.lookingFor?.length) {
      safeMergeMulti('lookingFor', extracted.lookingFor, selectedLookingFor, setSelectedLookingFor);
      setSuggestedLookingFor(prev => [...new Set([...prev, ...extracted.lookingFor])]);
    }
    if (extracted.sectorIds?.length) {
      safeMergeMulti('sectors', extracted.sectorIds, selectedSectorIds, setSelectedSectorIds);
      setSuggestedSectorIds(prev => [...new Set([...prev, ...extracted.sectorIds])]);
    }
    if (extracted.skills?.length) {
      const newSkillIds = extracted.skills.map(s => s.skillId);
      const existingSkillIds = selectedSkills.map(s => s.skillId);
      const toAdd = extracted.skills.filter(s => !existingSkillIds.includes(s.skillId));
      if (toAdd.length) setSelectedSkills(prev => [...prev, ...toAdd]);
      setSuggestedSkillIds(prev => [...new Set([...prev, ...newSkillIds])]);
    }

    setHasAnalyzed(true);
    toast({ title: 'AI Extraction Complete', description: 'Fields have been filled from your document. Review and edit as needed.', variant: 'success' });
  };

  // ─── AI Analyze (safe merge) ────────────────────────────────────────────

  const handleAIAnalyze = async () => {
    if (!title.trim() && !summary.trim()) {
      toast({ title: 'Info', description: 'Please fill in at least a pitch title or elevator pitch first', variant: 'error' });
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await analyzePitchText({
        title: title.trim(),
        summary: summary.trim(),
        detailedDesc: detailedDesc.trim() || undefined,
      });

      setLastAIExtractionAt(new Date().toISOString());
      if (result.confidence) {
        setFieldConfidence(prev => ({ ...prev, ...result.confidence }));
      }

      // Enum fields: safe merge
      safeMergeEnum('category', result.category, userTouchedFields.has('category'), setCategory);
      if (result.category && result.category !== 'other') {
        setCategories(prev => [...new Set([...prev.filter(c => c !== 'other' && c !== 'Other'), result.category])]);
      }
      safeMergeEnum('stage', result.stage, userTouchedFields.has('stage'), (v) => setStage(v as PitchStage));

      // Text fields: safe merge
      if (result.companyName) safeMergeText('companyName', result.companyName, companyName, setCompanyName);
      if (result.whatYouNeed) safeMergeText('whatYouNeed', result.whatYouNeed, whatYouNeed, setWhatYouNeed);
      if (result.tractionSummary) safeMergeText('tractionSummary', result.tractionSummary, tractionSummary, setTractionSummary);
      if (result.founderBackgroundSummary) safeMergeText('founderBackgroundSummary', result.founderBackgroundSummary, founderBackgroundSummary, setFounderBackgroundSummary);

      // Multi-select: merge
      if (result.matchIntent?.length) safeMergeMulti('matchIntent', result.matchIntent, matchIntent, setMatchIntent);
      if (result.supportNeededTags?.length) safeMergeMulti('supportNeededTags', result.supportNeededTags, supportNeededTags, setSupportNeededTags);

      // Funding
      if (result.fundingAmountRequested != null) {
        safeMergeText('fundingAmountRequested', String(result.fundingAmountRequested), fundingAmountRequested, setFundingAmountRequested);
        setFundingSource('ai');
      }
      if (result.fundingCurrency) {
        safeMergeEnum('fundingCurrency', result.fundingCurrency, userTouchedFields.has('fundingCurrency'), setFundingCurrency);
      }

      // Open advanced section if AI populates advanced fields
      if ((result as any).tractionSignals?.length || (result as any).advisoryTopics?.length) {
        setAdvancedOpen(true);
      }

      // Selection fields with suggested tracking
      if (result.lookingFor?.length) {
        safeMergeMulti('lookingFor', result.lookingFor, selectedLookingFor, setSelectedLookingFor);
        setSuggestedLookingFor(prev => [...new Set([...prev, ...result.lookingFor])]);
      }
      if (result.sectorIds?.length) {
        safeMergeMulti('sectors', result.sectorIds, selectedSectorIds, setSelectedSectorIds);
        setSuggestedSectorIds(prev => [...new Set([...prev, ...result.sectorIds])]);
      }
      if (result.skills?.length) {
        const newSkillIds = result.skills.map(s => s.skillId);
        const existingSkillIds = selectedSkills.map(s => s.skillId);
        const toAdd = result.skills.filter(s => !existingSkillIds.includes(s.skillId));
        if (toAdd.length) setSelectedSkills(prev => [...prev, ...toAdd]);
        setSuggestedSkillIds(prev => [...new Set([...prev, ...newSkillIds])]);
      }

      setHasAnalyzed(true);
      toast({ title: 'AI Analysis Complete', description: 'Suggestions applied. Review any highlighted fields.', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'AI analysis failed', variant: 'error' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !summary.trim() || !problemStatement.trim() || !detailedDesc.trim() || !whatYouNeed.trim()) {
      toast({ title: t.common?.error || 'Error', description: 'Please fill in all required fields (title, elevator pitch, problem, solution, and what you need)', variant: 'error' });
      return;
    }
    if (!selectedSectorIds.length || !businessModel.length || !targetCustomerType.length || !operatingMarkets.length) {
      toast({ title: t.common?.error || 'Error', description: 'Please select industry sectors, business model, target customer type, and operating markets', variant: 'error' });
      return;
    }

    // Build metadata
    const metadata: Record<string, any> = {
      ...(pitch?.metadata || {}),
    };
    if (businessModel.length) metadata.businessModel = businessModel;
    else delete metadata.businessModel;
    if (targetCustomerType.length) metadata.targetCustomerType = targetCustomerType;
    else delete metadata.targetCustomerType;
    if (operatingMarkets.length) metadata.operatingMarkets = operatingMarkets;
    else delete metadata.operatingMarkets;
    if (tractionSummary.trim()) metadata.tractionSummary = tractionSummary.trim();
    else delete metadata.tractionSummary;
    if (founderBackgroundSummary.trim()) metadata.founderBackgroundSummary = founderBackgroundSummary.trim();
    else delete metadata.founderBackgroundSummary;

    // New fields
    if (matchIntent.length) metadata.matchIntent = matchIntent;
    else delete metadata.matchIntent;
    if (supportNeededTags.length) metadata.supportNeededTags = supportNeededTags;
    else delete metadata.supportNeededTags;
    if (fundingAmountRequested && !isNaN(parseFloat(fundingAmountRequested))) {
      metadata.fundingAmountRequested = parseFloat(fundingAmountRequested);
    } else delete metadata.fundingAmountRequested;
    if (fundingCurrency && fundingAmountRequested) metadata.fundingCurrency = fundingCurrency;
    else delete metadata.fundingCurrency;
    if (tractionSignals.length) metadata.tractionSignals = tractionSignals;
    else delete metadata.tractionSignals;
    if (advisoryTopics.length) metadata.advisoryTopics = advisoryTopics;
    else delete metadata.advisoryTopics;
    if (idealCounterpartProfile.trim()) metadata.idealCounterpartProfile = idealCounterpartProfile.trim();
    else delete metadata.idealCounterpartProfile;
    metadata.strictLookingFor = strictLookingFor;

    // Tracking metadata
    metadata._tracking = {
      fieldSource,
      fieldConfidence,
      userConfirmedAIFields,
      lastAIExtractionAt,
      lastHumanEditAt,
      aiSuggestedValues: aiSuggestions,
    };

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const data: CreatePitchInput | UpdatePitchInput = {
      title: title.trim(),
      companyName: companyName.trim() || undefined,
      summary: summary.trim(),
      problemStatement: problemStatement.trim() || undefined,
      detailedDesc: detailedDesc.trim() || undefined,
      whatYouNeed: whatYouNeed.trim() || undefined,
      category: categories.length > 0 ? categories[0] : (category.trim() || 'other'),
      stage,
      investmentRange: investmentRange.trim() || undefined,
      timeline: timeline.trim() || undefined,
      lookingFor: selectedLookingFor,
      sectorIds: selectedSectorIds.filter(id => !id.startsWith('custom_') && uuidRegex.test(id)),
      skills: selectedSkills.filter(s => !s.skillId.startsWith('custom_') && uuidRegex.test(s.skillId)),
      visibility,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    // Edit-mode-only fields
    if (isEditMode) {
      (data as UpdatePitchInput).isActive = isActive;
    }

    await onSubmit(data);
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const inputClass = 'w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all';
  const textareaClass = `${inputClass} resize-none`;

  const expandButton = (expanded: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
      <FullScreenMaximize24Regular className="w-4 h-4" />{expanded ? 'Less' : 'Expand'}
    </button>
  );

  // ─── Render ───────────────────────────────────────────────────────────────


  // Extra search states
  const [sectorSearch, setSectorSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [lfSearch, setLfSearch] = useState('');
  const [customSkillInp, setCustomSkillInp] = useState('');
  const [customLfInp, setCustomLfInp] = useState('');

  const filteredSectors = useMemo(() => smartSort(allSectors.filter(o => !sectorSearch || o.name.toLowerCase().includes(sectorSearch.toLowerCase())), o => o.id, selectedSectorIds, suggestedSectorIds), [allSectors, sectorSearch, selectedSectorIds, suggestedSectorIds]);
  const filteredSkills = useMemo(() => smartSort(allSkills.filter(o => !skillSearch || o.name.toLowerCase().includes(skillSearch.toLowerCase())), o => o.id, selectedSkills.map(s => s.skillId), suggestedSkillIds), [allSkills, skillSearch, selectedSkills, suggestedSkillIds]);
  const filteredLF = useMemo(() => smartSort(lookingForItems.filter(o => !lfSearch || o.name.toLowerCase().includes(lfSearch.toLowerCase())), o => o.id, selectedLookingFor, suggestedLookingFor), [lookingForItems, lfSearch, selectedLookingFor, suggestedLookingFor]);

  return (
    <form onSubmit={handleSubmit} className={`${p.fw} ${p.fs}`}>

      {/* ═══ Upload Banner ═══════════════════════════════════ */}
      <section className={p.up}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibE}>⬆</div><div><h2 className={p.ht}>Upload Pitch Deck</h2><p className={p.hd}>Upload your pitch deck, one-pager, or business plan. AI can extract details and help pre-fill your pitch form.</p></div></div></div>
        <div className={p.dz} tabIndex={0} role="button" onClick={() => document.getElementById('pf-up')?.click()}>
          <input id="pf-up" type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const d = await extractPitchFromDocument(f); handleDocExtracted(d); } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'error' }); } }} />
          <div className={p.dzA}>↑</div><strong>Drop your file here or click to upload</strong><span>Supports PDF, DOCX, TXT — AI will extract pitch details and suggest relevant fields automatically.</span>
        </div>
      </section>

      {/* ═══ Pitch Details ═══════════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibE}>◔</div><div><h2 className={p.ht}>Pitch Details</h2><p className={p.hd}>This section defines the startup story clearly: what you do, why it matters, and what support you need.</p></div></div></div>
        <div className={p.fg}>
          <div className={p.f}><span className={p.lbl}>Pitch Title<span className={p.req}>*</span></span><input type="text" value={title} onChange={handleInputEdit('title', setTitle)} placeholder="e.g. AI-Powered Supply Chain Optimization Platform" className={p.inp} required /></div>
          <div className={p.f}><span className={p.lbl}>Company / Startup Name</span><input type="text" value={companyName} onChange={handleInputEdit('companyName', setCompanyName)} placeholder="e.g. LogiFlow Technologies" className={p.inp} /></div>
          <div className={p.f}><div className={p.flr}><span className={p.lbl}>Elevator Pitch<span className={p.req}>*</span></span><button type="button" onClick={() => setSummaryExpanded(!summaryExpanded)} className={p.exp}>{summaryExpanded ? 'Less' : 'Expand'}</button></div><textarea value={summary} onChange={handleInputEdit('summary', setSummary)} placeholder="Describe your idea in 2–3 sentences. What does it do and why does it matter?" rows={summaryExpanded ? 8 : 3} className={p.taSm} required /></div>
          <div className={p.f}><div className={p.flr}><span className={p.lbl}>Problem Statement<span className={p.req}>*</span></span><button type="button" onClick={() => setProblemExpanded(!problemExpanded)} className={p.exp}>{problemExpanded ? 'Less' : 'Expand'}</button></div><textarea value={problemStatement} onChange={handleInputEdit('problemStatement', setProblemStatement)} placeholder="What problem are you solving? Who has this problem and how painful is it?" rows={problemExpanded ? 8 : 3} className={p.taMd} required /></div>
          <div className={p.f}><div className={p.flr}><span className={p.lbl}>Solution Summary<span className={p.req}>*</span></span><button type="button" onClick={() => setSolutionExpanded(!solutionExpanded)} className={p.exp}>{solutionExpanded ? 'Less' : 'Expand'}</button></div><textarea value={detailedDesc} onChange={handleInputEdit('detailedDesc', setDetailedDesc)} placeholder="How does your solution work? What is the market opportunity and key advantage?" rows={solutionExpanded ? 12 : 5} className={p.taMd} required /></div>
          <div className={p.f}><div className={p.flr}><span className={p.lbl}>What You Need<span className={p.req}>*</span></span><button type="button" onClick={() => setWhatYouNeedExpanded(!whatYouNeedExpanded)} className={p.exp}>{whatYouNeedExpanded ? 'Less' : 'Expand'}</button></div><textarea value={whatYouNeed} onChange={handleInputEdit('whatYouNeed', setWhatYouNeed)} placeholder="What are you looking for? e.g. $500K seed funding, CTO with AI expertise, strategic partnerships..." rows={whatYouNeedExpanded ? 8 : 3} className={p.taSm} required /></div>
        </div>
        <AISuggestionBanner suggestion={aiSuggestions.title} onAccept={() => acceptSuggestion('title', setTitle)} onDismiss={() => dismissSuggestion('title')} />
      </section>

      {/* ═══ Match Targets ═══════════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibB}>◎</div><div><h2 className={p.ht}>Match Targets</h2><p className={p.hd}>Choose the types of people or organizations your pitch should be matched with first.</p></div></div></div>
        <div className={p.msr}>
          {MATCH_INTENT_OPTIONS.map(o => (
            <button key={o.value} type="button" onClick={() => { markUserTouched('matchIntent'); setMatchIntent(prev => prev.includes(o.value) ? prev.filter(v => v !== o.value) : [...prev, o.value]); }} className={matchIntent.includes(o.value) ? p.pBlu : p.pill}>
              {matchIntent.includes(o.value) && '✓ '}{o.label}
            </button>
          ))}
        </div>
      </section>

      {/* ═══ Support Needed ══════════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibY}>✦</div><div><h2 className={p.ht}>Support Needed</h2><p className={p.hd}>Select the specific support this pitch is looking for so the match quality is more precise.</p></div></div></div>
        <div className={p.ca}><div className={p.cw}>
          {SUPPORT_NEEDED_OPTIONS.map(o => (
            <button key={o.value} type="button" onClick={() => { markUserTouched('supportNeededTags'); setSupportNeededTags(prev => prev.includes(o.value) ? prev.filter(v => v !== o.value) : [...prev, o.value]); }} className={supportNeededTags.includes(o.value) ? p.cY : p.chip}>
              {o.label}
            </button>
          ))}
        </div></div>
      </section>

      {/* ═══ Stage & Category ════════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibB}>◈</div><div><h2 className={p.ht}>Stage & Category</h2><p className={p.hd}>Define maturity, category, and fundraising context to make the pitch easier to evaluate.</p></div></div></div>
        <div className={p.fg}>
          <div className={p.f}><span className={p.lbl}>Pitch Stage</span>
            <div className={p.pg}>{STAGE_OPTIONS.map(o => (<button key={o.id} type="button" onClick={() => { markUserTouched('stage'); setStage(o.id as any); }} className={stage === o.id ? p.pSel : p.pill}>{stage === o.id && '✓ '}{o.label}</button>))}</div>
          </div>
          <div className={p.f}><span className={p.lbl}>Category<span className={p.req}>*</span></span>
            {categories.length > 0 && <div className={p.cw} style={{marginBottom:8}}>{categories.map(c => (<span key={c} className={p.cC}>{c} <button type="button" onClick={() => setCategories(prev => prev.filter(x => x !== c))} className={p.dm}>×</button></span>))}</div>}
            <AutocompleteTagInput value={categorySearch} onChange={setCategorySearch} onAdd={v => { if (!categories.some(c => c.toLowerCase() === v.toLowerCase())) { setCategories(prev => [...prev.filter(c => c !== 'other' && c !== 'Other'), v]); markUserTouched('category'); } setCategorySearch(''); }} suggestions={CATEGORY_SUGGESTIONS} existingTags={categories} placeholder="Search or create category..." />
            <div className={p.ts}>{CATEGORY_SUGGESTIONS.filter(c => !categories.some(sel => sel.toLowerCase() === c.toLowerCase())).filter(c => !categorySearch || c.toLowerCase().includes(categorySearch.toLowerCase())).slice(0, 10).map(c => (<button key={c} type="button" onClick={() => { setCategories(prev => [...prev.filter(x => x !== 'other' && x !== 'Other'), c]); setCategorySearch(''); markUserTouched('category'); }} className={p.tsg}>{c}</button>))}</div>
          </div>
          <div className={p.f}><div className={p.flr}><span className={p.lbl}>Funding Ask / Investment Range</span>{fundingSource !== 'manual' && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fundingSource === 'document' ? 'bg-emerald-400 text-[#042820]' : 'bg-blue-400 text-[#042820]'}`}>{fundingSource === 'document' ? 'From Document' : 'AI Estimation'}</span>}</div><input type="text" value={investmentRange} onChange={handleInputEdit('investmentRange', setInvestmentRange)} placeholder="e.g. $250K – $500K Seed Round" className={p.inp} /></div>
          {showFundingFields && (
            <div className={`${p.fg} ${p.tc}`}>
              <div className={p.f}><span className={p.lbl}>Funding Amount</span><input type="number" step="any" min="0" value={fundingAmountRequested} onChange={handleInputEdit('fundingAmountRequested', setFundingAmountRequested)} placeholder="e.g. 500000" className={p.inp} /></div>
              <div className={p.f}><span className={p.lbl}>Currency</span><Select value={fundingCurrency} onChange={(v) => { markUserTouched('fundingCurrency'); setFundingCurrency(v); }} options={CURRENCY_OPTIONS.map(o => ({ value: o.value, label: o.label }))} /></div>
            </div>
          )}
          <div className={p.f}><div className={p.flr}><span className={p.lbl}>Timeline & Milestones</span><button type="button" onClick={() => setTimelineExpanded(!timelineExpanded)} className={p.exp}>{timelineExpanded ? 'Less' : 'Expand'}</button></div><textarea value={timeline} onChange={handleInputEdit('timeline', setTimeline)} placeholder="e.g. Q1: MVP launch. Q2: first 100 customers. Q3: series of pilot partnerships." rows={timelineExpanded ? 10 : 3} className={p.taSm} /></div>
        </div>
      </section>

      {/* ═══ AI Analyze Banner ═══════════════════════════════ */}
      {(title.trim() || summary.trim()) && (
        <div className={p.azBanner}>
          <div className="azCopy">
            <strong style={{display:'block',marginBottom:4,fontSize:'0.98rem',fontWeight:800,color:'var(--text)'}}>
              {hasAnalyzed ? '✦ Re-analyze with AI' : '✦ Auto-fill with AI'}
            </strong>
            <span style={{color:'var(--textSoft)',fontSize:'0.9rem',lineHeight:1.5}}>
              Stage, Category, Sectors, Skills, Markets, Match Targets & more
            </span>
          </div>
          <button type="button" onClick={handleAIAnalyze} disabled={isAnalyzing} className={p.bS} style={{flexShrink:0}}>
            {isAnalyzing ? <><ArrowSync24Regular className="w-4 h-4 animate-spin" />Analyzing...</> : <><Sparkle24Regular className="w-4 h-4" />{hasAnalyzed ? 'Re-analyze' : 'Analyze'}</>}
          </button>
        </div>
      )}

      {/* ═══ Industry Sectors ════════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibC}>▣</div><div><h2 className={p.ht}>Industry Sectors<span className={p.req}>*</span></h2><p className={p.hd}>Choose the sectors this pitch belongs to or impacts most directly.</p></div></div>{selectedSectorIds.length > 0 && <div className={p.cb}>{selectedSectorIds.length} selected</div>}</div>
        <div className={p.fg}>
          <div className={p.sb}><span className={p.sbi}>⌕</span><input type="text" value={sectorSearch} onChange={e => setSectorSearch(e.target.value)} placeholder="Search sectors..." className={p.inp} /></div>
          <div className={p.ca}><div className={p.cw}>
            {filteredSectors.slice(0, 40).map(o => (<button key={o.id} type="button" onClick={() => toggleSector(o.id)} className={selectedSectorIds.includes(o.id) ? p.cC : p.chip}>{suggestedSectorIds.includes(o.id) && <span className={p.star}>★</span>}{o.name}</button>))}
          </div><div className={p.te}><input type="text" placeholder="Add custom sector..." className={p.inp} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = (e.target as HTMLInputElement).value.trim(); if (v) { handleAddCustomSector(v); (e.target as HTMLInputElement).value = ''; } } }} /><button type="button" className={p.tp}>+</button></div></div>
        </div>
      </section>

      {/* ═══ Business Model ══════════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibI}>⧉</div><div><h2 className={p.ht}>Business Model<span className={p.req}>*</span></h2><p className={p.hd}>Select the revenue or operating models that best fit the startup.</p></div></div></div>
        <div className={p.msr}>
          {BUSINESS_MODEL_OPTIONS.map(o => (<button key={o.value} type="button" onClick={() => { markUserTouched('businessModel'); setBusinessModel(prev => prev.includes(o.value) ? prev.filter(v => v !== o.value) : [...prev, o.value]); }} className={businessModel.includes(o.value) ? p.pInd : p.pill}>{businessModel.includes(o.value) && '✓ '}{o.label}</button>))}
        </div>
      </section>

      {/* ═══ Target Customer Type ════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibY}>◎</div><div><h2 className={p.ht}>Target Customer Type<span className={p.req}>*</span></h2><p className={p.hd}>Identify who the solution is built for.</p></div></div></div>
        <div className={p.msr}>
          {TARGET_CUSTOMER_OPTIONS.map(o => (<button key={o.value} type="button" onClick={() => { markUserTouched('targetCustomerType'); setTargetCustomerType(prev => prev.includes(o.value) ? prev.filter(v => v !== o.value) : [...prev, o.value]); }} className={targetCustomerType.includes(o.value) ? p.pCya : p.pill}>{targetCustomerType.includes(o.value) && '✓ '}{o.label}</button>))}
        </div>
      </section>

      {/* ═══ Operating Markets ════════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibE}>◌</div><div><h2 className={p.ht}>Operating Markets<span className={p.req}>*</span></h2><p className={p.hd}>Add the regions where the startup operates or plans to expand.</p></div></div>{marketsSource !== 'manual' && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${marketsSource === 'document' ? 'bg-emerald-400 text-[#042820]' : 'bg-blue-400 text-[#042820]'}`}>{marketsSource === 'document' ? 'From Document' : 'AI Estimation'}</span>}</div>
        {operatingMarkets.length > 0 && <div className={p.cw} style={{marginBottom:12}}>{operatingMarkets.map(m => { const label = MARKET_OPTIONS.find(o => o.value === m)?.label || m; return (<span key={m} className={p.cC}>{label} <button type="button" onClick={() => handleRemoveMarket(m)} className={p.dm}>×</button></span>); })}</div>}
        <AutocompleteTagInput value={newMarket} onChange={setNewMarket} onAdd={v => handleAddMarket(v)} suggestions={MARKET_OPTIONS.map(o => o.label)} existingTags={operatingMarkets.map(m => MARKET_OPTIONS.find(o => o.value === m)?.label || m)} placeholder="Search or add market region..." />
        <div className={p.msr} style={{marginTop:12}}>
          {MARKET_OPTIONS.filter(o => !newMarket || o.label.toLowerCase().includes(newMarket.toLowerCase())).slice(0, 20).map(o => (
            <button key={o.value} type="button" onClick={() => { setOperatingMarkets(prev => prev.includes(o.value) ? prev.filter(v => v !== o.value) : [...prev, o.value]); setMarketsSource('manual'); }} className={operatingMarkets.includes(o.value) ? p.pillBlu : p.pill}>
              {operatingMarkets.includes(o.value) && '✓ '}{o.label}
            </button>
          ))}
        </div>
      </section>

      {/* ═══ Traction Summary ════════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibY}>↗</div><div><h2 className={p.ht}>Traction Summary</h2><p className={p.hd}>Add current traction or early validation signals to strengthen the pitch.</p></div></div></div>
        <div className={p.fg}>
          <div className={p.f}><div className={p.flr}><span className={p.lbl}>Current traction and key metrics</span><button type="button" onClick={() => setTractionExpanded(!tractionExpanded)} className={p.exp}>{tractionExpanded ? 'Less' : 'Expand'}</button></div><textarea value={tractionSummary} onChange={handleInputEdit('tractionSummary', setTractionSummary)} placeholder="e.g. 5,000 users, $10K MRR, 3 enterprise pilots, LOIs from 2 Fortune 500 companies." rows={tractionExpanded ? 8 : 3} className={p.taSm} /></div>
          <div className={p.f}><span className={p.lbl}>Traction Signals</span>
            {tractionSignals.length > 0 && <div className={p.cw} style={{marginBottom:8}}>{tractionSignals.map(s => (<span key={s} className={p.cC}>{s} <button type="button" onClick={() => setTractionSignals(prev => prev.filter(x => x !== s))} className={p.dm}>×</button></span>))}</div>}
            <AutocompleteTagInput value={tractionInput} onChange={setTractionInput} onAdd={v => { if (!tractionSignals.map(x => x.toLowerCase()).includes(v.toLowerCase())) setTractionSignals([...tractionSignals, v]); setTractionInput(''); }} suggestions={TRACTION_SUGGESTIONS} existingTags={tractionSignals} placeholder="Add traction signal..." />
          </div>
        </div>
      </section>

      {/* ═══ Founder Background ══════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibB}>⌘</div><div><h2 className={p.ht}>Founder Background</h2><p className={p.hd}>Provide short founder credibility context that helps others trust execution ability.</p></div></div></div>
        <div className={p.f}><div className={p.flr}><span className={p.lbl}>Founding team background</span><button type="button" onClick={() => setFounderExpanded(!founderExpanded)} className={p.exp}>{founderExpanded ? 'Less' : 'Expand'}</button></div><textarea value={founderBackgroundSummary} onChange={handleInputEdit('founderBackgroundSummary', setFounderBackgroundSummary)} placeholder="e.g. 2x founder, ex-Google engineer, 10 years in logistics tech." rows={founderExpanded ? 8 : 3} className={p.taSm} /></div>
      </section>

      {/* ═══ Who Are You Looking For? ════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibB}>⌕</div><div><h2 className={p.ht}>Who Are You Looking For?</h2><p className={p.hd}>Select the people you want to connect with after publishing the pitch.</p></div></div></div>
        <div className={p.fg}>
          <div className={p.sb}><span className={p.sbi}>⌕</span><input type="text" value={lfSearch} onChange={e => setLfSearch(e.target.value)} placeholder="Search options..." className={p.inp} /></div>
          <div className={p.ca}><div className={p.cw}>
            {filteredLF.map(o => (<button key={o.id} type="button" onClick={() => toggleLookingFor(o.id)} className={selectedLookingFor.includes(o.id) ? p.cC : p.chip}>{suggestedLookingFor.includes(o.id) && <span className={p.star}>★</span>}{o.name}</button>))}
          </div><div className={p.te}><input type="text" value={customLfInp} onChange={e => setCustomLfInp(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customLfInp.trim()) { e.preventDefault(); handleAddCustomLookingFor(customLfInp.trim()); setCustomLfInp(''); } }} placeholder="Add custom option..." className={p.inp} /><button type="button" onClick={() => { if (customLfInp.trim()) { handleAddCustomLookingFor(customLfInp.trim()); setCustomLfInp(''); } }} disabled={!customLfInp.trim()} className={p.tp}>+</button></div></div>
        </div>
      </section>

      {/* ═══ Skills Needed ═══════════════════════════════════ */}
      <section className={p.card}>
        <div className={p.hdr}><div className={p.hl}><div className={p.ibC}>✦</div><div><h2 className={p.ht}>Skills Needed</h2><p className={p.hd}>Specify what skills or expertise the startup needs most at this stage.</p></div></div>{selectedSkills.length > 0 && <div className={p.cb}>{selectedSkills.length} selected</div>}</div>
        <div className={p.fg}>
          <div className={p.sb}><span className={p.sbi}>⌕</span><input type="text" value={skillSearch} onChange={e => setSkillSearch(e.target.value)} placeholder="Search skills..." className={p.inp} /></div>
          <div className={p.ca}><div className={p.cw}>
            {filteredSkills.slice(0, 40).map(o => (<button key={o.id} type="button" onClick={() => toggleSkill(o.id)} className={selectedSkills.some(sk => sk.skillId === o.id) ? p.cC : p.chip}>{suggestedSkillIds.includes(o.id) && <span className={p.star}>★</span>}{o.name}</button>))}
          </div><div className={p.te}><input type="text" value={customSkillInp} onChange={e => setCustomSkillInp(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customSkillInp.trim()) { e.preventDefault(); handleAddCustomSkill(customSkillInp.trim()); setCustomSkillInp(''); } }} placeholder="Add custom skill..." className={p.inp} /><button type="button" onClick={() => { if (customSkillInp.trim()) { handleAddCustomSkill(customSkillInp.trim()); setCustomSkillInp(''); } }} disabled={!customSkillInp.trim()} className={p.tp}>+</button></div></div>
        </div>
      </section>

      {/* ═══ Advanced / Matching Preferences ═════════════════ */}
      <section className={p.advCard}>
        <div className={p.hdr} style={{cursor:'pointer'}} onClick={() => setAdvancedOpen(!advancedOpen)}>
          <div className={p.hl}><div className={p.ibB}>⚙</div><div><h2 className={p.ht}>Advanced Matching Preferences</h2><p className={p.hd}>Fine-tune matching criteria for better results. {!advancedOpen ? 'Click to expand.' : ''}</p></div></div>
          <span style={{fontSize:'1.2rem',color:'var(--textSoft)'}}>{advancedOpen ? '▾' : '▸'}</span>
        </div>
        {advancedOpen && (
          <div className={p.fg}>
            <div className={p.f}><span className={p.lbl}>Advisory Topics</span>
              {advisoryTopics.length > 0 && <div className={p.cw} style={{marginBottom:8}}>{advisoryTopics.map(t => (<span key={t} className={p.cC}>{t} <button type="button" onClick={() => setAdvisoryTopics(prev => prev.filter(x => x !== t))} className={p.dm}>×</button></span>))}</div>}
              <AutocompleteTagInput value={advisoryInput} onChange={setAdvisoryInput} onAdd={v => { if (!advisoryTopics.map(x => x.toLowerCase()).includes(v.toLowerCase())) setAdvisoryTopics([...advisoryTopics, v]); setAdvisoryInput(''); }} suggestions={ADVISORY_SUGGESTIONS} existingTags={advisoryTopics} placeholder="Add advisory topic..." />
            </div>
            <div className={p.f}><div className={p.flr}><span className={p.lbl}>Ideal Counterpart Profile</span></div><textarea value={idealCounterpartProfile} onChange={handleInputEdit('idealCounterpartProfile', setIdealCounterpartProfile)} placeholder="Describe the ideal partner, advisor, investor, or collaborator for this pitch..." rows={4} className={p.taSm} maxLength={5000} /></div>
            <div className={p.f}><span className={p.lbl}>Matching Mode</span>
              <div className={p.segRow}>
                <button type="button" onClick={() => setStrictLookingFor(false)} className={!strictLookingFor ? p.segF : p.seg}>Flexible</button>
                <button type="button" onClick={() => setStrictLookingFor(true)} className={strictLookingFor ? p.segS : p.seg}>Strict</button>
              </div>
              <p className={p.note}>Strict = only exact role matches. Flexible = broader matching across related roles.</p>
            </div>
          </div>
        )}
      </section>

      {/* ═══ CTA ═════════════════════════════════════════════ */}
      <div className={p.cta}>
        <button type="submit" disabled={isSubmitting} className={p.bP}>{isSubmitting ? (isEditMode ? 'Saving...' : 'Creating Pitch...') : isEditMode ? 'Save Changes' : 'Create Pitch'}</button>
        <button type="button" onClick={onCancel} className={p.bO}>{t.common?.cancel || 'Cancel'}</button>
      </div>
    </form>
  );
}
