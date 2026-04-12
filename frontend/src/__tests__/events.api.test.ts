/**
 * Events API Client Tests
 *
 * Tests for the events API client functions.
 */

// Mock the api client
jest.mock('../lib/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

// Import after mocking
import { api } from '../lib/api/client';
import {
  createEvent,
  getHostedEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getEventAttendees,
  exportAttendees,
  addAttendeesToContacts,
  inviteAttendees,
  getEventQRCode,
  getMyEventMatches,
  getAttendedEvents,
  getPublicEvent,
  registerForEvent,
  getPublicAttendees,
} from '../lib/api/events';

// Type the mocked api
const mockApi = api as jest.Mocked<typeof api>;

describe('Events API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===== Host Event Endpoints =====

  describe('createEvent', () => {
    it('should create an event', async () => {
      const eventData = {
        name: 'Tech Networking',
        description: 'A networking event',
        dateTime: '2026-02-20T18:00:00.000Z',
        location: 'Conference Center',
      };
      const mockResponse = {
        event: { id: 'event-1', ...eventData, uniqueCode: 'abc12345' },
        eventUrl: 'https://intellmatch.com/e/abc12345',
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await createEvent(eventData);

      expect(mockApi.post).toHaveBeenCalledWith('/events', eventData);
      expect(result.event.name).toBe('Tech Networking');
      expect(result.eventUrl).toContain('abc12345');
    });

    it('should create event with minimal data', async () => {
      const eventData = {
        name: 'Simple Event',
        dateTime: '2026-03-01T10:00:00.000Z',
      };
      mockApi.post.mockResolvedValue({ event: { id: 'event-2', ...eventData }, eventUrl: '' });

      await createEvent(eventData);

      expect(mockApi.post).toHaveBeenCalledWith('/events', eventData);
    });
  });

  describe('getHostedEvents', () => {
    it('should fetch hosted events without params', async () => {
      const mockResponse = {
        events: [{ id: 'event-1', name: 'Event 1' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getHostedEvents();

      expect(mockApi.get).toHaveBeenCalledWith('/events');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch hosted events with pagination', async () => {
      mockApi.get.mockResolvedValue({ events: [], pagination: {} });

      await getHostedEvents({ page: 2, limit: 10 });

      expect(mockApi.get).toHaveBeenCalledWith('/events?page=2&limit=10');
    });

    it('should fetch active events only', async () => {
      mockApi.get.mockResolvedValue({ events: [], pagination: {} });

      await getHostedEvents({ status: 'active' });

      expect(mockApi.get).toHaveBeenCalledWith('/events?status=active');
    });

    it('should fetch inactive events only', async () => {
      mockApi.get.mockResolvedValue({ events: [], pagination: {} });

      await getHostedEvents({ status: 'inactive' });

      expect(mockApi.get).toHaveBeenCalledWith('/events?status=inactive');
    });
  });

  describe('getEvent', () => {
    it('should fetch event by ID', async () => {
      const mockResponse = {
        event: { id: 'event-1', name: 'Test Event', uniqueCode: 'test1234' },
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getEvent('event-1');

      expect(mockApi.get).toHaveBeenCalledWith('/events/event-1');
      expect(result.event.id).toBe('event-1');
    });
  });

  describe('updateEvent', () => {
    it('should update event name', async () => {
      const updateData = { name: 'Updated Event Name' };
      mockApi.put.mockResolvedValue({ event: { id: 'event-1', ...updateData } });

      await updateEvent('event-1', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/events/event-1', updateData);
    });

    it('should update multiple event fields', async () => {
      const updateData = {
        name: 'New Name',
        description: 'New Description',
        location: 'New Location',
        isActive: false,
      };
      mockApi.put.mockResolvedValue({ event: { id: 'event-1', ...updateData } });

      await updateEvent('event-1', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/events/event-1', updateData);
    });
  });

  describe('deleteEvent', () => {
    it('should delete event', async () => {
      mockApi.delete.mockResolvedValue(undefined);

      await deleteEvent('event-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/events/event-1');
    });
  });

  describe('getEventAttendees', () => {
    it('should fetch attendees without params', async () => {
      const mockResponse = {
        attendees: [{ id: 'att-1', name: 'John', email: 'john@example.com' }],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getEventAttendees('event-1');

      expect(mockApi.get).toHaveBeenCalledWith('/events/event-1/attendees');
      expect(result.attendees.length).toBe(1);
    });

    it('should fetch attendees with pagination', async () => {
      mockApi.get.mockResolvedValue({ attendees: [], pagination: {} });

      await getEventAttendees('event-1', { page: 2, limit: 20 });

      expect(mockApi.get).toHaveBeenCalledWith('/events/event-1/attendees?page=2&limit=20');
    });

    it('should fetch attendees with search', async () => {
      mockApi.get.mockResolvedValue({ attendees: [], pagination: {} });

      await getEventAttendees('event-1', { search: 'john' });

      expect(mockApi.get).toHaveBeenCalledWith('/events/event-1/attendees?search=john');
    });
  });

  describe('exportAttendees', () => {
    it('should export as JSON', async () => {
      const mockResponse = {
        attendees: [{ id: 'att-1', name: 'John' }],
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await exportAttendees('event-1', 'json');

      expect(mockApi.post).toHaveBeenCalledWith('/events/event-1/attendees/export?format=json', {});
      expect(result).toEqual(mockResponse);
    });

    it('should export as CSV by default', async () => {
      mockApi.post.mockResolvedValue('Name,Email\nJohn,john@example.com');

      await exportAttendees('event-1');

      expect(mockApi.post).toHaveBeenCalledWith('/events/event-1/attendees/export?format=csv', {});
    });
  });

  describe('addAttendeesToContacts', () => {
    it('should add all attendees when no IDs specified', async () => {
      const mockResponse = { added: 5, skipped: 2, total: 7 };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await addAttendeesToContacts('event-1');

      expect(mockApi.post).toHaveBeenCalledWith('/events/event-1/attendees/add-to-contacts', {
        attendeeIds: undefined,
      });
      expect(result.added).toBe(5);
    });

    it('should add specific attendees', async () => {
      mockApi.post.mockResolvedValue({ added: 2, skipped: 0, total: 2 });

      await addAttendeesToContacts('event-1', ['att-1', 'att-2']);

      expect(mockApi.post).toHaveBeenCalledWith('/events/event-1/attendees/add-to-contacts', {
        attendeeIds: ['att-1', 'att-2'],
      });
    });
  });

  describe('inviteAttendees', () => {
    it('should invite all attendees', async () => {
      const mockResponse = {
        toInvite: 3,
        alreadyUsers: 2,
        emails: ['new1@example.com', 'new2@example.com', 'new3@example.com'],
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await inviteAttendees('event-1');

      expect(mockApi.post).toHaveBeenCalledWith('/events/event-1/invite-all', {});
      expect(result.toInvite).toBe(3);
    });

    it('should invite specific attendees with message', async () => {
      mockApi.post.mockResolvedValue({ toInvite: 1, alreadyUsers: 0, emails: [] });

      await inviteAttendees('event-1', {
        attendeeIds: ['att-1'],
        message: 'Join us on IntellMatch!',
      });

      expect(mockApi.post).toHaveBeenCalledWith('/events/event-1/invite-all', {
        attendeeIds: ['att-1'],
        message: 'Join us on IntellMatch!',
      });
    });
  });

  describe('getEventQRCode', () => {
    it('should get QR code as base64 by default', async () => {
      const mockResponse = {
        qrCode: 'data:image/png;base64,QRCODE_DATA',
        eventUrl: 'https://intellmatch.com/e/abc12345',
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getEventQRCode('event-1');

      expect(mockApi.get).toHaveBeenCalledWith('/events/event-1/qr?format=base64&size=300');
      expect(result).toBe('data:image/png;base64,QRCODE_DATA');
    });

    it('should get QR code as PNG with custom size', async () => {
      mockApi.get.mockResolvedValue({ qrCode: 'png-data', eventUrl: '' });

      await getEventQRCode('event-1', 'png', 500);

      expect(mockApi.get).toHaveBeenCalledWith('/events/event-1/qr?format=png&size=500');
    });

    it('should get QR code as SVG', async () => {
      mockApi.get.mockResolvedValue({ qrCode: '<svg>...</svg>', eventUrl: '' });

      await getEventQRCode('event-1', 'svg');

      expect(mockApi.get).toHaveBeenCalledWith('/events/event-1/qr?format=svg&size=300');
    });
  });

  describe('getMyEventMatches', () => {
    it('should get matches for event', async () => {
      const mockResponse = {
        matches: [
          { id: 'att-2', name: 'Match Person', matchLevel: 'HIGH', matchScore: 85 },
        ],
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getMyEventMatches('event-1');

      expect(mockApi.get).toHaveBeenCalledWith('/events/event-1/my-matches');
      expect(result.matches.length).toBe(1);
    });
  });

  describe('getAttendedEvents', () => {
    it('should get attended events without params', async () => {
      const mockResponse = {
        events: [
          {
            event: { id: 'event-1', name: 'Tech Meetup' },
            myRegistration: { id: 'reg-1', createdAt: '2026-01-15' },
            highMatches: 3,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getAttendedEvents();

      expect(mockApi.get).toHaveBeenCalledWith('/events/attended');
      expect(result.events[0].highMatches).toBe(3);
    });

    it('should get attended events with pagination', async () => {
      mockApi.get.mockResolvedValue({ events: [], pagination: {} });

      await getAttendedEvents({ page: 2, limit: 10 });

      expect(mockApi.get).toHaveBeenCalledWith('/events/attended?page=2&limit=10');
    });
  });

  // ===== Public Event Endpoints =====

  describe('getPublicEvent', () => {
    it('should get public event info', async () => {
      const mockResponse = {
        event: {
          id: 'event-1',
          name: 'Public Networking',
          description: 'An open event',
          dateTime: '2026-03-01T18:00:00.000Z',
          location: 'Downtown',
          attendeeCount: 25,
        },
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getPublicEvent('abc12345');

      expect(mockApi.get).toHaveBeenCalledWith('/events/public/abc12345', { requireAuth: false });
      expect(result.event.name).toBe('Public Networking');
      expect(result.event.attendeeCount).toBe(25);
    });
  });

  describe('registerForEvent', () => {
    it('should register guest for event', async () => {
      const registrationData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        company: 'Tech Corp',
        role: 'Developer',
        bio: 'Full-stack developer',
        lookingFor: 'Investors and mentors',
      };
      const mockResponse = {
        attendee: { id: 'att-new', ...registrationData },
        accessToken: 'guest-token-123',
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await registerForEvent('abc12345', registrationData);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/events/public/abc12345/register',
        registrationData,
        { requireAuth: false }
      );
      expect(result.accessToken).toBe('guest-token-123');
    });

    it('should register with minimal data', async () => {
      const registrationData = {
        name: 'John Doe',
        email: 'john@example.com',
      };
      mockApi.post.mockResolvedValue({ attendee: {}, accessToken: 'token' });

      await registerForEvent('abc12345', registrationData);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/events/public/abc12345/register',
        registrationData,
        { requireAuth: false }
      );
    });
  });

  describe('getPublicAttendees', () => {
    it('should get attendees with token', async () => {
      const mockResponse = {
        attendees: [
          { id: 'att-1', name: 'Person 1', matchLevel: 'HIGH' },
          { id: 'att-2', name: 'Person 2', matchLevel: 'LOW' },
        ],
        myInfo: { id: 'att-me', name: 'Me' },
        total: 2,
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getPublicAttendees('abc12345', 'my-token');

      expect(mockApi.get).toHaveBeenCalledWith(
        '/events/public/abc12345/attendees?token=my-token',
        { requireAuth: false }
      );
      expect(result.attendees.length).toBe(2);
      expect(result.myInfo.name).toBe('Me');
    });

    it('should get attendees without token (for logged-in users)', async () => {
      mockApi.get.mockResolvedValue({ attendees: [], myInfo: {}, total: 0 });

      await getPublicAttendees('abc12345');

      expect(mockApi.get).toHaveBeenCalledWith(
        '/events/public/abc12345/attendees',
        { requireAuth: false }
      );
    });

    it('should encode token properly', async () => {
      mockApi.get.mockResolvedValue({ attendees: [], myInfo: {}, total: 0 });

      await getPublicAttendees('abc12345', 'token+with=special&chars');

      expect(mockApi.get).toHaveBeenCalledWith(
        '/events/public/abc12345/attendees?token=token%2Bwith%3Dspecial%26chars',
        { requireAuth: false }
      );
    });
  });
});
