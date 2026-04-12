import { HardFilterStatus, MatchingStats, MatchLevel } from '../common/matching-common.types';
import {
  applyBoundedAIAdjustment,
  assignRanks,
  createEmptyStats,
  determineMatchLevel,
  generateMatchId,
  getExpiryDate,
  isSparseRecord,
} from '../common/matching-common.utils';
import {
  DEFAULT_PROJECT_CONFIG,
  DeterministicProjectScoreBreakdown,
  FindProjectMatchesRequest,
  ProjectAIValidationItem,
  ProjectFilterOptions,
  ProjectIntent,
  ProjectMatchResponse,
  ProjectMatchResult,
  ProjectMatchingConfig,
  ProjectProfile,
  ProviderProfile,
  getPolicyForIntent,
  mapIntentToCounterpart,
} from './project-matching.types';
import { normalizeProjectProfile, normalizeProviderProfile } from './project-normalization.utils';
import { retrieveProjectCandidates } from './project-retrieval.utils';
import {
  buildStructuredExplanation,
  calculateProjectDeterministicScore,
  runProjectHardFilters,
} from './project-scoring.utils';

export class ProjectMatchingService {
  constructor(
    private readonly prisma: any,
    private readonly config: ProjectMatchingConfig = DEFAULT_PROJECT_CONFIG,
    private readonly llmService?: { validateProjectMatches?: (args: any) => Promise<ProjectAIValidationItem[]> },
  ) {}

