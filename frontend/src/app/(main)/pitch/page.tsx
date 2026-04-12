/**
 * Pitch Page
 *
 * List and manage pitches. Mirrors /projects page pattern.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useOrganizationStore } from '@/stores/organizationStore';
import {
  Add24Regular,
  Search24Regular,
  ChevronRight24Regular,
  People24Regular,
  Rocket24Regular,
  Globe24Regular,
  LockClosed24Regular,
  Delete24Regular,
  Edit24Regular,
  Sparkle24Regular,
  PeopleTeam24Regular,
  MoreVertical24Regular,
  Archive24Regular,
  ArrowUndo24Regular,
  ArrowSync24Regular,
  Lightbulb24Regular,
  Building24Regular,
} from '@fluentui/react-icons';
import {
  listPitches,
  deletePitch,
  archivePitch,
  Pitch,
  STAGE_OPTIONS,
  LOOKING_FOR_OPTIONS,
} from '@/lib/api/pitch';
import { Avatar } from '@/components/ui/Avatar';
import { toast } from '@/components/ui/Toast';

/**
 * Confirm Modal Component
 */
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-th-surface border border-th-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-semibold text-th-text mb-2">{title}</h3>
        <p className="text-sm text-th-text-t mb-6">{message}</p>
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-medium text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-colors">{cancelLabel || 'Cancel'}</button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50">
            {loading ? <ArrowSync24Regular className="w-4 h-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Card Menu Component (3-dot dropdown)
 */
function CardMenu({
  onEdit,
  onArchive,
  onDelete,
  isArchived,
  onOpenChange,
}: {
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isArchived: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const setOpenState = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenState(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenState(!open); }}
        className="p-1.5 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
      >
        <MoreVertical24Regular className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-1 w-44 bg-[#1e1e2e] border border-th-border rounded-xl shadow-xl z-50 overflow-hidden">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); setOpenState(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-th-text hover:bg-th-surface-h transition-colors"
          >
            <Edit24Regular className="w-4 h-4" />
            {t.common?.edit || 'Edit'}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchive(); setOpenState(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-th-text hover:bg-th-surface-h transition-colors"
          >
            {isArchived ? <><ArrowUndo24Regular className="w-4 h-4" />{t.common?.unarchive || 'Unarchive'}</> : <><Archive24Regular className="w-4 h-4" />{t.common?.archive || 'Archive'}</>}
          </button>
          <div className="border-t border-th-border" />
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); setOpenState(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Delete24Regular className="w-4 h-4" />
            {t.common?.delete || 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Pitch Card Component (matches ProjectCard exactly)
 */
function PitchCard({
  pitch,
  onEdit,
  onDelete,
  onArchive,
}: {
  pitch: Pitch;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const stageLabel = STAGE_OPTIONS.find(s => s.id === pitch.stage)?.label || pitch.stage;
  const lookingForLabels = (pitch.lookingFor || [])
    .map(id => LOOKING_FOR_OPTIONS.find(o => o.id === id)?.label || id)
    .slice(0, 2);

  return (
    <Link href={`/pitch/${pitch.id}`}>
      <div className={`group bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200 ${pitch.isActive === false ? 'opacity-70' : ''} ${menuOpen ? 'relative z-10' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-white truncate">{pitch.title || pitch.fileName}</h3>
              {pitch.visibility === 'PRIVATE' ? (
                <LockClosed24Regular className="w-4 h-4 text-th-text-m" />
              ) : (
                <Globe24Regular className="w-4 h-4 text-green-400" />
              )}
              {pitch.isActive === false && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  {t.common?.archived || 'Archived'}
                </span>
              )}
            </div>
            {pitch.companyName && (
              <p className="text-xs text-white font-bold flex items-center gap-1 mb-1">
                <Building24Regular className="w-3.5 h-3.5" />
                {pitch.companyName}
              </p>
            )}
            <p className="text-sm text-white font-bold line-clamp-2 mb-3">{pitch.summary || ''}</p>

            {/* Tags Row */}
            <div className="flex flex-wrap gap-2 mb-3">
              {stageLabel && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                  {stageLabel}
                </span>
              )}
              {pitch.category && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                  {(t.projects?.categories as Record<string, string>)?.[pitch.category] || pitch.category}
                </span>
              )}
              {lookingForLabels.map((label, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                  {label}
                </span>
              ))}
            </div>

            {/* Sectors */}
            {pitch.sectors && pitch.sectors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {pitch.sectors.slice(0, 3).map((sector) => (
                  <span key={sector.id} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
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

          {/* Match Count & Actions */}
          <div className="flex flex-col items-end gap-2">
            {(pitch.matchCount ?? 0) > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500 text-black text-xs font-bold">
                <People24Regular className="w-3 h-3" />
                {pitch.matchCount} {t.projects?.matches || 'matches'}
              </div>
            )}
            <CardMenu
              onEdit={() => onEdit(pitch.id)}
              onDelete={() => onDelete(pitch.id)}
              onArchive={() => onArchive(pitch.id)}
              isArchived={pitch.isActive === false}
              onOpenChange={setMenuOpen}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Team Pitch Card Component
 */
function TeamPitchCard({ pitch }: { pitch: Pitch }) {
  const { t } = useI18n();
  const stageLabel = STAGE_OPTIONS.find(s => s.id === pitch.stage)?.label || pitch.stage;

  return (
    <Link href={`/pitch/${pitch.id}`}>
      <div className="group bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200">
        <div className="flex items-start gap-3">
          <Avatar name={pitch.user?.fullName || 'Unknown'} src={pitch.user?.avatarUrl} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-white truncate">{pitch.title || pitch.fileName}</h3>
              {stageLabel && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                  {stageLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-white font-bold line-clamp-2 mb-2">{pitch.summary || ''}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-th-text-m">{pitch.user?.fullName}</span>
              {(pitch.matchCount ?? 0) > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500 text-black text-xs font-bold">
                  <People24Regular className="w-3 h-3" />
                  {pitch.matchCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function PitchesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organization = useOrganizationStore((s) => s.organization);
  const isTeamPlan = organization !== null;
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [teamPitches, setTeamPitches] = useState<Pitch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pitches' | 'team'>('pitches');
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  // Auto-open pitch from query param (e.g. /pitch?id=xxx)
  useEffect(() => {
    const pitchId = searchParams.get('id');
    if (pitchId) {
      router.push(`/pitch/${pitchId}`);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (activeTab === 'team') {
      fetchTeamPitches();
    } else {
      fetchPitches();
    }
  }, [activeTab]);

  const fetchPitches = async () => {
    setIsLoading(true);
    try {
      const data = await listPitches({ limit: 50 });
      setPitches(data.pitches);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamPitches = async () => {
    if (!organization) return;
    setIsLoading(true);
    try {
      // Team pitches use org context (handled by middleware)
      const data = await listPitches({ limit: 50 });
      setTeamPitches(data.pitches);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteRequest = (id: string) => {
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePitch(deleteTarget);
      setPitches((prev) => prev.filter((p) => p.id !== deleteTarget));
      toast({ title: t.pitch?.deleted || 'Pitch deleted', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleArchive = async (id: string) => {
    const pitch = pitches.find((p) => p.id === id);
    if (!pitch) return;
    try {
      await archivePitch(id, !pitch.isActive);
      setPitches((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
      );
      toast({
        title: pitch.isActive
          ? (t.pitch?.archived || 'Pitch archived')
          : (t.pitch?.unarchived || 'Pitch unarchived'),
        variant: 'success',
      });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/pitch/${id}/edit`);
  };

  const activePitches = pitches.filter(p => p.isActive !== false);
  const archivedPitches = pitches.filter(p => p.isActive === false);

  const sourcePitches = tab === 'active' ? activePitches : archivedPitches;
  const filteredPitches = sourcePitches.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (p.title || '').toLowerCase().includes(query) ||
      (p.summary || '').toLowerCase().includes(query) ||
      (p.companyName || '').toLowerCase().includes(query);
  });

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-th-text">{t.pitch?.title || 'Pitches'}</h1>
        <Link
          href="/pitch/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400 text-[#042820] text-sm font-bold rounded-lg hover:bg-emerald-500 transition-all"
        >
          <Add24Regular className="w-4 h-4" />
          {t.pitch?.new || 'New'}
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
          <Search24Regular className="w-5 h-5 text-th-text-m" />
        </div>
        <input
          type="text"
          placeholder={t.pitch?.searchPlaceholder || 'Search pitches...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
        />
      </div>

      {/* Archive Tabs */}
      <div className="flex items-center gap-1 bg-th-surface rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-emerald-400 text-[#042820] font-bold' : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'}`}
        >
          {t.common?.all || 'All'}
          {activePitches.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'active' ? 'bg-white/20' : 'bg-th-surface-h'}`}>
              {activePitches.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'archived' ? 'bg-emerald-400 text-[#042820] font-bold' : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'}`}
        >
          <Archive24Regular className="w-4 h-4" />
          {t.common?.archived || 'Archived'}
          {archivedPitches.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'archived' ? 'bg-white/20' : 'bg-th-surface-h'}`}>
              {archivedPitches.length}
            </span>
          )}
        </button>
      </div>

      {/* Tabs - only show if team plan */}
      {isTeamPlan && (
        <div className="flex gap-1 p-1 bg-th-surface rounded-xl">
          <button
            onClick={() => setActiveTab('pitches')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'pitches'
                ? 'bg-th-surface-h text-th-text'
                : 'text-th-text-t hover:text-th-text'
            }`}
          >
            {t.pitch?.myPitches || 'My Pitches'}
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'team'
                ? 'bg-th-surface-h text-th-text'
                : 'text-th-text-t hover:text-th-text'
            }`}
          >
            {t.organization?.teamProjects || 'Team'}
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-th-surface border border-th-border rounded-xl p-4 animate-pulse">
              <div className="space-y-3">
                <div className="h-5 bg-th-surface-h rounded w-1/3" />
                <div className="h-4 bg-th-surface-h rounded w-2/3" />
                <div className="flex gap-2">
                  <div className="h-6 bg-th-surface-h rounded w-16" />
                  <div className="h-6 bg-th-surface-h rounded w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content - My Pitches */}
      {activeTab === 'pitches' && !isLoading && filteredPitches.length > 0 && (
        <div className="space-y-3">
          {filteredPitches.map((pitch) => (
            <PitchCard key={pitch.id} pitch={pitch} onEdit={handleEdit} onDelete={handleDeleteRequest} onArchive={handleArchive} />
          ))}
        </div>
      )}

      {/* Content - Team Pitches */}
      {activeTab === 'team' && !isLoading && teamPitches.length > 0 && (
        <div className="space-y-3">
          {teamPitches.map((pitch) => (
            <TeamPitchCard key={pitch.id} pitch={pitch} />
          ))}
        </div>
      )}

      {/* Empty State - Team */}
      {activeTab === 'team' && !isLoading && teamPitches.length === 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          <PeopleTeam24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t text-lg">{t.organization?.noTeamProjects || 'No team pitches yet'}</p>
          <p className="text-sm text-th-text-m mt-1">
            {t.pitch?.shareWithTeam || 'Share your pitches with your team from the pitch detail page'}
          </p>
        </div>
      )}

      {/* Empty State - My Pitches (Active) */}
      {activeTab === 'pitches' && !isLoading && filteredPitches.length === 0 && tab === 'active' && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          <Lightbulb24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t text-lg">{t.pitch?.noPitches || 'No pitches yet'}</p>
          <p className="text-sm text-th-text-m mt-1">
            {searchQuery
              ? (t.common?.tryAgain || 'Try a different search')
              : (t.pitch?.createFirst || 'Create your first pitch to find matches')}
          </p>
          {!searchQuery && (
            <Link
              href="/pitch/new"
              className="inline-flex items-center gap-2 mt-4 px-6 py-2 bg-emerald-400 text-[#042820] font-bold rounded-xl hover:bg-emerald-500 transition-all"
            >
              <Add24Regular className="w-5 h-5" />
              {t.pitch?.createPitch || 'Create Pitch'}
            </Link>
          )}
        </div>
      )}

      {/* Empty State - My Pitches (Archived) */}
      {activeTab === 'pitches' && !isLoading && filteredPitches.length === 0 && tab === 'archived' && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          <Archive24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t text-lg">{t.pitch?.noArchivedPitches || 'No archived pitches'}</p>
          <p className="text-sm text-th-text-m mt-1">{t.pitch?.archivedWillAppear || 'Archived pitches will appear here.'}</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        title={t.pitch?.deletePitchTitle || 'Delete Pitch'}
        message={t.pitch?.deletePitchMessage || 'Are you sure you want to delete this pitch? This action cannot be undone and all associated matches will be removed.'}
        confirmLabel={t.common?.delete || 'Delete'}
        cancelLabel={t.common?.cancel || 'Cancel'}
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* FAB */}
      <Link
        href="/pitch/new"
        className="fixed bottom-24 end-6 w-14 h-14 bg-emerald-400 text-[#042820] rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-500 hover:scale-110 transition-all z-40"
      >
        <Add24Regular className="w-6 h-6" />
      </Link>
    </div>
  );
}
