import {
  HardFilterReason,
  HardFilterResult,
  HardFilterStatus,
} from "../common/matching-common.types";
import {
  CounterpartType,
  DeterministicProjectScoreBreakdown,
  EngagementModel,
  ProjectIntent,
  ProjectMatchingConfig,
  ProjectProfile,
  ProjectStage,
  ProviderProfile,
  SemanticFieldComparison,
  StructuredMatchExplanation,
  DEFAULT_PROJECT_CONFIG,
  getAlternativeIntentsForCounterpart,
  getPolicyForIntent,
  mapIntentToCounterpart,
} from "./project-matching.types";
import {
  buildOfferSignals,
  buildProjectNeedSignals,
  confidenceLabel,
  cosineSimilarity,
  evidenceLevelScore,
  expandEquivalentPhrases,
  jaccard,
  normalizeText,
  overlapScore,
  tokenize,
  unique,
} from "./project-normalization.utils";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function normalize100(v: number): number {
  return Math.round(clamp01(v) * 100);
}

function pass(reason = "PASS", details: string[] = []): HardFilterResult {
  return {
    status: HardFilterStatus.PASS,
    reason: reason as HardFilterReason,
    details,
  } as HardFilterResult;
}

function review(
  reason: HardFilterReason,
  message: string,
  details: string[] = [],
): HardFilterResult {
  return {
    status: HardFilterStatus.REVIEW,
    reason,
    message,
    details,
  } as HardFilterResult;
}

function fail(
  reason: HardFilterReason,
  message: string,
  details: string[] = [],
): HardFilterResult {
  return {
    status: HardFilterStatus.FAIL,
    reason,
    message,
    details,
  } as HardFilterResult;
}

function combine(results: HardFilterResult[]): HardFilterResult {
  if (results.some((r) => r.status === HardFilterStatus.FAIL)) {
    return results.find((r) => r.status === HardFilterStatus.FAIL)!;
  }
  if (results.some((r) => r.status === HardFilterStatus.REVIEW)) {
    const item = results.find((r) => r.status === HardFilterStatus.REVIEW)!;
    return {
      ...item,
      details: unique(results.flatMap((r) => (r as any).details || [])),
    } as HardFilterResult;
  }
  return pass("PASS", unique(results.flatMap((r) => (r as any).details || [])));
}

function stageIndex(stage?: ProjectStage): number {
  const order = [
    ProjectStage.JUST_AN_IDEA,
    ProjectStage.VALIDATING,
    ProjectStage.BUILDING_MVP,
    ProjectStage.LAUNCHED,
    ProjectStage.GROWING,
    ProjectStage.SCALING,
  ];
  return stage ? order.indexOf(stage) : -1;
}

function stageFit(
  projectStage?: ProjectStage,
  allowed: ProjectStage[] = [],
): number {
  const idx = stageIndex(projectStage);
  if (idx < 0) return 0.45;
  if (!allowed.length) return 0.5;
  const distances = allowed
    .map((item) => Math.abs(stageIndex(item) - idx))
    .filter((v) => v >= 0);
  if (!distances.length) return 0.35;
  return clamp01(1 - Math.min(...distances) / 5);
}

function rangeOverlap(
  minA?: number,
  maxA?: number,
  minB?: number,
  maxB?: number,
): number {
  if ([minA, maxA, minB, maxB].some((v) => v == null)) return 0.45;
  const low = Math.max(minA as number, minB as number);
  const high = Math.min(maxA as number, maxB as number);
  if (high <= low) return 0;
  const union =
    Math.max(maxA as number, maxB as number) -
    Math.min(minA as number, minB as number);
  return union > 0 ? (high - low) / union : 0;
}

