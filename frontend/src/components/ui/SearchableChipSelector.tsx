'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search24Regular,
  Dismiss16Regular,
  Add24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  Star24Filled,
  Checkmark24Regular,
} from '@fluentui/react-icons';

interface ChipItem {
  id: string;
  name: string;
}

interface SearchableChipSelectorProps {
  items: ChipItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  suggestedIds?: string[];
  searchPlaceholder?: string;
  accentColor?: 'emerald' | 'blue' | 'cyan' | 'green' | 'purple' | 'amber';
  label?: string;
  allowCustom?: boolean;
  onAddCustom?: (name: string) => void;
  customPlaceholder?: string;
}

const colorMap = {
  emerald: {
    selected: 'bg-emerald-400 text-[#042820] border border-emerald-400/80',
    suggested: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20',
    suggestedSelected: 'bg-yellow-400 text-[#042820] border border-yellow-400/80',
    default: 'bg-th-surface text-th-text border border-th-border hover:bg-white/[0.12]',
    chip: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
    search: 'focus:ring-emerald-500/50 focus:border-emerald-500/50',
    expand: 'text-emerald-400 hover:text-emerald-300',
  },
  blue: {
    selected: 'bg-emerald-400 text-[#042820] border border-emerald-400/80',
    suggested: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20',
    suggestedSelected: 'bg-yellow-400 text-[#042820] border border-yellow-400/80',
    default: 'bg-th-surface text-th-text border border-th-border hover:bg-white/[0.12]',
    chip: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
    search: 'focus:ring-emerald-500/50 focus:border-emerald-500/50',
    expand: 'text-emerald-400 hover:text-emerald-300',
  },
  cyan: {
    selected: 'bg-emerald-400 text-[#042820] border border-emerald-400/80',
    suggested: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20',
    suggestedSelected: 'bg-yellow-400 text-[#042820] border border-yellow-400/80',
    default: 'bg-th-surface text-th-text border border-th-border hover:bg-white/[0.12]',
    chip: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
    search: 'focus:ring-emerald-500/50 focus:border-emerald-500/50',
    expand: 'text-emerald-400 hover:text-emerald-300',
  },
  green: {
    selected: 'bg-emerald-400 text-[#042820] border border-emerald-400/80',
    suggested: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20',
    suggestedSelected: 'bg-yellow-400 text-[#042820] border border-yellow-400/80',
    default: 'bg-th-surface text-th-text border border-th-border hover:bg-white/[0.12]',
    chip: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
    search: 'focus:ring-emerald-500/50 focus:border-emerald-500/50',
    expand: 'text-emerald-400 hover:text-emerald-300',
  },
  purple: {
    selected: 'bg-emerald-400 text-[#042820] border border-emerald-400/80',
    suggested: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20',
    suggestedSelected: 'bg-yellow-400 text-[#042820] border border-yellow-400/80',
    default: 'bg-th-surface text-th-text border border-th-border hover:bg-white/[0.12]',
    chip: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
    search: 'focus:ring-emerald-500/50 focus:border-emerald-500/50',
    expand: 'text-emerald-400 hover:text-emerald-300',
  },
  amber: {
    selected: 'bg-emerald-400 text-[#042820] border border-emerald-400/80',
    suggested: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20',
    suggestedSelected: 'bg-yellow-400 text-[#042820] border border-yellow-400/80',
    default: 'bg-th-surface text-th-text border border-th-border hover:bg-white/[0.12]',
    chip: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
    search: 'focus:ring-emerald-500/50 focus:border-emerald-500/50',
    expand: 'text-emerald-400 hover:text-emerald-300',
  },
};

