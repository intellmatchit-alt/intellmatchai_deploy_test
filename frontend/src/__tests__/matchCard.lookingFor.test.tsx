/**
 * MatchCard tests for the per-Looking-For display contract.
 *
 *   - Renders the totalScore as the headline.
 *   - Renders the bestLookingFor label as a "Best Fit" line.
 *   - Renders every selected per-Looking-For score (does not hide lower scores).
 *   - Falls back gracefully when no per-Looking-For data is provided.
 *   - Falls back to legacy Record<id, score> shape when only that is provided.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MatchCard, type MatchCardData } from '../components/features/matches/MatchCard';
import { en } from '../lib/i18n/en';

function baseCardData(): MatchCardData {
  return {
    id: 'match_1',
    source: 'project',
    sourceTitle: 'Test Project',
    score: 0,
    contactId: 'contact_1',
    name: 'Ahmad Saleh',
    company: 'Acme',
    jobTitle: 'CEO',
    reasons: [],
    sharedSectors: [],
    sharedSkills: [],
    status: 'PENDING',
    channels: {},
  };
}

describe('MatchCard — per-Looking-For display', () => {
  it('shows totalScore as the headline number', () => {
    const data: MatchCardData = {
      ...baseCardData(),
      score: 84,
      lookingForScoreDetails: [
        {
          id: 'investor', label: 'Investor', score: 45, finalScore: 45,
          matchLevel: 'PARTIAL', isBestMatchType: false,
        },
        {
          id: 'advisor', label: 'Advisor', score: 84, finalScore: 84,
          matchLevel: 'VERY_GOOD', isBestMatchType: true,
        },
      ],
      bestLookingForId: 'advisor',
      bestLookingForLabel: 'Advisor',
    };
    render(<MatchCard match={data} t={en} />);
    expect(screen.getByText('84%')).toBeInTheDocument();
  });

  it('shows the Best Fit label when bestLookingForLabel is provided', () => {
    const data: MatchCardData = {
      ...baseCardData(),
      score: 84,
      bestLookingForId: 'advisor',
      bestLookingForLabel: 'Advisor',
    };
    render(<MatchCard match={data} t={en} />);
    expect(screen.getByText(/Best Fit:/)).toBeInTheDocument();
    expect(screen.getByText('Advisor')).toBeInTheDocument();
  });

  it('shows every selected per-Looking-For score (lower ones not hidden)', () => {
    const data: MatchCardData = {
      ...baseCardData(),
      score: 84,
      lookingForScoreDetails: [
        {
          id: 'investor', label: 'Investor', score: 45, finalScore: 45,
          matchLevel: 'PARTIAL', isBestMatchType: false,
        },
        {
          id: 'advisor', label: 'Advisor', score: 84, finalScore: 84,
          matchLevel: 'VERY_GOOD', isBestMatchType: true,
        },
        {
          id: 'strategic_partner', label: 'Strategic Partner', score: 74, finalScore: 74,
          matchLevel: 'VERY_GOOD', isBestMatchType: false,
        },
      ],
      bestLookingForId: 'advisor',
      bestLookingForLabel: 'Advisor',
    };
    render(<MatchCard match={data} t={en} />);
    expect(screen.getByText(/Investor 45%/)).toBeInTheDocument();
    expect(screen.getByText(/Advisor 84%.*Best/)).toBeInTheDocument();
    expect(screen.getByText(/Strategic Partner 74%/)).toBeInTheDocument();
  });

  it('falls back to legacy Record<id, score> shape', () => {
    const data: MatchCardData = {
      ...baseCardData(),
      score: 80,
      lookingForScores: { investor: 80, advisor: 60 },
      lookingForLabels: { investor: 'Investor', advisor: 'Advisor' },
    };
    render(<MatchCard match={data} t={en} />);
    expect(screen.getByText(/Investor 80%/)).toBeInTheDocument();
    expect(screen.getByText(/Advisor 60%/)).toBeInTheDocument();
  });

  it('does not crash when no per-Looking-For data is provided', () => {
    const data: MatchCardData = {
      ...baseCardData(),
      score: 50,
    };
    render(<MatchCard match={data} t={en} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
    // No "Best Fit:" label present.
    expect(screen.queryByText(/Best Fit:/)).not.toBeInTheDocument();
  });

  it('renders the overall explanation summary when present', () => {
    const data: MatchCardData = {
      ...baseCardData(),
      score: 84,
      overallExplanationSummary:
        'This match is ranked Very Good because the Advisor score is the strongest selected Looking For score.',
    };
    render(<MatchCard match={data} t={en} />);
    expect(
      screen.getByText(/strongest selected Looking For score/),
    ).toBeInTheDocument();
  });
});
