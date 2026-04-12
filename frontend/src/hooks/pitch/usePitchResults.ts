/**
 * PNME Hook: Pitch Results
 * Fetches complete pitch analysis results
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Contact {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  matchScore: number | null;
}

interface MatchReason {
  type: string;
  text: string;
  evidence: string;
}

interface MatchBreakdown {
  relevance: { score: number; weight: number; weighted: number };
  expertise: { score: number; weight: number; weighted: number };
  strategic: { score: number; weight: number; weighted: number };
  relationship: { score: number; weight: number; weighted: number };
}

interface PitchMatch {
  id: string;
  contact: Contact;
  score: number;
  breakdown: MatchBreakdown;
  reasons: MatchReason[];
  angleCategory: string | null;
  outreachDraft: string | null;
  status: string;
}

interface PitchSection {
  id: string;
  type: string;
  order: number;
  title: string;
  content: string;
  confidence: number;
  matches: PitchMatch[];
}

interface PitchNeed {
  key: string;
  label: string;
  description: string | null;
  confidence: number;
  amount?: string | null;
  timeline?: string | null;
}

interface PitchResultsResponse {
  pitch: {
    id: string;
    status: string;
    fileName: string;
    fileType: string;
    title: string | null;
    companyName: string | null;
    language: string;
    uploadedAt: string;
    processedAt: string | null;
    sectionsCount?: number;
    needsCount?: number;
  };
  sections: PitchSection[];
  needs: PitchNeed[];
  summary: {
    totalMatches: number;
    avgScore: number;
    topAngle: string | null;
  };
}

export function usePitchResults(
  pitchId: string,
  options?: {
    enabled?: boolean;
    sectionType?: string;
    minScore?: number;
    limit?: number;
  },
) {
  return useQuery({
    queryKey: ['pitch', pitchId, 'results', options],
    queryFn: async (): Promise<PitchResultsResponse> => {
      const params = new URLSearchParams();
      if (options?.sectionType) params.append('sectionType', options.sectionType);
      if (options?.minScore) params.append('minScore', options.minScore.toString());
      if (options?.limit) params.append('limit', options.limit.toString());

      const response = await api.get<PitchResultsResponse>(`/pitches/${pitchId}/results?${params.toString()}`);
      return response;
    },
    enabled: options?.enabled !== false,
  });
}
