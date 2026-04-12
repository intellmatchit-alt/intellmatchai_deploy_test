/**
 * Discover Projects Page
 *
 * Browse public collaboration projects from other users.
 * Click on a project to see match details and add owner as contact.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Search24Regular,
  Filter24Regular,
  Rocket24Regular,
  People24Regular,
  ChevronRight24Regular,
  Globe24Regular,
  Dismiss24Regular,
  Checkmark24Regular,
  Star24Regular,
  PersonAdd24Regular,
  Chat24Regular,
  BookmarkAdd24Regular,
  Bookmark24Filled,
  Mail24Regular,
  Building24Regular,
  Briefcase24Regular,
  PeopleTeam24Regular,
} from '@fluentui/react-icons';
import { discoverProjects, Project, STAGE_OPTIONS, LOOKING_FOR_OPTIONS, ProjectStage, UserSummary } from '@/lib/api/projects';
import { getContacts } from '@/lib/api/contacts';
import { toast } from '@/components/ui/Toast';

// Helper to manage saved projects in localStorage
const SAVED_PROJECTS_KEY = 'savedDiscoverProjects';

function getSavedProjects(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_PROJECTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function toggleSavedProject(projectId: string): boolean {
  const saved = getSavedProjects();
  const index = saved.indexOf(projectId);
  if (index === -1) {
    saved.push(projectId);
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(saved));
    return true; // now saved
  } else {
    saved.splice(index, 1);
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(saved));
    return false; // now unsaved
  }
}

interface DiscoverProject extends Project {
  user: UserSummary;
  matchScore?: number;
  matchReasons?: string[];
  isSaved?: boolean;
  isFromContact?: boolean;
}

/**
 * Project Detail Modal
 */
