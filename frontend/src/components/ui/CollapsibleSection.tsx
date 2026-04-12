'use client';

import { useState } from 'react';
import { ChevronDown24Regular } from '@fluentui/react-icons';

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  headerColor?: string;
  borderColor?: string;
  metaBadge?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  description,
  icon,
  defaultOpen = false,
  headerColor = 'from-neutral-500 to-neutral-400',
  borderColor,
  metaBadge,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const borderClass = borderColor || 'border-white/[0.12]';

  return (
    <div className={`bg-[linear-gradient(180deg,rgba(10,30,52,0.96),rgba(8,24,42,0.98))] backdrop-blur-xl border-2 ${borderClass} rounded-3xl shadow-lg overflow-visible`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 md:p-6 flex items-start justify-between gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex gap-3.5">
          {icon && (
            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center flex-shrink-0 border border-white/10 bg-white/[0.04]">
              {icon}
            </div>
          )}
          <div className="text-start">
            <span className="text-[1.06rem] font-extrabold text-th-text tracking-tight">{title}</span>
            {description && (
              <p className="text-[0.96rem] text-th-text-s mt-1.5 leading-relaxed font-medium">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {metaBadge && (
            <span className="inline-flex items-center min-h-[38px] px-3 py-2 rounded-full border border-white/[0.12] bg-white/[0.03] text-th-text text-[0.84rem] font-extrabold whitespace-nowrap">
              {metaBadge}
            </span>
          )}
          <ChevronDown24Regular
            className={`w-5 h-5 text-th-text-m transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-5 md:px-6 pb-5 md:pb-6 space-y-5">{children}</div>
      </div>
    </div>
  );
}
