/**
 * IntellMatch Pitch Matching Engine — Scoring Utilities
 * v8.0.0 — production-hardened
 *
 * Changes from v7:
 * - Soft intent filtering: missing contactTypes → WARN (not FAIL) when deep profile evidence exists
 * - supportNeededTags integrated into need-offer scoring
 * - Intent-specific minimum score enforcement
 */

import {
  DEFAULT_PITCH_CONFIG, DeterministicScoreBreakdown, HardFilterReason, MatchIntent,
  PitchContact, PitchMatchingConfig, PitchProfile, PitchScoringWeights, PitchStage,
  SupportNeededTag,
} from './pitch-matching.types';

import {
  HardFilterStatus, ScoringComponent, normalizeTag, clampScore, areSectorsRelated, calculateCosineSimilarity,
} from './matching-bands.constants';

export interface HardFilterResult {
  status: HardFilterStatus;
  reason: HardFilterReason;
  details: string;
  evidence: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STAGE_ORDER: PitchStage[] = [
  PitchStage.JUST_AN_IDEA, PitchStage.VALIDATING, PitchStage.BUILDING_MVP,
  PitchStage.LAUNCHED, PitchStage.GROWING, PitchStage.SCALING,
];

const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'into', 'your', 'their', 'that', 'this',
  'our', 'you', 'they', 'are', 'can', 'will', 'need', 'help', 'want', 'looking',
  'seeking', 'build', 'company', 'startup', 'founder', 'team', 'product', 'market',
]);

const NEED_OFFER_CONCEPTS: Record<string, string[]> = {
  funding: ['funding', 'fundraise', 'capital', 'investor', 'seed', 'series a', 'series b', 'venture', 'angel', 'check writer', 'lead investor', 'follow investor'],
  distribution: ['distribution', 'channel partner', 'reseller', 'gtm', 'go to market', 'channel sales', 'market access', 'sales partner', 'commercial distribution', 'route to market'],
  introductions: ['introduction', 'warm intro', 'network access', 'enterprise access', 'customer intro', 'relationships', 'decision-maker access', 'buyer introductions'],
  integration: ['integration', 'api partnership', 'technical integration', 'embedded', 'platform partnership', 'system integrator', 'implementation partner'],
  compliance: ['compliance', 'regulatory', 'risk', 'governance', 'regtech', 'policy', 'banking compliance', 'aml', 'kyc', 'audit'],
  hiring: ['hiring', 'recruiting', 'talent', 'cofounder', 'cto', 'builder', 'technical founder', 'sales leader'],
  pilot: ['pilot', 'poc', 'proof of concept', 'design partner', 'reference customer', 'trial', 'sandbox'],
  buyer: ['buyer', 'customer', 'procurement', 'purchase', 'adoption', 'enterprise customer', 'design partner'],
  advisory: ['advisor', 'mentorship', 'board', 'strategic guidance', 'operator guidance', 'domain advisor', 'board advisor'],
  partnerships: ['strategic partner', 'commercial partner', 'distribution partner', 'channel partner', 'enterprise alliance', 'go to market partner'],
  enterprise_access: ['enterprise access', 'regional network', 'warm bank introductions', 'corporate access', 'decision maker network', 'cxo network'],
  market_validation: ['market validation', 'customer discovery', 'problem validation', 'design feedback', 'user interviews'],
  growth: ['growth', 'scaling', 'scale up', 'expansion', 'regional expansion', 'market expansion'],
};

const PHRASE_TAXONOMY: Array<{ label: string; phrases: string[] }> = [
  { label: 'distribution_partner', phrases: ['distribution partner', 'channel partner', 'channel sales', 'route to market', 'reseller network', 'sales partner'] },
  { label: 'market_access', phrases: ['market access', 'enterprise access', 'regional network', 'warm introductions', 'warm bank introductions', 'decision maker access'] },
  { label: 'gtm_partner', phrases: ['go to market partner', 'commercial partner', 'business development partner', 'alliance partner'] },
  { label: 'pilot_customer', phrases: ['pilot customer', 'design partner', 'proof of concept', 'sandbox customer', 'trial customer'] },
  { label: 'compliance_advisor', phrases: ['banking compliance advisor', 'regtech advisor', 'risk advisor', 'governance advisor', 'policy advisor'] },
  { label: 'technical_integration', phrases: ['technical integration', 'api partner', 'platform integration', 'embedded partner', 'system integrator'] },
  { label: 'founding_builder', phrases: ['technical cofounder', 'cto cofounder', 'product cofounder', 'startup builder', 'founding engineer'] },
  { label: 'investor_support', phrases: ['lead investor', 'follow investor', 'angel investor', 'venture investor', 'check writer'] },
];

const MATCH_INTENT_KEYWORDS: Record<MatchIntent, string[]> = {
  [MatchIntent.INVESTOR]: ['funding', 'capital', 'investor', 'lead investor', 'angel', 'vc', 'check'],
  [MatchIntent.ADVISOR]: ['advisor', 'mentor', 'board', 'operator', 'governance', 'strategy'],
  [MatchIntent.STRATEGIC_PARTNER]: ['distribution', 'partner', 'reseller', 'integration', 'channel', 'alliance'],
  [MatchIntent.COFOUNDER]: ['cofounder', 'builder', 'cto', 'cpo', 'product lead', 'technical founder'],
  [MatchIntent.CUSTOMER_BUYER]: ['buyer', 'customer', 'design partner', 'pilot', 'procurement', 'enterprise customer'],
};

// ============================================================================
// INTENT INFERENCE
// ============================================================================

export function inferIntentsFromNeedText(needText: string, otherFields: string[] = []): MatchIntent[] {
  const combined = [needText, ...otherFields].filter(Boolean).join(' ');
  const normalized = normalizeTag(combined || '');
  const intents: MatchIntent[] = [];
  for (const intent of Object.values(MatchIntent)) {
    const keywords = MATCH_INTENT_KEYWORDS[intent] || [];
    for (const keyword of keywords) {
      const token = normalizeTag(keyword);
      if (token && normalized.includes(token)) { intents.push(intent); break; }
    }
  }
  return Array.from(new Set(intents));
}

// ============================================================================
// HELPERS
// ============================================================================

export function getIntentPolicy(intent: MatchIntent, config: PitchMatchingConfig = DEFAULT_PITCH_CONFIG) {
  return config.intentPolicies[intent] || config.intentPolicies[MatchIntent.STRATEGIC_PARTNER];
}

export function getIntentWeights(intent: MatchIntent, config: PitchMatchingConfig = DEFAULT_PITCH_CONFIG): PitchScoringWeights {
  if (!config.features.enableIntentPolicies) return config.defaultWeights;
  return normalizeWeights(getIntentPolicy(intent, config).weights || config.defaultWeights);
}

