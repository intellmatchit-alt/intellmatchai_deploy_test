/**
 * MatchController Unit Tests
 */

import { Request, Response, NextFunction } from 'express';

// Mock the matching service module
jest.mock('../infrastructure/external/matching/index.js', () => ({
  getMatchingService: jest.fn().mockReturnValue({
    getMatches: jest.fn(),
    getMatchDetails: jest.fn(),
    getIntersections: jest.fn(),
    getDailyRecommendations: jest.fn(),
    recalculateScore: jest.fn(),
  }),
}));

// Mock contact repository
jest.mock('../infrastructure/repositories/PrismaContactRepository.js', () => ({
  PrismaContactRepository: jest.fn().mockImplementation(() => ({
    findByOwnerId: jest.fn(),
    findById: jest.fn(),
  })),
}));

// Mock use case
jest.mock('../application/use-cases/contact/index.js', () => ({
  GetFollowUpContactsUseCase: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
  })),
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
import { MatchController } from '../presentation/controllers/MatchController';
import { getMatchingService } from '../infrastructure/external/matching/index.js';

describe('MatchController', () => {
  let controller: MatchController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockMatchingService: any;

  beforeEach(() => {
    controller = new MatchController();
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

    // Get the mock matching service
    mockMatchingService = getMatchingService();

    jest.clearAllMocks();
  });

  describe('getMatches', () => {
    it('should return matches with scores', async () => {
      const mockMatches = [
        {
          contactId: 'contact-1',
          fullName: 'John Smith',
          finalScore: 85,
          breakdown: { goalAlignment: 30, sectorOverlap: 20 },
          reasons: ['Shared sector: Tech'],
        },
      ];

      mockReq.query = { limit: '20', minScore: '50' };
      mockMatchingService.getMatches.mockResolvedValue(mockMatches);

      await controller.getMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockMatchingService.getMatches).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          limit: 20,
          minScore: 50,
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            matches: mockMatches,
            total: 1,
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;

      await controller.getMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should return empty matches when user has no contacts', async () => {
      mockMatchingService.getMatches.mockResolvedValue([]);

      await controller.getMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            matches: [],
            total: 0,
          }),
        })
      );
    });

    it('should use default options when not provided', async () => {
      mockMatchingService.getMatches.mockResolvedValue([]);

      await controller.getMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockMatchingService.getMatches).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          limit: 20,
          minScore: 0,
        })
      );
    });
  });

  describe('getMatchDetails', () => {
    it('should return match details for a contact', async () => {
      const mockMatch = {
        contactId: 'contact-123',
        finalScore: 75,
        breakdown: { goalAlignment: 25, sectorOverlap: 20 },
        reasons: ['Shared sector: Tech'],
      };

      mockReq.params = { contactId: 'contact-123' };
      mockMatchingService.getMatchDetails.mockResolvedValue(mockMatch);

      await controller.getMatchDetails(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockMatch,
        })
      );
    });

    it('should return 404 when contact not found', async () => {
      mockReq.params = { contactId: 'nonexistent' };
      mockMatchingService.getMatchDetails.mockResolvedValue(null);

      await controller.getMatchDetails(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.params = { contactId: 'contact-123' };

      await controller.getMatchDetails(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getIntersections', () => {
    it('should return intersection details', async () => {
      const mockIntersections = {
        sectors: ['Tech', 'Finance'],
        skills: ['JavaScript'],
        interests: [],
      };

      mockReq.params = { contactId: 'contact-123' };
      mockMatchingService.getIntersections.mockResolvedValue(mockIntersections);

      await controller.getIntersections(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            contactId: 'contact-123',
            intersections: mockIntersections,
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.params = { contactId: 'contact-123' };

      await controller.getIntersections(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getDailyRecommendations', () => {
    it('should return daily recommendations', async () => {
      const mockRecommendations = [
        { contactId: 'c1', fullName: 'John', score: 90 },
        { contactId: 'c2', fullName: 'Jane', score: 85 },
      ];

      mockReq.query = { count: '5' };
      mockMatchingService.getDailyRecommendations.mockResolvedValue(mockRecommendations);

      await controller.getDailyRecommendations(mockReq as Request, mockRes as Response, mockNext);

      expect(mockMatchingService.getDailyRecommendations).toHaveBeenCalledWith('user-123', 5);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should use default count when not provided', async () => {
      mockMatchingService.getDailyRecommendations.mockResolvedValue([]);

      await controller.getDailyRecommendations(mockReq as Request, mockRes as Response, mockNext);

      expect(mockMatchingService.getDailyRecommendations).toHaveBeenCalledWith('user-123', 3);
    });
  });
});
