/**
 * Autocomplete Tag Input Component
 *
 * A text input with autocomplete dropdown for adding tags.
 * Supports predefined suggestions and custom entries.
 * Uses portal rendering so dropdown escapes parent stacking contexts.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Add24Regular } from '@fluentui/react-icons';

interface AutocompleteTagInputProps {
  value: string;
  onChange: (value: string) => void;
  onAdd: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  existingTags?: string[];
  className?: string;
  inputClassName?: string;
  accentColor?: 'purple' | 'cyan' | 'amber';
}

export function AutocompleteTagInput({
  value,
  onChange,
  onAdd,
  suggestions,
  placeholder = 'Add tag...',
  existingTags = [],
  className = '',
  inputClassName = '',
  accentColor = 'purple',
}: AutocompleteTagInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Calculate dropdown position from input
  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // Filter suggestions based on input
  useEffect(() => {
    if (value.trim()) {
      const searchTerm = value.toLowerCase().trim();
      const filtered = suggestions
        .filter(s =>
          s.toLowerCase().includes(searchTerm) &&
          !existingTags.includes(s)
        )
        .slice(0, 8);
      setFilteredSuggestions(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      const popular = suggestions
        .filter(s => !existingTags.includes(s))
        .slice(0, 6);
      setFilteredSuggestions(popular);
      setIsOpen(false);
    }
    setHighlightedIndex(-1);
  }, [value, suggestions, existingTags]);

  // Recalculate position when dropdown opens or on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleUpdate = () => updatePosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen, updatePosition]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && filteredSuggestions.length > 0) { setIsOpen(true); updatePosition(); return; }
      setHighlightedIndex(prev =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        handleSelect(filteredSuggestions[highlightedIndex]);
      } else if (value.trim()) {
        handleAdd();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (suggestion: string) => {
    onAdd(suggestion);
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleAdd = () => {
    if (value.trim() && !existingTags.includes(value.trim())) {
      onAdd(value.trim());
      onChange('');
    }
  };

  const handleFocus = () => {
    if (value.trim() && filteredSuggestions.length > 0) {
      setIsOpen(true);
      updatePosition();
    }
  };

  const colorClasses = {
    purple: {
      highlight: 'bg-emerald-500/20 text-emerald-300',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
    },
    cyan: {
      highlight: 'bg-cyan-500/20 text-cyan-300',
      border: 'border-cyan-500/30',
      text: 'text-cyan-400',
    },
    amber: {
      highlight: 'bg-yellow-500/20 text-yellow-300',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
    },
  };

  const colors = colorClasses[accentColor];

  const dropdown = isOpen && filteredSuggestions.length > 0 && mounted ? (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 99999,
      }}
      className="bg-[#0c1f35] border border-[rgba(146,179,221,0.3)] rounded-xl shadow-2xl overflow-hidden"
    >
      <div className="max-h-48 overflow-y-auto">
        {filteredSuggestions.map((suggestion, index) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => handleSelect(suggestion)}
            className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
              index === highlightedIndex
                ? colors.highlight
                : 'text-[#d9e9fb] hover:bg-[rgba(255,255,255,0.06)]'
            }`}
          >
            {suggestion}
          </button>
        ))}
      </div>
      {value.trim() && !filteredSuggestions.includes(value.trim()) && (
        <div className={`px-4 py-2 border-t ${colors.border} bg-[rgba(255,255,255,0.03)]`}>
          <button
            type="button"
            onClick={handleAdd}
            className={`text-sm ${colors.text} hover:underline`}
          >
            + Add &quot;{value.trim()}&quot;
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <div ref={wrapperRef} className={className}>
        <div className="flex items-center bg-[rgba(255,255,255,0.04)] border-2 border-[rgba(146,179,221,0.24)] rounded-2xl overflow-hidden transition-colors focus-within:border-[rgba(24,210,164,0.58)]">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder}
            className={`flex-1 px-4 py-3 bg-transparent text-[#f6fbff] placeholder-[#9ab4d1] focus:outline-none font-medium ${inputClassName}`}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-3 text-[#4dd8ff] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          >
            <Add24Regular className="w-5 h-5" />
          </button>
        </div>
      </div>
      {dropdown && createPortal(dropdown, document.body)}
    </>
  );
}

// Common suggestions for different tag types
export const SECTOR_SUGGESTIONS = [
  'Technology', 'IT Services', 'Software Development', 'Finance & Banking',
  'Healthcare', 'E-commerce', 'Real Estate', 'Consulting',
  'Media & Entertainment', 'Education', 'Manufacturing', 'Telecommunications',
  'Energy', 'Logistics & Supply Chain', 'Retail', 'Government',
  'Non-Profit', 'Legal Services', 'Marketing & Advertising', 'Hospitality',
  'Automotive', 'Agriculture', 'Pharmaceuticals', 'Insurance',
  'Construction', 'Aerospace', 'Fashion & Apparel', 'Food & Beverage',
  'Sports & Fitness', 'Travel & Tourism',
];

export const SKILL_SUGGESTIONS = [
  'Executive Leadership', 'Team Management', 'Strategic Planning', 'Project Management',
  'Software Development', 'System Architecture', 'Cloud Computing', 'Data Analysis',
  'Machine Learning', 'Cybersecurity', 'DevOps', 'UI/UX Design',
  'Business Development', 'Sales Strategy', 'Marketing Strategy', 'Financial Analysis',
  'Product Management', 'Communication', 'Problem Solving', 'Digital Transformation',
  'Quality Assurance', 'Risk Management', 'Brand Management', 'Content Strategy',
];

export const INTEREST_SUGGESTIONS = [
  'Technology Trends', 'Artificial Intelligence', 'Blockchain',
  'Startups & Entrepreneurship', 'Venture Capital', 'Digital Innovation',
  'Sustainability', 'Leadership Development', 'Business Strategy',
  'Networking', 'Mentorship', 'Social Impact', 'Future of Work',
];

export const HOBBY_SUGGESTIONS = [
  'Reading', 'Travel', 'Photography', 'Cooking', 'Music', 'Sports',
  'Fitness', 'Running', 'Hiking', 'Yoga', 'Gaming', 'Art',
  'Writing', 'Gardening', 'Movies', 'Podcasts', 'Golf', 'Tennis',
  'Chess', 'Volunteering', 'Meditation', 'Dancing',
];
