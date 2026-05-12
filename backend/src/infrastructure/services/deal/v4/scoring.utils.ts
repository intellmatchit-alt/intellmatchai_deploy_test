/**
 * Deal Matching Scoring Utilities
 * v4.0.0 — strict final production
 *
 * v4 changes: expanded requirement concepts (25+ groups), semantic sub-score
 * evidence, buyerRole-aware persona scoring, location hard filter for explicit
 * constraint, stricter sparse data threshold.
 */

import {
  BuyRequest, SellOffering, DealMatchResult, DealScoringWeights, DEFAULT_DEAL_WEIGHTS, DEFAULT_DEAL_THRESHOLDS,
  SolutionCategory, BudgetRange, NeededTimeline, BuyingStage, SalesTimeline,
  CompanySize, TargetCompanySize, DeliveryMode,
  areBudgetsCompatible, ProviderType, BuyerType, BuyerRole,
} from './types';
import {
  HardFilterStatus, HardFilterReason, HardFilterResult, ScoringComponent, ScoreBreakdown, FieldMatch,
  createPassResult, createFailResult, createReviewResult, combineHardFilterResults,
  calculateTagOverlap, textSimilarity, clampScore,
} from './common';

// ============================================================================
// REQUIREMENT CONCEPT GROUPS — v4: expanded to 25+ groups
// ============================================================================

const REQUIREMENT_CONCEPTS: Record<string, string[]> = {
  api: ['api', 'rest api', 'graphql', 'webhook', 'api integration', 'endpoints', 'sdk', 'api access'],
  integration: ['integration', 'api', 'connect', 'sync', 'import', 'export', 'webhook', 'zapier', 'middleware', 'data sync', 'interoperability'],
  security: ['security', 'encryption', 'sso', 'soc2', 'soc 2', 'gdpr', 'hipaa', 'iso 27001', 'penetration testing', 'mfa', '2fa', 'rbac', 'zero trust', 'data protection'],
  compliance: ['compliance', 'gdpr', 'hipaa', 'soc2', 'pci', 'iso', 'audit', 'regulatory', 'data residency', 'privacy', 'ccpa'],
  scalable: ['scalable', 'scale', 'high availability', 'elastic', 'auto-scaling', 'enterprise-grade', 'load balancing', 'horizontal scaling'],
  cloud: ['cloud', 'saas', 'aws', 'azure', 'gcp', 'hosted', 'cloud-native', 'multi-cloud', 'serverless', 'iaas', 'paas'],
  mobile: ['mobile', 'ios', 'android', 'responsive', 'mobile app', 'native app', 'pwa', 'cross-platform'],
  analytics: ['analytics', 'reporting', 'dashboard', 'insights', 'bi', 'business intelligence', 'metrics', 'kpi', 'data analysis', 'visualization'],
  reporting: ['reporting', 'reports', 'dashboard', 'analytics', 'export', 'data visualization', 'scheduled reports', 'custom reports'],
  automation: ['automation', 'workflow', 'rpa', 'automated', 'bot', 'orchestration', 'trigger', 'rule engine', 'no-code', 'low-code'],
  ai: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'nlp', 'deep learning', 'predictive', 'generative ai', 'chatbot', 'intelligent'],
  support: ['support', '24/7', 'sla', 'customer success', 'helpdesk', 'onboarding', 'dedicated support', 'technical support', 'account manager'],
  customization: ['customization', 'custom', 'configurable', 'white-label', 'branding', 'personalization', 'theming', 'flexible'],
  multilingual: ['multilingual', 'multi-language', 'localization', 'l10n', 'i18n', 'translation', 'rtl'],
  performance: ['performance', 'fast', 'low latency', 'speed', 'uptime', '99.9%', 'sla', 'response time', 'throughput'],
  data_management: ['data management', 'database', 'data warehouse', 'etl', 'data pipeline', 'data lake', 'backup', 'disaster recovery'],
  user_management: ['user management', 'rbac', 'permissions', 'roles', 'access control', 'sso', 'ldap', 'active directory', 'multi-tenant'],
  ecommerce: ['ecommerce', 'payment', 'stripe', 'checkout', 'cart', 'inventory', 'order management', 'shipping', 'marketplace'],
  crm: ['crm', 'customer relationship', 'salesforce', 'hubspot', 'lead management', 'pipeline', 'contact management'],
  erp: ['erp', 'enterprise resource planning', 'sap', 'oracle', 'netsuite', 'inventory', 'procurement', 'supply chain'],
  communication: ['communication', 'messaging', 'chat', 'video', 'email', 'notifications', 'push', 'sms', 'slack', 'teams'],
  document: ['document', 'file management', 'storage', 'pdf', 'collaboration', 'versioning', 'digital signature', 'e-sign'],
  project_management: ['project management', 'task', 'kanban', 'agile', 'sprint', 'jira', 'asana', 'trello', 'gantt'],
  training: ['training', 'onboarding', 'documentation', 'knowledge base', 'tutorial', 'certification', 'lms'],
  open_source: ['open source', 'self-hosted', 'on-premise', 'source code', 'open-source', 'community edition'],
};

