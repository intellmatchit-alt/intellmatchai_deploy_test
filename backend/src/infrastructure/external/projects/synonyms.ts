/**
 * Sector & skill synonym normalization for project matching.
 *
 * The legacy overlap math compares Prisma `sectorId` / `skillId` values
 * directly — exact ID match only. Real production data is messy: contacts
 * import sectors as free-text, the same concept exists under different IDs
 * across migrations, and some labels are localized (Arabic) versus their
 * English equivalents.
 *
 * This module provides:
 *   1. A canonical-key normalizer that collapses common synonym groups to a
 *      single key (e.g. "AI", "ML", "Artificial Intelligence", "Machine
 *      Learning" → "ai_ml").
 *   2. A token-fallback so labels not in the synonym table still match when
 *      they share a meaningful root (e.g. "Big Data & Analytics" vs
 *      "Data Analytics").
 *   3. Helpers (`hasSynonymOverlap`, `countSynonymOverlap`, `intersectByCanonical`)
 *      used by the role scorer and the spec-component derivation.
 *
 * Design notes:
 *   - The synonym table is intentionally compact (~60 groups). Maintaining a
 *     huge table is costly; the token-fallback handles the long tail.
 *   - Cross-language pairs are explicit: each Arabic label that's commonly
 *     used in seed data sits in the same group as its English counterpart.
 *
 * @module infrastructure/external/projects/synonyms
 */

// ────────────────────────────────────────────────────────────────────────────
// CANONICAL SYNONYM GROUPS
//
// Each row is a list of labels that should be treated as the same concept.
// The first entry is the "canonical key" returned by `canonicalizeLabel`.
// Order within a row doesn't matter — comparisons are case-insensitive and
// whitespace-collapsed.
// ────────────────────────────────────────────────────────────────────────────

const SYNONYM_GROUPS: string[][] = [
  // ── AI / ML ──────────────────────────────────────────────────────────────
  ["ai_ml", "ai", "ml", "artificial intelligence", "machine learning", "applied ai", "applied machine learning", "الذكاء الاصطناعي", "الذكاء الاصطناعي التطبيقي", "تعلم الآلة", "الذكاء الاصطناعي في التطبيقات الأمنية"],
  ["data_science", "data science", "data scientist", "data analytics", "data analysis", "big data", "big data & analytics", "data engineering", "تحليل البيانات الضخمة"],
  ["nlp", "natural language processing", "nlp"],
  ["computer_vision", "computer vision", "image processing", "vision ai"],
  ["deep_learning", "deep learning", "neural networks"],

  // ── Tech / Software ──────────────────────────────────────────────────────
  ["software_dev", "software development", "software engineering", "software", "custom web & mobile software development", "programming", "coding", "تطوير البرمجيات", "برمجة"],
  ["web_development", "web development", "web dev", "frontend development", "backend development"],
  ["mobile_development", "mobile development", "mobile app development", "ios development", "android development"],
  ["devops", "devops", "site reliability", "sre", "platform engineering", "infrastructure"],
  ["cloud", "cloud computing", "cloud", "aws", "azure", "gcp", "google cloud", "كلاود"],
  ["cybersecurity", "cybersecurity", "cyber security", "information security", "infosec", "security", "الأمن السيبراني"],
  ["blockchain", "blockchain", "blockchain technology", "web3", "crypto", "blockchain technology", "blockchain‑enabled supply chain", "blockchain‑enabled logistics"],
  ["iot", "iot", "internet of things", "internet-of-things"],
  ["api", "api", "rest api", "rest apis", "graphql", "apis"],

  // ── Business sectors ─────────────────────────────────────────────────────
  ["fintech", "fintech", "financial technology", "finance technology"],
  ["healthtech", "healthtech", "health tech", "health technology", "digital health"],
  ["edtech", "edtech", "education technology", "educational technology", "digital education"],
  ["proptech", "proptech", "property technology", "real estate technology"],
  ["agritech", "agritech", "ag tech", "agtech", "agri-tech", "agricultural technology", "agri‑food traceability"],
  ["cleantech", "cleantech", "clean tech", "clean technology", "sustainability tech", "green tech", "renewable energy"],
  ["foodtech", "foodtech", "food tech", "food technology", "food packaging", "food safety"],
  ["legaltech", "legaltech", "legal tech", "legal technology"],
  ["insurtech", "insurtech", "insurance technology"],
  ["martech", "martech", "marketing technology", "digital marketing technology"],
  ["hrtech", "hrtech", "hr tech", "human resources technology"],
  ["mediatech", "mediatech", "media technology", "digital media"],
  ["retailtech", "retailtech", "retail technology"],
  ["logistics_tech", "logistics tech", "supply chain tech", "supply chain digitization", "supply chain transparency"],
  ["mobility", "mobility", "automotive tech", "transportation tech", "ride hailing"],
  ["gaming", "gaming", "video games", "esports"],

  // ── Industries ───────────────────────────────────────────────────────────
  ["finance", "finance", "financial services", "banking", "investment banking"],
  ["healthcare", "healthcare", "health care", "medical", "medicine"],
  ["education", "education", "training", "learning", "training and development", "training & development"],
  ["consulting", "consulting", "consultancy", "management consulting", "business consulting"],
  ["real_estate", "real estate", "property", "property development", "commercial real estate"],
  ["legal", "legal", "legal services", "law"],
  ["marketing", "marketing", "advertising", "branding", "digital marketing"],
  ["sales", "sales", "business development", "bd", "biz dev"],
  ["operations", "operations", "ops", "operational excellence"],
  ["manufacturing", "manufacturing", "industrial"],
  ["energy", "energy", "oil & gas", "oil and gas", "renewable energy"],
  ["telecom", "telecom", "telecommunications"],
  ["media_entertainment", "media", "entertainment", "media & entertainment", "broadcasting"],
  ["government", "government", "public sector", "public policy", "govtech"],
  ["nonprofit", "non-profit", "nonprofit", "ngo"],

  // ── Skills (functional) ──────────────────────────────────────────────────
  ["product_management", "product management", "product", "pm", "product strategy"],
  ["project_management", "project management", "program management"],
  ["leadership", "leadership", "executive leadership", "management"],
  ["strategy", "strategy", "strategic planning", "business strategy", "operational strategy"],
  ["fundraising", "fundraising", "capital raising", "venture capital", "fund raising"],
  ["partnerships", "partnerships", "partnership development", "alliances", "strategic partnerships"],
  ["growth", "growth", "growth hacking", "user acquisition"],
  ["finance_skills", "financial analysis", "corporate finance", "financial consulting", "accounting", "mergers & acquisitions"],
  ["go_to_market", "go-to-market", "gtm", "go to market"],
  ["customer_success", "customer success", "client services", "client success"],
  ["entrepreneurship", "entrepreneurship", "entrepreneur", "startup"],
];

