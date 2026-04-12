/**
 * WebSocket Hook
 *
 * Manages WebSocket connection for real-time updates.
 *
 * @module hooks/useWebSocket
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { getAccessToken } from '@/lib/api/client';

/**
 * Connection status
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Enrichment progress event
 */
export interface EnrichmentProgressEvent {
  contactId: string;
  step: number;
  total: number;
  status: string;
  timestamp: string;
}

/**
 * Enrichment complete event
 */
export interface EnrichmentCompleteEvent {
  contactId: string;
  data?: unknown;
  success: boolean;
  error?: string;
  timestamp: string;
}

/**
 * Match update event
 */
export interface MatchUpdateEvent {
  contactId: string;
  score: number;
  reasons: string[];
  timestamp: string;
}

/**
 * Suggestion ready event
 */
export interface SuggestionReadyEvent {
  contactId: string;
  suggestions: unknown;
  timestamp: string;
}

/**
 * Project match progress event
 */
export interface ProjectMatchProgressEvent {
  projectId: string;
  progress: number;
  status: string;
  timestamp: string;
}

/**
 * Project match complete event
 */
export interface ProjectMatchCompleteEvent {
  projectId: string;
  matchCount: number;
  status: 'completed' | 'failed';
  error?: string;
  timestamp: string;
}

/**
 * New message event
 */
export interface NewMessageEvent {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  messageType: string;
  status: string;
  createdAt: string;
  attachments: Array<{
    id: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    duration: number | null;
  }>;
}

/**
 * Message read event
 */
export interface MessageReadEvent {
  conversationId: string;
  readBy: string;
  readAt: string;
}

/**
 * Typing event
 */
export interface TypingEvent {
  conversationId: string;
  userId: string;
  timestamp: string;
}

/**
 * Message reaction event
 */
export interface MessageReactionEvent {
  conversationId: string;
  messageId: string;
  reactions: Array<{
    id: string;
    messageId: string;
    userId: string;
    emoji: string;
    createdAt: string;
    user: { id: string; fullName: string };
  }>;
}

/**
 * Message edited event
 */
export interface MessageEditedEvent {
  conversationId: string;
  messageId: string;
  content: string;
  isEdited: boolean;
  editedAt: string;
}

/**
 * Message deleted event
 */
export interface MessageDeletedEvent {
  conversationId: string;
  messageId: string;
  deletedAt: string;
}

/**
 * User online/offline event
 */
export interface UserOnlineEvent {
  userId: string;
  timestamp: string;
}

/**
 * Event handlers type
 */
/**
 * Generic notification event (from notification:new WebSocket)
 */
export interface NotificationNewEvent {
  type: string;
  title: string;
  message: string;
  [key: string]: unknown;
}

export interface WebSocketEventHandlers {
  onEnrichmentProgress?: (event: EnrichmentProgressEvent) => void;
  onEnrichmentComplete?: (event: EnrichmentCompleteEvent) => void;
  onMatchUpdate?: (event: MatchUpdateEvent) => void;
  onSuggestionReady?: (event: SuggestionReadyEvent) => void;
  onProjectMatchProgress?: (event: ProjectMatchProgressEvent) => void;
  onProjectMatchComplete?: (event: ProjectMatchCompleteEvent) => void;
  onNewMessage?: (event: NewMessageEvent) => void;
  onMessageRead?: (event: MessageReadEvent) => void;
  onMessageReaction?: (event: MessageReactionEvent) => void;
  onMessageEdited?: (event: MessageEditedEvent) => void;
  onMessageDeleted?: (event: MessageDeletedEvent) => void;
  onTyping?: (event: TypingEvent) => void;
  onTypingStop?: (event: TypingEvent) => void;
  onUserOnline?: (event: UserOnlineEvent) => void;
  onUserOffline?: (event: UserOnlineEvent) => void;
  onNotificationNew?: (event: NotificationNewEvent) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

/**
 * WebSocket hook options
 */
export interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

/**
 * WebSocket hook return type
 */
export interface UseWebSocketReturn {
  status: ConnectionStatus;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribeToEnrichment: (contactId: string) => void;
  unsubscribeFromEnrichment: (contactId: string) => void;
  subscribeToMatches: () => void;
  unsubscribeFromMatches: () => void;
  emitTyping: (conversationId: string, recipientId: string) => void;
  emitTypingStop: (conversationId: string, recipientId: string) => void;
}

/**
 * Get WebSocket URL from environment
 */
function getWebSocketUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  // Convert HTTP to WS protocol
  return apiUrl.replace(/^http/, 'ws').replace('/api/v1', '');
}

/**
 * WebSocket hook
 *
 * Provides real-time updates via Socket.IO.
 *
 * @param handlers - Event handlers
 * @param options - Connection options
 * @returns WebSocket controls and status
 */
