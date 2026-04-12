/**
 * Profile Management E2E Tests
 *
 * Tests the complete profile management flow.
 */

import { Request, Response, NextFunction } from 'express';

// Mock all dependencies
jest.mock('../../infrastructure/database/prisma/client.js', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userSector: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    userSkill: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    userInterest: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    userGoal: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    consentLog: {
      create: jest.fn(),
    },
    sector: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    skill: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    interest: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback({
      userSector: { deleteMany: jest.fn(), createMany: jest.fn() },
      userSkill: { deleteMany: jest.fn(), createMany: jest.fn() },
      userInterest: { deleteMany: jest.fn(), createMany: jest.fn() },
      userGoal: { deleteMany: jest.fn(), createMany: jest.fn() },
      sector: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      skill: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      interest: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      user: { update: jest.fn() },
    })),
  },
}));

jest.mock('../../infrastructure/external/storage/StorageServiceFactory.js', () => ({
  StorageServiceFactory: {
    create: jest.fn().mockReturnValue({
      uploadFile: jest.fn().mockResolvedValue('https://storage.example.com/avatar.jpg'),
      deleteFile: jest.fn().mockResolvedValue(true),
    }),
  },
}));

jest.mock('../../shared/logger/index.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

import { ProfileController } from '../../presentation/controllers/ProfileController';
import { prisma } from '../../infrastructure/database/prisma/client.js';

describe('Profile Management E2E Tests', () => {
  let controller: ProfileController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    bio: 'Original bio',
    company: 'Test Corp',
    jobTitle: 'Developer',
    location: 'New York',
    phone: '+1234567890',
    linkedinUrl: 'https://linkedin.com/in/testuser',
    avatarUrl: null,
    isOnboarded: true,
    userSectors: [{ sector: { id: 's1', name: 'Technology' } }],
    userSkills: [{ skill: { id: 'sk1', name: 'JavaScript' } }],
    userInterests: [{ interest: { id: 'i1', name: 'AI' } }],
    userGoals: [{ goalType: 'MENTORSHIP', description: 'Find a mentor' }],
  };

  beforeEach(() => {
    controller = new ProfileController();
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
    jest.clearAllMocks();
  });

  describe('Complete Profile Flow', () => {
    it('should complete full profile setup flow', async () => {
      // Step 1: Get initial profile
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await controller.getProfile(mockReq as Request, mockRes as Response, mockNext);

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

      // Step 2: Update basic profile info
      jest.clearAllMocks();
      mockReq.body = {
        fullName: 'Updated Name',
        bio: 'Updated bio',
        company: 'New Company',
        jobTitle: 'Senior Developer',
        location: 'San Francisco',
      };

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        ...mockReq.body,
      });

      await controller.updateProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            fullName: 'Updated Name',
            bio: 'Updated bio',
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);

      // Step 3: Update sectors
      jest.clearAllMocks();
      mockReq.body = {
        sectors: ['s1', 's2', 's3'],
      };

      (prisma.userSector.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.userSector.createMany as jest.Mock).mockResolvedValue({ count: 3 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        userSectors: [
          { sector: { id: 's1', name: 'Technology' } },
          { sector: { id: 's2', name: 'Finance' } },
          { sector: { id: 's3', name: 'Healthcare' } },
        ],
      });

      await controller.updateSectors(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.userSector.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(prisma.userSector.createMany).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);

      // Step 4: Update skills
      jest.clearAllMocks();
      mockReq.body = {
        skills: ['sk1', 'sk2'],
      };

      (prisma.userSkill.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.userSkill.createMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        userSkills: [
          { skill: { id: 'sk1', name: 'JavaScript' } },
          { skill: { id: 'sk2', name: 'Python' } },
        ],
      });

      await controller.updateSkills(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.userSkill.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);

      // Step 5: Update goals
      jest.clearAllMocks();
      mockReq.body = {
        goals: [
          { goalType: 'MENTORSHIP', description: 'Find a senior mentor' },
          { goalType: 'COLLABORATION', description: 'Find project partners' },
        ],
      };

      (prisma.userGoal.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.userGoal.createMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        userGoals: mockReq.body.goals,
      });

      await controller.updateGoals(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.userGoal.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle avatar upload flow', async () => {
      mockReq.file = {
        buffer: Buffer.from('fake-image-data'),
        mimetype: 'image/jpeg',
        originalname: 'avatar.jpg',
        size: 1024,
      } as any;

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        avatarUrl: 'https://storage.example.com/avatar.jpg',
      });

      await controller.uploadAvatar(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            avatarUrl: expect.any(String),
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle consent update with logging', async () => {
      mockReq.body = {
        dataProcessing: true,
        marketing: false,
        thirdPartySharing: false,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        consentDataProcessing: false,
        consentMarketing: true,
        consentThirdPartySharing: true,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        consentDataProcessing: true,
        consentMarketing: false,
        consentThirdPartySharing: false,
      });
      (prisma.consentLog.create as jest.Mock).mockResolvedValue({});

      await controller.updateConsent(mockReq as Request, mockRes as Response, mockNext);

      // Should log consent changes
      expect(prisma.consentLog.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Onboarding Flow', () => {
    it('should complete onboarding with all data', async () => {
      mockReq.body = {
        fullName: 'New User',
        bio: 'My bio',
        company: 'Startup Inc',
        jobTitle: 'Founder',
        location: 'Austin',
        sectors: ['s1', 's2'],
        skills: ['sk1'],
        interests: ['i1'],
        goals: [{ goalType: 'INVESTMENT', description: 'Raise seed round' }],
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        id: 'user-123',
        isOnboarded: true,
        ...mockReq.body,
      });

      await controller.completeOnboarding(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            isOnboarded: true,
          }),
        })
      );
    });
  });

  describe('Account Deletion Flow', () => {
    it('should deactivate account', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
        deletedAt: new Date(),
      });

      await controller.deleteAccount(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            isActive: false,
            deletedAt: expect.any(Date),
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthenticated requests', async () => {
      mockReq.user = undefined;

      await controller.getProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await controller.getProfile(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle invalid sectors array', async () => {
      mockReq.body = {
        sectors: 'not-an-array',
      };

      await controller.updateSectors(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
