/**
 * Cache Clear Page
 *
 * This page forcibly clears all browser caches and service workers.
 */

'use client';

import { useEffect, useState } from 'react';

export default function ClearCachePage() {
  const [status, setStatus] = useState('Clearing caches...');
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function clearAll() {
      try {
        // 1. Unregister all service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
            console.log('Unregistered SW:', registration.scope);
          }
          setStatus(prev => prev + '\n✓ Service workers unregistered');
        }

        // 2. Clear all caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            await caches.delete(cacheName);
            console.log('Deleted cache:', cacheName);
          }
          setStatus(prev => prev + '\n✓ All caches cleared');
        }

        // 3. Clear localStorage
        localStorage.clear();
        setStatus(prev => prev + '\n✓ LocalStorage cleared');

        // 4. Clear sessionStorage
        sessionStorage.clear();
        setStatus(prev => prev + '\n✓ SessionStorage cleared');

        setStatus(prev => prev + '\n\n✅ All done! Redirecting in 3 seconds...');
        setDone(true);

        // Redirect after 3 seconds
        setTimeout(() => {
          window.location.href = '/deals';
        }, 3000);

      } catch (error) {
        console.error('Error clearing cache:', error);
        setStatus(prev => prev + '\n❌ Error: ' + String(error));
      }
    }

    clearAll();
  }, []);

  return (
    <div className="min-h-screen bg-th-bg flex items-center justify-center p-4">
      <div className="bg-th-surface border border-th-border rounded-xl p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-th-text mb-4">Clearing Cache</h1>
        <pre className="text-sm text-th-text-s whitespace-pre-wrap font-mono">
          {status}
        </pre>
        {done && (
          <button
            onClick={() => window.location.href = '/deals'}
            className="mt-4 w-full py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
          >
            Go to Deals Now
          </button>
        )}
      </div>
    </div>
  );
}