export function getEffectiveWeights(pitch: PitchProfile, config: PitchMatchingConfig = DEFAULT_PITCH_CONFIG): PitchScoringWeights {
  const intents = pitch.matchIntent?.length ? pitch.matchIntent : [MatchIntent.STRATEGIC_PARTNER];
  return getIntentWeights(intents[0], config);
}

/**
 * v8: Check if a contact has deep profile evidence for a given intent,
 * independent of declared contactTypes. Used for soft intent filtering.
 */
function hasDeepProfileEvidenceForIntent(contact: PitchContact, intent: MatchIntent): boolean {
  switch (intent) {
    case MatchIntent.INVESTOR:
      return !!(contact.investmentProfile?.investorTypes?.length || contact.investmentProfile?.ticketMinUsd || contact.investmentProfile?.portfolioFocus?.length);
    case MatchIntent.ADVISOR:
      return !!(contact.advisorProfile?.functionalExpertise?.length || contact.advisorProfile?.advisorRoles?.length || contact.advisorProfile?.boardExperience);
    case MatchIntent.STRATEGIC_PARTNER:
      return !!(contact.partnerProfile?.partnerCapabilities?.length || contact.partnerProfile?.partnershipTypes?.length);
    case MatchIntent.COFOUNDER:
      return !!(contact.founderProfile?.founderRoles?.length || contact.founderProfile?.builderFunctions?.length);
    case MatchIntent.CUSTOMER_BUYER:
      return !!(contact.buyerProfile?.buyerIndustries?.length || contact.buyerProfile?.buyingRoles?.length || contact.buyerProfile?.procurementAuthority);
    default:
      return false;
  }
}

// ============================================================================
// HARD FILTERS — v8: soft intent filtering
// ============================================================================

export function runPitchHardFilters(
  pitch: PitchProfile, contact: PitchContact,
  intentOrConfig?: MatchIntent | PitchMatchingConfig, configArg?: PitchMatchingConfig,
): HardFilterResult {
  const intent = typeof intentOrConfig === 'string' ? intentOrConfig : ((pitch.matchIntent?.length ? pitch.matchIntent[0] : MatchIntent.STRATEGIC_PARTNER) as MatchIntent);
  const config = (typeof intentOrConfig === 'string' ? configArg : intentOrConfig) || DEFAULT_PITCH_CONFIG;
  if (!config.features.enableHardFilters) return pass();

  const policy = getIntentPolicy(intent, config);

  if (contact.optedOut) return fail(HardFilterReason.OPT_OUT, 'Contact opted out.');
  if (contact.blocked) return fail(HardFilterReason.BLOCKED, 'Contact is blocked.');
  if (pitch.excludedEntities?.includes(contact.id)) return fail(HardFilterReason.EXCLUDED, 'Contact excluded.');

  /**
   * v8 FIX: Soft intent filtering.
   * If contact doesn't declare the intent type but HAS deep profile evidence,
   * downgrade to WARN instead of FAIL. This prevents strong deep-profile
   * matches from being vetoed by incomplete contactTypes metadata.
   */
  if (config.features.enableSoftIntentFiltering && !contact.contactTypes.includes(intent)) {
    const hasDeepEvidence = hasDeepProfileEvidenceForIntent(contact, intent);
    if (hasDeepEvidence) {
      // Allow through with warning — deep profile evidence rescues the evaluation
      // The intent score component will still penalize the mismatch
    } else if (contact.contactTypes.length > 0) {
      // Contact has declared types but intent is not among them AND no deep evidence
      return fail(HardFilterReason.TYPE_MISMATCH, `Intent ${intent} not in contact types ${contact.contactTypes.join(', ')} and no deep profile evidence found.`);
    }
    // If contactTypes is empty entirely, allow through — missing data, not contradiction
  }

  const stageDistance = getClosestStageDistance(pitch.pitchStage, contact.preferredStages);
  if (policy.stageHardFilterMode === 'STRICT' && contact.preferredStages.length > 0 && stageDistance > 1) {
    return fail(HardFilterReason.STAGE_INCOMPATIBLE, `Stage policy (${policy.intent}) requires exact or adjacent stage fit.`);
  }
  if (policy.stageHardFilterMode === 'RELAXED' && contact.preferredStages.length > 0 && stageDistance > 2) {
    return fail(HardFilterReason.STAGE_INCOMPATIBLE, `Stage policy (${policy.intent}) requires reasonably near stage fit.`);
  }

  const requiredGeographies = pitch.requiredGeographies?.length ? pitch.requiredGeographies : [];
  if (requiredGeographies.length > 0 && contact.geographies.length > 0) {
    if (overlapCount(requiredGeographies, contact.geographies) === 0) {
      return fail(HardFilterReason.GEOGRAPHY_REQUIRED_MISMATCH, `No overlap with required geographies: ${requiredGeographies.join(', ')}.`);
    }
  }

  if (pitch.strictCategoryMatch && pitch.primaryCategory && contact.categories.length > 0) {
    if (!contact.categories.some(c => normalizeTag(c) === normalizeTag(pitch.primaryCategory))) {
      return fail(HardFilterReason.CATEGORY_REQUIRED_MISMATCH, `Strict category match failed for ${pitch.primaryCategory}.`);
    }
  }

  if ((pitch.requireCustomerTypeFit || policy.requireCustomerTypeFit) && pitch.targetCustomerType.length > 0 && contact.customerTypes.length > 0) {
    if (overlapCount(pitch.targetCustomerType, contact.customerTypes) === 0) {
      return fail(HardFilterReason.CUSTOMER_FIT_REQUIRED_MISMATCH, 'Required customer type fit was not found.');
    }
  }

  if ((pitch.requireOfferCapabilityFit || policy.requireNeedOfferEvidence) && pitch.whatYouNeed) {
    const capability = getNeedOfferSemanticScore(pitch, contact, intent);
    const threshold = getNeedOfferHardFilterThreshold(intent, pitch, contact, config);
    if (capability < threshold) {
      return fail(HardFilterReason.OFFER_CAPABILITY_REQUIRED_MISMATCH, `Need-offer score ${capability.toFixed(2)} < threshold ${threshold.toFixed(2)}.`);
    }
  }

  return pass();
}

// ============================================================================
// SCORING COMPONENTS (preserved from v7 with minor refinements)
// ============================================================================

