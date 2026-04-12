'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Add24Regular,
} from '@fluentui/react-icons';
import { TaskCard } from './TaskCard';
import type { Task } from '@/lib/api/tasks';

interface TaskCalendarViewProps {
  tasks: Task[];
  onClickTask: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  onAddTask?: (date: string) => void;
  onShare?: (task: Task) => void;
  view?: 'month' | 'week';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TaskCalendarView({
  tasks,
  onClickTask,
  onToggleStatus,
  onAddTask,
  onShare,
  view = 'month',
}: TaskCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      const dateStr = task.dueDate
        ? new Date(task.dueDate).toISOString().split('T')[0]
        : null;
      if (dateStr) {
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(task);
      }
    }
    return map;
  }, [tasks]);

  // Calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }
  // Pad last week
  while (weeks.length > 0 && weeks[weeks.length - 1].length < 7) {
    weeks[weeks.length - 1].push(null);
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(todayStr);
  };

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const selectedTasks = selectedDate ? tasksByDate[selectedDate] || [] : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-th-hover text-white/50"
          >
            <ChevronLeft24Regular className="w-5 h-5" />
          </button>
          <h3 className="text-base font-semibold text-white min-w-[140px] text-center">
            {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-th-hover text-white/50"
          >
            <ChevronRight24Regular className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10"
        >
          Today
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-th-border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-th-surface-hover">
          {DAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-[10px] font-medium text-white/50 uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-t border-th-border/50">
            {week.map((day, di) => {
              if (day === null) {
                return <div key={di} className="min-h-[60px] bg-th-surface/50" />;
              }

              const dateStr = getDateStr(day);
              const dayTasks = tasksByDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const hasOverdue = dayTasks.some(
                (t) =>
                  new Date(t.dueDate!) < new Date() &&
                  ['PENDING', 'IN_PROGRESS'].includes(t.status)
              );

              return (
                <button
                  key={di}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    'min-h-[60px] p-1 text-left transition-colors relative',
                    'hover:bg-th-hover',
                    isSelected && 'bg-emerald-500/10',
                    isToday && 'bg-blue-500/5'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-6 h-6 text-xs rounded-full',
                      isToday && 'bg-emerald-500 text-white font-bold',
                      isSelected && !isToday && 'bg-emerald-500/30 text-emerald-300'
                    )}
                  >
                    {day}
                  </span>
                  {/* Dot indicators */}
                  {dayTasks.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 px-0.5">
                      {dayTasks.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            t.status === 'COMPLETED'
                              ? 'bg-green-400'
                              : hasOverdue
                              ? 'bg-red-400'
                              : 'bg-blue-400'
                          )}
                        />
                      ))}
                      {dayTasks.length > 3 && (
                        <span className="text-[8px] text-white/60">+{dayTasks.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected date tasks */}
      {selectedDate && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              <span className="ml-2 text-xs text-white/50">
                ({selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''})
              </span>
            </h4>
            {onAddTask && (
              <button
                onClick={() => onAddTask(selectedDate)}
                className="p-1.5 rounded-lg hover:bg-th-hover text-emerald-400"
              >
                <Add24Regular className="w-5 h-5" />
              </button>
            )}
          </div>
          {selectedTasks.length > 0 ? (
            <div className="space-y-2">
              {selectedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={onClickTask}
                  onToggleStatus={onToggleStatus}
                  compact
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/60 py-4 text-center">No tasks on this date</p>
          )}
        </div>
      )}
    </div>
  );
}
