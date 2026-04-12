'use client';

import { useState, useRef, useEffect } from 'react';
import { createBugReport } from '@/lib/api/bug-reports';
import { toast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';

interface QAReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const URGENCY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'] as const;
const CATEGORY_OPTIONS = ['BUG', 'UI_ISSUE', 'PERFORMANCE', 'FEATURE_REQUEST', 'OTHER'] as const;

export function QAReportModal({ isOpen, onClose }: QAReportModalProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [category, setCategory] = useState<typeof CATEGORY_OPTIONS[number]>('BUG');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pagePath, setPagePath] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPagePath(window.location.pathname);
    }
  }, [isOpen]);

  const MAX_SCREENSHOT_MB = 10;

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SCREENSHOT_MB * 1024 * 1024) {
      toast({ title: `Screenshot too large (max ${MAX_SCREENSHOT_MB}MB)`, variant: 'destructive' });
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Only image files are allowed', variant: 'destructive' });
      e.target.value = '';
      return;
    }

    setScreenshot(file);
    const reader = new FileReader();
    reader.onloadend = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setDescription('');
    setUrgency('MEDIUM');
    setCategory('BUG');
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || submitting) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('description', description.trim());
      formData.append('urgency', urgency);
      formData.append('category', category);
      formData.append('pagePath', pagePath);
      formData.append('userAgent', navigator.userAgent);
      formData.append('platform', /Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iOS' : /Windows/i.test(navigator.userAgent) ? 'Windows' : /Mac/i.test(navigator.userAgent) ? 'macOS' : /Linux/i.test(navigator.userAgent) ? 'Linux' : 'Other');
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      await createBugReport(formData);
      setSubmitted(true);
      setTimeout(() => {
        resetForm();
        setSubmitted(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      toast({ title: err.message || 'Failed to submit report', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const urgencyColors: Record<string, string> = {
    LOW: 'bg-green-600 hover:bg-green-500 text-white',
    MEDIUM: 'bg-amber-600 hover:bg-amber-500 text-white',
    HIGH: 'bg-red-600 hover:bg-red-500 text-white',
  };
  const urgencyInactive = 'bg-th-surface border border-th-border text-th-text-s hover:text-th-text';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-[#060b18]" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-th-surface border border-th-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-th-border">
          <h2 className="text-lg font-semibold text-th-text">
            {t.bugReports?.submit || 'Report an Issue'}
          </h2>
          <button
            onClick={onClose}
            className="text-th-text-s hover:text-th-text p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success confirmation */}
        {submitted ? (
          <div className="p-8 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center animate-in zoom-in-50">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-th-text">Report Sent!</p>
              <p className="text-sm text-th-text-s mt-1">Thank you for your feedback.</p>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Screenshot */}
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-1.5">
              {t.bugReports?.screenshot || 'Screenshot'}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScreenshotChange}
              className="hidden"
            />
            {screenshotPreview ? (
              <div className="relative inline-block">
                <img
                  src={screenshotPreview}
                  alt="Screenshot preview"
                  className="h-24 w-auto rounded-lg border border-th-border object-cover"
                />
                {screenshot && (
                  <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] text-white/80">
                    {formatSize(screenshot.size)}
                  </span>
                )}
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-teal-400 hover:text-teal-300"
                  >
                    {t.bugReports?.changeScreenshot || 'Change'}
                  </button>
                  <span className="text-th-text-s text-xs">|</span>
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    {t.bugReports?.removeScreenshot || 'Remove'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-th-border text-th-text-s text-sm hover:border-teal-500/50 hover:text-teal-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t.bugReports?.addScreenshot || 'Add Screenshot'}
              </button>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-1.5">
              {t.bugReports?.description || 'Description'} <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.bugReports?.descriptionPlaceholder || 'Describe the issue you encountered...'}
              required
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-th-border text-th-text placeholder:text-th-text-s/50 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500/50 resize-none"
            />
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-1.5">
              {t.bugReports?.urgency || 'Urgency'}
            </label>
            <div className="flex gap-2">
              {URGENCY_OPTIONS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    urgency === u ? urgencyColors[u] : urgencyInactive
                  }`}
                >
                  {t.bugReports?.urgencyLevels?.[u] || u}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-1.5">
              {t.bugReports?.category || 'Category'}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof CATEGORY_OPTIONS[number])}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-th-border text-th-text text-sm focus:outline-none focus:ring-1 focus:ring-teal-500/50 appearance-none"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c} className="bg-[#1a1a2e] text-white">
                  {t.bugReports?.categories?.[c] || c}
                </option>
              ))}
            </select>
          </div>

          {/* Page (auto-detected) */}
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-1.5">
              {t.bugReports?.page || 'Page'}
            </label>
            <span className="inline-block px-2.5 py-1 rounded-md bg-white/5 border border-th-border text-th-text-s text-xs font-mono">
              {pagePath}
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!description.trim() || submitting}
            className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {submitting
              ? (t.bugReports?.submitting || 'Submitting...')
              : (t.bugReports?.submitButton || 'Submit Report')}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
