/**
 * Public Event Registration Page
 *
 * Landing page for event QR code - guests can register here.
 * Includes Open Graph meta tags for social sharing.
 */

import { Metadata } from 'next';
import EventRegistrationClient from './EventRegistrationClient';

interface Props {
  params: { code: string };
}

// Fetch event data for metadata
async function getEventData(code: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/events/public/${code}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.event || null;
  } catch {
    return null;
  }
}

// Generate Open Graph metadata for social sharing (WhatsApp, Facebook, Twitter, etc.)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventData(params.code);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://intellmatch.com';

  if (!event) {
    return {
      title: 'Event Not Found | IntellMatch',
      description: 'This event may have been removed or the link is incorrect.',
      openGraph: {
        title: 'Event Not Found',
        description: 'This event may have been removed or the link is incorrect.',
        siteName: 'IntellMatch',
        images: [{ url: `${siteUrl}/intelllogo.png`, width: 512, height: 512, alt: 'IntellMatch' }],
      },
    };
  }

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

  // Prioritize welcomeMessage for social sharing, then fall back to description or auto-generated text
  const description = event.welcomeMessage || event.description ||
    `Join ${event.name} on ${dateStr} at ${timeStr}. ${event.location ? `Location: ${event.location}. ` : ''}Connect with other attendees and expand your network!`;

  const eventUrl = `${siteUrl}/e/${params.code}`;

  // Use the thumbnail URL if available (must be an HTTP URL, not base64)
  // Base64 URLs don't work for OG images - social platforms need to fetch the image
  let ogImage = `${siteUrl}/intelllogo.png`; // Default fallback
  if (event.thumbnailUrl && !event.thumbnailUrl.startsWith('data:')) {
    ogImage = event.thumbnailUrl;
  }

  return {
    title: `${event.name} | IntellMatch`,
    description: description.slice(0, 160),
    openGraph: {
      type: 'website',
      url: eventUrl,
      title: event.name,
      description: description.slice(0, 200),
      siteName: 'IntellMatch',
      images: [
        {
          url: ogImage,
          alt: event.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: event.name,
      description: description.slice(0, 200),
      images: [ogImage],
    },
    other: {
      'og:locale': 'en_US',
    },
  };
}

export default function PublicEventPage({ params }: Props) {
  return <EventRegistrationClient code={params.code} />;
}
