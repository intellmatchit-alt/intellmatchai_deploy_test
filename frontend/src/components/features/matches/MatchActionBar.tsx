'use client';

import { useState } from 'react';
import { ConnectModal, type ConnectChannels } from './ConnectModal';
import { PersonAvailable24Regular, Dismiss24Regular, ArrowUndo24Regular } from '@fluentui/react-icons';
import { Archive24Regular } from '@fluentui/react-icons';
import type { Translations } from '@/lib/i18n/en';

interface MatchActionBarProps {
  currentStatus: string;
  contactName: string;
  channels: ConnectChannels;
  onStatusChange: (status: string) => void;
  isUpdating?: boolean;
  dismissStatus?: string; // 'DISMISSED' for projects/opportunities, 'IGNORED' for pitch/deals
  t: Translations;
}

const TERMINAL_STATUSES = ['DISMISSED', 'IGNORED', 'ARCHIVED', 'CONTACTED', 'CONNECTED'];

export function MatchActionBar({
  currentStatus,
  contactName,
  channels,
  onStatusChange,
  isUpdating = false,
  dismissStatus = 'DISMISSED',
  t,
}: MatchActionBarProps) {
  const [connectOpen, setConnectOpen] = useState(false);
  const ma = t.matchActions;

  const isTerminal = TERMINAL_STATUSES.includes(currentStatus);

  const isRestorable = ['DISMISSED', 'IGNORED', 'ARCHIVED'].includes(currentStatus);

  if (isTerminal) {
    const labelMap: Record<string, string> = {
      DISMISSED: ma.dismissed,
      IGNORED: ma.dismissed,
      ARCHIVED: ma.archived,
      CONTACTED: ma.contacted,
      CONNECTED: ma.connected,
    };
    const colorMap: Record<string, string> = {
      DISMISSED: 'bg-red-400 text-[#042820]',
      IGNORED: 'bg-red-400 text-[#042820]',
      ARCHIVED: 'bg-emerald-400 text-[#042820]',
      CONTACTED: 'bg-green-400 text-[#042820]',
      CONNECTED: 'bg-green-400 text-[#042820]',
    };
    return (
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${colorMap[currentStatus] || 'bg-th-surface-h text-[#042820]'}`}>
          {labelMap[currentStatus] || currentStatus}
        </span>
        {isRestorable && (
          <button
            onClick={() => onStatusChange('ACTIVE')}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-400 text-[#042820] hover:bg-green-500 transition-colors disabled:opacity-50"
          >
            <ArrowUndo24Regular className="w-4 h-4" />
            {ma.restore || 'Restore'}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setConnectOpen(true)}
          disabled={isUpdating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-400 text-[#042820] hover:bg-emerald-500 transition-colors disabled:opacity-50"
        >
          <PersonAvailable24Regular className="w-4 h-4" />
          {ma.connect}
        </button>

        <button
          onClick={() => onStatusChange(dismissStatus)}
          disabled={isUpdating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-400 text-[#042820] hover:bg-red-500 transition-colors disabled:opacity-50"
        >
          <Dismiss24Regular className="w-4 h-4" />
          {ma.dismiss}
        </button>

        <button
          onClick={() => onStatusChange('ARCHIVED')}
          disabled={isUpdating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-400 text-[#042820] hover:bg-emerald-500 transition-colors disabled:opacity-50"
        >
          <Archive24Regular className="w-4 h-4" />
          {ma.archive}
        </button>
      </div>

      <ConnectModal
        open={connectOpen}
        onOpenChange={setConnectOpen}
        contactName={contactName}
        channels={channels}
        onConnect={() => onStatusChange('CONTACTED')}
        t={t}
      />
    </>
  );
}
