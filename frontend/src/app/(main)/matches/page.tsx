/**
 * Matches Page
 *
 * Unified view of all AI-powered matches from Projects, Deals, Pitch, and Jobs.
 * Only shows contacts (not users), filtered to contacts in user's contact list.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { getContacts, Contact } from '@/lib/api/contacts';
import { getProjects, getProjectMatches } from '@/lib/api/projects';
import { getDeals, getDealResults } from '@/lib/api/deals';
import { listPitches, getPitchResults } from '@/lib/api/pitch';
import { getAllMatches as getAllOpportunityMatches } from '@/lib/api/opportunities';
import { MatchCard, type MatchCardData } from '@/components/features/matches';
import { api } from '@/lib/api/client';
import {
  Sparkle24Regular,
  Handshake24Regular,
  Lightbulb24Regular,
  Rocket24Regular,
  Briefcase24Regular,
  People24Regular,
  Dismiss12Regular,
  Search20Regular,
} from '@fluentui/react-icons';

/** Unified match item extending the shared MatchCardData */
interface UnifiedMatch extends MatchCardData {
  sourceId: string;
  matchId: string;
  createdAt: string;
  contact?: Contact;
}

const STORAGE_KEY = 'matches-local-statuses';

function getLocalStatuses(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveLocalStatuses(statuses: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
}

/** Color config per source type */
const SOURCE_COLORS: Record<string, { bg: string; bgActive: string; border: string; borderActive: string; text: string; textActive: string; badge: string; badgeActive: string }> = {
  project: {
    bg: 'bg-emerald-500/5', bgActive: 'bg-emerald-500/20',
    border: 'border-emerald-500/15', borderActive: 'border-emerald-500/50',
    text: 'text-th-text-s', textActive: 'text-emerald-300',
    badge: 'bg-emerald-500/10 text-emerald-400/60', badgeActive: 'bg-emerald-500/30 text-emerald-300',
  },
  deal: {
    bg: 'bg-blue-500/5', bgActive: 'bg-blue-500/20',
    border: 'border-blue-500/15', borderActive: 'border-blue-500/50',
    text: 'text-th-text-s', textActive: 'text-blue-300',
    badge: 'bg-blue-500/10 text-blue-400/60', badgeActive: 'bg-blue-500/30 text-blue-300',
  },
  pitch: {
    bg: 'bg-emerald-500/5', bgActive: 'bg-emerald-500/20',
    border: 'border-emerald-500/15', borderActive: 'border-emerald-500/50',
    text: 'text-th-text-s', textActive: 'text-emerald-300',
    badge: 'bg-emerald-500/10 text-emerald-400/60', badgeActive: 'bg-emerald-500/30 text-emerald-300',
  },
  job: {
    bg: 'bg-teal-500/5', bgActive: 'bg-teal-500/20',
    border: 'border-teal-500/15', borderActive: 'border-teal-500/50',
    text: 'text-th-text-s', textActive: 'text-teal-300',
    badge: 'bg-teal-500/10 text-teal-400/60', badgeActive: 'bg-teal-500/30 text-teal-300',
  },
};

export default function MatchesPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'project' | 'deal' | 'pitch' | 'job'>('all');
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [sourceSearch, setSourceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'dismissed'>('active');
  const [matches, setMatches] = useState<UnifiedMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const toggleSourceId = useCallback((id: string) => {
    setSelectedSourceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSourceIds = useCallback(() => setSelectedSourceIds(new Set()), []);

  useEffect(() => {
    async function fetchAllMatches() {
      setIsLoading(true);
      const allMatches: UnifiedMatch[] = [];

      try {
        // First fetch user's contacts to validate matches
        const contactsData = await getContacts({ limit: 500 }).catch(() => null);
        const contactMap = new Map<string, Contact>();
        if (contactsData?.contacts) {
          contactsData.contacts.forEach(c => contactMap.set(c.id, c));
        }

        // Fetch all sources in parallel
        const [projectsRes, dealsRes, pitchesRes, oppsRes] = await Promise.all([
          getProjects({ limit: 50 }).catch(() => null),
          getDeals({ limit: 20 }).catch(() => null),
          listPitches({ limit: 20 }).catch(() => null),
          getAllOpportunityMatches({ limit: 100 }).catch(() => null),
        ]);

        // Project matches - contacts only
        if (projectsRes?.projects) {
          for (const project of projectsRes.projects) {
            try {
              const res = await getProjectMatches(project.id, { minScore: 30 });
              if (res?.matches) {
                for (const m of res.matches) {
                  if (m.matchType !== 'contact' || !m.matchedContact?.id) continue;
                  const contact = contactMap.get(m.matchedContact.id);
                  allMatches.push({
                    id: `proj-${m.id}`,
                    source: 'project',

                    sourceTitle: project.title,
                    sourceId: project.id,
                    matchId: m.id,
                    score: m.matchScore,
                    name: contact?.name || m.matchedContact.fullName,
                    company: contact?.company || m.matchedContact.company || '',
                    contactId: m.matchedContact.id,
                    reasons: m.reasons || [],
                    sharedSectors: m.sharedSectors || [],
                    sharedSkills: m.sharedSkills || [],
                    status: m.status,
                    createdAt: m.createdAt,
                    contact: contact || undefined,
                    channels: {
                      phone: contact?.phone || m.matchedContact.phone || null,
                      email: contact?.email || m.matchedContact.email || null,
                      linkedinUrl: contact?.linkedInUrl || m.matchedContact.linkedinUrl || null,
                    },
                  });
                }
              }
            } catch {}
          }
        }

        // Deal matches
        if (dealsRes?.deals) {
          for (const deal of dealsRes.deals.filter((d: any) => d.matchCount > 0)) {
            try {
              const res = await getDealResults(deal.id);
              if (res?.results) {
                for (const m of res.results) {
                  if (!m.contact?.id) continue;
                  const contact = contactMap.get(m.contact.id);
                  allMatches.push({
                    id: `deal-${m.id}`,
                    source: 'deal',

                    sourceTitle: deal.productName || deal.targetDescription || 'Smart Deal',
                    sourceId: deal.id,
                    matchId: m.id,
                    score: m.score,
                    name: contact?.name || m.contact.fullName || (m.contact as any).name || 'Unknown',
                    company: contact?.company || m.contact.company || '',
                    contactId: m.contact.id,
                    reasons: (m.reasons || []).map((r: any) => typeof r === 'string' ? r : r.text),
                    sharedSectors: [],
                    sharedSkills: [],
                    status: m.status,
                    createdAt: m.createdAt || deal.createdAt,
                    contact: contact || undefined,
                    channels: {
                      phone: contact?.phone || m.contact.phone || null,
                      email: contact?.email || m.contact.email || null,
                      linkedinUrl: contact?.linkedInUrl || m.contact.linkedinUrl || null,
                    },
                  });
                }
              }
            } catch {}
          }
        }

        // Pitch matches
        if (pitchesRes?.pitches) {
          for (const pitch of pitchesRes.pitches.filter((p: any) => p.status === 'COMPLETED' || p.status === 'completed')) {
            try {
              const res = await getPitchResults(pitch.id);
              if (res?.sections) {
                for (const section of res.sections) {
                  if (section.matches) {
                    for (const m of section.matches) {
                      if (!m.contact?.id) continue;
                      const contact = contactMap.get(m.contact.id);
                      allMatches.push({
                        id: `pitch-${m.id}`,
                        source: 'pitch',

                        sourceTitle: pitch.title || pitch.companyName || 'Pitch Deck',
                        sourceId: pitch.id,
                        matchId: m.id,
                        score: m.score,
                        name: contact?.name || m.contact.fullName,
                        company: contact?.company || m.contact.company || '',
                        contactId: m.contact.id,
                        reasons: (m.reasons || []).map((r: any) => typeof r === 'string' ? r : r.text),
                        sharedSectors: [],
                        sharedSkills: [],
                        status: m.status,
                        createdAt: pitch.uploadedAt,
                        contact: contact || undefined,
                        channels: {
                          phone: contact?.phone || m.contact.phone || null,
                          email: contact?.email || m.contact.email || null,
                          linkedinUrl: contact?.linkedInUrl || m.contact.linkedinUrl || null,
                        },
                      });
                    }
                  }
                }
              }
            } catch {}
          }
        }

        // Opportunity (Jobs) matches - contacts only
        if (oppsRes?.matches) {
          for (const m of oppsRes.matches) {
            if (m.matchType !== 'contact' || !m.candidate?.id) continue;
            const contact = contactMap.get(m.candidate.id);
            allMatches.push({
              id: `job-${m.id}`,
              source: 'job',
              sourceTitle: m.opportunityTitle || 'Opportunity',
              sourceId: m.opportunityId,
              matchId: m.id,
              score: m.matchScore,
              name: contact?.name || m.candidate.fullName,
              company: contact?.company || m.candidate.company || '',
              contactId: m.candidate.id,
              reasons: m.reasons || [],
              sharedSectors: m.sharedSectors || [],
              sharedSkills: m.sharedSkills || [],
              status: m.status,
              createdAt: m.createdAt,
              contact: contact || undefined,
              channels: {
                phone: contact?.phone || m.candidate.phone || null,
                email: contact?.email || m.candidate.email || null,
                linkedinUrl: contact?.linkedInUrl || m.candidate.linkedinUrl || null,
              },
            });
          }
        }

        // Resolve intellmatchUserId for contacts with emails
        const uniqueEmails = [...new Set(allMatches.map(m => m.channels.email).filter(Boolean))] as string[];
        const emailToUserId = new Map<string, string>();
        if (uniqueEmails.length > 0) {
          try {
            const checkResult = await api.post<{ existingEmails: string[] }>('/users/check-emails', { emails: uniqueEmails });
            if (checkResult.existingEmails?.length > 0) {
              const searchResult = await api.get<any[]>(`/users/search?q=${encodeURIComponent(checkResult.existingEmails.join(','))}&limit=100`);
              if (searchResult) {
                for (const user of searchResult) {
                  if (user.email) {
                    emailToUserId.set(user.email.toLowerCase(), user.id);
                  }
                }
              }
            }
          } catch {}
        }

        // Attach intellmatchUserId to channels
        for (const m of allMatches) {
          if (m.channels.email) {
            const userId = emailToUserId.get(m.channels.email.toLowerCase());
            if (userId) {
              m.channels.intellmatchUserId = userId;
            }
          }
        }

        // Sort by score descending
        allMatches.sort((a, b) => b.score - a.score);

        // Apply locally stored statuses (dismissed/archived)
        const localStatuses = getLocalStatuses();
        for (const m of allMatches) {
          if (localStatuses[m.id]) {
            m.status = localStatuses[m.id];
          }
        }

        setMatches(allMatches);
      } catch (error) {
        console.error('Failed to fetch matches:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllMatches();
  }, []);

  const handleStatusChange = useCallback((matchId: string, status: string) => {
    const localStatuses = getLocalStatuses();

    if (status === 'ACTIVE') {
      // Restore: remove from local overrides
      delete localStatuses[matchId];
    } else {
      // Dismiss or Archive: store locally
      localStatuses[matchId] = status;
    }

    saveLocalStatuses(localStatuses);
    setMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, status: status === 'ACTIVE' ? 'PENDING' : status } : m
    ));
  }, []);

  // Build unique source items for the dropdown (grouped by source type)
  const sourceItems = useMemo(() => {
    const byType: Record<string, Map<string, { id: string; title: string; matchCount: number }>> = {
      project: new Map(),
      deal: new Map(),
      pitch: new Map(),
      job: new Map(),
    };
    for (const m of matches) {
      const map = byType[m.source];
      if (!map) continue;
      const existing = map.get(m.sourceId);
      if (existing) {
        existing.matchCount++;
      } else {
        map.set(m.sourceId, { id: m.sourceId, title: m.sourceTitle, matchCount: 1 });
      }
    }
    return {
      project: [...(byType.project?.values() || [])],
      deal: [...(byType.deal?.values() || [])],
      pitch: [...(byType.pitch?.values() || [])],
      job: [...(byType.job?.values() || [])],
    };
  }, [matches]);

  const sourceCounts = {
    all: matches.length,
    project: matches.filter(m => m.source === 'project').length,
    deal: matches.filter(m => m.source === 'deal').length,
    pitch: matches.filter(m => m.source === 'pitch').length,
    job: matches.filter(m => m.source === 'job').length,
  };

  const filters = [
    { id: 'all' as const, label: t.common?.all || 'All', count: sourceCounts.all },
    { id: 'project' as const, label: t.matchesPage?.projects || 'Projects', count: sourceCounts.project },
    { id: 'deal' as const, label: t.matchesPage?.deals || 'Deals', count: sourceCounts.deal },
    { id: 'pitch' as const, label: t.matchesPage?.pitch || 'Pitch', count: sourceCounts.pitch },
    { id: 'job' as const, label: t.matchesPage?.jobs || 'Jobs', count: sourceCounts.job },
  ];

  const DISMISSED_STATUSES = ['DISMISSED', 'IGNORED'];
  const ARCHIVED_STATUSES = ['ARCHIVED'];
  const ACTIVE_STATUSES_EXCLUDE = [...DISMISSED_STATUSES, ...ARCHIVED_STATUSES];

  const activeMatches = matches.filter(m => !ACTIVE_STATUSES_EXCLUDE.includes(m.status));
  const archivedMatches = matches.filter(m => ARCHIVED_STATUSES.includes(m.status));
  const dismissedMatches = matches.filter(m => DISMISSED_STATUSES.includes(m.status));

  const statusMatches = statusFilter === 'archived' ? archivedMatches : statusFilter === 'dismissed' ? dismissedMatches : activeMatches;
  const sourceFiltered = filter === 'all' ? statusMatches : statusMatches.filter(m => m.source === filter);
  const filteredMatches = selectedSourceIds.size > 0 ? sourceFiltered.filter(m => selectedSourceIds.has(m.sourceId)) : sourceFiltered;

  const excellentCount = activeMatches.filter(m => m.score >= 90).length;
  const strongCount = activeMatches.filter(m => m.score >= 75 && m.score < 90).length;
  const veryGoodCount = activeMatches.filter(m => m.score >= 60 && m.score < 75).length;

  return (
    <div className="space-y-4 animate-fade-in pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-th-text">{t.matches?.title || 'AI Matches'}</h1>
        <p className="text-th-text-t text-sm">{t.matchesPage?.subtitle || 'All your AI-powered matches from contacts'}</p>
      </div>

      {/* Stats - Row 1: Active & Contacts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-th-surface border border-th-border rounded-xl p-3 text-center">
          <div className="w-8 h-8 mx-auto mb-1 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Handshake24Regular className="w-4 h-4 text-white" />
          </div>
          <p className="text-xl font-bold text-th-text">{activeMatches.length}</p>
          <p className="text-[10px] text-th-text-m">{t.matchesPage?.activeMatches || 'Active Matches'}</p>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-3 text-center">
          <div className="w-8 h-8 mx-auto mb-1 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <People24Regular className="w-4 h-4 text-white" />
          </div>
          <p className="text-xl font-bold text-th-text">{new Set(activeMatches.map(m => m.contactId)).size}</p>
          <p className="text-[10px] text-th-text-m">{t.matchesPage?.contacts || 'Contacts'}</p>
        </div>
      </div>

      {/* Stats - Row 2: Excellent, Strong, Good */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-th-surface border border-th-border rounded-xl p-2.5 text-center">
          <div className="w-6 h-6 mx-auto mb-1 rounded-md bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <Sparkle24Regular className="w-3 h-3 text-white" />
          </div>
          <p className="text-lg font-bold text-green-400">{excellentCount}</p>
          <p className="text-[10px] text-th-text-m">{t.matchesPage?.excellent || 'Excellent'} <span className="text-green-400/60">90%+</span></p>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-2.5 text-center">
          <div className="w-6 h-6 mx-auto mb-1 rounded-md bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
            <Sparkle24Regular className="w-3 h-3 text-white" />
          </div>
          <p className="text-lg font-bold text-blue-400">{strongCount}</p>
          <p className="text-[10px] text-th-text-m">{t.matchesPage?.strong || 'Strong'} <span className="text-blue-400/60">75%-89%</span></p>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-2.5 text-center">
          <div className="w-6 h-6 mx-auto mb-1 rounded-md bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Sparkle24Regular className="w-3 h-3 text-white" />
          </div>
          <p className="text-lg font-bold text-amber-400">{veryGoodCount}</p>
          <p className="text-[10px] text-th-text-m">{t.matchesPage?.veryGood || 'Very Good'} <span className="text-amber-400/60">60%-74%</span></p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 p-1 bg-th-surface rounded-xl">
        {([
          { id: 'active' as const, label: t.matchesPage?.active || 'Active', count: activeMatches.length },
          { id: 'archived' as const, label: t.common?.archived || 'Archived', count: archivedMatches.length },
          { id: 'dismissed' as const, label: t.matchesPage?.dismissed || 'Dismissed', count: dismissedMatches.length },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === tab.id
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Source Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); clearSourceIds(); setSourceSearch(''); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              filter === f.id
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Source Item Chips - shown when a specific source type is selected */}
      {filter !== 'all' && sourceItems[filter].length > 1 && (() => {
        const colors = SOURCE_COLORS[filter];
        const items = sourceItems[filter];
        const visibleItems = sourceSearch
          ? items.filter(i => i.title.toLowerCase().includes(sourceSearch.toLowerCase()))
          : items;
        const selectedCount = selectedSourceIds.size;
        const selectedItems = items.filter(i => selectedSourceIds.has(i.id));
        const totalSelectedMatches = selectedItems.reduce((s, i) => s + i.matchCount, 0);

        return (
          <div className="space-y-2">
            {/* Search bar + clear all */}
            {items.length > 4 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-th-surface border border-th-border rounded-lg">
                <Search20Regular className="w-4 h-4 text-th-text-m flex-shrink-0" />
                <input
                  type="text"
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  placeholder={`Search ${filters.find(f => f.id === filter)?.label.toLowerCase()}...`}
                  className="bg-transparent text-xs text-th-text placeholder-th-text-m outline-none w-full"
                />
                {sourceSearch && (
                  <button onClick={() => setSourceSearch('')} className="p-0.5">
                    <Dismiss12Regular className="w-3 h-3 text-th-text-m" />
                  </button>
                )}
              </div>
            )}

            {/* Selected summary bar */}
            {selectedCount > 0 && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colors.bgActive} border ${colors.borderActive}`}>
                <span className={`text-xs font-medium ${colors.textActive} flex-1`}>
                  {selectedCount === 1
                    ? selectedItems[0].title
                    : `${selectedCount} ${t.matchesPage?.selected || 'selected'}`}
                  <span className="ml-1.5 opacity-60">({totalSelectedMatches} {t.matchesPage?.matches || 'matches'})</span>
                </span>
                <button
                  onClick={clearSourceIds}
                  className={`text-[10px] px-2 py-0.5 rounded-full ${colors.badge} hover:opacity-80 transition-opacity flex items-center gap-1`}
                >
                  {t.matchesPage?.clearAll || 'Clear all'}
                  <Dismiss12Regular className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Chips row */}
            <div className="flex gap-1.5 flex-wrap">
              {visibleItems.map(item => {
                const isActive = selectedSourceIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleSourceId(item.id)}
                    className={`
                      group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                      border transition-all duration-200
                      ${isActive
                        ? `${colors.bgActive} ${colors.borderActive} ${colors.textActive} shadow-sm`
                        : `${colors.bg} ${colors.border} ${colors.text} hover:${colors.bgActive} hover:${colors.borderActive}`
                      }
                    `}
                  >
                    <span className="truncate max-w-[160px]">{item.title}</span>
                    <span className={`
                      text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                      ${isActive ? colors.badgeActive : colors.badge}
                    `}>
                      {item.matchCount}
                    </span>
                    {isActive && (
                      <Dismiss12Regular className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                );
              })}
              {visibleItems.length === 0 && sourceSearch && (
                <p className="text-xs text-th-text-m py-1">No {filters.find(f => f.id === filter)?.label.toLowerCase()} match &ldquo;{sourceSearch}&rdquo;</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-th-surface border border-th-border rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-th-surface-h" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-th-surface-h rounded" />
                  <div className="h-3 w-24 bg-th-surface-h rounded" />
                  <div className="h-3 w-48 bg-th-surface-h rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Matches */}
      {!isLoading && (
        <div className="space-y-3">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onStatusChange={handleStatusChange}
              t={t as any}
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filteredMatches.length === 0 && (
        <div className="bg-th-surface border border-th-border rounded-xl p-10 text-center">
          <People24Regular className="w-10 h-10 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t">
            {matches.length === 0
              ? (t.matchesPage?.noMatchesFound || 'No matches found from your contacts')
              : (t.matchesPage?.noFilterMatches || 'No matches with this filter')}
          </p>
          <p className="text-xs text-th-text-m mt-1">
            {matches.length === 0
              ? (t.matchesPage?.noMatchesHint || 'Create projects, deals, pitches, or job listings and run Find Matches.')
              : (t.matchesPage?.tryFilterHint || 'Try a different filter.')}
          </p>
          {matches.length === 0 && (
            <Link href="/matching">
              <button className="mt-4 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-xl">
                {t.matchesPage?.goToMatching || 'Go to Matching'}
              </button>
            </Link>
          )}
        </div>
      )}

      {/* Source breakdown */}
      {!isLoading && matches.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <h3 className="text-th-text font-semibold mb-3 flex items-center gap-2 text-sm">
            <Sparkle24Regular className="w-4 h-4 text-emerald-400" />
            {t.matchesPage?.matchSources || 'Match Sources'}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: t.matchesPage?.projects || 'Projects', count: sourceCounts.project, icon: Lightbulb24Regular, color: 'text-emerald-400' },
              { label: t.matchesPage?.smartDeals || 'Smart Deals', count: sourceCounts.deal, icon: Handshake24Regular, color: 'text-blue-400' },
              { label: t.matchesPage?.pitchDecks || 'Pitch Decks', count: sourceCounts.pitch, icon: Rocket24Regular, color: 'text-emerald-400' },
              { label: t.matchesPage?.jobs || 'Jobs', count: sourceCounts.job, icon: Briefcase24Regular, color: 'text-teal-400' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-th-text-s">{s.label}</span>
                <span className="text-xs font-semibold text-th-text ml-auto">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