function completenessScore(
  project: ProjectProfile,
  provider: ProviderProfile,
): number {
  const projectFields = [
    project.projectTitle,
    project.summary,
    project.detailedDescription,
    project.projectNeeds,
    project.projectStage,
    project.primaryCategory,
    project.lookingFor?.length,
    project.industrySectors?.length,
    project.skillsNeeded?.length,
  ];
  const providerFields = [
    provider.name,
    provider.description,
    provider.counterpartType,
    provider.sectors?.length,
    provider.skills?.length,
    provider.capabilities?.length,
    provider.operatingMarkets?.length,
  ];
  const total = projectFields.length + providerFields.length;
  const filled = [...projectFields, ...providerFields].filter(Boolean).length;
  return total ? filled / total : 0;
}

function fieldSemanticComparisons(
  project: ProjectProfile,
  provider: ProviderProfile,
): SemanticFieldComparison[] {
  const comparisons: SemanticFieldComparison[] = [];
  const pairs: Array<
    [string, number[] | undefined, number[] | undefined, string[]]
  > = [
    [
      "needs↔capabilities",
      project.fieldEmbeddings?.projectNeeds,
      provider.fieldEmbeddings?.capabilities,
      provider.capabilities || [],
    ],
    [
      "skills↔skills",
      project.fieldEmbeddings?.skillsNeeded,
      provider.fieldEmbeddings?.skills,
      provider.skills || [],
    ],
    [
      "sectors↔sectors",
      project.fieldEmbeddings?.industrySectors,
      provider.fieldEmbeddings?.sectors,
      provider.sectors || [],
    ],
    [
      "markets↔markets",
      project.fieldEmbeddings?.operatingMarkets,
      provider.fieldEmbeddings?.operatingMarkets,
      provider.operatingMarkets || [],
    ],
  ];
  for (const [field, left, right, evidence] of pairs) {
    if (!left || !right) continue;
    comparisons.push({
      field,
      weight: field.includes("needs") ? 0.4 : 0.2,
      score: cosineSimilarity(left, right),
      evidence: evidence.slice(0, 5),
    });
  }
  return comparisons;
}

function needOfferMatch(
  project: ProjectProfile,
  provider: ProviderProfile,
): {
  coverage: number;
  precision: number;
  capabilityFit: number;
  matchedNeeds: string[];
  strongestSignals: string[];
  gaps: string[];
} {
  const needs = buildProjectNeedSignals(project);
  const offers = buildOfferSignals(provider);
  if (!needs.length || !offers.length) {
    return {
      coverage: 0,
      precision: 0,
      capabilityFit: 0,
      matchedNeeds: [],
      strongestSignals: [],
      gaps: [],
    };
  }

  const matchedNeeds: string[] = [];
  const strongestSignals: string[] = [];
  const gaps: string[] = [];
  let coverageWeighted = 0;
  let precisionWeighted = 0;
  let totalWeight = 0;
  let capabilityFit = 0;

  for (const need of needs) {
    let best = 0;
    let bestEvidence = "";
    for (const offer of offers) {
      const phraseScore = need.phrases.some((p) =>
        offer.phrases.some((o) => o === p || o.includes(p) || p.includes(o)),
      )
        ? 1
        : 0;
      const tokenScore = jaccard(
        tokenize(need.normalized),
        tokenize(offer.normalized),
      );
      const clusterScore = need.clusters.some((c) => offer.clusters.includes(c))
        ? 1
        : 0;
      const score = phraseScore * 0.45 + tokenScore * 0.25 + clusterScore * 0.3;
      if (score > best) {
        best = score;
        bestEvidence = `${need.raw} ↔ ${offer.raw}`;
      }
    }

    const weight = clamp01(need.importance || 0.65);
    totalWeight += weight;
    coverageWeighted += (best >= 0.48 ? 1 : best) * weight;
    precisionWeighted += best * weight;
    if (best >= 0.48) {
      matchedNeeds.push(need.raw);
      strongestSignals.push(bestEvidence);
      capabilityFit += best * weight;
    } else {
      gaps.push(`Need not strongly covered: ${need.raw}`);
    }
  }

  return {
    coverage: totalWeight ? coverageWeighted / totalWeight : 0,
    precision: totalWeight ? precisionWeighted / totalWeight : 0,
    capabilityFit: totalWeight ? capabilityFit / totalWeight : 0,
    matchedNeeds: unique(matchedNeeds),
    strongestSignals: unique(strongestSignals).slice(0, 6),
    gaps: unique(gaps).slice(0, 6),
  };
}

