/**
 * Provider Profile Mapper
 *
 * Maps User and Contact database records to ProviderProfile objects
 * used by the advanced matching engine. Builds profiles on-the-fly
 * without requiring a separate ProviderProfile database table.
 */

import { CounterpartType, ProviderProfile, ProjectStage } from './project-matching.types';
import { EntityFamily, ExecutionTrack, SeniorityLevel } from '../common/matching-common.types';
import { COUNTERPART_HINT_ONTOLOGY } from './project-ontology.constants';
import { normalizeText, tokenize } from './project-normalization.utils';

// ─── Type inference helpers ──────────────────────────────────

const INVESTOR_PATTERN = /\b(investor|venture\s*capital|vc\s|angel|fund\s*manager|portfolio|capital|investment\s*(director|manager|analyst))\b/i;
const ADVISOR_PATTERN = /\b(advisor|mentor|board\s*(member|director)|consultant|coach|strategist)\b/i;
const COFOUNDER_PATTERN = /\b(co-?founder|founding|cto|ceo|coo|cmo|chief)\b/i;
const TALENT_PATTERN = /\b(developer|engineer|designer|architect|analyst|scientist|manager|specialist|coordinator|lead\b)/i;
const SERVICE_PATTERN = /\b(agency|firm|provider|studio|consultancy|solutions|services\s*(company|llc|inc)?)\b/i;

export function inferCounterpartType(jobTitle?: string, bio?: string, company?: string): CounterpartType {
  const text = [jobTitle, bio, company].filter(Boolean).join(' ');
  if (INVESTOR_PATTERN.test(text)) return CounterpartType.INVESTOR;
  if (ADVISOR_PATTERN.test(text)) return CounterpartType.ADVISOR;
  if (COFOUNDER_PATTERN.test(text)) return CounterpartType.COFOUNDER;
  if (SERVICE_PATTERN.test(text)) return CounterpartType.SERVICE_PROVIDER;
  if (TALENT_PATTERN.test(text)) return CounterpartType.TALENT;
  return CounterpartType.PARTNER;
}

export function inferExecutionTrack(jobTitle?: string, bio?: string): ExecutionTrack {
  const text = [jobTitle, bio].filter(Boolean).join(' ').toLowerCase();
  if (/investor|fund|capital|vc|angel/.test(text)) return ExecutionTrack.FINANCIAL;
  if (/advisor|mentor|board|consultant|coach/.test(text)) return ExecutionTrack.ADVISORY;
  if (/ceo|coo|director|vp|head\s+of|manager/.test(text)) return ExecutionTrack.STRATEGIC;
  if (/cto|engineer|developer|architect|devops|data/.test(text)) return ExecutionTrack.TECHNICAL;
  if (/operations|logistics|supply|procurement/.test(text)) return ExecutionTrack.OPERATIONAL;
  return ExecutionTrack.HANDS_ON;
}

export function inferSeniority(jobTitle?: string): SeniorityLevel | undefined {
  if (!jobTitle) return undefined;
  const t = jobTitle.toLowerCase();
  if (/\b(chief|c-level|ceo|cto|coo|cfo|cmo|president)\b/.test(t)) return SeniorityLevel.C_LEVEL;
  if (/\b(vp|vice\s*president|evp|svp)\b/.test(t)) return SeniorityLevel.EXECUTIVE;
  if (/\b(principal|staff)\b/.test(t)) return SeniorityLevel.PRINCIPAL;
  if (/\b(director|head\s+of)\b/.test(t)) return SeniorityLevel.LEAD;
  if (/\b(senior|sr\.?)\b/.test(t)) return SeniorityLevel.SENIOR;
  if (/\b(junior|jr\.?|intern|associate)\b/.test(t)) return SeniorityLevel.JUNIOR;
  return SeniorityLevel.MID;
}

function extractKeywords(name: string, jobTitle?: string, bio?: string, sectors: string[] = [], skills: string[] = []): string[] {
  const parts = [jobTitle, bio, ...sectors, ...skills].filter(Boolean);
  const tokens = parts.flatMap(p => tokenize(normalizeText(p!)));
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'at', 'of', 'for', 'to', 'with', 'on', 'is', 'are', 'was', 'been']);
  return [...new Set(tokens.filter(t => t.length > 2 && !stopWords.has(t)))].slice(0, 30);
}

