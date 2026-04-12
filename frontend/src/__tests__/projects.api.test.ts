/**
 * Projects API Client Tests
 *
 * Tests for the projects API client functions.
 */

// Mock the api client - use inline mock functions
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
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  findProjectMatches,
  getProjectMatches,
  updateMatchStatus,
  discoverProjects,
  getProjectMatchJobStatus,
} from '../lib/api/projects';

// Type the mocked api
const mockApi = api as jest.Mocked<typeof api>;

describe('Projects API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjects', () => {
    it('should fetch projects without params', async () => {
      const mockResponse = {
        projects: [{ id: '1', title: 'Test' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getProjects();

      expect(mockApi.get).toHaveBeenCalledWith('/projects');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch projects with pagination params', async () => {
      mockApi.get.mockResolvedValue({ projects: [], pagination: {} });

      await getProjects({ page: 2, limit: 10 });

      expect(mockApi.get).toHaveBeenCalledWith('/projects?page=2&limit=10');
    });

    it('should fetch projects with status filter', async () => {
      mockApi.get.mockResolvedValue({ projects: [], pagination: {} });

      await getProjects({ status: 'active' });

      expect(mockApi.get).toHaveBeenCalledWith('/projects?status=active');
    });
  });

  describe('createProject', () => {
    it('should create a project', async () => {
      const projectData = {
        title: 'New Project',
        summary: 'A new project',
        stage: 'IDEA' as const,
      };
      const mockResponse = { id: 'new-1', ...projectData };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await createProject(projectData);

      expect(mockApi.post).toHaveBeenCalledWith('/projects', projectData);
      expect(result).toEqual(mockResponse);
    });

    it('should create project with all fields', async () => {
      const projectData = {
        title: 'Complete Project',
        summary: 'A complete project',
        detailedDesc: 'Detailed description',
        category: 'healthtech',
        stage: 'MVP' as const,
        investmentRange: '$100K',
        timeline: '12 months',
        lookingFor: ['investor', 'cofounder'],
        sectorIds: ['s1', 's2'],
        skills: [{ skillId: 'sk1', importance: 'REQUIRED' as const }],
        visibility: 'PUBLIC' as const,
      };
      mockApi.post.mockResolvedValue({ id: 'new-1', ...projectData });

      await createProject(projectData);

      expect(mockApi.post).toHaveBeenCalledWith('/projects', projectData);
    });
  });

  describe('getProject', () => {
    it('should fetch a project by ID', async () => {
      const mockResponse = {
        id: 'project-1',
        title: 'Test Project',
        matches: [],
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getProject('project-1');

      expect(mockApi.get).toHaveBeenCalledWith('/projects/project-1');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateProject', () => {
    it('should update a project', async () => {
      const updateData = { title: 'Updated Title' };
      mockApi.put.mockResolvedValue({ id: 'project-1', ...updateData });

      await updateProject('project-1', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/projects/project-1', updateData);
    });

    it('should update project with multiple fields', async () => {
      const updateData = {
        title: 'Updated Title',
        summary: 'Updated summary',
        stage: 'GROWTH' as const,
        sectorIds: ['s1'],
        skills: [{ skillId: 'sk1', importance: 'PREFERRED' as const }],
      };
      mockApi.put.mockResolvedValue({ id: 'project-1', ...updateData });

      await updateProject('project-1', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/projects/project-1', updateData);
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      mockApi.delete.mockResolvedValue({ message: 'Project deleted' });

      const result = await deleteProject('project-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/project-1');
      expect(result.message).toBe('Project deleted');
    });
  });

  describe('findProjectMatches', () => {
    it('should trigger sync matching by default', async () => {
      const mockResponse = {
        matchCount: 5,
        matches: [{ id: 'm1', matchScore: 90 }],
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await findProjectMatches('project-1');

      expect(mockApi.post).toHaveBeenCalledWith('/projects/project-1/find-matches');
      expect(result).toEqual(mockResponse);
    });

    it('should trigger async matching when specified', async () => {
      const mockResponse = {
        jobId: 'job-123',
        status: 'queued',
        message: 'Matching started',
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await findProjectMatches('project-1', true);

      expect(mockApi.post).toHaveBeenCalledWith('/projects/project-1/find-matches?async=true');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProjectMatches', () => {
    it('should fetch matches without filters', async () => {
      const mockResponse = {
        matches: [{ id: 'm1', matchScore: 90 }],
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getProjectMatches('project-1');

      expect(mockApi.get).toHaveBeenCalledWith('/projects/project-1/matches');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch matches with type filter', async () => {
      mockApi.get.mockResolvedValue({ matches: [] });

      await getProjectMatches('project-1', { type: 'user' });

      expect(mockApi.get).toHaveBeenCalledWith('/projects/project-1/matches?type=user');
    });

    it('should fetch matches with status filter', async () => {
      mockApi.get.mockResolvedValue({ matches: [] });

      await getProjectMatches('project-1', { status: 'CONTACTED' });

      expect(mockApi.get).toHaveBeenCalledWith('/projects/project-1/matches?status=CONTACTED');
    });

    it('should fetch matches with minScore filter', async () => {
      mockApi.get.mockResolvedValue({ matches: [] });

      await getProjectMatches('project-1', { minScore: 70 });

      expect(mockApi.get).toHaveBeenCalledWith('/projects/project-1/matches?minScore=70');
    });

    it('should fetch matches with multiple filters', async () => {
      mockApi.get.mockResolvedValue({ matches: [] });

      await getProjectMatches('project-1', { type: 'contact', status: 'SAVED', minScore: 60 });

      expect(mockApi.get).toHaveBeenCalledWith(
        '/projects/project-1/matches?type=contact&status=SAVED&minScore=60'
      );
    });
  });

  describe('updateMatchStatus', () => {
    it('should update match status to contacted', async () => {
      mockApi.put.mockResolvedValue({ id: 'match-1', status: 'CONTACTED' });

      await updateMatchStatus('project-1', 'match-1', 'CONTACTED');

      expect(mockApi.put).toHaveBeenCalledWith('/projects/project-1/matches/match-1/status', {
        status: 'CONTACTED',
      });
    });

    it('should update match status to saved', async () => {
      mockApi.put.mockResolvedValue({ id: 'match-1', status: 'SAVED' });

      await updateMatchStatus('project-1', 'match-1', 'SAVED');

      expect(mockApi.put).toHaveBeenCalledWith('/projects/project-1/matches/match-1/status', {
        status: 'SAVED',
      });
    });

    it('should update match status to dismissed', async () => {
      mockApi.put.mockResolvedValue({ id: 'match-1', status: 'DISMISSED' });

      await updateMatchStatus('project-1', 'match-1', 'DISMISSED');

      expect(mockApi.put).toHaveBeenCalledWith('/projects/project-1/matches/match-1/status', {
        status: 'DISMISSED',
      });
    });

    it('should update match status to connected', async () => {
      mockApi.put.mockResolvedValue({ id: 'match-1', status: 'CONNECTED' });

      await updateMatchStatus('project-1', 'match-1', 'CONNECTED');

      expect(mockApi.put).toHaveBeenCalledWith('/projects/project-1/matches/match-1/status', {
        status: 'CONNECTED',
      });
    });
  });

  describe('getProjectMatchJobStatus', () => {
    it('should fetch job status', async () => {
      const mockResponse = {
        id: 'job-123',
        status: 'completed',
        progress: 100,
        result: { matchCount: 5 },
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getProjectMatchJobStatus('project-1', 'job-123');

      expect(mockApi.get).toHaveBeenCalledWith('/projects/project-1/match-status/job-123');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('discoverProjects', () => {
    it('should fetch public projects without filters', async () => {
      const mockResponse = {
        projects: [{ id: 'p1', title: 'Public Project' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await discoverProjects();

      expect(mockApi.get).toHaveBeenCalledWith('/projects/discover/all');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch with pagination', async () => {
      mockApi.get.mockResolvedValue({ projects: [], pagination: {} });

      await discoverProjects({ page: 2, limit: 10 });

      expect(mockApi.get).toHaveBeenCalledWith('/projects/discover/all?page=2&limit=10');
    });

    it('should filter by category', async () => {
      mockApi.get.mockResolvedValue({ projects: [], pagination: {} });

      await discoverProjects({ category: 'healthtech' });

      expect(mockApi.get).toHaveBeenCalledWith('/projects/discover/all?category=healthtech');
    });

    it('should filter by stage', async () => {
      mockApi.get.mockResolvedValue({ projects: [], pagination: {} });

      await discoverProjects({ stage: 'MVP' });

      expect(mockApi.get).toHaveBeenCalledWith('/projects/discover/all?stage=MVP');
    });

    it('should filter by sector', async () => {
      mockApi.get.mockResolvedValue({ projects: [], pagination: {} });

      await discoverProjects({ sector: 'sector-tech' });

      expect(mockApi.get).toHaveBeenCalledWith('/projects/discover/all?sector=sector-tech');
    });

    it('should combine multiple filters', async () => {
      mockApi.get.mockResolvedValue({ projects: [], pagination: {} });

      await discoverProjects({ category: 'fintech', stage: 'GROWTH', page: 1, limit: 5 });

      expect(mockApi.get).toHaveBeenCalledWith(
        '/projects/discover/all?page=1&limit=5&category=fintech&stage=LAUNCHED'
      );
    });
  });
});
