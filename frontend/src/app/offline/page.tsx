/**
 * Offline Page
 *
 * Displayed when the user is offline and the page is not cached.
 */

'use client';

import { WifiOff24Regular, ArrowClockwise24Regular } from '@fluentui/react-icons';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />
      </div>

      <div className="relative text-center max-w-md">
        {/* Icon */}
        <div className="relative mx-auto w-24 h-24 mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-lg opacity-50" />
          <div className="relative w-full h-full rounded-full bg-th-surface backdrop-blur-sm border border-th-border flex items-center justify-center">
            <WifiOff24Regular className="w-12 h-12 text-th-text-t" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-th-text mb-4">You're Offline</h1>

        {/* Description */}
        <p className="text-th-text-t mb-8">
          It looks like you've lost your internet connection. Please check your
          connection and try again.
        </p>

        {/* Retry button */}
        <button
          onClick={handleRetry}
          className="relative group inline-flex items-center gap-2"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
          <span className="relative flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
            <ArrowClockwise24Regular className="w-5 h-5" />
            Try Again
          </span>
        </button>

        {/* Tips */}
        <div className="mt-12 bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6 text-left">
          <h3 className="text-th-text font-semibold mb-3">Things to try:</h3>
          <ul className="space-y-2 text-sm text-th-text-t">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">•</span>
              Check your WiFi or mobile data connection
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">•</span>
              Try moving to an area with better signal
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">•</span>
              Disable airplane mode if enabled
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">•</span>
              Restart your router or device
            </li>
          </ul>
        </div>

        {/* App info */}
        <p className="mt-8 text-xs text-th-text-m">
          IntellMatch v1.0.0
        </p>
      </div>
    </div>
  );
}
