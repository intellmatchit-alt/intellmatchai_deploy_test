/**
 * PWA Install Hook
 *
 * Captures the beforeinstallprompt event and provides
 * methods to trigger the install prompt programmatically.
 *
 * @module hooks/usePWAInstall
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallState {
  /** Whether the app can be installed */
  canInstall: boolean;
  /** Whether the app is already installed */
  isInstalled: boolean;
  /** Whether the install prompt is currently showing */
  isPrompting: boolean;
  /** The platform (iOS, Android, Desktop) */
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  /** Whether running in standalone mode (already installed) */
  isStandalone: boolean;
}

interface UsePWAInstallReturn extends PWAInstallState {
  /** Trigger the install prompt */
  promptInstall: () => Promise<boolean>;
  /** Dismiss the install banner (user chose not to install) */
  dismissBanner: () => void;
  /** Whether the banner was dismissed */
  isDismissed: boolean;
}

const DISMISSED_KEY = 'pwa-install-dismissed';
const DISMISSED_EXPIRY_DAYS = 7;

/**
 * Detect the user's platform
 */
function detectPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';

  const ua = window.navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }

  if (/android/.test(ua)) {
    return 'android';
  }

  if (/windows|macintosh|linux/.test(ua)) {
    return 'desktop';
  }

  return 'unknown';
}

/**
 * Check if running in standalone mode
 */
function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Check if banner was dismissed recently
 */
function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false;

  const dismissed = localStorage.getItem(DISMISSED_KEY);
  if (!dismissed) return false;

  const dismissedTime = parseInt(dismissed, 10);
  const expiryTime = DISMISSED_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  return Date.now() - dismissedTime < expiryTime;
}

/**
 * Hook for PWA installation
 */
export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect platform
    setPlatform(detectPlatform());

    // Check if already installed
    const standalone = isRunningStandalone();
    setIsStandalone(standalone);
    setIsInstalled(standalone);

    // Check if dismissed recently
    setIsDismissed(wasDismissedRecently());

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    setIsPrompting(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error prompting install:', error);
      return false;
    } finally {
      setIsPrompting(false);
    }
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  }, []);

  // Can install if:
  // - Not already installed
  // - Not dismissed recently
  // - Has deferred prompt (Android/Desktop) OR is iOS (manual install)
  const canInstall =
    !isInstalled &&
    !isDismissed &&
    !isStandalone &&
    (deferredPrompt !== null || platform === 'ios');

  return {
    canInstall,
    isInstalled,
    isPrompting,
    platform,
    isStandalone,
    promptInstall,
    dismissBanner,
    isDismissed,
  };
}

export default usePWAInstall;
