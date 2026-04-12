'use client';

/**
 * PNME: Pitch Upload Page
 * Drag & drop upload for pitch decks
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  DocumentArrowUpRegular,
  DocumentRegular,
  DismissRegular,
  CheckmarkCircleRegular,
} from '@fluentui/react-icons';
import { usePitchUpload } from '@/hooks/pitch/usePitchUpload';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
};

export default function PitchUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [error, setError] = useState<string | null>(null);

  const { mutate: uploadPitch, isPending } = usePitchUpload({
    onSuccess: (data) => {
      // Redirect to processing page
      router.push(`/pitch/${data.pitch.id}`);
    },
    onError: (error: any) => {
      setError(error.message || 'Upload failed. Please try again.');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File is too large. Maximum size is 50MB.');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Invalid file type. Only PDF files are supported.');
      } else {
        setError('Invalid file. Please try a different file.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    multiple: false,
  });

  const handleSubmit = () => {
    if (!file) return;

    uploadPitch({
      file,
      title: title || undefined,
      language,
    });
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-dark-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-th-text">Upload Pitch Deck</h1>
          <p className="text-dark-400 mt-1">
            Upload your pitch deck to analyze it and find the best contacts for each section
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 mb-6">
          {!file ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-[#00d084]/40 bg-[#00d084]/50/10'
                  : 'border-dark-600 hover:border-dark-500'
              }`}
            >
              <input {...getInputProps()} />
              <DocumentArrowUpRegular className="w-16 h-16 text-dark-500 mx-auto mb-4" />
              <h3 className="text-th-text font-medium mb-2">
                {isDragActive ? 'Drop your file here' : 'Drag & drop your pitch deck'}
              </h3>
              <p className="text-dark-400 text-sm mb-4">or click to browse</p>
              <p className="text-dark-500 text-xs">
                PDF files only, max 50MB
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-dark-700 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#00d084]/50/20 flex items-center justify-center">
                  <DocumentRegular className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <p className="text-th-text font-medium">{file.name}</p>
                  <p className="text-dark-400 text-sm">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={removeFile}
                className="p-2 text-dark-400 hover:text-red-400 transition-colors"
              >
                <DismissRegular className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Options */}
        {file && (
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 mb-6">
            <h2 className="text-th-text font-medium mb-4">Options</h2>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-dark-300 text-sm mb-2">
                Title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Startup Pitch"
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-th-text placeholder-dark-500 focus:outline-none focus:border-[#00d084]/50"
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-dark-300 text-sm mb-2">
                Language
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    language === 'en'
                      ? 'bg-primary-600 text-th-text'
                      : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                  }`}
                >
                  {language === 'en' && <CheckmarkCircleRegular className="w-4 h-4" />}
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    language === 'ar'
                      ? 'bg-primary-600 text-th-text'
                      : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                  }`}
                >
                  {language === 'ar' && <CheckmarkCircleRegular className="w-4 h-4" />}
                  Arabic
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        {file && (
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-th-text font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white" />
                Uploading...
              </>
            ) : (
              <>
                <DocumentArrowUpRegular className="w-5 h-5" />
                Analyze Pitch Deck
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