export function calculateIntentScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  if (!pitch.matchIntent.length || !contact.contactTypes.length) {
    // v8: check for deep profile evidence even when declarations are missing
    const hasDeep = hasDeepProfileEvidenceForIntent(contact, intent);
    if (hasDeep) {
      return comp('intentScore', 45, weights.intentScore, [`Deep profile evidence found for ${intent} despite missing declarations`], [], 0.55);
    }
    return comp('intentScore', config.fallbackScores.missingIntent, weights.intentScore, [], ['Intent data missing'], 0.3);
  }
  if (contact.contactTypes.includes(intent)) {
    const direct = pitch.matchIntent.includes(intent) ? 1 : 0.75;
    return comp('intentScore', clampScore(direct * 100), weights.intentScore, [`Selected intent fit: ${intent}`], [], 0.96);
  }
  // v8: contact doesn't declare intent but may have deep evidence
  const hasDeep = hasDeepProfileEvidenceForIntent(contact, intent);
  if (hasDeep) {
    return comp('intentScore', 40, weights.intentScore, [`${intent} not declared but deep profile evidence exists`], ['Type not declared'], 0.52);
  }
  return comp('intentScore', 0, weights.intentScore, [], [`No ${intent} contact intent fit`], 0.9);
}

export function calculateCategoryScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  if (!pitch.primaryCategory || contact.categories.length === 0) {
    return comp('categoryScore', config.fallbackScores.missingCategory, weights.categoryScore, [], ['Category data missing'], 0.28);
  }
  const pitchCat = normalizeTag(pitch.primaryCategory);
  if (contact.categories.some(c => normalizeTag(c) === pitchCat)) return comp('categoryScore', 100, weights.categoryScore, [`Exact category: ${pitch.primaryCategory}`], [], 0.95);
  if (contact.categories.some(c => normalizeTag(c).includes(pitchCat) || pitchCat.includes(normalizeTag(c)) || areSectorsRelated(c, pitch.primaryCategory))) {
    return comp('categoryScore', 68, weights.categoryScore, ['Related category match'], [], 0.74);
  }
  return comp('categoryScore', 10, weights.categoryScore, [], ['Category mismatch'], 0.8);
}

export function calculateSectorScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  if (!pitch.industrySectors.length || !contact.sectors.length) return comp('sectorScore', config.fallbackScores.missingSector, weights.sectorScore, [], ['Sector data missing'], 0.28);
  let wm = 0; const ev: string[] = [];
  for (const s of pitch.industrySectors) {
    for (const c of contact.sectors) {
      if (normalizeTag(s) === normalizeTag(c)) { wm += 1; ev.push(`Exact: ${s}`); break; }
      if (areSectorsRelated(s, c)) { wm += 0.7; ev.push(`Related: ${s} ~ ${c}`); break; }
    }
  }
  const score = clampScore((wm / Math.max(1, pitch.industrySectors.length)) * 100);
  return comp('sectorScore', score, weights.sectorScore, ev, wm === 0 ? ['No sector overlap'] : [], Math.min(1, 0.44 + ev.length * 0.12));
}

export function calculateBusinessModelScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  if (!pitch.businessModel.length || !contact.businessModels.length) return comp('businessModelScore', config.fallbackScores.missingModel, weights.businessModelScore, [], ['Business model data missing'], 0.28);
  const overlap = pitch.businessModel.filter(m => contact.businessModels.includes(m));
  const score = clampScore((overlap.length / Math.max(1, pitch.businessModel.length)) * 100);
  return comp('businessModelScore', score, weights.businessModelScore, overlap.length ? [`Model overlap: ${overlap.join(', ')}`] : [], overlap.length ? [] : ['No model overlap'], overlap.length ? 0.84 : 0.54);
}

export function calculateStageScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  const policy = getIntentPolicy(intent, config);
  if (!pitch.pitchStage || !contact.preferredStages.length) {
    const fb = intent === MatchIntent.INVESTOR ? Math.min(config.fallbackScores.missingStage, 4) : config.fallbackScores.missingStage;
    return comp('stageScore', fb, weights.stageScore, [], ['Stage data missing'], 0.26);
  }
  const d = getClosestStageDistance(pitch.pitchStage, contact.preferredStages);
  const score = d === 0 ? 100 : d === 1 ? 78 : d === 2 ? 52 : d === 3 ? 24 : 0;
  const pen: string[] = [];
  if (score < 30 && policy.stageHardFilterMode !== 'NONE') pen.push('Weak stage alignment');
  return comp('stageScore', score, weights.stageScore, [`Stage distance: ${d}`], pen, score > 0 ? 0.88 : 0.7);
}

export function calculateCustomerTypeScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  if (!pitch.targetCustomerType.length || !contact.customerTypes.length) {
    const fb = (intent === MatchIntent.CUSTOMER_BUYER || intent === MatchIntent.STRATEGIC_PARTNER) ? Math.min(config.fallbackScores.missingCustomerType, 4) : config.fallbackScores.missingCustomerType;
    return comp('customerTypeScore', fb, weights.customerTypeScore, [], ['Customer type data missing'], 0.25);
  }
  const matched = matchedNormalizedValues(pitch.targetCustomerType, contact.customerTypes);
  const score = clampScore((matched.length / Math.max(1, pitch.targetCustomerType.length)) * 100);
  return comp('customerTypeScore', score, weights.customerTypeScore, matched.length ? [`Customer type overlap: ${matched.join(', ')}`] : [], matched.length ? [] : ['No customer type overlap'], matched.length ? 0.86 : 0.56);
}

export function calculateGeographyScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  const markets = pitch.requiredGeographies?.length ? pitch.requiredGeographies : pitch.operatingMarkets;
  if (!markets.length || !contact.geographies.length) {
    const fb = (intent === MatchIntent.CUSTOMER_BUYER || intent === MatchIntent.STRATEGIC_PARTNER || intent === MatchIntent.INVESTOR) ? Math.min(config.fallbackScores.missingGeography, 5) : config.fallbackScores.missingGeography;
    return comp('geographyScore', fb, weights.geographyScore, [], ['Geography data missing'], 0.26);
  }
  const matched = matchedNormalizedValues(markets, contact.geographies);
  const score = clampScore((matched.length / Math.max(1, markets.length)) * 100);
  return comp('geographyScore', score, weights.geographyScore, matched.length ? [`Geography overlap: ${matched.join(', ')}`] : [], matched.length ? [] : ['No geography overlap'], matched.length ? 0.87 : 0.55);
}

export function calculateNeedOfferScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  if (!pitch.whatYouNeed) return comp('needOfferScore', Math.min(config.fallbackScores.missingNeedOffer, 3), weights.needOfferScore, [], ['Pitch need missing'], 0.18);
  const offerCorpus = getContactOfferCorpus(contact, intent);
  if (!offerCorpus.length) return comp('needOfferScore', config.fallbackScores.missingNeedOffer, weights.needOfferScore, [], ['Contact offer data missing'], 0.22);

  // v8: Boost from supportNeededTags if available
  let tagBoost = 0;
  if (pitch.supportNeededTags?.length) {
    const offerText = offerCorpus.join(' ').toLowerCase();
    const tagHits = pitch.supportNeededTags.filter(tag => offerText.includes(tag.replace(/_/g, ' ')));
    tagBoost = tagHits.length > 0 ? Math.min(0.08, tagHits.length * 0.025) : 0;
  }

  const details = scoreNeedOfferDetails(pitch.whatYouNeed, offerCorpus, pitch.needEmbedding, contact.needOfferEmbedding, intent);
  const finalNeedScore = Math.min(1, details.score + tagBoost);
  return comp('needOfferScore', clampScore(finalNeedScore * 100), weights.needOfferScore, details.evidence, finalNeedScore >= 0.26 ? [] : ['Weak need-offer fit'], details.confidence);
}

