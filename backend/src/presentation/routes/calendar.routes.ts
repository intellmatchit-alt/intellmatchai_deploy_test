/**
 * Calendar Routes
 *
 * Routes for calendar view - combines tasks and reminders for calendar display.
 *
 * @module presentation/routes/calendar
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AuthenticationError } from '../../shared/errors';
import { prisma } from '../../infrastructure/database/prisma/client';
import { logger } from '../../shared/logger';
import { meetingService } from '../../application/use-cases/meeting';
import { VideoProvider } from '@prisma/client';

export const calendarRoutes = Router();

// All calendar routes require authentication
calendarRoutes.use(authenticate);

interface CalendarEvent {
  id: string;
  type: 'task' | 'reminder';
  title: string;
  description?: string | null;
  date: Date;
  dueDate?: Date | null;
  reminderAt?: Date | null;
  priority?: string;
  status?: string;
  isCompleted?: boolean;
  contact?: {
    id: string;
    fullName: string;
    company?: string | null;
  } | null;
}

/**
 * GET /api/v1/calendar/events
 * Get all tasks and reminders for calendar display
 *
 * Query params:
 * - start?: string (ISO date) - Start of date range
 * - end?: string (ISO date) - End of date range
 * - type?: 'task' | 'reminder' | 'all' (default 'all')
 * - includeCompleted?: boolean (default false)
 */
calendarRoutes.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const start = req.query.start ? new Date(req.query.start as string) : undefined;
    const end = req.query.end ? new Date(req.query.end as string) : undefined;
    const type = (req.query.type as string) || 'all';
    const includeCompleted = req.query.includeCompleted === 'true';

    const events: CalendarEvent[] = [];

    // Fetch tasks
    if (type === 'all' || type === 'task') {
      const taskWhere: any = { userId: req.user.userId };

      if (!includeCompleted) {
        taskWhere.status = { in: ['PENDING', 'IN_PROGRESS'] };
      }

      // Filter by date range (using dueDate or reminderAt)
      if (start || end) {
        taskWhere.OR = [
          {
            dueDate: {
              ...(start && { gte: start }),
              ...(end && { lte: end }),
            },
          },
          {
            reminderAt: {
              ...(start && { gte: start }),
              ...(end && { lte: end }),
            },
          },
        ];
      }

      const tasks = await prisma.contactTask.findMany({
        where: taskWhere,
        include: {
          contact: {
            select: { id: true, fullName: true, company: true },
          },
        },
        orderBy: [
          { dueDate: 'asc' },
          { reminderAt: 'asc' },
          { createdAt: 'desc' },
        ],
      });

      for (const task of tasks) {
        // Use dueDate as primary date, fallback to reminderAt or createdAt
        const eventDate = task.dueDate || task.reminderAt || task.createdAt;

        events.push({
          id: task.id,
          type: 'task',
          title: task.title,
          description: task.description,
          date: eventDate,
          dueDate: task.dueDate,
          reminderAt: task.reminderAt,
          priority: task.priority,
          status: task.status,
          contact: task.contact,
        });
      }
    }

    // Fetch reminders
    if (type === 'all' || type === 'reminder') {
      const reminderWhere: any = { userId: req.user.userId };

      if (!includeCompleted) {
        reminderWhere.isCompleted = false;
      }

      // Filter by date range
      if (start || end) {
        reminderWhere.reminderAt = {
          ...(start && { gte: start }),
          ...(end && { lte: end }),
        };
      }

      const reminders = await prisma.contactReminder.findMany({
        where: reminderWhere,
        include: {
          contact: {
            select: { id: true, fullName: true, company: true },
          },
        },
        orderBy: { reminderAt: 'asc' },
      });

      for (const reminder of reminders) {
        events.push({
          id: reminder.id,
          type: 'reminder',
          title: reminder.title,
          description: reminder.description,
          date: reminder.reminderAt,
          reminderAt: reminder.reminderAt,
          isCompleted: reminder.isCompleted,
          contact: reminder.contact,
        });
      }
    }

    // Sort all events by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    logger.debug('Calendar events fetched', {
      userId: req.user.userId,
      count: events.length,
      type,
      start,
      end,
    });

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/calendar/events/by-date
 * Get events grouped by date for calendar grid display
 *
 * Query params:
 * - month: number (1-12)
 * - year: number
 * - includeCompleted?: boolean (default false)
 */
