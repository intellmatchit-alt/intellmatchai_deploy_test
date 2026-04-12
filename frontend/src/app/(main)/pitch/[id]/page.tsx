/**
 * Pitch Detail Page
 *
 * View pitch details, matches, and collaborators.
 * Mirrors the /projects/[id] page pattern.
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
  ChevronDown24Regular,
  ChevronUp24Regular,
  PersonAdd24Regular,
  Building24Regular,
  Briefcase24Regular,
  Eye24Regular,
  ArrowSync24Regular,
  Document24Regular,
  Clock24Regular,
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  Money24Regular,
  Calendar24Regular,
  Tag24Regular,
} from '@fluentui/react-icons';
import {
  getPitchStatus,
  getPitchResults,
  findPitchMatches,
  deletePitch,
  PitchStatusResponse,
  PitchResultsResponse,
  PitchSection,
  PitchMatch,
  PitchNeed,
  MatchStatus,
  STAGE_OPTIONS,
  LOOKING_FOR_OPTIONS,
} from '@/lib/api/pitch';
import { createContact } from '@/lib/api/contacts';
import { MatchActionBar, EditableIceBreakers, MatchCard, type MatchCardData } from '@/components/features/matches';
import {
  listSentRequests,
  cancelCollaborationRequest,
  getMatchResults,
  CollaborationRequest,
  CollaborationMatchResult,
  getRequestStatusColor,
  getRequestStatusLabel,
  formatRelativeTime,
} from '@/lib/api/collaboration';
import { toast } from '@/components/ui/Toast';
import { Avatar } from '@/components/ui/Avatar';
import CollaborateButton from '@/components/features/collaboration/CollaborateButton';
import TeamMembersList from '@/components/features/collaboration/TeamMembersList';

const STORAGE_KEY = 'pitch-matches-local-statuses';

function getLocalStatuses(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveLocalStatuses(statuses: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
}

const SECTION_ICONS: Record<string, string> = {
  PROBLEM: '\u{1F50D}',
  SOLUTION: '\u{1F4A1}',
  MARKET: '\u{1F4CA}',
  BUSINESS_MODEL: '\u{1F4B0}',
  TRACTION: '\u{1F4C8}',
  TECHNOLOGY: '\u{2699}\u{FE0F}',
  TEAM: '\u{1F465}',
  INVESTMENT_ASK: '\u{1F4B5}',
  EXECUTIVE_SUMMARY: '\u{1F4DD}',
  OTHER: '\u{1F4CB}',
};

/** Map PitchMatch to MatchCardData for the shared MatchCard */
function pitchMatchToCardData(match: PitchMatch, pitchTitle: string): MatchCardData | null {
  const contact = match.contact;
  if (!contact) return null;
  return {
    id: match.id,
    source: 'pitch',
    sourceTitle: pitchTitle,
    score: match.score,
    contactId: contact.id,
    name: contact.fullName,
    company: contact.company || undefined,
    jobTitle: contact.jobTitle || undefined,
    reasons: (match.reasons || []).map((r) => typeof r === 'string' ? r : r.text).filter(Boolean),
    sharedSectors: [],
    sharedSkills: [],
    status: match.status as string,
    channels: {
      phone: null,
      email: null,
      linkedinUrl: null,
    },
  };
}

/**
 * Match Detail Modal (adapted from project detail)
 */
