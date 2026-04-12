'use client';

import { useState, useEffect, useCallback } from 'react';
import { saApi } from '@/lib/api/superadmin-client';

interface BugReport {
  id: string;
  userId: string;
  description: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'BUG' | 'UI_ISSUE' | 'PERFORMANCE' | 'FEATURE_REQUEST' | 'OTHER';
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'WONT_FIX';
  pagePath: string;
  pageTitle: string | null;
  screenshotUrl: string | null;
  platform: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { fullName: string; email: string };
}

interface Stats {
  open: number;
  inProgress: number;
  highUrgency: number;
  total: number;
}

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'DONE', 'WONT_FIX'] as const;
const CATEGORY_OPTIONS = ['BUG', 'UI_ISSUE', 'PERFORMANCE', 'FEATURE_REQUEST', 'OTHER'] as const;
const URGENCY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'] as const;

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-400 text-black border-blue-400',
  IN_PROGRESS: 'bg-emerald-400 text-black border-emerald-400',
  DONE: 'bg-green-500 text-black border-green-500',
  WONT_FIX: 'bg-gray-400 text-black border-gray-400',
};

const urgencyDot: Record<string, string> = {
  LOW: 'bg-green-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-red-500',
};

const categoryLabels: Record<string, string> = {
  BUG: 'Bug',
  UI_ISSUE: 'UI Issue',
  PERFORMANCE: 'Performance',
  FEATURE_REQUEST: 'Feature Request',
  OTHER: 'Other',
};

const statusLabels: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  WONT_FIX: "Won't Fix",
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

