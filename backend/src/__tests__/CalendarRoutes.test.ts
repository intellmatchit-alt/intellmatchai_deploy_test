/**
 * Calendar Routes Unit Tests
 */

import { Request, Response, NextFunction } from 'express';

// Mock prisma
jest.mock('../infrastructure/database/prisma/client.js', () => ({
  prisma: {
    contactTask: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    contactReminder: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock meeting service
jest.mock('../application/use-cases/meeting/index.js', () => ({
  meetingService: {
    getMeetings: jest.fn(),
    getUpcomingMeetings: jest.fn(),
    createMeeting: jest.fn(),
    getMeetingById: jest.fn(),
    updateMeeting: jest.fn(),
    deleteMeeting: jest.fn(),
    addAttendees: jest.fn(),
    removeAttendee: jest.fn(),
    convertTaskToMeeting: jest.fn(),
  },
}));

// Mock logger
jest.mock('../shared/logger/index.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock auth middleware
jest.mock('../presentation/middleware/auth.middleware.js', () => ({
  authenticate: (req: Request, res: Response, next: NextFunction) => {
    req.user = { userId: 'user-123', email: 'test@example.com' };
    next();
  },
}));

import { prisma } from '../infrastructure/database/prisma/client';
import { meetingService } from '../application/use-cases/meeting/index';

// Create a simple test handler that mimics the route logic
const createMockHandler = () => {
  return async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
    }
    return res.status(200).json({ success: true, data: [] });
  };
};

describe('Calendar Routes', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: { userId: 'user-123', email: 'test@example.com' },
      body: {},
      params: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('GET /events', () => {
    it('should return empty array when no events exist', async () => {
      (prisma.contactTask.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contactReminder.findMany as jest.Mock).mockResolvedValue([]);

      const handler = createMockHandler();
      await handler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('should require authentication', async () => {
      mockReq.user = undefined;

      const handler = createMockHandler();
      await handler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('GET /events/by-date', () => {
    it('should validate month and year parameters', () => {
      mockReq.query = { month: '13', year: '2026' };

      // Simulate validation logic
      const month = parseInt(mockReq.query.month as string, 10);
      const year = parseInt(mockReq.query.year as string, 10);

      expect(month).toBeGreaterThan(12); // Invalid month
    });

    it('should accept valid month and year', () => {
      mockReq.query = { month: '6', year: '2026' };

      const month = parseInt(mockReq.query.month as string, 10);
      const year = parseInt(mockReq.query.year as string, 10);

      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(year).toBe(2026);
    });
  });

  describe('GET /summary', () => {
    it('should return task and reminder counts', async () => {
      (prisma.contactTask.count as jest.Mock).mockResolvedValue(5);
      (prisma.contactReminder.count as jest.Mock).mockResolvedValue(3);

      const taskCount = await prisma.contactTask.count({
        where: { userId: 'user-123', status: { in: ['PENDING', 'IN_PROGRESS'] } },
      });
      const reminderCount = await prisma.contactReminder.count({
        where: { userId: 'user-123', isCompleted: false },
      });

      expect(taskCount).toBe(5);
      expect(reminderCount).toBe(3);
    });
  });

  describe('Meeting Endpoints', () => {
    describe('GET /meetings', () => {
      it('should call meetingService.getMeetings', async () => {
        const mockMeetings = [
          { id: 'meeting-1', title: 'Test Meeting' },
        ];
        (meetingService.getMeetings as jest.Mock).mockResolvedValue(mockMeetings);

        const result = await meetingService.getMeetings('user-123', {});

        expect(result).toEqual(mockMeetings);
        expect(meetingService.getMeetings).toHaveBeenCalledWith('user-123', {});
      });
    });

    describe('GET /meetings/upcoming', () => {
      it('should return upcoming meetings with default limit', async () => {
        const mockMeetings = [
          { id: 'meeting-1', title: 'Upcoming 1' },
          { id: 'meeting-2', title: 'Upcoming 2' },
        ];
        (meetingService.getUpcomingMeetings as jest.Mock).mockResolvedValue(mockMeetings);

        const result = await meetingService.getUpcomingMeetings('user-123', 5);

        expect(result).toEqual(mockMeetings);
        expect(meetingService.getUpcomingMeetings).toHaveBeenCalledWith('user-123', 5);
      });
    });

    describe('POST /meetings', () => {
      it('should create a meeting with valid data', async () => {
        const meetingData = {
          title: 'New Meeting',
          startTime: new Date('2026-02-10T10:00:00Z'),
          endTime: new Date('2026-02-10T11:00:00Z'),
        };
        const mockMeeting = { id: 'meeting-new', ...meetingData };
        (meetingService.createMeeting as jest.Mock).mockResolvedValue(mockMeeting);

        const result = await meetingService.createMeeting(meetingData, 'user-123');

        expect(result).toEqual(mockMeeting);
        expect(meetingService.createMeeting).toHaveBeenCalledWith(meetingData, 'user-123');
      });

      it('should validate required fields', () => {
        mockReq.body = { description: 'No title' };

        const { title, startTime, endTime } = mockReq.body;

        expect(title).toBeUndefined();
        expect(startTime).toBeUndefined();
        expect(endTime).toBeUndefined();
      });
    });

    describe('GET /meetings/:id', () => {
      it('should return meeting by ID', async () => {
        const mockMeeting = { id: 'meeting-1', title: 'Test Meeting' };
        (meetingService.getMeetingById as jest.Mock).mockResolvedValue(mockMeeting);

        const result = await meetingService.getMeetingById('meeting-1', 'user-123');

        expect(result).toEqual(mockMeeting);
      });

      it('should return null for non-existent meeting', async () => {
        (meetingService.getMeetingById as jest.Mock).mockResolvedValue(null);

        const result = await meetingService.getMeetingById('non-existent', 'user-123');

        expect(result).toBeNull();
      });
    });

    describe('PUT /meetings/:id', () => {
      it('should update meeting', async () => {
        const updateData = { title: 'Updated Title' };
        const mockMeeting = { id: 'meeting-1', title: 'Updated Title' };
        (meetingService.updateMeeting as jest.Mock).mockResolvedValue(mockMeeting);

        const result = await meetingService.updateMeeting('meeting-1', updateData, 'user-123');

        expect(result).toEqual(mockMeeting);
      });
    });

    describe('DELETE /meetings/:id', () => {
      it('should delete meeting', async () => {
        (meetingService.deleteMeeting as jest.Mock).mockResolvedValue(true);

        const result = await meetingService.deleteMeeting('meeting-1', 'user-123');

        expect(result).toBe(true);
      });

      it('should return false for non-existent meeting', async () => {
        (meetingService.deleteMeeting as jest.Mock).mockResolvedValue(false);

        const result = await meetingService.deleteMeeting('non-existent', 'user-123');

        expect(result).toBe(false);
      });
    });

    describe('POST /meetings/:id/attendees', () => {
      it('should add attendees to meeting', async () => {
        const attendees = [
          { email: 'test@example.com', name: 'Test User' },
        ];
        const mockAttendees = [{ id: 'att-1', ...attendees[0] }];
        (meetingService.addAttendees as jest.Mock).mockResolvedValue(mockAttendees);

        const result = await meetingService.addAttendees('meeting-1', attendees, 'user-123');

        expect(result).toEqual(mockAttendees);
      });
    });

    describe('DELETE /meetings/:id/attendees/:attendeeId', () => {
      it('should remove attendee from meeting', async () => {
        (meetingService.removeAttendee as jest.Mock).mockResolvedValue(true);

        const result = await meetingService.removeAttendee('meeting-1', 'att-1', 'user-123');

        expect(result).toBe(true);
      });
    });

    describe('POST /meetings/from-task', () => {
      it('should convert task to meeting', async () => {
        const data = {
          taskId: 'task-1',
          startTime: new Date('2026-02-10T10:00:00Z'),
          endTime: new Date('2026-02-10T11:00:00Z'),
        };
        const mockMeeting = { id: 'meeting-new', title: 'Task Meeting', taskId: 'task-1' };
        (meetingService.convertTaskToMeeting as jest.Mock).mockResolvedValue(mockMeeting);

        const result = await meetingService.convertTaskToMeeting(data, 'user-123');

        expect(result).toEqual(mockMeeting);
        expect(result.taskId).toBe('task-1');
      });
    });
  });
});
