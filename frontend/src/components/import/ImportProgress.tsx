/**
 * Import Progress
 *
 * Displays real-time progress of contact import pipeline.
 * Shows stages, counts, and handles completion/failure states.
 *
 * @module components/import/ImportProgress
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Checkmark24Regular,
  Dismiss24Regular,
  ArrowSync24Regular,
  Clock24Regular,
  Warning24Regular,
  ArrowCounterclockwise24Regular,
  People24Regular,
  Merge24Regular,
  Sparkle24Regular,
  Tag24Regular,
  TextDescription24Regular,
  Link24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '@/lib/i18n';
import { getBatchStatus, rollbackBatch, type BatchStatusResponse } from '@/lib/api/import';

interface ImportProgressProps {
  batchId: string;
  onComplete: () => void;
}

interface Stage {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const STAGES: Stage[] = [
  { name: 'normalize', icon: ArrowSync24Regular, label: 'Normalizing' },
  { name: 'dedupe', icon: Merge24Regular, label: 'Deduplicating' },
  { name: 'enrich', icon: Sparkle24Regular, label: 'Enriching' },
  { name: 'tag', icon: Tag24Regular, label: 'Extracting Tags' },
  { name: 'summary', icon: TextDescription24Regular, label: 'Building Summaries' },
  { name: 'match', icon: Link24Regular, label: 'Matching' },
];

const POLL_INTERVAL = 2000; // 2 seconds

export default function ImportProgress({ batchId, onComplete }: ImportProgressProps) {
  const { t } = useI18n();

  const [status, setStatus] = useState<BatchStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Poll for status
  const fetchStatus = useCallback(async () => {
    try {
      const result = await getBatchStatus(batchId);
      setStatus(result);

      // Check if completed or failed
      if (result.batch.status === 'COMPLETED') {
        onComplete();
      } else if (result.batch.status === 'FAILED') {
        setError(result.batch.errorMessage || 'Import failed');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to get status');
    }
  }, [batchId, onComplete]);

  // Initial fetch and polling
  useEffect(() => {
    fetchStatus();

    const interval = setInterval(() => {
      if (status?.batch?.status === 'PROCESSING' || status?.batch?.status === 'PENDING') {
        fetchStatus();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchStatus, status?.batch?.status]);

  // Handle rollback
  const handleRollback = async () => {
    if (!confirm(t.import?.rollbackConfirm || 'Are you sure you want to undo this import? All imported contacts will be deleted.')) {
      return;
    }

    setIsRollingBack(true);
    try {
      await rollbackBatch(batchId);
      // Refresh status
      await fetchStatus();
    } catch (err) {
      setError((err as Error).message || 'Failed to rollback');
    } finally {
      setIsRollingBack(false);
    }
  };

  // Get stage status
  const getStageStatus = (stageName: string) => {
    const stageInfo = status?.stages?.find(s => s.name === stageName);
    return stageInfo?.status || 'pending';
  };

  // Get stage progress
  const getStageProgress = (stageName: string) => {
    const stageInfo = status?.stages?.find(s => s.name === stageName);
    return stageInfo?.progress || 0;
  };

  // Get stage label from translations
  const getStageLabel = (stageName: string, defaultLabel: string) => {
    const stageLabels: Record<string, string | undefined> = {
      normalize: t.import?.['stages.normalize'],
      dedupe: t.import?.['stages.dedupe'],
      enrich: t.import?.['stages.enrich'],
      tag: t.import?.['stages.tag'],
      summary: t.import?.['stages.summary'],
      match: t.import?.['stages.match'],
    };
    return stageLabels[stageName] || defaultLabel;
  };

  // Render stage icon
  const renderStageIcon = (stage: Stage) => {
    const stageStatus = getStageStatus(stage.name);
    const Icon = stage.icon;

    switch (stageStatus) {
      case 'completed':
        return (
          <div className="w-8 h-8 bg-accent-green/20 rounded-full flex items-center justify-center">
            <Checkmark24Regular className="w-4 h-4 text-accent-green" />
          </div>
        );
      case 'processing':
        return (
          <div className="w-8 h-8 bg-accent-blue/20 rounded-full flex items-center justify-center">
            <Icon className="w-4 h-4 text-accent-blue animate-spin" />
          </div>
        );
      case 'failed':
        return (
          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
            <Dismiss24Regular className="w-4 h-4 text-red-400" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center">
            <Clock24Regular className="w-4 h-4 text-dark-400" />
          </div>
        );
    }
  };

  if (!status || !status.batch) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowSync24Regular className="w-8 h-8 text-accent-blue animate-spin" />
      </div>
    );
  }

  const batch = status.batch;
  const isCompleted = batch.status === 'COMPLETED';
  const isFailed = batch.status === 'FAILED';
  const isRolledBack = batch.status === 'ROLLED_BACK';

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-dark-400">
            {t.import?.overallProgress || 'Overall Progress'}
          </span>
          <span className="text-sm text-th-text font-medium">
            {batch.overallProgress}%
          </span>
        </div>
        <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`
              h-full transition-all duration-500
              ${isFailed ? 'bg-red-500' : isCompleted ? 'bg-accent-green' : 'bg-accent-blue'}
            `}
            style={{ width: `${batch.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="p-3 border-b border-dark-700">
          <span className="text-sm text-dark-400">
            {t.import?.stages || 'Processing Stages'}
          </span>
        </div>
        <div className="divide-y divide-dark-700">
          {STAGES.map((stage) => {
            const stageStatus = getStageStatus(stage.name);
            const progress = getStageProgress(stage.name);

            return (
              <div key={stage.name} className="p-3 flex items-center gap-3">
                {renderStageIcon(stage)}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${stageStatus === 'pending' ? 'text-dark-400' : 'text-th-text'}`}>
                    {getStageLabel(stage.name, stage.label)}
                  </p>
                  {stageStatus === 'processing' && (
                    <div className="mt-1 h-1 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-blue transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {stageStatus === 'completed' && (
                  <span className="text-xs text-accent-green">Done</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={People24Regular}
          label={t.import?.stats?.imported || 'Imported'}
          value={batch.totalImported}
          color="blue"
        />
        <StatCard
          icon={Merge24Regular}
          label={t.import?.stats?.duplicates || 'Merged'}
          value={batch.duplicatesMerged}
          color="purple"
        />
        <StatCard
          icon={Tag24Regular}
          label={t.import?.stats?.tagged || 'Tagged'}
          value={batch.taggedCount}
          color="yellow"
        />
        <StatCard
          icon={Link24Regular}
          label={t.import?.stats?.matched || 'Matched'}
          value={batch.matchedCount}
          color="green"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <Warning24Regular className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400 font-medium">
              {t.import?.error || 'Import Error'}
            </p>
            <p className="text-sm text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Rolled Back Message */}
      {isRolledBack && (
        <div className="flex items-center gap-3 p-4 bg-dark-800 border border-dark-700 rounded-lg">
          <ArrowCounterclockwise24Regular className="w-5 h-5 text-dark-400" />
          <span className="text-sm text-dark-300">
            {t.import?.rolledBack || 'This import has been rolled back. Contacts were not added.'}
          </span>
        </div>
      )}

      {/* Rollback Button (only show when completed) */}
      {isCompleted && !isRolledBack && (
        <button
          onClick={handleRollback}
          disabled={isRollingBack}
          className="w-full px-4 py-3 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 hover:text-th-text transition-colors flex items-center justify-center gap-2"
        >
          {isRollingBack ? (
            <>
              <ArrowSync24Regular className="w-5 h-5 animate-spin" />
              {t.import?.rollingBack || 'Rolling back...'}
            </>
          ) : (
            <>
              <ArrowCounterclockwise24Regular className="w-5 h-5" />
              {t.import?.undoImport || 'Undo Import'}
            </>
          )}
        </button>
      )}

      {/* Current Stage Indicator */}
      {batch.currentStage && batch.status === 'PROCESSING' && (
        <div className="text-center">
          <p className="text-sm text-dark-400">
            {t.import?.currentlyProcessing || 'Currently processing:'}{' '}
            <span className="text-accent-blue">
              {getStageLabel(batch.currentStage, batch.currentStage)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

// Stat card component
interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: 'blue' | 'purple' | 'yellow' | 'green';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-accent-blue/10 text-accent-blue',
    purple: 'bg-emerald-500/10 text-emerald-500',
    yellow: 'bg-accent-yellow/10 text-accent-yellow',
    green: 'bg-accent-green/10 text-accent-green',
  };

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-th-text">{value}</p>
          <p className="text-xs text-dark-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
