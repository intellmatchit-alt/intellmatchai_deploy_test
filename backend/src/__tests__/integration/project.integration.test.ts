/**
 * Project API Integration Tests
 *
 * Tests the project API endpoints with mocked services.
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
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  sector: {
    findMany: jest.fn(),
  },
  skill: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  contact: {
    findMany: jest.fn(),
  },
};

jest.mock('../../infrastructure/database/prisma/client.js', () => ({
  prisma: mockPrisma,
}));

// Mock ProjectMatchingService
const mockFindMatchesForProject = jest.fn();
jest.mock('../../infrastructure/external/projects/ProjectMatchingService.js', () => ({
  ProjectMatchingService: jest.fn().mockImplementation(() => ({
    findMatchesForProject: mockFindMatchesForProject,
    extractProjectKeywords: jest.fn().mockResolvedValue(['tech', 'startup']),
    getActiveProvider: jest.fn().mockReturnValue('groq'),
  })),
}));

// Mock queue service
const mockTriggerProjectMatching = jest.fn();
const mockGetProjectMatchingJobStatus = jest.fn();
jest.mock('../../infrastructure/queue/index.js', () => ({
  triggerProjectMatching: mockTriggerProjectMatching,
  getProjectMatchingJobStatus: mockGetProjectMatchingJobStatus,
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

import { ProjectController } from '../../presentation/controllers/ProjectController';

describe('Project API Integration Tests', () => {
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

  describe('Project CRUD Operations', () => {
    describe('POST /projects - Create Project', () => {
      it('should create project with all fields', async () => {
        const projectData = {
          title: 'AI Healthcare Platform',
          summary: 'Building an AI-powered healthcare platform for diagnostics',
          detailedDesc: 'Detailed description of the platform...',
          category: 'healthtech',
          stage: 'MVP',
          investmentRange: '$100K - $500K',
          timeline: '12 months',
          lookingFor: ['investor', 'technical_partner'],
          sectorIds: ['sector-health', 'sector-tech'],
          skills: [
            { skillId: 'skill-ml', importance: 'REQUIRED' },
            { skillId: 'skill-python', importance: 'PREFERRED' },
          ],
          visibility: 'PUBLIC',
        };

        const createdProject = {
          id: 'project-new',
          userId: 'user-123',
          ...projectData,
          keywords: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          sectors: [
            { sector: { id: 'sector-health', name: 'Healthcare' } },
            { sector: { id: 'sector-tech', name: 'Technology' } },
          ],
          skillsNeeded: [
            { skill: { id: 'skill-ml', name: 'Machine Learning' }, importance: 'REQUIRED' },
            { skill: { id: 'skill-python', name: 'Python' }, importance: 'PREFERRED' },
          ],
        };

        mockReq.body = projectData;
        mockPrisma.project.create.mockResolvedValue(createdProject);

        await controller.create(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.project.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'AI Healthcare Platform',
              summary: expect.any(String),
              stage: 'MVP',
              visibility: 'PUBLIC',
            }),
          })
        );
        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              id: 'project-new',
              title: 'AI Healthcare Platform',
            }),
          })
        );
      });

      it('should create project with minimal required fields', async () => {
        mockReq.body = {
          title: 'Simple Project',
          summary: 'A simple project idea',
        };

        mockPrisma.project.create.mockResolvedValue({
          id: 'project-simple',
          userId: 'user-123',
          title: 'Simple Project',
          summary: 'A simple project idea',
          stage: 'IDEA',
          visibility: 'PUBLIC',
          sectors: [],
          skillsNeeded: [],
        });

        await controller.create(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(201);
      });

      it('should reject project without title', async () => {
        mockReq.body = { summary: 'No title project' };

        await controller.create(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('required'),
          })
        );
      });

      it('should reject project without summary', async () => {
        mockReq.body = { title: 'No summary project' };

        await controller.create(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('required'),
          })
        );
      });

      it('should reject unauthenticated request', async () => {
        mockReq.user = undefined;
        mockReq.body = { title: 'Test', summary: 'Test' };

        await controller.create(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('GET /projects - List Projects', () => {
      it('should return paginated projects list', async () => {
        const mockProjects = [
          {
            id: 'project-1',
            title: 'Project 1',
            summary: 'Summary 1',
            stage: 'IDEA',
            isActive: true,
            sectors: [{ sector: { id: 's1', name: 'Tech' } }],
            skillsNeeded: [],
            _count: { matches: 3 },
          },
          {
            id: 'project-2',
            title: 'Project 2',
            summary: 'Summary 2',
            stage: 'MVP',
            isActive: true,
            sectors: [],
            skillsNeeded: [{ skill: { id: 'sk1', name: 'Python' }, importance: 'REQUIRED' }],
            _count: { matches: 0 },
          },
        ];

        mockPrisma.project.findMany.mockResolvedValue(mockProjects);
        mockPrisma.project.count.mockResolvedValue(2);

        await controller.list(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              projects: expect.arrayContaining([
                expect.objectContaining({ id: 'project-1', matchCount: 3 }),
                expect.objectContaining({ id: 'project-2', matchCount: 0 }),
              ]),
              pagination: expect.objectContaining({
                page: 1,
                limit: 20,
                total: 2,
                totalPages: 1,
              }),
            }),
          })
        );
      });

      it('should support pagination', async () => {
        mockReq.query = { page: '2', limit: '10' };
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.project.count.mockResolvedValue(25);

        await controller.list(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 10,
            take: 10,
          })
        );
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              pagination: expect.objectContaining({
                page: 2,
                limit: 10,
                totalPages: 3,
              }),
            }),
          })
        );
      });

      it('should filter by status', async () => {
        mockReq.query = { status: 'active' };
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.project.count.mockResolvedValue(0);

        await controller.list(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              isActive: true,
            }),
          })
        );
      });
    });

    describe('GET /projects/:id - Get Project', () => {
      it('should return project with matches', async () => {
        const mockProject = {
          id: 'project-1',
          userId: 'user-123',
          title: 'Test Project',
          summary: 'A test project',
          stage: 'MVP',
          sectors: [{ sector: { id: 's1', name: 'Tech' } }],
          skillsNeeded: [{ skill: { id: 'sk1', name: 'Python' }, importance: 'REQUIRED' }],
          matches: [
            {
              id: 'match-1',
              matchScore: 85,
              matchType: 'user',
              reasons: ['Shared sector', 'Relevant skills'],
              suggestedAction: 'Connect',
              suggestedMessage: 'Hi, I saw your project...',
              sharedSectors: ['Tech'],
              sharedSkills: ['Python'],
              status: 'PENDING',
              matchedUser: { id: 'user-456', fullName: 'John Doe', email: 'john@example.com' },
              matchedContact: null,
              createdAt: new Date(),
            },
          ],
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
              matches: expect.arrayContaining([
                expect.objectContaining({
                  id: 'match-1',
                  matchScore: 85,
                  matchedUser: expect.objectContaining({ fullName: 'John Doe' }),
                }),
              ]),
            }),
          })
        );
      });

      it('should return 404 for non-existent project', async () => {
        mockReq.params = { id: 'nonexistent' };
        mockPrisma.project.findFirst.mockResolvedValue(null);

        await controller.get(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('not found'),
          })
        );
      });

      it('should not return other user projects', async () => {
        mockReq.params = { id: 'project-other' };
        mockPrisma.project.findFirst.mockResolvedValue(null); // findFirst with userId filter returns null

        await controller.get(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('PUT /projects/:id - Update Project', () => {
      it('should update project fields', async () => {
        const existingProject = {
          id: 'project-1',
          userId: 'user-123',
          title: 'Old Title',
        };

        const updatedProject = {
          ...existingProject,
          title: 'New Title',
          summary: 'Updated summary',
          stage: 'LAUNCHED',
          sectors: [],
          skillsNeeded: [],
        };

        mockReq.params = { id: 'project-1' };
        mockReq.body = {
          title: 'New Title',
          summary: 'Updated summary',
          stage: 'LAUNCHED',
        };
        mockPrisma.project.findFirst.mockResolvedValue(existingProject);
        mockPrisma.project.update.mockResolvedValue(updatedProject);

        await controller.update(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.project.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'project-1' },
            data: expect.objectContaining({
              title: 'New Title',
              summary: 'Updated summary',
              stage: 'LAUNCHED',
            }),
          })
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should update sectors', async () => {
        mockReq.params = { id: 'project-1' };
        mockReq.body = { sectorIds: ['sector-1', 'sector-2'] };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockPrisma.project.update.mockResolvedValue({
          id: 'project-1',
          sectors: [],
          skillsNeeded: [],
        });

        await controller.update(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.projectSector.deleteMany).toHaveBeenCalledWith({
          where: { projectId: 'project-1' },
        });
        expect(mockPrisma.projectSector.createMany).toHaveBeenCalledWith({
          data: [
            { projectId: 'project-1', sectorId: 'sector-1' },
            { projectId: 'project-1', sectorId: 'sector-2' },
          ],
        });
      });

      it('should update skills', async () => {
        mockReq.params = { id: 'project-1' };
        mockReq.body = {
          skills: [
            { skillId: 'skill-1', importance: 'REQUIRED' },
            { skillId: 'skill-2', importance: 'NICE_TO_HAVE' },
          ],
        };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockPrisma.project.update.mockResolvedValue({
          id: 'project-1',
          sectors: [],
          skillsNeeded: [],
        });

        await controller.update(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.projectSkill.deleteMany).toHaveBeenCalled();
        expect(mockPrisma.projectSkill.createMany).toHaveBeenCalledWith({
          data: [
            { projectId: 'project-1', skillId: 'skill-1', importance: 'REQUIRED' },
            { projectId: 'project-1', skillId: 'skill-2', importance: 'NICE_TO_HAVE' },
          ],
        });
      });

      it('should clear keywords when content changes', async () => {
        mockReq.params = { id: 'project-1' };
        mockReq.body = { title: 'New Title' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockPrisma.project.update.mockResolvedValue({
          id: 'project-1',
          sectors: [],
          skillsNeeded: [],
        });

        await controller.update(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.project.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              keywords: [],
            }),
          })
        );
      });
    });

    describe('DELETE /projects/:id - Delete Project', () => {
      it('should delete project', async () => {
        mockReq.params = { id: 'project-1' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockPrisma.project.delete.mockResolvedValue({});

        await controller.delete(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.project.delete).toHaveBeenCalledWith({
          where: { id: 'project-1' },
        });
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: 'Project deleted successfully',
          })
        );
      });

      it('should return 404 for non-existent project', async () => {
        mockReq.params = { id: 'nonexistent' };
        mockPrisma.project.findFirst.mockResolvedValue(null);

        await controller.delete(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        expect(mockPrisma.project.delete).not.toHaveBeenCalled();
      });
    });
  });

  describe('Project Matching', () => {
    describe('POST /projects/:id/find-matches - Sync Mode', () => {
      it('should trigger matching and return results', async () => {
        const mockMatches = [
          { id: 'match-1', matchScore: 90 },
          { id: 'match-2', matchScore: 75 },
        ];

        mockReq.params = { id: 'project-1' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockFindMatchesForProject.mockResolvedValue(mockMatches);
        mockPrisma.projectMatch.findMany.mockResolvedValue(
          mockMatches.map((m) => ({
            ...m,
            matchType: 'user',
            reasons: ['Shared skills'],
            suggestedAction: 'Connect',
            suggestedMessage: 'Hi!',
            sharedSectors: [],
            sharedSkills: ['Python'],
            status: 'PENDING',
            matchedUser: { id: 'u1', fullName: 'User 1' },
            matchedContact: null,
            createdAt: new Date(),
          }))
        );

        await controller.findMatches(mockReq as Request, mockRes as Response, mockNext);

        expect(mockFindMatchesForProject).toHaveBeenCalledWith('project-1', 'user-123');
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              matchCount: 2,
              matches: expect.arrayContaining([
                expect.objectContaining({ matchScore: 90 }),
                expect.objectContaining({ matchScore: 75 }),
              ]),
            }),
          })
        );
      });

      it('should return 404 for non-existent project', async () => {
        mockReq.params = { id: 'nonexistent' };
        mockPrisma.project.findFirst.mockResolvedValue(null);

        await controller.findMatches(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        expect(mockFindMatchesForProject).not.toHaveBeenCalled();
      });
    });

    describe('POST /projects/:id/find-matches?async=true - Async Mode', () => {
      it('should queue matching job and return job ID', async () => {
        mockReq.params = { id: 'project-1' };
        mockReq.query = { async: 'true' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockTriggerProjectMatching.mockResolvedValue({ jobId: 'job-123', queued: true });

        await controller.findMatches(mockReq as Request, mockRes as Response, mockNext);

        expect(mockTriggerProjectMatching).toHaveBeenCalledWith('project-1', 'user-123');
        expect(mockRes.status).toHaveBeenCalledWith(202);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              jobId: 'job-123',
              status: 'queued',
            }),
          })
        );
      });

      it('should fallback to sync when queue unavailable', async () => {
        mockReq.params = { id: 'project-1' };
        mockReq.query = { async: 'true' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockTriggerProjectMatching.mockResolvedValue({ jobId: null, queued: false });
        mockFindMatchesForProject.mockResolvedValue([]);
        mockPrisma.projectMatch.findMany.mockResolvedValue([]);

        await controller.findMatches(mockReq as Request, mockRes as Response, mockNext);

        expect(mockFindMatchesForProject).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
    });

    describe('GET /projects/:id/matches - Get Matches', () => {
      it('should return all matches', async () => {
        const mockMatches = [
          {
            id: 'match-1',
            matchScore: 90,
            matchType: 'user',
            reasons: ['Shared skills'],
            suggestedAction: 'Connect',
            suggestedMessage: 'Hi!',
            sharedSectors: ['Tech'],
            sharedSkills: ['Python'],
            status: 'PENDING',
            matchedUser: { id: 'u1', fullName: 'User 1', email: 'u1@test.com' },
            matchedContact: null,
            createdAt: new Date(),
          },
          {
            id: 'match-2',
            matchScore: 75,
            matchType: 'contact',
            reasons: ['Shared sector'],
            suggestedAction: 'Message',
            suggestedMessage: 'Hello!',
            sharedSectors: ['Tech'],
            sharedSkills: [],
            status: 'SAVED',
            matchedUser: null,
            matchedContact: { id: 'c1', fullName: 'Contact 1' },
            createdAt: new Date(),
          },
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
              matches: expect.arrayContaining([
                expect.objectContaining({ matchType: 'user', matchedUser: expect.any(Object) }),
                expect.objectContaining({ matchType: 'contact', matchedContact: expect.any(Object) }),
              ]),
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

      it('should filter by status', async () => {
        mockReq.params = { id: 'project-1' };
        mockReq.query = { status: 'contacted' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockPrisma.projectMatch.findMany.mockResolvedValue([]);

        await controller.getMatches(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.projectMatch.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: 'CONTACTED',
            }),
          })
        );
      });

      it('should filter by minimum score', async () => {
        mockReq.params = { id: 'project-1' };
        mockReq.query = { minScore: '80' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockPrisma.projectMatch.findMany.mockResolvedValue([]);

        await controller.getMatches(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.projectMatch.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              matchScore: { gte: 80 },
            }),
          })
        );
      });
    });

    describe('PUT /projects/:id/matches/:matchId/status - Update Match Status', () => {
      it('should update match status to contacted', async () => {
        mockReq.params = { id: 'project-1', matchId: 'match-1' };
        mockReq.body = { status: 'contacted' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockPrisma.projectMatch.update.mockResolvedValue({ id: 'match-1', status: 'CONTACTED' });

        await controller.updateMatchStatus(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.projectMatch.update).toHaveBeenCalledWith({
          where: { id: 'match-1' },
          data: { status: 'CONTACTED' },
        });
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should update match status to saved', async () => {
        mockReq.params = { id: 'project-1', matchId: 'match-1' };
        mockReq.body = { status: 'saved' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockPrisma.projectMatch.update.mockResolvedValue({ id: 'match-1', status: 'SAVED' });

        await controller.updateMatchStatus(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.projectMatch.update).toHaveBeenCalledWith({
          where: { id: 'match-1' },
          data: { status: 'SAVED' },
        });
      });

      it('should update match status to dismissed', async () => {
        mockReq.params = { id: 'project-1', matchId: 'match-1' };
        mockReq.body = { status: 'dismissed' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockPrisma.projectMatch.update.mockResolvedValue({ id: 'match-1', status: 'DISMISSED' });

        await controller.updateMatchStatus(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.projectMatch.update).toHaveBeenCalledWith({
          where: { id: 'match-1' },
          data: { status: 'DISMISSED' },
        });
      });

      it('should update match status to connected', async () => {
        mockReq.params = { id: 'project-1', matchId: 'match-1' };
        mockReq.body = { status: 'connected' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockPrisma.projectMatch.update.mockResolvedValue({ id: 'match-1', status: 'CONNECTED' });

        await controller.updateMatchStatus(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.projectMatch.update).toHaveBeenCalledWith({
          where: { id: 'match-1' },
          data: { status: 'CONNECTED' },
        });
      });

      it('should reject invalid status', async () => {
        mockReq.params = { id: 'project-1', matchId: 'match-1' };
        mockReq.body = { status: 'invalid_status' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });

        await controller.updateMatchStatus(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        expect(mockPrisma.projectMatch.update).not.toHaveBeenCalled();
      });
    });

    describe('GET /projects/:id/match-status/:jobId - Get Job Status', () => {
      it('should return job status', async () => {
        mockReq.params = { id: 'project-1', jobId: 'job-123' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockGetProjectMatchingJobStatus.mockResolvedValue({
          id: 'job-123',
          status: 'completed',
          progress: 100,
          result: { matchCount: 5 },
        });

        await controller.getMatchJobStatus(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              id: 'job-123',
              status: 'completed',
              progress: 100,
            }),
          })
        );
      });

      it('should return 404 for non-existent job', async () => {
        mockReq.params = { id: 'project-1', jobId: 'nonexistent' };
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-123' });
        mockGetProjectMatchingJobStatus.mockResolvedValue(null);

        await controller.getMatchJobStatus(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('Project Discovery', () => {
    describe('GET /projects/discover/all - Discover Public Projects', () => {
      it('should return public projects from other users', async () => {
        const mockProjects = [
          {
            id: 'project-other-1',
            userId: 'user-456',
            title: 'AI Startup',
            summary: 'Building AI solutions',
            category: 'saas',
            stage: 'MVP',
            lookingFor: ['investor'],
            visibility: 'PUBLIC',
            isActive: true,
            createdAt: new Date(),
            user: { id: 'user-456', fullName: 'Jane Doe', company: 'AI Corp', avatarUrl: null },
            sectors: [{ sector: { id: 's1', name: 'Tech' } }],
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
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              projects: expect.arrayContaining([
                expect.objectContaining({
                  id: 'project-other-1',
                  user: expect.objectContaining({ fullName: 'Jane Doe' }),
                }),
              ]),
            }),
          })
        );
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
        mockReq.query = { stage: 'LAUNCHED' };
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.project.count.mockResolvedValue(0);

        await controller.discover(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              stage: 'LAUNCHED',
            }),
          })
        );
      });

      it('should filter by sector', async () => {
        mockReq.query = { sector: 'sector-tech' };
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.project.count.mockResolvedValue(0);

        await controller.discover(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              sectors: {
                some: { sectorId: 'sector-tech' },
              },
            }),
          })
        );
      });

      it('should support pagination', async () => {
        mockReq.query = { page: '2', limit: '5' };
        mockPrisma.project.findMany.mockResolvedValue([]);
        mockPrisma.project.count.mockResolvedValue(15);

        await controller.discover(mockReq as Request, mockRes as Response, mockNext);

        expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 5,
            take: 5,
          })
        );
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              pagination: expect.objectContaining({
                page: 2,
                limit: 5,
                totalPages: 3,
              }),
            }),
          })
        );
      });
    });
  });
});
