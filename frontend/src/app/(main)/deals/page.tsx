/**
 * Deals Page
 *
 * List and manage deal matching requests.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useOrganizationStore } from '@/stores/organizationStore';
import {
  Add24Regular,
  Search24Regular,
  ChevronRight24Regular,
  Briefcase24Regular,
  People24Regular,
  Delete24Regular,
  Edit24Regular,
  ArrowSync24Regular,
  MoreVertical24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  Clock24Regular,
  Money24Regular,
  Cart24Regular,
  PeopleTeam24Regular,
  Apps24Regular,
  Archive24Regular,
  ArrowUndo24Regular,
} from '@fluentui/react-icons';
import {
  getDeals,
  deleteDeal,
  archiveDeal,
  Deal,
  DealMode,
  DealStatus,
  getModeColor,
  getStatusColor,
} from '@/lib/api/deals';
import { getTeamDeals, TeamDeal } from '@/lib/api/organization';
import { Avatar } from '@/components/ui/Avatar';
import { toast } from '@/components/ui/Toast';

/**
 * Mode Toggle Component — 3 visual cards
 */
function ModeToggle({
  mode,
  onChange,
}: {
  mode: DealMode | 'ALL';
  onChange: (mode: DealMode | 'ALL') => void;
}) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        onClick={() => onChange('ALL')}
        className={`relative overflow-hidden px-3 py-3 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1.5 border ${
          mode === 'ALL'
            ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 border-emerald-500/40 text-white shadow-lg shadow-emerald-500/10'
            : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h hover:text-th-text'
        }`}
      >
        {mode === 'ALL' && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-500/10" />
        )}
        <Apps24Regular className={`w-5 h-5 relative ${mode === 'ALL' ? 'text-emerald-400' : ''}`} />
        <span className="relative">{t.deals?.allModes || 'All'}</span>
      </button>
      <button
        onClick={() => onChange('SELL')}
        className={`relative overflow-hidden px-3 py-3 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1.5 border ${
          mode === 'SELL'
            ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10'
            : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h hover:text-th-text'
        }`}
      >
        {mode === 'SELL' && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-green-500/10" />
        )}
        <Money24Regular className={`w-5 h-5 relative ${mode === 'SELL' ? 'text-emerald-400' : ''}`} />
        <span className="relative">{t.deals?.sell || 'Sell'}</span>
      </button>
      <button
        onClick={() => onChange('BUY')}
        className={`relative overflow-hidden px-3 py-3 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1.5 border ${
          mode === 'BUY'
            ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-400 shadow-lg shadow-blue-500/10'
            : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h hover:text-th-text'
        }`}
      >
        {mode === 'BUY' && (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10" />
        )}
        <Cart24Regular className={`w-5 h-5 relative ${mode === 'BUY' ? 'text-blue-400' : ''}`} />
        <span className="relative">{t.deals?.buy || 'Buy'}</span>
      </button>
    </div>
  );
}

/**
 * Score Bar — mini gradient bar visualization
 */
function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'from-emerald-500 to-green-400'
      : score >= 40
        ? 'from-yellow-400 to-cyan-400'
        : 'from-red-500 to-emerald-400';

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-th-surface-h rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-th-text-t">{score}%</span>
    </div>
  );
}

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
 * Card Menu Component — 3-dot dropdown with Edit and Delete
 */
function CardMenu({
  onEdit,
  onDelete,
  onArchive,
  isArchived,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  isArchived: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
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
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
      >
        <MoreVertical24Regular className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-1 w-44 bg-[#1e1e2e] border border-th-border rounded-xl shadow-xl z-20 overflow-hidden">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-th-text hover:bg-th-surface-h transition-colors"
          >
            <Edit24Regular className="w-4 h-4" />
            {t.common?.edit || 'Edit'}
          </button>
          <div className="border-t border-th-border" />
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
        </div>
      )}
    </div>
  );
}

/**
 * Deal Card Component
 */
