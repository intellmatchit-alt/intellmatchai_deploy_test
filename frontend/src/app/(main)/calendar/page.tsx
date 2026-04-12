/**
 * Calendar Page
 *
 * Displays tasks and reminders in a calendar view.
 * Features:
 * - Month view with navigation
 * - Tasks and reminders displayed on dates
 * - Click date to see details
 * - Quick actions (complete task, dismiss reminder)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api/client';
import { toast } from '@/components/ui/Toast';
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Calendar24Regular,
  TaskListSquareAdd24Regular,
  Clock24Regular,
  Checkmark24Regular,
  Person24Regular,
  Building24Regular,
  Dismiss24Regular,
  ArrowLeft24Regular,
  MoreHorizontal24Regular,
} from '@fluentui/react-icons';
import { TaskActionPopup } from '@/components/tasks/TaskActionPopup';

interface CalendarEvent {
  id: string;
  type: 'task' | 'reminder';
  title: string;
  description?: string | null;
  date: string;
  dueDate?: string | null;
  reminderAt?: string | null;
  priority?: string;
  status?: string;
  isCompleted?: boolean;
  contact?: {
    id: string;
    fullName: string;
    company?: string | null;
  } | null;
}

interface EventsByDate {
  [date: string]: CalendarEvent[];
}

interface CalendarSummary {
  tasks: { today: number; thisWeek: number; overdue: number; totalPending: number };
  reminders: { today: number; thisWeek: number; overdue: number; totalPending: number };
  totals: { today: number; thisWeek: number; overdue: number; totalPending: number };
}

export default function CalendarPage() {
  const { t, lang } = useI18n();
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventsByDate, setEventsByDate] = useState<EventsByDate>({});
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);
  const [actionPopup, setActionPopup] = useState<CalendarEvent | null>(null);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Fetch calendar data
  const fetchCalendarData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventsResponse, summaryResponse] = await Promise.all([
        api.get<{ month: number; year: number; eventsByDate: EventsByDate }>(
          `/calendar/events/by-date?month=${currentMonth + 1}&year=${currentYear}`
        ),
        api.get<CalendarSummary>('/calendar/summary'),
      ]);

      setEventsByDate(eventsResponse?.eventsByDate || {});
      setSummary(summaryResponse || null);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
      toast({ title: 'Error', description: 'Failed to load calendar', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  // Calendar grid calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const calendarDays: { day: number; isCurrentMonth: boolean; dateKey: string }[] = [];

  // Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = currentMonth === 0 ? 12 : currentMonth;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const dateKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ day, isCurrentMonth: false, dateKey });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ day, isCurrentMonth: true, dateKey });
  }

  // Next month days to fill remaining cells
  const remainingCells = 42 - calendarDays.length;
  for (let day = 1; day <= remainingCells; day++) {
    const nextMonth = currentMonth === 11 ? 1 : currentMonth + 2;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const dateKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ day, isCurrentMonth: false, dateKey });
  }

  // Handle date click
  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    setSelectedEvents(eventsByDate[dateKey] || []);
  };

  // Check if a date is today
  const isToday = (dateKey: string) => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dateKey === todayKey;
  };

  // Get month name
  const monthNames = lang === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayNames = lang === 'ar'
    ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Action popup handlers
  const handleEventClick = (event: CalendarEvent) => {
    setActionPopup(event);
  };

  const handleActionComplete = async () => {
    const popup = actionPopup;
    if (!popup) return;
    setActionPopup(null);
    try {
      const contactId = popup.contact?.id || null;
      if (popup.type === 'task') {
        if (contactId) {
          await api.put(`/contacts/${contactId}/tasks/${popup.id}`, { status: 'COMPLETED' });
        } else {
          await api.patch(`/tasks/${popup.id}/status`, { status: 'COMPLETED' });
        }
        toast({ title: t.taskAction?.completed || 'Task Completed', variant: 'success' });
      } else {
        if (contactId) {
          await api.put(`/contacts/${contactId}/reminders/${popup.id}`, { isCompleted: true });
        } else {
          await api.patch(`/tasks/${popup.id}/status`, { status: 'COMPLETED' });
        }
        toast({ title: t.taskAction?.completed || 'Reminder Completed', variant: 'success' });
      }
      fetchCalendarData();
      setSelectedEvents(prev => prev.filter(e => e.id !== popup.id));
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to complete', variant: 'error' });
    }
  };

  const handleActionDismiss = async () => {
    const popup = actionPopup;
    if (!popup) return;
    setActionPopup(null);
    try {
      const contactId = popup.contact?.id || null;
      if (popup.type === 'task') {
        if (contactId) {
          await api.put(`/contacts/${contactId}/tasks/${popup.id}`, { status: 'CANCELLED' });
        } else {
          await api.patch(`/tasks/${popup.id}/status`, { status: 'CANCELLED' });
        }
      } else {
        if (contactId) {
          await api.put(`/contacts/${contactId}/reminders/${popup.id}`, { isCompleted: true });
        } else {
          await api.patch(`/tasks/${popup.id}/status`, { status: 'CANCELLED' });
        }
      }
      toast({ title: t.taskAction?.dismissed || 'Dismissed', variant: 'success' });
      fetchCalendarData();
      setSelectedEvents(prev => prev.filter(e => e.id !== popup.id));
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to dismiss', variant: 'error' });
    }
  };

  const handleActionRemindLater = async (remindAt: Date) => {
    const popup = actionPopup;
    if (!popup) return;
    setActionPopup(null);
    try {
      const contactId = popup.contact?.id || null;
      if (popup.type === 'task') {
        if (contactId) {
          await api.put(`/contacts/${contactId}/tasks/${popup.id}`, { reminderAt: remindAt.toISOString() });
        } else {
          await api.patch(`/tasks/${popup.id}`, { reminderAt: remindAt.toISOString() });
        }
      } else {
        if (contactId) {
          await api.put(`/contacts/${contactId}/reminders/${popup.id}`, { reminderAt: remindAt.toISOString() });
        } else {
          await api.patch(`/tasks/${popup.id}`, { reminderAt: remindAt.toISOString() });
        }
      }
      toast({ title: t.taskAction?.snoozed || 'Reminder set', variant: 'success' });
      fetchCalendarData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to set reminder', variant: 'error' });
    }
  };

  // Get priority color
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-600';
      case 'HIGH': return 'bg-red-500';
      case 'MEDIUM': return 'bg-orange-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-th-nav-bottom backdrop-blur-sm border-b border-th-border px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
            <ArrowLeft24Regular className="w-5 h-5 text-th-text" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-th-text flex items-center gap-2">
              <Calendar24Regular className="w-6 h-6 text-emerald-400" />
              {t.calendar?.title || 'Calendar'}
            </h1>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 p-4">
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{summary.totals.today}</p>
            <p className="text-xs text-th-text-t">{t.calendar?.today || 'Today'}</p>
          </div>
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{summary.totals.thisWeek}</p>
            <p className="text-xs text-th-text-t">{t.calendar?.thisWeek || 'This Week'}</p>
          </div>
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{summary.totals.overdue}</p>
            <p className="text-xs text-th-text-t">{t.calendar?.overdue || 'Overdue'}</p>
          </div>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-th-surface-h rounded-lg transition-colors"
        >
          <ChevronLeft24Regular className="w-5 h-5 text-th-text" />
        </button>

        <div className="text-center">
          <h2 className="text-lg font-semibold text-th-text">
            {monthNames[currentMonth]} {currentYear}
          </h2>
          <button
            onClick={goToToday}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {t.calendar?.goToToday || 'Go to Today'}
          </button>
        </div>

        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-th-surface-h rounded-lg transition-colors"
        >
          <ChevronRight24Regular className="w-5 h-5 text-th-text" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="px-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-th-text-m py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square bg-th-surface rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ day, isCurrentMonth, dateKey }, index) => {
              const events = eventsByDate[dateKey] || [];
              const hasTask = events.some(e => e.type === 'task');
              const hasReminder = events.some(e => e.type === 'reminder');
              const isSelected = selectedDate === dateKey;

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(dateKey)}
                  className={`
                    aspect-square p-1 rounded-lg transition-all relative
                    ${isCurrentMonth ? 'text-th-text' : 'text-white/70'}
                    ${isToday(dateKey) ? 'bg-emerald-500/30 border border-emerald-500/50' : 'hover:bg-th-surface-h'}
                    ${isSelected ? 'ring-2 ring-emerald-500' : ''}
                  `}
                >
                  <span className="text-sm font-medium">{day}</span>

                  {/* Event indicators */}
                  {events.length > 0 && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {hasTask && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      {hasReminder && <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Date Events */}
      {selectedDate && (
        <div className="mt-6 px-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-th-text-s">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-1 hover:bg-th-surface-h rounded transition-colors"
            >
              <Dismiss24Regular className="w-4 h-4 text-th-text-t" />
            </button>
          </div>

          {selectedEvents.length === 0 ? (
            <div className="text-center py-8 bg-th-surface rounded-xl border border-th-border">
              <Calendar24Regular className="w-10 h-10 text-white/70 mx-auto mb-2" />
              <p className="text-th-text-m">{t.calendar?.noEvents || 'No events on this date'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event) => (
                <div
                  key={event.id}
                  className={`
                    bg-th-surface border rounded-xl p-4
                    ${event.type === 'task' ? 'border-blue-500/30' : 'border-teal-500/30'}
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {event.type === 'task' ? (
                          <TaskListSquareAdd24Regular className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        ) : (
                          <Clock24Regular className="w-4 h-4 text-teal-400 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-th-text truncate">{event.title}</span>
                        {event.priority && (
                          <span className={`w-2 h-2 rounded-full ${getPriorityColor(event.priority)} flex-shrink-0`} />
                        )}
                      </div>

                      {event.description && (
                        <p className="text-xs text-th-text-t mb-2 line-clamp-2">{event.description}</p>
                      )}

                      {event.contact ? (
                        <button
                          onClick={() => router.push(`/contacts/${event.contact!.id}`)}
                          className="flex items-center gap-1.5 text-xs text-th-text-m hover:text-th-text-s transition-colors"
                        >
                          <Person24Regular className="w-3 h-3" />
                          <span>{event.contact.fullName}</span>
                          {event.contact.company && (
                            <>
                              <Building24Regular className="w-3 h-3" />
                              <span>{event.contact.company}</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-th-text-t">
                          <Person24Regular className="w-3 h-3" />
                          <span>Personal task</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleEventClick(event)}
                      className={`
                        p-2 rounded-lg transition-colors flex-shrink-0
                        ${event.type === 'task'
                          ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
                          : 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-400'}
                      `}
                    >
                      <MoreHorizontal24Regular className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 px-4 flex items-center justify-center gap-6 text-xs text-th-text-m">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          <span>{t.calendar?.tasks || 'Tasks'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
          <span>{t.calendar?.reminders || 'Reminders'}</span>
        </div>
      </div>

      {/* Task/Reminder Action Popup */}
      <TaskActionPopup
        isOpen={!!actionPopup}
        onClose={() => setActionPopup(null)}
        onComplete={handleActionComplete}
        onDismiss={handleActionDismiss}
        onRemindLater={handleActionRemindLater}
        title={actionPopup?.title || ''}
        type={actionPopup?.type || 'task'}
        t={t.taskAction}
      />
    </div>
  );
}
