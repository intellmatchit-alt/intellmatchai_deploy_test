'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMyBugReports, BugReport } from '@/lib/api/bug-reports';
import { useI18n } from '@/lib/i18n';

const STATUS_TABS = ['ALL', 'OPEN', 'IN_PROGRESS', 'DONE'] as const;

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  IN_PROGRESS: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  DONE: 'bg-green-500/20 text-green-400 border-green-500/30',
  WONT_FIX: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const urgencyDot: Record<string, string> = {
  LOW: 'bg-green-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-red-500',
};

const categoryColors: Record<string, string> = {
  BUG: 'bg-red-500/15 text-red-400',
  UI_ISSUE: 'bg-purple-500/15 text-purple-400',
  PERFORMANCE: 'bg-orange-500/15 text-orange-400',
  FEATURE_REQUEST: 'bg-teal-500/15 text-teal-400',
  OTHER: 'bg-gray-500/15 text-gray-400',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function BugReportsPage() {
  const { t } = useI18n();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; page: number; limit: number } = { page, limit: 20 };
      if (activeTab !== 'ALL') params.status = activeTab;
      const data = await getMyBugReports(params);
      setReports(data.bugReports);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load bug reports:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const br = t.bugReports || {} as any;

  return (
    <div className="max-w-2xl mx-auto px-4">
      {/* Header */}
      <h1 className="text-xl font-bold text-th-text mb-4">{br.title || 'My Reports'}</h1>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-teal-600 text-white'
                : 'text-th-text-s hover:text-th-text'
            }`}
          >
            {tab === 'ALL' ? (br.all || 'All') : (br.statuses?.[tab] || tab.replace('_', ' '))}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-th-text-s">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>{br.noReports || 'No reports submitted yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-th-surface border border-th-border rounded-xl p-4 space-y-2.5"
            >
              {/* Top row: urgency dot + category + status + time */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${urgencyDot[report.urgency]}`} title={report.urgency} />
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[report.category]}`}>
                    {br.categories?.[report.category] || report.category.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[report.status]}`}>
                    {br.statuses?.[report.status] || report.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-th-text-s">{timeAgo(report.createdAt)}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-th-text line-clamp-3">{report.description}</p>

              {/* Page path */}
              <span className="inline-block text-xs font-mono text-th-text-s bg-white/5 px-2 py-0.5 rounded">
                {report.pagePath}
              </span>

              {/* Screenshot thumbnail */}
              {report.screenshotUrl && (
                <div>
                  <img
                    src={report.screenshotUrl}
                    alt="Screenshot"
                    className="h-20 w-auto rounded-lg border border-th-border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(report.screenshotUrl!, '_blank')}
                  />
                </div>
              )}

              {/* Admin Notes */}
              {report.adminNotes && (
                <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs font-medium text-teal-400 mb-0.5">{br.adminNotes || 'Admin Response'}</p>
                  <p className="text-sm text-th-text">{report.adminNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-th-border text-th-text-s text-sm disabled:opacity-30 hover:bg-white/10 transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-th-text-s">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-th-border text-th-text-s text-sm disabled:opacity-30 hover:bg-white/10 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
