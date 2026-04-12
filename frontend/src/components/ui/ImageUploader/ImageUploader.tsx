'use client';

import React, { useRef, useState } from 'react';
import {
  Image24Regular,
  Add24Regular,
  Dismiss24Regular,
  ArrowExpand24Regular,
} from '@fluentui/react-icons';
import { useI18n } from '@/lib/i18n/Provider';

interface ImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onFilesSelected?: (files: File[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
  disabled?: boolean;
  className?: string;
}

export function ImageUploader({
  images,
  onImagesChange,
  onFilesSelected,
  maxImages = 10,
  maxSizeMB = 5,
  disabled = false,
  className = '',
}: ImageUploaderProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = maxSizeMB * 1024 * 1024;

    // Filter valid files
    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) {
        return false;
      }
      if (file.size > maxSize) {
        return false;
      }
      return true;
    });

    // Limit total images
    const remainingSlots = maxImages - images.length - pendingFiles.length;
    const filesToAdd = validFiles.slice(0, remainingSlots);

    if (filesToAdd.length === 0) return;

    // Add to pending files
    setPendingFiles((prev) => [...prev, ...filesToAdd]);

    // Generate previews
    filesToAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPreviews((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });

    // Notify parent of files selected
    if (onFilesSelected) {
      onFilesSelected([...pendingFiles, ...filesToAdd]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const existingCount = images.length;

    if (index < existingCount) {
      // Remove existing image
      const newImages = [...images];
      newImages.splice(index, 1);
      onImagesChange(newImages);
    } else {
      // Remove pending image
      const pendingIndex = index - existingCount;
      const newPendingFiles = [...pendingFiles];
      const newPreviews = [...previews];
      newPendingFiles.splice(pendingIndex, 1);
      newPreviews.splice(pendingIndex, 1);
      setPendingFiles(newPendingFiles);
      setPreviews(newPreviews);

      if (onFilesSelected) {
        onFilesSelected(newPendingFiles);
      }
    }
  };

  const openPreview = (url: string) => {
    setPreviewImage(url);
  };

  const closePreview = () => {
    setPreviewImage(null);
  };

  const allImages = [...images, ...previews];
  const canAddMore = allImages.length < maxImages && !disabled;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-th-text-t mb-2">
        <Image24Regular className="w-4 h-4 inline mr-2" />
        {t.imageUploader?.title || 'Attachments'}
        <span className="text-th-text-m ml-2">
          ({allImages.length}/{maxImages})
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        {/* Existing and preview images */}
        {allImages.map((url, index) => (
          <div
            key={index}
            className="relative w-20 h-20 rounded-lg overflow-hidden bg-th-surface border border-th-border group"
          >
            <img
              src={url}
              alt={`Image ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => openPreview(url)}
                className="p-1 rounded bg-th-surface-h hover:bg-white/30 text-th-text"
              >
                <ArrowExpand24Regular className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => removeImage(index)}
                disabled={disabled}
                className="p-1 rounded bg-red-500/50 hover:bg-red-500/70 text-white disabled:opacity-50"
              >
                <Dismiss24Regular className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Add button */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-white/20 hover:border-emerald-400 hover:bg-th-surface flex flex-col items-center justify-center gap-1 text-th-text-t hover:text-emerald-400 transition-colors"
          >
            <Add24Regular className="w-6 h-6" />
            <span className="text-xs">{t.imageUploader?.add || 'Add'}</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Size limit hint */}
      <p className="text-xs text-th-text-m mt-2">
        {t.imageUploader?.hint || `Max ${maxSizeMB}MB per image. Up to ${maxImages} images (JPG, PNG, GIF, WebP).`}
      </p>

      {/* Full screen preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 rounded-full transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); closePreview(); }}
            aria-label="Close"
          >
            <Dismiss24Regular className="w-6 h-6 text-white" />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default ImageUploader;
