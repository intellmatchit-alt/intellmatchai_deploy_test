/**
 * Projects Page
 *
 * List and manage collaboration projects.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useOrganizationStore } from '@/stores/organizationStore';
import {
  Add24Regular,
  Search24Regular,
  ChevronRight24Regular,
  Lightbulb24Regular,
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
} from '@fluentui/react-icons';
import { getProjects, deleteProject, updateProject, Project, STAGE_OPTIONS, LOOKING_FOR_OPTIONS } from '@/lib/api/projects';
import { getTeamProjects, TeamProject } from '@/lib/api/organization';
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
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-th-surface border border-th-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-semibold text-th-text mb-2">{title}</h3>
        <p className="text-sm text-th-text-t mb-6">{message}</p>
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-medium text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-colors">{t.common?.cancel || 'Cancel'}</button>
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
}: {
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isArchived: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 176 }); // 176 = w-44 = 11rem
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleScroll() { setOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); updatePos(); setOpen(!open); }}
        className="p-1.5 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
      >
        <MoreVertical24Regular className="w-5 h-5" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed w-44 bg-[#1e1e2e] border border-th-border rounded-xl shadow-2xl overflow-hidden"
          style={{ top: pos.top, left: Math.max(8, pos.left), zIndex: 9999 }}
        >
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-th-text hover:bg-th-surface-h transition-colors"
          >
            <Edit24Regular className="w-4 h-4" />
            {t.common?.edit || 'Edit'}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchive(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-th-text hover:bg-th-surface-h transition-colors"
          >
            {isArchived ? <><ArrowUndo24Regular className="w-4 h-4" />{t.common?.unarchive || 'Unarchive'}</> : <><Archive24Regular className="w-4 h-4" />{t.common?.archive || 'Archive'}</>}
          </button>
          <div className="border-t border-th-border" />
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Delete24Regular className="w-4 h-4" />
            {t.common?.delete || 'Delete'}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * Project Card Component
 */
