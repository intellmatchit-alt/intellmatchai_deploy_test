'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/hooks/useOrganization';
import { organizationApi, WarmIntroRequest } from '@/lib/api/organization';
import {
  ArrowLeft24Regular,
  Send24Regular,
  MailInbox24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  Clock24Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  ArrowCircleRight24Regular,
} from '@fluentui/react-icons';

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  PENDING: { color: 'text-emerald-400 bg-emerald-500/20', icon: Clock24Regular },
  APPROVED: { color: 'text-blue-400 bg-blue-500/20', icon: ArrowCircleRight24Regular },
  COMPLETED: { color: 'text-green-400 bg-green-500/20', icon: CheckmarkCircle24Regular },
  DECLINED: { color: 'text-red-400 bg-red-500/20', icon: DismissCircle24Regular },
  CANCELLED: { color: 'text-th-text-t bg-white/[0.03]0/20', icon: DismissCircle24Regular },
};

export default function WarmIntrosPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { organization } = useOrganization();

  const [tab, setTab] = useState<'sent' | 'received'>('received');
  const [sent, setSent] = useState<WarmIntroRequest[]>([]);
  const [received, setReceived] = useState<WarmIntroRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; pending: number; completed: number } | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadData = async () => {
    if (!organization) return;
    setLoading(true);
    try {
      const [sentData, receivedData, statsData] = await Promise.all([
        organizationApi.getSentIntros(organization.id),
        organizationApi.getReceivedIntros(organization.id),
        organizationApi.getIntroStats(organization.id),
      ]);
      setSent(sentData);
      setReceived(receivedData);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [organization]);

  const handleRespond = async (introId: string, status: string) => {
    if (!organization) return;
    setRespondingId(introId);
    try {
      await organizationApi.respondToIntro(organization.id, introId, { status });
      await loadData();
    } catch (err) {
      console.error(err);
    }
    setRespondingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const currentList = tab === 'sent' ? sent : received;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.organization?.warmIntros || 'Warm Intros'}</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-th-surface border border-th-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-th-text">{stats.total}</p>
            <p className="text-xs text-th-text-m">{t.organization?.totalIntros || 'Total'}</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.pending}</p>
            <p className="text-xs text-th-text-m">{t.organization?.pendingIntros || 'Pending'}</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
            <p className="text-xs text-th-text-m">{t.organization?.completedIntros || 'Completed'}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-th-surface rounded-xl p-1">
        <button
          onClick={() => setTab('received')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'received' ? 'bg-emerald-500 text-white' : 'text-th-text-t hover:text-white'
          }`}
        >
          <MailInbox24Regular className="w-4 h-4" />
          {t.organization?.received || 'Received'} ({received.length})
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'sent' ? 'bg-emerald-500 text-white' : 'text-th-text-t hover:text-white'
          }`}
        >
          <Send24Regular className="w-4 h-4" />
          {t.organization?.sent || 'Sent'} ({sent.length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : currentList.length === 0 ? (
        <div className="text-center py-12 text-th-text-m">
          <p>{tab === 'sent' ? (t.organization?.noSentIntros || 'No intro requests sent yet') : (t.organization?.noReceivedIntros || 'No intro requests to handle')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((intro, index) => {
            const statusConf = STATUS_CONFIG[intro.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = statusConf.icon;
            const person = tab === 'sent' ? intro.connector : intro.requester;
            return (
              <div
                key={intro.id}
                className="bg-th-surface border border-th-border rounded-xl p-4"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Top row: status + date */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConf.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {intro.status}
                  </div>
                  <span className="text-xs text-white/70">{formatDate(intro.createdAt)}</span>
                </div>

                {/* People involved */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs font-medium">
                      {person?.fullName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-th-text">{person?.fullName}</p>
                      <p className="text-xs text-th-text-m">{tab === 'sent' ? 'Connector' : 'Requester'}</p>
                    </div>
                  </div>
                  <div className="text-white/70">&rarr;</div>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-xs font-medium">
                      {intro.targetContact?.fullName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-th-text">{intro.targetContact?.fullName}</p>
                      <p className="text-xs text-th-text-m">{intro.targetContact?.company || intro.targetContact?.jobTitle || 'Contact'}</p>
                    </div>
                  </div>
                </div>

                {/* Message */}
                {intro.message && (
                  <p className="text-sm text-th-text-t bg-th-surface rounded-lg p-3 mb-3">&ldquo;{intro.message}&rdquo;</p>
                )}

                {/* Actions for received + pending */}
                {tab === 'received' && intro.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond(intro.id, 'APPROVED')}
                      disabled={respondingId === intro.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      <Checkmark24Regular className="w-4 h-4" />
                      {t.organization?.approve || 'Approve'}
                    </button>
                    <button
                      onClick={() => handleRespond(intro.id, 'DECLINED')}
                      disabled={respondingId === intro.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      <Dismiss24Regular className="w-4 h-4" />
                      {t.organization?.decline || 'Decline'}
                    </button>
                  </div>
                )}

                {/* Complete button for approved intros */}
                {tab === 'received' && intro.status === 'APPROVED' && (
                  <button
                    onClick={() => handleRespond(intro.id, 'COMPLETED')}
                    disabled={respondingId === intro.id}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                  >
                    <CheckmarkCircle24Regular className="w-4 h-4" />
                    {t.organization?.markComplete || 'Mark as Completed'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
