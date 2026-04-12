'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Clock24Regular,
  Checkmark24Regular,
  Flag24Regular,
  Add24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '@/lib/i18n/Provider';
import { ContactTask, ContactReminder } from '@/lib/api/contacts';

interface ContactCalendarProps {
  tasks: ContactTask[];
  reminders: ContactReminder[];
  onAddTask: () => void;
  onAddReminder: () => void;
  onTaskClick: (task: ContactTask) => void;
  onReminderClick: (reminder: ContactReminder) => void;
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function ContactCalendar({
  tasks,
  reminders,
  onAddTask,
  onAddReminder,
  onTaskClick,
  onReminderClick,
}: ContactCalendarProps) {
  const { t } = useI18n();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Get days in month
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Add empty cells for days before first day of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [currentMonth]);

  // Get items for a specific date
  const getItemsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];

    const dateTasks = tasks.filter(t => t.dueDate?.startsWith(dateStr));
    const dateReminders = reminders.filter(r => r.reminderAt?.startsWith(dateStr));

    return { tasks: dateTasks, reminders: dateReminders };
  };

  // Check if date has items
  const hasItems = (date: Date) => {
    const items = getItemsForDate(date);
    return items.tasks.length > 0 || items.reminders.length > 0;
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is selected
  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  // Navigate months
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Format month name
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Get selected date items
  const selectedItems = getItemsForDate(selectedDate);

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' });
  };

  // Priority colors
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'text-red-400';
      case 'HIGH':
        return 'text-teal-400';
      case 'MEDIUM':
        return 'text-yellow-400';
      default:
        return 'text-white/60';
    }
  };

  return (
    <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-th-text flex items-center gap-2">
          <Clock24Regular className="w-5 h-5 text-emerald-400" />
          {t.calendar?.title || 'Schedule'}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={onAddReminder}
            className="p-2 rounded-lg bg-th-surface hover:bg-th-surface-h text-emerald-400 transition-colors"
            title={t.calendar?.addReminder || 'Add Reminder'}
          >
            <Clock24Regular className="w-4 h-4" />
          </button>
          <button
            onClick={onAddTask}
            className="p-2 rounded-lg bg-th-surface hover:bg-th-surface-h text-blue-400 transition-colors"
            title={t.calendar?.addTask || 'Add Task'}
          >
            <Add24Regular className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-th-surface-h text-th-text-t transition-colors"
        >
          <ChevronLeft24Regular className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-th-text">{monthName}</span>
        <button
          onClick={nextMonth}
          className="p-1 rounded hover:bg-th-surface-h text-th-text-t transition-colors"
        >
          <ChevronRight24Regular className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {/* Day headers */}
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="text-center text-xs text-th-text-m py-1">
            {day}
          </div>
        ))}

        {/* Days */}
        {daysInMonth.map((date, index) => (
          <div key={index} className="aspect-square">
            {date && (
              <button
                onClick={() => setSelectedDate(date)}
                className={`w-full h-full rounded-lg text-sm flex flex-col items-center justify-center relative transition-colors ${
                  isSelected(date)
                    ? 'bg-emerald-500 text-white'
                    : isToday(date)
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'hover:bg-th-surface-h text-th-text-s'
                }`}
              >
                {date.getDate()}
                {hasItems(date) && !isSelected(date) && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-400" />
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Selected date items */}
      <div className="border-t border-th-border pt-4">
        <h4 className="text-sm font-medium text-th-text-t mb-3">
          {selectedDate.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}
          {isToday(selectedDate) && (
            <span className="ml-2 text-xs text-emerald-400">({t.calendar?.today || 'Today'})</span>
          )}
        </h4>

        {selectedItems.reminders.length === 0 && selectedItems.tasks.length === 0 ? (
          <p className="text-sm text-th-text-m text-center py-4">
            {t.calendar?.noItems || 'No tasks or reminders'}
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {/* Reminders */}
            {selectedItems.reminders.map((reminder) => (
              <button
                key={reminder.id}
                onClick={() => onReminderClick(reminder)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors text-left"
              >
                <Clock24Regular className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-th-text truncate">{reminder.title}</p>
                  <p className="text-xs text-th-text-t">
                    {formatTime(reminder.reminderAt)}
                  </p>
                </div>
                {reminder.isCompleted && (
                  <Checkmark24Regular className="w-4 h-4 text-green-400 shrink-0" />
                )}
              </button>
            ))}

            {/* Tasks */}
            {selectedItems.tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-left"
              >
                <Flag24Regular className={`w-5 h-5 shrink-0 ${getPriorityColor(task.priority)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-th-text truncate">{task.title}</p>
                  <p className="text-xs text-th-text-t">
                    {task.dueDate && formatTime(task.dueDate)}
                    <span className="ml-2 capitalize">{task.priority.toLowerCase()}</span>
                  </p>
                </div>
                {task.status === 'COMPLETED' && (
                  <Checkmark24Regular className="w-4 h-4 text-green-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ContactCalendar;
