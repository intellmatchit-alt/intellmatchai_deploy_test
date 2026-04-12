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
    console.error('Import page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong!</h2>
        <p className="text-dark-300 mb-4">Error details:</p>
        <pre className="bg-dark-900 p-3 rounded-lg text-sm text-red-300 overflow-auto mb-4">
          {error.message}
        </pre>
        {error.stack && (
          <details className="mb-4">
            <summary className="text-dark-400 cursor-pointer hover:text-th-text">
              Stack trace
            </summary>
            <pre className="bg-dark-900 p-3 rounded-lg text-xs text-dark-400 overflow-auto mt-2 max-h-40">
              {error.stack}
            </pre>
          </details>
        )}
        <button
          onClick={() => reset()}
          className="w-full px-4 py-3 bg-accent-blue text-th-text rounded-lg hover:bg-accent-blue/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
