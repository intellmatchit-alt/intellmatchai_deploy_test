/**
 * Embedding-based Semantic Scorer for Project Matching (Tier 3 / Tier 4).
 *
 * For each role in a project's `lookingFor`, computes the cosine similarity
 * between:
 *   - role description embedding (e.g. "An investor: someone who invests
 *     money in startups...") — 8 of these, one per role, computed once
 *   - contact profile embedding (jobTitle + company + bio + skill names)
 *
 * Cosine similarity ∈ [-1, 1] is mapped to a 0..100 score. Strongly negative
 * similarities (rare in this domain) are floored at 0.
 *
 * Caching: embeddings are stored in an in-memory LRU keyed by SHA-1 of the
 * input text. This avoids re-embedding identical profiles across requests.
 * For a multi-process pm2 setup the cache is per-worker (acceptable: warming
 * up takes a few requests; the OpenAI cost per call is ~$0.00002).
 *
 * Provider: uses OpenAI's `text-embedding-3-small` (1536-dim, $0.02 / 1M
 * input tokens, multilingual including Arabic).
 *
 * @module infrastructure/external/projects/lookingForSemanticScorer
 */

import crypto from "crypto";
import { ROLE_DESCRIPTIONS, ContactScoringInput } from "./lookingForRoleScorer";
import { logger } from "../../../shared/logger";

const EMBEDDING_MODEL = "text-embedding-3-small";
const OPENAI_URL = "https://api.openai.com/v1/embeddings";

interface CacheEntry {
  vector: Float32Array;
  insertedAt: number;
}

// Simple LRU-ish cache. Bounded to keep the worker memory predictable.
const MAX_CACHE = 5000;
const cache = new Map<string, CacheEntry>();

function hash(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex");
}

function cacheGet(key: string): Float32Array | null {
  const entry = cache.get(key);
  if (!entry) return null;
  // Refresh insertion order (Map preserves order; delete + set bumps it).
  cache.delete(key);
  cache.set(key, entry);
  return entry.vector;
}

function cacheSet(key: string, vector: Float32Array): void {
  if (cache.size >= MAX_CACHE) {
    // Evict the oldest (first-inserted) entry.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { vector, insertedAt: Date.now() });
}

async function embed(text: string): Promise<Float32Array | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!text?.trim()) return null;

  const key = hash(text);
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const resp = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000), // model context cap; 8k is well within
      }),
    });
    if (!resp.ok) {
      logger.warn("[LookingForSemantic] Embedding call failed", { status: resp.status });
      return null;
    }
    const body = (await resp.json()) as { data?: Array<{ embedding: number[] }> };
    const vec = body.data?.[0]?.embedding;
    if (!vec?.length) return null;
    const float = new Float32Array(vec);
    cacheSet(key, float);
    return float;
  } catch (err) {
    logger.warn("[LookingForSemantic] Embedding fetch error", { err });
    return null;
  }
}

function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Map cosine similarity ∈ [-1, 1] to a 0..100 score.
 * Real-world distribution for ada-2/3-small in this domain sits ~0.2..0.7,
 * so we re-scale 0.20→0 and 0.65→100 for a more useful spread.
 */
function similarityToScore(sim: number): number {
  const lo = 0.2;
  const hi = 0.65;
  const clamped = Math.max(lo, Math.min(hi, sim));
  return Math.round(((clamped - lo) / (hi - lo)) * 100);
}

function buildContactText(c: ContactScoringInput): string {
  const skillsLine = c.skillNames?.length ? `Skills: ${c.skillNames.join(", ")}.` : "";
  return [
    c.jobTitle ? `Job title: ${c.jobTitle}.` : "",
    c.headline ? `Headline: ${c.headline}.` : "",
    c.company ? `Company: ${c.company}.` : "",
    c.bio ? `Bio: ${c.bio}.` : "",
    skillsLine,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * Compute per-role semantic scores for a contact against a project's
 * lookingFor list. Returns null if embeddings aren't available
 * (no API key, network error, empty input) — the caller should fall back
 * to keyword scoring alone.
 */
export async function semanticScoreLookingForRoles(
  roles: string[],
  contact: ContactScoringInput,
): Promise<Record<string, number> | null> {
  if (!roles?.length) return null;
  const contactText = buildContactText(contact);
  if (!contactText) return null;

  // Embed contact + each role description in parallel.
  const [contactVec, ...roleVecs] = await Promise.all([
    embed(contactText),
    ...roles.map((r) => embed(ROLE_DESCRIPTIONS[r] || r)),
  ]);

  if (!contactVec) return null;

  const out: Record<string, number> = {};
  for (let i = 0; i < roles.length; i++) {
    const rv = roleVecs[i];
    if (!rv) {
      out[roles[i]] = 0;
      continue;
    }
    const sim = cosine(contactVec, rv);
    out[roles[i]] = similarityToScore(sim);
  }
  return out;
}

/**
 * Batch helper: score many contacts against one project's roles in a single
 * call. The role-description embeddings are computed once (cached anyway,
 * but this saves the lookups). Fails gracefully — a contact whose embedding
 * call errors gets `null` for every role and the caller should fall through
 * to keyword scoring for it.
 */
export async function semanticScoreManyContacts(
  roles: string[],
  contacts: ContactScoringInput[],
): Promise<Array<Record<string, number> | null>> {
  if (!roles?.length || !contacts?.length) return contacts.map(() => null);

  // Pre-embed role descriptions once.
  const roleVecs = await Promise.all(
    roles.map((r) => embed(ROLE_DESCRIPTIONS[r] || r)),
  );

  // Embed contacts in parallel — bounded by Promise.all without throttling
  // since payloads are small. For very large batches add p-limit later.
  const contactVecs = await Promise.all(
    contacts.map((c) => embed(buildContactText(c))),
  );

  return contactVecs.map((cv) => {
    if (!cv) return null;
    const out: Record<string, number> = {};
    for (let i = 0; i < roles.length; i++) {
      const rv = roleVecs[i];
      out[roles[i]] = rv ? similarityToScore(cosine(cv, rv)) : 0;
    }
    return out;
  });
}
