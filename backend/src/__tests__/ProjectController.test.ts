/**
 * ProjectController Unit Tests
 */

import { Request, Response, NextFunction } from 'express';

// Mock Prisma client
const mockPrisma = {
  project: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  projectSector: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  projectSkill: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  projectMatch: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  sector: {
    findMany: jest.fn(),
  },
  skill: {
    findMany: jest.fn(),
  },
};

jest.mock('../infrastructure/database/prisma/client.js', () => ({
  prisma: mockPrisma,
}));

// Mock ProjectMatchingService
const mockMatchingService = {
  findMatchesForProject: jest.fn(),
};

jest.mock('../infrastructure/external/projects/ProjectMatchingService.js', () => ({
  ProjectMatchingService: jest.fn().mockImplementation(() => mockMatchingService),
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
import { ProjectController } from '../presentation/controllers/ProjectController';

describe('ProjectController', () => {
  let controller: ProjectController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new ProjectController();
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

  describe('list', () => {
    it('should return paginated list of projects', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          title: 'Test Project',
          summary: 'A test project',
          stage: 'IDEA',
          sectors: [{ sector: { id: 'sector-1', name: 'Tech' } }],
          skillsNeeded: [{ skill: { id: 'skill-1', name: 'JavaScript' }, importance: 'REQUIRED' }],
          _count: { matches: 5 },
        },
      ];

      mockPrisma.project.findMany.mockResolvedValue(mockProjects);
      mockPrisma.project.count.mockResolvedValue(1);

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            projects: expect.any(Array),
            pagination: expect.objectContaining({
              page: 1,
              limit: 20,
              total: 1,
            }),
          }),
        })
      );
    });

    it('should filter by active status', async () => {
      mockReq.query = { status: 'active' };
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', isActive: true },
        })
      );
    });

    it('should filter by inactive status', async () => {
      mockReq.query = { status: 'inactive' };
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', isActive: false },
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;

      await controller.list(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('create', () => {
    it('should create a new project', async () => {
      const projectData = {
        title: 'New Project',
        summary: 'A new project',
        stage: 'IDEA',
        sectorIds: ['sector-1'],
        skills: [{ skillId: 'skill-1', importance: 'REQUIRED' }],
      };

      const createdProject = {
        id: 'project-new',
        userId: 'user-123',
        ...projectData,
        sectors: [{ sector: { id: 'sector-1', name: 'Tech' } }],
        skillsNeeded: [{ skill: { id: 'skill-1', name: 'JavaScript' }, importance: 'REQUIRED' }],
      };

      mockReq.body = projectData;
      mockPrisma.project.create.mockResolvedValue(createdProject);

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.project.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            title: 'New Project',
          }),
        })
      );
    });

    it('should throw error when title is missing', async () => {
      mockReq.body = { summary: 'A project without title' };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should throw error when summary is missing', async () => {
      mockReq.body = { title: 'A project without summary' };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.body = { title: 'Test', summary: 'Test' };

      await controller.create(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('get', () => {
    it('should return project details', async () => {
      const mockProject = {
        id: 'project-1',
        userId: 'user-123',
        title: 'Test Project',
        summary: 'A test project',
        sectors: [{ sector: { id: 'sector-1', name: 'Tech' } }],
        skillsNeeded: [{ skill: { id: 'skill-1', name: 'JavaScript' }, importance: 'REQUIRED' }],
        matches: [],
      };

      mockReq.params = { id: 'project-1' };
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);

      await controller.get(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'project-1',
            title: 'Test Project',
          }),
        })
      );
    });

    it('should return 404 when project not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await controller.get(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.params = { id: 'project-1' };

      await controller.get(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('update', () => {
    it('should update project', async () => {
      const existingProject = {
        id: 'project-1',
        userId: 'user-123',
        title: 'Old Title',
      };

      const updatedProject = {
        id: 'project-1',
        userId: 'user-123',
        title: 'New Title',
        summary: 'Updated summary',
        sectors: [],
        skillsNeeded: [],
      };

      mockReq.params = { id: 'project-1' };
      mockReq.body = { title: 'New Title' };
      mockPrisma.project.findFirst.mockResolvedValue(existingProject);
      mockPrisma.project.update.mockResolvedValue(updatedProject);

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.project.update).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when project not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockReq.body = { title: 'New Title' };
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should update sectors when provided', async () => {
      mockReq.params = { id: 'project-1' };
      mockReq.body = { sectorIds: ['sector-1', 'sector-2'] };
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
      mockPrisma.project.update.mockResolvedValue({ id: 'project-1', sectors: [], skillsNeeded: [] });

      await controller.update(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.projectSector.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.projectSector.createMany).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete project', async () => {
      mockReq.params = { id: 'project-1' };
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
      mockPrisma.project.delete.mockResolvedValue({});

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 'project-1' } });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Project deleted successfully',
        })
      );
    });

    it('should return 404 when project not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await controller.delete(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('findMatches', () => {
    it('should trigger matching and return results', async () => {
      const mockMatches = [
        { id: 'match-1', matchScore: 85 },
        { id: 'match-2', matchScore: 75 },
      ];

      mockReq.params = { id: 'project-1' };
      mockMatchingService.findMatchesForProject.mockResolvedValue(mockMatches);
      mockPrisma.projectMatch.findMany.mockResolvedValue(mockMatches.map(m => ({
        ...m,
        matchedUser: null,
        matchedContact: null,
      })));

      await controller.findMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockMatchingService.findMatchesForProject).toHaveBeenCalledWith('project-1', 'user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            matchCount: 2,
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.params = { id: 'project-1' };

      await controller.findMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getMatches', () => {
    it('should return matches for a project', async () => {
      const mockMatches = [
        { id: 'match-1', matchScore: 85, matchedUser: { fullName: 'John' }, matchedContact: null },
      ];

      mockReq.params = { id: 'project-1' };
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
      mockPrisma.projectMatch.findMany.mockResolvedValue(mockMatches);

      await controller.getMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            matches: expect.any(Array),
          }),
        })
      );
    });

    it('should filter by match type', async () => {
      mockReq.params = { id: 'project-1' };
      mockReq.query = { type: 'user' };
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
      mockPrisma.projectMatch.findMany.mockResolvedValue([]);

      await controller.getMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.projectMatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            matchType: 'user',
          }),
        })
      );
    });

    it('should filter by minimum score', async () => {
      mockReq.params = { id: 'project-1' };
      mockReq.query = { minScore: '70' };
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
      mockPrisma.projectMatch.findMany.mockResolvedValue([]);

      await controller.getMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.projectMatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            matchScore: { gte: 70 },
          }),
        })
      );
    });

    it('should return 404 when project not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await controller.getMatches(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateMatchStatus', () => {
    it('should update match status', async () => {
      mockReq.params = { id: 'project-1', matchId: 'match-1' };
      mockReq.body = { status: 'contacted' };
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
      mockPrisma.projectMatch.update.mockResolvedValue({ id: 'match-1', status: 'CONTACTED' });

      await controller.updateMatchStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.projectMatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'match-1' },
          data: { status: 'CONTACTED' },
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should throw error for invalid status', async () => {
      mockReq.params = { id: 'project-1', matchId: 'match-1' };
      mockReq.body = { status: 'invalid' };
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });

      await controller.updateMatchStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should return 404 when project not found', async () => {
      mockReq.params = { id: 'nonexistent', matchId: 'match-1' };
      mockReq.body = { status: 'contacted' };
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await controller.updateMatchStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('discover', () => {
    it('should return public projects from other users', async () => {
      const mockProjects = [
        {
          id: 'project-2',
          userId: 'user-456',
          title: 'Public Project',
          summary: 'A public project',
          visibility: 'PUBLIC',
          isActive: true,
          user: { id: 'user-456', fullName: 'Other User' },
          sectors: [],
          skillsNeeded: [],
        },
      ];

      mockPrisma.project.findMany.mockResolvedValue(mockProjects);
      mockPrisma.project.count.mockResolvedValue(1);

      await controller.discover(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: { not: 'user-123' },
            visibility: 'PUBLIC',
            isActive: true,
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should filter by category', async () => {
      mockReq.query = { category: 'healthtech' };
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);

      await controller.discover(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'healthtech',
          }),
        })
      );
    });

    it('should filter by stage', async () => {
      mockReq.query = { stage: 'MVP' };
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);

      await controller.discover(mockReq as Request, mockRes as Response, mockNext);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stage: 'MVP',
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      mockReq.user = undefined;

      await controller.discover(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
