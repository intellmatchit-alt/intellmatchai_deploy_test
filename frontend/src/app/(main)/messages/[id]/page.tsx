/**
 * Chat Conversation Page
 *
 * Real-time messaging with typing indicators, read receipts, pagination,
 * file/image/video attachments, voice recording, emoji picker, reactions,
 * and edit/delete messages.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import {
  ArrowLeft24Regular,
  Send24Filled,
  Checkmark20Regular,
  CheckmarkCircle20Filled,
  Attach24Regular,
  Mic24Regular,
  Stop24Filled,
  Play24Filled,
  Pause24Filled,
  Dismiss24Regular,
  Document24Regular,
  ArrowDownload24Regular,
  Emoji24Regular,
  MoreHorizontal24Regular,
  Edit24Regular,
  Delete24Regular,
  Copy24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import {
  getMessages,
  sendMessage as sendMessageApi,
  markConversationRead,
  toggleReaction as toggleReactionApi,
  editMessage as editMessageApi,
  deleteMessage as deleteMessageApi,
  Message,
  MessageAttachment,
  MessageReaction,
  ConversationUser,
} from '@/lib/api/messages';
import {
  useWebSocket,
  NewMessageEvent,
  MessageReadEvent,
  MessageReactionEvent,
  MessageEditedEvent,
  MessageDeletedEvent,
  TypingEvent,
} from '@/hooks/useWebSocket';
import { useMessageStore } from '@/stores/messageStore';
import { useAuth } from '@/hooks/useAuth';

// ── Constants ────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F525}'];

// ── Helpers ─────────────────────────────────────────────────────────

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function isDifferentDay(a: string, b: string): boolean {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'XLS';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PPT';
  if (mimeType.includes('csv')) return 'CSV';
  if (mimeType.includes('text/plain')) return 'TXT';
  return 'FILE';
}

/** Group reactions by emoji: { emoji, count, users[], hasReacted } */
function groupReactions(reactions: MessageReaction[], currentUserId: string | undefined) {
  const map = new Map<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }>();
  for (const r of reactions) {
    const existing = map.get(r.emoji);
    if (existing) {
      existing.count++;
      existing.users.push(r.user.fullName);
      if (r.userId === currentUserId) existing.hasReacted = true;
    } else {
      map.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        users: [r.user.fullName],
        hasReacted: r.userId === currentUserId,
      });
    }
  }
  return Array.from(map.values());
}

// ── Sub-components ──────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-th-surface-h rounded-2xl rounded-bl-md w-fit">
      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function MessageStatusIcon({ status }: { status: string }) {
  if (status === 'READ') {
    return <CheckmarkCircle20Filled className="w-4 h-4 text-emerald-400" />;
  }
  return <Checkmark20Regular className="w-4 h-4 text-th-text-m" />;
}

/** Voice/Audio player with play/pause, progress bar, duration */
function VoicePlayer({ url, duration: initialDuration }: { url: string; duration?: number | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
        setDuration(audio.duration);
      }
    };
    const onEnded = () => { setIsPlaying(false); setProgress(0); };
    const onLoaded = () => { if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoaded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoaded);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={toggle} className="flex-shrink-0 w-8 h-8 rounded-full bg-th-surface-h flex items-center justify-center hover:bg-white/30 transition-colors">
        {isPlaying ? <Pause24Filled className="w-4 h-4" /> : <Play24Filled className="w-4 h-4" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="h-1 bg-th-surface-h rounded-full overflow-hidden">
          <div className="h-full bg-white/60 rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-[10px] opacity-70">{formatDuration(duration)}</span>
      </div>
    </div>
  );
}

