/**
 * File Uploader
 *
 * Handles file upload for CSV/VCF and contact picker selection.
 * Uploads contacts in chunks and creates import batch.
 *
 * @module components/import/FileUploader
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import {
  ArrowUpload24Regular,
  Document24Regular,
  Dismiss24Regular,
  Checkmark24Regular,
  Warning24Regular,
  ArrowSync24Regular,
} from '@fluentui/react-icons';
import { useI18n, type Translations } from '@/lib/i18n';
import {
  createImportBatch,
  uploadChunk,
  commitBatch,
  parseVCF,
  parseCSV,
  type ImportSource,
  type RawContact,
} from '@/lib/api/import';

interface FileUploaderProps {
  method: ImportSource;
  enrichmentEnabled: boolean;
  aiSummaryEnabled: boolean;
  onBatchCreated: (batchId: string) => void;
  /** If true, file uploader only parses and calls onContactsParsed instead of uploading */
  parseOnly?: boolean;
  /** Called when contacts are parsed (only when parseOnly is true) */
  onContactsParsed?: (contacts: RawContact[]) => void;
}

type UploadState = 'idle' | 'parsing' | 'uploading' | 'error';

const CHUNK_SIZE = 200;

export default function FileUploader({
  method,
  enrichmentEnabled,
  aiSummaryEnabled,
  onBatchCreated,
  parseOnly = false,
  onContactsParsed,
}: FileUploaderProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<RawContact[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const acceptedFileTypes = method === 'VCF_UPLOAD' ? '.vcf,.vcard' : '.csv';
  const fileTypeLabel = method === 'VCF_UPLOAD' ? 'VCF' : 'CSV';

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setUploadState('parsing');

    try {
      const content = await file.text();
      let contacts: RawContact[];

      if (method === 'VCF_UPLOAD') {
        contacts = parseVCF(content);
      } else {
        contacts = parseCSV(content);
      }

      if (contacts.length === 0) {
        setError(t.import?.errors?.noContacts || 'No valid contacts found in file');
        setUploadState('error');
        return;
      }

      setParsedContacts(contacts);
      setUploadState('idle');

      // If parseOnly mode, notify parent with parsed contacts
      if (parseOnly && onContactsParsed) {
        onContactsParsed(contacts);
      }
    } catch (err) {
      setError(t.import?.errors?.parseError || 'Failed to parse file');
      setUploadState('error');
    }
  }, [method, t, parseOnly, onContactsParsed]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Handle contact picker
  const handleContactPicker = useCallback(async () => {
    try {
      setUploadState('parsing');
      setError(null);

      // @ts-expect-error - Contact Picker API
      const contacts = await navigator.contacts.select(
        ['name', 'email', 'tel', 'organization', 'jobTitle'],
        { multiple: true }
      );

      const rawContacts: RawContact[] = contacts.map((contact: {
        name?: string[];
        email?: string[];
        tel?: string[];
        organization?: string[];
        jobTitle?: string[];
      }) => ({
        name: contact.name?.[0],
        email: contact.email?.[0],
        emails: contact.email,
        phone: contact.tel?.[0],
        phones: contact.tel,
        company: contact.organization?.[0],
        jobTitle: contact.jobTitle?.[0],
      }));

      if (rawContacts.length === 0) {
        setError(t.import?.errors?.noContactsSelected || 'No contacts selected');
        setUploadState('error');
        return;
      }

      setParsedContacts(rawContacts);
      setUploadState('idle');

      // If parseOnly mode, notify parent with parsed contacts
      if (parseOnly && onContactsParsed) {
        onContactsParsed(rawContacts);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(t.import?.errors?.pickerError || 'Failed to access contacts');
        setUploadState('error');
      } else {
        setUploadState('idle');
      }
    }
  }, [t, parseOnly, onContactsParsed]);

  // Start upload process
  const handleUpload = useCallback(async () => {
    if (parsedContacts.length === 0) return;

    setUploadState('uploading');
    setUploadProgress(0);
    setError(null);

    try {
      // Create batch
      const { batchId } = await createImportBatch({
        source: method,
        enrichmentEnabled,
        aiSummaryEnabled,
      });

      // Upload in chunks
      const totalChunks = Math.ceil(parsedContacts.length / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, parsedContacts.length);
        const chunk = parsedContacts.slice(start, end);

        await uploadChunk(batchId, {
          chunkIndex: i,
          contacts: chunk,
          isLastChunk: i === totalChunks - 1,
        });

        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      // Commit batch to start processing
      await commitBatch(batchId);

      // Notify parent
      onBatchCreated(batchId);
    } catch (err) {
      setError((err as Error).message || t.import?.errors?.uploadError || 'Failed to upload contacts');
      setUploadState('error');
    }
  }, [parsedContacts, method, enrichmentEnabled, aiSummaryEnabled, onBatchCreated, t]);

  // Clear selection
  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setParsedContacts([]);
    setError(null);
    setUploadState('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Render contact picker button
  if (method === 'PHONE_PICKER') {
    return (
      <div className="space-y-6">
        {parsedContacts.length === 0 || parseOnly ? (
          <button
            onClick={handleContactPicker}
            disabled={uploadState === 'parsing'}
            className="w-full p-8 bg-dark-800 border-2 border-dashed border-dark-600 rounded-xl hover:border-accent-blue/50 transition-colors"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-accent-blue/10 rounded-full flex items-center justify-center">
                {uploadState === 'parsing' ? (
                  <ArrowSync24Regular className="w-8 h-8 text-accent-blue animate-spin" />
                ) : (
                  <Document24Regular className="w-8 h-8 text-accent-blue" />
                )}
              </div>
              <div className="text-center">
                <p className="text-th-text font-medium">
                  {uploadState === 'parsing'
                    ? (t.import?.loading || 'Loading contacts...')
                    : (t.import?.pickContacts || 'Pick Contacts')
                  }
                </p>
                <p className="text-sm text-dark-400 mt-1">
                  {t.import?.pickContactsDescription || 'Select which contacts to import'}
                </p>
              </div>
            </div>
          </button>
        ) : (
          <ContactPreview
            contacts={parsedContacts}
            onClear={handleClear}
            onUpload={handleUpload}
            uploadState={uploadState}
            uploadProgress={uploadProgress}
            t={t}
          />
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <Warning24Regular className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}
      </div>
    );
  }

  // Render file upload
  return (
    <div className="space-y-6">
      {parsedContacts.length === 0 || parseOnly ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes}
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className={`
              w-full p-8 bg-dark-800 border-2 border-dashed rounded-xl cursor-pointer
              transition-colors
              ${uploadState === 'parsing'
                ? 'border-accent-blue bg-accent-blue/5'
                : 'border-dark-600 hover:border-accent-blue/50'
              }
            `}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-accent-blue/10 rounded-full flex items-center justify-center">
                {uploadState === 'parsing' ? (
                  <ArrowSync24Regular className="w-8 h-8 text-accent-blue animate-spin" />
                ) : (
                  <ArrowUpload24Regular className="w-8 h-8 text-accent-blue" />
                )}
              </div>
              <div className="text-center">
                <p className="text-th-text font-medium">
                  {uploadState === 'parsing'
                    ? (t.import?.parsing || 'Parsing file...')
                    : (t.import?.dropFile || 'Drop your file here')
                  }
                </p>
                <p className="text-sm text-dark-400 mt-1">
                  {t.import?.orClickToSelect || 'or click to select'} ({fileTypeLabel})
                </p>
              </div>
            </div>
          </div>

          {selectedFile && uploadState === 'parsing' && (
            <div className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg">
              <Document24Regular className="w-5 h-5 text-dark-400" />
              <span className="text-sm text-th-text flex-1 truncate">{selectedFile.name}</span>
            </div>
          )}
        </>
      ) : (
        <ContactPreview
          contacts={parsedContacts}
          fileName={selectedFile?.name}
          onClear={handleClear}
          onUpload={handleUpload}
          uploadState={uploadState}
          uploadProgress={uploadProgress}
          t={t}
        />
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <Warning24Regular className="w-5 h-5 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Help text */}
      <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700/50">
        <p className="text-sm text-dark-400">
          {method === 'VCF_UPLOAD' ? (
            t.import?.vcfHelp || 'Export contacts from your phone or email app as a VCF (vCard) file. Most contact apps have an "Export" or "Share" option.'
          ) : (
            t.import?.csvHelp || 'Your CSV file should have headers like: Name, Email, Phone, Company, Job Title. We automatically map common variations.'
          )}
        </p>
      </div>
    </div>
  );
}

// Contact preview component
interface ContactPreviewProps {
  contacts: RawContact[];
  fileName?: string;
  onClear: () => void;
  onUpload: () => void;
  uploadState: UploadState;
  uploadProgress: number;
  t: Translations;
}

function ContactPreview({
  contacts,
  fileName,
  onClear,
  onUpload,
  uploadState,
  uploadProgress,
  t,
}: ContactPreviewProps) {
  const previewContacts = contacts.slice(0, 5);
  const remaining = contacts.length - previewContacts.length;

  return (
    <div className="space-y-4">
      {/* File info */}
      {fileName && (
        <div className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg">
          <Document24Regular className="w-5 h-5 text-accent-blue" />
          <span className="text-sm text-th-text flex-1 truncate">{fileName}</span>
          <button
            onClick={onClear}
            disabled={uploadState === 'uploading'}
            className="p-1 hover:bg-dark-700 rounded transition-colors"
          >
            <Dismiss24Regular className="w-4 h-4 text-dark-400" />
          </button>
        </div>
      )}

      {/* Contact count */}
      <div className="flex items-center gap-2 p-4 bg-accent-green/10 border border-accent-green/20 rounded-lg">
        <Checkmark24Regular className="w-5 h-5 text-accent-green" />
        <span className="text-sm text-th-text">
          {(t.import?.contactsFound || '{count} contacts found').replace('{count}', String(contacts.length))}
        </span>
      </div>

      {/* Preview list */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="p-3 border-b border-dark-700">
          <span className="text-sm text-dark-400">
            {t.import?.preview || 'Preview'}
          </span>
        </div>
        <div className="divide-y divide-dark-700">
          {previewContacts.map((contact, index) => (
            <div key={index} className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center">
                <span className="text-sm text-th-text font-medium">
                  {(contact.name || contact.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-th-text truncate">
                  {contact.name || contact.email || contact.phone || 'Unknown'}
                </p>
                {contact.company && (
                  <p className="text-xs text-dark-400 truncate">{contact.company}</p>
                )}
              </div>
            </div>
          ))}
          {remaining > 0 && (
            <div className="p-3 text-center">
              <span className="text-sm text-dark-400">
                +{remaining} {t.import?.more || 'more'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Upload progress */}
      {uploadState === 'uploading' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-dark-400">{t.import?.uploading || 'Uploading...'}</span>
            <span className="text-th-text">{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onClear}
          disabled={uploadState === 'uploading'}
          className="flex-1 px-4 py-3 bg-dark-700 text-th-text rounded-lg hover:bg-dark-600 transition-colors disabled:opacity-50"
        >
          {t.import?.cancel || 'Cancel'}
        </button>
        <button
          onClick={onUpload}
          disabled={uploadState === 'uploading'}
          className="flex-1 px-4 py-3 bg-accent-blue text-th-text rounded-lg hover:bg-accent-blue/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploadState === 'uploading' ? (
            <>
              <ArrowSync24Regular className="w-5 h-5 animate-spin" />
              {t.import?.uploading || 'Uploading...'}
            </>
          ) : (
            t.import?.startImport || 'Start Import'
          )}
        </button>
      </div>
    </div>
  );
}
