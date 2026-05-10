/**
 * Advanced Matching Adapter
 *
 * Bridges the legacy candidate fetching (User/Contact queries) with the
 * advanced 14-component scoring engine. Produces v2 match data (structured
 * explanations, confidence, match levels) while maintaining backward
 * compatibility with v1 ProjectMatch fields.
 */

import { PrismaClient, ProjectMatch } from '@prisma/client';
import { logger } from '../../../shared/logger';
import { LLMService } from '../../../shared/llm';
import {
  ProjectProfile,
  ProviderProfile,
  ProjectIntent,
  CounterpartType,
  ProjectStage as AdvancedProjectStage,
  PrimaryCategory,
  DEFAULT_PROJECT_CONFIG,
  getPolicyForIntent,
  mapIntentToCounterpart,
} from './project-matching.types';
import {
  calculateProjectDeterministicScore,
  runProjectHardFilters,
  buildStructuredExplanation,
} from './project-scoring.utils';
import {
  normalizeProjectProfile,
  normalizeProviderProfile,
  buildProjectNeedSignals,
} from './project-normalization.utils';
import { HardFilterStatus, MatchLevel } from '../common/matching-common.types';
import { determineMatchLevel, isSparseRecord, generateMatchId } from '../common/matching-common.utils';
import { buildProviderFromUser, buildProviderFromContact, UserWithRelations, ContactWithRelations } from './provider-profile.mapper';
import { targetDedupeKeys } from './lookingForEnhancedScorer';
import { EXCLUDE_TEST_ACCOUNTS, EXCLUDE_TEST_ACCOUNTS_NULLABLE } from './test-account-filter';

const config = DEFAULT_PROJECT_CONFIG;

// Safely parse JSON array values from database (may be string or array)
function safeJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* not valid JSON */ }
  }
  return [];
}

// Map DB project stage to advanced stage
function mapProjectStage(stage?: string): AdvancedProjectStage {
  const map: Record<string, AdvancedProjectStage> = {
    'IDEA': AdvancedProjectStage.JUST_AN_IDEA,
    'MVP': AdvancedProjectStage.BUILDING_MVP,
    'EARLY': AdvancedProjectStage.VALIDATING,
    'GROWTH': AdvancedProjectStage.GROWING,
    'SCALE': AdvancedProjectStage.SCALING,
  };
  return map[stage || 'IDEA'] || AdvancedProjectStage.JUST_AN_IDEA;
}

// Map lookingFor IDs to CounterpartType
function mapLookingForToCounterpartTypes(lookingFor: string[]): CounterpartType[] {
  const map: Record<string, CounterpartType> = {
    'investor': CounterpartType.INVESTOR,
    'advisor': CounterpartType.ADVISOR,
    'service_provider': CounterpartType.SERVICE_PROVIDER,
    'strategic_partner': CounterpartType.PARTNER,
    'channel_distribution': CounterpartType.PARTNER,
    'technical_partner': CounterpartType.PARTNER,
    'cofounder_talent': CounterpartType.COFOUNDER,
  };
  return [...new Set(lookingFor.map(id => map[id] || CounterpartType.PARTNER))];
}

// Infer the best intent from lookingFor array
function inferIntent(lookingFor: string[]): ProjectIntent {
  if (lookingFor.includes('investor')) return ProjectIntent.FIND_INVESTOR;
  if (lookingFor.includes('advisor')) return ProjectIntent.FIND_ADVISOR;
  if (lookingFor.includes('service_provider')) return ProjectIntent.FIND_SERVICE_PROVIDER;
  if (lookingFor.includes('cofounder_talent')) return ProjectIntent.FIND_COFOUNDER;
  if (lookingFor.includes('technical_partner')) return ProjectIntent.FIND_PARTNER;
  return ProjectIntent.FIND_PARTNER;
}

