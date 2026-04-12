'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/hooks/useOrganization';
import { organizationApi, SharedContact } from '@/lib/api/organization';
import {
  ArrowLeft24Regular,
  Search24Regular,
  People24Regular,
  Building24Regular,
  PersonCircle24Regular,
} from '@fluentui/react-icons';

export default function TeamContactsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { organization } = useOrganization();

  const [contacts, setContacts] = useState<SharedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<{ totalShared: number; contactLimit: number; memberCount: number } | null>(null);

  const loadContacts = async () => {
    if (!organization) return;
    setLoading(true);
    try {
      const [result, statsData] = await Promise.all([
        organizationApi.getOrgContacts(organization.id, { page, limit: 20, search: search || undefined }),
        organizationApi.getOrgContactStats(organization.id),
      ]);
      setContacts(result.data);
      setTotalPages(result.pagination.totalPages);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadContacts();
  }, [organization, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadContacts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const limitPercent = stats ? Math.round((stats.totalShared / stats.contactLimit) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-th-text">{t.organization?.teamContacts || 'Team Contacts'}</h1>
          <p className="text-sm text-th-text-m">{organization?.name}</p>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-th-surface border border-th-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-th-text-t">{t.organization?.orgContacts || 'Organization Contacts'}</span>
            <span className="text-sm font-medium text-th-text">{stats.totalShared.toLocaleString()} / {stats.contactLimit.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-th-surface-h rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(limitPercent, 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-th-text-m">
              <People24Regular className="w-3 h-3 inline mr-1" />
              {stats.memberCount} {t.organization?.membersCount || 'members'}
            </span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search24Regular className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.organization?.searchContacts || 'Search team contacts...'}
          className="w-full bg-th-surface border border-th-border rounded-xl pl-10 pr-4 py-3 text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Contact List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12">
          <People24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t">{t.organization?.noTeamContacts || 'No team contacts yet'}</p>
          <p className="text-sm text-white/70 mt-1">{t.organization?.shareToSee || 'Share contacts from your contact list to see them here'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((sc, index) => (
            <div
              key={sc.id}
              className="flex items-center justify-between p-4 bg-th-surface border border-th-border rounded-xl hover:bg-th-surface transition-all cursor-pointer"
              style={{ animationDelay: `${index * 30}ms` }}
              onClick={() => router.push(`/contacts/${sc.contactId}`)}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  {sc.contact.avatarUrl ? (
                    <img src={sc.contact.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white text-sm font-medium">
                      {sc.contact.fullName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  {/* Shared by badge */}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-th-bg-t border-2 border-th-border flex items-center justify-center" title={`Shared by ${sc.sharedBy.fullName}`}>
                    {sc.sharedBy.avatarUrl ? (
                      <img src={sc.sharedBy.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-[8px] text-th-text font-bold">{sc.sharedBy.fullName?.charAt(0)}</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-th-text">{sc.contact.fullName}</p>
                  <div className="flex items-center gap-2">
                    {sc.contact.jobTitle && <span className="text-xs text-th-text-m">{sc.contact.jobTitle}</span>}
                    {sc.contact.company && (
                      <>
                        {sc.contact.jobTitle && <span className="text-xs text-white/70">at</span>}
                        <span className="text-xs text-th-text-t">{sc.contact.company}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  sc.visibility === 'FULL' ? 'bg-green-500/20 text-green-400' :
                  sc.visibility === 'BASIC' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-white/[0.03]0/20 text-th-text-t'
                }`}>
                  {sc.visibility}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 bg-th-surface-h rounded-lg text-sm text-th-text-t disabled:opacity-50"
          >
            {t.common?.previous || 'Previous'}
          </button>
          <span className="text-sm text-th-text-m">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 bg-th-surface-h rounded-lg text-sm text-th-text-t disabled:opacity-50"
          >
            {t.common?.next || 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}
