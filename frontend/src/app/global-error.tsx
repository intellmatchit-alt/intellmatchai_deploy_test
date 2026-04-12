'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-th-bg">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-th-text mb-4">Something went wrong</h2>
            <p className="text-th-text-t mb-4">
              {error.message || 'A critical error occurred'}
            </p>
            {error.digest && (
              <p className="text-xs text-th-text-m mb-4">Error ID: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-th-text rounded-lg font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
