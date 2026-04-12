/**
 * PNME Hook: Pitch List
 * Fetches user's pitch decks
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Pitch {
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
}

interface PitchListResponse {
  pitches: Pitch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function usePitchList(options?: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['pitches', options],
    queryFn: async (): Promise<PitchListResponse> => {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());

      const response = await api.get<PitchListResponse>(`/pitches?${params.toString()}`);
      return response;
    },
  });
}
