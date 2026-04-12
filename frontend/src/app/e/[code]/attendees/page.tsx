/**
 * Event Attendees Page
 *
 * Shows attendees and match levels for authenticated users.
 * Requires user to be logged in and registered for the event.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  People24Regular,
  ArrowLeft24Regular,
  Star24Filled,
  StarHalf24Filled,
  Star24Regular,
  Building24Regular,
  Briefcase24Regular,
  Target24Regular,
  Sparkle24Regular,
  Chat24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  Lightbulb24Regular,
  Mail24Regular,
  Send24Regular,
  Search24Regular,
} from '@fluentui/react-icons';
import { useAuth } from '@/hooks/useAuth';
import { getPublicEvent, getPublicAttendees, EventAttendee } from '@/lib/api/events';
import { createConversation } from '@/lib/api/messages';
import { toast } from '@/components/ui/Toast';
import { MatchSummaryBadges, CriterionScoreItem } from '@/components/features/itemized-matching';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/Dialog/Dialog';

const WhatsAppIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/**
 * Match Badge Component
 */
function MatchBadge({ level, score }: { level: string; score?: number }) {
  const config = {
    HIGH: {
      bg: 'bg-green-500/20',
      border: 'border-green-500/30',
      text: 'text-green-400',
      icon: Star24Filled,
      label: 'High Match',
    },
    MEDIUM: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      icon: StarHalf24Filled,
      label: 'Medium Match',
    },
    LOW: {
      bg: 'bg-white/[0.03]0/20',
      border: 'border-neutral-500/30',
      text: 'text-th-text-t',
      icon: Star24Regular,
      label: 'Low Match',
    },
  };

  const { bg, border, text, icon: Icon, label } = config[level as keyof typeof config] || config.LOW;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${bg} ${text} border ${border}`}>
      <Icon className="w-3 h-3" />
      {label}
      {score !== undefined && <span className="ml-0.5">({score}%)</span>}
    </span>
  );
}

/**
 * Attendee Card Component
 */
function AttendeeCard({
  attendee,
  onClick,
}: {
  attendee: EventAttendee;
  onClick: () => void;
}) {
  return (
    <div
      className="bg-th-surface border border-th-border rounded-xl overflow-hidden transition-all cursor-pointer hover:bg-th-surface-h"
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          {attendee.photoUrl ? (
            <img
              src={attendee.photoUrl}
              alt={attendee.name}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white text-lg font-semibold">
              {attendee.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-th-text truncate">{attendee.name}</h3>
              {attendee.matchLevel && <MatchBadge level={attendee.matchLevel} />}
            </div>

            {(attendee.company || attendee.role) && (
              <p className="text-sm text-th-text-t flex items-center gap-1 mb-2">
                {attendee.role && (
                  <>
                    <Briefcase24Regular className="w-3.5 h-3.5" />
                    {attendee.role}
                  </>
                )}
                {attendee.role && attendee.company && <span className="mx-1">at</span>}
                {attendee.company && (
                  <>
                    {!attendee.role && <Building24Regular className="w-3.5 h-3.5" />}
                    {attendee.company}
                  </>
                )}
              </p>
            )}

            {attendee.bio && (
              <p className="text-sm text-th-text-s mb-2 line-clamp-2">{attendee.bio}</p>
            )}

            {attendee.matchReasons && attendee.matchReasons.length > 0 && (
              <div className="mt-2 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <p className="text-xs text-emerald-300 flex items-center gap-1">
                  <Sparkle24Regular className="w-3.5 h-3.5" />
                  {attendee.matchReasons[0]}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Attendee Detail Modal
 */
function AttendeeDetailModal({
  attendee,
  open,
  onClose,
}: {
  attendee: EventAttendee | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [sendingMessage, setSendingMessage] = useState(false);

  if (!attendee) return null;

  const iceBreakers = (attendee as any).iceBreakers || [];

  const handleSendMessage = async () => {
    if (!attendee.userId) return;
    setSendingMessage(true);
    try {
      const conversation = await createConversation(attendee.userId);
      router.push(`/messages/${conversation.id}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg" className="max-h-[85vh] overflow-y-auto">
        <DialogTitle className="sr-only">{attendee.name}</DialogTitle>

        {/* Header: Avatar + Name + Badge */}
        <div className="flex flex-col items-center text-center mb-6">
          {attendee.photoUrl ? (
            <img
              src={attendee.photoUrl}
              alt={attendee.name}
              className="w-20 h-20 rounded-full object-cover mb-3"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white text-2xl font-semibold mb-3">
              {attendee.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className="text-xl font-bold text-th-text mb-1">{attendee.name}</h2>
          {attendee.matchLevel && (
            <MatchBadge level={attendee.matchLevel} score={attendee.matchScore} />
          )}
        </div>

        {/* Role & Company */}
        {(attendee.company || attendee.role) && (
          <div className="flex items-center gap-2 text-sm text-th-text-s mb-4">
            {attendee.role && (
              <>
                <Briefcase24Regular className="w-4 h-4 text-th-text-t" />
                <span>{attendee.role}</span>
              </>
            )}
            {attendee.role && attendee.company && <span className="text-th-text-m">at</span>}
            {attendee.company && (
              <>
                {!attendee.role && <Building24Regular className="w-4 h-4 text-th-text-t" />}
                <span>{attendee.company}</span>
              </>
            )}
          </div>
        )}

        {/* Bio */}
        {attendee.bio && (
          <div className="mb-4">
            <p className="text-sm text-th-text-s">{attendee.bio}</p>
          </div>
        )}

        {/* Looking For */}
        {attendee.lookingFor && (
          <div className="mb-4 p-3 bg-th-surface rounded-lg border border-th-border">
            <div className="flex items-start gap-2">
              <Target24Regular className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-th-text-m mb-1">Looking for</p>
                <p className="text-sm text-th-text-s">{attendee.lookingFor}</p>
              </div>
            </div>
          </div>
        )}

        {/* Match Reasons */}
        {attendee.matchReasons && attendee.matchReasons.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-th-text-m flex items-center gap-1 mb-2">
              <Sparkle24Regular className="w-3.5 h-3.5" />
              Match Reasons
            </p>
            <div className="space-y-2">
              {attendee.matchReasons.map((reason, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
                >
                  <p className="text-sm text-emerald-300">{reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ice Breakers */}
        {iceBreakers.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-th-text-m flex items-center gap-1 mb-2">
              <Lightbulb24Regular className="w-3.5 h-3.5" />
              Conversation Starters
            </p>
            <div className="space-y-2">
              {iceBreakers.map((iceBreaker: string, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 bg-gradient-to-r from-emerald-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-lg"
                >
                  <p className="text-sm text-emerald-200">&ldquo;{iceBreaker}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-th-border">
          {attendee.userId && (
            <button
              onClick={handleSendMessage}
              disabled={sendingMessage}
              className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-th-text rounded-lg font-medium transition-all disabled:opacity-50"
            >
              <Send24Regular className="w-4 h-4" />
              {sendingMessage ? 'Opening...' : 'Send Message'}
            </button>
          )}
          {attendee.email && (
            <a
              href={`mailto:${attendee.email}`}
              className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all"
            >
              <Mail24Regular className="w-4 h-4" />
              Email
            </a>
          )}
          {attendee.mobile && (
            <a
              href={`https://wa.me/${attendee.mobile.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all"
            >
              <WhatsAppIcon />
              WhatsApp
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Attendees Page
 */
export default function AttendeesPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [event, setEvent] = useState<{ name: string; attendeeCount: number } | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [myInfo, setMyInfo] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttendee, setSelectedAttendee] = useState<EventAttendee | null>(null);

  // Redirect to event page if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/e/${code}`);
    }
  }, [authLoading, isAuthenticated, code, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [code, isAuthenticated]);

  const loadData = async () => {
    try {
      const [eventData, attendeesData] = await Promise.all([
        getPublicEvent(code),
        getPublicAttendees(code),
      ]);

      setEvent(eventData.event);
      setAttendees(attendeesData.attendees);
      setMyInfo(attendeesData.myInfo);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
      if (error.status === 401 || error.status === 403) {
        router.push(`/e/${code}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredAttendees = attendees.filter((a) => {
    // Match level filter
    if (filter === 'high' && a.matchLevel !== 'HIGH') return false;
    if (filter === 'medium' && a.matchLevel !== 'MEDIUM' && a.matchLevel !== 'HIGH') return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const searchFields = [a.name, a.company, a.role, a.bio, a.lookingFor];
      if (!searchFields.some((f) => f?.toLowerCase().includes(q))) return false;
    }

    return true;
  });

  const matchCounts = {
    high: attendees.filter((a) => a.matchLevel === 'HIGH').length,
    medium: attendees.filter((a) => a.matchLevel === 'MEDIUM').length,
    low: attendees.filter((a) => a.matchLevel === 'LOW').length,
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg p-4 md:p-6">
        <div className="max-w-2xl mx-auto animate-pulse">
          <div className="h-8 bg-th-surface-h rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-th-surface rounded-xl p-4">
                <div className="h-14 bg-th-surface-h rounded mb-3"></div>
                <div className="h-4 bg-th-surface-h rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push('/events')}
            className="p-2 rounded-lg text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-all"
          >
            <ArrowLeft24Regular className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-th-text">{event?.name || 'Event'}</h1>
            {myInfo && (
              <p className="text-sm text-th-text-t">
                Welcome, <span className="text-emerald-400">{myInfo.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Match Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{matchCounts.high}</div>
            <div className="text-xs text-green-300">High Matches</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">{matchCounts.medium}</div>
            <div className="text-xs text-yellow-300">Medium Matches</div>
          </div>
          <div className="bg-white/[0.03]0/10 border border-neutral-500/20 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-th-text-t">{matchCounts.low}</div>
            <div className="text-xs text-th-text-s">Others</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, company, role..."
            className="w-full pl-10 pr-4 py-2.5 bg-th-surface border border-th-border rounded-lg text-sm text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {(['all', 'high', 'medium'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-th-surface-h text-th-text border border-white/20'
                  : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
              }`}
            >
              {f === 'all' ? 'All' : f === 'high' ? 'High Matches' : 'Medium+'}
            </button>
          ))}
        </div>

        {/* Attendees List */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
            <People24Regular className="w-5 h-5" />
            Attendees ({filteredAttendees.length})
          </h2>
        </div>

        {filteredAttendees.length === 0 ? (
          <div className="text-center py-12 bg-th-surface rounded-xl">
            <People24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
            <h3 className="text-th-text font-medium mb-1">No matches found</h3>
            <p className="text-th-text-t text-sm">
              {searchQuery
                ? 'Try a different search term'
                : filter !== 'all'
                ? 'Try showing all attendees'
                : 'Be the first to register or wait for more attendees'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAttendees.map((attendee) => (
              <AttendeeCard
                key={attendee.id}
                attendee={attendee}
                onClick={() => setSelectedAttendee(attendee)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-th-text-m">
          Powered by <span className="text-emerald-400">IntellMatch</span>
        </p>
      </div>

      {/* Attendee Detail Modal */}
      <AttendeeDetailModal
        attendee={selectedAttendee}
        open={!!selectedAttendee}
        onClose={() => setSelectedAttendee(null)}
      />
    </div>
  );
}
