/**
 * ContactSelectionModal Component
 *
 * Modal to select contacts for collaboration.
 * Supports single-select and multi-select modes.
 * Shows all user's contacts with search functionality.
 * Indicates contacts that have accounts on the platform.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Dismiss24Regular,
  Search24Regular,
  Person24Regular,
  Building24Regular,
  Checkmark24Regular,
  PersonAvailable24Regular,
  Mail24Regular,
  Phone24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/Toast';
import { getAccessToken } from '@/lib/api/client';

interface Contact {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  hasAccount?: boolean;
  linkedUserId?: string | null;
}

interface ContactSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: Contact) => void;
  onMultiSelect?: (contacts: Contact[]) => void;
  multiSelect?: boolean;
  title?: string;
  description?: string;
}

export default function ContactSelectionModal({
  isOpen,
  onClose,
  onSelect,
  onMultiSelect,
  multiSelect = false,
  title = 'Select Contact',
  description = 'Choose a contact to send a collaboration request',
}: ContactSelectionModalProps) {
  const { t, isRTL } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Handle SSR - only render portal on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch contacts when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setSearchQuery('');
      setSelectedId(null);
      setSelectedIds(new Set());
      return;
    }

    const fetchContacts = async () => {
      setIsLoading(true);
      try {
        const token = getAccessToken();
        if (!token) {
          toast.error('Please log in to view contacts');
          setIsLoading(false);
          return;
        }

        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/contacts?limit=100&sort=name&order=asc`;
        const response = await fetch(apiUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch contacts: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data) {
          let contactList: Contact[] = [];
          if (Array.isArray(data.data)) {
            contactList = data.data;
          } else if (data.data.contacts && Array.isArray(data.data.contacts)) {
            contactList = data.data.contacts;
          }

          setContacts(contactList);
          setFilteredContacts(contactList);

          // Check for accounts in background
          checkForAccounts(contactList).then(contactsWithAccountInfo => {
            setContacts(contactsWithAccountInfo);
            setFilteredContacts(contactsWithAccountInfo);
          }).catch(err => {
            console.error('checkForAccounts failed:', err);
          });
        } else {
          setContacts([]);
          setFilteredContacts([]);
        }
      } catch (error: any) {
        console.error('Failed to fetch contacts:', error);
        toast.error('Failed to load contacts');
        setContacts([]);
        setFilteredContacts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContacts();
  }, [isOpen]);

  // Check if contacts have accounts (by checking email against users)
  const checkForAccounts = async (contactList: Contact[]): Promise<Contact[]> => {
    try {
      const token = getAccessToken();
      if (!token) return contactList;

      // Get emails that have accounts
      const emails = contactList
        .filter(c => c.email)
        .map(c => c.email!.toLowerCase());

      if (emails.length === 0) return contactList;

      // Call API to check which emails have accounts
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/check-emails`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emails }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const emailsWithAccounts = new Set(data.data?.existingEmails || []);

        return contactList.map(contact => ({
          ...contact,
          hasAccount: contact.email ? emailsWithAccounts.has(contact.email.toLowerCase()) : false,
        }));
      }
    } catch (error) {
      // Silently fail - just don't show account badges
      console.warn('Could not check for accounts:', error);
    }

    return contactList;
  };

  // Filter contacts based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = contacts.filter(
      (contact) =>
        contact.fullName.toLowerCase().includes(query) ||
        contact.company?.toLowerCase().includes(query) ||
        contact.jobTitle?.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query)
    );
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);

  const handleSingleSelect = () => {
    const contact = contacts.find((c) => c.id === selectedId);
    if (contact) {
      onSelect(contact);
      setSelectedId(null);
      setSearchQuery('');
    }
  };

  const handleMultiConfirm = () => {
    const selected = contacts.filter(c => selectedIds.has(c.id));
    if (selected.length > 0 && onMultiSelect) {
      onMultiSelect(selected);
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  };

  const toggleMultiSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (!isOpen || !mounted) return null;

  const isMulti = multiSelect && onMultiSelect;

  // Use portal to render at document body level to escape backdrop-filter containing block
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg mx-4 bg-th-bg-s rounded-xl shadow-xl border border-th-border max-h-[85vh] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-th-border">
          <div>
            <h2 className="text-lg font-semibold text-th-text">{title}</h2>
            <p className="text-sm text-th-text-t">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-th-bg-t rounded-lg transition-colors"
          >
            <Dismiss24Regular className="w-5 h-5 text-th-text-t" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-th-border">
          <div className="relative">
            <Search24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
            <input
              type="text"
              placeholder="Search by name, company, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-th-bg-t border border-neutral-700 rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoFocus
            />
          </div>
          {/* Results count + select all */}
          {!isLoading && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-th-text-m">
                {filteredContacts.length} {filteredContacts.length === 1 ? 'contact' : 'contacts'}
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
              {isMulti && filteredContacts.length > 0 && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {selectedIds.size === filteredContacts.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent" />
              <p className="mt-3 text-sm text-th-text-t">Loading contacts...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <Person24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
              <p className="text-th-text-t">
                {searchQuery ? 'No contacts match your search' : 'No contacts found'}
              </p>
              {!searchQuery && (
                <p className="text-sm text-th-text-m mt-1">
                  Add contacts first to send collaboration requests
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredContacts.map((contact) => {
                const isSelected = isMulti ? selectedIds.has(contact.id) : selectedId === contact.id;
                return (
                  <button
                    key={contact.id}
                    onClick={() => isMulti ? toggleMultiSelect(contact.id) : setSelectedId(contact.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-2 border-emerald-500'
                        : 'bg-th-bg-t/50 hover:bg-th-bg-t border-2 border-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative">
                      {contact.avatarUrl ? (
                        <img
                          src={contact.avatarUrl}
                          alt={contact.fullName}
                          className="w-11 h-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-500/30 flex items-center justify-center text-sm font-medium text-white">
                          {getInitials(contact.fullName)}
                        </div>
                      )}
                      {/* Account badge */}
                      {contact.hasAccount && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-th-border">
                          <Checkmark24Regular className="w-2.5 h-2.5 text-th-text" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-th-text truncate">{contact.fullName}</span>
                        {contact.hasAccount ? (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                            Member
                          </span>
                        ) : (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                            Invite
                          </span>
                        )}
                      </div>
                      {(contact.jobTitle || contact.company) && (
                        <div className="text-sm text-th-text-t truncate">
                          {contact.jobTitle}
                          {contact.jobTitle && contact.company && ' at '}
                          {contact.company}
                        </div>
                      )}
                      {/* Contact info */}
                      <div className="flex items-center gap-3 mt-1">
                        {contact.email && (
                          <span className="flex items-center gap-1 text-xs text-th-text-m">
                            <Mail24Regular className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{contact.email}</span>
                          </span>
                        )}
                        {contact.phone && (
                          <span className="flex items-center gap-1 text-xs text-th-text-m">
                            <Phone24Regular className="w-3 h-3" />
                            {contact.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    <div className={`flex-shrink-0 w-5 h-5 rounded-${isMulti ? 'md' : 'full'} border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-neutral-600'
                    }`}>
                      {isSelected && (
                        <Checkmark24Regular className="w-3 h-3 text-th-text" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-th-border flex items-center justify-between">
          <div className="text-xs text-th-text-m">
            {isMulti && selectedIds.size > 0 ? (
              <span className="text-emerald-400 font-medium">{selectedIds.size} selected</span>
            ) : contacts.filter(c => c.hasAccount).length > 0 ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Green badge = has IntellMatch account
              </span>
            ) : null}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-th-text-t hover:text-th-text transition-colors"
            >
              Cancel
            </button>
            {isMulti ? (
              <button
                onClick={handleMultiConfirm}
                disabled={selectedIds.size === 0}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-700 disabled:text-th-text-m text-white font-medium rounded-lg transition-colors"
              >
                Send to {selectedIds.size > 0 ? selectedIds.size : ''} Contact{selectedIds.size !== 1 ? 's' : ''}
              </button>
            ) : (
              <button
                onClick={handleSingleSelect}
                disabled={!selectedId}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-700 disabled:text-th-text-m text-white font-medium rounded-lg transition-colors"
              >
                Select
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
