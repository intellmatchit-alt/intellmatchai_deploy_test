'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  MoreHorizontal24Regular,
  Edit24Regular,
  Copy24Regular,
  Delete24Regular,
  Share24Regular,
  CalendarAdd24Regular,
} from '@fluentui/react-icons';

interface TaskCardMenuProps {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onShare?: () => void;
  onAddToCalendar?: () => void;
}

export function TaskCardMenu({
  onEdit,
  onDuplicate,
  onDelete,
  onShare,
  onAddToCalendar,
}: TaskCardMenuProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 rounded-lg hover:bg-th-hover text-white/50 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreHorizontal24Regular className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-th-surface border border-th-border rounded-xl shadow-lg py-1 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleAction(onEdit)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white hover:bg-th-hover transition-colors"
          >
            <Edit24Regular className="w-4 h-4 text-white/50" />
            {(t as any).tasksPage?.menu?.edit || 'Edit'}
          </button>
          <button
            onClick={() => handleAction(onDuplicate)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white hover:bg-th-hover transition-colors"
          >
            <Copy24Regular className="w-4 h-4 text-white/50" />
            {(t as any).tasksPage?.menu?.duplicate || 'Duplicate'}
          </button>
          {onShare && (
            <button
              onClick={() => handleAction(onShare)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white hover:bg-th-hover transition-colors"
            >
              <Share24Regular className="w-4 h-4 text-white/50" />
              {(t as any).tasksPage?.menu?.share || 'Share'}
            </button>
          )}
          {onAddToCalendar && (
            <button
              onClick={() => handleAction(onAddToCalendar)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white hover:bg-th-hover transition-colors"
            >
              <CalendarAdd24Regular className="w-4 h-4 text-white/50" />
              {(t as any).tasksPage?.menu?.addToCalendar || 'Add to Calendar'}
            </button>
          )}
          <div className="border-t border-th-border my-1" />
          <button
            onClick={() => handleAction(onDelete)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Delete24Regular className="w-4 h-4" />
            {(t as any).tasksPage?.menu?.delete || 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
}