function isRequirementCovered(requirement: string, capabilityCorpus: string): boolean {
  const reqLower = requirement.toLowerCase().trim();
  const corpus = capabilityCorpus.toLowerCase();
  if (corpus.includes(reqLower)) return true;
  for (const [, synonyms] of Object.entries(REQUIREMENT_CONCEPTS)) {
    if (reqLower === synonyms[0] || synonyms.some(s => reqLower.includes(s) || s.includes(reqLower))) {
      if (synonyms.some(s => corpus.includes(s))) return true;
    }
  }
  const tokens = reqLower.split(/\s+/).filter(t => t.length > 2);
  if (tokens.length > 0 && tokens.filter(t => corpus.includes(t)).length >= Math.max(1, Math.ceil(tokens.length * 0.6))) return true;
  return false;
}

function buildSellerCapabilityCorpus(sell: SellOffering): string {
  return [...(sell.capabilities || []), ...(sell.tags?.merged || []), sell.offeringSummary || '', sell.idealCustomerProfile || '', sell.productServiceName || '', ...(sell.industryFocus || [])].join(' ').toLowerCase();
}

// ============================================================================
// HARD FILTERS — v4: preserved from v3, added location hard filter
// ============================================================================

export function runDealHardFilters(buy: BuyRequest, sell: SellOffering): HardFilterResult {
  return combineHardFilterResults([
    checkActiveStatus(buy, sell),
    checkCategoryCompatibility(buy, sell),
    checkBudgetCompatibility(buy, sell),
    checkRequirementsSatisfaction(buy, sell),
    checkProviderTypeCompatibility(buy, sell),
    checkDeliveryCompatibility(buy, sell),
    checkTimelineUrgency(buy, sell),
    checkLocationConstraint(buy, sell),
    checkDataQuality(buy, sell),
  ]);
}

function checkActiveStatus(b: BuyRequest, s: SellOffering): HardFilterResult {
  if (b.isDeleted || s.isDeleted) return createFailResult(HardFilterReason.BLOCKED, 'Record deleted', []);
  if (!b.isActive || !s.isActive) return createFailResult(HardFilterReason.OPT_OUT, 'Inactive', []);
  return createPassResult();
}

function checkCategoryCompatibility(b: BuyRequest, s: SellOffering): HardFilterResult {
  if (b.solutionCategory === s.solutionCategory) return createPassResult();
  const groups: SolutionCategory[][] = [
    [SolutionCategory.SAAS_SOFTWARE, SolutionCategory.MANAGED_SERVICES],
    [SolutionCategory.CONSULTING_ADVISORY, SolutionCategory.PROFESSIONAL_SERVICES],
    [SolutionCategory.TRAINING_EDUCATION, SolutionCategory.CONSULTING_ADVISORY],
    [SolutionCategory.STAFFING, SolutionCategory.PROFESSIONAL_SERVICES],
    [SolutionCategory.INTEGRATION, SolutionCategory.SAAS_SOFTWARE],
  ];
  for (const g of groups) if (g.includes(b.solutionCategory) && g.includes(s.solutionCategory)) return createReviewResult(HardFilterReason.CATEGORY_MISMATCH, 'Related categories', []);
  if (b.solutionCategory === SolutionCategory.OTHER || s.solutionCategory === SolutionCategory.OTHER) return createReviewResult(HardFilterReason.CATEGORY_MISMATCH, 'OTHER category', []);
  return createFailResult(HardFilterReason.CATEGORY_MISMATCH, 'Incompatible categories', [`Buyer: ${b.solutionCategory}`, `Seller: ${s.solutionCategory}`]);
}

function checkBudgetCompatibility(b: BuyRequest, s: SellOffering): HardFilterResult {
  const { compatible, gap } = areBudgetsCompatible(b.budgetRange, s.priceRange);
  if (compatible) return createPassResult();
  if (gap === 'GAP') return createReviewResult(HardFilterReason.BUDGET_MISMATCH, 'Moderate budget gap', [`B: ${b.budgetRange}, S: ${s.priceRange}`]);
  return createFailResult(HardFilterReason.BUDGET_MISMATCH, 'Budget incompatible', [`B: ${b.budgetRange}, S: ${s.priceRange}`]);
}

