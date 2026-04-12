/**
 * Connection Status Component
 *
 * Displays real-time WebSocket connection status.
 */

'use client';

import { useState, useEffect } from 'react';
import { useWebSocket, ConnectionStatus as Status } from '@/hooks/useWebSocket';
import {
  PlugConnected24Regular,
  PlugDisconnected24Regular,
  ArrowSync24Regular,
  Warning24Regular,
} from '@fluentui/react-icons';

interface ConnectionStatusProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function ConnectionStatus({
  showLabel = false,
  size = 'sm',
  className = '',
}: ConnectionStatusProps) {
  const { status, isConnected } = useWebSocket();
  const [isVisible, setIsVisible] = useState(false);

  // Show status briefly when it changes
  useEffect(() => {
    if (status !== 'connected') {
      setIsVisible(true);
    } else {
      // Hide after brief success indication
      const timer = setTimeout(() => setIsVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const dotSizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  const statusConfig: Record<Status, {
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    label: string;
    pulse?: boolean;
  }> = {
    connecting: {
      icon: <ArrowSync24Regular className={`${sizeClasses[size]} animate-spin`} />,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400',
      label: 'Connecting...',
      pulse: true,
    },
    connected: {
      icon: <PlugConnected24Regular className={sizeClasses[size]} />,
      color: 'text-green-400',
      bgColor: 'bg-green-400',
      label: 'Connected',
    },
    disconnected: {
      icon: <PlugDisconnected24Regular className={sizeClasses[size]} />,
      color: 'text-th-text-m',
      bgColor: 'bg-white/[0.03]0',
      label: 'Disconnected',
    },
    error: {
      icon: <Warning24Regular className={sizeClasses[size]} />,
      color: 'text-red-400',
      bgColor: 'bg-red-400',
      label: 'Connection Error',
      pulse: true,
    },
  };

  const config = statusConfig[status];

  // Simple dot indicator (always visible)
  if (!showLabel && !isVisible) {
    return (
      <div className={`relative ${className}`} title={config.label}>
        <div className={`${dotSizeClasses[size]} rounded-full ${config.bgColor} ${config.pulse ? 'animate-pulse' : ''}`} />
      </div>
    );
  }

  // Full status indicator
  return (
    <div
      className={`flex items-center gap-2 ${config.color} ${className}`}
      title={config.label}
    >
      {config.icon}
      {showLabel && (
        <span className="text-sm font-medium">{config.label}</span>
      )}
    </div>
  );
}

/**
 * Connection Status Toast
 *
 * Shows a toast notification when connection status changes.
 */
export function ConnectionStatusToast() {
  const { status } = useWebSocket();
  const [show, setShow] = useState(false);
  const [lastStatus, setLastStatus] = useState<Status>('disconnected');

  useEffect(() => {
    if (status !== lastStatus) {
      // Don't show toast for initial connection
      if (lastStatus !== 'disconnected' || status === 'error') {
        setShow(true);
        const timer = setTimeout(() => setShow(false), 3000);
        return () => clearTimeout(timer);
      }
      setLastStatus(status);
    }
  }, [status, lastStatus]);

  if (!show) return null;

  const messages: Record<Status, { text: string; color: string }> = {
    connecting: { text: 'Reconnecting to server...', color: 'bg-yellow-500/90' },
    connected: { text: 'Connected to server', color: 'bg-green-500/90' },
    disconnected: { text: 'Disconnected from server', color: 'bg-white/[0.03]0/90' },
    error: { text: 'Connection error', color: 'bg-red-500/90' },
  };

  const message = messages[status];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className={`px-4 py-2 rounded-full ${message.color} text-th-text text-sm font-medium shadow-lg backdrop-blur-sm`}>
        {message.text}
      </div>
    </div>
  );
}

/**
 * Notification types
 */
interface Notification {
  id: string;
  type: 'match' | 'suggestion' | 'enrichment';
  title: string;
  message: string;
  contactId?: string;
  timestamp: Date;
}

/**
 * Real-time Notifications Component
 *
 * Shows notifications for match updates, suggestions, and enrichment events.
 */
export function RealTimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const { subscribeToMatches } = useWebSocket({
    onMatchUpdate: (event) => {
      const notification: Notification = {
        id: `match-${event.contactId}-${Date.now()}`,
        type: 'match',
        title: 'Match Score Updated',
        message: `Match score updated to ${event.score}%`,
        contactId: event.contactId,
        timestamp: new Date(event.timestamp),
      };
      setNotifications((prev) => [notification, ...prev.slice(0, 4)]);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      }, 5000);
    },
    onSuggestionReady: (event) => {
      const notification: Notification = {
        id: `suggestion-${event.contactId}-${Date.now()}`,
        type: 'suggestion',
        title: 'New Suggestions Available',
        message: 'New connection suggestions are ready',
        contactId: event.contactId,
        timestamp: new Date(event.timestamp),
      };
      setNotifications((prev) => [notification, ...prev.slice(0, 4)]);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      }, 5000);
    },
    onEnrichmentComplete: (event) => {
      if (event.success) {
        const notification: Notification = {
          id: `enrichment-${event.contactId}-${Date.now()}`,
          type: 'enrichment',
          title: 'Contact Enriched',
          message: 'Contact data has been enriched with additional information',
          contactId: event.contactId,
          timestamp: new Date(event.timestamp),
        };
        setNotifications((prev) => [notification, ...prev.slice(0, 4)]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
        }, 5000);
      }
    },
  });

  // Subscribe to matches on mount
  useEffect(() => {
    subscribeToMatches();
  }, [subscribeToMatches]);

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'match':
        return 'border-l-emerald-500 bg-emerald-500/10';
      case 'suggestion':
        return 'border-l-green-500 bg-green-500/10';
      case 'enrichment':
        return 'border-l-blue-500 bg-blue-500/10';
      default:
        return 'border-l-neutral-500 bg-white/[0.03]0/10';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`border-l-4 ${getNotificationStyles(notification.type)} backdrop-blur-sm rounded-lg p-3 shadow-lg animate-slide-in-right`}
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-sm font-semibold text-th-text">{notification.title}</h4>
              <p className="text-xs text-th-text-s mt-1">{notification.message}</p>
            </div>
            <button
              onClick={() => dismissNotification(notification.id)}
              className="text-th-text-t hover:text-th-text transition-colors ml-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
