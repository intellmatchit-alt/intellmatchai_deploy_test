import { CounterpartType, NeedCluster } from './project-matching.types';

export const PHRASE_NORMALIZATION_RULES: Array<[RegExp, string]> = [
  [/\bgo[- ]to[- ]market\b/gi, 'go to market'],
  [/\bgtm\b/gi, 'go to market'],
  [/\btechnical co[- ]founder\b/gi, 'technical cofounder'],
  [/\bcto\b/gi, 'technical leader'],
  [/\bchannel partner\b/gi, 'distribution partner'],
  [/\bregional reseller\b/gi, 'distribution partner'],
  [/\boem\b/gi, 'manufacturing partner'],
  [/\bcapital raising\b/gi, 'fundraising support'],
  [/\bfundraising\b/gi, 'fundraising support'],
  [/\bboard advisor\b/gi, 'advisor'],
  [/\bangel investor\b/gi, 'investor'],
  [/\bux\/ui\b/gi, 'ux design'],
  [/\bui\/ux\b/gi, 'ux design'],
  [/\bbiz dev\b/gi, 'business development'],
  [/\bbd\b/gi, 'business development'],
  [/\bmachine learning\b/gi, 'ai'],
  [/\bartificial intelligence\b/gi, 'ai'],
];

export const CLUSTER_ONTOLOGY: Record<NeedCluster, string[]> = {
  FUNDING: ['funding', 'capital', 'investor', 'angel', 'vc', 'venture', 'seed', 'series a', 'raise', 'fundraising support'],
  GO_TO_MARKET: ['go to market', 'market entry', 'launch strategy', 'pricing strategy'],
  CHANNELS: ['channel', 'reseller', 'distribution channel', 'retail channel', 'partner channel'],
  TECH_BUILD: ['engineering', 'software development', 'mvp build', 'technical leader', 'backend', 'frontend', 'platform build', 'full stack'],
  PRODUCT: ['product', 'product management', 'roadmap', 'feature prioritization'],
  DATA_AI: ['ai', 'machine learning', 'data science', 'analytics', 'llm', 'rag'],
  OPERATIONS: ['operations', 'supply chain', 'process', 'execution'],
  SALES: ['sales', 'business development', 'enterprise sales', 'lead generation'],
  DISTRIBUTION: ['distribution partner', 'reseller', 'dealer', 'wholesale'],
  MANUFACTURING: ['manufacturing', 'factory', 'production partner', 'hardware production'],
  PARTNERSHIPS: ['strategic partner', 'integration partner', 'alliances', 'business partnership'],
  COMPLIANCE: ['compliance', 'regulatory', 'governance'],
  MARKETING: ['marketing', 'growth marketing', 'performance marketing', 'brand'],
  RESEARCH: ['research', 'validation', 'pilot study', 'proof of concept'],
  HIRING: ['hiring', 'recruitment', 'talent acquisition', 'team building'],
  STRATEGY: ['strategy', 'advisor', 'mentor', 'board', 'strategic'],
  UX_DESIGN: ['ux design', 'ui design', 'product design', 'experience design'],
  LEGAL: ['legal', 'contracts', 'terms', 'privacy'],
  OTHER: [],
};

export const COUNTERPART_HINT_ONTOLOGY: Array<{ pattern: RegExp; hints: CounterpartType[] }> = [
  { pattern: /investor|capital|funding|angel|vc|venture/i, hints: [CounterpartType.INVESTOR] },
  { pattern: /advisor|board|mentor|strategy/i, hints: [CounterpartType.ADVISOR] },
  { pattern: /technical cofounder|cofounder|founding engineer|technical leader/i, hints: [CounterpartType.COFOUNDER] },
  { pattern: /team member|hire|employee|developer|designer|sales lead/i, hints: [CounterpartType.TALENT] },
  { pattern: /supplier|vendor|manufacturing|agency|development shop|service provider/i, hints: [CounterpartType.SERVICE_PROVIDER] },
  { pattern: /partner|distribution|reseller|channel|integration|alliance/i, hints: [CounterpartType.PARTNER] },
];

export const SEMANTIC_EQUIVALENCE_GROUPS: string[][] = [
  ['distribution partner', 'channel partner', 'reseller', 'dealer'],
  ['go to market', 'gtm', 'market entry', 'launch strategy'],
  ['fundraising support', 'capital raising', 'investor outreach'],
  ['technical cofounder', 'startup cto', 'technical leader', 'founding engineer'],
  ['advisory', 'advisor', 'mentor', 'board guidance'],
  ['service provider', 'vendor', 'agency', 'outsourcing partner'],
  ['integration partner', 'strategic partner', 'technology partner'],
];
