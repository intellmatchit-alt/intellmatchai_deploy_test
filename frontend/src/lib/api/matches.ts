/**
 * Matches API
 *
 * API functions for matching and recommendation endpoints.
 *
 * @module lib/api/matches
 */

import { api } from './client';
import { Contact } from './contacts';

/**
 * Intersection point between user and contact
 */
export interface IntersectionPoint {
  type: 'sector' | 'skill' | 'interest' | 'company' | 'location';
  label: string;
  id?: string;
  strength: number;
}

/**
 * Match result for a contact
 */
export interface MatchResult {
  contactId: string;
  score: number;
  scoreBreakdown: {
    goalAlignmentScore: number;
    sectorScore: number;
    skillScore: number;
    semanticSimilarityScore?: number;
    networkProximityScore?: number;
    complementarySkillsScore: number;
    recencyScore: number;
    interactionScore: number;
    interestScore: number;
    hobbyScore: number;
  };
  intersections: IntersectionPoint[];
  reasons?: string[];
  suggestedMessage?: string;
  goalAlignment?: {
    matchedGoals: string[];
    relevantTraits: string[];
  };
  confidence?: number;
  matchQuality?: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Matches list response
 */
export interface MatchesResponse {
  matches: MatchResult[];
  total: number;
}

/**
 * Daily recommendation
 */
export interface DailyRecommendation {
  contact: {
    id: string;
    name: string;
    company?: string;
    jobTitle?: string;
  };
  match: MatchResult;
  recommendationReason: string;
}

/**
 * Daily recommendations response
 */
export interface DailyRecommendationsResponse {
  recommendations: DailyRecommendation[];
  date: string;
}

/**
 * Follow-up reminders response
 */
export interface FollowUpResponse {
  contacts: Contact[];
  daysThreshold: number;
}

/**
 * Match query options
 */
export interface MatchQueryOptions {
  limit?: number;
  minScore?: number;
  sector?: string;
}

/**
 * Get ranked matches for user's contacts
 */
export function getMatches(options?: MatchQueryOptions): Promise<MatchesResponse> {
  const params = new URLSearchParams();

  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.minScore) params.set('minScore', String(options.minScore));
  if (options?.sector) params.set('sector', options.sector);

  const query = params.toString();
  return api.get<MatchesResponse>(`/matches${query ? `?${query}` : ''}`);
}

/**
 * Get detailed match analysis for a contact
 */
export function getMatchDetails(contactId: string): Promise<MatchResult> {
  return api.get<MatchResult>(`/matches/${contactId}`);
}

/**
 * Get intersection points with a contact
 */
export function getIntersections(
  contactId: string
): Promise<{ contactId: string; intersections: IntersectionPoint[] }> {
  return api.get<{ contactId: string; intersections: IntersectionPoint[] }>(
    `/matches/intersections/${contactId}`
  );
}

/**
 * Get daily recommendations
 */
export function getDailyRecommendations(
  count?: number
): Promise<DailyRecommendationsResponse> {
  const query = count ? `?count=${count}` : '';
  return api.get<DailyRecommendationsResponse>(`/recommendations/daily${query}`);
}

/**
 * Get follow-up reminders
 */
export function getFollowUpReminders(days?: number): Promise<FollowUpResponse> {
  const query = days ? `?days=${days}` : '';
  return api.get<FollowUpResponse>(`/recommendations/followup${query}`);
}

/**
 * Recalculate match score for a contact
 */
export function recalculateScore(
  contactId: string
): Promise<{ contactId: string; score: number }> {
  return api.post<{ contactId: string; score: number }>(
    `/matches/${contactId}/recalculate`
  );
}

// ============================================================================
// Suggestions & Skill Gap
// ============================================================================

export interface ImprovementSuggestion {
  category: string;
  suggestion: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedImpact?: number;
  effort?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ProfileImprovementsResponse {
  completeness: number;
  suggestions: ImprovementSuggestion[];
  profile: {
    skillCount: number;
    sectorCount: number;
    goalCount: number;
    interestCount: number;
    hobbyCount: number;
    hasBio: boolean;
    hasJobTitle: boolean;
    hasCompany: boolean;
  };
}

export interface SkillGapResponse {
  contactId: string;
  contactName: string;
  userSkillCount: number;
  contactSkillCount: number;
  matchedSkills: Array<{ source: string; target: string; matchType: string; score: number }>;
  missingSkills: string[];
  learnableSkills: string[];
  complementarySkills: string[];
}

/**
 * Get profile improvement suggestions
 */
export function getProfileImprovements(): Promise<ProfileImprovementsResponse> {
  return api.get<ProfileImprovementsResponse>('/suggestions/profile-improvements');
}

/**
 * Get skill gap analysis with a contact
 */
export function getSkillGap(contactId: string): Promise<SkillGapResponse> {
  return api.get<SkillGapResponse>(`/suggestions/skill-gap/${contactId}`);
}
