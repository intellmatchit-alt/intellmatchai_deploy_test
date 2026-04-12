'use client';

import { cn } from '@/lib/utils';
import {
  Dismiss24Regular,
  CheckmarkCircle24Regular,
  Delete24Regular,
  Flag24Regular,
  ArrowCircleRight24Regular,
} from '@fluentui/react-icons';

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onBulkStatus: (status: string) => void;
  onBulkPriority: (priority: string) => void;
  onBulkDelete: () => void;
}

export function BulkActionBar({
  selectedCount,
  onClear,
  onBulkStatus,
  onBulkPriority,
  onBulkDelete,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 bg-th-surface border border-emerald-500/30 rounded-2xl shadow-xl shadow-emerald-500/10 backdrop-blur-xl animate-slide-up">
      <span className="text-xs font-medium text-emerald-400 mr-1">
        {selectedCount} selected
      </span>

      <div className="w-px h-5 bg-th-border" />

      <button
        onClick={() => onBulkStatus('COMPLETED')}
        className="p-1.5 rounded-lg hover:bg-green-500/15 text-green-400 transition-colors"
        title="Mark Complete"
      >
        <CheckmarkCircle24Regular className="w-5 h-5" />
      </button>

      <button
        onClick={() => onBulkStatus('IN_PROGRESS')}
        className="p-1.5 rounded-lg hover:bg-blue-500/15 text-blue-400 transition-colors"
        title="In Progress"
      >
        <ArrowCircleRight24Regular className="w-5 h-5" />
      </button>

      <div className="w-px h-5 bg-th-border" />

      <button
        onClick={onBulkDelete}
        className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors"
        title="Delete"
      >
        <Delete24Regular className="w-5 h-5" />
      </button>

      <div className="w-px h-5 bg-th-border" />

      <button
        onClick={onClear}
        className="p-1.5 rounded-lg hover:bg-th-hover text-white/50 transition-colors"
        title="Clear Selection"
      >
        <Dismiss24Regular className="w-4 h-4" />
      </button>
    </div>
  );
}
