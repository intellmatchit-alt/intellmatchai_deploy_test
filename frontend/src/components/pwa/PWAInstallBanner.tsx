/**
 * PWA Install Banner
 *
 * A visually prominent banner that encourages users to install the app.
 * Shows different UI for iOS (manual install) vs Android/Desktop (automatic prompt).
 * Supports RTL languages (Arabic).
 *
 * @module components/pwa/PWAInstallBanner
 */

'use client';

import { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { cn } from '@/lib/utils';

/**
 * Download/Install Icon
 */
const DownloadIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

/**
 * Close Icon
 */
const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Share Icon (for iOS)
 */
const ShareIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

/**
 * Plus Icon (for iOS Add to Home Screen)
 */
const PlusSquareIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

/**
 * Check Icon
 */
const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);

/**
 * App Icon Component
 */
const AppIcon = () => (
  <div className="relative flex shrink-0 items-center justify-center">
    <img src="/intelllogo.png" alt="IntellMatch" className="h-14 w-auto" />
  </div>
);

/**
 * Translations for PWA Banner
 */
const translations = {
  en: {
    installTitle: 'Install IntellMatch',
    installDescription: 'Install for offline access & quick launch',
    installDescriptionIOS: 'Add to home screen for the best experience',
    notNow: 'Not Now',
    installApp: 'Install App',
    howToInstall: 'How to Install',
    installing: 'Installing...',
    worksOffline: 'Works Offline',
    fastLaunch: 'Fast Launch',
    noAppStore: 'No App Store',
    iosStep1: 'Tap the Share button',
    iosStep1Desc: 'Find the share icon at the bottom of Safari',
    iosStep2: 'Scroll and tap "Add to Home Screen"',
    iosStep2Desc: 'Look for Add to Home Screen option',
    iosStep3: 'Tap "Add"',
    iosStep3Desc: 'The app will be added to your home screen',
  },
  ar: {
    installTitle: 'تثبيت IntellMatch',
    installDescription: 'ثبّت للوصول بدون إنترنت والتشغيل السريع',
    installDescriptionIOS: 'أضف إلى الشاشة الرئيسية للحصول على أفضل تجربة',
    notNow: 'ليس الآن',
    installApp: 'تثبيت التطبيق',
    howToInstall: 'كيفية التثبيت',
    installing: 'جاري التثبيت...',
    worksOffline: 'يعمل بدون إنترنت',
    fastLaunch: 'تشغيل سريع',
    noAppStore: 'بدون متجر',
    iosStep1: 'اضغط على زر المشاركة',
    iosStep1Desc: 'ابحث عن أيقونة المشاركة في أسفل Safari',
    iosStep2: 'اضغط على "إضافة إلى الشاشة الرئيسية"',
    iosStep2Desc: 'ابحث عن خيار إضافة إلى الشاشة الرئيسية',
    iosStep3: 'اضغط على "إضافة"',
    iosStep3Desc: 'سيتم إضافة التطبيق إلى شاشتك الرئيسية',
  },
};

type Lang = keyof typeof translations;

/**
 * iOS Install Instructions Modal
 */
const IOSInstructions = ({
  onClose,
  t,
  isRTL,
}: {
  onClose: () => void;
  t: typeof translations.en;
  isRTL: boolean;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
    onClick={onClose}
  >
    <div
      className="w-full max-w-lg animate-slide-up-full rounded-t-3xl bg-th-bg-s p-6 pb-10"
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-th-text">{t.installTitle}</h3>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-th-text-t hover:bg-th-bg-t hover:text-th-text"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Steps */}
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            1
          </div>
          <div>
            <p className="font-medium text-th-text">{t.iosStep1}</p>
            <p className="mt-1 text-sm text-th-text-t">
              {t.iosStep1Desc} <ShareIcon className="inline h-4 w-4" />
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            2
          </div>
          <div>
            <p className="font-medium text-th-text">{t.iosStep2}</p>
            <p className="mt-1 text-sm text-th-text-t">
              {t.iosStep2Desc} <PlusSquareIcon className="inline h-4 w-4" />
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            3
          </div>
          <div>
            <p className="font-medium text-th-text">{t.iosStep3}</p>
            <p className="mt-1 text-sm text-th-text-t">{t.iosStep3Desc}</p>
          </div>
        </div>
      </div>

      {/* Visual Guide Arrow */}
      <div className="mt-8 flex justify-center">
        <div className="animate-bounce text-th-text-m">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  </div>
);

/**
 * PWA Install Banner Component
 */
export function PWAInstallBanner() {
  const {
    canInstall,
    isInstalled,
    isPrompting,
    platform,
    promptInstall,
    dismissBanner,
  } = usePWAInstall();

  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [isRTL, setIsRTL] = useState(false);

  // Detect language from document
  useEffect(() => {
    const detectLanguage = () => {
      if (typeof document !== 'undefined') {
        const htmlLang = document.documentElement.lang as Lang;
        const dir = document.documentElement.dir;

        if (htmlLang === 'ar' || dir === 'rtl') {
          setLang('ar');
          setIsRTL(true);
        } else {
          setLang('en');
          setIsRTL(false);
        }
      }
    };

    detectLanguage();

    // Listen for language changes
    const observer = new MutationObserver(detectLanguage);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang', 'dir'],
    });

    return () => observer.disconnect();
  }, []);

  const t = translations[lang];

  // Don't show if can't install or already installed
  if (!canInstall || isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (platform === 'ios') {
      setShowIOSInstructions(true);
    } else {
      await promptInstall();
    }
  };

  return (
    <>
      {/* Main Banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up-full"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Gradient border top */}
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />

        <div className="bg-th-bg-s/95 backdrop-blur-lg">
          <div className="mx-auto max-w-lg px-4 py-4">
            <div className="flex items-center gap-4">
              {/* App Icon */}
              <AppIcon />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-th-text">
                  {t.installTitle}
                </h3>
                <p className="mt-0.5 text-sm text-th-text-t">
                  {platform === 'ios' ? t.installDescriptionIOS : t.installDescription}
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={dismissBanner}
                className="shrink-0 rounded-full p-2 text-th-text-m hover:bg-th-bg-t hover:text-th-text-s"
                aria-label="Dismiss"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={dismissBanner}
                className="flex-1 rounded-xl border border-neutral-700 bg-th-bg-t px-4 py-3 text-sm font-medium text-th-text-s transition-colors hover:bg-neutral-700"
              >
                {t.notNow}
              </button>
              <button
                onClick={handleInstallClick}
                disabled={isPrompting}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-th-text transition-all',
                  'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400',
                  'shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isPrompting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    {t.installing}
                  </>
                ) : (
                  <>
                    <DownloadIcon className="h-4 w-4" />
                    {platform === 'ios' ? t.howToInstall : t.installApp}
                  </>
                )}
              </button>
            </div>

            {/* Features highlight */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-th-text-m">
              <span className="flex items-center gap-1">
                <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                {t.worksOffline}
              </span>
              <span className="flex items-center gap-1">
                <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                {t.fastLaunch}
              </span>
              <span className="flex items-center gap-1">
                <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                {t.noAppStore}
              </span>
            </div>
          </div>
        </div>

        {/* Safe area padding for mobile devices */}
        <div className="bg-th-bg-s/95 pb-safe" />
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <IOSInstructions
          onClose={() => setShowIOSInstructions(false)}
          t={t}
          isRTL={isRTL}
        />
      )}
    </>
  );
}

export default PWAInstallBanner;