export function calculateTractionScore(pitch: PitchProfile, _contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  if (!pitch.tractionSummary) {
    const fb = intent === MatchIntent.INVESTOR ? Math.min(config.fallbackScores.missingTraction, 3) : config.fallbackScores.missingTraction;
    return comp('tractionScore', fb, weights.tractionScore, [], ['No traction summary'], intent === MatchIntent.INVESTOR ? 0.2 : 0.34);
  }
  const TRACTION_PATTERNS: Array<{ pattern: RegExp; score: number; evidence: string }> = [
    { pattern: /\$\s?([1-9][0-9]{3,})(\s?(m|k|million|thousand))?/i, score: 18, evidence: 'Revenue / GMV signal' },
    { pattern: /\b([1-9][0-9]{2,})\s?(users|customers|clients|contracts)\b/i, score: 18, evidence: 'Customer count signal' },
    { pattern: /\b([1-9][0-9]{1,})\s?(pilots|pilot customers|pilot programs)\b/i, score: 12, evidence: 'Pilot traction signal' },
    { pattern: /\b([1-9][0-9]{1,3})\s?%\s?(growth|mom|yoy|retention|conversion)\b/i, score: 16, evidence: 'Growth metric signal' },
    { pattern: /\b(waitlist|pipeline|signed loi|loi|letters of intent)\b/i, score: 10, evidence: 'Pipeline signal' },
  ];
  let score = 20; const ev: string[] = [];
  for (const rule of TRACTION_PATTERNS) { if (rule.pattern.test(pitch.tractionSummary)) { score += rule.score; ev.push(rule.evidence); } }
  if (/\b(pre-revenue|idea stage)\b/i.test(pitch.tractionSummary)) { score -= 12; ev.push('Early traction limitation'); }
  if (intent === MatchIntent.CUSTOMER_BUYER) score *= 0.75;
  if (intent === MatchIntent.COFOUNDER) score *= 0.85;
  return comp('tractionScore', clampScore(score), weights.tractionScore, ev.length ? ev : ['Narrative traction only'], [], ev.length ? 0.82 : 0.58);
}

export function calculateTeamScore(pitch: PitchProfile, _contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  if (!pitch.founderBackgroundSummary) {
    const fb = (intent === MatchIntent.COFOUNDER || intent === MatchIntent.INVESTOR) ? Math.min(config.fallbackScores.missingTeam, 4) : config.fallbackScores.missingTeam;
    return comp('teamScore', fb, weights.teamScore, [], ['No founder/team summary'], 0.24);
  }
  const TEAM_PATTERNS: Array<{ pattern: RegExp; score: number; evidence: string }> = [
    { pattern: /\b(prior exit|successful exit|acquired|sold company|serial founder)\b/i, score: 24, evidence: 'Prior exit signal' },
    { pattern: /\b(ex-|former|previously at)\s?[A-Za-z0-9& .-]+/i, score: 14, evidence: 'Strong operator signal' },
    { pattern: /\b(cto|ceo|chief|vp|head of|director)\b/i, score: 10, evidence: 'Leadership signal' },
    { pattern: /\b(phd|doctorate|researcher|scientist)\b/i, score: 8, evidence: 'Deep expertise signal' },
    { pattern: /\b(founder|co-founder|startup)\b/i, score: 8, evidence: 'Founder background signal' },
  ];
  let score = 25; const ev: string[] = [];
  for (const rule of TEAM_PATTERNS) { if (rule.pattern.test(pitch.founderBackgroundSummary)) { score += rule.score; ev.push(rule.evidence); } }
  if (/\b(2 founders|three founders|team of [2-9])\b/i.test(pitch.founderBackgroundSummary)) { score += 8; ev.push('Multi-founder signal'); }
  return comp('teamScore', clampScore(score), weights.teamScore, ev.length ? ev : ['General team credibility'], [], ev.length ? 0.8 : 0.6);
}

export function calculateSemanticScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  if (!config.features.enableSemanticMatching) return comp('semanticScore', 50, weights.semanticScore, ['Semantic matching disabled'], [], 0.5);
  if (pitch.embedding?.length && contact.embedding?.length && pitch.embedding.length === contact.embedding.length) {
    const sim = Math.max(0, calculateCosineSimilarity(pitch.embedding, contact.embedding));
    return comp('semanticScore', clampScore(sim * 100), weights.semanticScore, [`Embedding similarity: ${Math.round(sim * 100)}%`], [], 0.86);
  }
  const pitchText = [pitch.pitchTitle, pitch.elevatorPitch, pitch.problemStatement, pitch.solutionSummary, pitch.whatYouNeed, pitch.tractionSummary, pitch.founderBackgroundSummary, ...pitch.industrySectors, ...pitch.targetCustomerType].filter(Boolean).join(' ');
  const contactText = getContactOfferCorpus(contact, intent).join(' ');
  const overlap = semanticTextSimilarity(pitchText, contactText);
  return comp('semanticScore', clampScore(overlap * 100), weights.semanticScore, [`Field semantic similarity: ${Math.round(overlap * 100)}%`], overlap > 0 ? [] : ['Low semantic overlap'], overlap > 0 ? 0.66 : 0.38);
}

