'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';

/**
 * Title options for name prefix
 */
export const TITLE_OPTIONS = [
  'Mr.',
  'Mrs.',
  'Ms.',
  'Miss',
  'Dr.',
  'Prof.',
  'Sir',
  'Madam',
  'Sheikh',
  'Eng.',
  'Capt.',
  'Rev.',
] as const;

export type TitleOption = typeof TITLE_OPTIONS[number];

export interface NameFieldsValues {
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
}

interface NameFieldsProps {
  values: NameFieldsValues;
  onChange: (values: NameFieldsValues) => void;
  errors?: {
    title?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
  };
  required?: {
    title?: boolean;
    firstName?: boolean;
    middleName?: boolean;
    lastName?: boolean;
  };
  disabled?: boolean;
  compact?: boolean; // Compact layout for smaller forms
}

/**
 * Helper to build full name from parts
 */
export function buildFullName(values: NameFieldsValues): string {
  const parts: string[] = [];
  if (values.title) parts.push(values.title);
  if (values.firstName) parts.push(values.firstName);
  if (values.middleName) parts.push(values.middleName);
  if (values.lastName) parts.push(values.lastName);
  return parts.join(' ').trim();
}

/**
 * Helper to parse full name into parts (best effort)
 */
export function parseFullName(fullName: string): NameFieldsValues {
  const parts = fullName.trim().split(/\s+/);

  // Check if first part is a title
  let title: string | undefined;
  if (parts.length > 0) {
    const firstPart = parts[0];
    // Check if it matches a known title (case insensitive)
    const matchedTitle = TITLE_OPTIONS.find(
      t => t.toLowerCase() === firstPart.toLowerCase() ||
           t.toLowerCase().replace('.', '') === firstPart.toLowerCase().replace('.', '')
    );
    if (matchedTitle) {
      title = matchedTitle;
      parts.shift(); // Remove title from parts
    }
  }

  // Now parse remaining parts
  if (parts.length === 0) {
    return { title, firstName: '', lastName: '' };
  } else if (parts.length === 1) {
    return { title, firstName: parts[0], lastName: '' };
  } else if (parts.length === 2) {
    return { title, firstName: parts[0], lastName: parts[1] };
  } else {
    // 3 or more parts: first is firstName, last is lastName, rest is middleName
    return {
      title,
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1],
    };
  }
}

export function NameFields({
  values,
  onChange,
  errors,
  required = { firstName: true, lastName: true },
  disabled = false,
  compact = false,
}: NameFieldsProps) {
  const { t } = useI18n();

  const handleChange = (field: keyof NameFieldsValues, value: string) => {
    onChange({
      ...values,
      [field]: value,
    });
  };

  const inputClass = `w-full px-3 py-2 bg-th-surface border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 ${compact ? 'text-sm' : ''}`;
  const labelClass = `block text-xs font-medium text-th-text-t mb-1`;
  const errorClass = `text-xs text-red-400 mt-1`;

  return (
    <div className="space-y-3">
      {/* Row 1: Title and First Name */}
      <div className={`grid ${compact ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
        {/* Title */}
        <div className={compact ? 'col-span-1' : 'col-span-1'}>
          <label className={labelClass}>
            {t.common?.title || 'Title'}
            {required?.title && <span className="text-red-400 ml-1">*</span>}
          </label>
          <select
            value={values.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            disabled={disabled}
            className={`${inputClass} ${errors?.title ? 'border-red-500' : 'border-th-border'}`}
          >
            <option value="" className="bg-th-bg-s">Select...</option>
            {TITLE_OPTIONS.map((title) => (
              <option key={title} value={title} className="bg-th-bg-s">
                {title}
              </option>
            ))}
          </select>
          {errors?.title && <p className={errorClass}>{errors.title}</p>}
        </div>

        {/* First Name */}
        <div className={compact ? 'col-span-3' : 'col-span-2'}>
          <label className={labelClass}>
            {t.common?.firstName || 'First Name'}
            {required?.firstName && <span className="text-red-400 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={values.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder={t.common?.firstNamePlaceholder || 'First name'}
            disabled={disabled}
            className={`${inputClass} ${errors?.firstName ? 'border-red-500' : 'border-th-border'}`}
          />
          {errors?.firstName && <p className={errorClass}>{errors.firstName}</p>}
        </div>
      </div>

      {/* Row 2: Middle Name and Last Name */}
      <div className="grid grid-cols-2 gap-3">
        {/* Middle Name */}
        <div>
          <label className={labelClass}>
            {t.common?.middleName || 'Middle Name'}
            {required?.middleName && <span className="text-red-400 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={values.middleName || ''}
            onChange={(e) => handleChange('middleName', e.target.value)}
            placeholder={t.common?.middleNamePlaceholder || 'Middle name (optional)'}
            disabled={disabled}
            className={`${inputClass} ${errors?.middleName ? 'border-red-500' : 'border-th-border'}`}
          />
          {errors?.middleName && <p className={errorClass}>{errors.middleName}</p>}
        </div>

        {/* Last Name */}
        <div>
          <label className={labelClass}>
            {t.common?.lastName || 'Last Name'}
            {required?.lastName && <span className="text-red-400 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={values.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder={t.common?.lastNamePlaceholder || 'Last name'}
            disabled={disabled}
            className={`${inputClass} ${errors?.lastName ? 'border-red-500' : 'border-th-border'}`}
          />
          {errors?.lastName && <p className={errorClass}>{errors.lastName}</p>}
        </div>
      </div>
    </div>
  );
}

export default NameFields;
