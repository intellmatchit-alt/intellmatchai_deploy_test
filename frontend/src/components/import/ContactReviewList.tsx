/**
 * Contact Review List
 *
 * Allows users to search, filter, and select contacts before import.
 *
 * @module components/import/ContactReviewList
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Search24Regular,
  CheckmarkCircle24Filled,
  Circle24Regular,
  ArrowLeft24Regular,
  ArrowRight24Regular,
  SelectAllOn24Regular,
  SelectAllOff24Regular,
  ArrowSort24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '@/lib/i18n';
import { type RawContact } from '@/lib/api/import';

interface ContactReviewListProps {
  contacts: RawContact[];
  onConfirm: (selectedContacts: RawContact[]) => void;
  onBack: () => void;
}

type SortField = 'name' | 'company' | 'email';
type SortOrder = 'asc' | 'desc';

export default function ContactReviewList({
  contacts,
  onConfirm,
  onBack,
}: ContactReviewListProps) {
  const { t } = useI18n();

  // State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() =>
    new Set(contacts.map((_, index) => index))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) {
      return contacts.map((contact, index) => ({ contact, originalIndex: index }));
    }

    const query = searchQuery.toLowerCase();
    return contacts
      .map((contact, index) => ({ contact, originalIndex: index }))
      .filter(({ contact }) => {
        const name = (contact.name || '').toLowerCase();
        const email = (contact.email || '').toLowerCase();
        const phone = (contact.phone || '').toLowerCase();
        const company = (contact.company || '').toLowerCase();
        const jobTitle = (contact.jobTitle || '').toLowerCase();

        return (
          name.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          company.includes(query) ||
          jobTitle.includes(query)
        );
      });
  }, [contacts, searchQuery]);

  // Sort filtered contacts
  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      let aVal = '';
      let bVal = '';

      switch (sortField) {
        case 'name':
          aVal = a.contact.name || a.contact.email || '';
          bVal = b.contact.name || b.contact.email || '';
          break;
        case 'company':
          aVal = a.contact.company || '';
          bVal = b.contact.company || '';
          break;
        case 'email':
          aVal = a.contact.email || '';
          bVal = b.contact.email || '';
          break;
      }

      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();

      if (sortOrder === 'asc') {
        return aVal.localeCompare(bVal);
      }
      return bVal.localeCompare(aVal);
    });
  }, [filteredContacts, sortField, sortOrder]);

  // Toggle selection for a contact
  const toggleSelection = useCallback((originalIndex: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(originalIndex)) {
        next.delete(originalIndex);
      } else {
        next.add(originalIndex);
      }
      return next;
    });
  }, []);

  // Select all visible contacts
  const selectAllVisible = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      sortedContacts.forEach(({ originalIndex }) => {
        next.add(originalIndex);
      });
      return next;
    });
  }, [sortedContacts]);

  // Deselect all visible contacts
  const deselectAllVisible = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      sortedContacts.forEach(({ originalIndex }) => {
        next.delete(originalIndex);
      });
      return next;
    });
  }, [sortedContacts]);

  // Select all contacts
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(contacts.map((_, index) => index)));
  }, [contacts]);

  // Deselect all contacts
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Toggle sort
  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField]);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    const selected = contacts.filter((_, index) => selectedIds.has(index));
    onConfirm(selected);
  }, [contacts, selectedIds, onConfirm]);

  // Calculate counts
  const selectedCount = selectedIds.size;
  const totalCount = contacts.length;
  const visibleCount = sortedContacts.length;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.import?.searchPlaceholder || 'Search by name, email, or company...'}
          className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-th-text placeholder-dark-400 focus:outline-none focus:border-accent-blue/50"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-dark-700 rounded"
          >
            <Dismiss24Regular className="w-4 h-4 text-dark-400" />
          </button>
        )}
      </div>

      {/* Selection actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-th-text transition-colors"
          >
            <SelectAllOn24Regular className="w-4 h-4" />
            {t.import?.selectAll || 'Select All'}
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-th-text transition-colors"
          >
            <SelectAllOff24Regular className="w-4 h-4" />
            {t.import?.deselectAll || 'Deselect All'}
          </button>
        </div>

        {/* Count display */}
        <span className="text-sm text-dark-400">
          {(t.import?.selectedCount || '{selected} of {total} selected')
            .replace('{selected}', String(selectedCount))
            .replace('{total}', String(totalCount))}
        </span>
      </div>

      {/* Bulk actions for search results */}
      {searchQuery && visibleCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-dark-800/50 rounded-lg border border-dark-700/50">
          <span className="text-sm text-dark-300 flex-1">
            {(t.import?.matchingContacts || '{count} matching contacts')
              .replace('{count}', String(visibleCount))}
          </span>
          <button
            type="button"
            onClick={selectAllVisible}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue/10 hover:bg-accent-blue/20 rounded-lg text-sm text-accent-blue transition-colors"
          >
            <Checkmark24Regular className="w-4 h-4" />
            {t.import?.selectMatching || 'Select matching'}
          </button>
          <button
            type="button"
            onClick={deselectAllVisible}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-sm text-red-400 transition-colors"
          >
            <Dismiss24Regular className="w-4 h-4" />
            {t.import?.excludeMatching || 'Exclude matching'}
          </button>
        </div>
      )}

      {/* Sort options */}
      <div className="flex items-center gap-2 text-sm">
        <ArrowSort24Regular className="w-4 h-4 text-dark-400" />
        <span className="text-dark-400">{t.import?.sortBy || 'Sort by'}:</span>
        {(['name', 'company', 'email'] as SortField[]).map((field) => (
          <button
            key={field}
            type="button"
            onClick={() => toggleSort(field)}
            className={`
              px-2 py-1 rounded text-xs transition-colors
              ${sortField === field
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
              }
            `}
          >
            {field === 'name' && (t.import?.sortName || 'Name')}
            {field === 'company' && (t.import?.sortCompany || 'Company')}
            {field === 'email' && (t.import?.sortEmail || 'Email')}
            {sortField === field && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
          </button>
        ))}
      </div>

      {/* Contact list - simple scrollable div */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        {sortedContacts.length > 0 ? (
          <div className="max-h-[400px] overflow-y-auto">
            {sortedContacts.map(({ contact, originalIndex }) => {
              const isSelected = selectedIds.has(originalIndex);
              const displayName = contact.name || contact.email || contact.phone || 'Unknown';
              const initial = displayName[0]?.toUpperCase() || '?';

              return (
                <div
                  key={originalIndex}
                  className={`
                    flex items-center gap-3 px-4 py-3 border-b border-dark-700 cursor-pointer
                    transition-colors
                    ${isSelected ? 'bg-dark-800' : 'bg-dark-800/50 hover:bg-dark-800'}
                  `}
                  onClick={() => toggleSelection(originalIndex)}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(originalIndex);
                    }}
                  >
                    {isSelected ? (
                      <CheckmarkCircle24Filled className="w-6 h-6 text-accent-blue" />
                    ) : (
                      <Circle24Regular className="w-6 h-6 text-dark-400" />
                    )}
                  </button>

                  {/* Avatar */}
                  <div className="w-10 h-10 bg-dark-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm text-th-text font-medium">{initial}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isSelected ? 'text-th-text' : 'text-dark-300'}`}>
                      {displayName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-dark-400 truncate">
                      {contact.email && <span>{contact.email}</span>}
                      {contact.email && contact.company && <span>•</span>}
                      {contact.company && <span>{contact.company}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-dark-400">
              {t.import?.noMatchingContacts || 'No contacts match your search'}
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-dark-700 text-th-text rounded-lg hover:bg-dark-600 transition-colors"
        >
          <ArrowLeft24Regular className="w-5 h-5" />
          {t.import?.back || 'Back'}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selectedCount === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent-blue text-th-text rounded-lg hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(t.import?.importSelected || 'Import {count} Contacts')
            .replace('{count}', String(selectedCount))}
          <ArrowRight24Regular className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
