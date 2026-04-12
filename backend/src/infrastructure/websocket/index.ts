/**
 * WebSocket Setup
 *
 * Socket.IO server configuration for real-time updates.
 *
 * @module infrastructure/websocket
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../auth/jwt.js';
import { logger } from '../../shared/logger/index.js';

/**
 * Socket.IO server instance
 */
let io: SocketIOServer | null = null;

/**
 * Connected users map (userId -> socketId)
 */
const connectedUsers = new Map<string, string>();

/**
 * Initialize WebSocket server
 *
 * @param socketServer - Socket.IO server instance
 */
export const initializeWebSocket = (socketServer: SocketIOServer): void => {
  io = socketServer;

  io.on('connection', (socket: Socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    /**
     * Handle user authentication via JWT token
     */
    socket.on('authenticate', (data: { token: string; userId?: string }) => {
      const { token } = data;
      if (!token) {
        socket.emit('auth:error', { message: 'Authentication token required' });
        return;
      }

      try {
        const payload = verifyAccessToken(token);
        const userId = payload.userId;
        connectedUsers.set(userId, socket.id);
        socket.join(`user:${userId}`);
        (socket as any).userId = userId;
        logger.info(`User ${userId} authenticated on socket ${socket.id}`);

        socket.emit('auth:success', { userId });
        socket.broadcast.emit('user:online', { userId, timestamp: new Date().toISOString() });
      } catch (error) {
        logger.warn(`WebSocket auth failed on socket ${socket.id}`, { error });
        socket.emit('auth:error', { message: 'Invalid or expired token' });
      }
    });

    /**
     * Handle typing indicator start
     */
    socket.on('message:typing', (data: { conversationId: string; recipientId: string }) => {
      const userId = (socket as any).userId;
      if (!userId) return;
      if (data.recipientId) {
        io?.to(`user:${data.recipientId}`).emit('message:typing', {
          conversationId: data.conversationId,
          userId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    /**
     * Handle typing indicator stop
     */
    socket.on('message:typing:stop', (data: { conversationId: string; recipientId: string }) => {
      const userId = (socket as any).userId;
      if (!userId) return;
      if (data.recipientId) {
        io?.to(`user:${data.recipientId}`).emit('message:typing:stop', {
          conversationId: data.conversationId,
          userId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    /**
     * Subscribe to enrichment updates for a contact
     */
    socket.on('subscribe:enrichment', (data: { contactId: string }) => {
      if (!(socket as any).userId) return;
      const { contactId } = data;
      socket.join(`enrichment:${contactId}`);
      logger.debug(`Socket ${socket.id} subscribed to enrichment:${contactId}`);
    });

    /**
     * Subscribe to match updates
     */
    socket.on('subscribe:matches', () => {
      const userId = (socket as any).userId;
      if (!userId) return;
      socket.join(`matches:${userId}`);
      logger.debug(`Socket ${socket.id} subscribed to matches:${userId}`);
    });

    /**
     * Unsubscribe from a room
     */
    socket.on('unsubscribe', (room: string) => {
      socket.leave(room);
      logger.debug(`Socket ${socket.id} unsubscribed from ${room}`);
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', (reason: string) => {
      logger.info(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`);

      // Remove from connected users and broadcast offline
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          socket.broadcast.emit('user:offline', { userId, timestamp: new Date().toISOString() });
          break;
        }
      }
    });

    /**
     * Handle errors
     */
    socket.on('error', (error: Error) => {
      logger.error(`WebSocket error on ${socket.id}:`, error);
    });
  });

  logger.info('WebSocket server initialized');
};

/**
 * Get Socket.IO server instance
 *
 * @returns Socket.IO server or null if not initialized
 */
export const getIO = (): SocketIOServer | null => {
  return io;
};

/**
 * Emit event to a specific user
 *
 * @param userId - User ID to emit to
 * @param event - Event name
 * @param data - Event data
 */
export const emitToUser = (
  userId: string,
  event: string,
  data: unknown
): void => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
    logger.debug(`Emitted ${event} to user ${userId}`);
  }
};

/**
 * Emit enrichment progress
 *
 * @param contactId - Contact ID
 * @param step - Current step
 * @param total - Total steps
 * @param status - Status message
 */
export const emitEnrichmentProgress = (
  contactId: string,
  step: number,
  total: number,
  status: string
): void => {
  if (io) {
    io.to(`enrichment:${contactId}`).emit('enrichment:progress', {
      contactId,
      step,
      total,
      status,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Emit enrichment completion
 *
 * @param contactId - Contact ID
 * @param data - Enrichment data
 */
export const emitEnrichmentComplete = (
  contactId: string,
  data: unknown
): void => {
  if (io) {
    io.to(`enrichment:${contactId}`).emit('enrichment:complete', {
      contactId,
      data,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Emit suggestion ready
 *
 * @param userId - User ID
 * @param contactId - Contact ID
 * @param suggestions - Suggestions data
 */
export const emitSuggestionReady = (
  userId: string,
  contactId: string,
  suggestions: unknown
): void => {
  if (io) {
    io.to(`user:${userId}`).emit('suggestion:ready', {
      contactId,
      suggestions,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Emit match update
 *
 * @param userId - User ID
 * @param contactId - Contact ID
 * @param score - Match score
 * @param reasons - Match reasons
 */
export const emitMatchUpdate = (
  userId: string,
  contactId: string,
  score: number,
  reasons: string[]
): void => {
  if (io) {
    io.to(`user:${userId}`).emit('match:updated', {
      contactId,
      score,
      reasons,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Emit project match progress
 *
 * @param userId - User ID
 * @param projectId - Project ID
 * @param progress - Progress percentage (0-100)
 * @param status - Status message
 */
export const emitProjectMatchProgress = (
  userId: string,
  projectId: string,
  progress: number,
  status: string
): void => {
  if (io) {
    io.to(`user:${userId}`).emit('project:match:progress', {
      projectId,
      progress,
      status,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Emit project match completion
 *
 * @param userId - User ID
 * @param projectId - Project ID
 * @param matchCount - Number of matches found
 * @param status - 'completed' | 'failed'
 * @param error - Error message if failed
 */
export const emitProjectMatchComplete = (
  userId: string,
  projectId: string,
  matchCount: number,
  status: 'completed' | 'failed',
  error?: string
): void => {
  if (io) {
    io.to(`user:${userId}`).emit('project:match:complete', {
      projectId,
      matchCount,
      status,
      error,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Emit product match progress
 *
 * @param userId - User ID
 * @param runId - Product match run ID
 * @param progress - Progress percentage (0-100)
 * @param status - Status message
 */
export const emitProductMatchProgress = (
  userId: string,
  runId: string,
  progress: number,
  status: string
): void => {
  if (io) {
    io.to(`user:${userId}`).emit('product:match:progress', {
      runId,
      progress,
      status,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Emit product match completion
 *
 * @param userId - User ID
 * @param runId - Product match run ID
 * @param matchCount - Number of matches found
 * @param avgScore - Average match score
 * @param status - 'completed' | 'failed'
 * @param error - Error message if failed
 */
export const emitProductMatchComplete = (
  userId: string,
  runId: string,
  matchCount: number,
  avgScore: number,
  status: 'completed' | 'failed',
  error?: string
): void => {
  if (io) {
    io.to(`user:${userId}`).emit('product:match:complete', {
      runId,
      matchCount,
      avgScore,
      status,
      error,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Check if a user is currently online
 */
export const isUserOnline = (userId: string): boolean => {
  return connectedUsers.has(userId);
};

/**
 * Emit new message to a user
 */
export const emitNewMessage = (userId: string, messageData: unknown): void => {
  if (io) {
    io.to(`user:${userId}`).emit('message:new', messageData);
  }
};

/**
 * Emit message read receipt to a user
 */
export const emitMessageRead = (userId: string, data: unknown): void => {
  if (io) {
    io.to(`user:${userId}`).emit('message:read', data);
  }
};

/**
 * Emit message reaction to a user
 */
export const emitMessageReaction = (userId: string, data: unknown): void => {
  if (io) {
    io.to(`user:${userId}`).emit('message:reaction', data);
  }
};

/**
 * Emit message edited to a user
 */
export const emitMessageEdited = (userId: string, data: unknown): void => {
  if (io) {
    io.to(`user:${userId}`).emit('message:edited', data);
  }
};

/**
 * Emit message deleted to a user
 */
export const emitMessageDeleted = (userId: string, data: unknown): void => {
  if (io) {
    io.to(`user:${userId}`).emit('message:deleted', data);
  }
};

export default {
  initializeWebSocket,
  getIO,
  emitToUser,
  emitEnrichmentProgress,
  emitEnrichmentComplete,
  emitSuggestionReady,
  emitMatchUpdate,
  emitProjectMatchProgress,
  emitProjectMatchComplete,
  emitProductMatchProgress,
  emitProductMatchComplete,
  isUserOnline,
  emitNewMessage,
  emitMessageRead,
  emitMessageReaction,
  emitMessageEdited,
  emitMessageDeleted,
};