function checkRequirementsSatisfaction(b: BuyRequest, s: SellOffering): HardFilterResult {
  if (!b.mustHaveRequirements?.length) return createPassResult();
  const corpus = buildSellerCapabilityCorpus(s);
  let covered = 0; const missing: string[] = [];
  for (const r of b.mustHaveRequirements) { if (isRequirementCovered(r, corpus)) covered++; else missing.push(r); }
  const cov = covered / b.mustHaveRequirements.length;
  if (cov >= 0.7) return createPassResult();
  if (cov >= 0.4) return createReviewResult(HardFilterReason.REQUIREMENTS_NOT_MET, `${Math.round(cov * 100)}% met`, [`Missing: ${missing.slice(0, 3).join(', ')}`]);
  return createFailResult(HardFilterReason.REQUIREMENTS_NOT_MET, 'Most requirements unmet', [`Missing: ${missing.slice(0, 5).join(', ')}`]);
}

function checkProviderTypeCompatibility(b: BuyRequest, s: SellOffering): HardFilterResult {
  if (b.providerType === s.providerType) return createPassResult();
  const compat: Record<ProviderType, ProviderType[]> = {
    [ProviderType.COMPANY]: [ProviderType.AGENCY, ProviderType.PARTNER],
    [ProviderType.INDIVIDUAL]: [ProviderType.CONSULTANT],
    [ProviderType.CONSULTANT]: [ProviderType.INDIVIDUAL],
    [ProviderType.PARTNER]: [ProviderType.COMPANY, ProviderType.AGENCY],
    [ProviderType.AGENCY]: [ProviderType.COMPANY, ProviderType.PARTNER],
  };
  if (compat[b.providerType]?.includes(s.providerType)) return createPassResult();
  return createReviewResult(HardFilterReason.PROVIDER_TYPE_MISMATCH, `Buyer wants ${b.providerType}, seller is ${s.providerType}`, []);
}

function checkDeliveryCompatibility(b: BuyRequest, s: SellOffering): HardFilterResult {
  const mode = b.deliveryMode;
  if (!mode || mode === DeliveryMode.NO_PREFERENCE) return createPassResult();
  const caps = s.deliveryModeCapability || [];
  if (!caps.length) return createPassResult();
  if (caps.includes(mode) || caps.includes(DeliveryMode.HYBRID) || caps.includes(DeliveryMode.NO_PREFERENCE)) return createPassResult();
  if (mode === DeliveryMode.ONSITE && !caps.includes(DeliveryMode.ONSITE)) return createFailResult(HardFilterReason.DELIVERY_MISMATCH, 'Buyer requires onsite, seller cannot', []);
  if (mode === DeliveryMode.REMOTE && !caps.includes(DeliveryMode.REMOTE)) return createFailResult(HardFilterReason.DELIVERY_MISMATCH, 'Buyer requires remote, seller cannot', []);
  return createReviewResult(HardFilterReason.DELIVERY_MISMATCH, 'Delivery mode may not align', []);
}

function checkTimelineUrgency(b: BuyRequest, s: SellOffering): HardFilterResult {
  const urgent = b.neededTimeline === NeededTimeline.IMMEDIATELY || b.buyingStage === BuyingStage.URGENT_NEED;
  if (!urgent) return createPassResult();
  if (s.salesTimeline === SalesTimeline.ACTIVELY_SELLING) return createPassResult();
  if (s.salesTimeline === SalesTimeline.BUILDING_PIPELINE || s.salesTimeline === SalesTimeline.SEASONAL) return createFailResult(HardFilterReason.TIMELINE_MISMATCH, 'Urgent buyer, seller not active', [`Seller: ${s.salesTimeline}`]);
  return createReviewResult(HardFilterReason.TIMELINE_MISMATCH, 'Urgent buyer, seller exploring', []);
}

/** v4 NEW: Explicit location constraint hard filter */
function checkLocationConstraint(b: BuyRequest, s: SellOffering): HardFilterResult {
  const bLoc = b.targetMarketLocation?.toLowerCase().trim();
  const sLoc = s.targetMarketLocation?.toLowerCase().trim();
  if (!bLoc || !sLoc) return createPassResult();
  if (bLoc === sLoc || bLoc.includes(sLoc) || sLoc.includes(bLoc)) return createPassResult();
  // Both specified explicit locations that don't overlap at all
  // Common substrings < 3 chars don't count
  const bWords = bLoc.split(/[\s,]+/).filter(w => w.length >= 3);
  const sWords = sLoc.split(/[\s,]+/).filter(w => w.length >= 3);
  const hasOverlap = bWords.some(bw => sWords.some(sw => bw === sw || bw.includes(sw) || sw.includes(bw)));
  if (hasOverlap) return createPassResult();
  return createReviewResult(HardFilterReason.LOCATION_MISMATCH, 'Different locations', [`Buyer: ${bLoc}, Seller: ${sLoc}`]);
}

