'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  Dismiss24Regular,
  Delete24Regular,
  Flag24Regular,
  Person24Regular,
  Tag24Regular,
  Clock24Regular,
  Alert24Regular,
  ArrowRepeatAll24Regular,
  Add24Regular,
  PersonAccounts24Regular,
  ChevronDown24Regular as ChevronDown,
  Search24Regular,
  PeopleTeam24Regular,
  Image24Regular,
  Mic24Regular,
  Stop24Regular,
} from '@fluentui/react-icons';
import type { Task, TaskInput, TaskCategory, TaskReminder } from '@/lib/api/tasks';
import { InlineDatePicker } from './InlineDatePicker';
import { setTaskRecurrence, removeTaskRecurrence, addTaskReminder, deleteTaskReminder } from '@/lib/api/tasks';
import { getContacts } from '@/lib/api/contacts';

// Extended TaskInput with pending reminder operations for the parent to handle (create mode)
// or for the modal to handle internally (edit mode)
export interface TaskInputWithReminders extends TaskInput {
  _pendingReminders?: { reminderAt: string; type: string }[];
  _deletedReminderIds?: string[];
  _imageFiles?: File[];
  _voiceBlob?: Blob | null;
}

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: TaskInputWithReminders) => Promise<void>;
  onDelete?: () => Promise<void>;
  task?: Task | null;
  categories?: TaskCategory[];
  contacts?: Array<{ id: string; fullName: string }>;
  defaultDate?: string;
  onSaveAndAddAnother?: (input: TaskInputWithReminders) => Promise<void>;
  prefill?: Partial<TaskInput> | null;
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-500/20 text-green-400 border-green-500/30',
  MEDIUM: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  HIGH: 'bg-red-500/20 text-red-400 border-red-500/30',
  URGENT: 'bg-red-600/20 text-red-500 border-red-600/30',
};

const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

const REMINDER_PRESETS = [
  { key: '5min', label: '5 min', minutes: 5 },
  { key: '15min', label: '15 min', minutes: 15 },
  { key: '1hour', label: '1 hour', minutes: 60 },
  { key: '1day', label: '1 day', minutes: 1440 },
  { key: 'custom', label: 'Custom', minutes: -1 },
] as const;

const RECURRENCE_OPTIONS = [
  { key: 'NONE', label: 'None' },
  { key: 'DAILY', label: 'Daily' },
  { key: 'WEEKLY', label: 'Weekly' },
  { key: 'MONTHLY', label: 'Monthly' },
  { key: 'YEARLY', label: 'Yearly' },
] as const;

interface ReminderEntry {
  id?: string;          // Present if existing (from DB)
  reminderAt: string;   // ISO string
  type: string;         // e.g. 'IN_APP'
  isExisting: boolean;  // true if loaded from task.reminders
  label?: string;       // Display label
}

