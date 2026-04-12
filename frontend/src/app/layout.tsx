/**
 * Root Layout
 *
 * The root layout that wraps all pages.
 * Includes global providers, styles, and PWA configuration.
 */

import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/Toast';
import { PWAInstallBanner } from '@/components/pwa';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-arabic',
});

export const metadata: Metadata = {
  title: {
    default: 'IntellMatch',
    template: '%s | IntellMatch',
  },
  description: 'Smart Professional Networking - AI-powered relationship management',
  keywords: ['networking', 'professional', 'contacts', 'relationships', 'AI', 'business cards', 'CRM'],
  authors: [{ name: 'IntellMatch Team' }],
  creator: 'IntellMatch',
  publisher: 'IntellMatch',
  manifest: '/manifest.json',
  applicationName: 'IntellMatch',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black',
    title: 'IntellMatch',
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/icon-512x512.png', color: '#10b981' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'IntellMatch',
    title: 'IntellMatch - Smart Professional Networking',
    description: 'AI-powered relationship management and professional networking platform',
    images: [
      {
        url: '/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'IntellMatch',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'IntellMatch',
    description: 'AI-powered relationship management and professional networking platform',
    images: ['/icons/icon-512x512.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#10b981' },
    { media: '(prefers-color-scheme: dark)', color: '#10b981' },
  ],
  colorScheme: 'dark light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${ibmPlexArabic.variable}`} suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="IntellMatch" />
        <meta name="msapplication-TileColor" content="#10b981" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Apple Splash Screens */}
        <link
          rel="apple-touch-startup-image"
          href="/icons/icon-512x512.png"
          media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
        />

        {/* Force service worker update and cache clear */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var BUILD_ID = 'v20260316-finotive-theme';
                var storedBuild = localStorage.getItem('app_build');
                if (storedBuild !== BUILD_ID) {
                  localStorage.setItem('app_build', BUILD_ID);
                  // Stop page from rendering until caches are cleared
                  document.documentElement.style.display = 'none';
                  var done = false;
                  function reload() { if (!done) { done = true; window.location.reload(); } }
                  // Clear all caches
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      return Promise.all(names.map(function(n) { return caches.delete(n); }));
                    }).then(reload).catch(reload);
                  }
                  // Unregister all service workers
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(regs) {
                      return Promise.all(regs.map(function(r) { return r.unregister(); }));
                    }).then(reload).catch(reload);
                  }
                  // Safety timeout — reload after 2s even if promises hang
                  setTimeout(reload, 2000);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased" style={{ background: 'var(--color-bg-primary)' }}>
        <ThemeProvider attribute="class" defaultTheme="dark" storageKey="intellmatch-theme">
          {children}
          <Toaster />
          <PWAInstallBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
