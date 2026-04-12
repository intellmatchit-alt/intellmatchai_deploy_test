/**
 * Meeting Service
 *
 * Handles meeting CRUD operations and calendar integration.
 *
 * @module application/use-cases/meeting/MeetingService
 */

import { PrismaClient, VideoProvider, AttendeeStatus } from '@prisma/client';
import { logger } from '../../../shared/logger';

const prisma = new PrismaClient();

export interface CreateMeetingInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  videoLink?: string;
  videoProvider?: VideoProvider;
  contactId?: string;
  taskId?: string;
  isAllDay?: boolean;
  reminderMinutes?: number;
  attendees?: Array<{
    email: string;
    name?: string;
  }>;
}

export interface UpdateMeetingInput {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  videoLink?: string;
  videoProvider?: VideoProvider;
  isAllDay?: boolean;
  reminderMinutes?: number;
}

export interface MeetingFilters {
  startDate?: Date;
  endDate?: Date;
  contactId?: string;
}

export interface ConvertTaskToMeetingInput {
  taskId: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  videoLink?: string;
  videoProvider?: VideoProvider;
  attendees?: Array<{
    email: string;
    name?: string;
  }>;
}

/**
 * Service for managing meetings and calendar integration
 */
export class MeetingService {
  /**
   * Create a new meeting
   */
  async createMeeting(input: CreateMeetingInput, userId: string) {
    try {
      // Validate contact belongs to user if specified
      if (input.contactId) {
        const contact = await prisma.contact.findFirst({
          where: { id: input.contactId, ownerId: userId },
        });
        if (!contact) {
          throw new Error('Contact not found or unauthorized');
        }
      }

      // Validate task belongs to user if specified
      if (input.taskId) {
        const task = await prisma.contactTask.findFirst({
          where: { id: input.taskId, userId },
        });
        if (!task) {
          throw new Error('Task not found or unauthorized');
        }

        // Check if task already has a meeting
        const existingMeeting = await prisma.meeting.findUnique({
          where: { taskId: input.taskId },
        });
        if (existingMeeting) {
          throw new Error('Task already has an associated meeting');
        }
      }

      // Create meeting with attendees
      const meeting = await prisma.meeting.create({
        data: {
          title: input.title,
          description: input.description,
          startTime: input.startTime,
          endTime: input.endTime,
          location: input.location,
          videoLink: input.videoLink,
          videoProvider: input.videoProvider,
          contactId: input.contactId,
          taskId: input.taskId,
          isAllDay: input.isAllDay || false,
          reminderMinutes: input.reminderMinutes,
          createdById: userId,
          attendees: input.attendees
            ? {
                create: input.attendees.map((a) => ({
                  email: a.email,
                  name: a.name,
                  status: AttendeeStatus.PENDING,
                })),
              }
            : undefined,
        },
        include: {
          attendees: true,
          contact: {
            select: {
              id: true,
              fullName: true,
              email: true,
              company: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      logger.info('Meeting created', {
        meetingId: meeting.id,
        userId,
        title: meeting.title,
      });

      return meeting;
    } catch (error) {
      logger.error('Failed to create meeting', { error, input, userId });
      throw error;
    }
  }

  /**
   * Get meetings for a user within a date range
   */
  async getMeetings(userId: string, filters: MeetingFilters = {}) {
    const where: any = {
      createdById: userId,
    };

    if (filters.startDate) {
      where.startTime = { gte: filters.startDate };
    }

    if (filters.endDate) {
      where.endTime = { ...(where.endTime || {}), lte: filters.endDate };
    }

    if (filters.contactId) {
      where.contactId = filters.contactId;
    }

    return prisma.meeting.findMany({
      where,
      include: {
        attendees: true,
        contact: {
          select: {
            id: true,
            fullName: true,
            email: true,
            company: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  /**
   * Get a single meeting by ID
   */
  async getMeetingById(meetingId: string, userId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        createdById: userId,
      },
      include: {
        attendees: true,
        contact: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            company: true,
            jobTitle: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    return meeting;
  }

  /**
   * Update a meeting
   */
  async updateMeeting(meetingId: string, input: UpdateMeetingInput, userId: string) {
    // Verify ownership
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, createdById: userId },
    });

    if (!meeting) {
      throw new Error('Meeting not found or unauthorized');
    }

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        title: input.title,
        description: input.description,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location,
        videoLink: input.videoLink,
        videoProvider: input.videoProvider,
        isAllDay: input.isAllDay,
        reminderMinutes: input.reminderMinutes,
      },
      include: {
        attendees: true,
        contact: {
          select: {
            id: true,
            fullName: true,
            email: true,
            company: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    logger.info('Meeting updated', {
      meetingId,
      userId,
    });

    return updated;
  }

  /**
   * Delete a meeting
   */
  async deleteMeeting(meetingId: string, userId: string): Promise<boolean> {
    // Verify ownership
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, createdById: userId },
    });

    if (!meeting) {
      return false;
    }

    await prisma.meeting.delete({
      where: { id: meetingId },
    });

    logger.info('Meeting deleted', {
      meetingId,
      userId,
    });

    return true;
  }

  /**
   * Add attendees to a meeting
   */
  async addAttendees(
    meetingId: string,
    attendees: Array<{ email: string; name?: string }>,
    userId: string
  ) {
    // Verify ownership
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, createdById: userId },
    });

    if (!meeting) {
      throw new Error('Meeting not found or unauthorized');
    }

    // Add new attendees (skip duplicates due to unique constraint)
    const created = await prisma.$transaction(
      attendees.map((a) =>
        prisma.meetingAttendee.upsert({
          where: {
            meetingId_email: {
              meetingId,
              email: a.email,
            },
          },
          create: {
            meetingId,
            email: a.email,
            name: a.name,
            status: AttendeeStatus.PENDING,
          },
          update: {
            name: a.name,
          },
        })
      )
    );

    logger.info('Attendees added to meeting', {
      meetingId,
      count: created.length,
      userId,
    });

    return created;
  }

  /**
   * Remove an attendee from a meeting
   */
  async removeAttendee(meetingId: string, attendeeId: string, userId: string): Promise<boolean> {
    // Verify ownership
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, createdById: userId },
    });

    if (!meeting) {
      return false;
    }

    await prisma.meetingAttendee.delete({
      where: { id: attendeeId },
    });

    logger.info('Attendee removed from meeting', {
      meetingId,
      attendeeId,
      userId,
    });

    return true;
  }

  /**
   * Update attendee status (for RSVP)
   */
  async updateAttendeeStatus(
    meetingId: string,
    attendeeEmail: string,
    status: AttendeeStatus
  ) {
    const attendee = await prisma.meetingAttendee.findFirst({
      where: {
        meetingId,
        email: attendeeEmail,
      },
    });

    if (!attendee) {
      throw new Error('Attendee not found');
    }

    return prisma.meetingAttendee.update({
      where: { id: attendee.id },
      data: { status },
    });
  }

  /**
   * Convert a task to a meeting
   */
  async convertTaskToMeeting(input: ConvertTaskToMeetingInput, userId: string) {
    // Get the task
    const task = await prisma.contactTask.findFirst({
      where: { id: input.taskId, userId },
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found or unauthorized');
    }

    // Check if task already has a meeting
    const existingMeeting = await prisma.meeting.findUnique({
      where: { taskId: input.taskId },
    });

    if (existingMeeting) {
      throw new Error('Task already has an associated meeting');
    }

    // Auto-add contact as attendee if they have email
    const attendees = input.attendees || [];
    if (task.contact?.email && !attendees.find((a) => a.email === task.contact?.email)) {
      attendees.push({
        email: task.contact.email,
        name: task.contact.fullName,
      });
    }

    // Create the meeting
    const meeting = await this.createMeeting(
      {
        title: task.title,
        description: task.description || undefined,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location,
        videoLink: input.videoLink,
        videoProvider: input.videoProvider,
        contactId: task.contactId,
        taskId: task.id,
        attendees,
      },
      userId
    );

    logger.info('Task converted to meeting', {
      taskId: task.id,
      meetingId: meeting.id,
      userId,
    });

    return meeting;
  }

  /**
   * Get upcoming meetings for dashboard/reminders
   */
  async getUpcomingMeetings(userId: string, limit = 5) {
    const now = new Date();

    return prisma.meeting.findMany({
      where: {
        createdById: userId,
        startTime: { gte: now },
      },
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
            company: true,
          },
        },
        attendees: {
          select: {
            email: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
      take: limit,
    });
  }

  /**
   * Get meetings for a specific contact
   */
  async getContactMeetings(contactId: string, userId: string) {
    // Verify contact ownership
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ownerId: userId },
    });

    if (!contact) {
      throw new Error('Contact not found or unauthorized');
    }

    return prisma.meeting.findMany({
      where: {
        contactId,
        createdById: userId,
      },
      include: {
        attendees: true,
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });
  }
}

export const meetingService = new MeetingService();
