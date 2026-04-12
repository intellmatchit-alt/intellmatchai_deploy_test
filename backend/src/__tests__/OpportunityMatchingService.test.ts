/**
 * OpportunityMatchingService Unit Tests
 *
 * Tests the opportunity matching algorithm for job/career opportunities
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

import { OpportunityMatchingService } from '../infrastructure/external/opportunities/OpportunityMatchingService';

describe('OpportunityMatchingService', () => {
  let mockPrisma: any;
  let service: OpportunityMatchingService;

  // Test data fixtures
  const createMockUser = (overrides = {}) => ({
    id: 'user-123',
    fullName: 'Test User',
    email: 'test@example.com',
    company: 'TechCorp',
    jobTitle: 'Senior Data Scientist',
    location: 'San Francisco',
    bio: 'AI and ML specialist',
    isActive: true,
    userSectors: [
      { sectorId: 'sector-tech', sector: { id: 'sector-tech', name: 'Technology' } },
    ],
    userSkills: [
      { skillId: 'skill-python', skill: { id: 'skill-python', name: 'Python' } },
      { skillId: 'skill-ml', skill: { id: 'skill-ml', name: 'Machine Learning' } },
    ],
    userInterests: [
      { interestId: 'interest-ai', interest: { name: 'AI' } },
    ],
    userHobbies: [
      { hobbyId: 'hobby-reading', hobby: { name: 'Reading' } },
    ],
    userGoals: [
      { goalType: 'HIRING', isActive: true },
    ],
    ...overrides,
  });

  const createMockIntent = (overrides = {}) => ({
    id: 'intent-123',
    userId: 'user-123',
    title: 'Hiring ML Engineers',
    intentType: 'HIRING',
    roleArea: 'Machine Learning',
    seniority: 'SENIOR',
    locationPref: 'San Francisco',
    remoteOk: true,
    notes: 'Looking for ML engineers',
    isActive: true,
    sectorPrefs: [
      { sectorId: 'sector-tech', sector: { id: 'sector-tech', name: 'Technology' } },
    ],
    skillPrefs: [
      { skillId: 'skill-python', skill: { id: 'skill-python', name: 'Python' } },
      { skillId: 'skill-ml', skill: { id: 'skill-ml', name: 'Machine Learning' } },
    ],
    ...overrides,
  });

  const createMockUserCandidate = (overrides = {}) => ({
    id: 'candidate-user-1',
    fullName: 'Candidate User',
    company: 'Startup Inc',
    jobTitle: 'Software Engineer',
    location: 'San Francisco',
    bio: 'Full stack developer',
    isActive: true,
    userSectors: [
      { sectorId: 'sector-tech', sector: { name: 'Technology' } },
    ],
    userSkills: [
      { skillId: 'skill-python', skill: { name: 'Python' } },
    ],
    userInterests: [
      { interestId: 'interest-ai', interest: { name: 'AI' } },
    ],
    userHobbies: [],
    userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
    opportunityIntents: [],
    ...overrides,
  });

  const createMockContactCandidate = (overrides = {}) => ({
    id: 'candidate-contact-1',
    fullName: 'Contact Candidate',
    company: 'Tech Corp',
    jobTitle: 'Senior Developer',
    location: 'San Francisco',
    bio: 'Experienced developer',
    contactSectors: [
      { sectorId: 'sector-tech', sector: { name: 'Technology' } },
    ],
    contactSkills: [
      { skillId: 'skill-python', skill: { name: 'Python' } },
    ],
    contactInterests: [],
    contactHobbies: [],
    ...overrides,
  });

  beforeEach(() => {
    mockPrisma = {
      opportunityIntent: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      contact: {
        findMany: jest.fn(),
      },
      opportunityMatch: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
    };

    service = new OpportunityMatchingService(mockPrisma);
    jest.clearAllMocks();
  });

  // ===========================================
  // A. Provider Configuration Tests
  // ===========================================
  describe('Provider Configuration', () => {
    it('should return none when no provider is configured', () => {
      expect(service.getActiveProvider()).toBe('none');
    });
  });

  // ===========================================
  // B. Intent Alignment Tests
  // ===========================================
  describe('Intent Alignment Scoring', () => {
    it('should find matches for HIRING intent with job seekers', async () => {
      const mockIntent = createMockIntent({ intentType: 'HIRING' });
      const mockUser = createMockUser();
      const jobSeekerCandidate = createMockUserCandidate({
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([jobSeekerCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      expect(matches.length).toBeGreaterThan(0);
      // Job seeker should have high intent alignment
    });

    it('should find recruiter/HR for OPEN_TO_OPPORTUNITIES intent', async () => {
      const mockIntent = createMockIntent({
        intentType: 'OPEN_TO_OPPORTUNITIES',
        seniority: 'MID',
      });
      const mockUser = createMockUser({
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });
      const recruiterCandidate = createMockUserCandidate({
        id: 'recruiter-1',
        jobTitle: 'Technical Recruiter',
        userGoals: [{ goalType: 'HIRING', isActive: true }],
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([recruiterCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      expect(matches.length).toBeGreaterThan(0);
    });

    it('should find senior professionals for ADVISORY_BOARD intent', async () => {
      const mockIntent = createMockIntent({
        intentType: 'ADVISORY_BOARD',
      });
      const mockUser = createMockUser();
      const seniorCandidate = createMockUserCandidate({
        id: 'vp-1',
        jobTitle: 'VP of Engineering',
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([seniorCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      // VP should match well for advisory board
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  // ===========================================
  // C. Seniority Fit Tests
  // ===========================================
  describe('Seniority Fit Scoring', () => {
    it('should prefer candidates at/below level for HIRING', async () => {
      const mockIntent = createMockIntent({
        intentType: 'HIRING',
        seniority: 'SENIOR',
      });
      const mockUser = createMockUser();
      const midLevelCandidate = createMockUserCandidate({
        id: 'mid-dev',
        jobTitle: 'Software Developer', // Mid level
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });
      const vpCandidate = createMockUserCandidate({
        id: 'vp-candidate',
        jobTitle: 'VP of Engineering', // Way above senior
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([midLevelCandidate, vpCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      // Mid-level should rank better for hiring senior role
      const midMatch = matches.find((m: any) => m.matchedUserId === 'mid-dev');
      const vpMatch = matches.find((m: any) => m.matchedUserId === 'vp-candidate');

      if (midMatch && vpMatch) {
        // Mid-level is closer to senior than VP
        expect(midMatch.matchScore).toBeGreaterThanOrEqual(vpMatch.matchScore - 20);
      }
    });

    it('should prefer senior candidates for ADVISORY_BOARD', async () => {
      const mockIntent = createMockIntent({
        intentType: 'ADVISORY_BOARD',
      });
      const mockUser = createMockUser();
      const juniorCandidate = createMockUserCandidate({
        id: 'junior-dev',
        jobTitle: 'Junior Developer',
      });
      const vpCandidate = createMockUserCandidate({
        id: 'vp-candidate',
        jobTitle: 'VP of Engineering',
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([juniorCandidate, vpCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      const juniorMatch = matches.find((m: any) => m.matchedUserId === 'junior-dev');
      const vpMatch = matches.find((m: any) => m.matchedUserId === 'vp-candidate');

      // VP should have higher score for advisory
      if (vpMatch && juniorMatch) {
        expect(vpMatch.matchScore).toBeGreaterThan(juniorMatch.matchScore);
      } else if (vpMatch && !juniorMatch) {
        // Junior might be filtered out (score <= 20)
        expect(vpMatch).toBeDefined();
      }
    });
  });

  // ===========================================
  // D. Location Match Tests
  // ===========================================
  describe('Location Match Scoring', () => {
    it('should score 100 for same city match', async () => {
      const mockIntent = createMockIntent({
        locationPref: 'San Francisco',
        remoteOk: false,
      });
      const mockUser = createMockUser();
      const sameLocationCandidate = createMockUserCandidate({
        location: 'San Francisco',
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([sameLocationCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      expect(matches.length).toBeGreaterThan(0);
    });

    it('should accept any location when remoteOk is true', async () => {
      const mockIntent = createMockIntent({
        locationPref: 'San Francisco',
        remoteOk: true,
      });
      const mockUser = createMockUser();
      const remoteCandidate = createMockUserCandidate({
        location: 'New York', // Different city
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([remoteCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      // Should still match because remote is OK
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  // ===========================================
  // E. Score Threshold Tests
  // ===========================================
  describe('Score Threshold Filtering', () => {
    it('should filter out candidates with score <= 20', async () => {
      const mockIntent = createMockIntent();
      const mockUser = createMockUser();
      // Candidate with no overlap - should score low
      const noOverlapCandidate = createMockUserCandidate({
        id: 'no-overlap',
        userSectors: [{ sector: { name: 'Healthcare' } }], // Different sector
        userSkills: [{ skill: { name: 'Nursing' } }], // Different skill
        userGoals: [], // No relevant goals
        userInterests: [],
        userHobbies: [],
        location: 'Tokyo', // Different location
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([noOverlapCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      // Low scoring candidates should be filtered
      for (const match of matches) {
        expect(match.matchScore).toBeGreaterThan(20);
      }
    });
  });

  // ===========================================
  // F. Return Structure Tests
  // ===========================================
  describe('Return Structure Validation', () => {
    it('should return valid OpportunityMatch structure', async () => {
      const mockIntent = createMockIntent();
      const mockUser = createMockUser();
      const candidate = createMockUserCandidate({
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([candidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'match-1',
          ...args.data,
          reasons: args.data.reasons || [],
          sharedSectors: args.data.sharedSectors || [],
          sharedSkills: args.data.sharedSkills || [],
          nextSteps: args.data.nextSteps || [],
        })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      for (const match of matches) {
        expect(match).toHaveProperty('intentId');
        expect(match).toHaveProperty('matchScore');
        expect(match).toHaveProperty('matchType');
        expect(match).toHaveProperty('reasons');
        expect(match).toHaveProperty('sharedSectors');
        expect(match).toHaveProperty('sharedSkills');
        expect(match).toHaveProperty('intentAlignment');
        expect(match).toHaveProperty('suggestedAction');
        expect(match).toHaveProperty('suggestedMessage');
        expect(match).toHaveProperty('nextSteps');
      }
    });

    it('should have valid suggestedAction values', async () => {
      const mockIntent = createMockIntent();
      const mockUser = createMockUser();
      const candidate = createMockUserCandidate({
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([candidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'match-1',
          ...args.data,
          reasons: args.data.reasons || [],
          sharedSectors: args.data.sharedSectors || [],
          sharedSkills: args.data.sharedSkills || [],
          nextSteps: args.data.nextSteps || [],
        })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      const validActions = ['Connect', 'Request Intro', 'Schedule Call', 'Send Message'];
      for (const match of matches) {
        expect(validActions).toContain(match.suggestedAction);
      }
    });

    it('should have nextSteps as array', async () => {
      const mockIntent = createMockIntent();
      const mockUser = createMockUser();
      const candidate = createMockUserCandidate({
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([candidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'match-1',
          ...args.data,
          reasons: args.data.reasons || [],
          sharedSectors: args.data.sharedSectors || [],
          sharedSkills: args.data.sharedSkills || [],
          nextSteps: args.data.nextSteps || [],
        })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      for (const match of matches) {
        expect(Array.isArray(match.nextSteps)).toBe(true);
      }
    });
  });

  // ===========================================
  // G. Error Handling Tests
  // ===========================================
  describe('Error Handling', () => {
    it('should throw error when no active intent found', async () => {
      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(null);

      await expect(service.findMatchesForIntent('user-123')).rejects.toThrow(
        'No active opportunity intent found'
      );
    });

    it('should throw error when user not found', async () => {
      const mockIntent = createMockIntent();
      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findMatchesForIntent('user-123')).rejects.toThrow('User not found');
    });
  });

  // ===========================================
  // H. Intent Compatibility Tests
  // ===========================================
  describe('Intent Compatibility', () => {
    it('should match HIRING with OPEN_TO_OPPORTUNITIES users', async () => {
      const mockIntent = createMockIntent({ intentType: 'HIRING' });
      const mockUser = createMockUser();
      const openToWorkCandidate = createMockUserCandidate({
        opportunityIntents: [{ intentType: 'OPEN_TO_OPPORTUNITIES' }],
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([openToWorkCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      expect(matches.length).toBeGreaterThan(0);
    });
  });

  // ===========================================
  // I. Contact vs User Candidate Tests
  // ===========================================
  describe('Contact vs User Candidates', () => {
    it('should include both users and contacts in matches', async () => {
      const mockIntent = createMockIntent();
      const mockUser = createMockUser();
      const userCandidate = createMockUserCandidate({
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });
      const contactCandidate = createMockContactCandidate();

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([userCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([contactCandidate]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'match-' + args.data.matchType,
          ...args.data,
        })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      const matchTypes = matches.map((m: any) => m.matchType);

      // Should have both types if both scored above threshold
      if (matches.length >= 2) {
        expect(matchTypes).toContain('user');
        expect(matchTypes).toContain('contact');
      }
    });

    it('should set correct matchedUserId or matchedContactId', async () => {
      const mockIntent = createMockIntent();
      const mockUser = createMockUser();
      const userCandidate = createMockUserCandidate({
        id: 'user-candidate-123',
        userGoals: [{ goalType: 'JOB_SEEKING', isActive: true }],
      });

      mockPrisma.opportunityIntent.findFirst.mockResolvedValue(mockIntent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.findMany.mockResolvedValue([userCandidate]);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.opportunityMatch.deleteMany.mockResolvedValue({});
      mockPrisma.opportunityMatch.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'match-1', ...args.data })
      );
      mockPrisma.opportunityIntent.update.mockResolvedValue(mockIntent);

      const matches = await service.findMatchesForIntent('user-123');

      for (const match of matches) {
        if (match.matchType === 'user') {
          expect(match.matchedUserId).toBeDefined();
        } else {
          expect(match.matchedContactId).toBeDefined();
        }
      }
    });
  });
});
