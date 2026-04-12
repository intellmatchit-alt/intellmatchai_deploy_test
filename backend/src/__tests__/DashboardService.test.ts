/**
 * DashboardService Unit Tests
 *
 * Since DashboardService creates its own PrismaClient instance,
 * we mock at the @prisma/client level to intercept all queries.
 */

// Mock PrismaClient at the package level
const mockPrismaClient = {
  contact: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  matchResult: {
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  interaction: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  userSector: {
    count: jest.fn(),
  },
  sector: {
    count: jest.fn(),
  },
  contactSector: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
  InteractionType: {
    SCANNED: 'SCANNED',
    SAVED: 'SAVED',
    VIEWED: 'VIEWED',
    NOTED: 'NOTED',
    MEETING: 'MEETING',
    MESSAGE: 'MESSAGE',
    FOLLOW_UP: 'FOLLOW_UP',
    INTRODUCED: 'INTRODUCED',
    CALLED: 'CALLED',
    EMAILED: 'EMAILED',
  },
}));

// Mock cache service
jest.mock('../infrastructure/cache/index.js', () => ({
  cacheService: {
    isAvailable: jest.fn().mockReturnValue(false),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  },
  CACHE_TTL: {
    DASHBOARD: 300,
  },
  CACHE_KEYS: {
    DASHBOARD_STATS: 'dashboard:stats:',
    DASHBOARD_HEALTH: 'dashboard:health:',
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

// Import after mocks
import { DashboardService } from '../infrastructure/services/DashboardService';

describe('DashboardService', () => {
  let service: DashboardService;
  const userId = 'user-123';

  beforeEach(() => {
    service = new DashboardService();
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return dashboard stats', async () => {
      // The service makes many parallel calls, so we need to set up mocks carefully
      // contact.count is called 3 times (current, previous, total)
      mockPrismaClient.contact.count
        .mockResolvedValueOnce(10) // Current period contacts
        .mockResolvedValueOnce(8)  // Previous period contacts
        .mockResolvedValueOnce(50); // Total contacts

      // matchResult.count is called 2 times then 1 more for total
      mockPrismaClient.matchResult.count
        .mockResolvedValueOnce(15) // Current period matches
        .mockResolvedValueOnce(12) // Previous period matches
        .mockResolvedValueOnce(30); // Total matches

      // interaction.count is called multiple times
      mockPrismaClient.interaction.count
        .mockResolvedValueOnce(25) // Current period interactions
        .mockResolvedValueOnce(20) // Previous period interactions
        .mockResolvedValueOnce(10) // Viewed count
        .mockResolvedValueOnce(8)  // Response interactions
        .mockResolvedValueOnce(100); // Total interactions

      // Mock average match score
      mockPrismaClient.matchResult.aggregate.mockResolvedValue({
        _avg: { finalScore: 75 },
      });

      const stats = await service.getStats(userId, 'week');

      expect(stats).toHaveProperty('contacts');
      expect(stats).toHaveProperty('matches');
      expect(stats).toHaveProperty('interactions');
      expect(stats).toHaveProperty('averageMatchScore');
      expect(stats).toHaveProperty('responseRate');
      expect(typeof stats.averageMatchScore).toBe('number');
    });

    it('should handle empty data', async () => {
      mockPrismaClient.contact.count.mockResolvedValue(0);
      mockPrismaClient.matchResult.count.mockResolvedValue(0);
      mockPrismaClient.interaction.count.mockResolvedValue(0);
      mockPrismaClient.matchResult.aggregate.mockResolvedValue({ _avg: { finalScore: null } });

      const stats = await service.getStats(userId, 'week');

      expect(stats.contacts.current).toBe(0);
      expect(stats.averageMatchScore).toBe(0);
    });
  });

  describe('getNetworkHealth', () => {
    it('should calculate network health score', async () => {
      // Mock contacts with sectors and interactions
      mockPrismaClient.contact.findMany.mockResolvedValue([
        {
          id: 'c1',
          isEnriched: true,
          contactSectors: [{ sectorId: 's1' }, { sectorId: 's2' }],
          interactions: [{ id: 'i1' }],
        },
        {
          id: 'c2',
          isEnriched: false,
          contactSectors: [{ sectorId: 's1' }],
          interactions: [],
        },
      ]);

      // Mock total available sectors
      mockPrismaClient.sector.count.mockResolvedValue(10);

      // Mock contact counts for growth calculation
      mockPrismaClient.contact.count
        .mockResolvedValueOnce(5)  // This month
        .mockResolvedValueOnce(3)  // Last month
        .mockResolvedValueOnce(2)  // This week
        .mockResolvedValueOnce(1); // Last week

      // Mock high matches
      mockPrismaClient.matchResult.count
        .mockResolvedValueOnce(3)  // High matches (>=70)
        .mockResolvedValueOnce(5); // Total matches

      const health = await service.getNetworkHealth(userId);

      expect(health).toEqual(
        expect.objectContaining({
          overallScore: expect.any(Number),
          diversity: expect.objectContaining({
            score: expect.any(Number),
            sectorCount: 2,
          }),
          engagement: expect.objectContaining({
            score: expect.any(Number),
            activeContactsPercent: 50,
          }),
          growth: expect.objectContaining({
            score: expect.any(Number),
          }),
          quality: expect.objectContaining({
            score: expect.any(Number),
          }),
        })
      );
    });

    it('should handle empty network', async () => {
      mockPrismaClient.contact.findMany.mockResolvedValue([]);
      mockPrismaClient.sector.count.mockResolvedValue(10);
      mockPrismaClient.contact.count.mockResolvedValue(0);
      mockPrismaClient.matchResult.count.mockResolvedValue(0);

      const health = await service.getNetworkHealth(userId);

      // With no contacts, diversity and engagement should be 0
      // Growth score has a base of 50, quality is 0
      // Overall = (0 * 0.25) + (0 * 0.30) + (50 * 0.25) + (0 * 0.20) = 12.5 -> 13
      expect(health.diversity.sectorCount).toBe(0);
      expect(health.diversity.score).toBe(0);
      expect(health.engagement.score).toBe(0);
    });
  });

  describe('getActivityTimeline', () => {
    it('should return activity items', async () => {
      const mockInteractions = [
        {
          id: 'i1',
          interactionType: 'MEETING',
          notes: 'Had lunch',
          metadata: {},
          occurredAt: new Date(),
          contact: { id: 'c1', fullName: 'John Smith', company: 'Tech Corp' },
        },
      ];

      const mockContacts = [
        {
          id: 'c2',
          fullName: 'Jane Doe',
          company: 'Finance Inc',
          createdAt: new Date(Date.now() - 3600000),
        },
      ];

      mockPrismaClient.interaction.findMany.mockResolvedValue(mockInteractions);
      mockPrismaClient.contact.findMany.mockResolvedValue(mockContacts);

      const activity = await service.getActivityTimeline(userId, 10);

      expect(activity).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            type: expect.any(String),
            title: expect.any(String),
          }),
        ])
      );
    });

    it('should sort by timestamp descending', async () => {
      const now = new Date();
      const oneHourAgo = new Date(Date.now() - 3600000);

      mockPrismaClient.interaction.findMany.mockResolvedValue([
        {
          id: 'i1',
          interactionType: 'MEETING',
          notes: 'Old meeting',
          metadata: {},
          occurredAt: oneHourAgo,
          contact: { id: 'c1', fullName: 'A', company: null },
        },
      ]);
      mockPrismaClient.contact.findMany.mockResolvedValue([
        {
          id: 'c2',
          fullName: 'B',
          company: null,
          createdAt: now,
        },
      ]);

      const activity = await service.getActivityTimeline(userId, 10);

      // Most recent should be first
      expect(activity.length).toBeGreaterThanOrEqual(1);
      // First item should be the newer contact, not the older interaction
      if (activity.length >= 2) {
        expect(activity[0].occurredAt.getTime()).toBeGreaterThanOrEqual(activity[1].occurredAt.getTime());
      }
    });
  });

  describe('getChartData', () => {
    it('should return chart data for visualizations', async () => {
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);

      // Mock contacts over time - all records need createdAt field
      mockPrismaClient.contact.findMany.mockResolvedValue([
        { createdAt: today },
        { createdAt: yesterday },
      ]);

      // Mock matches over time - all records need createdAt field
      mockPrismaClient.matchResult.findMany.mockResolvedValue([
        { createdAt: today, finalScore: 80 },
        { createdAt: yesterday, finalScore: 60 },
        { createdAt: yesterday, finalScore: 90 },
      ]);

      // Mock interactions over time - all records need occurredAt field
      mockPrismaClient.interaction.findMany.mockResolvedValue([
        { occurredAt: today, interactionType: 'MEETING' },
      ]);

      // Mock interactions by type
      mockPrismaClient.interaction.groupBy.mockResolvedValue([
        { interactionType: 'MEETING', _count: 10 },
        { interactionType: 'EMAILED', _count: 20 },
      ]);

      // Mock contacts by sector
      mockPrismaClient.contactSector.findMany.mockResolvedValue([
        { sector: { name: 'Tech' } },
        { sector: { name: 'Finance' } },
        { sector: { name: 'Tech' } },
      ]);

      const chartData = await service.getChartData(userId, 30);

      expect(chartData).toEqual(
        expect.objectContaining({
          contactsOverTime: expect.any(Array),
          matchesOverTime: expect.any(Array),
          interactionsOverTime: expect.any(Array),
          interactionsByType: expect.any(Array),
          contactsBySector: expect.any(Array),
          matchScoreDistribution: expect.any(Array),
        })
      );
    });

    it('should handle empty data', async () => {
      mockPrismaClient.contact.findMany.mockResolvedValue([]);
      mockPrismaClient.matchResult.findMany.mockResolvedValue([]);
      mockPrismaClient.interaction.findMany.mockResolvedValue([]);
      mockPrismaClient.interaction.groupBy.mockResolvedValue([]);
      mockPrismaClient.contactSector.findMany.mockResolvedValue([]);

      const chartData = await service.getChartData(userId, 7);

      expect(chartData.contactsOverTime).toHaveLength(7);
      expect(chartData.contactsOverTime.every((d: any) => d.value === 0)).toBe(true);
    });
  });
});