function MatchDetailModal({
  match,
  pitchTitle,
  onClose,
  onStatusChange,
  t,
}: {
  match: PitchMatch;
  pitchTitle: string;
  onClose: () => void;
  onStatusChange: (matchId: string, status: MatchStatus) => void;
  t: any;
}) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);

  const contact = match.contact;
  if (!contact) return null;

  const handleStatusChange = async (status: string) => {
    setIsUpdating(true);
    try {
      const localStatuses = getLocalStatuses();
      const storageKey = `pitch-${match.id}`;
      if (status === 'ACTIVE' || status === 'PENDING') {
        delete localStatuses[storageKey];
        onStatusChange(match.id, 'PENDING' as MatchStatus);
      } else {
        localStatuses[storageKey] = status;
        onStatusChange(match.id, status as MatchStatus);
      }
      saveLocalStatuses(localStatuses);
      toast({ title: 'Status updated', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddContact = async () => {
    setIsAddingContact(true);
    try {
      await createContact({
        name: contact.fullName,
        company: contact.company || undefined,
        jobTitle: contact.jobTitle || undefined,
        source: 'MANUAL',
      });
      toast({ title: 'Contact added', description: `${contact.fullName} has been added to your contacts`, variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsAddingContact(false);
    }
  };

  const iceBreakers = (match.outreachDraft || '').split('\n').filter(Boolean);

  // Score breakdown
  const breakdown = match.breakdown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[calc(100%-2rem)] max-w-lg bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-th-border">
          <Avatar src={contact.avatarUrl} name={contact.fullName} size="sm" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{contact.fullName}</h2>
            <p className="text-xs text-white truncate">
              {[contact.jobTitle, contact.company].filter(Boolean).join(' \u00B7 ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${match.score >= 90 ? 'bg-[#22C55E] text-black border-[#22C55E]' : match.score >= 75 ? 'bg-[#84CC16] text-black border-[#84CC16]' : match.score >= 60 ? 'bg-[#FACC15] text-black border-[#FACC15]' : match.score >= 40 ? 'bg-[#FB923C] text-black border-[#FB923C]' : 'bg-[#EF4444] text-black border-[#EF4444]'}`}>{match.score}%</span>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-th-surface-h text-th-text-t">
              <Dismiss24Regular className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Score Breakdown */}
          {breakdown && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(breakdown).map(([key, val]) => (
                <div key={key} className="p-2 bg-th-surface rounded-lg">
                  <div className="text-xs text-white font-bold uppercase">{key}</div>
                  <div className="text-sm font-bold text-white">{val.score}<span className="text-xs text-white font-bold"> / 100</span></div>
                </div>
              ))}
            </div>
          )}

          {/* Angle Category */}
          {match.angleCategory && (
            <span className="inline-block px-2 py-1 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
              {match.angleCategory}
            </span>
          )}

          {/* Match Reasons */}
          {Array.isArray(match.reasons) && match.reasons.length > 0 && (
            <div className="space-y-1.5">
              {match.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Checkmark24Regular className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white">{typeof reason === 'string' ? reason : reason.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Ice Breakers / Outreach */}
          {iceBreakers.length > 0 && (
            <EditableIceBreakers
              iceBreakers={iceBreakers}
              accentColor="purple"
              label={t.pitch?.outreach || 'Suggested Outreach'}
              onSave={async () => {}}
            />
          )}

          {/* Actions */}
          <MatchActionBar
            currentStatus={match.status}
            contactName={contact.fullName}
            channels={{ phone: null, email: null, linkedinUrl: null }}
            onStatusChange={handleStatusChange}
            isUpdating={isUpdating}
            dismissStatus="IGNORED"
            t={t}
          />
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-3 border-t border-th-border bg-th-surface">
          <button
            onClick={handleAddContact}
            disabled={isAddingContact}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-500 text-[#042820] text-xs font-bold disabled:opacity-50"
          >
            <PersonAdd24Regular className="w-3.5 h-3.5" />
            Add to Contacts
          </button>
          <button
            onClick={() => { router.push(`/contacts/${contact.id}`); onClose(); }}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-400 hover:bg-emerald-500 text-[#042820] text-xs font-bold rounded-lg"
          >
            View Details
            <ChevronRight24Regular className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PitchDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const pitchId = params.id as string;

  const [pitchData, setPitchData] = useState<PitchStatusResponse | null>(null);
  const [results, setResults] = useState<PitchResultsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFindingMatches, setIsFindingMatches] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<PitchMatch | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'collaborators'>('matches');
  const [matchStatusFilter, setMatchStatusFilter] = useState<'active' | 'archived' | 'dismissed'>('active');

  // Sections expand
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Collaboration requests state
  const [sentRequests, setSentRequests] = useState<CollaborationRequest[]>([]);
  const [isLoadingSentRequests, setIsLoadingSentRequests] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Polling for processing
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch pitch data
  useEffect(() => {
    fetchPitchData();
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [pitchId]);

  // Fetch collaboration requests
  useEffect(() => {
    if (pitchId) fetchSentRequests();
  }, [pitchId]);

  const fetchPitchData = async () => {
    setIsLoading(true);
    try {
      const [statusData, resultsData] = await Promise.all([
        getPitchStatus(pitchId),
        getPitchResults(pitchId).catch(() => null),
      ]);
      setPitchData(statusData);
      setResults(resultsData);

      // Start polling if still processing
      if (statusData.status !== 'COMPLETED' && statusData.status !== 'FAILED') {
        const interval = setInterval(async () => {
          try {
            const updated = await getPitchStatus(pitchId);
            setPitchData(updated);
            if (updated.status === 'COMPLETED' || updated.status === 'FAILED') {
              clearInterval(interval);
              setPollInterval(null);
              if (updated.status === 'COMPLETED') {
                const res = await getPitchResults(pitchId).catch(() => null);
                setResults(res);
              }
            }
          } catch {}
        }, 2000);
        setPollInterval(interval);
      }
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
      router.push('/pitch');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSentRequests = async () => {
    setIsLoadingSentRequests(true);
    try {
      const data = await listSentRequests({ sourceType: 'PITCH', sourceId: pitchId, limit: 50 });
      setSentRequests(data.requests);
    } catch {} finally {
      setIsLoadingSentRequests(false);
    }
  };

  const handleFindMatches = async () => {
    setIsFindingMatches(true);
    try {
      const result = await findPitchMatches(pitchId);
      setResults(result);
      toast({
        title: t.projects?.matchesFound || 'Matches found',
        description: `${result.matchCount} potential matches found`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsFindingMatches(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(t.pitch?.confirmDelete || 'Are you sure you want to delete this pitch?')) {
      try {
        await deletePitch(pitchId);
        toast({ title: t.pitch?.deleted || 'Pitch deleted', variant: 'success' });
        router.push('/pitch');
      } catch (error: any) {
        toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
      }
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setCancellingId(requestId);
    try {
      await cancelCollaborationRequest(requestId);
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast({ title: 'Request cancelled', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setCancellingId(null);
    }
  };

  const handleMatchStatusChange = (matchId: string, status: MatchStatus) => {
    if (!results) return;
    setResults({
      ...results,
      sections: results.sections.map((s) => ({
        ...s,
        matches: s.matches.map((m) => m.id === matchId ? { ...m, status } : m),
      })),
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
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

  if (!pitchData) return null;

  // Gather all matches across sections
  const allMatches = results?.sections?.flatMap((s) => s.matches) || [];
  const localStatuses = getLocalStatuses();
  for (const m of allMatches) {
    const stored = localStatuses[`pitch-${m.id}`];
    if (stored) m.status = stored as MatchStatus;
  }

  const activeCount = allMatches.filter((m) => m.status !== 'IGNORED' && m.status !== 'ARCHIVED').length;
  const archivedCount = allMatches.filter((m) => m.status === 'ARCHIVED').length;
  const dismissedCount = allMatches.filter((m) => m.status === 'IGNORED').length;

  const statusFilteredMatches = allMatches.filter((m) => {
    if (matchStatusFilter === 'active') return m.status !== 'IGNORED' && m.status !== 'ARCHIVED';
    if (matchStatusFilter === 'archived') return m.status === 'ARCHIVED';
    if (matchStatusFilter === 'dismissed') return m.status === 'IGNORED';
    return true;
  });

  const stageLabel = STAGE_OPTIONS.find((s) => s.id === pitchData.stage)?.label || pitchData.stage || '';
  const lookingForLabels = (pitchData.lookingFor || []).map(
    (id) => LOOKING_FOR_OPTIONS.find((o) => o.id === id)?.label || id
  );

  const isProcessing = pitchData.status !== 'COMPLETED' && pitchData.status !== 'FAILED';
  const sections = results?.sections || [];
  const needs = results?.needs || [];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/pitch')} className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors">
            <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-th-text">{pitchData.title || 'Untitled Pitch'}</h1>
            {pitchData.companyName && (
              <p className="text-sm text-th-text-t flex items-center gap-1">
                <Building24Regular className="w-4 h-4" />
                {pitchData.companyName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/pitch/${pitchId}/edit`} className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors">
            <Edit24Regular className="w-5 h-5" />
          </Link>
          <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-red-500/20 text-th-text-t hover:text-red-400 transition-colors">
            <Delete24Regular className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Processing Progress */}
      {isProcessing && pitchData.progress && (
        <div className="bg-th-surface backdrop-blur-sm border border-emerald-500/30 rounded-xl p-6">
          <div className="flex items-center gap-2 text-emerald-400 mb-4">
            <ArrowSync24Regular className="w-5 h-5 animate-spin" />
            <span className="font-medium">Processing Pitch...</span>
          </div>
          <div className="w-full h-2 bg-th-surface-h rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all" style={{ width: `${pitchData.progress.overall}%` }} />
          </div>
          <div className="space-y-2">
            {pitchData.progress.steps.map((step) => (
              <div key={step.step} className="flex items-center gap-2 text-sm">
                {step.status === 'COMPLETED' && <CheckmarkCircle24Regular className="w-4 h-4 text-green-400" />}
                {step.status === 'PROCESSING' && <ArrowSync24Regular className="w-4 h-4 text-emerald-400 animate-spin" />}
                {step.status === 'FAILED' && <ErrorCircle24Regular className="w-4 h-4 text-red-400" />}
                {step.status === 'PENDING' && <div className="w-4 h-4 rounded-full border border-th-border" />}
                <span className={step.status === 'COMPLETED' ? 'text-green-400' : step.status === 'PROCESSING' ? 'text-emerald-400' : 'text-th-text-m'}>
                  {step.step.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pitch Info */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6 space-y-4">
        {pitchData.summary && <p className="text-white font-bold">{pitchData.summary}</p>}
        {pitchData.detailedDesc && <p className="text-sm text-white">{pitchData.detailedDesc}</p>}

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {stageLabel && (
            <span className="px-3 py-1 rounded-full text-sm bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
              <Rocket24Regular className="w-4 h-4 inline me-1" />{stageLabel}
            </span>
          )}
          {pitchData.category && (
            <span className="px-3 py-1 rounded-full text-sm bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
              {(t.projects?.categories as Record<string, string>)?.[pitchData.category] || pitchData.category}
            </span>
          )}
        </div>

        {/* Investment & Timeline */}
        {(pitchData.investmentRange || pitchData.timeline) && (
          <div className="flex flex-wrap gap-4 text-sm">
            {pitchData.investmentRange && (
              <div className="flex items-center gap-1 text-white font-bold">
                <Money24Regular className="w-4 h-4" />{pitchData.investmentRange}
              </div>
            )}
            {pitchData.timeline && (
              <div className="flex items-center gap-1 text-white font-bold">
                <Calendar24Regular className="w-4 h-4" />{pitchData.timeline}
              </div>
            )}
          </div>
        )}

        {/* Looking For */}
        {lookingForLabels.length > 0 && (
          <div>
            <h4 className="text-sm text-white font-bold mb-2 flex items-center gap-2">
              <People24Regular className="w-4 h-4" />Looking For
            </h4>
            <div className="flex flex-wrap gap-2">
              {lookingForLabels.map((label, i) => (
                <span key={i} className="px-2 py-1 rounded-lg text-sm bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{label}</span>
              ))}
            </div>
          </div>
        )}

        {/* Sectors & Skills */}
        <div className="grid grid-cols-2 gap-4">
          {pitchData.sectors && pitchData.sectors.length > 0 && (
            <div>
              <h4 className="text-sm text-white font-bold mb-2">Sectors</h4>
              <div className="flex flex-wrap gap-1">
                {pitchData.sectors.map((s) => (
                  <span key={s.id} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">{s.name}</span>
                ))}
              </div>
            </div>
          )}
          {pitchData.skillsNeeded && pitchData.skillsNeeded.length > 0 && (
            <div>
              <h4 className="text-sm text-white font-bold mb-2">Skills Needed</h4>
              <div className="flex flex-wrap gap-1">
                {pitchData.skillsNeeded.map((s) => (
                  <span key={s.id} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                    {s.name}
                    {s.importance && <span className="ml-1">({s.importance})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* File info */}
        {pitchData.fileName && (
          <div className="flex items-center gap-4 text-xs text-white font-bold pt-2 border-t border-th-border">
            <div className="flex items-center gap-1"><Document24Regular className="w-3.5 h-3.5" />{pitchData.fileName}</div>
            <div className="flex items-center gap-1"><Clock24Regular className="w-3.5 h-3.5" />{new Date(pitchData.uploadedAt).toLocaleDateString()}</div>
          </div>
        )}
      </div>

      {/* Sections (Pitch-specific) */}
      {sections.length > 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Document24Regular className="w-5 h-5 text-emerald-400" />
            {t.pitch?.sections || 'Pitch Sections'} ({sections.length})
          </h3>
          <div className="space-y-2">
            {sections.map((section) => (
              <div key={section.id} className="border border-th-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-th-surface-h transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{SECTION_ICONS[section.type] || '\u{1F4CB}'}</span>
                    <span className="text-xs px-2 py-0.5 bg-emerald-400 text-[#042820] border border-emerald-400/80 rounded-full font-bold uppercase flex-shrink-0">
                      {section.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-white font-bold truncate">{section.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-white font-bold">{Math.round(section.confidence * 100)}%</span>
                    <span className="text-xs text-white font-bold">{section.matches?.length || 0} matches</span>
                    {expandedSections.has(section.id) ? <ChevronUp24Regular className="w-4 h-4 text-th-text-t" /> : <ChevronDown24Regular className="w-4 h-4 text-th-text-t" />}
                  </div>
                </button>
                {expandedSections.has(section.id) && (
                  <div className="px-3 pb-3 border-t border-th-border pt-3">
                    <p className="text-sm text-white whitespace-pre-wrap">{section.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Needs (Pitch-specific) */}
      {needs.length > 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Tag24Regular className="w-5 h-5 text-emerald-400" />
            {t.pitch?.needs || 'Identified Needs'} ({needs.length})
          </h3>
          <div className="space-y-2">
            {needs.map((need) => (
              <div key={need.key} className="p-3 bg-th-bg rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{need.label}</span>
                  <span className="text-xs text-white font-bold">{Math.round(need.confidence * 100)}%</span>
                </div>
                {need.description && <p className="text-xs text-white mt-1">{need.description}</p>}
                <div className="flex items-center gap-3 mt-1.5">
                  {need.amount && <span className="text-xs px-2 py-0.5 bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold rounded-full">{need.amount}</span>}
                  {need.timeline && <span className="text-xs px-2 py-0.5 bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold rounded-full">{need.timeline}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-th-border pb-1">
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold transition-all ${
            activeTab === 'matches'
              ? 'bg-emerald-400 text-[#042820]'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
          }`}
        >
          <Sparkle24Regular className="w-5 h-5" />
          {t.pitch?.matches || 'Matches'}
          {activeCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-green-500 text-black font-bold">{activeCount}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('collaborators')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold transition-all ${
            activeTab === 'collaborators'
              ? 'bg-emerald-400 text-[#042820]'
              : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
          }`}
        >
          <PeopleTeam24Regular className="w-5 h-5" />
          Collaborators
        </button>
      </div>

      {activeTab === 'matches' && (
        <>
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkle24Regular className="w-6 h-6 text-emerald-400" />
                {t.pitch?.matches || 'Matches'}
                {activeCount > 0 && <span className="text-sm font-normal text-th-text-m">({activeCount})</span>}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFindMatches}
                  disabled={isFindingMatches || isProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400 text-[#042820] text-sm font-bold rounded-lg hover:bg-emerald-500 transition-all disabled:opacity-50"
                >
                  {isFindingMatches ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Finding...</>
                  ) : (
                    <><Sparkle24Regular className="w-4 h-4" />{t.projects?.findMatches || 'Find Matches'}</>
                  )}
                </button>
                <CollaborateButton
                  sourceType="PITCH"
                  sourceId={pitchId}
                  sourceTitle={pitchData.title || 'Pitch'}
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
                      ? 'bg-emerald-400 text-[#042820] font-bold'
                      : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Matches List */}
            {statusFilteredMatches.length > 0 ? (
              <div className="space-y-3">
                {statusFilteredMatches.map((match) => {
                  const cardData = pitchMatchToCardData(match, pitchData?.title || 'Pitch');
                  if (!cardData) return null;
                  return (
                    <MatchCard
                      key={match.id}
                      match={cardData}
                      onClick={() => setSelectedMatch(match)}
                      onStatusChange={async (id, status) => {
                        const ls = getLocalStatuses();
                        const storageKey = `pitch-${match.id}`;
                        if (status === 'ACTIVE') {
                          delete ls[storageKey];
                          handleMatchStatusChange(match.id, 'PENDING' as MatchStatus);
                        } else {
                          ls[storageKey] = status;
                          handleMatchStatusChange(match.id, status as MatchStatus);
                        }
                        saveLocalStatuses(ls);
                        toast({ title: 'Status updated', variant: 'success' });
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
                  {allMatches.length === 0 ? (t.pitch?.noMatches || 'No matches yet') : 'No matches with this filter'}
                </p>
                {allMatches.length === 0 && (
                  <p className="text-sm text-th-text-m mt-1">Click &quot;Find Matches&quot; to discover potential connections</p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'collaborators' && (
        <>
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-th-text mb-4 flex items-center gap-2">
              <PeopleTeam24Regular className="w-5 h-5 text-emerald-400" />
              Collaborators
            </h3>
            <TeamMembersList sourceType="PITCH" sourceId={pitchId} isOwner={true} />
          </div>

          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-th-text mb-4 flex items-center gap-2">
              <People24Regular className="w-5 h-5 text-blue-400" />
              Collaboration Requests
              {sentRequests.length > 0 && <span className="text-sm font-normal text-th-text-m">({sentRequests.length})</span>}
            </h3>

            {isLoadingSentRequests ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-16 bg-th-surface rounded-lg animate-pulse" />)}
              </div>
            ) : sentRequests.length === 0 ? (
              <div className="text-center py-8">
                <People24Regular className="w-10 h-10 text-white/70 mx-auto mb-2" />
                <p className="text-th-text-m text-sm">No collaboration requests sent yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentRequests.map((req) => {
                  const recipient = req.toUser || req.toContact;
                  const recipientName = recipient?.fullName || 'Unknown';
                  return (
                    <div key={req.id} className="bg-th-surface border border-th-border rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-th-bg-t flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-th-text-t">
                            {recipientName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-th-text text-sm truncate">{recipientName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs border ${getRequestStatusColor(req.status)}`}>
                              {getRequestStatusLabel(req.status)}
                            </span>
                          </div>
                          <div className="text-xs text-th-text-m mt-0.5">{formatRelativeTime(req.createdAt)}</div>
                        </div>
                        {req.status === 'PENDING' && (
                          <button
                            onClick={() => handleCancelRequest(req.id)}
                            disabled={cancellingId === req.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                          >
                            {cancellingId === req.id ? '...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Match Detail Modal */}
      {selectedMatch && pitchData && (
        <MatchDetailModal
          match={selectedMatch}
          pitchTitle={pitchData.title || 'Pitch'}
          onClose={() => setSelectedMatch(null)}
          onStatusChange={(matchId, status) => {
            handleMatchStatusChange(matchId, status);
            setSelectedMatch(prev => prev ? { ...prev, status } : null);
          }}
          t={t}
        />
      )}
    </div>
  );
}