export function calculateCounterpartFitScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent, config: PitchMatchingConfig): ScoringComponent {
  const weights = getIntentWeights(intent, config);
  const evidence: string[] = [];
  const penalties: string[] = [];
  let score = 0;

  // Intent-specific counterpart scoring (unchanged from v7 — full implementations)
  if (intent === MatchIntent.INVESTOR) {
    const text = getContactOfferCorpus(contact, intent).join(' ');
    const investorSig = keywordCoverage(text, ['investor', 'venture', 'vc', 'angel', 'fund', 'capital', 'portfolio', 'thesis']);
    const stageSig = contact.preferredStages.length ? (contact.preferredStages.includes(pitch.pitchStage) ? 1 : getClosestStageDistance(pitch.pitchStage, contact.preferredStages) <= 1 ? 0.72 : 0.38) : 0.35;
    const geoSig = pitch.operatingMarkets.length && contact.investmentProfile?.deploymentGeographies?.length ? coverageRatio(pitch.operatingMarkets, contact.investmentProfile.deploymentGeographies) : 0.35;
    const sectorSig = pitch.industrySectors.length ? coverageRatio(pitch.industrySectors, [...contact.sectors, ...(contact.investmentProfile?.portfolioFocus || [])]) : 0.4;
    const ticketSig = inferInvestorTicketFit(pitch, contact);
    const thesisSig = semanticTextSimilarity(`${pitch.elevatorPitch} ${pitch.whatYouNeed} ${pitch.tractionSummary || ''}`, text);
    score = 0.20 * investorSig + 0.14 * stageSig + 0.14 * sectorSig + 0.10 * geoSig + 0.16 * ticketSig + 0.10 * (contact.investmentProfile?.leadPreference === 'LEAD' || contact.investmentProfile?.leadPreference === 'BOTH' ? 0.9 : 0.45) + 0.16 * thesisSig;
    if (investorSig > 0.45) evidence.push('Investor evidence');
    if (stageSig > 0.75) evidence.push('Stage fits');
    if (sectorSig > 0.5) evidence.push('Sector aligns');
    if (ticketSig > 0.6) evidence.push('Ticket-size fit');
  } else if (intent === MatchIntent.ADVISOR) {
    const advisorText = getContactOfferCorpus(contact, intent).join(' ');
    const advSig = keywordCoverage(advisorText, ['advisor', 'mentor', 'board', 'operator', 'strategy', 'governance']);
    const expSig = semanticTextSimilarity(`${pitch.problemStatement} ${pitch.solutionSummary} ${pitch.whatYouNeed}`, advisorText);
    const funcNeeds = extractFunctionalNeeds(pitch.whatYouNeed);
    const funcSig = coverageRatio(funcNeeds, [...(contact.advisorProfile?.functionalExpertise || []), ...(contact.expertise || []), ...(contact.keywords || [])]);
    const boardSig = /board|governance/.test(normalizeTag(pitch.whatYouNeed)) ? (contact.advisorProfile?.boardExperience ? 1 : 0.25) : (contact.advisorProfile?.boardExperience ? 0.7 : 0.45);
    const opSig = coverageRatio(extractFunctionalNeeds(`${pitch.problemStatement} ${pitch.solutionSummary}`), contact.advisorProfile?.operatorBackground || []);
    score = 0.22 * advSig + 0.26 * expSig + 0.24 * funcSig + 0.14 * boardSig + 0.14 * opSig;
    if (advSig > 0.45) evidence.push('Advisor evidence');
    if (expSig > 0.45) evidence.push('Domain expertise aligns');
    if (funcSig > 0.45) evidence.push('Functional fit');
  } else if (intent === MatchIntent.STRATEGIC_PARTNER) {
    const partnerText = getContactOfferCorpus(contact, intent).join(' ');
    const capSig = keywordCoverage(partnerText, ['distribution', 'channel', 'reseller', 'integration', 'alliance', 'bd', 'enterprise access']);
    const needSig = scoreNeedOfferDetails(pitch.whatYouNeed, getContactOfferCorpus(contact, intent), pitch.needEmbedding, contact.needOfferEmbedding, intent).score;
    const custSig = coverageRatio(pitch.targetCustomerType, [...contact.customerTypes, ...(contact.buyerProfile?.buyerIndustries || [])]);
    const geoSig = coverageRatio(pitch.operatingMarkets, [...contact.geographies, ...(contact.partnerProfile?.distributionMarkets || [])]);
    score = 0.20 * capSig + 0.30 * needSig + 0.20 * custSig + 0.15 * geoSig + 0.15 * coverageRatio(extractFunctionalNeeds(pitch.whatYouNeed), [...(contact.partnerProfile?.partnerCapabilities || []), ...contact.canOffer]);
    if (capSig > 0.45) evidence.push('Partnership capability');
    if (needSig > 0.5) evidence.push('Need satisfaction');
  } else if (intent === MatchIntent.COFOUNDER) {
    const founderText = getContactOfferCorpus(contact, intent).join(' ');
    const fSig = keywordCoverage(founderText, ['founder', 'cofounder', 'startup', 'builder', 'product', 'engineering', 'growth', 'sales']);
    const compSig = calculateCofounderComplementarityScore(pitch, contact);
    const mSig = semanticTextSimilarity(`${pitch.elevatorPitch} ${pitch.problemStatement} ${pitch.solutionSummary}`, founderText);
    score = 0.18 * fSig + 0.30 * compSig + 0.20 * mSig + 0.16 * coverageRatio(['startup', 'build', 'launch'], contact.founderProfile?.startupExperience || []) + 0.16 * keywordCoverage(founderText, ['technical', 'product', 'growth', 'sales']);
    if (fSig > 0.45) evidence.push('Founder evidence');
    if (compSig > 0.5) evidence.push('Complementary fit');
    if (mSig > 0.45) evidence.push('Mission alignment');
  } else if (intent === MatchIntent.CUSTOMER_BUYER) {
    const text = getContactOfferCorpus(contact, intent).join(' ');
    const bSig = keywordCoverage(text, ['buyer', 'procurement', 'purchase', 'operator', 'customer', 'enterprise', 'decision maker']);
    const painSig = semanticTextSimilarity(`${pitch.problemStatement} ${pitch.solutionSummary}`, text);
    const icpSig = coverageRatio(pitch.targetCustomerType, [...contact.customerTypes, ...(contact.buyerProfile?.buyerIndustries || [])]);
    const geoSig = coverageRatio(pitch.operatingMarkets, contact.geographies);
    const authSig = contact.buyerProfile?.procurementAuthority ? 1 : coverageRatio(['head', 'director', 'vp', 'chief', 'procurement', 'buyer'], [...(contact.buyerProfile?.buyerSeniority || []), ...(contact.buyerProfile?.buyingRoles || []), contact.title]);
    score = 0.18 * bSig + 0.22 * painSig + 0.22 * icpSig + 0.14 * geoSig + 0.12 * authSig + 0.12 * coverageRatio(extractFunctionalNeeds(pitch.whatYouNeed), [...(contact.buyerProfile?.buyingRoles || []), ...contact.customerTypes]);
    if (bSig > 0.45) evidence.push('Buyer evidence');
    if (painSig > 0.45) evidence.push('Pain aligns');
    if (icpSig > 0.45) evidence.push('ICP fit');
  }

  if (score < 0.25) penalties.push(`Weak ${intent} counterpart-fit evidence`);
  if (!evidence.length) evidence.push(`Counterpart ${intent} fit inferred from sparse signals`);
  const conf = evidence.length >= 4 ? 0.86 : evidence.length === 3 ? 0.78 : evidence.length === 2 ? 0.68 : evidence.length === 1 ? 0.56 : 0.4;
  return comp('counterpartFitScore', clampScore(score * 100), weights.counterpartFitScore, evidence, penalties, conf);
}

// ============================================================================
// MAIN SCORING
// ============================================================================

