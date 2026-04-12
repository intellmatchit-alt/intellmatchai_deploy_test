/**
 * Discover Pitches Page
 *
 * Browse public pitches from other users.
 * Mirrors /projects/discover pattern exactly.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Search24Regular,
  Rocket24Regular,
  People24Regular,
  ChevronRight24Regular,
  Globe24Regular,
  Dismiss24Regular,
  Checkmark24Regular,
  PersonAdd24Regular,
  Chat24Regular,
  BookmarkAdd24Regular,
  Bookmark24Filled,
  Building24Regular,
  Briefcase24Regular,
  PeopleTeam24Regular,
} from '@fluentui/react-icons';
import {
  discoverPitches,
  Pitch,
  PitchStage,
  STAGE_OPTIONS,
  LOOKING_FOR_OPTIONS,
} from '@/lib/api/pitch';
import { getContacts } from '@/lib/api/contacts';
import { toast } from '@/components/ui/Toast';

// Helper to manage saved pitches in localStorage
const SAVED_PITCHES_KEY = 'savedDiscoverPitches';

function getSavedPitches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_PITCHES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function toggleSavedPitch(pitchId: string): boolean {
  const saved = getSavedPitches();
  const index = saved.indexOf(pitchId);
  if (index === -1) {
    saved.push(pitchId);
    localStorage.setItem(SAVED_PITCHES_KEY, JSON.stringify(saved));
    return true;
  } else {
    saved.splice(index, 1);
    localStorage.setItem(SAVED_PITCHES_KEY, JSON.stringify(saved));
    return false;
  }
}

interface DiscoverPitch extends Pitch {
  isSaved?: boolean;
  isFromContact?: boolean;
}

/**
 * Pitch Detail Modal
 */