function skillFit(
  project: ProjectProfile,
  provider: ProviderProfile,
): { score: number; matchedSkills: string[] } {
  const needed = project.skillsNeeded || [];
  const providerBag = [
    ...(provider.skills || []),
    ...(provider.capabilities || []),
  ].map(normalizeText);
  const matched = needed.filter((skill) => {
    const phrases = expandEquivalentPhrases(skill);
    return providerBag.some((item) =>
      phrases.some((p) => item === p || item.includes(p) || p.includes(item)),
    );
  });
  return {
    score: needed.length ? matched.length / needed.length : 0,
    matchedSkills: unique(matched),
  };
}

function sectorFitScore(
  project: ProjectProfile,
  provider: ProviderProfile,
): { score: number; matchedSectors: string[] } {
  const matched = (project.industrySectors || []).filter((item) =>
    (provider.sectors || []).some(
      (p) =>
        normalizeText(p) === normalizeText(item) ||
        normalizeText(p).includes(normalizeText(item)) ||
        normalizeText(item).includes(normalizeText(p)),
    ),
  );
  return {
    score: project.industrySectors?.length
      ? matched.length / project.industrySectors.length
      : 0,
    matchedSectors: unique(matched),
  };
}

function marketFitScore(
  project: ProjectProfile,
  provider: ProviderProfile,
): { score: number; matchedMarkets: string[] } {
  const matched = (project.operatingMarkets || []).filter((item) =>
    (provider.operatingMarkets || []).some(
      (p) =>
        normalizeText(p) === normalizeText(item) ||
        normalizeText(p).includes(normalizeText(item)) ||
        normalizeText(item).includes(normalizeText(p)),
    ),
  );
  return {
    score: project.operatingMarkets?.length
      ? matched.length / project.operatingMarkets.length
      : 0.5,
    matchedMarkets: unique(matched),
  };
}

function lookingForFit(
  project: ProjectProfile,
  provider: ProviderProfile,
  intent: ProjectIntent,
): number {
  const target = mapIntentToCounterpart(intent);
  const lookingFor = project.lookingFor || [];
  if (!lookingFor.length) return provider.counterpartType === target ? 0.75 : 0;
  if (lookingFor.includes(provider.counterpartType)) return 1;
  return provider.counterpartType === target ? 0.35 : 0;
}

function counterpartFit(
  project: ProjectProfile,
  provider: ProviderProfile,
  intent: ProjectIntent,
): number {
  const target = mapIntentToCounterpart(intent);
  if (provider.counterpartType === target) return 1;
  return (project.lookingFor || []).includes(provider.counterpartType)
    ? 0.25
    : 0;
}