export function calculatePitchDeterministicScore(
  pitch: PitchProfile, contact: PitchContact,
  intentOrConfig?: MatchIntent | PitchMatchingConfig, configArg?: PitchMatchingConfig,
): DeterministicScoreBreakdown {
  const intent = typeof intentOrConfig === 'string' ? intentOrConfig : ((pitch.matchIntent?.length ? pitch.matchIntent[0] : MatchIntent.STRATEGIC_PARTNER) as MatchIntent);
  const config = (typeof intentOrConfig === 'string' ? configArg : intentOrConfig) || DEFAULT_PITCH_CONFIG;

  const components: ScoringComponent[] = [
    calculateIntentScore(pitch, contact, intent, config),
    calculateCategoryScore(pitch, contact, intent, config),
    calculateSectorScore(pitch, contact, intent, config),
    calculateBusinessModelScore(pitch, contact, intent, config),
    calculateStageScore(pitch, contact, intent, config),
    calculateCustomerTypeScore(pitch, contact, intent, config),
    calculateGeographyScore(pitch, contact, intent, config),
    calculateNeedOfferScore(pitch, contact, intent, config),
    calculateTractionScore(pitch, contact, intent, config),
    calculateTeamScore(pitch, contact, intent, config),
    calculateSemanticScore(pitch, contact, intent, config),
    calculateCounterpartFitScore(pitch, contact, intent, config),
  ];

  for (const c of components) c.weightedScore = c.score * c.weight;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0) || 1;
  const rawScore = components.reduce((s, c) => s + c.weightedScore, 0);
  let normalizedScore = rawScore / totalWeight;

  const penalties: string[] = [];
  const policy = getIntentPolicy(intent, config);
  const get = (name: string) => components.find(c => c.name === name);
  if (get('sectorScore')!.score < 20) penalties.push('Sector mismatch penalty');
  if (get('stageScore')!.score < 20 && policy.stageHardFilterMode !== 'NONE') penalties.push('Stage mismatch penalty');
  if (get('intentScore')!.score < 20) penalties.push('Intent mismatch penalty');
  if (get('needOfferScore')!.score < 25) penalties.push('Need-offer weakness penalty');
  if (get('counterpartFitScore')!.score < 25) penalties.push('Counterpart-fit weakness penalty');
  if (policy.requireCustomerTypeFit && get('customerTypeScore')!.score < 25) penalties.push('Customer-type fit penalty');

  if (penalties.length > 0) {
    normalizedScore *= penalties.length >= 5 ? 0.55 : penalties.length === 4 ? 0.64 : penalties.length === 3 ? 0.74 : penalties.length === 2 ? 0.84 : 0.92;
  }

  const confidence = components.reduce((s, c) => s + c.confidence * c.weight, 0) / totalWeight;

  return {
    intent, components,
    rawScore: clampScore(rawScore),
    normalizedScore: clampScore(normalizedScore),
    confidence, totalWeight,
    penalties: [...components.flatMap(c => c.penalties), ...penalties, `Intent policy: ${intent}`],
  };
}

export function extractKeyReasons(components: ScoringComponent[]): string[] {
  return [...components].filter(c => c.score >= 55).sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 5).map(c => c.explanation);
}

// ============================================================================
// INTERNAL HELPERS (abbreviated for space — same logic as v7)
// ============================================================================

function scoreNeedOfferDetails(needText: string, offerParts: string[], needEmb: number[] | undefined, offerEmb: number[] | undefined, intent: MatchIntent): { score: number; evidence: string[]; confidence: number } {
  const needSegs = splitIntoSemanticSegments(needText);
  const offerSegs = offerParts.flatMap(splitIntoSemanticSegments);
  const evidence: string[] = [];
  const structured = needSegs.map(s => ({ segment: s, labels: classifyNeedSegment(s, intent) }));
  const reranked = structured.map(item => rerankSegmentAgainstOffers(item.segment, item.labels, offerSegs, intent));
  const baseCov = reranked.length ? average(reranked.map(i => i.score)) : 0;
  const critical = reranked.filter(i => i.labels.some(l => CRITICAL_NEED_LABELS.has(l)));
  const critCov = critical.length ? average(critical.map(i => i.score)) : baseCov;
  const conceptMatches = matchedNeedOfferConcepts(needText, offerParts.join(' '));
  const conceptCov = needSegs.length ? Math.min(1, conceptMatches.length / Math.max(1, Math.min(needSegs.length, 5))) : 0;
  const phraseMatches = matchedPhraseTaxonomy(needText, offerParts.join(' '));
  const phraseCov = Math.min(1, phraseMatches.length / 4);
  const intentSig = keywordCoverage(`${needText} ${offerParts.join(' ')}`, MATCH_INTENT_KEYWORDS[intent] || []);
  const lexical = semanticTextSimilarity(needText, offerParts.join(' '));
  const fieldCov = structured.length ? average(structured.map(item => coverageRatio(item.labels, classifyNeedSegment(offerParts.join(' '), intent)))) : 0;

  let embedding = 0;
  const hasEmb = !!(needEmb?.length && offerEmb?.length && needEmb.length === offerEmb.length);
  if (hasEmb) { embedding = Math.max(0, calculateCosineSimilarity(needEmb!, offerEmb!)); evidence.push(`Embedding similarity: ${Math.round(embedding * 100)}%`); }

  const embW = hasEmb ? 0.16 : 0;
  const raw = { baseCov: 0.22, critCov: 0.18, conceptCov: 0.14, phraseCov: 0.10, lexical: 0.08, intentSig: 0.06, fieldCov: 0.06 };
  const rawSum = Object.values(raw).reduce((a, b) => a + b, 0);
  const scale = hasEmb ? 1 : (1 / rawSum);
  const score = embW * embedding + raw.baseCov * (hasEmb ? 1 : scale) * baseCov + raw.critCov * (hasEmb ? 1 : scale) * critCov + raw.conceptCov * (hasEmb ? 1 : scale) * conceptCov + raw.phraseCov * (hasEmb ? 1 : scale) * phraseCov + raw.lexical * (hasEmb ? 1 : scale) * lexical + raw.intentSig * (hasEmb ? 1 : scale) * intentSig + raw.fieldCov * (hasEmb ? 1 : scale) * fieldCov;

  const best = reranked.filter(i => i.score >= 0.42).sort((a, b) => b.score - a.score).slice(0, 4);
  for (const i of best) { evidence.push(`Need '${i.segment}' matched '${i.bestOffer}' (${Math.round(i.score * 100)}%)`); }
  if (conceptMatches.length) evidence.push(`Concepts: ${conceptMatches.join(', ')}`);
  if (phraseMatches.length) evidence.push(`Phrases: ${phraseMatches.join(', ')}`);

  const conf = hasEmb ? 0.9 : critCov > 0.62 ? 0.86 : baseCov > 0.54 || phraseMatches.length >= 2 ? 0.78 : baseCov > 0.34 ? 0.66 : 0.5;
  return { score: Math.min(1, score), evidence: uniqueStrings(evidence), confidence: conf };
}

