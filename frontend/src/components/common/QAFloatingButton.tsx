'use client';

import { useState, useEffect } from 'react';
import { getAppConfig } from '@/lib/api/bug-reports';
import { QAReportModal } from './QAReportModal';
import { useI18n } from '@/lib/i18n';

let cachedQAEnabled: boolean | null = null;

export function QAFloatingButton() {
  const { dir } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [qaEnabled, setQaEnabled] = useState<boolean | null>(cachedQAEnabled);

  useEffect(() => {
    if (cachedQAEnabled !== null) {
      setQaEnabled(cachedQAEnabled);
      return;
    }

    getAppConfig()
      .then((config: any) => {
        const enabled = config.qaReportingEnabled === true || config.qaReportingEnabled === 'true';
        cachedQAEnabled = enabled;
        setQaEnabled(enabled);
      })
      .catch(() => {
        cachedQAEnabled = false;
        setQaEnabled(false);
      });
  }, []);

  if (qaEnabled !== true) return null;

  const isRTL = dir === 'rtl';

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`fixed bottom-24 z-40 w-12 h-12 rounded-full bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/30 flex items-center justify-center transition-colors ${
          isRTL ? 'left-4' : 'right-4'
        }`}
        aria-label="Report a bug"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2l1.88 1.88" />
          <path d="M14.12 3.88L16 2" />
          <path d="M9 7.13v-1a3.003 3.003 0 116 0v1" />
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6" />
          <path d="M12 20v-9" />
          <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
          <path d="M6 13H2" />
          <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
          <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
          <path d="M22 13h-4" />
          <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
        </svg>
      </button>

      <QAReportModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