function subtypeSpecificFit(
  project: ProjectProfile,
  provider: ProviderProfile,
): number {
  switch (provider.counterpartType) {
    case CounterpartType.INVESTOR: {
      const thesisFit = overlapScore(
        project.industrySectors || [],
        provider.investorProfile?.thesisSectors || [],
      );
      const preferredStageFit = stageFit(
        project.projectStage,
        provider.investorProfile?.preferredStages || [],
      );
      const fundingFit = rangeOverlap(
        project.fundingAskMin,
        project.fundingAskMax,
        provider.investorProfile?.checkMin,
        provider.investorProfile?.checkMax,
      );
      const geo = overlapScore(
        project.operatingMarkets || [],
        provider.investorProfile?.operatingMarkets ||
          provider.operatingMarkets ||
          [],
      );
      return clamp01(
        thesisFit * 0.3 +
          preferredStageFit * 0.25 +
          fundingFit * 0.25 +
          geo * 0.2,
      );
    }
    case CounterpartType.ADVISOR: {
      const topics = overlapScore(
        project.advisoryTopics || [],
        provider.advisorProfile?.advisoryTopics || [],
      );
      const functions = overlapScore(
        project.skillsNeeded || [],
        provider.advisorProfile?.advisoryFunctions || [],
      );
      const boardYears = provider.advisorProfile?.boardExperienceYears || 0;
      const experience =
        boardYears >= 5
          ? 1
          : boardYears >= 3
            ? 0.8
            : boardYears >= 1
              ? 0.55
              : 0.3;
      return clamp01(topics * 0.45 + functions * 0.25 + experience * 0.3);
    }
    case CounterpartType.SERVICE_PROVIDER: {
      const categories = overlapScore(
        [...(project.skillsNeeded || []), project.projectNeeds],
        provider.serviceProviderProfile?.serviceCategories || [],
      );
      const budget = rangeOverlap(
        project.fundingAskMin,
        project.fundingAskMax,
        provider.serviceProviderProfile?.budgetMin,
        provider.serviceProviderProfile?.budgetMax,
      );
      const certifications = (
        provider.serviceProviderProfile?.certifications || []
      ).length
        ? 1
        : 0.45;
      return clamp01(categories * 0.45 + budget * 0.35 + certifications * 0.2);
    }
    case CounterpartType.PARTNER: {
      const typeFit = overlapScore(
        project.partnerTypeNeeded || [],
        provider.partnerProfile?.partnerTypes || [],
      );
      const customerFit = overlapScore(
        project.targetCustomerTypes || [],
        provider.partnerProfile?.customerTypes || [],
      );
      const channelFit = overlapScore(
        project.projectNeeds ? [project.projectNeeds] : [],
        provider.partnerProfile?.channels || [],
      );
      const integrationFit = overlapScore(
        project.skillsNeeded || [],
        provider.partnerProfile?.integrationCapabilities || [],
      );
      return clamp01(
        typeFit * 0.35 +
          customerFit * 0.2 +
          channelFit * 0.25 +
          integrationFit * 0.2,
      );
    }
    case CounterpartType.COFOUNDER:
    case CounterpartType.TALENT: {
      const desiredRoleFit = overlapScore(
        project.skillsNeeded || [],
        provider.talentProfile?.desiredRoles || [],
      );
      const commitment =
        !project.commitmentLevelNeeded ||
        !provider.talentProfile?.commitmentLevel
          ? 0.55
          : provider.talentProfile.commitmentLevel ===
                project.commitmentLevelNeeded ||
              provider.talentProfile.commitmentLevel === "FLEXIBLE" ||
              (project.commitmentLevelNeeded as string) === EngagementModel.CONTRACT
            ? 1
            : 0.1;
      const startupStage = stageFit(
        project.projectStage,
        provider.talentProfile?.startupStageComfort || [],
      );
      const leadership = provider.talentProfile?.leadershipExperienceYears || 0;
      const leadershipFit =
        leadership >= 6
          ? 1
          : leadership >= 3
            ? 0.75
            : leadership >= 1
              ? 0.5
              : 0.3;
      return clamp01(
        desiredRoleFit * 0.35 +
          commitment * 0.25 +
          startupStage * 0.2 +
          leadershipFit * 0.2,
      );
    }
    default:
      return 0.5;
  }
}

