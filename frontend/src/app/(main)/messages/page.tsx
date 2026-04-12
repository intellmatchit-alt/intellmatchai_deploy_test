/**
 * Messages Page
 *
 * List conversations with search and new message functionality.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  Add24Regular,
  Search24Regular,
  Chat24Regular,
  Dismiss24Regular,
  Send24Regular,
} from '@fluentui/react-icons';
import { getConversations, createConversation, ConversationListItem } from '@/lib/api/messages';
import { api } from '@/lib/api/client';
import { useMessageStore } from '@/stores/messageStore';
import { toast } from '@/components/ui/Toast';

/**
 * Format timestamp for conversation list
 */
function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Avatar component with online indicator
 */
function UserAvatar({ user, size = 'md' }: { user: { fullName: string; avatarUrl: string | null; isOnline?: boolean }; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-10 h-10' : 'w-12 h-12';
  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const onlineUsers = useMessageStore((s) => s.onlineUsers);
  const isOnline = user.isOnline || onlineUsers.has((user as any).id);

  return (
    <div className="relative flex-shrink-0">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.fullName}
          className={`${sizeClass} rounded-full object-cover`}
        />
      ) : (
        <div className={`${sizeClass} rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
          {user.fullName.charAt(0).toUpperCase()}
        </div>
      )}
      {isOnline && (
        <div className={`absolute bottom-0 right-0 ${dotSize} bg-green-500 rounded-full border-2 border-th-border`} />
      )}
    </div>
  );
}

/**
 * Conversation card
 */
function ConversationCard({ conversation, onClick }: { conversation: ConversationListItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-th-surface transition-all duration-200 text-left"
    >
      <UserAvatar user={conversation.otherUser} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-th-text truncate">{conversation.otherUser.fullName}</span>
          <span className="text-xs text-th-text-m flex-shrink-0">
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-sm text-th-text-t truncate">
            {conversation.lastMessage
              ? conversation.lastMessage.deletedAt
                ? 'This message was deleted'
                : conversation.lastMessage.content
                || (conversation.lastMessage.messageType === 'VOICE' ? '🎤 Voice message'
                  : conversation.lastMessage.messageType === 'IMAGE' ? '📷 Photo'
                  : conversation.lastMessage.messageType === 'VIDEO' ? '🎬 Video'
                  : conversation.lastMessage.messageType === 'AUDIO' ? '🎵 Audio'
                  : conversation.lastMessage.messageType === 'FILE' ? '📎 File'
                  : 'Attachment')
              : 'No messages yet'}
          </span>
          {conversation.unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-semibold">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * New message modal
 */
function NewMessageModal({ onClose, onSelect }: { onClose: () => void; onSelect: (userId: string) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<any[]>(`/users/search?q=${encodeURIComponent(query.trim())}&limit=10`);
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-th-bg-s border border-th-border rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-th-border">
          <h2 className="text-lg font-semibold text-th-text">{(t as any).messages?.newMessage || 'New Message'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-th-surface-h text-th-text-t">
            <Dismiss24Regular />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={(t as any).messages?.searchUsers || 'Search users...'}
              className="w-full pl-10 pr-4 py-2.5 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/50"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-center text-th-text-m py-8">No users found</p>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelect(user.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-th-surface transition-all duration-200 text-left"
            >
              <UserAvatar user={{ ...user, isOnline: false }} size="sm" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-th-text block truncate">{user.fullName}</span>
                {(user.jobTitle || user.company) && (
                  <span className="text-sm text-th-text-t truncate block">
                    {[user.jobTitle, user.company].filter(Boolean).join(' at ')}
                  </span>
                )}
              </div>
              <Send24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations({ limit: 50 });
      setConversations(data.conversations);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleNewMessage = async (userId: string) => {
    try {
      const data = await createConversation(userId);
      setShowNewMessage(false);
      router.push(`/messages/${data.id}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    }
  };

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.otherUser.fullName.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const msgs = (t as any).messages || {};

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-th-text">{msgs.title || 'Messages'}</h1>
          <p className="text-sm text-th-text-t mt-1">{msgs.subtitle || 'Chat with your connections'}</p>
        </div>
        <button
          onClick={() => setShowNewMessage(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Add24Regular className="w-5 h-5" />
          <span className="hidden sm:inline">{msgs.newMessage || 'New Message'}</span>
        </button>
      </div>

      {/* Search */}
      {conversations.length > 0 && (
        <div className="relative mb-4">
          <Search24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={msgs.searchPlaceholder || 'Search conversations...'}
            className="w-full pl-10 pr-4 py-2.5 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      )}

      {/* Conversation List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-th-surface flex items-center justify-center mb-4">
            <Chat24Regular className="w-8 h-8 text-th-text-m" />
          </div>
          <h3 className="text-lg font-medium text-th-text mb-2">
            {msgs.noConversations || 'No conversations yet'}
          </h3>
          <p className="text-th-text-t text-sm mb-6 max-w-sm">
            {msgs.noConversationsDesc || 'Start a conversation with someone in your network'}
          </p>
          <button
            onClick={() => setShowNewMessage(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
          >
            {msgs.startConversation || 'Start Conversation'}
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              onClick={() => router.push(`/messages/${conversation.id}`)}
            />
          ))}
        </div>
      )}

      {/* New Message Modal */}
      {showNewMessage && (
        <NewMessageModal
          onClose={() => setShowNewMessage(false)}
          onSelect={handleNewMessage}
        />
      )}
    </div>
  );
}
