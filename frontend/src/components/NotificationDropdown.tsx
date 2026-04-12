'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useNotificationStore } from '@/stores/notificationStore';
import {
  Alert24Regular,
  Alert24Filled,
  Checkmark24Regular,
  Dismiss24Regular,
  Wallet24Regular,
  ArrowUp24Regular,
  ArrowDown24Regular,
  Warning24Regular,
  Handshake24Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
} from '@fluentui/react-icons';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  type Notification,
} from '@/lib/api/notifications';

export function NotificationDropdown() {
  const { t } = useI18n();
  const { unreadCount, setUnreadCount } = useNotificationStore();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch unread count on mount
  useEffect(() => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }, [setUnreadCount]);

  // Fetch notifications when opened
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getNotifications(1)
        .then((res) => setNotifications(res.notifications))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount(Math.max(0, unreadCount - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  const getNotificationRoute = (n: Notification): string | null => {
    switch (n.type) {
      case 'collaboration_request_received':
      case 'collaboration_request_accepted':
      case 'collaboration_request_rejected':
        return '/collaborations';
      case 'task_assigned':
      case 'task_reminder':
      case 'task_overdue':
        return '/tasks';
      case 'wallet_credit':
      case 'wallet_debit':
      case 'wallet_low_balance':
        return '/wallet';
      default:
        return null;
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.isRead) await handleMarkRead(n.id);
    const route = getNotificationRoute(n);
    if (route) {
      setIsOpen(false);
      router.push(route);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'wallet_credit':
        return <ArrowUp24Regular className="w-4 h-4 text-green-400" />;
      case 'wallet_debit':
        return <ArrowDown24Regular className="w-4 h-4 text-red-400" />;
      case 'wallet_low_balance':
        return <Warning24Regular className="w-4 h-4 text-amber-400" />;
      case 'collaboration_request_received':
        return <Handshake24Regular className="w-4 h-4 text-teal-400" />;
      case 'collaboration_request_accepted':
        return <CheckmarkCircle24Regular className="w-4 h-4 text-green-400" />;
      case 'collaboration_request_rejected':
        return <DismissCircle24Regular className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-th-hover text-th-text-m transition-colors"
      >
        {unreadCount > 0 ? (
          <Alert24Filled className="w-5 h-5 text-emerald-400" />
        ) : (
          <Alert24Regular className="w-5 h-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-[#0d1528] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-th-border">
            <h3 className="text-sm font-semibold text-th-text">
              {(t as any).notifications?.title || 'Notifications'}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                {(t as any).notifications?.markAllRead || 'Mark all as read'}
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-72">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-th-text-m">
                {(t as any).notifications?.noNotifications || 'No notifications'}
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'relative px-4 py-3 border-b border-th-border/50 hover:bg-th-hover transition-colors cursor-pointer',
                    !n.isRead && 'bg-emerald-500/5'
                  )}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-start gap-2">
                    {getNotificationIcon(n.type) && (
                      <div className="mt-0.5 flex-shrink-0">{getNotificationIcon(n.type)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm text-th-text', !n.isRead && 'font-medium')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-th-text-m mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                    <span className="text-[10px] text-th-text-t flex-shrink-0">{formatTime(n.createdAt)}</span>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 bg-emerald-500 rounded-full absolute right-3 top-3" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
