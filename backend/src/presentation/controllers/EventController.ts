/**
 * Event Controller
 *
 * Handles HTTP requests for event QR & matching endpoints.
 *
 * @module presentation/controllers/EventController
 */

import { Request, Response, NextFunction } from 'express';
import crypto, { randomBytes } from 'crypto';
import { prisma } from '../../infrastructure/database/prisma/client';
import { AuthenticationError, NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { qrCodeService } from '../../infrastructure/services/QRCodeService';
import { getStorageService } from '../../infrastructure/external/storage';
import { hashPassword, validatePassword } from '../../infrastructure/auth/password';
import { generateTokenPair } from '../../infrastructure/auth/jwt';
import { EmailService } from '../../infrastructure/services/EmailService';
import { eventMatchingService } from '../../infrastructure/services/event';
import { queueService, QueueName, EventMatchingJobData } from '../../infrastructure/queue/QueueService';

/**
 * Generate a unique event code (8 characters, alphanumeric)
 */
function generateUniqueCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Generate a guest access token
 */
function generateAccessToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Event Controller
 */
export class EventController {
  /**
   * Create a new event
   * POST /api/v1/events
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { name, description, dateTime, location, locationLat, locationLng, thumbnailUrl, welcomeMessage } = req.body;

      // Generate unique code, retry if collision
      let uniqueCode: string;
      let attempts = 0;
      do {
        uniqueCode = generateUniqueCode();
        const existing = await prisma.event.findUnique({ where: { uniqueCode } });
        if (!existing) break;
        attempts++;
      } while (attempts < 5);

      if (attempts >= 5) {
        throw new ValidationError('Failed to generate unique event code');
      }

      const event = await prisma.event.create({
        data: {
          hostId: req.user.userId,
          name,
          description,
          dateTime: new Date(dateTime),
          location,
          locationLat: locationLat ? parseFloat(locationLat) : null,
          locationLng: locationLng ? parseFloat(locationLng) : null,
          thumbnailUrl,
          welcomeMessage,
          uniqueCode,
        },
      });

      logger.info(`Event created: ${event.id} by user ${req.user.userId}`);

      res.status(201).json({
        success: true,
        data: {
          event,
          eventUrl: `${process.env.FRONTEND_URL || 'https://intellmatch.com'}/e/${uniqueCode}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List user's events (as host)
   * GET /api/v1/events
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const status = req.query.status as string;

      const where: any = { hostId: req.user.userId };

      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      }

      const [events, total] = await Promise.all([
        prisma.event.findMany({
          where,
          include: {
            _count: { select: { attendees: true } },
          },
          orderBy: { dateTime: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.event.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          events: events.map(e => ({
            ...e,
            attendeeCount: e._count.attendees,
            eventUrl: `${process.env.FRONTEND_URL || 'https://intellmatch.com'}/e/${e.uniqueCode}`,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get event details
   * GET /api/v1/events/:id
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { id } = req.params;

      const event = await prisma.event.findFirst({
        where: { id, hostId: req.user.userId },
        include: {
          _count: { select: { attendees: true } },
        },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      res.status(200).json({
        success: true,
        data: {
          event: {
            ...event,
            attendeeCount: event._count.attendees,
            eventUrl: `${process.env.FRONTEND_URL || 'https://intellmatch.com'}/e/${event.uniqueCode}`,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update event
   * PUT /api/v1/events/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { id } = req.params;
      const { name, description, dateTime, location, locationLat, locationLng, thumbnailUrl, welcomeMessage, isActive } = req.body;

      // Verify ownership
      const existing = await prisma.event.findFirst({
        where: { id, hostId: req.user.userId },
      });

      if (!existing) {
        throw new NotFoundError('Event not found');
      }

      const event = await prisma.event.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(dateTime !== undefined && { dateTime: new Date(dateTime) }),
          ...(location !== undefined && { location }),
          ...(locationLat !== undefined && { locationLat: locationLat ? parseFloat(locationLat) : null }),
          ...(locationLng !== undefined && { locationLng: locationLng ? parseFloat(locationLng) : null }),
          ...(thumbnailUrl !== undefined && { thumbnailUrl }),
          ...(welcomeMessage !== undefined && { welcomeMessage }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      res.status(200).json({
        success: true,
        data: { event },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete event
   * DELETE /api/v1/events/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { id } = req.params;

      // Verify ownership
      const existing = await prisma.event.findFirst({
        where: { id, hostId: req.user.userId },
      });

      if (!existing) {
        throw new NotFoundError('Event not found');
      }

      await prisma.event.delete({ where: { id } });

      logger.info(`Event deleted: ${id} by user ${req.user.userId}`);

      res.status(200).json({
        success: true,
        message: 'Event deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get event attendees (for host)
   * GET /api/v1/events/:id/attendees
   */
  async getAttendees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { id } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const search = req.query.search as string;

      // Verify ownership
      const event = await prisma.event.findFirst({
        where: { id, hostId: req.user.userId },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      const where: any = { eventId: id };

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { company: { contains: search } },
        ];
      }

      const [attendees, total] = await Promise.all([
        prisma.eventAttendee.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.eventAttendee.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          attendees,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export attendees
   * POST /api/v1/events/:id/attendees/export
   */
  async exportAttendees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { id } = req.params;
      const format = (req.query.format as string) || 'csv';

      // Verify ownership
      const event = await prisma.event.findFirst({
        where: { id, hostId: req.user.userId },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      const attendees = await prisma.eventAttendee.findMany({
        where: { eventId: id },
        orderBy: { createdAt: 'asc' },
      });

      if (format === 'json') {
        res.status(200).json({
          success: true,
          data: { attendees },
        });
      } else {
        // CSV format
        const headers = ['Name', 'Email', 'Mobile', 'Company', 'Role', 'Bio', 'Looking For', 'Registered At'];
        const rows = attendees.map(a => [
          a.name,
          a.email,
          a.mobile || '',
          a.company || '',
          a.role || '',
          (a.bio || '').replace(/"/g, '""'),
          (a.lookingFor || '').replace(/"/g, '""'),
          a.createdAt.toISOString(),
        ]);

        const csv = [
          headers.join(','),
          ...rows.map(r => r.map(c => `"${c}"`).join(',')),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${event.name}-attendees.csv"`);
        res.status(200).send(csv);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add attendees to host's contacts
   * POST /api/v1/events/:id/attendees/add-to-contacts
   */
  async addToContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { id } = req.params;
      const { attendeeIds } = req.body;

      // Verify ownership
      const event = await prisma.event.findFirst({
        where: { id, hostId: req.user.userId },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      // Get attendees
      const whereAttendees: any = { eventId: id, isHost: false };
      if (attendeeIds && attendeeIds.length > 0) {
        whereAttendees.id = { in: attendeeIds };
      }

      const attendees = await prisma.eventAttendee.findMany({
        where: whereAttendees,
      });

      // Check for existing contacts by email
      const existingContacts = await prisma.contact.findMany({
        where: {
          ownerId: req.user.userId,
          email: { in: attendees.map(a => a.email) },
        },
        select: { email: true },
      });

      const existingEmails = new Set(existingContacts.map(c => c.email));

      // Create contacts for attendees not already in contacts
      const newContacts = attendees
        .filter(a => !existingEmails.has(a.email))
        .map(a => ({
          ownerId: req.user!.userId,
          fullName: a.name,
          email: a.email,
          phone: a.mobile,
          company: a.company,
          jobTitle: a.role,
          bio: a.bio,
          source: 'EVENT' as const,
          notes: `Met at event: ${event.name}\nLooking for: ${a.lookingFor || 'N/A'}`,
          rawSources: JSON.stringify([{ type: 'event', eventId: event.id, attendeeId: a.id }]),
        }));

      if (newContacts.length > 0) {
        await prisma.contact.createMany({ data: newContacts });
      }

      logger.info(`Added ${newContacts.length} contacts from event ${id}`);

      res.status(200).json({
        success: true,
        data: {
          added: newContacts.length,
          skipped: existingEmails.size,
          total: attendees.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Invite attendees to IntellMatch
   * POST /api/v1/events/:id/invite-all
   */
  async inviteAttendees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { id } = req.params;
      const { attendeeIds, message } = req.body;

      // Verify ownership and get host info
      const event = await prisma.event.findFirst({
        where: { id, hostId: req.user.userId },
        include: {
          host: true,
        },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      // Get attendees
      const whereAttendees: any = { eventId: id, isHost: false };
      if (attendeeIds && attendeeIds.length > 0) {
        whereAttendees.id = { in: attendeeIds };
      }

      const attendees = await prisma.eventAttendee.findMany({
        where: whereAttendees,
        select: { email: true, name: true },
      });

      // Check which are already users
      const existingUsers = await prisma.user.findMany({
        where: { email: { in: attendees.map(a => a.email) } },
        select: { email: true },
      });

      const existingEmails = new Set(existingUsers.map(u => u.email));
      const toInvite = attendees.filter(a => !existingEmails.has(a.email));

      // Send invitation emails
      const emailService = new EmailService();
      const frontendUrl = process.env.FRONTEND_URL || 'https://intellmatch.com';
      const eventDate = new Date(event.dateTime);

      const { sent, failed } = await emailService.sendBulkEventInvitations(
        toInvite,
        {
          hostName: event.host.fullName,
          eventName: event.name,
          eventDate: eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          eventLocation: event.location || undefined,
          eventDescription: event.description || undefined,
          registerUrl: `${frontendUrl}/register`,
          customMessage: message || undefined,
        }
      );

      logger.info(`Event invitations sent: ${sent} successful, ${failed} failed for event ${id}`);

      res.status(200).json({
        success: true,
        data: {
          toInvite: toInvite.length,
          alreadyUsers: existingEmails.size,
          emailsSent: sent,
          emailsFailed: failed,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get public event info (no auth required)
   * GET /api/v1/events/public/:code
   */
  async getPublicEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;

      const event = await prisma.event.findUnique({
        where: { uniqueCode: code },
        select: {
          id: true,
          name: true,
          description: true,
          dateTime: true,
          location: true,
          locationLat: true,
          locationLng: true,
          thumbnailUrl: true,
          welcomeMessage: true,
          isActive: true,
          _count: { select: { attendees: true } },
        },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      if (!event.isActive) {
        throw new ValidationError('This event is no longer active');
      }

      res.status(200).json({
        success: true,
        data: {
          event: {
            id: event.id,
            name: event.name,
            description: event.description,
            dateTime: event.dateTime,
            location: event.location,
            locationLat: event.locationLat,
            locationLng: event.locationLng,
            thumbnailUrl: event.thumbnailUrl,
            welcomeMessage: event.welcomeMessage,
            attendeeCount: event._count.attendees,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Register as guest for an event (no auth required)
   * POST /api/v1/events/public/:code/register
   */
  async registerGuest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const { name, email, mobile, company, role, bio, lookingFor, password } = req.body;

      const event = await prisma.event.findUnique({
        where: { uniqueCode: code },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      if (!event.isActive) {
        throw new ValidationError('This event is no longer active');
      }

      // Check if already registered as attendee
      const existing = await prisma.eventAttendee.findFirst({
        where: { eventId: event.id, email },
      });

      if (existing) {
        // Return existing with new token
        const accessToken = generateAccessToken();
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.eventAttendee.update({
          where: { id: existing.id },
          data: { accessToken, tokenExpiry },
        });

        res.status(200).json({
          success: true,
          message: 'Already registered',
          data: {
            attendee: { ...existing, accessToken },
            accessToken,
          },
        });
        return;
      }

      // Check if user exists with this email
      let existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      let newUserCreated = false;
      let authTokens: { accessToken: string; refreshToken: string } | null = null;

      // If password provided and no existing user, create account
      if (password && !existingUser) {
        // Validate password
        const validation = validatePassword(password);
        if (!validation.isValid) {
          throw new ValidationError(validation.errors.join('. '));
        }

        const hashedPassword = await hashPassword(password);

        // Extract first/last name from full name
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Create user account
        const newUser = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            passwordHash: hashedPassword,
            firstName,
            lastName,
            fullName: name,
            company: company || null,
            jobTitle: role || null,
            phone: mobile || null,
            bio: bio || null,
            emailVerified: false, // Can verify later
            onboardingStep: 0, // Can complete onboarding later
          },
        });

        existingUser = { id: newUser.id };
        newUserCreated = true;

        // Generate auth tokens for the new user
        authTokens = generateTokenPair(newUser.id, newUser.email);

        logger.info(`New user account created during event registration: ${email}`);
      }

      // Generate access token for event
      const accessToken = generateAccessToken();
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const attendee = await prisma.eventAttendee.create({
        data: {
          eventId: event.id,
          userId: existingUser?.id || null,
          email,
          name,
          mobile,
          company,
          role,
          bio,
          lookingFor,
          accessToken,
          tokenExpiry,
        },
      });

      // Run matching with all other attendees
      await this.runMatchingForAttendee(attendee.id, event.id);

      logger.info(`Guest registered for event ${event.id}: ${email}`);

      res.status(201).json({
        success: true,
        data: {
          attendee: { ...attendee, accessToken },
          accessToken,
          // Include auth tokens if new account was created
          ...(newUserCreated && authTokens && {
            userCreated: true,
            authToken: authTokens.accessToken,
            refreshToken: authTokens.refreshToken,
          }),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Join event as authenticated user
   * POST /api/v1/events/public/:code/join
   */
  async joinEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { code } = req.params;

      const event = await prisma.event.findUnique({
        where: { uniqueCode: code },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      if (!event.isActive) {
        throw new ValidationError('This event is no longer active');
      }

      // Check if already registered by userId
      const existing = await prisma.eventAttendee.findFirst({
        where: { eventId: event.id, userId: req.user.userId },
      });

      if (existing) {
        res.status(200).json({
          success: true,
          message: 'Already registered',
          data: { attendee: existing },
        });
        return;
      }

      // Also check by email to avoid duplicates
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: {
          userGoals: true,
          userInterests: { include: { interest: true } },
        },
      });

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      const existingByEmail = await prisma.eventAttendee.findFirst({
        where: { eventId: event.id, email: user.email },
      });

      if (existingByEmail) {
        // Link to user if not already linked
        if (!existingByEmail.userId) {
          await prisma.eventAttendee.update({
            where: { id: existingByEmail.id },
            data: { userId: req.user.userId },
          });
        }
        res.status(200).json({
          success: true,
          message: 'Already registered',
          data: { attendee: { ...existingByEmail, userId: req.user.userId } },
        });
        return;
      }

      // Build lookingFor from user goals, interests, skills, sectors
      const goalNames = user.userGoals.map(ug => ug.goalType.replace(/_/g, ' '));
      const interestNames = user.userInterests.map(ui => ui.interest.name);

      // Get sectors and skills from onboarding data if available
      let sectorNames: string[] = [];
      let skillNames: string[] = [];
      if (user.onboardingData && typeof user.onboardingData === 'object') {
        const data = user.onboardingData as any;
        if (data.sectors) sectorNames = data.sectors.map((s: any) => s.name || s).filter(Boolean);
        if (data.skills) skillNames = data.skills.map((s: any) => s.name || s).filter(Boolean);
      }

      const lookingForParts = [
        ...goalNames,
        ...interestNames,
        ...sectorNames,
        ...skillNames,
      ].filter(Boolean);

      const lookingFor = lookingForParts.length > 0
        ? lookingForParts.join(', ')
        : user.bio || '';

      const attendee = await prisma.eventAttendee.create({
        data: {
          eventId: event.id,
          userId: req.user.userId,
          email: user.email,
          name: user.fullName,
          mobile: user.phone,
          company: user.company,
          role: user.jobTitle,
          bio: user.bio,
          lookingFor,
          photoUrl: user.avatarUrl,
        },
      });

      // Run matching with other attendees
      await this.runMatchingForAttendee(attendee.id, event.id);

      logger.info(`User ${req.user.userId} joined event ${event.id}`);

      res.status(201).json({
        success: true,
        data: { attendee },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Enqueue matching for a new attendee against all existing attendees.
   * Matching runs asynchronously via BullMQ worker so the join response is not blocked.
   */
  private async runMatchingForAttendee(attendeeId: string, eventId: string): Promise<void> {
    try {
      const attendee = await prisma.eventAttendee.findUnique({
        where: { id: attendeeId },
        select: { userId: true, name: true, bio: true, lookingFor: true, company: true, role: true },
      });

      if (!attendee) return;

      const jobData: EventMatchingJobData = {
        eventId,
        attendeeId,
        userId: attendee.userId ?? undefined,
      };

      const job = await queueService.addJob(
        QueueName.EVENT_MATCHING,
        'match-attendee',
        jobData,
      );

      if (job) {
        logger.info('Enqueued event matching job', { jobId: job.id, eventId, attendeeId, isGuest: !attendee.userId });
      } else {
        // Queue unavailable - fall back to synchronous matching
        logger.warn('Queue unavailable, falling back to synchronous event matching', { eventId, attendeeId });
        await this.runMatchingSynchronous(attendeeId, eventId, attendee.userId ?? undefined);
      }
    } catch (error) {
      logger.error('Error enqueuing attendee matching:', error);
      // Don't fail the join request if matching enqueue fails
    }
  }

  /**
   * Synchronous fallback for event matching when queue is unavailable
   */
  private async runMatchingSynchronous(attendeeId: string, eventId: string, userId?: string): Promise<void> {
    // Fetch all other attendees (both users and guests)
    const otherAttendees = await prisma.eventAttendee.findMany({
      where: { eventId, id: { not: attendeeId } },
      select: { id: true, userId: true, name: true, bio: true, lookingFor: true, company: true, role: true },
    });

    if (otherAttendees.length === 0) return;

    // Separate user-based and guest attendees
    const userAttendees = otherAttendees.filter(a => a.userId);
    const guestAttendees = otherAttendees.filter(a => !a.userId);

    // Fetch user profiles for user-based attendees (and the new attendee if they have a userId)
    const allUserIds = [...(userId ? [userId] : []), ...userAttendees.map(a => a.userId!).filter(Boolean)];
    const userProfiles = allUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          include: {
            userGoals: true,
            userSectors: { include: { sector: true } },
            userSkills: { include: { skill: true } },
            userInterests: { include: { interest: true } },
            userHobbies: { include: { hobby: true } },
          },
        })
      : [];

    const profileMap = new Map(userProfiles.map(u => [u.id, u]));

    // Build the new attendee's profile (user-based or guest-based)
    let newAttendeeProfile: Parameters<typeof eventMatchingService.calculateMatchScore>[0] | null = null;
    if (userId) {
      newAttendeeProfile = profileMap.get(userId) || null;
    } else {
      // Guest attendee - fetch their form data
      const guestData = await prisma.eventAttendee.findUnique({
        where: { id: attendeeId },
        select: { id: true, name: true, bio: true, lookingFor: true, company: true, role: true },
      });
      if (guestData) {
        newAttendeeProfile = this.buildGuestProfileSync(guestData);
      }
    }

    if (!newAttendeeProfile) return;

    const matchesToCreate: any[] = [];

    // Match against user-based attendees
    for (const other of userAttendees) {
      if (!other.userId) continue;
      const otherProfile = profileMap.get(other.userId);
      if (!otherProfile) continue;

      const { score, level, reasons } = eventMatchingService.calculateMatchScore(newAttendeeProfile, otherProfile);

      if (score < 10) continue;

      matchesToCreate.push({
        attendeeId,
        matchedAttendeeId: other.id,
        matchLevel: level,
        score,
        reasons: JSON.stringify(reasons),
      });

      matchesToCreate.push({
        attendeeId: other.id,
        matchedAttendeeId: attendeeId,
        matchLevel: level,
        score,
        reasons: JSON.stringify(reasons),
      });
    }

    // Match against guest attendees
    for (const guest of guestAttendees) {
      const guestProfile = this.buildGuestProfileSync(guest);

      const { score, level, reasons } = eventMatchingService.calculateMatchScore(newAttendeeProfile, guestProfile);

      if (score < 10) continue;

      matchesToCreate.push({
        attendeeId,
        matchedAttendeeId: guest.id,
        matchLevel: level,
        score,
        reasons: JSON.stringify(reasons),
      });

      matchesToCreate.push({
        attendeeId: guest.id,
        matchedAttendeeId: attendeeId,
        matchLevel: level,
        score,
        reasons: JSON.stringify(reasons),
      });
    }

    if (matchesToCreate.length > 0) {
      await prisma.eventAttendeeMatch.createMany({
        data: matchesToCreate,
        skipDuplicates: true,
      });
    }

    logger.info(`Created ${matchesToCreate.length} matches for attendee ${attendeeId} (sync fallback)`);
  }

  /**
   * Build an EventAttendeeProfile from guest form data (synchronous fallback helper)
   */
  private buildGuestProfileSync(guest: {
    id: string;
    name: string;
    bio: string | null;
    lookingFor: string | null;
    company: string | null;
    role: string | null;
  }) {
    const goals: Array<{ goalType: string }> = [];
    if (guest.lookingFor) {
      const lf = guest.lookingFor.toLowerCase();
      if (lf.includes('hire') || lf.includes('recruit') || lf.includes('talent')) goals.push({ goalType: 'HIRING' });
      if (lf.includes('job') || lf.includes('career') || lf.includes('position') || lf.includes('opportunity')) goals.push({ goalType: 'JOB_SEEKING' });
      if (lf.includes('invest') || lf.includes('fund')) goals.push({ goalType: 'INVESTMENT' });
      if (lf.includes('partner') || lf.includes('collaborat')) goals.push({ goalType: 'PARTNERSHIP' });
      if (lf.includes('mentor') || lf.includes('advis')) goals.push({ goalType: 'MENTORSHIP' });
      if (lf.includes('learn') || lf.includes('training')) goals.push({ goalType: 'LEARNING' });
      if (lf.includes('sell') || lf.includes('client') || lf.includes('customer')) goals.push({ goalType: 'SALES' });
      if (goals.length === 0) goals.push({ goalType: 'COLLABORATION' });
    }

    return {
      id: guest.id,
      jobTitle: guest.role || undefined,
      userGoals: goals,
      userSectors: [] as Array<{ sectorId: string; sector?: { name: string } }>,
      userSkills: [] as Array<{ skillId: string; skill?: { name: string } }>,
      userInterests: [] as Array<{ interestId: string; interest?: { name: string } }>,
      userHobbies: [] as Array<{ hobbyId: string; hobby?: { name: string } }>,
    };
  }

  /**
   * Get public attendees list (with matches for the requesting attendee)
   * GET /api/v1/events/public/:code/attendees
   */
  async getPublicAttendees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const token = req.query.token as string;

      const event = await prisma.event.findUnique({
        where: { uniqueCode: code },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      // Find the requesting attendee by token or by logged-in user
      let requestingAttendee: any = null;

      if (token) {
        requestingAttendee = await prisma.eventAttendee.findFirst({
          where: {
            eventId: event.id,
            accessToken: token,
            tokenExpiry: { gt: new Date() },
          },
        });
      } else if (req.user) {
        requestingAttendee = await prisma.eventAttendee.findFirst({
          where: {
            eventId: event.id,
            userId: req.user.userId,
          },
        });
      }

      if (!requestingAttendee) {
        throw new AuthenticationError('Please register for the event first or provide a valid access token');
      }

      // Get all attendees
      const attendees = await prisma.eventAttendee.findMany({
        where: { eventId: event.id },
        select: {
          id: true,
          name: true,
          company: true,
          role: true,
          bio: true,
          lookingFor: true,
          photoUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Get matches for the requesting attendee
      const matches = await prisma.eventAttendeeMatch.findMany({
        where: { attendeeId: requestingAttendee.id },
      });

      const matchMap = new Map(matches.map(m => [m.matchedAttendeeId, m]));

      // Combine attendees with match info
      const attendeesWithMatches = attendees
        .filter(a => a.id !== requestingAttendee.id) // Exclude self
        .map(a => {
          const match = matchMap.get(a.id);
          return {
            ...a,
            matchLevel: match?.matchLevel || 'LOW',
            matchScore: match?.score || 0,
            matchReasons: match?.reasons ? JSON.parse(match.reasons) : [],
          };
        })
        .sort((a, b) => {
          // Sort by match level (HIGH first), then by score
          const levelOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
          const levelDiff = levelOrder[a.matchLevel as keyof typeof levelOrder] - levelOrder[b.matchLevel as keyof typeof levelOrder];
          if (levelDiff !== 0) return levelDiff;
          return b.matchScore - a.matchScore;
        });

      res.status(200).json({
        success: true,
        data: {
          attendees: attendeesWithMatches,
          myInfo: {
            id: requestingAttendee.id,
            name: requestingAttendee.name,
            email: requestingAttendee.email,
          },
          total: attendeesWithMatches.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's attended events
   * GET /api/v1/events/attended
   */
  async getAttendedEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

      // Find events where user is an attendee
      const attendances = await prisma.eventAttendee.findMany({
        where: { userId: req.user.userId },
        include: {
          event: {
            include: {
              _count: { select: { attendees: true } },
            },
          },
          matchesAsSource: {
            where: { matchLevel: 'HIGH' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      const total = await prisma.eventAttendee.count({
        where: { userId: req.user.userId },
      });

      res.status(200).json({
        success: true,
        data: {
          events: attendances.map(a => ({
            event: {
              ...a.event,
              attendeeCount: a.event._count.attendees,
            },
            myRegistration: {
              id: a.id,
              createdAt: a.createdAt,
            },
            highMatches: a.matchesAsSource.length,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get my matches for a specific event
   * GET /api/v1/events/:id/my-matches
   */
  async getMyMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { id } = req.params;

      // Find user's attendance record
      const attendance = await prisma.eventAttendee.findFirst({
        where: { eventId: id, userId: req.user.userId },
      });

      if (!attendance) {
        throw new NotFoundError('You are not registered for this event');
      }

      // Get matches
      const matches = await prisma.eventAttendeeMatch.findMany({
        where: { attendeeId: attendance.id },
        include: {
          matchedAttendee: {
            select: {
              id: true,
              name: true,
              company: true,
              role: true,
              bio: true,
              lookingFor: true,
              photoUrl: true,
            },
          },
        },
        orderBy: [
          { matchLevel: 'asc' }, // HIGH comes first alphabetically
          { score: 'desc' },
        ],
      });

      res.status(200).json({
        success: true,
        data: {
          matches: matches.map(m => ({
            ...m.matchedAttendee,
            matchLevel: m.matchLevel,
            matchScore: m.score,
            matchReasons: m.reasons ? JSON.parse(m.reasons) : [],
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate QR code for event
   * GET /api/v1/events/:id/qr
   */
  async getQRCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { id } = req.params;
      const format = (req.query.format as 'png' | 'svg' | 'base64') || 'png';
      const size = Math.min(1000, Math.max(100, parseInt(req.query.size as string, 10) || 300));

      // Verify ownership
      const event = await prisma.event.findFirst({
        where: { id, hostId: req.user.userId },
        select: { uniqueCode: true, name: true },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      const qrCode = await qrCodeService.generateEventQR(event.uniqueCode, { format, size });

      if (format === 'svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', `inline; filename="${event.name}-qr.svg"`);
        res.status(200).send(qrCode);
      } else if (format === 'base64') {
        res.status(200).json({
          success: true,
          data: {
            qrCode: qrCode as string,
            eventUrl: `${process.env.FRONTEND_URL || 'https://intellmatch.com'}/e/${event.uniqueCode}`,
          },
        });
      } else {
        // PNG
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="${event.name}-qr.png"`);
        res.status(200).send(qrCode);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload event thumbnail
   * POST /api/v1/events/:id/thumbnail
   */
  async uploadThumbnail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { id } = req.params;

      // Verify ownership
      const event = await prisma.event.findFirst({
        where: { id, hostId: req.user.userId },
      });

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No thumbnail file uploaded' },
        });
        return;
      }

      // Upload to MinIO storage for proper OG image support (WhatsApp, social sharing)
      const storage = getStorageService();
      const isStorageAvailable = await storage.isAvailable();

      let thumbnailUrl: string;

      if (isStorageAvailable) {
        // Use MinIO storage - generates proper HTTP URL for OG images
        const fileExtension = req.file.mimetype.split('/')[1] || 'jpg';
        const key = `events/${id}/thumbnail-${Date.now()}.${fileExtension}`;

        const result = await storage.upload('thumbnails', key, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: 'public, max-age=31536000', // Cache for 1 year
        });

        thumbnailUrl = result.url;
      } else {
        // Fallback to base64 if storage unavailable (won't work for OG images)
        logger.warn('Storage unavailable, falling back to base64 for event thumbnail');
        thumbnailUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      const updatedEvent = await prisma.event.update({
        where: { id },
        data: { thumbnailUrl },
        select: { thumbnailUrl: true },
      });

      logger.info('Event thumbnail uploaded', { eventId: id, userId: req.user.userId, size: req.file.size, useStorage: isStorageAvailable });

      res.status(200).json({
        success: true,
        data: { thumbnailUrl: updatedEvent.thumbnailUrl },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Convert guest to full user account
   * POST /api/v1/events/guests/convert
   */
  async convertGuestToUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accessToken, password } = req.body;

      // Find the guest by access token
      const attendee = await prisma.eventAttendee.findFirst({
        where: {
          accessToken,
          tokenExpiry: { gt: new Date() },
        },
        include: {
          event: {
            select: { name: true },
          },
        },
      });

      if (!attendee) {
        throw new ValidationError('Invalid or expired access token');
      }

      // Check if user already exists with this email
      const existingUser = await prisma.user.findUnique({
        where: { email: attendee.email.toLowerCase() },
      });

      if (existingUser) {
        throw new ConflictError('An account already exists with this email. Please log in instead.');
      }

      // Validate password
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new ValidationError('Invalid password', { errors: passwordValidation.errors });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user account with data from attendee
      const userId = crypto.randomUUID();
      const user = await prisma.user.create({
        data: {
          id: userId,
          email: attendee.email.toLowerCase(),
          passwordHash,
          fullName: attendee.name,
          phone: attendee.mobile || null,
          company: attendee.company || null,
          jobTitle: attendee.role || null,
          bio: attendee.bio || null,
          avatarUrl: attendee.photoUrl || null,
          emailVerified: true, // Email verified through event registration
          isActive: true,
        },
      });

      // Link all attendee records with this email to the new user
      await prisma.eventAttendee.updateMany({
        where: {
          email: attendee.email.toLowerCase(),
          userId: null,
        },
        data: {
          userId: user.id,
        },
      });

      // Invalidate the guest access token (set expiry to now)
      await prisma.eventAttendee.update({
        where: { id: attendee.id },
        data: {
          accessToken: null,
          tokenExpiry: null,
        },
      });

      // Generate JWT tokens
      const tokenPair = generateTokenPair(user.id, user.email);

      // Save refresh token
      await prisma.refreshToken.create({
        data: {
          token: tokenPair.refreshToken,
          userId: user.id,
          expiresAt: tokenPair.refreshTokenExpiresAt,
        },
      });

      logger.info('Guest converted to user', {
        userId: user.id,
        email: user.email,
        eventName: attendee.event.name,
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.fullName,
            company: user.company,
            jobTitle: user.jobTitle,
            avatarUrl: user.avatarUrl,
          },
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          expiresAt: tokenPair.accessTokenExpiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Link guest token to authenticated user
   * POST /api/v1/events/guests/link
   */
  async linkGuestToUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { accessToken } = req.body;

      // Find the guest by access token
      const attendee = await prisma.eventAttendee.findFirst({
        where: {
          accessToken,
          tokenExpiry: { gt: new Date() },
        },
        include: {
          event: {
            select: { id: true, name: true },
          },
        },
      });

      if (!attendee) {
        throw new ValidationError('Invalid or expired access token');
      }

      // Check if already linked to a different user
      if (attendee.userId && attendee.userId !== req.user.userId) {
        throw new ConflictError('This registration is already linked to another account');
      }

      // Link to current user
      await prisma.eventAttendee.update({
        where: { id: attendee.id },
        data: {
          userId: req.user.userId,
          accessToken: null, // Invalidate token after linking
          tokenExpiry: null,
        },
      });

      logger.info('Guest linked to user', {
        userId: req.user.userId,
        attendeeId: attendee.id,
        eventId: attendee.event.id,
      });

      res.status(200).json({
        success: true,
        data: {
          linked: true,
          event: {
            id: attendee.event.id,
            name: attendee.event.name,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const eventController = new EventController();
