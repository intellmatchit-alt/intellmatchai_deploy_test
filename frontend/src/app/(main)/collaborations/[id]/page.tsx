/**
 * Collaboration Session Page
 *
 * View collaboration request details, run matching, and manage introductions.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  Target24Regular,
  Sparkle24Regular,
  People24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  Clock24Regular,
  ArrowSync24Regular,
  PersonAdd24Regular,
  Send24Regular,
  Info24Regular,
  ChevronRight24Regular,
  Mic24Regular,
  Play24Regular,
  Stop24Regular,
} from '@fluentui/react-icons';
import {
  getCollaborationRequest,
  getSessionStatus,
  runMatching,
  getMatchResults,
  createIntroduction,
  completeIntroduction,
  declineIntroduction,
  getIntroductions,
  CollaborationRequest,
  CollaborationSession,
  CollaborationMatchResult,
  Introduction,
  getSourceTypeLabel,
  getSourceTypeColor,
  getRequestStatusLabel,
  getRequestStatusColor,
  getSessionStatusLabel,
  getSessionStatusColor,
  getIntroductionStatusLabel,
  getIntroductionStatusColor,
  getMatchReasonTypeLabel,
  formatRelativeTime,
  getInitials,
} from '@/lib/api/collaboration';
import { toast } from '@/components/ui/Toast';

// ============================================================================
// Voice Player Component
// ============================================================================

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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full text-sm text-emerald-300 hover:bg-emerald-500/25 transition-colors"
    >
      {isPlaying ? <Stop24Regular className="w-4 h-4" /> : <Play24Regular className="w-4 h-4" />}
      <Mic24Regular className="w-4 h-4" />
      {isPlaying ? 'Playing...' : 'Voice Message'}
    </button>
  );
}

// ============================================================================
// Match Strength Helpers
// ============================================================================

type MatchStrength = 'excellent' | 'veryGood' | 'good' | 'partial' | 'weak';

function getMatchStrength(score: number): MatchStrength {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'veryGood';
  if (score >= 60) return 'good';
  if (score >= 40) return 'partial';
  return 'weak';
}

function getMatchStrengthStyle(strength: MatchStrength): { bg: string; text: string; border: string; color: string } {
  switch (strength) {
    case 'excellent':
      return { bg: 'bg-[#22C55E]/20', text: 'text-[#22C55E]', border: 'border-[#22C55E]/30', color: '#22C55E' };
    case 'veryGood':
      return { bg: 'bg-[#84CC16]/20', text: 'text-[#84CC16]', border: 'border-[#84CC16]/30', color: '#84CC16' };
    case 'good':
      return { bg: 'bg-[#FACC15]/20', text: 'text-[#FACC15]', border: 'border-[#FACC15]/30', color: '#FACC15' };
    case 'partial':
      return { bg: 'bg-[#FB923C]/20', text: 'text-[#FB923C]', border: 'border-[#FB923C]/30', color: '#FB923C' };
    case 'weak':
      return { bg: 'bg-[#EF4444]/20', text: 'text-[#EF4444]', border: 'border-[#EF4444]/30', color: '#EF4444' };
  }
}

function getMatchStrengthLabel(strength: MatchStrength, t: any): string {
  switch (strength) {
    case 'excellent': return t.collaborations?.excellent || 'Excellent';
    case 'veryGood': return t.collaborations?.veryGood || 'Very Good';
    case 'good': return t.collaborations?.good || 'Good';
    case 'partial': return t.collaborations?.partial || 'Partial';
    case 'weak': return t.collaborations?.weak || 'Weak';
  }
}

function getMatchStrengthFullLabel(strength: MatchStrength, t: any): string {
  switch (strength) {
    case 'excellent': return t.collaborations?.excellentMatch || 'Excellent Match';
    case 'veryGood': return t.collaborations?.veryGoodMatch || 'Very Good Match';
    case 'good': return t.collaborations?.goodMatch || 'Good Match';
    case 'partial': return t.collaborations?.partialMatch || 'Partial Match';
    case 'weak': return t.collaborations?.weakMatch || 'Weak Match';
  }
}

function getMatchStrengthDesc(strength: MatchStrength, t: any): string {
  switch (strength) {
    case 'excellent': return t.collaborations?.excellentMatchDesc || 'This person is highly aligned with your requirements across multiple criteria.';
    case 'veryGood': return t.collaborations?.veryGoodMatchDesc || 'This person matches very well on most important criteria.';
    case 'good': return t.collaborations?.goodMatchDesc || 'This person matches well on several important criteria.';
    case 'partial': return t.collaborations?.partialMatchDesc || 'This person has some relevant overlap with your requirements.';
    case 'weak': return t.collaborations?.weakMatchDesc || 'This person has limited overlap with your requirements.';
  }
}

/**
 * Match Result Card Component
 */
