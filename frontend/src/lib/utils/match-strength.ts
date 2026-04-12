/**
 * Standardized match strength labels and colors.
 * Used across all match types (Project, Opportunity, Pitch, Deal, Profile).
 */

export type MatchStrength = 'excellent' | 'strong' | 'very_good' | 'good' | 'weak';

export interface MatchStrengthInfo {
  label: string;
  strength: MatchStrength;
  textClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
}

/**
 * Standard match strength tiers (used across all matching: project, deal, pitch, job):
 *   Excellent  — 90–100
 *   Strong     — 75–89
 *   Very Good  — 60–74
 *   Good       — 40–59
 *   Weak       — 0–39
 */
export function getMatchStrength(score: number | undefined | null): MatchStrengthInfo {
  if (score === undefined || score === null || score <= 0) {
    return {
      label: 'Weak',
      strength: 'weak',
      textClass: 'text-[#EF4444]',
      bgClass: 'bg-[#EF4444]',
      borderClass: 'border-[#EF4444]',
      badgeClass: 'bg-[#EF4444] text-black border border-[#EF4444]',
    };
  }

  if (score >= 90) {
    return {
      label: 'Excellent',
      strength: 'excellent',
      textClass: 'text-[#22C55E]',
      bgClass: 'bg-[#22C55E]',
      borderClass: 'border-[#22C55E]',
      badgeClass: 'bg-[#22C55E] text-black border border-[#22C55E]',
    };
  }

  if (score >= 75) {
    return {
      label: 'Strong',
      strength: 'strong',
      textClass: 'text-[#84CC16]',
      bgClass: 'bg-[#84CC16]',
      borderClass: 'border-[#84CC16]',
      badgeClass: 'bg-[#84CC16] text-black border border-[#84CC16]',
    };
  }

  if (score >= 60) {
    return {
      label: 'Very Good',
      strength: 'very_good',
      textClass: 'text-[#FACC15]',
      bgClass: 'bg-[#FACC15]',
      borderClass: 'border-[#FACC15]',
      badgeClass: 'bg-[#FACC15] text-black border border-[#FACC15]',
    };
  }

  if (score >= 40) {
    return {
      label: 'Good',
      strength: 'good',
      textClass: 'text-[#FB923C]',
      bgClass: 'bg-[#FB923C]',
      borderClass: 'border-[#FB923C]',
      badgeClass: 'bg-[#FB923C] text-black border border-[#FB923C]',
    };
  }

  return {
    label: 'Weak',
    strength: 'weak',
    textClass: 'text-[#EF4444]',
    bgClass: 'bg-[#EF4444]',
    borderClass: 'border-[#EF4444]',
    badgeClass: 'bg-[#EF4444] text-black border border-[#EF4444]',
  };
}

/** Compact badge component markup helper */
export function matchStrengthBadge(score: number | undefined | null): { label: string; className: string } {
  const info = getMatchStrength(score);
  return {
    label: `${score ?? 0}% - ${info.label}`,
    className: `px-2 py-0.5 rounded-full text-xs font-medium ${info.badgeClass}`,
  };
}
