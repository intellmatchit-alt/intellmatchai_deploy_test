/**
 * User Entity
 *
 * Core domain entity representing a user in the system.
 * Contains business logic and validation rules.
 *
 * @module domain/entities/User
 */

import { ConsentSettings, GoalType, ProficiencyLevel, Intensity } from '../value-objects';

/**
 * User ID type
 */
export type UserId = string;

/**
 * User Sector relationship
 */
export interface UserSector {
  sectorId: string;
  isPrimary: boolean;
}

/**
 * User Skill relationship
 */
export interface UserSkill {
  skillId: string;
  proficiency: ProficiencyLevel;
}

/**
 * User Interest relationship
 */
export interface UserInterest {
  interestId: string;
  intensity: Intensity;
}

/**
 * User Goal
 */
export interface UserGoal {
  id: string;
  type: GoalType;
  description: string;
  targetDate?: Date;
  isActive: boolean;
}

/**
 * User properties interface
 */
export interface UserProps {
  id: UserId;
  email: string;
  passwordHash: string;
  name: string;
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  avatarUrl?: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  location?: string;
  preferredLocale: string;
  consent: ConsentSettings;
  sectors: UserSector[];
  skills: UserSkill[];
  interests: UserInterest[];
  goals: UserGoal[];
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User entity
 */
export class User {
  private readonly props: UserProps;

  private constructor(props: UserProps) {
    this.props = props;
  }

  /**
   * Create a new user
   */
  public static create(props: UserProps): User {
    // Validate required fields
    if (!props.email || !props.email.includes('@')) {
      throw new Error('Invalid email address');
    }

    if (!props.name || props.name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters');
    }

    if (!props.passwordHash) {
      throw new Error('Password hash is required');
    }

    return new User(props);
  }

  /**
   * Reconstitute user from database
   */
  public static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  // Getters
  get id(): UserId {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get name(): string {
    return this.props.name;
  }

  get title(): string | undefined {
    return this.props.title;
  }

  get firstName(): string | undefined {
    return this.props.firstName;
  }

  get middleName(): string | undefined {
    return this.props.middleName;
  }

  get lastName(): string | undefined {
    return this.props.lastName;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get company(): string | undefined {
    return this.props.company;
  }

  get jobTitle(): string | undefined {
    return this.props.jobTitle;
  }

  get bio(): string | undefined {
    return this.props.bio;
  }

  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  get linkedInUrl(): string | undefined {
    return this.props.linkedInUrl;
  }

  get websiteUrl(): string | undefined {
    return this.props.websiteUrl;
  }

  get location(): string | undefined {
    return this.props.location;
  }

  get preferredLocale(): string {
    return this.props.preferredLocale;
  }

  get consent(): ConsentSettings {
    return this.props.consent;
  }

  get sectors(): UserSector[] {
    return [...this.props.sectors];
  }

  get skills(): UserSkill[] {
    return [...this.props.skills];
  }

  get interests(): UserInterest[] {
    return [...this.props.interests];
  }

  get goals(): UserGoal[] {
    return [...this.props.goals];
  }

  get isEmailVerified(): boolean {
    return this.props.isEmailVerified;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get lastLoginAt(): Date | undefined {
    return this.props.lastLoginAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods

  /**
   * Update profile information
   */
  public updateProfile(data: {
    name?: string;
    title?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    bio?: string;
    linkedInUrl?: string;
    websiteUrl?: string;
    location?: string;
  }): void {
    if (data.name !== undefined) {
      if (data.name.trim().length < 2) {
        throw new Error('Name must be at least 2 characters');
      }
      this.props.name = data.name.trim();
    }

    if (data.title !== undefined) this.props.title = data.title;
    if (data.firstName !== undefined) this.props.firstName = data.firstName;
    if (data.middleName !== undefined) this.props.middleName = data.middleName;
    if (data.lastName !== undefined) this.props.lastName = data.lastName;
    if (data.phone !== undefined) this.props.phone = data.phone;
    if (data.company !== undefined) this.props.company = data.company;
    if (data.jobTitle !== undefined) this.props.jobTitle = data.jobTitle;
    if (data.bio !== undefined) this.props.bio = data.bio;
    if (data.linkedInUrl !== undefined) this.props.linkedInUrl = data.linkedInUrl;
    if (data.websiteUrl !== undefined) this.props.websiteUrl = data.websiteUrl;
    if (data.location !== undefined) this.props.location = data.location;

    this.props.updatedAt = new Date();
  }

  /**
   * Update avatar URL
   */
  public updateAvatar(avatarUrl: string): void {
    this.props.avatarUrl = avatarUrl;
    this.props.updatedAt = new Date();
  }

  /**
   * Update password hash
   */
  public updatePasswordHash(passwordHash: string): void {
    this.props.passwordHash = passwordHash;
    this.props.updatedAt = new Date();
  }

  /**
   * Update consent settings
   */
  public updateConsent(consent: Partial<ConsentSettings>): void {
    this.props.consent = {
      ...this.props.consent,
      ...consent,
    };
    this.props.updatedAt = new Date();
  }

  /**
   * Update preferred locale
   */
  public updateLocale(locale: string): void {
    this.props.preferredLocale = locale;
    this.props.updatedAt = new Date();
  }

  /**
   * Update sectors
   */
  public updateSectors(sectors: UserSector[]): void {
    // Ensure at least one primary sector if sectors exist
    if (sectors.length > 0 && !sectors.some(s => s.isPrimary)) {
      sectors[0].isPrimary = true;
    }

    this.props.sectors = sectors;
    this.props.updatedAt = new Date();
  }

  /**
   * Update skills
   */
  public updateSkills(skills: UserSkill[]): void {
    this.props.skills = skills;
    this.props.updatedAt = new Date();
  }

  /**
   * Update interests
   */
  public updateInterests(interests: UserInterest[]): void {
    this.props.interests = interests;
    this.props.updatedAt = new Date();
  }

  /**
   * Add a goal
   */
  public addGoal(goal: UserGoal): void {
    this.props.goals.push(goal);
    this.props.updatedAt = new Date();
  }

  /**
   * Remove a goal
   */
  public removeGoal(goalId: string): void {
    this.props.goals = this.props.goals.filter(g => g.id !== goalId);
    this.props.updatedAt = new Date();
  }

  /**
   * Mark email as verified
   */
  public verifyEmail(): void {
    this.props.isEmailVerified = true;
    this.props.updatedAt = new Date();
  }

  /**
   * Record login
   */
  public recordLogin(): void {
    this.props.lastLoginAt = new Date();
    this.props.updatedAt = new Date();
  }

  /**
   * Deactivate user
   */
  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  /**
   * Activate user
   */
  public activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  /**
   * Get primary sector ID
   */
  public getPrimarySectorId(): string | undefined {
    const primary = this.props.sectors.find(s => s.isPrimary);
    return primary?.sectorId;
  }

  /**
   * Check if user has completed onboarding
   */
  public hasCompletedOnboarding(): boolean {
    return (
      this.props.sectors.length > 0 &&
      this.props.skills.length > 0 &&
      this.props.interests.length > 0
    );
  }

  /**
   * Convert to plain object for persistence
   */
  public toObject(): UserProps {
    return { ...this.props };
  }

  /**
   * Convert to public profile (without sensitive data)
   */
  public toPublicProfile(): Omit<UserProps, 'passwordHash'> {
    const { passwordHash, ...publicProps } = this.props;
    return publicProps;
  }
}
