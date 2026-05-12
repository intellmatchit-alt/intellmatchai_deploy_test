/**
 * SellForm — Standalone form component for SELL mode deals
 *
 * Used by both /deals/new and /deals/[id]/edit pages.
 * Supports 13 fields: 6 core columns + 7 metadata fields.
 */

'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Money24Regular,
  Sparkle24Regular,
  Target24Regular,
  Settings24Regular,
  Building24Regular,
  Person24Regular,
  PeopleTeam24Regular,
  Handshake24Regular,
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
import { DealDocumentUpload } from '@/components/deals/DealDocumentUpload';
import { CollapsibleSection } from '@/components/deals/CollapsibleSection';
import { PillSelector } from '@/components/deals/PillSelector';
import { QuickTagRow } from '@/components/deals/QuickTagRow';
import { DomainTagInput } from '@/components/deals/DomainTagInput';
import z from './SellForm.module.css';

// ─── Constants ──────────────────────────────────────────────────────
export const SOLUTION_CATEGORIES = [
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

export const SELL_BUYER_TAGS = [
  'Budget Holder', 'Technical Evaluator', 'C-Level', 'SMB Owner',
  'Enterprise Buyer', 'Government / Public Sector', 'Startup Founder', 'Procurement Manager',
];

export const PRICE_RANGES = [
  { value: '< $1K', label: '< $1K' },
  { value: '$1K - $10K', label: '$1K - $10K' },
  { value: '$10K - $50K', label: '$10K - $50K' },
  { value: '$50K - $100K', label: '$50K - $100K' },
  { value: '$100K+', label: '$100K+' },
];

export const SELL_TIMELINES = [
  { value: 'Actively selling now', label: 'Actively Selling' },
  { value: 'Exploring the market', label: 'Exploring Market' },
  { value: 'Future pipeline', label: 'Future Pipeline' },
];

const DELIVERY_MODELS = [
  { value: 'On-premise', label: 'On-premise' },
  { value: 'Cloud/SaaS', label: 'Cloud/SaaS' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Managed Service', label: 'Managed Service' },
  { value: 'Self-service', label: 'Self-service' },
];

const CAPABILITY_TAGS = [
  'Custom Development', 'API Integration', 'Data Migration',
  'Training & Onboarding', '24/7 Support', 'SLA Guarantee',
  'White-label', 'Multi-tenant', 'Compliance (SOC2/ISO)',
  'Localization', 'Mobile Support', 'Analytics & Reporting',
  'Consulting', 'Implementation', 'Managed Services',
];

const DELIVERY_MODE_TAGS = DELIVERY_MODELS.map(d => d.value);

// ─── Helpers ────────────────────────────────────────────────────────

/** Parse structured context [Key: Value] from text for backward compat */
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
  value, onChange, accentColor = 'emerald',
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
                cat === value ? 'bg-emerald-500/20 text-emerald-300' : 'text-th-text hover:bg-th-surface-h'
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

// ─── Entity Type Selector (Provider Type) ────────────────────────────
function ProviderTypeSelector({
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
                ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
            }`}
          >
            {isSelected && <div className="absolute -top-4 -end-4 w-12 h-12 bg-emerald-500/15 rounded-full blur-xl" />}
            <div className="relative">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${isSelected ? 'bg-emerald-500/20' : 'bg-th-surface'}`}>
                <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-th-text-m'}`} />
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
export interface SellFormProps {
  deal?: Deal;
  onSubmit: (data: CreateDealInput | UpdateDealInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

// ═════════════════════════════════════════════════════════════════════
// SellForm Component
// ═════════════════════════════════════════════════════════════════════
export function SellForm({ deal, onSubmit, onCancel, isSubmitting }: SellFormProps) {
  const { t } = useI18n();

  // ── Core fields (6) ───────────────────────────────────────────────
  const [productName, setProductName] = useState('');
  const [solutionType, setSolutionType] = useState('');
  const [domain, setDomain] = useState('');
  const [companySize, setCompanySize] = useState<DealCompanySize | ''>('');
  const [targetDescription, setTargetDescription] = useState('');
  const [title, setTitle] = useState('');

  // ── Metadata fields (10) ─────────────────────────────────────────
  const [industryFocusTags, setIndustryFocusTags] = useState<string[]>([]);
  const [deliveryModel, setDeliveryModel] = useState('');
  const [buyerTags, setBuyerTags] = useState<string[]>([]);
  const [idealCustomerProfile, setIdealCustomerProfile] = useState('');
  const [targetMarketLocation, setTargetMarketLocation] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [salesTimeline, setSalesTimeline] = useState('');
  const [providerType, setProviderType] = useState<DealTargetEntityType | undefined>();
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [deliveryModeCapability, setDeliveryModeCapability] = useState<string[]>([]);

  // ── Populate from existing deal ──────────────────────────────────
  useEffect(() => {
    if (!deal) return;

    setTitle(deal.title || '');
    setProductName(deal.productName || '');
    setSolutionType(deal.solutionType || '');
    setDomain(deal.domain || '');
    setCompanySize((deal.companySize as DealCompanySize) || '');

    // Read metadata if present (new format)
    const meta = deal.metadata || {};
    if (meta.industryFocus) setIndustryFocusTags(Array.isArray(meta.industryFocus) ? meta.industryFocus : []);
    if (meta.deliveryModel) setDeliveryModel(meta.deliveryModel);
    if (meta.idealBuyerType) setBuyerTags(Array.isArray(meta.idealBuyerType) ? meta.idealBuyerType : []);
    if (meta.idealCustomerProfile) setIdealCustomerProfile(meta.idealCustomerProfile);
    if (meta.targetMarketLocation) setTargetMarketLocation(meta.targetMarketLocation);
    if (meta.priceRange) setPriceRange(meta.priceRange);
    if (meta.salesTimeline) setSalesTimeline(meta.salesTimeline);
    if (meta.providerType) setProviderType(meta.providerType as DealTargetEntityType);
    if (meta.capabilities) setCapabilities(Array.isArray(meta.capabilities) ? meta.capabilities : []);
    if (meta.deliveryModeCapability) setDeliveryModeCapability(Array.isArray(meta.deliveryModeCapability) ? meta.deliveryModeCapability : []);
    // Fall back to deal.targetEntityType for providerType
    if (!meta.providerType && deal.targetEntityType) setProviderType(deal.targetEntityType as DealTargetEntityType);

    // Backward compat: parse structured context from targetDescription
    if (deal.targetDescription && !deal.metadata) {
      const { cleanText, context } = parseStructuredContext(deal.targetDescription);
      setTargetDescription(cleanText);
      if (context['Buyer Tags']) {
        setBuyerTags(context['Buyer Tags'].split(',').map(t => t.trim()).filter(Boolean));
      }
      if (context['Price Range']) setPriceRange(context['Price Range']);
      if (context['Timeline']) setSalesTimeline(context['Timeline']);
    } else {
      setTargetDescription(deal.targetDescription || '');
    }
  }, [deal]);

  // ── Auto-save draft (create mode only) ───────────────────────────
  const SELL_STORAGE_KEY = 'deal_sell_draft';
  useEffect(() => {
    if (deal) return; // Don't load draft in edit mode
    const saved = localStorage.getItem(SELL_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.productName) setProductName(data.productName);
        if (data.solutionType) setSolutionType(data.solutionType);
        if (data.domain) setDomain(data.domain);
        if (data.companySize) setCompanySize(data.companySize);
        if (data.targetDescription) setTargetDescription(data.targetDescription);
        if (data.title) setTitle(data.title);
        if (data.buyerTags) setBuyerTags(data.buyerTags);
        if (data.priceRange) setPriceRange(data.priceRange);
        if (data.salesTimeline) setSalesTimeline(data.salesTimeline);
        if (data.deliveryModel) setDeliveryModel(data.deliveryModel);
        if (data.industryFocusTags) setIndustryFocusTags(data.industryFocusTags);
        if (data.idealCustomerProfile) setIdealCustomerProfile(data.idealCustomerProfile);
        if (data.targetMarketLocation) setTargetMarketLocation(data.targetMarketLocation);
        if (data.providerType) setProviderType(data.providerType);
        if (data.capabilities) setCapabilities(data.capabilities);
        if (data.deliveryModeCapability) setDeliveryModeCapability(data.deliveryModeCapability);
      } catch {}
    }
  }, [deal]);

  useEffect(() => {
    if (deal) return;
    const timer = setTimeout(() => {
      const data = { productName, solutionType, domain, companySize, targetDescription, title, buyerTags, priceRange, salesTimeline, deliveryModel, industryFocusTags, idealCustomerProfile, targetMarketLocation, providerType, capabilities, deliveryModeCapability };
      if (Object.values(data).some(v => v && (typeof v === 'string' ? v.length > 0 : (v as string[]).length > 0))) {
        localStorage.setItem(SELL_STORAGE_KEY, JSON.stringify(data));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [deal, productName, solutionType, domain, companySize, targetDescription, title, buyerTags, priceRange, salesTimeline, deliveryModel, industryFocusTags, idealCustomerProfile, targetMarketLocation, providerType, capabilities, deliveryModeCapability]);

  // ── Document extraction ──────────────────────────────────────────
  const handleDocExtracted = (data: ExtractedDealData) => {
    if (data.productName) setProductName(data.productName);
    if (data.solutionType) setSolutionType(data.solutionType);
    if (data.domain) setDomain(data.domain);
    if (data.companySize) setCompanySize(data.companySize as DealCompanySize);
    if (data.targetDescription) setTargetDescription(data.targetDescription);
    if (data.title) setTitle(data.title);
    if (data.priceRange) setPriceRange(data.priceRange);
    if (data.timeline) setSalesTimeline(data.timeline);
    if (data.metadata) {
      if (data.metadata.deliveryModel) setDeliveryModel(data.metadata.deliveryModel);
      if (data.metadata.targetMarketLocation) setTargetMarketLocation(data.metadata.targetMarketLocation);
      if (data.metadata.idealCustomerProfile) setIdealCustomerProfile(data.metadata.idealCustomerProfile);
      if (data.metadata.providerType) setProviderType(data.metadata.providerType as DealTargetEntityType);
      if (data.metadata.capabilities) setCapabilities(Array.isArray(data.metadata.capabilities) ? data.metadata.capabilities : []);
      if (data.metadata.deliveryModeCapability) setDeliveryModeCapability(Array.isArray(data.metadata.deliveryModeCapability) ? data.metadata.deliveryModeCapability : []);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missing: string[] = [];
    if (!productName.trim()) missing.push('Product / Service Name');
    if (!solutionType) missing.push('Solution Category');
    if (!industryFocusTags.length) missing.push('Industry Focus');
    if (!providerType) missing.push('Provider Type');
    if (!capabilities.length) missing.push('Capabilities');
    if (!buyerTags.length) missing.push('Ideal Buyer Type');
    if (!idealCustomerProfile.trim()) missing.push('Ideal Customer Profile');
    if (!priceRange) missing.push('Price Range');
    if (!salesTimeline) missing.push('Sales Timeline');
    if (missing.length > 0) {
      const { toast } = await import('@/components/ui/Toast');
      toast({ title: 'Required fields missing', description: missing.join(', '), variant: 'error' });
      return;
    }

    // Build backward-compat structured context for targetDescription
    const contextParts = buildStructuredContext({
      'Buyer Tags': buyerTags,
      'Price Range': priceRange,
      'Timeline': salesTimeline,
    });
    const fullTarget = [targetDescription || idealCustomerProfile, contextParts].filter(Boolean).join('\n');

    // Auto-generate title if empty
    const autoTitle = title || [productName, solutionType, domain].filter(Boolean).slice(0, 2).join(' \u2014 ') || 'Sell Deal';

    // Build metadata object
    const metadata: Record<string, any> = {};
    if (industryFocusTags.length > 0) metadata.industryFocus = industryFocusTags;
    if (deliveryModel) metadata.deliveryModel = deliveryModel;
    if (buyerTags.length > 0) metadata.idealBuyerType = buyerTags;
    if (idealCustomerProfile) metadata.idealCustomerProfile = idealCustomerProfile;
    if (targetMarketLocation) metadata.targetMarketLocation = targetMarketLocation;
    if (priceRange) metadata.priceRange = priceRange;
    if (salesTimeline) metadata.salesTimeline = salesTimeline;
    if (providerType) metadata.providerType = providerType;
    if (capabilities.length) metadata.capabilities = capabilities;
    if (deliveryModeCapability.length) metadata.deliveryModeCapability = deliveryModeCapability;

    const payload: CreateDealInput | UpdateDealInput = {
      ...(deal ? {} : { mode: 'SELL' as const }),
      title: autoTitle,
      productName: productName || undefined,
      solutionType: solutionType || undefined,
      domain: domain || undefined,
      companySize: companySize || undefined,
      targetEntityType: providerType || undefined,
      targetDescription: fullTarget || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    await onSubmit(payload);

    if (!deal) {
      localStorage.removeItem(SELL_STORAGE_KEY);
    }
  };

  const toggleBuyerTag = (tag: string) => {
    setBuyerTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleCapability = (tag: string) => {
    setCapabilities(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const [capabilityInput, setCapabilityInput] = useState('');
  const addCustomCapability = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || capabilities.includes(trimmed)) return;
    setCapabilities(prev => [...prev, trimmed]);
    setCapabilityInput('');
  };

  const toggleDeliveryCapability = (tag: string) => {
    setDeliveryModeCapability(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // Industry focus tag helpers
  const [industryInput, setIndustryInput] = useState('');
  const addIndustryTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || industryFocusTags.includes(trimmed)) return;
    setIndustryFocusTags(prev => [...prev, trimmed]);
    setIndustryInput('');
  };
  const removeIndustryTag = (index: number) => {
    setIndustryFocusTags(prev => prev.filter((_, i) => i !== index));
  };


  return (
    <>
      {/* ═══ Hero ═══════════════════════════════════════════════ */}
      <section className={z.hero}>
        <div className={z.hdr} style={{marginBottom:0}}>
          <div className={z.hl}>
            <div className={z.ibE} style={{cursor:'pointer'}} onClick={onCancel}>←</div>
            <div><h1 className={z.heroTitle}>{t.deals?.whatYoureSelling || "I Want to Sell"}</h1><p className={z.hd}>Define what you&apos;re offering, who it helps, and who should buy it.</p></div>
          </div>
        </div>
      </section>

      {/* ═══ Upload ═════════════════════════════════════════════ */}
      <section className={z.up}>
        <div className={z.hdr}><div className={z.hl}><div className={z.ibY}>⬆</div><div><h2 className={z.ht}>Quick Fill from Document</h2><p className={z.hd}>Upload a document and AI will extract offering details to speed up form completion.</p></div></div></div>
        <div className={z.dz} tabIndex={0} role="button" onClick={() => document.getElementById('sf-up')?.click()}>
          <input id="sf-up" type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const { extractDealFromDocument } = await import('@/lib/api/deals'); const d = await extractDealFromDocument(f); handleDocExtracted(d); } catch (err: any) { const { toast: t2 } = await import('@/components/ui/Toast'); t2({ title: 'Error', description: err.message, variant: 'error' }); } }} />
          <div className={z.dzA}>↑</div><strong>Drop your file here or click to upload</strong><span>Supports PDF, DOCX, TXT — useful for proposals, product sheets, service decks, and pricing documents.</span>
        </div>
      </section>

      <form onSubmit={handleSubmit} className={z.ss}>

        {/* ═══ What You're Selling ══════════════════════════════ */}
        <section className={z.card}>
          <div className={z.hdr}><div className={z.hl}><div className={z.ibE}>◎</div><div><h2 className={z.ht}>{t.deals?.whatYoureSelling || "What You're Selling"}</h2><p className={z.hd}>Describe the offering clearly so the system can find relevant buyers, sectors, and contacts.</p></div></div></div>
          <div className={z.fg}>
            <div className={z.f}><span className={z.lbl}>{t.deals?.productName || 'Product / Service Name'}<span className={z.req}>*</span></span><input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. CloudCRM Pro, SEO Consulting, Office Space Lease" className={z.inp} /><div className={z.hlp}>{t.deals?.productNameHelper || 'The name of your product, service, or offer.'}</div></div>
            <div className={z.f}><span className={z.lbl}>{t.deals?.solutionCategory || 'Solution Category'}<span className={z.req}>*</span></span><SolutionTypeInput value={solutionType} onChange={setSolutionType} accentColor="emerald" /></div>
            <div className={z.f}><span className={z.lbl}>{t.deals?.industryFocus || 'Industry Focus'}<span className={z.req}>*</span></span><DomainTagInput value={domain} onChange={setDomain} accentColor="emerald" placeholder={t.deals?.domainPlaceholder || 'e.g. Technology, Healthcare, Finance'} /><div className={z.hlp}>{t.deals?.industryHelper || 'Helps match you with contacts in these industries.'}</div></div>

            {/* Provider Type */}
            <div className={z.f}><span className={z.lbl}>{t.deals?.providerTypeSell || 'Provider Type'}<span className={z.req}>*</span></span>
              <div className={z.pg}>
                {([
                  { id: 'COMPANY' as const, icon: z.ibB, sym: '▣', title: t.deals?.entityCompany || 'Company', desc: t.deals?.entityCompanyDesc || 'An established company with a product or service.' },
                  { id: 'INDIVIDUAL' as const, icon: z.ibE, sym: '◉', title: t.deals?.entityIndividual || 'Individual', desc: t.deals?.entityIndividualDesc || 'A freelancer or independent expert offering a service.' },
                  { id: 'CONSULTANT' as const, icon: z.ibC, sym: '⌘', title: t.deals?.entityConsultant || 'Consultant', desc: t.deals?.entityConsultantDesc || 'An advisor who can guide decision-making or transformation work.' },
                  { id: 'PARTNER' as const, icon: z.ibI, sym: '◇', title: t.deals?.entityPartner || 'Partner', desc: t.deals?.entityPartnerDesc || 'A business partner for joint venture, referral, or collaboration models.' },
                ] as const).map(o => (
                  <div key={o.id} className={providerType === o.id ? z.pcA : z.pc} onClick={() => setProviderType(o.id)}>
                    <div className={o.icon}>{o.sym}</div>
                    <div className={z.pt}>{o.title}</div>
                    <div className={z.pd}>{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Model */}
            <div className={z.f}><span className={z.lbl}>{t.deals?.deliveryModel || 'Delivery Model'}</span>
              <div className={z.msr}>{DELIVERY_MODELS.map(o => (<button key={o.value} type="button" onClick={() => setDeliveryModel(deliveryModel === o.value ? '' : o.value)} className={deliveryModel === o.value ? z.pBlu : z.pill}>{deliveryModel === o.value && '✓ '}{o.label}</button>))}</div>
            </div>

            {/* All Delivery Capabilities */}
            <div className={z.f}><span className={z.lbl}>{t.deals?.deliveryModeCapability || 'All Delivery Capabilities'}</span>
              <div className={z.msr}>{DELIVERY_MODE_TAGS.map(v => (<button key={v} type="button" onClick={() => toggleDeliveryCapability(v)} className={deliveryModeCapability.includes(v) ? z.pSel : z.pill}>{deliveryModeCapability.includes(v) && '✓ '}{v}</button>))}</div>
              <div className={z.hlp}>{t.deals?.deliveryModeCapabilityHelper || 'Select all delivery modes you support.'}</div>
            </div>

            {/* Capabilities */}
            <div className={z.f}><span className={z.lbl}>{t.deals?.capabilities || 'Capabilities'}<span className={z.req}>*</span></span>
              <div className={z.ca}><div className={z.cw}>
                {CAPABILITY_TAGS.map(v => (<button key={v} type="button" onClick={() => toggleCapability(v)} className={capabilities.includes(v) ? z.pSel : z.pill}>{capabilities.includes(v) && '✓ '}{v}</button>))}
              </div>
              <div className={z.te}><input type="text" value={capabilityInput} onChange={e => setCapabilityInput(e.target.value)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && capabilityInput.trim()) { e.preventDefault(); addCustomCapability(capabilityInput); } }} placeholder="Add custom capability..." className={z.inp} /><button type="button" onClick={() => addCustomCapability(capabilityInput)} disabled={!capabilityInput.trim()} className={z.tp}>+</button></div>
              </div>
              <div className={z.hlp}>{t.deals?.capabilitiesHelper || 'Key capabilities your offering provides.'}</div>
            </div>
          </div>
        </section>

        {/* ═══ Target Customer ══════════════════════════════════ */}
        <section className={z.card}>
          <div className={z.hdr}><div className={z.hl}><div className={z.ibE}>◌</div><div><h2 className={z.ht}>{t.deals?.targetCustomer || 'Your Target Customer'}</h2><p className={z.hd}>Define your ideal buyer clearly so matching focuses on the right companies and decision-makers.</p></div></div></div>
          <div className={z.fg}>
            <div className={z.f}><span className={z.lbl}>{t.deals?.companySize || 'Target Company Size'}</span>
              <select value={companySize} onChange={e => setCompanySize(e.target.value as any)} className={z.sel}>
                <option value="">{t.deals?.companySizePlaceholder || 'Select company size'}</option>
                <option value="SMALL">{t.deals?.sizeSmall || 'Small (1-50 employees)'}</option>
                <option value="MEDIUM">{t.deals?.sizeMedium || 'Medium (51-500 employees)'}</option>
                <option value="ENTERPRISE">{t.deals?.sizeEnterprise || 'Enterprise (500+ employees)'}</option>
              </select>
            </div>

            <div className={z.f}><span className={z.lbl}>{t.deals?.idealBuyerType || 'Ideal Buyer Type'}<span className={z.req}>*</span></span>
              <div className={z.msr}>{SELL_BUYER_TAGS.map(v => (<button key={v} type="button" onClick={() => toggleBuyerTag(v)} className={buyerTags.includes(v) ? z.pSel : z.pill}>{buyerTags.includes(v) && '✓ '}{v}</button>))}</div>
            </div>

            <div className={z.f}><span className={z.lbl}>Offering Summary</span><textarea value={targetDescription} onChange={e => setTargetDescription(e.target.value)} placeholder="What does your offering do, who does it help, and what problem does it solve?" rows={3} className={z.taSm} /></div>
            <div className={z.f}><span className={z.lbl}>{t.deals?.idealCustomerProfile || 'Ideal Customer Profile'}<span className={z.req}>*</span></span><textarea value={idealCustomerProfile} onChange={e => setIdealCustomerProfile(e.target.value)} placeholder={t.deals?.idealCustomerProfilePlaceholder || 'Detailed profile of your ideal customer: company characteristics, pain points, team size, buying triggers, budget patterns, and urgency.'} rows={4} className={z.taMd} /></div>
            <div className={z.f}><span className={z.lbl}>{t.deals?.targetMarketLocation || 'Target Market Location'}</span><input type="text" value={targetMarketLocation} onChange={e => setTargetMarketLocation(e.target.value)} placeholder={t.deals?.targetMarketLocationPlaceholder || 'e.g. Middle East, North America, Global'} className={z.inp} /></div>
          </div>
        </section>

        {/* ═══ Deal Details (collapsible) ═══════════════════════ */}
        <section className={z.deal}>
          <div className={z.hdr} style={{cursor:'pointer'}} >
            <div className={z.hl}><div className={z.ibB}>◈</div><div><h2 className={z.ht}>{t.deals?.dealDetails || 'Deal Details'}</h2><p className={z.hd}>Optional sales details that help organize targeting and deal prioritization.</p></div></div>
            <div className={z.chev}>⌃</div>
          </div>
          <div className={z.fg}>
            <div className={z.f}><span className={z.lbl}>{t.deals?.dealName || 'Deal Name'} <span className={z.hlp}>(optional)</span></span><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t.deals?.dealNamePlaceholder || 'Auto-generated if left empty'} className={z.inp} /></div>

            {/* Industry Focus Tags */}
            <div className={z.f}><span className={z.lbl}>{t.deals?.industryFocusTags || 'Industry Focus Tags'}</span>
              {industryFocusTags.length > 0 && <div className={z.cw}>{industryFocusTags.map((v, i) => (<span key={`${v}-${i}`} className={z.pSel}>{v} <button type="button" onClick={() => removeIndustryTag(i)} className={z.tp} style={{width:18,height:18,minHeight:18,fontSize:12,borderRadius:999,border:'none',background:'rgba(255,255,255,0.12)'}}>×</button></span>))}</div>}
              <input type="text" value={industryInput} onChange={e => setIndustryInput(e.target.value)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && industryInput.trim()) { e.preventDefault(); addIndustryTag(industryInput); } }} placeholder={t.deals?.industryFocusTagsPlaceholder || 'Type and press Enter to add tags'} className={z.inp} />
            </div>

            <div className={z.f}><span className={z.lbl}>{t.deals?.priceRange || 'Price Range'}<span className={z.req}>*</span></span>
              <div className={z.msr}>{PRICE_RANGES.map(o => (<button key={o.value} type="button" onClick={() => setPriceRange(priceRange === o.value ? '' : o.value)} className={priceRange === o.value ? z.pSel : z.pill}>{priceRange === o.value && '✓ '}{o.label}</button>))}</div>
            </div>

            <div className={z.f}><span className={z.lbl}>{t.deals?.sellTimeline || 'Sales Timeline'}<span className={z.req}>*</span></span>
              <div className={z.msr}>{SELL_TIMELINES.map(o => (<button key={o.value} type="button" onClick={() => setSalesTimeline(salesTimeline === o.value ? '' : o.value)} className={salesTimeline === o.value ? z.pSel : z.pill}>{salesTimeline === o.value && '✓ '}{o.label}</button>))}</div>
            </div>
          </div>
        </section>

        {/* ═══ CTA ══════════════════════════════════════════════ */}
        <div className={z.cta}>
          <button type="button" onClick={onCancel} className={z.bO}>{t.deals?.cancel || 'Cancel'}</button>
          <button type="submit" disabled={isSubmitting || (!productName && !solutionType)} className={z.bP}>
            {isSubmitting ? (deal ? (t.deals?.updating || 'Updating...') : (t.deals?.calculating || 'Calculating matches...')) : (deal ? (t.deals?.updateAndRematch || 'Update & Re-Match') : '✧ ' + (t.deals?.findBuyers || 'Find Buyers in My Network'))}
          </button>
        </div>
      </form>
    </>
  );
}
