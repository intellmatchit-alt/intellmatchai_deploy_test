/**
 * PNME Hook: Update Match Status
 * Handles saving, ignoring, or marking matches as contacted
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface UpdateMatchStatusParams {
  matchId: string;
  status: 'PENDING' | 'SAVED' | 'IGNORED' | 'CONTACTED';
  outreachEdited?: string;
}

interface UpdateMatchStatusResponse {
  id: string;
  status: string;
  savedAt?: string;
  ignoredAt?: string;
  contactedAt?: string;
}

export function useUpdateMatchStatus(options?: {
  onSuccess?: (data: UpdateMatchStatusResponse) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateMatchStatusParams): Promise<UpdateMatchStatusResponse> => {
      const { matchId, ...body } = params;
      const response = await api.patch<UpdateMatchStatusResponse>(`/pitch-matches/${matchId}`, body);
      return response;
    },
    onSuccess: (data) => {
      // Invalidate pitch results to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['pitch'] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}
