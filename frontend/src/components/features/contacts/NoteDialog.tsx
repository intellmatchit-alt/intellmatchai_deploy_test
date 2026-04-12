'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n/Provider';
import { toast } from '@/components/ui/Toast';
import { api, getAccessToken } from '@/lib/api/client';
import {
  Mic24Regular,
  Image24Regular,
  Document24Regular,
  Stop24Regular,
  Play24Regular,
  Pause24Regular,
  Delete24Regular,
  Attach24Regular,
  Add24Regular,
  Info16Regular,
} from '@fluentui/react-icons';

interface ContactNote {
  id: string;
  type: 'TEXT' | 'IMAGE' | 'VOICE' | 'FILE';
  content?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  duration?: number;
  createdAt: string;
}

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  onSuccess: (note: ContactNote) => void;
}

interface ImageAttachment {
  id: string;
  file: File;
  preview: string;
}

interface FileAttachment {
  id: string;
  file: File;
}

interface VoiceAttachment {
  id: string;
  blob: Blob;
  duration: number;
}

export function NoteDialog({
  open,
  onOpenChange,
  contactId,
  onSuccess,
}: NoteDialogProps) {
  const { t } = useI18n();

  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; percent: number } | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceAttachments, setVoiceAttachments] = useState<VoiceAttachment[]>([]);
  const [currentRecordingDuration, setCurrentRecordingDuration] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef<number>(0);

  // Image state
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle dialog open/close - prevent close while recording
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && isRecording) {
      // Don't allow closing while recording - stop first
      toast({
        title: 'Recording in progress',
        description: 'Please stop the recording before closing',
        variant: 'error',
      });
      return;
    }
    if (!newOpen) {
      // Clean up audio playback on close
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingVoiceId(null);
    }
    onOpenChange(newOpen);
  }, [isRecording, onOpenChange]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setContent('');
      setVoiceAttachments([]);
      setImageAttachments([]);
      setFileAttachments([]);
      setCurrentRecordingDuration(0);
      setUploadProgress(null);
      durationRef.current = 0;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [open]);

  // Cleanup recording resources
  const cleanupRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setCurrentRecordingDuration(0);
    durationRef.current = 0;
  }, []);

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      durationRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedMime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: recordedMime });
        if (blob.size > 0 && durationRef.current > 0) {
          const newVoice: VoiceAttachment = {
            id: Date.now().toString(),
            blob,
            duration: durationRef.current,
          };
          setVoiceAttachments(prev => [...prev, newVoice]);
        }
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setCurrentRecordingDuration(0);
        durationRef.current = 0;
      };

      mediaRecorder.start(1000); // Collect data every second for reliability
      setIsRecording(true);
      setCurrentRecordingDuration(0);

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setCurrentRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      cleanupRecording();
      toast({
        title: t.common?.error || 'Error',
        description: 'Could not access microphone',
        variant: 'error',
      });
    }
  };

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const playVoice = (voice: VoiceAttachment) => {
    if (playingVoiceId === voice.id) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingVoiceId(null);
    } else {
      // Start playing
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const url = URL.createObjectURL(voice.blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingVoiceId(null);
      audio.play();
      setPlayingVoiceId(voice.id);
    }
  };

  const removeVoice = (id: string) => {
    setVoiceAttachments(prev => prev.filter(v => v.id !== id));
    if (playingVoiceId === id && audioRef.current) {
      audioRef.current.pause();
      setPlayingVoiceId(null);
    }
  };

  // Image functions
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const newImage: ImageAttachment = {
            id: Date.now().toString() + Math.random(),
            file,
            preview: reader.result as string,
          };
          setImageAttachments(prev => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const removeImage = (id: string) => {
    setImageAttachments(prev => prev.filter(img => img.id !== id));
  };

  // File functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const newFile: FileAttachment = {
          id: Date.now().toString() + Math.random(),
          file,
        };
        setFileAttachments(prev => [...prev, newFile]);
      });
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFileAttachments(prev => prev.filter(f => f.id !== id));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PPT';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'XLS';
    return 'FILE';
  };

  // Upload with progress tracking
  const uploadWithProgress = (url: string, formData: FormData): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => prev ? { ...prev, percent } : { current: 1, total: 1, percent });
        }
      });

      xhr.addEventListener('load', () => {
        const response = new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
        });
        resolve(response);
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.open('POST', url);
      const token = getAccessToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasContent = content.trim().length > 0;
    const hasVoice = voiceAttachments.length > 0;
    const hasImages = imageAttachments.length > 0;
    const hasFiles = fileAttachments.length > 0;

    if (!hasContent && !hasVoice && !hasImages && !hasFiles) {
      toast({
        title: t.common?.error || 'Error',
        description: 'Please add some content or attachments',
        variant: 'error',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const createdNotes: ContactNote[] = [];
      const textContent = content.trim();

      // Calculate total uploads for progress tracking
      const totalUploads = voiceAttachments.length + imageAttachments.length + fileAttachments.length;
      let currentUpload = 0;

      // Upload text note if there's content and no attachments
      if (hasContent && !hasVoice && !hasImages && !hasFiles) {
        const note = await api.post<ContactNote>(`/contacts/${contactId}/notes`, {
          type: 'TEXT',
          content: textContent,
        });
        createdNotes.push(note);
      }

      // Upload voice notes with progress
      for (const voice of voiceAttachments) {
        currentUpload++;
        setUploadProgress({ current: currentUpload, total: totalUploads, percent: 0 });

        const voiceMime = voice.blob.type || 'audio/webm';
        const voiceExt = voiceMime.includes('mp4') ? 'mp4' : 'webm';
        const formData = new FormData();
        formData.append('voice', voice.blob, `voice-note.${voiceExt}`);
        formData.append('duration', voice.duration.toString());

        const response = await uploadWithProgress(
          `${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/notes/voice`,
          formData
        );

        if (!response.ok) throw new Error('Failed to upload voice note');
        const result = await response.json();
        createdNotes.push(result.data);
      }

      // Upload image notes with progress
      for (const image of imageAttachments) {
        currentUpload++;
        setUploadProgress({ current: currentUpload, total: totalUploads, percent: 0 });

        const formData = new FormData();
        formData.append('image', image.file);
        if (textContent) {
          formData.append('content', textContent);
        }

        const response = await uploadWithProgress(
          `${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/notes/image`,
          formData
        );

        if (!response.ok) throw new Error('Failed to upload image note');
        const result = await response.json();
        createdNotes.push(result.data);
      }

      // Upload file notes with progress
      for (const file of fileAttachments) {
        currentUpload++;
        setUploadProgress({ current: currentUpload, total: totalUploads, percent: 0 });

        const formData = new FormData();
        formData.append('file', file.file);
        if (textContent) {
          formData.append('content', textContent);
        }

        const response = await uploadWithProgress(
          `${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/notes/file`,
          formData
        );

        if (!response.ok) throw new Error('Failed to upload file note');
        const result = await response.json();
        createdNotes.push(result.data);
      }

      setUploadProgress(null);

      // If there's text content with attachments, also create a text note
      if (hasContent && (hasVoice || hasImages || hasFiles)) {
        const note = await api.post<ContactNote>(`/contacts/${contactId}/notes`, {
          type: 'TEXT',
          content: textContent,
        });
        createdNotes.push(note);
      }

      toast({
        title: t.common?.success || 'Success',
        description: `${createdNotes.length} note(s) added`,
        variant: 'success',
      });

      // Call onSuccess for each created note
      createdNotes.forEach(note => onSuccess(note));
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        title: t.common?.error || 'Error',
        description: t.noteDialog?.saveFailed || 'Failed to save note',
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAttachments = voiceAttachments.length + imageAttachments.length + fileAttachments.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t.noteDialog?.title || 'Add Note'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Text Content - Always visible */}
          <div>
            <label className="block text-sm font-medium text-th-text-t mb-1">
              {t.noteDialog?.content || 'Note'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.noteDialog?.placeholder || 'Write your note here...'}
              rows={4}
              className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder:text-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Attachment Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-th-text-t">Attach:</span>

            {/* Voice Record Button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isRecording
                  ? 'bg-red-500/30 border border-red-500/50 text-red-300 animate-pulse'
                  : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
              }`}
            >
              {isRecording ? (
                <>
                  <Stop24Regular className="w-4 h-4" />
                  {formatDuration(currentRecordingDuration)}
                </>
              ) : (
                <>
                  <Mic24Regular className="w-4 h-4" />
                  Voice
                </>
              )}
            </button>

            {/* Image Button */}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              ref={imageInputRef}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-th-surface border border-th-border rounded-lg text-sm text-th-text-s hover:bg-th-surface-h transition-colors"
            >
              <Image24Regular className="w-4 h-4" />
              Image
            </button>

            {/* File Button */}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv"
              multiple
              onChange={handleFileSelect}
              ref={fileInputRef}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-th-surface border border-th-border rounded-lg text-sm text-th-text-s hover:bg-th-surface-h transition-colors"
            >
              <Attach24Regular className="w-4 h-4" />
              File
            </button>
          </div>

          {/* Upload Limitations Info */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-th-surface/50 border border-th-border/50 rounded-lg">
            <Info16Regular className="w-4 h-4 text-th-text-m mt-0.5 flex-shrink-0" />
            <div className="text-xs text-th-text-m space-y-0.5">
              <p><span className="text-th-text-s font-medium">Images:</span> Max 5 MB per file (JPG, PNG, GIF, WebP)</p>
              <p><span className="text-th-text-s font-medium">Voice:</span> Max 10 MB per recording</p>
              <p><span className="text-th-text-s font-medium">Files:</span> Max 20 MB per file (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, CSV)</p>
            </div>
          </div>

          {/* Voice Attachments */}
          {voiceAttachments.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-th-text-t">
                Voice Notes ({voiceAttachments.length})
              </label>
              {voiceAttachments.map((voice) => (
                <div
                  key={voice.id}
                  className="flex items-center gap-3 p-3 bg-th-surface border border-th-border rounded-lg"
                >
                  <button
                    type="button"
                    onClick={() => playVoice(voice)}
                    className="w-10 h-10 rounded-full bg-emerald-500/30 hover:bg-emerald-500/40 flex items-center justify-center transition-colors"
                  >
                    {playingVoiceId === voice.id ? (
                      <Pause24Regular className="w-5 h-5 text-emerald-300" />
                    ) : (
                      <Play24Regular className="w-5 h-5 text-emerald-300" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm text-th-text">Voice Note</p>
                    <p className="text-xs text-th-text-m">{formatDuration(voice.duration)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVoice(voice.id)}
                    className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                  >
                    <Delete24Regular className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Image Attachments */}
          {imageAttachments.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-th-text-t">
                Images ({imageAttachments.length})
              </label>
              <div className="grid grid-cols-3 gap-2">
                {imageAttachments.map((image) => (
                  <div key={image.id} className="relative group">
                    <img
                      src={image.preview}
                      alt="Preview"
                      className="w-full h-24 object-cover rounded-lg bg-black/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Delete24Regular className="w-3 h-3 text-th-text" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Attachments */}
          {fileAttachments.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-th-text-t">
                Files ({fileAttachments.length})
              </label>
              {fileAttachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 bg-th-surface border border-th-border rounded-lg"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-emerald-300">
                      {getFileIcon(file.file.type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-th-text truncate">{file.file.name}</p>
                    <p className="text-xs text-th-text-m">
                      {(file.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center flex-shrink-0 transition-colors"
                  >
                    <Delete24Regular className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="flex-col gap-2">
            {uploadProgress && (
              <div className="w-full flex flex-col items-center gap-1 py-2">
                <div className="flex items-center gap-2 text-sm text-th-text-s">
                  <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                  <span>{t.mediaNotes?.uploading || 'Uploading'} {uploadProgress.current}/{uploadProgress.total}</span>
                </div>
                <div className="w-full h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress.percent}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2 w-full justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting || isRecording}
                className="text-th-text-t hover:text-th-text hover:bg-th-surface-h"
              >
                {t.common?.cancel || 'Cancel'}
              </Button>
              <button
                type="submit"
                disabled={isSubmitting || isRecording}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-emerald-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && !uploadProgress && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {t.noteDialog?.add || 'Add Note'}
                {totalAttachments > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-th-surface-h rounded text-xs">
                    +{totalAttachments}
                  </span>
                )}
              </button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NoteDialog;
