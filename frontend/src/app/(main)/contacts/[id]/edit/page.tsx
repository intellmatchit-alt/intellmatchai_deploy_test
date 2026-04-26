/**
 * Edit Contact Page
 *
 * Edit existing contact information.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/Toast';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useDetectedCountry } from '@/hooks/useDetectedCountry';
import { getAccessToken } from '@/lib/api/client';
import {
  getContact, updateContact,
  getContactTasks, createContactTask, updateContactTask, deleteContactTask,
  getContactReminders, createContactReminder, updateContactReminder, deleteContactReminder,
  type ContactTask, type ContactReminder, type TaskPriority, type TaskStatus,
} from '@/lib/api/contacts';
import { api } from '@/lib/api/client';
import {
  ArrowLeft24Regular,
  Person24Regular,
  Mail24Regular,
  Building24Regular,
  Briefcase24Regular,
  Location24Regular,
  Globe24Regular,
  Link24Regular,
  Checkmark24Regular,
  Add24Regular,
  Dismiss24Regular,
  DocumentText24Regular,
  Save24Regular,
  Clock24Regular,
  TaskListSquareAdd24Regular,
  Mic24Regular,
  MicOff24Regular,
  Delete24Regular,
  Calendar24Regular,
  Play24Regular,
  Pause24Regular,
  CheckmarkCircle24Regular,
  FullScreenMaximize24Regular,
  Note24Regular,
  Image24Regular,
  Document24Regular,
} from '@fluentui/react-icons';
import { NoteDialog } from '@/components/features/contacts/NoteDialog';

interface Sector { id: string; name: string; nameAr?: string; }
interface Skill { id: string; name: string; nameAr?: string; }
interface Hobby { id: string; name: string; nameAr?: string; }

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

/**
 * Bio Preview Dialog - Full screen bio editor with tabs
 */
