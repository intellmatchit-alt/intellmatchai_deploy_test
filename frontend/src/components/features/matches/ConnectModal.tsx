'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Chat24Regular, Call24Regular, Mail24Regular } from '@fluentui/react-icons';
import { WhatsAppIcon, LinkedInIcon } from './icons';
import { createConversation } from '@/lib/api/messages';
import type { Translations } from '@/lib/i18n/en';

export interface ConnectChannels {
  intellmatchUserId?: string | null;
  phone?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
}

interface ConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  channels: ConnectChannels;
  onConnect: () => void;
  t: Translations;
}

export function ConnectModal({
  open,
  onOpenChange,
  contactName,
  channels,
  onConnect,
  t,
}: ConnectModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const ma = t.matchActions;

  const handleIntellMatch = async () => {
    if (!channels.intellmatchUserId) return;
    setLoading(true);
    try {
      const res = await createConversation(channels.intellmatchUserId);
      onConnect();
      onOpenChange(false);
      router.push(`/messages/${res.id}`);
    } catch {
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleChannel = (url: string) => {
    onConnect();
    onOpenChange(false);
    window.open(url, '_blank');
  };

  const hasAnyChannel =
    channels.intellmatchUserId ||
    channels.phone ||
    channels.email ||
    channels.linkedinUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{ma.connectWith} {contactName}</DialogTitle>
          <DialogDescription>{ma.chooseChannel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-4">
          {channels.intellmatchUserId && (
            <button
              onClick={handleIntellMatch}
              disabled={loading}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
            >
              <Chat24Regular />
              <span className="font-medium">{ma.intellmatchMessage}</span>
            </button>
          )}

          {channels.phone && (
            <>
              <a
                href={`tel:${channels.phone}`}
                onClick={() => { onConnect(); onOpenChange(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
              >
                <Call24Regular />
                <span className="font-medium">{ma.call}</span>
                <span className="text-xs text-th-text-t ml-auto">{channels.phone}</span>
              </a>
              <button
                onClick={() => handleChannel(`https://wa.me/${channels.phone!.replace(/[^0-9]/g, '')}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
              >
                <WhatsAppIcon />
                <span className="font-medium">{ma.whatsapp}</span>
              </button>
            </>
          )}

          {channels.email && (
            <a
              href={`mailto:${channels.email}`}
              onClick={() => { onConnect(); onOpenChange(false); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 transition-colors"
            >
              <Mail24Regular />
              <span className="font-medium">{ma.email}</span>
              <span className="text-xs text-th-text-t ml-auto">{channels.email}</span>
            </a>
          )}

          {channels.linkedinUrl && (
            <button
              onClick={() => handleChannel(channels.linkedinUrl!)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 transition-colors"
            >
              <LinkedInIcon />
              <span className="font-medium">{ma.linkedin}</span>
            </button>
          )}

          {!hasAnyChannel && (
            <p className="text-center text-th-text-t py-4">{ma.noChannelsAvailable}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
