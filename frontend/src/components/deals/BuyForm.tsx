/**
 * BuyForm — Standalone form component for BUY mode deals
 *
 * Used by both /deals/new and /deals/[id]/edit pages.
 * Supports 14 fields: 6 core columns + 8 metadata fields.
 */

'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Cart24Regular,
  Building24Regular,
  Person24Regular,
  PeopleTeam24Regular,
  Handshake24Regular,
  Sparkle24Regular,
  Info24Regular,
  Target24Regular,
  Settings24Regular,
} from '@fluentui/react-icons';
import {
  Deal,
  CreateDealInput,
  UpdateDealInput,
  DealCompanySize,
  DealTargetEntityType,
  ExtractedDealData,
} from '@/lib/api/deals';
import { Select } from '@/components/ui/Select';
import b from './BuyForm.module.css';
import { DealDocumentUpload } from '@/components/deals/DealDocumentUpload';
import { CollapsibleSection } from '@/components/deals/CollapsibleSection';
import { PillSelector } from '@/components/deals/PillSelector';
import { QuickTagRow } from '@/components/deals/QuickTagRow';
import { DomainTagInput } from '@/components/deals/DomainTagInput';

// ─── Constants ──────────────────────────────────────────────────────
const SOLUTION_CATEGORIES = [
  'SaaS / Software',
  'Consulting / Advisory',
  'Professional Services',
  'Hardware / Equipment',
  'Real Estate / Property',
  'Financial Services',
  'Marketing / Advertising',
  'Training / Education',
  'Logistics / Supply Chain',
  'Healthcare / Medical',
  'Legal Services',
  'IT Infrastructure',
  'Custom / Other',
];

export const BUY_REQUIREMENT_TAGS = [
  'ISO Certified', 'Local Office', '24/7 Support', 'API Integration',
  'Custom Development', 'Scalable Solution', 'Data Security', 'Mobile Support',
  'Multilingual', 'Free Trial',
];

const PRICE_RANGES = [
  { value: '< $1K', label: '< $1K' },
  { value: '$1K - $10K', label: '$1K - $10K' },
  { value: '$10K - $50K', label: '$10K - $50K' },
  { value: '$50K - $100K', label: '$50K - $100K' },
  { value: '$100K+', label: '$100K+' },
];

const BUY_TIMELINES = [
  { value: 'Urgent (this week)', label: 'Urgent' },
  { value: 'Soon (this month)', label: 'This Month' },
  { value: 'Next quarter', label: 'Next Quarter' },
  { value: 'This year', label: 'This Year' },
  { value: 'No rush', label: 'No Rush' },
];

const BUYING_STAGES = [
  { value: 'Just exploring', label: 'Just Exploring' },
  { value: 'Comparing providers', label: 'Comparing Providers' },
  { value: 'Ready to buy', label: 'Ready to Buy' },
  { value: 'Already in discussions', label: 'In Discussions' },
];

const DELIVERY_MODES = [
  { value: 'On-premise', label: 'On-premise' },
  { value: 'Cloud/SaaS', label: 'Cloud/SaaS' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Managed Service', label: 'Managed Service' },
  { value: 'Self-service', label: 'Self-service' },
];

const BUYER_ROLE_OPTIONS = [
  { value: 'DECISION_MAKER', label: 'Decision Maker' },
  { value: 'TECHNICAL_EVALUATOR', label: 'Technical Evaluator' },
  { value: 'END_USER', label: 'End User' },
  { value: 'PROCUREMENT', label: 'Procurement' },
  { value: 'BUDGET_HOLDER', label: 'Budget Holder' },
  { value: 'CONSULTANT', label: 'Consultant / Advisor' },
];

// ─── Helpers ────────────────────────────────────────────────────────

function parseStructuredContext(text: string): { cleanText: string; context: Record<string, string> } {
  const context: Record<string, string> = {};
  const pattern = /\[([^:]+):\s*([^\]]+)\]/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    context[match[1].trim()] = match[2].trim();
  }
  const cleanText = text.replace(/\[([^:]+):\s*([^\]]+)\]\n?/g, '').trim();
  return { cleanText, context };
}