// Build ProjectProfile from DB project
function buildProjectProfile(project: any): ProjectProfile {
  const lookingFor = safeJsonArray(project.lookingFor) as string[];
  const sectors = (project.sectors || []).map((ps: any) => ps.sector?.name || ps.name).filter(Boolean);
  const skills = (project.skillsNeeded || []).map((ps: any) => ps.skill?.name || ps.name).filter(Boolean);
  const keywords = safeJsonArray(project.keywords) as string[];
  const needs = safeJsonArray(project.needs) as string[];
  const markets = safeJsonArray(project.markets) as string[];

  return normalizeProjectProfile({
    id: project.id,
    ownerId: project.userId,
    projectTitle: project.title || '',
    summary: project.summary || '',
    detailedDescription: project.detailedDesc || '',
    projectNeeds: needs.join(', ') || project.whatYouNeed || '',
    projectStage: mapProjectStage(project.stage),
    primaryCategory: (project.category || 'OTHER') as PrimaryCategory | string,
    timeline: project.timeline || undefined,
    lookingFor: mapLookingForToCounterpartTypes(lookingFor),
    industrySectors: sectors,
    skillsNeeded: skills,
    operatingMarkets: markets,
    fundingAskMin: project.fundingAskMin || undefined,
    fundingAskMax: project.fundingAskMax || undefined,
    advisoryTopics: safeJsonArray(project.advisoryTopics) as string[] || undefined,
    partnerTypeNeeded: safeJsonArray(project.partnerTypeNeeded) as string[] || undefined,
    commitmentLevelNeeded: project.commitmentLevelNeeded || undefined,
    idealCounterpartProfile: project.idealCounterpartProfile || undefined,
    engagementModel: safeJsonArray(project.engagementModel) as string[] || undefined,
    targetCustomerTypes: safeJsonArray(project.targetCustomerTypes) as string[] || undefined,
    keywords,
    dataQualityScore: 70,
    strictLookingFor: project.strictLookingFor || false,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  } as ProjectProfile);
}

// Component labels and weight lookups
const COMPONENT_META: Record<string, { label: string; descFn: (score: number, provider: ProviderProfile, breakdown: any) => string }> = {
  lookingForFit: { label: 'Looking For Fit', descFn: (s, p) => s >= 80 ? `${p.name} matches your lookingFor preferences` : s > 0 ? 'Partial lookingFor alignment' : 'Not in lookingFor list' },
  counterpartFit: { label: 'Counterpart Type', descFn: (s, p) => s >= 80 ? `Identified as ${p.counterpartType.toLowerCase().replace('_', ' ')}` : 'Type mismatch' },
  needCoverage: { label: 'Need Coverage', descFn: (s, _, b) => { const n = b?.matchedNeeds?.length || 0; return n > 0 ? `${n} project need${n > 1 ? 's' : ''} covered` : 'No strong need coverage'; } },
  needPrecision: { label: 'Need Precision', descFn: (s) => s >= 50 ? 'Good precision on matched needs' : 'Low need precision' },
  capabilityFit: { label: 'Capability Fit', descFn: (s) => s >= 50 ? 'Capabilities align with project needs' : 'Limited capability overlap' },
  skillFit: { label: 'Skills Match', descFn: (s, _, b) => { const n = b?.matchedSkills?.length || 0; return n > 0 ? `${n} skill${n > 1 ? 's' : ''} matched` : 'No skill overlap'; } },
  sectorFit: { label: 'Industry Alignment', descFn: (s, _, b) => { const n = b?.matchedSectors?.length || 0; return n > 0 ? `${n} sector${n > 1 ? 's' : ''} aligned` : 'No sector overlap'; } },
  marketFit: { label: 'Market Fit', descFn: (s, _, b) => { const n = b?.matchedMarkets?.length || 0; return n > 0 ? `${n} market${n > 1 ? 's' : ''} overlap` : 'No market overlap'; } },
  stageFit: { label: 'Stage Fit', descFn: (s) => s >= 70 ? 'Good project stage alignment' : s >= 40 ? 'Moderate stage fit' : 'Stage mismatch' },
  engagementFit: { label: 'Engagement Fit', descFn: (s) => s >= 50 ? 'Compatible engagement model' : 'Engagement model gap' },
  subtypeSpecificFit: { label: 'Role-Specific Fit', descFn: (s, p) => s >= 50 ? `Strong ${p.counterpartType.toLowerCase().replace('_', ' ')} specific fit` : 'Limited role-specific alignment' },
  credibilityFit: { label: 'Credibility', descFn: (s) => s >= 70 ? 'High credibility signals' : s >= 40 ? 'Moderate credibility' : 'Low credibility data' },
  semanticFit: { label: 'Semantic Match', descFn: (s) => s >= 50 ? 'Strong text similarity' : 'Low semantic overlap' },
  completenessFit: { label: 'Data Completeness', descFn: (s) => s >= 80 ? 'Complete profiles on both sides' : 'Some profile data missing' },
};

