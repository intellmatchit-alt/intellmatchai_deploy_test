/**
 * Message Controller
 *
 * Handles HTTP requests for direct messaging endpoints.
 *
 * @module presentation/controllers/MessageController
 */

import { Request, Response, NextFunction } from "express";
import { prisma } from "../../infrastructure/database/prisma/client";
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors";
import { logger } from "../../shared/logger";
import {
  emitNewMessage,
  emitMessageRead,
  emitMessageReaction,
  emitMessageEdited,
  emitMessageDeleted,
  isUserOnline,
} from "../../infrastructure/websocket/index.js";
import { getStorageService } from "../../infrastructure/external/storage/index.js";
import { v4 as uuidv4 } from "uuid";

const ATTACHMENT_BUCKET = "message-attachments";

/**
 * Determine message type from MIME type
 */
function getMessageTypeFromMime(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "FILE";
}

/**
 * Order two participant IDs lexicographically for unique constraint consistency
 */
function orderParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Include clause for message attachments and reactions */
const messageInclude = {
  attachments: true,
  reactions: {
    include: {
      user: {
        select: { id: true, fullName: true },
      },
    },
  },
};

class MessageController {
  /**
   * GET /conversations
   * List user's conversations with last message and unread count
   */
  async listConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [{ participantOneId: userId }, { participantTwoId: userId }],
        },
        include: {
          participantOne: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              jobTitle: true,
              company: true,
            },
          },
          participantTwo: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              jobTitle: true,
              company: true,
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: messageInclude,
          },
        },
        orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
        skip,
        take: limit,
      });

      // Get unread counts for each conversation
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              senderId: { not: userId },
              status: { not: "READ" },
            },
          });

          const otherUser =
            conv.participantOneId === userId
              ? conv.participantTwo
              : conv.participantOne;

          return {
            id: conv.id,
            otherUser: {
              ...otherUser,
              isOnline: isUserOnline(otherUser.id),
            },
            lastMessage: conv.messages[0] || null,
            lastMessageAt: conv.lastMessageAt,
            unreadCount,
            createdAt: conv.createdAt,
          };
        }),
      );

      const total = await prisma.conversation.count({
        where: {
          OR: [{ participantOneId: userId }, { participantTwoId: userId }],
        },
      });

      res.json({
        success: true,
        data: {
          conversations: conversationsWithUnread,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /conversations
   * Create or find existing conversation with another user
   */
  async createConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const { participantId, message } = req.body;
      if (!participantId)
        throw new ValidationError("participantId is required");
      if (participantId === userId)
        throw new ValidationError("Cannot create conversation with yourself");

      // Verify participant exists
      const participant = await prisma.user.findUnique({
        where: { id: participantId },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          jobTitle: true,
          company: true,
        },
      });
      if (!participant) throw new NotFoundError("User not found");

      const [participantOneId, participantTwoId] = orderParticipants(
        userId,
        participantId,
      );

      // Find or create conversation
      let conversation = await prisma.conversation.findUnique({
        where: {
          participantOneId_participantTwoId: {
            participantOneId,
            participantTwoId,
          },
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { participantOneId, participantTwoId },
        });
      }

      // Send initial message if provided
      if (message && message.trim()) {
        const msg = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: userId,
            content: message.trim(),
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: msg.createdAt },
        });

        // Emit real-time notification
        emitNewMessage(participantId, {
          id: msg.id,
          conversationId: conversation.id,
          senderId: userId,
          content: msg.content,
          messageType: "TEXT",
          status: msg.status,
          createdAt: msg.createdAt,
          attachments: [],
        });
      }

      res.json({
        success: true,
        data: {
          id: conversation.id,
          otherUser: {
            ...participant,
            isOnline: isUserOnline(participant.id),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /conversations/user/:userId
   * Get or create conversation with a specific user
   */
  async getConversationByUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const otherUserId = String(req.params.userId);
      if (!otherUserId) throw new ValidationError("userId is required");
      if (otherUserId === userId)
        throw new ValidationError("Cannot message yourself");

      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          jobTitle: true,
          company: true,
        },
      });
      if (!otherUser) throw new NotFoundError("User not found");

      const [participantOneId, participantTwoId] = orderParticipants(
        userId,
        otherUserId,
      );

      let conversation = await prisma.conversation.findUnique({
        where: {
          participantOneId_participantTwoId: {
            participantOneId,
            participantTwoId,
          },
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { participantOneId, participantTwoId },
        });
      }

      res.json({
        success: true,
        data: {
          id: conversation.id,
          otherUser: {
            ...otherUser,
            isOnline: isUserOnline(otherUser.id),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /conversations/:conversationId
   * Get paginated messages for a conversation
   */
  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const { conversationId } = req.params as { conversationId: string };

      // Verify user is participant
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ participantOneId: userId }, { participantTwoId: userId }],
        },
        include: {
          participantOne: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              jobTitle: true,
              company: true,
            },
          },
          participantTwo: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              jobTitle: true,
              company: true,
            },
          },
        },
      });

      if (!conversation) throw new NotFoundError("Conversation not found");

      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before as string | undefined;

      const whereClause: any = { conversationId };
      if (before) {
        whereClause.createdAt = { lt: new Date(before) };
      }

      const messages = await prisma.message.findMany({
        where: whereClause,
        include: messageInclude,
        orderBy: { createdAt: "desc" },
        take: limit + 1, // Fetch one extra to determine if there are more
      });

      const hasMore = messages.length > limit;
      if (hasMore) messages.pop();

      const otherUser =
        conversation.participantOneId === userId
          ? conversation.participantTwo
          : conversation.participantOne;

      res.json({
        success: true,
        data: {
          conversationId: conversation.id,
          otherUser: {
            ...otherUser,
            isOnline: isUserOnline(otherUser.id),
          },
          messages: messages.reverse(), // Return in chronological order
          hasMore,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /conversations/:conversationId/messages
   * Send a message in a conversation (supports file attachments)
   */
  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const { conversationId } = req.params as { conversationId: string };
      const content = req.body.content?.trim() || null;
      const files = (req.files as Express.Multer.File[]) || [];
      const duration = req.body.duration ? parseFloat(req.body.duration) : null;
      let messageType = (req.body.messageType as string) || "TEXT";

      // Validate: need content or files
      if (!content && files.length === 0) {
        throw new ValidationError("Message content or attachments required");
      }

      // Verify user is participant
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ participantOneId: userId }, { participantTwoId: userId }],
        },
      });

      if (!conversation) throw new NotFoundError("Conversation not found");

      // Auto-detect message type from files
      if (files.length > 0 && messageType === "TEXT") {
        messageType = getMessageTypeFromMime(files[0].mimetype);
      }

      // Upload files to MinIO
      const attachmentData: Array<{
        fileName: string;
        originalName: string;
        mimeType: string;
        size: number;
        storageKey: string;
        storageBucket: string;
        url: string;
        duration: number | null;
      }> = [];

      if (files.length > 0) {
        const storage = getStorageService();
        await storage.ensureBucket(ATTACHMENT_BUCKET);

        for (const file of files) {
          const ext = file.originalname.split(".").pop() || "bin";
          const fileName = `${uuidv4()}.${ext}`;
          const storageKey = `${conversationId}/${fileName}`;

          const result = await storage.upload(
            ATTACHMENT_BUCKET,
            storageKey,
            file.buffer,
            { contentType: file.mimetype },
          );

          attachmentData.push({
            fileName,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            storageKey,
            storageBucket: ATTACHMENT_BUCKET,
            url: result.url,
            duration:
              messageType === "VOICE" || messageType === "AUDIO"
                ? duration
                : null,
          });
        }
      }

      // Create message + attachments in a transaction
      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          content,
          messageType: messageType as any,
          attachments:
            attachmentData.length > 0
              ? {
                  create: attachmentData,
                }
              : undefined,
        },
        include: messageInclude,
      });

      // Update conversation lastMessageAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt },
      });

      // Emit to the other participant
      const recipientId =
        conversation.participantOneId === userId
          ? conversation.participantTwoId
          : conversation.participantOneId;

      emitNewMessage(recipientId, {
        id: message.id,
        conversationId,
        senderId: userId,
        content: message.content,
        messageType: message.messageType,
        status: message.status,
        createdAt: message.createdAt,
        attachments: message.attachments,
      });

      res.json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /conversations/:conversationId/read
   * Mark all unread messages in conversation as read
   */
  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const { conversationId } = req.params as { conversationId: string };

      // Verify user is participant
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ participantOneId: userId }, { participantTwoId: userId }],
        },
      });

      if (!conversation) throw new NotFoundError("Conversation not found");

      const now = new Date();

      // Mark all unread messages from the other user as read
      const result = await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          status: { not: "READ" },
        },
        data: {
          status: "READ",
          readAt: now,
        },
      });

      // Notify the sender that their messages were read
      if (result.count > 0) {
        const senderId =
          conversation.participantOneId === userId
            ? conversation.participantTwoId
            : conversation.participantOneId;

        emitMessageRead(senderId, {
          conversationId,
          readBy: userId,
          readAt: now.toISOString(),
        });
      }

      res.json({
        success: true,
        data: { markedCount: result.count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /unread-count
   * Get total unread message count across all conversations
   */
  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const count = await prisma.message.count({
        where: {
          conversation: {
            OR: [{ participantOneId: userId }, { participantTwoId: userId }],
          },
          senderId: { not: userId },
          status: { not: "READ" },
        },
      });

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * POST /conversations/:conversationId/messages/:messageId/reactions
   * Toggle a reaction on a message
   */
  async toggleReaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const { conversationId, messageId } = req.params as {
        conversationId: string;
        messageId: string;
      };
      const { emoji } = req.body;
      if (!emoji) throw new ValidationError("emoji is required");

      // Verify user is participant
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ participantOneId: userId }, { participantTwoId: userId }],
        },
      });
      if (!conversation) throw new NotFoundError("Conversation not found");

      // Verify message exists in this conversation
      const message = await prisma.message.findFirst({
        where: { id: messageId, conversationId },
      });
      if (!message) throw new NotFoundError("Message not found");

      // Toggle: check if reaction already exists
      const existing = await prisma.messageReaction.findUnique({
        where: {
          messageId_userId_emoji: { messageId, userId, emoji },
        },
      });

      if (existing) {
        await prisma.messageReaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.messageReaction.create({
          data: { messageId, userId, emoji },
        });
      }

      // Get updated reactions
      const reactions = await prisma.messageReaction.findMany({
        where: { messageId },
        include: { user: { select: { id: true, fullName: true } } },
      });

      // Emit to other participant
      const recipientId =
        conversation.participantOneId === userId
          ? conversation.participantTwoId
          : conversation.participantOneId;

      emitMessageReaction(recipientId, {
        conversationId,
        messageId,
        reactions,
      });

      res.json({
        success: true,
        data: { reactions },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /conversations/:conversationId/messages/:messageId
   * Edit a message
   */
  async editMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const { conversationId, messageId } = req.params as {
        conversationId: string;
        messageId: string;
      };
      const { content } = req.body;
      if (!content || !content.trim())
        throw new ValidationError("content is required");

      // Verify user is participant
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ participantOneId: userId }, { participantTwoId: userId }],
        },
      });
      if (!conversation) throw new NotFoundError("Conversation not found");

      // Find message - must be sender, TEXT type, not deleted
      const message = await prisma.message.findFirst({
        where: { id: messageId, conversationId },
      });
      if (!message) throw new NotFoundError("Message not found");
      if (message.senderId !== userId)
        throw new ValidationError("You can only edit your own messages");
      if (message.messageType !== "TEXT")
        throw new ValidationError("Only text messages can be edited");
      if (message.deletedAt)
        throw new ValidationError("Cannot edit a deleted message");

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: {
          content: content.trim(),
          isEdited: true,
          editedAt: new Date(),
        },
        include: messageInclude,
      });

      // Emit to other participant
      const recipientId =
        conversation.participantOneId === userId
          ? conversation.participantTwoId
          : conversation.participantOneId;

      emitMessageEdited(recipientId, {
        conversationId,
        messageId,
        content: updated.content,
        isEdited: true,
        editedAt: updated.editedAt,
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /conversations/:conversationId/messages/:messageId
   * Soft-delete a message
   */
  async deleteMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) throw new AuthenticationError("Not authenticated");

      const { conversationId, messageId } = req.params as {
        conversationId: string;
        messageId: string;
      };

      // Verify user is participant
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ participantOneId: userId }, { participantTwoId: userId }],
        },
      });
      if (!conversation) throw new NotFoundError("Conversation not found");

      // Find message - must be sender
      const message = await prisma.message.findFirst({
        where: { id: messageId, conversationId },
      });
      if (!message) throw new NotFoundError("Message not found");
      if (message.senderId !== userId)
        throw new ValidationError("You can only delete your own messages");
      if (message.deletedAt)
        throw new ValidationError("Message already deleted");

      await prisma.message.update({
        where: { id: messageId },
        data: {
          deletedAt: new Date(),
          content: null,
        },
      });

      // Emit to other participant
      const recipientId =
        conversation.participantOneId === userId
          ? conversation.participantTwoId
          : conversation.participantOneId;

      emitMessageDeleted(recipientId, {
        conversationId,
        messageId,
        deletedAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        data: { messageId, deleted: true },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const messageController = new MessageController();
