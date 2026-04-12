/**
 * Value Objects
 *
 * Immutable objects that represent domain concepts.
 *
 * @module domain/value-objects
 */

/**
 * Proficiency level for skills
 */
export enum ProficiencyLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
}

/**
 * Interest intensity level
 */
export enum Intensity {
  CASUAL = 'CASUAL',
  MODERATE = 'MODERATE',
  PASSIONATE = 'PASSIONATE',
}

/**
 * Goal type
 */
export enum GoalType {
  FIND_MENTOR = 'FIND_MENTOR',
  FIND_PARTNER = 'FIND_PARTNER',
  FIND_INVESTOR = 'FIND_INVESTOR',
  FIND_TALENT = 'FIND_TALENT',
  LEARN_SKILL = 'LEARN_SKILL',
  EXPAND_NETWORK = 'EXPAND_NETWORK',
  FIND_CLIENTS = 'FIND_CLIENTS',
  OTHER = 'OTHER',
}

/**
 * Contact source
 */
export enum ContactSource {
  MANUAL = 'MANUAL',
  CARD_SCAN = 'CARD_SCAN',
  IMPORT = 'IMPORT',
  LINKEDIN = 'LINKEDIN',
  COLLABORATION = 'COLLABORATION',
  EVENT = 'EVENT',
  PHOTO = 'PHOTO',
}

/**
 * Interaction type
 */
export enum InteractionType {
  MEETING = 'MEETING',
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MESSAGE = 'MESSAGE',
  EVENT = 'EVENT',
  OTHER = 'OTHER',
}

/**
 * Consent settings for user data processing
 */
export interface ConsentSettings {
  /**
   * Allow AI-powered matching
   */
  allowMatching: boolean;

  /**
   * Allow data enrichment from external sources
   */
  allowEnrichment: boolean;

  /**
   * Allow analytics and insights
   */
  allowAnalytics: boolean;

  /**
   * Allow marketing communications
   */
  allowMarketing: boolean;

  /**
   * Date consent was last updated
   */
  consentDate: Date;
}

/**
 * Create default consent settings
 */
export function createDefaultConsent(): ConsentSettings {
  return {
    allowMatching: true,
    allowEnrichment: false,
    allowAnalytics: true,
    allowMarketing: false,
    consentDate: new Date(),
  };
}

/**
 * Email value object
 */
export class Email {
  private readonly value: string;

  private constructor(email: string) {
    this.value = email.toLowerCase().trim();
  }

  public static create(email: string): Email {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      throw new Error('Invalid email address');
    }

    return new Email(email);
  }

  public getValue(): string {
    return this.value;
  }

  public getDomain(): string {
    return this.value.split('@')[1];
  }

  public equals(other: Email): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}

/**
 * Match score value object
 */
export class MatchScore {
  private readonly value: number;
  private readonly breakdown: MatchScoreBreakdown;

  private constructor(value: number, breakdown: MatchScoreBreakdown) {
    this.value = value;
    this.breakdown = breakdown;
  }

  public static create(breakdown: MatchScoreBreakdown): MatchScore {
    // Calculate weighted score
    const weights = {
      sectorMatch: 0.25,
      skillMatch: 0.25,
      interestMatch: 0.20,
      goalMatch: 0.15,
      locationMatch: 0.10,
      recency: 0.05,
    };

    const value = Math.round(
      breakdown.sectorMatch * weights.sectorMatch +
      breakdown.skillMatch * weights.skillMatch +
      breakdown.interestMatch * weights.interestMatch +
      breakdown.goalMatch * weights.goalMatch +
      breakdown.locationMatch * weights.locationMatch +
      breakdown.recency * weights.recency
    );

    return new MatchScore(Math.min(100, Math.max(0, value)), breakdown);
  }

  public getValue(): number {
    return this.value;
  }

  public getBreakdown(): MatchScoreBreakdown {
    return { ...this.breakdown };
  }

  public getGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (this.value >= 90) return 'A';
    if (this.value >= 75) return 'B';
    if (this.value >= 60) return 'C';
    if (this.value >= 40) return 'D';
    return 'F';
  }

  public isHighMatch(): boolean {
    return this.value >= 75;
  }
}

/**
 * Match score breakdown
 */
export interface MatchScoreBreakdown {
  sectorMatch: number;
  skillMatch: number;
  interestMatch: number;
  goalMatch: number;
  locationMatch: number;
  recency: number;
}