function buildRichScoreBreakdown(breakdown: any, provider: ProviderProfile, intent: ProjectIntent) {
  // Read from `componentScoreMap` (the legacy flat lookup). The richer
  // `componentScores` array is also available but the adapter rebuilds its
  // own evidence/penalty rows below, so the flat map is sufficient here.
  const flat: Record<string, number> | undefined =
    breakdown?.componentScoreMap ??
    (Array.isArray(breakdown?.componentScores)
      ? Object.fromEntries(
          breakdown.componentScores.map((c: any) => [c.name, c.score]),
        )
      : breakdown?.componentScores);
  if (!flat) return [];
  const policy = getPolicyForIntent(intent, config);
  return Object.entries(flat)
    .map(([name, rawScore]) => {
      const score = rawScore as number;
      const weight = (policy.weights as any)[name] || 0;
      const meta = COMPONENT_META[name];
      const evidence: string[] = [];
      const penalties: string[] = [];

      // Build evidence from matched items
      if (name === 'skillFit' && breakdown.matchedSkills?.length) evidence.push(`Matched: ${breakdown.matchedSkills.slice(0, 4).join(', ')}`);
      if (name === 'sectorFit' && breakdown.matchedSectors?.length) evidence.push(`Matched: ${breakdown.matchedSectors.slice(0, 4).join(', ')}`);
      if (name === 'marketFit' && breakdown.matchedMarkets?.length) evidence.push(`Matched: ${breakdown.matchedMarkets.slice(0, 4).join(', ')}`);
      if (name === 'needCoverage' && breakdown.matchedNeeds?.length) evidence.push(`Covered: ${breakdown.matchedNeeds.slice(0, 3).join(', ')}`);
      if (name === 'needCoverage' && breakdown.gaps?.length) penalties.push(...breakdown.gaps.slice(0, 2).map((g: string) => `Gap: ${g}`));

      if (score < 30) penalties.push('Low score — significant gap');

      return {
        name: meta?.label || name.replace(/([A-Z])/g, ' $1').trim(),
        score: Math.round(score),
        weight: Number(weight.toFixed(2)),
        weightedScore: Number((score * weight).toFixed(1)),
        explanation: meta?.descFn(score, provider, breakdown) || '',
        confidence: score >= 70 ? 0.9 : score >= 40 ? 0.6 : 0.3,
        evidence,
        penalties,
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);
}

export async function advancedFindMatches(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  organizationId?: string,
): Promise<ProjectMatch[]> {
  logger.info('Starting advanced project matching', { projectId, userId });

  // 1. Load project with relations
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sectors: { include: { sector: true } },
      skillsNeeded: { include: { skill: true } },
      user: { select: { id: true, fullName: true } },
    },
  });

  if (!project) throw new Error('Project not found');
  if (project.userId !== userId) throw new Error('Unauthorized');

  const projectProfile = buildProjectProfile(project);
  const lookingFor = safeJsonArray(project.lookingFor) as string[];
  const intent = inferIntent(lookingFor);

  logger.info('Project profile built for matching', {
    projectId,
    lookingFor,
    intent,
    sectors: projectProfile.industrySectors,
    skills: projectProfile.skillsNeeded,
    needs: projectProfile.projectNeeds?.substring(0, 100),
    markets: projectProfile.operatingMarkets,
    stage: projectProfile.projectStage,
  });

  // 2. Fetch user candidates (same query pattern as legacy)
  const projectSectorIds = project.sectors.map((s: any) => s.sectorId);
  const projectSkillIds = project.skillsNeeded.map((s: any) => s.skillId);

  // Exclude seed/test accounts (RFC 2606 reserved domains + synthetic
  // patterns the seed scripts emit). See test-account-filter.ts.
  const userWhere: any = {
    id: { not: userId },
    isActive: true,
    ...EXCLUDE_TEST_ACCOUNTS,
    OR: [
      ...(projectSectorIds.length ? [{ userSectors: { some: { sectorId: { in: projectSectorIds } } } }] : []),
      ...(projectSkillIds.length ? [{ userSkills: { some: { skillId: { in: projectSkillIds } } } }] : []),
    ],
  };
  if (!userWhere.OR.length) delete userWhere.OR;

  const users = await prisma.user.findMany({
    where: userWhere,
    include: {
      userSectors: { include: { sector: true } },
      userSkills: { include: { skill: true } },
      userInterests: { include: { interest: true } },
      userHobbies: { include: { hobby: true } },
    },
    take: 200,
  }) as unknown as UserWithRelations[];

  // 3. Fetch contact candidates (nullable email — use null-safe filter).
  const contactWhere: any = {
    ownerId: userId,
    ...EXCLUDE_TEST_ACCOUNTS_NULLABLE,
  };
  if (organizationId) {
    contactWhere.OR = [{ ownerId: userId }, { organizationId }];
    delete contactWhere.ownerId;
  }

  const contacts = await prisma.contact.findMany({
    where: contactWhere,
    include: {
      contactSectors: { include: { sector: true } },
      contactSkills: { include: { skill: true } },
      contactInterests: { include: { interest: true } },
      contactHobbies: { include: { hobby: true } },
    },
    take: 200,
  }) as unknown as ContactWithRelations[];

  logger.info('Fetched candidates', { users: users.length, contacts: contacts.length });

  // 4. Map to ProviderProfiles
  const userProviders = users.map(u => normalizeProviderProfile(buildProviderFromUser(u)));
  const contactProviders = contacts.map(c => normalizeProviderProfile(buildProviderFromContact(c)));
  const allProviders = [
    ...userProviders.map(p => ({ provider: p, type: 'user' as const })),
    ...contactProviders.map(p => ({ provider: p, type: 'contact' as const })),
  ];

  // 5. Score with advanced engine
  const policy = getPolicyForIntent(intent, config);
  const results: Array<{
    provider: ProviderProfile;
    type: 'user' | 'contact';
    score: number;
    confidence: number;
    matchLevel: MatchLevel;
    breakdown: any;
    explanation: any;
    hardFilterStatus: HardFilterStatus;
    matchedNeeds: string[];
    matchedSkills: string[];
    matchedSectors: string[];
    matchedMarkets: string[];
  }> = [];

  for (const candidate of allProviders) {
    const hardFilter = runProjectHardFilters(projectProfile, candidate.provider, intent, config);
    if (hardFilter.status === HardFilterStatus.FAIL) continue;

    const breakdown = calculateProjectDeterministicScore(projectProfile, candidate.provider, intent, config);
    if (breakdown.normalizedScore < policy.minDeterministicScore) continue;

    const sparse = isSparseRecord(candidate.provider.dataQualityScore, config.defaultThresholds.sparseRecordThreshold);
    const { level } = determineMatchLevel(
      breakdown.normalizedScore,
      breakdown.confidence,
      hardFilter.status,
      sparse,
      config.confidenceGates,
    );

    const explanation = buildStructuredExplanation({
      project: projectProfile,
      provider: candidate.provider,
      hardFilter,
      deterministicScore: breakdown.normalizedScore,
      scoreBreakdown: breakdown,
      selectedIntent: intent,
    });

    results.push({
      provider: candidate.provider,
      type: candidate.type,
      score: breakdown.normalizedScore,
      confidence: breakdown.confidence,
      matchLevel: level as MatchLevel,
      breakdown,
      explanation,
      hardFilterStatus: hardFilter.status,
      matchedNeeds: breakdown.matchedNeeds || [],
      matchedSkills: breakdown.matchedSkills || [],
      matchedSectors: breakdown.matchedSectors || [],
      matchedMarkets: breakdown.matchedMarkets || [],
    });
  }

  // 6. Sort by score
  results.sort((a, b) => b.score - a.score || b.confidence - a.confidence);

  // 6b. Dedupe by target identity BEFORE persisting. The same person can be
  // both a registered User and someone's manual Contact (often with diverging
  // email but matching name+company). Keep the higher-scoring row per person
  // so `ProjectMatch._count` agrees with what the UI actually shows.
  const userById = new Map(users.map((u) => [u.id, u]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const identityFor = (r: typeof results[number]) => {
    if (r.type === 'user') {
      const u = userById.get(r.provider.id);
      return {
        userId: r.provider.id,
        contactId: null,
        email: u?.email ?? null,
        linkedinUrl: u?.linkedinUrl ?? null,
        fullName: u?.fullName ?? r.provider.name,
        company: u?.company ?? null,
      };
    }
    const c = contactById.get(r.provider.id);
    return {
      userId: null,
      contactId: r.provider.id,
      email: c?.email ?? null,
      linkedinUrl: c?.linkedinUrl ?? null,
      fullName: c?.fullName ?? r.provider.name,
      company: c?.company ?? null,
    };
  };

  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k);
    if (!p || p === k) {
      parent.set(k, k);
      return k;
    }
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const resultKeys = results.map((r) => targetDedupeKeys(identityFor(r)));
  for (const keys of resultKeys) {
    if (!keys.length) continue;
    for (const k of keys) find(k);
    for (let i = 1; i < keys.length; i++) union(keys[0], keys[i]);
  }

  // Walk results in score-desc order; keep the first occurrence of each group.
  // Prefer User rows over Contact rows when both belong to the same group at
  // the same score (richer profile).
  const dedupedByRoot = new Map<string, typeof results[number]>();
  for (let i = 0; i < results.length; i++) {
    const keys = resultKeys[i];
    const root = keys.length ? find(keys[0]) : `anon:${i}`;
    const existing = dedupedByRoot.get(root);
    if (!existing) {
      dedupedByRoot.set(root, results[i]);
      continue;
    }
    // Prefer User row when scores are tied (already sorted desc).
    if (
      existing.score === results[i].score &&
      existing.type === 'contact' &&
      results[i].type === 'user'
    ) {
      dedupedByRoot.set(root, results[i]);
    }
  }
  const dedupedResults = Array.from(dedupedByRoot.values()).sort(
    (a, b) => b.score - a.score || b.confidence - a.confidence,
  );

  const topResults = dedupedResults.slice(0, 50);

  logger.info('Advanced scoring complete', {
    scored: results.length,
    deduped: dedupedResults.length,
    kept: topResults.length,
  });

  // 7. Generate LLM explanations for top matches
  const llmService = new LLMService('You are a senior analyst briefing a busy founder on a candidate match. Specific, evidence-led, no marketing language. Cite concrete artifacts (skills, sectors, roles, markets, stages) — never generic praise. Always respond with valid JSON.');
  const llmExplanations: Map<number, { reasons: string[]; summary: string; suggestedMessage: string }> = new Map();

  if (llmService.isAvailable() && topResults.length > 0) {
    // Generate LLM explanations in batches for top 20 matches
    const batchSize = 5;
    const maxLLMMatches = Math.min(topResults.length, 20);

    for (let batch = 0; batch < maxLLMMatches; batch += batchSize) {
      const batchEnd = Math.min(batch + batchSize, maxLLMMatches);
      const batchPromises = topResults.slice(batch, batchEnd).map(async (r, idx) => {
        const globalIdx = batch + idx;
        try {
          const pName = r.provider.name;
          const pTitle = r.provider.title || 'professional';
          const pCompany = r.provider.description || '';
          const pType = r.provider.counterpartType.toLowerCase().replace('_', ' ');

          const prompt = `Brief the project owner on whether this person is worth reaching out to.

PROJECT:
- Title: "${projectProfile.projectTitle}"
- Summary: "${projectProfile.summary}"
- Looking for: ${(projectProfile.lookingFor || []).join(', ')}
- Sectors: ${(projectProfile.industrySectors || []).join(', ')}
- Skills needed: ${(projectProfile.skillsNeeded || []).join(', ')}
- Stage: ${projectProfile.projectStage}

MATCHED PERSON:
- Name: ${pName}
- Role: ${pTitle}
- Background: ${pCompany}
- Their sectors: ${(r.provider.sectors || []).join(', ')}
- Their skills: ${(r.provider.skills || []).join(', ')}
- Match type (inferred): ${pType}

MATCH DATA (engine signals — for your reasoning, NOT to be repeated verbatim):
- Shared sectors: ${r.matchedSectors.join(', ') || 'none'}
- Shared skills: ${r.matchedSkills.join(', ') || 'none'}
- Match level: ${r.matchLevel}

Respond with JSON exactly in this shape:
{
  "reasons": ["...", "...", "...", "..."],
  "summary": "Two sentences as described below.",
  "suggestedMessage": "Two-sentence outreach as described below."
}

RULES:
- "summary" is exactly TWO sentences. It MUST NOT restate the numeric score, percentage, "match level", or words like "weak/partial/good/excellent match" (the UI already shows the score and band).
  - Sentence 1: name the strongest concrete fit between this person and this project (e.g. a specific shared skill applied to a specific need; a shared sector; a recent role that maps to the project's stage).
  - Sentence 2: name the most important gap or thing to verify before reaching out. If the person's inferred match type does not match the project's "Looking for" list, say that explicitly (e.g. "Profile reads as TALENT signals; an investor track record or check-size detail isn't visible.").
- Each of the four "reasons":
  - cites ONE concrete artifact (a specific skill name, sector, role, market, stage, or shared experience),
  - ties it to ONE specific project need from the prompt,
  - is under 25 words,
  - does NOT start with the person's name.
- "suggestedMessage" references one specific shared signal (a skill or sector by name, or a specific aspect of the project) — not generic openers like "your background caught my attention".
- Do NOT use any of these phrases anywhere in the output: "could be valuable", "potential for collaboration", "valuable expertise", "valuable perspective", "would bring", "great fit", "strong potential", "caught my attention", "valuable potential partner".`;

          const response = await llmService.callLLM(prompt, undefined, { maxTokens: 400, temperature: 0.3 });
          if (response) {
            const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleaned);
            llmExplanations.set(globalIdx, {
              reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 4) : [],
              summary: parsed.summary || '',
              suggestedMessage: parsed.suggestedMessage || '',
            });
          }
        } catch (err) {
          logger.warn('LLM explanation failed for match', { index: globalIdx, error: err });
        }
      });
      await Promise.all(batchPromises);
    }
    logger.info('LLM explanations generated', { count: llmExplanations.size });
  }

  // 8. Delete old matches + save new ones
  await prisma.projectMatch.deleteMany({ where: { projectId } });

  const savedMatches: ProjectMatch[] = [];
  for (let i = 0; i < topResults.length; i++) {
    const r = topResults[i];
    const isUser = r.type === 'user';
    const pName = r.provider.name;
    const pTitle = r.provider.title;
    const pType = r.provider.counterpartType.toLowerCase().replace('_', ' ');

    // Use LLM explanation if available, otherwise fallback to template
    const llmExpl = llmExplanations.get(i);
    let reasons: string[];
    let summary: string;
    let suggestedMessage: string;

    if (llmExpl && llmExpl.reasons.length > 0) {
      reasons = llmExpl.reasons;
      summary = llmExpl.summary;
      suggestedMessage = llmExpl.suggestedMessage;
    } else {
      // Deterministic fallback — used when the LLM is unavailable. Produces
      // the same shape as the LLM (2-sentence summary, 4 evidence-led
      // reasons, 1 outreach line) without restating the numeric score.
      const components: Record<string, number> =
        r.breakdown?.componentScoreMap ??
        (Array.isArray(r.breakdown?.componentScores)
          ? Object.fromEntries(
              r.breakdown.componentScores.map((c: any) => [c.name, c.score]),
            )
          : (r.breakdown?.componentScores as any) || {});
      const isMeta = (k: string) => ['lookingForFit', 'counterpartFit', 'completenessFit'].includes(k);
      const sortedComponents = Object.entries(components)
        .filter(([k]) => !isMeta(k))
        .sort(([, a], [, b]) => (b as number) - (a as number));
      const topComponent = sortedComponents[0];
      const weakestComponent = sortedComponents.length
        ? sortedComponents[sortedComponents.length - 1]
        : null;
      const humanize = (k: string) =>
        k.replace(/Fit$|Coverage$|Precision$/, '').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
      const projectAskedFor = projectProfile.lookingFor || [];
      const counterpartIsAsked = projectAskedFor
        .map((x: string) => String(x).toUpperCase())
        .includes(String(r.provider.counterpartType).toUpperCase());

      // Reasons — each cites one artifact tied to a project need.
      reasons = [];
      const projectSkill = (projectProfile.skillsNeeded || [])[0];
      const projectSector = (projectProfile.industrySectors || [])[0];
      if (r.matchedSkills.length > 0) {
        const sk = r.matchedSkills.slice(0, 2).join(', ');
        reasons.push(
          projectSkill
            ? `Shares ${sk} — a skill the project lists under "${projectSkill}".`
            : `Shares ${sk} with the project's stated skill needs.`,
        );
      }
      if (r.matchedSectors.length > 0) {
        const sc = r.matchedSectors[0];
        reasons.push(
          projectSector && projectSector.toLowerCase() !== sc.toLowerCase()
            ? `Sector experience in ${sc} adjacent to the project's ${projectSector} focus.`
            : `Sector experience in ${sc} matches the project domain.`,
        );
      }
      if (pTitle) {
        reasons.push(
          `Recent role as ${pTitle} maps to the project's ${projectProfile.projectStage || 'current'} stage.`,
        );
      }
      if (topComponent && (topComponent[1] as number) > 50) {
        reasons.push(`Strong ${humanize(topComponent[0])} signal (${Math.round(topComponent[1] as number)}%).`);
      } else if (counterpartIsAsked) {
        reasons.push(`Profile aligns with the "${pType}" role the project asked for.`);
      }
      // If we still don't have 4, pad with a generic-but-specific sector/skill mention.
      while (reasons.length < 4 && (r.matchedSkills.length || r.matchedSectors.length)) {
        if (r.matchedSkills.length > reasons.length) {
          const sk = r.matchedSkills[reasons.length];
          if (sk && !reasons.some((x) => x.includes(sk))) {
            reasons.push(`Hands-on with ${sk}, relevant to the project's technical needs.`);
            continue;
          }
        }
        break;
      }
      reasons = reasons.slice(0, 4);

      // Summary — 2 sentences, no score restating.
      const leadParts: string[] = [];
      if (r.matchedSkills.length) leadParts.push(`overlap on ${r.matchedSkills.slice(0, 2).join(', ')}`);
      if (r.matchedSectors.length) leadParts.push(`sector experience in ${r.matchedSectors[0]}`);
      const lead = leadParts.length
        ? `Strongest fit is ${leadParts.join(' and ')}.`
        : `Limited concrete overlap with the project's stated needs.`;
      let gap = '';
      if (!counterpartIsAsked) {
        const askedShort = projectAskedFor.length
          ? projectAskedFor.map((x: string) => String(x).toLowerCase().replace(/_/g, ' ')).slice(0, 2).join(' or ')
          : 'the requested role';
        gap = ` Profile reads as ${pType} signals; this project explicitly asked for ${askedShort}.`;
      } else if (weakestComponent && (weakestComponent[1] as number) < 30) {
        gap = ` What to verify before reaching out: ${humanize(weakestComponent[0])}.`;
      }
      summary = `${lead}${gap}`;

      // Outreach — references one specific shared signal.
      const hook = r.matchedSkills[0] || r.matchedSectors[0] || projectSkill || projectSector;
      suggestedMessage = hook
        ? `Hi ${pName.split(' ')[0]}, I'm building "${projectProfile.projectTitle}" and want to compare notes on ${hook}. Open to a 20-minute conversation this week?`
        : `Hi ${pName.split(' ')[0]}, I'm building "${projectProfile.projectTitle}" and would value 20 minutes of your perspective. Open to connecting this week?`;
    }

    const match = await prisma.projectMatch.create({
      data: {
        projectId,
        matchedUserId: isUser ? r.provider.id : null,
        matchedContactId: isUser ? null : r.provider.id,
        // v1 fields (backward compat)
        matchScore: r.score,
        matchType: r.type,
        reasons: reasons.slice(0, 4),
        suggestedAction: r.score >= 60 ? 'Connect' : r.score >= 40 ? 'Message' : 'Review',
        suggestedMessage,
        sharedSectors: r.matchedSectors,
        sharedSkills: r.matchedSkills,
        sharedInterests: [],
        sharedHobbies: [],
        // v2 fields (advanced)
        deterministicScore: r.score,
        finalScore: r.score,
        confidence: r.confidence,
        matchLevel: String(r.matchLevel),
        hardFilterStatus: String(r.hardFilterStatus),
        scoreBreakdown: buildRichScoreBreakdown(r.breakdown, r.provider, intent),
        explanation: {
          ...(r.explanation || {}),
          summary,
          rankingDrivers: reasons.slice(0, 4),
        },
        intent: String(intent),
        rank: i + 1,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'PENDING',
      },
    });
    savedMatches.push(match);
  }

  logger.info('Advanced matching complete', { projectId, matchCount: savedMatches.length });
  return savedMatches;
}
