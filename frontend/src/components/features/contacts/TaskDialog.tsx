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
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { useI18n } from '@/lib/i18n/Provider';
import { toast } from '@/components/ui/Toast';
import {
  ContactTask,
  CreateTaskInput,
  UpdateTaskInput,
  TaskPriority,
  createContactTask,
  updateContactTask,
  uploadTaskImages,
  deleteTaskImage,
  sendTaskEmail,
} from '@/lib/api/contacts';

interface ContactInfo {
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  task?: ContactTask | null;
  onSuccess: (task: ContactTask) => void;
  onDelete?: (taskId: string) => void;
  contact?: ContactInfo;
}

const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function TaskDialog({
  open,
  onOpenChange,
  contactId,
  task,
  onSuccess,
  onDelete,
  contact,
}: TaskDialogProps) {
  const { t } = useI18n();
  const isEditing = !!task;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [images, setImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [createdTask, setCreatedTask] = useState<ContactTask | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset form when dialog opens/closes or task changes
  useEffect(() => {
    if (open && task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setImages(task.imageUrls || []);
      setPendingFiles([]);
      setShowSendOptions(false);
      setCreatedTask(null);
      setShowDeleteConfirm(false);

      if (task.dueDate) {
        const date = new Date(task.dueDate);
        setDueDate(date.toISOString().split('T')[0]);
        setDueTime(date.toTimeString().slice(0, 5));
      } else {
        setDueDate('');
        setDueTime('');
      }
    } else if (open && !task) {
      setTitle('');
      setDescription('');
      setDueDate('');
      setDueTime('');
      setPriority('MEDIUM');
      setImages([]);
      setPendingFiles([]);
      setShowSendOptions(false);
      setCreatedTask(null);
      setShowDeleteConfirm(false);
    }
  }, [open, task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: t.common.error,
        description: t.taskDialog?.titleRequired || 'Title is required',
        variant: 'error',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let dueDateIso: string | undefined;
      if (dueDate) {
        const dateTime = dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T09:00:00`;
        dueDateIso = new Date(dateTime).toISOString();
      }

      let savedTask: ContactTask;

      if (isEditing && task) {
        // Update existing task
        const updateData: UpdateTaskInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDateIso || null,
          priority,
        };
        savedTask = await updateContactTask(contactId, task.id, updateData);
      } else {
        // Create new task
        const createData: CreateTaskInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDateIso,
          priority,
        };
        savedTask = await createContactTask(contactId, createData);
      }

      // Upload new images if any
      if (pendingFiles.length > 0) {
        savedTask = await uploadTaskImages(contactId, savedTask.id, pendingFiles);
      }

      toast({
        title: t.common.success,
        description: isEditing
          ? (t.taskDialog?.updated || 'Task updated')
          : (t.taskDialog?.created || 'Task created'),
        variant: 'success',
      });

      onSuccess(savedTask);

      // Show send options only for new tasks and if contact info is available
      const hasPhone = contact?.phone && contact.phone.trim().length > 0;
      const hasEmail = contact?.email && contact.email.trim().length > 0;

      console.log('Task created - checking send options:', {
        isEditing,
        contact,
        hasPhone,
        hasEmail
      });

      if (!isEditing && contact && (hasPhone || hasEmail)) {
        setCreatedTask(savedTask);
        setShowSendOptions(true);
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: t.common.error,
        description: t.taskDialog?.saveFailed || 'Failed to save task',
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImagesChange = async (newImages: string[]) => {
    // If an existing image was removed
    if (isEditing && task && newImages.length < images.length) {
      const removedIndex = images.findIndex((img, i) => newImages[i] !== img);
      if (removedIndex !== -1 && removedIndex < (task.imageUrls?.length || 0)) {
        try {
          await deleteTaskImage(contactId, task.id, removedIndex);
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

  const getPriorityColor = (p: TaskPriority) => {
    switch (p) {
      case 'URGENT':
        return 'bg-red-500 hover:bg-red-600';
      case 'HIGH':
        return 'bg-red-500 hover:bg-red-600';
      case 'MEDIUM':
        return 'bg-yellow-500 hover:bg-yellow-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  // Format task message for WhatsApp
  const formatTaskMessage = (task: ContactTask): string => {
    const lines = [`*Task: ${task.title}*`];

    if (task.description) {
      lines.push('', task.description);
    }

    if (task.dueDate) {
      const date = new Date(task.dueDate);
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      lines.push('', `📅 Due: ${formattedDate}`);
    }

    lines.push(`⚡ Priority: ${task.priority}`);
    lines.push('', '---', 'Sent from IntellMatch');

    return lines.join('\n');
  };

  // Send via WhatsApp
  const handleSendWhatsApp = () => {
    if (!createdTask || !contact?.phone) return;

    const phone = contact.phone.replace(/\D/g, ''); // Remove non-digits
    const message = formatTaskMessage(createdTask);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    toast({
      title: t.common.success,
      description: t.taskDialog?.whatsappOpened || 'WhatsApp opened',
      variant: 'success',
    });

    onOpenChange(false);
  };

  // Send via Email
  const handleSendEmail = async () => {
    if (!createdTask || !contact?.email) return;

    setIsSendingEmail(true);
    try {
      await sendTaskEmail(contactId, createdTask.id);
      toast({
        title: t.common.success,
        description: t.taskDialog?.emailSent || 'Task sent via email',
        variant: 'success',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: t.common.error,
        description: t.taskDialog?.emailFailed || 'Failed to send email',
        variant: 'error',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Skip sending and close
  const handleSkipSend = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {showSendOptions ? (
          // Send options view after task creation
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                {t.taskDialog?.taskCreated || 'Task Created!'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <p className="text-th-text-t text-sm">
                {t.taskDialog?.sendTaskTo || 'Send task to'} {contact?.fullName}?
              </p>

              <div className="flex gap-3">
                {/* WhatsApp Button */}
                {contact?.phone && contact.phone.trim().length > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleSendWhatsApp}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </Button>
                )}

                {/* Email Button */}
                {contact?.email && contact.email.trim().length > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleSendEmail}
                    loading={isSendingEmail}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    Email
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={handleSkipSend}
                className="w-full py-2.5 text-th-text-t hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors"
              >
                {t.taskDialog?.skipAndClose || 'Skip & Close'}
              </button>
            </DialogFooter>
          </>
        ) : (
          // Task form view
          <>
            <DialogHeader>
              <DialogTitle>
                {isEditing ? (t.taskDialog?.editTitle || 'Edit Task') : (t.taskDialog?.createTitle || 'Add Task')}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-th-text-t mb-1">
                  {t.taskDialog?.title || 'Title'} *
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.taskDialog?.titlePlaceholder || 'Enter task title'}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-th-text-t mb-1">
                  {t.taskDialog?.notes || 'Notes'}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.taskDialog?.notesPlaceholder || 'Add notes...'}
                  rows={2}
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

              {/* Due Date & Time */}
              <DateTimePicker
                date={dueDate}
                time={dueTime}
                onDateChange={setDueDate}
                onTimeChange={setDueTime}
                dateLabel={t.taskDialog?.dueDate || 'Due Date'}
                timeLabel={t.taskDialog?.dueTime || 'Time'}
              />

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-th-text-t mb-2">
                  {t.taskDialog?.priority || 'Priority'}
                </label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium text-th-text transition-colors ${
                        priority === p
                          ? getPriorityColor(p)
                          : 'bg-th-surface-h hover:bg-th-surface-h'
                      }`}
                    >
                      {t.taskDialog?.priorities?.[p.toLowerCase() as keyof typeof t.taskDialog.priorities] || p}
                    </button>
                  ))}
                </div>
              </div>

              {isEditing && onDelete && showDeleteConfirm && (
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <span className="text-sm text-red-400 flex-1">Are you sure you want to delete this task?</span>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={async () => {
                      setIsDeleting(true);
                      await onDelete(task!.id);
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
                  {isEditing ? (t.common.save) : (t.taskDialog?.create || 'Create Task')}
                </button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TaskDialog;
