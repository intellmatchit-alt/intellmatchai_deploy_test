'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  TaskListSquareLtr24Regular,
  CheckmarkCircle24Regular,
  Warning24Regular,
  ArrowRight24Regular,
  Clock24Regular,
} from '@fluentui/react-icons';
import { getTaskStats, getTasks, updateTaskStatus, type Task, type TaskStats } from '@/lib/api/tasks';

type TabKey = 'today' | 'thisWeek' | 'overdue';

export function TaskWidget() {
  const { t } = useI18n();
  const tw = t.dashboard.taskWidget;

  const [stats, setStats] = useState<TaskStats | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [tasksByTab, setTasksByTab] = useState<Record<TabKey, Task[]>>({
    today: [],
    thisWeek: [],
    overdue: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, todayRes, weekRes, overdueRes] = await Promise.all([
          getTaskStats(),
          getTasks({ filter: 'today', limit: 5 }),
          getTasks({ filter: 'thisWeek', limit: 5 }),
          getTasks({ filter: 'overdue', limit: 5 }),
        ]);
        setStats(s);
        setTasksByTab({
          today: todayRes.tasks,
          thisWeek: weekRes.tasks,
          overdue: overdueRes.tasks,
        });
        // Auto-select overdue tab if there are overdue tasks but none today
        if (overdueRes.tasks.length > 0 && todayRes.tasks.length === 0) {
          setActiveTab('overdue');
        }
      } catch (e) {
        console.error('Failed to load task widget', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleComplete = async (task: Task) => {
    try {
      await updateTaskStatus(task.id, 'COMPLETED');
      setTasksByTab((prev) => ({
        today: prev.today.filter((t) => t.id !== task.id),
        thisWeek: prev.thisWeek.filter((t) => t.id !== task.id),
        overdue: prev.overdue.filter((t) => t.id !== task.id),
      }));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              today: Math.max(0, prev.today - 1),
              completed: prev.completed + 1,
              pending: Math.max(0, prev.pending - 1),
              overdue: task.dueDate && new Date(task.dueDate) < new Date() ? Math.max(0, prev.overdue - 1) : prev.overdue,
            }
          : null
      );
    } catch (e) {
      console.error('Failed to complete task', e);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-th-border bg-th-surface p-4">
        <div className="h-24 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const currentTasks = tasksByTab[activeTab];

  const tabs: { key: TabKey; label: string; count: number; color: string }[] = [
    { key: 'today', label: tw?.today || 'Today', count: stats.today, color: 'text-blue-400' },
    { key: 'thisWeek', label: tw?.thisWeek || 'This Week', count: stats.thisWeek, color: 'text-emerald-400' },
    { key: 'overdue', label: tw?.overdue || 'Overdue', count: stats.overdue, color: 'text-red-400' },
  ];

  const formatDueDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return tw?.today || 'Today';
    if (diff === 1) return tw?.tomorrow || 'Tomorrow';
    if (diff < 0) return (tw?.daysOverdue || '{n}d overdue').replace('{n}', String(Math.abs(diff)));
    if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-2xl border border-th-border bg-th-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <TaskListSquareLtr24Regular className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-th-text">{tw?.tasks || 'Tasks'}</h3>
        </div>
        <Link
          href="/tasks"
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {tw?.viewAll || 'View all'}
          <ArrowRight24Regular className="w-3.5 h-3.5 rtl:rotate-180" />
        </Link>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 px-4 pb-2">
        {stats.overdue > 0 && (
          <div className="flex items-center gap-1">
            <Warning24Regular className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-medium text-red-400">{stats.overdue} {tw?.overdueCount || 'overdue'}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="text-xs text-th-text-m">{stats.today} {tw?.todayCount || 'today'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-th-text-m">{completionRate}% {tw?.done || 'done'}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 bg-th-surface-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-t border-th-border/50">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-2 text-xs font-medium text-center transition-colors border-b-2',
              activeTab === tab.key
                ? `${tab.color} border-current`
                : 'text-th-text-m border-transparent hover:text-th-text-s'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                'ms-1 px-1.5 py-0.5 rounded-full text-[10px]',
                activeTab === tab.key ? 'bg-current/10' : 'bg-th-surface-hover'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      {currentTasks.length > 0 ? (
        <div>
          {currentTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-th-hover transition-colors"
            >
              <button
                onClick={() => handleComplete(task)}
                className="text-white/60 hover:text-green-400 transition-colors flex-shrink-0"
              >
                <CheckmarkCircle24Regular className="w-4.5 h-4.5" />
              </button>
              <Link href="/tasks" className="flex-1 min-w-0">
                <p className="text-sm text-th-text truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.contact && (
                    <span className="text-[10px] text-th-text-t">{task.contact.fullName}</span>
                  )}
                  {task.dueDate && (
                    <span className={cn(
                      'flex items-center gap-0.5 text-[10px]',
                      activeTab === 'overdue' ? 'text-red-400' : 'text-th-text-t'
                    )}>
                      <Clock24Regular className="w-2.5 h-2.5" />
                      {formatDueDate(task.dueDate)}
                    </span>
                  )}
                </div>
              </Link>
              <span
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  task.priority === 'URGENT' && 'bg-red-500',
                  task.priority === 'HIGH' && 'bg-red-400',
                  task.priority === 'MEDIUM' && 'bg-orange-400',
                  task.priority === 'LOW' && 'bg-green-400'
                )}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center">
          <p className="text-xs text-th-text-t">
            {activeTab === 'today' && (tw?.noTasksToday || 'No tasks due today')}
            {activeTab === 'thisWeek' && (tw?.noTasksThisWeek || 'No tasks this week')}
            {activeTab === 'overdue' && (tw?.noOverdueTasks || 'No overdue tasks')}
          </p>
        </div>
      )}
    </div>
  );
}
