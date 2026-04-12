'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useTaskStore } from '@/stores/taskStore';
import {
  Add24Regular,
  List24Regular,
  Board24Regular,
  CalendarLtr24Regular,
  Search24Regular,
  Filter24Regular,
  Dismiss24Regular,
  CheckmarkCircle24Regular,
  Clock24Regular,
  Warning24Regular,
  TaskListSquareLtr24Regular,
  Flag24Regular,
  Person24Regular,
  Share24Regular,
} from '@fluentui/react-icons';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  bulkUpdateTasks,
  getTaskStats,
  getTaskCategories,
  getSharedWithMe,
  type Task,
  type TaskInput,
  type TaskStats,
  type TaskCategory,
  type TaskShare,
} from '@/lib/api/tasks';
import { api } from '@/lib/api/client';
import { TaskListView } from '@/components/tasks/TaskListView';
import { TaskKanbanView } from '@/components/tasks/TaskKanbanView';
import { TaskCalendarView } from '@/components/tasks/TaskCalendarView';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { BulkActionBar } from '@/components/tasks/BulkActionBar';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { addTaskReminder, deleteTaskReminder } from '@/lib/api/tasks';
import { ShareTaskModal } from '@/components/tasks/ShareTaskModal';
import { TaskCard } from '@/components/tasks/TaskCard';