function getNeedOfferSemanticScore(pitch: PitchProfile, contact: PitchContact, intent: MatchIntent): number {
  return scoreNeedOfferDetails(pitch.whatYouNeed, getContactOfferCorpus(contact, intent), pitch.needEmbedding, contact.needOfferEmbedding, intent).score;
}

function getContactOfferCorpus(contact: PitchContact, intent: MatchIntent): string[] {
  const base = [contact.title, contact.company, ...contact.canOffer, ...contact.keywords, ...contact.expertise, ...contact.sectors, ...contact.categories, ...contact.customerTypes].filter(Boolean);
  const extra: string[] = [];
  if (intent === MatchIntent.INVESTOR) { extra.push(...(contact.investmentProfile?.investorTypes || []), ...(contact.investmentProfile?.portfolioFocus || []), ...(contact.investmentProfile?.deploymentGeographies || [])); if (contact.investmentProfile?.checkSizeNotes) extra.push(contact.investmentProfile.checkSizeNotes); }
  else if (intent === MatchIntent.ADVISOR) { extra.push(...(contact.advisorProfile?.advisorRoles || []), ...(contact.advisorProfile?.functionalExpertise || []), ...(contact.advisorProfile?.operatorBackground || [])); if (contact.advisorProfile?.boardExperience) extra.push('board experience governance'); }
  else if (intent === MatchIntent.STRATEGIC_PARTNER) { extra.push(...(contact.partnerProfile?.partnerCapabilities || []), ...(contact.partnerProfile?.partnershipTypes || []), ...(contact.partnerProfile?.distributionMarkets || []), ...(contact.partnerProfile?.integrationCapabilities || [])); }
  else if (intent === MatchIntent.COFOUNDER) { extra.push(...(contact.founderProfile?.founderRoles || []), ...(contact.founderProfile?.builderFunctions || []), ...(contact.founderProfile?.startupExperience || []), ...(contact.founderProfile?.cofounderStyle || [])); }
  else if (intent === MatchIntent.CUSTOMER_BUYER) { extra.push(...(contact.buyerProfile?.buyerSeniority || []), ...(contact.buyerProfile?.buyerIndustries || []), ...(contact.buyerProfile?.buyingRoles || [])); if (contact.buyerProfile?.procurementAuthority) extra.push('procurement authority decision maker'); }
  return uniqueStrings([...base, ...extra]);
}