function credibilityFit(
  project: ProjectProfile,
  provider: ProviderProfile,
): number {
  const verified = provider.verified ? 1 : 0.55;
  const evidence = evidenceLevelScore(provider.evidenceLevel);
  const experience =
    provider.yearsExperience != null
      ? Math.min(1, provider.yearsExperience / 12)
      : 0.45;
  const projects = (provider.recentRelevantProjects || []).length
    ? Math.min(1, (provider.recentRelevantProjects || []).length / 4)
    : 0.3;
  const tractionBonus =
    provider.counterpartType === CounterpartType.INVESTOR &&
    (project.tractionSignals?.payingCustomers ||
      project.tractionSignals?.revenueMonthly)
      ? 1
      : 0.6;
  return clamp01(
    verified * 0.25 +
      evidence * 0.25 +
      experience * 0.2 +
      projects * 0.2 +
      tractionBonus * 0.1,
  );
}

function semanticFit(
  project: ProjectProfile,
  provider: ProviderProfile,
): { score: number; comparisons: SemanticFieldComparison[] } {
  const global = cosineSimilarity(project.embedding, provider.embedding);
  const comparisons = fieldSemanticComparisons(project, provider);
  const weighted = comparisons.length
    ? comparisons.reduce((sum, item) => sum + item.score * item.weight, 0) /
      comparisons.reduce((sum, item) => sum + item.weight, 0)
    : 0;
  return { score: clamp01(global * 0.4 + weighted * 0.6), comparisons };
}

function engagementFit(
  project: ProjectProfile,
  provider: ProviderProfile,
): number {
  switch (provider.counterpartType) {
    case CounterpartType.INVESTOR:
      return rangeOverlap(
        project.fundingAskMin,
        project.fundingAskMax,
        provider.investorProfile?.checkMin,
        provider.investorProfile?.checkMax,
      );
    case CounterpartType.ADVISOR:
      return project.engagementModel?.includes(EngagementModel.ADVISORY)
        ? 1
        : 0.65;
    case CounterpartType.SERVICE_PROVIDER:
      return rangeOverlap(
        project.fundingAskMin,
        project.fundingAskMax,
        provider.serviceProviderProfile?.budgetMin,
        provider.serviceProviderProfile?.budgetMax,
      );
    case CounterpartType.PARTNER:
      return project.engagementModel?.some((item) =>
        [
          EngagementModel.PARTNERSHIP,
          EngagementModel.STRATEGIC,
          EngagementModel.REVENUE_SHARE,
        ].includes(item),
      )
        ? 1
        : 0.7;
    case CounterpartType.COFOUNDER:
    case CounterpartType.TALENT:
      return !project.commitmentLevelNeeded ||
        !provider.talentProfile?.commitmentLevel
        ? 0.55
        : provider.talentProfile.commitmentLevel ===
              project.commitmentLevelNeeded ||
            provider.talentProfile.commitmentLevel === "FLEXIBLE"
          ? 1
          : 0.12;
    default:
      return 0.5;
  }
}

function confidenceFromComponents(
  components: Record<string, number>,
  provider: ProviderProfile,
): number {
  const avg =
    Object.values(components).reduce((a, b) => a + b, 0) /
    Math.max(1, Object.values(components).length);
  const evidence = evidenceLevelScore(provider.evidenceLevel);
  const data = clamp01((provider.dataQualityScore || 0) / 100);
  return clamp01(avg * 0.55 + evidence * 0.25 + data * 0.2);
}

