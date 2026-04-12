'use client';

import { useState, useRef, useEffect } from 'react';
import { useOrganizationStore } from '@/stores/organizationStore';
import { useI18n } from '@/lib/i18n';
import {
  Person24Regular,
  Building24Regular,
  ChevronDown16Regular,
} from '@fluentui/react-icons';

export function ContextSwitcher() {
  const { t } = useI18n();
  const { organization, activeOrgId, setActiveOrg } = useOrganizationStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Don't render if user has no organization
  if (!organization) return null;

  const isOrgMode = activeOrgId === organization.id;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-sm font-medium cursor-pointer ${
          isOrgMode
            ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
            : 'hover:bg-th-surface-h text-th-text-s'
        }`}
      >
        {isOrgMode ? (
          <Building24Regular className="w-4 h-4" />
        ) : (
          <Person24Regular className="w-4 h-4" />
        )}
        <span className="max-w-[100px] truncate">
          {isOrgMode ? organization.name : t.contextSwitcher.personal}
        </span>
        <ChevronDown16Regular className="w-3.5 h-3.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 min-w-[180px] bg-th-bg-s border border-th-border rounded-xl shadow-xl z-50 py-1 overflow-hidden">
          {/* Personal option */}
          <button
            type="button"
            onClick={() => {
              setActiveOrg(null);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors cursor-pointer ${
              !isOrgMode
                ? 'bg-th-surface text-th-text'
                : 'text-th-text-t hover:bg-th-surface hover:text-th-text'
            }`}
          >
            <Person24Regular className="w-4.5 h-4.5" />
            <span>{t.contextSwitcher.personal}</span>
            {!isOrgMode && (
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          {/* Organization option */}
          <button
            type="button"
            onClick={() => {
              setActiveOrg(organization.id);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors cursor-pointer ${
              isOrgMode
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-th-text-t hover:bg-th-surface hover:text-th-text'
            }`}
          >
            <Building24Regular className="w-4.5 h-4.5" />
            <span className="truncate">{organization.name}</span>
            {isOrgMode && (
              <span className="ml-auto w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