// ────────────────────────────────────────────────────────────────────────────
// LABEL → CANONICAL KEY MAP (built once)
// ────────────────────────────────────────────────────────────────────────────

const LABEL_TO_CANONICAL = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (let i = 1; i < group.length; i++) {
    LABEL_TO_CANONICAL.set(normalizeForKey(group[i]), canonical);
  }
  // The canonical key itself maps to itself, so the same key works on both sides.
  LABEL_TO_CANONICAL.set(canonical, canonical);
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function normalizeForKey(label: string): string {
  return (label || "")
    .toLowerCase()
    .normalize("NFKC")
    // Strip common punctuation that varies between sources.
    .replace(/[‑–—\-_/&,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Canonicalize a single label into its synonym-group key (or its own
 * normalised form when no group is defined for it). */
export function canonicalizeLabel(label: string): string {
  const norm = normalizeForKey(label);
  return LABEL_TO_CANONICAL.get(norm) ?? norm;
}

/** Canonicalize an array of labels and return the unique canonical keys. */
export function canonicalKeysOf(labels: string[] | undefined): Set<string> {
  const out = new Set<string>();
  if (!labels) return out;
  for (const raw of labels) {
    if (!raw) continue;
    out.add(canonicalizeLabel(raw));
  }
  return out;
}

/**
 * Token-overlap fallback for labels that don't share a synonym group. Returns
 * true when the two labels share at least one meaningful token (length ≥ 4
 * to avoid false positives on stop-words / generic fragments).
 */
function tokenOverlap(a: string, b: string): boolean {
  const ta = new Set(
    normalizeForKey(a)
      .split(/\s+/)
      .filter((tok) => tok.length >= 4),
  );
  if (!ta.size) return false;
  for (const tok of normalizeForKey(b).split(/\s+/)) {
    if (tok.length < 4) continue;
    if (ta.has(tok)) return true;
  }
  return false;
}

/**
 * Count how many entries in `contactLabels` overlap with `projectLabels`,
 * matching either by canonical synonym key or by ≥4-char token overlap.
 *
 * The result is bounded by the smaller side's count so very long contact
 * label lists (some imports drop hundreds of sectors per contact) can't
 * produce inflated counts.
 */
export function countSynonymOverlap(
  projectLabels: string[] | undefined,
  contactLabels: string[] | undefined,
): { count: number; matchedNames: string[] } {
  if (!projectLabels?.length || !contactLabels?.length) {
    return { count: 0, matchedNames: [] };
  }
  const projectKeys = canonicalKeysOf(projectLabels);
  const matchedKeys = new Set<string>();
  const matchedNames: string[] = [];

  // Pass 1: canonical key match
  for (const raw of contactLabels) {
    const key = canonicalizeLabel(raw);
    if (projectKeys.has(key) && !matchedKeys.has(key)) {
      matchedKeys.add(key);
      matchedNames.push(raw);
    }
  }

  // Pass 2: token-overlap fallback for project labels not yet matched.
  const unmatchedProjectLabels = projectLabels.filter(
    (p) => !matchedKeys.has(canonicalizeLabel(p)),
  );
  for (const proj of unmatchedProjectLabels) {
    for (const cand of contactLabels) {
      if (tokenOverlap(proj, cand)) {
        const key = canonicalizeLabel(cand);
        if (!matchedKeys.has(key)) {
          matchedKeys.add(key);
          matchedNames.push(cand);
        }
        break;
      }
    }
  }

  return {
    count: Math.min(matchedKeys.size, projectLabels.length),
    matchedNames,
  };
}
