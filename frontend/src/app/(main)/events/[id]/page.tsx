/**
 * Event Detail Page
 *
 * View event details, QR code, and attendees.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  QrCode24Regular,
  Copy24Regular,
  Share24Regular,
  ArrowDownload24Regular,
  People24Regular,
  CalendarLtr24Regular,
  Location24Regular,
  Mail24Regular,
  Phone24Regular,
  PersonAdd24Regular,
  ArrowExport24Regular,
  Checkmark24Regular,
  Edit24Regular,
  Document24Regular,
  Search24Regular,
  Filter24Regular,
  Dismiss24Regular,
  ChevronDown24Regular,
  ArrowSort24Regular,
  Image24Regular,
  Briefcase24Regular,
} from '@fluentui/react-icons';
import {
  getEvent,
  getEventAttendees,
  getEventQRCode,
  addAttendeesToContacts,
  inviteAttendees,
  exportAttendees,
  Event,
  EventAttendee,
} from '@/lib/api/events';
import { toast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';

/**
 * Attendee Card Component
 */
function AttendeeCard({
  attendee,
  onAddToContacts,
  isAdding,
}: {
  attendee: EventAttendee;
  onAddToContacts: (id: string) => void;
  isAdding: boolean;
}) {
  return (
    <div className="bg-th-surface border border-th-border rounded-lg p-4 overflow-hidden">
      <div className="flex items-start gap-3">
        {attendee.photoUrl ? (
          <img
            src={attendee.photoUrl}
            alt={attendee.name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
            {attendee.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-th-text truncate">{attendee.name}</h4>
              {(attendee.company || attendee.role) && (
                <p className="text-sm text-th-text-t truncate">
                  {attendee.role && attendee.company
                    ? `${attendee.role} at ${attendee.company}`
                    : attendee.company || attendee.role}
                </p>
              )}
            </div>
            <button
              onClick={() => onAddToContacts(attendee.id)}
              disabled={isAdding}
              className="flex-shrink-0 p-1.5 rounded-lg text-th-text-t hover:text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-50"
              title="Add to contacts"
            >
              <PersonAdd24Regular className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-1 mt-2 text-xs text-th-text-m">
            <span className="flex items-center gap-1 min-w-0">
              <Mail24Regular className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{attendee.email}</span>
            </span>
            {attendee.mobile && (
              <span className="flex items-center gap-1 min-w-0">
                <Phone24Regular className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{attendee.mobile}</span>
              </span>
            )}
          </div>
          {attendee.lookingFor && (
            <p className="mt-2 text-sm text-th-text-t line-clamp-2">
              <span className="text-emerald-400">Looking for:</span> {attendee.lookingFor}
            </p>
          )}
          {attendee.cvUrl && (
            <a
              href={attendee.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Document24Regular className="w-3.5 h-3.5 flex-shrink-0" />
              Download CV
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Event Detail Page
 */
export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [qrCode, setQrCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [addingContacts, setAddingContacts] = useState(false);
  const [addingSingleContact, setAddingSingleContact] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [filterMatchLevel, setFilterMatchLevel] = useState<string>('all');
  const [filterHasCV, setFilterHasCV] = useState<string>('all');
  const [filterHasPhoto, setFilterHasPhoto] = useState<string>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventData, attendeesData, qrData] = await Promise.all([
        getEvent(eventId),
        getEventAttendees(eventId),
        getEventQRCode(eventId, 'base64', 400),
      ]);
      setEvent(eventData.event);
      setAttendees(attendeesData.attendees);
      setQrCode(qrData);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
      if (error.status === 404) {
        router.push('/events');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!event) return;
    setCopying(true);
    try {
      const url = event.eventUrl || `${window.location.origin}/e/${event.uniqueCode}`;
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied!', variant: 'success' });
    } catch {
      toast({ title: 'Failed to copy', variant: 'error' });
    }
    setTimeout(() => setCopying(false), 2000);
  };

  const handleShare = async () => {
    if (!event) return;
    const url = event.eventUrl || `${window.location.origin}/e/${event.uniqueCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.name,
          text: `Join my event: ${event.name}`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQR = async () => {
    if (!event) return;
    try {
      const blob = await fetch(qrCode).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event.name.replace(/\s+/g, '-')}-qr.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Failed to download', variant: 'error' });
    }
  };

  const handleAddToContacts = async () => {
    if (!event) return;
    setAddingContacts(true);
    try {
      const result = await addAttendeesToContacts(event.id);
      toast({
        title: 'Added to contacts',
        description: `${result.added} new contacts added (${result.skipped} already existed)`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setAddingContacts(false);
    }
  };

  const handleAddSingleToContacts = async (attendeeId: string) => {
    if (!event) return;
    setAddingSingleContact(attendeeId);
    try {
      const result = await addAttendeesToContacts(event.id, [attendeeId]);
      if (result.added > 0) {
        toast({ title: 'Contact added', variant: 'success' });
      } else {
        toast({ title: 'Contact already exists', variant: 'info' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setAddingSingleContact(null);
    }
  };

  // Get unique companies for filter dropdown
  const uniqueCompanies = [...new Set(attendees.filter(a => a.company).map(a => a.company!))].sort();

  // Count active filters
  const activeFilterCount = [
    filterMatchLevel !== 'all',
    filterHasCV !== 'all',
    filterHasPhoto !== 'all',
    filterCompany !== 'all',
  ].filter(Boolean).length;

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setFilterMatchLevel('all');
    setFilterHasCV('all');
    setFilterHasPhoto('all');
    setFilterCompany('all');
    setSortBy('name');
  };

  // Filter and sort attendees
  const filteredAttendees = attendees
    .filter((attendee) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          attendee.name.toLowerCase().includes(query) ||
          attendee.email.toLowerCase().includes(query) ||
          (attendee.company && attendee.company.toLowerCase().includes(query)) ||
          (attendee.role && attendee.role.toLowerCase().includes(query)) ||
          (attendee.lookingFor && attendee.lookingFor.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Match level filter
      if (filterMatchLevel !== 'all') {
        if (!attendee.matchLevel || attendee.matchLevel !== filterMatchLevel) return false;
      }

      // Has CV filter
      if (filterHasCV === 'yes' && !attendee.cvUrl) return false;
      if (filterHasCV === 'no' && attendee.cvUrl) return false;

      // Has Photo filter
      if (filterHasPhoto === 'yes' && !attendee.photoUrl) return false;
      if (filterHasPhoto === 'no' && attendee.photoUrl) return false;

      // Company filter
      if (filterCompany !== 'all' && attendee.company !== filterCompany) return false;

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'company':
          return (a.company || '').localeCompare(b.company || '');
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'match':
          return (b.matchScore || 0) - (a.matchScore || 0);
        default:
          return 0;
      }
    });

  const handleInviteAll = async () => {
    if (!event) return;
    setInviting(true);
    try {
      const result = await inviteAttendees(event.id);
      if (result.emailsSent > 0) {
        toast({
          title: 'Invitations sent!',
          description: `${result.emailsSent} email${result.emailsSent > 1 ? 's' : ''} sent successfully${result.emailsFailed > 0 ? ` (${result.emailsFailed} failed)` : ''}. ${result.alreadyUsers} already have accounts.`,
          variant: 'success',
        });
      } else if (result.alreadyUsers > 0) {
        toast({
          title: 'No new invitations',
          description: `All ${result.alreadyUsers} attendees already have IntellMatch accounts.`,
          variant: 'info',
        });
      } else {
        toast({
          title: 'No attendees to invite',
          description: 'There are no attendees to send invitations to.',
          variant: 'info',
        });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setInviting(false);
    }
  };

  const handleExport = async () => {
    if (!event) return;
    try {
      const result = await exportAttendees(event.id, 'csv');
      // CSV comes back as string in the response
      const csvData = typeof result === 'string' ? result : JSON.stringify(result);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event.name.replace(/\s+/g, '-')}-attendees.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export downloaded', variant: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg p-4 md:p-6">
        <div className="max-w-4xl mx-auto animate-pulse">
          <div className="h-8 bg-th-surface-h rounded w-1/3 mb-6"></div>
          <div className="bg-th-surface rounded-xl p-6 mb-6">
            <div className="h-64 bg-th-surface-h rounded mb-4"></div>
            <div className="h-4 bg-th-surface-h rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const eventDate = new Date(event.dateTime);

  return (
    <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/events"
            className="p-2 rounded-lg text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-all"
          >
            <ArrowLeft24Regular className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-th-text">{event.name}</h1>
              {!event.isActive && (
                <span className="px-2 py-0.5 text-xs bg-neutral-600 text-th-text-s rounded-full">
                  Inactive
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-th-text-t">
              <span className="flex items-center gap-1">
                <CalendarLtr24Regular className="w-4 h-4" />
                {eventDate.toLocaleDateString()} at {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {event.location && (
                <span className="flex items-center gap-1">
                  <Location24Regular className="w-4 h-4" />
                  {event.location}
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/events/${event.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-th-surface-h hover:bg-th-surface-h text-th-text rounded-lg transition-all"
          >
            <Edit24Regular className="w-5 h-5" />
            Edit
          </Link>
        </div>

        {/* QR Code Card */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* QR Code */}
            <div className="bg-[#0c1222] border border-white/[0.06] p-4 rounded-xl">
              {qrCode ? (
                <img src={qrCode} alt="Event QR Code" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 bg-neutral-200 animate-pulse rounded" />
              )}
            </div>

            {/* Actions */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-lg font-semibold text-th-text mb-2">Share this QR code</h2>
              <p className="text-th-text-t text-sm mb-4">
                Guests can scan this code to register for your event and see who else is attending.
              </p>

              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 px-4 py-2 bg-th-surface-h hover:bg-th-surface-h text-th-text rounded-lg transition-all"
                >
                  {copying ? <Checkmark24Regular className="w-5 h-5 text-green-400" /> : <Copy24Regular className="w-5 h-5" />}
                  {copying ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 bg-th-surface-h hover:bg-th-surface-h text-th-text rounded-lg transition-all"
                >
                  <Share24Regular className="w-5 h-5" />
                  Share
                </button>
                <button
                  onClick={handleDownloadQR}
                  className="flex items-center gap-2 px-4 py-2 bg-th-surface-h hover:bg-th-surface-h text-th-text rounded-lg transition-all"
                >
                  <ArrowDownload24Regular className="w-5 h-5" />
                  Download QR
                </button>
              </div>

              <p className="mt-4 text-xs text-th-text-m">
                Event URL: <code className="bg-th-surface-h px-2 py-0.5 rounded">/e/{event.uniqueCode}</code>
              </p>
            </div>
          </div>
        </div>

        {/* Attendees Section */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
              <People24Regular className="w-5 h-5" />
              Attendees ({attendees.length})
            </h2>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-th-surface-h hover:bg-th-surface-h text-th-text rounded-lg transition-all"
              >
                <ArrowExport24Regular className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={handleAddToContacts}
                disabled={addingContacts || attendees.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-th-surface-h hover:bg-th-surface-h disabled:opacity-50 text-th-text rounded-lg transition-all"
              >
                <PersonAdd24Regular className="w-4 h-4" />
                {addingContacts ? 'Adding...' : 'Add All to Contacts'}
              </button>
              <button
                onClick={handleInviteAll}
                disabled={inviting || attendees.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-lg transition-all"
              >
                <Mail24Regular className="w-4 h-4" />
                {inviting ? 'Sending emails...' : 'Send Invitations'}
              </button>
            </div>
          </div>

          {/* Search and Filter Bar */}
          {attendees.length > 0 && (
            <div className="space-y-3 mb-4">
              {/* Search and Filter Toggle */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
                  <input
                    type="text"
                    placeholder="Search by name, email, company, role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                    showFilters || activeFilterCount > 0
                      ? 'bg-emerald-600 border-emerald-500 text-th-text'
                      : 'bg-th-surface border-th-border text-th-text-t hover:text-th-text hover:bg-th-surface-h'
                  }`}
                >
                  <Filter24Regular className="w-5 h-5" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="bg-th-surface-h text-th-text text-xs px-1.5 py-0.5 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="bg-th-surface border border-th-border rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-th-text flex items-center gap-2">
                      <Filter24Regular className="w-4 h-4" />
                      Filter & Sort
                    </h3>
                    {(activeFilterCount > 0 || searchQuery) && (
                      <button
                        onClick={clearFilters}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <Dismiss24Regular className="w-3 h-3" />
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Sort By */}
                    <div>
                      <label className="block text-xs font-medium text-th-text-t mb-1.5">
                        <ArrowSort24Regular className="w-3 h-3 inline mr-1" />
                        Sort By
                      </label>
                      <Select
                        value={sortBy}
                        onChange={(value) => setSortBy(value)}
                        options={[
                          { value: 'name', label: 'Name (A-Z)' },
                          { value: 'name-desc', label: 'Name (Z-A)' },
                          { value: 'company', label: 'Company' },
                          { value: 'date', label: 'Newest First' },
                          { value: 'date-asc', label: 'Oldest First' },
                          { value: 'match', label: 'Match Score' },
                        ]}
                      />
                    </div>

                    {/* Match Level Filter */}
                    <div>
                      <label className="block text-xs font-medium text-th-text-t mb-1.5">
                        Match Level
                      </label>
                      <Select
                        value={filterMatchLevel}
                        onChange={(value) => setFilterMatchLevel(value)}
                        options={[
                          { value: 'all', label: 'All Matches' },
                          { value: 'HIGH', label: 'HIGH' },
                          { value: 'MEDIUM', label: 'MEDIUM' },
                          { value: 'LOW', label: 'LOW' },
                        ]}
                      />
                    </div>

                    {/* Has CV Filter */}
                    <div>
                      <label className="block text-xs font-medium text-th-text-t mb-1.5">
                        <Document24Regular className="w-3 h-3 inline mr-1" />
                        Has CV
                      </label>
                      <Select
                        value={filterHasCV}
                        onChange={(value) => setFilterHasCV(value)}
                        options={[
                          { value: 'all', label: 'All' },
                          { value: 'yes', label: 'With CV' },
                          { value: 'no', label: 'Without CV' },
                        ]}
                      />
                    </div>

                    {/* Has Photo Filter */}
                    <div>
                      <label className="block text-xs font-medium text-th-text-t mb-1.5">
                        <Image24Regular className="w-3 h-3 inline mr-1" />
                        Has Photo
                      </label>
                      <Select
                        value={filterHasPhoto}
                        onChange={(value) => setFilterHasPhoto(value)}
                        options={[
                          { value: 'all', label: 'All' },
                          { value: 'yes', label: 'With Photo' },
                          { value: 'no', label: 'Without Photo' },
                        ]}
                      />
                    </div>

                    {/* Company Filter */}
                    <div>
                      <label className="block text-xs font-medium text-th-text-t mb-1.5">
                        <Briefcase24Regular className="w-3 h-3 inline mr-1" />
                        Company
                      </label>
                      <Select
                        value={filterCompany}
                        onChange={(value) => setFilterCompany(value)}
                        options={[
                          { value: 'all', label: 'All Companies' },
                          ...uniqueCompanies.map((company) => ({ value: company, label: company })),
                        ]}
                      />
                    </div>
                  </div>

                  {/* Active Filters Summary */}
                  {(activeFilterCount > 0 || searchQuery) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-th-border">
                      {searchQuery && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs">
                          Search: "{searchQuery}"
                          <button onClick={() => setSearchQuery('')} className="hover:text-th-text">
                            <Dismiss24Regular className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {filterMatchLevel !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs">
                          Match: {filterMatchLevel}
                          <button onClick={() => setFilterMatchLevel('all')} className="hover:text-th-text">
                            <Dismiss24Regular className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {filterHasCV !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs">
                          CV: {filterHasCV === 'yes' ? 'Yes' : 'No'}
                          <button onClick={() => setFilterHasCV('all')} className="hover:text-th-text">
                            <Dismiss24Regular className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {filterHasPhoto !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs">
                          Photo: {filterHasPhoto === 'yes' ? 'Yes' : 'No'}
                          <button onClick={() => setFilterHasPhoto('all')} className="hover:text-th-text">
                            <Dismiss24Regular className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {filterCompany !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs">
                          Company: {filterCompany}
                          <button onClick={() => setFilterCompany('all')} className="hover:text-th-text">
                            <Dismiss24Regular className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Results Count */}
              {(searchQuery || activeFilterCount > 0) && (
                <p className="text-sm text-th-text-t">
                  Showing {filteredAttendees.length} of {attendees.length} attendees
                </p>
              )}
            </div>
          )}

          {attendees.length === 0 ? (
            <div className="text-center py-12">
              <People24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
              <h3 className="text-th-text font-medium mb-1">No attendees yet</h3>
              <p className="text-th-text-t text-sm">Share the QR code to get guests registered</p>
            </div>
          ) : filteredAttendees.length === 0 ? (
            <div className="text-center py-12">
              <Filter24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
              <h3 className="text-th-text font-medium mb-1">No results found</h3>
              <p className="text-th-text-t text-sm mb-4">
                {activeFilterCount > 0
                  ? 'Try adjusting your filters or search term'
                  : 'Try a different search term'}
              </p>
              {(activeFilterCount > 0 || searchQuery) && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-emerald-400 hover:text-emerald-300"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAttendees.map((attendee) => (
                <AttendeeCard
                  key={attendee.id}
                  attendee={attendee}
                  onAddToContacts={handleAddSingleToContacts}
                  isAdding={addingSingleContact === attendee.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
