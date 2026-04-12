'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import type { Task } from '@/lib/api/tasks';

const COLUMNS = [
  { id: 'OVERDUE', label: 'Overdue', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { id: 'PENDING', label: 'To Do', color: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { id: 'COMPLETED', label: 'Done', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  { id: 'CANCELLED', label: 'Cancelled', color: 'text-red-400/60', bg: 'bg-red-500/5', border: 'border-red-500/10' },
];

interface TaskKanbanViewProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: string) => void;
  onClickTask: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  onShare?: (task: Task) => void;
}

function KanbanColumn({
  column,
  tasks,
  onClickTask,
  onToggleStatus,
}: {
  column: typeof COLUMNS[0];
  tasks: Task[];
  onClickTask: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[260px] max-w-[320px] flex-1 rounded-xl border transition-colors',
        column.border,
        isOver ? 'bg-emerald-500/10 border-emerald-500/30' : column.bg
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-th-border/50">
        <span className={cn('text-sm font-semibold', column.color)}>
          {column.label}
        </span>
        <span className="text-xs text-white/60 bg-th-surface-hover px-1.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
        {tasks.map((task) => (
          <div
            key={task.id}
            data-task-id={task.id}
            className="cursor-grab active:cursor-grabbing"
          >
            <TaskCard
              task={task}
              onClick={onClickTask}
              onToggleStatus={onToggleStatus}
              compact
            />
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center py-8 text-xs text-white/60">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskKanbanView({
  tasks,
  onStatusChange,
  onClickTask,
  onToggleStatus,
  onShare,
}: TaskKanbanViewProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const now = new Date();
  const tasksByStatus: Record<string, Task[]> = {};
  for (const col of COLUMNS) {
    if (col.id === 'OVERDUE') {
      tasksByStatus[col.id] = tasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < now &&
          (t.status === 'PENDING' || t.status === 'IN_PROGRESS')
      );
    } else {
      tasksByStatus[col.id] = tasks.filter((t) => {
        if (t.status !== col.id) return false;
        // Exclude overdue tasks from their normal column
        if (
          (col.id === 'PENDING' || col.id === 'IN_PROGRESS') &&
          t.dueDate &&
          new Date(t.dueDate) < now
        ) {
          return false;
        }
        return true;
      });
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = String(event.active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = String(active.id);
    const newStatus = String(over.id);

    // Only trigger if dropping on a valid status column (not OVERDUE — it's virtual)
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (validStatuses.includes(newStatus)) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== newStatus) {
        onStatusChange(taskId, newStatus);
      }
    }
  };

  // Find task element from pointer for drag
  const findTaskFromEvent = (element: HTMLElement | null): string | null => {
    while (element) {
      const taskId = element.getAttribute?.('data-task-id');
      if (taskId) return taskId;
      element = element.parentElement;
    }
    return null;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByStatus[col.id]}
            onClickTask={onClickTask}
            onToggleStatus={onToggleStatus}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="opacity-80 rotate-2 scale-105">
            <TaskCard task={activeTask} compact />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