function checkDataQuality(b: BuyRequest, s: SellOffering): HardFilterResult {
  const t = DEFAULT_DEAL_THRESHOLDS.sparseDataThreshold;
  if (b.dataQualityScore < t) return createReviewResult(HardFilterReason.SPARSE_DATA, `Buy quality ${b.dataQualityScore} < ${t}`, []);
  if (s.dataQualityScore < t) return createReviewResult(HardFilterReason.SPARSE_DATA, `Sell quality ${s.dataQualityScore} < ${t}`, []);
  return createPassResult();
}

// ============================================================================
// SCORING COMPONENTS (preserved from v3 with persona upgrade)
// ============================================================================

export function calculateCategoryScore(b: BuyRequest, s: SellOffering): ScoringComponent {
  if (b.solutionCategory === s.solutionCategory) return comp('categoryScore', 100, DEFAULT_DEAL_WEIGHTS.categoryScore, 0.92, 'Exact category match', [b.solutionCategory], []);
  const groups: SolutionCategory[][] = [[SolutionCategory.SAAS_SOFTWARE, SolutionCategory.MANAGED_SERVICES], [SolutionCategory.CONSULTING_ADVISORY, SolutionCategory.PROFESSIONAL_SERVICES], [SolutionCategory.TRAINING_EDUCATION, SolutionCategory.CONSULTING_ADVISORY], [SolutionCategory.STAFFING, SolutionCategory.PROFESSIONAL_SERVICES], [SolutionCategory.INTEGRATION, SolutionCategory.SAAS_SOFTWARE]];
  for (const g of groups) if (g.includes(b.solutionCategory) && g.includes(s.solutionCategory)) return comp('categoryScore', 65, DEFAULT_DEAL_WEIGHTS.categoryScore, 0.78, 'Related categories', [`${b.solutionCategory} ≈ ${s.solutionCategory}`], []);
  return comp('categoryScore', 15, DEFAULT_DEAL_WEIGHTS.categoryScore, 0.85, 'Different categories', [], [`Buyer: ${b.solutionCategory}`]);
}

export function calculateIndustryScore(b: BuyRequest, s: SellOffering): ScoringComponent {
  const { score: os, matched, unmatched } = calculateTagOverlap(b.relevantIndustry, s.industryFocus);
  const cov = b.relevantIndustry.length > 0 ? matched.length / b.relevantIndustry.length : 0;
  let score = os; let explanation = ''; const penalties: string[] = [];
  if (cov >= 0.8 || matched.length >= 2) { score = Math.max(score, 90); explanation = `Strong industry: ${matched.join(', ')}`; }
  else if (cov >= 0.5 || matched.length >= 1) { score = Math.max(score, 65); explanation = `Partial industry: ${matched.join(', ')}`; }
  else { score = 20; explanation = 'No industry overlap'; penalties.push('No matching industries'); }
  return comp('industryScore', score, DEFAULT_DEAL_WEIGHTS.industryScore, matched.length > 0 ? 0.8 : 0.5, explanation, matched, unmatched, penalties);
}

export function calculateBudgetScore(b: BuyRequest, s: SellOffering): ScoringComponent {
  const { gap, direction } = areBudgetsCompatible(b.budgetRange, s.priceRange);
  let score = 0; let explanation = ''; const matched: string[] = []; const missing: string[] = []; const penalties: string[] = [];
  if (gap === 'UNKNOWN') { score = 55; explanation = 'Budget CUSTOM'; }
  else if (gap === 'EXACT') { score = 100; explanation = 'Budget aligned'; matched.push(`${b.budgetRange} = ${s.priceRange}`); }
  else if (gap === 'CLOSE' && direction === 'BUYER_CAN_AFFORD') { score = 90; explanation = 'Seller below budget'; }
  else if (gap === 'CLOSE' && direction === 'SELLER_TOO_EXPENSIVE') { score = 72; explanation = 'Seller slightly above'; }
  else if (gap === 'GAP' && direction === 'BUYER_CAN_AFFORD') { score = 75; explanation = 'Seller well below budget'; }
  else if (gap === 'GAP' && direction === 'SELLER_TOO_EXPENSIVE') { score = 35; explanation = 'Seller above budget'; penalties.push('Budget gap'); }
  else if (gap === 'LARGE_GAP') { score = 12; explanation = 'Large budget mismatch'; penalties.push('Large budget gap'); }
  else { score = 50; explanation = 'Budget unclear'; }
  return comp('budgetScore', score, DEFAULT_DEAL_WEIGHTS.budgetScore, 0.85, explanation, matched, missing, penalties);
}