export default function TasksPage() {
  const { t } = useI18n();
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    selectedTaskIds,
    setSelectedTaskIds,
    toggleTaskSelection,
    clearSelection,
    filterStatus,
    setFilterStatus,
    filterPriority,
    setFilterPriority,
    filterCategory,
    setFilterCategory,
    filterPreset,
    setFilterPreset,
    clearFilters,
  } = useTaskStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [defaultDate, setDefaultDate] = useState<string>('');
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [shareTask, setShareTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<'myTasks' | 'sharedWithMe'>('myTasks');
  const [sharedTasks, setSharedTasks] = useState<TaskShare[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [showAssignedToMe, setShowAssignedToMe] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [prefillData, setPrefillData] = useState<Partial<TaskInput> | null>(null);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const filters: Record<string, any> = { page, limit: 100 };
      if (filterStatus) filters.status = filterStatus;
      if (filterPriority) filters.priority = filterPriority;
      if (filterCategory) filters.category = filterCategory;
      if (filterPreset) filters.filter = filterPreset;
      if (searchQuery) filters.search = searchQuery;
      if (showAssignedToMe) filters.assignedTo = 'me';

      const res = await getTasks(filters);
      setTasks(res.tasks);
      setTotalPages(res.totalPages);
    } catch (e) {
      console.error('Failed to fetch tasks', e);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterPriority, filterCategory, filterPreset, searchQuery, showAssignedToMe]);

  const fetchStats = useCallback(async () => {
    try {
      const s = await getTaskStats();
      setStats(s);
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await getTaskCategories();
      setCategories(cats);
    } catch (e) {
      console.error('Failed to fetch categories', e);
    }
  }, []);

  const fetchSharedTasks = useCallback(async () => {
    setLoadingShared(true);
    try {
      const data = await getSharedWithMe();
      setSharedTasks(data);
    } catch (e) {
      console.error('Failed to fetch shared tasks', e);
    } finally {
      setLoadingShared(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'myTasks') {
      fetchTasks();
    } else {
      fetchSharedTasks();
    }
  }, [fetchTasks, activeTab, fetchSharedTasks]);

  useEffect(() => {
    fetchStats();
    fetchCategories();
  }, [fetchStats, fetchCategories]);

  // Debounced search
  const [searchInput, setSearchInput] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput, setSearchQuery]);

  // Handlers
  const handleCreate = async (input: any) => {
    const task = await createTask(input);
    // Add pending reminders if any
    if (input._pendingReminders?.length) {
      for (const r of input._pendingReminders) {
        await addTaskReminder(task.id, r.reminderAt, r.type);
      }
    }
    fetchTasks();
    fetchStats();
  };

  const handleUpdate = async (input: any) => {
    if (!editingTask) return;
    await updateTask(editingTask.id, input);
    // Handle reminder changes
    if (input._deletedReminderIds?.length) {
      for (const rid of input._deletedReminderIds) {
        await deleteTaskReminder(editingTask.id, rid);
      }
    }
    if (input._pendingReminders?.length) {
      for (const r of input._pendingReminders) {
        await addTaskReminder(editingTask.id, r.reminderAt, r.type);
      }
    }
    fetchTasks();
    fetchStats();
  };

  const handleDelete = async () => {
    if (!editingTask) return;
    await deleteTask(editingTask.id);
    fetchTasks();
    fetchStats();
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    await updateTaskStatus(task.id, newStatus);
    fetchTasks();
    fetchStats();
  };

  const handleKanbanStatusChange = async (taskId: string, newStatus: string) => {
    await updateTaskStatus(taskId, newStatus);
    fetchTasks();
    fetchStats();
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    await updateTaskStatus(task.id, newStatus);
    fetchTasks();
    fetchStats();
  };

  const handleClickTask = (task: Task) => {
    setDetailTask(task);
  };

  const handleAddToCalendar = (task: Task) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
    window.open(`${apiUrl}/tasks/${task.id}/ical`, '_blank');
  };

  function parseQuickAdd(text: string): Partial<TaskInput> {
    const result: Partial<TaskInput> = { title: text };

    // Extract priority
    const urgentWords = /\b(urgent|asap|critical)\b/i;
    const highWords = /\b(important|high priority)\b/i;
    if (urgentWords.test(text)) {
      result.priority = 'URGENT';
      result.title = text.replace(urgentWords, '').trim();
    } else if (highWords.test(text)) {
      result.priority = 'HIGH';
      result.title = text.replace(highWords, '').trim();
    }

    // Extract "tomorrow"
    if (/\btomorrow\b/i.test(text)) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      result.dueDate = d.toISOString().split('T')[0];
      result.title = (result.title || text).replace(/\btomorrow\b/i, '').trim();
    }

    // Extract "today"
    if (/\btoday\b/i.test(text)) {
      result.dueDate = new Date().toISOString().split('T')[0];
      result.title = (result.title || text).replace(/\btoday\b/i, '').trim();
    }

    return result;
  }

  const handleDuplicate = async (task: Task) => {
    await createTask({
      title: task.title,
      description: task.description || undefined,
      dueDate: task.dueDate || null,
      reminderAt: task.reminderAt || null,
      priority: task.priority,
      status: 'PENDING',
      contactId: task.contactId || null,
      category: task.category || null,
      categoryColor: task.categoryColor || null,
    });
    fetchTasks();
    fetchStats();
  };

  const handleDeleteTask = async (task: Task) => {
    await deleteTask(task.id);
    fetchTasks();
    fetchStats();
  };

  const handleBulkStatus = async (status: string) => {
    await bulkUpdateTasks(selectedTaskIds, 'updateStatus', status);
    clearSelection();
    fetchTasks();
    fetchStats();
  };

  const handleBulkDelete = async () => {
    await bulkUpdateTasks(selectedTaskIds, 'delete');
    clearSelection();
    fetchTasks();
    fetchStats();
  };

  const handleShare = (task: Task) => {
    setShareTask(task);
  };

  const openNewTask = (date?: string) => {
    setEditingTask(null);
    setDefaultDate(date || '');
    setShowModal(true);
  };

  const hasActiveFilters = filterStatus || filterPriority || filterCategory || filterPreset;

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 border border-emerald-500/20 flex items-center justify-center">
            <TaskListSquareLtr24Regular className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{(t as any).tasksPage?.title || 'Tasks'}</h1>
            {stats && (
              <p className="text-xs text-white/50">
                {stats.pending} {(t as any).tasksPage?.stats?.pending || 'pending'}{stats.overdue > 0 ? ` · ${stats.overdue} ${(t as any).tasksPage?.stats?.overdue?.toLowerCase() || 'overdue'}` : ''}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => openNewTask()}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:opacity-90 transition-opacity"
        >
          <Add24Regular className="w-4 h-4" />
          {(t as any).tasksPage?.newTask || 'New'}
        </button>
      </div>

      {/* Tab Bar: My Tasks / Shared with me */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-th-surface border border-th-border">
        <button
          onClick={() => setActiveTab('myTasks')}
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
            activeTab === 'myTasks'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-white/50 hover:text-white'
          )}
        >
          {(t as any).tasksPage?.myTasks || 'My Tasks'}
        </button>
        <button
          onClick={() => setActiveTab('sharedWithMe')}
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-1.5',
            activeTab === 'sharedWithMe'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-white/50 hover:text-white'
          )}
        >
          <Share24Regular className="w-4 h-4" />
          {(t as any).tasksPage?.sharedWithMe || 'Shared with me'}
        </button>
      </div>

      {/* Quick Add (only on My Tasks tab) */}
      {activeTab === 'myTasks' && (
        <div className="relative">
          <input
            type="text"
            value={quickAddText}
            onChange={(e) => setQuickAddText(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && quickAddText.trim()) {
                try {
                  const res: any = await api.post('/tasks/parse', { data: { text: quickAddText } });
                  const parsed = (res?.data || res) as Partial<TaskInput>;
                  setEditingTask(null);
                  setDefaultDate(parsed.dueDate || '');
                  setPrefillData(parsed);
                  setShowModal(true);
                  setQuickAddText('');
                } catch {
                  // Fallback: client-side parse
                  const parsed = parseQuickAdd(quickAddText);
                  setEditingTask(null);
                  setDefaultDate(parsed.dueDate || '');
                  setPrefillData(parsed);
                  setShowModal(true);
                  setQuickAddText('');
                }
              }
            }}
            placeholder={(t as any).tasksPage?.quickAddPlaceholder || 'Quick add: Call client tomorrow 3pm...'}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-th-border rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <Add24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
        </div>
      )}

      {/* Stats Cards */}
      {activeTab === 'myTasks' && stats && (
        <div className="grid grid-cols-5 gap-2">
          <button
            onClick={() => setFilterPreset(filterPreset === 'today' ? '' : 'today')}
            className={cn(
              'p-2.5 rounded-xl border text-center transition-all',
              filterPreset === 'today'
                ? 'border-blue-500/30 bg-blue-500/10'
                : 'border-th-border bg-th-surface hover:bg-th-hover'
            )}
          >
            <CheckmarkCircle24Regular className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{stats.today}</p>
            <p className="text-[10px] text-white/50">{(t as any).tasksPage?.stats?.today || 'Today'}</p>
          </button>
          <button
            onClick={() => setFilterPreset(filterPreset === 'thisWeek' ? '' : 'thisWeek')}
            className={cn(
              'p-2.5 rounded-xl border text-center transition-all',
              filterPreset === 'thisWeek'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-th-border bg-th-surface hover:bg-th-hover'
            )}
          >
            <Clock24Regular className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{stats.thisWeek}</p>
            <p className="text-[10px] text-white/50">{(t as any).tasksPage?.stats?.thisWeek || 'This Week'}</p>
          </button>
          <button
            onClick={() => setFilterPreset(filterPreset === 'overdue' ? '' : 'overdue')}
            className={cn(
              'p-2.5 rounded-xl border text-center transition-all',
              filterPreset === 'overdue'
                ? 'border-red-500/30 bg-red-500/10'
                : 'border-th-border bg-th-surface hover:bg-th-hover'
            )}
          >
            <Warning24Regular className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{stats.overdue}</p>
            <p className="text-[10px] text-white/50">{(t as any).tasksPage?.stats?.overdue || 'Overdue'}</p>
          </button>
          <button
            onClick={() => setFilterPreset(filterPreset === 'highPriority' ? '' : 'highPriority')}
            className={cn(
              'p-2.5 rounded-xl border text-center transition-all',
              filterPreset === 'highPriority'
                ? 'border-orange-500/30 bg-orange-500/10'
                : 'border-th-border bg-th-surface hover:bg-th-hover'
            )}
          >
            <Flag24Regular className="w-4 h-4 text-orange-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{(stats.byPriority?.HIGH || 0) + (stats.byPriority?.URGENT || 0)}</p>
            <p className="text-[10px] text-white/50">{(t as any).tasksPage?.stats?.highPriority || 'High Priority'}</p>
          </button>
          <button
            onClick={() => setFilterPreset(filterPreset === 'noDate' ? '' : 'noDate')}
            className={cn(
              'p-2.5 rounded-xl border text-center transition-all',
              filterPreset === 'noDate'
                ? 'border-white/10 bg-white/5'
                : 'border-th-border bg-th-surface hover:bg-th-hover'
            )}
          >
            <CalendarLtr24Regular className="w-4 h-4 text-white/60 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{stats.pending - stats.thisWeek}</p>
            <p className="text-[10px] text-white/50">{(t as any).tasksPage?.stats?.noDate || 'No Date'}</p>
          </button>
        </div>
      )}

      {/* Shared with me tab */}
      {activeTab === 'sharedWithMe' && (
        <div className="space-y-3">
          {loadingShared ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : sharedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/60">
              <Share24Regular className="w-8 h-8 mb-2 text-white/60" />
              <p className="text-sm">{(t as any).tasksPage?.noShared || 'No shared tasks'}</p>
            </div>
          ) : (
            sharedTasks.map((share) => {
              const sharedTask = (share as any).task as Task | undefined;
              if (!sharedTask) return null;
              return (
                <div key={share.id} className="space-y-1">
                  <p className="text-[10px] text-white/60 px-1">
                    {(t as any).tasksPage?.sharedBy || 'Shared by'} {share.sharedBy?.fullName || 'Unknown'} - {share.permission === 'VIEW' ? ((t as any).tasksPage?.viewOnly || 'View only') : ((t as any).tasksPage?.canEdit || 'Can edit')}
                  </p>
                  <TaskCard
                    task={sharedTask}
                    onClick={share.permission === 'EDIT' ? handleClickTask : undefined}
                    onToggleStatus={share.permission === 'EDIT' ? handleToggleStatus : undefined}
                  />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Search & View Toggle (My Tasks only) */}
      {activeTab === 'myTasks' && <div className="flex items-center gap-2">
        {/* Search */}
        <div className="flex-1 relative">
          <Search24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={(t as any).tasksPage?.searchPlaceholder || 'Search tasks...'}
            className="w-full pl-9 pr-8 py-2 bg-white/[0.03] border border-th-border rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearchQuery(''); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50"
            >
              <Dismiss24Regular className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'p-2 rounded-xl border transition-colors',
            hasActiveFilters
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-th-border text-white/50 hover:bg-th-hover'
          )}
        >
          <Filter24Regular className="w-5 h-5" />
        </button>

        {/* View Toggle */}
        <div className="flex items-center border border-th-border rounded-xl overflow-hidden">
          {([
            { mode: 'list' as const, Icon: List24Regular },
            { mode: 'kanban' as const, Icon: Board24Regular },
            { mode: 'calendar' as const, Icon: CalendarLtr24Regular },
          ]).map(({ mode, Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'p-2 transition-colors',
                viewMode === mode
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-white/50 hover:bg-th-hover'
              )}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>}

      {/* Filter Panel */}
      {activeTab === 'myTasks' && showFilters && (
        <div className="p-3 rounded-xl border border-th-border bg-th-surface space-y-3 animate-fade-in">
          {/* Status */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">{(t as any).tasksPage?.filters?.status || 'Status'}</label>
            <div className="flex gap-1.5 flex-wrap">
              {['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg border transition-colors',
                    filterStatus === s
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'border-th-border text-white/50 hover:bg-th-hover'
                  )}
                >
                  {s ? ((t as any).tasksPage?.status?.[s === 'PENDING' ? 'pending' : s === 'IN_PROGRESS' ? 'inProgress' : s === 'COMPLETED' ? 'completed' : 'cancelled'] || s) : ((t as any).tasksPage?.filters?.all || 'All')}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">{(t as any).tasksPage?.filters?.priority || 'Priority'}</label>
            <div className="flex gap-1.5 flex-wrap">
              {['', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(p)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg border transition-colors',
                    filterPriority === p
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'border-th-border text-white/50 hover:bg-th-hover'
                  )}
                >
                  {p ? ((t as any).taskDialog?.priorities?.[p.toLowerCase()] || p) : ((t as any).tasksPage?.filters?.all || 'All')}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div>
              <label className="text-xs text-white/50 mb-1 block">{(t as any).tasksPage?.filters?.category || 'Category'}</label>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilterCategory('')}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg border transition-colors',
                    !filterCategory
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'border-th-border text-white/50 hover:bg-th-hover'
                  )}
                >
                  {(t as any).tasksPage?.filters?.all || 'All'}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.name)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg border transition-colors',
                      filterCategory === cat.name
                        ? 'border-opacity-50'
                        : 'border-th-border text-white/50 hover:bg-th-hover'
                    )}
                    style={
                      filterCategory === cat.name
                        ? { backgroundColor: `${cat.color}20`, color: cat.color, borderColor: `${cat.color}50` }
                        : {}
                    }
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assigned to me */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">{(t as any).tasksPage?.assignedToMe || 'Assigned to me'}</label>
            <button
              onClick={() => setShowAssignedToMe(!showAssignedToMe)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg border transition-colors inline-flex items-center gap-1',
                showAssignedToMe
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'border-th-border text-white/50 hover:bg-th-hover'
              )}
            >
              <Person24Regular className="w-3 h-3" />
              {(t as any).tasksPage?.assignedToMe || 'Assigned to me'}
            </button>
          </div>

          {(hasActiveFilters || showAssignedToMe) && (
            <button
              onClick={() => { clearFilters(); setShowAssignedToMe(false); }}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              {(t as any).tasksPage?.filters?.clearAll || 'Clear all filters'}
            </button>
          )}
        </div>
      )}

      {/* Content (My Tasks) */}
      {activeTab === 'myTasks' && (loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {viewMode === 'list' && (
            <TaskListView
              tasks={tasks}
              selectedIds={selectedTaskIds}
              onToggleStatus={handleToggleStatus}
              onStatusChange={handleStatusChange}
              onClickTask={handleClickTask}
              onSelectTask={(task) => toggleTaskSelection(task.id)}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteTask}
              onShare={handleShare}
              onAddToCalendar={handleAddToCalendar}
              showSelection={selectedTaskIds.length > 0}
            />
          )}

          {viewMode === 'kanban' && (
            <TaskKanbanView
              tasks={tasks}
              onStatusChange={handleKanbanStatusChange}
              onClickTask={handleClickTask}
              onToggleStatus={handleToggleStatus}
              onShare={handleShare}
            />
          )}

          {viewMode === 'calendar' && (
            <TaskCalendarView
              tasks={tasks}
              onClickTask={handleClickTask}
              onToggleStatus={handleToggleStatus}
              onAddTask={(date) => openNewTask(date)}
              onShare={handleShare}
            />
          )}
        </>
      ))}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedTaskIds.length}
        onClear={clearSelection}
        onBulkStatus={handleBulkStatus}
        onBulkPriority={async () => {}}
        onBulkDelete={handleBulkDelete}
      />

      {/* Task Form Modal */}
      <TaskFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTask(null);
          setPrefillData(null);
        }}
        onSave={editingTask ? handleUpdate : handleCreate}
        onSaveAndAddAnother={editingTask ? undefined : handleCreate}
        onDelete={editingTask ? handleDelete : undefined}
        task={editingTask}
        categories={categories}
        defaultDate={defaultDate}
        prefill={prefillData}
      />

      {shareTask && (
        <ShareTaskModal
          isOpen={!!shareTask}
          onClose={() => setShareTask(null)}
          taskId={shareTask.id}
          taskTitle={shareTask.title}
        />
      )}

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={detailTask}
        isOpen={!!detailTask}
        onClose={() => setDetailTask(null)}
        onEdit={(task) => {
          setDetailTask(null);
          setEditingTask(task);
          setShowModal(true);
        }}
      />
    </div>
  );
}
