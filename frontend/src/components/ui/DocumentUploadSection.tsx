'use client';

import { useState, useRef } from 'react';
import {
  Document24Regular,
  ArrowUpload24Regular,
  Sparkle24Regular,
  ArrowSync24Regular,
  Dismiss24Regular,
  CheckmarkCircle24Regular,
} from '@fluentui/react-icons';

interface DocumentUploadSectionProps<T> {
  onExtracted: (data: T) => void;
  extractFn: (file: File) => Promise<T>;
  title?: string;
  description?: string;
  accentColor?: 'emerald' | 'blue' | 'amber' | 'purple';
  acceptTypes?: string;
  maxSizeMB?: number;
}

const gradientMap = {
  emerald: 'from-emerald-500 to-teal-400',
  blue: 'from-blue-500 to-cyan-400',
  amber: 'from-emerald-500 to-teal-400',
  purple: 'from-purple-500 to-indigo-400',
};

const colorMap = {
  emerald: { icon: 'bg-emerald-500/[0.12] border-emerald-500/25 text-emerald-400', border: 'hover:border-emerald-500/60 hover:bg-emerald-500/[0.06]', btn: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30', banner: 'border-emerald-500/30 bg-emerald-500/[0.06]', topBorder: 'border-t-emerald-500' },
  blue: { icon: 'bg-blue-500/[0.12] border-blue-500/25 text-blue-400', border: 'hover:border-blue-500/60 hover:bg-blue-500/[0.06]', btn: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30', banner: 'border-blue-500/30 bg-blue-500/[0.06]', topBorder: 'border-t-blue-500' },
  amber: { icon: 'bg-emerald-500/[0.12] border-emerald-500/25 text-emerald-400', border: 'hover:border-emerald-500/60 hover:bg-emerald-500/[0.06]', btn: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30', banner: 'border-emerald-500/30 bg-emerald-500/[0.06]', topBorder: 'border-t-emerald-500' },
  purple: { icon: 'bg-purple-500/[0.12] border-purple-500/25 text-purple-400', border: 'hover:border-purple-500/60 hover:bg-purple-500/[0.06]', btn: 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30', banner: 'border-purple-500/30 bg-purple-500/[0.06]', topBorder: 'border-t-purple-500' },
};

export function DocumentUploadSection<T>({
  onExtracted,
  extractFn,
  title = 'Upload Project Document',
  description = 'Upload a proposal or business plan. AI will extract details and suggest relevant options.',
  accentColor = 'emerald',
  acceptTypes = '.pdf,.docx,.doc,.txt',
  maxSizeMB = 10,
}: DocumentUploadSectionProps<T>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gradient = gradientMap[accentColor];
  const clr = colorMap[accentColor];

  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (!allowedMimeTypes.includes(f.type)) {
      setError('Please upload PDF, DOCX, DOC, or TXT files.');
      return;
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`File size must be less than ${maxSizeMB}MB.`);
      return;
    }
    setFile(f);
    setExtracted(false);
  };

  const handleExtract = async () => {
    if (!file) return;
    setIsExtracting(true);
    setProgress(0);
    setError(null);
    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);
    try {
      const data = await extractFn(file);
      setProgress(100);
      setExtracted(true);
      onExtracted(data);
    } catch (err: any) {
      setError(err.message || 'Extraction failed');
    } finally {
      clearInterval(interval);
      setIsExtracting(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setExtracted(false);
    setProgress(0);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className={`bg-[linear-gradient(180deg,rgba(10,30,52,0.96),rgba(8,24,42,0.98))] backdrop-blur-xl border-2 border-white/[0.12] ${clr.topBorder} border-t-[3px] rounded-3xl shadow-lg overflow-hidden`}>
      <div className="p-5 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className={`w-[42px] h-[42px] rounded-[14px] flex items-center justify-center flex-shrink-0 border ${clr.icon}`}>
            <ArrowUpload24Regular className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-[1.06rem] font-extrabold text-th-text tracking-tight">{title}</h2>
            <p className="text-[0.96rem] text-th-text-s mt-1.5 leading-relaxed font-medium">{description}</p>
          </div>
        </div>

        {/* Dropzone */}
        <div
          onClick={() => fileRef.current?.click()}
          className={`group border-2 border-dashed border-white/[0.18] ${clr.border} rounded-[20px] min-h-[128px] flex flex-col items-center justify-center gap-2 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] text-center p-5 cursor-pointer transition-all focus-within:border-emerald-500/60 focus-within:shadow-[0_0_0_4px_rgba(24,210,164,0.22)]`}
          tabIndex={0}
          role="button"
          aria-label="Upload document"
        >
          <input ref={fileRef} type="file" accept={acceptTypes} onChange={handleFileSelect} className="hidden" />
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <Document24Regular className="w-5 h-5 text-th-text-s" />
              <span className="text-sm text-th-text-s truncate">{file.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); handleClear(); }} className="text-th-text-m hover:text-th-text ms-2">
                <Dismiss24Regular className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center ${clr.icon}`}>
                <ArrowUpload24Regular className="w-5 h-5" />
              </div>
              <strong className="text-[1rem] font-extrabold text-th-text">Drop your file here or click to upload</strong>
              <span className="text-th-text-s text-[0.94rem] leading-relaxed max-w-[620px]">
                Supports PDF, DOCX, TXT — AI will extract project details and suggest relevant options.
              </span>
            </>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 font-medium">{error}</p>
        )}

        {file && (
          <button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting}
            className={`w-full px-4 py-3 border-2 rounded-2xl text-sm font-extrabold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${clr.btn}`}
          >
            {isExtracting ? (
              <span className="flex items-center justify-center gap-2">
                <ArrowSync24Regular className="w-4 h-4 animate-spin" /> Extracting...
              </span>
            ) : extracted ? 'Re-extract' : (
              <span className="flex items-center justify-center gap-2">
                <Sparkle24Regular className="w-4 h-4" /> Extract with AI
              </span>
            )}
          </button>
        )}

        {isExtracting && (
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r ${gradient} transition-all duration-500 rounded-full`} style={{ width: `${progress}%` }} />
          </div>
        )}

        {extracted && !isExtracting && (
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-[14px] border ${clr.banner}`}>
            <CheckmarkCircle24Regular className="w-4 h-4 text-green-400 flex-shrink-0" />
            <p className="text-[0.84rem] text-th-text-s font-medium">Fields populated from document. Review and edit below.</p>
          </div>
        )}
      </div>
    </div>
  );
}
