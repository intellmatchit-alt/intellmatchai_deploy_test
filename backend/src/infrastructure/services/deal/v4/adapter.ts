/**
 * Deal v4.1 Adapter
 *
 * Bridges Prisma data (DealRequest + Contact + interaction stats) to the
 * engine types that v4 / helper engines expect. This is the ONLY place that
 * touches the Prisma rows shape; the engine itself stays pure.
 *
 * Convention used here for the candidate pool:
 *   - The CRM Contact represents the counterparty / helper. We synthesize a
 *     SellOffering or BuyRequest from a Contact's profile fields so the v4
 *     engine has structured surfaces to score against, while preserving
 *     legacy "match against my contacts" semantics.
 *   - Helper candidates use the Contact directly with no synthesis.
 *
 * Cutover note: this adapter is invoked only when DEAL_ENGINE_V4=true; the
 * legacy code path is otherwise untouched (zero regression by default).
 */

import {
  BuyRequest, SellOffering, SolutionCategory, ProviderType, BudgetRange,
  CompanySize, NeededTimeline, BuyingStage, DeliveryMode, BuyerType,
  TargetCompanySize, SalesTimeline, BuyerRole, DeliveryModel,
} from './types';
import { HelperCandidate } from './helper-types';
import { NetworkContext } from './network.utils';

// ---------------------------------------------------------------------------
// Inputs the adapter accepts (kept loose; works with Prisma-shaped objects
// without dragging the @prisma/client types into the v4 module surface)
// ---------------------------------------------------------------------------

