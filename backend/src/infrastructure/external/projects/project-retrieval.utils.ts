import {
  CounterpartType,
  ProjectFilterOptions,
  ProjectIntent,
  ProjectMatchingConfig,
  ProjectProfile,
  ProviderProfile,
  CandidateRetrievalDebug,
  mapIntentToCounterpart,
} from './project-matching.types';
import {
  buildOfferSignals,
  buildProjectNeedSignals,
  cosineSimilarity,
  normalizeProviderProfile,
  normalizeText,
  normalizeStringArray,
  normalizeProjectProfile,
  overlapScore,
  tokenize,
  unique,
  jaccard,
} from './project-normalization.utils';

export interface RetrievalCandidate {
  provider: ProviderProfile;
  debug: CandidateRetrievalDebug;
}

function buildStructuredWhere(
  project: ProjectProfile,
  intent: ProjectIntent,
  filters?: ProjectFilterOptions,
): Record<string, unknown> {
  const targetType = mapIntentToCounterpart(intent);
  const sectors = unique([...(filters?.sectors || []), ...(project.industrySectors || [])]).slice(0, 8);
  const markets = unique([...(filters?.markets || []), ...(project.operatingMarkets || [])]).slice(0, 8);

  const where: Record<string, unknown> = {
    blocked: false,
    optedOut: false,
    counterpartType: filters?.counterpartTypes?.length ? { in: filters.counterpartTypes } : targetType,
  };

  if (filters?.requireVerified) where['verified'] = true;
  if (filters?.minDataQualityScore) where['dataQualityScore'] = { gte: filters.minDataQualityScore };

  const or: Record<string, unknown>[] = [];
  if (sectors.length) {
    or.push({ sectors: { hasSome: sectors } });
    or.push({ investorProfile: { path: ['thesisSectors'], array_contains: sectors[0] } });
  }
  if (markets.length) {
    or.push({ operatingMarkets: { hasSome: markets } });
  }
  if (project.projectStage) {
    or.push({ investorProfile: { path: ['preferredStages'], array_contains: project.projectStage } });
    or.push({ talentProfile: { path: ['startupStageComfort'], array_contains: project.projectStage } });
  }

  if (or.length) where['OR'] = or;
  return where;
}

function lexicalScore(project: ProjectProfile, provider: ProviderProfile): number {
  const left = unique([
    ...tokenize(project.summary),
    ...tokenize(project.detailedDescription),
    ...tokenize(project.projectNeeds),
    ...(project.skillsNeeded || []).flatMap(tokenize),
    ...(project.industrySectors || []).flatMap(tokenize),
    ...(project.keywords || []).flatMap(tokenize),
  ]);
  const right = unique([
    ...tokenize(provider.description),
    ...(provider.skills || []).flatMap(tokenize),
    ...(provider.capabilities || []).flatMap(tokenize),
    ...(provider.sectors || []).flatMap(tokenize),
    ...(provider.keywords || []).flatMap(tokenize),
  ]);
  return jaccard(left, right);
}

function semanticScore(project: ProjectProfile, provider: ProviderProfile): number {
  const global = cosineSimilarity(project.embedding, provider.embedding);
  const fields: number[] = [];
  if (project.fieldEmbeddings?.projectNeeds && provider.fieldEmbeddings?.capabilities) {
    fields.push(cosineSimilarity(project.fieldEmbeddings.projectNeeds, provider.fieldEmbeddings.capabilities));
  }
  if (project.fieldEmbeddings?.skillsNeeded && provider.fieldEmbeddings?.skills) {
    fields.push(cosineSimilarity(project.fieldEmbeddings.skillsNeeded, provider.fieldEmbeddings.skills));
  }
  if (project.fieldEmbeddings?.industrySectors && provider.fieldEmbeddings?.sectors) {
    fields.push(cosineSimilarity(project.fieldEmbeddings.industrySectors, provider.fieldEmbeddings.sectors));
  }
  const avgField = fields.length ? fields.reduce((a, b) => a + b, 0) / fields.length : 0;
  return Math.min(1, global * 0.5 + avgField * 0.5);
}

