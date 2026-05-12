/**
 * Candidate Profile Detail Page
 *
 * Displays a candidate profile with all fields and any stored job matches.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  ArrowSync24Regular,
  Edit24Regular,
  Person24Regular,
  Briefcase24Regular,
  Location24Regular,
  Clock24Regular,
  Certificate24Regular,
  BookOpen24Regular,
  Translate24Regular,
  Star24Regular,
  Building24Regular,
  Money24Regular,
  Timer24Regular,
  Sparkle24Regular,
} from '@fluentui/react-icons';
import {
  getCandidateProfile,
  CandidateProfile,
  JOB_SENIORITY_OPTIONS,
  JOB_WORK_MODE_OPTIONS,
  JOB_EMPLOYMENT_TYPE_OPTIONS,
  JOB_AVAILABILITY_OPTIONS,
  LANGUAGE_PROFICIENCY_OPTIONS,
  MATCH_LEVEL_COLORS,
  MATCH_LEVEL_LABELS,
  JobMatchLevel,
  LanguageSkill,
  EducationEntry,
  RelevantExperienceEntry,
  SalaryRange,
} from '@/lib/api/job-matching';
import { toast } from '@/components/ui/Toast';

/**
 * Helper to look up a label from an options array
 */
function optionLabel(options: readonly { id: string; label: string }[], id: string): string {
  return options.find((o) => o.id === id)?.label || id;
}

/**
 * Format salary range for display
 */
function formatSalary(salary: SalaryRange): string {
  const parts: string[] = [];
  if (salary.min && salary.max) {
    parts.push(`${salary.min.toLocaleString()} - ${salary.max.toLocaleString()}`);
  } else if (salary.min) {
    parts.push(`From ${salary.min.toLocaleString()}`);
  } else if (salary.max) {
    parts.push(`Up to ${salary.max.toLocaleString()}`);
  }
  if (salary.currency) parts.push(salary.currency);
  return parts.join(' ');
}

