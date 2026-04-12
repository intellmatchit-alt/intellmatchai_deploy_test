/**
 * Pitch Edit Page
 *
 * Slim wrapper around PitchForm for editing an existing pitch.
 * Fetches pitch data, then passes it to the shared form component.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
} from '@fluentui/react-icons';
import {
  getPitchStatus,
  getPitchResults,
  updatePitch,
  updatePitchSection,
  archivePitch,
  UpdatePitchInput,
  PitchStatusResponse,
  PitchResultsResponse,
  Pitch,
} from '@/lib/api/pitch';
import { toast } from '@/components/ui/Toast';
import PitchForm from '@/components/pitch/PitchForm';

export default function PitchEditPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const pitchId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [pitch, setPitch] = useState<Pitch | null>(null);

  // Fetch pitch data
  useEffect(() => {
    const fetchPitch = async () => {
      try {
        setIsFetching(true);
        const statusData = await getPitchStatus(pitchId);
        setPitch(statusData);
      } catch (error: any) {
        toast({ title: t.common?.error || 'Error', description: 'Failed to load pitch', variant: 'error' });
        router.push('/pitch');
      } finally {
        setIsFetching(false);
      }
    };
    if (pitchId) fetchPitch();
  }, [pitchId]);

  const handleSubmit = async (data: UpdatePitchInput) => {
    setIsLoading(true);
    try {
      await updatePitch(pitchId, data);

      // Handle archive state if pitch was deactivated
      if (data.isActive === false) {
        await archivePitch(pitchId, false);
      }

      toast({ title: 'Pitch updated', variant: 'success' });
      router.push(`/pitch/${pitchId}`);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message || 'Failed to update pitch', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
        >
          <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">Edit Pitch</h1>
      </div>

      {pitch && (
        <PitchForm
          pitch={pitch}
          onSubmit={handleSubmit as any}
          onCancel={() => router.back()}
          isSubmitting={isLoading}
        />
      )}
    </div>
  );
}
