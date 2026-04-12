'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  Dismiss24Regular,
  Copy24Regular,
  Delete24Regular,
  Link24Regular,
  Mail24Regular,
  Person24Regular,
} from '@fluentui/react-icons';
import {
  shareTask,
  revokeTaskShare,
  getTaskShares,
  type TaskShare,
} from '@/lib/api/tasks';

interface ShareTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
}

export function ShareTaskModal({ isOpen, onClose, taskId, taskTitle }: ShareTaskModalProps) {
  const { t } = useI18n();
  const [shares, setShares] = useState<TaskShare[]>([]);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [loading, setLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (isOpen && taskId) {
      getTaskShares(taskId).then(setShares).catch(() => {});
    }
  }, [isOpen, taskId]);

  const handleShareViaEmail = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const share = await shareTask(taskId, { email: email.trim(), permission });
      setShares((prev) => [share, ...prev]);
      setEmail('');
    } catch (e) {
      console.error('Failed to share', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    try {
      const share = await shareTask(taskId, { permission });
      setShares((prev) => [share, ...prev]);
      if (share.shareToken) {
        const url = `${window.location.origin}/shared/task/${share.shareToken}`;
        await navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    } catch (e) {
      console.error('Failed to generate link', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await revokeTaskShare(taskId, shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (e) {
      console.error('Failed to revoke', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-th-surface border border-th-border rounded-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-th-border">
          <h2 className="text-lg font-semibold text-white">
            {(t as any).tasksPage?.menu?.share || 'Share'}: {taskTitle}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-th-hover text-white/50">
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Permission toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setPermission('VIEW')}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all',
                permission === 'VIEW'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'border-th-border text-white/50'
              )}
            >
              {(t as any).tasksPage?.viewOnly || 'View only'}
            </button>
            <button
              onClick={() => setPermission('EDIT')}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all',
                permission === 'EDIT'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'border-th-border text-white/50'
              )}
            >
              {(t as any).tasksPage?.canEdit || 'Can edit'}
            </button>
          </div>

          {/* Share via email */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Mail24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={(t as any).tasksPage?.shareViaEmail || 'Share via email'}
                className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-th-border rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                onKeyDown={(e) => e.key === 'Enter' && handleShareViaEmail()}
              />
            </div>
            <button
              onClick={handleShareViaEmail}
              disabled={!email.trim() || loading}
              className="px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              Share
            </button>
          </div>

          {/* Generate link */}
          <button
            onClick={handleGenerateLink}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-th-border rounded-xl text-white hover:bg-th-hover transition-colors disabled:opacity-50"
          >
            <Link24Regular className="w-4 h-4" />
            {linkCopied
              ? ((t as any).tasksPage?.linkCopied || 'Link copied!')
              : ((t as any).tasksPage?.generateLink || 'Generate link')}
          </button>

          {/* Existing shares */}
          {shares.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/50 font-medium">Shared with</p>
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03] border border-th-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Person24Regular className="w-4 h-4 text-white/50 flex-shrink-0" />
                    <span className="text-sm text-white truncate">
                      {share.sharedWith?.fullName || share.sharedEmail || 'Public link'}
                    </span>
                    <span className="text-[10px] text-white/60">{share.permission}</span>
                  </div>
                  <button
                    onClick={() => handleRevoke(share.id)}
                    className="p-1 text-red-400 hover:bg-red-500/10 rounded-lg"
                  >
                    <Delete24Regular className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