export function useWebSocket(
  handlers: WebSocketEventHandlers = {},
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);

  // Update handlers ref when handlers change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const {
    autoConnect = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    if (!isAuthenticated || !user) {
      return;
    }

    setStatus('connecting');

    const socket = io(getWebSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnectionAttempts,
      reconnectionDelay,
      autoConnect: true,
    });

    // Connection events
    socket.on('connect', () => {
      setStatus('connected');

      // Authenticate with JWT token
      const token = getAccessToken();
      if (token) {
        socket.emit('authenticate', { token });
      }

      handlersRef.current.onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      setStatus('disconnected');
      handlersRef.current.onDisconnect?.(reason);
    });

    socket.on('connect_error', (error) => {
      setStatus('error');
      handlersRef.current.onError?.(error);
    });

    // Application events
    socket.on('enrichment:progress', (event: EnrichmentProgressEvent) => {
      handlersRef.current.onEnrichmentProgress?.(event);
    });

    socket.on('enrichment:complete', (event: EnrichmentCompleteEvent) => {
      handlersRef.current.onEnrichmentComplete?.(event);
    });

    socket.on('match:updated', (event: MatchUpdateEvent) => {
      handlersRef.current.onMatchUpdate?.(event);
    });

    socket.on('suggestion:ready', (event: SuggestionReadyEvent) => {
      handlersRef.current.onSuggestionReady?.(event);
    });

    socket.on('project:match:progress', (event: ProjectMatchProgressEvent) => {
      handlersRef.current.onProjectMatchProgress?.(event);
    });

    socket.on('project:match:complete', (event: ProjectMatchCompleteEvent) => {
      handlersRef.current.onProjectMatchComplete?.(event);
    });

    // Message events
    socket.on('message:new', (event: NewMessageEvent) => {
      handlersRef.current.onNewMessage?.(event);
    });

    socket.on('message:read', (event: MessageReadEvent) => {
      handlersRef.current.onMessageRead?.(event);
    });

    socket.on('message:reaction', (event: MessageReactionEvent) => {
      handlersRef.current.onMessageReaction?.(event);
    });

    socket.on('message:edited', (event: MessageEditedEvent) => {
      handlersRef.current.onMessageEdited?.(event);
    });

    socket.on('message:deleted', (event: MessageDeletedEvent) => {
      handlersRef.current.onMessageDeleted?.(event);
    });

    socket.on('message:typing', (event: TypingEvent) => {
      handlersRef.current.onTyping?.(event);
    });

    socket.on('message:typing:stop', (event: TypingEvent) => {
      handlersRef.current.onTypingStop?.(event);
    });

    // Notification events
    socket.on('notification:new', (event: NotificationNewEvent) => {
      handlersRef.current.onNotificationNew?.(event);
    });

    // Online/offline events
    socket.on('user:online', (event: UserOnlineEvent) => {
      handlersRef.current.onUserOnline?.(event);
    });

    socket.on('user:offline', (event: UserOnlineEvent) => {
      handlersRef.current.onUserOffline?.(event);
    });

    socketRef.current = socket;
  }, [isAuthenticated, user, reconnectionAttempts, reconnectionDelay]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setStatus('disconnected');
    }
  }, []);

  /**
   * Subscribe to enrichment updates for a contact
   */
  const subscribeToEnrichment = useCallback((contactId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:enrichment', { contactId });
    }
  }, []);

  /**
   * Unsubscribe from enrichment updates
   */
  const unsubscribeFromEnrichment = useCallback((contactId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe', `enrichment:${contactId}`);
    }
  }, []);

  /**
   * Subscribe to match updates
   */
  const subscribeToMatches = useCallback(() => {
    if (socketRef.current?.connected && user?.id) {
      socketRef.current.emit('subscribe:matches', {});
    }
  }, [user?.id]);

  /**
   * Unsubscribe from match updates
   */
  const unsubscribeFromMatches = useCallback(() => {
    if (socketRef.current?.connected && user?.id) {
      socketRef.current.emit('unsubscribe', `matches:${user.id}`);
    }
  }, [user?.id]);

  /**
   * Emit typing indicator
   */
  const emitTyping = useCallback((conversationId: string, recipientId: string) => {
    if (socketRef.current?.connected && user?.id) {
      socketRef.current.emit('message:typing', { conversationId, recipientId });
    }
  }, [user?.id]);

  /**
   * Emit typing stop
   */
  const emitTypingStop = useCallback((conversationId: string, recipientId: string) => {
    if (socketRef.current?.connected && user?.id) {
      socketRef.current.emit('message:typing:stop', { conversationId, recipientId });
    }
  }, [user?.id]);

  // Auto-connect when authenticated
  useEffect(() => {
    if (autoConnect && isAuthenticated && user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, isAuthenticated, user, connect, disconnect]);

  return {
    status,
    isConnected: status === 'connected',
    connect,
    disconnect,
    subscribeToEnrichment,
    unsubscribeFromEnrichment,
    subscribeToMatches,
    unsubscribeFromMatches,
    emitTyping,
    emitTypingStop,
  };
}

export default useWebSocket;
