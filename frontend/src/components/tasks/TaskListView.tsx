'use client';

import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import type { Task } from '@/lib/api/tasks';

interface TaskListViewProps {
  tasks: Task[];
  selectedIds: string[];
  onToggleStatus: (task: Task) => void;
  onStatusChange?: (task: Task, status: string) => void;
  onClickTask: (task: Task) => void;
  onSelectTask: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onShare?: (task: Task) => void;
  onAddToCalendar?: (task: Task) => void;
  showSelection: boolean;
}

export function TaskListView({
  tasks,
  selectedIds,
  onToggleStatus,
  onStatusChange,
  onClickTask,
  onSelectTask,
  onDuplicate,
  onDelete,
  onShare,
  onAddToCalendar,
  showSelection,
}: TaskListViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/60">
        <p className="text-sm">No tasks found</p>
      </div>
    );
  }

  // Group by status for better visual organization
  const overdue = tasks.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate) < new Date() &&
      ['PENDING', 'IN_PROGRESS'].includes(t.status)
  );
  const active = tasks.filter(
    (t) =>
      ['PENDING', 'IN_PROGRESS'].includes(t.status) &&
      !overdue.includes(t)
  );
  const done = tasks.filter((t) =>
    ['COMPLETED', 'CANCELLED'].includes(t.status)
  );

  const renderSection = (title: string, items: Task[], className?: string) => {
    if (items.length === 0) return null;
    return (
      <div className={cn('space-y-2', className)}>
        <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide px-1">
          {title} ({items.length})
        </h3>
        {items.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isSelected={selectedIds.includes(task.id)}
            onToggleStatus={onToggleStatus}
            onStatusChange={onStatusChange}
            onClick={onClickTask}
            onSelect={showSelection ? onSelectTask : undefined}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onShare={onShare}
            onAddToCalendar={onAddToCalendar}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderSection('Overdue', overdue)}
      {renderSection('Active', active)}
      {renderSection('Completed', done)}
    </div>
  );
}
