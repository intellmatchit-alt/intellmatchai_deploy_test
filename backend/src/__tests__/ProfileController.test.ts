/**
 * ProfileController Unit Tests
 */

import { Request, Response, NextFunction } from 'express';
import { ProfileController } from '../presentation/controllers/ProfileController';

// Mock prisma
jest.mock('../infrastructure/database/prisma/client.js', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userSector: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    userSkill: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    userInterest: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    userGoal: {
      updateMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    consentLog: {
      createMany: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn({
      user: { update: jest.fn() },
      sector: { create: jest.fn() },
      skill: { upsert: jest.fn() },
      interest: { upsert: jest.fn() },
      userSector: { deleteMany: jest.fn(), createMany: jest.fn() },
      userSkill: { deleteMany: jest.fn(), createMany: jest.fn() },
      userInterest: { deleteMany: jest.fn(), createMany: jest.fn() },
      userGoal: { updateMany: jest.fn(), createMany: jest.fn() },
    })),
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

const { prisma } = require('../infrastructure/database/prisma/client.js');

describe('ProfileController', () => {
  let controller: ProfileController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new ProfileController();
    mockReq = {
      user: { userId: 'test-user-id', email: 'test@example.com' },
      body: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
      connection: { remoteAddress: '127.0.0.1' } as any,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        fullName: 'Test User',
        jobTitle: 'Developer',
        company: 'Test Co',
        bio: 'Test bio',
        avatarUrl: null,
        linkedinUrl: null,
        websiteUrl: null,
        phone: null,
        location: 'NYC',
        timezone: 'UTC',
        consentEnrichment: true,
        consentContacts: true,
        consentAnalytics: false,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        userSectors: [],
        userSkills: [],
        userInterests: [],
        userGoals: [],
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await controller.getProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-user-id' },
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            email: 'test@example.com',
            fullName: 'Test User',
          }),
        })
      );
    });

    it('should throw error when user is not authenticated', async () => {
      mockReq.user = undefined;

      await controller.getProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should return 404 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await controller.getProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'NOT_FOUND' }),
        })
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const updatedUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        fullName: 'Updated Name',
        jobTitle: 'Senior Developer',
        company: 'New Co',
        bio: 'Updated bio',
        avatarUrl: null,
        linkedinUrl: null,
        websiteUrl: null,
        phone: null,
        location: 'LA',
        timezone: 'PST',
      };

      mockReq.body = {
        fullName: 'Updated Name',
        jobTitle: 'Senior Developer',
        company: 'New Co',
        bio: 'Updated bio',
        location: 'LA',
      };

      prisma.user.update.mockResolvedValue(updatedUser);

      await controller.updateProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-user-id' },
          data: expect.objectContaining({
            fullName: 'Updated Name',
            jobTitle: 'Senior Developer',
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            fullName: 'Updated Name',
          }),
        })
      );
    });

    it('should throw error when user is not authenticated', async () => {
      mockReq.user = undefined;

      await controller.updateProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateSectors', () => {
    it('should update sectors successfully', async () => {
      mockReq.body = {
        sectors: [
          { sectorId: 'sector-1', isPrimary: true },
          { sectorId: 'sector-2', isPrimary: false },
        ],
      };

      prisma.userSector.deleteMany.mockResolvedValue({ count: 0 });
      prisma.userSector.createMany.mockResolvedValue({ count: 2 });
      prisma.userSector.findMany.mockResolvedValue([
        {
          sector: { id: 'sector-1', name: 'Technology', nameAr: 'تكنولوجيا' },
          isPrimary: true,
          experienceYears: null,
        },
      ]);

      await controller.updateSectors(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.userSector.deleteMany).toHaveBeenCalled();
      expect(prisma.userSector.createMany).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should throw validation error when sectors is not an array', async () => {
      mockReq.body = { sectors: 'not-an-array' };

      await controller.updateSectors(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateSkills', () => {
    it('should update skills successfully', async () => {
      mockReq.body = {
        skills: [
          { skillId: 'skill-1', proficiencyLevel: 'EXPERT' },
          { skillId: 'skill-2', proficiencyLevel: 'INTERMEDIATE' },
        ],
      };

      prisma.userSkill.deleteMany.mockResolvedValue({ count: 0 });
      prisma.userSkill.createMany.mockResolvedValue({ count: 2 });
      prisma.userSkill.findMany.mockResolvedValue([
        {
          skill: { id: 'skill-1', name: 'JavaScript', nameAr: null, category: 'Programming' },
          proficiencyLevel: 'EXPERT',
          isVerified: false,
        },
      ]);

      await controller.updateSkills(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.userSkill.deleteMany).toHaveBeenCalled();
      expect(prisma.userSkill.createMany).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('updateGoals', () => {
    it('should update goals successfully', async () => {
      mockReq.body = {
        goals: [
          { type: 'MENTORSHIP', description: 'Find a mentor', priority: 1 },
          { type: 'PARTNERSHIP', priority: 2 },
        ],
      };

      prisma.userGoal.updateMany.mockResolvedValue({ count: 0 });
      prisma.userGoal.createMany.mockResolvedValue({ count: 2 });
      prisma.userGoal.findMany.mockResolvedValue([
        { id: 'goal-1', goalType: 'MENTORSHIP', description: 'Find a mentor', priority: 1 },
      ]);

      await controller.updateGoals(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.userGoal.updateMany).toHaveBeenCalled();
      expect(prisma.userGoal.createMany).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('updateConsent', () => {
    it('should update consent and log changes', async () => {
      mockReq.body = {
        enrichment: false,
        analytics: true,
      };

      prisma.user.findUnique.mockResolvedValue({
        consentEnrichment: true,
        consentContacts: true,
        consentAnalytics: false,
      });

      prisma.user.update.mockResolvedValue({
        consentEnrichment: false,
        consentContacts: true,
        consentAnalytics: true,
      });

      prisma.consentLog.createMany.mockResolvedValue({ count: 2 });

      await controller.updateConsent(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.consentLog.createMany).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('uploadAvatar', () => {
    it('should upload avatar successfully', async () => {
      mockReq.file = {
        buffer: Buffer.from('test-image'),
        mimetype: 'image/png',
        size: 1000,
      } as any;

      prisma.user.update.mockResolvedValue({
        avatarUrl: 'data:image/png;base64,dGVzdC1pbWFnZQ==',
      });

      await controller.uploadAvatar(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return error when no file uploaded', async () => {
      mockReq.file = undefined;

      await controller.uploadAvatar(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'NO_FILE' }),
        })
      );
    });
  });

  describe('deleteAccount', () => {
    it('should deactivate account successfully', async () => {
      prisma.user.update.mockResolvedValue({ isActive: false });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await controller.deleteAccount(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        })
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
