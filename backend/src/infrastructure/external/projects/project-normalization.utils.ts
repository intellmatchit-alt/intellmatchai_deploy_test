import {
  CounterpartOfferSignal,
  CounterpartType,
  NeedCluster,
  ProjectNeedSignal,
  ProjectProfile,
  ProviderEvidenceLevel,
  ProviderProfile,
} from "./project-matching.types";
import {
  CLUSTER_ONTOLOGY,
  COUNTERPART_HINT_ONTOLOGY,
  PHRASE_NORMALIZATION_RULES,
  SEMANTIC_EQUIVALENCE_GROUPS,
} from "./project-ontology.constants";

export function normalizeText(value?: string | null): string {
  if (!value) return "";
  let out = String(value).toLowerCase().trim();
  for (const [pattern, replacement] of PHRASE_NORMALIZATION_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out
    .replace(/[^a-z0-9\s/+.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value?: string | null): string[] {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

export function unique<T>(values: T[]): T[] {
  return Array.from(
    new Set(values.filter((v) => v !== undefined && v !== null)),
  ) as T[];
}

export function normalizeStringArray(
  values?: Array<string | null | undefined>,
): string[] {
  return unique((values || []).map((v) => normalizeText(v)).filter(Boolean));
}

export function expandEquivalentPhrases(value: string): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  const expanded = new Set<string>([normalized]);
  for (const group of SEMANTIC_EQUIVALENCE_GROUPS) {
    const groupNorm = group.map(normalizeText);
    if (
      groupNorm.some(
        (item) =>
          item === normalized ||
          normalized.includes(item) ||
          item.includes(normalized),
      )
    ) {
      groupNorm.forEach((item) => expanded.add(item));
    }
  }
  return Array.from(expanded);
}

export function inferClustersFromText(value: string): NeedCluster[] {
  const normalized = normalizeText(value);
  if (!normalized) return ["OTHER"];
  const clusters: NeedCluster[] = [];
  for (const [cluster, synonyms] of Object.entries(CLUSTER_ONTOLOGY) as Array<
    [NeedCluster, string[]]
  >) {
    if (synonyms.some((item) => normalized.includes(normalizeText(item)))) {
      clusters.push(cluster);
    }
  }
  return clusters.length ? unique(clusters) : ["OTHER"];
}

export function inferCounterpartHints(value: string): CounterpartType[] {
  const normalized = normalizeText(value);
  const hints = new Set<CounterpartType>();
  for (const item of COUNTERPART_HINT_ONTOLOGY) {
    if (item.pattern.test(normalized)) {
      item.hints.forEach((hint) => hints.add(hint));
    }
  }
  return Array.from(hints);
}

export function jaccard(a: string[], b: string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size || !right.size) return 0;
  const intersection = Array.from(left).filter((item) =>
    right.has(item),
  ).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function overlapScore(left: string[], right: string[]): number {
  const a = normalizeStringArray(left);
  const b = normalizeStringArray(right);
  if (!a.length || !b.length) return 0;
  let hits = 0;
  for (const item of a) {
    if (
      b.some(
        (candidate) =>
          candidate === item ||
          candidate.includes(item) ||
          item.includes(candidate),
      )
    )
      hits += 1;
  }
  return hits / Math.max(a.length, b.length);
}

export function parseTagsFromText(value?: string | null): string[] {
  if (!value) return [];
  return unique(
    String(value)
      .split(/[\n,;|]/g)
      .map((item) => normalizeText(item))
      .filter(Boolean),
  );
}

export function buildProjectNeedSignals(
  project: ProjectProfile,
): ProjectNeedSignal[] {
  if (project.normalizedNeedSignals?.length)
    return project.normalizedNeedSignals;
  const rawItems = unique(
    [
      project.projectNeeds,
      project.summary,
      project.detailedDescription,
      ...(project.skillsNeeded || []),
      ...(project.advisoryTopics || []),
      ...(project.partnerTypeNeeded || []),
      project.idealCounterpartProfile || "",
    ].filter(Boolean),
  );

  return rawItems.map((raw, index) => ({
    raw,
    normalized: normalizeText(raw),
    phrases: expandEquivalentPhrases(raw),
    clusters: inferClustersFromText(raw),
    counterpartHints: inferCounterpartHints(raw),
    importance: index === 0 ? 1 : index < 3 ? 0.82 : 0.64,
  }));
}

export function buildOfferSignals(
  provider: ProviderProfile,
): CounterpartOfferSignal[] {
  if (provider.offerSignals?.length) return provider.offerSignals;
  const rawItems = unique(
    [
      provider.description,
      provider.title || "",
      ...(provider.skills || []),
      ...(provider.capabilities || []),
      ...(provider.investorProfile?.thesisSectors || []),
      ...(provider.advisorProfile?.advisoryTopics || []),
      ...(provider.advisorProfile?.advisoryFunctions || []),
      ...(provider.serviceProviderProfile?.serviceCategories || []),
      ...(provider.partnerProfile?.partnerTypes || []),
      ...(provider.partnerProfile?.channels || []),
      ...(provider.partnerProfile?.integrationCapabilities || []),
      ...(provider.talentProfile?.desiredRoles || []),
    ].filter(Boolean),
  );

  return rawItems.map((raw) => ({
    raw,
    normalized: normalizeText(raw),
    phrases: expandEquivalentPhrases(raw),
    clusters: inferClustersFromText(raw),
    evidenceLevel: provider.evidenceLevel || ProviderEvidenceLevel.MEDIUM,
  }));
}

export function normalizeProjectProfile(
  project: ProjectProfile,
): ProjectProfile {
  return {
    ...project,
    lookingFor: unique(project.lookingFor || []),
    industrySectors: unique(project.industrySectors || []),
    skillsNeeded: unique(project.skillsNeeded || []),
    operatingMarkets: unique(project.operatingMarkets || []),
    targetCustomerTypes: unique(project.targetCustomerTypes || []),
    advisoryTopics: unique(project.advisoryTopics || []),
    partnerTypeNeeded: unique(project.partnerTypeNeeded || []),
    engagementModel: unique(project.engagementModel || []),
    keywords: unique(project.keywords || []),
    normalizedNeedSignals: buildProjectNeedSignals(project),
  };
}

export function normalizeProviderProfile(
  provider: ProviderProfile,
): ProviderProfile {
  return {
    ...provider,
    sectors: unique(provider.sectors || []),
    skills: unique(provider.skills || []),
    capabilities: unique(provider.capabilities || []),
    operatingMarkets: unique(provider.operatingMarkets || []),
    keywords: unique(provider.keywords || []),
    offerSignals: buildOfferSignals(provider),
    investorProfile: provider.investorProfile
      ? {
          ...provider.investorProfile,
          thesisSectors: unique(provider.investorProfile.thesisSectors || []),
          operatingMarkets: unique(
            provider.investorProfile.operatingMarkets || [],
          ),
          targetCustomerTypes: unique(
            provider.investorProfile.targetCustomerTypes || [],
          ),
          notablePortfolio: unique(
            provider.investorProfile.notablePortfolio || [],
          ),
        }
      : undefined,
    advisorProfile: provider.advisorProfile
      ? {
          ...provider.advisorProfile,
          advisoryTopics: unique(provider.advisorProfile.advisoryTopics || []),
          advisoryFunctions: unique(
            provider.advisorProfile.advisoryFunctions || [],
          ),
        }
      : undefined,
    serviceProviderProfile: provider.serviceProviderProfile
      ? {
          ...provider.serviceProviderProfile,
          serviceCategories: unique(
            provider.serviceProviderProfile.serviceCategories || [],
          ),
          deliveryModes: unique(
            provider.serviceProviderProfile.deliveryModes || [],
          ),
          certifications: unique(
            provider.serviceProviderProfile.certifications || [],
          ),
        }
      : undefined,
    partnerProfile: provider.partnerProfile
      ? {
          ...provider.partnerProfile,
          partnerTypes: unique(provider.partnerProfile.partnerTypes || []),
          channels: unique(provider.partnerProfile.channels || []),
          territories: unique(provider.partnerProfile.territories || []),
          customerTypes: unique(provider.partnerProfile.customerTypes || []),
          integrationCapabilities: unique(
            provider.partnerProfile.integrationCapabilities || [],
          ),
        }
      : undefined,
    talentProfile: provider.talentProfile
      ? {
          ...provider.talentProfile,
          desiredRoles: unique(provider.talentProfile.desiredRoles || []),
        }
      : undefined,
  };
}

export function cosineSimilarity(a?: number[], b?: number[]): number {
  if (!a || !b || !a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}

export function evidenceLevelScore(level?: string): number {
  switch (level) {
    case "HIGH":
      return 1;
    case "MEDIUM":
      return 0.7;
    case "LOW":
      return 0.45;
    default:
      return 0.55;
  }
}

export function safeNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function confidenceLabel(
  confidence: number,
): ConfidenceLevel | "VERY_LOW" {
  if (confidence >= 0.78) return "HIGH" as ConfidenceLevel;
  if (confidence >= 0.6) return "MEDIUM" as ConfidenceLevel;
  if (confidence >= 0.45) return "LOW" as ConfidenceLevel;
  return "VERY_LOW";
}
