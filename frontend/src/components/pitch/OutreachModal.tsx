'use client';

/**
 * PNME Component: Outreach Modal
 * Modal for viewing and editing outreach messages
 */

import { useState, useEffect } from 'react';
import {
  DismissRegular,
  CopyRegular,
  CheckmarkRegular,
  ArrowSyncRegular,
  SendRegular,
} from '@fluentui/react-icons';
import { useUpdateMatchStatus } from '@/hooks/pitch/useUpdateMatchStatus';
import { regenerateOutreach } from '@/lib/api/pitch';

interface OutreachModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string | null;
  pitchId: string;
  sectionId: string | null;
  contactId: string | null;
  contactName: string;
  outreachDraft: string;
}

export function OutreachModal({
  isOpen,
  onClose,
  matchId,
  pitchId,
  sectionId,
  contactId,
  contactName,
  outreachDraft,
}: OutreachModalProps) {
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'professional' | 'casual' | 'warm'>('professional');
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateMatchStatus();

  // Reset message when modal opens
  useEffect(() => {
    if (isOpen) {
      setMessage(outreachDraft);
      setCopied(false);
    }
  }, [isOpen, outreachDraft]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleRegenerate = async () => {
    if (!pitchId || !sectionId || !contactId) return;
    setIsRegenerating(true);
    try {
      const result = await regenerateOutreach(pitchId, sectionId, contactId, { tone });
      setMessage(result.outreachDraft);
    } catch (error) {
      console.error('Failed to regenerate outreach:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleMarkContacted = () => {
    if (!matchId) return;
    updateStatus(
      { matchId, status: 'CONTACTED', outreachEdited: message },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-dark-800 rounded-xl border border-dark-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <h2 className="text-th-text font-medium">
            Outreach to {contactName}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-th-text transition-colors"
          >
            <DismissRegular className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Tone Selector */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-dark-400 text-sm">Tone:</span>
            {(['professional', 'casual', 'warm'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors capitalize ${
                  tone === t
                    ? 'bg-primary-600 text-th-text'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm text-dark-300 hover:text-th-text transition-colors"
            >
              <ArrowSyncRegular className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          </div>

          {/* Message Editor */}
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your outreach message..."
              className="w-full h-64 px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-th-text placeholder-dark-500 focus:outline-none focus:border-[#00d084]/50 resize-none"
            />
            <div className="absolute bottom-3 right-3 text-dark-500 text-xs">
              {message.length} characters
            </div>
          </div>

          {/* Tips */}
          <div className="mt-4 p-3 bg-dark-700/50 rounded-lg">
            <p className="text-dark-400 text-sm">
              <strong className="text-dark-300">Tip:</strong> Personalize the message by
              referencing specific details about the contact's background or your shared
              connections.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-dark-700">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 text-dark-300 hover:text-th-text transition-colors"
          >
            {copied ? (
              <>
                <CheckmarkRegular className="w-5 h-5 text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <CopyRegular className="w-5 h-5" />
                Copy to Clipboard
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-dark-300 hover:text-th-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMarkContacted}
              disabled={isUpdating}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-th-text rounded-lg transition-colors"
            >
              {isUpdating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
              ) : (
                <SendRegular className="w-4 h-4" />
              )}
              Mark as Contacted
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
