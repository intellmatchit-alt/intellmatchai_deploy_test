'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import {
  Dismiss24Regular,
  Edit24Regular,
  Send24Regular,
  Clock24Regular,
  Person24Regular,
  Flag24Regular,
  Chat24Regular,
  History24Regular,
  ArrowRepeatAll24Regular,
  Tag24Regular,
  Delete24Regular,
  CheckmarkCircle24Regular,
  Add24Regular,
} from '@fluentui/react-icons';
import type { Task, TaskComment, TaskActivityEntry } from '@/lib/api/tasks';
import { getTaskComments, addTaskComment, deleteTaskComment, getTaskActivity } from '@/lib/api/tasks';

interface TaskDetailPanelProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'text-red-500 bg-red-500/15 border-red-500/30',
  HIGH: 'text-red-400 bg-red-400/15 border-red-400/30',
  MEDIUM: 'text-orange-400 bg-orange-400/15 border-orange-400/30',
  LOW: 'text-green-400 bg-green-400/15 border-green-400/30',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-white/60 bg-white/10 border-white/20',
  IN_PROGRESS: 'text-blue-400 bg-blue-400/15 border-blue-400/30',
  COMPLETED: 'text-green-400 bg-green-400/15 border-green-400/30',
  CANCELLED: 'text-red-400/60 bg-red-400/10 border-red-400/20',
};

const ACTIVITY_ICONS: Record<string, typeof CheckmarkCircle24Regular> = {
  created: Add24Regular,
  updated: Edit24Regular,
  status_changed: CheckmarkCircle24Regular,
  commented: Chat24Regular,
  assigned: Person24Regular,
};

