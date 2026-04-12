/**
 * SendInvitationModal Component
 *
 * Modal for collaborators to send WhatsApp/Email invitations
 * to matched contacts.
 */

'use client';

import { useState } from 'react';
import {
  Dismiss24Regular,
  Mail24Regular,
  Phone24Regular,
  Send24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/Toast';
import {
  sendInvitation,
  InvitationChannel,
  CollaborationMatchResult,
} from '@/lib/api/collaboration';

interface SendInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  collaborationRequestId: string;
  matchResult?: CollaborationMatchResult;
  recipientName?: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
}

export default function SendInvitationModal({
  isOpen,
  onClose,
  onSuccess,
  collaborationRequestId,
  matchResult,
  recipientName = '',
  recipientEmail,
  recipientPhone,
}: SendInvitationModalProps) {
  const { t, isRTL } = useI18n();
  const [isSending, setIsSending] = useState(false);
  const [channel, setChannel] = useState<InvitationChannel>(
    recipientEmail ? 'EMAIL' : recipientPhone ? 'WHATSAPP' : 'EMAIL'
  );
  const [name, setName] = useState(recipientName);
  const [email, setEmail] = useState(recipientEmail || '');
  const [phone, setPhone] = useState(recipientPhone || '');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSend = async () => {
    // Validate
    if (!name.trim()) {
      toast.error('Please enter the recipient name');
      return;
    }
    if (channel === 'EMAIL' && !email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    if ((channel === 'WHATSAPP' || channel === 'SMS') && !phone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setIsSending(true);
    try {
      const result = await sendInvitation(collaborationRequestId, {
        matchResultId: matchResult?.id,
        recipientName: name.trim(),
        recipientEmail: channel === 'EMAIL' ? email.trim() : undefined,
        recipientPhone: channel === 'WHATSAPP' || channel === 'SMS' ? phone.trim() : undefined,
        channel,
        message: message.trim() || undefined,
      });

      if (result.success) {
        toast.success(`Invitation sent via ${channel === 'EMAIL' ? 'Email' : 'WhatsApp'}`);
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to send invitation');
      }
    } catch (error: any) {
      console.error('Failed to send invitation:', error);
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setIsSending(false);
    }
  };

  const channelOptions: { id: InvitationChannel; label: string; icon: React.ReactNode; disabled: boolean }[] = [
    {
      id: 'EMAIL',
      label: 'Email',
      icon: <Mail24Regular className="w-5 h-5" />,
      disabled: false,
    },
    {
      id: 'WHATSAPP',
      label: 'WhatsApp',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
      disabled: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md mx-4 bg-th-bg-s rounded-xl shadow-xl border border-th-border"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-th-border">
          <div>
            <h2 className="text-lg font-semibold text-th-text">Send Invitation</h2>
            <p className="text-sm text-th-text-t">
              Invite this person to join as a collaborator
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-th-bg-t rounded-lg transition-colors"
          >
            <Dismiss24Regular className="w-5 h-5 text-th-text-t" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Channel Selection */}
          <div>
            <label className="block text-sm font-medium text-th-text-t mb-2">
              Send via
            </label>
            <div className="flex gap-2">
              {channelOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setChannel(option.id)}
                  disabled={option.disabled}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    channel === option.id
                      ? 'bg-[#00d084]/50/20 text-primary-400 border-2 border-[#00d084]/40'
                      : 'bg-th-bg-t text-th-text-s border-2 border-transparent hover:bg-neutral-700'
                  } ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {option.icon}
                  <span>{option.label}</span>
                  {channel === option.id && (
                    <Checkmark24Regular className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient Name */}
          <div>
            <label className="block text-sm font-medium text-th-text-t mb-2">
              Recipient Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
              className="w-full px-3 py-2 bg-th-bg-t border border-neutral-700 rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-[#00d084]/40 focus:border-transparent"
            />
          </div>

          {/* Email or Phone based on channel */}
          {channel === 'EMAIL' ? (
            <div>
              <label className="block text-sm font-medium text-th-text-t mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-10 pr-4 py-2 bg-th-bg-t border border-neutral-700 rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-[#00d084]/40 focus:border-transparent"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-th-text-t mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full pl-10 pr-4 py-2 bg-th-bg-t border border-neutral-700 rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-[#00d084]/40 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Personal Message */}
          <div>
            <label className="block text-sm font-medium text-th-text-t mb-2">
              Personal Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message to the invitation..."
              rows={3}
              className="w-full px-3 py-2 bg-th-bg-t border border-neutral-700 rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-[#00d084]/40 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-th-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-th-text-t hover:text-th-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="px-4 py-2 bg-[#00d084]/50 hover:bg-[#00b870] disabled:bg-neutral-700 text-th-text rounded-lg transition-colors inline-flex items-center gap-2"
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send24Regular className="w-4 h-4" />
                Send Invitation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
