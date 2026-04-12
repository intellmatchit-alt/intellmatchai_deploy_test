/**
 * PNME Hook: Pitch Upload
 * Handles uploading pitch decks to the API
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface UploadPitchParams {
  file: File;
  title?: string;
  language?: 'en' | 'ar';
}

interface UploadPitchResponse {
  pitch: {
    id: string;
    status: string;
    fileName: string;
    fileType: string;
    title: string | null;
    companyName: string | null;
    language: string;
    uploadedAt: string;
  };
  jobs: Array<{
    step: string;
    status: string;
    progress: number;
  }>;
}

export function usePitchUpload(options?: {
  onSuccess?: (data: UploadPitchResponse) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UploadPitchParams): Promise<UploadPitchResponse> => {
      const formData = new FormData();
      formData.append('file', params.file);
      if (params.title) {
        formData.append('title', params.title);
      }
      if (params.language) {
        formData.append('language', params.language);
      }

      const response = await api.post('/pitches', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response as any;
    },
    onSuccess: (data: any) => {
      // Invalidate pitch list
      queryClient.invalidateQueries({ queryKey: ['pitches'] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}