export function TaskDetailPanel({ task, isOpen, onClose, onEdit }: TaskDetailPanelProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivityEntry[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task && isOpen) {
      fetchComments();
      fetchActivity();
    }
  }, [task?.id, isOpen]);

  const fetchComments = async () => {
    if (!task) return;
    setLoadingComments(true);
    try {
      const data = await getTaskComments(task.id);
      setComments(data);
    } catch (e) {
      console.error('Failed to fetch comments', e);
    } finally {
      setLoadingComments(false);
    }
  };

  const fetchActivity = async () => {
    if (!task) return;
    setLoadingActivity(true);
    try {
      const data = await getTaskActivity(task.id);
      setActivity(data);
    } catch (e) {
      console.error('Failed to fetch activity', e);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleAddComment = async () => {
    if (!task || !commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addTaskComment(task.id, commentText.trim());
      setCommentText('');
      fetchComments();
      fetchActivity();
    } catch (e) {
      console.error('Failed to add comment', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!task) return;
    try {
      await deleteTaskComment(task.id, commentId);
      fetchComments();
    } catch (e) {
      console.error('Failed to delete comment', e);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelative = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const getActivityLabel = (action: string) => {
    const tp = (t as any).tasksPage;
    switch (action) {
      case 'created': return tp?.activityCreated || 'created the task';
      case 'updated': return tp?.activityUpdated || 'updated the task';
      case 'status_changed': return tp?.activityStatusChanged || 'changed status';
      case 'assigned': return tp?.activityAssigned || 'assigned the task';
      case 'commented': return tp?.activityCommented || 'left a comment';
      default: return action;
    }
  };

  if (!isOpen || !task) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-14 bottom-0 w-full max-w-md z-50 bg-th-bg border-l border-th-border shadow-2xl flex flex-col animate-slide-in-right pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-th-border">
          <h2 className="text-lg font-semibold text-white truncate flex-1 mr-2">
            {task.title}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(task)}
              className="p-2 rounded-lg hover:bg-th-hover text-white/50 transition-colors"
              title="Edit"
            >
              <Edit24Regular className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-th-hover text-white/50 transition-colors"
            >
              <Dismiss24Regular className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Task Details */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Status & Priority badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-lg border',
                STATUS_COLORS[task.status]
              )}>
                {task.status.replace('_', ' ')}
              </span>
              <span className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-lg border inline-flex items-center gap-1',
                PRIORITY_COLORS[task.priority]
              )}>
                <Flag24Regular className="w-3 h-3" />
                {task.priority}
              </span>
            </div>

            {/* Description */}
            {task.description && (
              <div>
                <p className="text-sm text-white/50 leading-relaxed">
                  {task.description}
                </p>
              </div>
            )}

            {/* Meta fields */}
            <div className="space-y-2.5">
              {task.dueDate && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Clock24Regular className="w-4 h-4 text-white/50 flex-shrink-0" />
                  <span className="text-white/50">Due:</span>
                  <span className="text-white">
                    {formatDate(task.dueDate)}
                    {new Date(task.dueDate).getHours() !== 0 && ` at ${formatTime(task.dueDate)}`}
                  </span>
                </div>
              )}

              {task.contact && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Person24Regular className="w-4 h-4 text-white/50 flex-shrink-0" />
                  <span className="text-white/50">Contact:</span>
                  <span className="text-white">{task.contact.fullName}</span>
                </div>
              )}

              {task.assignedTo && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Person24Regular className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-white/50">Assigned to:</span>
                  <span className="text-white">{task.assignedTo.fullName}</span>
                </div>
              )}

              {task.category && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Tag24Regular className="w-4 h-4 text-white/50 flex-shrink-0" />
                  <span
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{
                      backgroundColor: `${task.categoryColor || '#6b7280'}20`,
                      color: task.categoryColor || '#6b7280',
                    }}
                  >
                    {task.category}
                  </span>
                </div>
              )}

              {task.recurrence && (
                <div className="flex items-center gap-2.5 text-sm">
                  <ArrowRepeatAll24Regular className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-white/50">Repeats:</span>
                  <span className="text-white">
                    {task.recurrence.pattern.charAt(0) + task.recurrence.pattern.slice(1).toLowerCase()}
                    {task.recurrence.interval > 1 && ` (every ${task.recurrence.interval})`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t border-th-border">
            <div className="flex">
              <button
                onClick={() => setActiveTab('comments')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'comments'
                    ? 'text-emerald-400 border-emerald-400'
                    : 'text-white/50 border-transparent hover:text-white'
                )}
              >
                <Chat24Regular className="w-4 h-4" />
                {(t as any).tasksPage?.comments || 'Comments'}
                {comments.length > 0 && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                    {comments.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'activity'
                    ? 'text-emerald-400 border-emerald-400'
                    : 'text-white/50 border-transparent hover:text-white'
                )}
              >
                <History24Regular className="w-4 h-4" />
                {(t as any).tasksPage?.activity || 'Activity'}
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className="p-4">
            {activeTab === 'comments' && (
              <div className="space-y-3">
                {loadingComments ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-white/60 text-center py-8">
                    {(t as any).tasksPage?.detail?.noComments || 'No comments yet'}
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="group/comment p-3 rounded-xl bg-th-surface border border-th-border">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-white">
                              {comment.user?.fullName?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-white truncate">
                            {comment.user?.fullName || 'Unknown'}
                          </span>
                          <span className="text-[10px] text-white/60 flex-shrink-0">
                            {formatRelative(comment.createdAt)}
                          </span>
                        </div>
                        {user?.id === comment.userId && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="opacity-0 group-hover/comment:opacity-100 p-1 rounded hover:bg-red-500/10 text-white/60 hover:text-red-400 transition-all"
                          >
                            <Delete24Regular className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-white mt-1.5 pl-8">
                        {comment.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-3">
                {loadingActivity ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  </div>
                ) : activity.length === 0 ? (
                  <p className="text-sm text-white/60 text-center py-8">
                    {(t as any).tasksPage?.detail?.noActivity || 'No activity yet'}
                  </p>
                ) : (
                  activity.map((entry) => {
                    const IconComp = ACTIVITY_ICONS[entry.action] || History24Regular;
                    return (
                      <div key={entry.id} className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-th-surface border border-th-border flex items-center justify-center flex-shrink-0 mt-0.5">
                          <IconComp className="w-3.5 h-3.5 text-white/50" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white">
                            <span className="font-medium">{entry.user?.fullName || 'Unknown'}</span>{' '}
                            <span className="text-white/50">{getActivityLabel(entry.action)}</span>
                          </p>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <p className="text-xs text-white/60 mt-0.5">
                              {JSON.stringify(entry.details)}
                            </p>
                          )}
                          <p className="text-[10px] text-white/60 mt-0.5">
                            {formatRelative(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Comment Input (always visible at bottom when on comments tab) */}
        {activeTab === 'comments' && (
          <div className="border-t border-th-border p-3">
            <div className="flex items-center gap-2">
              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                placeholder={(t as any).tasksPage?.commentPlaceholder || 'Write a comment...'}
                className="flex-1 px-3 py-2 bg-white/[0.03] border border-th-border rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || submitting}
                className={cn(
                  'p-2 rounded-xl transition-colors',
                  commentText.trim()
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-th-surface text-white/60 border border-th-border'
                )}
              >
                <Send24Regular className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
