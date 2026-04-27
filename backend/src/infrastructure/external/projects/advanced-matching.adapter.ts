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
  if (!breakdown?.componentScores) return [];
  const policy = getPolicyForIntent(intent, config);
  return Object.entries(breakdown.componentScores)
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

  const userWhere: any = {
    id: { not: userId },
    isActive: true,
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

  // 3. Fetch contact candidates
  const contactWhere: any = { ownerId: userId };
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
  const topResults = results.slice(0, 50);

  logger.info('Advanced scoring complete', { scored: results.length, kept: topResults.length });

  // 7. Generate LLM explanations for top matches
  const llmService = new LLMService('You are a professional networking match analyst. You explain why two professionals are a good match for collaboration. Be specific, concise, and professional. Always respond with valid JSON.');
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

          const prompt = `Analyze this project-to-person match and explain why they are a good fit.

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
- Match type: ${pType}

MATCH DATA:
- Overall score: ${r.score}/100
- Shared sectors: ${r.matchedSectors.join(', ') || 'none'}
- Shared skills: ${r.matchedSkills.join(', ') || 'none'}
- Confidence: ${Math.round(r.confidence * 100)}%
- Match level: ${r.matchLevel}

Respond with JSON:
{
  "reasons": ["reason1", "reason2", "reason3", "reason4"],
  "summary": "A 2-3 sentence explanation of why this is a good match, mentioning the score and what makes this person valuable for the project.",
  "suggestedMessage": "A personalized 2-sentence outreach message from the project owner to this person."
}

RULES:
- Each reason should be specific and mention concrete skills, experience, or qualifications
- Explain WHY the score is what it is (what contributed positively and what might be missing)
- Be honest about the match quality - don't oversell weak matches
- The summary should mention the ${r.score}% score and explain what it means`;

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
      // Fallback template reasons
      reasons = [];
      if (pTitle) {
        reasons.push(`${pName}'s role as ${pTitle} aligns with your search for a ${pType}.`);
      } else {
        reasons.push(`${pName} is identified as a potential ${pType} for your project.`);
      }
      if (r.matchedSkills.length > 0) {
        reasons.push(`Shared skills: ${r.matchedSkills.slice(0, 4).join(', ')}${r.matchedSkills.length > 4 ? ` and ${r.matchedSkills.length - 4} more` : ''}.`);
      }
      if (r.matchedSectors.length > 0) {
        reasons.push(`Industry alignment in ${r.matchedSectors.slice(0, 3).join(', ')}.`);
      }
      const components = r.breakdown?.componentScores || {};
      const topComponent = Object.entries(components)
        .filter(([k]) => !['lookingForFit', 'counterpartFit', 'completenessFit'].includes(k))
        .sort(([, a], [, b]) => (b as number) - (a as number))[0];
      if (topComponent && (topComponent[1] as number) > 50) {
        const label = (topComponent[0] as string).replace(/([A-Z])/g, ' $1').trim().toLowerCase();
        reasons.push(`Strong ${label} (${Math.round(topComponent[1] as number)}%).`);
      }
      summary = `${pName} is a ${r.matchLevel.replace('_', ' ').toLowerCase()} match as ${pType} with a score of ${r.score}% and ${Math.round(r.confidence * 100)}% confidence.`;
      suggestedMessage = `Hi ${pName.split(' ')[0]}, I'm working on "${projectProfile.projectTitle}" and your background in ${r.matchedSectors[0] || r.matchedSkills[0] || pType} caught my attention. Would you be interested in connecting?`;
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