function BioPreviewDialog({
  isOpen,
  onClose,
  bioSummary,
  bioFull,
  activeBioTab,
  onBioSummaryChange,
  onBioFullChange,
  onBioTabChange,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  bioSummary: string;
  bioFull: string;
  activeBioTab: 'summary' | 'full';
  onBioSummaryChange: (bio: string) => void;
  onBioFullChange: (bio: string) => void;
  onBioTabChange: (tab: 'summary' | 'full') => void;
  t: any;
}) {
  const [localSummary, setLocalSummary] = useState(bioSummary);
  const [localFull, setLocalFull] = useState(bioFull);
  const [localTab, setLocalTab] = useState(activeBioTab);

  useEffect(() => {
    setLocalSummary(bioSummary);
    setLocalFull(bioFull);
    setLocalTab(activeBioTab);
  }, [bioSummary, bioFull, activeBioTab]);

  const handleSave = () => {
    onBioSummaryChange(localSummary);
    onBioFullChange(localFull);
    onBioTabChange(localTab);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <div>
            <h3 className="text-lg font-semibold text-th-text">{t.contacts?.form?.bio || 'Bio / About'}</h3>
            <p className="text-sm text-th-text-t mt-0.5">{t.onboarding?.bioPreview?.subtitle || 'Write a compelling summary of this contact\'s background'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-th-text-t hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors">
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {/* Bio Tabs */}
          <div className="flex gap-1 mb-4 p-1 bg-th-surface rounded-lg">
            <button type="button" onClick={() => setLocalTab('summary')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${localTab === 'summary' ? 'bg-emerald-500 text-white' : 'text-th-text-t hover:text-white hover:bg-th-surface'}`}>
              {t.onboarding?.cvBio?.summarized || 'Summary'}
            </button>
            <button type="button" onClick={() => setLocalTab('full')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${localTab === 'full' ? 'bg-emerald-500 text-white' : 'text-th-text-t hover:text-white hover:bg-th-surface'}`}>
              {t.onboarding?.cvBio?.fullBio || 'Full Bio'}
            </button>
          </div>

          {localTab === 'summary' ? (
            <>
              <textarea value={localSummary} onChange={(e) => setLocalSummary(e.target.value)} placeholder={t.contacts?.form?.bioSummaryPlaceholder || 'Brief summary about this contact...'} rows={6} maxLength={500} className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-base leading-relaxed" autoFocus />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-th-text-m">{t.contacts?.form?.bioSummaryTip || 'Key highlights about this person'}</p>
                <p className={`text-xs ${localSummary.length > 450 ? 'text-yellow-400' : 'text-th-text-m'}`}>{localSummary.length}/500</p>
              </div>
            </>
          ) : (
            <>
              <textarea value={localFull} onChange={(e) => setLocalFull(e.target.value)} placeholder={t.contacts?.form?.bioFullPlaceholder || 'Detailed background, experience, and achievements...'} rows={12} maxLength={2000} className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-base leading-relaxed" autoFocus />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-th-text-m">{t.contacts?.form?.bioFullTip || 'Include detailed experience, education, and career highlights'}</p>
                <p className={`text-xs ${localFull.length > 1800 ? 'text-yellow-400' : 'text-th-text-m'}`}>{localFull.length}/2000</p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-th-border bg-th-surface">
          <button type="button" onClick={onClose} className="px-4 py-2 text-th-text-s hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors">
            {t.common?.cancel || 'Cancel'}
          </button>
          <button type="button" onClick={handleSave} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
            {t.common?.save || 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditContactPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;
  const detectedCountry = useDetectedCountry();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', company: '', jobTitle: '',
    website: '', linkedInUrl: '', location: '', notes: '', bio: '',
    bioSummary: '', bioFull: '',
    sectorIds: [] as string[], skillIds: [] as string[], interestIds: [] as string[], hobbyIds: [] as string[],
    customSectors: [] as string[], customSkills: [] as string[], customInterests: [] as string[], customHobbies: [] as string[],
  });
  const [activeBioTab, setActiveBioTab] = useState<'summary' | 'full'>('summary');

  // Custom input states
  const [newSector, setNewSector] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [newHobby, setNewHobby] = useState('');

  // Lookup data
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [interests, setInterests] = useState<Array<{ id: string; name: string; nameAr?: string }>>([]);
  const [hobbies, setHobbies] = useState<Hobby[]>([]);

  // Tasks and Reminders
  const [tasks, setTasks] = useState<ContactTask[]>([]);
  const [reminders, setReminders] = useState<ContactReminder[]>([]);
  const [newTask, setNewTask] = useState({ title: '', dueDate: '', reminderAt: '', priority: 'MEDIUM' as TaskPriority });
  const [newReminder, setNewReminder] = useState({ title: '', reminderAt: '' });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTaskId, setRecordingTaskId] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Bio dialog state
  const [isBioDialogOpen, setIsBioDialogOpen] = useState(false);

  // Media notes state
  const [contactNotes, setContactNotes] = useState<ContactNote[]>([]);
  const [showNoteDialog, setShowNoteDialog] = useState(false);

  // Fetch contact data
  useEffect(() => {
    const fetchContact = async () => {
      try {
        setIsFetching(true);
        const [contact, contactTasks, contactReminders, notesData] = await Promise.all([
          getContact(contactId),
          getContactTasks(contactId).catch(() => []),
          getContactReminders(contactId, true).catch(() => []),
          api.get<ContactNote[]>(`/contacts/${contactId}/notes`).catch(() => []),
        ]);

        setContactNotes(notesData || []);

        // Pre-populate form with existing data
        setFormData({
          fullName: contact.name || '',
          email: contact.email || '',
          phone: contact.phone || '',
          company: contact.company || '',
          jobTitle: contact.jobTitle || '',
          website: contact.websiteUrl || '',
          linkedInUrl: contact.linkedInUrl || '',
          location: contact.location || '',
          notes: contact.notes || '',
          bio: contact.bio || '',
          bioSummary: contact.bioSummary || contact.bio || '',
          bioFull: contact.bioFull || '',
          sectorIds: contact.sectors?.map((s: any) => s.id) || [],
          skillIds: contact.skills?.map((s: any) => s.id) || [],
          interestIds: contact.interests?.map((i: any) => i.id) || [],
          hobbyIds: contact.hobbies?.map((h: any) => h.id) || [],
          customSectors: [],
          customSkills: [],
          customInterests: [],
          customHobbies: [],
        });

        setTasks(contactTasks);
        setReminders(contactReminders);
      } catch (error: any) {
        console.error('Error fetching contact:', error);
        toast({
          title: t.common?.error || 'Error',
          description: 'Failed to load contact',
          variant: 'error',
        });
        router.push('/contacts');
      } finally {
        setIsFetching(false);
      }
    };

    if (contactId) {
      fetchContact();
    }
  }, [contactId, router, t]);

  // Fetch lookup data
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const token = getAccessToken();
        const headers = { Authorization: `Bearer ${token}` };
        const baseUrl = process.env.NEXT_PUBLIC_API_URL;

        const [sectorsRes, skillsRes, interestsRes, hobbiesRes] = await Promise.all([
          fetch(`${baseUrl}/sectors`, { headers }),
          fetch(`${baseUrl}/skills`, { headers }),
          fetch(`${baseUrl}/interests`, { headers }),
          fetch(`${baseUrl}/hobbies`, { headers }).catch(() => null),
        ]);

        const [sectorsData, skillsData, interestsData] = await Promise.all([
          sectorsRes.json(),
          skillsRes.json(),
          interestsRes.json(),
        ]);

        if (sectorsData.success) setSectors(sectorsData.data || []);
        if (skillsData.success) setSkills(skillsData.data || []);
        if (interestsData.success) setInterests(interestsData.data || []);

        if (hobbiesRes) {
          const hobbiesData = await hobbiesRes.json();
          if (hobbiesData.success) setHobbies(hobbiesData.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch lookups:', error);
      }
    };
    fetchLookups();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleSector = (id: string) => {
    setFormData(prev => ({
      ...prev,
      sectorIds: prev.sectorIds.includes(id)
        ? prev.sectorIds.filter(s => s !== id)
        : [...prev.sectorIds, id],
    }));
  };

  const toggleSkill = (id: string) => {
    setFormData(prev => ({
      ...prev,
      skillIds: prev.skillIds.includes(id)
        ? prev.skillIds.filter(s => s !== id)
        : [...prev.skillIds, id],
    }));
  };

  // Custom input handlers
  const addCustomSector = () => {
    if (newSector.trim() && !formData.customSectors.includes(newSector.trim())) {
      setFormData(prev => ({
        ...prev,
        customSectors: [...prev.customSectors, newSector.trim()],
      }));
      setNewSector('');
    }
  };

  const removeCustomSector = (sector: string) => {
    setFormData(prev => ({
      ...prev,
      customSectors: prev.customSectors.filter(s => s !== sector),
    }));
  };

  const addCustomSkill = () => {
    if (newSkill.trim() && !formData.customSkills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        customSkills: [...prev.customSkills, newSkill.trim()],
      }));
      setNewSkill('');
    }
  };

  const removeCustomSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      customSkills: prev.customSkills.filter(s => s !== skill),
    }));
  };

  const toggleInterest = (id: string) => {
    setFormData(prev => ({
      ...prev,
      interestIds: prev.interestIds.includes(id)
        ? prev.interestIds.filter(i => i !== id)
        : [...prev.interestIds, id],
    }));
  };

  const addCustomInterest = () => {
    if (newInterest.trim() && !formData.customInterests.includes(newInterest.trim())) {
      setFormData(prev => ({
        ...prev,
        customInterests: [...prev.customInterests, newInterest.trim()],
      }));
      setNewInterest('');
    }
  };

  const removeCustomInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      customInterests: prev.customInterests.filter(i => i !== interest),
    }));
  };

  const toggleHobby = (id: string) => {
    setFormData(prev => ({
      ...prev,
      hobbyIds: prev.hobbyIds.includes(id)
        ? prev.hobbyIds.filter(h => h !== id)
        : [...prev.hobbyIds, id],
    }));
  };

  const addCustomHobby = () => {
    if (newHobby.trim() && !formData.customHobbies.includes(newHobby.trim())) {
      setFormData(prev => ({
        ...prev,
        customHobbies: [...prev.customHobbies, newHobby.trim()],
      }));
      setNewHobby('');
    }
  };

  const removeCustomHobby = (hobby: string) => {
    setFormData(prev => ({
      ...prev,
      customHobbies: prev.customHobbies.filter(h => h !== hobby),
    }));
  };

  // Task handlers
  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      const task = await createContactTask(contactId, {
        title: newTask.title.trim(),
        dueDate: newTask.dueDate || undefined,
        reminderAt: newTask.reminderAt || undefined,
        priority: newTask.priority,
      });
      setTasks(prev => [...prev, task]);
      setNewTask({ title: '', dueDate: '', reminderAt: '', priority: 'MEDIUM' });
      setShowTaskForm(false);
      toast({ title: 'Task Added', description: 'Task has been added', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add task', variant: 'error' });
    }
  };

  const handleToggleTaskStatus = async (task: ContactTask) => {
    try {
      const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      const updated = await updateContactTask(contactId, task.id, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update task', variant: 'error' });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteContactTask(contactId, taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast({ title: 'Task Deleted', description: 'Task has been deleted', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete task', variant: 'error' });
    }
  };

  // Voice recording handlers
  const startRecording = async (taskId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        // Upload voice note
        try {
          const formData = new FormData();
          formData.append('voice', audioBlob, 'voice-note.webm');
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/tasks/${taskId}/voice`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            setTasks(prev => prev.map(t => t.id === taskId ? data.data : t));
            toast({ title: 'Voice Note Added', variant: 'success' });
          }
        } catch {
          toast({ title: 'Error', description: 'Failed to upload voice note', variant: 'error' });
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecordingTaskId(taskId);
      setIsRecording(true);
    } catch {
      toast({ title: 'Error', description: 'Could not access microphone', variant: 'error' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setRecordingTaskId(null);
  };

  const playVoice = (taskId: string, url: string) => {
    if (playingAudio === taskId) {
      setPlayingAudio(null);
    } else {
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setPlayingAudio(taskId);
    }
  };

  // Reminder handlers
  const handleAddReminder = async () => {
    if (!newReminder.title.trim() || !newReminder.reminderAt) return;

    try {
      const reminder = await createContactReminder(contactId, {
        title: newReminder.title.trim(),
        reminderAt: newReminder.reminderAt,
      });
      setReminders(prev => [...prev, reminder]);
      setNewReminder({ title: '', reminderAt: '' });
      setShowReminderForm(false);
      toast({ title: 'Reminder Added', description: 'Reminder has been added', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add reminder', variant: 'error' });
    }
  };

  const handleToggleReminderStatus = async (reminder: ContactReminder) => {
    try {
      const updated = await updateContactReminder(contactId, reminder.id, { isCompleted: !reminder.isCompleted });
      setReminders(prev => prev.map(r => r.id === reminder.id ? updated : r));
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update reminder', variant: 'error' });
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await deleteContactReminder(contactId, reminderId);
      setReminders(prev => prev.filter(r => r.id !== reminderId));
      toast({ title: 'Reminder Deleted', description: 'Reminder has been deleted', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete reminder', variant: 'error' });
    }
  };

  // Note handlers
  const handleNoteSuccess = (note: ContactNote) => {
    setContactNotes(prev => [...prev, note]);
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.delete(`/contacts/${contactId}/notes/${noteId}`);
      setContactNotes(prev => prev.filter(n => n.id !== noteId));
      toast({ title: 'Note Deleted', description: 'Note has been deleted', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete note', variant: 'error' });
    }
  };

  // Priority color helper
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'LOW': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-white/[0.03]0/20 text-th-text-t border-neutral-500/30';
    }
  };

  const handleUpdateContact = async () => {
    if (!formData.fullName.trim()) {
      toast({ title: 'Name Required', description: 'Please enter a contact name', variant: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      await updateContact(contactId, {
        name: formData.fullName,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        company: formData.company || undefined,
        jobTitle: formData.jobTitle || undefined,
        websiteUrl: formData.website || undefined,
        linkedInUrl: formData.linkedInUrl || undefined,
        location: formData.location || undefined,
        bio: formData.bioSummary || formData.bio || undefined, // Use summary as main bio for backward compatibility
        bioSummary: formData.bioSummary || undefined,
        bioFull: formData.bioFull || undefined,
        notes: formData.notes || undefined,
        sectors: formData.sectorIds.map(id => ({ sectorId: id })),
        skills: formData.skillIds.map(id => ({ skillId: id })),
        interests: formData.interestIds.map(id => ({ interestId: id })),
        hobbies: formData.hobbyIds.map(id => ({ hobbyId: id })),
        customSectors: formData.customSectors,
        customSkills: formData.customSkills,
        customInterests: formData.customInterests,
        customHobbies: formData.customHobbies,
      });

      toast({
        title: t.contacts?.updated || 'Contact Updated',
        description: `${formData.fullName} has been updated`,
        variant: 'success',
      });

      router.push(`/contacts/${contactId}`);
    } catch (error: any) {
      console.error('Update contact error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to update contact', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50";
  const chipInputClass = "flex-1 min-w-[120px] px-3 py-2 bg-transparent text-th-text placeholder-th-text-m focus:outline-none text-sm";

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.contacts?.editContact || 'Edit Contact'}</h1>
      </div>

      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-2xl p-6 space-y-5">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-2">{t.contacts?.form?.name || 'Full Name'} *</label>
          <div className="relative">
            <Person24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
            <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="John Doe" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">{t.contacts?.form?.email || 'Email'}</label>
            <div className="relative">
              <Mail24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="email@example.com" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">{t.contacts?.form?.phone || 'Phone'}</label>
            <PhoneInput
              value={formData.phone}
              onChange={(phone) => setFormData(prev => ({ ...prev, phone }))}
              placeholder="50 123 4567"
              defaultCountry={detectedCountry}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">{t.contacts?.form?.company || 'Company'}</label>
            <div className="relative">
              <Building24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input type="text" name="company" value={formData.company} onChange={handleInputChange} placeholder="Company Inc." className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">{t.contacts?.form?.jobTitle || 'Job Title'}</label>
            <div className="relative">
              <Briefcase24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} placeholder="CEO" className={inputClass} />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-th-text-s mb-2">{t.contacts?.form?.location || 'Location'}</label>
          <div className="relative">
            <Location24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
            <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="New York, USA" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">{t.contacts?.form?.website || 'Website'}</label>
            <div className="relative">
              <Globe24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input type="url" name="website" value={formData.website} onChange={handleInputChange} placeholder="example.com" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">LinkedIn</label>
            <div className="relative">
              <Link24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input type="url" name="linkedInUrl" value={formData.linkedInUrl} onChange={handleInputChange} placeholder="linkedin.com/in/..." className={inputClass} />
            </div>
          </div>
        </div>

        {/* Bio with Tabs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-th-text-s">
              <DocumentText24Regular className="w-4 h-4" />
              Bio / About
            </label>
            <button
              type="button"
              onClick={() => setIsBioDialogOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
            >
              <FullScreenMaximize24Regular className="w-4 h-4" />
              {t.onboarding?.bioPreview?.expand || 'Expand'}
            </button>
          </div>

          {/* Bio Tabs */}
          <div className="flex gap-1 mb-3 p-1 bg-th-surface rounded-lg">
            <button type="button" onClick={() => setActiveBioTab('summary')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeBioTab === 'summary' ? 'bg-emerald-500 text-white' : 'text-th-text-t hover:text-white hover:bg-th-surface'}`}>
              {t.onboarding?.cvBio?.summarized || 'Summary'}
            </button>
            <button type="button" onClick={() => setActiveBioTab('full')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeBioTab === 'full' ? 'bg-emerald-500 text-white' : 'text-th-text-t hover:text-white hover:bg-th-surface'}`}>
              {t.onboarding?.cvBio?.fullBio || 'Full Bio'}
            </button>
          </div>

          {activeBioTab === 'summary' ? (
            <>
              <textarea name="bioSummary" value={formData.bioSummary} onChange={handleInputChange} placeholder={t.contacts?.form?.bioSummaryPlaceholder || 'Brief summary about this contact...'} rows={4} maxLength={500} className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none" />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-th-text-m">{t.contacts?.form?.bioSummaryTip || 'Key highlights'}</span>
                <span className={`text-xs ${formData.bioSummary.length > 450 ? 'text-yellow-400' : 'text-th-text-m'}`}>{formData.bioSummary.length}/500</span>
              </div>
            </>
          ) : (
            <>
              <textarea name="bioFull" value={formData.bioFull} onChange={handleInputChange} placeholder={t.contacts?.form?.bioFullPlaceholder || 'Detailed background, experience, and achievements...'} rows={8} maxLength={2000} className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none" />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-th-text-m">{t.contacts?.form?.bioFullTip || 'Complete details'}</span>
                <span className={`text-xs ${formData.bioFull.length > 1800 ? 'text-yellow-400' : 'text-th-text-m'}`}>{formData.bioFull.length}/2000</span>
              </div>
            </>
          )}
        </div>

        {/* Bio Preview Dialog */}
        <BioPreviewDialog
          isOpen={isBioDialogOpen}
          onClose={() => setIsBioDialogOpen(false)}
          bioSummary={formData.bioSummary}
          bioFull={formData.bioFull}
          activeBioTab={activeBioTab}
          onBioSummaryChange={(bio) => setFormData(prev => ({ ...prev, bioSummary: bio }))}
          onBioFullChange={(bio) => setFormData(prev => ({ ...prev, bioFull: bio }))}
          onBioTabChange={setActiveBioTab}
          t={t}
        />

        {/* Sectors */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-3">{t.contacts?.form?.sectors || 'Sectors'}</label>

          {/* Custom input */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center bg-th-surface border border-th-border rounded-xl overflow-hidden">
              <input
                type="text"
                value={newSector}
                onChange={(e) => setNewSector(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSector())}
                placeholder="Add custom sector..."
                className={chipInputClass}
              />
              <button onClick={addCustomSector} className="p-2 hover:bg-th-surface-h transition-colors">
                <Add24Regular className="w-5 h-5 text-th-text-t" />
              </button>
            </div>
          </div>

          {/* Custom sectors */}
          {formData.customSectors.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.customSectors.map((sector, idx) => (
                <span key={`custom-${idx}`} className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full text-sm font-medium flex items-center gap-1">
                  {sector}
                  <button onClick={() => removeCustomSector(sector)} className="hover:bg-th-surface-h rounded-full p-0.5">
                    <Dismiss24Regular className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Predefined sectors */}
          {sectors.length > 0 && (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
              {sectors.map((sector) => {
                const isSelected = formData.sectorIds.includes(sector.id);
                return (
                  <div key={sector.id} className="relative">
                    <button type="button" onClick={() => toggleSector(sector.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isSelected
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white pe-7'
                        : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'}`}>
                      {lang === 'ar' && sector.nameAr ? sector.nameAr : sector.name}
                    </button>
                    {isSelected && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleSector(sector.id); }}
                        className="absolute top-1/2 -translate-y-1/2 end-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all">
                        <Dismiss24Regular className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Skills */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-3">{t.contacts?.form?.skills || 'Skills'}</label>

          {/* Custom input */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center bg-th-surface border border-th-border rounded-xl overflow-hidden">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
                placeholder="Add custom skill..."
                className={chipInputClass}
              />
              <button onClick={addCustomSkill} className="p-2 hover:bg-th-surface-h transition-colors">
                <Add24Regular className="w-5 h-5 text-th-text-t" />
              </button>
            </div>
          </div>

          {/* Custom skills */}
          {formData.customSkills.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.customSkills.map((skill, idx) => (
                <span key={`custom-${idx}`} className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full text-sm font-medium flex items-center gap-1">
                  {skill}
                  <button onClick={() => removeCustomSkill(skill)} className="hover:bg-th-surface-h rounded-full p-0.5">
                    <Dismiss24Regular className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Predefined skills */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto scrollbar-purple p-1">
              {skills.map((skill) => {
                const isSelected = formData.skillIds.includes(skill.id);
                return (
                  <div key={skill.id} className="relative">
                    <button type="button" onClick={() => toggleSkill(skill.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isSelected
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white pe-6'
                        : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'}`}>
                      {lang === 'ar' && skill.nameAr ? skill.nameAr : skill.name}
                    </button>
                    {isSelected && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleSkill(skill.id); }}
                        className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all">
                        <Dismiss24Regular className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Interests with Custom Input */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-3">
            {t.contacts?.form?.interests || 'Interests'}
            {formData.interestIds.length > 0 && <span className="text-xs text-yellow-400 ms-2">({formData.interestIds.length})</span>}
          </label>

          {/* Custom input */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center bg-th-surface border border-th-border rounded-xl overflow-hidden">
              <input
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomInterest())}
                placeholder="Add custom interest..."
                className="flex-1 px-4 py-2 bg-transparent text-th-text placeholder-th-text-m focus:outline-none"
              />
              <button type="button" onClick={addCustomInterest} className="p-2 hover:bg-th-surface-h transition-colors">
                <Add24Regular className="w-5 h-5 text-th-text-t" />
              </button>
            </div>
          </div>

          {/* Custom interests */}
          {formData.customInterests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.customInterests.map((interest) => (
                <div key={interest} className="relative">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-500 to-cyan-500 text-white pe-6">
                    {interest}
                  </span>
                  <button type="button" onClick={() => removeCustomInterest(interest)}
                    className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all">
                    <Dismiss24Regular className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Predefined interests */}
          {interests.length > 0 && (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto scrollbar-purple p-1">
              {interests.map((interest) => {
                const isSelected = formData.interestIds.includes(interest.id);
                return (
                  <div key={interest.id} className="relative">
                    <button type="button" onClick={() => toggleInterest(interest.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isSelected
                        ? 'bg-gradient-to-r from-yellow-500 to-cyan-500 text-white pe-6'
                        : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'}`}>
                      {lang === 'ar' && interest.nameAr ? interest.nameAr : interest.name}
                    </button>
                    {isSelected && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleInterest(interest.id); }}
                        className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all">
                        <Dismiss24Regular className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hobbies with Custom Input */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-3">
            Hobbies
            {formData.hobbyIds.length > 0 && <span className="text-xs text-red-400 ms-2">({formData.hobbyIds.length})</span>}
          </label>

          {/* Custom input */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center bg-th-surface border border-th-border rounded-xl overflow-hidden">
              <input
                type="text"
                value={newHobby}
                onChange={(e) => setNewHobby(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomHobby())}
                placeholder="Add custom hobby..."
                className="flex-1 px-4 py-2 bg-transparent text-th-text placeholder-th-text-m focus:outline-none"
              />
              <button type="button" onClick={addCustomHobby} className="p-2 hover:bg-th-surface-h transition-colors">
                <Add24Regular className="w-5 h-5 text-th-text-t" />
              </button>
            </div>
          </div>

          {/* Custom hobbies */}
          {formData.customHobbies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.customHobbies.map((hobby) => (
                <div key={hobby} className="relative">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-red-500 to-emerald-500 text-white pe-6">
                    {hobby}
                  </span>
                  <button type="button" onClick={() => removeCustomHobby(hobby)}
                    className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all">
                    <Dismiss24Regular className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Predefined hobbies */}
          {hobbies.length > 0 && (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto scrollbar-purple p-1">
              {hobbies.map((hobby) => {
                const isSelected = formData.hobbyIds.includes(hobby.id);
                return (
                  <div key={hobby.id} className="relative">
                    <button type="button" onClick={() => toggleHobby(hobby.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isSelected
                        ? 'bg-gradient-to-r from-red-500 to-emerald-500 text-white pe-6'
                        : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'}`}>
                      {lang === 'ar' && hobby.nameAr ? hobby.nameAr : hobby.name}
                    </button>
                    {isSelected && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleHobby(hobby.id); }}
                        className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all">
                        <Dismiss24Regular className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-2">{t.contacts?.form?.notes || 'Notes'}</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Add any notes..."
            rows={3}
            className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
          />
        </div>

        {/* Media Notes Section */}
        <div className="border-t border-th-border pt-5">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-medium text-th-text-s">
              <Note24Regular className="w-4 h-4 text-emerald-400" />
              {t.mediaNotes?.title || 'Media Notes'} ({contactNotes.length})
            </label>
            <button
              type="button"
              onClick={() => setShowNoteDialog(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-sm text-emerald-300 transition-colors"
            >
              <Add24Regular className="w-4 h-4" />
              {t.common?.add || 'Add'}
            </button>
          </div>

          {/* Notes List */}
          {contactNotes.length > 0 ? (
            <div className="space-y-2">
              {contactNotes.map((note) => (
                <div
                  key={note.id}
                  className="bg-th-surface border border-th-border rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {note.type === 'TEXT' && (
                        <p className="text-sm text-th-text">{note.content}</p>
                      )}
                      {note.type === 'VOICE' && note.mediaUrl && (
                        <div className="flex items-center gap-3">
                          <Mic24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          <audio controls className="flex-1 h-8">
                            <source src={note.mediaUrl} type={note.mimeType || 'audio/webm'} />
                          </audio>
                        </div>
                      )}
                      {note.type === 'IMAGE' && note.mediaUrl && (
                        <div>
                          <img src={note.mediaUrl} alt="Note" className="max-w-full max-h-48 rounded-lg object-contain" />
                          {note.content && <p className="text-sm text-th-text-s mt-2">{note.content}</p>}
                        </div>
                      )}
                      {note.type === 'FILE' && note.mediaUrl && (
                        <a
                          href={note.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2 bg-th-surface rounded-lg hover:bg-th-surface-h transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-emerald-300">
                              {note.mimeType?.includes('pdf') ? 'PDF' :
                               note.mimeType?.includes('word') || note.mimeType?.includes('document') ? 'DOC' :
                               note.mimeType?.includes('powerpoint') || note.mimeType?.includes('presentation') ? 'PPT' :
                               note.mimeType?.includes('excel') || note.mimeType?.includes('spreadsheet') ? 'XLS' : 'FILE'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-th-text truncate">{note.fileName || 'Download file'}</p>
                            {note.content && <p className="text-xs text-th-text-t truncate">{note.content}</p>}
                          </div>
                        </a>
                      )}
                      <p className="text-xs text-th-text-m mt-2">
                        {new Date(note.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 hover:bg-th-surface-h rounded-lg flex-shrink-0"
                    >
                      <Delete24Regular className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-th-text-m text-center py-4">
              {t.mediaNotes?.empty || 'No media notes. Add images, voice notes, or files.'}
            </p>
          )}
        </div>

        {/* Reminders Section */}
        <div className="border-t border-th-border pt-5">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-medium text-th-text-s">
              <Clock24Regular className="w-4 h-4 text-emerald-400" />
              Reminders ({reminders.filter(r => !r.isCompleted).length})
            </label>
            <button
              type="button"
              onClick={() => setShowReminderForm(!showReminderForm)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-sm text-emerald-300 transition-colors"
            >
              <Add24Regular className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Add Reminder Form */}
          {showReminderForm && (
            <div className="bg-th-surface border border-th-border rounded-xl p-4 mb-3 space-y-3">
              <input
                type="text"
                value={newReminder.title}
                onChange={(e) => setNewReminder(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Reminder title..."
                className="w-full px-4 py-2.5 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <div>
                <label className="block text-xs text-th-text-t mb-1">Remind at</label>
                <input
                  type="datetime-local"
                  value={newReminder.reminderAt}
                  onChange={(e) => setNewReminder(prev => ({ ...prev, reminderAt: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-th-surface border border-th-border rounded-lg text-th-text focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowReminderForm(false)} className="px-4 py-2 text-th-text-t hover:text-th-text">Cancel</button>
                <button type="button" onClick={handleAddReminder} disabled={!newReminder.title.trim() || !newReminder.reminderAt} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg">Add</button>
              </div>
            </div>
          )}

          {/* Reminders List */}
          {reminders.length > 0 && (
            <div className="space-y-2">
              {reminders.map((reminder) => (
                <div key={reminder.id} className={`flex items-center justify-between bg-th-surface border border-th-border rounded-lg p-3 ${reminder.isCompleted ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => handleToggleReminderStatus(reminder)} className={`p-1 rounded ${reminder.isCompleted ? 'text-green-400' : 'text-th-text-t hover:text-emerald-400'}`}>
                      <CheckmarkCircle24Regular className="w-5 h-5" />
                    </button>
                    <div>
                      <p className={`text-sm ${reminder.isCompleted ? 'line-through text-th-text-m' : 'text-th-text'}`}>{reminder.title}</p>
                      <p className="text-xs text-th-text-t">{new Date(reminder.reminderAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleDeleteReminder(reminder.id)} className="p-1.5 hover:bg-th-surface-h rounded-lg">
                    <Delete24Regular className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks Section */}
        <div className="border-t border-th-border pt-5">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-medium text-th-text-s">
              <TaskListSquareAdd24Regular className="w-4 h-4 text-cyan-400" />
              Tasks ({tasks.filter(t => t.status !== 'COMPLETED').length})
            </label>
            <button
              type="button"
              onClick={() => setShowTaskForm(!showTaskForm)}
              className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-sm text-cyan-300 transition-colors"
            >
              <Add24Regular className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Add Task Form */}
          {showTaskForm && (
            <div className="bg-th-surface border border-th-border rounded-xl p-4 mb-3 space-y-3">
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Task title..."
                className="w-full px-4 py-2.5 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-th-text-t mb-1">Due Date</label>
                  <input type="datetime-local" value={newTask.dueDate} onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-xs text-th-text-t mb-1">Reminder</label>
                  <input type="datetime-local" value={newTask.reminderAt} onChange={(e) => setNewTask(prev => ({ ...prev, reminderAt: e.target.value }))} className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-th-text-t mb-1">Priority</label>
                <div className="flex gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => (
                    <button key={priority} type="button" onClick={() => setNewTask(prev => ({ ...prev, priority }))}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${newTask.priority === priority ? getPriorityColor(priority) : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'}`}>
                      {priority}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowTaskForm(false)} className="px-4 py-2 text-th-text-t hover:text-th-text">Cancel</button>
                <button type="button" onClick={handleAddTask} disabled={!newTask.title.trim()} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-lg">Add</button>
              </div>
            </div>
          )}

          {/* Tasks List */}
          {tasks.length > 0 && (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className={`bg-th-surface border border-th-border rounded-lg p-3 ${task.status === 'COMPLETED' ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <button type="button" onClick={() => handleToggleTaskStatus(task)} className={`p-1 rounded mt-0.5 ${task.status === 'COMPLETED' ? 'text-green-400' : 'text-th-text-t hover:text-cyan-400'}`}>
                        <CheckmarkCircle24Regular className="w-5 h-5" />
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-sm ${task.status === 'COMPLETED' ? 'line-through text-th-text-m' : 'text-th-text'}`}>{task.title}</p>
                          <span className={`px-2 py-0.5 rounded text-xs border ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                        </div>
                        {task.dueDate && <p className="text-xs text-th-text-t flex items-center gap-1"><Calendar24Regular className="w-3 h-3" />Due: {new Date(task.dueDate).toLocaleString()}</p>}
                        {task.reminderAt && <p className="text-xs text-th-text-t flex items-center gap-1"><Clock24Regular className="w-3 h-3" />Reminder: {new Date(task.reminderAt).toLocaleString()}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!task.voiceNoteUrl ? (
                        <button type="button" onClick={() => isRecording && recordingTaskId === task.id ? stopRecording() : startRecording(task.id)}
                          className={`p-1.5 rounded-lg transition-colors ${isRecording && recordingTaskId === task.id ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-th-surface-h text-th-text-t'}`}>
                          {isRecording && recordingTaskId === task.id ? <MicOff24Regular className="w-4 h-4" /> : <Mic24Regular className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button type="button" onClick={() => playVoice(task.id, task.voiceNoteUrl!)} className="p-1.5 hover:bg-th-surface-h rounded-lg text-cyan-400">
                          {playingAudio === task.id ? <Pause24Regular className="w-4 h-4" /> : <Play24Regular className="w-4 h-4" />}
                        </button>
                      )}
                      <button type="button" onClick={() => handleDeleteTask(task.id)} className="p-1.5 hover:bg-th-surface-h rounded-lg">
                        <Delete24Regular className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                  {isRecording && recordingTaskId === task.id && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />Recording...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <button onClick={handleUpdateContact} disabled={isLoading || !formData.fullName.trim()} className="relative w-full group mt-4">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
          <span className="relative flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
            {isLoading ? (
              <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : (
              <><Save24Regular className="w-5 h-5" />{t.contacts?.form?.save || 'Save Changes'}</>
            )}
          </span>
        </button>

        {/* Cancel Button */}
        <button
          onClick={() => router.back()}
          className="w-full py-3 rounded-xl border border-th-border text-th-text-s hover:bg-th-surface transition-all"
        >
          {t.common?.cancel || 'Cancel'}
        </button>
      </div>

      {/* Note Dialog */}
      <NoteDialog
        open={showNoteDialog}
        onOpenChange={setShowNoteDialog}
        contactId={contactId}
        onSuccess={handleNoteSuccess}
      />
    </div>
  );
}
