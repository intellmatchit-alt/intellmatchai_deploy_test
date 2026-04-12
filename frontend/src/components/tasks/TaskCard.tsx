'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  Flag24Regular,
  CheckmarkCircle24Regular,
  CheckmarkCircle24Filled,
  Person24Regular,
  Clock24Regular,
  Tag24Regular,
  ArrowRepeatAll24Regular,
} from '@fluentui/react-icons';
import type { Task } from '@/lib/api/tasks';
import { updateTaskStatus } from '@/lib/api/tasks';
import { TaskCardMenu } from './TaskCardMenu';

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'text-red-500',
  HIGH: 'text-red-400',
  MEDIUM: 'text-orange-400',
  LOW: 'text-green-400',
};

const PRIORITY_BG: Record<string, string> = {
  URGENT: 'bg-red-600/15 border-red-600/30',
  HIGH: 'bg-red-500/15 border-red-500/30',
  MEDIUM: 'bg-orange-500/15 border-orange-500/30',
  LOW: 'bg-green-500/15 border-green-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-white/60',
  IN_PROGRESS: 'text-blue-400',
  COMPLETED: 'text-green-400',
  CANCELLED: 'text-red-400/50',
};

function TaskStatusSelector({ status, onStatusChange }: { status: string; onStatusChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const statuses = [
    { value: 'PENDING', label: 'Pending', color: 'bg-white/20 text-white/80' },
    { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500/20 text-blue-400' },
    { value: 'COMPLETED', label: 'Completed', color: 'bg-emerald-500/20 text-emerald-400' },
    { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
  ];

  const current = statuses.find(s => s.value === status) || statuses[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/10 ${current.color} hover:opacity-80 transition-all`}
      >
        {current.label}
      </button>
      {open && (
        <div className="absolute top-full mt-1 start-0 z-30 w-36 bg-[#1e1e2e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
          {statuses.map(s => (
            <button
              key={s.value}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStatusChange(s.value); setOpen(false); }}
              className={`w-full px-3 py-2 text-xs text-start hover:bg-white/5 transition-colors ${status === s.value ? 'bg-white/5 font-semibold' : ''} ${s.color}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  isSelected?: boolean;
  onToggleStatus?: (task: Task) => void;
  onStatusChange?: (task: Task, status: string) => void;
  onClick?: (task: Task) => void;
  onSelect?: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onShare?: (task: Task) => void;
  onAddToCalendar?: (task: Task) => void;
  compact?: boolean;
}

export function TaskCard({
  task,
  isSelected,
  onToggleStatus,
  onStatusChange,
  onClick,
  onSelect,
  onDuplicate,
  onDelete,
  onShare,
  onAddToCalendar,
  compact,
}: TaskCardProps) {
  const { t } = useI18n();
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    !['COMPLETED', 'CANCELLED'].includes(task.status);
  const isCompleted = task.status === 'COMPLETED';
  const isCancelled = task.status === 'CANCELLED';

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const taskDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (taskDate.getTime() === today.getTime()) return 'Today';
    if (taskDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

    const diff = taskDate.getTime() - today.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)}d ago`;
    if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });

    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (d.getHours() === 0 && d.getMinutes() === 0) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={cn(
        'group relative rounded-xl border transition-all duration-200',
        'hover:shadow-md cursor-pointer',
        isSelected
          ? 'border-emerald-500/50 bg-emerald-500/10'
          : 'border-th-border bg-th-surface',
        isOverdue && !isCompleted && 'border-red-500/30',
        (isCompleted || isCancelled) && 'opacity-60'
      )}
      onClick={() => onClick?.(task)}
    >
      <div className={cn('p-3', compact && 'p-2.5')}>
        <div className="flex items-start gap-2.5">
          {/* Status indicator */}
          {onStatusChange ? (
            <div className="mt-0.5 flex-shrink-0">
              <TaskStatusSelector
                status={task.status}
                onStatusChange={(newStatus) => onStatusChange(task, newStatus)}
              />
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus?.(task);
              }}
              className={cn(
                'mt-0.5 flex-shrink-0 transition-colors',
                STATUS_COLORS[task.status],
                'hover:text-green-400'
              )}
            >
              {isCompleted ? (
                <CheckmarkCircle24Filled className="w-5 h-5" />
              ) : (
                <CheckmarkCircle24Regular className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  'text-sm font-medium text-white truncate',
                  isCompleted && 'line-through text-white/50'
                )}
              >
                {task.title}
              </h3>
            </div>

            {task.description && !compact && (
              <p className="text-xs text-white/60 mt-0.5 line-clamp-1">
                {task.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {/* Priority */}
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-[10px] font-medium',
                  PRIORITY_COLORS[task.priority]
                )}
              >
                <Flag24Regular className="w-3 h-3" />
                {task.priority}
              </span>

              {/* Due date */}
              {task.dueDate && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-[10px]',
                    isOverdue ? 'text-red-400 font-medium' : 'text-white/50'
                  )}
                >
                  <Clock24Regular className="w-3 h-3" />
                  {formatDate(task.dueDate)}
                  {formatTime(task.dueDate) && ` ${formatTime(task.dueDate)}`}
                </span>
              )}

              {/* Contact */}
              {task.contact && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-white/50">
                  <Person24Regular className="w-3 h-3" />
                  {task.contact.fullName}
                </span>
              )}

              {/* Category */}
              {task.category && (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${task.categoryColor || '#6b7280'}20`,
                    color: task.categoryColor || '#6b7280',
                  }}
                >
                  <Tag24Regular className="w-3 h-3" />
                  {task.category}
                </span>
              )}

              {/* Recurrence indicator */}
              {task.recurrence && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400" title={`Repeats ${task.recurrence.pattern.toLowerCase()}`}>
                  <ArrowRepeatAll24Regular className="w-3 h-3" />
                </span>
              )}

              {/* Assigned user */}
              {task.assignedTo && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-400">
                  <Person24Regular className="w-3 h-3" />
                  {task.assignedTo.fullName}
                </span>
              )}
            </div>

            {/* Assignee avatars */}
            {(task as any).assignees && (task as any).assignees.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {(task as any).assignees.slice(0, 3).map((a: any) => (
                  <div key={a.contactId} className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[8px] font-bold text-emerald-400" title={a.contact?.fullName}>
                    {(a.contact?.fullName || '?')[0]}
                  </div>
                ))}
                {(task as any).assignees.length > 3 && (
                  <span className="text-[10px] text-white/50">+{(task as any).assignees.length - 3}</span>
                )}
              </div>
            )}
          </div>

          {/* Options menu */}
          {(onDuplicate || onDelete) && (
            <TaskCardMenu
              onEdit={() => onClick?.(task)}
              onDuplicate={() => onDuplicate?.(task)}
              onDelete={() => onDelete?.(task)}
              onShare={() => onShare?.(task)}
              onAddToCalendar={onAddToCalendar ? () => onAddToCalendar(task) : undefined}
            />
          )}

          {/* Selection checkbox for bulk */}
          {onSelect && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(task);
              }}
              className={cn(
                'w-5 h-5 rounded border-2 flex-shrink-0 transition-colors',
                isSelected
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-th-border hover:border-emerald-400'
              )}
            >
              {isSelected && (
                <svg className="w-full h-full text-white" viewBox="0 0 16 16" fill="none">
                  <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