export function calculateRequirementsScore(b: BuyRequest, s: SellOffering): ScoringComponent {
  const reqs = b.mustHaveRequirements || [];
  if (!reqs.length) return comp('requirementsScore', 70, DEFAULT_DEAL_WEIGHTS.requirementsScore, 0.5, 'No requirements specified', [], []);
  const corpus = buildSellerCapabilityCorpus(s);
  const matched: string[] = []; const missing: string[] = [];
  for (const r of reqs) { if (isRequirementCovered(r, corpus)) matched.push(r); else missing.push(r); }
  const cov = matched.length / reqs.length;
  let score = clampScore(cov * 100); let explanation = ''; const penalties: string[] = [];
  if (cov >= 0.9) { score = Math.max(score, 95); explanation = `Nearly all met (${matched.length}/${reqs.length})`; }
  else if (cov >= 0.7) { score = Math.max(score, 75); explanation = `Most met (${matched.length}/${reqs.length})`; }
  else if (cov >= 0.5) { explanation = `Partial (${matched.length}/${reqs.length})`; }
  else { explanation = `Low coverage (${matched.length}/${reqs.length})`; penalties.push('<50% requirements met'); }
  return comp('requirementsScore', score, DEFAULT_DEAL_WEIGHTS.requirementsScore, matched.length > 0 ? 0.78 : 0.4, explanation, matched, missing, penalties);
}

export function calculateSizeFitScore(b: BuyRequest, s: SellOffering): ScoringComponent {
  const pref = b.preferredProviderSize; const prov = s.companySize ?? null;
  if (!pref || pref === CompanySize.NO_PREFERENCE) return comp('providerSizeScore', 80, DEFAULT_DEAL_WEIGHTS.providerSizeScore, 0.6, 'No size preference', [], []);
  if (!prov || prov === CompanySize.NO_PREFERENCE) return comp('providerSizeScore', 70, DEFAULT_DEAL_WEIGHTS.providerSizeScore, 0.5, 'Seller size unknown', [], []);
  const order: Record<CompanySize, number> = { [CompanySize.INDIVIDUAL_SOLO]: 1, [CompanySize.SMALL]: 2, [CompanySize.MEDIUM]: 3, [CompanySize.ENTERPRISE]: 4, [CompanySize.NO_PREFERENCE]: 0 };
  const diff = Math.abs((order[pref] || 0) - (order[prov] || 0));
  if (diff === 0) return comp('providerSizeScore', 95, DEFAULT_DEAL_WEIGHTS.providerSizeScore, 0.85, 'Size match', [`${pref}`], []);
  if (diff === 1) return comp('providerSizeScore', 70, DEFAULT_DEAL_WEIGHTS.providerSizeScore, 0.72, 'Adjacent sizes', [`${pref} ≈ ${prov}`], []);
  return comp('providerSizeScore', 35, DEFAULT_DEAL_WEIGHTS.providerSizeScore, 0.7, 'Size mismatch', [], [`Prefers ${pref}, seller ${prov}`]);
}

export function calculateProviderTypeScore(b: BuyRequest, s: SellOffering): ScoringComponent {
  if (b.providerType === s.providerType) return comp('providerTypeScore', 100, DEFAULT_DEAL_WEIGHTS.providerTypeScore, 0.9, 'Exact provider type', [b.providerType], []);
  const compat: Record<ProviderType, ProviderType[]> = { [ProviderType.COMPANY]: [ProviderType.AGENCY, ProviderType.PARTNER], [ProviderType.INDIVIDUAL]: [ProviderType.CONSULTANT], [ProviderType.CONSULTANT]: [ProviderType.INDIVIDUAL], [ProviderType.PARTNER]: [ProviderType.COMPANY, ProviderType.AGENCY], [ProviderType.AGENCY]: [ProviderType.COMPANY, ProviderType.PARTNER] };
  if (compat[b.providerType]?.includes(s.providerType)) return comp('providerTypeScore', 75, DEFAULT_DEAL_WEIGHTS.providerTypeScore, 0.72, 'Compatible types', [`${b.providerType} ↔ ${s.providerType}`], []);
  return comp('providerTypeScore', 30, DEFAULT_DEAL_WEIGHTS.providerTypeScore, 0.7, 'Different types', [], [`${b.providerType} ≠ ${s.providerType}`]);
}

/**
 * v4: buyerRole-aware persona scoring.
 * If buyerRole is set explicitly, use it for stronger mapping.
 * If not, fall back to inference.
 */