export default function CandidateDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const candidateId = params.id as string;

  const [profile, setProfile] = useState<(CandidateProfile & { jobMatches?: any[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);
        const data = await getCandidateProfile(candidateId);
        setProfile(data as any);
      } catch (err: any) {
        const msg = err.message || 'Failed to load candidate profile';
        setError(msg);
        toast({
          title: t.common?.error || 'Error',
          description: msg,
          variant: 'error',
        });
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [candidateId, t]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ArrowSync24Regular className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-6">
        <button
          onClick={() => router.push('/opportunities')}
          className="flex items-center gap-2 text-th-text-t hover:text-th-text transition-colors text-sm"
        >
          <ArrowLeft24Regular className="w-4 h-4" />
          Back to Opportunities
        </button>
        <div className="text-center py-16 bg-th-surface rounded-xl border border-th-border">
          <Person24Regular className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <p className="text-th-text-t">{error || 'Candidate profile not found'}</p>
          <button
            onClick={() => router.push('/opportunities')}
            className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const seniorityLabel = optionLabel(JOB_SENIORITY_OPTIONS, profile.seniority);
  const availabilityLabel = profile.availability
    ? optionLabel(JOB_AVAILABILITY_OPTIONS, profile.availability)
    : null;
  const workModeLabels = profile.desiredWorkMode.map((wm) => optionLabel(JOB_WORK_MODE_OPTIONS, wm));
  const employmentLabels = profile.desiredEmploymentType.map((et) => optionLabel(JOB_EMPLOYMENT_TYPE_OPTIONS, et));

  const jobMatches: any[] = profile.jobMatches || [];

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/opportunities')}
        className="flex items-center gap-2 text-th-text-t hover:text-th-text transition-colors text-sm"
      >
        <ArrowLeft24Regular className="w-4 h-4" />
        Back to Opportunities
      </button>

      {/* Header Card */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Person24Regular className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-th-text truncate">{profile.title}</h1>
            {profile.fullName && (
              <p className="text-sm text-th-text-s truncate">{profile.fullName}</p>
            )}
          </div>
          <button
            onClick={() => router.push(`/opportunities/candidate/${candidateId}/edit`)}
            className="p-2 rounded-lg bg-th-surface-h text-th-text-t hover:text-th-text transition-colors flex-shrink-0"
          >
            <Edit24Regular className="w-4 h-4" />
          </button>
        </div>

        {/* Meta tags */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-th-text-t">
          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
            {seniorityLabel}
          </span>
          {profile.roleArea && (
            <span className="px-2 py-0.5 rounded-full bg-th-surface-h border border-th-border">
              {profile.roleArea}
            </span>
          )}
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-th-surface-h border border-th-border">
            <Location24Regular className="w-3 h-3" />
            {profile.location}
          </span>
          {!profile.isActive && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">
              Inactive
            </span>
          )}
        </div>

        {/* Data quality score */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-th-text-m font-medium uppercase">Profile Quality:</span>
          <div className="flex-1 max-w-[120px] h-1.5 bg-th-surface-h rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                profile.dataQualityScore >= 70
                  ? 'bg-emerald-500'
                  : profile.dataQualityScore >= 40
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${profile.dataQualityScore}%` }}
            />
          </div>
          <span className="text-xs text-th-text-s">{profile.dataQualityScore}%</span>
        </div>
      </div>

      {/* Preferences Card */}
      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-th-text flex items-center gap-2">
          <Briefcase24Regular className="w-4 h-4 text-emerald-400" />
          Preferences
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Desired Work Modes */}
          <div>
            <span className="text-[10px] text-th-text-m font-medium uppercase">Work Mode</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {workModeLabels.map((label) => (
                <span key={label} className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Desired Employment Types */}
          <div>
            <span className="text-[10px] text-th-text-m font-medium uppercase">Employment Type</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {employmentLabels.map((label) => (
                <span key={label} className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Availability */}
          {availabilityLabel && (
            <div>
              <span className="text-[10px] text-th-text-m font-medium uppercase">Availability</span>
              <div className="flex items-center gap-1 mt-1">
                <Clock24Regular className="w-3.5 h-3.5 text-th-text-t" />
                <span className="text-xs text-th-text-s">{availabilityLabel}</span>
              </div>
            </div>
          )}

          {/* Years of Experience */}
          {profile.yearsOfExperience != null && (
            <div>
              <span className="text-[10px] text-th-text-m font-medium uppercase">Experience</span>
              <p className="text-xs text-th-text-s mt-1">{profile.yearsOfExperience} years</p>
            </div>
          )}

          {/* Notice Period */}
          {profile.noticePeriod != null && (
            <div>
              <span className="text-[10px] text-th-text-m font-medium uppercase">Notice Period</span>
              <div className="flex items-center gap-1 mt-1">
                <Timer24Regular className="w-3.5 h-3.5 text-th-text-t" />
                <span className="text-xs text-th-text-s">{profile.noticePeriod} days</span>
              </div>
            </div>
          )}

          {/* Salary Expectation */}
          {profile.expectedSalary && (
            <div>
              <span className="text-[10px] text-th-text-m font-medium uppercase">Expected Salary</span>
              <div className="flex items-center gap-1 mt-1">
                <Money24Regular className="w-3.5 h-3.5 text-th-text-t" />
                <span className="text-xs text-th-text-s">{formatSalary(profile.expectedSalary)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Skills Card */}
      {profile.skills.length > 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2 mb-3">
            <Star24Regular className="w-4 h-4 text-emerald-400" />
            Skills
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="px-2.5 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Profile Summary Card */}
      {profile.profileSummaryPreferences && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-th-text mb-2">Profile Summary</h2>
          <p className="text-sm text-th-text-s leading-relaxed whitespace-pre-wrap">
            {profile.profileSummaryPreferences}
          </p>
        </div>
      )}

      {/* Languages Card */}
      {profile.languages.length > 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2 mb-3">
            <Translate24Regular className="w-4 h-4 text-emerald-400" />
            Languages
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.languages.map((lang: LanguageSkill, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-th-surface-h border border-th-border"
              >
                <span className="text-sm text-th-text font-medium">{lang.language}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {optionLabel(LANGUAGE_PROFICIENCY_OPTIONS, lang.proficiency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education Card */}
      {profile.education.length > 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2 mb-3">
            <BookOpen24Regular className="w-4 h-4 text-emerald-400" />
            Education
          </h2>
          <div className="space-y-2">
            {profile.education.map((edu: EducationEntry, i: number) => (
              <div
                key={i}
                className="px-3 py-2 rounded-lg bg-th-surface-h border border-th-border"
              >
                <p className="text-sm text-th-text font-medium">
                  {edu.degree} in {edu.field}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {edu.institution && (
                    <span className="text-xs text-th-text-t">{edu.institution}</span>
                  )}
                  {edu.year && (
                    <span className="text-xs text-th-text-m">{edu.year}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications Card */}
      {profile.certifications.length > 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2 mb-3">
            <Certificate24Regular className="w-4 h-4 text-emerald-400" />
            Certifications
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {profile.certifications.map((cert: string, i: number) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              >
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Industries Card */}
      {profile.industries.length > 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2 mb-3">
            <Building24Regular className="w-4 h-4 text-emerald-400" />
            Industries
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {profile.industries.map((ind: string, i: number) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20"
              >
                {ind}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Relevant Experience Card */}
      {profile.relevantExperience.length > 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2 mb-3">
            <Briefcase24Regular className="w-4 h-4 text-emerald-400" />
            Relevant Experience
          </h2>
          <div className="space-y-2">
            {profile.relevantExperience.map((exp: RelevantExperienceEntry, i: number) => (
              <div
                key={i}
                className="px-3 py-2 rounded-lg bg-th-surface-h border border-th-border"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-th-text font-medium">{exp.roleFamily}</p>
                  <span className="text-xs text-th-text-t">{exp.years} yr{exp.years !== 1 ? 's' : ''}</span>
                </div>
                {exp.domain && (
                  <p className="text-xs text-th-text-t mt-0.5">{exp.domain}</p>
                )}
                {exp.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {exp.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job Matches Card */}
      {jobMatches.length > 0 && (
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2 mb-3">
            <Sparkle24Regular className="w-4 h-4 text-emerald-400" />
            Job Matches
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-600/20 text-emerald-400">
              {jobMatches.length}
            </span>
          </h2>
          <div className="space-y-2">
            {jobMatches.map((match: any) => {
              const level = (match.matchLevel as JobMatchLevel) || 'GOOD';
              const levelColor = MATCH_LEVEL_COLORS[level] || MATCH_LEVEL_COLORS.GOOD;
              const levelLabel = MATCH_LEVEL_LABELS[level] || level;
              const reasons: string[] = Array.isArray(match.keyReasons)
                ? match.keyReasons
                : typeof match.keyReasons === 'string'
                  ? [match.keyReasons]
                  : [];

              return (
                <div
                  key={match.id}
                  className="px-3 py-3 rounded-lg bg-th-surface-h border border-th-border"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-th-text">
                        {Math.round(match.finalScore)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${levelColor}`}>
                        {levelLabel}
                      </span>
                    </div>
                    <span className="text-[10px] text-th-text-m">
                      Rank #{match.rank}
                    </span>
                  </div>

                  {reasons.length > 0 && (
                    <ul className="space-y-0.5 mt-1">
                      {reasons.slice(0, 4).map((reason: string, idx: number) => (
                        <li key={idx} className="text-xs text-th-text-s flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5 flex-shrink-0">*</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  )}

                  {match.explanation?.summary_explanation && (
                    <p className="text-xs text-th-text-t mt-2 leading-relaxed">
                      {match.explanation.summary_explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
