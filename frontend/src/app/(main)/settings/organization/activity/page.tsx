'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/hooks/useOrganization';
import { organizationApi, OrgActivityLog } from '@/lib/api/organization';
import {
  ArrowLeft24Regular,
  PersonAdd24Regular,
  PersonDelete24Regular,
  Edit24Regular,
  Share24Regular,
  People24Regular,
  Building24Regular,
  Handshake24Regular,
} from '@fluentui/react-icons';

const ACTION_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  ORG_CREATED: { icon: Building24Regular, color: 'text-emerald-400 bg-emerald-500/20', label: 'Organization Created' },
  ORG_UPDATED: { icon: Edit24Regular, color: 'text-blue-400 bg-blue-500/20', label: 'Organization Updated' },
  MEMBER_INVITED: { icon: PersonAdd24Regular, color: 'text-green-400 bg-green-500/20', label: 'Member Invited' },
  MEMBER_JOINED: { icon: People24Regular, color: 'text-emerald-400 bg-emerald-500/20', label: 'Member Joined' },
  MEMBER_REMOVED: { icon: PersonDelete24Regular, color: 'text-red-400 bg-red-500/20', label: 'Member Removed' },
  ROLE_CHANGED: { icon: Edit24Regular, color: 'text-emerald-400 bg-emerald-500/20', label: 'Role Changed' },
  CONTACT_SHARED: { icon: Share24Regular, color: 'text-cyan-400 bg-cyan-500/20', label: 'Contacts Shared' },
  INTRO_REQUESTED: { icon: Handshake24Regular, color: 'text-emerald-400 bg-emerald-500/20', label: 'Intro Requested' },
};

export default function ActivityLogPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { organization, isLoading: orgLoading } = useOrganization();

  const [logs, setLogs] = useState<OrgActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAction, setFilterAction] = useState('');

  const loadLogs = async () => {
    if (!organization) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await organizationApi.getActivityLog(organization.id, {
        page,
        limit: 20,
        action: filterAction || undefined,
      });
      setLogs(Array.isArray(result?.data) ? result.data : []);
      setTotalPages(result?.pagination?.totalPages || 1);
    } catch (err) {
      console.error(err);
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [organization, page, filterAction]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t.common?.justNow || 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-6 animate-fade-in pb-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
            <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
          </button>
          <h1 className="text-2xl font-bold text-th-text">{t.organization?.activityLog || 'Activity Log'}</h1>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-8 text-center">
          <Building24Regular className="w-12 h-12 text-th-text-m mx-auto mb-3" />
          <p className="text-th-text-t">{t.organization?.noOrg || 'You are not part of any organization yet.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.organization?.activityLog || 'Activity Log'}</h1>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => { setFilterAction(''); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${!filterAction ? 'bg-emerald-500 text-white' : 'bg-th-surface-h text-th-text-t hover:bg-th-surface-h'}`}
        >
          {t.common?.all || 'All'}
        </button>
        {Object.entries(ACTION_CONFIG).map(([action, config]) => (
          <button
            key={action}
            onClick={() => { setFilterAction(action); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${filterAction === action ? 'bg-emerald-500 text-white' : 'bg-th-surface-h text-th-text-t hover:bg-th-surface-h'}`}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-th-text-m">
          {t.organization?.noActivity || 'No activity yet'}
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log, index) => {
            const config = ACTION_CONFIG[log.action] || { icon: Edit24Regular, color: 'text-th-text-t bg-th-surface-h', label: log.action };
            const Icon = config.icon;
            return (
              <div key={log.id} className="flex gap-3 p-3 hover:bg-th-surface rounded-xl transition-colors" style={{ animationDelay: `${index * 30}ms` }}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-th-text">{log.user.fullName}</span>
                    <span className="text-xs text-th-text-m">{config.label}</span>
                  </div>
                  {log.metadata && (
                    <p className="text-xs text-th-text-m mt-0.5 truncate">
                      {JSON.stringify(log.metadata).slice(0, 80)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-white/70 whitespace-nowrap">{formatDate(log.createdAt)}</span>
              </div>
            );
          })}
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
