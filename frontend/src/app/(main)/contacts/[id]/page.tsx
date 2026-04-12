/**
 * Contact Detail Page
 *
 * View and manage individual contact.
 */

"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";
import {
  Call24Regular,
  Mail24Regular,
  Edit24Regular,
  Delete24Regular,
  Star24Regular,
  Star24Filled,
  ChevronLeft24Regular,
  Checkmark20Regular,
  ArrowDownload24Regular,
  DocumentPdf24Regular,
  Image24Regular,
  Chat24Regular,
  ArrowSync24Regular,
  Add24Regular,
  TaskListSquareAdd24Regular,
  Clock24Regular,
  Mic24Regular,
  Play24Regular,
  Pause24Regular,
  Dismiss24Regular,
  DocumentText24Regular,
  Camera24Regular,
  Sparkle24Regular,
  PersonAvailable24Regular,
  Copy24Regular,
  Target24Regular,
  Building24Regular,
  Wrench24Regular,
  PeopleTeam24Regular,
  Heart24Regular,
  DataUsage24Regular,
  Info16Regular,
  Lightbulb24Regular,
  Checkmark24Regular,
  BrainCircuit24Regular,
  Share24Regular,
  CalendarClock24Regular,
  QrCode24Regular,
} from "@fluentui/react-icons";
import {
  deleteContact,
  getContact,
  updateContact,
  getContactTasks,
  deleteContactTask,
  ContactTask,
} from "@/lib/api/contacts";
import { getMatchDetails, MatchResult } from "@/lib/api/matches";
import { useItemizedMatch } from "@/hooks/itemized-matching";
import { ItemizedMatchCard } from "@/components/features/itemized-matching";
import {
  getProjects,
  getProjectMatches,
  updateMatchStatus,
  updateMatchIceBreakers as updateProjectIceBreakers,
  STAGE_OPTIONS,
  LOOKING_FOR_OPTIONS,
  type ProjectMatch,
  type MatchStatus,
} from "@/lib/api/projects";
import {
  listOpportunities,
  getOpportunityMatches,
  updateMatchStatus as updateOpportunityMatchStatus,
  updateMatchIceBreakers as updateOpportunityIceBreakers,
  type OpportunityMatch,
  type OpportunityMatchStatus,
} from "@/lib/api/opportunities";
import {
  getDeals,
  getDealResults,
  updateDealMatchStatus,
  type DealMatchResult,
  type DealMatchStatus,
  getCategoryLabel,
} from "@/lib/api/deals";
import {
  listPitches,
  getPitchResults,
  updateMatchStatus as updatePitchMatchStatus,
  type PitchMatch,
  type MatchStatus as PitchMatchStatus,
} from "@/lib/api/pitch";
import {
  ChevronDown24Regular,
  ChevronUp24Regular,
  Rocket24Regular,
  Handshake24Regular,
  Briefcase24Regular,
  SlideText24Regular,
  BookmarkAdd24Regular,
} from "@fluentui/react-icons";
import { api, getAccessToken } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";
import { createConversation } from "@/lib/api/messages";
import { TaskDialog } from "@/components/features/contacts/TaskDialog";

import { NoteDialog } from "@/components/features/contacts/NoteDialog";
import RadarChart from "@/components/RadarChart";
import {
  MatchActionBar,
  EditableIceBreakers,
} from "@/components/features/matches";
import { getMatchStrength } from "@/lib/utils/match-strength";

interface ContactNote {
  id: string;
  type: "TEXT" | "IMAGE" | "VOICE" | "FILE";
  content?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  createdAt: string;
}

/**
 * Icons - Styled to match the theme
 */
const PhoneIcon = () => <Call24Regular className="w-5 h-5 text-emerald-400" />;

const EmailIcon = () => <Mail24Regular className="w-5 h-5 text-emerald-400" />;

const SmsIcon = () => <Chat24Regular className="w-5 h-5 text-blue-400" />;

const WhatsAppIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const EditIcon = () => <Edit24Regular className="w-5 h-5" />;

const TrashIcon = () => <Delete24Regular className="w-5 h-5" />;

const StarIcon = ({ filled }: { filled?: boolean }) =>
  filled ? (
    <Star24Filled className="w-5 h-5" />
  ) : (
    <Star24Regular className="w-5 h-5" />
  );

/**
 * Info item component
 */
function InfoItem({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-th-surface-h transition-colors">
      <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-th-text-t font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm font-semibold text-th-text">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-inherit hover:text-inherit"
      >
        {content}
      </a>
    );
  }

  return content;
}

/**
 * Get match score color based on score value
 * Matches the color scheme used in the contacts list page
 */