function rerankSegmentAgainstOffers(seg: string, labels: string[], offerSegs: string[], intent: MatchIntent): { segment: string; labels: string[]; bestOffer: string; score: number } {
  let best = ''; let bestScore = 0;
  for (const c of offerSegs) {
    const lex = semanticTextSimilarity(seg, c);
    const phr = phraseTaxonomySimilarity(seg, c);
    const con = matchedNeedOfferConcepts(seg, c).length ? 0.12 : 0;
    const lab = coverageRatio(labels, classifyNeedSegment(c, intent));
    const s = Math.min(1, lex * 0.50 + phr * 0.16 + con + 0.18 * lab + 0.04 * keywordCoverage(`${seg} ${c}`, MATCH_INTENT_KEYWORDS[intent] || []));
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return { segment: seg, labels, bestOffer: best, score: bestScore };
}

const CRITICAL_NEED_LABELS = new Set(['funding', 'distribution', 'integration', 'technical', 'customer', 'buyer', 'cofounder', 'advisor']);

function classifyNeedSegment(seg: string, intent: MatchIntent): string[] {
  const text = normalizeTag(seg);
  const labels = new Set<string>();
  const rules: Array<[string, string[]]> = [
    ['funding', ['funding', 'raise', 'investment', 'angel', 'seed', 'series a', 'capital']],
    ['distribution', ['distribution', 'channel', 'reseller', 'go to market', 'gtm', 'sales partner']],
    ['integration', ['integration', 'api', 'platform', 'technical integration', 'sdk']],
    ['technical', ['cto', 'technical', 'engineering', 'ai lead', 'product builder', 'developer']],
    ['advisor', ['advisor', 'mentor', 'board', 'expert', 'governance']],
    ['customer', ['customer', 'pilot', 'design partner', 'enterprise buyer', 'early customer']],
    ['buyer', ['procurement', 'purchase', 'buyer', 'budget owner', 'decision maker']],
    ['cofounder', ['cofounder', 'founding', 'co-founder']],
    ['operations', ['operations', 'ops', 'execution']],
    ['growth', ['growth', 'marketing', 'demand gen', 'partnerships']],
  ];
  for (const [label, tokens] of rules) { if (tokens.some(t => text.includes(normalizeTag(t)))) labels.add(label); }
  if (intent === MatchIntent.INVESTOR) labels.add('funding');
  if (intent === MatchIntent.ADVISOR) labels.add('advisor');
  if (intent === MatchIntent.STRATEGIC_PARTNER) labels.add('distribution');
  if (intent === MatchIntent.COFOUNDER) labels.add('cofounder');
  if (intent === MatchIntent.CUSTOMER_BUYER) labels.add('customer');
  return [...labels];
}

function inferInvestorTicketFit(pitch: PitchProfile, contact: PitchContact): number {
  const min = contact.investmentProfile?.ticketMinUsd;
  const max = contact.investmentProfile?.ticketMaxUsd;
  if (!min && !max) return 0.45;
  let approx: number | null = null;
  if (typeof pitch.fundingAmountRequested === 'number') approx = pitch.fundingAmountRequested;
  else { const text = normalizeTag(`${pitch.whatYouNeed} ${pitch.tractionSummary || ''}`); approx = inferRaiseAmount(text); }
  if (!approx) return 0.72;
  if (min && approx < min * 0.5) return 0.35;
  if (max && approx > max * 1.8) return 0.3;
  if (min && approx < min) return 0.62;
  if (max && approx > max) return 0.62;
  return 0.94;
}

function inferRaiseAmount(text: string): number | null {
  const m = text.replace(/[, ]+/g, ' ').match(/(\d+(?:\.\d+)?)\s*(k|m|mn|million)?\s*(usd|dollars|\$)?/i);
  if (!m) return null;
  let v = Number(m[1]);
  const s = (m[2] || '').toLowerCase();
  if (s === 'k') v *= 1_000;
  if (s in { 'm': 1, 'mn': 1, 'million': 1 }) v *= 1_000_000;
  return v;
}

function calculateCofounderComplementarityScore(pitch: PitchProfile, contact: PitchContact): number {
  const needLabels = classifyNeedSegment(pitch.whatYouNeed, MatchIntent.COFOUNDER);
  const founderText = [...(contact.founderProfile?.founderRoles || []), ...(contact.founderProfile?.builderFunctions || []), ...(contact.founderProfile?.cofounderStyle || []), contact.title, ...contact.expertise, ...contact.keywords].join(' ');
  let score = coverageRatio(needLabels, classifyNeedSegment(founderText, MatchIntent.COFOUNDER));
  const nt = normalizeTag(founderText);
  if (/technical|cto|engineer|product/.test(nt) && /gtm|sales|growth|business/.test(normalizeTag(pitch.founderBackgroundSummary || ''))) score = Math.max(score, 0.9);
  if (/sales|growth|business|commercial/.test(nt) && /technical|engineer|product|ai/.test(normalizeTag(pitch.founderBackgroundSummary || ''))) score = Math.max(score, 0.9);
  return score || 0.35;
}

function getNeedOfferHardFilterThreshold(intent: MatchIntent, pitch: PitchProfile, contact: PitchContact, config: PitchMatchingConfig): number {
  const base: Record<MatchIntent, number> = { [MatchIntent.INVESTOR]: 0.24, [MatchIntent.ADVISOR]: 0.18, [MatchIntent.STRATEGIC_PARTNER]: 0.22, [MatchIntent.COFOUNDER]: 0.20, [MatchIntent.CUSTOMER_BUYER]: 0.23 };
  let t = base[intent];
  const q = Math.min(pitch.dataQualityScore || 0, contact.dataQualityScore || 0);
  if (q < config.thresholds.sparseRecordThreshold) t -= 0.03;
  if (contact.canOffer.length >= 4 || contact.expertise.length >= 4) t -= 0.01;
  if (!pitch.whatYouNeed || !contact.canOffer.length) t += 0.02;
  return Math.max(0.14, Math.min(0.28, Number(t.toFixed(2))));
}

// Utility functions
function splitIntoSemanticSegments(text: string): string[] { const r = (text || '').split(/[\n,;|/]+/g).map(i => i.trim()).filter(Boolean); return r.length ? r : text ? [text] : []; }
function semanticTextSimilarity(a: string, b: string): number { const tA = expandTokens(tokenize(a)); const tB = expandTokens(tokenize(b)); if (!tA.size || !tB.size) return 0; let o = 0; for (const t of tA) if (tB.has(t)) o++; const lex = o / Math.max(tA.size, tB.size); const c = matchedNeedOfferConcepts(a, b).length; return Math.min(1, lex + (c ? Math.min(0.35, c * 0.08) : 0)); }
function matchedNeedOfferConcepts(need: string, offer: string): string[] { const nn = normalizeTag(need); const no = normalizeTag(offer); const m: string[] = []; for (const [c, syns] of Object.entries(NEED_OFFER_CONCEPTS)) { if (syns.some(k => nn.includes(normalizeTag(k))) && syns.some(k => no.includes(normalizeTag(k)))) m.push(c); } return m; }
function extractFunctionalNeeds(text: string): string[] { if (!text) return []; const f: string[] = []; for (const [c, syns] of Object.entries(NEED_OFFER_CONCEPTS)) { if (syns.some(k => normalizeTag(text).includes(normalizeTag(k)))) f.push(c); } return f.length ? f : tokenize(text).slice(0, 8); }
function coverageRatio(src: string[], tgt: string[]): number { if (!src.length || !tgt.length) return 0; return matchedNormalizedValues(src, tgt).length / Math.max(1, src.length); }
function matchedNormalizedValues(src: string[], tgt: string[]): string[] { const tn = tgt.map(normalizeTag); const m: string[] = []; for (const v of src) { const n = normalizeTag(v); if (!n) continue; if (tn.some(c => c === n || c.includes(n) || n.includes(c) || areSectorsRelated(c, n))) m.push(v); } return uniqueStrings(m); }
function keywordCoverage(text: string, kws: string[]): number { if (!text || !kws.length) return 0; const n = normalizeTag(text); let m = 0; for (const k of kws) if (n.includes(normalizeTag(k))) m++; return m / kws.length; }
function expandTokens(tokens: string[]): Set<string> { const e = new Set<string>(); for (const t of tokens) { e.add(t); for (const [c, syns] of Object.entries(NEED_OFFER_CONCEPTS)) { if (t === c || syns.some(i => tokenize(i).includes(t))) { e.add(c); for (const s of syns.flatMap(tokenize)) e.add(s); } } } return e; }
function tokenize(text: string): string[] { return normalizeTag(text).split(/\s+/).filter(t => t.length > 2 && !STOPWORDS.has(t)); }
function uniqueStrings(vals: string[]): string[] { const seen = new Set<string>(); const out: string[] = []; for (const v of vals) { const n = normalizeTag(v); if (!n || seen.has(n)) continue; seen.add(n); out.push(v); } return out; }
function average(vals: number[]): number { return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0; }
function pass(): HardFilterResult { return { status: HardFilterStatus.PASS, reason: HardFilterReason.NONE, details: '', evidence: [] }; }
function fail(reason: HardFilterReason, details: string): HardFilterResult { return { status: HardFilterStatus.FAIL, reason, details, evidence: [details] }; }
function normalizeWeights(w: PitchScoringWeights): PitchScoringWeights { const e = Object.entries(w) as Array<[keyof PitchScoringWeights, number]>; const t = e.reduce((s, [, v]) => s + v, 0) || 1; const n = {} as PitchScoringWeights; for (const [k, v] of e) n[k] = v / t; return n; }
function overlapCount(a: string[], b: string[]): number { const bs = new Set(b.map(normalizeTag)); return a.map(normalizeTag).filter(v => bs.has(v)).length; }
function matchedPhraseTaxonomy(need: string, offer: string): string[] { const nn = normalizeTag(need); const no = normalizeTag(offer); const m: string[] = []; for (const i of PHRASE_TAXONOMY) { if (i.phrases.some(p => nn.includes(normalizeTag(p))) && i.phrases.some(p => no.includes(normalizeTag(p)))) m.push(i.label); } return m; }
function phraseTaxonomySimilarity(a: string, b: string): number { const m = matchedPhraseTaxonomy(a, b).length; return m ? Math.min(1, 0.34 + m * 0.18) : 0; }
function comp(name: string, score: number, weight: number, evidence: string[], penalties: string[], confidence: number): ScoringComponent { return { name, score: clampScore(score), weight, weightedScore: 0, explanation: evidence.length ? evidence.join('; ') : penalties.length ? penalties.join('; ') : `${name}: ${Math.round(score)}`, confidence, evidence, penalties }; }
function getClosestStageDistance(stage: PitchStage, candidates: PitchStage[]): number { if (!candidates.length) return Infinity; const si = STAGE_ORDER.indexOf(stage); return Math.min(...candidates.map(c => Math.abs(STAGE_ORDER.indexOf(c) - si))); }


