/**
 * DeterministicMatchingService Unit Tests
 *
 * Tests the 10-factor matching algorithm for contact matching
 */

// Mock all dependencies before imports
const mockPrismaUser = {
  findUnique: jest.fn(),
};

const mockPrismaContact = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaInteraction = {
  findMany: jest.fn(),
};

jest.mock('../infrastructure/database/prisma/client', () => ({
  prisma: {
    user: mockPrismaUser,
    contact: mockPrismaContact,
    interaction: mockPrismaInteraction,
  },
}));

jest.mock('../shared/logger/index.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../infrastructure/cache/CacheService', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  },
  CACHE_KEYS: {
    CONTACT_MATCHES: 'contact_matches:',
    CONTACT_MATCH_DETAIL: 'contact_match_detail:',
  },
  CACHE_TTL: {
    CONTACT_MATCHES: 300,
    MATCH_DETAILS: 300,
  },
}));

jest.mock('../infrastructure/database/neo4j/GraphService', () => ({
  neo4jGraphService: {
    isAvailable: jest.fn().mockReturnValue(false),
    getContactsByDegree: jest.fn().mockResolvedValue(new Map()),
  },
}));

jest.mock('../infrastructure/external/embedding/EmbeddingService', () => ({
  embeddingService: {
    isAvailable: jest.fn().mockReturnValue(false),
    calculateBulkSimilarity: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../infrastructure/external/matching/MatchHistoryService', () => ({
  matchHistoryService: {
    recordMatch: jest.fn().mockResolvedValue(undefined),
    recordBatchMatches: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../infrastructure/external/matching/MatchFeedbackService', () => ({
  matchFeedbackService: {
    getHiddenContactIds: jest.fn().mockResolvedValue(new Set()),
    getBulkFeedbackScores: jest.fn().mockResolvedValue(new Map()),
    calculateFeedbackAdjustment: jest.fn().mockImplementation((score: number) => {
      if (score > 0) return 1 + (score / 100) * 0.15;
      if (score < 0) return 1 + (score / 100) * 0.25;
      return 1;
    }),
  },
}));

jest.mock('../infrastructure/external/rerank/CohereRerankService', () => ({
  CohereRerankService: jest.fn().mockImplementation(() => ({
    rerank: jest.fn().mockResolvedValue({ results: [], processingTimeMs: 0 }),
  })),
  formatContactForRerank: jest.fn(),
  buildRerankQuery: jest.fn(),
}));

jest.mock('../config', () => ({
  config: {
    ai: {
      cohere: { apiKey: '' },
    },
  },
}));

import { DeterministicMatchingService } from '../infrastructure/external/matching/DeterministicMatchingService';
import { matchFeedbackService } from '../infrastructure/external/matching/MatchFeedbackService';
import { neo4jGraphService } from '../infrastructure/database/neo4j/GraphService';
import { embeddingService } from '../infrastructure/external/embedding/EmbeddingService';

describe('DeterministicMatchingService', () => {
  let service: DeterministicMatchingService;

  // Test data fixtures
  const createMockUser = (overrides = {}) => ({
    id: 'user-123',
    fullName: 'Test User',
    email: 'test@example.com',
    company: 'TechCorp',
    jobTitle: 'Software Engineer',
    location: 'San Francisco',
    bio: 'Passionate about technology',
    userSectors: [
      { sectorId: 'sector-tech', sector: { id: 'sector-tech', name: 'Technology' } },
      { sectorId: 'sector-finance', sector: { id: 'sector-finance', name: 'Finance' } },
    ],
    userSkills: [
      { skillId: 'skill-python', skill: { id: 'skill-python', name: 'Python' } },
      { skillId: 'skill-js', skill: { id: 'skill-js', name: 'JavaScript' } },
    ],
    userInterests: [
      { interestId: 'interest-ai', interest: { id: 'interest-ai', name: 'AI' } },
    ],
    userHobbies: [
      { hobbyId: 'hobby-reading', hobby: { id: 'hobby-reading', name: 'Reading' } },
    ],
    userGoals: [
      { goalType: 'COLLABORATION', priority: 1 },
    ],
    ...overrides,
  });

  const createMockContact = (overrides = {}) => ({
    id: 'contact-456',
    ownerId: 'user-123',
    fullName: 'Contact Person',
    email: 'contact@example.com',
    company: 'StartupInc',
    jobTitle: 'Developer',
    location: 'San Francisco',
    bio: 'Building cool things',
    createdAt: new Date(),
    updatedAt: new Date(),
    contactSectors: [
      { sectorId: 'sector-tech', sector: { id: 'sector-tech', name: 'Technology' } },
    ],
    contactSkills: [
      { skillId: 'skill-python', skill: { id: 'skill-python', name: 'Python' } },
    ],
    contactInterests: [
      { interestId: 'interest-ai', interest: { id: 'interest-ai', name: 'AI' } },
    ],
    contactHobbies: [
      { hobbyId: 'hobby-reading', hobby: { id: 'hobby-reading', name: 'Reading' } },
    ],
    interactions: [],
    ...overrides,
  });

  beforeEach(() => {
    service = new DeterministicMatchingService();
    jest.clearAllMocks();
  });

  // ===========================================
  // A. Score Range Validation Tests
  // ===========================================
  describe('Score Range Validation', () => {
    it('should return scores within 0-100 range', async () => {
      const mockUser = createMockUser();
      const mockContact = createMockContact();

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockPrismaContact.findMany.mockResolvedValue([mockContact]);

      const matches = await service.getMatches('user-123', { limit: 10, minScore: 0 });

      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        expect(match.score).toBeGreaterThanOrEqual(0);
        expect(match.score).toBeLessThanOrEqual(100);
      }
    });

    it('should have all score breakdown components within 0-100', async () => {
      const mockUser = createMockUser();
      const mockContact = createMockContact();

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockPrismaContact.findFirst.mockResolvedValue(mockContact);

      const details = await service.getMatchDetails('user-123', 'contact-456');

      expect(details).not.toBeNull();
      expect(details!.scoreBreakdown).toBeDefined();

      const breakdown = details!.scoreBreakdown;
      expect(breakdown.goalAlignmentScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.goalAlignmentScore).toBeLessThanOrEqual(100);
      expect(breakdown.sectorScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.sectorScore).toBeLessThanOrEqual(100);
      expect(breakdown.skillScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.skillScore).toBeLessThanOrEqual(100);
      expect(breakdown.semanticSimilarityScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.semanticSimilarityScore).toBeLessThanOrEqual(100);
      expect(breakdown.networkProximityScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.networkProximityScore).toBeLessThanOrEqual(100);
      expect(breakdown.complementarySkillsScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.complementarySkillsScore).toBeLessThanOrEqual(100);
      expect(breakdown.recencyScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.recencyScore).toBeLessThanOrEqual(100);
      expect(breakdown.interactionScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.interactionScore).toBeLessThanOrEqual(100);
      expect(breakdown.interestScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.interestScore).toBeLessThanOrEqual(100);
      expect(breakdown.hobbyScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.hobbyScore).toBeLessThanOrEqual(100);
    });

    it('should cap final score at 100 even with maximum overlap', async () => {
      // Create user and contact with maximum possible overlap
      const maxOverlapUser = createMockUser({
        userSectors: [
          { sectorId: 's1', sector: { name: 'Tech' } },
          { sectorId: 's2', sector: { name: 'Finance' } },
        ],
        userSkills: [
          { skillId: 'sk1', skill: { name: 'Frontend Development' } },
          { skillId: 'sk2', skill: { name: 'Backend Development' } },
        ],
        userGoals: [{ goalType: 'COLLABORATION' }],
      });

      const maxOverlapContact = createMockContact({
        contactSectors: [
          { sectorId: 's1', sector: { name: 'Tech' } },
          { sectorId: 's2', sector: { name: 'Finance' } },
        ],
        contactSkills: [
          { skillId: 'sk1', skill: { name: 'Frontend Development' } },
          { skillId: 'sk2', skill: { name: 'Backend Development' } },
        ],
        interactions: [{}, {}, {}, {}, {}], // 5 interactions
      });

      mockPrismaUser.findUnique.mockResolvedValue(maxOverlapUser);
      mockPrismaContact.findMany.mockResolvedValue([maxOverlapContact]);

      const matches = await service.getMatches('user-123', { limit: 10, minScore: 0 });

      expect(matches[0].score).toBeLessThanOrEqual(100);
    });
  });

  // ===========================================
  // B. Scoring Algorithm Correctness Tests
  // ===========================================
  describe('Scoring Algorithm Correctness', () => {
    describe('Goal Alignment (25% weight)', () => {
      it('should score high for HIRING goal with recruiter contact', async () => {
        const hiringUser = createMockUser({
          userGoals: [{ goalType: 'HIRING' }],
        });
        const recruiterContact = createMockContact({
          jobTitle: 'Technical Recruiter',
          contactSkills: [{ skillId: 'sk1', skill: { name: 'Recruiting' } }],
        });

        mockPrismaUser.findUnique.mockResolvedValue(hiringUser);
        mockPrismaContact.findFirst.mockResolvedValue(recruiterContact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.goalAlignmentScore).toBeGreaterThan(0);
      });

      it('should score high for INVESTMENT goal with investor contact', async () => {
        const investmentUser = createMockUser({
          userGoals: [{ goalType: 'INVESTMENT' }],
        });
        const investorContact = createMockContact({
          jobTitle: 'Venture Capital Partner',
          company: 'ABC Capital',
        });

        mockPrismaUser.findUnique.mockResolvedValue(investmentUser);
        mockPrismaContact.findFirst.mockResolvedValue(investorContact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.goalAlignmentScore).toBeGreaterThan(30);
      });

      it('should score high for MENTORSHIP goal with senior contact', async () => {
        const mentorshipUser = createMockUser({
          userGoals: [{ goalType: 'MENTORSHIP' }],
        });
        const seniorContact = createMockContact({
          jobTitle: 'CEO and Founder',
          contactSectors: [{ sectorId: 'sector-tech', sector: { name: 'Technology' } }],
        });

        mockPrismaUser.findUnique.mockResolvedValue(mentorshipUser);
        mockPrismaContact.findFirst.mockResolvedValue(seniorContact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.goalAlignmentScore).toBeGreaterThan(30);
      });

      it('should return 0 for goal alignment when user has no goals', async () => {
        const noGoalsUser = createMockUser({ userGoals: [] });
        const mockContact = createMockContact();

        mockPrismaUser.findUnique.mockResolvedValue(noGoalsUser);
        mockPrismaContact.findFirst.mockResolvedValue(mockContact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.goalAlignmentScore).toBe(0);
      });
    });

    describe('Sector Overlap (15% weight)', () => {
      it('should score higher with more shared sectors', async () => {
        const user = createMockUser({
          userSectors: [
            { sectorId: 's1', sector: { name: 'Tech' } },
            { sectorId: 's2', sector: { name: 'Finance' } },
          ],
        });

        const oneSharedSectorContact = createMockContact({
          contactSectors: [{ sectorId: 's1', sector: { name: 'Tech' } }],
        });

        const twoSharedSectorsContact = createMockContact({
          id: 'contact-789',
          contactSectors: [
            { sectorId: 's1', sector: { name: 'Tech' } },
            { sectorId: 's2', sector: { name: 'Finance' } },
          ],
        });

        mockPrismaUser.findUnique.mockResolvedValue(user);

        mockPrismaContact.findFirst.mockResolvedValueOnce(oneSharedSectorContact);
        const details1 = await service.getMatchDetails('user-123', 'contact-456');

        mockPrismaContact.findFirst.mockResolvedValueOnce(twoSharedSectorsContact);
        const details2 = await service.getMatchDetails('user-123', 'contact-789');

        expect(details2!.scoreBreakdown.sectorScore).toBeGreaterThan(details1!.scoreBreakdown.sectorScore);
      });

      it('should return 0 sector score with no overlap', async () => {
        const user = createMockUser({
          userSectors: [{ sectorId: 's1', sector: { name: 'Tech' } }],
        });
        const contact = createMockContact({
          contactSectors: [{ sectorId: 's2', sector: { name: 'Healthcare' } }],
        });

        mockPrismaUser.findUnique.mockResolvedValue(user);
        mockPrismaContact.findFirst.mockResolvedValue(contact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.sectorScore).toBe(0);
      });
    });

    describe('Skill Match (12% weight)', () => {
      it('should score higher with more shared skills', async () => {
        const user = createMockUser({
          userSkills: [
            { skillId: 'sk1', skill: { name: 'Python' } },
            { skillId: 'sk2', skill: { name: 'JavaScript' } },
            { skillId: 'sk3', skill: { name: 'React' } },
          ],
        });

        const oneSkillContact = createMockContact({
          contactSkills: [{ skillId: 'sk1', skill: { name: 'Python' } }],
        });

        const threeSkillsContact = createMockContact({
          id: 'contact-789',
          contactSkills: [
            { skillId: 'sk1', skill: { name: 'Python' } },
            { skillId: 'sk2', skill: { name: 'JavaScript' } },
            { skillId: 'sk3', skill: { name: 'React' } },
          ],
        });

        mockPrismaUser.findUnique.mockResolvedValue(user);

        mockPrismaContact.findFirst.mockResolvedValueOnce(oneSkillContact);
        const details1 = await service.getMatchDetails('user-123', 'contact-456');

        mockPrismaContact.findFirst.mockResolvedValueOnce(threeSkillsContact);
        const details2 = await service.getMatchDetails('user-123', 'contact-789');

        expect(details2!.scoreBreakdown.skillScore).toBeGreaterThan(details1!.scoreBreakdown.skillScore);
      });
    });

    describe('Network Proximity (8% weight)', () => {
      it('should score 100 for 1st degree connection', async () => {
        const user = createMockUser();
        const contact = createMockContact();

        (neo4jGraphService.isAvailable as jest.Mock).mockReturnValue(true);
        (neo4jGraphService.getContactsByDegree as jest.Mock).mockResolvedValue(
          new Map([[1, ['contact-456']]])
        );

        mockPrismaUser.findUnique.mockResolvedValue(user);
        mockPrismaContact.findFirst.mockResolvedValue(contact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.networkProximityScore).toBe(100);
      });

      it('should score 70 for 2nd degree connection', async () => {
        const user = createMockUser();
        const contact = createMockContact();

        (neo4jGraphService.isAvailable as jest.Mock).mockReturnValue(true);
        (neo4jGraphService.getContactsByDegree as jest.Mock).mockResolvedValue(
          new Map([[2, ['contact-456']]])
        );

        mockPrismaUser.findUnique.mockResolvedValue(user);
        mockPrismaContact.findFirst.mockResolvedValue(contact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.networkProximityScore).toBe(70);
      });

      it('should score 40 for 3rd degree connection', async () => {
        const user = createMockUser();
        const contact = createMockContact();

        (neo4jGraphService.isAvailable as jest.Mock).mockReturnValue(true);
        (neo4jGraphService.getContactsByDegree as jest.Mock).mockResolvedValue(
          new Map([[3, ['contact-456']]])
        );

        mockPrismaUser.findUnique.mockResolvedValue(user);
        mockPrismaContact.findFirst.mockResolvedValue(contact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.networkProximityScore).toBe(40);
      });

      it('should score 0 when no network connection', async () => {
        const user = createMockUser();
        const contact = createMockContact();

        (neo4jGraphService.isAvailable as jest.Mock).mockReturnValue(true);
        (neo4jGraphService.getContactsByDegree as jest.Mock).mockResolvedValue(new Map());

        mockPrismaUser.findUnique.mockResolvedValue(user);
        mockPrismaContact.findFirst.mockResolvedValue(contact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.networkProximityScore).toBe(0);
      });
    });

    describe('Complementary Skills (7% weight)', () => {
      it('should score high when user has Frontend and contact has Backend', async () => {
        const user = createMockUser({
          userSkills: [{ skillId: 'sk1', skill: { name: 'Frontend Development' } }],
        });
        const contact = createMockContact({
          contactSkills: [{ skillId: 'sk2', skill: { name: 'Backend Development' } }],
        });

        mockPrismaUser.findUnique.mockResolvedValue(user);
        mockPrismaContact.findFirst.mockResolvedValue(contact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.complementarySkillsScore).toBeGreaterThan(0);
      });

      it('should score 0 when no complementary skills', async () => {
        const user = createMockUser({
          userSkills: [{ skillId: 'sk1', skill: { name: 'Cooking' } }],
        });
        const contact = createMockContact({
          contactSkills: [{ skillId: 'sk2', skill: { name: 'Gardening' } }],
        });

        mockPrismaUser.findUnique.mockResolvedValue(user);
        mockPrismaContact.findFirst.mockResolvedValue(contact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.complementarySkillsScore).toBe(0);
      });
    });

    describe('Recency (7% weight)', () => {
      it('should score higher for recently updated contact', async () => {
        const user = createMockUser();

        const recentContact = createMockContact({
          updatedAt: new Date(), // Today
        });

        const oldContact = createMockContact({
          id: 'contact-old',
          updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        });

        mockPrismaUser.findUnique.mockResolvedValue(user);

        mockPrismaContact.findFirst.mockResolvedValueOnce(recentContact);
        const details1 = await service.getMatchDetails('user-123', 'contact-456');

        mockPrismaContact.findFirst.mockResolvedValueOnce(oldContact);
        const details2 = await service.getMatchDetails('user-123', 'contact-old');

        expect(details1!.scoreBreakdown.recencyScore).toBeGreaterThan(details2!.scoreBreakdown.recencyScore);
      });
    });

    describe('Interaction Frequency (6% weight)', () => {
      it('should score higher with more interactions', async () => {
        const user = createMockUser();

        const noInteractionsContact = createMockContact({ interactions: [] });
        const manyInteractionsContact = createMockContact({
          id: 'contact-active',
          interactions: [{}, {}, {}, {}, {}], // 5 interactions = 100 points
        });

        mockPrismaUser.findUnique.mockResolvedValue(user);

        mockPrismaContact.findFirst.mockResolvedValueOnce(noInteractionsContact);
        const details1 = await service.getMatchDetails('user-123', 'contact-456');

        mockPrismaContact.findFirst.mockResolvedValueOnce(manyInteractionsContact);
        const details2 = await service.getMatchDetails('user-123', 'contact-active');

        expect(details2!.scoreBreakdown.interactionScore).toBeGreaterThan(details1!.scoreBreakdown.interactionScore);
        expect(details1!.scoreBreakdown.interactionScore).toBe(0);
        expect(details2!.scoreBreakdown.interactionScore).toBe(100); // 5 * 20 = 100
      });

      it('should cap interaction score at 100', async () => {
        const user = createMockUser();
        const superActiveContact = createMockContact({
          interactions: Array(10).fill({}), // 10 interactions
        });

        mockPrismaUser.findUnique.mockResolvedValue(user);
        mockPrismaContact.findFirst.mockResolvedValue(superActiveContact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.interactionScore).toBe(100); // Capped at 100
      });
    });

    describe('Interest Overlap (5% weight)', () => {
      it('should score based on shared interests', async () => {
        const user = createMockUser({
          userInterests: [
            { interestId: 'i1', interest: { name: 'AI' } },
            { interestId: 'i2', interest: { name: 'Blockchain' } },
          ],
        });
        const contact = createMockContact({
          contactInterests: [
            { interestId: 'i1', interest: { name: 'AI' } },
          ],
        });

        mockPrismaUser.findUnique.mockResolvedValue(user);
        mockPrismaContact.findFirst.mockResolvedValue(contact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.interestScore).toBeGreaterThan(0);
      });
    });

    describe('Hobby Overlap (5% weight)', () => {
      it('should score based on shared hobbies', async () => {
        const user = createMockUser({
          userHobbies: [
            { hobbyId: 'h1', hobby: { name: 'Reading' } },
            { hobbyId: 'h2', hobby: { name: 'Gaming' } },
          ],
        });
        const contact = createMockContact({
          contactHobbies: [
            { hobbyId: 'h1', hobby: { name: 'Reading' } },
            { hobbyId: 'h2', hobby: { name: 'Gaming' } },
          ],
        });

        mockPrismaUser.findUnique.mockResolvedValue(user);
        mockPrismaContact.findFirst.mockResolvedValue(contact);

        const details = await service.getMatchDetails('user-123', 'contact-456');

        expect(details!.scoreBreakdown.hobbyScore).toBe(100); // Full overlap
      });
    });
  });

  // ===========================================
  // C. Edge Cases Tests
  // ===========================================
  describe('Edge Cases', () => {
    it('should return empty array when user not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const matches = await service.getMatches('nonexistent', { limit: 10 });

      expect(matches).toEqual([]);
    });

    it('should return empty array when user has no contacts', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(createMockUser());
      mockPrismaContact.findMany.mockResolvedValue([]);

      const matches = await service.getMatches('user-123', { limit: 10 });

      expect(matches).toEqual([]);
    });

    it('should return null when contact not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(createMockUser());
      mockPrismaContact.findFirst.mockResolvedValue(null);

      const details = await service.getMatchDetails('user-123', 'nonexistent');

      expect(details).toBeNull();
    });

    it('should handle contact with no sectors/skills gracefully', async () => {
      const user = createMockUser();
      const emptyContact = createMockContact({
        contactSectors: [],
        contactSkills: [],
        contactInterests: [],
        contactHobbies: [],
      });

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findFirst.mockResolvedValue(emptyContact);

      const details = await service.getMatchDetails('user-123', 'contact-456');

      expect(details).not.toBeNull();
      expect(details!.score).toBeGreaterThanOrEqual(0);
      expect(details!.scoreBreakdown.sectorScore).toBe(0);
      expect(details!.scoreBreakdown.skillScore).toBe(0);
    });

    it('should handle user with empty profile', async () => {
      const emptyUser = createMockUser({
        userSectors: [],
        userSkills: [],
        userInterests: [],
        userHobbies: [],
        userGoals: [],
      });
      const contact = createMockContact();

      mockPrismaUser.findUnique.mockResolvedValue(emptyUser);
      mockPrismaContact.findFirst.mockResolvedValue(contact);

      const details = await service.getMatchDetails('user-123', 'contact-456');

      expect(details).not.toBeNull();
      // Score should be low but not crash
      expect(details!.scoreBreakdown.goalAlignmentScore).toBe(0);
      expect(details!.scoreBreakdown.sectorScore).toBe(0);
      expect(details!.scoreBreakdown.skillScore).toBe(0);
    });

    it('should filter out hidden contacts', async () => {
      const user = createMockUser();
      const contact1 = createMockContact({ id: 'contact-1' });
      const contact2 = createMockContact({ id: 'contact-2' });

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findMany.mockResolvedValue([contact1, contact2]);
      (matchFeedbackService.getHiddenContactIds as jest.Mock).mockResolvedValue(new Set(['contact-2']));

      const matches = await service.getMatches('user-123', { limit: 10 });

      expect(matches.length).toBe(1);
      expect(matches[0].contactId).toBe('contact-1');
    });
  });

  // ===========================================
  // D. Feedback Adjustment Tests
  // ===========================================
  describe('Feedback Adjustment', () => {
    it('should increase score for positive feedback', async () => {
      const user = createMockUser();
      const contact = createMockContact();

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findMany.mockResolvedValue([contact]);
      (matchFeedbackService.getBulkFeedbackScores as jest.Mock).mockResolvedValue(
        new Map([['contact-456', 50]]) // Positive feedback
      );

      const matches = await service.getMatches('user-123', { limit: 10 });

      // Score should be boosted
      expect(matches.length).toBe(1);
      // With feedback score of 50, adjustment is 1 + (50/100) * 0.15 = 1.075
    });

    it('should decrease score for negative feedback', async () => {
      const user = createMockUser();
      const contact = createMockContact();

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findMany.mockResolvedValue([contact]);
      (matchFeedbackService.getBulkFeedbackScores as jest.Mock).mockResolvedValue(
        new Map([['contact-456', -50]]) // Negative feedback
      );

      const matches = await service.getMatches('user-123', { limit: 10 });

      // Score should be reduced
      expect(matches.length).toBe(1);
      // With feedback score of -50, adjustment is 1 + (-50/100) * 0.25 = 0.875
    });

    it('should not adjust score when feedback is neutral', async () => {
      const user = createMockUser();
      const contact = createMockContact();

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findMany.mockResolvedValue([contact]);
      (matchFeedbackService.getBulkFeedbackScores as jest.Mock).mockResolvedValue(
        new Map([['contact-456', 0]]) // Neutral feedback
      );

      const matches = await service.getMatches('user-123', { limit: 10 });

      expect(matches.length).toBe(1);
      // Score should be unchanged
    });
  });

  // ===========================================
  // E. Return Structure Validation Tests
  // ===========================================
  describe('Return Structure Validation', () => {
    it('should return MatchResult with all required fields', async () => {
      const user = createMockUser();
      const contact = createMockContact();

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findFirst.mockResolvedValue(contact);

      const details = await service.getMatchDetails('user-123', 'contact-456');

      expect(details).toHaveProperty('contactId');
      expect(details).toHaveProperty('score');
      expect(details).toHaveProperty('scoreBreakdown');
      expect(details).toHaveProperty('intersections');
      expect(details).toHaveProperty('reasons');
      expect(details).toHaveProperty('suggestedMessage');
    });

    it('should have scoreBreakdown with all 10 components', async () => {
      const user = createMockUser();
      const contact = createMockContact();

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findFirst.mockResolvedValue(contact);

      const details = await service.getMatchDetails('user-123', 'contact-456');

      expect(details!.scoreBreakdown).toHaveProperty('goalAlignmentScore');
      expect(details!.scoreBreakdown).toHaveProperty('sectorScore');
      expect(details!.scoreBreakdown).toHaveProperty('skillScore');
      expect(details!.scoreBreakdown).toHaveProperty('semanticSimilarityScore');
      expect(details!.scoreBreakdown).toHaveProperty('networkProximityScore');
      expect(details!.scoreBreakdown).toHaveProperty('complementarySkillsScore');
      expect(details!.scoreBreakdown).toHaveProperty('recencyScore');
      expect(details!.scoreBreakdown).toHaveProperty('interactionScore');
      expect(details!.scoreBreakdown).toHaveProperty('interestScore');
      expect(details!.scoreBreakdown).toHaveProperty('hobbyScore');
    });

    it('should populate intersections array with shared attributes', async () => {
      const user = createMockUser({
        userSectors: [{ sectorId: 's1', sector: { id: 's1', name: 'Tech' } }],
        userSkills: [{ skillId: 'sk1', skill: { id: 'sk1', name: 'Python' } }],
      });
      const contact = createMockContact({
        contactSectors: [{ sectorId: 's1', sector: { id: 's1', name: 'Tech' } }],
        contactSkills: [{ skillId: 'sk1', skill: { id: 'sk1', name: 'Python' } }],
      });

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findFirst.mockResolvedValue(contact);

      const details = await service.getMatchDetails('user-123', 'contact-456');

      expect(details!.intersections.length).toBeGreaterThan(0);
      expect(details!.intersections.some(i => i.type === 'sector')).toBe(true);
      expect(details!.intersections.some(i => i.type === 'skill')).toBe(true);
    });

    it('should generate meaningful reasons', async () => {
      const user = createMockUser({
        userGoals: [{ goalType: 'COLLABORATION' }],
      });
      const contact = createMockContact();

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findFirst.mockResolvedValue(contact);

      const details = await service.getMatchDetails('user-123', 'contact-456');

      expect(details!.reasons).toBeDefined();
      expect(Array.isArray(details!.reasons)).toBe(true);
      expect(details!.reasons!.length).toBeGreaterThan(0);
    });
  });

  // ===========================================
  // F. Ranking Validation Tests
  // ===========================================
  describe('Ranking Validation', () => {
    it('should rank high-overlap contacts above low-overlap contacts', async () => {
      const user = createMockUser({
        userSectors: [
          { sectorId: 's1', sector: { name: 'Tech' } },
          { sectorId: 's2', sector: { name: 'Finance' } },
        ],
        userSkills: [
          { skillId: 'sk1', skill: { name: 'Python' } },
          { skillId: 'sk2', skill: { name: 'JavaScript' } },
        ],
      });

      const highOverlapContact = createMockContact({
        id: 'high-match',
        contactSectors: [
          { sectorId: 's1', sector: { name: 'Tech' } },
          { sectorId: 's2', sector: { name: 'Finance' } },
        ],
        contactSkills: [
          { skillId: 'sk1', skill: { name: 'Python' } },
          { skillId: 'sk2', skill: { name: 'JavaScript' } },
        ],
      });

      const lowOverlapContact = createMockContact({
        id: 'low-match',
        contactSectors: [],
        contactSkills: [],
      });

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findMany.mockResolvedValue([lowOverlapContact, highOverlapContact]);

      const matches = await service.getMatches('user-123', { limit: 10, minScore: 0 });

      expect(matches.length).toBe(2);
      expect(matches[0].contactId).toBe('high-match');
      expect(matches[1].contactId).toBe('low-match');
      expect(matches[0].score).toBeGreaterThan(matches[1].score);
    });
  });

  // ===========================================
  // G. Daily Recommendations Tests
  // ===========================================
  describe('getDailyRecommendations', () => {
    it('should return up to specified count of recommendations', async () => {
      const user = createMockUser();
      const contacts = [
        createMockContact({ id: 'c1' }),
        createMockContact({ id: 'c2' }),
        createMockContact({ id: 'c3' }),
      ];

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findMany.mockResolvedValue(contacts);
      mockPrismaContact.findUnique
        .mockResolvedValueOnce({ id: 'c1', fullName: 'Contact 1', company: 'Co1', jobTitle: 'Dev' })
        .mockResolvedValueOnce({ id: 'c2', fullName: 'Contact 2', company: 'Co2', jobTitle: 'Dev' })
        .mockResolvedValueOnce({ id: 'c3', fullName: 'Contact 3', company: 'Co3', jobTitle: 'Dev' });
      mockPrismaInteraction.findMany.mockResolvedValue([]);

      const recommendations = await service.getDailyRecommendations('user-123', 3);

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should exclude recently contacted contacts', async () => {
      const user = createMockUser();
      const contacts = [
        createMockContact({ id: 'c1' }),
        createMockContact({ id: 'c2' }),
      ];

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findMany.mockResolvedValue(contacts);
      mockPrismaContact.findUnique.mockResolvedValue({ id: 'c2', fullName: 'Contact 2', company: 'Co2', jobTitle: 'Dev' });
      mockPrismaInteraction.findMany.mockResolvedValue([
        { contactId: 'c1' }, // c1 was recently contacted
      ]);

      const recommendations = await service.getDailyRecommendations('user-123', 3);

      // c1 should be excluded
      const contactIds = recommendations.map(r => r.contact.id);
      expect(contactIds).not.toContain('c1');
    });
  });

  // ===========================================
  // H. getIntersections Tests
  // ===========================================
  describe('getIntersections', () => {
    it('should return intersection points between user and contact', async () => {
      const user = createMockUser({
        company: 'SharedCo',
        location: 'San Francisco',
        userSectors: [{ sectorId: 's1', sector: { id: 's1', name: 'Tech' } }],
        userSkills: [{ skillId: 'sk1', skill: { id: 'sk1', name: 'Python' } }],
        userInterests: [{ interestId: 'i1', interest: { id: 'i1', name: 'AI' } }],
        userHobbies: [{ hobbyId: 'h1', hobby: { id: 'h1', name: 'Reading' } }],
      });
      const contact = createMockContact({
        company: 'SharedCo',
        location: 'San Francisco',
        contactSectors: [{ sectorId: 's1', sector: { id: 's1', name: 'Tech' } }],
        contactSkills: [{ skillId: 'sk1', skill: { id: 'sk1', name: 'Python' } }],
        contactInterests: [{ interestId: 'i1', interest: { id: 'i1', name: 'AI' } }],
        contactHobbies: [{ hobbyId: 'h1', hobby: { id: 'h1', name: 'Reading' } }],
      });

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findFirst.mockResolvedValue(contact);

      const intersections = await service.getIntersections('user-123', 'contact-456');

      expect(intersections.length).toBeGreaterThan(0);

      const types = intersections.map(i => i.type);
      expect(types).toContain('sector');
      expect(types).toContain('skill');
      expect(types).toContain('interest');
      expect(types).toContain('hobby');
      expect(types).toContain('company');
      expect(types).toContain('location');
    });

    it('should return empty array when user not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const intersections = await service.getIntersections('nonexistent', 'contact-456');

      expect(intersections).toEqual([]);
    });

    it('should return empty array when contact not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(createMockUser());
      mockPrismaContact.findFirst.mockResolvedValue(null);

      const intersections = await service.getIntersections('user-123', 'nonexistent');

      expect(intersections).toEqual([]);
    });
  });

  // ===========================================
  // I. recalculateScore Tests
  // ===========================================
  describe('recalculateScore', () => {
    it('should recalculate and update contact match score', async () => {
      const user = createMockUser();
      const contact = createMockContact();

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaContact.findFirst.mockResolvedValue(contact);
      mockPrismaContact.update.mockResolvedValue({ ...contact, matchScore: 65 });

      const score = await service.recalculateScore('user-123', 'contact-456');

      expect(score).toBeGreaterThan(0);
      expect(mockPrismaContact.update).toHaveBeenCalledWith({
        where: { id: 'contact-456' },
        data: { matchScore: expect.any(Number) },
      });
    });

    it('should return 0 when contact not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(createMockUser());
      mockPrismaContact.findFirst.mockResolvedValue(null);

      const score = await service.recalculateScore('user-123', 'nonexistent');

      expect(score).toBe(0);
    });
  });
});
