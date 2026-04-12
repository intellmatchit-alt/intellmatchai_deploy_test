'use client';

import { useState } from 'react';
import {
  Dismiss24Regular,
  Mail24Regular,
  Phone24Regular,
  Send24Regular,
  Checkmark24Regular,
  ErrorCircle24Regular,
} from '@fluentui/react-icons';
import { useLanguage } from '@/hooks/useLanguage';

interface InviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contact: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
  };
  onSuccess?: () => void;
}

type InviteMethod = 'email' | 'sms';

export function InviteDialog({ isOpen, onClose, contact, onSuccess }: InviteDialogProps) {
  const { t } = useLanguage();
  const [method, setMethod] = useState<InviteMethod>(contact.email ? 'email' : 'sms');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSendEmail = !!contact.email;
  const canSendSms = !!contact.phone;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/contacts/${contact.id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          method,
          message: message || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error?.message || t.invitation?.sendFailed || 'Failed to send invitation');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch {
      setError(t.invitation?.sendFailed || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-th-border bg-th-bg-s p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-th-text">
            {t.invitation?.title || 'Invite to IntellMatch'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-th-text-t transition-colors hover:bg-th-surface-h hover:text-th-text"
          >
            <Dismiss24Regular />
          </button>
        </div>

        {success ? (
          // Success state
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <Checkmark24Regular className="h-8 w-8 text-green-400" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-th-text">
              {t.invitation?.sent || 'Invitation Sent!'}
            </h3>
            <p className="text-th-text-t">
              {t.invitation?.sentDescription?.replace('{name}', contact.fullName) ||
                `${contact.fullName} will receive an invitation to join IntellMatch.`}
            </p>
          </div>
        ) : (
          <>
            {/* Contact info */}
            <div className="mb-6 rounded-xl bg-th-surface p-4">
              <p className="text-sm text-th-text-t">
                {t.invitation?.inviting || 'Inviting'}
              </p>
              <p className="text-lg font-medium text-th-text">{contact.fullName}</p>
              {contact.email && (
                <p className="text-sm text-th-text-t">{contact.email}</p>
              )}
            </div>

            {/* Method selection */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-th-text-s">
                {t.invitation?.sendVia || 'Send invitation via'}
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setMethod('email')}
                  disabled={!canSendEmail}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 transition-colors ${
                    method === 'email'
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                      : canSendEmail
                        ? 'bg-th-surface text-th-text-t hover:bg-th-surface-h'
                        : 'cursor-not-allowed bg-th-surface text-white/70'
                  }`}
                >
                  <Mail24Regular />
                  <span>{t.invitation?.email || 'Email'}</span>
                </button>
                <button
                  onClick={() => setMethod('sms')}
                  disabled={!canSendSms}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 transition-colors ${
                    method === 'sms'
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                      : canSendSms
                        ? 'bg-th-surface text-th-text-t hover:bg-th-surface-h'
                        : 'cursor-not-allowed bg-th-surface text-white/70'
                  }`}
                >
                  <Phone24Regular />
                  <span>{t.invitation?.sms || 'SMS'}</span>
                </button>
              </div>
              {!canSendEmail && !canSendSms && (
                <p className="mt-2 text-sm text-red-400">
                  {t.invitation?.noContactInfo || 'Contact has no email or phone number'}
                </p>
              )}
            </div>

            {/* Personal message */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-th-text-s">
                {t.invitation?.personalMessage || 'Personal message (optional)'}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.invitation?.messagePlaceholder || 'Add a personal note to your invitation...'}
                rows={3}
                className="w-full resize-none rounded-xl border border-th-border bg-th-surface px-4 py-3 text-th-text placeholder-th-text-m focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-red-400">
                <ErrorCircle24Regular className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-th-surface-h px-4 py-3 font-medium text-th-text transition-colors hover:bg-th-surface-h"
              >
                {t.common?.cancel || 'Cancel'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || (!canSendEmail && !canSendSms)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Send24Regular className="h-5 w-5" />
                    <span>{t.invitation?.send || 'Send Invitation'}</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default InviteDialog;