function ProjectCard({
  project,
  onEdit,
  onDelete,
  onArchive,
}: {
  project: Project;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const { t } = useI18n();

  const stageLabel = STAGE_OPTIONS.find(s => s.id === project.stage)?.label || project.stage;
  const lookingForLabels = project.lookingFor
    .map(id => LOOKING_FOR_OPTIONS.find(o => o.id === id)?.label || id)
    .slice(0, 2);

  const router = useRouter();

  return (
    <div className="relative mb-5" style={{ zIndex: 'auto' }}>
      <div
        onClick={() => router.push(`/projects/${project.id}`)}
        className={`group cursor-pointer bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200 ${!project.isActive ? 'opacity-70' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-white truncate">{project.title}</h3>
              {project.visibility === 'PRIVATE' ? (
                <LockClosed24Regular className="w-4 h-4 text-th-text-m" />
              ) : (
                <Globe24Regular className="w-4 h-4 text-green-400" />
              )}
              {!project.isActive && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  {t.common?.archived || 'Archived'}
                </span>
              )}
            </div>
            <p className="text-sm text-white font-bold line-clamp-2 mb-3">{project.summary}</p>

            {/* Tags Row */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                {stageLabel}
              </span>
              {project.category && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                  {(t.projects?.categories as Record<string, string>)?.[project.category] || project.category}
                </span>
              )}
              {lookingForLabels.map((label, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                  {label}
                </span>
              ))}
            </div>

            {/* Sectors */}
            {project.sectors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {project.sectors.slice(0, 3).map((sector) => (
                  <span key={sector.id} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                    {sector.name}
                  </span>
                ))}
                {project.sectors.length > 3 && (
                  <span className="px-2 py-0.5 rounded-full text-xs text-th-text-m">
                    +{project.sectors.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Match Count & Actions */}
          <div className="flex flex-col items-end gap-2">
            {(project.matchCount ?? 0) > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500 text-black text-xs font-bold">
                <People24Regular className="w-3 h-3" />
                {project.matchCount} {t.projects?.matches || 'matches'}
              </div>
            )}
            <CardMenu
              onEdit={() => onEdit(project.id)}
              onDelete={() => onDelete(project.id)}
              onArchive={() => onArchive(project.id)}
              isArchived={!project.isActive}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Team Project Card Component
 */
function TeamProjectCard({ project }: { project: TeamProject }) {
  const { t } = useI18n();
  const stageLabel = STAGE_OPTIONS.find(s => s.id === project.stage)?.label || project.stage;

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="group bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200">
        <div className="flex items-start gap-3">
          <Avatar name={project.user.fullName} src={project.user.avatarUrl} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-white truncate">{project.title}</h3>
              <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                {stageLabel}
              </span>
            </div>
            <p className="text-sm text-white font-bold line-clamp-2 mb-2">{project.summary}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-th-text-m">{project.user.fullName}</span>
              {project.matchCount > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500 text-black text-xs font-bold">
                  <People24Regular className="w-3 h-3" />
                  {project.matchCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const organization = useOrganizationStore((s) => s.organization);
  const isTeamPlan = organization !== null;
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamProjects, setTeamProjects] = useState<TeamProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'projects' | 'team'>('projects');
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  useEffect(() => {
    if (activeTab === 'team') {
      fetchTeamProjects();
    } else {
      fetchProjects();
    }
  }, [activeTab]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const data = await getProjects({ status: 'all', limit: 50 });
      setProjects(data.projects);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamProjects = async () => {
    if (!organization) return;
    setIsLoading(true);
    try {
      const data = await getTeamProjects(organization.id, { limit: 50 });
      setTeamProjects(data.projects);
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
      await deleteProject(deleteTarget);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget));
      toast({ title: t.projects?.deleted || 'Project deleted', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleArchive = async (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    try {
      await updateProject(id, { isActive: !project.isActive });
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
      );
      toast({
        title: project.isActive
          ? (t.projects?.archived || 'Project archived')
          : (t.projects?.unarchived || 'Project unarchived'),
        variant: 'success',
      });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/projects/${id}`);
  };

  const activeProjects = projects.filter(p => p.isActive !== false);
  const archivedProjects = projects.filter(p => p.isActive === false);

  const sourceProjects = tab === 'active' ? activeProjects : archivedProjects;
  const filteredProjects = sourceProjects.filter((p) => {
    if (!searchQuery) return true;
    return p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.summary.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-th-text">{t.projects?.title || 'Projects'}</h1>
        <Link
          href="/projects/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400 text-[#042820] text-sm font-bold rounded-lg hover:bg-emerald-500 transition-all"
        >
          <Add24Regular className="w-4 h-4" />
          {t.projects?.new || 'New'}
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
          <Search24Regular className="w-5 h-5 text-th-text-m" />
        </div>
        <input
          type="text"
          placeholder={t.projects?.searchPlaceholder || 'Search projects...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
        />
      </div>

      {/* Archive Tabs */}
      <div className="flex items-center gap-1 bg-th-surface rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${tab === 'active' ? 'bg-emerald-400 text-[#042820]' : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'}`}
        >
          {t.common?.all || 'All'}
          {activeProjects.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'active' ? 'bg-white/20' : 'bg-th-surface-h'}`}>
              {activeProjects.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${tab === 'archived' ? 'bg-emerald-400 text-[#042820]' : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'}`}
        >
          <Archive24Regular className="w-4 h-4" />
          {t.common?.archived || 'Archived'}
          {archivedProjects.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'archived' ? 'bg-white/20' : 'bg-th-surface-h'}`}>
              {archivedProjects.length}
            </span>
          )}
        </button>
      </div>

      {/* Tabs - only show if team plan */}
      {isTeamPlan && (
        <div className="flex gap-1 p-1 bg-th-surface rounded-xl">
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'projects'
                ? 'bg-th-surface-h text-th-text'
                : 'text-th-text-t hover:text-th-text'
            }`}
          >
            {t.projects?.myProjects || 'My Projects'}
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

      {/* Content - My Projects */}
      {activeTab === 'projects' && !isLoading && filteredProjects.length > 0 && (
        <div>
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} onEdit={handleEdit} onDelete={handleDeleteRequest} onArchive={handleArchive} />
          ))}
        </div>
      )}

      {/* Content - Team Projects */}
      {activeTab === 'team' && !isLoading && teamProjects.length > 0 && (
        <div>
          {teamProjects.map((project) => (
            <TeamProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Empty State - Team */}
      {activeTab === 'team' && !isLoading && teamProjects.length === 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          <PeopleTeam24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t text-lg">{t.organization?.noTeamProjects || 'No team projects yet'}</p>
          <p className="text-sm text-th-text-m mt-1">
            {t.organization?.shareProjectHint || 'Share your projects with your team from the project detail page'}
          </p>
        </div>
      )}

      {/* Empty State - My Projects (Active) */}
      {activeTab === 'projects' && !isLoading && filteredProjects.length === 0 && tab === 'active' && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          <Lightbulb24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t text-lg">{t.projects?.noProjects || 'No projects yet'}</p>
          <p className="text-sm text-th-text-m mt-1">
            {searchQuery
              ? (t.common?.tryAgain || 'Try a different search')
              : (t.projects?.createFirst || 'Create your first collaboration project')}
          </p>
          {!searchQuery && (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 mt-4 px-6 py-2 bg-emerald-400 text-[#042820] font-bold rounded-xl hover:bg-emerald-500 transition-all"
            >
              <Add24Regular className="w-5 h-5" />
              {t.projects?.createProject || 'Create Project'}
            </Link>
          )}
        </div>
      )}

      {/* Empty State - My Projects (Archived) */}
      {activeTab === 'projects' && !isLoading && filteredProjects.length === 0 && tab === 'archived' && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          <Archive24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t text-lg">{t.projects?.noArchived || 'No archived projects'}</p>
          <p className="text-sm text-th-text-m mt-1">{t.projects?.archivedHint || 'Archived projects will appear here.'}</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        title={t.projects?.deleteTitle || "Delete Project"}
        message={t.projects?.deleteMessage || "Are you sure you want to delete this project? This action cannot be undone and all associated matches will be removed."}
        confirmLabel={t.common?.delete || "Delete"}
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* FAB */}
      <Link
        href="/projects/new"
        className="fixed bottom-24 end-6 w-14 h-14 bg-emerald-400 text-[#042820] rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-500 hover:scale-110 transition-all z-40"
      >
        <Add24Regular className="w-6 h-6" />
      </Link>
    </div>
  );
}
