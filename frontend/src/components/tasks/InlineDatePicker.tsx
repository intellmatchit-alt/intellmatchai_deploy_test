'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
} from '@fluentui/react-icons';

interface InlineDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function InlineDatePicker({ value, onChange }: InlineDatePickerProps) {
  const initial = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    const days: { day: number; dateStr: string; current: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      days.push({ day: d, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, current: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, current: true });
    }

    const remaining = Math.ceil(days.length / 7) * 7 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 1 : month + 2;
      const y = month === 11 ? year + 1 : year;
      days.push({ day: d, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, current: false });
    }

    return days;
  }, [year, month]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-th-surface p-1.5">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-1">
        <button type="button" onClick={prevMonth} className="p-0.5 rounded hover:bg-th-surface-h text-white/50">
          <ChevronLeft24Regular className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-semibold text-white">{monthLabel}</span>
        <button type="button" onClick={nextMonth} className="p-0.5 rounded hover:bg-th-surface-h text-white/50">
          <ChevronRight24Regular className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7">
        {DAYS.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-white/50 py-0.5">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map(({ day, dateStr, current }, i) => {
          const isSelected = dateStr === value;
          const isToday = dateStr === todayStr;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(dateStr)}
              className={cn(
                'h-7 flex items-center justify-center rounded text-[11px] font-medium transition-all',
                !current && 'text-white/50/30',
                current && 'text-white hover:bg-th-surface-h',
                isToday && !isSelected && 'bg-emerald-500/20 text-emerald-400',
                isSelected && 'bg-emerald-500 text-white',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex gap-1 mt-1 pt-1 border-t border-th-border/50">
        <button type="button" onClick={() => onChange(todayStr)}
          className="flex-1 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors">
          Today
        </button>
        <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); onChange(fmt(d)); }}
          className="flex-1 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors">
          Tomorrow
        </button>
        <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 7); onChange(fmt(d)); }}
          className="flex-1 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors">
          +1 Week
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')}
            className="flex-1 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/10 rounded transition-colors">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
