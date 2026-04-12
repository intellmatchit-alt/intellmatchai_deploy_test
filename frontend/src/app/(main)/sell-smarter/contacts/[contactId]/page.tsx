/**
 * Sell Smarter Contact Detail Page
 *
 * Displays detailed match result for a specific contact.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Checkmark24Regular,
  Bookmark24Regular,
  BookmarkFilled,
  Dismiss24Regular,
  Copy24Regular,
  Edit24Regular,
  Mail24Regular,
  Phone24Regular,
  Globe24Regular,
  Chat24Regular,
  Person24Regular,
  Building24Regular,
} from '@fluentui/react-icons';
import {
  getContactMatchDetail,
  updateMatchResult,
  ContactDetailResponse,
  ProductMatchBadge,
  getBadgeLabel,
  getBadgeColor,
  getScoreColor,
  getScoreBarColor,
  getExplanationTypeLabel,
} from '@/lib/api/productMatch';
import { toast } from '@/components/ui/Toast';

/**
 * Score Breakdown Bar
 */
function ScoreBreakdownBar({
  label,
  score,
  weight,
  weighted,
}: {
  label: string;
  score: number;
  weight: number;
  weighted: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-th-text-t">{label}</span>
        <span className="text-th-text font-medium">
          {score.toFixed(0)} <span className="text-th-text-m">({(weight * 100).toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-2 bg-th-surface-h rounded-full overflow-hidden">
        <div
          className={`h-full ${score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-white/[0.03]0'} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const contactId = params.contactId as string;
  const runId = searchParams.get('runId');

  const [data, setData] = useState<ContactDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!runId) {
      router.push('/sell-smarter');
      return;
    }
    fetchData();
  }, [contactId, runId]);

  const fetchData = async () => {
    if (!runId) return;

    setIsLoading(true);
    try {
      const detail = await getContactMatchDetail(contactId, runId);
      setData(detail);
      setEditedMessage(detail.result.openerEdited || detail.result.openerMessage || '');
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (saved: boolean) => {
    if (!data) return;

    try {
      const updated = await updateMatchResult(data.result.id, { isSaved: saved });
      setData((prev) => prev ? { ...prev, result: { ...prev.result, isSaved: saved, isDismissed: false } } : null);
      toast({
        title: saved ? (t.sellSmarter?.savedToList || 'Saved') : (t.sellSmarter?.removedFromList || 'Removed'),
        variant: 'success',
      });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    }
  };

  const handleDismiss = async () => {
    if (!data) return;

    try {
      await updateMatchResult(data.result.id, { isDismissed: true });
      setData((prev) => prev ? { ...prev, result: { ...prev.result, isDismissed: true, isSaved: false } } : null);
      toast({ title: t.sellSmarter?.dismissed || 'Dismissed', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    }
  };

  const handleMarkContacted = async () => {
    if (!data) return;

    try {
      await updateMatchResult(data.result.id, { isContacted: true });
      setData((prev) => prev ? { ...prev, result: { ...prev.result, isContacted: true } } : null);
      toast({ title: t.sellSmarter?.markedContacted || 'Marked as contacted', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    }
  };

  const handleSaveMessage = async () => {
    if (!data) return;

    try {
      await updateMatchResult(data.result.id, { openerEdited: editedMessage });
      setData((prev) => prev ? { ...prev, result: { ...prev.result, openerEdited: editedMessage } } : null);
      setIsEditing(false);
      toast({ title: t.sellSmarter?.messageSaved || 'Message saved', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    }
  };

  const handleCopy = async () => {
    const message = data?.result.openerEdited || data?.result.openerMessage;
    if (message) {
      await navigator.clipboard.writeText(message);
      setIsCopied(true);
      toast({ title: t.sellSmarter?.messageCopied || 'Message copied', variant: 'success' });
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in pb-20">
        <div className="h-8 bg-th-surface-h rounded w-48 animate-pulse" />
        <div className="h-24 bg-th-surface border border-th-border rounded-xl animate-pulse" />
        <div className="h-40 bg-th-surface border border-th-border rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 animate-fade-in pb-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ms-2 hover:bg-th-surface-h rounded-lg transition-colors">
            <ArrowLeft24Regular className="w-5 h-5 text-th-text-t" />
          </button>
          <h1 className="text-xl font-bold text-th-text">{t.common?.error || 'Error'}</h1>
        </div>
        <p className="text-th-text-t">{t.sellSmarter?.contactNotFound || 'Contact not found'}</p>
      </div>
    );
  }

  const { result, contact } = data;
  const breakdown = result.breakdownJson;

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ms-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t" />
        </button>
        <h1 className="text-xl font-bold text-th-text">{t.sellSmarter?.matchDetail || 'Match Detail'}</h1>
      </div>

      {/* Contact Header */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xl font-semibold flex-shrink-0">
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(contact.fullName)
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-th-text truncate">{contact.fullName}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getBadgeColor(result.badge)}`}>
                {getBadgeLabel(result.badge)}
              </span>
            </div>

            {contact.jobTitle && (
              <p className="text-sm text-th-text-s flex items-center gap-1">
                <Person24Regular className="w-4 h-4 text-th-text-m" />
                {contact.jobTitle}
              </p>
            )}

            {contact.company && (
              <p className="text-sm text-th-text-t flex items-center gap-1 mt-0.5">
                <Building24Regular className="w-4 h-4 text-th-text-m" />
                {contact.company}
              </p>
            )}

            {/* Contact Info */}
            <div className="flex flex-wrap gap-3 mt-3">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                  <Mail24Regular className="w-3 h-3" />
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                  <Phone24Regular className="w-3 h-3" />
                  {contact.phone}
                </a>
              )}
              {contact.linkedinUrl && (
                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                  <Globe24Regular className="w-3 h-3" />
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Match Analysis Section */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-th-text-t mb-3">{t.sellSmarter?.matchAnalysis || 'Match Analysis'}</h3>

        {/* Match Categories */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-th-surface rounded-lg p-3">
            <div className="text-xs text-th-text-m mb-1">{t.sellSmarter?.decisionPower || 'Decision Power'}</div>
            <div className="text-sm font-medium text-th-text">{breakdown.decisionPower.score >= 70 ? 'High' : breakdown.decisionPower.score >= 40 ? 'Medium' : 'Low'}</div>
          </div>
          <div className="bg-th-surface rounded-lg p-3">
            <div className="text-xs text-th-text-m mb-1">{t.sellSmarter?.companyFit || 'Company Fit'}</div>
            <div className="text-sm font-medium text-th-text">{breakdown.companyFit.score >= 70 ? 'Strong' : breakdown.companyFit.score >= 40 ? 'Moderate' : 'Weak'}</div>
          </div>
          <div className="bg-th-surface rounded-lg p-3">
            <div className="text-xs text-th-text-m mb-1">{t.sellSmarter?.roleContext || 'Role Context'}</div>
            <div className="text-sm font-medium text-th-text">{breakdown.roleContext.score >= 70 ? 'Relevant' : breakdown.roleContext.score >= 40 ? 'Partial' : 'Limited'}</div>
          </div>
          <div className="bg-th-surface rounded-lg p-3">
            <div className="text-xs text-th-text-m mb-1">{t.sellSmarter?.relationship || 'Relationship'}</div>
            <div className="text-sm font-medium text-th-text">{breakdown.additional.score >= 70 ? 'Strong' : breakdown.additional.score >= 40 ? 'Developing' : 'New'}</div>
          </div>
        </div>
      </div>

      {/* Why This Match */}
      {result.explanationJson.length > 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-th-text-t mb-3">{t.sellSmarter?.whyMatch || 'Why This Match'}</h3>
          <div className="space-y-2">
            {result.explanationJson.map((exp, i) => (
              <div key={i} className="flex items-start gap-2">
                <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm text-th-text">{exp.text}</span>
                  <span className="text-xs text-th-text-m ms-2">({getExplanationTypeLabel(exp.type)})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Approach */}
      {result.talkAngle && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <h3 className="text-sm font-medium text-emerald-300 mb-2">{t.sellSmarter?.suggestedApproach || 'Suggested Approach'}</h3>
          <p className="text-sm text-emerald-200">{result.talkAngle}</p>
        </div>
      )}

      {/* Opener Message */}
      {(result.openerMessage || result.openerEdited) && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-th-text-t">{t.sellSmarter?.openerMessage || 'Opener Message'}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Edit24Regular className="w-3 h-3" />
                {isEditing ? (t.common?.cancel || 'Cancel') : (t.common?.edit || 'Edit')}
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Copy24Regular className="w-3 h-3" />
                {isCopied ? (t.sellSmarter?.copied || 'Copied!') : (t.sellSmarter?.copy || 'Copy')}
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none"
              />
              <button
                onClick={handleSaveMessage}
                className="w-full py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-all"
              >
                {t.sellSmarter?.saveMessage || 'Save Message'}
              </button>
            </div>
          ) : (
            <div className="bg-th-surface rounded-lg p-3 text-sm text-th-text-s whitespace-pre-wrap">
              {result.openerEdited || result.openerMessage}
            </div>
          )}
        </div>
      )}

      {/* Sectors & Skills */}
      {(contact.sectors.length > 0 || contact.skills.length > 0) && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          {contact.sectors.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs text-th-text-m mb-2">{t.sellSmarter?.sectors || 'Sectors'}</h4>
              <div className="flex flex-wrap gap-1">
                {contact.sectors.map((sector, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          )}
          {contact.skills.length > 0 && (
            <div>
              <h4 className="text-xs text-th-text-m mb-2">{t.sellSmarter?.skills || 'Skills'}</h4>
              <div className="flex flex-wrap gap-1">
                {contact.skills.map((skill, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-th-surface-h text-th-text-s border border-th-border">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleSave(!result.isSaved)}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
            result.isSaved
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              : 'bg-th-surface text-th-text border border-th-border hover:bg-th-surface-h'
          }`}
        >
          {result.isSaved ? (
            <BookmarkFilled className="w-5 h-5" />
          ) : (
            <Bookmark24Regular className="w-5 h-5" />
          )}
          {result.isSaved ? (t.sellSmarter?.saved || 'Saved') : (t.sellSmarter?.save || 'Save')}
        </button>

        {!result.isContacted && (
          <button
            onClick={handleMarkContacted}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-all"
          >
            <Chat24Regular className="w-5 h-5" />
            {t.sellSmarter?.markContacted || 'Mark Contacted'}
          </button>
        )}

        {result.isContacted && (
          <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <Checkmark24Regular className="w-5 h-5" />
            {t.sellSmarter?.contacted || 'Contacted'}
          </div>
        )}
      </div>

      {!result.isDismissed && (
        <button
          onClick={handleDismiss}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium bg-th-surface text-th-text-t border border-th-border hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
        >
          <Dismiss24Regular className="w-5 h-5" />
          {t.sellSmarter?.dismiss || 'Dismiss'}
        </button>
      )}

      {/* View Contact Link */}
      <Link
        href={`/contacts/${contactId}`}
        className="block w-full text-center py-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        {t.sellSmarter?.viewFullProfile || 'View Full Contact Profile'}
      </Link>
    </div>
  );
}
