/**
 * Match Detail Modal Component
 *
 * Modal showing full details of a match including reasons, suggested message, and actions.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { getMatchStrength } from '@/lib/utils/match-strength';
import {
  Dismiss24Regular,
  Copy24Regular,
  Checkmark24Regular,
  Chat24Regular,
  BookmarkAdd24Regular,
  ArrowRight24Regular,
  Person24Regular,
  Building24Regular,
  Location24Regular,
  Mail24Regular,
  Phone24Regular,
  Link24Regular,
  Sparkle24Regular,
  PersonAdd24Regular,
} from '@fluentui/react-icons';
import {
  OpportunityMatch,
  OpportunityMatchStatus,
  updateMatchStatus,
} from '@/lib/api/opportunities';
import { toast } from '@/components/ui/Toast';
import { MatchActionBar, EditableIceBreakers } from '@/components/features/matches';
import { updateMatchIceBreakers as updateOpportunityMatchIceBreakers } from '@/lib/api/opportunities';

interface MatchDetailModalProps {
  match: OpportunityMatch;
  onClose: () => void;
  onStatusChange: (matchId: string, status: OpportunityMatchStatus) => void;
}

/**
 * Score color based on value
 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'text-black bg-[#22C55E] border-[#22C55E]';
  if (score >= 75) return 'text-black bg-[#84CC16] border-[#84CC16]';
  if (score >= 60) return 'text-black bg-[#FACC15] border-[#FACC15]';
  if (score >= 40) return 'text-black bg-[#FB923C] border-[#FB923C]';
  return 'text-black bg-[#EF4444] border-[#EF4444]';
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: OpportunityMatchStatus }) {
  const statusColors: Record<OpportunityMatchStatus, string> = {
    PENDING: 'bg-th-surface-h text-th-text-t border-th-border',
    CONTACTED: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
    INTRODUCED: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
    SAVED: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
    DISMISSED: 'bg-red-400 text-[#042820] border-red-400',
    CONNECTED: 'bg-green-500 text-black border-green-500',
    ARCHIVED: 'bg-emerald-400 text-[#042820] border-emerald-400/80',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[status]}`}>
      {status}
    </span>
  );
}

export default function MatchDetailModal({
  match,
  onClose,
  onStatusChange,
}: MatchDetailModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [copying, setCopying] = useState(false);
  const [updating, setUpdating] = useState(false);

  const copyMessage = async () => {
    if (match.suggestedMessage) {
      setCopying(true);
      await navigator.clipboard.writeText(match.suggestedMessage);
      toast({ title: t.common?.copied || 'Copied to clipboard', variant: 'success' });
      setTimeout(() => setCopying(false), 1000);
    }
  };

  // Add to contacts functionality
  const handleAddToContact = () => {
    const candidate = match.candidate;

    // Build bio from match reasons and suggested message
    let bio = '';
    if (candidate.bio) {
      bio = candidate.bio;
    }
    if (match.reasons && match.reasons.length > 0) {
      bio += bio ? '\n\nMatch Reasons:\n' : 'Match Reasons:\n';
      bio += match.reasons.map(r => `• ${r}`).join('\n');
    }

    // Save contact data to sessionStorage
    const contactData = {
      fullName: candidate.fullName || '',
      email: candidate.email || '',
      phone: candidate.phone || '',
      company: candidate.company || '',
      jobTitle: candidate.jobTitle || '',
      linkedInUrl: candidate.linkedinUrl || '',
      location: candidate.location || '',
    };
    sessionStorage.setItem('scannedContact', JSON.stringify(contactData));

    // Save AI suggestions (sectors, skills, interests, bio)
    const aiSuggestions = {
      sectors: match.sharedSectors || [],
      skills: match.sharedSkills || [],
      interests: [],
      bio: bio,
    };
    sessionStorage.setItem('aiSuggestions', JSON.stringify(aiSuggestions));

    // Set source as MATCH
    sessionStorage.setItem('contactSource', 'MATCH');

    // Store match info as notes
    let notes = '';
    if (match.suggestedMessage) {
      notes += 'Suggested Outreach Message:\n' + match.suggestedMessage;
    }
    if (match.nextSteps && match.nextSteps.length > 0) {
      notes += (notes ? '\n\n' : '') + 'Next Steps:\n' + match.nextSteps.map(s => `• ${s}`).join('\n');
    }
    if (match.intentAlignment) {
      notes += (notes ? '\n\n' : '') + 'Intent Alignment: ' + match.intentAlignment;
    }
    if (notes) {
      sessionStorage.setItem('explorerNotes', notes);
    }

    // Close modal and navigate
    onClose();
    router.push('/contacts/new');
  };

  const handleStatusChange = async (status: OpportunityMatchStatus) => {
    try {
      setUpdating(true);
      await updateMatchStatus(match.opportunityId, match.id, status);
      onStatusChange(match.id, status);
      toast({
        title:
          status === 'SAVED'
            ? t.opportunities?.saved || 'Saved'
            : status === 'DISMISSED'
              ? t.opportunities?.dismissed || 'Dismissed'
              : status === 'CONTACTED'
                ? t.opportunities?.markedContacted || 'Marked as contacted'
                : status === 'CONNECTED'
                  ? t.opportunities?.markedConnected || 'Marked as connected'
                  : t.common?.success || 'Success',
        variant: 'success',
      });
    } catch (error: any) {
      toast({ title: t.common?.error || 'Error', description: error.message, variant: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[calc(100%-2rem)] max-w-lg bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-th-border">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/30 to-blue-500/30 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden">
            {match.candidate.avatarUrl ? (
              <img
                src={match.candidate.avatarUrl}
                alt={match.candidate.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              match.candidate.fullName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{match.candidate.fullName}</h2>
            <p className="text-xs text-white truncate">
              {[match.candidate.jobTitle, match.candidate.company].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex-shrink-0 ${getMatchStrength(match.matchScore).badgeClass}`}>
            {Math.round(match.matchScore)}%
          </span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-th-surface-h text-th-text-t">
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Intent Alignment */}
          {match.intentAlignment && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Sparkle24Regular className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-white text-sm">{match.intentAlignment}</span>
            </div>
          )}

          {/* Contact Info */}
          <div className="bg-th-surface rounded-xl p-3 space-y-2">
            <h3 className="text-xs text-white font-bold uppercase">Contact Information</h3>
            {match.candidate.location && (
              <div className="flex items-center gap-2 text-sm text-white">
                <Location24Regular className="w-4 h-4 text-white" />
                {match.candidate.location}
              </div>
            )}
            {match.candidate.email && (
              <div className="flex items-center gap-2 text-sm text-white">
                <Mail24Regular className="w-4 h-4 text-white" />
                <a href={`mailto:${match.candidate.email}`} className="hover:text-emerald-400">{match.candidate.email}</a>
              </div>
            )}
            {match.candidate.phone && (
              <div className="flex items-center gap-2 text-sm text-white">
                <Phone24Regular className="w-4 h-4 text-white" />
                <a href={`tel:${match.candidate.phone}`} className="hover:text-emerald-400">{match.candidate.phone}</a>
              </div>
            )}
            {match.candidate.linkedinUrl && (
              <div className="flex items-center gap-2 text-sm text-white">
                <Link24Regular className="w-4 h-4 text-white" />
                <a href={match.candidate.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">LinkedIn Profile</a>
              </div>
            )}
          </div>

          {/* Shared Tags */}
          {(match.sharedSectors.length > 0 || match.sharedSkills.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {match.sharedSectors.map((sector, i) => (
                <span key={`sector-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                  {sector}
                </span>
              ))}
              {match.sharedSkills.map((skill, i) => (
                <span key={`skill-${i}`} className="px-2 py-0.5 rounded-full text-xs bg-emerald-400 text-[#042820] border border-emerald-400/80 font-bold">
                  {skill}
                </span>
              ))}
            </div>
          )}

          {/* Why This Match */}
          {match.reasons.length > 0 && (
            <div className="bg-th-surface rounded-xl p-3 space-y-2">
              <h3 className="text-xs text-white font-bold uppercase">Why This Match</h3>
              {match.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Checkmark24Regular className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white">{reason}</span>
                </div>
              ))}
            </div>
          )}

          {/* V3: Summary Explanation + Match Level */}
          {match.explanation && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <h3 className="text-xs text-white font-bold uppercase mb-2">Match Summary</h3>
              <p className="text-sm text-white leading-relaxed">{match.explanation}</p>
              <div className="flex items-center gap-2 mt-3">
                {match.matchLevel && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                    match.matchLevel === 'EXCELLENT' ? 'bg-[#22C55E] text-black border-[#22C55E]' :
                    match.matchLevel === 'VERY_GOOD' ? 'bg-[#84CC16] text-black border-[#84CC16]' :
                    match.matchLevel === 'GOOD' ? 'bg-[#FACC15] text-black border-[#FACC15]' :
                    match.matchLevel === 'WEAK' ? 'bg-[#FB923C] text-black border-[#FB923C]' :
                    'bg-[#EF4444] text-black border-[#EF4444]'
                  }`}>
                    {match.matchLevel?.replace('_', ' ')}
                  </span>
                )}
                {match.confidenceScore != null && (
                  <span className="text-xs text-white font-bold">Confidence: {match.confidenceScore}%</span>
                )}
                {match.hardFilterStatus && match.hardFilterStatus !== 'PASS' && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                    match.hardFilterStatus === 'FAIL' ? 'bg-[#EF4444] text-black border-[#EF4444]' :
                    'bg-[#FACC15] text-black border-[#FACC15]'
                  }`}>
                    {match.hardFilterStatus}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* V3: Missing Skills */}
          {match.missingSkills && match.missingSkills.length > 0 && (
            <div className="bg-th-surface rounded-xl p-3 space-y-2">
              <h3 className="text-xs text-white font-bold uppercase">Missing Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {match.missingSkills.slice(0, 10).map((skill, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-red-400 text-[#042820] border border-red-400 font-bold line-through">
                    {skill}
                  </span>
                ))}
                {match.missingSkills.length > 10 && (
                  <span className="text-xs text-white font-bold">+{match.missingSkills.length - 10} more</span>
                )}
              </div>
            </div>
          )}

          {/* V3: Risks / Gaps */}
          {match.risks && match.risks.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-2">
              <h3 className="text-xs text-white font-bold uppercase">Gaps & Concerns</h3>
              {match.risks.map((risk, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                  <span className="text-white">{risk}</span>
                </div>
              ))}
            </div>
          )}

          {/* V3: Score Breakdown */}
          {match.scoreBreakdown && Array.isArray(match.scoreBreakdown) && match.scoreBreakdown.length > 0 && (
            <details className="bg-th-surface rounded-xl overflow-hidden">
              <summary className="p-3 cursor-pointer text-sm font-bold text-white hover:bg-white/[0.02] transition-colors">
                Score Breakdown ({match.scoreBreakdown.length} components)
              </summary>
              <div className="px-3 pb-3 space-y-2">
                {[...match.scoreBreakdown]
                  .sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0))
                  .map((comp, i) => {
                    const score = comp.score || 0;
                    const barColor = score >= 90 ? 'bg-[#22C55E]' : score >= 75 ? 'bg-[#84CC16]' : score >= 60 ? 'bg-[#FACC15]' : score >= 40 ? 'bg-[#FB923C]' : 'bg-[#EF4444]';
                    const scoreTextColor = score >= 90 ? 'text-[#22C55E]' : score >= 75 ? 'text-[#84CC16]' : score >= 60 ? 'text-[#FACC15]' : score >= 40 ? 'text-[#FB923C]' : 'text-[#EF4444]';
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white flex-1" title={comp.name}>
                            {comp.name.replace(/Score$/, '').replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className={`text-xs font-bold ${scoreTextColor}`}>{Math.round(score)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, score)}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </details>
          )}

          {/* Ice Breaker Messages */}
          {match.suggestedMessage && (
            <EditableIceBreakers
              iceBreakers={(match.suggestedMessage || '').split('\n').filter(Boolean)}
              accentColor="sky"
              label={t.opportunities?.iceBreakers || 'Ice Breakers'}
              onSave={async (text) => {
                await updateOpportunityMatchIceBreakers(match.opportunityId, match.id, text);
              }}
            />
          )}

          {/* Next Steps */}
          {match.nextSteps && match.nextSteps.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-2">
              <h3 className="text-xs text-white font-bold uppercase">Next Steps</h3>
              {match.nextSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <ArrowRight24Regular className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white">{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <MatchActionBar
            currentStatus={match.status}
            contactName={match.candidate.fullName}
            channels={{ phone: (match.candidate as any).phone, email: (match.candidate as any).email, linkedinUrl: (match.candidate as any).linkedinUrl }}
            onStatusChange={(status) => handleStatusChange(status as OpportunityMatchStatus)}
            isUpdating={updating}
            dismissStatus="DISMISSED"
            t={t}
          />
        </div>

        {/* Footer */}
        {match.matchType === 'user' && (
          <div className="p-3 border-t border-th-border bg-th-surface">
            <button
              onClick={handleAddToContact}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-500 text-[#042820] text-sm font-bold transition-colors"
            >
              <PersonAdd24Regular className="w-4 h-4" />
              {t.opportunities?.addToContacts || 'Add to Contacts'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
