'use client';

/**
 * PNME: Pitch List Page
 * Shows user's pitch decks with status and actions
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DocumentArrowUpRegular,
  DocumentRegular,
  ClockRegular,
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  DeleteRegular,
  ArrowRightRegular,
} from '@fluentui/react-icons';
import { usePitchList } from '@/hooks/pitch/usePitchList';
import { formatDistanceToNow } from 'date-fns';

interface Pitch {
  id: string;
  status: string;
  fileName: string;
  title: string | null;
  companyName: string | null;
  uploadedAt: string;
  processedAt: string | null;
  sectionsCount?: number;
  needsCount?: number;
}

const statusConfig: Record<string, { icon: typeof CheckmarkCircleRegular; color: string; label: string }> = {
  PENDING: { icon: ClockRegular, color: 'text-yellow-400', label: 'Pending' },
  EXTRACTING: { icon: ClockRegular, color: 'text-blue-400', label: 'Extracting' },
  CLASSIFYING: { icon: ClockRegular, color: 'text-blue-400', label: 'Classifying' },
  ANALYZING: { icon: ClockRegular, color: 'text-blue-400', label: 'Analyzing' },
  MATCHING: { icon: ClockRegular, color: 'text-emerald-400', label: 'Matching' },
  GENERATING: { icon: ClockRegular, color: 'text-emerald-400', label: 'Generating' },
  COMPLETED: { icon: CheckmarkCircleRegular, color: 'text-green-400', label: 'Completed' },
  FAILED: { icon: ErrorCircleRegular, color: 'text-red-400', label: 'Failed' },
};

export default function PitchListPage() {
  const router = useRouter();
  const { data, isLoading, error } = usePitchList();
  const [selectedPitch, setSelectedPitch] = useState<string | null>(null);

  const pitches: Pitch[] = data?.pitches || [];

  return (
    <div className="min-h-screen bg-dark-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-th-text">Pitch Deck Analyzer</h1>
          <p className="text-dark-400 mt-1">
            Upload your pitch deck to find the best contacts for each section
          </p>
        </div>
        <Link
          href="/pitch/upload"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-th-text rounded-lg transition-colors"
        >
          <DocumentArrowUpRegular className="w-5 h-5" />
          Upload Pitch
        </Link>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400">Failed to load pitches. Please try again.</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#00d084]/40" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && pitches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <DocumentRegular className="w-16 h-16 text-dark-500 mb-4" />
          <h2 className="text-xl font-semibold text-th-text mb-2">No pitch decks yet</h2>
          <p className="text-dark-400 mb-6 max-w-md">
            Upload your first pitch deck to analyze it and find the best contacts
            for each section of your presentation.
          </p>
          <Link
            href="/pitch/upload"
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-th-text rounded-lg transition-colors"
          >
            <DocumentArrowUpRegular className="w-5 h-5" />
            Upload Your First Pitch
          </Link>
        </div>
      )}

      {/* Pitch List */}
      {!isLoading && pitches.length > 0 && (
        <div className="space-y-4">
          {pitches.map((pitch) => {
            const config = statusConfig[pitch.status] || statusConfig.PENDING;
            const StatusIcon = config.icon;

            return (
              <div
                key={pitch.id}
                className="bg-dark-800 rounded-xl p-4 border border-dark-700 hover:border-dark-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-dark-700 flex items-center justify-center">
                      <DocumentRegular className="w-6 h-6 text-dark-400" />
                    </div>
                    <div>
                      <h3 className="text-th-text font-medium">
                        {pitch.title || pitch.fileName}
                      </h3>
                      {pitch.companyName && (
                        <p className="text-dark-400 text-sm">{pitch.companyName}</p>
                      )}
                      <p className="text-dark-500 text-xs mt-1">
                        Uploaded {formatDistanceToNow(new Date(pitch.uploadedAt))} ago
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Status Badge */}
                    <div className={`flex items-center gap-2 ${config.color}`}>
                      <StatusIcon className="w-5 h-5" />
                      <span className="text-sm">{config.label}</span>
                    </div>

                    {/* Stats */}
                    {pitch.status === 'COMPLETED' && (
                      <div className="flex items-center gap-4 text-dark-400 text-sm">
                        <span>{pitch.sectionsCount || 0} sections</span>
                        <span>{pitch.needsCount || 0} needs</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {pitch.status === 'COMPLETED' ? (
                        <Link
                          href={`/pitch/${pitch.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-th-text text-sm rounded-lg transition-colors"
                        >
                          View Results
                          <ArrowRightRegular className="w-4 h-4" />
                        </Link>
                      ) : pitch.status !== 'FAILED' ? (
                        <Link
                          href={`/pitch/${pitch.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-th-text text-sm rounded-lg transition-colors"
                        >
                          View Progress
                        </Link>
                      ) : (
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
                        >
                          <DeleteRegular className="w-4 h-4" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
