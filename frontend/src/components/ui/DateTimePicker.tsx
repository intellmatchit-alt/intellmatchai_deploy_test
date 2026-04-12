/**
 * DateTimePicker
 *
 * Custom calendar-style date and time picker.
 * Styled to match the app's calendar page (purple accent, dark theme).
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Clock24Regular,
  Calendar24Regular,
  Dismiss24Regular,
} from '@fluentui/react-icons';

interface DateTimePickerProps {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  dateLabel?: string;
  timeLabel?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIME_PRESETS = [
  '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00',
];

export function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  dateLabel = 'Due Date',
  timeLabel = 'Time',
}: DateTimePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (date) return new Date(date + 'T00:00:00');
    return new Date();
  });
  const calRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

  // Update viewDate when date prop changes
  useEffect(() => {
    if (date) {
      setViewDate(new Date(date + 'T00:00:00'));
    }
  }, [date]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) {
        setShowTimePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  // Build calendar days
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const calendarDays: { day: number; isCurrentMonth: boolean; dateKey: string }[] = [];

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
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

  // Next month days
  const remaining = 42 - calendarDays.length;
  for (let day = 1; day <= remaining; day++) {
    const nextMonth = currentMonth === 11 ? 1 : currentMonth + 2;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const dateKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ day, isCurrentMonth: false, dateKey });
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const goToPrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const goToNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

  const handleDateSelect = (dateKey: string) => {
    onDateChange(dateKey);
    setShowCalendar(false);
  };

  const handleClearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateChange('');
    onTimeChange('');
  };

  const handleClearTime = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTimeChange('');
  };

  // Format display date
  const formatDisplayDate = (d: string) => {
    if (!d) return '';
    const parts = d.split('-');
    const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDisplayTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Date Picker */}
      <div className="relative" ref={calRef}>
        <label className="block text-sm font-medium text-th-text-t mb-1">{dateLabel}</label>
        <button
          type="button"
          onClick={() => { setShowCalendar(!showCalendar); setShowTimePicker(false); }}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-th-surface border border-th-border rounded-lg text-left hover:border-emerald-500/50 transition-colors"
        >
          <Calendar24Regular className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className={`flex-1 text-sm truncate ${date ? 'text-th-text' : 'text-th-text-m'}`}>
            {date ? formatDisplayDate(date) : 'Select date'}
          </span>
          {date && (
            <span onClick={handleClearDate} className="p-0.5 hover:bg-th-surface-h rounded transition-colors">
              <Dismiss24Regular className="w-3.5 h-3.5 text-th-text-t" />
            </span>
          )}
        </button>

        {/* Calendar Dropdown */}
        {showCalendar && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-th-nav-bottom border border-emerald-500/30 rounded-xl shadow-2xl p-3 animate-scale-up min-w-[280px]">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={goToPrevMonth} className="p-1.5 hover:bg-th-surface-h rounded-lg transition-colors">
                <ChevronLeft24Regular className="w-4 h-4 text-th-text" />
              </button>
              <span className="text-sm font-semibold text-th-text">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>
              <button type="button" onClick={goToNextMonth} className="p-1.5 hover:bg-th-surface-h rounded-lg transition-colors">
                <ChevronRight24Regular className="w-4 h-4 text-th-text" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-th-text-t py-1">{d}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(({ day, isCurrentMonth, dateKey }, idx) => {
                const isSelected = dateKey === date;
                const isToday = dateKey === todayKey;
                const isPast = dateKey < todayKey;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDateSelect(dateKey)}
                    className={`
                      aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all
                      ${!isCurrentMonth ? 'text-white/70' : isPast ? 'text-th-text-t' : 'text-th-text'}
                      ${isSelected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : ''}
                      ${isToday && !isSelected ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : ''}
                      ${!isSelected && !isToday ? 'hover:bg-th-surface-h' : ''}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Quick options */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-th-border">
              <button
                type="button"
                onClick={() => handleDateSelect(todayKey)}
                className="flex-1 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const tmrw = new Date();
                  tmrw.setDate(tmrw.getDate() + 1);
                  const key = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
                  handleDateSelect(key);
                }}
                className="flex-1 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  const key = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;
                  handleDateSelect(key);
                }}
                className="flex-1 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
              >
                Next Week
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Time Picker */}
      <div className="relative" ref={timeRef}>
        <label className="block text-sm font-medium text-th-text-t mb-1">{timeLabel}</label>
        <button
          type="button"
          onClick={() => { setShowTimePicker(!showTimePicker); setShowCalendar(false); }}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-th-surface border border-th-border rounded-lg text-left hover:border-emerald-500/50 transition-colors"
        >
          <Clock24Regular className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className={`flex-1 text-sm ${time ? 'text-th-text' : 'text-th-text-m'}`}>
            {time ? formatDisplayTime(time) : 'Select time'}
          </span>
          {time && (
            <span onClick={handleClearTime} className="p-0.5 hover:bg-th-surface-h rounded transition-colors">
              <Dismiss24Regular className="w-3.5 h-3.5 text-th-text-t" />
            </span>
          )}
        </button>

        {/* Time Dropdown */}
        {showTimePicker && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-th-nav-bottom border border-emerald-500/30 rounded-xl shadow-2xl p-3 animate-scale-up">
            <div className="grid grid-cols-3 gap-1.5">
              {TIME_PRESETS.map((t) => {
                const isSelected = t === time;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { onTimeChange(t); setShowTimePicker(false); }}
                    className={`py-2 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'text-th-text hover:bg-th-surface-h'
                    }`}
                  >
                    {formatDisplayTime(t)}
                  </button>
                );
              })}
            </div>

            {/* Custom time input */}
            <div className="mt-3 pt-3 border-t border-th-border">
              <label className="text-[10px] text-th-text-t font-medium mb-1 block">Custom time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => { onTimeChange(e.target.value); setShowTimePicker(false); }}
                className="w-full px-3 py-2 bg-th-bg border border-th-border rounded-lg text-sm text-th-text focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