function buildStructuredContext(parts: Record<string, string | string[]>): string {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(parts)) {
    if (!val || (Array.isArray(val) && val.length === 0)) continue;
    const v = Array.isArray(val) ? val.join(', ') : val;
    if (v) lines.push(`[${key}: ${v}]`);
  }
  return lines.join('\n');
}

// ─── Solution Type Autocomplete ─────────────────────────────────────
function SolutionTypeInput({
  value, onChange, accentColor = 'blue',
}: { value: string; onChange: (v: string) => void; accentColor?: 'emerald' | 'blue' | 'purple' }) {
  const { t } = useI18n();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filtered = value
    ? SOLUTION_CATEGORIES.filter(c => c.toLowerCase().includes(value.toLowerCase()))
    : SOLUTION_CATEGORIES;

  const ringColor = accentColor === 'emerald' ? 'focus:ring-emerald-500/50 focus:border-emerald-500'
    : accentColor === 'blue' ? 'focus:ring-blue-500/50 focus:border-blue-500'
    : 'focus:ring-emerald-500/50 focus:border-emerald-500';

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={t.deals?.solutionTypePlaceholder || 'e.g., CRM Software, Marketing Services'}
        className={`w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 ${ringColor} transition-all`}
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 py-1 bg-th-bg-t border border-th-border rounded-xl shadow-2xl max-h-48 overflow-auto">
          {filtered.map((cat) => (
            <button
              key={cat}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(cat); setShowSuggestions(false); }}
              className={`w-full px-4 py-2 text-sm text-start transition-colors ${
                cat === value ? 'bg-blue-500/20 text-blue-300' : 'text-th-text hover:bg-th-surface-h'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Entity Type Selector ──────────────────────────────────────────
function EntityTypeSelector({
  value, onChange,
}: { value: DealTargetEntityType | undefined; onChange: (v: DealTargetEntityType) => void }) {
  const { t } = useI18n();
  const options: Array<{ id: DealTargetEntityType; label: string; desc: string; icon: typeof Building24Regular }> = [
    { id: 'COMPANY', label: t.deals?.entityCompany || 'Company', desc: t.deals?.entityCompanyDesc || 'An established company', icon: Building24Regular },
    { id: 'INDIVIDUAL', label: t.deals?.entityIndividual || 'Individual', desc: t.deals?.entityIndividualDesc || 'A freelancer or expert', icon: Person24Regular },
    { id: 'CONSULTANT', label: t.deals?.entityConsultant || 'Consultant', desc: t.deals?.entityConsultantDesc || 'An advisor', icon: PeopleTeam24Regular },
    { id: 'PARTNER', label: t.deals?.entityPartner || 'Partner', desc: t.deals?.entityPartnerDesc || 'A business partner', icon: Handshake24Regular },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`relative overflow-hidden p-3 rounded-xl text-start transition-all border ${
              isSelected
                ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/15 border-blue-500/40 shadow-lg shadow-blue-500/10'
                : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
            }`}
          >
            {isSelected && <div className="absolute -top-4 -end-4 w-12 h-12 bg-blue-500/15 rounded-full blur-xl" />}
            <div className="relative">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${isSelected ? 'bg-blue-500/20' : 'bg-th-surface'}`}>
                <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-th-text-m'}`} />
              </div>
              <div className={`font-medium text-sm ${isSelected ? 'text-th-text' : ''}`}>{option.label}</div>
              <div className="text-xs opacity-70 mt-1">{option.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────
export interface BuyFormProps {
  deal?: Deal;
  onSubmit: (data: CreateDealInput | UpdateDealInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

// ═════════════════════════════════════════════════════════════════════
// BuyForm Component
// ═════════════════════════════════════════════════════════════════════
export function BuyForm({ deal, onSubmit, onCancel, isSubmitting }: BuyFormProps) {
  const { t } = useI18n();

  // ── Core fields (6) ───────────────────────────────────────────────
  const [problemStatement, setProblemStatement] = useState('');
  const [solutionType, setSolutionType] = useState('');
  const [domain, setDomain] = useState('');
  const [targetEntityType, setTargetEntityType] = useState<DealTargetEntityType | undefined>();
  const [companySize, setCompanySize] = useState<DealCompanySize | ''>('');
  const [title, setTitle] = useState('');

  // ── Metadata fields (9) ──────────────────────────────────────────
  const [requirementTags, setRequirementTags] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState('');
  const [neededTimeline, setNeededTimeline] = useState('');
  const [buyingStage, setBuyingStage] = useState('');
  const [targetMarketLocation, setTargetMarketLocation] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('');
  const [idealProviderProfile, setIdealProviderProfile] = useState('');
  const [relevantIndustryTags, setRelevantIndustryTags] = useState<string[]>([]);
  const [buyerRole, setBuyerRole] = useState('');

  // ── Populate from existing deal ──────────────────────────────────
  useEffect(() => {
    if (!deal) return;

    setTitle(deal.title || '');
    setSolutionType(deal.solutionType || '');
    setDomain(deal.domain || '');
    setCompanySize((deal.companySize as DealCompanySize) || '');
    setTargetEntityType(deal.targetEntityType as DealTargetEntityType | undefined);

    // Read metadata if present (new format)
    const meta = deal.metadata || {};
    if (meta.mustHaveRequirements) setRequirementTags(Array.isArray(meta.mustHaveRequirements) ? meta.mustHaveRequirements : []);
    if (meta.budgetRange) setBudgetRange(meta.budgetRange);
    if (meta.neededTimeline) setNeededTimeline(meta.neededTimeline);
    if (meta.buyingStage) setBuyingStage(meta.buyingStage);
    if (meta.targetMarketLocation) setTargetMarketLocation(meta.targetMarketLocation);
    if (meta.deliveryMode) setDeliveryMode(meta.deliveryMode);
    if (meta.idealProviderProfile) setIdealProviderProfile(meta.idealProviderProfile);
    if (meta.relevantIndustry) setRelevantIndustryTags(Array.isArray(meta.relevantIndustry) ? meta.relevantIndustry : []);
    if (meta.buyerRole) setBuyerRole(meta.buyerRole);

    // Backward compat: parse structured context from problemStatement
    if (deal.problemStatement && !deal.metadata) {
      const { cleanText, context } = parseStructuredContext(deal.problemStatement);
      setProblemStatement(cleanText);
      if (context['Requirements']) {
        setRequirementTags(context['Requirements'].split(',').map(t => t.trim()).filter(Boolean));
      }
      if (context['Budget']) setBudgetRange(context['Budget']);
      if (context['Timeline']) setNeededTimeline(context['Timeline']);
      if (context['Decision Stage']) setBuyingStage(context['Decision Stage']);
    } else {
      setProblemStatement(deal.problemStatement || '');
    }
  }, [deal]);

  // ── Auto-save draft (create mode only) ───────────────────────────
  const BUY_STORAGE_KEY = 'deal_buy_draft';
  useEffect(() => {
    if (deal) return;
    const saved = localStorage.getItem(BUY_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.problemStatement) setProblemStatement(data.problemStatement);
        if (data.solutionType) setSolutionType(data.solutionType);
        if (data.domain) setDomain(data.domain);
        if (data.companySize) setCompanySize(data.companySize);
        if (data.targetEntityType) setTargetEntityType(data.targetEntityType);
        if (data.title) setTitle(data.title);
        if (data.requirementTags) setRequirementTags(data.requirementTags);
        if (data.budgetRange) setBudgetRange(data.budgetRange);
        if (data.neededTimeline) setNeededTimeline(data.neededTimeline);
        if (data.buyingStage) setBuyingStage(data.buyingStage);
        if (data.targetMarketLocation) setTargetMarketLocation(data.targetMarketLocation);
        if (data.deliveryMode) setDeliveryMode(data.deliveryMode);
        if (data.idealProviderProfile) setIdealProviderProfile(data.idealProviderProfile);
        if (data.relevantIndustryTags) setRelevantIndustryTags(data.relevantIndustryTags);
        if (data.buyerRole) setBuyerRole(data.buyerRole);
      } catch {}
    }
  }, [deal]);

  useEffect(() => {
    if (deal) return;
    const timer = setTimeout(() => {
      const data = { problemStatement, solutionType, domain, companySize, targetEntityType, title, requirementTags, budgetRange, neededTimeline, buyingStage, targetMarketLocation, deliveryMode, idealProviderProfile, relevantIndustryTags, buyerRole };
      if (Object.values(data).some(v => v && (typeof v === 'string' ? v.length > 0 : Array.isArray(v) ? v.length > 0 : true))) {
        localStorage.setItem(BUY_STORAGE_KEY, JSON.stringify(data));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [deal, problemStatement, solutionType, domain, companySize, targetEntityType, title, requirementTags, budgetRange, neededTimeline, buyingStage, targetMarketLocation, deliveryMode, idealProviderProfile, relevantIndustryTags, buyerRole]);

  // ── Document extraction ──────────────────────────────────────────
  const handleDocExtracted = (data: ExtractedDealData) => {
    if (data.problemStatement) setProblemStatement(data.problemStatement);
    if (data.solutionType) setSolutionType(data.solutionType);
    if (data.domain) setDomain(data.domain);
    if (data.companySize) setCompanySize(data.companySize as DealCompanySize);
    if (data.targetEntityType) setTargetEntityType(data.targetEntityType as DealTargetEntityType);
    if (data.title) setTitle(data.title);
    if (data.priceRange) setBudgetRange(data.priceRange);
    if (data.timeline) setNeededTimeline(data.timeline);
    if (data.requirements) {
      setRequirementTags(data.requirements.split(',').map(r => r.trim()).filter(r => BUY_REQUIREMENT_TAGS.includes(r)));
    }
    if (data.metadata) {
      if (data.metadata.deliveryMode) setDeliveryMode(data.metadata.deliveryMode);
      if (data.metadata.targetMarketLocation) setTargetMarketLocation(data.metadata.targetMarketLocation);
      if (data.metadata.idealProviderProfile) setIdealProviderProfile(data.metadata.idealProviderProfile);
      if (data.metadata.buyerRole) setBuyerRole(data.metadata.buyerRole);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missing: string[] = [];
    if (!problemStatement.trim()) missing.push('What do you need');
    if (!solutionType) missing.push('Solution Category');
    if (!relevantIndustryTags.length) missing.push('Relevant Industry');
    if (!targetEntityType) missing.push('Provider Type');
    if (!requirementTags.length) missing.push('Must-Have Requirements');
    if (!budgetRange) missing.push('Budget');
    if (!neededTimeline) missing.push('Timeline');
    if (!buyingStage) missing.push('Buying Stage');
    if (missing.length > 0) {
      const { toast } = await import('@/components/ui/Toast');
      toast({ title: 'Required fields missing', description: missing.join(', '), variant: 'error' });
      return;
    }

    // Build backward-compat structured context for problemStatement
    const contextParts = buildStructuredContext({
      'Requirements': requirementTags,
      'Budget': budgetRange,
      'Timeline': neededTimeline,
      'Decision Stage': buyingStage,
    });
    const fullProblem = [problemStatement, contextParts].filter(Boolean).join('\n');

    // Auto-generate title
    const entityLabel = targetEntityType ? { COMPANY: 'Company', INDIVIDUAL: 'Individual', CONSULTANT: 'Consultant', PARTNER: 'Partner' }[targetEntityType] : '';
    const autoTitle = title || [solutionType, entityLabel].filter(Boolean).join(' \u2014 ') || `Looking for ${solutionType || 'Solution'}`;

    // Build metadata object
    const metadata: Record<string, any> = {};
    if (requirementTags.length > 0) metadata.mustHaveRequirements = requirementTags;
    if (budgetRange) metadata.budgetRange = budgetRange;
    if (neededTimeline) metadata.neededTimeline = neededTimeline;
    if (buyingStage) metadata.buyingStage = buyingStage;
    if (targetMarketLocation) metadata.targetMarketLocation = targetMarketLocation;
    if (deliveryMode) metadata.deliveryMode = deliveryMode;
    if (idealProviderProfile) metadata.idealProviderProfile = idealProviderProfile;
    if (relevantIndustryTags.length > 0) metadata.relevantIndustry = relevantIndustryTags;
    if (buyerRole) metadata.buyerRole = buyerRole;

    const payload: CreateDealInput | UpdateDealInput = {
      ...(deal ? {} : { mode: 'BUY' as const }),
      title: autoTitle,
      problemStatement: fullProblem || undefined,
      solutionType: solutionType || undefined,
      domain: domain || undefined,
      companySize: companySize || undefined,
      targetEntityType,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    await onSubmit(payload);

    if (!deal) {
      localStorage.removeItem(BUY_STORAGE_KEY);
    }
  };

  const toggleRequirement = (tag: string) => {
    setRequirementTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // Relevant industry tag helpers
  const [industryInput, setIndustryInput] = useState('');
  const addIndustryTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || relevantIndustryTags.includes(trimmed)) return;
    setRelevantIndustryTags(prev => [...prev, trimmed]);
    setIndustryInput('');
  };
  const removeIndustryTag = (index: number) => {
    setRelevantIndustryTags(prev => prev.filter((_, i) => i !== index));
  };


  return (
    <>
      {/* ═══ Hero ═══════════════════════════════════════════════ */}
      <section className={b.hero}>
        <div className={b.hdr} style={{marginBottom:0}}>
          <div className={b.hl}>
            <div className={b.ibB} style={{cursor:'pointer'}} onClick={onCancel}>←</div>
            <div><h1 className={b.heroTitle}>I Want to Buy</h1><p className={b.hd}>Describe what you need and we&apos;ll help find the right people and providers.</p></div>
          </div>
        </div>
      </section>

      {/* ═══ Upload ═════════════════════════════════════════════ */}
      <section className={b.up}>
        <div className={b.hdr}><div className={b.hl}><div className={b.ibY}>⬆</div><div><h2 className={b.ht}>Quick Fill from Document</h2><p className={b.hd}>Upload a document and AI will extract request details to speed up completion.</p></div></div></div>
        <div className={b.dz} tabIndex={0} role="button" onClick={() => document.getElementById('bf-up')?.click()}>
          <input id="bf-up" type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const { extractDealFromDocument } = await import('@/lib/api/deals'); const d = await extractDealFromDocument(f); handleDocExtracted(d); } catch (err: any) { const { toast: t2 } = await import('@/components/ui/Toast'); t2({ title: 'Error', description: err.message, variant: 'error' }); } }} />
          <div className={b.dzA}>↑</div><strong>Drop your file here or click to upload</strong><span>Supports PDF, DOCX, TXT — useful for RFPs, requirement documents, briefs, and procurement notes.</span>
        </div>
      </section>

      <form onSubmit={handleSubmit} className={b.ss}>

        {/* ═══ What You Need ════════════════════════════════════ */}
        <section className={b.card}>
          <div className={b.hdr}><div className={b.hl}><div className={b.ibB}>◎</div><div><h2 className={b.ht}>What You Need</h2><p className={b.hd}>Describe the need clearly so the system can match you with the most relevant providers.</p></div></div></div>
          <div className={b.fg}>
            <div className={b.f}><span className={b.lbl}>What do you need?<span className={b.req}>*</span></span><textarea value={problemStatement} onChange={e => setProblemStatement(e.target.value)} placeholder={"Describe what you're looking for. For example:\n• We need a CRM system that integrates with our ERP\n• Looking for a marketing agency specialized in B2B SaaS\n• Need a consultant for ISO 27001 certification"} rows={6} className={b.taLg} required /><div className={b.hlp}>{t.deals?.problemHelper || 'The more detail you provide, the better we can match you with the right providers.'}</div></div>
            <div className={b.f}><span className={b.lbl}>{t.deals?.solutionCategory || 'Solution Category'}<span className={b.req}>*</span></span><SolutionTypeInput value={solutionType} onChange={setSolutionType} accentColor="blue" /></div>
            <div className={b.f}><span className={b.lbl}>{t.deals?.relevantIndustry || 'Relevant Industry'}<span className={b.req}>*</span></span><DomainTagInput value={domain} onChange={setDomain} accentColor="blue" placeholder={t.deals?.domainPlaceholder || 'e.g. Technology, Healthcare, Finance'} /></div>
          </div>
        </section>

        {/* ═══ Who You're Looking For ═══════════════════════════ */}
        <section className={b.card}>
          <div className={b.hdr}><div className={b.hl}><div className={b.ibC}>◌</div><div><h2 className={b.ht}>{t.deals?.whoYoureLookingFor || "Who You're Looking For"}</h2><p className={b.hd}>Define provider preferences so the matches are closer to your buying requirements.</p></div></div></div>
          <div className={b.fg}>
            {/* Provider Type */}
            <div className={b.f}><span className={b.lbl}>{t.deals?.providerType || 'Provider Type'}<span className={b.req}>*</span></span>
              <div className={b.pg}>
                {([
                  { id: 'COMPANY' as const, icon: b.ibB, sym: '▣', title: t.deals?.entityCompany || 'Company', desc: 'An established company with a product or service offering.' },
                  { id: 'INDIVIDUAL' as const, icon: b.ibC, sym: '◉', title: t.deals?.entityIndividual || 'Individual', desc: 'A freelancer or independent expert who can deliver directly.' },
                  { id: 'CONSULTANT' as const, icon: b.ibE, sym: '⌘', title: t.deals?.entityConsultant || 'Consultant', desc: 'An advisor who helps evaluate, implement, or guide the solution.' },
                  { id: 'PARTNER' as const, icon: b.ibI, sym: '◇', title: t.deals?.entityPartner || 'Partner', desc: 'A business partner for joint work, collaboration, or broader delivery.' },
                ] as const).map(o => (
                  <div key={o.id} className={targetEntityType === o.id ? b.pcA : b.pc} onClick={() => setTargetEntityType(o.id)}>
                    <div className={o.icon}>{o.sym}</div>
                    <div className={b.pt}>{o.title}</div>
                    <div className={b.pd}>{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Buyer Role */}
            <div className={b.f}><span className={b.lbl}>{t.deals?.buyerRole || 'Your Role as Buyer'}</span>
              <select value={buyerRole} onChange={e => setBuyerRole(e.target.value)} className={b.sel}>
                <option value="">{t.deals?.buyerRolePlaceholder || 'Select your role'}</option>
                {BUYER_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className={b.hlp}>{t.deals?.buyerRoleHelper || 'How you participate in the buying decision.'}</div>
            </div>

            {/* Provider Size */}
            <div className={b.f}><span className={b.lbl}>{t.deals?.preferredProviderSize || 'Preferred Provider Size'}</span>
              <select value={companySize} onChange={e => setCompanySize(e.target.value as any)} className={b.sel}>
                <option value="">{t.deals?.companySizePlaceholder || 'Select company size'}</option>
                <option value="SMALL">{t.deals?.sizeSmall || 'Small (1-50 employees)'}</option>
                <option value="MEDIUM">{t.deals?.sizeMedium || 'Medium (51-500 employees)'}</option>
                <option value="ENTERPRISE">{t.deals?.sizeEnterprise || 'Enterprise (500+ employees)'}</option>
              </select>
            </div>

            {/* Must-Have Requirements */}
            <div className={b.f}><span className={b.lbl}>{t.deals?.mustHaveRequirements || 'Must-Have Requirements'}<span className={b.req}>*</span></span>
              <div className={b.msr}>{BUY_REQUIREMENT_TAGS.map(v => (<button key={v} type="button" onClick={() => toggleRequirement(v)} className={requirementTags.includes(v) ? b.pSel : b.pill}>{requirementTags.includes(v) && '✓ '}{v}</button>))}</div>
            </div>

            {/* Delivery Mode */}
            <div className={b.f}><span className={b.lbl}>{t.deals?.deliveryMode || 'Delivery Mode'}</span>
              <div className={b.msr}>{DELIVERY_MODES.map(o => (<button key={o.value} type="button" onClick={() => setDeliveryMode(deliveryMode === o.value ? '' : o.value)} className={deliveryMode === o.value ? b.pSel : b.pill}>{deliveryMode === o.value && '✓ '}{o.label}</button>))}</div>
            </div>

            {/* Target Market Location */}
            <div className={b.f}><span className={b.lbl}>{t.deals?.targetMarketLocation || 'Target Market Location'}</span><input type="text" value={targetMarketLocation} onChange={e => setTargetMarketLocation(e.target.value)} placeholder={t.deals?.targetMarketLocationPlaceholder || 'e.g. Middle East, North America, Global'} className={b.inp} /></div>

            {/* Ideal Provider Profile */}
            <div className={b.f}><span className={b.lbl}>{t.deals?.idealProviderProfile || 'Ideal Provider Profile'}</span><textarea value={idealProviderProfile} onChange={e => setIdealProviderProfile(e.target.value)} placeholder={t.deals?.idealProviderProfilePlaceholder || 'Describe your ideal provider: experience level, certifications, industry background, delivery track record, team setup, support model, and communication style.'} rows={4} className={b.taMd} /></div>
          </div>
        </section>

        {/* ═══ Budget & Timeline ════════════════════════════════ */}
        <section className={b.budget}>
          <div className={b.hdr}>
            <div className={b.hl}><div className={b.ibI}>◈</div><div><h2 className={b.ht}>{t.deals?.budgetTimeline || 'Budget & Timeline'}</h2><p className={b.hd}>Optional buying context that helps prioritize the most relevant providers.</p></div></div>
            <div className={b.chev}>⌃</div>
          </div>
          <div className={b.fg}>
            <div className={b.f}><span className={b.lbl}>{t.deals?.dealName || 'Request Name'} <span className={b.hlp}>(optional)</span></span><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t.deals?.dealNamePlaceholder || 'Auto-generated if left empty'} className={b.inp} /></div>

            <div className={b.f}><span className={b.lbl}>{'Budget'}<span className={b.req}>*</span></span>
              <div className={b.msr}>{PRICE_RANGES.map(o => (<button key={o.value} type="button" onClick={() => setBudgetRange(budgetRange === o.value ? '' : o.value)} className={budgetRange === o.value ? b.pSel : b.pill}>{budgetRange === o.value && '✓ '}{o.label}</button>))}</div>
            </div>

            <div className={b.f}><span className={b.lbl}>{'When do you need this?'}<span className={b.req}>*</span></span>
              <div className={b.msr}>{BUY_TIMELINES.map(o => (<button key={o.value} type="button" onClick={() => setNeededTimeline(neededTimeline === o.value ? '' : o.value)} className={neededTimeline === o.value ? b.pSel : b.pill}>{neededTimeline === o.value && '✓ '}{o.label}</button>))}</div>
            </div>

            <div className={b.f}><span className={b.lbl}>{'Where are you in the process?'}<span className={b.req}>*</span></span>
              <div className={b.msr}>{BUYING_STAGES.map(o => (<button key={o.value} type="button" onClick={() => setBuyingStage(buyingStage === o.value ? '' : o.value)} className={buyingStage === o.value ? b.pSel : b.pill}>{buyingStage === o.value && '✓ '}{o.label}</button>))}</div>
            </div>

            {/* Industry Tags */}
            <div className={b.f}><span className={b.lbl}>{t.deals?.relevantIndustryTags || 'Relevant Industry Tags'}</span>
              {relevantIndustryTags.length > 0 && <div className={b.msr}>{relevantIndustryTags.map((v, i) => (<span key={`${v}-${i}`} className={b.pSel}>{v} <button type="button" onClick={() => removeIndustryTag(i)} style={{width:18,height:18,borderRadius:999,border:'none',background:'rgba(255,255,255,0.12)',color:'inherit',fontSize:12,display:'inline-grid',placeItems:'center',cursor:'pointer',padding:0,marginInlineStart:4}}>×</button></span>))}</div>}
              <input type="text" value={industryInput} onChange={e => setIndustryInput(e.target.value)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && industryInput.trim()) { e.preventDefault(); addIndustryTag(industryInput); } }} placeholder={t.deals?.relevantIndustryTagsPlaceholder || 'Type and press Enter to add tags'} className={b.inp} />
            </div>
          </div>
        </section>

        {/* ═══ CTA ══════════════════════════════════════════════ */}
        <div className={b.cta}>
          <button type="button" onClick={onCancel} className={b.bO}>{t.deals?.cancel || 'Cancel'}</button>
          <button type="submit" disabled={isSubmitting || (!problemStatement && !solutionType)} className={b.bP}>
            {isSubmitting ? (deal ? (t.deals?.updating || 'Updating...') : (t.deals?.calculating || 'Calculating matches...')) : (deal ? (t.deals?.updateAndRematch || 'Update & Re-Match') : '✧ ' + (t.deals?.findProviders || 'Find Providers in My Network'))}
          </button>
        </div>
      </form>
    </>
  );
}
