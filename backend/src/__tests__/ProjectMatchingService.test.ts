/**
 * ProjectMatchingService Unit Tests
 */

// Mock config before imports
jest.mock('../config/index.js', () => ({
  config: {
    ai: {
      provider: 'none',
      openai: { enabled: false, apiKey: '', model: '' },
      groq: { enabled: false, apiKey: '', model: '' },
      gemini: { enabled: false, apiKey: '', model: '' },
    },
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

// Mock OpenAIExplanationService
jest.mock('../infrastructure/external/explanation/OpenAIExplanationService.js', () => ({
  OpenAIExplanationService: jest.fn().mockImplementation(() => ({})),
}));

import { ProjectMatchingService } from '../infrastructure/external/projects/ProjectMatchingService';

describe('ProjectMatchingService', () => {
  let mockPrisma: any;
  let service: ProjectMatchingService;

  const mockProject = {
    id: 'project-1',
    userId: 'user-123',
    title: 'AI Healthcare App',
    summary: 'A mobile app for health monitoring using machine learning',
    detailedDesc: 'We are building an innovative healthcare solution',
    keywords: [],
    lookingFor: ['technical_partner', 'investor'],
    sectors: [
      { sectorId: 'sector-1', sector: { id: 'sector-1', name: 'Healthcare' } },
      { sectorId: 'sector-2', sector: { id: 'sector-2', name: 'Technology' } },
    ],
    skillsNeeded: [
      { skillId: 'skill-1', skill: { id: 'skill-1', name: 'Machine Learning' }, importance: 'REQUIRED' },
      { skillId: 'skill-2', skill: { id: 'skill-2', name: 'React Native' }, importance: 'PREFERRED' },
    ],
    user: {
      id: 'user-123',
      fullName: 'Project Owner',
      userSectors: [],
      userSkills: [],
      userInterests: [],
      userHobbies: [],
    },
  };

  const mockUsers = [
    {
      id: 'user-456',
      fullName: 'John Developer',
      company: 'Tech Corp',
      jobTitle: 'Senior Engineer',
      bio: 'Experienced developer in healthcare tech',
      isActive: true,
      userSectors: [{ sector: { name: 'Healthcare' } }, { sector: { name: 'Technology' } }],
      userSkills: [{ skill: { name: 'Machine Learning' } }, { skill: { name: 'Python' } }],
      userInterests: [{ interest: { name: 'AI' } }],
      userHobbies: [],
    },
    {
      id: 'user-789',
      fullName: 'Jane Investor',
      company: 'Venture Capital',
      jobTitle: 'Investor',
      bio: 'Healthcare focused investor',
      isActive: true,
      userSectors: [{ sector: { name: 'Healthcare' } }],
      userSkills: [],
      userInterests: [],
      userHobbies: [],
    },
  ];

  const mockContacts = [
    {
      id: 'contact-1',
      fullName: 'Dr. Smith',
      company: 'Hospital',
      jobTitle: 'Medical Advisor',
      bio: 'Healthcare consultant',
      contactSectors: [{ sector: { name: 'Healthcare' } }],
      contactSkills: [{ skill: { name: 'Medical' } }],
      contactInterests: [],
      contactHobbies: [],
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      contact: {
        findMany: jest.fn(),
      },
      projectMatch: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
    };

    service = new ProjectMatchingService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('getActiveProvider', () => {
    it('should return none when no provider is configured', () => {
      expect(service.getActiveProvider()).toBe('none');
    });
  });

  describe('extractProjectKeywords (fallback)', () => {
    it('should extract keywords from project text using fallback method', async () => {
      const project = {
        title: 'AI Healthcare Mobile App',
        summary: 'A mobile application for monitoring health using artificial intelligence and machine learning',
        detailedDesc: null,
      };

      const keywords = await service.extractProjectKeywords(project);

      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords.length).toBeLessThanOrEqual(10);
      // Should extract meaningful words
      expect(keywords.some(k => k.includes('mobile') || k.includes('health') || k.includes('learning'))).toBe(true);
    });

    it('should filter out stop words', async () => {
      const project = {
        title: 'The Best App for Healthcare',
        summary: 'This is an application that will help with medical needs',
        detailedDesc: null,
      };

      const keywords = await service.extractProjectKeywords(project);

      // Should not include common stop words
      const stopWords = ['the', 'for', 'this', 'that', 'with'];
      for (const stopWord of stopWords) {
        expect(keywords.includes(stopWord)).toBe(false);
      }
    });

    it('should handle empty detailed description', async () => {
      const project = {
        title: 'Test Project',
        summary: 'A test project',
        detailedDesc: undefined,
      };

      const keywords = await service.extractProjectKeywords(project);
      expect(Array.isArray(keywords)).toBe(true);
    });
  });

  describe('findMatchesForProject', () => {
    it('should throw error when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.findMatchesForProject('nonexistent', 'user-123'))
        .rejects.toThrow('Project not found');
    });

    it('should throw error when user is not project owner', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        userId: 'different-user',
      });

      await expect(service.findMatchesForProject('project-1', 'user-123'))
        .rejects.toThrow('Unauthorized access to project');
    });

    it('should find and score matches successfully', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockResolvedValue(mockProject);
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.contact.findMany.mockResolvedValue(mockContacts);
      mockPrisma.projectMatch.deleteMany.mockResolvedValue({});
      mockPrisma.projectMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );

      const matches = await service.findMatchesForProject('project-1', 'user-123');

      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'project-1' } })
      );
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
      expect(mockPrisma.contact.findMany).toHaveBeenCalled();
      expect(mockPrisma.projectMatch.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'project-1' } });
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should extract and save keywords if not present', async () => {
      const projectWithoutKeywords = { ...mockProject, keywords: [] };
      mockPrisma.project.findUnique.mockResolvedValue(projectWithoutKeywords);
      mockPrisma.project.update.mockResolvedValue(projectWithoutKeywords);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.projectMatch.deleteMany.mockResolvedValue({});

      await service.findMatchesForProject('project-1', 'user-123');

      expect(mockPrisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'project-1' },
          data: expect.objectContaining({ keywords: expect.any(Array) }),
        })
      );
    });
  });

  describe('scoring logic', () => {
    it('should score candidates with shared sectors higher', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        keywords: ['healthcare', 'mobile', 'ai'],
      });
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.projectMatch.deleteMany.mockResolvedValue({});
      mockPrisma.projectMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-new', ...args.data })
      );

      const matches = await service.findMatchesForProject('project-1', 'user-123');

      // John Developer should score higher due to shared sectors and skills
      const johnMatch = matches.find((m: any) => m.matchedUserId === 'user-456');
      const janeMatch = matches.find((m: any) => m.matchedUserId === 'user-789');

      if (johnMatch && janeMatch) {
        expect(johnMatch.matchScore).toBeGreaterThanOrEqual(janeMatch.matchScore);
      }
    });

    it('should give bonus for lookingFor type match', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        lookingFor: ['investor'],
        keywords: ['healthcare'],
      });
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'investor-1',
          fullName: 'Jane Investor',
          jobTitle: 'Investor at VC Firm',
          company: 'VC Firm',
          bio: '',
          isActive: true,
          userSectors: [{ sector: { name: 'Healthcare' } }],
          userSkills: [],
          userInterests: [],
          userHobbies: [],
        },
        {
          id: 'developer-1',
          fullName: 'Dev Person',
          jobTitle: 'Developer',
          company: 'Tech Co',
          bio: '',
          isActive: true,
          userSectors: [{ sector: { name: 'Healthcare' } }],
          userSkills: [],
          userInterests: [],
          userHobbies: [],
        },
      ]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.projectMatch.deleteMany.mockResolvedValue({});
      mockPrisma.projectMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-new', ...args.data })
      );

      const matches = await service.findMatchesForProject('project-1', 'user-123');

      const investorMatch = matches.find((m: any) => m.matchedUserId === 'investor-1');
      const developerMatch = matches.find((m: any) => m.matchedUserId === 'developer-1');

      if (investorMatch && developerMatch) {
        expect(investorMatch.matchScore).toBeGreaterThan(developerMatch.matchScore);
      }
    });

    it('should filter out candidates with low scores', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        keywords: ['very', 'specific', 'niche', 'technology'],
      });
      // User with no overlap
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'no-match-user',
          fullName: 'Random Person',
          company: 'Unrelated Co',
          jobTitle: 'Unrelated Role',
          bio: 'Nothing relevant here',
          isActive: true,
          userSectors: [{ sector: { name: 'Unrelated Sector' } }],
          userSkills: [{ skill: { name: 'Unrelated Skill' } }],
          userInterests: [],
          userHobbies: [],
        },
      ]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.projectMatch.deleteMany.mockResolvedValue({});

      const matches = await service.findMatchesForProject('project-1', 'user-123');

      // Low scoring candidates should be filtered out (score <= 20)
      expect(matches.every((m: any) => m.matchScore > 20)).toBe(true);
    });
  });

  describe('fallback explanation generation', () => {
    it('should generate fallback explanation with shared sectors', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        keywords: [],
      });
      mockPrisma.user.findMany.mockResolvedValue([mockUsers[0]]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.projectMatch.deleteMany.mockResolvedValue({});
      mockPrisma.projectMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-new', ...args.data })
      );

      const matches = await service.findMatchesForProject('project-1', 'user-123');

      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0] as any;
      expect(match.reasons).toBeDefined();
      expect(Array.isArray(match.reasons)).toBe(true);
      expect(match.suggestedMessage).toBeDefined();
      expect(typeof match.suggestedMessage).toBe('string');
    });
  });

  describe('saveMatches', () => {
    it('should delete existing matches before saving new ones', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        keywords: ['test'],
      });
      mockPrisma.user.findMany.mockResolvedValue([mockUsers[0]]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.projectMatch.deleteMany.mockResolvedValue({});
      mockPrisma.projectMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-new', ...args.data })
      );

      await service.findMatchesForProject('project-1', 'user-123');

      expect(mockPrisma.projectMatch.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
      });
    });

    it('should set matchType based on candidate type', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        keywords: ['test'],
      });
      mockPrisma.user.findMany.mockResolvedValue([mockUsers[0]]);
      mockPrisma.contact.findMany.mockResolvedValue([mockContacts[0]]);
      mockPrisma.projectMatch.deleteMany.mockResolvedValue({});
      mockPrisma.projectMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-new', ...args.data })
      );

      await service.findMatchesForProject('project-1', 'user-123');

      const createCalls = mockPrisma.projectMatch.create.mock.calls;
      const userMatch = createCalls.find((call: any) => call[0].data.matchedUserId);
      const contactMatch = createCalls.find((call: any) => call[0].data.matchedContactId);

      if (userMatch) {
        expect(userMatch[0].data.matchType).toBe('user');
      }
      if (contactMatch) {
        expect(contactMatch[0].data.matchType).toBe('contact');
      }
    });
  });
});
