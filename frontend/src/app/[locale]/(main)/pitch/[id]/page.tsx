'use client';

/**
 * PNME: Pitch Results Page
 * Shows pitch analysis results with sections and matches
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  DocumentRegular,
  PersonRegular,
  ChevronRightRegular,
  BookmarkRegular,
  BookmarkAddRegular,
  DismissCircleRegular,
  MailRegular,
  CheckmarkCircleRegular,
} from '@fluentui/react-icons';
import { usePitchStatus } from '@/hooks/pitch/usePitchStatus';
import { usePitchResults } from '@/hooks/pitch/usePitchResults';
import { PitchProgress } from '@/components/pitch/PitchProgress';
import { PitchSectionList } from '@/components/pitch/PitchSectionList';
import { PitchMatchList } from '@/components/pitch/PitchMatchList';
import { OutreachModal } from '@/components/pitch/OutreachModal';
import CollaborateButton from '@/components/features/collaboration/CollaborateButton';

export default function PitchResultsPage() {
  const params = useParams();
  const pitchId = params.id as string;

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [outreachModal, setOutreachModal] = useState<{
    isOpen: boolean;
    matchId: string | null;
    contactId: string | null;
    contactName: string;
    outreachDraft: string;
  }>({
    isOpen: false,
    matchId: null,
    contactId: null,
    contactName: '',
    outreachDraft: '',
  });

  // Fetch pitch status (for progress)
  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
  } = usePitchStatus(pitchId, {
    // Poll every 2s while processing
    refetchInterval: (data) => {
      if (!data?.state?.data) return 2000;
      if (data.state.data.status === 'COMPLETED' || data.state.data.status === 'FAILED') return false;
      return 2000;
    },
  });

  // Fetch results (only when completed)
  const {
    data: resultsData,
    isLoading: resultsLoading,
    error: resultsError,
  } = usePitchResults(pitchId, {
    enabled: statusData?.status === 'COMPLETED',
  });

  // Select first section by default
  useEffect(() => {
    if (resultsData?.sections?.length && !selectedSectionId) {
      setSelectedSectionId(resultsData.sections[0].id);
    }
  }, [resultsData, selectedSectionId]);

  const isProcessing = statusData && !['COMPLETED', 'FAILED'].includes(statusData.status);
  const isCompleted = statusData?.status === 'COMPLETED';
  const isFailed = statusData?.status === 'FAILED';

  const selectedSection = resultsData?.sections?.find((s) => s.id === selectedSectionId);

  const openOutreachModal = (matchId: string, contactId: string, contactName: string, outreachDraft: string) => {
    setOutreachModal({
      isOpen: true,
      matchId,
      contactId,
      contactName,
      outreachDraft,
    });
  };

  const closeOutreachModal = () => {
    setOutreachModal({
      isOpen: false,
      matchId: null,
      contactId: null,
      contactName: '',
      outreachDraft: '',
    });
  };

  // Loading state
  if (statusLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#00d084]/40" />
      </div>
    );
  }

  // Error state
  if (statusError) {
    return (
      <div className="min-h-screen bg-dark-900 p-6">
        <div className="max-w-2xl mx-auto bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <h2 className="text-red-400 font-medium mb-2">Error loading pitch</h2>
          <p className="text-red-400/70">
            {(statusError as any).message || 'Failed to load pitch. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <div className="border-b border-dark-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-th-text">
              {statusData?.title || statusData?.fileName || 'Pitch Analysis'}
            </h1>
            {statusData?.companyName && (
              <p className="text-dark-400">{statusData.companyName}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isCompleted && resultsData?.summary && (
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-th-text">{resultsData.summary.totalMatches}</p>
                  <p className="text-dark-400">Matches</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-400">{resultsData.summary.avgScore}</p>
                  <p className="text-dark-400">Avg Score</p>
                </div>
              </div>
            )}
            <CollaborateButton
              sourceType="PITCH"
              sourceId={pitchId}
              sourceTitle={statusData?.title || statusData?.fileName || 'Pitch'}
              variant="secondary"
              size="md"
            />
          </div>
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && statusData?.progress && (
        <div className="p-6">
          <PitchProgress progress={statusData.progress} />
        </div>
      )}

      {/* Failed State */}
      {isFailed && (
        <div className="p-6">
          <div className="max-w-2xl mx-auto bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <h2 className="text-red-400 font-medium mb-2">Processing failed</h2>
            <p className="text-red-400/70">
              We couldn't process your pitch deck. Please try uploading again.
            </p>
          </div>
        </div>
      )}

      {/* Results View */}
      {isCompleted && resultsData && (
        <div className="flex h-[calc(100vh-140px)]">
          {/* Left Panel: Sections */}
          <div className="w-80 border-r border-dark-700 overflow-y-auto">
            <PitchSectionList
              sections={resultsData.sections}
              selectedId={selectedSectionId}
              onSelect={setSelectedSectionId}
            />
          </div>

          {/* Right Panel: Matches */}
          <div className="flex-1 overflow-y-auto">
            {selectedSection ? (
              <PitchMatchList
                section={selectedSection}
                onOpenOutreach={openOutreachModal}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-dark-400">
                Select a section to view matches
              </div>
            )}
          </div>
        </div>
      )}

      {/* Outreach Modal */}
      <OutreachModal
        isOpen={outreachModal.isOpen}
        onClose={closeOutreachModal}
        matchId={outreachModal.matchId}
        pitchId={pitchId}
        sectionId={selectedSectionId}
        contactId={outreachModal.contactId}
        contactName={outreachModal.contactName}
        outreachDraft={outreachModal.outreachDraft}
      />
    </div>
  );
}