function MatchResultCard({
  result,
  requestId,
  onIntroduce,
  onClick,
}: {
  result: CollaborationMatchResult;
  requestId: string;
  onIntroduce: (resultId: string) => void;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const strength = getMatchStrength(result.score);
  const strengthStyle = getMatchStrengthStyle(strength);

  return (
    <div
      onClick={onClick}
      className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h hover:border-emerald-500/30 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-4">
        {/* Avatar with gradient border */}
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-br from-cyan-500 to-blue-500">
            <div className="w-full h-full rounded-full bg-th-bg-s flex items-center justify-center overflow-hidden">
              {result.contact?.avatarUrl ? (
                <img src={result.contact.avatarUrl} alt={result.contact.fullName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-th-text">
                  {result.contact ? getInitials(result.contact.fullName) : '?'}
                </span>
              )}
            </div>
          </div>
          {result.isIntroduced && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <Checkmark24Regular className="w-3 h-3 text-th-text" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white truncate">
              {result.contact?.fullName || 'Unknown Contact'}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-xs border ${strengthStyle.bg} ${strengthStyle.text} ${strengthStyle.border}`}>
              {getMatchStrengthLabel(strength, t)}
            </span>
            {result.isIntroduced && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                {t.collaborations?.introduced || 'Introduced'}
              </span>
            )}
          </div>
          {result.contact?.jobTitle && (
            <p className="text-sm font-medium text-white truncate">{result.contact.jobTitle}</p>
          )}
          {result.contact?.company && (
            <p className="text-sm font-medium text-white/80 truncate">{result.contact.company}</p>
          )}

          {/* Match reasons as tags */}
          {result.reasonsJson && result.reasonsJson.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.reasonsJson.slice(0, 3).map((reason, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-th-surface text-white/90 border border-th-border">
                  {reason.text}
                </span>
              ))}
              {result.reasonsJson.length > 3 && (
                <span className="px-2 py-0.5 text-xs font-medium text-white/70">
                  +{result.reasonsJson.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Arrow */}
        <ChevronRight24Regular className="w-5 h-5 text-th-text-m flex-shrink-0" />
      </div>
    </div>
  );
}

/**
 * Match Result Detail Modal
 */
/**
 * Introduce Modal - Channel selection + contact info for consent flow
 */
function IntroduceModal({
  result,
  request,
  onClose,
  onIntroduce,
}: {
  result: CollaborationMatchResult;
  request: CollaborationRequest;
  onClose: () => void;
  onIntroduce: (resultId: string) => void;
}) {
  const { t } = useI18n();
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');
  const [contactEmail, setContactEmail] = useState(result.contact?.email || '');
  const [contactPhone, setContactPhone] = useState(result.contact?.phone || '');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (channel === 'EMAIL' && !contactEmail) {
      toast({ title: t.collaborations?.emailRequired || 'Email is required', variant: 'error' });
      return;
    }
    if (channel === 'WHATSAPP' && !contactPhone) {
      toast({ title: t.collaborations?.phoneRequired || 'Phone is required', variant: 'error' });
      return;
    }

    setIsSending(true);
    try {
      const intro = await createIntroduction(request.id, result.id, {
        channel,
        contactEmail: channel === 'EMAIL' ? contactEmail : undefined,
        contactPhone: channel === 'WHATSAPP' ? contactPhone : undefined,
        message: message || undefined,
      });
      onIntroduce(result.id);
      if (channel === 'EMAIL' && intro.emailSent === false) {
        toast({ title: t.collaborations?.introductionCreated || 'Introduction created', description: 'Email could not be sent. Check the contact email.', variant: 'warning' });
      } else {
        toast({ title: t.collaborations?.introductionSent || 'Introduction sent', variant: 'success' });
      }
      onClose();
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-th-bg-s border border-th-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-th-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-th-text">
              {t.collaborations?.introduceContact || 'Introduce Contact'}
            </h2>
            <p className="text-[11px] text-th-text-t">
              {result.contact?.fullName || 'Unknown'}{result.contact?.company ? ` · ${result.contact.company}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors">
            <Dismiss24Regular className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3">
          {/* Channel toggle */}
          <div>
            <label className="text-xs font-medium text-th-text-s mb-1.5 block">
              {t.collaborations?.sendVia || 'Send via'}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setChannel('EMAIL')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  channel === 'EMAIL'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'
                }`}
              >
                Email
              </button>
              <button
                onClick={() => setChannel('WHATSAPP')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  channel === 'WHATSAPP'
                    ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                    : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'
                }`}
              >
                WhatsApp
              </button>
            </div>
          </div>

          {/* Contact email/phone */}
          {channel === 'EMAIL' ? (
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/50 text-xs"
            />
          ) : (
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/50 text-xs"
            />
          )}

          {/* Optional message */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.collaborations?.messagePlaceholder || 'Add a personal note (optional)...'}
            rows={2}
            className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:border-emerald-500/50 text-xs resize-none"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-3 border-t border-th-border justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-th-text-t hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors"
          >
            {t.common?.cancel || 'Cancel'}
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {isSending ? (
              <ArrowSync24Regular className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send24Regular className="w-3.5 h-3.5" />
            )}
            {t.collaborations?.sendIntroduction || 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchResultDetailModal({
  result,
  request,
  onClose,
  onIntroduce,
}: {
  result: CollaborationMatchResult;
  request: CollaborationRequest;
  onClose: () => void;
  onIntroduce: (resultId: string) => void;
}) {
  const { t } = useI18n();
  const [showIntroduceModal, setShowIntroduceModal] = useState(false);
  const strength = getMatchStrength(result.score);
  const strengthStyle = getMatchStrengthStyle(strength);

  // Build narrative explanation
  const contactName = result.contact?.fullName || 'This contact';
  const projectTitle = request.sourceFeature?.title || 'your project';
  const reasons = result.reasonsJson || [];
  const sectorReasons = reasons.filter(r => r.type === 'SECTOR_MATCH');
  const skillReasons = reasons.filter(r => r.type === 'SKILL_MATCH');
  const locationReasons = reasons.filter(r => r.type === 'LOCATION_MATCH');
  const keywordReasons = reasons.filter(r => r.type === 'KEYWORD_MATCH');

  // Build the narrative text
  const buildNarrative = (): string => {
    const parts: string[] = [];

    // Opening line
    const strengthLabel = strength === 'excellent' ? 'an excellent' : strength === 'veryGood' ? 'a very good' : strength === 'good' ? 'a good' : strength === 'partial' ? 'a partial' : 'a weak';
    parts.push(`${contactName} is ${strengthLabel} match for "${projectTitle}".`);

    // Sector match
    if (sectorReasons.length > 0) {
      const sectors = sectorReasons.map(r => r.text);
      parts.push(`They work in ${sectors.join(', ')}, which aligns directly with what your project needs.`);
    }

    // Skill match
    if (skillReasons.length > 0) {
      const skills = skillReasons.map(r => r.text);
      parts.push(`They bring expertise in ${skills.join(', ')} — skills that are valuable for this collaboration.`);
    }

    // Location match
    if (locationReasons.length > 0) {
      const locations = locationReasons.map(r => r.text);
      parts.push(`Based in ${locations.join(', ')}, they are well-positioned geographically for this project.`);
    }

    // Keyword match
    if (keywordReasons.length > 0) {
      const keywords = keywordReasons.map(r => r.text);
      parts.push(`Their profile also matches on relevant keywords: ${keywords.join(', ')}.`);
    }

    return parts.join(' ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm max-h-[70vh] bg-th-bg-s border border-th-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-th-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-br from-cyan-500 to-blue-500 flex-shrink-0">
              <div className="w-full h-full rounded-full bg-th-bg-s flex items-center justify-center overflow-hidden">
                {result.contact?.avatarUrl ? (
                  <img src={result.contact.avatarUrl} alt={result.contact.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-th-text">
                    {result.contact ? getInitials(result.contact.fullName) : '?'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm font-bold text-th-text truncate">{result.contact?.fullName || 'Unknown'}</h2>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] border ${strengthStyle.bg} ${strengthStyle.text} ${strengthStyle.border}`}>
                  {getMatchStrengthLabel(strength, t)}
                </span>
                {result.isIntroduced && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-green-500/30 text-green-300">
                    {t.collaborations?.introduced || 'Introduced'}
                  </span>
                )}
              </div>
              {(result.contact?.jobTitle || result.contact?.company) && (
                <p className="text-xs text-th-text-t truncate">
                  {[result.contact?.jobTitle, result.contact?.company].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
            >
              <Dismiss24Regular className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Narrative explanation */}
          {reasons.length > 0 && (
            <div className={`rounded-lg p-3 border ${strengthStyle.bg} ${strengthStyle.border}`}>
              <div className="flex items-start gap-2">
                <Sparkle24Regular className={`w-4 h-4 ${strengthStyle.text} flex-shrink-0 mt-0.5`} />
                <p className="text-xs text-neutral-200 leading-relaxed">
                  {buildNarrative()}
                </p>
              </div>
            </div>
          )}

          {/* Specific match points */}
          {reasons.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-th-text-t mb-2">
                {t.collaborations?.matchPoints || 'How they can help'}
              </h3>
              <div className="space-y-1.5">
                {sectorReasons.map((r, i) => (
                  <div key={`s-${i}`} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                    <p className="text-xs text-th-text-s">
                      <span className="text-blue-400 font-medium">Sector: </span>{r.text}
                    </p>
                  </div>
                ))}
                {skillReasons.map((r, i) => (
                  <div key={`sk-${i}`} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 mt-1.5" />
                    <p className="text-xs text-th-text-s">
                      <span className="text-green-400 font-medium">Skill: </span>{r.text}
                    </p>
                  </div>
                ))}
                {locationReasons.map((r, i) => (
                  <div key={`l-${i}`} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />
                    <p className="text-xs text-th-text-s">
                      <span className="text-emerald-400 font-medium">Location: </span>{r.text}
                    </p>
                  </div>
                ))}
                {keywordReasons.map((r, i) => (
                  <div key={`k-${i}`} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0 mt-1.5" />
                    <p className="text-xs text-th-text-s">
                      <span className="text-yellow-400 font-medium">Keyword: </span>{r.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex gap-2 p-3 border-t border-th-border bg-th-surface">
          {!result.isIntroduced && !result.isDismissed && (
            <button
              onClick={() => setShowIntroduceModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
            >
              <PersonAdd24Regular className="w-4 h-4" />
              {t.collaborations?.introduce || 'Introduce'}
            </button>
          )}
          {result.isIntroduced && (
            <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500/20 text-green-400 text-sm font-medium rounded-lg">
              <Checkmark24Regular className="w-4 h-4" />
              {t.collaborations?.introduced || 'Introduced'}
            </div>
          )}
        </div>
      </div>

      {/* Introduce Modal */}
      {showIntroduceModal && (
        <IntroduceModal
          result={result}
          request={request}
          onClose={() => setShowIntroduceModal(false)}
          onIntroduce={onIntroduce}
        />
      )}
    </div>
  );
}

/**
 * Introduction Card Component
 */
function IntroductionCard({
  introduction,
  onComplete,
  onDecline,
}: {
  introduction: Introduction;
  onComplete: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const { t } = useI18n();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleComplete = async () => {
    setIsProcessing(true);
    try {
      await completeIntroduction(introduction.id);
      onComplete(introduction.id);
      toast({ title: t.collaborations?.introductionCompleted || 'Introduction completed', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (confirm(t.collaborations?.confirmDecline || 'Are you sure you want to decline this introduction?')) {
      setIsProcessing(true);
      try {
        await declineIntroduction(introduction.id);
        onDecline(introduction.id);
        toast({ title: t.collaborations?.introductionDeclined || 'Introduction declined', variant: 'success' });
      } catch (error: any) {
        toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const statusExplanation: Record<string, string> = {
    PENDING: t.collaborations?.statusExplainPending || 'Introduction created — waiting to be sent to the contact.',
    SENT: t.collaborations?.statusExplainSent || 'Invitation sent — waiting for the contact to respond.',
    ACCEPTED: t.collaborations?.statusExplainAccepted || 'Contact accepted the introduction — you can now connect.',
    COMPLETED: t.collaborations?.statusExplainCompleted || 'Introduction completed successfully.',
    DECLINED: t.collaborations?.statusExplainDeclined || 'Contact declined this introduction.',
  };

  const name = introduction.contactName || introduction.contact?.fullName || 'Unknown';

  return (
    <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-white">{getInitials(name)}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-white truncate">{name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] border ${getIntroductionStatusColor(introduction.status)}`}>
              {getIntroductionStatusLabel(introduction.status)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-white/80">
            {introduction.channel && (
              <span>via {introduction.channel === 'EMAIL' ? 'Email' : 'WhatsApp'}</span>
            )}
            <span>{formatRelativeTime(introduction.createdAt)}</span>
          </div>
          <p className="text-[11px] font-medium text-white/60 mt-1">{statusExplanation[introduction.status] || ''}</p>
        </div>

        {/* Actions */}
        {(introduction.status === 'PENDING' || introduction.status === 'ACCEPTED') && (
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={handleComplete} disabled={isProcessing} className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50" title="Complete">
              <Checkmark24Regular className="w-4 h-4" />
            </button>
            <button onClick={handleDecline} disabled={isProcessing} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50" title="Decline">
              <Dismiss24Regular className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CollaborationSessionPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const requestId = params.id as string;

  const [request, setRequest] = useState<CollaborationRequest | null>(null);
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [results, setResults] = useState<CollaborationMatchResult[]>([]);
  const [introductions, setIntroductions] = useState<Introduction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningMatching, setIsRunningMatching] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [selectedResult, setSelectedResult] = useState<CollaborationMatchResult | null>(null);
  const [matchFilter, setMatchFilter] = useState<'all' | MatchStrength>('all');
  const [sectionTab, setSectionTab] = useState<'matches' | 'introductions'>('matches');
  const [introFilter, setIntroFilter] = useState<'all' | 'PENDING' | 'SENT' | 'ACCEPTED' | 'COMPLETED' | 'DECLINED'>('all');

  // Fetch request and session data
  const fetchData = useCallback(async () => {
    try {
      const requestData = await getCollaborationRequest(requestId);
      setRequest(requestData);

      if (requestData.session) {
        setSession(requestData.session as CollaborationSession);

        // Fetch results if session is done
        if (requestData.session.status === 'DONE') {
          const resultsData = await getMatchResults(requestData.session.id, { limit: 100 });
          setResults(resultsData.results);
        }

        // Fetch introductions
        const introData = await getIntroductions(requestId);
        setIntroductions(introData.introductions);
      }
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
      router.push('/collaborations');
    } finally {
      setIsLoading(false);
    }
  }, [requestId, router, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for session status when running
  useEffect(() => {
    if (session?.status === 'RUNNING' && !pollInterval) {
      const interval = setInterval(async () => {
        try {
          const sessionData = await getSessionStatus(session.id);
          setSession(sessionData);

          if (sessionData.status === 'DONE' || sessionData.status === 'FAILED') {
            clearInterval(interval);
            setPollInterval(null);

            if (sessionData.status === 'DONE') {
              const resultsData = await getMatchResults(sessionData.id, { limit: 100 });
              setResults(resultsData.results);
              toast({
                title: t.collaborations?.matchingComplete || 'Matching complete',
                description: `${resultsData.results.length} ${t.collaborations?.matchesFound || 'matches found'}`,
                variant: 'success',
              });
            } else {
              toast({
                title: t.collaborations?.matchingFailed || 'Matching failed',
                description: sessionData.error || 'An error occurred',
                variant: 'error',
              });
            }
          }
        } catch (error) {
          console.error('Failed to poll session status:', error);
        }
      }, 2000);

      setPollInterval(interval);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [session?.status, session?.id, pollInterval, t]);

  const handleRunMatching = async () => {
    setIsRunningMatching(true);
    try {
      const result = await runMatching(requestId);
      setSession(result.session);
      toast({ title: t.collaborations?.matchingStarted || 'Matching started', variant: 'success' });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setIsRunningMatching(false);
    }
  };

  const handleIntroduce = (resultId: string) => {
    setResults((prev) => prev.map((r) => (r.id === resultId ? { ...r, isIntroduced: true } : r)));
    // Refresh introductions
    getIntroductions(requestId).then((data) => setIntroductions(data.introductions));
  };

  const handleIntroductionComplete = (id: string) => {
    setIntroductions((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'COMPLETED' } : i)));
  };

  const handleIntroductionDecline = (id: string) => {
    setIntroductions((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'DECLINED' } : i)));
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in pb-20">
        <div className="h-8 bg-th-surface-h rounded w-1/4 animate-pulse" />
        <div className="bg-th-surface border border-th-border rounded-xl p-6 space-y-4">
          <div className="h-6 bg-th-surface-h rounded w-1/2 animate-pulse" />
          <div className="h-4 bg-th-surface-h rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-th-surface-h rounded w-2/3 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!request) return null;

  const introducedCount = results.filter((r) => r.isIntroduced).length;
  const pendingIntroductions = introductions.filter((i) => i.status === 'PENDING').length;
  const completedIntroductions = introductions.filter((i) => i.status === 'COMPLETED').length;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/collaborations')}
          className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors"
        >
          <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text truncate">
          {t.collaborations?.collaborationSession || 'Collaboration Session'}
        </h1>
      </div>

      {/* Request Info */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold">
              {request.fromUser?.fullName?.charAt(0) || '?'}
            </div>
            <div>
              <h3 className="font-semibold text-th-text">{request.fromUser?.fullName || 'Unknown User'}</h3>
              <p className="text-sm text-th-text-t">{t.collaborations?.isLookingFor || 'is looking for...'}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm border ${getRequestStatusColor(request.status)}`}>
            {getRequestStatusLabel(request.status)}
          </span>
        </div>

        {/* Source feature info */}
        {request.sourceFeature && (
          <div className="bg-th-surface border border-th-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target24Regular className="w-5 h-5 text-emerald-400" />
              <span className="font-semibold text-th-text">{request.sourceFeature.title}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs border ${getSourceTypeColor(request.sourceType)}`}>
                {getSourceTypeLabel(request.sourceType)}
              </span>
            </div>
            {request.sourceFeature.description && (
              <p className="text-sm text-th-text-t">{request.sourceFeature.description}</p>
            )}

            {/* Criteria */}
            {request.sourceFeature.criteria && (
              <div className="flex flex-wrap gap-1 mt-3">
                {request.sourceFeature.criteria.sectors?.map((s: string, i: number) => (
                  <span key={`s-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {s}
                  </span>
                ))}
                {request.sourceFeature.criteria.skills?.map((s: string, i: number) => (
                  <span key={`sk-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {s}
                  </span>
                ))}
                {request.sourceFeature.criteria.locations?.map((l: string, i: number) => (
                  <span key={`l-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {l}
                  </span>
                ))}
                {request.sourceFeature.criteria.keywords?.map((k: string, i: number) => (
                  <span key={`k-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message */}
        {request.message && (
          <div className="flex items-start gap-2 p-3 bg-th-surface rounded-lg">
            <Info24Regular className="w-4 h-4 text-th-text-m flex-shrink-0 mt-0.5" />
            <p className="text-sm text-th-text-s">{request.message}</p>
          </div>
        )}

        {/* Voice Message */}
        {request.voiceMessageUrl && (
          <div className="p-3 bg-th-surface rounded-lg">
            <VoicePlayer url={request.voiceMessageUrl} />
          </div>
        )}
      </div>

      {/* Session Status & Run Matching */}
      {request.status === 'ACCEPTED' && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-th-text flex items-center gap-2">
              <Sparkle24Regular className="w-5 h-5 text-emerald-400" />
              {t.collaborations?.matching || 'Matching'}
            </h2>
            {session && (
              <span className={`px-3 py-1 rounded-full text-sm border ${getSessionStatusColor(session.status)}`}>
                {getSessionStatusLabel(session.status)}
              </span>
            )}
          </div>

          {/* Progress bar for running session */}
          {session?.status === 'RUNNING' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-th-text-t">{t.collaborations?.scanningContacts || 'Scanning contacts...'}</span>
                <span className="text-emerald-400">{session.progress}%</span>
              </div>
              <div className="w-full h-3 bg-th-surface-h rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${session.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Run matching button */}
          {(!session || session.status === 'PENDING' || session.status === 'FAILED') && (
            <button
              onClick={handleRunMatching}
              disabled={isRunningMatching}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
            >
              {isRunningMatching ? (
                <>
                  <ArrowSync24Regular className="w-5 h-5 animate-spin" />
                  {t.collaborations?.starting || 'Starting...'}
                </>
              ) : (
                <>
                  <Sparkle24Regular className="w-5 h-5" />
                  {t.collaborations?.runMatching || 'Run Matching'}
                </>
              )}
            </button>
          )}

          {/* Re-run matching button for completed sessions */}
          {session?.status === 'DONE' && (
            <button
              onClick={handleRunMatching}
              disabled={isRunningMatching}
              className="w-full flex items-center justify-center gap-2 py-3 bg-th-surface-h border border-emerald-500/50 text-emerald-400 font-semibold rounded-xl hover:bg-emerald-500/20 transition-all disabled:opacity-50"
            >
              {isRunningMatching ? (
                <>
                  <ArrowSync24Regular className="w-5 h-5 animate-spin" />
                  {t.collaborations?.starting || 'Starting...'}
                </>
              ) : (
                <>
                  <ArrowSync24Regular className="w-5 h-5" />
                  {t.collaborations?.rerunMatching || 'Re-run Matching'}
                </>
              )}
            </button>
          )}

          {/* Session stats */}
          {session?.status === 'DONE' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-th-surface border border-th-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-th-text">{session.totalContacts}</div>
                <div className="text-xs text-th-text-m">{t.collaborations?.contactsScanned || 'Contacts'}</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-400">{session.matchCount}</div>
                <div className="text-xs text-th-text-m">{t.collaborations?.matchesFound || 'Matches'}</div>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{introducedCount}</div>
                <div className="text-xs text-th-text-m">{t.collaborations?.introduced || 'Introduced'}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs: Matches & Introductions */}
      {(results.length > 0 || introductions.length > 0) && (() => {
        const excellentCount = results.filter(r => getMatchStrength(r.score) === 'excellent').length;
        const veryGoodCount = results.filter(r => getMatchStrength(r.score) === 'veryGood').length;
        const goodCount = results.filter(r => getMatchStrength(r.score) === 'good').length;
        const partialCount = results.filter(r => getMatchStrength(r.score) === 'partial').length;
        const weakCount = results.filter(r => getMatchStrength(r.score) === 'weak').length;
        const filteredResults = matchFilter === 'all'
          ? results
          : results.filter(r => getMatchStrength(r.score) === matchFilter);

        type SectionTab = 'matches' | 'introductions';
        const tabItems: { id: SectionTab; label: string; count: number }[] = [
          { id: 'matches', label: t.collaborations?.matchResults || 'Matches', count: results.length },
          { id: 'introductions', label: t.collaborations?.introductions || 'Introductions', count: introductions.length },
        ];

        return (
          <div className="space-y-4">
            {/* Section Tabs */}
            <div className="flex gap-1 p-1 bg-th-surface border border-th-border rounded-xl">
              {tabItems.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSectionTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    sectionTab === tab.id
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-th-text-t hover:text-th-text hover:bg-th-surface-h'
                  }`}
                >
                  {tab.id === 'matches' ? <People24Regular className="w-4 h-4" /> : <Send24Regular className="w-4 h-4" />}
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                      sectionTab === tab.id ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/10 text-th-text-m'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Matches Tab */}
            {sectionTab === 'matches' && (
              <div className="space-y-4">
                {results.length > 0 ? (
                  <>
                    {/* Score Filter Pills */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      <button
                        onClick={() => setMatchFilter('all')}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                          matchFilter === 'all'
                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                            : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'
                        }`}
                      >
                        {t.collaborations?.allMatches || 'All'} ({results.length})
                      </button>
                      {excellentCount > 0 && (
                        <button onClick={() => setMatchFilter('excellent')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${matchFilter === 'excellent' ? 'bg-[#22C55E]/30 text-[#22C55E] border border-[#22C55E]/50' : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'}`}>
                          {t.collaborations?.excellent || 'Excellent'} ({excellentCount})
                        </button>
                      )}
                      {veryGoodCount > 0 && (
                        <button onClick={() => setMatchFilter('veryGood')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${matchFilter === 'veryGood' ? 'bg-[#84CC16]/30 text-[#84CC16] border border-[#84CC16]/50' : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'}`}>
                          {t.collaborations?.veryGood || 'Very Good'} ({veryGoodCount})
                        </button>
                      )}
                      {goodCount > 0 && (
                        <button onClick={() => setMatchFilter('good')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${matchFilter === 'good' ? 'bg-[#FACC15]/30 text-[#FACC15] border border-[#FACC15]/50' : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'}`}>
                          {t.collaborations?.good || 'Good'} ({goodCount})
                        </button>
                      )}
                      {partialCount > 0 && (
                        <button onClick={() => setMatchFilter('partial')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${matchFilter === 'partial' ? 'bg-[#FB923C]/30 text-[#FB923C] border border-[#FB923C]/50' : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'}`}>
                          {t.collaborations?.partial || 'Partial'} ({partialCount})
                        </button>
                      )}
                      {weakCount > 0 && (
                        <button onClick={() => setMatchFilter('weak')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${matchFilter === 'weak' ? 'bg-[#EF4444]/30 text-[#EF4444] border border-[#EF4444]/50' : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'}`}>
                          {t.collaborations?.weak || 'Weak'} ({weakCount})
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {filteredResults.map((result) => (
                        <MatchResultCard
                          key={result.id}
                          result={result}
                          requestId={requestId}
                          onIntroduce={handleIntroduce}
                          onClick={() => setSelectedResult(result)}
                        />
                      ))}
                      {filteredResults.length === 0 && (
                        <div className="text-center py-8 text-th-text-m text-sm">
                          {t.collaborations?.noMatchesInCategory || 'No matches in this category'}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-th-text-m text-sm">
                    <People24Regular className="w-10 h-10 text-white/30 mx-auto mb-2" />
                    <p>{t.collaborations?.noMatchesYet || 'No matches yet. Run matching to find contacts.'}</p>
                  </div>
                )}
              </div>
            )}

            {/* Introductions Tab */}
            {sectionTab === 'introductions' && (() => {
              const statusCounts = {
                PENDING: introductions.filter(i => i.status === 'PENDING').length,
                SENT: introductions.filter(i => i.status === 'SENT').length,
                ACCEPTED: introductions.filter(i => i.status === 'ACCEPTED').length,
                COMPLETED: introductions.filter(i => i.status === 'COMPLETED').length,
                DECLINED: introductions.filter(i => i.status === 'DECLINED').length,
              };
              const filteredIntros = introFilter === 'all'
                ? introductions
                : introductions.filter(i => i.status === introFilter);

              const filterButtons: { id: typeof introFilter; label: string; color: string; count: number }[] = [
                { id: 'all', label: 'All', color: 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50', count: introductions.length },
                { id: 'PENDING', label: 'Pending', color: 'bg-yellow-500/30 text-yellow-300 border-yellow-500/50', count: statusCounts.PENDING },
                { id: 'SENT', label: 'Sent', color: 'bg-blue-500/30 text-blue-300 border-blue-500/50', count: statusCounts.SENT },
                { id: 'ACCEPTED', label: 'Accepted', color: 'bg-green-500/30 text-green-300 border-green-500/50', count: statusCounts.ACCEPTED },
                { id: 'COMPLETED', label: 'Completed', color: 'bg-green-500/30 text-green-300 border-green-500/50', count: statusCounts.COMPLETED },
                { id: 'DECLINED', label: 'Declined', color: 'bg-red-500/30 text-red-300 border-red-500/50', count: statusCounts.DECLINED },
              ];

              return (
                <div className="space-y-3">
                  {introductions.length > 0 ? (
                    <>
                      {/* Status filter pills */}
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {filterButtons.filter(f => f.id === 'all' || f.count > 0).map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setIntroFilter(f.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                              introFilter === f.id
                                ? `${f.color} border`
                                : 'bg-th-surface text-th-text-t border border-th-border hover:bg-th-surface-h'
                            }`}
                          >
                            {f.label} ({f.count})
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        {filteredIntros.map((introduction) => (
                          <IntroductionCard
                            key={introduction.id}
                            introduction={introduction}
                            onComplete={handleIntroductionComplete}
                            onDecline={handleIntroductionDecline}
                          />
                        ))}
                        {filteredIntros.length === 0 && (
                          <div className="text-center py-8 text-th-text-m text-xs">
                            No introductions with this status
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-th-text-m text-sm">
                      <Send24Regular className="w-10 h-10 text-white/30 mx-auto mb-2" />
                      <p>{t.collaborations?.noIntroductions || 'No introductions sent yet. Click on a match to introduce them.'}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Match Result Detail Modal */}
      {selectedResult && request && (
        <MatchResultDetailModal
          result={selectedResult}
          request={request}
          onClose={() => setSelectedResult(null)}
          onIntroduce={(resultId) => {
            handleIntroduce(resultId);
            setSelectedResult((prev) => prev ? { ...prev, isIntroduced: true } : null);
          }}
        />
      )}
    </div>
  );
}
