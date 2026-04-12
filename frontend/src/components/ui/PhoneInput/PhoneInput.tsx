/**
 * Phone Input Component
 *
 * A phone number input with country code dropdown showing flags.
 * Supports RTL layouts and dark theme styling.
 *
 * @module components/ui/PhoneInput/PhoneInput
 */

'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown24Regular, Search24Regular } from '@fluentui/react-icons';
import { cn } from '@/lib/utils';
import {
  CountryCode,
  countryCodes,
  getDefaultCountry,
  parsePhoneNumber,
  formatPhoneNumber
} from './countryCodes';

export interface PhoneInputProps {
  /**
   * The full phone value (e.g., "+971501234567")
   */
  value?: string;

  /**
   * Called when phone value changes
   */
  onChange?: (value: string) => void;

  /**
   * Called when country code changes
   * Returns the ISO country code (e.g., 'SA', 'AE')
   */
  onCountryChange?: (countryCode: string) => void;

  /**
   * Called when input loses focus
   */
  onBlur?: () => void;

  /**
   * Placeholder for the local number input
   */
  placeholder?: string;

  /**
   * Whether the input is disabled
   */
  disabled?: boolean;

  /**
   * Error state styling
   */
  error?: boolean;

  /**
   * Additional className for the container
   */
  className?: string;

  /**
   * Default country code (ISO code like 'US', 'AE')
   */
  defaultCountry?: string;

  /**
   * Input name attribute
   */
  name?: string;

  /**
   * Whether field is required
   */
  required?: boolean;
}

/**
 * PhoneInput component with country code selector
 */
export function PhoneInput({
  value = '',
  onChange,
  onCountryChange,
  onBlur,
  placeholder = '50 123 4567',
  disabled = false,
  error = false,
  className,
  defaultCountry = 'AE',
  name,
  required,
}: PhoneInputProps) {
  // Parse initial value to get country and local number
  const parsed = parsePhoneNumber(value);

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(() => {
    if (parsed.countryCode) return parsed.countryCode;
    return countryCodes.find(c => c.code === defaultCountry) || getDefaultCountry();
  });

  const [localNumber, setLocalNumber] = useState(parsed.localNumber);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Track if user has interacted with the input
  const userInteractedRef = useRef(false);

  // Update country when defaultCountry prop changes (e.g., after geolocation detection)
  // Only if user hasn't interacted and no phone value is set
  useEffect(() => {
    if (userInteractedRef.current) return;
    if (value) return; // Don't override if there's already a phone value
    const match = countryCodes.find(c => c.code === defaultCountry);
    if (match && match.code !== selectedCountry.code) {
      setSelectedCountry(match);
      if (onCountryChange) {
        onCountryChange(match.code);
      }
    }
  }, [defaultCountry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-parse when value changes from external source (e.g., scanned contact data)
  // Only do this if user hasn't manually interacted with the input
  useEffect(() => {
    if (userInteractedRef.current) return; // Don't override user's manual selection

    const newParsed = parsePhoneNumber(value);
    if (newParsed.countryCode) {
      setSelectedCountry(newParsed.countryCode);
      setLocalNumber(newParsed.localNumber);
      // Notify parent of detected country code
      if (onCountryChange) {
        onCountryChange(newParsed.countryCode.code);
      }
    } else if (value && !newParsed.countryCode) {
      // If there's a value but no country code detected, just update local number
      setLocalNumber(value);
    }
  }, [value, onCountryChange]);

  // Filter countries based on search
  const filteredCountries = React.useMemo(() => {
    if (!searchQuery) return countryCodes;
    const query = searchQuery.toLowerCase();
    return countryCodes.filter(
      c => c.name.toLowerCase().includes(query) ||
           c.dialCode.includes(query) ||
           c.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Update parent when country or local number changes
  const notifyChange = useCallback((country: CountryCode, local: string) => {
    if (onChange) {
      const formatted = local ? formatPhoneNumber(country, local) : '';
      onChange(formatted);
    }
  }, [onChange]);

  // Handle country selection
  const handleSelectCountry = (country: CountryCode) => {
    userInteractedRef.current = true; // Mark that user has manually selected
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery('');
    notifyChange(country, localNumber);
    // Notify parent of country code change
    if (onCountryChange) {
      onCountryChange(country.code);
    }
  };

  // Handle local number change
  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    userInteractedRef.current = true; // Mark that user has manually typed
    const newValue = e.target.value;
    setLocalNumber(newValue);
    notifyChange(selectedCountry, newValue);
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
      buttonRef.current?.focus();
    }
  };

  return (
    <div className={cn('relative flex', className)} ref={dropdownRef}>
      {/* Country Code Dropdown Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 px-3 py-2.5 rounded-s-xl border border-e-0',
          'bg-th-surface text-th-text transition-all',
          'hover:bg-th-surface-h focus:outline-none focus:ring-2 focus:ring-inset',
          error
            ? 'border-red-500/50 focus:ring-red-500/50'
            : 'border-th-border focus:ring-emerald-500/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-lg leading-none">{selectedCountry.flag}</span>
        <span className="text-sm text-th-text-s">{selectedCountry.dialCode}</span>
        <ChevronDown24Regular
          className={cn(
            'w-4 h-4 text-th-text-t transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Phone Number Input */}
      <input
        type="tel"
        name={name}
        value={localNumber}
        onChange={handleLocalNumberChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={cn(
          'flex-1 px-4 py-2.5 rounded-e-xl border',
          'bg-th-surface text-th-text placeholder-th-text-m',
          'focus:outline-none focus:ring-2 focus:ring-inset transition-all',
          error
            ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500'
            : 'border-th-border focus:ring-emerald-500/50 focus:border-emerald-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-full start-0 mt-1 w-72 max-h-80 overflow-hidden
            bg-th-bg-s border border-th-border rounded-xl shadow-xl z-50
            flex flex-col"
          role="listbox"
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-th-border">
            <div className="relative">
              <Search24Regular className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-t" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country..."
                className="w-full ps-9 pe-3 py-2 bg-th-surface border border-th-border rounded-lg
                  text-th-text text-sm placeholder-th-text-m
                  focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Countries List */}
          <div className="flex-1 overflow-y-auto">
            {filteredCountries.length === 0 ? (
              <div className="px-4 py-8 text-center text-th-text-m text-sm">
                No countries found
              </div>
            ) : (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleSelectCountry(country)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-start',
                    'hover:bg-th-surface transition-colors',
                    selectedCountry.code === country.code && 'bg-emerald-500/10'
                  )}
                  role="option"
                  aria-selected={selectedCountry.code === country.code}
                >
                  <span className="text-xl">{country.flag}</span>
                  <span className="flex-1 text-th-text text-sm truncate">{country.name}</span>
                  <span className="text-th-text-t text-sm">{country.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PhoneInput;
