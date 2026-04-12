/**
 * Collaborations Inbox Page
 *
 * View and manage received collaboration requests.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  Search24Regular,
  Mail24Regular,
  Target24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  Clock24Regular,
  ArrowRight24Regular,
  People24Regular,
  Settings24Regular,
  Mic24Regular,
  Play24Regular,
  Stop24Regular,
} from '@fluentui/react-icons';
import {
  listReceivedRequests,
  acceptCollaborationRequest,
  rejectCollaborationRequest,
  CollaborationRequest,
  CollaborationRequestStatus,
  getSourceTypeLabel,
  getSourceTypeColor,
  getRequestStatusLabel,
  getRequestStatusColor,
  formatRelativeTime,
} from '@/lib/api/collaboration';
import { toast } from '@/components/ui/Toast';

/**
 * Request Card Component
 */
function VoicePlayer({ url }: { url: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPlaying) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    }
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-full text-xs text-emerald-300 hover:bg-emerald-500/25 transition-colors"
    >
      {isPlaying ? <Stop24Regular className="w-3 h-3" /> : <Play24Regular className="w-3 h-3" />}
      <Mic24Regular className="w-3 h-3" />
      {isPlaying ? 'Playing...' : 'Voice Message'}
    </button>
  );
}

/**
 * Confirmation Dialog Component
 */
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmColor,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-th-surface border border-th-border rounded-xl p-4 max-w-[260px] w-full shadow-2xl">
        <h3 className="text-sm font-semibold text-th-text mb-1">{title}</h3>
        <p className="text-xs text-th-text-t mb-3">{message}</p>
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 ${confirmColor}`}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestCard({
  request,
  onStatusChange,
}: {
  request: CollaborationRequest;
  onStatusChange: (id: string, status: CollaborationRequestStatus) => void;
}) {
  const { t } = useI18n();
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'accept' | 'reject' | null>(null);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await acceptCollaborationRequest(request.id);
      onStatusChange(request.id, 'ACCEPTED');
      toast({ title: t.collaborations?.accepted || 'Request accepted', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsProcessing(false);
      setConfirmAction(null);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await rejectCollaborationRequest(request.id);
      onStatusChange(request.id, 'REJECTED');
      toast({ title: t.collaborations?.rejected || 'Request rejected', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsProcessing(false);
      setConfirmAction(null);
    }
  };

  return (
    <Link href={`/collaborations/${request.id}`}>
      <div className="group bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
              {request.fromUser?.fullName?.charAt(0) || '?'}
            </div>

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-th-text truncate">
                  {request.fromUser?.fullName || 'Unknown User'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getRequestStatusColor(request.status)}`}>
                  {getRequestStatusLabel(request.status)}
                </span>
              </div>

              {/* Source feature info */}
              {request.sourceFeature && (
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Target24Regular className="w-4 h-4 text-th-text-m" />
                    <span className="text-sm text-neutral-200 font-medium truncate">{request.sourceFeature.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${getSourceTypeColor(request.sourceType)}`}>
                      {getSourceTypeLabel(request.sourceType)}
                    </span>
                  </div>
                  {request.sourceFeature.description && (
                    <p className="text-xs text-th-text-t line-clamp-2 ms-6">{request.sourceFeature.description}</p>
                  )}
                  {/* Criteria tags */}
                  {request.sourceFeature.criteria && (
                    <div className="flex flex-wrap gap-1 mt-1.5 ms-6">
                      {request.sourceFeature.criteria.sectors?.slice(0, 3).map((s: string, i: number) => (
                        <span key={`s-${i}`} className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                          {s}
                        </span>
                      ))}
                      {request.sourceFeature.criteria.skills?.slice(0, 3).map((s: string, i: number) => (
                        <span key={`sk-${i}`} className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                          {s}
                        </span>
                      ))}
                      {request.sourceFeature.criteria.keywords?.slice(0, 2).map((k: string, i: number) => (
                        <span key={`k-${i}`} className="px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/20">
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Message preview */}
              {request.message && (
                <p className="text-sm text-th-text-t line-clamp-2 mb-2">{request.message}</p>
              )}

              {/* Voice message */}
              {request.voiceMessageUrl && (
                <div className="mb-2">
                  <VoicePlayer url={request.voiceMessageUrl} />
                </div>
              )}

              {/* Time */}
              <div className="flex items-center gap-1 text-xs text-th-text-m">
                <Clock24Regular className="w-3 h-3" />
                {formatRelativeTime(request.createdAt)}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-2">
            {request.status === 'PENDING' && (
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmAction('accept'); }}
                  disabled={isProcessing}
                  className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  title={t.collaborations?.accept || 'Accept'}
                >
                  <Checkmark24Regular className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmAction('reject'); }}
                  disabled={isProcessing}
                  className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  title={t.collaborations?.reject || 'Reject'}
                >
                  <Dismiss24Regular className="w-5 h-5" />
                </button>
              </div>
            )}
            {(request.status === 'ACCEPTED' || request.status === 'COMPLETED') && (
              <div className="flex items-center gap-1 text-emerald-400">
                <span className="text-sm">{t.collaborations?.viewSession || 'View'}</span>
                <ArrowRight24Regular className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Accept Confirmation */}
      <ConfirmDialog
        open={confirmAction === 'accept'}
        title={t.collaborations?.confirmAcceptTitle || 'Accept Request'}
        message={t.collaborations?.confirmAcceptMessage || `Accept collaboration request from ${request.fromUser?.fullName || 'this user'}?`}
        confirmLabel={t.common?.accept || 'Accept'}
        cancelLabel={t.common?.cancel || 'Cancel'}
        confirmColor="bg-emerald-500 hover:bg-emerald-600"
        onConfirm={handleAccept}
        onCancel={() => setConfirmAction(null)}
        loading={isProcessing}
      />

      {/* Reject Confirmation */}
      <ConfirmDialog
        open={confirmAction === 'reject'}
        title={t.collaborations?.confirmRejectTitle || 'Decline Request'}
        message={t.collaborations?.confirmRejectMessage || `Are you sure you want to decline the request from ${request.fromUser?.fullName || 'this user'}?`}
        confirmLabel={t.common?.decline || 'Decline'}
        cancelLabel={t.common?.cancel || 'Cancel'}
        confirmColor="bg-red-500 hover:bg-red-600"
        onConfirm={handleReject}
        onCancel={() => setConfirmAction(null)}
        loading={isProcessing}
      />
    </Link>
  );
}

type StatusFilter = 'all' | CollaborationRequestStatus;

export default function CollaborationsInboxPage() {
  const { t } = useI18n();
  const [requests, setRequests] = useState<CollaborationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch requests
  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const params: { status?: CollaborationRequestStatus } = {};
      if (statusFilter !== 'all') params.status = statusFilter;

      const data = await listReceivedRequests({ ...params, limit: 50 });
      setRequests(data.requests);
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (id: string, status: CollaborationRequestStatus) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const filteredRequests = requests.filter((r) => {
    const matchesSearch = !searchQuery ||
      r.fromUser?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sourceTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.message && r.message.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const statusTabs = [
    { id: 'all' as const, label: t.collaborations?.all || 'All' },
    { id: 'PENDING' as const, label: t.collaborations?.pending || 'Pending' },
    { id: 'ACCEPTED' as const, label: t.collaborations?.accepted || 'Accepted' },
    { id: 'COMPLETED' as const, label: t.collaborations?.completed || 'Completed' },
  ];

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-th-text">{t.collaborations?.inbox || 'Collaboration Inbox'}</h1>
        {pendingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500 text-white font-medium">
            {pendingCount}
          </span>
        )}
        <Link
          href="/settings/collaboration"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-th-surface border border-th-border text-th-text-s text-sm font-medium rounded-lg hover:bg-th-surface-h hover:text-th-text transition-all"
          title={t.collaborations?.settings || 'Settings'}
        >
          <Settings24Regular className="w-4 h-4" />
          {t.collaborations?.settings || 'Settings'}
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
          <Search24Regular className="w-5 h-5 text-th-text-m" />
        </div>
        <input
          type="text"
          placeholder={t.collaborations?.searchPlaceholder || 'Search requests...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
        />
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 p-1 bg-th-surface rounded-xl">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === tab.id
                ? 'bg-th-surface-h text-th-text'
                : 'text-th-text-t hover:text-th-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-th-surface border border-th-border rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-th-surface-h" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-th-surface-h rounded w-1/3" />
                  <div className="h-4 bg-th-surface-h rounded w-2/3" />
                  <div className="h-4 bg-th-surface-h rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && filteredRequests.length > 0 && (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredRequests.length === 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-12 text-center">
          <Mail24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-th-text-t text-lg">{t.collaborations?.noRequests || 'No collaboration requests'}</p>
          <p className="text-sm text-th-text-m mt-1">
            {searchQuery
              ? (t.common?.tryAgain || 'Try a different search')
              : (t.collaborations?.noRequestsDesc || 'When someone sends you a collaboration request, it will appear here')}
          </p>
        </div>
      )}
    </div>
  );
}
