/**
 * Contact Entity
 *
 * Core domain entity representing a contact in the user's network.
 *
 * @module domain/entities/Contact
 */

import { ContactSource, InteractionType, ProficiencyLevel, Intensity } from '../value-objects';

/**
 * Contact ID type
 */
export type ContactId = string;

/**
 * Contact Sector relationship
 */
export interface ContactSector {
  sectorId: string;
  sectorName?: string;
  sectorNameAr?: string | null;
  isPrimary: boolean;
}

/**
 * Contact Skill relationship
 */
export interface ContactSkill {
  skillId: string;
  skillName?: string;
  skillNameAr?: string | null;
  proficiency: ProficiencyLevel;
}

/**
 * Contact Interest relationship
 */
export interface ContactInterest {
  interestId: string;
  interestName?: string;
}

/**
 * Contact Hobby relationship
 */
export interface ContactHobby {
  hobbyId: string;
  hobbyName?: string;
}

/**
 * Contact Interaction
 */
export interface ContactInteraction {
  id: string;
  type: InteractionType;
  notes?: string;
  date: Date;
  createdAt: Date;
}

/**
 * Contact properties interface
 */
export interface ContactProps {
  id: ContactId;
  userId: string;
  name: string;
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  bioSummary?: string;
  bioFull?: string;
  avatarUrl?: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  location?: string;
  cardImageUrl?: string;
  source: ContactSource;
  sectors: ContactSector[];
  skills: ContactSkill[];
  interests: ContactInterest[];
  hobbies: ContactHobby[];
  interactions: ContactInteraction[];
  notes?: string;
  isFavorite: boolean;
  matchScore?: number;
  lastContactedAt?: Date;
  enrichmentData?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Contact entity
 */
export class Contact {
  private readonly props: ContactProps;

  private constructor(props: ContactProps) {
    this.props = props;
  }

  /**
   * Create a new contact
   */
  public static create(props: ContactProps): Contact {
    if (!props.name || props.name.trim().length < 1) {
      throw new Error('Contact name is required');
    }

    return new Contact(props);
  }

  /**
   * Reconstitute contact from database
   */
  public static fromPersistence(props: ContactProps): Contact {
    return new Contact(props);
  }

  // Getters
  get id(): ContactId {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
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

  get email(): string | undefined {
    return this.props.email;
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

  get bioSummary(): string | undefined {
    return this.props.bioSummary;
  }

  get bioFull(): string | undefined {
    return this.props.bioFull;
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

  get cardImageUrl(): string | undefined {
    return this.props.cardImageUrl;
  }

  get source(): ContactSource {
    return this.props.source;
  }

  get sectors(): ContactSector[] {
    return [...this.props.sectors];
  }

  get skills(): ContactSkill[] {
    return [...this.props.skills];
  }

  get interests(): ContactInterest[] {
    return [...this.props.interests];
  }

  get hobbies(): ContactHobby[] {
    return [...this.props.hobbies];
  }

  get interactions(): ContactInteraction[] {
    return [...this.props.interactions];
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  get isFavorite(): boolean {
    return this.props.isFavorite;
  }

  get matchScore(): number | undefined {
    return this.props.matchScore;
  }

  get lastContactedAt(): Date | undefined {
    return this.props.lastContactedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get enrichmentData(): Record<string, any> | undefined {
    return this.props.enrichmentData;
  }

  // Business methods

  /**
   * Update basic contact info
   */
  public updateInfo(data: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    bio?: string | null;
    bioSummary?: string | null;
    bioFull?: string | null;
    linkedInUrl?: string | null;
    websiteUrl?: string | null;
    location?: string | null;
    notes?: string | null;
  }): void {
    if (data.name !== undefined) {
      if (data.name && data.name.trim().length < 1) {
        throw new Error('Contact name is required');
      }
      if (data.name) this.props.name = data.name.trim();
    }

    if (data.email !== undefined) this.props.email = data.email || undefined;
    if (data.phone !== undefined) this.props.phone = data.phone || undefined;
    if (data.company !== undefined) this.props.company = data.company || undefined;
    if (data.jobTitle !== undefined) this.props.jobTitle = data.jobTitle || undefined;
    if (data.bio !== undefined) this.props.bio = data.bio || undefined;
    if (data.bioSummary !== undefined) this.props.bioSummary = data.bioSummary || undefined;
    if (data.bioFull !== undefined) this.props.bioFull = data.bioFull || undefined;
    if (data.linkedInUrl !== undefined) this.props.linkedInUrl = data.linkedInUrl || undefined;
    if (data.websiteUrl !== undefined) this.props.websiteUrl = data.websiteUrl || undefined;
    if (data.location !== undefined) this.props.location = data.location || undefined;
    if (data.notes !== undefined) this.props.notes = data.notes || undefined;

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
   * Update sectors
   */
  public updateSectors(sectors: ContactSector[]): void {
    if (sectors.length > 0 && !sectors.some(s => s.isPrimary)) {
      sectors[0].isPrimary = true;
    }
    this.props.sectors = sectors;
    this.props.updatedAt = new Date();
  }

  /**
   * Update skills
   */
  public updateSkills(skills: ContactSkill[]): void {
    this.props.skills = skills;
    this.props.updatedAt = new Date();
  }

  /**
   * Update interests
   */
  public updateInterests(interests: ContactInterest[]): void {
    this.props.interests = interests;
    this.props.updatedAt = new Date();
  }

  /**
   * Update hobbies
   */
  public updateHobbies(hobbies: ContactHobby[]): void {
    this.props.hobbies = hobbies;
    this.props.updatedAt = new Date();
  }

  /**
   * Add an interaction
   */
  public addInteraction(interaction: ContactInteraction): void {
    this.props.interactions.push(interaction);
    this.props.lastContactedAt = interaction.date;
    this.props.updatedAt = new Date();
  }

  /**
   * Toggle favorite status
   */
  public toggleFavorite(): void {
    this.props.isFavorite = !this.props.isFavorite;
    this.props.updatedAt = new Date();
  }

  /**
   * Set match score
   */
  public setMatchScore(score: number): void {
    this.props.matchScore = Math.min(100, Math.max(0, score));
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
   * Get days since last contact
   */
  public getDaysSinceLastContact(): number | null {
    if (!this.props.lastContactedAt) return null;
    const diff = Date.now() - this.props.lastContactedAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if follow-up is needed (more than 30 days)
   */
  public needsFollowUp(): boolean {
    const days = this.getDaysSinceLastContact();
    return days !== null && days > 30;
  }

  /**
   * Convert to plain object
   */
  public toObject(): ContactProps {
    return { ...this.props };
  }
}
