/**
 * Event API Integration Tests
 *
 * Tests for the complete Event QR & Matching API flow.
 */

import { Request, Response, NextFunction } from 'express';

// Mock Prisma with realistic behavior for integration testing
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

jest.mock('../../infrastructure/database/prisma/client.js', () => ({
  prisma: mockPrisma,
}));

// Mock QRCodeService
const mockQRCodeService = {
  generateEventQR: jest.fn(),
};

jest.mock('../../infrastructure/services/QRCodeService.js', () => ({
  qrCodeService: mockQRCodeService,
}));

// Mock logger
jest.mock('../../shared/logger/index.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

import { EventController } from '../../presentation/controllers/EventController';

describe('Event API Integration', () => {
  let controller: EventController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  // Simulated database state
  let eventsDb: any[] = [];
  let attendeesDb: any[] = [];
  let matchesDb: any[] = [];

  beforeEach(() => {
    controller = new EventController();

    // Reset simulated database
    eventsDb = [];
    attendeesDb = [];
    matchesDb = [];

    mockReq = {
      user: { userId: 'host-user-id', email: 'host@example.com' },
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

    // Setup realistic mock behaviors
    setupMockBehaviors();
  });

  function setupMockBehaviors() {
    // Event creation
    mockPrisma.event.create.mockImplementation(({ data }) => {
      const event = {
        id: `event-${Date.now()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };
      eventsDb.push(event);
      return Promise.resolve(event);
    });

    // Event find by unique code (for collision check)
    mockPrisma.event.findUnique.mockImplementation(({ where }) => {
      if (where.uniqueCode) {
        return Promise.resolve(eventsDb.find(e => e.uniqueCode === where.uniqueCode) || null);
      }
      return Promise.resolve(eventsDb.find(e => e.id === where.id) || null);
    });

    // Event find first (ownership check)
    mockPrisma.event.findFirst.mockImplementation(({ where }) => {
      return Promise.resolve(
        eventsDb.find(e => e.id === where.id && e.hostId === where.hostId) || null
      );
    });

    // Attendee creation
    mockPrisma.eventAttendee.create.mockImplementation(({ data }) => {
      const attendee = {
        id: `attendee-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      attendeesDb.push(attendee);
      return Promise.resolve(attendee);
    });

    // Attendee find first
    mockPrisma.eventAttendee.findFirst.mockImplementation(({ where }) => {
      return Promise.resolve(
        attendeesDb.find(a => {
          if (where.eventId && a.eventId !== where.eventId) return false;
          if (where.email && a.email !== where.email) return false;
          if (where.userId && a.userId !== where.userId) return false;
          if (where.accessToken && a.accessToken !== where.accessToken) return false;
          return true;
        }) || null
      );
    });

    // Attendee find unique
    mockPrisma.eventAttendee.findUnique.mockImplementation(({ where }) => {
      return Promise.resolve(attendeesDb.find(a => a.id === where.id) || null);
    });

    // Attendee find many
    mockPrisma.eventAttendee.findMany.mockImplementation(({ where }) => {
      let filtered = attendeesDb;
      if (where?.eventId) {
        filtered = filtered.filter(a => a.eventId === where.eventId);
      }
      if (where?.id?.not) {
        filtered = filtered.filter(a => a.id !== where.id.not);
      }
      return Promise.resolve(filtered);
    });

    // Match creation
    mockPrisma.eventAttendeeMatch.createMany.mockImplementation(({ data }) => {
      const newMatches = Array.isArray(data) ? data : [data];
      matchesDb.push(...newMatches.map(m => ({ id: `match-${Date.now()}`, ...m })));
      return Promise.resolve({ count: newMatches.length });
    });

    // Match find many
    mockPrisma.eventAttendeeMatch.findMany.mockImplementation(({ where }) => {
      return Promise.resolve(
        matchesDb.filter(m => m.attendeeId === where?.attendeeId)
      );
    });

    // User find
    mockPrisma.user.findUnique.mockResolvedValue(null);
  }

  describe('Complete Host Flow', () => {
    it('should allow host to create event, get QR, and view attendees', async () => {
      // Step 1: Create event
      mockReq.body = {
        name: 'Tech Networking Event',
        description: 'A gathering for tech professionals',
        dateTime: '2026-02-20T18:00:00.000Z',
        location: 'Innovation Hub',
      };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      const createResponse = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(createResponse.success).toBe(true);
      expect(createResponse.data.event.name).toBe('Tech Networking Event');

      const eventId = createResponse.data.event.id;
      const uniqueCode = createResponse.data.event.uniqueCode;

      // Step 2: Get event details
      jest.clearAllMocks();
      mockReq.params = { id: eventId };
      mockPrisma.event.findFirst.mockResolvedValue({
        ...eventsDb[0],
        _count: { attendees: 0 },
      });

      await controller.get(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const getResponse = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(getResponse.data.event.uniqueCode).toBe(uniqueCode);

      // Step 3: Generate QR code
      jest.clearAllMocks();
      mockReq.params = { id: eventId };
      mockReq.query = { format: 'base64' };
      mockPrisma.event.findFirst.mockResolvedValue({
        uniqueCode,
        name: 'Tech Networking Event',
      });
      mockQRCodeService.generateEventQR.mockResolvedValue('data:image/png;base64,QRDATA');

      await controller.getQRCode(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const qrResponse = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(qrResponse.data.qrCode).toBe('data:image/png;base64,QRDATA');
      expect(qrResponse.data.eventUrl).toContain(uniqueCode);
    });
  });

  describe('Complete Guest Flow', () => {
    let eventId: string;
    let uniqueCode: string;

    beforeEach(async () => {
      // Setup: Create an event
      const event = {
        id: 'event-test-123',
        hostId: 'host-user-id',
        name: 'Startup Meetup',
        description: 'Connect with fellow entrepreneurs',
        dateTime: new Date('2026-03-01T19:00:00.000Z'),
        location: 'Startup Hub',
        uniqueCode: 'meet1234',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      eventsDb.push(event);
      eventId = event.id;
      uniqueCode = event.uniqueCode;
    });

    it('should allow guest to view public event, register, and see matches', async () => {
      // Step 1: View public event info
      mockReq.user = undefined; // Not authenticated
      mockReq.params = { code: uniqueCode };
      mockPrisma.event.findUnique.mockResolvedValue({
        ...eventsDb[0],
        _count: { attendees: 0 },
      });

      await controller.getPublicEvent(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const publicResponse = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(publicResponse.data.event.name).toBe('Startup Meetup');

      // Step 2: Register as guest
      jest.clearAllMocks();
      mockReq.body = {
        name: 'Alice Entrepreneur',
        email: 'alice@startup.com',
        company: 'Alice Tech',
        role: 'Founder',
        bio: 'Building the future of tech',
        lookingFor: 'Investors, mentors, and tech partners',
      };
      mockPrisma.event.findUnique.mockResolvedValue(eventsDb[0]);
      mockPrisma.eventAttendee.findFirst.mockResolvedValue(null); // Not already registered

      await controller.registerGuest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      const registerResponse = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(registerResponse.data.attendee.name).toBe('Alice Entrepreneur');
      expect(registerResponse.data.accessToken).toBeDefined();

      const aliceToken = registerResponse.data.accessToken;
      const aliceId = registerResponse.data.attendee.id;

      // Step 3: Another guest registers
      jest.clearAllMocks();
      mockReq.body = {
        name: 'Bob Investor',
        email: 'bob@ventures.com',
        company: 'Bob Ventures',
        role: 'Partner',
        bio: 'Investing in early-stage startups',
        lookingFor: 'Tech founders and innovative startups',
      };
      mockPrisma.event.findUnique.mockResolvedValue(eventsDb[0]);

      await controller.registerGuest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      const bobResponse = (mockRes.json as jest.Mock).mock.calls[0][0];
      const bobId = bobResponse.data.attendee.id;

      // Step 4: Alice views attendees with matches
      jest.clearAllMocks();
      mockReq.params = { code: uniqueCode };
      mockReq.query = { token: aliceToken };
      mockPrisma.event.findUnique.mockResolvedValue(eventsDb[0]);
      mockPrisma.eventAttendee.findFirst.mockResolvedValue({
        id: aliceId,
        name: 'Alice Entrepreneur',
        accessToken: aliceToken,
        tokenExpiry: new Date(Date.now() + 86400000),
      });
      mockPrisma.eventAttendee.findMany.mockResolvedValue(attendeesDb);
      mockPrisma.eventAttendeeMatch.findMany.mockResolvedValue([
        {
          attendeeId: aliceId,
          matchedAttendeeId: bobId,
          matchLevel: 'HIGH',
          score: 75,
          reasons: '["Shared interests: tech, startups"]',
        },
      ]);

      await controller.getPublicAttendees(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const attendeesResponse = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(attendeesResponse.data.attendees).toBeDefined();
      expect(attendeesResponse.data.myInfo.name).toBe('Alice Entrepreneur');
    });

    it('should handle returning guest with existing registration', async () => {
      // First registration
      const existingAttendee = {
        id: 'attendee-existing',
        eventId: eventId,
        email: 'returning@guest.com',
        name: 'Returning Guest',
        accessToken: 'old-token',
        tokenExpiry: new Date(Date.now() - 86400000), // Expired
      };
      attendeesDb.push(existingAttendee);

      mockReq.params = { code: uniqueCode };
      mockReq.body = {
        name: 'Returning Guest',
        email: 'returning@guest.com',
      };
      mockPrisma.event.findUnique.mockResolvedValue(eventsDb[0]);
      mockPrisma.eventAttendee.findFirst.mockResolvedValue(existingAttendee);
      mockPrisma.eventAttendee.update.mockResolvedValue({
        ...existingAttendee,
        accessToken: 'new-token',
        tokenExpiry: new Date(Date.now() + 86400000),
      });

      await controller.registerGuest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.message).toBe('Already registered');
      // Token is regenerated each time, so just verify it exists
      expect(response.data.accessToken).toBeDefined();
      expect(typeof response.data.accessToken).toBe('string');
      expect(response.data.accessToken.length).toBeGreaterThan(0);
    });
  });

  describe('Matching Integration', () => {
    it('should create bidirectional matches when guest registers', async () => {
      // Setup: Event with one existing attendee
      const event = {
        id: 'event-match-test',
        hostId: 'host-id',
        uniqueCode: 'match123',
        isActive: true,
      };
      eventsDb.push(event);

      const existingAttendee = {
        id: 'attendee-existing',
        eventId: event.id,
        email: 'existing@test.com',
        name: 'Existing Person',
        lookingFor: 'Investors and mentors in technology',
      };
      attendeesDb.push(existingAttendee);

      // New guest registers with matching interests
      mockReq.params = { code: 'match123' };
      mockReq.body = {
        name: 'New Person',
        email: 'new@test.com',
        lookingFor: 'Technology partners and investors',
      };
      mockPrisma.event.findUnique.mockResolvedValue(event);
      mockPrisma.eventAttendee.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await controller.registerGuest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);

      // Verify matches were created
      expect(mockPrisma.eventAttendeeMatch.createMany).toHaveBeenCalled();
      const createMatchCall = (mockPrisma.eventAttendeeMatch.createMany as jest.Mock).mock.calls[0][0];

      // Should have 2 matches (bidirectional)
      expect(createMatchCall.data.length).toBe(2);

      // Both should have valid match levels
      expect(createMatchCall.data[0].matchLevel).toBeDefined();
      expect(createMatchCall.data[1].matchLevel).toBeDefined();
    });
  });

  describe('Host Actions on Attendees', () => {
    let eventId: string;

    beforeEach(() => {
      const event = {
        id: 'event-actions-test',
        hostId: 'host-user-id',
        name: 'Action Test Event',
        uniqueCode: 'action12',
        isActive: true,
      };
      eventsDb.push(event);
      eventId = event.id;

      // Add some attendees
      attendeesDb.push(
        { id: 'att-1', eventId, email: 'guest1@test.com', name: 'Guest One', isHost: false },
        { id: 'att-2', eventId, email: 'guest2@test.com', name: 'Guest Two', isHost: false },
      );
    });

    it('should export attendees in requested format', async () => {
      mockReq.params = { id: eventId };
      mockReq.query = { format: 'json' };
      mockPrisma.event.findFirst.mockResolvedValue(eventsDb[0]);
      mockPrisma.eventAttendee.findMany.mockResolvedValue(attendeesDb);

      await controller.exportAttendees(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.data.attendees.length).toBe(2);
    });

    it('should add attendees to contacts', async () => {
      mockReq.params = { id: eventId };
      mockReq.body = { attendeeIds: ['att-1'] };
      mockPrisma.event.findFirst.mockResolvedValue(eventsDb[0]);
      mockPrisma.eventAttendee.findMany.mockResolvedValue([attendeesDb[0]]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.contact.createMany.mockResolvedValue({ count: 1 });

      await controller.addToContacts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.data.added).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle event not found gracefully', async () => {
      mockReq.params = { code: 'nonexistent' };
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await controller.getPublicEvent(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle inactive event gracefully', async () => {
      mockReq.params = { code: 'inactive' };
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'inactive-event',
        isActive: false,
        _count: { attendees: 0 },
      });

      await controller.getPublicEvent(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle unauthorized access to host endpoints', async () => {
      mockReq.user = undefined;
      mockReq.body = { name: 'Test Event' };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle access to non-owned event', async () => {
      mockReq.params = { id: 'other-users-event' };
      mockPrisma.event.findFirst.mockResolvedValue(null); // Query includes hostId check

      await controller.get(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Pagination', () => {
    it('should paginate events list correctly', async () => {
      // Add multiple events
      for (let i = 0; i < 25; i++) {
        eventsDb.push({
          id: `event-${i}`,
          hostId: 'host-user-id',
          name: `Event ${i}`,
          uniqueCode: `code${i}`,
          isActive: true,
        });
      }

      mockReq.query = { page: '2', limit: '10' };
      mockPrisma.event.findMany.mockResolvedValue(
        eventsDb.slice(10, 20).map(e => ({ ...e, _count: { attendees: 0 } }))
      );
      mockPrisma.event.count.mockResolvedValue(25);

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.data.pagination.page).toBe(2);
      expect(response.data.pagination.limit).toBe(10);
      expect(response.data.pagination.total).toBe(25);
      expect(response.data.pagination.totalPages).toBe(3);
    });

    it('should paginate attendees list correctly', async () => {
      const event = { id: 'event-pag', hostId: 'host-user-id' };
      eventsDb.push(event);

      mockReq.params = { id: 'event-pag' };
      mockReq.query = { page: '1', limit: '5' };
      mockPrisma.event.findFirst.mockResolvedValue(event);
      mockPrisma.eventAttendee.findMany.mockResolvedValue([
        { id: 'att-1', name: 'Attendee 1' },
        { id: 'att-2', name: 'Attendee 2' },
      ]);
      mockPrisma.eventAttendee.count.mockResolvedValue(12);

      await controller.getAttendees(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.data.pagination.total).toBe(12);
      expect(response.data.pagination.totalPages).toBe(3);
    });
  });
});