  async findMatches(request: FindProjectMatchesRequest): Promise<ProjectMatchResponse> {
    const startedAt = Date.now();
    const stats = createEmptyStats() as MatchingStats & Record<string, number>;

    const project = await this.loadProject(request.projectId);
    if (!project) throw new Error(`Project not found: ${request.projectId}`);

    const candidates = await retrieveProjectCandidates({
      prisma: this.prisma,
      project,
      intent: request.intent,
      config: this.config,
      filters: request.filters,
    });

    stats.totalCandidates = candidates.length;
    const scored = await this.scoreProviders(project, candidates, request.intent, stats);
    const policy = getPolicyForIntent(request.intent, this.config);

    const deterministicPassed = scored.filter(item =>
      item.hardFilterStatus !== HardFilterStatus.FAIL &&
      item.deterministicScore >= policy.minDeterministicScore &&
      item.confidence >= policy.minConfidence,
    );
    stats.filteredOutDeterministic = scored.length - deterministicPassed.length;

    const aiValidated = request.includeAI && this.config.features.enableAIValidation && this.llmService
      ? await this.applyAIValidation(project, deterministicPassed)
      : deterministicPassed;

    const finalCandidates = aiValidated.filter(item => item.finalScore >= policy.minPostAIScore && item.confidence >= policy.minConfidence);
    stats.filteredOutPostAI = aiValidated.length - finalCandidates.length;

    finalCandidates.sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.deterministicScore !== a.deterministicScore) return b.deterministicScore - a.deterministicScore;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return (b.retrieval?.retrievalScore || 0) - (a.retrieval?.retrievalScore || 0);
    });

    const ranked = assignRanks(finalCandidates) as ProjectMatchResult[];
    const limit = request.limit ?? this.config.defaultThresholds.maxResults;
    const offset = request.offset ?? 0;
    const matches = ranked.slice(offset, offset + limit);

    stats.finalMatches = matches.length;
    stats.processingTimeMs = Date.now() - startedAt;

    await this.saveMatches(project, request.intent, matches);

    return {
      success: true,
      projectId: project.id,
      projectTitle: project.projectTitle,
      intent: request.intent,
      matches,
      stats,
      processingTimeMs: stats.processingTimeMs,
    } as ProjectMatchResponse;
  }

  private async scoreProviders(
    project: ProjectProfile,
    candidates: Array<{ provider: ProviderProfile; debug: any }>,
    intent: ProjectIntent,
    stats: MatchingStats & Record<string, number>,
  ): Promise<ProjectMatchResult[]> {
    const results: ProjectMatchResult[] = [];
    for (const candidate of candidates) {
      const provider = candidate.provider;
      const hardFilter = runProjectHardFilters(project, provider, intent, this.config);
      if (hardFilter.status === HardFilterStatus.FAIL) stats.failedHardFilters += 1;
      else if (hardFilter.status === HardFilterStatus.REVIEW) stats.reviewCandidates += 1;
      else stats.passedHardFilters += 1;

      const breakdown = calculateProjectDeterministicScore(project, provider, intent, this.config, candidate.debug.retrievalScore);
      stats.scoredCandidates += 1;

      const sparse = isSparseRecord(provider.dataQualityScore, this.config.defaultThresholds.sparseRecordThreshold);
      const { level, reason } = determineMatchLevel(
        breakdown.normalizedScore,
        breakdown.confidence,
        hardFilter.status,
        sparse,
        this.config.confidenceGates,
      );

      const explanation = buildStructuredExplanation({
        project,
        provider,
        hardFilter,
        deterministicScore: breakdown.normalizedScore,
        scoreBreakdown: breakdown,
        selectedIntent: intent,
      });

      results.push({
        id: generateMatchId(project.id, provider.id, String(intent)),
        projectId: project.id,
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.counterpartType,
        intent,
        deterministicScore: breakdown.normalizedScore,
        aiScore: null,
        finalScore: breakdown.normalizedScore,
        confidence: breakdown.confidence,
        matchLevel: level as MatchLevel,
        hardFilterStatus: hardFilter.status,
        hardFilterReason: hardFilter.reason,
        matchedNeeds: breakdown.matchedNeeds,
        matchedSkills: breakdown.matchedSkills,
        matchedSectors: breakdown.matchedSectors,
        matchedMarkets: breakdown.matchedMarkets,
        scoreBreakdown: breakdown,
        retrieval: candidate.debug,
        explanation,
        isVerified: provider.verified,
        alternativeIntentScores: this.buildAlternativeIntentSnapshot(project, provider, intent),
        hydrationSnapshot: {
          providerCounterpartType: provider.counterpartType,
          evidenceLevel: provider.evidenceLevel,
          retrieval: candidate.debug,
          matchLevelReason: reason,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as ProjectMatchResult);
    }
    return results;
  }

  private buildAlternativeIntentSnapshot(
    project: ProjectProfile,
    provider: ProviderProfile,
    selectedIntent: ProjectIntent,
  ): ProjectMatchResult['alternativeIntentScores'] {
    const intents = [selectedIntent, ...((project.lookingFor || []).map(type => {
      switch (type) {
        case mapIntentToCounterpart(ProjectIntent.FIND_INVESTOR): return ProjectIntent.FIND_INVESTOR;
        case mapIntentToCounterpart(ProjectIntent.FIND_ADVISOR): return ProjectIntent.FIND_ADVISOR;
        case mapIntentToCounterpart(ProjectIntent.FIND_SERVICE_PROVIDER): return ProjectIntent.FIND_SERVICE_PROVIDER;
        case mapIntentToCounterpart(ProjectIntent.FIND_PARTNER): return ProjectIntent.FIND_PARTNER;
        case mapIntentToCounterpart(ProjectIntent.FIND_COFOUNDER): return ProjectIntent.FIND_COFOUNDER;
        default: return ProjectIntent.FIND_TALENT;
      }
    }))];
    const uniqueIntents = Array.from(new Set(intents)).slice(0, 3);
    return uniqueIntents
      .map(intent => {
        const breakdown = calculateProjectDeterministicScore(project, provider, intent, this.config);
        return {
          intent,
          deterministicScore: breakdown.normalizedScore,
          confidence: breakdown.confidence,
          whyNotSelected: intent === selectedIntent ? [] : [`Lower than selected intent ${selectedIntent}.`],
        };
      })
      .sort((a, b) => b.deterministicScore - a.deterministicScore)
      .slice(0, 3);
  }

  private async applyAIValidation(project: ProjectProfile, matches: ProjectMatchResult[]): Promise<ProjectMatchResult[]> {
    if (!matches.length || !this.llmService?.validateProjectMatches) return matches;

    const providers = await Promise.all(matches.map(item => this.loadProvider(item.providerId)));
    const providerMap = new Map<string, ProviderProfile>();
    providers.forEach(provider => {
      if (provider) providerMap.set(provider.id, provider);
    });

    const aiItems = await this.llmService.validateProjectMatches({
      project,
      providers: matches
        .map(match => ({
          provider: providerMap.get(match.providerId),
          deterministicScore: match.deterministicScore,
          explanationSeed: {
            matchedNeeds: match.matchedNeeds,
            matchedSkills: match.matchedSkills,
            matchedSectors: match.matchedSectors,
            matchedMarkets: match.matchedMarkets,
            scoreBreakdown: match.scoreBreakdown?.componentScores,
          },
        }))
        .filter((x: any) => !!x.provider),
    });

    const aiMap = new Map(aiItems.map(item => [item.providerId, item]));
    return matches.map(match => {
      const ai = aiMap.get(match.providerId);
      if (!ai) return match;
      const finalScore = applyBoundedAIAdjustment(match.deterministicScore, ai.aiScoreDelta, 6);
      const comparativeNotes = [
        ...(match.explanation?.comparativeNotes || []),
        ...(ai.aiExplanation ? [`AI validation: ${ai.aiExplanation}`] : []),
        ...((ai.aiEvidenceFor || []).map(item => `AI evidence for: ${item}`)),
        ...((ai.aiEvidenceAgainst || []).map(item => `AI evidence against: ${item}`)),
        ...((ai.warnings || []).map(item => `AI warning: ${item}`)),
      ];
      return {
        ...match,
        aiScore: ai.aiScoreDelta,
        finalScore,
        aiSummary: ai.aiExplanation,
        explanation: match.explanation ? { ...match.explanation, comparativeNotes } : match.explanation,
      };
    });
  }

  private async loadProject(projectId: string): Promise<ProjectProfile | null> {
    const row = await this.prisma.project.findUnique({ where: { id: projectId } });
    return row ? this.mapProject(row) : null;
  }

  private async loadProvider(providerId: string): Promise<ProviderProfile | null> {
    const row = await this.prisma.providerProfile.findUnique({ where: { id: providerId } });
    return row ? this.mapProvider(row) : null;
  }

  private async saveMatches(project: ProjectProfile, intent: ProjectIntent, matches: ProjectMatchResult[]): Promise<void> {
    if (!matches.length) return;
    await this.prisma.projectMatch.createMany({
      data: matches.map(match => ({
        id: match.id,
        projectId: project.id,
        providerId: match.providerId,
        intent,
        deterministicScore: match.deterministicScore,
        aiScore: match.aiScore,
        finalScore: match.finalScore,
        matchLevel: match.matchLevel,
        confidence: match.confidence,
        explanationJson: match.explanation,
        hydrationSnapshot: match.hydrationSnapshot,
        expiresAt: getExpiryDate(30),
      })),
      skipDuplicates: true,
    });
  }

  private mapProject(row: any): ProjectProfile {
    return normalizeProjectProfile({
      id: row.id,
      ownerId: row.ownerId,
      organizationId: row.organizationId ?? undefined,
      projectTitle: row.projectTitle ?? row.title ?? '',
      summary: row.summary ?? '',
      detailedDescription: row.detailedDescription ?? row.description ?? '',
      projectNeeds: row.projectNeeds ?? '',
      projectStage: row.projectStage,
      primaryCategory: row.primaryCategory ?? 'OTHER',
      timeline: row.timeline ?? undefined,
      lookingFor: row.lookingFor ?? [],
      industrySectors: row.industrySectors ?? [],
      skillsNeeded: row.skillsNeeded ?? [],
      operatingMarkets: row.operatingMarkets ?? [],
      fundingAskMin: row.fundingAskMin ?? undefined,
      fundingAskMax: row.fundingAskMax ?? undefined,
      tractionSignals: row.tractionSignals ?? undefined,
      advisoryTopics: row.advisoryTopics ?? [],
      partnerTypeNeeded: row.partnerTypeNeeded ?? [],
      commitmentLevelNeeded: row.commitmentLevelNeeded ?? undefined,
      idealCounterpartProfile: row.idealCounterpartProfile ?? undefined,
      engagementModel: row.engagementModel ?? [],
      targetCustomerTypes: row.targetCustomerTypes ?? [],
      normalizedNeedSignals: row.normalizedNeedSignals ?? undefined,
      keywords: row.keywords ?? [],
      embedding: row.embedding ?? undefined,
      fieldEmbeddings: row.fieldEmbeddings ?? undefined,
      dataQualityScore: Number(row.dataQualityScore ?? 70),
      strictLookingFor: Boolean(row.strictLookingFor),
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
    });
  }

  private mapProvider(row: any): ProviderProfile {
    return normalizeProviderProfile({
      id: row.id,
      userId: row.userId ?? undefined,
      organizationId: row.organizationId ?? undefined,
      name: row.name ?? row.displayName ?? 'Unknown',
      title: row.title ?? undefined,
      description: row.description ?? '',
      counterpartType: row.counterpartType,
      entityFamily: row.entityFamily,
      executionTrack: row.executionTrack,
      seniority: row.seniority ?? undefined,
      sectors: row.sectors ?? [],
      skills: row.skills ?? [],
      capabilities: row.capabilities ?? [],
      operatingMarkets: row.operatingMarkets ?? [],
      keywords: row.keywords ?? [],
      embedding: row.embedding ?? undefined,
      fieldEmbeddings: row.fieldEmbeddings ?? undefined,
      offerSignals: row.offerSignals ?? undefined,
      yearsExperience: row.yearsExperience ?? undefined,
      recentRelevantProjects: row.recentRelevantProjects ?? [],
      verified: Boolean(row.verified),
      evidenceLevel: row.evidenceLevel ?? undefined,
      available: row.available !== false,
      blocked: Boolean(row.blocked),
      optedOut: Boolean(row.optedOut),
      dataQualityScore: Number(row.dataQualityScore ?? 60),
      investorProfile: row.investorProfile ?? undefined,
      advisorProfile: row.advisorProfile ?? undefined,
      talentProfile: row.talentProfile ?? undefined,
      serviceProviderProfile: row.serviceProviderProfile ?? row.supplierProfile ?? undefined,
      partnerProfile: row.partnerProfile ?? undefined,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
    });
  }
}
