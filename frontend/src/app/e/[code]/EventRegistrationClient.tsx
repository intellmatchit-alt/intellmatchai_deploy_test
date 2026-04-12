/**
 * Event Landing Page Client Component
 *
 * Two-step flow for unauthenticated users:
 * 1. Event info page with "Attend" button
 * 2. Terms acceptance page (matching consent) → Register/Login
 *
 * Authenticated users auto-join and redirect to attendees.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarLtr24Regular,
  Location24Regular,
  People24Regular,
  ArrowRight24Regular,
  ArrowLeft24Regular,
  Person24Regular,
  Sparkle24Regular,
  PeopleTeam24Regular,
  Shield24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { useAuth } from '@/hooks/useAuth';
import { getPublicEvent, joinEvent } from '@/lib/api/events';
import { toast } from '@/components/ui/Toast';

interface EventRegistrationClientProps {
  code: string;
}

export default function EventRegistrationClient({ code }: EventRegistrationClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'event' | 'terms'>('event');
  const [accepted, setAccepted] = useState(false);

  // Fetch event info
  useEffect(() => {
    async function fetchEvent() {
      try {
        const data = await getPublicEvent(code);
        setEvent(data.event);
      } catch (err: any) {
        setError(err.message || 'Event not found');
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [code]);

  // Auto-join when authenticated
  useEffect(() => {
    if (authLoading || !isAuthenticated || !event || joining) return;

    async function autoJoin() {
      setJoining(true);
      try {
        await joinEvent(code);
        router.replace(`/e/${code}/attendees`);
      } catch (err: any) {
        if (err.message?.includes('Already registered')) {
          router.replace(`/e/${code}/attendees`);
          return;
        }
        toast({ title: 'Error joining event', description: err.message, variant: 'error' });
        setJoining(false);
      }
    }
    autoJoin();
  }, [authLoading, isAuthenticated, event, code, router]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg flex items-center justify-center p-4">
        <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h1 className="text-xl font-bold text-th-text mb-2">Event Not Found</h1>
          <p className="text-th-text-t">{error || 'This event may have been removed or the link is incorrect.'}</p>
        </div>
      </div>
    );
  }

  // If authenticated, show joining state
  if (isAuthenticated || joining) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-th-text-t">Joining event...</p>
        </div>
      </div>
    );
  }

  // Format date
  const eventDate = new Date(event.dateTime);
  const dateStr = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = eventDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const returnToPath = `/e/${code}`;

  // ===== STEP 2: Terms & Conditions =====
  if (step === 'terms') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg p-4 md:p-6">
        <div className="max-w-lg mx-auto pt-8">
          {/* Back button */}
          <button
            onClick={() => { setStep('event'); setAccepted(false); }}
            className="flex items-center gap-2 text-th-text-t hover:text-th-text mb-6 transition-colors"
          >
            <ArrowLeft24Regular className="w-5 h-5" />
            Back to event
          </button>

          {/* Terms Card */}
          <div className="bg-th-surface backdrop-blur-xl border border-th-border rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Shield24Regular className="w-5 h-5 text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-th-text">Event Terms of Service</h1>
            </div>

            <p className="text-th-text-s mb-5">
              By attending <span className="text-th-text font-medium">{event.name}</span>, you agree to the following:
            </p>

            <div className="space-y-4">
              {/* Term 1: Matching */}
              <div className="flex gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <PeopleTeam24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-th-text mb-1">Attendee Matching</h3>
                  <p className="text-sm text-th-text-s">
                    Your profile information (name, role, company, skills, and interests) will be used to match you with other attendees at this event. All attendees will see your name, role, and a brief summary.
                  </p>
                </div>
              </div>

              {/* Term 2: Profile visibility */}
              <div className="flex gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <People24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-th-text mb-1">Profile Visibility</h3>
                  <p className="text-sm text-th-text-s">
                    Other attendees will be able to view your public profile details including your name, company, job title, bio, and what you're looking for. Your email and phone number will not be shared.
                  </p>
                </div>
              </div>

              {/* Term 3: AI-powered */}
              <div className="flex gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Sparkle24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-th-text mb-1">AI-Powered Recommendations</h3>
                  <p className="text-sm text-th-text-s">
                    We use AI to analyze compatibility between attendees based on goals, skills, and interests to suggest meaningful connections. Match results (High, Medium, Low) will be visible to both parties.
                  </p>
                </div>
              </div>
            </div>

            {/* Acceptance checkbox */}
            <label className="flex items-start gap-3 mt-6 cursor-pointer group">
              <div
                className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border transition-all ${
                  accepted
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-neutral-500 group-hover:border-emerald-400'
                }`}
                onClick={() => setAccepted(!accepted)}
              >
                {accepted && <Checkmark24Regular className="w-3.5 h-3.5 text-th-text" />}
              </div>
              <span className="text-sm text-th-text-s" onClick={() => setAccepted(!accepted)}>
                I understand and agree that my profile information will be shared with other event attendees for matching purposes.
              </span>
            </label>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Link
              href={accepted ? `/register?returnTo=${encodeURIComponent(returnToPath)}` : '#'}
              onClick={(e) => {
                if (!accepted) {
                  e.preventDefault();
                  toast({ title: 'Please accept the terms', description: 'You must agree to the event terms before continuing', variant: 'info' });
                }
              }}
              className={`flex items-center justify-center gap-2 w-full py-3.5 font-semibold rounded-xl transition-all ${
                accepted
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-th-bg-t text-th-text-m cursor-not-allowed'
              }`}
            >
              <Person24Regular className="w-5 h-5" />
              Create Account & Attend
              <ArrowRight24Regular className="w-5 h-5" />
            </Link>

            <Link
              href={accepted ? `/login?redirect=${encodeURIComponent(returnToPath)}` : '#'}
              onClick={(e) => {
                if (!accepted) {
                  e.preventDefault();
                  toast({ title: 'Please accept the terms', description: 'You must agree to the event terms before continuing', variant: 'info' });
                }
              }}
              className={`flex items-center justify-center gap-2 w-full py-3.5 border font-medium rounded-xl transition-all ${
                accepted
                  ? 'bg-th-surface hover:bg-th-surface-h border-th-border text-th-text'
                  : 'bg-th-bg-s border-th-border text-th-text-m cursor-not-allowed'
              }`}
            >
              Already have an account? Log in
            </Link>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-th-text-m">
            Powered by <span className="text-emerald-400">IntellMatch</span>
          </p>
        </div>
      </div>
    );
  }

  // ===== STEP 1: Event Info =====
  return (
    <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg p-4 md:p-6">
      <div className="max-w-lg mx-auto pt-8">
        {/* Event Thumbnail */}
        {event.thumbnailUrl && (
          <div className="mb-6 rounded-2xl overflow-hidden">
            <img
              src={event.thumbnailUrl}
              alt={event.name}
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        {/* Event Info Card */}
        <div className="bg-th-surface backdrop-blur-xl border border-th-border rounded-2xl p-6 mb-6">
          <h1 className="text-2xl font-bold text-th-text mb-4">{event.name}</h1>

          {event.welcomeMessage && (
            <p className="text-th-text-s mb-4">{event.welcomeMessage}</p>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-th-text-s">
              <CalendarLtr24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>{dateStr} at {timeStr}</span>
            </div>

            {event.location && (
              <div className="flex items-center gap-3 text-th-text-s">
                <Location24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>{event.location}</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-th-text-s">
              <People24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>{event.attendeeCount} attendee{event.attendeeCount !== 1 ? 's' : ''} registered</span>
            </div>
          </div>

          {event.description && (
            <p className="mt-4 text-sm text-th-text-t">{event.description}</p>
          )}
        </div>

        {/* Attend Button */}
        <button
          onClick={() => setStep('terms')}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
        >
          Attend This Event
          <ArrowRight24Regular className="w-5 h-5" />
        </button>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-th-text-m">
          Powered by <span className="text-emerald-400">IntellMatch</span>
        </p>
      </div>
    </div>
  );
}
