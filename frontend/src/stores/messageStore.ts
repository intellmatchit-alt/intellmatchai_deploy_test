'use client';

import { create } from 'zustand';

interface MessageState {
  unreadCount: number;
  onlineUsers: Set<string>;
  typingUsers: Map<string, string>; // conversationId -> userId
}

interface MessageActions {
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: (count?: number) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setTyping: (conversationId: string, userId: string) => void;
  clearTyping: (conversationId: string) => void;
}

export const useMessageStore = create<MessageState & MessageActions>((set) => ({
  unreadCount: 0,
  onlineUsers: new Set<string>(),
  typingUsers: new Map<string, string>(),

  setUnreadCount: (count) => set({ unreadCount: count }),

  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),

  decrementUnread: (count = 1) =>
    set((state) => ({ unreadCount: Math.max(0, state.unreadCount - count) })),

  setUserOnline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.add(userId);
      return { onlineUsers: next };
    }),

  setUserOffline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),

  setTyping: (conversationId, userId) =>
    set((state) => {
      const next = new Map(state.typingUsers);
      next.set(conversationId, userId);
      return { typingUsers: next };
    }),

  clearTyping: (conversationId) =>
    set((state) => {
      const next = new Map(state.typingUsers);
      next.delete(conversationId);
      return { typingUsers: next };
    }),
}));
