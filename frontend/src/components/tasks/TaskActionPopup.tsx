/**
 * Task Action Popup
 *
 * Shows a confirmation popup when clicking on a task/reminder
 * with options: Complete, Dismiss, Remind Me Later (with time options).
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  CheckmarkCircle24Regular,
  Dismiss24Regular,
  Clock24Regular,
  Timer24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Calendar24Regular,
} from '@fluentui/react-icons';

export interface TaskActionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onDismiss: () => void;
  onRemindLater: (remindAt: Date) => void;
  title: string;
  type: 'task' | 'reminder';
  t: {
    complete: string;
    dismiss: string;
    remindLater: string;
    in15min: string;
    in1hour: string;
    in3hours: string;
    tomorrow: string;
    customTime: string;
    setReminder: string;
    back: string;
    chooseTime: string;
  };
}

const REMIND_OPTIONS = [
  { key: '15min', minutes: 15 },
  { key: '1hour', minutes: 60 },
  { key: '3hours', minutes: 180 },
  { key: 'tomorrow', minutes: 0 },
] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const TIME_PRESETS = [
  '09:00', '10:00', '12:00', '14:00', '16:00', '18:00',
];

function getTomorrowMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function formatTime12(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function TaskActionPopup({
  isOpen,
  onClose,
  onComplete,
  onDismiss,
  onRemindLater,
  title,
  type,
  t,
}: TaskActionPopupProps) {
  const [showRemindOptions, setShowRemindOptions] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [viewDate, setViewDate] = useState(new Date());
  const popupRef = useRef<HTMLDivElement>(null);

  // Reset state when popup opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShowRemindOptions(false);
      setShowCustomPicker(false);
      setSelectedDate('');
      setSelectedTime('09:00');
      setViewDate(new Date());
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRemindOption = (option: typeof REMIND_OPTIONS[number]) => {
    let remindAt: Date;
    if (option.key === 'tomorrow') {
      remindAt = getTomorrowMorning();
    } else {
      remindAt = new Date(Date.now() + option.minutes * 60 * 1000);
    }
    onRemindLater(remindAt);
  };

  const handleCustomRemind = () => {
    if (!selectedDate) return;
    const [h, m] = selectedTime.split(':').map(Number);
    const remindAt = new Date(selectedDate + 'T00:00:00');
    remindAt.setHours(h, m, 0, 0);
    if (remindAt <= new Date()) return;
    onRemindLater(remindAt);
    onClose();
  };

  const accentColor = type === 'task' ? 'cyan' : 'purple';
  const accentClasses = {
    cyan: {
      completeBg: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400',
      dismissBg: 'bg-red-500/15 hover:bg-red-500/25 text-red-400',
      remindBg: 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400',
      optionBg: 'hover:bg-cyan-500/10 text-white',
      border: 'border-cyan-500/30',
      setBtn: 'bg-cyan-500 hover:bg-cyan-600 text-white',
    },
    purple: {
      completeBg: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400',
      dismissBg: 'bg-red-500/15 hover:bg-red-500/25 text-red-400',
      remindBg: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400',
      optionBg: 'hover:bg-emerald-500/10 text-white',
      border: 'border-emerald-500/30',
      setBtn: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    },
  };
  const colors = accentClasses[accentColor];

  const labelMap: Record<string, string> = {
    '15min': t.in15min,
    '1hour': t.in1hour,
    '3hours': t.in3hours,
    'tomorrow': t.tomorrow,
  };

  // Calendar logic
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const calendarDays: { day: number; isCurrentMonth: boolean; dateKey: string }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const pm = currentMonth === 0 ? 12 : currentMonth;
    const py = currentMonth === 0 ? currentYear - 1 : currentYear;
    calendarDays.push({ day, isCurrentMonth: false, dateKey: `${py}-${String(pm).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({ day, isCurrentMonth: true, dateKey: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
  }
  const remaining = 42 - calendarDays.length;
  for (let day = 1; day <= remaining; day++) {
    const nm = currentMonth === 11 ? 1 : currentMonth + 2;
    const ny = currentMonth === 11 ? currentYear + 1 : currentYear;
    calendarDays.push({ day, isCurrentMonth: false, dateKey: `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in px-4">
      <div
        ref={popupRef}
        className={`w-full max-w-sm bg-th-nav-bottom border ${colors.border} rounded-2xl shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] overflow-y-auto`}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-th-border">
          <p className="text-sm font-semibold text-white truncate">{title}</p>
        </div>

        {!showRemindOptions ? (
          /* Main Actions */
          <div className="p-3 space-y-2">
            <button
              onClick={() => { onComplete(); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${colors.completeBg}`}
            >
              <CheckmarkCircle24Regular className="w-5 h-5" />
              <span className="text-sm font-medium">{t.complete}</span>
            </button>

            <button
              onClick={() => { onDismiss(); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${colors.dismissBg}`}
            >
              <Dismiss24Regular className="w-5 h-5" />
              <span className="text-sm font-medium">{t.dismiss}</span>
            </button>

            <button
              onClick={() => setShowRemindOptions(true)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${colors.remindBg}`}
            >
              <Clock24Regular className="w-5 h-5" />
              <span className="text-sm font-medium">{t.remindLater}</span>
            </button>
          </div>
        ) : !showCustomPicker ? (
          /* Remind Me Later — Preset Options */
          <div className="p-3 space-y-2">
            <button
              onClick={() => setShowRemindOptions(false)}
              className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors mb-1 px-1"
            >
              <ChevronLeft24Regular className="w-4 h-4 rtl:rotate-180" />
              {t.back}
            </button>

            <p className="text-xs text-white/70 font-medium px-1">{t.chooseTime}</p>

            {REMIND_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => { handleRemindOption(option); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${colors.optionBg}`}
              >
                <Timer24Regular className="w-4 h-4 text-white/60" />
                <span className="text-sm">{labelMap[option.key]}</span>
              </button>
            ))}

            {/* Custom date & time button */}
            <button
              onClick={() => setShowCustomPicker(true)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${colors.optionBg}`}
            >
              <Calendar24Regular className="w-4 h-4 text-white/60" />
              <span className="text-sm">{t.customTime}</span>
            </button>
          </div>
        ) : (
          /* Custom Date & Time — Calendar Picker */
          <div className="p-3 space-y-3">
            <button
              onClick={() => setShowCustomPicker(false)}
              className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors px-1"
            >
              <ChevronLeft24Regular className="w-4 h-4 rtl:rotate-180" />
              {t.back}
            </button>

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setViewDate(new Date(currentYear, currentMonth - 1, 1))} className="p-1.5 hover:bg-th-surface-h rounded-lg transition-colors">
                <ChevronLeft24Regular className="w-4 h-4 text-white" />
              </button>
              <span className="text-sm font-semibold text-white">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>
              <button type="button" onClick={() => setViewDate(new Date(currentYear, currentMonth + 1, 1))} className="p-1.5 hover:bg-th-surface-h rounded-lg transition-colors">
                <ChevronRight24Regular className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-white/60 py-0.5">{d}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(({ day, isCurrentMonth, dateKey }, idx) => {
                const isSelected = dateKey === selectedDate;
                const isToday = dateKey === todayKey;
                const isPast = dateKey < todayKey;

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isPast && !isToday}
                    onClick={() => setSelectedDate(dateKey)}
                    className={`
                      aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all
                      ${!isCurrentMonth ? 'text-white/70' : isPast && !isToday ? 'text-white/70' : 'text-white'}
                      ${isSelected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : ''}
                      ${isToday && !isSelected ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : ''}
                      ${!isSelected && !(isPast && !isToday) ? 'hover:bg-th-surface-h' : ''}
                      ${isPast && !isToday ? 'cursor-not-allowed' : ''}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Time Selection */}
            <div>
              <p className="text-xs text-white/60 font-medium mb-2 px-1">Time</p>
              <div className="grid grid-cols-3 gap-1.5">
                {TIME_PRESETS.map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setSelectedTime(tp)}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                      tp === selectedTime
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'text-white hover:bg-th-surface-h'
                    }`}
                  >
                    {formatTime12(tp)}
                  </button>
                ))}
              </div>
            </div>

            {/* Set Reminder Button */}
            <button
              onClick={handleCustomRemind}
              disabled={!selectedDate}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors.setBtn}`}
            >
              {t.setReminder}
            </button>
          </div>
        )}

        {/* Cancel footer */}
        <div className="px-3 pb-3">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
