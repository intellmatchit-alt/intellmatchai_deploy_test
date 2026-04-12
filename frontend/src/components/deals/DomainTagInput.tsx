'use client';

import { useState, useEffect, useRef } from 'react';
import { Dismiss12Regular } from '@fluentui/react-icons';
import { getSectors, Sector } from '@/lib/api/profile';

interface DomainTagInputProps {
  value: string;
  onChange: (value: string) => void;
  accentColor?: 'emerald' | 'blue' | 'purple';
  placeholder?: string;
}

const ringColors = {
  emerald: 'focus-within:ring-emerald-500/50 focus-within:border-emerald-500',
  blue: 'focus-within:ring-blue-500/50 focus-within:border-blue-500',
  purple: 'focus-within:ring-emerald-500/50 focus-within:border-emerald-500',
};

const tagColors = {
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  purple: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const dismissColors = {
  emerald: 'hover:bg-emerald-500/30',
  blue: 'hover:bg-blue-500/30',
  purple: 'hover:bg-emerald-500/30',
};

export function DomainTagInput({ value, onChange, accentColor = 'emerald', placeholder }: DomainTagInputProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse comma-separated value into tags
  const tags = value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];

  useEffect(() => {
    getSectors()
      .then(data => setSectors(data))
      .catch(() => {});
  }, []);

  const sectorNames = sectors.map(s => s.name);
  const filtered = inputValue
    ? sectorNames.filter(s =>
        s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.some(t => t.toLowerCase() === s.toLowerCase())
      )
    : sectorNames.filter(s => !tags.some(t => t.toLowerCase() === s.toLowerCase()));

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) return;
    const newTags = [...tags, trimmed];
    onChange(newTags.join(', '));
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index);
    onChange(newTags.join(', '));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="relative">
      <div
        className={`flex flex-wrap gap-1.5 p-2.5 bg-th-surface border border-th-border rounded-xl focus-within:outline-none focus-within:ring-2 ${ringColors[accentColor]} transition-all min-h-[46px] cursor-text`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border ${tagColors[accentColor]}`}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(i); }}
              className={`p-0.5 rounded-full transition-colors ${dismissColors[accentColor]}`}
            >
              <Dismiss12Regular className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? (placeholder || 'Type to search industries...') : ''}
          className="flex-1 min-w-[120px] bg-transparent text-th-text placeholder-th-text-m text-sm focus:outline-none py-1 px-1"
        />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 py-1 bg-th-bg-t border border-th-border rounded-xl shadow-2xl max-h-48 overflow-auto">
          {filtered.slice(0, 15).map((sector) => (
            <button
              key={sector}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(sector);
              }}
              className="w-full px-4 py-2 text-sm text-start text-th-text hover:bg-th-surface-h transition-colors"
            >
              {sector}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
