/**
 * MatchDetailModal Component
 *
 * Displays detailed match information including:
 * - Overall match score
 * - Radar chart visualization
 * - Shared attributes
 * - Why connect reasons
 * - Conversation starter suggestion
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMatchStrength } from '@/lib/utils/match-strength';
import {
  Dismiss24Regular,
  Person24Regular,
  Building24Regular,
  Briefcase24Regular,
  Copy24Regular,
  Checkmark24Regular,
  Chat24Regular,
  PersonAvailable24Regular,
  ArrowRight24Regular,
  Target24Regular,
  Wrench24Regular,
  PeopleTeam24Regular,
  Lightbulb24Regular,
  DataUsage24Regular,
  Info16Regular,
  BrainCircuit24Regular,
  Share24Regular,
  CalendarClock24Regular,
  Heart24Regular,
} from '@fluentui/react-icons';
import RadarChart from './RadarChart';
import SkillGapVisualization from './features/matching/SkillGapVisualization';
import { useI18n } from '@/lib/i18n';

interface MatchData {
  score: number;
  breakdown: {
    goalAlignmentScore: number;
    sectorScore: number;
    skillScore: number;
    semanticSimilarityScore?: number;
    networkProximityScore?: number;
    complementarySkillsScore: number;
    recencyScore: number;
    interactionScore: number;
    interestScore: number;
    hobbyScore?: number;
  };
  sharedAttributes: string[];
  reasons: string[];
  suggestedMessage?: string;
  goalAlignment?: {
    matchedGoals: string[];
    relevantTraits: string[];
  };
  confidence?: number;
  matchQuality?: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ContactData {
  id: string;
  fullName: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
}

interface MatchDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: ContactData;
  match: MatchData;
}

export default function MatchDetailModal({
  isOpen,
  onClose,
  contact,
  match,
}: MatchDetailModalProps) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Prepare radar chart data
  const radarData = [
    { axis: 'Goals', value: match.breakdown.goalAlignmentScore },
    { axis: 'Sectors', value: match.breakdown.sectorScore },
    { axis: 'Skills', value: match.breakdown.skillScore },
    { axis: 'Complementary', value: match.breakdown.complementarySkillsScore },
    { axis: 'Recency', value: match.breakdown.recencyScore },
    { axis: 'Engagement', value: match.breakdown.interactionScore },
  ];

  const handleCopyMessage = async () => {
    if (match.suggestedMessage) {
      await navigator.clipboard.writeText(match.suggestedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleViewProfile = () => {
    onClose();
    router.push(`/contacts/${contact.id}`);
  };

  const handleSendMessage = () => {
    // Copy message and close modal
    handleCopyMessage();
    // Could also integrate with messaging system
  };

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'from-green-500 to-emerald-500';
    if (score >= 50) return 'from-cyan-500 to-teal-500';
    return 'from-red-500 to-emerald-500';
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 end-4 p-2 text-th-text-t hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors z-10"
        >
          <Dismiss24Regular className="w-5 h-5" />
        </button>

        {/* Header with Score */}
        <div className="p-6 pb-4 border-b border-th-border">
          <div className="flex items-center gap-4">
            {/* Avatar with Score Ring */}
            <div className="relative group">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getScoreColor(match.score)} p-1`}>
                <div className="w-full h-full rounded-full bg-th-bg-s flex items-center justify-center">
                  {contact.avatarUrl ? (
                    <img
                      src={contact.avatarUrl}
                      alt={contact.fullName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-bold text-th-text">
                      {getInitials(contact.fullName)}
                    </span>
                  )}
                </div>
              </div>
              {/* Score Badge */}
              <div className={`absolute -bottom-1 -end-1 w-8 h-8 rounded-full bg-gradient-to-br ${getScoreColor(match.score)} flex items-center justify-center shadow-lg cursor-help`}>
                <span className="text-xs font-bold text-th-text">{match.score}</span>
              </div>
              {/* Score calculation tooltip */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-4 py-3 bg-th-bg-t border border-th-border rounded-xl text-xs text-th-text-s w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                <p className="font-semibold text-th-text mb-2 text-sm">How Match Score is Calculated</p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span>AI Semantic Similarity*</span><span className="text-emerald-400">25%</span></div>
                  <div className="flex justify-between"><span>Goals Alignment</span><span className="text-emerald-400">20%</span></div>
                  <div className="flex justify-between"><span>Sector Overlap</span><span className="text-blue-400">12%</span></div>
                  <div className="flex justify-between"><span>Skills Match</span><span className="text-cyan-400">12%</span></div>
                  <div className="flex justify-between"><span>Network Proximity</span><span className="text-emerald-400">8%</span></div>
                  <div className="flex justify-between"><span>Complementary Skills</span><span className="text-green-400">8%</span></div>
                  <div className="flex justify-between"><span>Recency Bonus</span><span className="text-teal-400">5%</span></div>
                  <div className="flex justify-between"><span>Interaction History</span><span className="text-cyan-400">4%</span></div>
                  <div className="flex justify-between"><span>Shared Interests</span><span className="text-emerald-400">3%</span></div>
                  <div className="flex justify-between"><span>Hobbies</span><span className="text-red-400">3%</span></div>
                </div>
                <p className="mt-2 pt-2 border-t border-th-border text-th-text-t text-[10px]">Score = sum of (component score × weight)</p>
                <p className="mt-1 text-th-text-m text-[9px]">*Requires contact profile data</p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-th-text truncate">{contact.fullName}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getMatchStrength(match.score).badgeClass}`}>{match.score} - {getMatchStrength(match.score).label}</span>
                {match.matchQuality && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                    match.matchQuality === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                    match.matchQuality === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-white/60'
                  }`}>
                    {match.matchQuality === 'HIGH' ? 'High Confidence' :
                     match.matchQuality === 'MEDIUM' ? 'Medium Confidence' :
                     'Low Confidence'}
                  </span>
                )}
              </div>
              {contact.jobTitle && (
                <div className="flex items-center gap-1 text-th-text-t mt-1">
                  <Briefcase24Regular className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-sm">{contact.jobTitle}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-1 text-th-text-t">
                  <Building24Regular className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-sm">{contact.company}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="px-6 py-4 border-b border-th-border">
          <h3 className="text-sm font-medium text-th-text-t mb-3">
            {t.contacts?.matchDetails?.matchBreakdown || 'Match Breakdown'}
          </h3>
          <RadarChart
            data={radarData}
            size={180}
            className="mx-auto"
            color="#10b981"
            animate={true}
          />
        </div>

        {/* Score Breakdown - 2 Column Grid */}
        <div className="px-6 py-4 border-b border-th-border">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-medium text-th-text-t">Score Details</h3>
            <div className="group relative">
              <Info16Regular className="w-3.5 h-3.5 text-th-text-m cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-th-bg-t border border-th-border rounded-lg text-xs text-th-text-s w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                <p className="font-medium text-th-text mb-1">Score = Sum of (Component × Weight)</p>
                <p className="text-[10px] text-th-text-t">Total of all 10 weighted components</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Goals', value: match.breakdown.goalAlignmentScore, Icon: Target24Regular, color: 'purple', weight: '25%', tooltip: 'Networking goals alignment' },
              { label: 'Sectors', value: match.breakdown.sectorScore, Icon: Building24Regular, color: 'blue', weight: '15%', tooltip: 'Industry sectors overlap' },
              { label: 'Skills', value: match.breakdown.skillScore, Icon: Wrench24Regular, color: 'cyan', weight: '12%', tooltip: 'Professional skills match' },
              { label: 'AI Semantic', value: match.breakdown.semanticSimilarityScore || 0, Icon: BrainCircuit24Regular, color: 'violet', weight: '10%', tooltip: 'AI profile similarity (requires job, company, bio, sectors, or skills data)' },
              { label: 'Network', value: match.breakdown.networkProximityScore || 0, Icon: Share24Regular, color: 'indigo', weight: '8%', tooltip: 'Connection degree (1st/2nd/3rd)' },
              { label: 'Synergy', value: match.breakdown.complementarySkillsScore, Icon: PeopleTeam24Regular, color: 'green', weight: '7%', tooltip: 'Complementary skills' },
              { label: 'Recency', value: match.breakdown.recencyScore || 0, Icon: CalendarClock24Regular, color: 'teal', weight: '7%', tooltip: 'How recently updated' },
              { label: 'Activity', value: match.breakdown.interactionScore, Icon: DataUsage24Regular, color: 'cyan', weight: '6%', tooltip: 'Interaction history' },
              { label: 'Interests', value: match.breakdown.interestScore, Icon: Lightbulb24Regular, color: 'pink', weight: '5%', tooltip: 'Shared interests' },
              { label: 'Hobbies', value: match.breakdown.hobbyScore || 0, Icon: Heart24Regular, color: 'rose', weight: '5%', tooltip: 'Shared hobbies' },
            ].map((item) => (
              <div key={item.label} className="bg-th-surface rounded-lg p-2 hover:bg-th-surface-h transition-colors group relative">
                <div className="flex items-center gap-1.5 mb-1">
                  <item.Icon className={`w-3.5 h-3.5 ${
                    item.color === 'purple' ? 'text-emerald-400' :
                    item.color === 'blue' ? 'text-blue-400' :
                    item.color === 'cyan' ? 'text-cyan-400' :
                    item.color === 'violet' ? 'text-emerald-400' :
                    item.color === 'indigo' ? 'text-emerald-400' :
                    item.color === 'green' ? 'text-green-400' :
                    item.color === 'teal' ? 'text-teal-400' :
                    item.color === 'cyan' ? 'text-cyan-400' :
                    item.color === 'pink' ? 'text-emerald-400' :
                    'text-red-400'
                  }`} />
                  <span className="text-[11px] font-medium text-th-text-s flex-1">{item.label}</span>
                  <span className={`text-[11px] font-bold ${item.value >= 70 ? 'text-green-400' : item.value >= 40 ? 'text-yellow-400' : 'text-th-text-m'}`}>
                    {Math.round(item.value)}%
                  </span>
                </div>
                <div className="h-1 bg-th-surface-h rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.color === 'purple' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                      item.color === 'blue' ? 'bg-gradient-to-r from-blue-600 to-blue-400' :
                      item.color === 'cyan' ? 'bg-gradient-to-r from-cyan-600 to-cyan-400' :
                      item.color === 'violet' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                      item.color === 'indigo' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                      item.color === 'green' ? 'bg-gradient-to-r from-green-600 to-green-400' :
                      item.color === 'teal' ? 'bg-gradient-to-r from-teal-600 to-teal-400' :
                      item.color === 'cyan' ? 'bg-gradient-to-r from-cyan-600 to-cyan-400' :
                      item.color === 'pink' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                      'bg-gradient-to-r from-red-600 to-red-400'
                    }`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-th-bg-t border border-th-border rounded-lg text-[10px] text-th-text-s w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                  <p className="font-medium text-th-text mb-0.5">{item.label} ({item.weight})</p>
                  <p className="leading-tight">{item.tooltip}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What You Share */}
        {match.sharedAttributes.length > 0 && (
          <div className="px-6 py-4 border-b border-th-border">
            <h3 className="text-sm font-medium text-th-text-t mb-3">
              {t.contacts?.matchDetails?.whatYouShare || 'What You Share'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {match.sharedAttributes.map((attr, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-sm text-emerald-300"
                >
                  {attr}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Match Insights */}
        {match.reasons.length > 0 && (
          <div className="px-6 py-4 border-b border-th-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-th-text-t">
                {t.contacts?.matchDetails?.matchInsights || 'Match Insights'}
              </h3>
              <span className="text-xs text-th-text-m">
                {match.reasons.length} {match.reasons.length === 1 ? 'reason' : 'reasons'}
              </span>
            </div>
            <div className="space-y-1.5">
              {match.reasons.map((reason, index) => (
                <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-gradient-to-r from-green-500/5 to-transparent border border-green-500/10">
                  <Checkmark24Regular className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-th-text-s">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goal Alignment */}
        {match.goalAlignment && match.goalAlignment.matchedGoals.length > 0 && (
          <div className="px-6 py-4 border-b border-th-border">
            <h3 className="text-sm font-medium text-th-text-t mb-3">
              {t.contacts?.matchDetails?.goalAlignment || 'Goal Alignment'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {match.goalAlignment.matchedGoals.map((goal, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full text-sm text-green-300"
                >
                  {goal}
                </span>
              ))}
            </div>
            {match.goalAlignment.relevantTraits.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {match.goalAlignment.relevantTraits.slice(0, 4).map((trait, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-th-surface rounded text-xs text-th-text-t"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skill Gap Analysis */}
        {contact?.id && (
          <div className="px-6 py-4 border-b border-th-border">
            <SkillGapVisualization contactId={contact.id} />
          </div>
        )}

        {/* Ice Breaker Messages */}
        {match.suggestedMessage && (
          <div className="px-6 py-4 border-b border-th-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Chat24Regular className="w-3.5 h-3.5 text-th-text" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-th-text">
                    {t.contacts?.matchDetails?.iceBreaker || 'Ice Breakers'}
                  </h3>
                  <span className="text-[10px] text-th-text-m">
                    {match.suggestedMessage.split('\n').filter(Boolean).length} suggestions
                  </span>
                </div>
                <p className="text-[10px] text-th-text-m">
                  {(match.goalAlignment?.matchedGoals?.length ?? 0) > 0
                    ? `Based on ${match.goalAlignment!.matchedGoals[0].toLowerCase()} goals`
                    : match.sharedAttributes?.length > 0
                      ? `Based on ${match.sharedAttributes.length} shared attributes`
                      : 'Tailored to your connection'}
                </p>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {match.suggestedMessage.split('\n').filter(Boolean).map((message, index) => (
                <div key={index} className="relative group">
                  <div className="bg-gradient-to-r from-white/5 to-white/[0.02] rounded-lg p-2.5 pe-10 border border-th-border hover:border-cyan-500/30 transition-all">
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-medium">{index + 1}</span>
                      <p className="text-xs text-th-text-s italic leading-relaxed">
                        &quot;{message.trim()}&quot;
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await navigator.clipboard.writeText(message.trim());
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute top-1.5 end-1.5 p-1.5 text-th-text-m hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Copy this message"
                  >
                    <Copy24Regular className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-6 flex gap-3">
          <button
            onClick={handleViewProfile}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-th-surface border border-th-border text-th-text font-medium rounded-xl hover:bg-th-surface-h transition-colors"
          >
            <Person24Regular className="w-5 h-5" />
            {t.contacts?.matchDetails?.viewProfile || 'View Profile'}
          </button>
          <button
            onClick={handleSendMessage}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
          >
            <Chat24Regular className="w-5 h-5" />
            {t.contacts?.matchDetails?.sendMessage || 'Send Message'}
            <ArrowRight24Regular className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