export function SearchableChipSelector({
  items,
  selectedIds,
  onToggle,
  suggestedIds = [],
  searchPlaceholder = 'Search...',
  accentColor = 'emerald',
  label,
  allowCustom = false,
  onAddCustom,
  customPlaceholder = 'Add custom...',
}: SearchableChipSelectorProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(selectedIds.length > 0);
  const [customInput, setCustomInput] = useState('');
  const prevSelectedCount = useRef(selectedIds.length);
  const colors = colorMap[accentColor];

  // Auto-expand when selected items are added (e.g. from extraction)
  useEffect(() => {
    if (selectedIds.length > prevSelectedCount.current && selectedIds.length > 0) {
      setExpanded(true);
    }
    prevSelectedCount.current = selectedIds.length;
  }, [selectedIds.length]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aScore = (selectedIds.includes(a.id) ? 2 : 0) + (suggestedIds.includes(a.id) ? 1 : 0);
      const bScore = (selectedIds.includes(b.id) ? 2 : 0) + (suggestedIds.includes(b.id) ? 1 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    });
  }, [items, selectedIds, suggestedIds]);

  const filteredItems = useMemo(() => {
    if (!search) return sortedItems;
    return sortedItems.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
  }, [sortedItems, search]);

  const getChipClass = (id: string) => {
    const isSelected = selectedIds.includes(id);
    const isSuggested = suggestedIds.includes(id);
    if (isSelected && isSuggested) return colors.suggestedSelected;
    if (isSelected) return colors.selected;
    if (isSuggested) return colors.suggested;
    return colors.default;
  };

  const handleAddCustom = () => {
    if (!customInput.trim() || !onAddCustom) return;
    onAddCustom(customInput.trim());
    setCustomInput('');
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-th-text-s">{label}</span>
          {selectedIds.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${colors.chip}`}>
              {selectedIds.length} selected
            </span>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search24Regular className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-m font-bold" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); if (e.target.value) setExpanded(true); }}
          placeholder={searchPlaceholder}
          className={`w-full ps-10 pe-4 py-[15px] bg-white/[0.04] border-2 border-white/[0.12] rounded-2xl text-[1rem] text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:border-emerald-500/60 focus:shadow-[0_0_0_4px_rgba(24,210,164,0.22)] focus:bg-white/[0.05] transition-all ${colors.search}`}
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-m hover:text-th-text">
            <Dismiss16Regular className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Selected chips (removable) */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const item = items.find(i => i.id === id);
            if (!item) return null;
            return (
              <span key={id} className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border ${colors.chip}`}>
                {suggestedIds.includes(id) && <Star24Filled className="w-3 h-3" />}
                {item.name}
                <button type="button" onClick={() => onToggle(id)} className="hover:text-th-text">
                  <Dismiss16Regular className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Chips area container */}
      <div className="border-2 border-white/[0.10] bg-white/[0.025] rounded-[18px] p-3 space-y-3">
        {/* Chip grid */}
        <div className={`flex flex-wrap gap-2.5 overflow-y-auto scrollbar-purple transition-all ${expanded ? 'max-h-96' : 'max-h-32'}`}>
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={`px-3.5 py-2 rounded-full text-[0.92rem] font-bold border-2 transition-all active:scale-95 flex items-center gap-2 ${getChipClass(item.id)}`}
            >
              {suggestedIds.includes(item.id) && <Star24Filled className="w-3.5 h-3.5 text-yellow-400" />}
              {selectedIds.includes(item.id) && <Checkmark24Regular className="w-3.5 h-3.5" />}
              {item.name}
            </button>
          ))}
          {search && filteredItems.length === 0 && (
            <p className="text-xs text-th-text-m py-2 px-1">No matches for &quot;{search}&quot;</p>
          )}
        </div>

        {/* Expand toggle */}
        {items.length > 10 && (
          <button type="button" onClick={() => setExpanded(!expanded)} className={`text-xs font-bold flex items-center gap-1 ${colors.expand}`}>
            {expanded ? <><ChevronUp24Regular className="w-4 h-4" />Show less</> : <><ChevronDown24Regular className="w-4 h-4" />Show all ({items.length})</>}
          </button>
        )}

        {/* Custom entry */}
        {allowCustom && onAddCustom && (
          <div className="grid grid-cols-[1fr_auto] gap-2.5">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustom())}
              placeholder={customPlaceholder}
              className={`w-full px-4 py-3 bg-white/[0.04] border-2 border-white/[0.12] rounded-2xl text-[1rem] text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:border-emerald-500/60 transition-all ${colors.search}`}
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!customInput.trim()}
              className="w-12 h-full rounded-[14px] border-2 border-blue-500/20 bg-blue-500/[0.08] text-cyan-400 text-[22px] font-extrabold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-blue-500/[0.14]"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