export interface DealRequestRow {
  id: string;
  userId: string;
  mode: 'BUY' | 'SELL';
  title?: string | null;
  domain?: string | null;
  solutionType?: string | null;
  companySize?: string | null;
  problemStatement?: string | null;
  targetEntityType?: string | null;
  productName?: string | null;
  targetDescription?: string | null;
  buyerRole?: string | null;
  metadata?: Record<string, any> | null;
  dataQualityScore?: number | null;
  embedding?: number[] | null | unknown;
  isActive?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactRow {
  id: string;
  ownerId: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  bioFull?: string | null;
  bioSummary?: string | null;
  organizationId?: string | null;
  matchScore?: { toNumber?: () => number } | number | null;
  lastInteractionAt?: Date | null;
  enrichmentData?: any;
  // optional taxonomy / interaction stats supplied by the caller
  sectors?: string[];
  skills?: string[];
  interests?: string[];
  interactionCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers: enum coercion with safe defaults
// ---------------------------------------------------------------------------

function toSolutionCategory(s?: string | null): SolutionCategory {
  if (!s) return SolutionCategory.OTHER;
  const norm = s.toUpperCase().replace(/[\s/]+/g, '_');
  const known = (SolutionCategory as Record<string, string>)[norm];
  if (known) return known as SolutionCategory;
  // Soft mappings for free-text solutionType
  const t = s.toLowerCase();
  if (/(saas|software|platform|app)/.test(t)) return SolutionCategory.SAAS_SOFTWARE;
  if (/(consult|advis)/.test(t)) return SolutionCategory.CONSULTING_ADVISORY;
  if (/(integration|api|middleware)/.test(t)) return SolutionCategory.INTEGRATION;
  if (/(manage|operations)/.test(t)) return SolutionCategory.MANAGED_SERVICES;
  if (/(staff|recruit|talent)/.test(t)) return SolutionCategory.STAFFING;
  if (/(market|brand|seo|content)/.test(t)) return SolutionCategory.MARKETING;
  if (/(legal|compliance|gdpr)/.test(t)) return SolutionCategory.LEGAL;
  if (/(finance|account|tax)/.test(t)) return SolutionCategory.FINANCIAL;
  if (/(train|educat|course)/.test(t)) return SolutionCategory.TRAINING_EDUCATION;
  if (/(hardware|device|equipment)/.test(t)) return SolutionCategory.HARDWARE;
  return SolutionCategory.OTHER;
}

function toProviderType(s?: string | null): ProviderType {
  if (!s) return ProviderType.COMPANY;
  const norm = s.toUpperCase();
  const known = (ProviderType as Record<string, string>)[norm];
  return (known as ProviderType) ?? ProviderType.COMPANY;
}

function toCompanySize(s?: string | null): CompanySize | undefined {
  if (!s) return undefined;
  const norm = s.toUpperCase();
  if (norm in CompanySize) return (CompanySize as Record<string, string>)[norm] as CompanySize;
  // map legacy DealCompanySize → engine CompanySize
  if (norm === 'SMALL') return CompanySize.SMALL;
  if (norm === 'MEDIUM') return CompanySize.MEDIUM;
  if (norm === 'ENTERPRISE') return CompanySize.ENTERPRISE;
  return undefined;
}

function toTargetCompanySize(s?: string | null): TargetCompanySize {
  if (!s) return TargetCompanySize.NO_PREFERENCE;
  const norm = s.toUpperCase();
  if (norm in TargetCompanySize) return (TargetCompanySize as Record<string, string>)[norm] as TargetCompanySize;
  if (norm === 'SMALL') return TargetCompanySize.SMALL_BUSINESS;
  if (norm === 'MEDIUM') return TargetCompanySize.MID_MARKET;
  if (norm === 'ENTERPRISE') return TargetCompanySize.ENTERPRISE;
  return TargetCompanySize.NO_PREFERENCE;
}

function toBudgetRange(s?: string | null): BudgetRange {
  if (!s) return BudgetRange.CUSTOM;
  const norm = s.toUpperCase().replace(/[\s$+]+/g, '_').replace(/_+/g, '_');
  const known = (BudgetRange as Record<string, string>)[norm];
  return (known as BudgetRange) ?? BudgetRange.CUSTOM;
}

function toNeededTimeline(s?: string | null): NeededTimeline {
  if (!s) return NeededTimeline.EXPLORING;
  const norm = s.toUpperCase().replace(/[\s-]+/g, '_');
  const known = (NeededTimeline as Record<string, string>)[norm];
  if (known) return known as NeededTimeline;
  if (/(immediate|asap|urgent)/i.test(s)) return NeededTimeline.IMMEDIATELY;
  if (/(1.?month|30.?day)/i.test(s)) return NeededTimeline.WITHIN_1_MONTH;
  if (/(3.?month|q[1-4])/i.test(s)) return NeededTimeline.WITHIN_3_MONTHS;
  if (/(6.?month|half|year)/i.test(s)) return NeededTimeline.WITHIN_6_MONTHS;
  return NeededTimeline.EXPLORING;
}

function toBuyingStage(s?: string | null): BuyingStage {
  if (!s) return BuyingStage.EXPLORING;
  const norm = s.toUpperCase().replace(/[\s-]+/g, '_');
  const known = (BuyingStage as Record<string, string>)[norm];
  return (known as BuyingStage) ?? BuyingStage.EXPLORING;
}

function toDeliveryMode(s?: string | null): DeliveryMode | undefined {
  if (!s) return undefined;
  const norm = s.toUpperCase();
  const known = (DeliveryMode as Record<string, string>)[norm];
  return known as DeliveryMode | undefined;
}

function toDeliveryModeArray(arr?: string[] | null): DeliveryMode[] | undefined {
  if (!arr?.length) return undefined;
  const out: DeliveryMode[] = [];
  for (const s of arr) { const m = toDeliveryMode(s); if (m) out.push(m); }
  return out;
}

function toDeliveryModel(s?: string | null): DeliveryModel | undefined {
  if (!s) return undefined;
  const norm = s.toUpperCase().replace(/[\s-]+/g, '_');
  const known = (DeliveryModel as Record<string, string>)[norm];
  return known as DeliveryModel | undefined;
}

function toBuyerRole(s?: string | null): BuyerRole | undefined {
  if (!s) return undefined;
  const norm = s.toUpperCase().replace(/[\s-]+/g, '_');
  const known = (BuyerRole as Record<string, string>)[norm];
  return known as BuyerRole | undefined;
}

function toBuyerTypeArray(arr?: string[] | null): BuyerType[] {
  if (!arr?.length) return [BuyerType.DEPARTMENT_HEAD];
  const out: BuyerType[] = [];
  for (const s of arr) {
    const norm = s.toUpperCase().replace(/[\s-]+/g, '_');
    const known = (BuyerType as Record<string, string>)[norm];
    if (known) out.push(known as BuyerType);
  }
  return out.length ? out : [BuyerType.DEPARTMENT_HEAD];
}

function toSalesTimeline(s?: string | null): SalesTimeline {
  if (!s) return SalesTimeline.EXPLORING_MARKET;
  const norm = s.toUpperCase().replace(/[\s-]+/g, '_');
  const known = (SalesTimeline as Record<string, string>)[norm];
  return (known as SalesTimeline) ?? SalesTimeline.EXPLORING_MARKET;
}

function metaArr(meta: Record<string, any> | null | undefined, ...keys: string[]): string[] {
  if (!meta) return [];
  for (const k of keys) {
    const v = meta[k];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  }
  return [];
}

function metaStr(meta: Record<string, any> | null | undefined, ...keys: string[]): string | undefined {
  if (!meta) return undefined;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return undefined;
}

function decimalToNumber(v: ContactRow['matchScore']): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  return 0;
}

// ---------------------------------------------------------------------------
// 1. DealRequest → BuyRequest (BUY mode)
// ---------------------------------------------------------------------------

export function dealRequestToBuyRequest(d: DealRequestRow): BuyRequest {
  const meta = d.metadata || {};
  const industries = metaArr(meta, 'relevantIndustryTags', 'relevantIndustry')
    .concat(d.domain ? [d.domain] : []);
  return {
    id: d.id,
    ownerId: d.userId,
    requestDocumentFile: undefined,
    whatYouNeed: d.problemStatement || d.title || d.targetDescription || '',
    solutionCategory: toSolutionCategory(d.solutionType),
    relevantIndustry: dedupeStrings(industries),
    providerType: toProviderType(d.targetEntityType),
    preferredProviderSize: toCompanySize(d.companySize),
    mustHaveRequirements: metaArr(meta, 'mustHaveRequirements', 'requirementTags'),
    budgetRange: toBudgetRange(metaStr(meta, 'budgetRange')),
    neededTimeline: toNeededTimeline(metaStr(meta, 'neededTimeline')),
    buyingStage: toBuyingStage(metaStr(meta, 'buyingStage')),
    targetMarketLocation: metaStr(meta, 'targetMarketLocation'),
    deliveryMode: toDeliveryMode(metaStr(meta, 'deliveryMode')),
    idealProviderProfile: metaStr(meta, 'idealProviderProfile'),
    requestName: d.title || undefined,
    buyerRole: toBuyerRole(d.buyerRole),
    embedding: Array.isArray(d.embedding) ? (d.embedding as number[]) : undefined,
    dataQualityScore: d.dataQualityScore || 50,
    isActive: d.isActive !== false,
    isDeleted: false,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    source: 'MANUAL',
  };
}

// ---------------------------------------------------------------------------
// 2. DealRequest → SellOffering (SELL mode)
// ---------------------------------------------------------------------------

export function dealRequestToSellOffering(d: DealRequestRow): SellOffering {
  const meta = d.metadata || {};
  const industries = metaArr(meta, 'industryFocus', 'industryFocusTags')
    .concat(d.domain ? [d.domain] : []);
  return {
    id: d.id,
    ownerId: d.userId,
    productServiceName: d.productName || d.title || 'Untitled offering',
    offeringSummary: d.targetDescription || d.problemStatement || '',
    solutionCategory: toSolutionCategory(d.solutionType),
    industryFocus: dedupeStrings(industries),
    providerType: toProviderType(metaStr(meta, 'providerType') ?? d.targetEntityType),
    deliveryModel: toDeliveryModel(metaStr(meta, 'deliveryModel')),
    targetCompanySize: toTargetCompanySize(d.companySize),
    companySize: toCompanySize(metaStr(meta, 'providerCompanySize') ?? d.companySize),
    idealBuyerType: toBuyerTypeArray(metaArr(meta, 'idealBuyerType', 'buyerTags')),
    idealCustomerProfile: metaStr(meta, 'idealCustomerProfile') || d.targetDescription || '',
    targetMarketLocation: metaStr(meta, 'targetMarketLocation'),
    priceRange: toBudgetRange(metaStr(meta, 'priceRange', 'budgetRange')),
    salesTimeline: toSalesTimeline(metaStr(meta, 'salesTimeline')),
    dealName: d.title || undefined,
    capabilities: metaArr(meta, 'capabilities'),
    deliveryModeCapability: toDeliveryModeArray(metaArr(meta, 'deliveryModeCapability')),
    embedding: Array.isArray(d.embedding) ? (d.embedding as number[]) : undefined,
    dataQualityScore: d.dataQualityScore || 50,
    isActive: d.isActive !== false,
    isDeleted: false,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    source: 'MANUAL',
  };
}

// ---------------------------------------------------------------------------
// 3. Contact → SellOffering (when deal is BUY mode and contact is candidate seller)
// ---------------------------------------------------------------------------

export function contactToSellOffering(c: ContactRow, dealHints: { fallbackCategory?: SolutionCategory; fallbackIndustry?: string[] } = {}): SellOffering {
  const sectors = c.sectors ?? [];
  const skills = c.skills ?? [];
  const bio = c.bioFull || c.bio || c.bioSummary || '';

  // Heuristic: derive solutionCategory from skills/bio
  const inferredCategory = inferSolutionCategoryFromText([...skills, bio].join(' '))
    ?? dealHints.fallbackCategory ?? SolutionCategory.OTHER;

  return {
    id: `contact-as-sell:${c.id}`,
    ownerId: c.ownerId,
    organizationId: c.organizationId ?? undefined,
    productServiceName: c.fullName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Contact',
    offeringSummary: bio || `${c.jobTitle ?? ''} at ${c.company ?? ''}`.trim(),
    solutionCategory: inferredCategory,
    industryFocus: sectors.length ? sectors : (dealHints.fallbackIndustry ?? []),
    providerType: ProviderType.INDIVIDUAL,
    deliveryModel: undefined,
    targetCompanySize: TargetCompanySize.NO_PREFERENCE,
    companySize: CompanySize.INDIVIDUAL_SOLO,
    idealBuyerType: [BuyerType.DEPARTMENT_HEAD],
    idealCustomerProfile: bio,
    priceRange: BudgetRange.CUSTOM,
    salesTimeline: SalesTimeline.EXPLORING_MARKET,
    capabilities: skills,
    deliveryModeCapability: undefined,
    dataQualityScore: bio ? 60 : 35,
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: 'MANUAL',
  };
}

// ---------------------------------------------------------------------------
// 4. Contact → BuyRequest (when deal is SELL mode and contact is candidate buyer)
// ---------------------------------------------------------------------------

export function contactToBuyRequest(c: ContactRow, dealHints: { fallbackCategory?: SolutionCategory; fallbackIndustry?: string[] } = {}): BuyRequest {
  const sectors = c.sectors ?? [];
  const skills = c.skills ?? [];
  const interests = c.interests ?? [];
  const bio = c.bioFull || c.bio || c.bioSummary || '';

  return {
    id: `contact-as-buy:${c.id}`,
    ownerId: c.ownerId,
    organizationId: c.organizationId ?? undefined,
    whatYouNeed: bio || `${c.jobTitle ?? ''} at ${c.company ?? ''}`.trim() || 'Contact',
    solutionCategory: inferSolutionCategoryFromText([...skills, bio].join(' '))
      ?? dealHints.fallbackCategory ?? SolutionCategory.OTHER,
    relevantIndustry: sectors.length ? sectors : (dealHints.fallbackIndustry ?? []),
    providerType: ProviderType.COMPANY,
    mustHaveRequirements: interests.slice(0, 5),
    budgetRange: BudgetRange.CUSTOM,
    neededTimeline: NeededTimeline.EXPLORING,
    buyingStage: BuyingStage.EXPLORING,
    deliveryMode: undefined,
    idealProviderProfile: bio,
    dataQualityScore: bio ? 60 : 35,
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: 'MANUAL',
  };
}

// ---------------------------------------------------------------------------
// 5. Contact → HelperCandidate (helper flows)
// ---------------------------------------------------------------------------

export function contactToHelperCandidate(c: ContactRow): HelperCandidate {
  const jobTitle = (c.jobTitle || '').toLowerCase();
  const jobAreas = inferJobTitleAreas(jobTitle);
  const seniority = inferSeniorityHints(jobTitle);
  const lastInteractionDays = c.lastInteractionAt
    ? Math.floor((Date.now() - new Date(c.lastInteractionAt).getTime()) / 86400000)
    : null;

  return {
    id: c.id,
    userId: undefined, // Contact ≠ User; future cross-reference via email
    fullName: c.fullName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Contact',
    jobTitle: c.jobTitle ?? null,
    jobTitleAreas: jobAreas,
    company: c.company ?? null,
    organizationId: c.organizationId ?? null,
    industries: c.sectors ?? [],
    seniorityHints: seniority,
    bio: c.bioFull || c.bio || c.bioSummary || null,
    email: c.email ?? null,
    worksAtTargetOrg: false, // adapter has no target counterparty pinned today
    targetRoleProximity: jobAreas.length ? 'ADJACENT' : 'NONE',

    isFirstDegree: true, // contact in user's CRM = 1st degree by definition
    isSecondDegree: false,
    sameOrganization: false,
    mutualConnections: 0,
    relationshipStrength: clampRelationshipStrength(decimalToNumber(c.matchScore)),
    interactionCount: c.interactionCount ?? 0,
    lastInteractionDays,
    signals: undefined,
  };
}

// ---------------------------------------------------------------------------
// 6. Network context for a contact (used in direct flow scoring)
// ---------------------------------------------------------------------------

export function networkContextForContact(c: ContactRow): NetworkContext {
  const lastInteractionDays = c.lastInteractionAt
    ? Math.floor((Date.now() - new Date(c.lastInteractionAt).getTime()) / 86400000)
    : null;
  return {
    isFirstDegree: true,
    isSecondDegree: false,
    sameOrganization: false,
    mutualConnections: 0,
    relationshipStrength: clampRelationshipStrength(decimalToNumber(c.matchScore)),
    interactionCount: c.interactionCount ?? 0,
    lastInteractionDays,
    notes: [],
  };
}

// ---------------------------------------------------------------------------
// Internal heuristics
// ---------------------------------------------------------------------------

function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = (s || '').toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(s);
  }
  return out;
}