export function runProjectHardFilters(
  project: ProjectProfile,
  provider: ProviderProfile,
  intent: ProjectIntent,
  config: ProjectMatchingConfig = DEFAULT_PROJECT_CONFIG,
): HardFilterResult {
  const policy = getPolicyForIntent(intent, config);
  const target = mapIntentToCounterpart(intent);
  const results: HardFilterResult[] = [];

  if (provider.blocked)
    results.push(
      fail(HardFilterReason.BLOCKED, "Provider is blocked", ["blocked=true"]),
    );
  if (provider.optedOut)
    results.push(
      fail(HardFilterReason.OPT_OUT, "Provider opted out of matching", [
        "optedOut=true",
      ]),
    );
  if (
    policy.hardRequirements.requireCounterpartTypeMatch &&
    provider.counterpartType !== target
  ) {
    results.push(
      fail(HardFilterReason.FAMILY_INCOMPATIBLE, "Counterpart type mismatch", [
        `expected=${target}`,
        `actual=${provider.counterpartType}`,
      ]),
    );
  }
  if (
    policy.hardRequirements.requireLookingForAlignment &&
    project.lookingFor?.length &&
    !project.lookingFor.includes(provider.counterpartType)
  ) {
    results.push(
      project.strictLookingFor
        ? fail(
            HardFilterReason.FAMILY_INCOMPATIBLE,
            "Provider is not in project lookingFor list",
            [`lookingFor=${project.lookingFor.join(",")}`],
          )
        : review(
            HardFilterReason.FAMILY_INCOMPATIBLE,
            "Provider is adjacent to lookingFor but not explicitly selected",
            [`lookingFor=${project.lookingFor.join(",")}`],
          ),
    );
  }
  if (
    (provider.dataQualityScore || 0) <
    config.defaultThresholds.dataQualityThreshold
  ) {
    results.push(
      review(HardFilterReason.LOW_DATA_QUALITY, "Low provider data quality", [
        `dataQualityScore=${provider.dataQualityScore}`,
      ]),
    );
  }
  if (
    policy.hardRequirements.requireMarketFitForStrictCases &&
    project.operatingMarkets?.length &&
    provider.operatingMarkets?.length
  ) {
    const score = overlapScore(
      project.operatingMarkets,
      provider.operatingMarkets,
    );
    if (score === 0)
      results.push(
        review(
          HardFilterReason.GEOGRAPHY_INCOMPATIBLE,
          "No market overlap detected",
          [],
        ),
      );
  }
  if (
    target === CounterpartType.INVESTOR &&
    policy.hardRequirements.requireFundingRangeForInvestor &&
    project.fundingAskMin != null &&
    project.fundingAskMax != null
  ) {
    const fit = rangeOverlap(
      project.fundingAskMin,
      project.fundingAskMax,
      provider.investorProfile?.checkMin,
      provider.investorProfile?.checkMax,
    );
    if (fit === 0)
      results.push(
        review(
          HardFilterReason.BUDGET_INCOMPATIBLE,
          "Funding ask does not overlap investor check size",
          [],
        ),
      );
  }

  return combine(results.length ? results : [pass()]);
}

export function calculateProjectDeterministicScore(
  project: ProjectProfile,
  provider: ProviderProfile,
  intent: ProjectIntent,
  config: ProjectMatchingConfig = DEFAULT_PROJECT_CONFIG,
  retrievalScore?: number,
): DeterministicProjectScoreBreakdown {
  const policy = getPolicyForIntent(intent, config);
  const need = needOfferMatch(project, provider);
  const skill = skillFit(project, provider);
  const sector = sectorFitScore(project, provider);
  const market = marketFitScore(project, provider);
  const semantic = semanticFit(project, provider);

  const components: Record<string, number> = {
    lookingForFit: lookingForFit(project, provider, intent),
    counterpartFit: counterpartFit(project, provider, intent),
    needCoverage: need.coverage,
    needPrecision: need.precision,
    capabilityFit: need.capabilityFit,
    skillFit: skill.score,
    sectorFit: sector.score,
    marketFit: market.score,
    stageFit:
      provider.counterpartType === CounterpartType.INVESTOR
        ? stageFit(
            project.projectStage,
            provider.investorProfile?.preferredStages || [],
          )
        : provider.counterpartType === CounterpartType.COFOUNDER ||
            provider.counterpartType === CounterpartType.TALENT
          ? stageFit(
              project.projectStage,
              provider.talentProfile?.startupStageComfort || [],
            )
          : 0.7,
    engagementFit: engagementFit(project, provider),
    subtypeSpecificFit: subtypeSpecificFit(project, provider),
    credibilityFit: credibilityFit(project, provider),
    semanticFit: semantic.score,
    completenessFit: completenessScore(project, provider),
  };

  const weighted = Object.entries(policy.weights).reduce(
    (sum, [key, weight]) => sum + (components[key] || 0) * weight,
    0,
  );
  const normalizedScore = normalize100(weighted);
  const confidence = confidenceFromComponents(components, provider);

  return {
    totalScore: normalizedScore,
    normalizedScore,
    confidence,
    policyType: policy.counterpartType,
    componentScores: Object.fromEntries(
      Object.entries(components).map(([k, v]) => [
        k,
        Number((v * 100).toFixed(2)),
      ]),
    ),
    matchedNeeds: need.matchedNeeds,
    matchedSkills: skill.matchedSkills,
    matchedSectors: sector.matchedSectors,
    matchedMarkets: market.matchedMarkets,
    strongestSignals: need.strongestSignals,
    gaps: need.gaps,
    semanticFieldComparisons: semantic.comparisons,
    retrievalScore,
  } as DeterministicProjectScoreBreakdown;
}

