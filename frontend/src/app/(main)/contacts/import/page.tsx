/**
 * Import Center Page
 *
 * Multi-step wizard for importing contacts from various sources.
 * Steps: Method Selection → Consent → Upload/Processing → Quality Review
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import Link from 'next/link';
import {
  ImportMethodSelector,
  ConsentScreen,
  ImportProgress,
  FileUploader,
  ContactReviewList,
  type ImportSource,
} from '@/components/import';
import {
  type RawContact,
  createImportBatch,
  uploadChunk,
  commitBatch,
} from '@/lib/api/import';

type Step = 'method' | 'consent' | 'upload' | 'review' | 'progress' | 'complete';

const CHUNK_SIZE = 200;

export default function ImportCenterPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<ImportSource | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [enrichmentEnabled] = useState(true);
  const [aiSummaryEnabled] = useState(true);
  const [phoneEnrichmentEnabled] = useState(true);
  const [parsedContacts, setParsedContacts] = useState<RawContact[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Handle method selection
  const handleMethodSelect = useCallback((selectedMethod: ImportSource) => {
    setMethod(selectedMethod);
    setStep('consent');
  }, []);

  // Handle consent completion
  const handleConsent = useCallback((_options: { enrichment: boolean; aiSummary: boolean; phoneEnrichment: boolean }) => {
    // Enrichment is always enabled - values are mandatory
    setStep('upload');
  }, []);

  // Handle contacts parsed from file
  const handleContactsParsed = useCallback((contacts: RawContact[]) => {
    setParsedContacts(contacts);
    setStep('review');
  }, []);

  // Handle selected contacts from review step
  const handleSelectedContacts = useCallback(async (selectedContacts: RawContact[]) => {
    if (selectedContacts.length === 0 || !method) return;

    setIsUploading(true);
    setStep('progress');

    try {
      // Create batch
      const { batchId: newBatchId } = await createImportBatch({
        source: method,
        enrichmentEnabled,
        aiSummaryEnabled,
        phoneEnrichmentEnabled,
      });

      // Upload in chunks
      const totalChunks = Math.ceil(selectedContacts.length / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, selectedContacts.length);
        const chunk = selectedContacts.slice(start, end);

        await uploadChunk(newBatchId, {
          chunkIndex: i,
          contacts: chunk,
          isLastChunk: i === totalChunks - 1,
        });
      }

      // Commit batch to start processing
      await commitBatch(newBatchId);

      setBatchId(newBatchId);
    } catch (err: any) {
      console.error('Upload failed:', err);
      if (err?.status === 402 || err?.code === 'INSUFFICIENT_POINTS') {
        toast({
          title: t.wallet?.insufficientPoints || 'Insufficient Points',
          description: err?.message || 'Not enough points to import contacts',
          variant: 'destructive',
        });
      }
      // Go back to review step on error
      setStep('review');
    } finally {
      setIsUploading(false);
    }
  }, [method, enrichmentEnabled, aiSummaryEnabled, phoneEnrichmentEnabled, t]);

  // Handle batch creation (for backward compatibility)
  const handleBatchCreated = useCallback((newBatchId: string) => {
    setBatchId(newBatchId);
    setStep('progress');
  }, []);

  // Handle completion
  const handleComplete = useCallback(() => {
    setStep('complete');
  }, []);

  // Navigate back
  const handleBack = useCallback(() => {
    switch (step) {
      case 'consent':
        setStep('method');
        setMethod(null);
        break;
      case 'upload':
        setStep('consent');
        break;
      case 'review':
        setStep('upload');
        setParsedContacts([]);
        break;
      case 'progress':
        // Can't go back during processing
        break;
      case 'complete':
        router.push('/contacts');
        break;
      default:
        router.push('/contacts');
    }
  }, [step, router]);

  // Get step title
  const getStepTitle = () => {
    switch (step) {
      case 'method':
        return t.import?.selectMethod || 'Select Import Method';
      case 'consent':
        return t.import?.privacyConsent || 'Privacy & Consent';
      case 'upload':
        return t.import?.uploadContacts || 'Upload Contacts';
      case 'review':
        return t.import?.reviewContacts || 'Review Contacts';
      case 'progress':
        return t.import?.processing || 'Processing Contacts';
      case 'complete':
        return t.import?.complete || 'Import Complete';
    }
  };

  // Get step number (now 5 steps)
  const getStepNumber = () => {
    switch (step) {
      case 'method': return 1;
      case 'consent': return 2;
      case 'upload': return 3;
      case 'review': return 4;
      case 'progress': return 5;
      case 'complete': return 5;
    }
  };

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <div className="border-b border-dark-700 bg-dark-800/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-lg hover:bg-dark-700 transition-colors"
              disabled={step === 'progress'}
            >
              <ArrowLeft24Regular className="w-5 h-5 text-dark-300" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-th-text">
                {t.import?.title || 'Import Contacts'}
              </h1>
              <p className="text-sm text-dark-400">
                {getStepTitle()}
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((num) => (
              <div key={num} className="flex items-center flex-1">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${num < getStepNumber() ? 'bg-accent-blue text-th-text' : ''}
                    ${num === getStepNumber() ? 'bg-accent-blue text-th-text' : ''}
                    ${num > getStepNumber() ? 'bg-dark-700 text-dark-400' : ''}
                  `}
                >
                  {num < getStepNumber() ? (
                    <Checkmark24Regular className="w-4 h-4" />
                  ) : (
                    num
                  )}
                </div>
                {num < 5 && (
                  <div
                    className={`
                      flex-1 h-1 mx-2
                      ${num < getStepNumber() ? 'bg-accent-blue' : 'bg-dark-700'}
                    `}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {step === 'method' && (
          <ImportMethodSelector onSelect={handleMethodSelect} />
        )}

        {step === 'consent' && method && (
          <ConsentScreen
            method={method}
            onConsent={handleConsent}
            onBack={handleBack}
          />
        )}

        {step === 'upload' && method && (
          <FileUploader
            method={method}
            enrichmentEnabled={enrichmentEnabled}
            aiSummaryEnabled={aiSummaryEnabled}
            onBatchCreated={handleBatchCreated}
            parseOnly={true}
            onContactsParsed={handleContactsParsed}
          />
        )}

        {step === 'review' && parsedContacts.length > 0 && (
          <ContactReviewList
            contacts={parsedContacts}
            onConfirm={handleSelectedContacts}
            onBack={handleBack}
          />
        )}

        {step === 'progress' && batchId && (
          <ImportProgress
            batchId={batchId}
            onComplete={handleComplete}
          />
        )}

        {step === 'complete' && (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-accent-green/20 flex items-center justify-center mx-auto mb-6">
              <Checkmark24Regular className="w-10 h-10 text-accent-green" />
            </div>
            <h2 className="text-2xl font-bold text-th-text mb-2">
              {t.import?.importSuccess || 'Import Complete!'}
            </h2>
            <p className="text-dark-300 mb-8">
              {t.import?.importSuccessMessage || 'Your contacts have been imported and are ready to use.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/contacts"
                className="px-6 py-3 bg-accent-blue text-th-text rounded-lg hover:bg-accent-blue/90 transition-colors"
              >
                {t.import?.viewContacts || 'View Contacts'}
              </Link>
              <button
                onClick={() => {
                  setStep('method');
                  setMethod(null);
                  setBatchId(null);
                }}
                className="px-6 py-3 bg-dark-700 text-th-text rounded-lg hover:bg-dark-600 transition-colors"
              >
                {t.import?.importMore || 'Import More'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
