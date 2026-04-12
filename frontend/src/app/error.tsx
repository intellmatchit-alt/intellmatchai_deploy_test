'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-th-text mb-4">Something went wrong</h2>
        <p className="text-th-text-t mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>
        {error.digest && (
          <p className="text-xs text-th-text-m mb-4">Error ID: {error.digest}</p>
        )}
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-th-text rounded-lg font-medium transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-6 py-3 border border-th-border text-th-text-s hover:bg-th-surface rounded-lg font-medium transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
