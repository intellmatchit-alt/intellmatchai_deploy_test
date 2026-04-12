/**
 * Events Page
 *
 * List and manage hosted and attended events.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  Add24Regular,
  CalendarLtr24Regular,
  Location24Regular,
  People24Regular,
  QrCode24Regular,
  ChevronRight24Regular,
  Delete24Regular,
  Star24Filled,
  PersonBoard24Regular,
  CalendarCheckmark24Regular,
} from '@fluentui/react-icons';
import { getHostedEvents, getAttendedEvents, deleteEvent, Event } from '@/lib/api/events';
import { toast } from '@/components/ui/Toast';

/**
 * Event Card Component
 */
function EventCard({
  event,
  onDelete,
}: {
  event: Event;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this event?')) {
      setIsDeleting(true);
      try {
        await deleteEvent(event.id);
        toast({ title: 'Event deleted', variant: 'success' });
        onDelete(event.id);
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'error' });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const eventDate = new Date(event.dateTime);
  const isPast = eventDate < new Date();

  return (
    <Link href={`/events/${event.id}`}>
      <div className="group bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-th-text truncate">{event.name}</h3>
              {event.isActive ? (
                <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                  Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs bg-white/[0.03]0/20 text-th-text-t">
                  Inactive
                </span>
              )}
              {isPast && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                  Past
                </span>
              )}
            </div>

            {event.description && (
              <p className="text-sm text-th-text-t line-clamp-2 mb-3">{event.description}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-th-text-t">
              <div className="flex items-center gap-1.5">
                <CalendarLtr24Regular className="w-4 h-4" />
                <span>{eventDate.toLocaleDateString()} {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {event.location && (
                <div className="flex items-center gap-1.5">
                  <Location24Regular className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">{event.location}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <People24Regular className="w-4 h-4" />
                <span>{event.attendeeCount || 0} attendees</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 rounded-lg text-th-text-t hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete event"
            >
              <Delete24Regular className="w-5 h-5" />
            </button>
            <ChevronRight24Regular className="w-5 h-5 text-th-text-m group-hover:text-th-text transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Attended Event Card Component
 */
function AttendedEventCard({
  event,
  myRegistration,
  highMatches,
}: {
  event: Event;
  myRegistration: { id: string; createdAt: string };
  highMatches: number;
}) {
  const eventDate = new Date(event.dateTime);
  const isPast = eventDate < new Date();
  const registeredDate = new Date(myRegistration.createdAt);

  return (
    <Link href={`/e/${event.uniqueCode}/attendees`}>
      <div className="group bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-th-text truncate">{event.name}</h3>
              {isPast && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                  Past
                </span>
              )}
            </div>

            {event.description && (
              <p className="text-sm text-th-text-t line-clamp-2 mb-3">{event.description}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-th-text-t">
              <div className="flex items-center gap-1.5">
                <CalendarLtr24Regular className="w-4 h-4" />
                <span>{eventDate.toLocaleDateString()} {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {event.location && (
                <div className="flex items-center gap-1.5">
                  <Location24Regular className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">{event.location}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <People24Regular className="w-4 h-4" />
                <span>{event.attendeeCount || 0} attendees</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-th-text-m">
              <span>Joined {registeredDate.toLocaleDateString()}</span>
              {highMatches > 0 && (
                <span className="flex items-center gap-1 text-green-400">
                  <Star24Filled className="w-3.5 h-3.5" />
                  {highMatches} high match{highMatches !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>

          <ChevronRight24Regular className="w-5 h-5 text-th-text-m group-hover:text-th-text transition-colors" />
        </div>
      </div>
    </Link>
  );
}

/**
 * Events Page
 */
export default function EventsPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'hosted' | 'attended'>('hosted');
  const [events, setEvents] = useState<Event[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<Array<{
    event: Event;
    myRegistration: { id: string; createdAt: string };
    highMatches: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (activeTab === 'hosted') {
      loadHostedEvents();
    } else {
      loadAttendedEvents();
    }
  }, [activeTab, filter]);

  const loadHostedEvents = async () => {
    setLoading(true);
    try {
      const { events } = await getHostedEvents({ status: filter, limit: 50 });
      setEvents(events);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadAttendedEvents = async () => {
    setLoading(true);
    try {
      const { events } = await getAttendedEvents({ limit: 50 });
      setAttendedEvents(events);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-th-text flex items-center gap-2">
              <QrCode24Regular className="w-7 h-7" />
              My Events
            </h1>
            <p className="text-th-text-t mt-1">Create and manage networking events with QR check-in</p>
          </div>
          <Link
            href="/events/new"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-emerald-500 text-white rounded-lg font-medium transition-all"
          >
            <Add24Regular className="w-5 h-5" />
            Create Event
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-th-border mb-6">
          <button
            onClick={() => setActiveTab('hosted')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'hosted'
                ? 'border-emerald-500 text-th-text'
                : 'border-transparent text-th-text-t hover:text-th-text'
            }`}
          >
            <PersonBoard24Regular className="w-5 h-5" />
            Hosted Events
          </button>
          <button
            onClick={() => setActiveTab('attended')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'attended'
                ? 'border-emerald-500 text-th-text'
                : 'border-transparent text-th-text-t hover:text-th-text'
            }`}
          >
            <CalendarCheckmark24Regular className="w-5 h-5" />
            Attended Events
          </button>
        </div>

        {/* Hosted Tab Content */}
        {activeTab === 'hosted' && (
          <>
            {/* Filters */}
            <div className="flex gap-2 mb-6">
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === status
                      ? 'bg-th-surface-h text-th-text border border-white/20'
                      : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {/* Events List */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-th-surface rounded-xl p-4 animate-pulse">
                    <div className="h-6 bg-th-surface-h rounded w-1/3 mb-3"></div>
                    <div className="h-4 bg-th-surface-h rounded w-2/3 mb-2"></div>
                    <div className="h-4 bg-th-surface-h rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-16">
                <QrCode24Regular className="w-16 h-16 text-white/70 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-th-text mb-2">No events yet</h3>
                <p className="text-th-text-t mb-6">Create your first event and generate a QR code for guests to scan</p>
                <Link
                  href="/events/new"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-emerald-500 text-white rounded-lg font-medium transition-all"
                >
                  <Add24Regular className="w-5 h-5" />
                  Create Your First Event
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Attended Tab Content */}
        {activeTab === 'attended' && (
          <>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-th-surface rounded-xl p-4 animate-pulse">
                    <div className="h-6 bg-th-surface-h rounded w-1/3 mb-3"></div>
                    <div className="h-4 bg-th-surface-h rounded w-2/3 mb-2"></div>
                    <div className="h-4 bg-th-surface-h rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : attendedEvents.length === 0 ? (
              <div className="text-center py-16">
                <CalendarCheckmark24Regular className="w-16 h-16 text-white/70 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-th-text mb-2">No attended events</h3>
                <p className="text-th-text-t mb-6">
                  Scan a QR code at an event to join and see your matches
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {attendedEvents.map(({ event, myRegistration, highMatches }) => (
                  <AttendedEventCard
                    key={event.id}
                    event={event}
                    myRegistration={myRegistration}
                    highMatches={highMatches}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