export function buildStructuredExplanation(args: {
  project: ProjectProfile;
  provider: ProviderProfile;
  hardFilter: HardFilterResult;
  deterministicScore: number;
  scoreBreakdown: DeterministicProjectScoreBreakdown;
  selectedIntent: ProjectIntent;
}): StructuredMatchExplanation {
  const alternatives = getAlternativeIntentsForCounterpart(
    args.provider.counterpartType,
  ).filter((item) => item !== args.selectedIntent);
  return {
    summary: `${args.provider.name} is a ${args.provider.counterpartType} match with deterministic score ${args.deterministicScore}.`,
    passedHardFilters:
      args.hardFilter.status === HardFilterStatus.PASS
        ? ["Passed hard filters"]
        : [],
    rankingDrivers: unique([
      ...(args.scoreBreakdown.matchedNeeds.length
        ? [
            `Matched needs: ${args.scoreBreakdown.matchedNeeds.slice(0, 3).join(", ")}`,
          ]
        : []),
      ...(args.scoreBreakdown.matchedSkills.length
        ? [
            `Matched skills: ${args.scoreBreakdown.matchedSkills.slice(0, 3).join(", ")}`,
          ]
        : []),
      ...(args.scoreBreakdown.matchedSectors.length
        ? [
            `Sector fit: ${args.scoreBreakdown.matchedSectors.slice(0, 3).join(", ")}`,
          ]
        : []),
      ...(args.scoreBreakdown.matchedMarkets.length
        ? [
            `Market fit: ${args.scoreBreakdown.matchedMarkets.slice(0, 3).join(", ")}`,
          ]
        : []),
    ]),
    strongestSignals: args.scoreBreakdown.strongestSignals,
    missingCriticalSignals: args.scoreBreakdown.gaps,
    cautionFlags:
      args.hardFilter.status === HardFilterStatus.REVIEW
        ? [args.hardFilter.message || "Requires review"]
        : [],
    whySelectedIntentWon: [
      `Selected intent ${args.selectedIntent} aligns with counterpart type ${args.provider.counterpartType}.`,
      ...(args.project.lookingFor?.includes(args.provider.counterpartType)
        ? ["Provider is explicitly included in lookingFor."]
        : [
            "Provider is adjacent-intent surfaced, not a strict explicit choice.",
          ]),
      ...(alternatives.length
        ? [
            `Scored as stronger fit for ${args.selectedIntent} than adjacent intents ${alternatives.join(", ")}.`,
          ]
        : []),
    ],
    comparativeNotes: [],
    confidenceLabel: confidenceLabel(args.scoreBreakdown.confidence),
    scoreBreakdown: Object.entries(args.scoreBreakdown.componentScores).map(
      ([label, score]) => ({ label, score }),
    ),
  } as StructuredMatchExplanation;
}