function clampRelationshipStrength(raw: number): number {
  if (Number.isNaN(raw) || !Number.isFinite(raw)) return 0;
  if (raw <= 1) return Math.max(0, Math.min(1, raw));
  return Math.max(0, Math.min(1, raw / 100));
}

function inferSolutionCategoryFromText(text: string): SolutionCategory | null {
  const t = text.toLowerCase();
  if (/(saas|software|developer|engineer|product|platform)/.test(t)) return SolutionCategory.SAAS_SOFTWARE;
  if (/(consult|advis|strategy)/.test(t)) return SolutionCategory.CONSULTING_ADVISORY;
  if (/(integration|api|middleware)/.test(t)) return SolutionCategory.INTEGRATION;
  if (/(market|brand|seo|growth|content)/.test(t)) return SolutionCategory.MARKETING;
  if (/(legal|compliance|regulator)/.test(t)) return SolutionCategory.LEGAL;
  if (/(finance|account|tax|cfo|controller)/.test(t)) return SolutionCategory.FINANCIAL;
  if (/(train|coach|learn)/.test(t)) return SolutionCategory.TRAINING_EDUCATION;
  return null;
}

const JOB_AREA_RULES: Array<[RegExp, string]> = [
  [/(sales|account executive|ae|business development|bd)/, 'sales'],
  [/(business development)/, 'business development'],
  [/(partnership|alliance|channel)/, 'partnerships'],
  [/(procurement|sourcing|vendor management)/, 'procurement'],
  [/(consult|advisor)/, 'consulting'],
  [/(market|growth)/, 'marketing'],
  [/(engineer|developer|cto|tech)/, 'engineering'],
  [/(product manager|product lead)/, 'product'],
  [/(operations|coo)/, 'operations'],
  [/(finance|cfo|controller)/, 'finance'],
  [/(customer success|cs)/, 'customer success'],
  [/(pre-sales|solutions engineer|se)/, 'pre-sales'],
];

function inferJobTitleAreas(title: string): string[] {
  const out = new Set<string>();
  for (const [re, area] of JOB_AREA_RULES) if (re.test(title)) out.add(area);
  return Array.from(out);
}

function inferSeniorityHints(title: string): ('JUNIOR' | 'MID' | 'SENIOR' | 'EXECUTIVE')[] {
  const out = new Set<'JUNIOR' | 'MID' | 'SENIOR' | 'EXECUTIVE'>();
  if (/(ceo|cto|cfo|coo|cmo|chief|founder|president|vp|vice president|head of)/i.test(title)) out.add('EXECUTIVE');
  if (/(director|principal|lead|senior|sr\.)/i.test(title)) out.add('SENIOR');
  if (/(manager|specialist|analyst)/i.test(title) && !/(senior|sr\.)/i.test(title)) out.add('MID');
  if (/(intern|junior|jr\.|associate)/i.test(title)) out.add('JUNIOR');
  if (out.size === 0) out.add('MID');
  return Array.from(out);
}