/** Renders a single attachment inside a message bubble */
function AttachmentRenderer({ att, isMine }: { att: MessageAttachment; isMine: boolean }) {
  const mime = att.mimeType;

  if (mime.startsWith('image/')) {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden max-w-[260px]">
        <img src={att.url} alt={att.originalName} className="w-full h-auto rounded-lg" loading="lazy" />
      </a>
    );
  }

  if (mime.startsWith('video/')) {
    return (
      <video src={att.url} controls className="rounded-lg max-w-[260px] max-h-[200px]" preload="metadata" />
    );
  }

  if (mime.startsWith('audio/')) {
    return <VoicePlayer url={att.url} duration={att.duration} />;
  }

  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isMine ? 'bg-th-surface-h' : 'bg-th-surface'} hover:opacity-80 transition-opacity`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${isMine ? 'bg-th-surface-h' : 'bg-emerald-500/20 text-emerald-400'}`}>
        {getFileTypeLabel(mime)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{att.originalName}</p>
        <p className="text-[10px] opacity-60">{formatFileSize(att.size)}</p>
      </div>
      <ArrowDownload24Regular className="w-4 h-4 opacity-60 flex-shrink-0" />
    </a>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const conversationId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<ConversationUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Attachment state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingDurationRef = useRef(0);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Message actions state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [quickReactId, setQuickReactId] = useState<string | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingEmitRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { decrementUnread, setTyping, clearTyping, typingUsers, onlineUsers } = useMessageStore();

  const isTyping = typingUsers.has(conversationId);
  const isOtherOnline = otherUser ? onlineUsers.has(otherUser.id) || otherUser.isOnline : false;

  const msgs = (t as any).messages || {};

  // ── Close menus on outside click ──────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
      // Close quick react and reaction picker if clicking outside
      if (quickReactId || reactionPickerMsgId) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-reaction-area]')) {
          setQuickReactId(null);
          setReactionPickerMsgId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [quickReactId, reactionPickerMsgId]);

  // ── Cleanup file previews ─────────────────────────────────
  useEffect(() => {
    return () => {
      filePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [filePreviews]);

  // ── File selection ────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const maxFiles = 5;
    const combined = [...pendingFiles, ...selected].slice(0, maxFiles);
    setPendingFiles(combined);

    const previews = combined.map((f) =>
      f.type.startsWith('image/') ? URL.createObjectURL(f) : ''
    );
    setFilePreviews(previews);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    setFilePreviews((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ── Voice recording ───────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        setVoiceDuration(recordingDurationRef.current);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          recordingDurationRef.current = d + 1;
          return d + 1;
        });
      }, 1000);
    } catch {
      // Microphone denied or not available
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
  };

  const cancelVoice = () => {
    setVoiceBlob(null);
    setVoiceDuration(0);
  };

  // ── Emoji picker handler ────────────────────────────────────
  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInput((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  // ── Reaction handlers ────────────────────────────────────────
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const result = await toggleReactionApi(conversationId, messageId, emoji);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, reactions: result.reactions } : msg
        )
      );
    } catch {
      // ignore
    }
    setQuickReactId(null);
    setReactionPickerMsgId(null);
  };

  const onReactionEmojiClick = (emojiData: EmojiClickData) => {
    if (reactionPickerMsgId) {
      handleToggleReaction(reactionPickerMsgId, emojiData.emoji);
    }
  };

  // ── Edit/Delete handlers ──────────────────────────────────────
  const startEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditContent(msg.content || '');
    setActiveMenuId(null);
  };

  const cancelEdit = () => {
    setEditingMsgId(null);
    setEditContent('');
  };

  const saveEdit = async () => {
    if (!editingMsgId || !editContent.trim()) return;
    try {
      const updated = await editMessageApi(conversationId, editingMsgId, editContent.trim());
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMsgId
            ? { ...msg, content: updated.content, isEdited: true, editedAt: updated.editedAt }
            : msg
        )
      );
    } catch {
      // ignore
    }
    setEditingMsgId(null);
    setEditContent('');
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm(msgs.deleteConfirm || 'Delete this message?')) return;
    setActiveMenuId(null);
    try {
      await deleteMessageApi(conversationId, messageId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, deletedAt: new Date().toISOString(), content: null }
            : msg
        )
      );
    } catch {
      // ignore
    }
  };

  const handleCopy = (content: string | null) => {
    if (content) navigator.clipboard.writeText(content);
    setActiveMenuId(null);
  };

  // ── WebSocket handlers ────────────────────────────────────
  const onNewMessage = useCallback(
    (event: NewMessageEvent) => {
      if (event.conversationId === conversationId) {
        setMessages((prev) => [...prev, { ...event, reactions: [] } as unknown as Message]);
        markConversationRead(conversationId).then(() => {
          decrementUnread(1);
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    },
    [conversationId, decrementUnread]
  );

  const onMessageRead = useCallback(
    (event: MessageReadEvent) => {
      if (event.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.senderId === user?.id && msg.status !== 'READ'
              ? { ...msg, status: 'READ' as const, readAt: event.readAt }
              : msg
          )
        );
      }
    },
    [conversationId, user?.id]
  );

  const onMessageReaction = useCallback(
    (event: MessageReactionEvent) => {
      if (event.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === event.messageId ? { ...msg, reactions: event.reactions } : msg
          )
        );
      }
    },
    [conversationId]
  );

  const onMessageEdited = useCallback(
    (event: MessageEditedEvent) => {
      if (event.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === event.messageId
              ? { ...msg, content: event.content, isEdited: true, editedAt: event.editedAt }
              : msg
          )
        );
      }
    },
    [conversationId]
  );

  const onMessageDeleted = useCallback(
    (event: MessageDeletedEvent) => {
      if (event.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === event.messageId
              ? { ...msg, deletedAt: event.deletedAt, content: null }
              : msg
          )
        );
      }
    },
    [conversationId]
  );

  const onTypingHandler = useCallback(
    (event: TypingEvent) => {
      if (event.conversationId === conversationId) setTyping(conversationId, event.userId);
    },
    [conversationId, setTyping]
  );

  const onTypingStopHandler = useCallback(
    (event: TypingEvent) => {
      if (event.conversationId === conversationId) clearTyping(conversationId);
    },
    [conversationId, clearTyping]
  );

  const { emitTyping, emitTypingStop } = useWebSocket({
    onNewMessage,
    onMessageRead,
    onMessageReaction,
    onMessageEdited,
    onMessageDeleted,
    onTyping: onTypingHandler,
    onTypingStop: onTypingStopHandler,
  });

  // ── Load messages ─────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await getMessages(conversationId);
        if (!mounted) return;
        setMessages(data.messages);
        setOtherUser(data.otherUser);
        setHasMore(data.hasMore);
        await markConversationRead(conversationId);
        decrementUnread();
      } catch {
        router.push('/messages');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [conversationId, router, decrementUnread]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView();
    }
  }, [loading]);

  // Load older messages
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    try {
      const data = await getMessages(conversationId, { before: messages[0].createdAt });
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
      });
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hasMore, loadingMore, messages]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container && container.scrollTop < 100 && hasMore && !loadingMore) {
      loadMore();
    }
  }, [hasMore, loadingMore, loadMore]);

  // ── Send message ──────────────────────────────────────────
  const handleSend = async () => {
    const content = input.trim();
    const hasFiles = pendingFiles.length > 0;
    const hasVoice = !!voiceBlob;

    if (!content && !hasFiles && !hasVoice) return;
    if (sending) return;

    setInput('');
    setSending(true);

    if (otherUser) emitTypingStop(conversationId, otherUser.id);

    try {
      let msg: Message;

      if (hasVoice) {
        msg = await sendMessageApi(conversationId, {
          content: content || undefined,
          voiceBlob: voiceBlob!,
          voiceDuration,
          messageType: 'VOICE',
        });
        setVoiceBlob(null);
        setVoiceDuration(0);
      } else if (hasFiles) {
        msg = await sendMessageApi(conversationId, {
          content: content || undefined,
          files: pendingFiles,
        });
        setPendingFiles([]);
        setFilePreviews([]);
      } else {
        msg = await sendMessageApi(conversationId, { content });
      }

      setMessages((prev) => [...prev, msg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      if (content) setInput(content);
    } finally {
      setSending(false);
    }
  };

  // ── Typing indicator logic ────────────────────────────────
  const handleInputChange = (value: string) => {
    setInput(value);
    if (!otherUser) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 1000) {
      emitTyping(conversationId, otherUser.id);
      lastTypingEmitRef.current = now;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(conversationId, otherUser.id);
    }, 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = input.trim() || pendingFiles.length > 0 || voiceBlob;

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 10rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-th-border mb-2">
        <button
          onClick={() => router.push('/messages')}
          className="p-1.5 rounded-lg hover:bg-th-surface-h text-th-text-t transition-colors"
        >
          <ArrowLeft24Regular className="w-5 h-5" />
        </button>

        {otherUser && (
          <>
            <div className="relative flex-shrink-0">
              {otherUser.avatarUrl ? (
                <img src={otherUser.avatarUrl} alt={otherUser.fullName} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold text-sm">
                  {otherUser.fullName.charAt(0).toUpperCase()}
                </div>
              )}
              {isOtherOnline && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-th-border" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-th-text truncate">{otherUser.fullName}</h2>
              <p className="text-xs text-th-text-t">
                {isTyping
                  ? msgs.typing || 'typing...'
                  : isOtherOnline
                  ? msgs.online || 'Online'
                  : otherUser.jobTitle
                  ? `${otherUser.jobTitle}${otherUser.company ? ` at ${otherUser.company}` : ''}`
                  : msgs.offline || 'Offline'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4 space-y-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {hasMore && (
          <div className="flex justify-center pb-4">
            {loadingMore ? (
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <button onClick={loadMore} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                {msgs.loadMore || 'Load more messages'}
              </button>
            )}
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-th-text-t text-sm">{msgs.noMessagesDesc || 'Send the first message to start the conversation'}</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMine = msg.senderId === user?.id;
          const showDateSep = idx === 0 || isDifferentDay(messages[idx - 1].createdAt, msg.createdAt);
          const attachments = msg.attachments || [];
          const reactions = msg.reactions || [];
          const isDeleted = !!msg.deletedAt;
          const isEditing = editingMsgId === msg.id;
          const grouped = groupReactions(reactions, user?.id);

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 rounded-full text-xs text-th-text-t bg-th-surface">
                    {formatDateSeparator(msg.createdAt)}
                  </span>
                </div>
              )}

              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 group relative`}>
                {/* Quick reaction bar + context menu (on hover) */}
                {!isDeleted && !isEditing && (
                  <div
                    className={`absolute ${isMine ? 'right-0 -top-8' : 'left-0 -top-8'} hidden group-hover:flex items-center gap-0.5 bg-th-bg-t border border-th-border rounded-lg px-1 py-0.5 z-10 shadow-lg`}
                    data-reaction-area
                  >
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-th-surface-h text-sm transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id);
                        setQuickReactId(null);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-th-surface-h text-xs text-th-text-t transition-colors"
                    >
                      +
                    </button>
                    <div className="w-px h-5 bg-th-surface-h mx-0.5" />
                    <div className="relative" ref={activeMenuId === msg.id ? menuRef : undefined}>
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-th-surface-h text-th-text-t transition-colors"
                      >
                        <MoreHorizontal24Regular className="w-4 h-4" />
                      </button>
                      {activeMenuId === msg.id && (
                        <div className={`absolute ${isMine ? 'right-0' : 'left-0'} top-full mt-1 bg-th-bg-t border border-th-border rounded-lg shadow-xl z-20 py-1 min-w-[140px]`}>
                          {isMine && msg.messageType === 'TEXT' && !isDeleted && (
                            <button
                              onClick={() => startEdit(msg)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-200 hover:bg-th-surface-h transition-colors"
                            >
                              <Edit24Regular className="w-4 h-4" />
                              {msgs.editMessage || 'Edit'}
                            </button>
                          )}
                          {isMine && !isDeleted && (
                            <button
                              onClick={() => handleDelete(msg.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-th-surface-h transition-colors"
                            >
                              <Delete24Regular className="w-4 h-4" />
                              {msgs.deleteMessage || 'Delete'}
                            </button>
                          )}
                          {msg.content && !isDeleted && (
                            <button
                              onClick={() => handleCopy(msg.content)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-200 hover:bg-th-surface-h transition-colors"
                            >
                              <Copy24Regular className="w-4 h-4" />
                              {msgs.copyMessage || 'Copy'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reaction picker overlay */}
                {reactionPickerMsgId === msg.id && (
                  <div
                    className={`absolute ${isMine ? 'right-0' : 'left-0'} bottom-full mb-2 z-30`}
                    data-reaction-area
                  >
                    <EmojiPicker
                      theme={Theme.DARK}
                      onEmojiClick={onReactionEmojiClick}
                      width={300}
                      height={350}
                      searchDisabled={false}
                      skinTonesDisabled
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                )}

                <div className="max-w-[75%]">
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isDeleted
                        ? 'bg-th-surface text-th-text-m'
                        : isMine
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-br-md'
                        : 'bg-th-surface-h text-th-text rounded-bl-md'
                    }`}
                  >
                    {isDeleted ? (
                      <p className="text-sm italic">{msgs.messageDeleted || 'This message was deleted'}</p>
                    ) : isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-th-surface-h border border-white/20 rounded-lg px-3 py-2 text-sm text-th-text focus:outline-none focus:border-emerald-400 resize-none"
                          rows={2}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={cancelEdit} className="px-3 py-1 text-xs rounded-lg hover:bg-th-surface-h text-th-text-s transition-colors">
                            {msgs.cancel || 'Cancel'}
                          </button>
                          <button
                            onClick={saveEdit}
                            disabled={!editContent.trim()}
                            className="px-3 py-1 text-xs rounded-lg bg-th-surface-h hover:bg-white/30 text-th-text disabled:opacity-50 transition-colors flex items-center gap-1"
                          >
                            <Checkmark24Regular className="w-3 h-3" />
                            {msgs.save || 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Attachments */}
                        {attachments.length > 0 && (
                          <div className="space-y-2 mb-1">
                            {attachments.map((att) => (
                              <AttachmentRenderer key={att.id} att={att} isMine={isMine} />
                            ))}
                          </div>
                        )}
                        {/* Text content */}
                        {msg.content && (
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                        {/* Time + edited + status */}
                        <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {msg.isEdited && (
                            <span className={`text-[10px] italic ${isMine ? 'text-th-text/50' : 'text-th-text-m'}`}>
                              {msgs.edited || 'edited'}
                            </span>
                          )}
                          <span className={`text-[10px] ${isMine ? 'text-th-text/60' : 'text-th-text-m'}`}>
                            {formatMessageTime(msg.createdAt)}
                          </span>
                          {isMine && <MessageStatusIcon status={msg.status} />}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Reactions row */}
                  {!isDeleted && grouped.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                      {grouped.map((g) => (
                        <button
                          key={g.emoji}
                          onClick={() => handleToggleReaction(msg.id, g.emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                            g.hasReacted
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                          }`}
                          title={g.users.join(', ')}
                        >
                          <span>{g.emoji}</span>
                          {g.count > 1 && <span>{g.count}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start mb-1">
            <TypingDots />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachment preview bar */}
      {pendingFiles.length > 0 && (
        <div className="px-2 py-2 border-t border-th-border flex gap-2 overflow-x-auto">
          {pendingFiles.map((file, idx) => (
            <div key={idx} className="relative flex-shrink-0 group">
              {file.type.startsWith('image/') && filePreviews[idx] ? (
                <img src={filePreviews[idx]} alt="" className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-th-surface-h flex flex-col items-center justify-center">
                  <Document24Regular className="w-5 h-5 text-th-text-t" />
                  <span className="text-[9px] text-th-text-t mt-0.5 truncate max-w-[56px]">{getFileTypeLabel(file.type)}</span>
                </div>
              )}
              <button
                onClick={() => removeFile(idx)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Dismiss24Regular className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Voice recording preview */}
      {voiceBlob && !isRecording && (
        <div className="px-2 py-2 border-t border-th-border flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-th-surface rounded-xl">
            <Mic24Regular className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-th-text-s">{msgs.voiceMessage || 'Voice message'}</span>
            <span className="text-xs text-th-text-m">{formatDuration(voiceDuration)}</span>
          </div>
          <button onClick={cancelVoice} className="p-1.5 rounded-lg hover:bg-th-surface-h text-th-text-t">
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="px-2 py-3 border-t border-th-border flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-red-400 font-medium">{msgs.recording || 'Recording'}</span>
          <span className="text-sm text-th-text-t">{formatDuration(recordingDuration)}</span>
          <div className="flex-1" />
          <button
            onClick={stopRecording}
            className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <Stop24Filled className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Input bar */}
      {!isRecording && (
        <div className="pt-2 border-t border-th-border relative">
          {/* Emoji picker overlay */}
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-full mb-2 left-0 z-30">
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={onEmojiClick}
                width={320}
                height={400}
                searchDisabled={false}
                skinTonesDisabled
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-colors"
            >
              <Attach24Regular className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Emoji button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${
                showEmojiPicker
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
              }`}
            >
              <Emoji24Regular className="w-5 h-5" />
            </button>

            {/* Text input */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={msgs.typePlaceholder || 'Type a message...'}
              rows={1}
              className="flex-1 px-4 py-2.5 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/50 resize-none max-h-32"
              style={{ minHeight: '44px' }}
            />

            {/* Mic / Send button */}
            {hasContent ? (
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                <Send24Filled className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-colors"
              >
                <Mic24Regular className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
