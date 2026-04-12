'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { useI18n } from '@/lib/i18n/Provider';
import { toast } from '@/components/ui/Toast';
import {
  ContactReminder,
  CreateReminderInput,
  UpdateReminderInput,
  createContactReminder,
  updateContactReminder,
  uploadReminderImages,
  deleteReminderImage,
} from '@/lib/api/contacts';

interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  reminder?: ContactReminder | null;
  onSuccess: (reminder: ContactReminder) => void;
  onDelete?: (reminderId: string) => void;
}

export function ReminderDialog({
  open,
  onOpenChange,
  contactId,
  reminder,
  onSuccess,
  onDelete,
}: ReminderDialogProps) {
  const { t } = useI18n();
  const isEditing = !!reminder;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset form when dialog opens/closes or reminder changes
  useEffect(() => {
    if (open && reminder) {
      setTitle(reminder.title);
      setDescription(reminder.description || '');
      setImages(reminder.imageUrls || []);
      setPendingFiles([]);
      setShowDeleteConfirm(false);

      if (reminder.reminderAt) {
        const date = new Date(reminder.reminderAt);
        setReminderDate(date.toISOString().split('T')[0]);
        setReminderTime(date.toTimeString().slice(0, 5));
      } else {
        setReminderDate('');
        setReminderTime('');
      }
    } else if (open && !reminder) {
      setTitle('');
      setDescription('');
      setImages([]);
      setPendingFiles([]);
      setShowDeleteConfirm(false);

      // Default to tomorrow at 9am
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setReminderDate(tomorrow.toISOString().split('T')[0]);
      setReminderTime('09:00');
    }
  }, [open, reminder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: t.common.error,
        description: t.reminderDialog?.titleRequired || 'Title is required',
        variant: 'error',
      });
      return;
    }

    if (!reminderDate || !reminderTime) {
      toast({
        title: t.common.error,
        description: t.reminderDialog?.dateRequired || 'Date and time are required',
        variant: 'error',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const reminderAtIso = new Date(`${reminderDate}T${reminderTime}:00`).toISOString();

      let savedReminder: ContactReminder;

      if (isEditing && reminder) {
        // Update existing reminder
        const updateData: UpdateReminderInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          reminderAt: reminderAtIso,
        };
        savedReminder = await updateContactReminder(contactId, reminder.id, updateData);
      } else {
        // Create new reminder
        const createData: CreateReminderInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          reminderAt: reminderAtIso,
        };
        savedReminder = await createContactReminder(contactId, createData);
      }

      // Upload new images if any
      if (pendingFiles.length > 0) {
        savedReminder = await uploadReminderImages(contactId, savedReminder.id, pendingFiles);
      }

      toast({
        title: t.common.success,
        description: isEditing
          ? (t.reminderDialog?.updated || 'Reminder updated')
          : (t.reminderDialog?.created || 'Reminder created'),
        variant: 'success',
      });

      onSuccess(savedReminder);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving reminder:', error);
      toast({
        title: t.common.error,
        description: t.reminderDialog?.saveFailed || 'Failed to save reminder',
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImagesChange = async (newImages: string[]) => {
    // If an existing image was removed
    if (isEditing && reminder && newImages.length < images.length) {
      const removedIndex = images.findIndex((img, i) => newImages[i] !== img);
      if (removedIndex !== -1 && removedIndex < (reminder.imageUrls?.length || 0)) {
        try {
          await deleteReminderImage(contactId, reminder.id, removedIndex);
        } catch (error) {
          console.error('Error deleting image:', error);
        }
      }
    }
    setImages(newImages);
  };

  const handleFilesSelected = (files: File[]) => {
    setPendingFiles(files);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? (t.reminderDialog?.editTitle || 'Edit Reminder') : (t.reminderDialog?.createTitle || 'Add Reminder')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-th-text-t mb-1">
              {t.reminderDialog?.title || 'Title'} *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.reminderDialog?.titlePlaceholder || 'Enter reminder title'}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-th-text-t mb-1">
              {t.reminderDialog?.notes || 'Notes'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.reminderDialog?.notesPlaceholder || 'Add notes...'}
              rows={3}
              className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder:text-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Image Uploader */}
          <ImageUploader
            images={images}
            onImagesChange={handleImagesChange}
            onFilesSelected={handleFilesSelected}
            maxImages={10}
            maxSizeMB={5}
          />

          {/* Reminder Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-th-text-t mb-1">
                {t.reminderDialog?.date || 'Date'} *
              </label>
              <Input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-text-t mb-1">
                {t.reminderDialog?.time || 'Time'} *
              </label>
              <Input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                required
              />
            </div>
          </div>

          {isEditing && onDelete && showDeleteConfirm && (
            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <span className="text-sm text-red-400 flex-1">Are you sure you want to delete this reminder?</span>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  await onDelete(reminder!.id);
                  setIsDeleting(false);
                }}
                className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs bg-th-surface-h text-th-text-t rounded-lg hover:bg-th-surface-h transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          <DialogFooter>
            {isEditing && onDelete && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="mr-auto px-4 py-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
              >
                Delete
              </button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-th-text-t hover:text-th-text hover:bg-th-surface-h"
            >
              {t.common.cancel}
            </Button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-emerald-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isEditing ? (t.common.save) : (t.reminderDialog?.create || 'Create Reminder')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ReminderDialog;
