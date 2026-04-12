/**
 * Export Modal
 *
 * Modal for exporting contacts to CSV or vCard formats.
 */

'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Dismiss24Regular,
  DocumentTable24Regular,
  ContactCard24Regular,
  ArrowDownload24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { getAccessToken } from '@/lib/api/client';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds?: string[];
  totalContacts?: number;
}

type ExportFormat = 'csv' | 'vcard';
type ExportScope = 'all' | 'selected' | 'filtered';

export default function ExportModal({
  isOpen,
  onClose,
  selectedIds = [],
  totalContacts = 0,
}: ExportModalProps) {
  const { t } = useI18n();
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<ExportScope>(selectedIds.length > 0 ? 'selected' : 'all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setExportComplete(false);

    try {
      const params = new URLSearchParams();
      params.append('format', format);

      if (scope === 'selected' && selectedIds.length > 0) {
        params.append('ids', selectedIds.join(','));
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contacts/export?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `contacts.${format === 'csv' ? 'csv' : 'vcf'}`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportComplete(true);

      // Close modal after brief delay
      setTimeout(() => {
        onClose();
        setExportComplete(false);
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
      alert(t.common?.error || 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions = [
    {
      id: 'csv' as ExportFormat,
      icon: <DocumentTable24Regular className="w-6 h-6" />,
      title: 'CSV',
      description: t.export?.csvDescription || 'Spreadsheet format for Excel, Google Sheets',
    },
    {
      id: 'vcard' as ExportFormat,
      icon: <ContactCard24Regular className="w-6 h-6" />,
      title: 'vCard',
      description: t.export?.vcardDescription || 'Import to phone contacts, Outlook',
    },
  ];

  const scopeOptions = [
    {
      id: 'all' as ExportScope,
      label: t.export?.allContacts || 'All contacts',
      count: totalContacts,
      disabled: false,
    },
    {
      id: 'selected' as ExportScope,
      label: t.export?.selectedContacts || 'Selected contacts',
      count: selectedIds.length,
      disabled: selectedIds.length === 0,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-th-border">
          <h2 className="text-lg font-semibold text-th-text">
            {t.export?.title || 'Export Contacts'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-th-text-t hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors"
          >
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Format Selection */}
          <div>
            <h3 className="text-sm font-medium text-th-text-t mb-3">
              {t.export?.format || 'Export Format'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {formatOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setFormat(option.id)}
                  className={`p-4 rounded-xl border text-start transition-all ${
                    format === option.id
                      ? 'bg-emerald-500/20 border-emerald-500 text-white'
                      : 'bg-th-surface border-th-border text-th-text-s hover:bg-th-surface-h'
                  }`}
                >
                  <div className={`mb-2 ${format === option.id ? 'text-emerald-400' : 'text-th-text-m'}`}>
                    {option.icon}
                  </div>
                  <p className="font-medium">{option.title}</p>
                  <p className="text-xs text-th-text-m mt-1">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Scope Selection */}
          <div>
            <h3 className="text-sm font-medium text-th-text-t mb-3">
              {t.export?.scope || 'What to Export'}
            </h3>
            <div className="space-y-2">
              {scopeOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => !option.disabled && setScope(option.id)}
                  disabled={option.disabled}
                  className={`w-full p-3 rounded-xl border text-start flex items-center justify-between transition-all ${
                    option.disabled
                      ? 'bg-th-surface border-th-border-s text-white/70 cursor-not-allowed'
                      : scope === option.id
                      ? 'bg-emerald-500/20 border-emerald-500 text-white'
                      : 'bg-th-surface border-th-border text-th-text-s hover:bg-th-surface-h'
                  }`}
                >
                  <span>{option.label}</span>
                  <span className={`text-sm ${scope === option.id ? 'text-emerald-400' : 'text-th-text-m'}`}>
                    {option.count} {t.contacts?.title?.toLowerCase() || 'contacts'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-th-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-th-surface border border-th-border text-th-text font-medium rounded-xl hover:bg-th-surface-h transition-colors"
          >
            {t.common?.cancel || 'Cancel'}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || (scope === 'selected' && selectedIds.length === 0)}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t.export?.exporting || 'Exporting...'}
              </>
            ) : exportComplete ? (
              <>
                <Checkmark24Regular className="w-5 h-5" />
                {t.export?.complete || 'Complete!'}
              </>
            ) : (
              <>
                <ArrowDownload24Regular className="w-5 h-5" />
                {t.export?.export || 'Export'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
