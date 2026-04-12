/**
 * Contacts Page
 *
 * List and manage contacts with FAB for adding new contacts.
 * Shows match details modal when clicking on match scores.
 * Features comprehensive filters for matches and sectors.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { useI18n } from '@/lib/i18n';
import { copyContactsToOrg } from '@/lib/api/organization';
import { getSectors, Sector } from '@/lib/api/profile';
import { getContacts as fetchContactsApi } from '@/lib/api/contacts';
import {
  Search24Regular,
  Add24Regular,
  Star24Filled,
  Star24Regular,
  ChevronRight24Regular,
  Sparkle24Regular,
  ArrowDownload24Regular,
  ArrowUpload24Regular,
  Filter24Regular,
  ArrowSort24Regular,
  ChevronDown24Regular,
  Lightbulb24Regular,
  Handshake24Regular,
  Rocket24Regular,
  Briefcase24Regular,
  Warning24Regular,
  ArrowUpRight24Regular,
} from '@fluentui/react-icons';
import AddContactModal from '@/components/AddContactModal';
import ExportModal from '@/components/ExportModal';
import { getMatches } from '@/lib/api/matches';
import { getProjects, getProjectMatches } from '@/lib/api/projects';
import { getDeals, getDealResults } from '@/lib/api/deals';
import { listPitches, getPitchResults } from '@/lib/api/pitch';
import { getAllMatches as getAllOpportunityMatches } from '@/lib/api/opportunities';
import { useOrganizationStore } from '@/stores/organizationStore';
import { useItemizedMatch } from '@/hooks/itemized-matching';
import { ItemizedMatchCard } from '@/components/features/itemized-matching';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { updateContact } from '@/lib/api/contacts';

interface ApiSector {
  id: string;
  name: string;
  nameAr?: string | null;
  isPrimary: boolean;
}

interface ApiSkill {
  id: string;
  name: string;
  proficiency?: string;
}

interface ApiInterest {
  id: string;
  name: string;
}

interface ApiContact {
  id: string;
  name?: string;
  fullName?: string;
  company?: string;
  jobTitle?: string;
  avatarUrl?: string;
  sectors?: ApiSector[];
  skills?: ApiSkill[];
  interests?: ApiInterest[];
  matchScore?: number;
  lastContactedAt?: string;
  isFavorite?: boolean;
  email?: string;
  phone?: string;
  location?: string;
  source?: string;
}

interface ContactSectorItem {
  name: string;
  nameAr?: string | null;
}

interface Contact {
  id: string;
  fullName: string;
  company?: string;
  jobTitle?: string;
  avatarUrl?: string;
  sectors?: ContactSectorItem[];
  skills?: string[];
  interests?: string[];
  matchScore?: number;
  lastInteraction?: string;
  isFavorite?: boolean;
  email?: string;
  phone?: string;
  location?: string;
  source?: string;
}

/** Top match info per type for a contact */
interface TopMatch {
  source: 'project' | 'deal' | 'pitch' | 'job';
  score: number;
  title: string;
}

/** Map of contactId → top matches by type */
type ContactMatchMap = Map<string, { project?: TopMatch; deal?: TopMatch; pitch?: TopMatch; job?: TopMatch }>;

// Match filter options
type MatchFilter = 'all' | 'high' | 'medium' | 'low' | 'none';

// Sort options
type SortOption = 'name' | 'matchScore' | 'recent' | 'company';

const MATCH_TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: any; label: string }> = {
  project: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25', icon: Lightbulb24Regular, label: 'Project' },
  deal: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/25', icon: Handshake24Regular, label: 'Deal' },
  pitch: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25', icon: Rocket24Regular, label: 'Pitch' },
  job: { bg: 'bg-teal-500/15', text: 'text-teal-300', border: 'border-teal-500/25', icon: Briefcase24Regular, label: 'Job' },
};

/**
 * Contact card component with useful data display
 */
