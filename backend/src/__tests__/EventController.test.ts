/**
 * EventController Unit Tests
 *
 * Tests for the Event QR & Matching feature endpoints.
 */

import { Request, Response, NextFunction } from 'express';

// Mock Prisma client
const mockPrisma = {
  event: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  eventAttendee: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
  },
  eventAttendeeMatch: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  contact: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('../infrastructure/database/prisma/client.js', () => ({
  prisma: mockPrisma,
}));

// Mock QRCodeService
const mockQRCodeService = {
  generateEventQR: jest.fn(),
};

jest.mock('../infrastructure/services/QRCodeService.js', () => ({
  qrCodeService: mockQRCodeService,
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

// Import after mocks
import { EventController } from '../presentation/controllers/EventController';

describe('EventController', () => {
  let controller: EventController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new EventController();
    mockReq = {
      user: { userId: 'user-123', email: 'host@example.com' },
      body: {},
      params: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new event', async () => {
      const eventData = {
        name: 'Tech Networking',
        description: 'A networking event for tech professionals',
        dateTime: '2026-02-15T18:00:00.000Z',
        location: 'Conference Room A',
      };

      mockReq.body = eventData;
      mockPrisma.event.findUnique.mockResolvedValue(null); // No collision
      mockPrisma.event.create.mockResolvedValue({
        id: 'event-1',
        hostId: 'user-123',
        uniqueCode: 'abc12345',
        ...eventData,
        dateTime: new Date(eventData.dateTime),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.event.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            event: expect.objectContaining({
              name: 'Tech Networking',
            }),
            eventUrl: expect.stringContaining('/e/'),
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.body = { name: 'Test Event' };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should retry generating unique code on collision', async () => {
      mockReq.body = {
        name: 'Test Event',
        dateTime: '2026-02-15T18:00:00.000Z',
      };

      // First call returns existing, second returns null
      mockPrisma.event.findUnique
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);

      mockPrisma.event.create.mockResolvedValue({
        id: 'event-1',
        uniqueCode: 'xyz98765',
      });

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.event.findUnique).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('list', () => {
    it('should return paginated list of host events', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          hostId: 'user-123',
          name: 'Event 1',
          uniqueCode: 'abc12345',
          isActive: true,
          _count: { attendees: 10 },
        },
        {
          id: 'event-2',
          hostId: 'user-123',
          name: 'Event 2',
          uniqueCode: 'def67890',
          isActive: true,
          _count: { attendees: 5 },
        },
      ];

      mockPrisma.event.findMany.mockResolvedValue(mockEvents);
      mockPrisma.event.count.mockResolvedValue(2);

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hostId: 'user-123' },
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            events: expect.arrayContaining([
              expect.objectContaining({
                attendeeCount: 10,
                eventUrl: expect.stringContaining('/e/abc12345'),
              }),
            ]),
            pagination: expect.objectContaining({
              total: 2,
            }),
          }),
        })
      );
    });

    it('should filter by active status', async () => {
      mockReq.query = { status: 'active' };
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hostId: 'user-123', isActive: true },
        })
      );
    });

    it('should filter by inactive status', async () => {
      mockReq.query = { status: 'inactive' };
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hostId: 'user-123', isActive: false },
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('get', () => {
    it('should return event details', async () => {
      const mockEvent = {
        id: 'event-1',
        hostId: 'user-123',
        name: 'Test Event',
        uniqueCode: 'abc12345',
        _count: { attendees: 15 },
      };

      mockReq.params = { id: 'event-1' };
      mockPrisma.event.findFirst.mockResolvedValue(mockEvent);

      await controller.get(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            event: expect.objectContaining({
              id: 'event-1',
              attendeeCount: 15,
            }),
          }),
        })
      );
    });

    it('should return 404 when event not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await controller.get(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should not return event owned by another user', async () => {
      mockReq.params = { id: 'event-1' };
      mockPrisma.event.findFirst.mockResolvedValue(null); // Query includes hostId

      await controller.get(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('update', () => {
    it('should update event', async () => {
      mockReq.params = { id: 'event-1' };
      mockReq.body = { name: 'Updated Event Name' };
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', hostId: 'user-123' });
      mockPrisma.event.update.mockResolvedValue({
        id: 'event-1',
        name: 'Updated Event Name',
      });

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.event.update).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should update isActive status', async () => {
      mockReq.params = { id: 'event-1' };
      mockReq.body = { isActive: false };
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', hostId: 'user-123' });
      mockPrisma.event.update.mockResolvedValue({
        id: 'event-1',
        isActive: false,
      });

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        })
      );
    });

    it('should return 404 when event not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockReq.body = { name: 'New Name' };
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('delete', () => {
    it('should delete event', async () => {
      mockReq.params = { id: 'event-1' };
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', hostId: 'user-123' });
      mockPrisma.event.delete.mockResolvedValue({});

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.event.delete).toHaveBeenCalledWith({ where: { id: 'event-1' } });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Event deleted successfully',
        })
      );
    });

    it('should return 404 when event not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getAttendees', () => {
    it('should return paginated attendee list for host', async () => {
      const mockAttendees = [
        { id: 'att-1', name: 'John Doe', email: 'john@example.com', company: 'Tech Inc' },
        { id: 'att-2', name: 'Jane Smith', email: 'jane@example.com', company: 'Data Co' },
      ];

      mockReq.params = { id: 'event-1' };
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', hostId: 'user-123' });
      mockPrisma.eventAttendee.findMany.mockResolvedValue(mockAttendees);
      mockPrisma.eventAttendee.count.mockResolvedValue(2);

      await controller.getAttendees(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            attendees: mockAttendees,
            pagination: expect.objectContaining({
              total: 2,
            }),
          }),
        })
      );
    });

    it('should filter attendees by search term', async () => {
      mockReq.params = { id: 'event-1' };
      mockReq.query = { search: 'john' };
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', hostId: 'user-123' });
      mockPrisma.eventAttendee.findMany.mockResolvedValue([]);
      mockPrisma.eventAttendee.count.mockResolvedValue(0);

      await controller.getAttendees(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.eventAttendee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'john' } },
              { email: { contains: 'john' } },
              { company: { contains: 'john' } },
            ]),
          }),
        })
      );
    });
  });

  describe('exportAttendees', () => {
    it('should export attendees as JSON', async () => {
      const mockAttendees = [
        { id: 'att-1', name: 'John Doe', email: 'john@example.com' },
      ];

      mockReq.params = { id: 'event-1' };
      mockReq.query = { format: 'json' };
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', hostId: 'user-123', name: 'Test' });
      mockPrisma.eventAttendee.findMany.mockResolvedValue(mockAttendees);

      await controller.exportAttendees(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { attendees: mockAttendees },
        })
      );
    });

    it('should export attendees as CSV', async () => {
      const mockAttendees = [
        {
          id: 'att-1',
          name: 'John Doe',
          email: 'john@example.com',
          mobile: '1234567890',
          company: 'Tech Inc',
          role: 'Developer',
          bio: 'A developer',
          lookingFor: 'Investors',
          createdAt: new Date('2026-01-15'),
        },
      ];

      mockReq.params = { id: 'event-1' };
      mockReq.query = { format: 'csv' };
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', hostId: 'user-123', name: 'Test Event' });
      mockPrisma.eventAttendee.findMany.mockResolvedValue(mockAttendees);

      await controller.exportAttendees(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="Test Event-attendees.csv"'
      );
      expect(mockRes.send).toHaveBeenCalled();
    });
  });

  describe('addToContacts', () => {
    it('should add attendees to host contacts', async () => {
      const mockAttendees = [
        { id: 'att-1', name: 'John Doe', email: 'john@example.com', isHost: false },
        { id: 'att-2', name: 'Jane Smith', email: 'jane@example.com', isHost: false },
      ];

      mockReq.params = { id: 'event-1' };
      mockReq.body = {};
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', hostId: 'user-123', name: 'Test' });
      mockPrisma.eventAttendee.findMany.mockResolvedValue(mockAttendees);
      mockPrisma.contact.findMany.mockResolvedValue([]); // No existing contacts
      mockPrisma.contact.createMany.mockResolvedValue({ count: 2 });

      await controller.addToContacts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.contact.createMany).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            added: 2,
            skipped: 0,
          }),
        })
      );
    });

    it('should skip attendees already in contacts', async () => {
      const mockAttendees = [
        { id: 'att-1', name: 'John Doe', email: 'john@example.com', isHost: false },
      ];

      mockReq.params = { id: 'event-1' };
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', hostId: 'user-123', name: 'Test' });
      mockPrisma.eventAttendee.findMany.mockResolvedValue(mockAttendees);
      mockPrisma.contact.findMany.mockResolvedValue([{ email: 'john@example.com' }]); // Already exists

      await controller.addToContacts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.contact.createMany).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            added: 0,
            skipped: 1,
          }),
        })
      );
    });
  });

  describe('inviteAttendees', () => {
    it('should return list of non-users to invite', async () => {
      const mockAttendees = [
        { email: 'new@example.com', name: 'New User' },
        { email: 'existing@example.com', name: 'Existing User' },
      ];

      mockReq.params = { id: 'event-1' };
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'event-1', hostId: 'user-123' });
      mockPrisma.eventAttendee.findMany.mockResolvedValue(mockAttendees);
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'existing@example.com' }]);

      await controller.inviteAttendees(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            toInvite: 1,
            alreadyUsers: 1,
            emails: ['new@example.com'],
          }),
        })
      );
    });
  });

  describe('getPublicEvent', () => {
    it('should return public event info', async () => {
      const mockEvent = {
        id: 'event-1',
        name: 'Public Networking',
        description: 'An open event',
        dateTime: new Date('2026-02-15T18:00:00.000Z'),
        location: 'City Center',
        isActive: true,
        _count: { attendees: 25 },
      };

      mockReq.params = { code: 'abc12345' };
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);

      await controller.getPublicEvent(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            event: expect.objectContaining({
              name: 'Public Networking',
              attendeeCount: 25,
            }),
          }),
        })
      );
    });

    it('should return 404 for non-existent event code', async () => {
      mockReq.params = { code: 'invalid123' };
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await controller.getPublicEvent(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should return error for inactive event', async () => {
      mockReq.params = { code: 'abc12345' };
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        isActive: false,
        _count: { attendees: 0 },
      });

      await controller.getPublicEvent(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('registerGuest', () => {
    it('should register a new guest', async () => {
      const guestData = {
        name: 'Guest User',
        email: 'guest@example.com',
        company: 'Guest Co',
        lookingFor: 'Investors and mentors',
      };

      mockReq.params = { code: 'abc12345' };
      mockReq.body = guestData;
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', isActive: true });
      mockPrisma.eventAttendee.findFirst.mockResolvedValue(null); // Not already registered
      mockPrisma.user.findUnique.mockResolvedValue(null); // Not an existing user
      mockPrisma.eventAttendee.create.mockResolvedValue({
        id: 'att-new',
        eventId: 'event-1',
        ...guestData,
        accessToken: 'generated-token',
      });
      mockPrisma.eventAttendee.findUnique.mockResolvedValue({
        id: 'att-new',
        lookingFor: guestData.lookingFor,
      });
      mockPrisma.eventAttendee.findMany.mockResolvedValue([]); // No other attendees

      await controller.registerGuest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.eventAttendee.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            attendee: expect.objectContaining({
              name: 'Guest User',
            }),
            accessToken: expect.any(String),
          }),
        })
      );
    });

    it('should return existing attendee if already registered', async () => {
      mockReq.params = { code: 'abc12345' };
      mockReq.body = { name: 'Guest User', email: 'guest@example.com' };
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', isActive: true });
      mockPrisma.eventAttendee.findFirst.mockResolvedValue({
        id: 'att-existing',
        email: 'guest@example.com',
      });
      mockPrisma.eventAttendee.update.mockResolvedValue({
        id: 'att-existing',
        accessToken: 'new-token',
      });

      await controller.registerGuest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Already registered',
        })
      );
    });

    it('should link to existing user account', async () => {
      mockReq.params = { code: 'abc12345' };
      mockReq.body = { name: 'Existing User', email: 'existing@example.com' };
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', isActive: true });
      mockPrisma.eventAttendee.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-456' });
      mockPrisma.eventAttendee.create.mockResolvedValue({
        id: 'att-new',
        userId: 'user-456',
      });
      mockPrisma.eventAttendee.findUnique.mockResolvedValue({ id: 'att-new' });
      mockPrisma.eventAttendee.findMany.mockResolvedValue([]);

      await controller.registerGuest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.eventAttendee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-456',
          }),
        })
      );
    });

    it('should reject registration for inactive event', async () => {
      mockReq.params = { code: 'abc12345' };
      mockReq.body = { name: 'Guest', email: 'guest@example.com' };
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', isActive: false });

      await controller.registerGuest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getPublicAttendees', () => {
    it('should return attendees with match info for token-authenticated guest', async () => {
      const mockAttendees = [
        { id: 'att-1', name: 'Person A', lookingFor: 'investors', photoUrl: null },
        { id: 'att-2', name: 'Person B', lookingFor: 'partners', photoUrl: null },
      ];

      mockReq.params = { code: 'abc12345' };
      mockReq.query = { token: 'valid-token' };
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1' });
      mockPrisma.eventAttendee.findFirst.mockResolvedValue({
        id: 'att-requesting',
        name: 'Requesting User',
      });
      mockPrisma.eventAttendee.findMany.mockResolvedValue(mockAttendees);
      mockPrisma.eventAttendeeMatch.findMany.mockResolvedValue([
        { attendeeId: 'att-requesting', matchedAttendeeId: 'att-1', matchLevel: 'HIGH', score: 80, reasons: '[]' },
      ]);

      await controller.getPublicAttendees(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            attendees: expect.any(Array),
            myInfo: expect.objectContaining({
              name: 'Requesting User',
            }),
          }),
        })
      );
    });

    it('should return error without valid token or auth', async () => {
      mockReq.params = { code: 'abc12345' };
      mockReq.query = {};
      mockReq.user = undefined;
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1' });
      mockPrisma.eventAttendee.findFirst.mockResolvedValue(null);

      await controller.getPublicAttendees(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getAttendedEvents', () => {
    it('should return events user has attended', async () => {
      const mockAttendances = [
        {
          id: 'att-1',
          createdAt: new Date(),
          event: {
            id: 'event-1',
            name: 'Tech Meetup',
            _count: { attendees: 20 },
          },
          matchesAsAttendee: [{ matchLevel: 'HIGH' }],
        },
      ];

      mockPrisma.eventAttendee.findMany.mockResolvedValue(mockAttendances);
      mockPrisma.eventAttendee.count.mockResolvedValue(1);

      await controller.getAttendedEvents(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            events: expect.arrayContaining([
              expect.objectContaining({
                event: expect.objectContaining({
                  name: 'Tech Meetup',
                }),
                highMatches: 1,
              }),
            ]),
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;

      await controller.getAttendedEvents(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getMyMatches', () => {
    it('should return matches for logged-in attendee', async () => {
      const mockMatches = [
        {
          matchLevel: 'HIGH',
          score: 85,
          reasons: '["Shared interests: investors, tech"]',
          matchedAttendee: {
            id: 'att-2',
            name: 'Match Person',
            company: 'Match Co',
          },
        },
      ];

      mockReq.params = { id: 'event-1' };
      mockPrisma.eventAttendee.findFirst.mockResolvedValue({ id: 'att-1', userId: 'user-123' });
      mockPrisma.eventAttendeeMatch.findMany.mockResolvedValue(mockMatches);

      await controller.getMyMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            matches: expect.arrayContaining([
              expect.objectContaining({
                name: 'Match Person',
                matchLevel: 'HIGH',
                matchScore: 85,
              }),
            ]),
          }),
        })
      );
    });

    it('should return 404 when user not registered for event', async () => {
      mockReq.params = { id: 'event-1' };
      mockPrisma.eventAttendee.findFirst.mockResolvedValue(null);

      await controller.getMyMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getQRCode', () => {
    it('should generate QR code as PNG', async () => {
      mockReq.params = { id: 'event-1' };
      mockReq.query = { format: 'png' };
      mockPrisma.event.findFirst.mockResolvedValue({
        uniqueCode: 'abc12345',
        name: 'Test Event',
      });
      mockQRCodeService.generateEventQR.mockResolvedValue(Buffer.from('png-data'));

      await controller.getQRCode(mockReq as Request, mockRes as Response, mockNext);

      expect(mockQRCodeService.generateEventQR).toHaveBeenCalledWith('abc12345', { format: 'png', size: 300 });
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should generate QR code as SVG', async () => {
      mockReq.params = { id: 'event-1' };
      mockReq.query = { format: 'svg' };
      mockPrisma.event.findFirst.mockResolvedValue({
        uniqueCode: 'abc12345',
        name: 'Test Event',
      });
      mockQRCodeService.generateEventQR.mockResolvedValue('<svg>...</svg>');

      await controller.getQRCode(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/svg+xml');
    });

    it('should generate QR code as base64', async () => {
      mockReq.params = { id: 'event-1' };
      mockReq.query = { format: 'base64' };
      mockPrisma.event.findFirst.mockResolvedValue({
        uniqueCode: 'abc12345',
        name: 'Test Event',
      });
      mockQRCodeService.generateEventQR.mockResolvedValue('data:image/png;base64,...');

      await controller.getQRCode(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            qrCode: expect.any(String),
            eventUrl: expect.stringContaining('/e/abc12345'),
          }),
        })
      );
    });

    it('should return 404 for non-owned event', async () => {
      mockReq.params = { id: 'event-1' };
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await controller.getQRCode(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
