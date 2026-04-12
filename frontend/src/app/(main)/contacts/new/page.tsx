/**
 * Add Contact Page
 *
 * Features:
 * - Manual contact entry
 * - Pre-fill from scanned business card
 * - Custom input for sectors, skills, interests
 * - AI-powered suggestions from scanned data
 * - Match score display after save
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/Toast";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { useDetectedCountry } from "@/hooks/useDetectedCountry";
import { api, getAccessToken } from "@/lib/api/client";
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
  Sparkle24Regular,
  Star24Filled,
  People24Regular,
  Trophy24Regular,
  Add24Regular,
  Dismiss24Regular,
  LightbulbFilament24Regular,
  DocumentText24Regular,
  ChartMultiple24Regular,
  Heart24Regular,
  Target24Regular,
  Handshake24Regular,
  Clock24Regular,
  TaskListSquareAdd24Regular,
  Mic24Regular,
  MicOff24Regular,
  Delete24Regular,
  Calendar24Regular,
  Play24Regular,
  Pause24Regular,
  Image24Regular,
  Camera24Regular,
  Stop24Regular,
  FullScreenMaximize24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  Attach24Regular,
  Document24Regular,
  Copy24Regular,
  PersonAvailable24Regular,
  Note24Regular,
  Wrench24Regular,
  BrainCircuit24Regular,
  Share24Regular,
  PeopleTeam24Regular,
  CalendarClock24Regular,
  DataUsage24Regular,
  Lightbulb24Regular,
  Info16Regular,
  Chat24Regular,
} from "@fluentui/react-icons";
import {
  AutocompleteTagInput,
  SECTOR_SUGGESTIONS,
  SKILL_SUGGESTIONS,
  INTEREST_SUGGESTIONS,
  HOBBY_SUGGESTIONS,
} from "@/components/ui/AutocompleteTagInput";
import { TaskDialog } from "@/components/features/contacts/TaskDialog";
import { ReminderDialog } from "@/components/features/contacts/ReminderDialog";
import { NoteDialog } from "@/components/features/contacts/NoteDialog";
import {
  getContactTasks,
  getContactReminders,
  ContactTask,
  ContactReminder,
} from "@/lib/api/contacts";

interface ContactNote {
  id: string;
  type: "TEXT" | "IMAGE" | "VOICE" | "FILE";
  content?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  duration?: number;
  createdAt: string;
}
import RadarChart from "@/components/RadarChart";

interface Sector {
  id: string;
  name: string;
  nameAr?: string;
}
interface Skill {
  id: string;
  name: string;
  nameAr?: string;
}
interface Interest {
  id: string;
  name: string;
  nameAr?: string;
}
interface Hobby {
  id: string;
  name: string;
  nameAr?: string;
}

interface MatchData {
  score: number;
  breakdown?: Record<string, number>;
  scoreBreakdown?: {
    goalAlignmentScore: number;
    sectorScore: number;
    skillScore: number;
    semanticSimilarityScore?: number;
    networkProximityScore?: number;
    complementarySkillsScore: number;
    recencyScore: number;
    interactionScore: number;
    interestScore: number;
    hobbyScore: number;
  };
  sharedAttributes?: string[];
  sharedSectors?: string[];
  sharedSkills?: string[];
  sharedInterests?: string[];
  sharedHobbies?: string[];
  intersections?: Array<{ type: string; label: string; strength: number }>;
  goalAlignment?: { matchedGoals: string[]; relevantTraits: string[] };
  reasons?: string[];
  suggestedMessage?: string;
  networkDegree?: number;
}

interface AISuggestions {
  sectors: string[];
  skills: string[];
  interests: string[];
  hobbies?: string[];
  bio: string;
}

interface TaskAttachment {
  id: string;
  file: File;
  previewUrl: string;
  type: "image" | "file";
}

interface PendingTask {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  reminderAt?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  voiceBlob?: Blob;
  voiceUrl?: string;
  attachments?: TaskAttachment[];
}

interface PendingReminder {
  id: string;
  title: string;
  description?: string;
  reminderAt: string;
  attachments?: TaskAttachment[];
}

interface PendingMediaNote {
  id: string;
  type: "IMAGE" | "VOICE";
  blob?: Blob;
  previewUrl?: string;
  mimeType?: string;
  fileName?: string;
  duration?: number; // For voice notes
}

/**
 * Bio Preview Dialog - Full screen bio editor with tabs for summary and full bio
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
  activeBioTab: "summary" | "full";
  onBioSummaryChange: (bio: string) => void;
  onBioFullChange: (bio: string) => void;
  onBioTabChange: (tab: "summary" | "full") => void;
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <div>
            <h3 className="text-lg font-semibold text-th-text">
              {t.contacts?.form?.bio || "Bio / About"}
            </h3>
            <p className="text-sm text-th-text-t mt-0.5">
              {t.onboarding?.bioPreview?.subtitle ||
                "Write a compelling summary of this contact's background"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-th-text-t hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors"
          >
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Bio Tabs */}
          <div className="flex gap-1 mb-4 p-1 bg-th-surface rounded-lg">
            <button
              type="button"
              onClick={() => setLocalTab("summary")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                localTab === "summary"
                  ? "bg-emerald-500 text-white"
                  : "text-th-text-t hover:text-th-text hover:bg-th-surface"
              }`}
            >
              {t.onboarding?.cvBio?.summarized || "Summary"}
            </button>
            <button
              type="button"
              onClick={() => setLocalTab("full")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                localTab === "full"
                  ? "bg-emerald-500 text-white"
                  : "text-th-text-t hover:text-th-text hover:bg-th-surface"
              }`}
            >
              {t.onboarding?.cvBio?.fullBio || "Full Bio"}
            </button>
          </div>

          {localTab === "summary" ? (
            <>
              <textarea
                value={localSummary}
                onChange={(e) => setLocalSummary(e.target.value)}
                placeholder={
                  t.contacts?.form?.bioSummaryPlaceholder ||
                  "Brief summary about this contact..."
                }
                rows={6}
                maxLength={500}
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-base leading-relaxed"
                autoFocus
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-th-text-m">
                  {t.contacts?.form?.bioSummaryTip ||
                    "Key highlights about this person"}
                </p>
                <p
                  className={`text-xs ${localSummary.length > 450 ? "text-yellow-400" : "text-th-text-m"}`}
                >
                  {localSummary.length}/500
                </p>
              </div>
            </>
          ) : (
            <>
              <textarea
                value={localFull}
                onChange={(e) => setLocalFull(e.target.value)}
                placeholder={
                  t.contacts?.form?.bioFullPlaceholder ||
                  "Detailed background, experience, and achievements..."
                }
                rows={12}
                maxLength={2000}
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-base leading-relaxed"
                autoFocus
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-th-text-m">
                  {t.contacts?.form?.bioFullTip ||
                    "Include detailed experience, education, and career highlights"}
                </p>
                <p
                  className={`text-xs ${localFull.length > 1800 ? "text-yellow-400" : "text-th-text-m"}`}
                >
                  {localFull.length}/2000
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-th-border bg-th-surface">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-th-text-s hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors"
          >
            {t.common?.cancel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
          >
            {t.common?.save || "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AddContactPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const detectedCountry = useDetectedCountry();
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isFromScan, setIsFromScan] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    jobTitle: "",
    website: "",
    linkedInUrl: "",
    location: "",
    notes: "",
    bio: "",
    bioSummary: "",
    bioFull: "",
    sectorIds: [] as string[],
    skillIds: [] as string[],
    interestIds: [] as string[],
    hobbyIds: [] as string[],
    customSectors: [] as string[],
    customSkills: [] as string[],
    customInterests: [] as string[],
    customHobbies: [] as string[],
  });
  const [activeBioTab, setActiveBioTab] = useState<"summary" | "full">(
    "summary",
  );

  // Custom input states
  const [newSector, setNewSector] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [newInterest, setNewInterest] = useState("");
  const [newHobby, setNewHobby] = useState("");

  // Lookup data
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [hobbies, setHobbies] = useState<Hobby[]>([]);

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(
    null,
  );

  // Enrichment data (from ScrapIn)
  const [enrichmentData, setEnrichmentData] = useState<{
    experience?: Array<{
      company?: string;
      title?: string;
      startDate?: string;
      endDate?: string;
      isCurrent?: boolean;
      description?: string;
    }>;
    education?: Array<{
      school?: string;
      degree?: string;
      field?: string;
      startYear?: number;
      endYear?: number;
    }>;
    pictureUrl?: string;
    iceBreakers?: string[];
    employmentVerification?: {
      status: "CURRENT" | "CHANGED" | "UNKNOWN" | "UNVERIFIED";
      cardData?: { company?: string; jobTitle?: string };
      verifiedData?: { company?: string; jobTitle?: string; source: string };
      changeDetails?: {
        previousCompany?: string;
        newCompany?: string;
        previousTitle?: string;
        newTitle?: string;
      };
      confidence: {
        overall: number;
        level: "HIGH" | "MEDIUM" | "LOW";
        reasons: string[];
      };
    };
    warnings?: string[];
  } | null>(null);

  // Success state
  const [savedContact, setSavedContact] = useState<any>(null);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Post-save tasks and reminders (same as contact detail page)
  const [savedTasks, setSavedTasks] = useState<ContactTask[]>([]);
  const [savedReminders, setSavedReminders] = useState<ContactReminder[]>([]);
  const [showPostSaveTaskDialog, setShowPostSaveTaskDialog] = useState(false);
  const [showPostSaveReminderDialog, setShowPostSaveReminderDialog] =
    useState(false);
  const [editingPostSaveTask, setEditingPostSaveTask] =
    useState<ContactTask | null>(null);
  const [editingPostSaveReminder, setEditingPostSaveReminder] =
    useState<ContactReminder | null>(null);

  // Post-save task/reminder handlers (for success view)
  const handleAddPostSaveTask = () => {
    setEditingPostSaveTask(null);
    setShowPostSaveTaskDialog(true);
  };

  const handleEditPostSaveTask = (task: ContactTask) => {
    setEditingPostSaveTask(task);
    setShowPostSaveTaskDialog(true);
  };

  const handlePostSaveTaskSuccess = (task: ContactTask) => {
    if (editingPostSaveTask) {
      setSavedTasks(savedTasks.map((t) => (t.id === task.id ? task : t)));
    } else {
      setSavedTasks([...savedTasks, task]);
    }
  };

  const handleAddPostSaveReminder = () => {
    setEditingPostSaveReminder(null);
    setShowPostSaveReminderDialog(true);
  };

  const handleEditPostSaveReminder = (reminder: ContactReminder) => {
    setEditingPostSaveReminder(reminder);
    setShowPostSaveReminderDialog(true);
  };

  const handlePostSaveReminderSuccess = (reminder: ContactReminder) => {
    if (editingPostSaveReminder) {
      setSavedReminders(
        savedReminders.map((r) => (r.id === reminder.id ? reminder : r)),
      );
    } else {
      setSavedReminders([...savedReminders, reminder]);
    }
  };

  // Post-save notes state and handlers
  const [savedNotes, setSavedNotes] = useState<ContactNote[]>([]);
  const [showPostSaveNoteDialog, setShowPostSaveNoteDialog] = useState(false);

  const handleAddPostSaveNote = () => {
    setShowPostSaveNoteDialog(true);
  };

  const handlePostSaveNoteSuccess = (note: ContactNote) => {
    setSavedNotes([...savedNotes, note]);
  };

  const fetchPostSaveNotes = async (contactId: string) => {
    try {
      const notesData = await api.get<ContactNote[]>(
        `/contacts/${contactId}/notes`,
      );
      setSavedNotes(notesData);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  // Fetch tasks, reminders, and notes after save
  const fetchPostSaveTasksReminders = async (contactId: string) => {
    try {
      const [tasksData, remindersData] = await Promise.all([
        getContactTasks(contactId),
        getContactReminders(contactId, true),
      ]);
      setSavedTasks(tasksData);
      setSavedReminders(remindersData);
      // Also fetch notes
      fetchPostSaveNotes(contactId);
    } catch (error) {
      console.error("Error fetching tasks/reminders:", error);
    }
  };

  // Tasks and Reminders state
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>(
    [],
  );
  const [newTask, setNewTask] = useState<{
    title: string;
    dueDate: string;
    reminderAt: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }>({ title: "", dueDate: "", reminderAt: "", priority: "MEDIUM" });
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [reminderAttachments, setReminderAttachments] = useState<
    TaskAttachment[]
  >([]);
  const [newReminder, setNewReminder] = useState({ title: "", reminderAt: "" });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTaskId, setRecordingTaskId] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null,
  );
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Media notes state (for notes section)
  const [pendingMediaNotes, setPendingMediaNotes] = useState<
    PendingMediaNote[]
  >([]);
  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [noteMediaRecorder, setNoteMediaRecorder] =
    useState<MediaRecorder | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    percent: number;
  } | null>(null);

  // Bio dialog state
  const [isBioDialogOpen, setIsBioDialogOpen] = useState(false);

  // Expand states for option lists and textareas
  const [sectorsExpanded, setSectorsExpanded] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [interestsExpanded, setInterestsExpanded] = useState(false);
  const [hobbiesExpanded, setHobbiesExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Load scanned contact data
  useEffect(() => {
    const scannedData = sessionStorage.getItem("scannedContact");
    const contactSource = sessionStorage.getItem("contactSource");
    const storedAiSuggestions = sessionStorage.getItem("aiSuggestions");
    const cardImageUrl = sessionStorage.getItem("cardImageUrl");
    const deepSearchData = sessionStorage.getItem("deepSearchResult");

    if (scannedData) {
      try {
        const parsed = JSON.parse(scannedData);

        // Detect LinkedIn URL from website field if not already separated
        let website = parsed.website || "";
        let linkedInUrl = parsed.linkedInUrl || "";

        if (!linkedInUrl && website.toLowerCase().includes("linkedin.com")) {
          linkedInUrl = website;
          website = "";
        }

        setFormData((prev) => ({
          ...prev,
          fullName: parsed.fullName || "",
          email: parsed.email || "",
          phone: parsed.phone || "",
          company: parsed.company || "",
          jobTitle: parsed.jobTitle || "",
          website: website,
          linkedInUrl: linkedInUrl,
          location: parsed.location || "",
        }));
        sessionStorage.removeItem("scannedContact");

        if (contactSource === "CARD_SCAN") {
          setIsFromScan(true);

          // Load card image and add as media note
          console.log(
            "Card image URL from sessionStorage:",
            cardImageUrl
              ? `${cardImageUrl.substring(0, 50)}... (length: ${cardImageUrl.length})`
              : "NULL",
          );
          if (cardImageUrl) {
            try {
              // Convert base64 data URL to blob
              const base64Data = cardImageUrl.split(",")[1];
              const mimeType =
                cardImageUrl.split(";")[0].split(":")[1] || "image/jpeg";
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: mimeType });

              // Add to pending media notes
              console.log(
                "Adding card image to pending media notes, blob size:",
                blob.size,
              );
              setPendingMediaNotes((prev) => [
                ...prev,
                {
                  id: `card-${Date.now()}`,
                  type: "IMAGE",
                  blob,
                  fileName: "business-card.jpg",
                  previewUrl: cardImageUrl,
                  mimeType,
                },
              ]);

              sessionStorage.removeItem("cardImageUrl");
            } catch (e) {
              console.error("Failed to process card image:", e);
            }
          }

          // Load deep search results (real data from web)
          if (deepSearchData) {
            try {
              const deepSearch = JSON.parse(deepSearchData);

              // Auto-fill bio, linkedInUrl, and location from deep search if available
              const deepBioSummary = deepSearch.bio || "";
              const deepBioFull = deepSearch.bioFull || deepSearch.bio || "";
              setFormData((prev) => ({
                ...prev,
                bio: deepBioFull || prev.bio,
                bioSummary: prev.bioSummary || deepBioSummary.slice(0, 500),
                bioFull: prev.bioFull || deepBioFull,
                linkedInUrl: deepSearch.linkedInUrl || prev.linkedInUrl,
                location: deepSearch.location || prev.location,
              }));

              // Load enrichment data (experience, education, employmentVerification)
              if (
                deepSearch.experience ||
                deepSearch.education ||
                deepSearch.employmentVerification
              ) {
                setEnrichmentData({
                  experience: deepSearch.experience,
                  education: deepSearch.education,
                  pictureUrl: deepSearch.pictureUrl,
                  iceBreakers: deepSearch.iceBreakers,
                  employmentVerification: deepSearch.employmentVerification,
                });
              }

              sessionStorage.removeItem("deepSearchResult");
              sessionStorage.removeItem("enrichmentData");
            } catch (e) {
              console.error("Failed to parse deep search data:", e);
            }
          }

          // Load AI suggestions from sessionStorage if available
          if (storedAiSuggestions) {
            try {
              const aiData = JSON.parse(storedAiSuggestions);
              console.log("Loaded AI suggestions:", aiData);
              setAiSuggestions(aiData);

              // Auto-apply ALL sectors from AI (use selectedSectors if available, otherwise all)
              const sectorsToApply =
                aiData.selectedSectors?.length > 0
                  ? aiData.selectedSectors
                  : aiData.sectors || [];

              // Auto-apply all AI suggestions to form
              const aiBioSummary = aiData.bio || "";
              const aiBioFull = aiData.bioFull || aiData.bio || "";
              setFormData((prev) => ({
                ...prev,
                customSectors: [
                  ...new Set([...prev.customSectors, ...sectorsToApply]),
                ],
                customSkills: [
                  ...new Set([...prev.customSkills, ...(aiData.skills || [])]),
                ],
                customInterests: [
                  ...new Set([
                    ...prev.customInterests,
                    ...(aiData.interests || []),
                  ]),
                ],
                customHobbies: [
                  ...new Set([
                    ...prev.customHobbies,
                    ...(aiData.hobbies || []),
                  ]),
                ],
                bio: prev.bio || aiBioFull,
                // Auto-populate bioSummary (short) and bioFull (detailed) from AI
                bioSummary: prev.bioSummary || aiBioSummary.slice(0, 500),
                bioFull: prev.bioFull || aiBioFull,
                linkedInUrl: prev.linkedInUrl || aiData.linkedInUrl || "",
                location: prev.location || aiData.location || "",
              }));

              sessionStorage.removeItem("aiSuggestions");
            } catch (e) {
              console.error("Failed to parse AI suggestions:", e);
            }
          }
          // Note: No separate AI analysis call - all suggestions come from scan
        }

        // Handle Explorer source
        if (contactSource === "EXPLORER") {
          // Load AI suggestions (sectors, skills, interests, bio) from Explorer
          if (storedAiSuggestions) {
            try {
              const aiData = JSON.parse(storedAiSuggestions);
              console.log("Loaded Explorer AI data:", aiData);
              setAiSuggestions(aiData);

              // Auto-apply sectors, skills, interests, hobbies and bio from Explorer
              const explorerBioSummary = aiData.bio || "";
              const explorerBioFull = aiData.bioFull || aiData.bio || "";
              setFormData((prev) => ({
                ...prev,
                customSectors: [
                  ...new Set([
                    ...prev.customSectors,
                    ...(aiData.sectors || []),
                  ]),
                ],
                customSkills: [
                  ...new Set([...prev.customSkills, ...(aiData.skills || [])]),
                ],
                customInterests: [
                  ...new Set([
                    ...prev.customInterests,
                    ...(aiData.interests || []),
                  ]),
                ],
                customHobbies: [
                  ...new Set([
                    ...prev.customHobbies,
                    ...(aiData.hobbies || []),
                  ]),
                ],
                bio: prev.bio || explorerBioFull,
                bioSummary: prev.bioSummary || explorerBioSummary.slice(0, 500),
                bioFull: prev.bioFull || explorerBioFull,
              }));

              sessionStorage.removeItem("aiSuggestions");
            } catch (e) {
              console.error("Failed to parse Explorer AI data:", e);
            }
          }

          // Load Explorer notes (conversation starters, common ground)
          const explorerNotes = sessionStorage.getItem("explorerNotes");
          if (explorerNotes) {
            setFormData((prev) => ({
              ...prev,
              notes: prev.notes
                ? prev.notes + "\n\n" + explorerNotes
                : explorerNotes,
            }));
            sessionStorage.removeItem("explorerNotes");
          }
        }

        // Handle Match source (from opportunity matching)
        if (contactSource === "MATCH") {
          // Load AI suggestions (sectors, skills, bio) from Match
          if (storedAiSuggestions) {
            try {
              const aiData = JSON.parse(storedAiSuggestions);
              console.log("Loaded Match AI data:", aiData);
              setAiSuggestions(aiData);

              // Auto-apply sectors, skills, hobbies, and bio from Match
              const matchBioSummary = aiData.bio || "";
              const matchBioFull = aiData.bioFull || aiData.bio || "";
              setFormData((prev) => ({
                ...prev,
                customSectors: [
                  ...new Set([
                    ...prev.customSectors,
                    ...(aiData.sectors || []),
                  ]),
                ],
                customSkills: [
                  ...new Set([...prev.customSkills, ...(aiData.skills || [])]),
                ],
                customInterests: [
                  ...new Set([
                    ...prev.customInterests,
                    ...(aiData.interests || []),
                  ]),
                ],
                customHobbies: [
                  ...new Set([
                    ...prev.customHobbies,
                    ...(aiData.hobbies || []),
                  ]),
                ],
                bio: prev.bio || matchBioFull,
                bioSummary: prev.bioSummary || matchBioSummary.slice(0, 500),
                bioFull: prev.bioFull || matchBioFull,
              }));

              sessionStorage.removeItem("aiSuggestions");
            } catch (e) {
              console.error("Failed to parse Match AI data:", e);
            }
          }

          // Load Match notes (suggested message, next steps)
          const matchNotes = sessionStorage.getItem("explorerNotes");
          if (matchNotes) {
            setFormData((prev) => ({
              ...prev,
              notes: prev.notes ? prev.notes + "\n\n" + matchNotes : matchNotes,
            }));
            sessionStorage.removeItem("explorerNotes");
          }
        }
      } catch (e) {
        console.error("Failed to parse scanned contact data:", e);
      }
    }

    if (contactSource) {
      sessionStorage.removeItem("contactSource");
    }
  }, []);

  // Fetch lookup data
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const token = getAccessToken();
        const headers = { Authorization: `Bearer ${token}` };
        const baseUrl = process.env.NEXT_PUBLIC_API_URL;

        const [sectorsRes, skillsRes, interestsRes, hobbiesRes] =
          await Promise.all([
            fetch(`${baseUrl}/sectors`, { headers }),
            fetch(`${baseUrl}/skills`, { headers }),
            fetch(`${baseUrl}/interests`, { headers }).catch(() => null),
            fetch(`${baseUrl}/hobbies`, { headers }).catch(() => null),
          ]);

        const [sectorsData, skillsData] = await Promise.all([
          sectorsRes.json(),
          skillsRes.json(),
        ]);

        if (sectorsData.success) setSectors(sectorsData.data || []);
        if (skillsData.success) setSkills(skillsData.data || []);

        if (interestsRes) {
          const interestsData = await interestsRes.json();
          if (interestsData.success) setInterests(interestsData.data || []);
        }

        if (hobbiesRes) {
          const hobbiesData = await hobbiesRes.json();
          if (hobbiesData.success) setHobbies(hobbiesData.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch lookups:", error);
      }
    };
    fetchLookups();
  }, []);

  // Generate AI suggestions from scanned data
  const generateAISuggestions = async (contactData: any) => {
    setIsGeneratingAI(true);
    try {
      const token = getAccessToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contacts/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: contactData.fullName,
            company: contactData.company,
            jobTitle: contactData.jobTitle,
            email: contactData.email,
            website: contactData.website,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setAiSuggestions(data.data);

          // Auto-populate bio if empty
          if (data.data.bio && !formData.bio) {
            setFormData((prev) => ({ ...prev, bio: data.data.bio }));
          }
        }
      }
    } catch (error) {
      console.error("Failed to generate AI suggestions:", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleSector = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      sectorIds: prev.sectorIds.includes(id)
        ? prev.sectorIds.filter((s) => s !== id)
        : [...prev.sectorIds, id],
    }));
  };

  const toggleSkill = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      skillIds: prev.skillIds.includes(id)
        ? prev.skillIds.filter((s) => s !== id)
        : [...prev.skillIds, id],
    }));
  };

  const toggleInterest = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      interestIds: prev.interestIds.includes(id)
        ? prev.interestIds.filter((i) => i !== id)
        : [...prev.interestIds, id],
    }));
  };

  const toggleHobby = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      hobbyIds: prev.hobbyIds.includes(id)
        ? prev.hobbyIds.filter((h) => h !== id)
        : [...prev.hobbyIds, id],
    }));
  };

  // Custom input handlers
  const addCustomSector = () => {
    if (
      newSector.trim() &&
      !formData.customSectors.includes(newSector.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        customSectors: [...prev.customSectors, newSector.trim()],
      }));
      setNewSector("");
    }
  };

  const removeCustomSector = (sector: string) => {
    setFormData((prev) => ({
      ...prev,
      customSectors: prev.customSectors.filter((s) => s !== sector),
    }));
  };

  const addCustomSkill = () => {
    if (newSkill.trim() && !formData.customSkills.includes(newSkill.trim())) {
      setFormData((prev) => ({
        ...prev,
        customSkills: [...prev.customSkills, newSkill.trim()],
      }));
      setNewSkill("");
    }
  };

  const removeCustomSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      customSkills: prev.customSkills.filter((s) => s !== skill),
    }));
  };

  const addCustomInterest = () => {
    if (
      newInterest.trim() &&
      !formData.customInterests.includes(newInterest.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        customInterests: [...prev.customInterests, newInterest.trim()],
      }));
      setNewInterest("");
    }
  };

  const removeCustomInterest = (interest: string) => {
    setFormData((prev) => ({
      ...prev,
      customInterests: prev.customInterests.filter((i) => i !== interest),
    }));
  };

  const addCustomHobby = () => {
    if (newHobby.trim() && !formData.customHobbies.includes(newHobby.trim())) {
      setFormData((prev) => ({
        ...prev,
        customHobbies: [...prev.customHobbies, newHobby.trim()],
      }));
      setNewHobby("");
    }
  };

  const removeCustomHobby = (hobby: string) => {
    setFormData((prev) => ({
      ...prev,
      customHobbies: prev.customHobbies.filter((h) => h !== hobby),
    }));
  };

  // Apply AI suggestion
  const applySuggestion = (
    type: "sector" | "skill" | "interest" | "hobby",
    value: string,
  ) => {
    if (type === "sector" && !formData.customSectors.includes(value)) {
      setFormData((prev) => ({
        ...prev,
        customSectors: [...prev.customSectors, value],
      }));
    } else if (type === "skill" && !formData.customSkills.includes(value)) {
      setFormData((prev) => ({
        ...prev,
        customSkills: [...prev.customSkills, value],
      }));
    } else if (
      type === "interest" &&
      !formData.customInterests.includes(value)
    ) {
      setFormData((prev) => ({
        ...prev,
        customInterests: [...prev.customInterests, value],
      }));
    } else if (type === "hobby" && !formData.customHobbies.includes(value)) {
      setFormData((prev) => ({
        ...prev,
        customHobbies: [...prev.customHobbies, value],
      }));
    }
  };

  const applyAllSuggestions = () => {
    if (!aiSuggestions) return;

    const suggestedBio = aiSuggestions.bio || "";
    setFormData((prev) => ({
      ...prev,
      customSectors: [
        ...new Set([...prev.customSectors, ...aiSuggestions.sectors]),
      ],
      customSkills: [
        ...new Set([...prev.customSkills, ...aiSuggestions.skills]),
      ],
      customInterests: [
        ...new Set([...prev.customInterests, ...aiSuggestions.interests]),
      ],
      bio: suggestedBio || prev.bio,
      bioSummary: prev.bioSummary || suggestedBio.slice(0, 500),
      bioFull: prev.bioFull || suggestedBio,
    }));

    toast({
      title: "Applied",
      description: "AI suggestions applied successfully",
      variant: "success",
    });
  };

  // Task handlers
  const addTask = () => {
    if (!newTask.title.trim()) return;

    const task: PendingTask = {
      id: `temp-${Date.now()}`,
      title: newTask.title.trim(),
      dueDate: newTask.dueDate || undefined,
      reminderAt: newTask.reminderAt || undefined,
      priority: newTask.priority,
      attachments:
        taskAttachments.length > 0 ? [...taskAttachments] : undefined,
    };

    setPendingTasks((prev) => [...prev, task]);
    setNewTask({ title: "", dueDate: "", reminderAt: "", priority: "MEDIUM" });
    setTaskAttachments([]);
    setShowTaskForm(false);
  };

  // Handle task attachment upload
  const handleTaskAttachmentUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: TaskAttachment[] = files.map((file) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : "",
      type: file.type.startsWith("image/") ? "image" : "file",
    }));
    setTaskAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  };

  // Remove task attachment
  const removeTaskAttachment = (attachmentId: string) => {
    setTaskAttachments((prev) => {
      const att = prev.find((a) => a.id === attachmentId);
      if (att?.previewUrl) {
        URL.revokeObjectURL(att.previewUrl);
      }
      return prev.filter((a) => a.id !== attachmentId);
    });
  };

  // Format task message for WhatsApp
  const formatTaskMessage = (task: PendingTask): string => {
    const lines = [`*Task: ${task.title}*`];

    if (task.dueDate) {
      const date = new Date(task.dueDate);
      const formattedDate = date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      lines.push("", `📅 Due: ${formattedDate}`);
    }

    lines.push(`⚡ Priority: ${task.priority}`);

    // Add attachments info
    if (task.attachments && task.attachments.length > 0) {
      lines.push(
        "",
        `📎 Attachments: ${task.attachments.length} file${task.attachments.length > 1 ? "s" : ""}`,
      );
    }

    // Add sender info
    lines.push("", "---");
    lines.push(`*Sent from:* ${user?.name || "IntellMatch User"}`);
    if (user?.phone) {
      lines.push(`📞 ${user.phone}`);
    }
    lines.push("", "_Sent via IntellMatch_");

    return lines.join("\n");
  };

  // Send task via WhatsApp
  const sendTaskViaWhatsApp = (task: PendingTask) => {
    if (!formData.phone) return;

    const phone = formData.phone.replace(/\D/g, "");
    const message = formatTaskMessage(task);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");

    toast({
      title: t.common?.success || "Success",
      description: "WhatsApp opened",
      variant: "success",
    });
  };

  // Send task via Email (mailto link since contact not saved yet)
  const sendTaskViaEmail = (task: PendingTask) => {
    if (!formData.email) return;

    const senderName = user?.name || "IntellMatch User";
    const subject = `Task from ${senderName}: ${task.title}`;
    let body = `Task: ${task.title}`;
    if (task.dueDate) {
      const date = new Date(task.dueDate);
      body += `\n\nDue: ${date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    body += `\nPriority: ${task.priority}`;

    // Add attachments info
    if (task.attachments && task.attachments.length > 0) {
      body += `\n\nAttachments: ${task.attachments.length} file${task.attachments.length > 1 ? "s" : ""}`;
    }

    // Add sender info
    body += "\n\n---";
    body += `\nSent from: ${senderName}`;
    if (user?.phone) {
      body += `\nPhone: ${user.phone}`;
    }
    body += "\n\nSent via IntellMatch";

    const mailtoUrl = `mailto:${formData.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");

    toast({
      title: t.common?.success || "Success",
      description: "Email client opened",
      variant: "success",
    });
  };

  const removeTask = (taskId: string) => {
    setPendingTasks((prev) => prev.filter((t) => t.id !== taskId));
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

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);

        setPendingTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, voiceBlob: audioBlob, voiceUrl: audioUrl }
              : t,
          ),
        );

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecordingTaskId(taskId);
      setIsRecording(true);
    } catch {
      toast({
        title: "Error",
        description: "Could not access microphone",
        variant: "error",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setRecordingTaskId(null);
  };

  const removeVoiceNote = (taskId: string) => {
    setPendingTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, voiceBlob: undefined, voiceUrl: undefined }
          : t,
      ),
    );
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
  const addReminder = () => {
    if (!newReminder.title.trim() || !newReminder.reminderAt) return;

    const reminder: PendingReminder = {
      id: `temp-${Date.now()}`,
      title: newReminder.title.trim(),
      reminderAt: newReminder.reminderAt,
      attachments:
        reminderAttachments.length > 0 ? [...reminderAttachments] : undefined,
    };

    setPendingReminders((prev) => [...prev, reminder]);
    setNewReminder({ title: "", reminderAt: "" });
    setReminderAttachments([]);
    setShowReminderForm(false);
  };

  // Handle reminder attachment upload
  const handleReminderAttachmentUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: TaskAttachment[] = files.map((file) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : "",
      type: file.type.startsWith("image/") ? "image" : "file",
    }));
    setReminderAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  };

  // Remove reminder attachment
  const removeReminderAttachment = (attachmentId: string) => {
    setReminderAttachments((prev) => {
      const att = prev.find((a) => a.id === attachmentId);
      if (att?.previewUrl) {
        URL.revokeObjectURL(att.previewUrl);
      }
      return prev.filter((a) => a.id !== attachmentId);
    });
  };

  const removeReminder = (reminderId: string) => {
    setPendingReminders((prev) => prev.filter((r) => r.id !== reminderId));
  };

  // Media Notes handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "error",
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const mediaNote: PendingMediaNote = {
      id: `note-${Date.now()}`,
      type: "IMAGE",
      blob: file,
      previewUrl,
      mimeType: file.type,
      fileName: file.name,
    };

    setPendingMediaNotes((prev) => [...prev, mediaNote]);
    e.target.value = ""; // Reset input
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setCameraStream(stream);
      setShowCameraModal(true);
    } catch {
      toast({
        title: "Camera Error",
        description: "Could not access camera",
        variant: "error",
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef || !cameraStream) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.videoWidth;
    canvas.height = videoRef.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const previewUrl = URL.createObjectURL(blob);
        const mediaNote: PendingMediaNote = {
          id: `note-${Date.now()}`,
          type: "IMAGE",
          blob,
          previewUrl,
          mimeType: "image/jpeg",
          fileName: `photo-${Date.now()}.jpg`,
        };

        setPendingMediaNotes((prev) => [...prev, mediaNote]);
        closeCamera();
      },
      "image/jpeg",
      0.85,
    );
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const startNoteVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const previewUrl = URL.createObjectURL(audioBlob);

        const mediaNote: PendingMediaNote = {
          id: `note-${Date.now()}`,
          type: "VOICE",
          blob: audioBlob,
          previewUrl,
          mimeType: "audio/webm",
          fileName: `voice-${Date.now()}.webm`,
        };

        setPendingMediaNotes((prev) => [...prev, mediaNote]);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setNoteMediaRecorder(recorder);
      setIsRecordingNote(true);
    } catch {
      toast({
        title: "Microphone Error",
        description: "Could not access microphone",
        variant: "error",
      });
    }
  };

  const stopNoteVoiceRecording = () => {
    if (noteMediaRecorder && noteMediaRecorder.state !== "inactive") {
      noteMediaRecorder.stop();
    }
    setIsRecordingNote(false);
    setNoteMediaRecorder(null);
  };

  const removeMediaNote = (noteId: string) => {
    setPendingMediaNotes((prev) => {
      const note = prev.find((n) => n.id === noteId);
      if (note?.previewUrl) {
        URL.revokeObjectURL(note.previewUrl);
      }
      return prev.filter((n) => n.id !== noteId);
    });
  };

  // Upload with progress tracking
  const uploadWithProgress = (
    url: string,
    formData: FormData,
    token: string | null,
  ): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress((prev) =>
            prev ? { ...prev, percent } : { current: 1, total: 1, percent },
          );
        }
      });

      xhr.addEventListener("load", () => {
        const response = new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
        });
        resolve(response);
      });

      xhr.addEventListener("error", () => reject(new Error("Upload failed")));
      xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

      xhr.open("POST", url);
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  };

  const playMediaNote = (noteId: string, url: string) => {
    if (playingAudio === noteId) {
      setPlayingAudio(null);
    } else {
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setPlayingAudio(noteId);
    }
  };

  // Priority color helper
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "HIGH":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "MEDIUM":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "LOW":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-white/[0.03]0/20 text-th-text-t border-neutral-500/30";
    }
  };

  const handleSaveContact = async () => {
    if (!formData.fullName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a contact name",
        variant: "error",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post<{
        contact: any;
        match: MatchData | null;
        enrichmentTriggered: boolean;
      }>("/contacts", {
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
        source: isFromScan ? "CARD_SCAN" : "MANUAL",
        sectors:
          formData.sectorIds.length > 0
            ? formData.sectorIds.map((id) => ({ sectorId: id }))
            : undefined,
        skills:
          formData.skillIds.length > 0
            ? formData.skillIds.map((id) => ({ skillId: id }))
            : undefined,
        interests:
          formData.interestIds.length > 0
            ? formData.interestIds.map((id) => ({ interestId: id }))
            : undefined,
        hobbies:
          formData.hobbyIds.length > 0
            ? formData.hobbyIds.map((id) => ({ hobbyId: id }))
            : undefined,
        // Send custom values for backend processing
        customSectors:
          formData.customSectors.length > 0
            ? formData.customSectors
            : undefined,
        customSkills:
          formData.customSkills.length > 0 ? formData.customSkills : undefined,
        customInterests:
          formData.customInterests.length > 0
            ? formData.customInterests
            : undefined,
        customHobbies:
          formData.customHobbies.length > 0
            ? formData.customHobbies
            : undefined,
        // Enrichment data from ScrapIn (experience, education, employmentVerification)
        enrichmentData: enrichmentData || undefined,
      });

      // Handle response safely
      if (response && response.contact) {
        const contactId = response.contact.id;
        // Save pending tasks
        for (const task of pendingTasks) {
          try {
            const taskResponse = await api.post(
              `/contacts/${contactId}/tasks`,
              {
                title: task.title,
                description: task.description,
                dueDate: task.dueDate,
                reminderAt: task.reminderAt,
                priority: task.priority,
              },
            );

            // Upload voice note if exists
            if (task.voiceBlob && taskResponse && (taskResponse as any).id) {
              const formData = new FormData();
              formData.append("voice", task.voiceBlob, "voice-note.webm");
              await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/tasks/${(taskResponse as any).id}/voice`,
                {
                  method: "POST",
                  body: formData,
                  credentials: "include",
                },
              );
            }
          } catch (taskError) {
            console.error("Failed to save task:", taskError);
          }
        }

        // Save pending reminders
        for (const reminder of pendingReminders) {
          try {
            await api.post(`/contacts/${contactId}/reminders`, {
              title: reminder.title,
              description: reminder.description,
              reminderAt: reminder.reminderAt,
            });
          } catch (reminderError) {
            console.error("Failed to save reminder:", reminderError);
          }
        }

        // Save pending media notes with progress tracking
        console.log("Pending media notes to upload:", pendingMediaNotes.length);
        if (pendingMediaNotes.length > 0) {
          setUploadProgress({
            current: 0,
            total: pendingMediaNotes.length,
            percent: 0,
          });
        }
        for (let i = 0; i < pendingMediaNotes.length; i++) {
          const note = pendingMediaNotes[i];
          setUploadProgress({
            current: i + 1,
            total: pendingMediaNotes.length,
            percent: 0,
          });
          console.log("Uploading media note:", {
            type: note.type,
            fileName: note.fileName,
            blobSize: note.blob?.size,
          });
          try {
            const noteFormData = new FormData();
            const token = getAccessToken();
            if (note.type === "IMAGE" && note.blob) {
              noteFormData.append(
                "image",
                note.blob,
                note.fileName || "image.jpg",
              );
              const noteResponse = await uploadWithProgress(
                `${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/notes/image`,
                noteFormData,
                token,
              );

              // If this is the business card image, update contact with cardImageUrl
              if (note.fileName === "business-card.jpg" && noteResponse.ok) {
                const noteData = await noteResponse.json();
                if (noteData.data?.mediaUrl) {
                  // Update contact with card image URL
                  await api.put(`/contacts/${contactId}`, {
                    cardImageUrl: noteData.data.mediaUrl,
                  });
                }
              }
            } else if (note.type === "VOICE" && note.blob) {
              noteFormData.append(
                "voice",
                note.blob,
                note.fileName || "voice.webm",
              );
              if (note.duration) {
                noteFormData.append("duration", String(note.duration));
              }
              await uploadWithProgress(
                `${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/notes/voice`,
                noteFormData,
                token,
              );
            }
          } catch (noteError) {
            console.error("Failed to save media note:", noteError);
          }
        }
        setUploadProgress(null);

        const mediaNotesCount = pendingMediaNotes.length;
        const tasksRemindersMsg =
          pendingTasks.length > 0 ||
          pendingReminders.length > 0 ||
          mediaNotesCount > 0
            ? ` with ${pendingTasks.length} task(s), ${pendingReminders.length} reminder(s), and ${mediaNotesCount} media note(s)`
            : "";

        toast({
          title: (t.contacts as any)?.addContactSuccess || "Contact Added",
          description: response.enrichmentTriggered
            ? `${formData.fullName} ${"has been added. Enriching profile..."}${tasksRemindersMsg}`
            : `${formData.fullName} ${"has been added"}${tasksRemindersMsg}`,
          variant: "success",
        });

        // Redirect directly to contact detail page to show matching
        router.push(`/contacts/${response.contact.id}`);
      } else {
        // Fallback if response structure is different
        toast({
          title: "Contact Added",
          description: `${formData.fullName} has been added`,
          variant: "success",
        });
        router.push("/contacts");
      }
    } catch (error: any) {
      console.error("Save contact error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add contact",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50";
  const chipInputClass =
    "flex-1 min-w-[120px] px-3 py-2 bg-transparent text-th-text placeholder-th-text-m focus:outline-none text-sm";

  // Success view with match results
  if (showSuccess && savedContact) {
    const contactName = savedContact.name || formData.fullName;

    return (
      <div className="animate-fade-in pb-20">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur-lg opacity-50" />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Checkmark24Regular className="w-10 h-10 text-th-text" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-th-text mb-2">
            Contact Added!
          </h1>
          <p className="text-th-text-t">{contactName} is now in your network</p>
        </div>

        {/* Match Analysis Card - Same design as contact detail page */}
        {matchData && matchData.score > 0 && (
          <div className="bg-gradient-to-br from-emerald-900/30 via-emerald-900/20 to-transparent backdrop-blur-sm border border-emerald-500/20 rounded-2xl p-6 mb-6 overflow-hidden relative">
            {/* Glow effects */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/20 rounded-full blur-3xl" />

            {/* Header */}
            <div className="flex items-center gap-2 mb-4 relative">
              <Sparkle24Regular className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-th-text">
                {t.contacts?.matchDetails?.matchBreakdown || "Match Analysis"}
              </h2>
            </div>

            {/* Main content - Score + Radar Chart */}
            <div className="flex flex-col md:flex-row items-center gap-8 relative mb-6">
              {/* Large Score Circle */}
              <div className="flex flex-col items-center gap-3 group relative">
                <div
                  className={`w-32 h-32 rounded-full flex items-center justify-center cursor-help ${
                    matchData.score >= 80
                      ? "bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-3 border-green-500/50"
                      : matchData.score >= 50
                        ? "bg-gradient-to-br from-yellow-500/30 to-cyan-500/30 border-3 border-yellow-500/50"
                        : matchData.score >= 20
                          ? "bg-gradient-to-br from-yellow-500/30 to-cyan-500/30 border-3 border-yellow-500/50"
                          : "bg-gradient-to-br from-neutral-500/30 to-neutral-600/30 border-3 border-neutral-500/50"
                  }`}
                  style={{ borderWidth: "3px" }}
                >
                  <span
                    className={`text-5xl font-bold ${
                      matchData.score >= 80
                        ? "text-green-400"
                        : matchData.score >= 50
                          ? "text-yellow-400"
                          : matchData.score >= 20
                            ? "text-yellow-400"
                            : "text-th-text-t"
                    }`}
                  >
                    {matchData.score}%
                  </span>
                </div>
                {/* Score calculation tooltip */}
                <div className="absolute top-0 start-full ms-3 px-4 py-3 bg-th-bg-t border border-th-border rounded-xl text-xs text-th-text-s w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                  <p className="font-semibold text-th-text mb-2 text-sm">
                    {t.contacts?.matchDetails?.howCalculated ||
                      "How Match Score is Calculated"}
                  </p>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span>
                        {t.contacts?.matchDetails?.scores?.goals || "Goals"}
                      </span>
                      <span className="text-emerald-400">
                        {t.contacts?.matchDetails?.weights?.goals || "25%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {t.contacts?.matchDetails?.scores?.sectors || "Sectors"}
                      </span>
                      <span className="text-blue-400">
                        {t.contacts?.matchDetails?.weights?.sectors || "15%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {t.contacts?.matchDetails?.scores?.skills || "Skills"}
                      </span>
                      <span className="text-cyan-400">
                        {t.contacts?.matchDetails?.weights?.skills || "12%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {t.contacts?.matchDetails?.scores?.aiSemantic ||
                          "AI Semantic"}
                        *
                      </span>
                      <span className="text-emerald-400">
                        {t.contacts?.matchDetails?.weights?.aiSemantic || "10%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {t.contacts?.matchDetails?.scores?.network || "Network"}
                      </span>
                      <span className="text-emerald-400">
                        {t.contacts?.matchDetails?.weights?.network || "8%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {t.contacts?.matchDetails?.scores?.synergy || "Synergy"}
                      </span>
                      <span className="text-green-400">
                        {t.contacts?.matchDetails?.weights?.synergy || "7%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {t.contacts?.matchDetails?.scores?.recency || "Recency"}
                      </span>
                      <span className="text-cyan-400">
                        {t.contacts?.matchDetails?.weights?.recency || "7%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {t.contacts?.matchDetails?.scores?.activity ||
                          "Activity"}
                      </span>
                      <span className="text-red-400">
                        {t.contacts?.matchDetails?.weights?.activity || "6%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {t.contacts?.matchDetails?.scores?.interests ||
                          "Interests"}
                      </span>
                      <span className="text-emerald-400">
                        {t.contacts?.matchDetails?.weights?.interests || "5%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {t.contacts?.matchDetails?.scores?.hobbies || "Hobbies"}
                      </span>
                      <span className="text-yellow-400">
                        {t.contacts?.matchDetails?.weights?.hobbies || "5%"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 pt-2 border-t border-th-border text-th-text-t text-[10px]">
                    {t.contacts?.matchDetails?.calculation?.scoreFormula ||
                      "Score = sum of (component score × weight)"}
                  </p>
                  <p className="mt-1 text-th-text-m text-[9px]">
                    {t.contacts?.matchDetails?.calculation?.aiNote ||
                      "*AI Semantic requires contact profile data (job, company, bio, etc.)"}
                  </p>
                </div>
                {/* Score label below circle */}
                <div
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
                    matchData.score >= 80
                      ? "bg-green-500/20 text-green-300 border border-green-500/30"
                      : matchData.score >= 50
                        ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                        : matchData.score >= 20
                          ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                          : "bg-white/[0.03]0/20 text-th-text-s border border-neutral-500/30"
                  }`}
                >
                  {matchData.score >= 80
                    ? t.contacts?.matchDetails?.scoreLabels?.excellent ||
                      "Excellent Match"
                    : matchData.score >= 50
                      ? t.contacts?.matchDetails?.scoreLabels?.good ||
                        "Good Match"
                      : matchData.score >= 20
                        ? t.contacts?.matchDetails?.scoreLabels?.fair ||
                          "Fair Match"
                        : t.contacts?.matchDetails?.scoreLabels?.low ||
                          "Low Match"}
                </div>
              </div>

              {/* Radar Chart */}
              {matchData.scoreBreakdown && (
                <div className="flex-1">
                  <RadarChart
                    data={[
                      {
                        axis: "Goals",
                        value: matchData.scoreBreakdown.goalAlignmentScore || 0,
                      },
                      {
                        axis: "Sectors",
                        value: matchData.scoreBreakdown.sectorScore || 0,
                      },
                      {
                        axis: "Skills",
                        value: matchData.scoreBreakdown.skillScore || 0,
                      },
                      {
                        axis: "Synergy",
                        value:
                          matchData.scoreBreakdown.complementarySkillsScore ||
                          0,
                      },
                      {
                        axis: "Recency",
                        value: matchData.scoreBreakdown.recencyScore || 0,
                      },
                      {
                        axis: "Activity",
                        value: matchData.scoreBreakdown.interactionScore || 0,
                      },
                    ]}
                    size={180}
                    className="mx-auto"
                    color="#10b981"
                    animate={true}
                  />
                </div>
              )}
            </div>

            {/* Score Breakdown - 2 Column Grid with all 10 components */}
            {matchData.scoreBreakdown && (
              <div className="relative mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-medium text-th-text-t">
                    {t.contacts?.matchDetails?.scoreBreakdown ||
                      "Score Breakdown"}
                  </h3>
                  <div className="group relative">
                    <Info16Regular className="w-4 h-4 text-th-text-m cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-th-bg-t border border-th-border rounded-lg text-xs text-th-text-s w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                      <p className="font-medium text-th-text mb-1">
                        Score = Sum of (Component × Weight)
                      </p>
                      <p className="text-[10px] text-th-text-t">
                        Total of all 10 weighted components
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: t.contacts?.matchDetails?.scores?.goals || "Goals",
                      key: "goals",
                      value: matchData.scoreBreakdown.goalAlignmentScore,
                      color: "purple",
                      Icon: Target24Regular,
                      weight: t.contacts?.matchDetails?.weights?.goals || "25%",
                      tooltip:
                        t.contacts?.matchDetails?.tooltips?.goals ||
                        "Matches networking goals like mentorship, investment, partnership, or collaboration",
                    },
                    {
                      label:
                        t.contacts?.matchDetails?.scores?.sectors || "Sectors",
                      key: "sectors",
                      value: matchData.scoreBreakdown.sectorScore,
                      color: "blue",
                      Icon: Building24Regular,
                      weight:
                        t.contacts?.matchDetails?.weights?.sectors || "15%",
                      tooltip:
                        t.contacts?.matchDetails?.tooltips?.sectors ||
                        "Jaccard similarity of industry sectors you both work in",
                    },
                    {
                      label:
                        t.contacts?.matchDetails?.scores?.skills || "Skills",
                      key: "skills",
                      value: matchData.scoreBreakdown.skillScore,
                      color: "cyan",
                      Icon: Wrench24Regular,
                      weight:
                        t.contacts?.matchDetails?.weights?.skills || "12%",
                      tooltip:
                        t.contacts?.matchDetails?.tooltips?.skills ||
                        "Overlap of professional skills and expertise areas",
                    },
                    {
                      label:
                        t.contacts?.matchDetails?.scores?.aiSemantic ||
                        "AI Semantic",
                      key: "aiSemantic",
                      value:
                        matchData.scoreBreakdown.semanticSimilarityScore || 0,
                      color: "violet",
                      Icon: BrainCircuit24Regular,
                      weight:
                        t.contacts?.matchDetails?.weights?.aiSemantic || "10%",
                      tooltip:
                        t.contacts?.matchDetails?.tooltips?.aiSemantic ||
                        "AI analysis of profile similarity. Requires contact to have job title, company, bio, sectors, skills, or interests",
                    },
                    {
                      label:
                        t.contacts?.matchDetails?.scores?.network || "Network",
                      key: "network",
                      value:
                        matchData.scoreBreakdown.networkProximityScore || 0,
                      color: "indigo",
                      Icon: Share24Regular,
                      weight:
                        t.contacts?.matchDetails?.weights?.network || "8%",
                      tooltip:
                        t.contacts?.matchDetails?.tooltips?.network ||
                        "Connection degree: 1st=100%, 2nd=70%, 3rd=40%",
                    },
                    {
                      label:
                        t.contacts?.matchDetails?.scores?.synergy || "Synergy",
                      key: "synergy",
                      value: matchData.scoreBreakdown.complementarySkillsScore,
                      color: "green",
                      Icon: PeopleTeam24Regular,
                      weight:
                        t.contacts?.matchDetails?.weights?.synergy || "7%",
                      tooltip:
                        t.contacts?.matchDetails?.tooltips?.synergy ||
                        "Skills that complement each other (e.g., sales + marketing)",
                    },
                    {
                      label:
                        t.contacts?.matchDetails?.scores?.recency || "Recency",
                      key: "recency",
                      value: matchData.scoreBreakdown.recencyScore || 0,
                      color: "yellow",
                      Icon: CalendarClock24Regular,
                      weight:
                        t.contacts?.matchDetails?.weights?.recency || "7%",
                      tooltip:
                        t.contacts?.matchDetails?.tooltips?.recency ||
                        "How recently updated (only if other data matches)",
                    },
                    {
                      label:
                        t.contacts?.matchDetails?.scores?.activity ||
                        "Activity",
                      key: "activity",
                      value: matchData.scoreBreakdown.interactionScore,
                      color: "lime",
                      Icon: DataUsage24Regular,
                      weight:
                        t.contacts?.matchDetails?.weights?.activity || "6%",
                      tooltip:
                        t.contacts?.matchDetails?.tooltips?.activity ||
                        "Based on calls, meetings, and messages exchanged",
                    },
                    {
                      label:
                        t.contacts?.matchDetails?.scores?.interests ||
                        "Interests",
                      key: "interests",
                      value: matchData.scoreBreakdown.interestScore,
                      color: "pink",
                      Icon: Lightbulb24Regular,
                      weight:
                        t.contacts?.matchDetails?.weights?.interests || "5%",
                      tooltip:
                        t.contacts?.matchDetails?.tooltips?.interests ||
                        "Shared professional interests and topics",
                    },
                    {
                      label:
                        t.contacts?.matchDetails?.scores?.hobbies || "Hobbies",
                      key: "hobbies",
                      value: matchData.scoreBreakdown.hobbyScore || 0,
                      color: "rose",
                      Icon: Heart24Regular,
                      weight:
                        t.contacts?.matchDetails?.weights?.hobbies || "5%",
                      tooltip:
                        t.contacts?.matchDetails?.tooltips?.hobbies ||
                        "Shared hobbies and personal interests",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="bg-th-surface rounded-lg p-2.5 hover:bg-th-surface-h transition-colors group relative"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <item.Icon
                          className={`w-4 h-4 ${
                            item.color === "purple"
                              ? "text-emerald-400"
                              : item.color === "blue"
                                ? "text-blue-400"
                                : item.color === "cyan"
                                  ? "text-cyan-400"
                                  : item.color === "violet"
                                    ? "text-emerald-400"
                                    : item.color === "indigo"
                                      ? "text-emerald-400"
                                      : item.color === "green"
                                        ? "text-green-400"
                                        : item.color === "yellow"
                                          ? "text-yellow-400"
                                          : item.color === "lime"
                                            ? "text-lime-400"
                                            : item.color === "pink"
                                              ? "text-emerald-400"
                                              : "text-red-400"
                          }`}
                        />
                        <span className="text-xs font-medium text-th-text-s flex-1">
                          {item.label}
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            item.value >= 70
                              ? "text-green-400"
                              : item.value >= 40
                                ? "text-yellow-400"
                                : "text-th-text-m"
                          }`}
                        >
                          {Math.round(item.value)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.color === "purple"
                              ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                              : item.color === "blue"
                                ? "bg-gradient-to-r from-blue-600 to-blue-400"
                                : item.color === "cyan"
                                  ? "bg-gradient-to-r from-cyan-600 to-cyan-400"
                                  : item.color === "violet"
                                    ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                                    : item.color === "indigo"
                                      ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                                      : item.color === "green"
                                        ? "bg-gradient-to-r from-green-600 to-green-400"
                                        : item.color === "yellow"
                                          ? "bg-gradient-to-r from-yellow-600 to-yellow-400"
                                          : item.color === "lime"
                                            ? "bg-gradient-to-r from-lime-600 to-lime-400"
                                            : item.color === "pink"
                                              ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                                              : "bg-gradient-to-r from-red-600 to-red-400"
                          }`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                      {/* Tooltip with detailed calculation */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-th-bg-t border border-th-border rounded-lg text-[10px] text-th-text-s w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                        <p className="font-semibold text-th-text mb-1">
                          {item.label}
                        </p>
                        <p className="text-th-text-t mb-2">{item.tooltip}</p>
                        <div className="border-t border-th-border pt-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-th-text-m">
                              {t.contacts?.matchDetails?.calculation
                                ?.rawScore || "Raw Score"}
                              :
                            </span>
                            <span className="text-th-text font-medium">
                              {Math.round(item.value)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-th-text-m">
                              {t.contacts?.matchDetails?.calculation?.weight ||
                                "Weight"}
                              :
                            </span>
                            <span className="text-th-text font-medium">
                              {item.weight}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-th-text-m">
                              {t.contacts?.matchDetails?.calculation
                                ?.contribution || "Contribution"}
                              :
                            </span>
                            <span className="text-green-400 font-bold">
                              +
                              {(
                                (item.value * parseFloat(item.weight)) /
                                100
                              ).toFixed(1)}{" "}
                              pts
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Score Calculation */}
                <div className="mt-4 p-3 bg-th-surface rounded-lg border border-th-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-th-text-t">
                      {t.contacts?.matchDetails?.totalCalculation ||
                        "Total Score Calculation"}
                    </span>
                    <span className="text-lg font-bold text-th-text">
                      {matchData.score}%
                    </span>
                  </div>
                  <div className="text-[10px] text-th-text-m space-y-0.5">
                    <div className="flex flex-wrap gap-1">
                      {[
                        {
                          label: "Goals",
                          value: matchData.scoreBreakdown.goalAlignmentScore,
                          weight: 0.25,
                        },
                        {
                          label: "Sectors",
                          value: matchData.scoreBreakdown.sectorScore,
                          weight: 0.15,
                        },
                        {
                          label: "Skills",
                          value: matchData.scoreBreakdown.skillScore,
                          weight: 0.12,
                        },
                        {
                          label: "AI",
                          value:
                            matchData.scoreBreakdown.semanticSimilarityScore ||
                            0,
                          weight: 0.1,
                        },
                        {
                          label: "Network",
                          value:
                            matchData.scoreBreakdown.networkProximityScore || 0,
                          weight: 0.08,
                        },
                        {
                          label: "Synergy",
                          value:
                            matchData.scoreBreakdown.complementarySkillsScore,
                          weight: 0.07,
                        },
                        {
                          label: "Recency",
                          value: matchData.scoreBreakdown.recencyScore || 0,
                          weight: 0.07,
                        },
                        {
                          label: "Activity",
                          value: matchData.scoreBreakdown.interactionScore,
                          weight: 0.06,
                        },
                        {
                          label: "Interests",
                          value: matchData.scoreBreakdown.interestScore,
                          weight: 0.05,
                        },
                        {
                          label: "Hobbies",
                          value: matchData.scoreBreakdown.hobbyScore || 0,
                          weight: 0.05,
                        },
                      ].map((c, i) => (
                        <span
                          key={c.label}
                          className={
                            c.value > 0 ? "text-green-400" : "text-white/70"
                          }
                        >
                          {i > 0 && "+ "}({Math.round(c.value)}×
                          {(c.weight * 100).toFixed(0)}%)
                        </span>
                      ))}
                      <span className="text-th-text font-medium">
                        = {matchData.score}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* What You Share */}
            {matchData.intersections && matchData.intersections.length > 0 && (
              <div className="pt-4 border-t border-th-border relative mb-4">
                <h3 className="text-sm font-medium text-th-text-t mb-3">
                  {t.contacts?.matchDetails?.whatYouShare || "What You Share"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {matchData.intersections.map((intersection, i) => (
                    <span
                      key={i}
                      className={`px-3 py-1.5 rounded-full text-sm border ${
                        intersection.type === "sector"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : intersection.type === "skill"
                            ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                            : intersection.type === "hobby"
                              ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {intersection.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Match Insights / Why Connect */}
            {matchData.reasons && matchData.reasons.length > 0 && (
              <div className="pt-4 border-t border-th-border relative mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-th-text-t">
                    {t.contacts?.matchDetails?.matchInsights ||
                      "Match Insights"}
                  </h3>
                  <span className="text-xs text-th-text-m">
                    {matchData.reasons.length}{" "}
                    {matchData.reasons.length === 1
                      ? t.contacts?.matchDetails?.reasonsToConnect ||
                        "reason to connect"
                      : t.contacts?.matchDetails?.reasonsToConnectPlural ||
                        "reasons to connect"}
                  </span>
                </div>
                <div className="space-y-2">
                  {matchData.reasons.map((reason, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gradient-to-r from-green-500/5 to-transparent border border-green-500/10"
                    >
                      <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-th-text-s">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goal Alignment */}
            {matchData.goalAlignment?.matchedGoals &&
              matchData.goalAlignment.matchedGoals.length > 0 && (
                <div className="pt-4 border-t border-th-border relative mb-4">
                  <h3 className="text-sm font-medium text-th-text-t mb-3">
                    {t.contacts?.matchDetails?.goalAlignment ||
                      "Goal Alignment"}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {matchData.goalAlignment.matchedGoals.map((goal, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-sm text-green-300"
                      >
                        {goal}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Ice Breaker Messages */}
            {matchData.suggestedMessage && (
              <div className="pt-4 border-t border-th-border relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                    <Chat24Regular className="w-4 h-4 text-th-text" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-th-text">
                        {t.contacts?.matchDetails?.iceBreaker || "Ice Breakers"}
                      </h3>
                      <span className="text-xs text-th-text-m">
                        {
                          matchData.suggestedMessage.split("\n").filter(Boolean)
                            .length
                        }{" "}
                        {t.contacts?.matchDetails?.suggestions || "suggestions"}
                      </span>
                    </div>
                    <p className="text-xs text-th-text-m">
                      {(matchData.goalAlignment?.matchedGoals?.length ?? 0) > 0
                        ? (
                            t.contacts?.matchDetails?.basedOnGoals ||
                            "Based on {goal} goals"
                          ).replace(
                            "{goal}",
                            matchData.goalAlignment!.matchedGoals[0].toLowerCase(),
                          )
                        : (matchData.intersections?.length ?? 0) > 0
                          ? (
                              t.contacts?.matchDetails?.basedOnShared ||
                              "Based on shared {type}s"
                            ).replace(
                              "{type}",
                              matchData.intersections![0].type,
                            )
                          : t.contacts?.matchDetails?.tailoredConnection ||
                            "Tailored to your connection"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {matchData.suggestedMessage
                    .split("\n")
                    .filter(Boolean)
                    .map((message, index) => (
                      <div key={index} className="relative group">
                        <div className="bg-gradient-to-r from-white/5 to-white/[0.02] rounded-lg p-3 pe-12 border border-th-border hover:border-cyan-500/30 transition-all">
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-medium">
                              {index + 1}
                            </span>
                            <p className="text-sm text-th-text-s italic leading-relaxed">
                              &quot;{message.trim()}&quot;
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(message.trim());
                            toast({
                              title: "Copied to clipboard!",
                              variant: "success",
                            });
                          }}
                          className="absolute top-2 end-2 p-2 text-th-text-m hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Copy this message"
                        >
                          <Copy24Regular className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes Section - First position */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-th-text flex items-center gap-2">
              <Note24Regular className="w-5 h-5 text-emerald-400" />
              {t.contactDetails?.notes?.title || "Notes"}
            </h3>
            <button
              type="button"
              onClick={() => setShowPostSaveNoteDialog(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-sm text-emerald-300 transition-colors"
            >
              <Add24Regular className="w-4 h-4" />
              {t.common?.add || "Add"}
            </button>
          </div>

          {savedNotes.length > 0 ? (
            <div className="space-y-2">
              {savedNotes.map((note) => (
                <div
                  key={note.id}
                  className="bg-th-surface border border-th-border rounded-lg p-3"
                >
                  {note.type === "TEXT" && (
                    <p className="text-sm text-th-text">{note.content}</p>
                  )}
                  {note.type === "VOICE" && note.mediaUrl && (
                    <div className="flex items-center gap-3">
                      <Mic24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <audio controls className="flex-1 h-8">
                        <source src={note.mediaUrl} type="audio/webm" />
                      </audio>
                    </div>
                  )}
                  {note.type === "IMAGE" && note.mediaUrl && (
                    <div>
                      <img
                        src={note.mediaUrl}
                        alt="Note"
                        className="max-w-full max-h-48 rounded-lg object-contain"
                      />
                      {note.content && (
                        <p className="text-sm text-th-text-s mt-2">
                          {note.content}
                        </p>
                      )}
                    </div>
                  )}
                  {note.type === "FILE" && note.mediaUrl && (
                    <a
                      href={note.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 bg-th-surface rounded-lg hover:bg-th-surface-h transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-emerald-300">
                          {note.mimeType?.includes("pdf")
                            ? "PDF"
                            : note.mimeType?.includes("word") ||
                                note.mimeType?.includes("document")
                              ? "DOC"
                              : note.mimeType?.includes("powerpoint") ||
                                  note.mimeType?.includes("presentation")
                                ? "PPT"
                                : note.mimeType?.includes("excel") ||
                                    note.mimeType?.includes("spreadsheet")
                                  ? "XLS"
                                  : "FILE"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-th-text truncate">
                          {note.fileName || "Download file"}
                        </p>
                        {note.content && (
                          <p className="text-xs text-th-text-t truncate">
                            {note.content}
                          </p>
                        )}
                      </div>
                    </a>
                  )}
                  <p className="text-xs text-th-text-m mt-2">
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-th-text-m text-center py-4">
              {t.contactDetails?.notes?.empty ||
                "No notes yet. Add notes to remember important details."}
            </p>
          )}
        </div>

        {/* Tasks Section */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-th-text flex items-center gap-2">
              <TaskListSquareAdd24Regular className="w-5 h-5 text-blue-400" />
              {t.contactDetails?.tasks?.title || "Tasks"}
            </h3>
            <button
              type="button"
              onClick={handleAddPostSaveTask}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-sm text-blue-300 transition-colors"
            >
              <Add24Regular className="w-4 h-4" />
              {t.common?.add || "Add"}
            </button>
          </div>

          {savedTasks.length > 0 ? (
            <div className="space-y-2">
              {savedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => handleEditPostSaveTask(task)}
                  className="w-full text-left bg-th-surface border border-th-border rounded-lg p-3 hover:bg-th-surface-h transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                        task.priority === "URGENT"
                          ? "bg-red-500"
                          : task.priority === "HIGH"
                            ? "bg-red-500"
                            : task.priority === "MEDIUM"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${task.status === "COMPLETED" ? "text-th-text-m line-through" : "text-th-text"}`}
                      >
                        {task.title}
                      </p>
                      {task.dueDate && (
                        <p className="text-xs text-th-text-m mt-1">
                          {t.contactDetails?.tasks?.due || "Due"}:{" "}
                          {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {task.voiceNoteUrl && (
                      <Mic24Regular className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-th-text-m text-center py-4">
              {t.contactDetails?.tasks?.empty ||
                "No tasks yet. Add tasks to follow up with this contact."}
            </p>
          )}
        </div>

        {/* Reminders Section */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-th-text flex items-center gap-2">
              <Clock24Regular className="w-5 h-5 text-yellow-400" />
              {t.contactDetails?.reminders?.title || "Reminders"}
            </h3>
            <button
              type="button"
              onClick={handleAddPostSaveReminder}
              className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-sm text-yellow-300 transition-colors"
            >
              <Add24Regular className="w-4 h-4" />
              {t.common?.add || "Add"}
            </button>
          </div>

          {savedReminders.length > 0 ? (
            <div className="space-y-2">
              {savedReminders.map((reminder) => (
                <button
                  key={reminder.id}
                  type="button"
                  onClick={() => handleEditPostSaveReminder(reminder)}
                  className="w-full text-left bg-th-surface border border-th-border rounded-lg p-3 hover:bg-th-surface-h transition-colors"
                >
                  <p
                    className={`text-sm font-medium ${reminder.isCompleted ? "text-th-text-m line-through" : "text-th-text"}`}
                  >
                    {reminder.title}
                  </p>
                  <p className="text-xs text-th-text-m mt-1">
                    {new Date(reminder.reminderAt).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-th-text-m text-center py-4">
              {t.contactDetails?.reminders?.empty ||
                "No reminders yet. Set reminders to stay in touch."}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => router.push(`/contacts/${savedContact.id}`)}
            className="relative w-full group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
            <span className="relative flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
              View Contact Details
            </span>
          </button>
          <button
            onClick={() => router.push("/contacts")}
            className="w-full py-3 rounded-xl border border-th-border text-th-text-s hover:bg-th-surface transition-all"
          >
            Back to Contacts
          </button>
          <button
            onClick={() => {
              setShowSuccess(false);
              setSavedContact(null);
              setMatchData(null);
              setAiSuggestions(null);
              setIsFromScan(false);
              setSavedTasks([]);
              setSavedReminders([]);
              setSavedNotes([]);
              setFormData({
                fullName: "",
                email: "",
                phone: "",
                company: "",
                jobTitle: "",
                website: "",
                linkedInUrl: "",
                location: "",
                notes: "",
                bio: "",
                bioSummary: "",
                bioFull: "",
                sectorIds: [],
                skillIds: [],
                interestIds: [],
                hobbyIds: [],
                customSectors: [],
                customSkills: [],
                customInterests: [],
                customHobbies: [],
              });
            }}
            className="w-full py-3 text-th-text-t hover:text-th-text transition-colors"
          >
            Add Another Contact
          </button>
        </div>

        {/* Task Dialog - for adding/editing tasks after save */}
        <TaskDialog
          open={showPostSaveTaskDialog}
          onOpenChange={setShowPostSaveTaskDialog}
          contactId={savedContact?.id || ""}
          task={editingPostSaveTask}
          onSuccess={handlePostSaveTaskSuccess}
          contact={
            savedContact
              ? {
                  fullName: savedContact.name,
                  phone: savedContact.phone,
                  email: savedContact.email,
                }
              : undefined
          }
        />

        {/* Reminder Dialog - for adding/editing reminders after save */}
        <ReminderDialog
          open={showPostSaveReminderDialog}
          onOpenChange={setShowPostSaveReminderDialog}
          contactId={savedContact?.id || ""}
          reminder={editingPostSaveReminder}
          onSuccess={handlePostSaveReminderSuccess}
        />

        {/* Note Dialog - for adding notes after save */}
        <NoteDialog
          open={showPostSaveNoteDialog}
          onOpenChange={setShowPostSaveNoteDialog}
          contactId={savedContact?.id || ""}
          onSuccess={handlePostSaveNoteSuccess}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-th-surface-h rounded-lg transition-colors"
        >
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">
          {t.contacts?.addContact || "Add Contact"}
        </h1>
        {isFromScan && (
          <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-xs text-emerald-300">
            From Scan
          </span>
        )}
      </div>

      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-2xl p-6 space-y-5">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-2">
            {t.contacts?.form?.name || "Full Name"} *
          </label>
          <div className="relative">
            <Person24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="John Doe"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.contacts?.form?.email || "Email"}
            </label>
            <div className="relative">
              <Mail24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="email@example.com"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.contacts?.form?.phone || "Phone"}
            </label>
            <PhoneInput
              value={formData.phone}
              onChange={(phone) => setFormData((prev) => ({ ...prev, phone }))}
              placeholder="50 123 4567"
              defaultCountry={detectedCountry}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.contacts?.form?.company || "Company"}
            </label>
            <div className="relative">
              <Building24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                placeholder="Company Inc."
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.contacts?.form?.jobTitle || "Job Title"}
            </label>
            <div className="relative">
              <Briefcase24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input
                type="text"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleInputChange}
                placeholder="CEO"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-th-text-s mb-2">
            {t.contacts?.form?.location || "Location"}
          </label>
          <div className="relative">
            <Location24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="New York, USA"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.contacts?.form?.website || "Website"}
            </label>
            <div className="relative">
              <Globe24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="example.com"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              LinkedIn
            </label>
            <div className="relative">
              <Link24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input
                type="url"
                name="linkedInUrl"
                value={formData.linkedInUrl}
                onChange={handleInputChange}
                placeholder="linkedin.com/in/..."
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Employment Verification Alert */}
        {enrichmentData?.employmentVerification?.status === "CHANGED" && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Sparkle24Regular className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-yellow-300 mb-1">
                  Employment Change Detected
                </h4>
                <p className="text-sm text-th-text-s">
                  {formData.fullName || "This person"} may have changed jobs.
                  Card shows{" "}
                  <span className="text-th-text font-medium">
                    {enrichmentData.employmentVerification.cardData?.company}
                  </span>
                  , but LinkedIn shows{" "}
                  <span className="text-th-text font-medium">
                    {
                      enrichmentData.employmentVerification.verifiedData
                        ?.company
                    }
                  </span>{" "}
                  as{" "}
                  <span className="text-th-text font-medium">
                    {
                      enrichmentData.employmentVerification.verifiedData
                        ?.jobTitle
                    }
                  </span>
                  .
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      enrichmentData.employmentVerification.confidence.level ===
                      "HIGH"
                        ? "bg-green-500/20 text-green-300"
                        : enrichmentData.employmentVerification.confidence
                              .level === "MEDIUM"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-white/[0.03]0/20 text-th-text-s"
                    }`}
                  >
                    {enrichmentData.employmentVerification.confidence.level}{" "}
                    Confidence
                  </span>
                  <span className="text-xs text-th-text-m">
                    via{" "}
                    {enrichmentData.employmentVerification.verifiedData?.source}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Experience & Education from LinkedIn */}
        {enrichmentData &&
          ((enrichmentData.experience?.length ?? 0) > 0 ||
            (enrichmentData.education?.length ?? 0) > 0) && (
            <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit24Regular className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-th-text">
                  LinkedIn Profile Data
                </h3>
                {enrichmentData.employmentVerification?.status ===
                  "CURRENT" && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">
                    Verified
                  </span>
                )}
              </div>

              {/* Experience */}
              {enrichmentData.experience &&
                enrichmentData.experience.length > 0 && (
                  <div>
                    <p className="text-xs text-th-text-t mb-2 flex items-center gap-1">
                      <Briefcase24Regular className="w-3 h-3" /> Experience
                    </p>
                    <div className="space-y-2">
                      {enrichmentData.experience.slice(0, 3).map((exp, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2 bg-th-surface rounded-lg"
                        >
                          <div
                            className={`w-2 h-2 rounded-full mt-1.5 ${exp.isCurrent ? "bg-green-400" : "bg-white/[0.03]0"}`}
                          />
                          <div className="flex-1">
                            <p className="text-sm text-th-text font-medium">
                              {exp.title}
                            </p>
                            <p className="text-xs text-th-text-t">
                              {exp.company}
                            </p>
                            {(exp.startDate || exp.endDate) && (
                              <p className="text-xs text-th-text-m">
                                {exp.startDate} -{" "}
                                {exp.isCurrent
                                  ? "Present"
                                  : exp.endDate || "N/A"}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                      {enrichmentData.experience.length > 3 && (
                        <p className="text-xs text-th-text-m">
                          +{enrichmentData.experience.length - 3} more positions
                        </p>
                      )}
                    </div>
                  </div>
                )}

              {/* Education */}
              {enrichmentData.education &&
                enrichmentData.education.length > 0 && (
                  <div>
                    <p className="text-xs text-th-text-t mb-2 flex items-center gap-1">
                      <Building24Regular className="w-3 h-3" /> Education
                    </p>
                    <div className="space-y-2">
                      {enrichmentData.education.slice(0, 2).map((edu, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2 bg-th-surface rounded-lg"
                        >
                          <div className="w-2 h-2 rounded-full mt-1.5 bg-blue-400" />
                          <div className="flex-1">
                            <p className="text-sm text-th-text font-medium">
                              {edu.school}
                            </p>
                            {(edu.degree || edu.field) && (
                              <p className="text-xs text-th-text-t">
                                {[edu.degree, edu.field]
                                  .filter(Boolean)
                                  .join(" in ")}
                              </p>
                            )}
                            {(edu.startYear || edu.endYear) && (
                              <p className="text-xs text-th-text-m">
                                {edu.startYear} - {edu.endYear || "Present"}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Ice Breakers */}
              {enrichmentData.iceBreakers &&
                enrichmentData.iceBreakers.length > 0 && (
                  <div>
                    <p className="text-xs text-th-text-t mb-2 flex items-center gap-1">
                      <Chat24Regular className="w-3 h-3" /> Conversation
                      Starters
                    </p>
                    <div className="space-y-2">
                      {enrichmentData.iceBreakers
                        .slice(0, 2)
                        .map((iceBreaker, i) => (
                          <div
                            key={i}
                            className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
                          >
                            <p className="text-xs text-th-text-s italic">
                              "{iceBreaker}"
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                navigator.clipboard.writeText(iceBreaker)
                              }
                              className="mt-1 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                            >
                              <Copy24Regular className="w-3 h-3" /> Copy
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </div>
          )}

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
              {t.onboarding?.bioPreview?.expand || "Expand"}
            </button>
          </div>

          {/* Bio Tabs */}
          <div className="flex gap-1 mb-3 p-1 bg-th-surface rounded-lg">
            <button
              type="button"
              onClick={() => setActiveBioTab("summary")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeBioTab === "summary"
                  ? "bg-emerald-500 text-white"
                  : "text-th-text-t hover:text-th-text hover:bg-th-surface"
              }`}
            >
              {t.onboarding?.cvBio?.summarized || "Summary"}
            </button>
            <button
              type="button"
              onClick={() => setActiveBioTab("full")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeBioTab === "full"
                  ? "bg-emerald-500 text-white"
                  : "text-th-text-t hover:text-th-text hover:bg-th-surface"
              }`}
            >
              {t.onboarding?.cvBio?.fullBio || "Full Bio"}
            </button>
          </div>

          {activeBioTab === "summary" ? (
            <>
              <textarea
                name="bioSummary"
                value={formData.bioSummary}
                onChange={handleInputChange}
                placeholder={
                  t.contacts?.form?.bioSummaryPlaceholder ||
                  "Brief summary about this contact..."
                }
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-th-text-m">
                  {t.contacts?.form?.bioSummaryTip || "Key highlights"}
                </span>
                <span
                  className={`text-xs ${formData.bioSummary.length > 450 ? "text-yellow-400" : "text-th-text-m"}`}
                >
                  {formData.bioSummary.length}/500
                </span>
              </div>
            </>
          ) : (
            <>
              <textarea
                name="bioFull"
                value={formData.bioFull}
                onChange={handleInputChange}
                placeholder={
                  t.contacts?.form?.bioFullPlaceholder ||
                  "Detailed background, experience, and achievements..."
                }
                rows={8}
                maxLength={2000}
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-th-text-m">
                  {t.contacts?.form?.bioFullTip || "Complete details"}
                </span>
                <span
                  className={`text-xs ${formData.bioFull.length > 1800 ? "text-yellow-400" : "text-th-text-m"}`}
                >
                  {formData.bioFull.length}/2000
                </span>
              </div>
            </>
          )}

          {aiSuggestions?.bio &&
            formData.bioSummary !== aiSuggestions.bio &&
            formData.bioFull !== aiSuggestions.bio && (
              <button
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    bioSummary: aiSuggestions.bio.slice(0, 500),
                    bioFull: aiSuggestions.bio,
                  }))
                }
                className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <LightbulbFilament24Regular className="w-3 h-3" />
                Use AI suggestion
              </button>
            )}
        </div>

        {/* Bio Preview Dialog */}
        <BioPreviewDialog
          isOpen={isBioDialogOpen}
          onClose={() => setIsBioDialogOpen(false)}
          bioSummary={formData.bioSummary}
          bioFull={formData.bioFull}
          activeBioTab={activeBioTab}
          onBioSummaryChange={(bio) =>
            setFormData((prev) => ({ ...prev, bioSummary: bio }))
          }
          onBioFullChange={(bio) =>
            setFormData((prev) => ({ ...prev, bioFull: bio }))
          }
          onBioTabChange={setActiveBioTab}
          t={t}
        />

        {/* Sectors with Custom Input */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-th-text-s flex items-center gap-2">
              {t.contacts?.form?.sectors || "Sectors"}
              {formData.sectorIds.length > 0 && (
                <span className="text-xs text-emerald-400">
                  ({formData.sectorIds.length})
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => setSectorsExpanded(!sectorsExpanded)}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              {sectorsExpanded ? (
                <>
                  <ChevronUp24Regular className="w-4 h-4" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown24Regular className="w-4 h-4" />
                  More
                </>
              )}
            </button>
          </div>

          {/* Autocomplete input for sectors */}
          <AutocompleteTagInput
            value={newSector}
            onChange={setNewSector}
            onAdd={(value) => {
              if (!formData.customSectors.includes(value)) {
                setFormData((prev) => ({
                  ...prev,
                  customSectors: [...prev.customSectors, value],
                }));
              }
            }}
            suggestions={[
              ...SECTOR_SUGGESTIONS,
              ...sectors.map((s) => s.name),
              ...(aiSuggestions?.sectors || []),
            ]}
            existingTags={formData.customSectors}
            placeholder="Add sector..."
            accentColor="purple"
            className="mb-3"
          />

          {/* Custom sectors */}
          {formData.customSectors.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.customSectors.map((sector, idx) => (
                <span
                  key={`custom-${idx}`}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full text-sm font-medium flex items-center gap-1"
                >
                  {sector}
                  <button
                    onClick={() => removeCustomSector(sector)}
                    className="hover:bg-th-surface-h rounded-full p-0.5"
                  >
                    <Dismiss24Regular className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* AI suggestions for sectors */}
          {aiSuggestions?.sectors && aiSuggestions.sectors.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-emerald-400 mb-2 flex items-center gap-1">
                <Sparkle24Regular className="w-3 h-3" />
                AI Suggestions:
              </p>
              <div className="flex flex-wrap gap-2">
                {aiSuggestions.sectors
                  .filter((s) => !formData.customSectors.includes(s))
                  .map((sector, idx) => (
                    <button
                      key={`ai-${idx}`}
                      onClick={() => applySuggestion("sector", sector)}
                      className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-sm text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                    >
                      + {sector}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Predefined sectors */}
          {sectors.length > 0 && (
            <div
              className={`flex flex-wrap gap-2 overflow-y-auto scrollbar-purple p-1 transition-all ${sectorsExpanded ? "max-h-96" : "max-h-32"}`}
            >
              {sectors.map((sector) => {
                const isSelected = formData.sectorIds.includes(sector.id);
                return (
                  <div key={sector.id} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleSector(sector.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white pe-7"
                          : "bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h"
                      }`}
                    >
                      {lang === "ar" && sector.nameAr
                        ? sector.nameAr
                        : sector.name}
                    </button>
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSector(sector.id);
                        }}
                        className="absolute top-1/2 -translate-y-1/2 end-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all"
                      >
                        <Dismiss24Regular className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Skills with Custom Input */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-th-text-s flex items-center gap-2">
              {t.contacts?.form?.skills || "Skills"}
              {formData.skillIds.length > 0 && (
                <span className="text-xs text-cyan-400">
                  ({formData.skillIds.length})
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => setSkillsExpanded(!skillsExpanded)}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              {skillsExpanded ? (
                <>
                  <ChevronUp24Regular className="w-4 h-4" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown24Regular className="w-4 h-4" />
                  More
                </>
              )}
            </button>
          </div>

          {/* Autocomplete input for skills */}
          <AutocompleteTagInput
            value={newSkill}
            onChange={setNewSkill}
            onAdd={(value) => {
              if (!formData.customSkills.includes(value)) {
                setFormData((prev) => ({
                  ...prev,
                  customSkills: [...prev.customSkills, value],
                }));
              }
            }}
            suggestions={[
              ...SKILL_SUGGESTIONS,
              ...skills.map((s) => s.name),
              ...(aiSuggestions?.skills || []),
            ]}
            existingTags={formData.customSkills}
            placeholder="Add skill..."
            accentColor="cyan"
            className="mb-3"
          />

          {/* Custom skills */}
          {formData.customSkills.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.customSkills.map((skill, idx) => (
                <span
                  key={`custom-${idx}`}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full text-sm font-medium flex items-center gap-1"
                >
                  {skill}
                  <button
                    onClick={() => removeCustomSkill(skill)}
                    className="hover:bg-th-surface-h rounded-full p-0.5"
                  >
                    <Dismiss24Regular className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* AI suggestions for skills */}
          {aiSuggestions?.skills && aiSuggestions.skills.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-cyan-400 mb-2 flex items-center gap-1">
                <Sparkle24Regular className="w-3 h-3" />
                AI Suggestions:
              </p>
              <div className="flex flex-wrap gap-2">
                {aiSuggestions.skills
                  .filter((s) => !formData.customSkills.includes(s))
                  .map((skill, idx) => (
                    <button
                      key={`ai-${idx}`}
                      onClick={() => applySuggestion("skill", skill)}
                      className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-sm text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                    >
                      + {skill}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Predefined skills */}
          {skills.length > 0 && (
            <div
              className={`flex flex-wrap gap-2 overflow-y-auto scrollbar-purple p-1 transition-all ${skillsExpanded ? "max-h-96" : "max-h-32"}`}
            >
              {skills.map((skill) => {
                const isSelected = formData.skillIds.includes(skill.id);
                return (
                  <div key={skill.id} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white pe-6"
                          : "bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h"
                      }`}
                    >
                      {lang === "ar" && skill.nameAr
                        ? skill.nameAr
                        : skill.name}
                    </button>
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSkill(skill.id);
                        }}
                        className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all"
                      >
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
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-th-text-s flex items-center gap-2">
              Interests
              {formData.interestIds.length > 0 && (
                <span className="text-xs text-yellow-400">
                  ({formData.interestIds.length})
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => setInterestsExpanded(!interestsExpanded)}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              {interestsExpanded ? (
                <>
                  <ChevronUp24Regular className="w-4 h-4" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown24Regular className="w-4 h-4" />
                  More
                </>
              )}
            </button>
          </div>

          {/* Autocomplete input for interests */}
          <AutocompleteTagInput
            value={newInterest}
            onChange={setNewInterest}
            onAdd={(value) => {
              if (!formData.customInterests.includes(value)) {
                setFormData((prev) => ({
                  ...prev,
                  customInterests: [...prev.customInterests, value],
                }));
              }
            }}
            suggestions={[
              ...INTEREST_SUGGESTIONS,
              ...interests.map((i) => i.name),
              ...(aiSuggestions?.interests || []),
            ]}
            existingTags={formData.customInterests}
            placeholder="Add interest..."
            accentColor="amber"
            className="mb-3"
          />

          {/* Custom interests */}
          {formData.customInterests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.customInterests.map((interest, idx) => (
                <span
                  key={`custom-${idx}`}
                  className="px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-lime-500 text-white rounded-full text-sm font-medium flex items-center gap-1"
                >
                  {interest}
                  <button
                    onClick={() => removeCustomInterest(interest)}
                    className="hover:bg-th-surface-h rounded-full p-0.5"
                  >
                    <Dismiss24Regular className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* AI suggestions for interests */}
          {aiSuggestions?.interests && aiSuggestions.interests.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-yellow-400 mb-2 flex items-center gap-1">
                <Sparkle24Regular className="w-3 h-3" />
                AI Suggestions:
              </p>
              <div className="flex flex-wrap gap-2">
                {aiSuggestions.interests
                  .filter((i) => !formData.customInterests.includes(i))
                  .map((interest, idx) => (
                    <button
                      key={`ai-${idx}`}
                      onClick={() => applySuggestion("interest", interest)}
                      className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-sm text-yellow-300 hover:bg-yellow-500/30 transition-colors"
                    >
                      + {interest}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Predefined interests */}
          {interests.length > 0 && (
            <div
              className={`flex flex-wrap gap-2 overflow-y-auto scrollbar-purple p-1 transition-all ${interestsExpanded ? "max-h-96" : "max-h-32"}`}
            >
              {interests.map((interest) => {
                const isSelected = formData.interestIds.includes(interest.id);
                return (
                  <div key={interest.id} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleInterest(interest.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-gradient-to-r from-yellow-500 to-lime-500 text-white pe-6"
                          : "bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h"
                      }`}
                    >
                      {lang === "ar" && interest.nameAr
                        ? interest.nameAr
                        : interest.name}
                    </button>
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleInterest(interest.id);
                        }}
                        className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all"
                      >
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
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-th-text-s flex items-center gap-2">
              Hobbies
              {formData.hobbyIds.length > 0 && (
                <span className="text-xs text-red-400">
                  ({formData.hobbyIds.length})
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => setHobbiesExpanded(!hobbiesExpanded)}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              {hobbiesExpanded ? (
                <>
                  <ChevronUp24Regular className="w-4 h-4" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown24Regular className="w-4 h-4" />
                  More
                </>
              )}
            </button>
          </div>

          {/* Autocomplete input for hobbies */}
          <AutocompleteTagInput
            value={newHobby}
            onChange={setNewHobby}
            onAdd={(value) => {
              if (!formData.customHobbies.includes(value)) {
                setFormData((prev) => ({
                  ...prev,
                  customHobbies: [...prev.customHobbies, value],
                }));
              }
            }}
            suggestions={[...HOBBY_SUGGESTIONS, ...hobbies.map((h) => h.name)]}
            existingTags={formData.customHobbies}
            placeholder="Add hobby..."
            accentColor="purple"
            className="mb-3"
          />

          {/* Custom hobbies */}
          {formData.customHobbies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.customHobbies.map((hobby, idx) => (
                <span
                  key={`custom-${idx}`}
                  className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-emerald-500 text-white rounded-full text-sm font-medium flex items-center gap-1"
                >
                  {hobby}
                  <button
                    onClick={() => removeCustomHobby(hobby)}
                    className="hover:bg-th-surface-h rounded-full p-0.5"
                  >
                    <Dismiss24Regular className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Predefined hobbies */}
          {hobbies.length > 0 && (
            <div
              className={`flex flex-wrap gap-2 overflow-y-auto scrollbar-purple p-1 transition-all ${hobbiesExpanded ? "max-h-96" : "max-h-32"}`}
            >
              {hobbies.map((hobby) => {
                const isSelected = formData.hobbyIds.includes(hobby.id);
                return (
                  <div key={hobby.id} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleHobby(hobby.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-gradient-to-r from-red-500 to-emerald-500 text-white pe-6"
                          : "bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h"
                      }`}
                    >
                      {lang === "ar" && hobby.nameAr
                        ? hobby.nameAr
                        : hobby.name}
                    </button>
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHobby(hobby.id);
                        }}
                        className="absolute top-1/2 -translate-y-1/2 end-1 w-4 h-4 flex items-center justify-center rounded-full bg-th-surface-h text-th-text hover:bg-th-surface-h transition-all"
                      >
                        <Dismiss24Regular className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveContact}
          disabled={isLoading || !formData.fullName.trim()}
          className="relative w-full group mt-4"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
          <span className="relative flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
            {isLoading ? (
              uploadProgress ? (
                <div className="flex flex-col items-center gap-1 py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>
                      {t.mediaNotes?.uploading || "Uploading"}{" "}
                      {uploadProgress.current}/{uploadProgress.total}
                    </span>
                  </div>
                  <div className="w-48 h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              )
            ) : (
              <>
                <Checkmark24Regular className="w-5 h-5" />
                {t.contacts?.form?.save || "Save Contact"}
              </>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