export function TaskFormModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  task,
  categories = [],
  contacts = [],
  defaultDate,
  onSaveAndAddAnother,
  prefill,
}: TaskFormModalProps) {
  const { t } = useI18n();
  const isEdit = !!task;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [status, setStatus] = useState<string>('PENDING');
  const [contactId, setContactId] = useState<string>('');
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [categoryColor, setCategoryColor] = useState<string>('');
  const [recurrencePattern, setRecurrencePattern] = useState<string>('NONE');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Attachment state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [existingVoice, setExistingVoice] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Assignees state
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneeContacts, setAssigneeContacts] = useState<Array<{ id: string; fullName: string; company?: string | null }>>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<Array<{ id: string; fullName: string; company?: string | null }>>([]);
  const [assigneeSearching, setAssigneeSearching] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const assigneeSearchRef = useRef<HTMLDivElement>(null);
  const assigneeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Multi-reminder state
  const [reminders, setReminders] = useState<ReminderEntry[]>([]);
  const [deletedReminderIds, setDeletedReminderIds] = useState<string[]>([]);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [customReminderDate, setCustomReminderDate] = useState('');
  const [customReminderTime, setCustomReminderTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description || '');
        if (task.dueDate) {
          const d = new Date(task.dueDate);
          setDueDate(d.toISOString().split('T')[0]);
          const h = d.getHours();
          const m = d.getMinutes();
          if (h || m) {
            setDueTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
          } else {
            setDueTime('');
          }
        } else {
          setDueDate('');
          setDueTime('');
        }
        setPriority(task.priority);
        setStatus(task.status);
        setContactId(task.contactId || '');
        setAssignedToId(task.assignedToId || '');
        setCategory(task.category || '');
        setCategoryColor(task.categoryColor || '');
        if (task.recurrence) {
          setRecurrencePattern(task.recurrence.pattern);
          setRecurrenceInterval(task.recurrence.interval);
        } else {
          setRecurrencePattern('NONE');
          setRecurrenceInterval(1);
        }
        // Load existing assignees
        if ((task as any).assignees && Array.isArray((task as any).assignees)) {
          const taskAssignees = (task as any).assignees;
          setAssigneeIds(taskAssignees.map((a: any) => a.contactId));
          setAssigneeContacts(taskAssignees.map((a: any) => ({
            id: a.contactId,
            fullName: a.contact?.fullName || 'Unknown',
            company: a.contact?.company || null,
          })));
        } else {
          setAssigneeIds([]);
          setAssigneeContacts([]);
        }
        // Load existing reminders
        const existingReminders: ReminderEntry[] = (task.reminders || []).map((r) => ({
          id: r.id,
          reminderAt: r.reminderAt,
          type: r.type || 'IN_APP',
          isExisting: true,
          label: formatReminderLabel(r.reminderAt),
        }));
        // Also include the legacy reminderAt if no reminders array but reminderAt exists
        if (existingReminders.length === 0 && task.reminderAt) {
          existingReminders.push({
            reminderAt: task.reminderAt,
            type: 'IN_APP',
            isExisting: false, // legacy, not from reminders table
            label: formatReminderLabel(task.reminderAt),
          });
        }
        setReminders(existingReminders);
        setExistingImages(task.imageUrls ? (typeof task.imageUrls === 'string' ? JSON.parse(task.imageUrls) : task.imageUrls) : []);
        setExistingVoice((task as any).voiceNoteUrl || '');
        setImageFiles([]);
        setVoiceBlob(null);
        setIsRecording(false);
      } else {
        setTitle(prefill?.title || '');
        setDescription(prefill?.description || '');
        setDueDate(prefill?.dueDate || defaultDate || '');
        setDueTime('');
        setPriority((prefill?.priority as any) || 'MEDIUM');
        setStatus((prefill?.status as any) || 'PENDING');
        setContactId(prefill?.contactId || '');
        setAssignedToId(prefill?.assignedToId || '');
        setCategory(prefill?.category || '');
        setCategoryColor(prefill?.categoryColor || '');
        setRecurrencePattern('NONE');
        setRecurrenceInterval(1);
        setReminders([]);
        setAssigneeIds([]);
        setAssigneeContacts([]);
        setImageFiles([]);
        setExistingImages([]);
        setVoiceBlob(null);
        setExistingVoice('');
        setIsRecording(false);
      }
      setDeletedReminderIds([]);
      setShowAddReminder(false);
      setCustomReminderDate('');
      setCustomReminderTime('');
      setShowDeleteConfirm(false);
      setShowCalendar(false);
    }
  }, [isOpen, task, defaultDate, prefill]);

  function formatReminderLabel(isoStr: string): string {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  }

  // Assignee search with debounce
  const handleAssigneeSearch = useCallback((query: string) => {
    setAssigneeSearch(query);
    if (assigneeDebounceRef.current) clearTimeout(assigneeDebounceRef.current);
    if (!query.trim()) {
      setAssigneeResults([]);
      setShowAssigneeDropdown(false);
      return;
    }
    assigneeDebounceRef.current = setTimeout(async () => {
      setAssigneeSearching(true);
      try {
        const res = await getContacts({ search: query, limit: 10 });
        const filtered = res.contacts
          .filter((c) => !assigneeIds.includes(c.id))
          .map((c) => ({ id: c.id, fullName: c.name, company: c.company || null }));
        setAssigneeResults(filtered);
        setShowAssigneeDropdown(true);
      } catch (e) {
        console.error('Failed to search contacts', e);
      } finally {
        setAssigneeSearching(false);
      }
    }, 300);
  }, [assigneeIds]);

  // Close assignee dropdown on click outside
  useEffect(() => {
    if (!showAssigneeDropdown) return;
    const handler = (e: MouseEvent) => {
      if (assigneeSearchRef.current && !assigneeSearchRef.current.contains(e.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAssigneeDropdown]);

  function addAssignee(contact: { id: string; fullName: string; company?: string | null }) {
    if (assigneeIds.includes(contact.id)) return;
    setAssigneeIds((prev) => [...prev, contact.id]);
    setAssigneeContacts((prev) => [...prev, contact]);
    setAssigneeSearch('');
    setAssigneeResults([]);
    setShowAssigneeDropdown(false);
  }

  function removeAssignee(contactId: string) {
    setAssigneeIds((prev) => prev.filter((id) => id !== contactId));
    setAssigneeContacts((prev) => prev.filter((c) => c.id !== contactId));
  }

  function getDueDateISO(): string | null {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    if (dueTime) {
      const [h, m] = dueTime.split(':');
      d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    }
    return d.toISOString();
  }

  function addReminderFromPreset(presetKey: string) {
    const dueDateISO = getDueDateISO();
    if (!dueDateISO) return;
    const preset = REMINDER_PRESETS.find((p) => p.key === presetKey);
    if (!preset || preset.minutes <= 0) return;
    const reminderDate = new Date(dueDateISO);
    reminderDate.setMinutes(reminderDate.getMinutes() - preset.minutes);
    const reminderAt = reminderDate.toISOString();
    // Avoid duplicates
    if (reminders.some((r) => r.reminderAt === reminderAt)) return;
    setReminders((prev) => [
      ...prev,
      {
        reminderAt,
        type: 'IN_APP',
        isExisting: false,
        label: formatReminderLabel(reminderAt),
      },
    ]);
  }

  function addCustomReminder() {
    if (!customReminderDate) return;
    const rd = new Date(customReminderDate);
    if (customReminderTime) {
      const [h, m] = customReminderTime.split(':');
      rd.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    }
    const reminderAt = rd.toISOString();
    // Avoid duplicates
    if (reminders.some((r) => r.reminderAt === reminderAt)) return;
    setReminders((prev) => [
      ...prev,
      {
        reminderAt,
        type: 'IN_APP',
        isExisting: false,
        label: formatReminderLabel(reminderAt),
      },
    ]);
    setCustomReminderDate('');
    setCustomReminderTime('');
    setShowAddReminder(false);
  }

  function removeReminder(index: number) {
    const reminder = reminders[index];
    if (reminder.isExisting && reminder.id) {
      setDeletedReminderIds((prev) => [...prev, reminder.id!]);
    }
    setReminders((prev) => prev.filter((_, i) => i !== index));
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setVoiceBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error('Failed to start recording', e);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  const buildInput = (): TaskInputWithReminders => {
    const dueDateISO = getDueDateISO();

    // Use the earliest reminder as the legacy reminderAt field
    let reminderAtISO: string | null = null;
    if (reminders.length > 0) {
      const sorted = [...reminders].sort(
        (a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime()
      );
      reminderAtISO = sorted[0].reminderAt;
    }

    // Collect new (non-existing) reminders to add
    const pendingReminders = reminders
      .filter((r) => !r.isExisting)
      .map((r) => ({ reminderAt: r.reminderAt, type: r.type }));

    return {
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDateISO,
      reminderAt: reminderAtISO,
      priority,
      status: isEdit ? status : 'PENDING',
      contactId: contactId || null,
      assignedToId: assignedToId || null,
      category: category || null,
      categoryColor: categoryColor || null,
      assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      _pendingReminders: pendingReminders.length > 0 ? pendingReminders : undefined,
      _deletedReminderIds: deletedReminderIds.length > 0 ? deletedReminderIds : undefined,
      _imageFiles: imageFiles.length > 0 ? imageFiles : undefined,
      _voiceBlob: voiceBlob || undefined,
    };
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const input = buildInput();

      // In edit mode, handle reminder deletions/additions directly
      if (isEdit && task) {
        // Delete removed reminders
        for (const remId of deletedReminderIds) {
          try {
            await deleteTaskReminder(task.id, remId);
          } catch (e) {
            console.error('Failed to delete reminder', remId, e);
          }
        }
        // Add new reminders
        const newReminders = reminders.filter((r) => !r.isExisting);
        for (const r of newReminders) {
          try {
            await addTaskReminder(task.id, r.reminderAt, r.type);
          } catch (e) {
            console.error('Failed to add reminder', e);
          }
        }
      }

      await onSave(input);

      // Handle recurrence for edit mode
      if (isEdit && task) {
        const hadRecurrence = !!task.recurrence;
        const wantsRecurrence = recurrencePattern !== 'NONE';
        if (wantsRecurrence) {
          await setTaskRecurrence(task.id, recurrencePattern, recurrenceInterval);
        } else if (hadRecurrence) {
          await removeTaskRecurrence(task.id);
        }
      }
      onClose();
    } catch (e) {
      console.error('Failed to save task', e);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate(defaultDate || '');
    setDueTime('');
    setPriority('MEDIUM');
    setStatus('PENDING');
    setContactId('');
    setAssignedToId('');
    setAssigneeIds([]);
    setAssigneeContacts([]);
    setAssigneeSearch('');
    setAssigneeResults([]);
    setShowAssigneeDropdown(false);
    setReminders([]);
    setDeletedReminderIds([]);
    setShowAddReminder(false);
    setCustomReminderDate('');
    setCustomReminderTime('');
    setRecurrencePattern('NONE');
    setRecurrenceInterval(1);
    setImageFiles([]);
    setExistingImages([]);
    setVoiceBlob(null);
    setExistingVoice('');
    setIsRecording(false);
    // Keep category & categoryColor for convenience
  };

  const handleSaveAndAddAnother = async () => {
    if (!title.trim() || !onSaveAndAddAnother) return;
    setSaving(true);
    try {
      await onSaveAndAddAnother(buildInput());
      resetForm();
    } catch (e) {
      console.error('Failed to save task', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (e) {
      console.error('Failed to delete task', e);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] sm:max-h-[80vh] bg-th-bg-s border border-th-border rounded-t-2xl sm:rounded-2xl flex flex-col animate-slide-up mb-safe">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-th-bg-s border-b border-th-border rounded-t-2xl">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? (t as any).taskDialog?.editTitle || 'Edit Task' : (t as any).taskDialog?.createTitle || 'Add Task'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-th-hover text-white/50">
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={(t as any).taskDialog?.titlePlaceholder || 'Enter task title'}
              className="w-full px-3 py-2 bg-white/[0.03] border border-th-border rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={(t as any).taskDialog?.notesPlaceholder || 'Add notes...'}
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.03] border border-th-border rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 resize-none"
            />
          </div>

          {/* Due Date & Time */}
          <div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-white/50 mb-1">
                  <Clock24Regular className="w-3.5 h-3.5 inline mr-1" />
                  {(t as any).taskDialog?.dueDate || 'Due Date'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className={cn(
                    'w-full px-2.5 py-1.5 text-start rounded-lg border text-sm transition-all',
                    dueDate
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/[0.03] border-th-border text-white/50 hover:border-emerald-500/30'
                  )}
                >
                  {dueDate
                    ? new Date(dueDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : (t as any).tasksPage?.selectDate || 'Select date'
                  }
                </button>
              </div>
              <div className="w-28">
                <label className="block text-xs text-white/50 mb-1">
                  {(t as any).taskDialog?.dueTime || 'Time'}
                </label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white/[0.03] border border-th-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>
            {showCalendar && (
              <div className="mt-2">
                <InlineDatePicker value={dueDate} onChange={(d) => { setDueDate(d); setShowCalendar(false); }} />
              </div>
            )}
          </div>

          {/* Reminders (multi) */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">
              <Alert24Regular className="w-3.5 h-3.5 inline mr-1" />
              {(t as any).taskDialog?.reminder || 'Reminders'}
            </label>

            {/* Existing reminders list */}
            {reminders.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {reminders.map((r, idx) => (
                  <div
                    key={r.id || `new-${idx}`}
                    className="flex items-center justify-between px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 rounded-lg"
                  >
                    <span className="text-xs text-teal-400">
                      {r.label || formatReminderLabel(r.reminderAt)}
                    </span>
                    <button
                      onClick={() => removeReminder(idx)}
                      className="p-0.5 text-teal-400/60 hover:text-red-400 transition-colors"
                      title="Remove reminder"
                    >
                      <Dismiss24Regular className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Preset buttons to add reminders */}
            <div className="flex gap-1.5 flex-wrap">
              {REMINDER_PRESETS.filter((p) => p.key !== 'custom').map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => addReminderFromPreset(preset.key)}
                  disabled={!dueDate}
                  className={cn(
                    'py-1 px-2.5 text-xs font-medium rounded-lg border transition-all',
                    'border-th-border text-white/50 hover:border-teal-500/30 hover:text-teal-400',
                    !dueDate && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  + {(t as any).taskDialog?.reminderPresets?.[preset.key] || preset.label}
                </button>
              ))}
              <button
                onClick={() => setShowAddReminder(!showAddReminder)}
                className={cn(
                  'py-1 px-2.5 text-xs font-medium rounded-lg border transition-all',
                  showAddReminder
                    ? 'bg-teal-500/20 text-teal-400 border-teal-500/30'
                    : 'border-th-border text-white/50 hover:border-teal-500/30 hover:text-teal-400'
                )}
              >
                + {(t as any).taskDialog?.reminderPresets?.custom || 'Custom'}
              </button>
            </div>

            {!dueDate && reminders.length === 0 && (
              <p className="text-[10px] text-white/60 mt-1">{(t as any).taskDialog?.setDueDateFirst || 'Set a due date to use presets, or add a custom reminder'}</p>
            )}

            {/* Custom reminder input */}
            {showAddReminder && (
              <div className="flex gap-2 mt-2 items-end">
                <div className="flex-1">
                  <input
                    type="date"
                    value={customReminderDate}
                    onChange={(e) => setCustomReminderDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white/[0.03] border border-th-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div className="w-28">
                  <input
                    type="time"
                    value={customReminderTime}
                    onChange={(e) => setCustomReminderTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white/[0.03] border border-th-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <button
                  onClick={addCustomReminder}
                  disabled={!customReminderDate}
                  className="px-3 py-2 text-xs font-medium text-teal-400 border border-teal-500/30 rounded-xl hover:bg-teal-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Add24Regular className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">
              <ArrowRepeatAll24Regular className="w-3.5 h-3.5 inline mr-1" />
              {(t as any).taskDialog?.recurrence || 'Repeat'}
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setRecurrencePattern(opt.key)}
                  className={cn(
                    'py-1 px-2.5 text-xs font-medium rounded-lg border transition-all',
                    recurrencePattern === opt.key
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'border-th-border text-white/50 hover:border-th-border-hover'
                  )}
                >
                  {(t as any).taskDialog?.recurrenceOptions?.[opt.key.toLowerCase()] || opt.label}
                </button>
              ))}
            </div>
            {recurrencePattern !== 'NONE' && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-white/50">{(t as any).taskDialog?.every || 'Every'}</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-1 bg-white/[0.03] border border-th-border rounded-lg text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <span className="text-xs text-white/50">
                  {recurrencePattern === 'DAILY' && ((t as any).taskDialog?.days || 'day(s)')}
                  {recurrencePattern === 'WEEKLY' && ((t as any).taskDialog?.weeks || 'week(s)')}
                  {recurrencePattern === 'MONTHLY' && ((t as any).taskDialog?.months || 'month(s)')}
                  {recurrencePattern === 'YEARLY' && ((t as any).taskDialog?.years || 'year(s)')}
                </span>
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">
              <Flag24Regular className="w-3.5 h-3.5 inline mr-1" />
              {(t as any).taskDialog?.priority || 'Priority'}
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'flex-1 py-1.5 px-2 text-xs font-medium rounded-lg border transition-all',
                    priority === p
                      ? PRIORITY_COLORS[p]
                      : 'border-th-border text-white/50 hover:border-th-border-hover'
                  )}
                >
                  {(t as any).taskDialog?.priorities?.[p.toLowerCase()] || p}
                </button>
              ))}
            </div>
          </div>

          {/* Status (edit mode only) */}
          {isEdit && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">{(t as any).tasksPage?.filters?.status || 'Status'}</label>
              <div className="flex gap-2 flex-wrap">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      'py-1.5 px-3 text-xs font-medium rounded-lg border transition-all',
                      status === s
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'border-th-border text-white/50 hover:border-th-border-hover'
                    )}
                  >
                    {(t as any).tasksPage?.status?.[s === 'PENDING' ? 'pending' : s === 'IN_PROGRESS' ? 'inProgress' : s === 'COMPLETED' ? 'completed' : 'cancelled'] || s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          {categories.length > 0 && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">
                <Tag24Regular className="w-3.5 h-3.5 inline mr-1" />
                {(t as any).tasksPage?.filters?.category || 'Category'}
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setCategory(''); setCategoryColor(''); }}
                  className={cn(
                    'py-1 px-2.5 text-xs font-medium rounded-lg border transition-all',
                    !category
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'border-th-border text-white/50'
                  )}
                >
                  {(t as any).tasksPage?.categories?.none || 'None'}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setCategory(cat.name); setCategoryColor(cat.color); }}
                    className={cn(
                      'py-1 px-2.5 text-xs font-medium rounded-lg border transition-all',
                      category === cat.name
                        ? 'border-opacity-50'
                        : 'border-th-border text-white/50'
                    )}
                    style={
                      category === cat.name
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

          {/* Assignees (contact search) */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">
              <PeopleTeam24Regular className="w-3.5 h-3.5 inline mr-1" />
              {(t as any).tasksPage?.assignees || 'Assignees'}
            </label>

            {/* Selected assignees as chips */}
            {assigneeContacts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {assigneeContacts.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-xs text-emerald-400"
                  >
                    <span className="w-4 h-4 rounded-full bg-emerald-500/30 flex items-center justify-center text-[8px] font-bold text-emerald-300">
                      {(c.fullName || '?')[0].toUpperCase()}
                    </span>
                    <span className="truncate max-w-[120px]">{c.fullName}</span>
                    <button
                      onClick={() => removeAssignee(c.id)}
                      className="p-0.5 hover:text-red-400 transition-colors"
                    >
                      <Dismiss24Regular className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className="relative" ref={assigneeSearchRef}>
              <div className="relative">
                <Search24Regular className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                <input
                  type="text"
                  value={assigneeSearch}
                  onChange={(e) => handleAssigneeSearch(e.target.value)}
                  placeholder={(t as any).tasksPage?.searchContacts || 'Search contacts to assign...'}
                  className="w-full ps-8 pe-3 py-1.5 bg-white/[0.03] border border-th-border rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
                />
                {assigneeSearching && (
                  <div className="absolute end-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                )}
              </div>

              {/* Search results dropdown */}
              {showAssigneeDropdown && assigneeResults.length > 0 && (
                <div className="absolute top-full mt-1 start-0 end-0 z-30 bg-[#1e1e2e] border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                  {assigneeResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => addAssignee(c)}
                      className="w-full px-3 py-2 text-start hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-400 flex-shrink-0">
                        {(c.fullName || '?')[0].toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs text-white truncate">{c.fullName}</div>
                        {c.company && (
                          <div className="text-[10px] text-white/40 truncate">{c.company}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showAssigneeDropdown && assigneeResults.length === 0 && assigneeSearch.trim() && !assigneeSearching && (
                <div className="absolute top-full mt-1 start-0 end-0 z-30 bg-[#1e1e2e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  <div className="px-3 py-2 text-xs text-white/40">{(t as any).tasksPage?.noContactsFound || 'No contacts found'}</div>
                </div>
              )}
            </div>
          </div>

          {/* Contact (optional) */}
          {contacts.length > 0 && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">
                <Person24Regular className="w-3.5 h-3.5 inline mr-1" />
                {(t as any).tasksPage?.contactOptional || 'Contact (optional)'}
              </label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white/[0.03] border border-th-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="">{(t as any).tasksPage?.noContact || 'No contact'}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Assign To (optional) */}
          {contacts.length > 0 && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">
                <PersonAccounts24Regular className="w-3.5 h-3.5 inline mr-1" />
                {(t as any).tasksPage?.assignTo || 'Assign To'}
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white/[0.03] border border-th-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="">{(t as any).tasksPage?.unassigned || 'Unassigned'}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Attachments Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">
                {(t as any).taskDialog?.attachments || 'Attachments'}
              </span>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setImageFiles(prev => [...prev, ...files]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white/70 text-sm hover:bg-white/[0.06] transition-colors w-full"
              >
                <Image24Regular className="w-4 h-4" />
                {(t as any).taskDialog?.addImages || 'Add Images'}
              </button>
              {/* Image previews */}
              {imageFiles.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {imageFiles.map((file, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                      <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImageFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center"
                      >
                        <Dismiss24Regular className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Existing images (edit mode) */}
              {existingImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {existingImages.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Voice Recording */}
            <div className="space-y-2">
              {!isRecording && !voiceBlob && !existingVoice && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white/70 text-sm hover:bg-white/[0.06] transition-colors w-full"
                >
                  <Mic24Regular className="w-4 h-4" />
                  {(t as any).taskDialog?.recordVoice || 'Record Voice Note'}
                </button>
              )}
              {isRecording && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm w-full animate-pulse"
                >
                  <Stop24Regular className="w-4 h-4" />
                  {(t as any).taskDialog?.stopRecording || 'Stop Recording'}
                </button>
              )}
              {voiceBlob && !isRecording && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <audio src={URL.createObjectURL(voiceBlob)} controls className="flex-1 h-8" />
                  <button
                    type="button"
                    onClick={() => setVoiceBlob(null)}
                    className="p-1 rounded-full hover:bg-white/10"
                  >
                    <Dismiss24Regular className="w-4 h-4 text-white/50" />
                  </button>
                </div>
              )}
              {existingVoice && !voiceBlob && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <audio src={existingVoice} controls className="flex-1 h-8" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-th-bg-s border-t border-th-border rounded-b-2xl">
          {isEdit && onDelete ? (
            showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">{(t as any).tasksPage?.deleteTaskConfirm || 'Delete task?'}</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {deleting ? '...' : (t as any).tasksPage?.yesDelete || 'Yes, delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs font-medium text-white/50 border border-th-border rounded-lg"
                >
                  {(t as any).common?.cancel || 'Cancel'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Delete24Regular className="w-5 h-5" />
              </button>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {!isEdit && onSaveAndAddAnother && (
              <button
                onClick={handleSaveAndAddAnother}
                disabled={!title.trim() || saving}
                className="px-4 py-2 text-sm font-medium text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
              >
                {saving ? '...' : (t as any).tasksPage?.saveAndAddAnother || 'Save & Add Another'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? '...' : isEdit ? ((t as any).common?.save || 'Save') : (t as any).taskDialog?.create || 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