function PitchDetailModal({
  pitch,
  onClose,
  onAddToContact,
  onToggleSave,
  t,
}: {
  pitch: DiscoverPitch;
  onClose: () => void;
  onAddToContact: (pitch: DiscoverPitch) => void;
  onToggleSave: (pitch: DiscoverPitch) => void;
  t: any;
}) {
  const stageLabel = STAGE_OPTIONS.find((s) => s.id === pitch.stage)?.label || pitch.stage;
  const lookingForLabels = (pitch.lookingFor || []).map(
    (id) => LOOKING_FOR_OPTIONS.find((o) => o.id === id)?.label || id
  );

  const matchReasons = [
    `Looking for ${lookingForLabels[0] || 'collaborators'}`,
    `Pitch in ${pitch.sectors?.[0]?.name || 'Business'} sector`,
    `Stage: ${stageLabel}`,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-th-border">
          {pitch.user && (
            <Avatar src={pitch.user.avatarUrl} name={pitch.user.fullName} size="lg" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-th-text mb-1">{pitch.title || 'Untitled'}</h2>
            <div className="flex items-center gap-2 text-sm text-th-text-t">
              <span className="font-medium text-th-text-s">{pitch.user?.fullName}</span>
              {pitch.user?.company && (
                <>
                  <span>·</span>
                  <span>{pitch.user.company}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {stageLabel && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {stageLabel}
                </span>
              )}
              {pitch.companyName && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {pitch.companyName}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors">
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary */}
          <div>
            <h3 className="text-sm font-medium text-th-text-t mb-2">About This Pitch</h3>
            <p className="text-th-text-s">{pitch.summary}</p>
            {pitch.detailedDesc && (
              <p className="text-th-text-t text-sm mt-2">{pitch.detailedDesc}</p>
            )}
          </div>

          {/* Why This Match */}
          <div>
            <h3 className="text-sm font-medium text-th-text-t mb-3">Why This Could Be a Good Match</h3>
            <ul className="space-y-2">
              {matchReasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-th-text-s">
                  <Checkmark24Regular className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {/* Looking For */}
          {lookingForLabels.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-th-text-t mb-3">Looking For</h3>
              <div className="flex flex-wrap gap-2">
                {lookingForLabels.map((label, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full text-sm bg-green-500/10 text-green-400 border border-green-500/20">
                    <People24Regular className="w-4 h-4 inline me-1" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sectors & Skills */}
          {((pitch.sectors && pitch.sectors.length > 0) || (pitch.skillsNeeded && pitch.skillsNeeded.length > 0)) && (
            <div>
              <h3 className="text-sm font-medium text-th-text-t mb-3">Sectors & Skills</h3>
              <div className="flex flex-wrap gap-2">
                {(pitch.sectors || []).map((sector) => (
                  <span key={sector.id} className="px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {sector.name}
                  </span>
                ))}
                {(pitch.skillsNeeded || []).map((skill) => (
                  <span key={skill.id} className="px-3 py-1 rounded-full text-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Owner Info */}
          {pitch.user && (
            <div className="bg-th-surface rounded-xl p-4 border border-th-border">
              <h3 className="text-sm font-medium text-th-text-t mb-3">Pitch Owner</h3>
              <div className="flex items-center gap-4">
                <Avatar src={pitch.user.avatarUrl} name={pitch.user.fullName} size="lg" />
                <div className="flex-1">
                  <p className="font-semibold text-th-text">{pitch.user.fullName}</p>
                  {pitch.user.jobTitle && (
                    <p className="text-sm text-th-text-t flex items-center gap-1">
                      <Briefcase24Regular className="w-4 h-4" />
                      {pitch.user.jobTitle}
                    </p>
                  )}
                  {pitch.user.company && (
                    <p className="text-sm text-th-text-t flex items-center gap-1">
                      <Building24Regular className="w-4 h-4" />
                      {pitch.user.company}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex flex-col gap-3 p-6 border-t border-th-border bg-th-surface">
          <button
            onClick={() => onAddToContact(pitch)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            <PersonAdd24Regular className="w-5 h-5" />
            {t.projects?.addOwnerToContacts || 'Add Owner to Contacts'}
          </button>
          <div className="flex items-center gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
              <Chat24Regular className="w-5 h-5" />
              {t.projects?.sendMessage || 'Message'}
            </button>
            <button
              onClick={() => onToggleSave(pitch)}
              className={`p-2.5 rounded-xl transition-colors ${
                pitch.isSaved
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  : 'bg-th-surface hover:bg-yellow-500/20 text-th-text-t hover:text-yellow-400'
              }`}
            >
              {pitch.isSaved ? <Bookmark24Filled className="w-5 h-5" /> : <BookmarkAdd24Regular className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Discover Pitch Card
 */
function DiscoverCard({
  pitch,
  onClick,
  onToggleSave,
  t,
}: {
  pitch: DiscoverPitch;
  onClick: () => void;
  onToggleSave: (pitch: DiscoverPitch) => void;
  t: any;
}) {
  const stageLabel = STAGE_OPTIONS.find((s) => s.id === pitch.stage)?.label || pitch.stage;
  const lookingForLabels = (pitch.lookingFor || [])
    .map((id) => LOOKING_FOR_OPTIONS.find((o) => o.id === id)?.label || id)
    .slice(0, 2);

  return (
    <div
      onClick={onClick}
      className={`bg-th-surface backdrop-blur-sm border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200 cursor-pointer ${
        pitch.isSaved
          ? 'border-yellow-500/30 hover:border-yellow-500/50'
          : pitch.isFromContact
          ? 'border-emerald-500/30 hover:border-emerald-500/50'
          : 'border-th-border hover:border-emerald-500/30'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          {pitch.user && (
            <Avatar src={pitch.user.avatarUrl} name={pitch.user.fullName} size="lg" />
          )}
          {pitch.isFromContact && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <PeopleTeam24Regular className="w-3 h-3 text-th-text" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-th-text">{pitch.title || 'Untitled'}</h3>
            {pitch.isSaved && <Bookmark24Filled className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
          </div>

          {pitch.companyName && (
            <p className="text-xs text-th-text-m flex items-center gap-1 mb-1">
              <Building24Regular className="w-3.5 h-3.5" />
              {pitch.companyName}
            </p>
          )}

          <p className="text-sm text-th-text-t line-clamp-2 mb-3">{pitch.summary || ''}</p>

          <div className="flex items-center gap-2 text-sm text-th-text-m mb-3">
            <span className="font-medium text-th-text-s">{pitch.user?.fullName}</span>
            {pitch.user?.company && (
              <>
                <span>·</span>
                <span>{pitch.user.company}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {stageLabel && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {stageLabel}
              </span>
            )}
            {pitch.category && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {(t.projects?.categories as Record<string, string>)?.[pitch.category] || pitch.category}
              </span>
            )}
            {lookingForLabels.map((label, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                <People24Regular className="w-3 h-3 inline me-1" />
                {label}
              </span>
            ))}
          </div>

          {pitch.sectors && pitch.sectors.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {pitch.sectors.slice(0, 3).map((sector) => (
                <span key={sector.id} className="px-2 py-0.5 rounded-full text-xs bg-th-surface text-th-text-m">
                  {sector.name}
                </span>
              ))}
              {pitch.sectors.length > 3 && (
                <span className="px-2 py-0.5 rounded-full text-xs text-th-text-m">
                  +{pitch.sectors.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSave(pitch); }}
            className={`p-2 rounded-lg transition-colors ${
              pitch.isSaved
                ? 'text-yellow-400 hover:bg-yellow-500/20'
                : 'text-th-text-m hover:text-yellow-400 hover:bg-th-surface-h'
            }`}
          >
            {pitch.isSaved ? <Bookmark24Filled className="w-5 h-5" /> : <BookmarkAdd24Regular className="w-5 h-5" />}
          </button>
          <ChevronRight24Regular className="w-5 h-5 text-th-text-m flex-shrink-0 rtl:rotate-180" />
        </div>
      </div>
    </div>
  );
}

type StatusFilter = 'all' | 'saved' | 'from_network';

export default function DiscoverPitchesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [pitches, setPitches] = useState<DiscoverPitch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<PitchStage | null>(null);
  const [selectedLookingFor, setSelectedLookingFor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPitch, setSelectedPitch] = useState<DiscoverPitch | null>(null);
  const [savedPitchIds, setSavedPitchIds] = useState<string[]>([]);
  const [contactUserIds, setContactUserIds] = useState<string[]>([]);

  useEffect(() => {
    setSavedPitchIds(getSavedPitches());
    const loadContacts = async () => {
      try {
        const data = await getContacts({ limit: 500 });
        const userIds = data.contacts
          .filter((c: any) => c.linkedUserId)
          .map((c: any) => c.linkedUserId);
        setContactUserIds(userIds);
      } catch {}
    };
    loadContacts();
  }, []);

  useEffect(() => {
    fetchPitches();
  }, [selectedStage]);

  const fetchPitches = async (loadMore = false) => {
    if (!loadMore) setIsLoading(true);
    try {
      const currentPage = loadMore ? page + 1 : 1;
      const data = await discoverPitches({
        page: currentPage,
        limit: 20,
        stage: selectedStage || undefined,
      });

      if (loadMore) {
        setPitches((prev) => [...prev, ...data.pitches]);
      } else {
        setPitches(data.pitches);
      }

      setPage(currentPage);
      setHasMore(data.pagination.page < data.pagination.totalPages);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToContact = (pitch: DiscoverPitch) => {
    const user = pitch.user;
    if (!user) return;

    const contactData = {
      fullName: user.fullName || '',
      email: user.email || '',
      company: user.company || '',
      jobTitle: user.jobTitle || '',
    };
    sessionStorage.setItem('scannedContact', JSON.stringify(contactData));

    const aiSuggestions = {
      sectors: (pitch.sectors || []).map(s => s.name),
      skills: (pitch.skillsNeeded || []).map(s => s.name),
      interests: (pitch.lookingFor || []).map(id => LOOKING_FOR_OPTIONS.find(o => o.id === id)?.label || id),
      bio: `Pitch: ${pitch.title}\n${pitch.summary || ''}`,
    };
    sessionStorage.setItem('aiSuggestions', JSON.stringify(aiSuggestions));
    sessionStorage.setItem('contactSource', 'PITCH');

    setSelectedPitch(null);
    router.push('/contacts/new');
  };

  const handleToggleSave = (pitch: DiscoverPitch) => {
    const nowSaved = toggleSavedPitch(pitch.id);
    setSavedPitchIds(getSavedPitches());

    if (selectedPitch?.id === pitch.id) {
      setSelectedPitch({ ...selectedPitch, isSaved: nowSaved });
    }

    toast({
      title: nowSaved ? 'Pitch Saved' : 'Removed from Saved',
      variant: 'success',
    });
  };

  const enrichedPitches = pitches.map((p) => ({
    ...p,
    isSaved: savedPitchIds.includes(p.id),
    isFromContact: p.user ? contactUserIds.includes(p.user.id) : false,
  }));

  const filteredPitches = enrichedPitches.filter((p) => {
    const matchesSearch = !searchQuery ||
      (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.summary || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.user?.fullName || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLookingFor = !selectedLookingFor ||
      (p.lookingFor || []).includes(selectedLookingFor);

    let matchesStatus = true;
    if (statusFilter === 'saved') matchesStatus = !!p.isSaved;
    else if (statusFilter === 'from_network') matchesStatus = !!p.isFromContact;

    return matchesSearch && matchesLookingFor && matchesStatus;
  });

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/pitch"
          className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
        >
          <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
        </Link>
        <h1 className="text-2xl font-bold text-th-text flex items-center gap-2">
          <Globe24Regular className="w-7 h-7 text-emerald-400" />
          {t.pitch?.discoverPitches || 'Discover Pitches'}
        </h1>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
          <Search24Regular className="w-5 h-5 text-th-text-m" />
        </div>
        <input
          type="text"
          placeholder="Search pitches or creators..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
        />
      </div>

      {/* Stage Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedStage(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            !selectedStage
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
              : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
          }`}
        >
          All Stages
        </button>
        {STAGE_OPTIONS.map((stage) => (
          <button
            key={stage.id}
            onClick={() => setSelectedStage(stage.id as PitchStage)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedStage === stage.id
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
            }`}
          >
            {stage.label}
          </button>
        ))}
      </div>

      {/* Looking For Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedLookingFor(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            !selectedLookingFor
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'
          }`}
        >
          All
        </button>
        {LOOKING_FOR_OPTIONS.slice(0, 6).map((option) => (
          <button
            key={option.id}
            onClick={() => setSelectedLookingFor(option.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedLookingFor === option.id
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            statusFilter === 'all'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'
          }`}
        >
          <Globe24Regular className="w-3.5 h-3.5" />
          All Pitches
        </button>
        <button
          onClick={() => setStatusFilter('saved')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            statusFilter === 'saved'
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'
          }`}
        >
          <Bookmark24Filled className="w-3.5 h-3.5" />
          Saved
          {savedPitchIds.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-500/30">
              {savedPitchIds.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setStatusFilter('from_network')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            statusFilter === 'from_network'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'
          }`}
        >
          <PeopleTeam24Regular className="w-3.5 h-3.5" />
          From My Network
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-th-surface border border-th-border rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-th-surface-h" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-th-surface-h rounded w-1/3" />
                  <div className="h-4 bg-th-surface-h rounded w-2/3" />
                  <div className="flex gap-2">
                    <div className="h-6 bg-th-surface-h rounded w-16" />
                    <div className="h-6 bg-th-surface-h rounded w-20" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && filteredPitches.length > 0 && (
        <>
          <div className="space-y-3">
            {filteredPitches.map((pitch) => (
              <DiscoverCard
                key={pitch.id}
                pitch={pitch}
                onClick={() => setSelectedPitch(pitch)}
                onToggleSave={handleToggleSave}
                t={t}
              />
            ))}
          </div>

          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => fetchPitches(true)}
                className="px-6 py-2 bg-th-surface border border-th-border text-th-text-s font-medium rounded-xl hover:bg-th-surface-h transition-all"
              >
                {t.common?.loadMore || 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && filteredPitches.length === 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          <Globe24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t text-lg">No pitches found</p>
          <p className="text-sm text-th-text-m mt-1">
            {searchQuery ? 'Try a different search' : 'No public pitches available right now'}
          </p>
        </div>
      )}

      {/* Pitch Detail Modal */}
      {selectedPitch && (
        <PitchDetailModal
          pitch={selectedPitch}
          onClose={() => setSelectedPitch(null)}
          onAddToContact={handleAddToContact}
          onToggleSave={handleToggleSave}
          t={t}
        />
      )}
    </div>
  );
}