calendarRoutes.get('/events/by-date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const month = parseInt(req.query.month as string, 10);
    const year = parseInt(req.query.year as string, 10);
    const includeCompleted = req.query.includeCompleted === 'true';

    if (!month || !year || month < 1 || month > 12) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid month (1-12) and year are required' },
      });
      return;
    }

    // Calculate start and end of month
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch tasks for the month
    // Include tasks by dueDate, reminderAt, OR createdAt (fallback for tasks without dates)
    const taskWhere: any = {
      userId: req.user.userId,
      OR: [
        { dueDate: { gte: startOfMonth, lte: endOfMonth } },
        { reminderAt: { gte: startOfMonth, lte: endOfMonth } },
        { dueDate: null, reminderAt: null, createdAt: { gte: startOfMonth, lte: endOfMonth } },
      ],
    };

    if (!includeCompleted) {
      taskWhere.status = { in: ['PENDING', 'IN_PROGRESS'] };
    }

    const tasks = await prisma.contactTask.findMany({
      where: taskWhere,
      include: {
        contact: {
          select: { id: true, fullName: true, company: true },
        },
      },
    });

    // Fetch reminders for the month
    const reminderWhere: any = {
      userId: req.user.userId,
      reminderAt: { gte: startOfMonth, lte: endOfMonth },
    };

    if (!includeCompleted) {
      reminderWhere.isCompleted = false;
    }

    const reminders = await prisma.contactReminder.findMany({
      where: reminderWhere,
      include: {
        contact: {
          select: { id: true, fullName: true, company: true },
        },
      },
    });

    // Group events by date (YYYY-MM-DD)
    const eventsByDate: Record<string, CalendarEvent[]> = {};

    for (const task of tasks) {
      const eventDate = task.dueDate || task.reminderAt || task.createdAt;

      const dateKey = eventDate.toISOString().split('T')[0];
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }

      eventsByDate[dateKey].push({
        id: task.id,
        type: 'task',
        title: task.title,
        description: task.description,
        date: eventDate,
        dueDate: task.dueDate,
        reminderAt: task.reminderAt,
        priority: task.priority,
        status: task.status,
        contact: task.contact,
      });
    }

    for (const reminder of reminders) {
      const dateKey = reminder.reminderAt.toISOString().split('T')[0];
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }

      eventsByDate[dateKey].push({
        id: reminder.id,
        type: 'reminder',
        title: reminder.title,
        description: reminder.description,
        date: reminder.reminderAt,
        reminderAt: reminder.reminderAt,
        isCompleted: reminder.isCompleted,
        contact: reminder.contact,
      });
    }

    // Sort events within each date
    for (const dateKey of Object.keys(eventsByDate)) {
      eventsByDate[dateKey].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    logger.debug('Calendar events by date fetched', {
      userId: req.user.userId,
      month,
      year,
      datesWithEvents: Object.keys(eventsByDate).length,
    });

    res.status(200).json({
      success: true,
      data: {
        month,
        year,
        eventsByDate,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/calendar/summary
 * Get summary counts for calendar (upcoming tasks/reminders)
 */
calendarRoutes.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Count tasks - use dueDate if set, otherwise fall back to createdAt
    const [todayTasks, thisWeekTasks, overdueTasks, totalPendingTasks] = await Promise.all([
      prisma.contactTask.count({
        where: {
          userId: req.user.userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          OR: [
            { dueDate: { gte: today, lt: tomorrow } },
            { dueDate: null, createdAt: { gte: today, lt: tomorrow } },
          ],
        },
      }),
      prisma.contactTask.count({
        where: {
          userId: req.user.userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          OR: [
            { dueDate: { gte: today, lt: nextWeek } },
            { dueDate: null, createdAt: { gte: today, lt: nextWeek } },
          ],
        },
      }),
      prisma.contactTask.count({
        where: {
          userId: req.user.userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { lt: today, not: null },
        },
      }),
      prisma.contactTask.count({
        where: {
          userId: req.user.userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      }),
    ]);

    // Count reminders
    const [todayReminders, thisWeekReminders, overdueReminders, totalPendingReminders] = await Promise.all([
      prisma.contactReminder.count({
        where: {
          userId: req.user.userId,
          isCompleted: false,
          reminderAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.contactReminder.count({
        where: {
          userId: req.user.userId,
          isCompleted: false,
          reminderAt: { gte: today, lt: nextWeek },
        },
      }),
      prisma.contactReminder.count({
        where: {
          userId: req.user.userId,
          isCompleted: false,
          reminderAt: { lt: today },
        },
      }),
      prisma.contactReminder.count({
        where: {
          userId: req.user.userId,
          isCompleted: false,
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        tasks: {
          today: todayTasks,
          thisWeek: thisWeekTasks,
          overdue: overdueTasks,
          totalPending: totalPendingTasks,
        },
        reminders: {
          today: todayReminders,
          thisWeek: thisWeekReminders,
          overdue: overdueReminders,
          totalPending: totalPendingReminders,
        },
        totals: {
          today: todayTasks + todayReminders,
          thisWeek: thisWeekTasks + thisWeekReminders,
          overdue: overdueTasks + overdueReminders,
          totalPending: totalPendingTasks + totalPendingReminders,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MEETING ENDPOINTS
// ============================================

/**
 * GET /api/v1/calendar/meetings
 * Get all meetings within a date range
 *
 * Query params:
 * - start?: string (ISO date)
 * - end?: string (ISO date)
 * - contactId?: string
 */
calendarRoutes.get('/meetings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const startDate = req.query.start ? new Date(req.query.start as string) : undefined;
    const endDate = req.query.end ? new Date(req.query.end as string) : undefined;
    const contactId = req.query.contactId as string | undefined;

    const meetings = await meetingService.getMeetings(req.user.userId, {
      startDate,
      endDate,
      contactId,
    });

    res.status(200).json({
      success: true,
      data: meetings,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/calendar/meetings/upcoming
 * Get upcoming meetings
 *
 * Query params:
 * - limit?: number (default 5)
 */
calendarRoutes.get('/meetings/upcoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const limit = parseInt(req.query.limit as string, 10) || 5;

    const meetings = await meetingService.getUpcomingMeetings(req.user.userId, limit);

    res.status(200).json({
      success: true,
      data: meetings,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/calendar/meetings
 * Create a new meeting
 *
 * Body:
 * - title: string (required)
 * - description?: string
 * - startTime: string (ISO date, required)
 * - endTime: string (ISO date, required)
 * - location?: string
 * - videoLink?: string
 * - videoProvider?: 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'OTHER'
 * - contactId?: string
 * - taskId?: string
 * - isAllDay?: boolean
 * - reminderMinutes?: number
 * - attendees?: Array<{ email: string, name?: string }>
 */
calendarRoutes.post('/meetings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const {
      title,
      description,
      startTime,
      endTime,
      location,
      videoLink,
      videoProvider,
      contactId,
      taskId,
      isAllDay,
      reminderMinutes,
      attendees,
    } = req.body;

    if (!title || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'title, startTime, and endTime are required' },
      });
      return;
    }

    const meeting = await meetingService.createMeeting(
      {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location,
        videoLink,
        videoProvider: videoProvider as VideoProvider,
        contactId,
        taskId,
        isAllDay,
        reminderMinutes,
        attendees,
      },
      req.user.userId
    );

    res.status(201).json({
      success: true,
      data: meeting,
    });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('unauthorized')) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/v1/calendar/meetings/:id
 * Get a single meeting by ID
 */
calendarRoutes.get('/meetings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const meeting = await meetingService.getMeetingById(req.params.id, req.user.userId);

    if (!meeting) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Meeting not found' },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: meeting,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/calendar/meetings/:id
 * Update a meeting
 */
calendarRoutes.put('/meetings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const {
      title,
      description,
      startTime,
      endTime,
      location,
      videoLink,
      videoProvider,
      isAllDay,
      reminderMinutes,
    } = req.body;

    const meeting = await meetingService.updateMeeting(
      req.params.id,
      {
        title,
        description,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        location,
        videoLink,
        videoProvider: videoProvider as VideoProvider,
        isAllDay,
        reminderMinutes,
      },
      req.user.userId
    );

    res.status(200).json({
      success: true,
      data: meeting,
    });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('unauthorized')) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Meeting not found' },
      });
      return;
    }
    next(error);
  }
});

/**
 * DELETE /api/v1/calendar/meetings/:id
 * Delete a meeting
 */
calendarRoutes.delete('/meetings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const deleted = await meetingService.deleteMeeting(req.params.id, req.user.userId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Meeting not found' },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Meeting deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/calendar/meetings/:id/attendees
 * Add attendees to a meeting
 *
 * Body:
 * - attendees: Array<{ email: string, name?: string }>
 */
calendarRoutes.post('/meetings/:id/attendees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const { attendees } = req.body;

    if (!attendees || !Array.isArray(attendees)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'attendees array is required' },
      });
      return;
    }

    const created = await meetingService.addAttendees(req.params.id, attendees, req.user.userId);

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('unauthorized')) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Meeting not found' },
      });
      return;
    }
    next(error);
  }
});

/**
 * DELETE /api/v1/calendar/meetings/:id/attendees/:attendeeId
 * Remove an attendee from a meeting
 */
calendarRoutes.delete(
  '/meetings/:id/attendees/:attendeeId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const removed = await meetingService.removeAttendee(
        req.params.id,
        req.params.attendeeId,
        req.user.userId
      );

      if (!removed) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Meeting or attendee not found' },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Attendee removed',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/calendar/meetings/from-task
 * Convert a task to a meeting
 *
 * Body:
 * - taskId: string (required)
 * - startTime: string (ISO date, required)
 * - endTime: string (ISO date, required)
 * - location?: string
 * - videoLink?: string
 * - videoProvider?: 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'OTHER'
 * - attendees?: Array<{ email: string, name?: string }>
 */
calendarRoutes.post('/meetings/from-task', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const {
      taskId,
      startTime,
      endTime,
      location,
      videoLink,
      videoProvider,
      attendees,
    } = req.body;

    if (!taskId || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'taskId, startTime, and endTime are required' },
      });
      return;
    }

    const meeting = await meetingService.convertTaskToMeeting(
      {
        taskId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location,
        videoLink,
        videoProvider: videoProvider as VideoProvider,
        attendees,
      },
      req.user.userId
    );

    res.status(201).json({
      success: true,
      data: meeting,
    });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('unauthorized') || error.message?.includes('already has')) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
      return;
    }
    next(error);
  }
});

export default calendarRoutes;
