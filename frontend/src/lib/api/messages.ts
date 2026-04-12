/**
 * Messages API
 *
 * API client functions for direct messaging.
 *
 * @module lib/api/messages
 */

import { api, getAccessToken, getAuthHeaders } from './client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * User info in conversation context
 */
export interface ConversationUser {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  company: string | null;
  isOnline: boolean;
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  id: string;
  messageId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  storageBucket: string;
  url: string;
  duration: number | null;
  createdAt: string;
}

/**
 * Message type enum
 */
export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'FILE';

/**
 * Message reaction
 */
export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user: { id: string; fullName: string };
}

/**
 * Message object
 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  messageType: MessageType;
  status: 'SENT' | 'DELIVERED' | 'READ';
  readAt: string | null;
  isEdited?: boolean;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: MessageAttachment[];
  reactions?: MessageReaction[];
}

/**
 * Conversation list item
 */
export interface ConversationListItem {
  id: string;
  otherUser: ConversationUser;
  lastMessage: Message | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * Get user's conversations
 */
export function getConversations(params?: { page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return api.get<{ conversations: ConversationListItem[]; pagination: PaginationInfo }>(
    `/messages/conversations${qs ? `?${qs}` : ''}`
  );
}

/**
 * Create or find conversation with another user
 */
export function createConversation(participantId: string, message?: string) {
  return api.post<{ id: string; otherUser: ConversationUser }>(
    '/messages/conversations',
    { participantId, message }
  );
}

/**
 * Get or create conversation with a specific user
 */
export function getConversationByUser(userId: string) {
  return api.get<{ id: string; otherUser: ConversationUser }>(
    `/messages/conversations/user/${userId}`
  );
}

/**
 * Get paginated messages for a conversation
 */
export function getMessages(conversationId: string, params?: { limit?: number; before?: string }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.before) query.set('before', params.before);
  const qs = query.toString();
  return api.get<{ conversationId: string; otherUser: ConversationUser; messages: Message[]; hasMore: boolean }>(
    `/messages/conversations/${conversationId}${qs ? `?${qs}` : ''}`
  );
}

/**
 * Send a message in a conversation
 * For text-only, uses JSON. For files/voice, uses FormData.
 */
export async function sendMessage(
  conversationId: string,
  options: {
    content?: string;
    files?: File[];
    voiceBlob?: Blob;
    voiceDuration?: number;
    messageType?: MessageType;
  }
): Promise<Message> {
  const { content, files, voiceBlob, voiceDuration, messageType } = options;
  const hasFiles = (files && files.length > 0) || voiceBlob;

  if (!hasFiles) {
    // Text-only: use existing JSON API
    return api.post<Message>(
      `/messages/conversations/${conversationId}/messages`,
      { content }
    );
  }

  // File upload: use FormData
  const formData = new FormData();
  if (content) formData.append('content', content);
  if (messageType) formData.append('messageType', messageType);

  if (voiceBlob) {
    formData.append('attachments', voiceBlob, 'voice.webm');
    if (!messageType) formData.append('messageType', 'VOICE');
    if (voiceDuration) formData.append('duration', String(voiceDuration));
  } else if (files) {
    for (const file of files) {
      formData.append('attachments', file);
    }
  }

  const response = await fetch(`${API_BASE_URL}/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'Failed to send message');
  }
  return data.data;
}

/**
 * Mark all unread messages in conversation as read
 */
export function markConversationRead(conversationId: string) {
  return api.patch<{ markedCount: number }>(
    `/messages/conversations/${conversationId}/read`
  );
}

/**
 * Get total unread message count
 */
export function getUnreadCount() {
  return api.get<{ count: number }>('/messages/unread-count');
}

/**
 * Toggle a reaction on a message
 */
export function toggleReaction(conversationId: string, messageId: string, emoji: string) {
  return api.post<{ reactions: MessageReaction[] }>(
    `/messages/conversations/${conversationId}/messages/${messageId}/reactions`,
    { emoji }
  );
}

/**
 * Edit a message
 */
export function editMessage(conversationId: string, messageId: string, content: string) {
  return api.patch<Message>(
    `/messages/conversations/${conversationId}/messages/${messageId}`,
    { content }
  );
}

/**
 * Delete a message (soft delete)
 */
export function deleteMessage(conversationId: string, messageId: string) {
  return api.delete<{ messageId: string; deleted: boolean }>(
    `/messages/conversations/${conversationId}/messages/${messageId}`
  );
}
