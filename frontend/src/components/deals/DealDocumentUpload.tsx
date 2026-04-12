'use client';

import { useState, useRef } from 'react';
import {
  Document24Regular,
  ArrowUpload24Regular,
  Sparkle24Regular,
} from '@fluentui/react-icons';
import { extractDealFromDocument, ExtractedDealData } from '@/lib/api/deals';
import { toast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';

interface DealDocumentUploadProps {
  onExtracted: (data: ExtractedDealData) => void;
}

export function DealDocumentUpload({ onExtracted }: DealDocumentUploadProps) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const allowed = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
      ];
      if (!allowed.includes(f.type)) {
        toast({ title: 'Error', description: 'Please upload PDF, DOCX, DOC, or TXT files.', variant: 'error' });
        return;
      }
      setFile(f);
      setExtracted(false);
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setIsExtracting(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);
    try {
      const data = await extractDealFromDocument(file);
      setProgress(100);
      setExtracted(true);
      onExtracted(data);
      toast({ title: t.deals?.dataExtracted || 'Data extracted successfully', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.deals?.extractionFailed || 'Extraction failed', description: error.message, variant: 'error' });
    } finally {
      clearInterval(interval);
      setIsExtracting(false);
    }
  };

  return (
    <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Document24Regular className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-medium text-th-text text-sm">{t.deals?.quickFillDoc || 'Quick Fill from Document'}</h3>
            <p className="text-xs text-th-text-m">{t.deals?.quickFillDocDesc || 'Upload a document and AI will extract deal details'}</p>
          </div>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="group border-2 border-dashed border-th-border hover:border-emerald-500/40 rounded-xl p-4 text-center cursor-pointer hover:bg-emerald-500/5 transition-all"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <Document24Regular className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-th-text-s truncate">{file.name}</span>
            </div>
          ) : (
            <div>
              <ArrowUpload24Regular className="w-6 h-6 text-th-text-m mx-auto mb-1 group-hover:text-emerald-400 transition-colors" />
              <p className="text-xs text-th-text-m group-hover:text-th-text-t transition-colors">
                {t.deals?.clickToUpload || 'Click to upload (PDF, DOCX, TXT)'}
              </p>
            </div>
          )}
        </div>

        {file && (
          <button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting}
            className="w-full px-4 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium hover:bg-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExtracting ? (t.deals?.extracting || 'Extracting...') : extracted ? (t.deals?.reExtract || 'Re-extract') : (t.deals?.extractData || 'Extract Data')}
          </button>
        )}

        {isExtracting && (
          <div className="h-1.5 bg-th-surface-h rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {extracted && (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <Sparkle24Regular className="w-3.5 h-3.5" /> {t.deals?.fieldsPopulated || 'Fields populated from document. Review and edit below.'}
          </p>
        )}
      </div>
    </div>
  );
}