export default function SuperadminBugReportsPage() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [stats, setStats] = useState<Stats>({ open: 0, inProgress: 0, highUrgency: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [qaEnabled, setQaEnabled] = useState(true);
  const [togglingQA, setTogglingQA] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await saApi.get<Stats>('/bug-reports/stats');
      setStats(data);
    } catch {}
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (urgencyFilter) params.set('urgency', urgencyFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');

      const qs = params.toString();
      const data = await saApi.get<{ reports: BugReport[]; total: number; page: number; totalPages: number }>(
        `/bug-reports?${qs}`
      );
      setReports(data.reports || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load bug reports:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, urgencyFilter, search, page]);

  const fetchQAConfig = useCallback(async () => {
    try {
      const configs = await saApi.get<Array<{ key: string; value: string }>>('/config?group=features');
      const cfg = Array.isArray(configs) ? configs.find((c: any) => c.key === 'qa_reporting_enabled') : null;
      setQaEnabled(cfg?.value === 'true');
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
    fetchQAConfig();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, urgencyFilter, search]);

  const toggleQA = async () => {
    setTogglingQA(true);
    try {
      const newVal = !qaEnabled;
      await saApi.patch('/config', {
        configs: [{ key: 'qa_reporting_enabled', value: newVal ? 'true' : 'false' }],
      });
      setQaEnabled(newVal);
    } catch (err) {
      console.error('Failed to toggle QA:', err);
    } finally {
      setTogglingQA(false);
    }
  };

  const startEdit = (report: BugReport) => {
    setEditingId(report.id);
    setEditStatus(report.status);
    setEditNotes(report.adminNotes || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditStatus('');
    setEditNotes('');
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      await saApi.patch(`/bug-reports/${id}/status`, {
        status: editStatus,
        adminNotes: editNotes || null,
      });
      cancelEdit();
      fetchReports();
      fetchStats();
    } catch (err) {
      console.error('Failed to update bug report:', err);
    } finally {
      setSaving(false);
    }
  };

  const selectClass =
    'px-2.5 py-1.5 rounded-lg bg-[#16161e] border border-[#2a2a35] text-white font-bold text-sm focus:outline-none focus:ring-1 focus:ring-[#DC2626]/50 appearance-none';

  return (
    <div className="space-y-6">
      {/* QA Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white font-bold">QA / Bug Reports</h2>
        <button
          onClick={toggleQA}
          disabled={togglingQA}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            qaEnabled ? 'bg-[#DC2626]' : 'bg-[#2a2a35]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              qaEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open', value: stats.open, color: 'text-white', bg: 'bg-blue-500/20' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-white', bg: 'bg-emerald-500/20' },
          { label: 'High Urgency', value: stats.highUrgency, color: 'text-white', bg: 'bg-red-500/20' },
          { label: 'Total', value: stats.total, color: 'text-white font-bold', bg: 'bg-[#16161e]' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border border-[#2a2a35] rounded-xl p-4`}>
            <p className="text-xs text-white font-bold mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>{categoryLabels[c]}</option>
          ))}
        </select>
        <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)} className={selectClass}>
          <option value="">All Urgencies</option>
          {URGENCY_OPTIONS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search descriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-[#16161e] border border-[#2a2a35] text-white font-bold text-sm placeholder:text-white font-bold focus:outline-none focus:ring-1 focus:ring-[#DC2626]/50"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#DC2626]/30 border-t-[#DC2626] rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-white font-bold">No bug reports found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a35] text-white font-bold text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-3">Status</th>
                <th className="text-left py-3 px-2">Urg</th>
                <th className="text-left py-3 px-3">Category</th>
                <th className="text-left py-3 px-3">User</th>
                <th className="text-left py-3 px-3">Page</th>
                <th className="text-left py-3 px-3">Description</th>
                <th className="text-left py-3 px-3">Screenshot</th>
                <th className="text-left py-3 px-3">Date</th>
                <th className="text-left py-3 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-b border-[#2a2a35]/50 hover:bg-[#16161e]/50">
                  <td className="py-3 px-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[report.status]}`}>
                      {statusLabels[report.status]}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${urgencyDot[report.urgency]}`} title={report.urgency} />
                  </td>
                  <td className="py-3 px-3 text-white font-bold">{categoryLabels[report.category]}</td>
                  <td className="py-3 px-3">
                    <div className="text-white font-bold text-xs">{report.user?.fullName || '—'}</div>
                    <div className="text-white font-bold text-xs truncate max-w-[120px]">{report.user?.email || ''}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-xs font-mono text-white font-bold">{report.pagePath}</span>
                  </td>
                  <td className="py-3 px-3 max-w-[200px]">
                    <p className="text-white font-bold text-xs truncate">{report.description}</p>
                  </td>
                  <td className="py-3 px-3">
                    {report.screenshotUrl ? (
                      <img
                        src={report.screenshotUrl}
                        alt="Screenshot"
                        className="h-8 w-12 rounded border border-[#2a2a35] object-cover cursor-pointer hover:opacity-80"
                        onClick={() => window.open(report.screenshotUrl!, '_blank')}
                      />
                    ) : (
                      <span className="text-white font-bold text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-white font-bold text-xs whitespace-nowrap">{timeAgo(report.createdAt)}</td>
                  <td className="py-3 px-3">
                    {editingId === report.id ? (
                      <div className="space-y-2 min-w-[180px]">
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full px-2 py-1 rounded bg-[#16161e] border border-[#2a2a35] text-white font-bold text-xs"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{statusLabels[s]}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Admin notes..."
                          className="w-full px-2 py-1 rounded bg-[#16161e] border border-[#2a2a35] text-white font-bold text-xs placeholder:text-white font-bold"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveEdit(report.id)}
                            disabled={saving}
                            className="px-2 py-1 rounded bg-[#DC2626] text-white text-xs hover:bg-[#DC2626]/80 disabled:opacity-50"
                          >
                            {saving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2 py-1 rounded bg-[#2a2a35] text-white font-bold text-xs hover:text-white font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(report)}
                        className="text-xs text-[#DC2626] hover:text-[#DC2626]/80 font-medium"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded-lg bg-[#16161e] border border-[#2a2a35] text-white font-bold text-sm disabled:opacity-30 hover:text-white font-bold"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-white font-bold">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded-lg bg-[#16161e] border border-[#2a2a35] text-white font-bold text-sm disabled:opacity-30 hover:text-white font-bold"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