export function calculateBuyerPersonaScore(b: BuyRequest, s: SellOffering): ScoringComponent {
  const targets = s.idealBuyerType || [];
  if (!targets.length) return comp('buyerPersonaScore', 60, DEFAULT_DEAL_WEIGHTS.buyerPersonaScore, 0.4, 'No ideal buyer type specified', [], []);

  let inferred: BuyerType[];
  if (b.buyerRole) {
    // v4: Map explicit buyerRole to BuyerType for direct comparison
    const roleMap: Record<BuyerRole, BuyerType[]> = {
      [BuyerRole.EXECUTIVE]: [BuyerType.C_LEVEL],
      [BuyerRole.TEAM_LEAD]: [BuyerType.DEPARTMENT_HEAD],
      [BuyerRole.PROCUREMENT]: [BuyerType.PROCUREMENT_MANAGER, BuyerType.BUDGET_HOLDER],
      [BuyerRole.TECHNICAL]: [BuyerType.TECHNICAL_EVALUATOR],
      [BuyerRole.FOUNDER_OWNER]: [BuyerType.SMB_OWNER, BuyerType.C_LEVEL],
      [BuyerRole.OPERATIONS]: [BuyerType.DEPARTMENT_HEAD, BuyerType.BUDGET_HOLDER],
    };
    inferred = roleMap[b.buyerRole] || inferBuyerPersona(b);
  } else {
    inferred = inferBuyerPersona(b);
  }

  const matched = inferred.filter(p => targets.includes(p));
  const isTarget = matched.length > 0;
  const cov = inferred.length > 0 ? matched.length / inferred.length : 0;
  let score: number; let explanation: string;
  // v4: Explicit buyerRole match = higher confidence
  const conf = b.buyerRole ? 0.78 : (targets.length > 0 ? 0.65 : 0.4);
  if (isTarget && cov >= 0.5) { score = 95; explanation = `Strong persona fit: ${matched.join(', ')}`; }
  else if (isTarget) { score = 78; explanation = `Partial persona: ${matched.join(', ')}`; }
  else { score = 25; explanation = 'Buyer persona not in seller targets'; }
  return comp('buyerPersonaScore', score, DEFAULT_DEAL_WEIGHTS.buyerPersonaScore, conf, explanation, matched.map(String), targets.filter(p => !matched.includes(p)).map(String));
}

export function inferBuyerPersona(b: BuyRequest): BuyerType[] {
  const personas = new Set<BuyerType>();
  const text = `${b.whatYouNeed} ${b.idealProviderProfile || ''}`.toLowerCase();
  const reqs = (b.mustHaveRequirements || []).map(r => r.toLowerCase());
  if (/(c-level|ceo|cto|cfo|chief|executive|board)/.test(text)) personas.add(BuyerType.C_LEVEL);
  const tech = ['api', 'integration', 'developer', 'technical', 'engineer', 'platform', 'stack', 'architecture'];
  if (reqs.some(r => tech.some(k => r.includes(k))) || tech.some(k => text.includes(k))) personas.add(BuyerType.TECHNICAL_EVALUATOR);
  if (/(procurement|vendor|rfp|request for proposal|tender|sourcing)/.test(text)) personas.add(BuyerType.PROCUREMENT_MANAGER);
  if (b.budgetRange === BudgetRange.RANGE_100K_500K || b.budgetRange === BudgetRange.RANGE_500K_PLUS || /(budget|finance|approval)/.test(text)) personas.add(BuyerType.BUDGET_HOLDER);
  if (/small business|startup|founder/.test(text)) personas.add(BuyerType.SMB_OWNER);
  if (/department|team|head|manager/.test(text)) personas.add(BuyerType.DEPARTMENT_HEAD);
  if (!personas.size) personas.add(BuyerType.BUDGET_HOLDER);
  return Array.from(personas);
}

export function calculateTimelineScore(b: BuyRequest, s: SellOffering): ScoringComponent {
  let score = 50; let explanation = ''; const matched: string[] = []; const missing: string[] = [];
  const urgent = b.neededTimeline === NeededTimeline.IMMEDIATELY || b.buyingStage === BuyingStage.URGENT_NEED;
  const ready = b.buyingStage === BuyingStage.READY_TO_DECIDE || urgent;
  const active = s.salesTimeline === SalesTimeline.ACTIVELY_SELLING;
  if (urgent && active) { score = 100; explanation = 'Urgent + active'; matched.push('Urgency match'); }
  else if (ready && active) { score = 90; explanation = 'Ready + active'; matched.push('Ready-to-close'); }
  else if (active) { score = 75; explanation = 'Active seller'; matched.push('Active'); }
  else if (s.salesTimeline === SalesTimeline.EXPLORING_MARKET && b.buyingStage === BuyingStage.EXPLORING) { score = 70; explanation = 'Both exploring'; }
  else if (s.salesTimeline === SalesTimeline.EXPLORING_MARKET) { score = 50; explanation = 'Seller exploring'; missing.push('Not active'); }
  else if (s.salesTimeline === SalesTimeline.BUILDING_PIPELINE) { score = 55; explanation = 'Pipeline building'; }
  else { score = 60; explanation = 'Timeline unclear'; }
  return comp('timelineScore', score, DEFAULT_DEAL_WEIGHTS.timelineScore, 0.7, explanation, matched, missing);
}

