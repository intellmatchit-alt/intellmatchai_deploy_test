/**
 * Project Detail Page
 *
 * View project details and AI-matched collaborators.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Edit24Regular,
  Delete24Regular,
  Sparkle24Regular,
  People24Regular,
  Rocket24Regular,
  PeopleTeam24Regular,
  Dismiss24Regular,
  Checkmark24Regular,
  ChevronRight24Regular,
  Mail24Regular,
  PersonAdd24Regular,
  BookmarkAdd24Regular,
  Copy24Regular,
  Building24Regular,
  Briefcase24Regular,
  Person24Regular,
  Lightbulb24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
} from '@fluentui/react-icons';
import {
  getProject,
  findProjectMatches,
  deleteProject,
  updateMatchStatus,
  Project,
  ProjectMatch,
  MatchStatus,
  STAGE_OPTIONS,
  LOOKING_FOR_OPTIONS,
} from '@/lib/api/projects';
import { createContact } from '@/lib/api/contacts';
import { MatchActionBar, EditableIceBreakers, MatchCard, type MatchCardData } from '@/components/features/matches';
import { updateMatchIceBreakers as updateProjectMatchIceBreakers } from '@/lib/api/projects';
import {
  listSentRequests,
  cancelCollaborationRequest,
  getMatchResults,
  getIntroductions,
  CollaborationRequest,
  CollaborationMatchResult,
  Introduction,
  getRequestStatusColor,
  getRequestStatusLabel,
  getIntroductionStatusColor,
  getIntroductionStatusLabel,
  formatRelativeTime,
} from '@/lib/api/collaboration';
import { toast } from '@/components/ui/Toast';
import { Avatar } from '@/components/ui/Avatar';
import CollaborateButton from '@/components/features/collaboration/CollaborateButton';
import TeamMembersList from '@/components/features/collaboration/TeamMembersList';

const STORAGE_KEY = 'matches-local-statuses';

function getLocalStatuses(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveLocalStatuses(statuses: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
}

/** Map ProjectMatch to MatchCardData for the shared MatchCard */
function projectMatchToCardData(match: ProjectMatch, projectTitle: string): MatchCardData | null {
  const person = match.matchedUser || match.matchedContact;
  if (!person) return null;
  return {
    id: match.id,
    source: 'project',
    sourceTitle: projectTitle,
    score: match.matchScore,
    contactId: match.matchedContact?.id || '',
    name: person.fullName,
    company: person.company || undefined,
    jobTitle: person.jobTitle || undefined,
    reasons: (match.reasons || []).map((r: any) => typeof r === 'string' ? r : r.text).filter(Boolean),
    sharedSectors: match.sharedSectors || [],
    sharedSkills: match.sharedSkills || [],
    status: match.status,
    channels: {
      phone: (person as any).phone || null,
      email: (person as any).email || null,
      linkedinUrl: (person as any).linkedinUrl || null,
    },
  };
}

/**
 * Match Detail Modal
 */