function getScoreColor(
  score: number | undefined,
): "success" | "warning" | "error" | "neutral" {
  if (score === undefined || score === null) return "neutral";
  if (score >= 80) return "success"; // Green
  if (score >= 50) return "warning"; // Yellow
  if (score >= 20) return "error"; // Orange/Red
  return "neutral"; // Gray
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { user: authUser } = useAuth();
  const contactId = params.id as string;

  const [showQrPopup, setShowQrPopup] = useState(false);
  const [contact, setContact] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCardImage, setShowCardImage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [matchDetails, setMatchDetails] = useState<MatchResult | null>(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(false);
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);

  // Itemized matching hooks
  const {
    match: itemizedMatch,
    isLoading: isLoadingItemized,
    fetchMatch: fetchItemizedMatch,
  } = useItemizedMatch();
  const [isUpdatingMatchStatus, setIsUpdatingMatchStatus] = useState(false);
  const [copiedIceBreakerIdx, setCopiedIceBreakerIdx] = useState<number | null>(
    null,
  );
  const [isUpdatingOpportunityStatus, setIsUpdatingOpportunityStatus] =
    useState(false);
  const [isUpdatingPitchStatus, setIsUpdatingPitchStatus] = useState(false);
  const [isUpdatingDealStatus, setIsUpdatingDealStatus] = useState(false);

  // User's items for matching
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [userOpportunities, setUserOpportunities] = useState<any[]>([]);
  const [userDeals, setUserDeals] = useState<any[]>([]);
  const [userPitches, setUserPitches] = useState<any[]>([]);
  // All matches for this contact keyed by item ID
  const [allProjectMatches, setAllProjectMatches] = useState<
    Record<string, ProjectMatch | null>
  >({});
  const [allOpportunityMatches, setAllOpportunityMatches] = useState<
    Record<string, OpportunityMatch | null>
  >({});
  const [allPitchMatches, setAllPitchMatches] = useState<
    Record<string, PitchMatch | null>
  >({});
  const [allDealMatches, setAllDealMatches] = useState<
    Record<string, DealMatchResult | null>
  >({});
  const [isLoadingAllMatches, setIsLoadingAllMatches] = useState(false);

  // Sticky contact bar — scroll-based detection
  const [showStickyBar, setShowStickyBar] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contact) return;
    const handleScroll = () => {
      const el = profileRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Show sticky bar when the profile section scrolls above the header (56px)
      setShowStickyBar(rect.bottom < 56);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [contact]);

  // Accordion expanded states
  const [expandedSection, setExpandedSection] = useState<
    "profile" | "project" | "opportunity" | "pitch" | "deal" | null
  >(null);
  const [expandedSubItem, setExpandedSubItem] = useState<string | null>(null);

  // Refs for accordion sections (for scroll into view)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll to section when expanding
  const handleAccordionClick = (
    section: "profile" | "project" | "opportunity" | "pitch" | "deal",
  ) => {
    const isExpanding = expandedSection !== section;
    setExpandedSection(isExpanding ? section : null);
    if (!isExpanding) {
      setExpandedSubItem(null);
    } else {
      // Auto-expand the first sub-item (highest match score)
      const firstItemId =
        section === "project"
          ? sortedUserProjects[0]?.id
          : section === "opportunity"
            ? sortedUserOpportunities[0]?.id
            : section === "pitch"
              ? sortedUserPitches[0]?.id
              : section === "deal"
                ? sortedUserDeals[0]?.id
                : null;
      setExpandedSubItem(firstItemId || null);
    }

    if (isExpanding) {
      const ref = sectionRefs.current[section];
      if (ref) {
        setTimeout(() => {
          const rect = ref.getBoundingClientRect();
          const offset = 70; // header height + some padding
          window.scrollBy({ top: rect.top - offset, behavior: "instant" });
        }, 100);
      }
    }
  };

  // Handle sub-item accordion within a section
  const handleSubItemClick = (itemId: string, e?: React.MouseEvent) => {
    const isExpanding = expandedSubItem !== itemId;
    setExpandedSubItem(isExpanding ? itemId : null);
    if (isExpanding && e) {
      const el =
        (e.currentTarget as HTMLElement).closest("[data-subitem]") ||
        e.currentTarget;
      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        if (rect.top < 70) {
          window.scrollBy({ top: rect.top - 70, behavior: "instant" });
        }
      }, 100);
    }
  };

  // Start IntellMatch chat with linked user
  const handleStartIntellMatchChat = async () => {
    if (!linkedUserId) return;
    setIsStartingChat(true);
    try {
      const data = await createConversation(linkedUserId);
      router.push(`/messages/${data.id}`);
    } catch (error: any) {
      toast({
        title: t.common?.error || "Error",
        description: error.message || "Failed to start conversation",
        variant: "error",
      });
    } finally {
      setIsStartingChat(false);
    }
  };

  // Handle project match status change
  const handleProjectMatchStatusChange = async (
    projectId: string,
    matchId: string,
    status: MatchStatus,
  ) => {
    setIsUpdatingMatchStatus(true);
    try {
      await updateMatchStatus(projectId, matchId, status);
      setAllProjectMatches((prev) => {
        const match = prev[projectId];
        return match ? { ...prev, [projectId]: { ...match, status } } : prev;
      });
      toast({
        title: t.projects?.statusUpdated || "Status updated",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: t.common?.error || "Error",
        description: error.message,
        variant: "error",
      });
    } finally {
      setIsUpdatingMatchStatus(false);
    }
  };

  // Copy ice breaker text
  const handleCopyIceBreaker = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIceBreakerIdx(index);
    toast({ title: t.common?.copied || "Copied!", variant: "success" });
    setTimeout(() => setCopiedIceBreakerIdx(null), 2000);
  };

  // Handle opportunity match status change
  const handleOpportunityMatchStatusChange = async (
    opportunityId: string,
    matchId: string,
    status: OpportunityMatchStatus,
  ) => {
    setIsUpdatingOpportunityStatus(true);
    try {
      await updateOpportunityMatchStatus(opportunityId, matchId, status);
      setAllOpportunityMatches((prev) => {
        const match = prev[opportunityId];
        return match
          ? { ...prev, [opportunityId]: { ...match, status } }
          : prev;
      });
      toast({
        title: t.projects?.statusUpdated || "Status updated",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: t.common?.error || "Error",
        description: error.message,
        variant: "error",
      });
    } finally {
      setIsUpdatingOpportunityStatus(false);
    }
  };

  // Handle pitch match status change
  const handlePitchMatchStatusChange = async (
    pitchId: string,
    matchId: string,
    status: PitchMatchStatus,
  ) => {
    setIsUpdatingPitchStatus(true);
    try {
      await updatePitchMatchStatus(matchId, status);
      setAllPitchMatches((prev) => {
        const match = prev[pitchId];
        return match ? { ...prev, [pitchId]: { ...match, status } } : prev;
      });
      toast({
        title: t.projects?.statusUpdated || "Status updated",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: t.common?.error || "Error",
        description: error.message,
        variant: "error",
      });
    } finally {
      setIsUpdatingPitchStatus(false);
    }
  };

  // Handle deal match status change
  const handleDealMatchStatusChange = async (
    dealId: string,
    matchId: string,
    status: DealMatchStatus,
  ) => {
    setIsUpdatingDealStatus(true);
    try {
      await updateDealMatchStatus(matchId, { status });
      setAllDealMatches((prev) => {
        const match = prev[dealId];
        return match ? { ...prev, [dealId]: { ...match, status } } : prev;
      });
      toast({
        title: t.projects?.statusUpdated || "Status updated",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: t.common?.error || "Error",
        description: error.message,
        variant: "error",
      });
    } finally {
      setIsUpdatingDealStatus(false);
    }
  };

  // Tasks and Reminders state
  const [tasks, setTasks] = useState<ContactTask[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<ContactTask | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    caption?: string;
  } | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Handle avatar upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: t.common?.error || "Error",
        description: "Please select an image file",
        variant: "error",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t.common?.error || "Error",
        description: "File size must be less than 5MB",
        variant: "error",
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/avatar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("p2p_access_token")}`,
          },
          body: formData,
        },
      );

      const result = await response.json();
      if (result.success && result.data?.avatarUrl) {
        setContact((prev: any) =>
          prev ? { ...prev, avatarUrl: result.data.avatarUrl } : null,
        );
        toast({
          title: t.profile?.avatarUpdated || "Photo Updated",
          variant: "success",
        });
      } else {
        throw new Error(result.error?.message || "Failed to upload photo");
      }
    } catch (error: any) {
      toast({
        title: t.common?.error || "Error",
        description: error.message || "Failed to upload photo",
        variant: "error",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Fetch contact data and match details
  useEffect(() => {
    const fetchContact = async () => {
      try {
        setIsLoading(true);
        const data = await getContact(contactId);
        console.log(
          "Contact API response:",
          JSON.stringify(
            {
              sectors: data.sectors,
              skills: data.skills,
              interests: data.interests,
              bio: data.bio?.substring(0, 50),
            },
            null,
            2,
          ),
        );
        setContact({
          id: data.id,
          name: data.name || "Unknown",
          company: data.company || "",
          jobTitle: data.jobTitle || "",
          email: data.email || "",
          phone: data.phone || "",
          linkedIn: data.linkedInUrl || "",
          location: data.location || "",
          bio: data.bio || "",
          notes: data.notes || "",
          avatarUrl: data.avatarUrl || null,
          cardImageUrl: data.cardImageUrl || null,
          sectors: data.sectors?.map((s: any) => s.name) || [],
          skills: data.skills?.map((s: any) => s.name) || [],
          interests: data.interests?.map((i: any) => i.name) || [],
          matchScore: data.matchScore || 0,
          matchReasons: [],
          interactions: [],
          addedAt: data.createdAt
            ? new Date(data.createdAt).toLocaleDateString()
            : "",
          source:
            data.source === "CARD_SCAN"
              ? "Card Scan"
              : data.source === "IMPORT"
                ? "Import"
                : "Manual",
        });
        setIsFavorite(data.isFavorite || false);

        // Fetch fresh match score to sync with header
        try {
          const matchData = await getMatchDetails(contactId);
          if (matchData?.score !== undefined) {
            setMatchDetails(matchData);
            setContact((prev: any) =>
              prev ? { ...prev, matchScore: matchData.score } : null,
            );
          }
        } catch (matchError) {
          console.error("Error fetching match details:", matchError);
          // Non-blocking - contact data is still shown
        }

        // Auto-load itemized match (new matching system)
        fetchItemizedMatch(contactId);

        // Check if this contact is a registered IntellMatch user (by email)
        if (data.email) {
          try {
            const checkResult = await api.post<{ existingEmails: string[] }>(
              "/users/check-emails",
              { emails: [data.email] },
            );
            if (checkResult.existingEmails?.length > 0) {
              // Found a user with this email - get their userId
              const searchResult = await api.get<any[]>(
                `/users/search?q=${encodeURIComponent(data.email)}&limit=1`,
              );
              const matchedUser = searchResult?.find(
                (u: any) =>
                  u.email?.toLowerCase() === data.email?.toLowerCase(),
              );
              if (matchedUser) {
                setLinkedUserId(matchedUser.id);
              }
            }
          } catch (e) {
            // Non-blocking - just means we can't show the IntellMatch message button
          }
        }
      } catch (error) {
        console.error("Error fetching contact:", error);
        toast({
          title: t.common.error,
          description: "Failed to load contact",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (contactId) {
      fetchContact();
    }
  }, [contactId, t, fetchItemizedMatch]);

  // Fetch user's projects, opportunities, deals, pitches + all matches for this contact
  useEffect(() => {
    const fetchUserItems = async () => {
      try {
        const [projectsData, opportunitiesData, dealsData] = await Promise.all([
          getProjects(),
          listOpportunities({ status: "active" }),
          getDeals(),
        ]);

        const projects = projectsData.projects || [];
        const opportunities = opportunitiesData.opportunities || [];
        const deals = dealsData.deals || [];

        setUserProjects(projects);
        setUserOpportunities(opportunities);
        setUserDeals(deals);

        let pitches: any[] = [];
        try {
          const pitchesData = await listPitches({ status: "COMPLETED" });
          pitches = pitchesData.pitches || [];
          setUserPitches(pitches);
        } catch (pitchErr) {
          console.error("Error fetching pitches:", pitchErr);
        }

        // Fetch all matches for this contact across all items
        if (contactId) {
          setIsLoadingAllMatches(true);
          try {
            const [
              projectMatchResults,
              oppMatchResults,
              pitchMatchResults,
              dealMatchResults,
            ] = await Promise.all([
              Promise.all(
                projects.map(async (proj: any) => {
                  try {
                    const { matches } = await getProjectMatches(proj.id);
                    const found = matches.find(
                      (m) => m.matchedContact?.id === contactId,
                    );
                    return [proj.id, found || null] as [
                      string,
                      ProjectMatch | null,
                    ];
                  } catch {
                    return [proj.id, null] as [string, ProjectMatch | null];
                  }
                }),
              ),
              Promise.all(
                opportunities.map(async (opp: any) => {
                  try {
                    const { matches } = await getOpportunityMatches(opp.id);
                    const found = matches.find(
                      (m) =>
                        m.matchType === "contact" &&
                        m.candidate?.id === contactId,
                    );
                    return [opp.id, found || null] as [
                      string,
                      OpportunityMatch | null,
                    ];
                  } catch {
                    return [opp.id, null] as [string, OpportunityMatch | null];
                  }
                }),
              ),
              Promise.all(
                pitches.map(async (pitch: any) => {
                  try {
                    const { sections } = await getPitchResults(pitch.id, {
                      limit: 200,
                    });
                    let found: PitchMatch | null = null;
                    for (const section of sections) {
                      const match = section.matches?.find(
                        (m) => m.contact?.id === contactId,
                      );
                      if (match) {
                        found = match;
                        break;
                      }
                    }
                    return [pitch.id, found] as [string, PitchMatch | null];
                  } catch {
                    return [pitch.id, null] as [string, PitchMatch | null];
                  }
                }),
              ),
              Promise.all(
                deals.map(async (deal: any) => {
                  try {
                    const { results } = await getDealResults(deal.id, {
                      limit: 200,
                    });
                    const found = results.find(
                      (r) => r.contact?.id === contactId,
                    );
                    return [deal.id, found || null] as [
                      string,
                      DealMatchResult | null,
                    ];
                  } catch {
                    return [deal.id, null] as [string, DealMatchResult | null];
                  }
                }),
              ),
            ]);

            setAllProjectMatches(Object.fromEntries(projectMatchResults));
            setAllOpportunityMatches(Object.fromEntries(oppMatchResults));
            setAllPitchMatches(Object.fromEntries(pitchMatchResults));
            setAllDealMatches(Object.fromEntries(dealMatchResults));
          } catch (err) {
            console.error("Error fetching all matches:", err);
          } finally {
            setIsLoadingAllMatches(false);
          }
        }
      } catch (error) {
        console.error("Error fetching user items:", error);
      }
    };

    fetchUserItems();
  }, [contactId]);

  // Auto-expand section from query params (e.g. ?expand=project&item=abc123)
  useEffect(() => {
    if (isLoadingAllMatches) return;
    const expand = searchParams.get("expand") as typeof expandedSection;
    const item = searchParams.get("item");
    if (expand) {
      setExpandedSection(expand);
      if (item) {
        setExpandedSubItem(item);
      }
      // Scroll to the section after a short delay
      setTimeout(() => {
        const ref = sectionRefs.current[expand];
        if (ref) {
          ref.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 150);
      // Clean up URL params without navigation
      router.replace(`/contacts/${contactId}`, { scroll: false });
    }
  }, [isLoadingAllMatches, searchParams, contactId, router]);

  // Fetch match details
  const fetchMatchDetails = async (forceRefresh = false) => {
    if ((matchDetails && !forceRefresh) || isLoadingMatch) return;
    setIsLoadingMatch(true);
    try {
      const data = await getMatchDetails(contactId);
      setMatchDetails(data);
      // Sync the header match score with the freshly calculated score
      if (data?.score !== undefined) {
        setContact((prev: any) =>
          prev ? { ...prev, matchScore: data.score } : null,
        );
      }
    } catch (error) {
      console.error("Error fetching match details:", error);
      toast({
        title: t.common.error,
        description:
          t.contactDetails.match?.fetchError || "Failed to load match details",
        variant: "error",
      });
    } finally {
      setIsLoadingMatch(false);
    }
  };

  // Fetch tasks, reminders and notes
  const fetchTasksRemindersNotes = async () => {
    try {
      const [tasksData, notesData] = await Promise.all([
        getContactTasks(contactId),
        api.get<ContactNote[]>(`/contacts/${contactId}/notes`),
      ]);
      setTasks(tasksData);
      setNotes(notesData || []);
    } catch (error) {
      console.error("Error fetching tasks/notes:", error);
    }
  };

  // Fetch tasks, reminders and notes on mount
  useEffect(() => {
    if (contactId) {
      fetchTasksRemindersNotes();
    }
  }, [contactId]);

  // Play/pause audio note
  const playAudioNote = (noteId: string, url: string) => {
    if (playingAudio === noteId) {
      setPlayingAudio(null);
    } else {
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setPlayingAudio(noteId);
    }
  };

  // Delete note (called after confirmation)
  const deleteNote = async (noteId: string) => {
    try {
      await api.delete(`/contacts/${contactId}/notes/${noteId}`);
      setNotes(notes.filter((n) => n.id !== noteId));
      setDeletingNoteId(null);
      toast({ title: "Note deleted", variant: "success" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "error",
      });
    }
  };

  // Delete task handler (from TaskDialog)
  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteContactTask(contactId, taskId);
      setTasks(tasks.filter((t) => t.id !== taskId));
      setShowTaskDialog(false);
      toast({ title: "Task deleted", variant: "success" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "error",
      });
    }
  };

  // Task dialog handlers
  const handleAddTask = () => {
    setEditingTask(null);
    setShowTaskDialog(true);
  };

  const handleEditTask = (task: ContactTask) => {
    setEditingTask(task);
    setShowTaskDialog(true);
  };

  const handleTaskSuccess = (task: ContactTask) => {
    if (editingTask) {
      setTasks(tasks.map((t) => (t.id === task.id ? task : t)));
    } else {
      setTasks([...tasks, task]);
    }
  };

  // Note dialog handlers
  const handleAddNote = () => {
    setShowNoteDialog(true);
  };

  const handleNoteSuccess = (note: ContactNote) => {
    setNotes([...notes, note]);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteContact(contactId);
      toast({
        title: t.contactDetails.delete.success,
        description: t.contactDetails.delete.successDesc.replace(
          "{name}",
          contact?.name || "",
        ),
        variant: "success",
      });
      router.push("/contacts");
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast({
        title: t.common.error,
        description: t.contactDetails.delete.error,
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/export`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        },
      );

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contact?.name?.replace(/\s+/g, "_") || "contact"}.vcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: t.export?.success || "Export successful",
        description: t.export?.downloadStarted || "Download started",
        variant: "success",
      });
    } catch (error) {
      console.error("Error exporting contact:", error);
      toast({
        title: t.common.error,
        description: t.export?.error || "Failed to export contact",
        variant: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Compute section match counts and sorted order
  const sectionMatchData = useMemo(() => {
    const projectCount =
      Object.values(allProjectMatches).filter(Boolean).length;
    const oppCount = Object.values(allOpportunityMatches).filter(
      Boolean,
    ).length;
    const pitchCount = Object.values(allPitchMatches).filter(Boolean).length;
    const dealCount = Object.values(allDealMatches).filter(Boolean).length;

    const sections: Array<{
      type: "project" | "opportunity" | "pitch" | "deal";
      count: number;
    }> = [
      { type: "project", count: projectCount },
      { type: "opportunity", count: oppCount },
      { type: "pitch", count: pitchCount },
      { type: "deal", count: dealCount },
    ];

    return sections.sort((a, b) => b.count - a.count);
  }, [
    allProjectMatches,
    allOpportunityMatches,
    allPitchMatches,
    allDealMatches,
  ]);

  // Sort items within each section by match score (descending)
  const sortedUserProjects = useMemo(
    () =>
      [...userProjects].sort(
        (a, b) =>
          (allProjectMatches[b.id]?.matchScore || 0) -
          (allProjectMatches[a.id]?.matchScore || 0),
      ),
    [userProjects, allProjectMatches],
  );
  const sortedUserOpportunities = useMemo(
    () =>
      [...userOpportunities].sort(
        (a, b) =>
          (allOpportunityMatches[b.id]?.matchScore || 0) -
          (allOpportunityMatches[a.id]?.matchScore || 0),
      ),
    [userOpportunities, allOpportunityMatches],
  );
  const sortedUserPitches = useMemo(
    () =>
      [...userPitches].sort(
        (a, b) =>
          ((allPitchMatches[b.id] as any)?.score || 0) -
          ((allPitchMatches[a.id] as any)?.score || 0),
      ),
    [userPitches, allPitchMatches],
  );
  const sortedUserDeals = useMemo(
    () =>
      [...userDeals].sort(
        (a, b) =>
          ((allDealMatches[b.id] as any)?.score || 0) -
          ((allDealMatches[a.id] as any)?.score || 0),
      ),
    [userDeals, allDealMatches],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-th-text-t">Contact not found</p>
        <Link href="/contacts">
          <Button variant="secondary">Back to Contacts</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in -mx-4 sm:mx-0">
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-900/50 to-transparent px-4 pt-4 pb-8 -mt-4">
        <div className="flex justify-between items-start mb-4">
          <Link
            href="/contacts"
            className="p-2 -ms-2 rounded-lg hover:bg-th-surface-h transition-colors text-th-text"
          >
            <ChevronLeft24Regular className="w-6 h-6 rtl:rotate-180" />
          </Link>
          <div className="flex gap-2">
            {authUser?.phone && (
              <button
                type="button"
                onClick={() => setShowQrPopup(true)}
                className="p-2 rounded-lg text-th-text-t hover:bg-th-surface-h hover:text-th-text transition-colors"
                title="Share my contact"
              >
                <QrCode24Regular className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="p-2 rounded-lg text-th-text-t hover:bg-th-surface-h hover:text-th-text transition-colors disabled:opacity-50"
              title={t.export?.exportVCard || "Export vCard"}
            >
              {isExporting ? (
                <div className="w-5 h-5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowDownload24Regular className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                const newVal = !isFavorite;
                setIsFavorite(newVal);
                try {
                  await updateContact(contactId, { isFavorite: newVal });
                } catch {
                  setIsFavorite(!newVal); // revert on error
                }
              }}
              className={`p-2 rounded-lg transition-colors ${
                isFavorite
                  ? "text-yellow-400"
                  : "text-th-text-t hover:bg-th-surface-h"
              }`}
            >
              <StarIcon filled={isFavorite} />
            </button>
            <Link
              href={`/contacts/${contactId}/edit`}
              className="p-2 rounded-lg text-th-text-s hover:bg-th-surface-h transition-colors"
            >
              <EditIcon />
            </Link>
          </div>
        </div>

        {/* Profile */}
        <div
          ref={profileRef}
          className="flex flex-col items-center text-center"
        >
          <div className="relative mb-3" style={{ direction: "ltr" }}>
            <div className="p-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full">
              <Avatar src={contact.avatarUrl} name={contact.name} size="2xl" />
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-emerald-500 rounded-full cursor-pointer hover:bg-emerald-600 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                disabled={isUploadingAvatar}
              />
              {isUploadingAvatar ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Edit24Regular className="w-5 h-5 text-white" />
              )}
            </label>
          </div>
          <h1 className="text-2xl font-bold text-white">{contact.name}</h1>
          <p className="text-neutral-200">{contact.jobTitle}</p>
          <p className="text-white/60">{contact.company}</p>
        </div>
      </div>

      {/* Sticky contact bar - fixed to top on scroll */}
      <div
        className={`fixed top-14 left-0 right-0 z-30 bg-th-nav-bottom border-b border-th-border px-4 py-2 transition-all duration-200 ${
          showStickyBar
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
          <Avatar src={contact.avatarUrl} name={contact.name} size="sm" />
          <div className="min-w-0 text-center">
            <p className="text-sm font-semibold text-white truncate">
              {contact.name}
            </p>
            <p className="text-xs text-white/60 truncate">
              {contact.jobTitle}
              {contact.jobTitle && contact.company ? " · " : ""}
              {contact.company}
            </p>
          </div>
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex-shrink-0"
            >
              <Call24Regular className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex justify-center gap-4 px-4 flex-wrap">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            title={t.contactDetails?.actions?.call || "Call"}
            className="flex flex-col items-center gap-2 p-3 min-w-[72px] rounded-xl bg-th-surface backdrop-blur-sm border border-th-border hover:bg-th-surface-h hover:border-emerald-400/40 transition-all group active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/25 flex items-center justify-center group-hover:bg-emerald-500/35 transition-colors ring-1 ring-emerald-400/20">
              <PhoneIcon />
            </div>
            <span className="text-xs text-neutral-200 font-medium group-hover:text-th-text transition-colors">
              {t.contactDetails?.actions?.call || "Call"}
            </span>
          </a>
        )}
        {contact.phone && (
          <a
            href={`sms:${contact.phone}`}
            title={t.contactDetails?.actions?.message || "Message"}
            className="flex flex-col items-center gap-2 p-3 min-w-[72px] rounded-xl bg-th-surface backdrop-blur-sm border border-th-border hover:bg-th-surface-h hover:border-blue-400/40 transition-all group active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/25 flex items-center justify-center group-hover:bg-blue-500/35 transition-colors ring-1 ring-blue-400/20">
              <SmsIcon />
            </div>
            <span className="text-xs text-neutral-200 font-medium group-hover:text-th-text transition-colors">
              {t.contactDetails?.actions?.message || "SMS"}
            </span>
          </a>
        )}
        {contact.phone && (
          <a
            href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            title={t.contactDetails?.actions?.whatsapp || "WhatsApp"}
            className="flex flex-col items-center gap-2 p-3 min-w-[72px] rounded-xl bg-th-surface backdrop-blur-sm border border-th-border hover:bg-th-surface-h hover:border-green-400/40 transition-all group active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/25 flex items-center justify-center group-hover:bg-green-500/35 transition-colors text-green-400 ring-1 ring-green-400/20">
              <WhatsAppIcon />
            </div>
            <span className="text-xs text-neutral-200 font-medium group-hover:text-green-300 transition-colors">
              {t.contactDetails?.actions?.whatsapp || "WhatsApp"}
            </span>
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            title={t.contactDetails?.actions?.email || "Email"}
            className="flex flex-col items-center gap-2 p-3 min-w-[72px] rounded-xl bg-th-surface backdrop-blur-sm border border-th-border hover:bg-th-surface-h hover:border-emerald-400/40 transition-all group active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/25 flex items-center justify-center group-hover:bg-emerald-500/35 transition-colors ring-1 ring-emerald-400/20">
              <EmailIcon />
            </div>
            <span className="text-xs text-neutral-200 font-medium group-hover:text-th-text transition-colors">
              {t.contactDetails?.actions?.email || "Email"}
            </span>
          </a>
        )}
        {contact.linkedIn && (
          <a
            href={contact.linkedIn}
            target="_blank"
            rel="noopener noreferrer"
            title={t.contactDetails?.actions?.linkedin || "LinkedIn"}
            className="flex flex-col items-center gap-2 p-3 min-w-[72px] rounded-xl bg-th-surface backdrop-blur-sm border border-th-border hover:bg-th-surface-h hover:border-blue-400/40 transition-all group active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/25 flex items-center justify-center group-hover:bg-blue-500/35 transition-colors text-blue-400 ring-1 ring-blue-400/20">
              <LinkedInIcon />
            </div>
            <span className="text-xs text-neutral-200 font-medium group-hover:text-blue-300 transition-colors">
              {t.contactDetails?.actions?.linkedin || "LinkedIn"}
            </span>
          </a>
        )}
        {linkedUserId && (
          <button
            type="button"
            onClick={handleStartIntellMatchChat}
            disabled={isStartingChat}
            title="Message on IntellMatch"
            className="flex flex-col items-center gap-2 p-3 min-w-[72px] rounded-xl bg-th-surface backdrop-blur-sm border border-th-border hover:bg-th-surface-h hover:border-emerald-400/40 transition-all group active:scale-95 disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-500/30 flex items-center justify-center group-hover:from-emerald-500/40 group-hover:to-emerald-500/40 transition-colors ring-1 ring-emerald-400/30">
              <Sparkle24Regular className="w-5 h-5 text-emerald-300" />
            </div>
            <span className="text-xs text-neutral-200 font-medium group-hover:text-emerald-300 transition-colors">
              IntellMatch
            </span>
          </button>
        )}
      </div>

      {/* Tabs - Match tab is default */}
      <div className="px-4">
        <Tabs defaultValue="match">
          <TabsList className="w-full flex gap-2 bg-th-surface border border-th-border rounded-xl p-1.5">
            <TabsTrigger
              value="match"
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border-none text-th-text-t hover:text-white hover:bg-th-surface-h data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/30"
            >
              {t.contactDetails.tabs.match}
            </TabsTrigger>
            <TabsTrigger
              value="info"
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border-none text-th-text-t hover:text-white hover:bg-th-surface-h data-[state=active]:bg-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-500/30"
            >
              {t.contactDetails.tabs.info}
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border-none text-th-text-t hover:text-white hover:bg-th-surface-h data-[state=active]:bg-green-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/30"
            >
              {t.contactDetails.tabs.activity}
            </TabsTrigger>
          </TabsList>

          {/* Info tab */}
          <TabsContent value="info">
            <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl">
              <div className="divide-y divide-th-border">
                {contact.email && (
                  <InfoItem
                    icon={<EmailIcon />}
                    label={t.contactDetails.labels.email}
                    value={contact.email}
                    href={`mailto:${contact.email}`}
                  />
                )}
                {contact.phone && (
                  <InfoItem
                    icon={<PhoneIcon />}
                    label={t.contactDetails.labels.phone}
                    value={contact.phone}
                    href={`tel:${contact.phone}`}
                  />
                )}
                {contact.linkedIn && (
                  <InfoItem
                    icon={<LinkedInIcon />}
                    label={t.contactDetails.labels.linkedin}
                    value={t.contactDetails.labels.viewProfile}
                    href={contact.linkedIn}
                  />
                )}
              </div>
            </div>

            {/* Bio */}
            {contact.bio && (
              <div className="mt-3 bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
                <h3 className="text-base font-semibold text-th-text mb-2 flex items-center gap-2">
                  <div className="w-1 h-4 bg-cyan-400 rounded-full" />
                  {t.contactDetails.labels.about}
                </h3>
                <p className="text-sm text-neutral-200 leading-relaxed">
                  {contact.bio}
                </p>
              </div>
            )}

            {/* Experience & Education (from enrichmentData) */}
            {contact.enrichmentData &&
              (contact.enrichmentData.experience?.length > 0 ||
                contact.enrichmentData.education?.length > 0) && (
                <div className="mt-3 bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkle24Regular className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-semibold text-th-text">
                      Career & Education
                    </h3>
                    {contact.enrichmentData.employmentVerification?.status ===
                      "CURRENT" && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">
                        Verified
                      </span>
                    )}
                    {contact.enrichmentData.employmentVerification?.status ===
                      "CHANGED" && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
                        Job Changed
                      </span>
                    )}
                  </div>

                  {/* Experience */}
                  {contact.enrichmentData.experience?.length > 0 && (
                    <div>
                      <p className="text-xs text-green-300 mb-2 flex items-center gap-1 font-medium">
                        <Briefcase24Regular className="w-4 h-4" /> Experience
                      </p>
                      <div className="space-y-2">
                        {contact.enrichmentData.experience
                          .slice(0, 4)
                          .map((exp: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 p-2.5 bg-th-surface border border-th-border rounded-lg"
                            >
                              <div
                                className={`w-2 h-2 rounded-full mt-1.5 ${exp.isCurrent ? "bg-green-400" : "bg-neutral-400"}`}
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
                        {contact.enrichmentData.experience.length > 4 && (
                          <p className="text-xs text-th-text-m">
                            +{contact.enrichmentData.experience.length - 4} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {contact.enrichmentData.education?.length > 0 && (
                    <div>
                      <p className="text-xs text-blue-300 mb-2 flex items-center gap-1 font-medium">
                        <Building24Regular className="w-4 h-4" /> Education
                      </p>
                      <div className="space-y-2">
                        {contact.enrichmentData.education
                          .slice(0, 3)
                          .map((edu: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 p-2.5 bg-th-surface border border-th-border rounded-lg"
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
                  {contact.enrichmentData.iceBreakers?.length > 0 && (
                    <div>
                      <p className="text-xs text-emerald-300 mb-2 flex items-center gap-1 font-medium">
                        <Chat24Regular className="w-4 h-4" /> Conversation
                        Starters
                      </p>
                      <div className="space-y-2">
                        {contact.enrichmentData.iceBreakers
                          .slice(0, 2)
                          .map((iceBreaker: string, i: number) => (
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

            {/* Employment Change Warning */}
            {contact.enrichmentData?.employmentVerification?.status ===
              "CHANGED" && (
              <div className="mt-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Sparkle24Regular className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-300 mb-1">
                      Employment Changed
                    </h4>
                    <p className="text-sm text-th-text-s">
                      Card showed{" "}
                      <span className="text-th-text font-medium">
                        {
                          contact.enrichmentData.employmentVerification.cardData
                            ?.company
                        }
                      </span>
                      , but now at{" "}
                      <span className="text-th-text font-medium">
                        {
                          contact.enrichmentData.employmentVerification
                            .verifiedData?.company
                        }
                      </span>
                      {contact.enrichmentData.employmentVerification
                        .verifiedData?.jobTitle && (
                        <>
                          {" "}
                          as{" "}
                          <span className="text-th-text font-medium">
                            {
                              contact.enrichmentData.employmentVerification
                                .verifiedData.jobTitle
                            }
                          </span>
                        </>
                      )}
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Personal Notes */}
            {contact.notes && (
              <div className="mt-3 bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
                <h3 className="text-base font-semibold text-th-text mb-2 flex items-center gap-2">
                  <DocumentText24Regular className="w-5 h-5 text-blue-400" />
                  {t.contacts?.form?.notes || "Notes"}
                </h3>
                <p className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
                  {contact.notes}
                </p>
              </div>
            )}

            {/* Sectors & Skills */}
            <div className="mt-3 bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 space-y-4">
              {contact.sectors.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-emerald-300 mb-2 flex items-center gap-1.5">
                    <div className="w-1 h-3.5 bg-emerald-400 rounded-full" />
                    {t.contactDetails.labels.sectors}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {contact.sectors.map((sector: string) => (
                      <span
                        key={sector}
                        className="px-3 py-1 rounded-full text-sm bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-medium"
                      >
                        {sector}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {contact.skills.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-cyan-300 mb-2 flex items-center gap-1.5">
                    <div className="w-1 h-3.5 bg-cyan-400 rounded-full" />
                    {t.contactDetails.labels.skills}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {contact.skills.map((skill: string) => (
                      <span
                        key={skill}
                        className="px-3 py-1 rounded-full text-sm bg-cyan-500/15 text-cyan-200 border border-cyan-500/25 font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {contact.interests.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-emerald-300 mb-2 flex items-center gap-1.5">
                    <div className="w-1 h-3.5 bg-emerald-400 rounded-full" />
                    {t.contactDetails.labels.interests}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {contact.interests.map((interest: string) => (
                      <span
                        key={interest}
                        className="px-3 py-1 rounded-full text-sm bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-medium"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Scanned Business Card Image */}
            {contact.cardImageUrl && (
              <div className="mt-3 bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-th-text flex items-center gap-2">
                    <Image24Regular className="w-5 h-5 text-emerald-400" />
                    {t.contactDetails.labels?.businessCard || "Business Card"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCardImage(!showCardImage)}
                    className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {showCardImage
                      ? t.common.hide || "Hide"
                      : t.common.show || "Show"}
                  </button>
                </div>
                {showCardImage && (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/20">
                    {contact.cardImageUrl.startsWith("data:") ? (
                      <img
                        src={contact.cardImageUrl}
                        alt="Business Card"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Image
                        src={contact.cardImageUrl}
                        alt="Business Card"
                        fill
                        className="object-contain"
                      />
                    )}
                  </div>
                )}
                {!showCardImage && (
                  <p className="text-sm text-th-text-m">
                    {t.contactDetails.labels?.cardFromScan ||
                      "This contact was added from a scanned business card"}
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          {/* Match tab - Accordion Sections (sorted by match count, profile last) */}
          <TabsContent value="match">
            <div className="space-y-3">
              {isLoadingAllMatches ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
                </div>
              ) : (
                <>
                  {/* Dynamic sections sorted by match count */}
                  {sectionMatchData.map(({ type, count }) => {
                    if (type === "project")
                      return (
                        <div
                          key="project"
                          ref={(el) => {
                            sectionRefs.current["project"] = el;
                          }}
                          className="bg-th-surface border border-th-border rounded-xl overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => handleAccordionClick("project")}
                            className="w-full flex items-center gap-3 p-4 hover:bg-th-surface transition-colors"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center ring-1 ring-blue-500/20">
                              <Rocket24Regular className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="flex-1 text-left">
                              <h3 className="font-semibold text-th-text">
                                {t.contacts?.matchDetails?.projectMatch ||
                                  "Smart Project Match"}
                              </h3>
                              <p className="text-xs text-th-text-s">
                                {t.contacts?.matchDetails?.projectMatchDesc ||
                                  "AI-powered criteria based on your project needs"}
                              </p>
                            </div>
                            {count > 0 && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">
                                {count}
                              </span>
                            )}
                            {expandedSection === "project" ? (
                              <ChevronUp24Regular className="w-5 h-5 text-th-text-t" />
                            ) : (
                              <ChevronDown24Regular className="w-5 h-5 text-th-text-t" />
                            )}
                          </button>
                          {expandedSection === "project" && (
                            <div className="px-4 pb-4 border-t border-th-border">
                              {userProjects.length === 0 ? (
                                <div className="text-center py-8">
                                  <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                                    <Rocket24Regular className="w-8 h-8 text-blue-400/40" />
                                  </div>
                                  <p className="text-th-text-m mb-1 font-medium">
                                    {t.contacts?.matchDetails?.noProjects ||
                                      "No projects yet"}
                                  </p>
                                  <p className="text-th-text-t text-xs mb-4">
                                    Create a project to see smart matches based
                                    on what you need
                                  </p>
                                  <Link
                                    href="/collaboration"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm font-medium"
                                  >
                                    <Add24Regular className="w-4 h-4" />
                                    {t.contacts?.matchDetails?.createProject ||
                                      "Create Project"}
                                  </Link>
                                </div>
                              ) : (
                                <div className="pt-3 space-y-2">
                                  {sortedUserProjects.map((proj: any) => {
                                    const match = allProjectMatches[proj.id];
                                    const isExpanded =
                                      expandedSubItem === proj.id;
                                    return (
                                      <div
                                        key={proj.id}
                                        data-subitem
                                        className="border border-th-border rounded-lg overflow-hidden"
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) =>
                                            handleSubItemClick(proj.id, e)
                                          }
                                          className="w-full flex items-center gap-2 p-3 hover:bg-th-surface-h transition-colors"
                                        >
                                          <span className="flex-1 text-left text-sm font-medium text-th-text truncate">
                                            {proj.title}
                                          </span>
                                          {match &&
                                            (() => {
                                              const s = getMatchStrength(
                                                match.matchScore,
                                              );
                                              return (
                                                <span
                                                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.badgeClass}`}
                                                >
                                                  {match.matchScore}% -{" "}
                                                  {s.label}
                                                </span>
                                              );
                                            })()}
                                          {!match && (
                                            <span className="text-xs text-th-text-t">
                                              No match
                                            </span>
                                          )}
                                          {isExpanded ? (
                                            <ChevronUp24Regular className="w-4 h-4 text-th-text-t flex-shrink-0" />
                                          ) : (
                                            <ChevronDown24Regular className="w-4 h-4 text-th-text-t flex-shrink-0" />
                                          )}
                                        </button>
                                        {isExpanded && (
                                          <div className="px-3 pb-3 border-t border-th-border">
                                            {match ? (
                                              (() => {
                                                const stageLabel =
                                                  STAGE_OPTIONS.find(
                                                    (s) => s.id === proj.stage,
                                                  )?.label ||
                                                  proj.stage ||
                                                  "";
                                                const lookingForLabels = (
                                                  proj.lookingFor || []
                                                ).map(
                                                  (id: string) =>
                                                    LOOKING_FOR_OPTIONS.find(
                                                      (o) => o.id === id,
                                                    )?.label || id,
                                                );
                                                const iceBreakersSource =
                                                  (match as any)
                                                    .suggestedMessageEdited ||
                                                  match.suggestedMessage ||
                                                  "";
                                                const iceBreakers =
                                                  iceBreakersSource
                                                    .split("\n")
                                                    .filter(Boolean);
                                                return (
                                                  <div className="space-y-4 pt-3">
                                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5">
                                                      <h4 className="text-xs font-medium text-emerald-400 mb-2">
                                                        {t.projects
                                                          ?.projectContext ||
                                                          "Project Context"}
                                                      </h4>
                                                      <p className="text-sm text-neutral-200 mb-2">
                                                        {proj.title}
                                                      </p>
                                                      <div className="flex flex-wrap gap-1.5">
                                                        {stageLabel && (
                                                          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                            {stageLabel}
                                                          </span>
                                                        )}
                                                        {lookingForLabels
                                                          .slice(0, 2)
                                                          .map(
                                                            (
                                                              label: string,
                                                              i: number,
                                                            ) => (
                                                              <span
                                                                key={i}
                                                                className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30"
                                                              >
                                                                {label}
                                                              </span>
                                                            ),
                                                          )}
                                                      </div>
                                                    </div>
                                                    {(match.sharedSectors
                                                      .length > 0 ||
                                                      match.sharedSkills
                                                        .length > 0) && (
                                                      <div>
                                                        <h4 className="text-xs font-medium text-th-text-t mb-2">
                                                          {t.projects
                                                            ?.sharedExpertise ||
                                                            "Shared Expertise"}
                                                        </h4>
                                                        <div className="flex flex-wrap gap-1.5">
                                                          {match.sharedSectors.map(
                                                            (s, i) => (
                                                              <span
                                                                key={`s-${i}`}
                                                                className="px-2.5 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                                              >
                                                                {s}
                                                              </span>
                                                            ),
                                                          )}
                                                          {match.sharedSkills.map(
                                                            (s, i) => (
                                                              <span
                                                                key={`sk-${i}`}
                                                                className="px-2.5 py-1 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30"
                                                              >
                                                                {s}
                                                              </span>
                                                            ),
                                                          )}
                                                        </div>
                                                      </div>
                                                    )}
                                                    {Array.isArray(
                                                      match.reasons,
                                                    ) &&
                                                      match.reasons.length >
                                                        0 && (
                                                        <div>
                                                          <h4 className="text-xs font-medium text-th-text-t mb-2.5">
                                                            {t.projectMatches
                                                              ?.whyGoodMatch ||
                                                              "Why This Is a Good Match"}
                                                          </h4>
                                                          <div className="space-y-2">
                                                            {match.reasons.map(
                                                              (reason, i) => (
                                                                <div
                                                                  key={i}
                                                                  className="flex items-start gap-2"
                                                                >
                                                                  <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                                                  <span className="text-[13px] text-th-text-s">
                                                                    {reason}
                                                                  </span>
                                                                </div>
                                                              ),
                                                            )}
                                                          </div>
                                                        </div>
                                                      )}
                                                    <EditableIceBreakers
                                                      iceBreakers={iceBreakers}
                                                      accentColor="purple"
                                                      label={
                                                        t.projectMatches
                                                          ?.iceBreakers ||
                                                        "Ice Breakers"
                                                      }
                                                      onSave={async (text) => {
                                                        await updateProjectIceBreakers(
                                                          proj.id,
                                                          match.id,
                                                          text,
                                                        );
                                                      }}
                                                    />
                                                    <MatchActionBar
                                                      currentStatus={
                                                        match.status
                                                      }
                                                      contactName={
                                                        contact.fullName
                                                      }
                                                      channels={{
                                                        intellmatchUserId:
                                                          linkedUserId,
                                                        phone: contact.phone,
                                                        email: contact.email,
                                                        linkedinUrl:
                                                          contact.linkedinUrl,
                                                      }}
                                                      onStatusChange={(
                                                        status,
                                                      ) =>
                                                        handleProjectMatchStatusChange(
                                                          proj.id,
                                                          match.id,
                                                          status as MatchStatus,
                                                        )
                                                      }
                                                      isUpdating={
                                                        isUpdatingMatchStatus
                                                      }
                                                      dismissStatus="DISMISSED"
                                                      t={t}
                                                    />
                                                  </div>
                                                );
                                              })()
                                            ) : (
                                              <div className="text-center py-4">
                                                <p className="text-th-text-t text-sm">
                                                  No match found.
                                                </p>
                                                <p className="text-th-text-m text-xs">
                                                  Run &quot;Find Matches&quot;
                                                  from the project page first.
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );

                    if (type === "opportunity")
                      return (
                        <div
                          key="opportunity"
                          ref={(el) => {
                            sectionRefs.current["opportunity"] = el;
                          }}
                          className="bg-th-surface border border-th-border rounded-xl overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => handleAccordionClick("opportunity")}
                            className="w-full flex items-center gap-3 p-4 hover:bg-th-surface transition-colors"
                          >
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                              <Briefcase24Regular className="w-5 h-5 text-green-400" />
                            </div>
                            <div className="flex-1 text-left">
                              <h3 className="font-semibold text-th-text">
                                {t.contacts?.matchDetails?.opportunityMatch ||
                                  "Opportunity Match"}
                              </h3>
                              <p className="text-xs text-th-text-s">
                                {t.contacts?.matchDetails
                                  ?.opportunityMatchDesc ||
                                  "Hiring or job opportunity fit"}
                              </p>
                            </div>
                            {count > 0 && (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                                {count}
                              </span>
                            )}
                            {expandedSection === "opportunity" ? (
                              <ChevronUp24Regular className="w-5 h-5 text-th-text-t" />
                            ) : (
                              <ChevronDown24Regular className="w-5 h-5 text-th-text-t" />
                            )}
                          </button>
                          {expandedSection === "opportunity" && (
                            <div className="px-4 pb-4 border-t border-th-border">
                              {userOpportunities.length === 0 ? (
                                <div className="text-center py-8">
                                  <Briefcase24Regular className="w-10 h-10 text-green-400/30 mx-auto mb-3" />
                                  <p className="text-th-text-m mb-3">
                                    {t.contacts?.matchDetails?.noOpportunity ||
                                      "Set your opportunity intent"}
                                  </p>
                                  <Link
                                    href="/opportunities"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                                  >
                                    <Add24Regular className="w-4 h-4" />
                                    {t.contacts?.matchDetails
                                      ?.setupOpportunity || "Setup Intent"}
                                  </Link>
                                </div>
                              ) : (
                                <div className="pt-3 space-y-2">
                                  {sortedUserOpportunities.map((opp: any) => {
                                    const match = allOpportunityMatches[opp.id];
                                    const isExpanded =
                                      expandedSubItem === opp.id;
                                    return (
                                      <div
                                        key={opp.id}
                                        data-subitem
                                        className="border border-th-border rounded-lg overflow-hidden"
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) =>
                                            handleSubItemClick(opp.id, e)
                                          }
                                          className="w-full flex items-center gap-2 p-3 hover:bg-th-surface-h transition-colors"
                                        >
                                          <span className="flex-1 text-left text-sm font-medium text-th-text truncate">
                                            {opp.title}
                                          </span>
                                          {match &&
                                            (() => {
                                              const s = getMatchStrength(
                                                match.matchScore,
                                              );
                                              return (
                                                <span
                                                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.badgeClass}`}
                                                >
                                                  {match.matchScore}% -{" "}
                                                  {s.label}
                                                </span>
                                              );
                                            })()}
                                          {!match && (
                                            <span className="text-xs text-th-text-t">
                                              No match
                                            </span>
                                          )}
                                          {isExpanded ? (
                                            <ChevronUp24Regular className="w-4 h-4 text-th-text-t flex-shrink-0" />
                                          ) : (
                                            <ChevronDown24Regular className="w-4 h-4 text-th-text-t flex-shrink-0" />
                                          )}
                                        </button>
                                        {isExpanded && (
                                          <div className="px-3 pb-3 border-t border-th-border">
                                            {match ? (
                                              (() => {
                                                const oppIceBreakersSource =
                                                  (match as any)
                                                    .suggestedMessageEdited ||
                                                  match.suggestedMessage ||
                                                  "";
                                                const oppIceBreakers =
                                                  oppIceBreakersSource
                                                    .split("\n")
                                                    .filter(Boolean);
                                                return (
                                                  <div className="space-y-4 pt-3">
                                                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3.5">
                                                      <h4 className="text-xs font-medium text-green-400 mb-2">
                                                        Opportunity Context
                                                      </h4>
                                                      <p className="text-sm text-neutral-200 mb-2">
                                                        {opp.title}
                                                      </p>
                                                      {match.intentAlignment && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                                                          {
                                                            match.intentAlignment
                                                          }
                                                        </span>
                                                      )}
                                                    </div>
                                                    {(match.sharedSectors
                                                      .length > 0 ||
                                                      match.sharedSkills
                                                        .length > 0) && (
                                                      <div>
                                                        <h4 className="text-xs font-medium text-th-text-t mb-2">
                                                          {t.projects
                                                            ?.sharedExpertise ||
                                                            "Shared Expertise"}
                                                        </h4>
                                                        <div className="flex flex-wrap gap-1.5">
                                                          {match.sharedSectors.map(
                                                            (s, i) => (
                                                              <span
                                                                key={`s-${i}`}
                                                                className="px-2.5 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                                              >
                                                                {s}
                                                              </span>
                                                            ),
                                                          )}
                                                          {match.sharedSkills.map(
                                                            (s, i) => (
                                                              <span
                                                                key={`sk-${i}`}
                                                                className="px-2.5 py-1 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30"
                                                              >
                                                                {s}
                                                              </span>
                                                            ),
                                                          )}
                                                        </div>
                                                      </div>
                                                    )}
                                                    {Array.isArray(
                                                      match.reasons,
                                                    ) &&
                                                      match.reasons.length >
                                                        0 && (
                                                        <div>
                                                          <h4 className="text-xs font-medium text-th-text-t mb-2.5">
                                                            {t.projectMatches
                                                              ?.whyGoodMatch ||
                                                              "Why This Is a Good Match"}
                                                          </h4>
                                                          <div className="space-y-2">
                                                            {match.reasons.map(
                                                              (reason, i) => (
                                                                <div
                                                                  key={i}
                                                                  className="flex items-start gap-2"
                                                                >
                                                                  <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                                                  <span className="text-[13px] text-th-text-s">
                                                                    {reason}
                                                                  </span>
                                                                </div>
                                                              ),
                                                            )}
                                                          </div>
                                                        </div>
                                                      )}
                                                    <EditableIceBreakers
                                                      iceBreakers={
                                                        oppIceBreakers
                                                      }
                                                      accentColor="green"
                                                      label={
                                                        t.projectMatches
                                                          ?.iceBreakers ||
                                                        "Ice Breakers"
                                                      }
                                                      onSave={async (text) => {
                                                        await updateOpportunityIceBreakers(
                                                          opp.id,
                                                          match.id,
                                                          text,
                                                        );
                                                      }}
                                                    />
                                                    <MatchActionBar
                                                      currentStatus={
                                                        match.status
                                                      }
                                                      contactName={
                                                        contact.fullName
                                                      }
                                                      channels={{
                                                        intellmatchUserId:
                                                          linkedUserId,
                                                        phone: contact.phone,
                                                        email: contact.email,
                                                        linkedinUrl:
                                                          contact.linkedinUrl,
                                                      }}
                                                      onStatusChange={(
                                                        status,
                                                      ) =>
                                                        handleOpportunityMatchStatusChange(
                                                          opp.id,
                                                          match.id,
                                                          status as OpportunityMatchStatus,
                                                        )
                                                      }
                                                      isUpdating={
                                                        isUpdatingOpportunityStatus
                                                      }
                                                      dismissStatus="DISMISSED"
                                                      t={t}
                                                    />
                                                  </div>
                                                );
                                              })()
                                            ) : (
                                              <div className="text-center py-4">
                                                <p className="text-th-text-t text-sm">
                                                  No match found.
                                                </p>
                                                <p className="text-th-text-m text-xs">
                                                  Run &quot;Find Matches&quot;
                                                  from the opportunity page
                                                  first.
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );

                    if (type === "pitch")
                      return (
                        <div
                          key="pitch"
                          ref={(el) => {
                            sectionRefs.current["pitch"] = el;
                          }}
                          className="bg-th-surface border border-th-border rounded-xl overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => handleAccordionClick("pitch")}
                            className="w-full flex items-center gap-3 p-4 hover:bg-th-surface transition-colors"
                          >
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                              <SlideText24Regular className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="flex-1 text-left">
                              <h3 className="font-semibold text-th-text">
                                {t.contacts?.matchDetails?.pitchMatch ||
                                  "Pitch Match"}
                              </h3>
                              <p className="text-xs text-th-text-s">
                                {t.contacts?.matchDetails?.pitchMatchDesc ||
                                  "How your pitch aligns with this contact"}
                              </p>
                            </div>
                            {count > 0 && (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-medium">
                                {count}
                              </span>
                            )}
                            {expandedSection === "pitch" ? (
                              <ChevronUp24Regular className="w-5 h-5 text-th-text-t" />
                            ) : (
                              <ChevronDown24Regular className="w-5 h-5 text-th-text-t" />
                            )}
                          </button>
                          {expandedSection === "pitch" && (
                            <div className="px-4 pb-4 border-t border-th-border">
                              {userPitches.length === 0 ? (
                                <div className="text-center py-8">
                                  <SlideText24Regular className="w-10 h-10 text-emerald-400/30 mx-auto mb-3" />
                                  <p className="text-th-text-m mb-3">
                                    {t.contacts?.matchDetails?.noPitches ||
                                      "Upload a pitch to see matches"}
                                  </p>
                                  <Link
                                    href="/pitch"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                                  >
                                    <Add24Regular className="w-4 h-4" />
                                    {t.contacts?.matchDetails?.uploadPitch ||
                                      "Upload Pitch"}
                                  </Link>
                                </div>
                              ) : (
                                <div className="pt-3 space-y-2">
                                  {sortedUserPitches.map((pitch: any) => {
                                    const match = allPitchMatches[pitch.id];
                                    const isExpanded =
                                      expandedSubItem === pitch.id;
                                    return (
                                      <div
                                        key={pitch.id}
                                        data-subitem
                                        className="border border-th-border rounded-lg overflow-hidden"
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) =>
                                            handleSubItemClick(pitch.id, e)
                                          }
                                          className="w-full flex items-center gap-2 p-3 hover:bg-th-surface-h transition-colors"
                                        >
                                          <span className="flex-1 text-left text-sm font-medium text-th-text truncate">
                                            {pitch.title ||
                                              pitch.fileName ||
                                              "Pitch"}
                                          </span>
                                          {match &&
                                            (() => {
                                              const s = getMatchStrength(
                                                match.score,
                                              );
                                              return (
                                                <span
                                                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.badgeClass}`}
                                                >
                                                  {match.score}% - {s.label}
                                                </span>
                                              );
                                            })()}
                                          {!match && (
                                            <span className="text-xs text-th-text-t">
                                              No match
                                            </span>
                                          )}
                                          {isExpanded ? (
                                            <ChevronUp24Regular className="w-4 h-4 text-th-text-t flex-shrink-0" />
                                          ) : (
                                            <ChevronDown24Regular className="w-4 h-4 text-th-text-t flex-shrink-0" />
                                          )}
                                        </button>
                                        {isExpanded && (
                                          <div className="px-3 pb-3 border-t border-th-border">
                                            {match ? (
                                              (() => {
                                                const pitchIceBreakersSource =
                                                  (match as any)
                                                    .outreachEdited ||
                                                  match.outreachDraft ||
                                                  "";
                                                const pitchIceBreakers =
                                                  pitchIceBreakersSource
                                                    .split("\n")
                                                    .filter(Boolean);
                                                return (
                                                  <div className="space-y-4 pt-3">
                                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5">
                                                      <h4 className="text-xs font-medium text-emerald-400 mb-2">
                                                        Pitch Context
                                                      </h4>
                                                      <p className="text-sm text-neutral-200 mb-2">
                                                        {pitch.title ||
                                                          pitch.fileName ||
                                                          "Pitch"}
                                                      </p>
                                                      {match.angleCategory && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                          {match.angleCategory}
                                                        </span>
                                                      )}
                                                    </div>
                                                    {Array.isArray(
                                                      match.reasons,
                                                    ) &&
                                                      match.reasons.length >
                                                        0 && (
                                                        <div>
                                                          <h4 className="text-xs font-medium text-th-text-t mb-2.5">
                                                            {t.projectMatches
                                                              ?.whyGoodMatch ||
                                                              "Why This Is a Good Match"}
                                                          </h4>
                                                          <div className="space-y-2">
                                                            {match.reasons.map(
                                                              (reason, i) => (
                                                                <div
                                                                  key={i}
                                                                  className="flex items-start gap-2"
                                                                >
                                                                  <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                                                  <div className="flex-1 min-w-0">
                                                                    <span className="text-[13px] text-th-text-s">
                                                                      {
                                                                        reason.text
                                                                      }
                                                                    </span>
                                                                    {reason.evidence && (
                                                                      <p className="text-[11px] text-th-text-m mt-0.5">
                                                                        {
                                                                          reason.evidence
                                                                        }
                                                                      </p>
                                                                    )}
                                                                  </div>
                                                                </div>
                                                              ),
                                                            )}
                                                          </div>
                                                        </div>
                                                      )}
                                                    <EditableIceBreakers
                                                      iceBreakers={
                                                        pitchIceBreakers
                                                      }
                                                      accentColor="purple"
                                                      label={
                                                        t.projectMatches
                                                          ?.iceBreakers ||
                                                        "Ice Breakers"
                                                      }
                                                      onSave={async (text) => {
                                                        await updatePitchMatchStatus(
                                                          match.id,
                                                          match.status as PitchMatchStatus,
                                                          text,
                                                        );
                                                      }}
                                                    />
                                                    <MatchActionBar
                                                      currentStatus={
                                                        match.status
                                                      }
                                                      contactName={
                                                        contact.fullName
                                                      }
                                                      channels={{
                                                        intellmatchUserId:
                                                          linkedUserId,
                                                        phone: contact.phone,
                                                        email: contact.email,
                                                        linkedinUrl:
                                                          contact.linkedinUrl,
                                                      }}
                                                      onStatusChange={(
                                                        status,
                                                      ) =>
                                                        handlePitchMatchStatusChange(
                                                          pitch.id,
                                                          match.id,
                                                          status as PitchMatchStatus,
                                                        )
                                                      }
                                                      isUpdating={
                                                        isUpdatingPitchStatus
                                                      }
                                                      dismissStatus="IGNORED"
                                                      t={t}
                                                    />
                                                  </div>
                                                );
                                              })()
                                            ) : (
                                              <div className="text-center py-4">
                                                <p className="text-th-text-t text-sm">
                                                  No match found.
                                                </p>
                                                <p className="text-th-text-m text-xs">
                                                  Run &quot;Find Matches&quot;
                                                  from the pitch page first.
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );

                    if (type === "deal")
                      return (
                        <div
                          key="deal"
                          ref={(el) => {
                            sectionRefs.current["deal"] = el;
                          }}
                          className="bg-th-surface border border-th-border rounded-xl overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => handleAccordionClick("deal")}
                            className="w-full flex items-center gap-3 p-4 hover:bg-th-surface transition-colors"
                          >
                            <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                              <Handshake24Regular className="w-5 h-5 text-sky-400" />
                            </div>
                            <div className="flex-1 text-left">
                              <h3 className="font-semibold text-th-text">
                                {t.contacts?.matchDetails?.dealMatch ||
                                  "Deal Match"}
                              </h3>
                              <p className="text-xs text-th-text-s">
                                {t.contacts?.matchDetails?.dealMatchDesc ||
                                  "Buy/sell opportunity fit"}
                              </p>
                            </div>
                            {count > 0 && (
                              <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 text-xs rounded-full font-medium">
                                {count}
                              </span>
                            )}
                            {expandedSection === "deal" ? (
                              <ChevronUp24Regular className="w-5 h-5 text-th-text-t" />
                            ) : (
                              <ChevronDown24Regular className="w-5 h-5 text-th-text-t" />
                            )}
                          </button>
                          {expandedSection === "deal" && (
                            <div className="px-4 pb-4 border-t border-th-border">
                              {userDeals.length === 0 ? (
                                <div className="text-center py-8">
                                  <Handshake24Regular className="w-10 h-10 text-sky-400/30 mx-auto mb-3" />
                                  <p className="text-th-text-m mb-3">
                                    {t.contacts?.matchDetails?.noDeals ||
                                      "Create a deal to see matches"}
                                  </p>
                                  <Link
                                    href="/sell-smarter"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500/20 border border-sky-500/30 text-sky-400 rounded-lg hover:bg-sky-500/30 transition-colors"
                                  >
                                    <Add24Regular className="w-4 h-4" />
                                    {t.contacts?.matchDetails?.createDeal ||
                                      "Create Deal"}
                                  </Link>
                                </div>
                              ) : (
                                <div className="pt-3 space-y-2">
                                  {sortedUserDeals.map((deal: any) => {
                                    const match = allDealMatches[deal.id];
                                    const isExpanded =
                                      expandedSubItem === deal.id;
                                    return (
                                      <div
                                        key={deal.id}
                                        data-subitem
                                        className="border border-th-border rounded-lg overflow-hidden"
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) =>
                                            handleSubItemClick(deal.id, e)
                                          }
                                          className="w-full flex items-center gap-2 p-3 hover:bg-th-surface-h transition-colors"
                                        >
                                          <span className="flex-1 text-left text-sm font-medium text-th-text truncate">
                                            {deal.title}
                                          </span>
                                          {match &&
                                            (() => {
                                              const s = getMatchStrength(
                                                match.score,
                                              );
                                              return (
                                                <span
                                                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.badgeClass}`}
                                                >
                                                  {match.score}% - {s.label}
                                                </span>
                                              );
                                            })()}
                                          {!match && (
                                            <span className="text-xs text-th-text-t">
                                              No match
                                            </span>
                                          )}
                                          {isExpanded ? (
                                            <ChevronUp24Regular className="w-4 h-4 text-th-text-t flex-shrink-0" />
                                          ) : (
                                            <ChevronDown24Regular className="w-4 h-4 text-th-text-t flex-shrink-0" />
                                          )}
                                        </button>
                                        {isExpanded && (
                                          <div className="px-3 pb-3 border-t border-th-border">
                                            {match ? (
                                              (() => {
                                                const dealIceBreakersSource =
                                                  match.openerEdited ||
                                                  match.openerMessage ||
                                                  "";
                                                const dealIceBreakers =
                                                  dealIceBreakersSource
                                                    .split("\n")
                                                    .filter(Boolean);
                                                return (
                                                  <div className="space-y-4 pt-3">
                                                    <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3.5">
                                                      <h4 className="text-xs font-medium text-sky-400 mb-2">
                                                        Deal Context
                                                      </h4>
                                                      <p className="text-sm text-neutral-200 mb-2">
                                                        {deal.title}
                                                      </p>
                                                      <div className="flex flex-wrap gap-1.5">
                                                        {match.category && (
                                                          <span className="px-2 py-0.5 rounded-full text-xs bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                                            {getCategoryLabel(
                                                              match.category,
                                                            )}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                    {Array.isArray(
                                                      match.reasons,
                                                    ) &&
                                                      match.reasons.length >
                                                        0 && (
                                                        <div>
                                                          <h4 className="text-xs font-medium text-th-text-t mb-2.5">
                                                            {t.projectMatches
                                                              ?.whyGoodMatch ||
                                                              "Why This Is a Good Match"}
                                                          </h4>
                                                          <div className="space-y-2">
                                                            {match.reasons.map(
                                                              (reason, i) => (
                                                                <div
                                                                  key={i}
                                                                  className="flex items-start gap-2"
                                                                >
                                                                  <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                                                  <div className="flex-1 min-w-0">
                                                                    <span className="text-[13px] text-th-text-s">
                                                                      {
                                                                        reason.text
                                                                      }
                                                                    </span>
                                                                    {reason.evidence && (
                                                                      <p className="text-[11px] text-th-text-m mt-0.5">
                                                                        {
                                                                          reason.evidence
                                                                        }
                                                                      </p>
                                                                    )}
                                                                  </div>
                                                                </div>
                                                              ),
                                                            )}
                                                          </div>
                                                        </div>
                                                      )}
                                                    <EditableIceBreakers
                                                      iceBreakers={
                                                        dealIceBreakers
                                                      }
                                                      accentColor="sky"
                                                      label={
                                                        t.projectMatches
                                                          ?.iceBreakers ||
                                                        "Ice Breakers"
                                                      }
                                                      onSave={async (text) => {
                                                        await updateDealMatchStatus(
                                                          match.id,
                                                          {
                                                            status:
                                                              match.status as DealMatchStatus,
                                                            openerEdited: text,
                                                          },
                                                        );
                                                      }}
                                                    />
                                                    <MatchActionBar
                                                      currentStatus={
                                                        match.status
                                                      }
                                                      contactName={
                                                        contact.fullName
                                                      }
                                                      channels={{
                                                        intellmatchUserId:
                                                          linkedUserId,
                                                        phone: contact.phone,
                                                        email: contact.email,
                                                        linkedinUrl:
                                                          contact.linkedinUrl,
                                                      }}
                                                      onStatusChange={(
                                                        status,
                                                      ) =>
                                                        handleDealMatchStatusChange(
                                                          deal.id,
                                                          match.id,
                                                          status as DealMatchStatus,
                                                        )
                                                      }
                                                      isUpdating={
                                                        isUpdatingDealStatus
                                                      }
                                                      dismissStatus="IGNORED"
                                                      t={t}
                                                    />
                                                  </div>
                                                );
                                              })()
                                            ) : (
                                              <div className="text-center py-4">
                                                <p className="text-th-text-t text-sm">
                                                  No match found.
                                                </p>
                                                <p className="text-th-text-m text-xs">
                                                  Run &quot;Find Matches&quot;
                                                  from the deal page first.
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );

                    return null;
                  })}

                  {/* Profile Match Section - Always Last */}
                  <div
                    ref={(el) => {
                      sectionRefs.current["profile"] = el;
                    }}
                    className="bg-th-surface border border-th-border rounded-xl"
                  >
                    <button
                      type="button"
                      onClick={() => handleAccordionClick("profile")}
                      className="w-full flex items-center gap-3 p-4 hover:bg-th-surface transition-colors rounded-t-xl"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-500/25 flex items-center justify-center ring-1 ring-emerald-400/30">
                        <PersonAvailable24Regular className="w-5 h-5 text-emerald-300" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-th-text">
                          {t.contacts?.matchDetails?.profileMatch ||
                            "Profile Match"}
                        </h3>
                        <p className="text-xs text-th-text-s">
                          {t.contacts?.matchDetails?.profileMatchDesc ||
                            "How well your profiles align"}
                        </p>
                      </div>
                      {expandedSection === "profile" ? (
                        <ChevronUp24Regular className="w-5 h-5 text-th-text-t" />
                      ) : (
                        <ChevronDown24Regular className="w-5 h-5 text-th-text-t" />
                      )}
                    </button>
                    {expandedSection === "profile" && (
                      <div className="px-4 pb-4 border-t border-th-border">
                        {isLoadingItemized && !itemizedMatch ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
                          </div>
                        ) : itemizedMatch ? (
                          <div className="pt-4">
                            <ItemizedMatchCard
                              match={itemizedMatch}
                              showActions={false}
                            />
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-th-text-m mb-3">
                              {t.contacts?.matchDetails?.noProfileData ||
                                "Complete your profile for matching"}
                            </p>
                            <Link
                              href="/profile"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                            >
                              <Add24Regular className="w-4 h-4" />
                              {t.contacts?.matchDetails?.setupProfile ||
                                "Setup Profile"}
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Activity tab */}
          <TabsContent value="activity">
            <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
              <h3 className="text-base font-semibold text-th-text mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-green-400 rounded-full" />
                {t.contactDetails.activity.recentInteractions}
              </h3>
              {contact.interactions.length > 0 ? (
                <div className="space-y-3">
                  {contact.interactions.map(
                    (interaction: {
                      id: string;
                      type: string;
                      notes: string;
                      date: string;
                    }) => (
                      <div
                        key={interaction.id}
                        className="flex gap-3 p-3 rounded-lg bg-th-surface border border-th-border"
                      >
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
                          {interaction.type}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-th-text">
                            {interaction.notes}
                          </p>
                          <p className="text-xs text-th-text-t mt-1">
                            {interaction.date}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-sm text-th-text-t text-center py-4">
                  {t.contactDetails.activity.noInteractions}
                </p>
              )}
            </div>

            <div className="mt-3">
              <button
                type="button"
                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
              >
                {t.contactDetails.activity.logInteraction}
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Notes, Tasks & Reminders Section */}
      <div className="px-4 pt-4 space-y-4">
        {/* Notes Section */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h3 className="text-base font-semibold text-th-text flex items-center gap-2 mb-3">
            <DocumentText24Regular className="w-5 h-5 text-emerald-400" />
            {t.contactDetails?.notes?.title || "Notes"}
          </h3>

          {notes.length > 0 ? (
            <>
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-th-surface border border-th-border rounded-lg p-3"
                  >
                    {note.type === "TEXT" && (
                      <p className="text-sm text-neutral-200">{note.content}</p>
                    )}
                    {note.type === "IMAGE" && note.mediaUrl && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImage({
                              url: note.mediaUrl!,
                              caption: note.content || note.fileName,
                            })
                          }
                          className="w-full cursor-pointer group"
                        >
                          <img
                            src={note.mediaUrl}
                            alt={note.fileName || "Note attachment"}
                            className="w-full max-h-48 object-cover rounded-lg bg-th-surface group-hover:opacity-80 transition-opacity"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const fallback =
                                target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = "flex";
                            }}
                          />
                          <div className="hidden items-center justify-center gap-2 p-4 bg-th-surface border border-th-border rounded-lg text-th-text-t">
                            <Image24Regular className="w-5 h-5" />
                            <span className="text-sm">
                              {note.fileName || "Image unavailable"}
                            </span>
                          </div>
                        </button>
                        {note.content && (
                          <p className="text-sm text-th-text-t mt-2">
                            {note.content}
                          </p>
                        )}
                      </div>
                    )}
                    {note.type === "VOICE" && note.mediaUrl && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playAudioNote(note.id, note.mediaUrl!)}
                          className="p-2 bg-blue-500/20 rounded-full"
                        >
                          {playingAudio === note.id ? (
                            <Pause24Regular className="w-5 h-5 text-blue-400" />
                          ) : (
                            <Play24Regular className="w-5 h-5 text-blue-400" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Mic24Regular className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-neutral-200">
                              {t.mediaNotes?.voiceNote || "Voice note"}
                            </span>
                          </div>
                          {note.duration && (
                            <span className="text-xs text-th-text-m">
                              {Math.floor(note.duration / 60)}:
                              {String(note.duration % 60).padStart(2, "0")}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {note.type === "FILE" && note.mediaUrl && (
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <DocumentPdf24Regular className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <a
                            href={note.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 truncate block"
                          >
                            {note.fileName || "Download file"}
                          </a>
                          {note.fileSize && (
                            <span className="text-xs text-th-text-m">
                              {(note.fileSize / 1024 / 1024).toFixed(2)} MB
                            </span>
                          )}
                          {note.content && (
                            <p className="text-sm text-th-text-t mt-1">
                              {note.content}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-th-border">
                      <span className="text-xs text-th-text-m">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                      {deletingNoteId === note.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Delete?</span>
                          <button
                            type="button"
                            onClick={() => deleteNote(note.id)}
                            className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingNoteId(null)}
                            className="px-2 py-0.5 text-xs bg-th-surface-h text-th-text-t rounded hover:bg-th-surface-h transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingNoteId(note.id)}
                          className="p-1 text-th-text-m hover:text-red-400 transition-colors"
                        >
                          <Dismiss24Regular className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddNote}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-sm text-emerald-300 font-medium transition-colors"
              >
                <Add24Regular className="w-4 h-4" />
                {t.contactDetails?.notes?.title
                  ? `Add ${t.contactDetails.notes.title}`
                  : "Add Note"}
              </button>
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-th-text-m mb-3">
                {t.contactDetails?.notes?.empty || "No notes yet"}
              </p>
              <button
                type="button"
                onClick={handleAddNote}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-emerald-300 font-medium transition-colors"
              >
                <Add24Regular className="w-5 h-5" />
                {t.contactDetails?.notes?.title
                  ? `Add ${t.contactDetails.notes.title}`
                  : "Add Note"}
              </button>
            </div>
          )}
        </div>

        {/* Tasks Section */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h3 className="text-base font-semibold text-th-text flex items-center gap-2 mb-3">
            <TaskListSquareAdd24Regular className="w-5 h-5 text-blue-400" />
            {t.contactDetails?.tasks?.title || "Tasks"}
          </h3>

          {tasks.length > 0 ? (
            <>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleEditTask(task)}
                    className="w-full text-left bg-th-surface border border-th-border rounded-lg p-3 hover:bg-th-surface-h transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                          task.priority === "URGENT"
                            ? "bg-red-500"
                            : task.priority === "HIGH"
                              ? "bg-blue-500"
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
                        <Mic24Regular className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddTask}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-sm text-blue-300 font-medium transition-colors"
              >
                <Add24Regular className="w-4 h-4" />
                {t.contactDetails?.tasks?.title
                  ? `Add ${t.contactDetails.tasks.title}`
                  : "Add Task"}
              </button>
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-th-text-m mb-3">
                {t.contactDetails?.tasks?.empty || "No tasks yet"}
              </p>
              <button
                type="button"
                onClick={handleAddTask}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-blue-300 font-medium transition-colors"
              >
                <Add24Regular className="w-5 h-5" />
                {t.contactDetails?.tasks?.title
                  ? `Add ${t.contactDetails.tasks.title}`
                  : "Add Task"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        contactId={contactId}
        task={editingTask}
        onSuccess={handleTaskSuccess}
        onDelete={handleDeleteTask}
        contact={
          contact
            ? {
                fullName: contact.name,
                phone: contact.phone,
                email: contact.email,
              }
            : undefined
        }
      />

      {/* Note Dialog */}
      <NoteDialog
        open={showNoteDialog}
        onOpenChange={setShowNoteDialog}
        contactId={contactId}
        onSuccess={handleNoteSuccess}
      />

      {/* Delete section */}
      <div className="px-4 pt-4 border-t border-th-border">
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 font-medium rounded-xl hover:bg-red-500/20 transition-all"
            >
              <TrashIcon />
              {t.contactDetails.delete.button}
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.contactDetails.delete.title}</DialogTitle>
              <DialogDescription>
                {t.contactDetails.delete.description.replace(
                  "{name}",
                  contact.name,
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setShowDeleteDialog(false)}
              >
                {t.contactDetails.delete.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                loading={isDeleting}
              >
                {t.contactDetails.delete.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Meta info */}
      <div className="px-4 pb-4 text-center text-xs text-th-text-t">
        <p>
          {t.contactDetails.addedOn
            .replace("{date}", contact.addedAt)
            .replace("{source}", contact.source)}
        </p>
      </div>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 rounded-full transition-colors z-10"
            aria-label="Close"
          >
            <Dismiss24Regular className="w-6 h-6 text-white" />
          </button>
          <div
            className="max-w-full max-h-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage.url}
              alt={lightboxImage.caption || "Image"}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            {lightboxImage.caption && (
              <p className="text-th-text/70 text-sm mt-3 text-center max-w-md">
                {lightboxImage.caption}
              </p>
            )}
          </div>
        </div>
      )}

      {/* QR Code Share Popup */}
      {showQrPopup && authUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={() => setShowQrPopup(false)}
        >
          <div
            className="relative w-full max-w-sm bg-th-nav-bottom border border-th-border rounded-2xl shadow-2xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQrPopup(false)}
              className="absolute top-3 right-3 p-1.5 hover:bg-th-surface-h rounded-full transition-colors"
            >
              <Dismiss24Regular className="w-5 h-5 text-th-text-t" />
            </button>
            <h3 className="text-lg font-semibold text-th-text mb-1">
              My Contact
            </h3>
            <p className="text-sm text-th-text-s mb-4">
              Scan to save my details
            </p>
            <div className="inline-block p-4 bg-[#0c1222] border border-white/[0.06] rounded-xl">
              <QRCodeSVG
                value={`BEGIN:VCARD\nVERSION:3.0\nFN:${authUser.name || ""}\nTEL:${authUser.phone || ""}\nEND:VCARD`}
                size={200}
                level="M"
              />
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-sm font-medium text-th-text">
                {authUser.name}
              </p>
              {authUser.phone && (
                <p className="text-sm text-th-text-s">{authUser.phone}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