function DealCard({
  deal,
  onEdit,
  onDelete,
  onArchive,
  index,
}: {
  deal: Deal;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  index: number;
}) {
  const { t } = useI18n();

  const isSell = deal.mode === 'SELL';
  const accentGradient = isSell
    ? 'from-emerald-500 to-green-400'
    : 'from-blue-500 to-cyan-400';
  const hoverGlow = isSell
    ? 'hover:shadow-emerald-500/5'
    : 'hover:shadow-blue-500/5';

  const getStatusIcon = (status: DealStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <Checkmark24Regular className="w-3 h-3" />;
      case 'PROCESSING':
        return <ArrowSync24Regular className="w-3 h-3 animate-spin" />;
      case 'FAILED':
        return <Dismiss24Regular className="w-3 h-3" />;
      default:
        return <Clock24Regular className="w-3 h-3" />;
    }
  };

  const statusLabel = t.deals?.status?.[deal.status.toLowerCase() as keyof typeof t.deals.status] || deal.status;
  const staggerClass = `stagger-${Math.min(index + 1, 10)}`;

  return (
    <div className={`animate-deal-card-enter ${staggerClass} ${deal.isActive === false ? 'opacity-70' : ''}`}>
      <Link href={`/deals/${deal.id}`}>
        <div className={`group relative bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden hover:bg-th-surface hover:border-white/20 hover:shadow-lg ${hoverGlow} hover:scale-[1.01] transition-all duration-200`}>
          {/* Left accent bar */}
          <div className={`absolute inset-y-0 start-0 w-1 bg-gradient-to-b ${accentGradient}`} />

          <div className="p-4 ps-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-th-text truncate">
                    {deal.title || deal.productName || deal.solutionType || (t.deals?.untitledDeal || 'Untitled Deal')}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    isSell
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}>
                    {deal.mode === 'SELL' ? (t.deals?.sell || 'Sell') : (t.deals?.buy || 'Buy')}
                  </span>
                  {deal.isActive === false && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-white/[0.03]0/20 text-white/60 border-neutral-500/30">
                      {t.common?.archived || 'Archived'}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-th-text-t line-clamp-2 mb-3">
                  {deal.mode === 'SELL'
                    ? deal.targetDescription || deal.domain
                    : deal.problemStatement || deal.domain}
                </p>

                {/* Tags Row */}
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-blue-500/20 text-blue-300 border-blue-500/30">
                    {getStatusIcon(deal.status)}
                    {statusLabel}
                  </span>
                  {deal.domain && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {deal.domain}
                    </span>
                  )}
                  {deal.solutionType && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {deal.solutionType}
                    </span>
                  )}
                </div>
              </div>

              {/* Match Count & Actions */}
              <div className="flex flex-col items-end gap-2">
                {deal.matchCount > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                    <People24Regular className="w-3 h-3" />
                    {deal.matchCount} {t.deals?.matches || 'matches'}
                  </div>
                )}
                <CardMenu
                  onEdit={() => onEdit(deal.id)}
                  onDelete={() => onDelete(deal.id)}
                  onArchive={() => onArchive(deal.id)}
                  isArchived={deal.isActive === false}
                />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

/**
 * Team Deal Card Component
 */
