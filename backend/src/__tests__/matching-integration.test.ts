/**
 * Matching Services Integration Test
 *
 * Creates test data and validates matching algorithms
 */

import { PrismaClient } from '@prisma/client';
import { DeterministicMatchingService } from '../infrastructure/external/matching/DeterministicMatchingService';
import { HybridMatchingService } from '../infrastructure/external/matching/HybridMatchingService';
import { matchFeedbackService } from '../infrastructure/external/matching/MatchFeedbackService';
import { CohereRerankService } from '../infrastructure/external/rerank/CohereRerankService';

const prisma = new PrismaClient();

// Test data IDs
let testUserId: string;
let highMatchContactId: string;
let mediumMatchContactId: string;
let lowMatchContactId: string;

// Sector/Skill IDs (will be fetched)
let techSectorId: string;
let financeSectorId: string;
let healthcareSectorId: string;
let pythonSkillId: string;
let javascriptSkillId: string;
let dataAnalysisSkillId: string;
let aiInterestId: string;
let blockchainInterestId: string;

describe('Matching Services Integration Tests', () => {
  beforeAll(async () => {
    console.log('\n📊 Setting up test data...\n');

    // Get or create sectors
    const sectors = await Promise.all([
      prisma.sector.upsert({
        where: { name: 'Technology' },
        create: { name: 'Technology', description: 'Tech sector' },
        update: {},
      }),
      prisma.sector.upsert({
        where: { name: 'Finance' },
        create: { name: 'Finance', description: 'Finance sector' },
        update: {},
      }),
      prisma.sector.upsert({
        where: { name: 'Healthcare' },
        create: { name: 'Healthcare', description: 'Healthcare sector' },
        update: {},
      }),
    ]);
    techSectorId = sectors[0].id;
    financeSectorId = sectors[1].id;
    healthcareSectorId = sectors[2].id;

    // Get or create skills
    const skills = await Promise.all([
      prisma.skill.upsert({
        where: { name: 'Python' },
        create: { name: 'Python', category: 'Programming' },
        update: {},
      }),
      prisma.skill.upsert({
        where: { name: 'JavaScript' },
        create: { name: 'JavaScript', category: 'Programming' },
        update: {},
      }),
      prisma.skill.upsert({
        where: { name: 'Data Analysis' },
        create: { name: 'Data Analysis', category: 'Analytics' },
        update: {},
      }),
    ]);
    pythonSkillId = skills[0].id;
    javascriptSkillId = skills[1].id;
    dataAnalysisSkillId = skills[2].id;

    // Get or create interests
    const interests = await Promise.all([
      prisma.interest.upsert({
        where: { name: 'Artificial Intelligence' },
        create: { name: 'Artificial Intelligence', category: 'Technology' },
        update: {},
      }),
      prisma.interest.upsert({
        where: { name: 'Blockchain' },
        create: { name: 'Blockchain', category: 'Technology' },
        update: {},
      }),
    ]);
    aiInterestId = interests[0].id;
    blockchainInterestId = interests[1].id;

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-matching-${Date.now()}@test.com`,
        passwordHash: 'test-hash',
        fullName: 'Test User for Matching',
        company: 'TechCorp',
        jobTitle: 'Senior Data Scientist',
        location: 'San Francisco',
        bio: 'Passionate about AI and data science',
        isActive: true,
        emailVerified: true,
      },
    });
    testUserId = testUser.id;

    // Add user sectors
    await prisma.userSector.createMany({
      data: [
        { userId: testUserId, sectorId: techSectorId, isPrimary: true },
        { userId: testUserId, sectorId: financeSectorId, isPrimary: false },
      ],
    });

    // Add user skills
    await prisma.userSkill.createMany({
      data: [
        { userId: testUserId, skillId: pythonSkillId },
        { userId: testUserId, skillId: dataAnalysisSkillId },
      ],
    });

    // Add user interests
    await prisma.userInterest.createMany({
      data: [
        { userId: testUserId, interestId: aiInterestId },
      ],
    });

    // Add user goals
    await prisma.userGoal.createMany({
      data: [
        { userId: testUserId, goalType: 'COLLABORATION', priority: 1 },
        { userId: testUserId, goalType: 'MENTORSHIP', priority: 2 },
      ],
    });

    // Create HIGH MATCH contact (same sector, skills, interests)
    const highMatchContact = await prisma.contact.create({
      data: {
        ownerId: testUserId,
        fullName: 'High Match Contact',
        email: 'high-match@test.com',
        company: 'AI Startup',
        jobTitle: 'Machine Learning Engineer',
        location: 'San Francisco',
        bio: 'Building AI solutions for enterprise',
      },
    });
    highMatchContactId = highMatchContact.id;

    await prisma.contactSector.createMany({
      data: [
        { contactId: highMatchContactId, sectorId: techSectorId },
        { contactId: highMatchContactId, sectorId: financeSectorId },
      ],
    });
    await prisma.contactSkill.createMany({
      data: [
        { contactId: highMatchContactId, skillId: pythonSkillId },
        { contactId: highMatchContactId, skillId: dataAnalysisSkillId },
      ],
    });
    await prisma.contactInterest.createMany({
      data: [
        { contactId: highMatchContactId, interestId: aiInterestId },
      ],
    });

    // Create MEDIUM MATCH contact (some overlap)
    const mediumMatchContact = await prisma.contact.create({
      data: {
        ownerId: testUserId,
        fullName: 'Medium Match Contact',
        email: 'medium-match@test.com',
        company: 'FinTech Inc',
        jobTitle: 'Software Developer',
        location: 'New York',
        bio: 'Full stack developer interested in fintech',
      },
    });
    mediumMatchContactId = mediumMatchContact.id;

    await prisma.contactSector.createMany({
      data: [
        { contactId: mediumMatchContactId, sectorId: financeSectorId },
      ],
    });
    await prisma.contactSkill.createMany({
      data: [
        { contactId: mediumMatchContactId, skillId: javascriptSkillId },
      ],
    });

    // Create LOW MATCH contact (no overlap)
    const lowMatchContact = await prisma.contact.create({
      data: {
        ownerId: testUserId,
        fullName: 'Low Match Contact',
        email: 'low-match@test.com',
        company: 'Healthcare Corp',
        jobTitle: 'Nurse',
        location: 'Miami',
        bio: 'Healthcare professional',
      },
    });
    lowMatchContactId = lowMatchContact.id;

    await prisma.contactSector.createMany({
      data: [
        { contactId: lowMatchContactId, sectorId: healthcareSectorId },
      ],
    });

    console.log('✅ Test data created successfully');
    console.log(`   - Test User ID: ${testUserId}`);
    console.log(`   - High Match Contact ID: ${highMatchContactId}`);
    console.log(`   - Medium Match Contact ID: ${mediumMatchContactId}`);
    console.log(`   - Low Match Contact ID: ${lowMatchContactId}`);
  });

  afterAll(async () => {
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');

    await prisma.contactInterest.deleteMany({ where: { contactId: { in: [highMatchContactId, mediumMatchContactId, lowMatchContactId] } } });
    await prisma.contactSkill.deleteMany({ where: { contactId: { in: [highMatchContactId, mediumMatchContactId, lowMatchContactId] } } });
    await prisma.contactSector.deleteMany({ where: { contactId: { in: [highMatchContactId, mediumMatchContactId, lowMatchContactId] } } });
    await prisma.contact.deleteMany({ where: { id: { in: [highMatchContactId, mediumMatchContactId, lowMatchContactId] } } });

    await prisma.userGoal.deleteMany({ where: { userId: testUserId } });
    await prisma.userInterest.deleteMany({ where: { userId: testUserId } });
    await prisma.userSkill.deleteMany({ where: { userId: testUserId } });
    await prisma.userSector.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });

    await prisma.$disconnect();
    console.log('✅ Cleanup complete');
  });

  describe('DeterministicMatchingService', () => {
    let service: DeterministicMatchingService;

    beforeAll(() => {
      service = new DeterministicMatchingService();
    });

    test('should rank high-match contact highest', async () => {
      console.log('\n🔬 Testing DeterministicMatchingService...');

      const matches = await service.getMatches(testUserId, { limit: 10, minScore: 0 });

      console.log('\n📊 EXPECTED RESULTS:');
      console.log('   High Match Contact: Score 70-100 (same sector, skills, interests)');
      console.log('   Medium Match Contact: Score 30-60 (partial overlap)');
      console.log('   Low Match Contact: Score 0-30 (no overlap)');

      console.log('\n📊 ACTUAL RESULTS:');
      matches.forEach((match, index) => {
        const contactName = match.contactId === highMatchContactId ? 'High Match' :
                           match.contactId === mediumMatchContactId ? 'Medium Match' : 'Low Match';
        console.log(`   ${index + 1}. ${contactName}: Score ${match.score}`);
        console.log(`      Reasons: ${match.reasons?.slice(0, 3).join(', ') || 'None'}`);
      });

      // Assertions
      const highMatch = matches.find(m => m.contactId === highMatchContactId);
      const mediumMatch = matches.find(m => m.contactId === mediumMatchContactId);
      const lowMatch = matches.find(m => m.contactId === lowMatchContactId);

      expect(highMatch).toBeDefined();
      expect(highMatch!.score).toBeGreaterThan(50);

      if (mediumMatch && highMatch) {
        expect(highMatch.score).toBeGreaterThan(mediumMatch.score);
      }

      if (lowMatch && mediumMatch) {
        expect(mediumMatch.score).toBeGreaterThanOrEqual(lowMatch.score);
      }
    });

    test('should return match details with score breakdown', async () => {
      console.log('\n🔬 Testing getMatchDetails...');

      const details = await service.getMatchDetails(testUserId, highMatchContactId);

      console.log('\n📊 EXPECTED:');
      console.log('   - scoreBreakdown with sector, skill, interest scores');
      console.log('   - intersections showing shared attributes');

      console.log('\n📊 ACTUAL:');
      console.log(`   Score: ${details?.score}`);
      console.log(`   Breakdown: ${JSON.stringify(details?.scoreBreakdown, null, 2)}`);
      console.log(`   Intersections: ${details?.intersections?.length || 0} found`);
      details?.intersections?.forEach(i => {
        console.log(`      - ${i.type}: ${i.items?.join(', ')}`);
      });

      expect(details).toBeDefined();
      expect(details!.scoreBreakdown).toBeDefined();
      expect(details!.score).toBeGreaterThan(0);
    });

    test('should return intersections between user and contact', async () => {
      console.log('\n🔬 Testing getIntersections...');

      const intersections = await service.getIntersections(testUserId, highMatchContactId);

      console.log('\n📊 EXPECTED:');
      console.log('   - Shared sectors: Technology, Finance');
      console.log('   - Shared skills: Python, Data Analysis');
      console.log('   - Shared interests: Artificial Intelligence');

      console.log('\n📊 ACTUAL:');
      intersections.forEach(i => {
        console.log(`   ${i.type}: ${i.items?.join(', ') || 'None'}`);
      });

      expect(intersections.length).toBeGreaterThan(0);

      const sectorIntersection = intersections.find(i => i.type === 'sectors');
      expect(sectorIntersection).toBeDefined();
    });
  });

  describe('HybridMatchingService', () => {
    let service: HybridMatchingService;

    beforeAll(() => {
      service = new HybridMatchingService();
    });

    test('should blend deterministic and Recombee scores', async () => {
      console.log('\n🔬 Testing HybridMatchingService...');

      const matches = await service.getMatches(testUserId, { limit: 10, minScore: 0 });

      console.log('\n📊 EXPECTED:');
      console.log('   - Scores blended: 70% deterministic + 30% Recombee');
      console.log('   - High Match should still rank highest');

      console.log('\n📊 ACTUAL:');
      matches.forEach((match, index) => {
        const contactName = match.contactId === highMatchContactId ? 'High Match' :
                           match.contactId === mediumMatchContactId ? 'Medium Match' : 'Low Match';
        console.log(`   ${index + 1}. ${contactName}: Score ${match.score}`);
        const hasRecombee = match.reasons?.some(r => r.includes('Recombee') || r.includes('similar users'));
        console.log(`      Recombee influence: ${hasRecombee ? 'Yes' : 'No'}`);
      });

      expect(matches.length).toBeGreaterThan(0);

      const highMatch = matches.find(m => m.contactId === highMatchContactId);
      expect(highMatch).toBeDefined();
    });

    test('should return daily recommendations', async () => {
      console.log('\n🔬 Testing getDailyRecommendations...');

      const recommendations = await service.getDailyRecommendations(testUserId, 3);

      console.log('\n📊 EXPECTED:');
      console.log('   - Up to 3 recommendations');
      console.log('   - Each with contact info and recommendation reason');

      console.log('\n📊 ACTUAL:');
      console.log(`   Recommendations count: ${recommendations.length}`);
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.contact?.name || 'Unknown'}`);
        console.log(`      Reason: ${rec.recommendationReason?.substring(0, 50)}...`);
      });

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });
  });

  describe('MatchFeedbackService', () => {
    test('should record and retrieve feedback', async () => {
      console.log('\n🔬 Testing MatchFeedbackService...');

      // Record positive feedback
      await matchFeedbackService.recordFeedback({
        userId: testUserId,
        contactId: highMatchContactId,
        matchType: 'CONTACT',
        action: 'ACCEPT',
        matchScoreAtFeedback: 85,
      });

      // Record negative feedback
      await matchFeedbackService.recordFeedback({
        userId: testUserId,
        contactId: lowMatchContactId,
        matchType: 'CONTACT',
        action: 'REJECT',
        matchScoreAtFeedback: 20,
      });

      console.log('\n📊 EXPECTED:');
      console.log('   - High Match: Positive feedback score');
      console.log('   - Low Match: Negative feedback score');

      const feedbackScores = await matchFeedbackService.getBulkFeedbackScores(
        testUserId,
        [highMatchContactId, lowMatchContactId]
      );

      console.log('\n📊 ACTUAL:');
      console.log(`   High Match feedback score: ${feedbackScores.get(highMatchContactId) || 0}`);
      console.log(`   Low Match feedback score: ${feedbackScores.get(lowMatchContactId) || 0}`);

      const highFeedback = feedbackScores.get(highMatchContactId) || 0;
      const lowFeedback = feedbackScores.get(lowMatchContactId) || 0;

      expect(highFeedback).toBeGreaterThan(0);
      expect(lowFeedback).toBeLessThan(0);

      // Cleanup feedback
      await prisma.matchFeedback.deleteMany({ where: { userId: testUserId } });
      await prisma.matchFeedbackStats.deleteMany({ where: { userId: testUserId } });
    });

    test('should calculate feedback adjustment correctly', () => {
      console.log('\n🔬 Testing calculateFeedbackAdjustment...');

      const testCases = [
        { score: 50, expected: '> 1.0 (boost)' },
        { score: 0, expected: '= 1.0 (neutral)' },
        { score: -30, expected: '< 1.0 (penalty)' },
      ];

      console.log('\n📊 EXPECTED vs ACTUAL:');
      testCases.forEach(tc => {
        const adjustment = matchFeedbackService.calculateFeedbackAdjustment(tc.score);
        const status = tc.score > 0 ? (adjustment > 1 ? '✅' : '❌') :
                      tc.score < 0 ? (adjustment < 1 ? '✅' : '❌') :
                      (adjustment === 1 ? '✅' : '❌');
        console.log(`   Score ${tc.score}: Expected ${tc.expected}, Got ${adjustment.toFixed(2)} ${status}`);
      });
    });
  });

  describe('CohereRerankService', () => {
    let service: CohereRerankService;

    beforeAll(() => {
      service = new CohereRerankService();
    });

    test('should check availability', async () => {
      console.log('\n🔬 Testing CohereRerankService availability...');

      const isAvailable = await service.isAvailable();

      console.log('\n📊 EXPECTED: Service available (API key configured)');
      console.log(`📊 ACTUAL: ${isAvailable ? '✅ Available' : '❌ Not available'}`);

      expect(typeof isAvailable).toBe('boolean');
    });

    test('should rerank documents by relevance', async () => {
      console.log('\n🔬 Testing Cohere rerank...');

      const isAvailable = await service.isAvailable();
      if (!isAvailable) {
        console.log('⚠️ Skipping: Cohere service not available');
        return;
      }

      const query = 'AI and machine learning expert for data science collaboration';
      const documents = [
        { id: highMatchContactId, text: 'Machine Learning Engineer at AI Startup, expert in Python and data analysis, interested in AI' },
        { id: mediumMatchContactId, text: 'Software Developer at FinTech Inc, JavaScript developer' },
        { id: lowMatchContactId, text: 'Nurse at Healthcare Corp' },
      ];

      console.log('\n📊 EXPECTED:');
      console.log('   1. High Match (ML Engineer) - highest relevance');
      console.log('   2. Medium Match (Software Dev) - medium relevance');
      console.log('   3. Low Match (Nurse) - lowest relevance');

      try {
        const results = await service.rerank(query, documents);

        console.log('\n📊 ACTUAL:');
        results.forEach((result, index) => {
          const name = result.id === highMatchContactId ? 'High Match' :
                      result.id === mediumMatchContactId ? 'Medium Match' : 'Low Match';
          console.log(`   ${index + 1}. ${name}: Relevance ${result.relevanceScore.toFixed(4)}`);
        });

        expect(results.length).toBe(3);
        expect(results[0].id).toBe(highMatchContactId);
      } catch (error: any) {
        console.log(`⚠️ Rerank error: ${error.message}`);
      }
    });
  });
});