function ContactCard({
  contact,
  topMatches,
  onToggleFavorite,
}: {
  contact: Contact;
  topMatches?: { project?: TopMatch; deal?: TopMatch; pitch?: TopMatch; job?: TopMatch };
  onToggleFavorite: (id: string, current: boolean) => void;
}) {
  if (!contact || !contact.id) {
    console.error('[ContactCard] Invalid contact:', contact);
    return null;
  }

  const displayName = contact.fullName || 'Unknown Contact';

  const matchEntries = topMatches
    ? (['project', 'deal', 'pitch', 'job'] as const).filter(k => topMatches[k])
    : [];

  return (
    <Link href={`/contacts/${contact.id}`}>
      <div className="group bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200">
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <Avatar src={contact.avatarUrl} name={displayName} size="lg" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-th-text truncate">{displayName}</h3>
            {contact.jobTitle && (
              <p className="text-sm text-th-text-s truncate">{contact.jobTitle}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-th-text-m">
              {contact.company && <span className="truncate">{contact.company}</span>}
              {contact.company && contact.location && <span>·</span>}
              {contact.location && <span className="truncate">{contact.location}</span>}
            </div>

            {/* Top Matches by Type */}
            {matchEntries.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {matchEntries.map(key => {
                  const m = topMatches![key]!;
                  const style = MATCH_TYPE_STYLES[key];
                  const Icon = style.icon;
                  return (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${style.bg} ${style.text} ${style.border}`}
                      title={`${style.label}: ${m.title}`}
                    >
                      <Icon className="w-3 h-3" />
                      {m.title}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(contact.id, !!contact.isFavorite);
            }}
            className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
              contact.isFavorite
                ? 'text-yellow-400 hover:text-yellow-300'
                : 'text-th-text-m/40 hover:text-yellow-400'
            }`}
            title={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {contact.isFavorite ? (
              <Star24Filled className="w-5 h-5" />
            ) : (
              <Star24Regular className="w-5 h-5" />
            )}
          </button>
          <ChevronRight24Regular className="w-5 h-5 text-th-text-m group-hover:text-th-text transition-colors rtl:rotate-180 flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}

export default function ContactsPage() {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectorParam = searchParams.get('sector');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string | null>(sectorParam && sectorParam !== 'all' ? sectorParam : null);
  const [activeTab, setActiveTab] = useState('all');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const organization = useOrganizationStore((s) => s.organization);
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId);
  const isTeamPlan = organization !== null;
  const isOrgMode = !!activeOrgId;
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [contactMatchMap, setContactMatchMap] = useState<ContactMatchMap>(new Map());

  // Copy to org state
  const [selectedForCopy, setSelectedForCopy] = useState<Set<string>>(new Set());
  const [isCopying, setIsCopying] = useState(false);

  const handleToggleFavorite = async (contactId: string, currentFavorite: boolean) => {
    const newVal = !currentFavorite;
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isFavorite: newVal } : c));
    try {
      await updateContact(contactId, { isFavorite: newVal });
    } catch {
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isFavorite: currentFavorite } : c));
    }
  };

  // Sync sector filter from URL params
  useEffect(() => {
    if (sectorParam && sectorParam !== 'all') {
      setSelectedSector(sectorParam);
    }
  }, [sectorParam]);

  // New filter states
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('matchScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [availableSectors, setAvailableSectors] = useState<Sector[]>([]);
  const [showFilters, setShowFilters] = useState(!!sectorParam);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedMatchType, setSelectedMatchType] = useState<'project' | 'deal' | 'pitch' | 'job' | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  // Plan limit state
  const [planLimit, setPlanLimit] = useState<{ limit: number; current: number; remaining: number } | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);

  // Itemized matching hook
  const { match: itemizedMatch, isLoading: isLoadingMatch, fetchMatch: fetchItemizedMatch, clearMatch } = useItemizedMatch();

  // Fetch contacts and sectors - refetch when org context changes
  useEffect(() => {
    fetchContacts();
    fetchSectors();
    fetchContactMatches();
    setSelectedForCopy(new Set());
  }, [activeOrgId]);

  const fetchSectors = async () => {
    try {
      const sectors = await getSectors();
      setAvailableSectors(sectors);
    } catch (error) {
      console.error('[Contacts] Failed to fetch sectors:', error);
    }
  };

  const fetchContacts = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      console.log('[Contacts] Fetching contacts...');

      // Fetch all contacts by paginating through batches of 100
      // Uses api client which handles 401 → token refresh → retry automatically
      const allApiContacts: ApiContact[] = [];

      // First page + matches in parallel
      const [firstData, matchesData] = await Promise.all([
        fetchContactsApi({ limit: 100, page: 1 }),
        getMatches({ limit: 100, minScore: 0 }).catch(() => ({ matches: [] })),
      ]);

      console.log('[Contacts] First page loaded');

      if (firstData?.contacts) {
        // Extract plan limit info
        const planLimitData = (firstData as any)?.planLimit || null;
        if (planLimitData) {
          setPlanLimit(planLimitData);
        }

        allApiContacts.push(...firstData.contacts);
        const total = firstData.total || firstData.contacts.length;
        const totalPages = Math.ceil(total / 100);
        console.log('[Contacts] Total:', total, 'Pages:', totalPages);

        // Fetch remaining pages in parallel (pages 2, 3, 4, ...)
        if (totalPages > 1) {
          const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
          const remainingResults = await Promise.all(
            remainingPages.map(p =>
              fetchContactsApi({ limit: 100, page: p }).catch((err) => {
                console.error(`[Contacts] Failed to fetch page ${p}:`, err);
                return null;
              })
            )
          );
          for (const result of remainingResults) {
            if (result?.contacts) {
              allApiContacts.push(...result.contacts);
            }
          }
        }

        console.log('[Contacts] Total contacts loaded:', allApiContacts.length);
        console.log('[Contacts] Fresh matches count:', matchesData.matches?.length || 0);

        // Create a map of fresh match scores by contact ID
        const freshScoresMap = new Map<string, number>();
        matchesData.matches?.forEach((match: any) => {
          freshScoresMap.set(match.contactId, match.score);
        });

        // Transform API contacts to frontend format with fresh match scores
        const transformedContacts: Contact[] = allApiContacts.map((c: ApiContact) => {
          const freshScore = freshScoresMap.get(c.id);
          const matchScore = freshScore !== undefined ? freshScore : c.matchScore;

          return {
            id: c.id,
            fullName: c.fullName || c.name || 'Unknown',
            company: c.company,
            jobTitle: c.jobTitle,
            avatarUrl: c.avatarUrl,
            sectors: c.sectors?.map((s: ApiSector) => ({ name: s.name, nameAr: s.nameAr })).filter(s => s.name) || [],
            skills: c.skills?.map((s: ApiSkill) => s.name).filter(Boolean) || [],
            interests: c.interests?.map((i: ApiInterest) => i.name).filter(Boolean) || [],
            matchScore: matchScore,
            lastInteraction: c.lastContactedAt,
            isFavorite: c.isFavorite,
            email: c.email,
            phone: c.phone,
            location: c.location,
            source: c.source,
          };
        });
        console.log('[Contacts] Transformed contacts:', transformedContacts.length);
        setContacts(transformedContacts);
      } else {
        setFetchError('Failed to fetch contacts from API');
      }
    } catch (error: any) {
      console.error('[Contacts] Failed to fetch contacts:', error);
      if (error?.code === 'SESSION_EXPIRED' || error?.status === 401) {
        setFetchError('Session expired. Please log in again.');
      } else {
        setFetchError(error?.message || 'Network error while fetching contacts');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch top matches per contact (project, deal, pitch, job)
  const fetchContactMatches = async () => {
    try {
      const map: ContactMatchMap = new Map();

      const helper = (contactId: string, source: 'project' | 'deal' | 'pitch' | 'job', score: number, title: string) => {
        if (!map.has(contactId)) map.set(contactId, {});
        const entry = map.get(contactId)!;
        if (!entry[source] || entry[source]!.score < score) {
          entry[source] = { source, score, title };
        }
      };

      const [projectsRes, dealsRes, pitchesRes, oppsRes] = await Promise.all([
        getProjects({ limit: 50 }).catch(() => null),
        getDeals({ limit: 20 }).catch(() => null),
        listPitches({ limit: 20 }).catch(() => null),
        getAllOpportunityMatches({ limit: 200 }).catch(() => null),
      ]);

      // Project matches
      if (projectsRes?.projects) {
        for (const project of projectsRes.projects) {
          try {
            const res = await getProjectMatches(project.id, { minScore: 20 });
            res?.matches?.forEach((m: any) => {
              if (m.matchType === 'contact' && m.matchedContact?.id) {
                helper(m.matchedContact.id, 'project', m.matchScore, project.title);
              }
            });
          } catch {}
        }
      }

      // Deal matches
      if (dealsRes?.deals) {
        for (const deal of dealsRes.deals.filter((d: any) => d.matchCount > 0)) {
          try {
            const res = await getDealResults(deal.id);
            res?.results?.forEach((m: any) => {
              if (m.contact?.id) {
                helper(m.contact.id, 'deal', m.score, deal.productName || deal.targetDescription || 'Deal');
              }
            });
          } catch {}
        }
      }

      // Pitch matches
      if (pitchesRes?.pitches) {
        for (const pitch of pitchesRes.pitches.filter((p: any) => p.status === 'COMPLETED')) {
          try {
            const res = await getPitchResults(pitch.id);
            res?.sections?.forEach((section: any) => {
              section.matches?.forEach((m: any) => {
                if (m.contact?.id) {
                  helper(m.contact.id, 'pitch', m.score, pitch.title || pitch.fileName || 'Pitch');
                }
              });
            });
          } catch {}
        }
      }

      // Opportunity/Job matches
      if (oppsRes?.matches) {
        oppsRes.matches.forEach((m: any) => {
          if (m.matchType === 'contact' && m.candidate?.id) {
            helper(m.candidate.id, 'job', m.matchScore, m.opportunityTitle || 'Job');
          }
        });
      }

      setContactMatchMap(map);
    } catch (error) {
      console.error('[Contacts] Failed to fetch match data:', error);
    }
  };

  // Fetch match details for a contact
  const fetchMatchDetails = async (contact: Contact) => {
    try {
      setSelectedContact(contact);
      setIsMatchModalOpen(true);
      // Fetch itemized match data
      await fetchItemizedMatch(contact.id);
    } catch (error) {
      console.error('Failed to fetch match details:', error);
    }
  };

  // Toggle contact selection for copy
  const toggleCopySelection = (contactId: string) => {
    setSelectedForCopy((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  // Copy selected contacts to org
  const handleCopyToOrg = async () => {
    if (!organization || selectedForCopy.size === 0) return;
    setIsCopying(true);
    try {
      const result = await copyContactsToOrg(organization.id, Array.from(selectedForCopy));
      alert(`${result.copied} ${t.orgContacts.copySuccess}`);
      setSelectedForCopy(new Set());
    } catch (error: any) {
      console.error('Copy to org failed:', error);
      alert(error.message || 'Failed to copy contacts');
    } finally {
      setIsCopying(false);
    }
  };

  // Handle contact added
  const handleContactAdded = (contact: any, match: any) => {
    // Add to contacts list
    setContacts((prev) => [contact, ...prev]);

    // Show match modal if match data available
    if (match) {
      setSelectedContact(contact);
      setIsMatchModalOpen(true);
    }
  };

  // Get unique sectors from contacts for the filter dropdown
  // Build a map of English name -> Arabic name for display
  const { contactSectors, sectorArMap } = useMemo(() => {
    const sectorSet = new Set<string>();
    const arMap: Record<string, string | null> = {};
    contacts.forEach((contact) => {
      contact.sectors?.forEach((sector) => {
        sectorSet.add(sector.name);
        if (sector.nameAr && !arMap[sector.name]) {
          arMap[sector.name] = sector.nameAr;
        }
      });
    });
    return { contactSectors: Array.from(sectorSet).sort(), sectorArMap: arMap };
  }, [contacts]);

  // Get unique skills from contacts for the filter dropdown
  const contactSkills = useMemo(() => {
    const skillSet = new Set<string>();
    contacts.forEach((contact) => {
      contact.skills?.forEach((skill) => skillSet.add(skill));
    });
    return Array.from(skillSet).sort();
  }, [contacts]);

  // Get unique locations from contacts for the filter dropdown
  const contactLocations = useMemo(() => {
    const locationSet = new Set<string>();
    contacts.forEach((contact) => {
      if (contact.location) locationSet.add(contact.location);
    });
    return Array.from(locationSet).sort();
  }, [contacts]);

  // Get unique sources from contacts
  const contactSources = useMemo(() => {
    const sourceSet = new Set<string>();
    contacts.forEach((contact) => {
      if (contact.source) sourceSet.add(contact.source);
    });
    return Array.from(sourceSet).sort();
  }, [contacts]);

  // Match filter configurations
  const matchFilters: { id: MatchFilter; label: string; range: string }[] = [
    { id: 'all', label: 'All Matches', range: '' },
    { id: 'high', label: 'High', range: '80-100%' },
    { id: 'medium', label: 'Medium', range: '50-79%' },
    { id: 'low', label: 'Low', range: '20-49%' },
    { id: 'none', label: 'Very Low', range: '0-19%' },
  ];

  // Sort options
  const sortOptions: { id: SortOption; label: string }[] = [
    { id: 'matchScore', label: 'Match Score' },
    { id: 'name', label: 'Name' },
    { id: 'company', label: 'Company' },
    { id: 'recent', label: 'Recent' },
  ];

  // Apply filters and sorting
  const filteredContacts = useMemo(() => {
    let result = contacts.filter((contact) => {
      try {
        // Search filter
        const matchesSearch =
          !searchQuery ||
          (contact.fullName && contact.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (contact.company && contact.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (contact.jobTitle && contact.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()));

        // Sector filter
        const matchesSector =
          !selectedSector ||
          (contact.sectors && contact.sectors.some(s => s.name === selectedSector));

        // Skill filter
        const matchesSkill =
          !selectedSkill ||
          (contact.skills && contact.skills.includes(selectedSkill));

        // Location filter
        const matchesLocation =
          !selectedLocation ||
          contact.location === selectedLocation;

        // Source filter
        const matchesSource =
          !selectedSource ||
          contact.source === selectedSource;

        // Match type filter (project/deal/pitch/job)
        const matchesMatchType =
          !selectedMatchType ||
          (contactMatchMap.has(contact.id) && !!contactMatchMap.get(contact.id)![selectedMatchType]);

        // Match score filter
        let matchesMatchFilter = true;
        const score = contact.matchScore ?? -1;
        switch (matchFilter) {
          case 'high':
            matchesMatchFilter = score >= 80;
            break;
          case 'medium':
            matchesMatchFilter = score >= 50 && score < 80;
            break;
          case 'low':
            matchesMatchFilter = score >= 20 && score < 50;
            break;
          case 'none':
            matchesMatchFilter = score >= 0 && score < 20;
            break;
          default:
            matchesMatchFilter = true;
        }

        return matchesSearch && matchesSector && matchesSkill && matchesLocation && matchesSource && matchesMatchFilter && matchesMatchType;
      } catch (err) {
        console.error('[Contacts] Filter error for contact:', contact, err);
        return false;
      }
    });

    // Sort the results
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortOption) {
        case 'matchScore':
          comparison = (b.matchScore ?? -1) - (a.matchScore ?? -1);
          break;
        case 'name':
          comparison = (a.fullName || '').localeCompare(b.fullName || '');
          break;
        case 'company':
          comparison = (a.company || '').localeCompare(b.company || '');
          break;
        case 'recent':
          comparison = new Date(b.lastInteraction || 0).getTime() - new Date(a.lastInteraction || 0).getTime();
          break;
      }
      return sortOrder === 'desc' ? comparison : -comparison;
    });

    return result;
  }, [contacts, searchQuery, selectedSector, selectedSkill, selectedLocation, selectedSource, selectedMatchType, contactMatchMap, matchFilter, sortOption, sortOrder]);

  // Get counts for each match filter
  const matchCounts = useMemo(() => {
    return {
      all: contacts.length,
      high: contacts.filter((c) => (c.matchScore ?? -1) >= 80).length,
      medium: contacts.filter((c) => (c.matchScore ?? -1) >= 50 && (c.matchScore ?? -1) < 80).length,
      low: contacts.filter((c) => (c.matchScore ?? -1) >= 20 && (c.matchScore ?? -1) < 50).length,
      none: contacts.filter((c) => (c.matchScore ?? -1) >= 0 && (c.matchScore ?? -1) < 20).length,
    };
  }, [contacts]);

  const tabs = [
    { id: 'all', label: t.contacts?.all || 'All', count: filteredContacts.length },
    { id: 'favorites', label: t.contacts?.favorites || 'Favorites', count: filteredContacts.filter(c => c.isFavorite).length },
    ...(isTeamPlan ? [{ id: 'team', label: t.contacts?.team || 'Team', count: 0 }] : []),
  ];

  // Check if any filters are active
  const hasActiveFilters = selectedSector !== null || selectedSkill !== null || selectedLocation !== null || selectedSource !== null || selectedMatchType !== null;

  // Plan limit helpers
  const isAtLimit = planLimit !== null && planLimit.remaining === 0;
  const isNearLimit = planLimit !== null && !isAtLimit && planLimit.limit > 0 && (planLimit.current / planLimit.limit) > 0.9;
  const usagePercent = planLimit && planLimit.limit > 0 ? Math.min((planLimit.current / planLimit.limit) * 100, 100) : 0;
  const usageColor = usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const usageTextColor = usagePercent >= 90 ? 'text-red-400' : usagePercent >= 70 ? 'text-emerald-400' : 'text-emerald-400';

  // Handler to check limit before add/import actions
  const handleAddClick = (e: React.MouseEvent) => {
    if (isAtLimit) {
      e.preventDefault();
      setShowLimitModal(true);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-th-text">{t.contacts?.title || 'Contacts'}</h1>
        <div className="flex items-center gap-2">
          {/* Export Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-th-surface border border-th-border text-th-text-s font-medium rounded-xl hover:bg-th-surface-h hover:text-th-text transition-all"
            title={t.export?.title || 'Export Contacts'}
          >
            <ArrowDownload24Regular className="w-5 h-5" />
            <span className="hidden sm:inline">{t.export?.export || 'Export'}</span>
          </button>
          {/* Import Button */}
          {isAtLimit ? (
            <button
              onClick={() => setShowLimitModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-th-surface border border-th-border text-th-text-m font-medium rounded-xl cursor-not-allowed opacity-60"
              title="Contact limit reached"
            >
              <ArrowUpload24Regular className="w-5 h-5" />
              <span className="hidden sm:inline">{t.import?.title || 'Import'}</span>
            </button>
          ) : (
            <Link
              href="/contacts/import"
              className="flex items-center gap-2 px-3 py-2 bg-th-surface border border-th-border text-th-text-s font-medium rounded-xl hover:bg-th-surface-h hover:text-th-text transition-all"
              title={t.import?.title || 'Import Contacts'}
            >
              <ArrowUpload24Regular className="w-5 h-5" />
              <span className="hidden sm:inline">{t.import?.title || 'Import'}</span>
            </Link>
          )}
          {/* Add Button */}
          {isAtLimit ? (
            <button
              onClick={() => setShowLimitModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/40 to-teal-500/40 text-white/60 font-medium rounded-xl cursor-not-allowed"
              title="Contact limit reached"
            >
              <Add24Regular className="w-5 h-5" />
              {t.common?.add || 'Add'}
            </button>
          ) : (
            <Link
              href="/contacts/add"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
            >
              <Add24Regular className="w-5 h-5" />
              {t.common?.add || 'Add'}
            </Link>
          )}
        </div>
      </div>

      {/* Search and Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
            <Search24Regular className="w-5 h-5 text-th-text-m" />
          </div>
          <input
            type="text"
            placeholder={t.contacts?.searchPlaceholder || 'Search contacts...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
          />
        </div>
        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
            hasActiveFilters
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
              : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
          }`}
        >
          <Filter24Regular className="w-5 h-5" />
          <span className="hidden sm:inline">Filters</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>
      </div>

      {/* Expandable Filters Panel */}
      {showFilters && (
        <div className="bg-th-surface border border-th-border rounded-xl p-4 space-y-4 animate-fade-in">
          {/* Search to filter the filter options */}
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                <Search24Regular className="w-4 h-4 text-th-text-m" />
              </div>
              <input
                type="text"
                placeholder="Search filters..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full ps-10 pe-4 py-2.5 bg-th-bg border border-th-border rounded-lg text-th-text text-sm placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Sort By */}
          {(!filterSearch || 'sort'.includes(filterSearch.toLowerCase())) && (
            <div>
              <label className="text-sm font-medium text-th-text-t mb-2 block flex items-center gap-2">
                <ArrowSort24Regular className="w-4 h-4" />
                Sort By
              </label>
              <div className="flex flex-wrap gap-2">
                {sortOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      if (sortOption === option.id) {
                        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortOption(option.id);
                        setSortOrder('desc');
                      }
                      setShowFilters(false);
                      setFilterSearch('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-1 ${
                      sortOption === option.id
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                    }`}
                  >
                    {option.label}
                    {sortOption === option.id && (
                      <span className="text-xs">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sector Filter */}
          {(() => {
            const q = filterSearch.toLowerCase();
            const filteredSectors = q ? contactSectors.filter(s => {
              const displayName = isRTL ? (sectorArMap[s] || s) : s;
              return s.toLowerCase().includes(q) || displayName.toLowerCase().includes(q);
            }) : contactSectors;
            const showSection = !q || (t.contacts?.sector || 'sector').toLowerCase().includes(q) || filteredSectors.length > 0;
            const sectorsToShow = q && !(t.contacts?.sector || 'sector').toLowerCase().includes(q) ? filteredSectors : contactSectors;
            if (!showSection) return null;
            return (
              <div>
                <label className="text-sm font-medium text-th-text-t mb-2 block">{t.contacts?.sector || 'Sector'}</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedSector(null); setShowFilters(false); setFilterSearch(''); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      !selectedSector
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                    }`}
                  >
                    {t.contacts?.allSectors || 'All Sectors'}
                  </button>
                  {sectorsToShow.map((sector) => {
                    const count = contacts.filter(c => c.sectors?.some(s => s.name === sector)).length;
                    const displayName = isRTL ? (sectorArMap[sector] || sector) : sector;
                    return (
                      <button
                        key={sector}
                        onClick={() => { setSelectedSector(sector); setShowFilters(false); setFilterSearch(''); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          selectedSector === sector
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                            : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                        }`}
                      >
                        {displayName}
                        <span className="ms-1.5 text-xs opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Skill Filter */}
          {(() => {
            const q = filterSearch.toLowerCase();
            const filteredSkills = q ? contactSkills.filter(s => s.toLowerCase().includes(q)) : contactSkills;
            const showSection = contactSkills.length > 0 && (!q || 'skills'.includes(q) || filteredSkills.length > 0);
            const skillsToShow = q && !'skills'.includes(q) ? filteredSkills : contactSkills;
            if (!showSection) return null;
            return (
              <div>
                <label className="text-sm font-medium text-th-text-t mb-2 block">Skills</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedSkill(null); setShowFilters(false); setFilterSearch(''); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      !selectedSkill
                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                        : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                    }`}
                  >
                    All Skills
                  </button>
                  {skillsToShow.map((skill) => {
                    const count = contacts.filter(c => c.skills?.includes(skill)).length;
                    return (
                      <button
                        key={skill}
                        onClick={() => { setSelectedSkill(skill); setShowFilters(false); setFilterSearch(''); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          selectedSkill === skill
                            ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                            : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                        }`}
                      >
                        {skill}
                        <span className="ml-1.5 text-xs opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Location Filter */}
          {(() => {
            const q = filterSearch.toLowerCase();
            const filteredLocs = q ? contactLocations.filter(l => l.toLowerCase().includes(q)) : contactLocations;
            const showSection = contactLocations.length > 0 && (!q || 'location'.includes(q) || filteredLocs.length > 0);
            const locsToShow = q && !'location'.includes(q) ? filteredLocs : contactLocations;
            if (!showSection) return null;
            return (
              <div>
                <label className="text-sm font-medium text-th-text-t mb-2 block">Location</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedLocation(null); setShowFilters(false); setFilterSearch(''); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      !selectedLocation
                        ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                        : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                    }`}
                  >
                    All Locations
                  </button>
                  {locsToShow.map((location) => {
                    const count = contacts.filter(c => c.location === location).length;
                    return (
                      <button
                        key={location}
                        onClick={() => { setSelectedLocation(location); setShowFilters(false); setFilterSearch(''); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          selectedLocation === location
                            ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                            : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                        }`}
                      >
                        {location}
                        <span className="ml-1.5 text-xs opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Matched In Filter (Project/Deal/Pitch/Job) */}
          {(() => {
            const q = filterSearch.toLowerCase();
            const showSection = !q || 'matched project deal pitch job opportunity'.includes(q);
            if (!showSection) return null;
            const matchTypes = [
              { id: 'project' as const, label: 'Project', style: MATCH_TYPE_STYLES.project },
              { id: 'deal' as const, label: 'Deal', style: MATCH_TYPE_STYLES.deal },
              { id: 'pitch' as const, label: 'Pitch', style: MATCH_TYPE_STYLES.pitch },
              { id: 'job' as const, label: 'Opportunity', style: MATCH_TYPE_STYLES.job },
            ];
            return (
              <div>
                <label className="text-sm font-medium text-th-text-t mb-2 block">Matched In</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedMatchType(null); setShowFilters(false); setFilterSearch(''); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      !selectedMatchType
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                    }`}
                  >
                    All
                  </button>
                  {matchTypes.map(({ id, label, style }) => {
                    const count = contacts.filter(c => contactMatchMap.has(c.id) && !!contactMatchMap.get(c.id)![id]).length;
                    if (count === 0) return null;
                    const Icon = style.icon;
                    return (
                      <button
                        key={id}
                        onClick={() => { setSelectedMatchType(id); setShowFilters(false); setFilterSearch(''); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5 ${
                          selectedMatchType === id
                            ? `${style.bg} ${style.border} ${style.text}`
                            : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                        <span className="text-xs opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Source Filter */}
          {(() => {
            const q = filterSearch.toLowerCase();
            const sourceLabels: Record<string, string> = { CARD_SCAN: 'Card Scan', LINKEDIN: 'LinkedIn', IMPORT: 'Import', MANUAL: 'Manual' };
            const filteredSources = q ? contactSources.filter(s => (sourceLabels[s] || s).toLowerCase().includes(q)) : contactSources;
            const showSection = contactSources.length > 0 && (!q || 'source'.includes(q) || filteredSources.length > 0);
            const sourcesToShow = q && !'source'.includes(q) ? filteredSources : contactSources;
            if (!showSection) return null;
            return (
              <div>
                <label className="text-sm font-medium text-th-text-t mb-2 block">Source</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedSource(null); setShowFilters(false); setFilterSearch(''); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      !selectedSource
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                    }`}
                  >
                    All Sources
                  </button>
                  {sourcesToShow.map((source) => {
                    const count = contacts.filter(c => c.source === source).length;
                    return (
                      <button
                        key={source}
                        onClick={() => { setSelectedSource(source); setShowFilters(false); setFilterSearch(''); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          selectedSource === source
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                            : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
                        }`}
                      >
                        {sourceLabels[source] || source}
                        <span className="ml-1.5 text-xs opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setMatchFilter('all');
                setSelectedSector(null);
                setSelectedSkill(null);
                setSelectedLocation(null);
                setSelectedSource(null);
                setSelectedMatchType(null);
                setShowFilters(false);
              }}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Active Filter Tags */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {selectedSector && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
              {selectedSector}
              <button onClick={() => setSelectedSector(null)} className="ml-1 hover:text-white"><Dismiss24Regular className="w-3 h-3" /></button>
            </span>
          )}
          {selectedSkill && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/20 border border-blue-500/30 text-blue-300">
              {selectedSkill}
              <button onClick={() => setSelectedSkill(null)} className="ml-1 hover:text-white"><Dismiss24Regular className="w-3 h-3" /></button>
            </span>
          )}
          {selectedLocation && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
              {selectedLocation}
              <button onClick={() => setSelectedLocation(null)} className="ml-1 hover:text-white"><Dismiss24Regular className="w-3 h-3" /></button>
            </span>
          )}
          {selectedSource && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
              {selectedSource === 'CARD_SCAN' ? 'Card Scan' : selectedSource === 'LINKEDIN' ? 'LinkedIn' : selectedSource === 'IMPORT' ? 'Import' : selectedSource === 'MANUAL' ? 'Manual' : selectedSource}
              <button onClick={() => setSelectedSource(null)} className="ml-1 hover:text-white"><Dismiss24Regular className="w-3 h-3" /></button>
            </span>
          )}
          {selectedMatchType && (() => {
            const style = MATCH_TYPE_STYLES[selectedMatchType];
            const Icon = style.icon;
            return (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${style.bg} border ${style.border} ${style.text}`}>
                <Icon className="w-3 h-3" />
                {style.label}
                <button onClick={() => setSelectedMatchType(null)} className="ml-1 hover:text-white"><Dismiss24Regular className="w-3 h-3" /></button>
              </span>
            );
          })()}
          <button
            onClick={() => { setSelectedSector(null); setSelectedSkill(null); setSelectedLocation(null); setSelectedSource(null); setSelectedMatchType(null); }}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Contact Usage Bar */}
      {planLimit && planLimit.limit > 0 && (
        <div className="bg-th-surface border border-th-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-th-text-s">Contact usage</span>
            <span className={`font-medium ${usageTextColor}`}>
              {planLimit.current.toLocaleString()} / {planLimit.limit.toLocaleString()} contacts
            </span>
          </div>
          <div className="w-full h-2 bg-th-bg rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${usageColor}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          {planLimit.remaining > 0 && (
            <p className="text-xs text-th-text-m">
              {planLimit.remaining.toLocaleString()} contacts remaining
            </p>
          )}
        </div>
      )}

      {/* Limit Reached Warning */}
      {isAtLimit && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <Warning24Regular className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-red-400 font-medium text-sm">Contact limit reached</p>
            <p className="text-red-400/70 text-xs mt-0.5">Upgrade your plan to add more contacts.</p>
          </div>
          <Link
            href="/checkout"
            className="flex-shrink-0 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            Upgrade Plan
            <ArrowUpRight24Regular className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Near Limit Warning */}
      {isNearLimit && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <Warning24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-400 text-sm font-medium flex-1">
            Running low on contacts — {planLimit!.remaining.toLocaleString()} remaining
          </p>
          <Link
            href="/checkout"
            className="flex-shrink-0 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-th-surface rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'team') { router.push('/contacts/team'); return; }
              setActiveTab(tab.id);
            }}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-th-surface-h text-th-text'
                : 'text-th-text-t hover:text-th-text'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Results Summary */}
      {!isLoading && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-th-text-t">
            Showing <span className="text-th-text font-medium">{filteredContacts.length}</span> of{' '}
            <span className="text-th-text font-medium">{contacts.length}</span> contacts
            {selectedSector && (
              <span className="ml-2">
                in <span className="text-emerald-300">{selectedSector}</span>
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setMatchFilter('all');
                setSelectedSector(null);
                setSelectedSkill(null);
                setSelectedLocation(null);
                setSelectedSource(null);
              }}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-th-surface border border-th-border rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-th-surface-h" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-th-surface-h rounded w-1/3" />
                  <div className="h-3 bg-th-surface-h rounded w-1/2" />
                  <div className="h-3 bg-th-surface-h rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Banner */}
      {fetchError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
          <p className="text-red-400 font-medium">Error loading contacts</p>
          <p className="text-red-400/70 text-sm mt-1">{fetchError}</p>
          <button
            onClick={() => fetchContacts()}
            className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Copy to Org floating bar (personal mode only, with org) */}
      {!isOrgMode && organization && selectedForCopy.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-50 bg-blue-600 rounded-xl shadow-xl shadow-blue-600/30 p-3 flex items-center justify-between max-w-lg mx-auto">
          <span className="text-th-text text-sm font-medium">
            {selectedForCopy.size} {t.orgContacts.selected}
          </span>
          <button
            onClick={handleCopyToOrg}
            disabled={isCopying}
            className="px-4 py-2 bg-[#00d084] text-[#060b18] rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {isCopying ? t.orgContacts.copying : `${t.orgContacts.copyToOrg}`}
          </button>
        </div>
      )}

      {/* Content */}
      {!isLoading && activeTab === 'all' && (
        filteredContacts.length > 0 ? (
          <div className="space-y-3">
            {filteredContacts.map((contact) => (
              <div key={contact.id} className="flex items-center gap-2">
                {/* Checkbox for copy-to-org in personal mode */}
                {!isOrgMode && organization && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); toggleCopySelection(contact.id); }}
                    className={`flex-shrink-0 w-5 h-5 rounded border transition-colors ${
                      selectedForCopy.has(contact.id)
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {selectedForCopy.has(contact.id) && (
                      <svg className="w-5 h-5 text-th-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <ContactCard
                    contact={contact}
                    topMatches={contactMatchMap.get(contact.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
            <Filter24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
            <p className="text-th-text-t text-lg">
              {hasActiveFilters || searchQuery ? 'No contacts match your filters' : (t.contacts?.noContacts || 'No contacts yet')}
            </p>
            <p className="text-sm text-th-text-m mt-1">
              {hasActiveFilters || searchQuery
                ? 'Try adjusting your search or filters'
                : (t.contacts?.startAdding || 'Start adding contacts')}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setMatchFilter('all');
                  setSelectedSector(null);
                  setSelectedSkill(null);
                  setSelectedLocation(null);
                  setSelectedSource(null);
                  setSearchQuery('');
                }}
                className="inline-block mt-4 px-6 py-2 bg-th-surface-h text-th-text font-medium rounded-xl hover:bg-th-surface-h transition-all"
              >
                Clear all filters
              </button>
            )}
            {!searchQuery && !hasActiveFilters && (
              <Link
                href="/contacts/add"
                className="inline-block mt-4 px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
              >
                {t.contacts?.addContact || 'Add Contact'}
              </Link>
            )}
          </div>
        )
      )}

      {!isLoading && activeTab === 'favorites' && (
        filteredContacts.filter(c => c.isFavorite).length > 0 ? (
          <div className="space-y-3">
            {filteredContacts
              .filter((c) => c.isFavorite)
              .map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  topMatches={contactMatchMap.get(contact.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
          </div>
        ) : (
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
            <Star24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
            <p className="text-th-text-t text-lg">{t.contacts?.noFavorites || 'No favorites yet'}</p>
            <p className="text-sm text-th-text-m mt-1">{t.contacts?.starToAdd || 'Star contacts to add them here'}</p>
          </div>
        )
      )}

      {/* Floating Action Button */}
      {isAtLimit ? (
        <button
          onClick={() => setShowLimitModal(true)}
          className="fixed bottom-24 end-6 w-14 h-14 bg-gradient-to-r from-emerald-500/40 to-teal-500/40 text-white/60 rounded-full shadow-lg flex items-center justify-center cursor-not-allowed z-40"
          title="Contact limit reached"
        >
          <Add24Regular className="w-6 h-6" />
        </button>
      ) : (
        <Link
          href="/contacts/add"
          className="fixed bottom-24 end-6 w-14 h-14 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-110 transition-all z-40"
        >
          <Add24Regular className="w-6 h-6" />
        </Link>
      )}

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onContactAdded={handleContactAdded}
      />

      {/* Match Detail Modal */}
      {isMatchModalOpen && selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsMatchModalOpen(false);
              setSelectedContact(null);
              clearMatch();
            }}
          />
          {/* Modal */}
          <div className="relative w-full max-w-lg bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => {
                setIsMatchModalOpen(false);
                setSelectedContact(null);
                clearMatch();
              }}
              className="absolute top-4 end-4 p-2 text-th-text-t hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors z-10"
            >
              <Dismiss24Regular className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="p-6 pb-4 border-b border-th-border">
              <div className="flex items-center gap-4">
                <Avatar src={selectedContact.avatarUrl} name={selectedContact.fullName} size="xl" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-th-text truncate">{selectedContact.fullName}</h2>
                  {selectedContact.jobTitle && (
                    <p className="text-sm text-th-text-t truncate">{selectedContact.jobTitle}</p>
                  )}
                  {selectedContact.company && (
                    <p className="text-sm text-th-text-m truncate">{selectedContact.company}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Match Content */}
            <div className="p-4">
              {isLoadingMatch && !itemizedMatch ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
                </div>
              ) : itemizedMatch ? (
                <ItemizedMatchCard match={itemizedMatch} showActions={false} />
              ) : (
                <div className="text-center py-12">
                  <Sparkle24Regular className="w-12 h-12 text-th-text-m/50 mx-auto mb-4" />
                  <p className="text-th-text-m">{t.contacts?.matchDetails?.noData || 'No match data available'}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-4 pt-0 flex gap-3">
              <Link
                href={`/contacts/${selectedContact.id}`}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-th-surface border border-th-border text-th-text font-medium rounded-xl hover:bg-th-surface-h transition-colors"
              >
                {t.contacts?.matchDetails?.viewProfile || 'View Profile'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Contact Limit Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowLimitModal(false)}
          />
          <div className="relative w-full max-w-sm bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/15 flex items-center justify-center">
                <Warning24Regular className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-th-text">Contact Limit Reached</h3>
                <p className="text-sm text-th-text-s mt-2">
                  You have reached your plan limit of{' '}
                  <span className="font-semibold text-th-text">{planLimit?.limit.toLocaleString()}</span> contacts.
                </p>
                <p className="text-sm text-th-text-m mt-1">
                  Upgrade your plan to add more contacts and grow your network.
                </p>
              </div>

              {/* Usage bar in modal */}
              {planLimit && planLimit.limit > 0 && (
                <div className="bg-th-surface rounded-lg p-3">
                  <div className="flex justify-between text-xs text-th-text-s mb-1.5">
                    <span>Current usage</span>
                    <span className="text-red-400 font-medium">
                      {planLimit.current.toLocaleString()} / {planLimit.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-th-bg rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="flex-1 px-4 py-3 bg-th-surface border border-th-border text-th-text font-medium rounded-xl hover:bg-th-surface-h transition-colors"
                >
                  Close
                </button>
                <Link
                  href="/checkout"
                  onClick={() => setShowLimitModal(false)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all text-center"
                >
                  Upgrade Plan
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        totalContacts={contacts.length}
      />
    </div>
  );
}