function TeamDealCard({ deal }: { deal: TeamDeal }) {
  const { t } = useI18n();
  const isSell = deal.mode === 'SELL';

  return (
    <Link href={`/deals/${deal.id}`}>
      <div className="group relative bg-th-surface backdrop-blur-sm border border-th-border rounded-xl overflow-hidden hover:bg-th-surface hover:border-white/20 transition-all duration-200">
        <div className={`absolute inset-y-0 start-0 w-1 bg-gradient-to-b ${isSell ? 'from-emerald-500 to-green-400' : 'from-blue-500 to-cyan-400'}`} />
        <div className="p-4 ps-5">
          <div className="flex items-start gap-3">
            <Avatar name={deal.user.fullName} src={deal.user.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-th-text truncate">
                  {deal.title || deal.productName || deal.solutionType || (t.deals?.untitledDeal || 'Untitled Deal')}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  isSell
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  {deal.mode === 'SELL' ? (t.deals?.sell || 'Sell') : (t.deals?.buy || 'Buy')}
                </span>
              </div>
              <p className="text-sm text-th-text-t line-clamp-2 mb-2">
                {deal.mode === 'SELL' ? deal.targetDescription || deal.domain : deal.problemStatement || deal.domain}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-th-text-m">{deal.user.fullName}</span>
                {deal.matchCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                    <People24Regular className="w-3 h-3" />
                    {deal.matchCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DealsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const organization = useOrganizationStore((s) => s.organization);
  const isTeamPlan = organization !== null;
  const [deals, setDeals] = useState<Deal[]>([]);
  const [teamDeals, setTeamDeals] = useState<TeamDeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<DealMode | 'ALL'>('ALL');
  const [showTeam, setShowTeam] = useState(false);
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  useEffect(() => {
    if (showTeam) {
      fetchTeamDeals();
    } else {
      fetchDeals();
    }
  }, [modeFilter, showTeam]);

  const fetchDeals = async () => {
    setIsLoading(true);
    try {
      const params: { mode?: DealMode; limit?: number } = { limit: 50 };
      if (modeFilter !== 'ALL') {
        params.mode = modeFilter;
      }
      const data = await getDeals(params);
      setDeals(data.deals);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamDeals = async () => {
    if (!organization) return;
    setIsLoading(true);
    try {
      const data = await getTeamDeals(organization.id, { limit: 50 });
      setTeamDeals(data.deals);
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
      await deleteDeal(deleteTarget);
      setDeals((prev) => prev.filter((d) => d.id !== deleteTarget));
      toast({ title: t.deals?.deleted || 'Deal deleted', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/deals/${id}`);
  };

  const handleArchive = async (id: string) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;
    const newIsActive = deal.isActive === false ? true : false;
    try {
      await archiveDeal(id, newIsActive);
      setDeals((prev) => prev.map((d) => d.id === id ? { ...d, isActive: newIsActive } : d));
      toast({ title: newIsActive ? (t.deals?.dealUnarchived || 'Deal unarchived') : (t.deals?.dealArchived || 'Deal archived'), variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    }
  };

  const activeDeals = deals.filter((d) => d.isActive !== false);
  const archivedDeals = deals.filter((d) => d.isActive === false);

  const filteredDeals = (tab === 'active' ? activeDeals : archivedDeals).filter((d) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      d.title?.toLowerCase().includes(query) ||
      d.productName?.toLowerCase().includes(query) ||
      d.solutionType?.toLowerCase().includes(query) ||
      d.domain?.toLowerCase().includes(query)
    );
  });

  const sellCount = activeDeals.filter((d) => d.mode === 'SELL').length;
  const buyCount = activeDeals.filter((d) => d.mode === 'BUY').length;

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header with glow orbs */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900/30 via-th-bg-s to-emerald-900/20 border border-th-border p-6">
        {/* Glow orbs */}
        <div className="absolute -top-10 -end-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -start-10 w-32 h-32 bg-emerald-500/15 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-th-text">{t.deals?.title || 'Deal Matching'}</h1>
            <Link
              href="/deals/new"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-105 transition-all"
            >
              <Add24Regular className="w-4 h-4" />
              {t.deals?.newDeal || 'New Deal'}
            </Link>
          </div>
          <p className="text-sm text-th-text-t mt-1">{t.deals?.subtitle || 'Find the right people in your network'}</p>
        </div>
      </div>

      {/* Active/Archived Tabs */}
      {!showTeam && (
        <div className="flex items-center gap-1 bg-th-surface rounded-lg p-1 w-fit">
          <button onClick={() => setTab('active')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-emerald-600 text-white' : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'}`}>
            <Briefcase24Regular className="w-4 h-4" />
            {t.common?.all || 'All'}
            {activeDeals.length > 0 && <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'active' ? 'bg-white/20' : 'bg-th-surface-h'}`}>{activeDeals.length}</span>}
          </button>
          <button onClick={() => setTab('archived')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'archived' ? 'bg-emerald-600 text-white' : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'}`}>
            <Archive24Regular className="w-4 h-4" />
            {t.common?.archived || 'Archived'}
            {archivedDeals.length > 0 && <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'archived' ? 'bg-white/20' : 'bg-th-surface-h'}`}>{archivedDeals.length}</span>}
          </button>
        </div>
      )}

      {/* Stats Row */}
      {tab === 'active' && (
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-th-surface border border-th-border rounded-xl p-3 text-center">
          <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
            {activeDeals.length}
          </div>
          <div className="text-xs text-th-text-m mt-0.5">{t.deals?.totalDeals || 'Total'}</div>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-3 text-center">
          <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-green-400">
            {sellCount}
          </div>
          <div className="text-xs text-th-text-m mt-0.5">{t.deals?.sell || 'Selling'}</div>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-3 text-center">
          <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
            {buyCount}
          </div>
          <div className="text-xs text-th-text-m mt-0.5">{t.deals?.buy || 'Buying'}</div>
        </div>
      </div>
      )}

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
          <Search24Regular className="w-5 h-5 text-th-text-m" />
        </div>
        <input
          type="text"
          placeholder={t.deals?.searchPlaceholder || 'Search deals...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
        />
      </div>

      {/* Team Toggle */}
      {isTeamPlan && (
        <div className="flex gap-2">
          <button
            onClick={() => setShowTeam(false)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              !showTeam
                ? 'bg-th-surface-h border-white/20 text-th-text'
                : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
            }`}
          >
            <Briefcase24Regular className="w-4 h-4" />
            {t.deals?.myDeals || 'My Deals'}
          </button>
          <button
            onClick={() => setShowTeam(true)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              showTeam
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-th-surface border-th-border text-th-text-t hover:bg-th-surface-h'
            }`}
          >
            <PeopleTeam24Regular className="w-4 h-4" />
            {t.organization?.teamDeals || 'Team Deals'}
          </button>
        </div>
      )}

      {/* Mode Toggle */}
      {!showTeam && tab === 'active' && <ModeToggle mode={modeFilter} onChange={setModeFilter} />}

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

      {/* Content - My Deals */}
      {!showTeam && !isLoading && filteredDeals.length > 0 && (
        <div className="space-y-3">
          {filteredDeals.map((deal, index) => (
            <DealCard key={deal.id} deal={deal} onEdit={handleEdit} onDelete={handleDeleteRequest} onArchive={handleArchive} index={index} />
          ))}
        </div>
      )}

      {/* Content - Team Deals */}
      {showTeam && !isLoading && teamDeals.length > 0 && (
        <div className="space-y-3">
          {teamDeals.map((deal) => (
            <TeamDealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}

      {/* Empty State - Team */}
      {showTeam && !isLoading && teamDeals.length === 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900/20 via-th-bg-s/50 to-emerald-900/20 backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          <div className="relative">
            <PeopleTeam24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
            <p className="text-th-text-s text-lg font-medium">{t.organization?.noTeamDeals || 'No team deals yet'}</p>
            <p className="text-sm text-th-text-m mt-1">
              {t.organization?.shareDealHint || 'Share your deals with your team from the deal detail page'}
            </p>
          </div>
        </div>
      )}

      {/* Empty State - My Deals */}
      {!showTeam && !isLoading && filteredDeals.length === 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900/20 via-th-bg-s/50 to-emerald-900/20 backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          {/* Glow orb */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />

          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Briefcase24Regular className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-th-text-s text-lg font-medium">{t.deals?.noDeals || 'No deals yet'}</p>
            <p className="text-sm text-th-text-m mt-1">
              {searchQuery
                ? (t.common?.tryAgain || 'Try a different search')
                : (t.deals?.createFirst || 'Create your first deal to find matches in your network')}
            </p>
            {!searchQuery && (
              <Link
                href="/deals/new"
                className="inline-flex items-center gap-2 mt-5 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-105 transition-all"
              >
                <Add24Regular className="w-5 h-5" />
                {t.deals?.createDeal || 'Create Deal'}
              </Link>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={t.deals?.deleteDealTitle || 'Delete Deal'}
        message={t.deals?.deleteDealMessage || 'Are you sure you want to delete this deal? This action cannot be undone and all associated matches will be removed.'}
        confirmLabel={t.common?.delete || 'Delete'}
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
