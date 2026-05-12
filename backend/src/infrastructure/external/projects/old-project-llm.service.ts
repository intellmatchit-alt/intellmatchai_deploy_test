import { ProjectAIValidationItem, ProjectProfile, ProviderProfile } from './project-matching.types';

interface ValidateProjectMatchesArgs {
  project: ProjectProfile;
  providers: Array<{
    provider: ProviderProfile;
    deterministicScore: number;
    explanationSeed: Record<string, unknown>;
  }>;
}

export class ProjectLLMService {
  constructor(private readonly llmClient?: any) {}

  async validateProjectMatches(args: ValidateProjectMatchesArgs): Promise<ProjectAIValidationItem[]> {
    if (!this.llmClient || !args.providers.length) {
      return args.providers.map(item => ({ providerId: item.provider.id, aiScoreDelta: 0 }));
    }

    const prompt = {
      task: 'Validate project matching results. Do not override hard filters. Only apply bounded deltas in [-6,6]. Prefer precision over recall. Explain only with evidence present in the input. Penalize vague, non-evidenced, or weakly aligned matches.',
      schema: {
        items: [
          {
            providerId: 'string',
            aiScoreDelta: 'number',
            aiExplanation: 'string',
            warnings: ['string'],
            aiEvidenceFor: ['string'],
            aiEvidenceAgainst: ['string'],
          },
        ],
      },
      project: this.serializeProject(args.project),
      candidates: args.providers.map((item, index) => ({
        rankBeforeAI: index + 1,
        provider: this.serializeProvider(item.provider),
        deterministicScore: item.deterministicScore,
        explanationSeed: item.explanationSeed,
      })),
    };

    try {
      const response = await this.llmClient.complete?.({
        model: 'gpt-4.1-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        prompt: JSON.stringify(prompt),
      });

      const parsed = this.safeParse(response?.text);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      return args.providers.map(item => {
        const ai = items.find((x: any) => x.providerId === item.provider.id) || {};
        const delta = this.boundDelta(ai.aiScoreDelta);
        return {
          providerId: item.provider.id,
          aiScoreDelta: delta,
          aiExplanation: typeof ai.aiExplanation === 'string' ? ai.aiExplanation : undefined,
          warnings: Array.isArray(ai.warnings) ? ai.warnings.filter((x: unknown) => typeof x === 'string') : undefined,
          aiEvidenceFor: Array.isArray(ai.aiEvidenceFor) ? ai.aiEvidenceFor.filter((x: unknown) => typeof x === 'string').slice(0, 4) : undefined,
          aiEvidenceAgainst: Array.isArray(ai.aiEvidenceAgainst) ? ai.aiEvidenceAgainst.filter((x: unknown) => typeof x === 'string').slice(0, 4) : undefined,
        };
      });
    } catch {
      return args.providers.map(item => ({ providerId: item.provider.id, aiScoreDelta: 0 }));
    }
  }

  private boundDelta(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(-6, Math.min(6, n));
  }

  private serializeProject(project: ProjectProfile) {
    return {
      id: project.id,
      title: project.projectTitle,
      summary: project.summary,
      detailedDescription: project.detailedDescription,
      projectNeeds: project.projectNeeds,
      projectStage: project.projectStage,
      primaryCategory: project.primaryCategory,
      lookingFor: project.lookingFor,
      sectors: project.industrySectors,
      skillsNeeded: project.skillsNeeded,
      operatingMarkets: project.operatingMarkets,
      fundingAskMin: project.fundingAskMin,
      fundingAskMax: project.fundingAskMax,
      tractionSignals: project.tractionSignals,
      advisoryTopics: project.advisoryTopics,
      partnerTypeNeeded: project.partnerTypeNeeded,
      commitmentLevelNeeded: project.commitmentLevelNeeded,
      engagementModel: project.engagementModel,
      idealCounterpartProfile: project.idealCounterpartProfile,
    };
  }

  private serializeProvider(provider: ProviderProfile) {
    return {
      id: provider.id,
      name: provider.name,
      title: provider.title,
      counterpartType: provider.counterpartType,
      description: provider.description,
      sectors: provider.sectors,
      skills: provider.skills,
      capabilities: provider.capabilities,
      operatingMarkets: provider.operatingMarkets,
      yearsExperience: provider.yearsExperience,
      verified: provider.verified,
      evidenceLevel: provider.evidenceLevel,
      recentRelevantProjects: provider.recentRelevantProjects,
      investorProfile: provider.investorProfile,
      advisorProfile: provider.advisorProfile,
      talentProfile: provider.talentProfile,
      serviceProviderProfile: provider.serviceProviderProfile,
      partnerProfile: provider.partnerProfile,
    };
  }

  private safeParse(value: unknown): any {
    if (!value || typeof value !== 'string') return {};
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
}