function ProjectDetailModal({
  project,
  onClose,
  onAddToContact,
  onToggleSave,
  t,
}: {
  project: DiscoverProject;
  onClose: () => void;
  onAddToContact: (project: DiscoverProject) => void;
  onToggleSave: (project: DiscoverProject) => void;
  t: any;
}) {
  const stageLabel = STAGE_OPTIONS.find((s) => s.id === project.stage)?.label || project.stage;
  const lookingForLabels = project.lookingFor.map(
    (id) => LOOKING_FOR_OPTIONS.find((o) => o.id === id)?.label || id
  );

  // Generate match reasons based on user's profile (simplified version)
  const matchReasons = project.matchReasons || [
    `Looking for ${lookingForLabels[0] || 'collaborators'}`,
    `Project in ${project.sectors[0]?.name || 'Business'} sector`,
    `Stage: ${stageLabel}`,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-th-border">
          {/* User Avatar */}
          <Avatar
            src={project.user.avatarUrl}
            name={project.user.fullName}
            size="lg"
          />

          {/* Project Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-th-text mb-1">{project.title}</h2>
            <div className="flex items-center gap-2 text-sm text-th-text-t">
              <span className="font-medium text-th-text-s">{project.user.fullName}</span>
              {project.user.company && (
                <>
                  <span>·</span>
                  <span>{project.user.company}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {stageLabel}
              </span>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
          >
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Project Summary */}
          <div>
            <h3 className="text-sm font-medium text-th-text-t mb-2">
              {t.projects?.aboutProject || 'About This Project'}
            </h3>
            <p className="text-th-text-s">{project.summary}</p>
            {project.detailedDesc && (
              <p className="text-th-text-t text-sm mt-2">{project.detailedDesc}</p>
            )}
          </div>

          {/* Why This Match */}
          <div>
            <h3 className="text-sm font-medium text-th-text-t mb-3">
              {t.projects?.whyMatch || 'Why This Could Be a Good Match'}
            </h3>
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
              <h3 className="text-sm font-medium text-th-text-t mb-3">
                {t.projects?.lookingFor || 'Looking For'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {lookingForLabels.map((label, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full text-sm bg-green-500/10 text-green-400 border border-green-500/20"
                  >
                    <People24Regular className="w-4 h-4 inline me-1" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sectors & Skills */}
          {(project.sectors.length > 0 || project.skillsNeeded.length > 0) && (
            <div>
              <h3 className="text-sm font-medium text-th-text-t mb-3">
                {t.projects?.sectorsSkills || 'Sectors & Skills'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.sectors.map((sector) => (
                  <span
                    key={sector.id}
                    className="px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  >
                    {sector.name}
                  </span>
                ))}
                {project.skillsNeeded.map((skill) => (
                  <span
                    key={skill.id}
                    className="px-3 py-1 rounded-full text-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Owner Info */}
          <div className="bg-th-surface rounded-xl p-4 border border-th-border">
            <h3 className="text-sm font-medium text-th-text-t mb-3">
              {t.projects?.projectOwner || 'Project Owner'}
            </h3>
            <div className="flex items-center gap-4">
              <Avatar
                src={project.user.avatarUrl}
                name={project.user.fullName}
                size="lg"
              />
              <div className="flex-1">
                <p className="font-semibold text-th-text">{project.user.fullName}</p>
                {project.user.jobTitle && (
                  <p className="text-sm text-th-text-t flex items-center gap-1">
                    <Briefcase24Regular className="w-4 h-4" />
                    {project.user.jobTitle}
                  </p>
                )}
                {project.user.company && (
                  <p className="text-sm text-th-text-t flex items-center gap-1">
                    <Building24Regular className="w-4 h-4" />
                    {project.user.company}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex flex-col gap-3 p-6 border-t border-th-border bg-th-surface">
          {/* Add to Contact button */}
          <button
            onClick={() => onAddToContact(project)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            <PersonAdd24Regular className="w-5 h-5" />
            {t.projects?.addOwnerToContacts || 'Add Owner to Contacts'}
          </button>

          {/* Secondary actions */}
          <div className="flex items-center gap-3">
            <button
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
            >
              <Chat24Regular className="w-5 h-5" />
              {t.projects?.sendMessage || 'Message'}
            </button>
            <button
              onClick={() => onToggleSave(project)}
              className={`p-2.5 rounded-xl transition-colors ${
                project.isSaved
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  : 'bg-th-surface hover:bg-yellow-500/20 text-th-text-t hover:text-yellow-400'
              }`}
              title={project.isSaved ? (t.projects?.unsaveProject || 'Remove from Saved') : (t.projects?.saveProject || 'Save Project')}
            >
              {project.isSaved ? (
                <Bookmark24Filled className="w-5 h-5" />
              ) : (
                <BookmarkAdd24Regular className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Discover Project Card
 */
function DiscoverCard({
  project,
  onClick,
  onToggleSave,
  t,
}: {
  project: DiscoverProject;
  onClick: () => void;
  onToggleSave: (project: DiscoverProject) => void;
  t: any;
}) {
  const stageLabel = STAGE_OPTIONS.find((s) => s.id === project.stage)?.label || project.stage;
  const lookingForLabels = project.lookingFor
    .map((id) => LOOKING_FOR_OPTIONS.find((o) => o.id === id)?.label || id)
    .slice(0, 2);

  return (
    <div
      onClick={onClick}
      className={`bg-th-surface backdrop-blur-sm border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200 cursor-pointer ${
        project.isSaved
          ? 'border-yellow-500/30 hover:border-yellow-500/50'
          : project.isFromContact
          ? 'border-emerald-500/30 hover:border-emerald-500/50'
          : 'border-th-border hover:border-emerald-500/30'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* User Avatar */}
        <div className="relative">
          <Avatar
            src={project.user.avatarUrl}
            name={project.user.fullName}
            size="lg"
          />
          {project.isFromContact && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center" title={t.projects?.fromYourNetwork || 'From your network'}>
              <PeopleTeam24Regular className="w-3 h-3 text-th-text" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Project Title with Status */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-th-text">{project.title}</h3>
            {project.isSaved && (
              <Bookmark24Filled className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            )}
          </div>

          {/* Summary */}
          <p className="text-sm text-th-text-t line-clamp-2 mb-3">{project.summary}</p>

          {/* User Info */}
          <div className="flex items-center gap-2 text-sm text-th-text-m mb-3">
            <span className="font-medium text-th-text-s">{project.user.fullName}</span>
            {project.user.company && (
              <>
                <span>·</span>
                <span>{project.user.company}</span>
              </>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {stageLabel}
            </span>
            {project.category && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {(t.projects?.categories as Record<string, string>)?.[project.category] || project.category}
              </span>
            )}
            {lookingForLabels.map((label, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                <People24Regular className="w-3 h-3 inline me-1" />
                {label}
              </span>
            ))}
          </div>

          {/* Sectors */}
          {project.sectors.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {project.sectors.slice(0, 3).map((sector) => (
                <span key={sector.id} className="px-2 py-0.5 rounded-full text-xs bg-th-surface text-th-text-m">
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

        {/* Actions */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(project);
            }}
            className={`p-2 rounded-lg transition-colors ${
              project.isSaved
                ? 'text-yellow-400 hover:bg-yellow-500/20'
                : 'text-th-text-m hover:text-yellow-400 hover:bg-th-surface-h'
            }`}
            title={project.isSaved ? (t.projects?.unsaveProject || 'Remove from Saved') : (t.projects?.saveProject || 'Save Project')}
          >
            {project.isSaved ? (
              <Bookmark24Filled className="w-5 h-5" />
            ) : (
              <BookmarkAdd24Regular className="w-5 h-5" />
            )}
          </button>
          <ChevronRight24Regular className="w-5 h-5 text-th-text-m flex-shrink-0 rtl:rotate-180" />
        </div>
      </div>
    </div>
  );
}

type StatusFilter = 'all' | 'saved' | 'from_network';

export default function DiscoverProjectsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [projects, setProjects] = useState<DiscoverProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<ProjectStage | null>(null);
  const [selectedLookingFor, setSelectedLookingFor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedProject, setSelectedProject] = useState<DiscoverProject | null>(null);
  const [savedProjectIds, setSavedProjectIds] = useState<string[]>([]);
  const [contactUserIds, setContactUserIds] = useState<string[]>([]);

  // Load saved projects and contacts on mount
  useEffect(() => {
    setSavedProjectIds(getSavedProjects());

    // Fetch contacts to get user IDs for "from network" filter
    const loadContacts = async () => {
      try {
        const data = await getContacts({ limit: 500 });
        // Extract user IDs from contacts (if they have linked user accounts)
        const userIds = data.contacts
          .filter((c: any) => c.linkedUserId)
          .map((c: any) => c.linkedUserId);
        setContactUserIds(userIds);
      } catch (error) {
        console.error('Error loading contacts:', error);
      }
    };
    loadContacts();
  }, []);

  // Fetch projects
  useEffect(() => {
    fetchProjects();
  }, [selectedStage]);

  const fetchProjects = async (loadMore = false) => {
    if (!loadMore) setIsLoading(true);
    try {
      const currentPage = loadMore ? page + 1 : 1;
      const data = await discoverProjects({
        page: currentPage,
        limit: 20,
        stage: selectedStage || undefined,
      });

      if (loadMore) {
        setProjects((prev) => [...prev, ...data.projects]);
      } else {
        setProjects(data.projects);
      }

      setPage(currentPage);
      setHasMore(data.pagination.page < data.pagination.totalPages);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Add to contact handler
  const handleAddToContact = (project: DiscoverProject) => {
    const user = project.user;

    // Build bio from project info
    let bio = `Project: ${project.title}\n${project.summary}`;

    // Save contact data to sessionStorage
    const contactData = {
      fullName: user.fullName || '',
      email: user.email || '',
      company: user.company || '',
      jobTitle: user.jobTitle || '',
    };
    sessionStorage.setItem('scannedContact', JSON.stringify(contactData));

    // Save AI suggestions
    const aiSuggestions = {
      sectors: project.sectors.map(s => s.name),
      skills: project.skillsNeeded.map(s => s.name),
      interests: project.lookingFor.map(id => LOOKING_FOR_OPTIONS.find(o => o.id === id)?.label || id),
      bio: bio,
    };
    sessionStorage.setItem('aiSuggestions', JSON.stringify(aiSuggestions));

    // Set source
    sessionStorage.setItem('contactSource', 'PROJECT');

    // Store project info as notes
    const stageLabel = STAGE_OPTIONS.find(s => s.id === project.stage)?.label || project.stage;
    let notes = `Met through project: ${project.title}\n`;
    notes += `Stage: ${stageLabel}\n`;
    notes += `Looking for: ${project.lookingFor.map(id => LOOKING_FOR_OPTIONS.find(o => o.id === id)?.label || id).join(', ')}`;
    sessionStorage.setItem('explorerNotes', notes);

    // Close modal and navigate
    setSelectedProject(null);
    router.push('/contacts/new');
  };

  // Toggle save handler
  const handleToggleSave = (project: DiscoverProject) => {
    const nowSaved = toggleSavedProject(project.id);
    setSavedProjectIds(getSavedProjects());

    // Update selected project if modal is open
    if (selectedProject?.id === project.id) {
      setSelectedProject({ ...selectedProject, isSaved: nowSaved });
    }

    toast({
      title: nowSaved
        ? (t.projects?.projectSaved || 'Project Saved')
        : (t.projects?.projectUnsaved || 'Removed from Saved'),
      variant: 'success',
    });
  };

  // Enrich projects with saved and network status
  const enrichedProjects = projects.map((p) => ({
    ...p,
    isSaved: savedProjectIds.includes(p.id),
    isFromContact: contactUserIds.includes(p.userId),
  }));

  // Filter projects
  const filteredProjects = enrichedProjects.filter((p) => {
    // Search filter
    const matchesSearch = !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.user.fullName.toLowerCase().includes(searchQuery.toLowerCase());

    // Looking for filter
    const matchesLookingFor = !selectedLookingFor ||
      p.lookingFor.includes(selectedLookingFor);

    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'saved') {
      matchesStatus = p.isSaved;
    } else if (statusFilter === 'from_network') {
      matchesStatus = p.isFromContact;
    }

    return matchesSearch && matchesLookingFor && matchesStatus;
  });

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/projects"
          className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
        >
          <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
        </Link>
        <h1 className="text-2xl font-bold text-th-text flex items-center gap-2">
          <Globe24Regular className="w-7 h-7 text-emerald-400" />
          {t.projects?.discoverProjects || 'Discover Projects'}
        </h1>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
          <Search24Regular className="w-5 h-5 text-th-text-m" />
        </div>
        <input
          type="text"
          placeholder={t.projects?.searchDiscoverPlaceholder || 'Search projects or creators...'}
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
          {t.projects?.allStages || 'All Stages'}
        </button>
        {STAGE_OPTIONS.map((stage) => (
          <button
            key={stage.id}
            onClick={() => setSelectedStage(stage.id as ProjectStage)}
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
          {t.projects?.allTypes || 'All'}
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
          {t.projects?.allProjects || 'All Projects'}
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
          {t.projects?.savedProjects || 'Saved'}
          {savedProjectIds.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-500/30">
              {savedProjectIds.length}
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
          {t.projects?.fromNetwork || 'From My Network'}
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
      {!isLoading && filteredProjects.length > 0 && (
        <>
          <div className="space-y-3">
            {filteredProjects.map((project) => (
              <DiscoverCard
                key={project.id}
                project={project}
                onClick={() => setSelectedProject(project)}
                onToggleSave={handleToggleSave}
                t={t}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => fetchProjects(true)}
                className="px-6 py-2 bg-th-surface border border-th-border text-th-text-s font-medium rounded-xl hover:bg-th-surface-h transition-all"
              >
                {t.common?.loadMore || 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && filteredProjects.length === 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          <Globe24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t text-lg">
            {t.projects?.noProjectsFound || 'No projects found'}
          </p>
          <p className="text-sm text-th-text-m mt-1">
            {searchQuery
              ? (t.common?.tryAgain || 'Try a different search')
              : (t.projects?.noPublicProjects || 'No public projects available right now')}
          </p>
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onAddToContact={handleAddToContact}
          onToggleSave={handleToggleSave}
          t={t}
        />
      )}
    </div>
  );
}
