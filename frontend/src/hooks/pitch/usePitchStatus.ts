/**
 * PNME Hook: Pitch Status
 * Fetches pitch processing status with polling support
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface PitchJobProgress {
  step: string;
  status: string;
  progress: number;
  error?: string;
}

interface PitchProgress {
  overall: number;
  currentStep: string | null;
  steps: PitchJobProgress[];
}

interface PitchStatusResponse {
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
  progress: PitchProgress;
}

export function usePitchStatus(
  pitchId: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false | ((query: { state: { data: PitchStatusResponse | undefined } }) => number | false | undefined);
  },
) {
  return useQuery({
    queryKey: ['pitch', pitchId, 'status'],
    queryFn: async (): Promise<PitchStatusResponse> => {
      const response = await api.get<PitchStatusResponse>(`/pitches/${pitchId}`);
      return response;
    },
    enabled: options?.enabled !== false,
    refetchInterval: options?.refetchInterval,
  });
}
