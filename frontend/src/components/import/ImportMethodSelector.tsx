/**
 * Import Method Selector
 *
 * Displays available import methods and handles selection.
 * Shows different options based on platform capabilities.
 *
 * @module components/import/ImportMethodSelector
 */

'use client';

import { useMemo } from 'react';
import {
  Phone24Regular,
  ContactCard24Regular,
  DocumentTable24Regular,
  CloudSync24Regular,
  ChevronRight24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '@/lib/i18n';
import { isMobileWrapper, isContactPickerSupported } from '@/lib/api/import';

export type ImportSource = 'PHONE_FULL' | 'PHONE_PICKER' | 'CSV_UPLOAD' | 'VCF_UPLOAD' | 'GOOGLE_SYNC' | 'MANUAL';

interface ImportMethod {
  id: ImportSource;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  available: boolean;
  badge?: string;
}

interface ImportMethodSelectorProps {
  onSelect: (method: ImportSource) => void;
}

export default function ImportMethodSelector({ onSelect }: ImportMethodSelectorProps) {
  const { t } = useI18n();

  const methods = useMemo<ImportMethod[]>(() => {
    const isMobile = isMobileWrapper();
    const hasContactPicker = isContactPickerSupported();

    return [
      {
        id: 'PHONE_FULL' as ImportSource,
        icon: Phone24Regular,
        title: t.import?.methods?.phoneFull?.title || 'Import from Phone',
        description: t.import?.methods?.phoneFull?.description || 'Import all contacts from your device',
        available: isMobile,
        badge: isMobile ? (t.import?.recommended || 'Recommended') : (t.import?.mobileOnly || 'Mobile App Only'),
      },
      {
        id: 'PHONE_PICKER' as ImportSource,
        icon: ContactCard24Regular,
        title: t.import?.methods?.contactPicker?.title || 'Pick Contacts',
        description: t.import?.methods?.contactPicker?.description || 'Select specific contacts to import',
        available: hasContactPicker,
        badge: !hasContactPicker ? (t.import?.notSupported || 'Not Supported') : undefined,
      },
      {
        id: 'VCF_UPLOAD' as ImportSource,
        icon: DocumentTable24Regular,
        title: t.import?.methods?.vcf?.title || 'Upload VCF File',
        description: t.import?.methods?.vcf?.description || 'Import from vCard (.vcf) file',
        available: true,
      },
      {
        id: 'CSV_UPLOAD' as ImportSource,
        icon: DocumentTable24Regular,
        title: t.import?.methods?.csv?.title || 'Upload CSV File',
        description: t.import?.methods?.csv?.description || 'Import from spreadsheet (.csv) file',
        available: true,
      },
      {
        id: 'GOOGLE_SYNC' as ImportSource,
        icon: CloudSync24Regular,
        title: t.import?.methods?.google?.title || 'Sync Google Contacts',
        description: t.import?.methods?.google?.description || 'Connect and sync your Google Contacts',
        available: true,
        badge: t.import?.comingSoon || 'Coming Soon',
      },
    ];
  }, [t]);

  return (
    <div className="space-y-3">
      <p className="text-dark-300 text-sm mb-6">
        {t.import?.selectMethodDescription || 'Choose how you want to import your contacts'}
      </p>

      {methods.map((method) => {
        const isDisabled = !method.available || method.id === 'GOOGLE_SYNC';
        const Icon = method.icon;

        return (
          <button
            key={method.id}
            onClick={() => !isDisabled && onSelect(method.id)}
            disabled={isDisabled}
            className={`
              w-full p-4 rounded-xl border transition-all text-left
              flex items-center gap-4
              ${isDisabled
                ? 'bg-dark-800/50 border-dark-700/50 opacity-60 cursor-not-allowed'
                : 'bg-dark-800 border-dark-700 hover:border-accent-blue/50 hover:bg-dark-700/50 cursor-pointer'
              }
            `}
          >
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center
              ${isDisabled ? 'bg-dark-700' : 'bg-accent-blue/10'}
            `}>
              <Icon className={`w-6 h-6 ${isDisabled ? 'text-dark-400' : 'text-accent-blue'}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-medium ${isDisabled ? 'text-dark-400' : 'text-th-text'}`}>
                  {method.title}
                </h3>
                {method.badge && (
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full
                    ${method.id === 'PHONE_FULL' && method.available
                      ? 'bg-accent-green/20 text-accent-green'
                      : 'bg-dark-600 text-dark-300'
                    }
                  `}>
                    {method.badge}
                  </span>
                )}
              </div>
              <p className={`text-sm mt-0.5 ${isDisabled ? 'text-dark-500' : 'text-dark-400'}`}>
                {method.description}
              </p>
            </div>

            {!isDisabled && (
              <ChevronRight24Regular className="w-5 h-5 text-dark-400" />
            )}
          </button>
        );
      })}

      <div className="mt-6 p-4 bg-dark-800/50 rounded-xl border border-dark-700/50">
        <p className="text-dark-400 text-sm">
          <span className="text-accent-blue">Tip:</span>{' '}
          {t.import?.tip || 'Export your contacts from your phone or email app as a VCF or CSV file for the most reliable import.'}
        </p>
      </div>
    </div>
  );
}