function structuredFilterScore(project: ProjectProfile, provider: ProviderProfile, intent: ProjectIntent): { score: number; matched: string[] } {
  const matched: string[] = [];
  const targetType = mapIntentToCounterpart(intent);
  let score = provider.counterpartType === targetType ? 0.3 : 0;
  if (provider.counterpartType === targetType) matched.push(`counterpart:${targetType}`);

  const sectorFit = overlapScore(project.industrySectors || [], provider.sectors || []);
  if (sectorFit > 0) {
    score += Math.min(0.2, sectorFit * 0.2);
    matched.push('sectors');
  }

  const marketFit = overlapScore(project.operatingMarkets || [], provider.operatingMarkets || []);
  if (marketFit > 0) {
    score += Math.min(0.15, marketFit * 0.15);
    matched.push('markets');
  }

  const needClusters = unique(buildProjectNeedSignals(project).flatMap(item => item.clusters));
  const offerClusters = unique(buildOfferSignals(provider).flatMap(item => item.clusters));
  const clusterHit = needClusters.filter(item => offerClusters.includes(item));
  if (clusterHit.length) {
    score += Math.min(0.2, clusterHit.length * 0.05);
    matched.push(`clusters:${clusterHit.slice(0, 4).join('|')}`);
  }

  const typeLookingFor = (project.lookingFor || []).includes(targetType);
  if (typeLookingFor) {
    score += 0.1;
    matched.push('lookingFor');
  }

  return { score: Math.min(1, score), matched };
}

export async function retrieveProjectCandidates(args: {
  prisma: any;
  project: ProjectProfile;
  intent: ProjectIntent;
  config: ProjectMatchingConfig;
  filters?: ProjectFilterOptions;
  networkUserIds?: Set<string>;
}): Promise<RetrievalCandidate[]> {
  const project = normalizeProjectProfile(args.project);
  const targetType = mapIntentToCounterpart(args.intent);
  const where = buildStructuredWhere(project, args.intent, args.filters);

  // Network-scoped: only discover providers whose userId is in the requester's network
  if (args.networkUserIds && args.networkUserIds.size > 0) {
    (where as any).userId = { in: [...args.networkUserIds] };
  }

  const rows = await args.prisma.providerProfile.findMany({
    where,
    take: args.config.defaultThresholds.retrievalTake,
    orderBy: [{ verified: 'desc' }, { updatedAt: 'desc' }],
  });

  const candidates = (rows || [])
    .map((row: any) => normalizeProviderProfile(row as ProviderProfile))
    .filter((provider: ProviderProfile) => provider.counterpartType === targetType || (args.filters?.counterpartTypes || []).includes(provider.counterpartType))
    .map((provider: ProviderProfile) => {
      const structured = structuredFilterScore(project, provider, args.intent);
      const lexical = lexicalScore(project, provider);
      const semantic = args.config.features.enableSemanticMatching ? semanticScore(project, provider) : 0;
      const retrievalScore = structured.score * 0.45 + lexical * 0.25 + semantic * 0.3;
      return {
        provider,
        debug: {
          providerId: provider.id,
          structuredFilterScore: Number(structured.score.toFixed(4)),
          lexicalScore: Number(lexical.toFixed(4)),
          semanticScore: Number(semantic.toFixed(4)),
          retrievalScore: Number(retrievalScore.toFixed(4)),
          matchedFilters: structured.matched,
        },
      };
    })
    .filter(item => item.debug.retrievalScore >= args.config.defaultThresholds.retrievalMinScore)
    .sort((a, b) => b.debug.retrievalScore - a.debug.retrievalScore)
    .slice(0, args.config.defaultThresholds.maxCandidatesToScore);

  return candidates;
}
