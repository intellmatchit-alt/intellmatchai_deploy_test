/**
 * Hiring Profile Detail Page
 *
 * Shows hiring profile details, allows finding matches,
 * and displays match results with score breakdowns.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  ArrowSync24Regular,
  Edit24Regular,
  Sparkle24Regular,
  Briefcase24Regular,
  Location24Regular,
  People24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  Clock24Regular,
  PersonAdd24Regular,
} from '@fluentui/react-icons';
import {
  getHiringProfile,
  findJobMatches,
  getJobMatches,
  HiringProfile,
  JobMatchResult,
  JobMatchLevel,
  ScoringComponent,
  MATCH_LEVEL_COLORS,
  MATCH_LEVEL_LABELS,
  JOB_SENIORITY_OPTIONS,
  JOB_WORK_MODE_OPTIONS,
  JOB_EMPLOYMENT_TYPE_OPTIONS,
  JOB_HIRING_URGENCY_OPTIONS,
} from '@/lib/api/job-matching';
import { toast } from '@/components/ui/Toast';

/**
 * Format date to relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function getLabelFromOptions(options: readonly { id: string; label: string }[], value: string): string {
  return options.find((o) => o.id === value)?.label || value;
}

/**
 * Expandable score breakdown for a single match
 */
function ScoreBreakdownPanel({ components }: { components: ScoringComponent[] }) {
  return (
    <div className="space-y-2 mt-3 pt-3 border-t border-th-border">
      <p className="text-[10px] text-th-text-m font-medium uppercase tracking-wider">Score Breakdown</p>
      <div className="space-y-1.5">
        {components.map((comp, idx) => {
          const pct = Math.round(comp.rawScore * 100);
          return (
            <div key={idx} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-th-text-s">{comp.name}</span>
                <span className="text-th-text-t tabular-nums">
                  {pct}% <span className="text-th-text-m">(w:{comp.weight})</span>
                </span>
              </div>
              <div className="h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {comp.explanation && (
                <p className="text-[10px] text-th-text-m leading-tight">{comp.explanation}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Single match card
 */
function MatchCard({ match }: { match: JobMatchResult }) {
  const [expanded, setExpanded] = useState(false);

  const levelColor = MATCH_LEVEL_COLORS[match.matchLevel] || 'text-th-text-t bg-th-surface-h';
  const levelLabel = MATCH_LEVEL_LABELS[match.matchLevel] || match.matchLevel;
  const seniorityLabel = getLabelFromOptions(JOB_SENIORITY_OPTIONS, match.candidateSeniority);

  return (
    <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-th-text truncate">{match.candidateName}</h3>
          {match.candidateTitle && (
            <p className="text-xs text-th-text-s truncate mt-0.5">{match.candidateTitle}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {match.candidateRoleArea && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-th-surface-h border border-th-border text-th-text-t">
                {match.candidateRoleArea}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-th-surface-h border border-th-border text-th-text-t">
              {seniorityLabel}
            </span>
          </div>
        </div>

        {/* Score badge */}
        <div className="flex flex-col items-center flex-shrink-0">
          <span className="text-lg font-bold text-th-text tabular-nums">{Math.round(match.finalScore)}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${levelColor}`}>
            {levelLabel}
          </span>
        </div>
      </div>

      {/* Hard filter warning */}
      {match.hardFilterStatus === 'FAIL' && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
          <Dismiss24Regular className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-[10px] text-red-400">{match.hardFilterReason || 'Failed hard filter'}</span>
        </div>
      )}
      {match.hardFilterStatus === 'WARN' && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <span className="text-[10px] text-yellow-400">{match.hardFilterReason || 'Warning'}</span>
        </div>
      )}

      {/* Key Reasons */}
      {match.keyReasons.length > 0 && (
        <ul className="space-y-1">
          {match.keyReasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-th-text-s">
              <Checkmark24Regular className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Skills pills */}
      {(match.matchedSkills.length > 0 || match.missingSkills.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {match.matchedSkills.map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
            >
              {skill}
            </span>
          ))}
          {match.missingSkills.map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 line-through"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Expand / collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] text-th-text-t hover:text-th-text transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp24Regular className="w-3.5 h-3.5" />
            Hide breakdown
          </>
        ) : (
          <>
            <ChevronDown24Regular className="w-3.5 h-3.5" />
            Show score breakdown
          </>
        )}
      </button>

      {expanded && match.scoreBreakdown?.components && (
        <ScoreBreakdownPanel components={match.scoreBreakdown.components} />
      )}
    </div>
  );
}

/**
 * Main Hiring Profile Detail Page
 */
export default function HiringProfileDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const [profile, setProfile] = useState<HiringProfile | null>(null);
  const [matches, setMatches] = useState<JobMatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [findingMatches, setFindingMatches] = useState(false);

  // Load profile and stored matches
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [profileData, storedMatches] = await Promise.all([
          getHiringProfile(profileId),
          getJobMatches(profileId).catch(() => [] as JobMatchResult[]),
        ]);
        setProfile(profileData);
        setMatches(storedMatches);
      } catch (error: any) {
        toast({
          title: t.common?.error || 'Error',
          description: error.message || 'Failed to load hiring profile',
          variant: 'error',
        });
        router.push('/opportunities');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profileId, router, t]);

  // Handle find matches
  const handleFindMatches = async () => {
    try {
      setFindingMatches(true);
      const result = await findJobMatches(profileId, { includeExplanations: true });
      setMatches(result.matches);
      toast({
        title: t.opportunities?.matchesFound || 'Matches found',
        description: `${result.total} ${t.opportunities?.potentialMatches || 'potential matches'} found`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: t.common?.error || 'Error',
        description: error.message || 'Failed to find matches',
        variant: 'error',
      });
    } finally {
      setFindingMatches(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Error / not found
  if (!profile) {
    return null;
  }

  const seniorityLabel = getLabelFromOptions(JOB_SENIORITY_OPTIONS, profile.seniority);
  const workModeLabel = getLabelFromOptions(JOB_WORK_MODE_OPTIONS, profile.workMode);
  const employmentLabel = getLabelFromOptions(JOB_EMPLOYMENT_TYPE_OPTIONS, profile.employmentType);
  const urgencyLabel = profile.hiringUrgency
    ? getLabelFromOptions(JOB_HIRING_URGENCY_OPTIONS, profile.hiringUrgency)
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/opportunities')}
        className="flex items-center gap-2 text-th-text-t hover:text-th-text transition-colors text-sm"
      >
        <ArrowLeft24Regular className="w-4 h-4" />
        {t.opportunities?.backToList || 'Back to Jobs'}
      </button>

      {/* Profile Header Card */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          {/* Icon */}
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <PersonAdd24Regular className="w-6 h-6" />
          </div>

          {/* Title + actions */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-th-text truncate">{profile.title}</h1>
              {!profile.isActive && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">
                  Inactive
                </span>
              )}
            </div>
            {profile.fullName && (
              <p className="text-xs text-th-text-s truncate">{profile.fullName}</p>
            )}
          </div>

          <button
            onClick={() => router.push(`/opportunities/hiring/${profileId}/edit`)}
            className="p-2 rounded-lg bg-th-surface-h text-th-text-t hover:text-th-text transition-colors flex-shrink-0"
          >
            <Edit24Regular className="w-4 h-4" />
          </button>
        </div>

        {/* Meta tags */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-th-text-t">
          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {seniorityLabel}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-th-surface-h border border-th-border">
            {profile.roleArea}
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-th-surface-h border border-th-border">
            <Location24Regular className="w-3 h-3" />
            {profile.location}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-th-surface-h border border-th-border">
            {workModeLabel}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-th-surface-h border border-th-border">
            {employmentLabel}
          </span>
          {urgencyLabel && (
            <span className={`px-2 py-0.5 rounded-full border ${
              profile.hiringUrgency === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
              profile.hiringUrgency === 'URGENT' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
              'bg-th-surface-h border-th-border'
            }`}>
              {urgencyLabel}
            </span>
          )}
        </div>

        {/* Created date */}
        <p className="text-[10px] text-th-text-m mt-2 flex items-center gap-1">
          <Clock24Regular className="w-3 h-3" />
          Created {formatRelativeTime(profile.createdAt)}
        </p>

        {/* Job Summary */}
        {profile.jobSummaryRequirements && (
          <div className="mt-3 pt-3 border-t border-th-border">
            <p className="text-[10px] text-th-text-m font-medium uppercase tracking-wider mb-1">Requirements</p>
            <p className="text-xs text-th-text-s leading-relaxed whitespace-pre-line">
              {profile.jobSummaryRequirements}
            </p>
          </div>
        )}

        {/* Skills */}
        {(profile.mustHaveSkills.length > 0 || profile.preferredSkills.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-th-border">
            {profile.mustHaveSkills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium"
              >
                * {skill}
              </span>
            ))}
            {profile.preferredSkills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Additional fields */}
        {(profile.industries.length > 0 ||
          profile.requiredLanguages.length > 0 ||
          profile.requiredCertifications.length > 0 ||
          profile.requiredEducationLevels.length > 0 ||
          profile.salaryRange ||
          profile.minimumYearsExperience) && (
          <div className="mt-3 pt-3 border-t border-th-border space-y-2">
            {profile.industries.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-th-text-m font-medium uppercase">Industries:</span>
                {profile.industries.map((ind, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {ind}
                  </span>
                ))}
              </div>
            )}
            {profile.requiredLanguages.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-th-text-m font-medium uppercase">Languages:</span>
                {profile.requiredLanguages.map((lang, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {lang.language} ({lang.proficiency})
                  </span>
                ))}
              </div>
            )}
            {profile.requiredCertifications.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-th-text-m font-medium uppercase">Certifications:</span>
                {profile.requiredCertifications.map((cert, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {cert}
                  </span>
                ))}
              </div>
            )}
            {profile.requiredEducationLevels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-th-text-m font-medium uppercase">Education:</span>
                {profile.requiredEducationLevels.map((edu, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {edu}
                  </span>
                ))}
              </div>
            )}
            {profile.salaryRange && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-th-text-m font-medium uppercase">Salary:</span>
                <span className="text-xs text-th-text-s">
                  {profile.salaryRange.min && profile.salaryRange.max
                    ? `${profile.salaryRange.min.toLocaleString()} - ${profile.salaryRange.max.toLocaleString()}`
                    : profile.salaryRange.min
                      ? `From ${profile.salaryRange.min.toLocaleString()}`
                      : `Up to ${profile.salaryRange.max?.toLocaleString()}`}
                  {profile.salaryRange.currency ? ` ${profile.salaryRange.currency}` : ''}
                </span>
              </div>
            )}
            {profile.minimumYearsExperience != null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-th-text-m font-medium uppercase">Min Experience:</span>
                <span className="text-xs text-th-text-s">{profile.minimumYearsExperience} years</span>
              </div>
            )}
          </div>
        )}

        {/* Data quality score */}
        <div className="mt-3 pt-3 border-t border-th-border flex items-center gap-2">
          <span className="text-[10px] text-th-text-m font-medium uppercase">Data Quality:</span>
          <div className="flex-1 h-1.5 bg-th-surface-h rounded-full overflow-hidden max-w-[120px]">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${Math.round(profile.dataQualityScore * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-th-text-t tabular-nums">
            {Math.round(profile.dataQualityScore * 100)}%
          </span>
        </div>
      </div>

      {/* Matches Section */}
      <div className="space-y-4">
        {/* Matches Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-1.5">
            <Sparkle24Regular className="w-4 h-4 text-emerald-400" />
            {t.opportunities?.matches || 'Matches'}
          </h2>
          {matches.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-600/20 text-emerald-400">
              {matches.length}
            </span>
          )}
          <button
            onClick={handleFindMatches}
            disabled={findingMatches || !profile.isActive}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors ml-auto"
          >
            {findingMatches ? (
              <ArrowSync24Regular className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkle24Regular className="w-4 h-4" />
            )}
            {t.opportunities?.findMatches || 'Find Matches'}
          </button>
        </div>

        {/* Matches List */}
        {matches.length > 0 ? (
          <div className="grid gap-3">
            {matches.map((match) => (
              <MatchCard key={match.matchId} match={match} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-th-surface rounded-xl border border-th-border">
            <People24Regular className="w-12 h-12 text-white/70 mx-auto mb-3" />
            <p className="text-th-text-t mb-4">
              {t.opportunities?.noMatchesYet || 'No matches yet'}
            </p>
            <button
              onClick={handleFindMatches}
              disabled={findingMatches || !profile.isActive}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {findingMatches ? (
                <ArrowSync24Regular className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkle24Regular className="w-5 h-5" />
              )}
              {t.opportunities?.findMatches || 'Find Matches'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
