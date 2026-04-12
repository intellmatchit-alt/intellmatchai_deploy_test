/**
 * Next.js Middleware
 *
 * Minimal middleware for the application.
 * The app uses a custom I18nProvider for translations,
 * so this middleware only handles essential routing.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow all requests to pass through
  // The custom I18nProvider handles language switching via localStorage
  return NextResponse.next();
}

export const config = {
  // Skip static files, API routes, and Next.js internals
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icons|screenshots|manifest.json|sw.js|workbox-.*\\.js).*)',
  ],
};