function MatchDetailModal({
  match,
  project,
  projectId,
  onClose,
  onStatusChange,
  t,
}: {
  match: ProjectMatch;
  project: Project;
  projectId: string;
  onClose: () => void;
  onStatusChange: (matchId: string, status: MatchStatus) => void;
  t: any;
}) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const person = match.matchedUser || match.matchedContact;
  if (!person) return null;

  const isUser = !!match.matchedUser;
  const stageLabel = STAGE_OPTIONS.find((s) => s.id === project.stage)?.label || project.stage;
  const lookingForLabels = project.lookingFor.map(
    (id) => LOOKING_FOR_OPTIONS.find((o) => o.id === id)?.label || id
  );

  const handleStatusChange = async (status: MatchStatus) => {
    setIsUpdating(true);
    try {
      const localStatuses = getLocalStatuses();
      const storageKey = `proj-${match.id}`;
      if ((status as string) === 'ACTIVE' || status === 'PENDING') {
        delete localStatuses[storageKey];
        onStatusChange(match.id, 'PENDING' as MatchStatus);
      } else {
        localStatuses[storageKey] = status;
        onStatusChange(match.id, status);
      }
      saveLocalStatuses(localStatuses);
      toast({ title: t.projects?.statusUpdated || 'Status updated', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddContact = async () => {
    if (!person) return;
    setIsAddingContact(true);
    try {
      await createContact({
        name: person.fullName,
        email: person.email || undefined,
        company: person.company || undefined,
        jobTitle: person.jobTitle || undefined,
        source: 'MANUAL',
      });
      toast({
        title: t.projectMatches?.contactAdded || 'Contact added',
        description: `${person.fullName} ${t.projectMatches?.addedToContacts || 'has been added to your contacts'}`,
        variant: 'success',
      });
      handleStatusChange('CONNECTED');
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleViewProfile = () => {
    if (isUser && match.matchedUser?.id) {
      router.push(`/profile/${match.matchedUser.id}`);
    } else if (match.matchedContact?.id) {
      router.push(`/contacts/${match.matchedContact.id}`);
    }
    onClose();
  };

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({ title: t.common?.copied || 'Copied!', variant: 'success' });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const iceBreakers = (match.suggestedMessage || '').split('\n').filter(Boolean);

  const scoreColor = match.matchScore >= 90 ? 'text-[#22C55E]' : match.matchScore >= 75 ? 'text-[#84CC16]' : match.matchScore >= 60 ? 'text-[#FACC15]' : match.matchScore >= 40 ? 'text-[#FB923C]' : 'text-[#EF4444]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md max-h-[75vh] overflow-y-auto bg-th-bg-s border border-th-border rounded-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header — same as opportunity */}
        <div className="sticky top-0 z-10 bg-th-bg-s border-b border-th-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 p-0.5">
                <div className="w-full h-full rounded-full bg-th-bg-s flex items-center justify-center overflow-hidden">
                  {match.matchedUser?.avatarUrl ? (
                    <img src={match.matchedUser.avatarUrl} alt={person.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-th-text">
                      {person.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-th-text">{person.fullName}</h2>
                <p className="text-sm text-white">
                  {person.jobTitle}{person.company && ` at ${person.company}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Score Badge */}
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                match.matchScore >= 90 ? 'bg-[#22C55E]/20 border-[#22C55E]/50 text-[#22C55E]' :
                match.matchScore >= 75 ? 'bg-[#84CC16]/20 border-[#84CC16]/50 text-[#84CC16]' :
                match.matchScore >= 60 ? 'bg-[#FACC15]/20 border-[#FACC15]/50 text-[#FACC15]' :
                match.matchScore >= 40 ? 'bg-[#FB923C]/20 border-[#FB923C]/50 text-[#FB923C]' :
                'bg-[#EF4444]/20 border-[#EF4444]/50 text-[#EF4444]'
              }`}>
                {match.matchScore}%
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors">
                <Dismiss24Regular className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content — mirrors opportunity pattern */}
        <div className="p-4 space-y-4">

          {/* Match Summary — emerald accent (like Intent Alignment in opportunity) */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkle24Regular className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-medium text-emerald-400">Match Summary</h3>
            </div>
            {match.explanation?.summary ? (
              <p className="text-sm text-white">{match.explanation.summary}</p>
            ) : (
              <p className="text-sm text-white">
                {person.fullName} has a <span className={`font-bold ${scoreColor}`}>{match.matchScore}%</span> match score for this project.
              </p>
            )}
            <div className="flex items-center gap-3 mt-3">
              <span className={`text-2xl font-bold ${scoreColor}`}>{match.matchScore}%</span>
              {match.matchLevel && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  match.matchLevel === 'EXCELLENT' ? 'bg-[#22C55E] text-black border-[#22C55E]' :
                  match.matchLevel === 'VERY_GOOD' ? 'bg-[#84CC16] text-black border-[#84CC16]' :
                  match.matchLevel === 'GOOD' ? 'bg-[#FACC15] text-black border-[#FACC15]' :
                  'bg-[#FB923C] text-black border-[#FB923C]'
                }`}>{match.matchLevel.replace(/_/g, ' ')}</span>
              )}
              {match.confidence != null && (
                <span className="text-xs text-white font-bold">{Math.round(match.confidence * 100)}% confidence</span>
              )}
            </div>
          </div>

          {/* Contact Info (like opportunity) */}
          {(person.email || person.phone || person.linkedinUrl) && (
            <div className="bg-th-surface rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3">Contact Information</h3>
              <div className="space-y-2">
                {person.email && (
                  <div className="flex items-center gap-2 text-sm text-white">
                    <Mail24Regular className="w-4 h-4 text-white" />
                    {person.email}
                  </div>
                )}
                {person.phone && (
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span className="w-4 h-4 text-white text-center">📞</span>
                    {person.phone}
                  </div>
                )}
                {person.linkedinUrl && (
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span className="w-4 h-4 text-white text-center">🔗</span>
                    <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">{person.linkedinUrl}</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shared Expertise (same as opportunity) */}
          {(match.sharedSectors.length > 0 || match.sharedSkills.length > 0) && (
            <div className="bg-th-surface rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3">Shared Expertise</h3>
              <div className="flex flex-wrap gap-2">
                {match.sharedSectors.map((s, i) => (
                  <span key={`s-${i}`} className="px-3 py-1 rounded-full text-sm bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{s}</span>
                ))}
                {match.sharedSkills.map((s, i) => (
                  <span key={`sk-${i}`} className="px-3 py-1 rounded-full text-sm bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Why This Match (same as opportunity) */}
          {((match.explanation?.rankingDrivers?.length) || (Array.isArray(match.reasons) && match.reasons.length > 0)) && (
            <div className="bg-th-surface rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3">Why This Match</h3>
              <div className="space-y-2">
                {(match.explanation?.rankingDrivers || match.reasons || []).map((reason, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-white">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Action (same as opportunity) */}
          {match.suggestedAction && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <h3 className="text-sm font-medium text-blue-400 mb-2">Suggested Action</h3>
              <p className="text-sm text-white">{match.suggestedAction}</p>
            </div>
          )}

          {/* Gaps & Concerns (same as opportunity risks) */}
          {match.explanation?.missingCriticalSignals?.length ? (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
              <h3 className="text-sm font-medium text-orange-400 mb-3">Gaps & Concerns</h3>
              <div className="space-y-2">
                {match.explanation.missingCriticalSignals.slice(0, 5).map((gap, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                    <span className="text-white">{gap}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Score Breakdown — collapsible (same pattern as opportunity) */}
          {match.scoreBreakdown && (Array.isArray(match.scoreBreakdown) ? match.scoreBreakdown.length > 0 : Object.keys(match.scoreBreakdown).length > 0) && (
            <details className="bg-th-surface rounded-xl overflow-hidden">
              <summary className="p-4 cursor-pointer text-sm font-medium text-white hover:bg-white/[0.02] transition-colors">
                Score Breakdown ({Array.isArray(match.scoreBreakdown) ? match.scoreBreakdown.length : Object.keys(match.scoreBreakdown).length} components)
              </summary>
              <div className="px-4 pb-4 space-y-3">
                {Array.isArray(match.scoreBreakdown) ? (
                  match.scoreBreakdown.map((comp: any, i: number) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white flex-1">{comp.name}</span>
                        <span className={`text-xs font-bold ${comp.score >= 90 ? 'text-[#22C55E]' : comp.score >= 75 ? 'text-[#84CC16]' : comp.score >= 60 ? 'text-[#FACC15]' : comp.score >= 40 ? 'text-[#FB923C]' : 'text-[#EF4444]'}`}>{comp.score}%</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${comp.score >= 90 ? 'bg-[#22C55E]' : comp.score >= 75 ? 'bg-[#84CC16]' : comp.score >= 60 ? 'bg-[#FACC15]' : comp.score >= 40 ? 'bg-[#FB923C]' : 'bg-[#EF4444]'}`} style={{ width: `${comp.score}%` }} />
                      </div>
                      {comp.explanation && <p className="text-xs text-white/80">{comp.explanation}</p>}
                      {comp.evidence?.length > 0 && comp.evidence.map((e: string, j: number) => (
                        <p key={j} className="text-xs text-emerald-400/70 pl-2">{e}</p>
                      ))}
                      {comp.penalties?.length > 0 && comp.penalties.filter((p: string) => !p.includes('Low score')).map((p: string, j: number) => (
                        <p key={j} className="text-xs text-orange-400/70 pl-2">{p}</p>
                      ))}
                    </div>
                  ))
                ) : null}
              </div>
            </details>
          )}

          {/* Ice Breakers / Suggested Message (same as opportunity) */}
          <EditableIceBreakers
            iceBreakers={iceBreakers}
            accentColor="purple"
            label={t.projectMatches?.iceBreakers || 'Suggested Message'}
            onSave={async (text) => {
              await updateProjectMatchIceBreakers(projectId, match.id, text);
            }}
          />

          {/* Actions */}
          <MatchActionBar
            currentStatus={match.status}
            contactName={person.fullName}
            channels={{ intellmatchUserId: match.matchedUser?.id, phone: person.phone, email: person.email, linkedinUrl: person.linkedinUrl }}
            onStatusChange={(status) => handleStatusChange(status as MatchStatus)}
            isUpdating={isUpdating}
            dismissStatus="DISMISSED"
            t={t}
          />
        </div>

        {/* Action Buttons — same as opportunity footer */}
        <div className="sticky bottom-0 bg-th-bg-s border-t border-th-border p-4 flex gap-3">
          {!match.matchedContact && (
            <button
              onClick={handleAddContact}
              disabled={isAddingContact}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-th-surface border border-th-border text-th-text font-medium rounded-xl hover:bg-th-surface-h transition-colors"
            >
              <PersonAdd24Regular className="w-4 h-4" />
              {t.projectMatches?.addToContacts || 'Add to Contacts'}
            </button>
          )}
          <button
            onClick={handleViewProfile}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
          >
            {isUser ? 'View Profile' : 'View Details'}
            <ChevronRight24Regular className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<(Project & { matches: ProjectMatch[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFindingMatches, setIsFindingMatches] = useState(false);
  const [matchStatusFilter, setMatchStatusFilter] = useState<'active' | 'archived' | 'dismissed'>('active');
  const [selectedMatch, setSelectedMatch] = useState<ProjectMatch | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'collaborators'>('matches');

  // Collaboration requests state
  const [sentRequests, setSentRequests] = useState<CollaborationRequest[]>([]);
  const [isLoadingSentRequests, setIsLoadingSentRequests] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resultsModalSessionId, setResultsModalSessionId] = useState<string | null>(null);
  const [resultsModalRecipient, setResultsModalRecipient] = useState<string>('');
  const [modalResults, setModalResults] = useState<CollaborationMatchResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [requestIntroductions, setRequestIntroductions] = useState<Record<string, Introduction[]>>({});
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [loadingIntroductions, setLoadingIntroductions] = useState<string | null>(null);

  // Fetch project
  useEffect(() => {
    fetchProject();
  }, [projectId]);

  // Fetch sent collaboration requests
  useEffect(() => {
    if (projectId) fetchSentRequests();
  }, [projectId]);

  const fetchProject = async () => {
    setIsLoading(true);
    try {
      const data = await getProject(projectId);
      // Apply localStorage statuses
      const localStatuses = getLocalStatuses();
      for (const m of data.matches) {
        const stored = localStatuses[`proj-${m.id}`];
        if (stored) m.status = stored as MatchStatus;
      }
      setProject(data);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
      router.push('/projects');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSentRequests = async () => {
    setIsLoadingSentRequests(true);
    try {
      const data = await listSentRequests({ sourceType: 'PROJECT', sourceId: projectId, limit: 50 });
      setSentRequests(data.requests);
    } catch {
      // Silently fail - not critical
    } finally {
      setIsLoadingSentRequests(false);
    }
  };

  const toggleIntroductions = async (requestId: string) => {
    if (expandedRequestId === requestId) {
      setExpandedRequestId(null);
      return;
    }
    setExpandedRequestId(requestId);
    if (!requestIntroductions[requestId]) {
      setLoadingIntroductions(requestId);
      try {
        const data = await getIntroductions(requestId);
        setRequestIntroductions((prev) => ({ ...prev, [requestId]: data.introductions }));
      } catch {
        // Silently fail
      } finally {
        setLoadingIntroductions(null);
      }
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setCancellingId(requestId);
    try {
      await cancelCollaborationRequest(requestId);
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast({ title: t.projects?.requestCancelled || 'Request cancelled', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setCancellingId(null);
    }
  };

  const handleViewResults = async (sessionId: string, recipientName: string) => {
    setResultsModalSessionId(sessionId);
    setResultsModalRecipient(recipientName);
    setIsLoadingResults(true);
    setModalResults([]);
    try {
      const data = await getMatchResults(sessionId, { limit: 50 });
      setModalResults(data.results);
    } catch {
      // Silently fail
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleFindMatches = async () => {
    setIsFindingMatches(true);
    try {
      const result = await findProjectMatches(projectId);
      // Check if result is async job response or sync match result
      if ('jobId' in result) {
        // Async mode - show queued message
        toast({
          title: t.projects?.matchingStarted || 'Matching started',
          description: result.message,
          variant: 'success',
        });
      } else {
        // Sync mode - update matches directly
        setProject((prev) => prev ? { ...prev, matches: result.matches } : null);
        toast({
          title: t.projects?.matchesFound || 'Matches found',
          description: `${result.matchCount} ${t.projects?.potentialCollaborators || 'potential collaborators'}`,
          variant: 'success',
        });
      }
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsFindingMatches(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(t.projects?.confirmDelete || 'Are you sure you want to delete this project?')) {
      try {
        await deleteProject(projectId);
        toast({ title: t.projects?.deleted || 'Project deleted', variant: 'success' });
        router.push('/projects');
      } catch (error: any) {
        toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
      }
    }
  };

  const handleMatchStatusChange = (matchId: string, status: MatchStatus) => {
    setProject((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        matches: prev.matches.map((m) =>
          m.id === matchId ? { ...m, status } : m
        ),
      };
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in pb-20">
        <div className="h-8 bg-th-surface-h rounded w-1/4 animate-pulse" />
        <div className="bg-th-surface border border-th-border rounded-xl p-6 space-y-4">
          <div className="h-6 bg-th-surface-h rounded w-1/2 animate-pulse" />
          <div className="h-4 bg-th-surface-h rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-th-surface-h rounded w-2/3 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!project) return null;

  const stageLabel = STAGE_OPTIONS.find((s) => s.id === project.stage)?.label || project.stage;
  const lookingForLabels = project.lookingFor
    .map((id) => LOOKING_FOR_OPTIONS.find((o) => o.id === id)?.label || id);

  // Status-based filtering (active/archived/dismissed)
  const activeCount = project.matches.filter((m) => m.status !== 'DISMISSED' && m.status !== 'ARCHIVED').length;
  const archivedCount = project.matches.filter((m) => m.status === 'ARCHIVED').length;
  const dismissedCount = project.matches.filter((m) => m.status === 'DISMISSED').length;

  const statusFilteredMatches = project.matches.filter((m) => {
    if (matchStatusFilter === 'active') return m.status !== 'DISMISSED' && m.status !== 'ARCHIVED';
    if (matchStatusFilter === 'archived') return m.status === 'ARCHIVED';
    if (matchStatusFilter === 'dismissed') return m.status === 'DISMISSED';
    return true;
  });

  const filteredMatches = statusFilteredMatches;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/projects')}
            className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
          >
            <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-th-text">{project.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/edit`}
            className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
          >
            <Edit24Regular className="w-5 h-5" />
          </Link>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-red-500/20 text-th-text-t hover:text-red-400 transition-colors"
          >
            <Delete24Regular className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Project Info */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6 space-y-4">
        <p className="text-white">{project.summary}</p>

        {project.detailedDesc && (
          <p className="text-sm text-white">{project.detailedDesc}</p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full text-sm bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
            <Rocket24Regular className="w-4 h-4 inline me-1" />
            {stageLabel}
          </span>
          {project.category && (
            <span className="px-3 py-1 rounded-full text-sm bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
              {(t.projects?.categories as Record<string, string>)?.[project.category] || project.category}
            </span>
          )}
        </div>

        {/* Looking For */}
        {lookingForLabels.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
              <People24Regular className="w-4 h-4" />
              {t.projects?.lookingFor || 'Looking For'}
            </h4>
            <div className="flex flex-wrap gap-2">
              {lookingForLabels.map((label, i) => (
                <span key={i} className="px-2 py-1 rounded-lg text-sm bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sectors & Skills */}
        <div className="grid grid-cols-2 gap-4">
          {project.sectors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white mb-2">{t.projects?.sectors || 'Sectors'}</h4>
              <div className="flex flex-wrap gap-1">
                {project.sectors.map((s) => (
                  <span key={s.id} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {project.skillsNeeded.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white mb-2">{t.projects?.skillsNeeded || 'Skills Needed'}</h4>
              <div className="flex flex-wrap gap-1">
                {project.skillsNeeded.map((s) => (
                  <span key={s.id} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Needs */}
        {project.needs && project.needs.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-white mb-2">{t.projects?.needs || 'Needs'}</h4>
            <div className="flex flex-wrap gap-1.5">
              {project.needs.map((need: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{need}</span>
              ))}
            </div>
          </div>
        )}

        {/* Markets */}
        {project.markets && project.markets.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-white mb-2">{t.projects?.markets || 'Markets'}</h4>
            <div className="flex flex-wrap gap-1.5">
              {project.markets.map((m: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Funding */}
        {(project.fundingAskMin || project.fundingAskMax) && (
          <div>
            <h4 className="text-sm font-medium text-white mb-2">{t.projects?.fundingRange || 'Funding Range'}</h4>
            <span className="text-sm text-white">
              {project.fundingAskMin && project.fundingAskMax
                ? `$${project.fundingAskMin.toLocaleString()} – $${project.fundingAskMax.toLocaleString()}`
                : project.fundingAskMin
                  ? `From $${project.fundingAskMin.toLocaleString()}`
                  : `Up to $${project.fundingAskMax!.toLocaleString()}`}
            </span>
          </div>
        )}

        {/* Advanced Matching Fields */}
        {(project.tractionSignals?.length || project.advisoryTopics?.length || project.partnerTypeNeeded?.length || project.targetCustomerTypes?.length || project.engagementModel?.length || project.commitmentLevelNeeded || project.idealCounterpartProfile) && (
          <div className="pt-3 border-t border-th-border space-y-3">
            <h4 className="text-sm font-medium text-white">{t.projects?.advancedSection || 'Matching Preferences'}</h4>
            {project.tractionSignals && project.tractionSignals.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Traction:</span>
                {project.tractionSignals.map((s: string, i: number) => (<span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{s}</span>))}
              </div>
            )}
            {project.advisoryTopics && project.advisoryTopics.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Advisory:</span>
                {project.advisoryTopics.map((s: string, i: number) => (<span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{s}</span>))}
              </div>
            )}
            {project.partnerTypeNeeded && project.partnerTypeNeeded.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Partner Type:</span>
                {project.partnerTypeNeeded.map((s: string, i: number) => (<span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{s}</span>))}
              </div>
            )}
            {project.targetCustomerTypes && project.targetCustomerTypes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Customers:</span>
                {project.targetCustomerTypes.map((s: string, i: number) => (<span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{s}</span>))}
              </div>
            )}
            {project.engagementModel && project.engagementModel.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Engagement:</span>
                {project.engagementModel.map((s: string, i: number) => (<span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{s}</span>))}
              </div>
            )}
            {project.commitmentLevelNeeded && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white font-bold uppercase">Commitment:</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{project.commitmentLevelNeeded}</span>
              </div>
            )}
            {project.idealCounterpartProfile && (
              <div>
                <span className="text-xs text-white font-bold uppercase">Ideal Counterpart:</span>
                <p className="text-xs text-white mt-0.5 leading-relaxed">{project.idealCounterpartProfile}</p>
              </div>
            )}
            {project.strictLookingFor && (
              <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-300 border border-red-500/20 font-bold">Strict Matching</span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-th-border pb-1">
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium transition-all ${
            activeTab === 'matches'
              ? 'bg-th-surface-h text-th-text border-b-2 border-emerald-500'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
          }`}
        >
          <Sparkle24Regular className="w-5 h-5" />
          {t.projects?.matches || 'Matches'}
          {activeCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
              {activeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('collaborators')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium transition-all ${
            activeTab === 'collaborators'
              ? 'bg-th-surface-h text-th-text border-b-2 border-emerald-500'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
          }`}
        >
          <PeopleTeam24Regular className="w-5 h-5" />
          {t.projects?.collaborators || 'Collaborators'}
        </button>
      </div>

      {activeTab === 'matches' && (
      <>
      {/* Matches Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-th-text flex items-center gap-2">
            <Sparkle24Regular className="w-6 h-6 text-emerald-400" />
            {t.projects?.matches || 'Matches'}
            {activeCount > 0 && (
              <span className="text-sm font-normal text-th-text-m">({activeCount})</span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFindMatches}
              disabled={isFindingMatches}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
            >
              {isFindingMatches ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t.projects?.finding || 'Finding...'}
                </>
              ) : (
                <>
                  <Sparkle24Regular className="w-4 h-4" />
                  {t.projects?.findMatches || 'Find Matches'}
                </>
              )}
            </button>
            <CollaborateButton
              sourceType="PROJECT"
              sourceId={projectId}
              sourceTitle={project.title}
              variant="secondary"
              size="sm"
              onSuccess={fetchSentRequests}
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 p-1 bg-th-surface rounded-xl">
          {([
            { id: 'active' as const, label: 'Active', count: activeCount },
            { id: 'archived' as const, label: 'Archived', count: archivedCount },
            { id: 'dismissed' as const, label: 'Dismissed', count: dismissedCount },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMatchStatusFilter(tab.id)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                matchStatusFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Matches List */}
        {filteredMatches.length > 0 ? (
          <div className="space-y-3">
            {filteredMatches.map((match) => {
              const cardData = projectMatchToCardData(match, project?.title || 'Project');
              if (!cardData) return null;
              return (
                <MatchCard
                  key={match.id}
                  match={cardData}
                  onClick={() => setSelectedMatch(match)}
                  onStatusChange={async (id, status) => {
                    const localStatuses = getLocalStatuses();
                    const storageKey = `proj-${match.id}`;
                    if (status === 'ACTIVE') {
                      delete localStatuses[storageKey];
                      handleMatchStatusChange(match.id, 'PENDING' as MatchStatus);
                    } else {
                      localStatuses[storageKey] = status;
                      handleMatchStatusChange(match.id, status as MatchStatus);
                    }
                    saveLocalStatuses(localStatuses);
                    toast({ title: t.projects?.statusUpdated || 'Status updated', variant: 'success' });
                  }}
                  hideSource
                  t={t}
                />
              );
            })}
          </div>
        ) : (
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
            <Sparkle24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
            <p className="text-th-text-t text-lg">
              {project.matches.length === 0
                ? (t.projects?.noMatchesYet || 'No matches yet')
                : (t.projects?.noMatchesFilter || 'No matches with this filter')}
            </p>
            {project.matches.length === 0 && (
              <p className="text-sm text-th-text-m mt-1">
                {t.projects?.clickFindMatches || 'Click "Find Matches" to discover potential collaborators'}
              </p>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {activeTab === 'collaborators' && (
      <>
      {/* Collaborators Section */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-th-text mb-4 flex items-center gap-2">
          <PeopleTeam24Regular className="w-5 h-5 text-emerald-400" />
          {t.projects?.collaborators || 'Collaborators'}
        </h3>
        <TeamMembersList
          sourceType="PROJECT"
          sourceId={projectId}
          isOwner={true}
        />
      </div>

      {/* Collaboration Requests Section */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-th-text mb-4 flex items-center gap-2">
          <People24Regular className="w-5 h-5 text-blue-400" />
          {t.projects?.collaborationRequests || 'Collaboration Requests'}
          {sentRequests.length > 0 && (
            <span className="text-sm font-normal text-th-text-m">({sentRequests.length})</span>
          )}
        </h3>

        {isLoadingSentRequests ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-th-surface rounded-lg animate-pulse" />
            ))}
          </div>
        ) : sentRequests.length === 0 ? (
          <div className="text-center py-8">
            <People24Regular className="w-10 h-10 text-white/70 mx-auto mb-2" />
            <p className="text-th-text-m text-sm">
              {t.projects?.noCollaborationRequests || 'No collaboration requests sent yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sentRequests.map((req) => {
              const recipient = req.toUser || req.toContact;
              const recipientName = recipient?.fullName || 'Unknown';
              const recipientCompany = recipient && 'company' in recipient ? recipient.company : null;
              const recipientJobTitle = recipient && 'jobTitle' in recipient ? recipient.jobTitle : null;
              const session = req.session;
              const sessionStatus = session?.status;
              const sessionId = session?.id;
              const introSummary = req.introductionsSummary;
              const hasIntroductions = introSummary && introSummary.total > 0;
              const isExpanded = expandedRequestId === req.id;
              const intros = requestIntroductions[req.id] || [];

              return (
                <div key={req.id} className="bg-th-surface border border-th-border rounded-xl overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-th-bg-t flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {recipient?.avatarUrl ? (
                          <img src={recipient.avatarUrl} alt={recipientName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-th-text-t">
                            {recipientName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-th-text text-sm truncate">{recipientName}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${getRequestStatusColor(req.status)}`}>
                            {getRequestStatusLabel(req.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-th-text-m mt-0.5">
                          {recipientJobTitle && <span className="truncate">{recipientJobTitle}</span>}
                          {recipientJobTitle && recipientCompany && <span>·</span>}
                          {recipientCompany && <span className="truncate">{recipientCompany}</span>}
                          {(recipientJobTitle || recipientCompany) && <span>·</span>}
                          <span>{formatRelativeTime(req.createdAt)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {req.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancelRequest(req.id)}
                            disabled={cancellingId === req.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                          >
                            {cancellingId === req.id ? '...' : (t.projects?.cancelRequest || 'Cancel')}
                          </button>
                        )}

                        {req.status === 'ACCEPTED' && sessionStatus === 'DONE' && sessionId && (
                          <button
                            onClick={() => handleViewResults(sessionId, recipientName)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                          >
                            {`${t.projects?.viewResults || 'View Results'} (${session?.matchCount || 0})`}
                          </button>
                        )}

                        {req.status === 'ACCEPTED' && sessionStatus === 'RUNNING' && (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-500 rounded-full transition-all"
                                style={{ width: `${session?.progress || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-yellow-400">{t.projects?.matchingInProgress || 'Matching...'}</span>
                          </div>
                        )}

                        {req.status === 'ACCEPTED' && sessionStatus === 'FAILED' && (
                          <span className="text-xs text-red-400">{t.projects?.matchingFailed || 'Failed'}</span>
                        )}
                      </div>
                    </div>

                    {/* Introduction Summary Bar - clickable to expand */}
                    {hasIntroductions && (
                      <button
                        onClick={() => toggleIntroductions(req.id)}
                        className="w-full flex items-center justify-between gap-2 mt-3 pt-3 border-t border-th-border cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-th-text-s">{t.collaborations?.introductions || 'Introductions'} ({introSummary.total})</span>
                          {introSummary.completed > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">
                              {introSummary.completed} {t.collaborations?.completed || 'Completed'}
                            </span>
                          )}
                          {introSummary.accepted > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400">
                              {introSummary.accepted} {t.collaborations?.accepted || 'Accepted'}
                            </span>
                          )}
                          {introSummary.sent > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400">
                              {introSummary.sent} {t.collaborations?.awaitingResponse || 'Awaiting'}
                            </span>
                          )}
                          {introSummary.pending > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400">
                              {introSummary.pending} {t.collaborations?.pending || 'Pending'}
                            </span>
                          )}
                          {introSummary.declined > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">
                              {introSummary.declined} {t.collaborations?.declined || 'Declined'}
                            </span>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp24Regular className="w-4 h-4 text-th-text-m flex-shrink-0" />
                        ) : (
                          <ChevronDown24Regular className="w-4 h-4 text-th-text-m flex-shrink-0" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded Introductions List */}
                  {isExpanded && hasIntroductions && (
                    <div className="border-t border-th-border bg-th-bg-s/50 px-4 py-3">
                      {loadingIntroductions === req.id ? (
                        <div className="space-y-2">
                          {[1, 2].map((i) => (
                            <div key={i} className="h-12 bg-th-surface rounded-lg animate-pulse" />
                          ))}
                        </div>
                      ) : intros.length === 0 ? (
                        <p className="text-xs text-th-text-m text-center py-2">
                          {t.collaborations?.noRequests || 'No introductions yet'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {intros.map((intro) => (
                            <div
                              key={intro.id}
                              className={`rounded-lg border p-3 ${
                                intro.status === 'ACCEPTED' || intro.status === 'COMPLETED'
                                  ? 'border-green-500/30 bg-green-500/5'
                                  : intro.status === 'DECLINED'
                                  ? 'border-red-500/30 bg-red-500/5'
                                  : 'border-th-border bg-th-surface'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Contact Avatar */}
                                <div className="w-8 h-8 rounded-full bg-th-bg-t flex items-center justify-center flex-shrink-0">
                                  <Person24Regular className="w-4 h-4 text-th-text-m" />
                                </div>

                                {/* Contact Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-th-text truncate">
                                      {intro.contact?.fullName || intro.contactName || 'Contact'}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getIntroductionStatusColor(intro.status)}`}>
                                      {getIntroductionStatusLabel(intro.status)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-th-text-m mt-0.5">
                                    {intro.contact?.jobTitle && (
                                      <span className="truncate">{intro.contact.jobTitle}</span>
                                    )}
                                    {intro.contact?.jobTitle && intro.contact?.company && <span>·</span>}
                                    {intro.contact?.company && (
                                      <span className="truncate">{intro.contact.company}</span>
                                    )}
                                    {(intro.contact?.jobTitle || intro.contact?.company) && <span>·</span>}
                                    {intro.channel && (
                                      <span>via {intro.channel === 'EMAIL' ? 'Email' : 'WhatsApp'}</span>
                                    )}
                                    <span>{formatRelativeTime(intro.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
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
      </>
      )}

      {/* Collaboration Match Results Modal */}
      {resultsModalSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResultsModalSessionId(null)} />
          <div className="relative w-full max-w-lg max-h-[90vh] bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 p-6 border-b border-th-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-th-text">
                    {t.projects?.viewResults || 'Match Results'}
                  </h2>
                  <p className="text-sm text-th-text-t mt-1">
                    {t.projects?.collaborationRequests || 'Collaboration'} — {resultsModalRecipient}
                  </p>
                </div>
                <button
                  onClick={() => setResultsModalSessionId(null)}
                  className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
                >
                  <Dismiss24Regular className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingResults ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : modalResults.length === 0 ? (
                <div className="text-center py-12">
                  <People24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
                  <p className="text-th-text-t">{t.projects?.noMatchesYet || 'No matches found'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {modalResults.map((result) => {
                    const contact = result.contact;
                    return (
                      <div
                        key={result.id}
                        className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all"
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar with gradient border */}
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-br from-blue-500 to-cyan-500">
                              <div className="w-full h-full rounded-full bg-th-bg-s flex items-center justify-center overflow-hidden">
                                {contact?.avatarUrl ? (
                                  <img src={contact.avatarUrl} alt={contact.fullName} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-sm font-bold text-th-text">
                                    {(contact?.fullName || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-th-text truncate">{contact?.fullName || 'Unknown'}</h3>
                            {contact?.jobTitle && (
                              <p className="text-sm text-th-text-t truncate flex items-center gap-1">
                                <Briefcase24Regular className="w-3.5 h-3.5 text-th-text-m flex-shrink-0" />
                                {contact.jobTitle}
                              </p>
                            )}
                            {contact?.company && (
                              <p className="text-sm text-th-text-m truncate flex items-center gap-1">
                                <Building24Regular className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                                {contact.company}
                              </p>
                            )}
                          </div>

                          {/* Match reasons as pills */}
                          {result.reasonsJson && result.reasonsJson.length > 0 && (
                            <div className="flex flex-wrap gap-1 flex-shrink-0 max-w-[120px] justify-end">
                              {result.reasonsJson.slice(0, 2).map((reason, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-300 border border-blue-500/20"
                                >
                                  {reason.text?.split(' ').slice(0, 2).join(' ') || reason.type?.replace('_MATCH', '')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Match Detail Modal */}
      {selectedMatch && project && (
        <MatchDetailModal
          match={selectedMatch}
          project={project}
          projectId={projectId}
          onClose={() => setSelectedMatch(null)}
          onStatusChange={(matchId, status) => {
            handleMatchStatusChange(matchId, status);
            // Update selected match status
            setSelectedMatch(prev => prev ? { ...prev, status } : null);
          }}
          t={t}
        />
      )}
    </div>
  );
}