export function calculateLocationScore(b: BuyRequest, s: SellOffering): ScoringComponent {
  const bL = b.targetMarketLocation?.toLowerCase().trim() || '';
  const sL = s.targetMarketLocation?.toLowerCase().trim() || '';
  if (!bL && !sL) return comp('locationScore', 70, DEFAULT_DEAL_WEIGHTS.locationScore, 0.5, 'No location constraints', [], []);
  if (!bL) return comp('locationScore', 70, DEFAULT_DEAL_WEIGHTS.locationScore, 0.55, 'No buyer location', [], []);
  if (!sL) return comp('locationScore', 70, DEFAULT_DEAL_WEIGHTS.locationScore, 0.55, 'Seller location-flexible', ['Flexible'], []);
  if (bL === sL) return comp('locationScore', 100, DEFAULT_DEAL_WEIGHTS.locationScore, 0.88, 'Exact location match', [b.targetMarketLocation!], []);
  if (bL.includes(sL) || sL.includes(bL)) return comp('locationScore', 85, DEFAULT_DEAL_WEIGHTS.locationScore, 0.75, 'Location overlap', [`${bL} ≈ ${sL}`], []);
  return comp('locationScore', 35, DEFAULT_DEAL_WEIGHTS.locationScore, 0.65, 'Different locations', [], [`Buyer: ${bL}, Seller: ${sL}`]);
}

export function calculateDeliveryScore(b: BuyRequest, s: SellOffering): ScoringComponent {
  const mode = b.deliveryMode;
  if (!mode || mode === DeliveryMode.NO_PREFERENCE) return comp('deliveryScore', 80, DEFAULT_DEAL_WEIGHTS.deliveryScore, 0.6, 'No delivery preference', [], []);
  const caps = s.deliveryModeCapability || [];
  if (!caps.length) return comp('deliveryScore', 68, DEFAULT_DEAL_WEIGHTS.deliveryScore, 0.45, 'Seller delivery unknown', [], []);
  if (caps.includes(mode)) return comp('deliveryScore', 95, DEFAULT_DEAL_WEIGHTS.deliveryScore, 0.88, `Supports ${mode}`, [mode], []);
  if (caps.includes(DeliveryMode.HYBRID)) return comp('deliveryScore', 82, DEFAULT_DEAL_WEIGHTS.deliveryScore, 0.75, 'Hybrid available', ['HYBRID'], []);
  if (caps.includes(DeliveryMode.NO_PREFERENCE)) return comp('deliveryScore', 75, DEFAULT_DEAL_WEIGHTS.deliveryScore, 0.6, 'Flexible', [], []);
  return comp('deliveryScore', 35, DEFAULT_DEAL_WEIGHTS.deliveryScore, 0.7, 'Delivery mismatch', [], [`Buyer: ${mode}, Seller: ${caps.join(', ')}`]);
}

/**
 * v4: Semantic scoring with sub-score tracking.
 * Returns component AND populates semanticSubScores for explanation.
 */
export function calculateSemanticScore(b: BuyRequest, s: SellOffering): { component: ScoringComponent; subScores: { field: string; score: number; explanation: string }[] } {
  const subScores: { field: string; score: number; explanation: string }[] = [];
  const needVsOffer = textSimilarity(b.whatYouNeed, [s.productServiceName, s.offeringSummary || '', s.idealCustomerProfile].join(' '));
  subScores.push({ field: 'whatYouNeed ↔ offering', score: Math.round(needVsOffer * 100), explanation: needVsOffer >= 0.4 ? 'Strong need-offer alignment' : needVsOffer >= 0.2 ? 'Moderate alignment' : 'Limited alignment' });

  const needVsICP = textSimilarity(b.whatYouNeed, s.idealCustomerProfile);
  subScores.push({ field: 'whatYouNeed ↔ idealCustomerProfile', score: Math.round(needVsICP * 100), explanation: needVsICP >= 0.3 ? 'Buyer need matches seller ICP' : 'Weak ICP match' });

  let profileVsOffer = 0;
  if (b.idealProviderProfile) {
    profileVsOffer = textSimilarity(b.idealProviderProfile, [s.offeringSummary || '', s.productServiceName].join(' '));
    subScores.push({ field: 'idealProviderProfile ↔ offering', score: Math.round(profileVsOffer * 100), explanation: profileVsOffer >= 0.3 ? 'Provider profile aligns' : 'Weak provider alignment' });
  }

  const reqsVsCaps = textSimilarity(b.mustHaveRequirements.join(' '), (s.capabilities || []).join(' '));
  subScores.push({ field: 'requirements ↔ capabilities', score: Math.round(reqsVsCaps * 100), explanation: reqsVsCaps >= 0.3 ? 'Requirements align with capabilities' : 'Limited capability match' });

  const hasProfile = b.idealProviderProfile ? 1 : 0;
  const tw = 0.40 + 0.25 + (hasProfile ? 0.20 : 0) + 0.15;
  const raw = (0.40 * needVsOffer + 0.25 * needVsICP + (hasProfile ? 0.20 * profileVsOffer : 0) + 0.15 * reqsVsCaps) / tw;
  const score = clampScore(raw * 100);
  const explanation = score >= 60 ? 'Strong semantic alignment' : score >= 40 ? 'Moderate semantic overlap' : score >= 20 ? 'Limited semantic similarity' : 'Minimal semantic overlap';
  const confidence = score >= 50 ? 0.72 : score >= 30 ? 0.58 : 0.42;
  return { component: comp('semanticScore', score, DEFAULT_DEAL_WEIGHTS.semanticScore, confidence, explanation, [], []), subScores };
}