function calculateDataQuality(fields: Record<string, unknown>): number {
  const checks = [
    ['name', 10], ['description', 15], ['jobTitle', 10], ['company', 5],
    ['sectors', 15], ['skills', 15], ['bio', 10], ['location', 5],
    ['interests', 5], ['hobbies', 5], ['linkedin', 5],
  ] as const;
  let score = 0;
  for (const [key, weight] of checks) {
    const val = fields[key];
    if (val && (typeof val === 'string' ? val.trim().length > 0 : Array.isArray(val) && val.length > 0)) {
      score += weight;
    }
  }
  return Math.min(score, 100);
}

// ─── Main mappers ──────────────────────────────────────

export interface UserWithRelations {
  id: string;
  fullName: string;
  jobTitle?: string | null;
  company?: string | null;
  bio?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  userSectors: Array<{ sector: { name: string } }>;
  userSkills: Array<{ skill: { name: string } }>;
  userInterests?: Array<{ interest: { name: string } }>;
  userHobbies?: Array<{ hobby: { name: string } }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactWithRelations {
  id: string;
  fullName: string;
  jobTitle?: string | null;
  company?: string | null;
  bio?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  contactSectors: Array<{ sector: { name: string } }>;
  contactSkills: Array<{ skill: { name: string } }>;
  contactInterests?: Array<{ interest: { name: string } }>;
  contactHobbies?: Array<{ hobby: { name: string } }>;
  createdAt: Date;
  updatedAt: Date;
}

export function buildProviderFromUser(user: UserWithRelations): ProviderProfile {
  const sectors = user.userSectors.map(s => s.sector.name);
  const skills = user.userSkills.map(s => s.skill.name);
  const interests = user.userInterests?.map(i => i.interest.name) || [];
  const counterpartType = inferCounterpartType(user.jobTitle || undefined, user.bio || undefined, user.company || undefined);

  return {
    id: user.id,
    userId: user.id,
    name: user.fullName,
    title: user.jobTitle || undefined,
    description: user.bio || [user.jobTitle, user.company].filter(Boolean).join(' at ') || '',
    counterpartType,
    entityFamily: EntityFamily.INDIVIDUAL,
    executionTrack: inferExecutionTrack(user.jobTitle || undefined, user.bio || undefined),
    seniority: inferSeniority(user.jobTitle || undefined),
    sectors,
    skills,
    capabilities: [...skills, ...interests].slice(0, 15),
    operatingMarkets: user.location ? [user.location] : [],
    keywords: extractKeywords(user.fullName, user.jobTitle || undefined, user.bio || undefined, sectors, skills),
    dataQualityScore: calculateDataQuality({
      name: user.fullName, description: user.bio, jobTitle: user.jobTitle,
      company: user.company, sectors, skills, bio: user.bio,
      location: user.location, interests, hobbies: user.userHobbies?.map(h => h.hobby.name),
      linkedin: user.linkedinUrl,
    }),
    verified: false,
    evidenceLevel: 'MEDIUM',
    available: true,
    blocked: false,
    optedOut: false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  } as ProviderProfile;
}

export function buildProviderFromContact(contact: ContactWithRelations): ProviderProfile {
  const sectors = contact.contactSectors.map(s => s.sector.name);
  const skills = contact.contactSkills.map(s => s.skill.name);
  const interests = contact.contactInterests?.map(i => i.interest.name) || [];
  const counterpartType = inferCounterpartType(contact.jobTitle || undefined, contact.bio || undefined, contact.company || undefined);

  return {
    id: contact.id,
    name: contact.fullName,
    title: contact.jobTitle || undefined,
    description: contact.bio || [contact.jobTitle, contact.company].filter(Boolean).join(' at ') || '',
    counterpartType,
    entityFamily: EntityFamily.INDIVIDUAL,
    executionTrack: inferExecutionTrack(contact.jobTitle || undefined, contact.bio || undefined),
    seniority: inferSeniority(contact.jobTitle || undefined),
    sectors,
    skills,
    capabilities: [...skills, ...interests].slice(0, 15),
    operatingMarkets: contact.location ? [contact.location] : [],
    keywords: extractKeywords(contact.fullName, contact.jobTitle || undefined, contact.bio || undefined, sectors, skills),
    dataQualityScore: calculateDataQuality({
      name: contact.fullName, description: contact.bio, jobTitle: contact.jobTitle,
      company: contact.company, sectors, skills, bio: contact.bio,
      location: contact.location, interests, hobbies: contact.contactHobbies?.map(h => h.hobby.name),
      linkedin: contact.linkedinUrl,
    }),
    verified: false,
    evidenceLevel: 'LOW',
    available: true,
    blocked: false,
    optedOut: false,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  } as ProviderProfile;
}
