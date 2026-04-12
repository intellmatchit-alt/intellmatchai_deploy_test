/**
 * Message Routes
 *
 * Routes for direct messaging between users.
 *
 * @module presentation/routes/message
 */

import { Router } from 'express';
import multer from 'multer';
import { messageController } from '../controllers/MessageController';
import { authenticate } from '../middleware/auth.middleware';

const messageRoutes = Router();

// All routes require authentication
messageRoutes.use(authenticate);

// Multer config for message attachments
const messageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 5 }, // 15MB per file, max 5 files
  fileFilter: (_req, file, cb) => {
    const allowed = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
      // Videos
      'video/mp4', 'video/webm', 'video/quicktime',
      // Audio
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

/**
 * GET /api/v1/messages/unread-count
 * Get total unread message count
 */
messageRoutes.get(
  '/unread-count',
  messageController.getUnreadCount.bind(messageController)
);

/**
 * GET /api/v1/messages/conversations
 * List user's conversations
 *
 * Query params:
 * - page: page number (default 1)
 * - limit: items per page (default 20)
 */
messageRoutes.get(
  '/conversations',
  messageController.listConversations.bind(messageController)
);

/**
 * POST /api/v1/messages/conversations
 * Create or find conversation with another user
 *
 * Body:
 * - participantId: string (required)
 * - message?: string (optional initial message)
 */
messageRoutes.post(
  '/conversations',
  messageController.createConversation.bind(messageController)
);

/**
 * GET /api/v1/messages/conversations/user/:userId
 * Get or create conversation with specific user
 * NOTE: Must be registered BEFORE /:conversationId to avoid route conflict
 */
messageRoutes.get(
  '/conversations/user/:userId',
  messageController.getConversationByUser.bind(messageController)
);

/**
 * POST /api/v1/messages/conversations/:conversationId/messages/:messageId/reactions
 * Toggle a reaction on a message
 */
messageRoutes.post(
  '/conversations/:conversationId/messages/:messageId/reactions',
  messageController.toggleReaction.bind(messageController)
);

/**
 * PATCH /api/v1/messages/conversations/:conversationId/messages/:messageId
 * Edit a message
 */
messageRoutes.patch(
  '/conversations/:conversationId/messages/:messageId',
  messageController.editMessage.bind(messageController)
);

/**
 * DELETE /api/v1/messages/conversations/:conversationId/messages/:messageId
 * Soft-delete a message
 */
messageRoutes.delete(
  '/conversations/:conversationId/messages/:messageId',
  messageController.deleteMessage.bind(messageController)
);

/**
 * GET /api/v1/messages/conversations/:conversationId
 * Get paginated messages for a conversation
 *
 * Query params:
 * - limit: messages per page (default 50)
 * - before: ISO date cursor for pagination
 */
messageRoutes.get(
  '/conversations/:conversationId',
  messageController.getMessages.bind(messageController)
);

/**
 * POST /api/v1/messages/conversations/:conversationId/messages
 * Send a message in a conversation (supports file attachments)
 *
 * Body (multipart/form-data or JSON):
 * - content: string (optional if attachments present)
 * - attachments: files (max 5, max 25MB each)
 * - messageType: string (optional, auto-detected from files)
 * - duration: number (optional, for voice/audio)
 */
messageRoutes.post(
  '/conversations/:conversationId/messages',
  messageUpload.array('attachments', 5),
  messageController.sendMessage.bind(messageController)
);

/**
 * PATCH /api/v1/messages/conversations/:conversationId/read
 * Mark all unread messages as read
 */
messageRoutes.patch(
  '/conversations/:conversationId/read',
  messageController.markRead.bind(messageController)
);

export default messageRoutes;