// ============================================================================
// MAIN SCORING — v4: returns semanticSubScores alongside
// ============================================================================

export function calculateDealMatchScore(
  b: BuyRequest, s: SellOffering, weights: DealScoringWeights = DEFAULT_DEAL_WEIGHTS,
): { finalScore: number; breakdown: ScoreBreakdown; fieldMatches: FieldMatch[]; semanticSubScores: { field: string; score: number; explanation: string }[] } {
  const { component: semanticComponent, subScores: semanticSubScores } = calculateSemanticScore(b, s);
  const components: ScoringComponent[] = [
    calculateCategoryScore(b, s), calculateIndustryScore(b, s),
    calculateBudgetScore(b, s), calculateRequirementsScore(b, s),
    calculateSizeFitScore(b, s), calculateTimelineScore(b, s),
    calculateLocationScore(b, s), calculateDeliveryScore(b, s),
    semanticComponent,
    calculateProviderTypeScore(b, s), calculateBuyerPersonaScore(b, s),
  ];
  let totalScore = 0; let totalWeight = 0;
  const allPenalties: { reason: string; points: number }[] = [];
  for (const c of components) {
    const w = weights[c.name as keyof DealScoringWeights] ?? c.weight;
    totalScore += c.score * w; totalWeight += w;
    for (const p of c.penalties) allPenalties.push({ reason: p, points: 3 });
  }
  let finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  finalScore = clampScore(finalScore - allPenalties.reduce((acc, p) => acc + p.points, 0));

  const fieldMatches: FieldMatch[] = [
    { source_field: 'solutionCategory', target_field: 'solutionCategory', source_value: b.solutionCategory, target_value: s.solutionCategory, match_type: b.solutionCategory === s.solutionCategory ? 'EXACT' : 'PARTIAL', score: components.find(c => c.name === 'categoryScore')?.score || 0 },
    { source_field: 'relevantIndustry', target_field: 'industryFocus', source_value: b.relevantIndustry, target_value: s.industryFocus, match_type: 'PARTIAL', score: components.find(c => c.name === 'industryScore')?.score || 0 },
    { source_field: 'budgetRange', target_field: 'priceRange', source_value: b.budgetRange, target_value: s.priceRange, match_type: b.budgetRange === s.priceRange ? 'EXACT' : 'COMPATIBLE', score: components.find(c => c.name === 'budgetScore')?.score || 0 },
    { source_field: 'mustHaveRequirements', target_field: 'capabilities', source_value: b.mustHaveRequirements, target_value: s.capabilities || [], match_type: 'PARTIAL', score: components.find(c => c.name === 'requirementsScore')?.score || 0 },
  ];

  const confidence = components.length ? components.reduce((acc, c) => acc + c.confidence, 0) / components.length : 0;
  return {
    finalScore,
    breakdown: { components, rawScore: totalWeight > 0 ? totalScore / totalWeight : 0, normalizedScore: finalScore, confidence, totalWeight, missingComponents: [], penalties: allPenalties.map(p => p.reason) },
    fieldMatches, semanticSubScores,
  };
}

export function sortDealMatches(matches: DealMatchResult[]): DealMatchResult[] {
  return matches.sort((a, b) => b.finalScore - a.finalScore || b.confidence - a.confidence || a.id.localeCompare(b.id));
}

export function assignDealRanks(matches: DealMatchResult[]): DealMatchResult[] {
  return matches.map((m, i) => ({ ...m, rank: i + 1 }));
}

function comp(name: string, score: number, weight: number, confidence: number, explanation: string, matched: string[], missing: string[], penalties: string[] = []): ScoringComponent {
  return { name, score: clampScore(score), weight, confidence, explanation, matchedItems: matched, missingItems: missing, penalties };
}

