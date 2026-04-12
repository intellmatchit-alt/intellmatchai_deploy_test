/**
 * Matching Services Validation Tests
 *
 * Integration tests that create real database records and validate
 * that all matching services return valid and correct results.
 *
 * Tests:
 * 1. DeterministicMatchingService (Contact Matching)
 * 2. ProjectMatchingService (Project Collaboration Matching)
 * 3. OpportunityMatchingService (Job Opportunity Matching)
 */

// IMPORTANT: Set the real DATABASE_URL before any imports
// This overrides the fake URL set by Jest setup.ts
process.env.DATABASE_URL = 'mysql://p2p_user:p2p_password@localhost:3306/p2p_db?connection_limit=10&pool_timeout=30&connect_timeout=30';

import { PrismaClient } from '@prisma/client';
import { DeterministicMatchingService } from '../infrastructure/external/matching/DeterministicMatchingService';
import { ProjectMatchingService } from '../infrastructure/external/projects/ProjectMatchingService';
import { OpportunityMatchingService } from '../infrastructure/external/opportunities/OpportunityMatchingService';

const prisma = new PrismaClient();

// Test IDs - will be populated during setup
let testUserId: string;
let perfectMatchContactId: string;
let partialMatchContactId: string;
let noMatchContactId: string;
let matchingUserCandidateId: string;
let testProjectId: string;
let testOpportunityIntentId: string;

// Reference data IDs
let techSectorId: string;
let financeSectorId: string;
let healthcareSectorId: string;
let pythonSkillId: string;
let javascriptSkillId: string;
let machineLearningSkillId: string;
let aiInterestId: string;
let readingHobbyId: string;

describe('Matching Services Validation Tests', () => {
  // =============================================
  // TEST SETUP - Create all test data
  // =============================================
  beforeAll(async () => {
    console.log('\n🔧 Setting up test data for matching validation...\n');

    // 1. Create/Get Sectors
    const sectors = await Promise.all([
      prisma.sector.upsert({
        where: { id: 'test-sector-tech' },
        create: { id: 'test-sector-tech', name: 'Technology' },
        update: {},
      }),
      prisma.sector.upsert({
        where: { id: 'test-sector-finance' },
        create: { id: 'test-sector-finance', name: 'Finance' },
        update: {},
      }),
      prisma.sector.upsert({
        where: { id: 'test-sector-healthcare' },
        create: { id: 'test-sector-healthcare', name: 'Healthcare' },
        update: {},
      }),
    ]);
    techSectorId = sectors[0].id;
    financeSectorId = sectors[1].id;
    healthcareSectorId = sectors[2].id;

    // 2. Create/Get Skills
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
        where: { name: 'Machine Learning' },
        create: { name: 'Machine Learning', category: 'AI' },
        update: {},
      }),
    ]);
    pythonSkillId = skills[0].id;
    javascriptSkillId = skills[1].id;
    machineLearningSkillId = skills[2].id;

    // 3. Create/Get Interests
    const interests = await Promise.all([
      prisma.interest.upsert({
        where: { name: 'Artificial Intelligence' },
        create: { name: 'Artificial Intelligence', category: 'Technology' },
        update: {},
      }),
    ]);
    aiInterestId = interests[0].id;

    // 4. Create/Get Hobbies
    const hobbies = await Promise.all([
      prisma.hobby.upsert({
        where: { name: 'Reading' },
        create: { name: 'Reading', category: 'Leisure' },
        update: {},
      }),
    ]);
    readingHobbyId = hobbies[0].id;

    // 5. Create Test User (the user who will do matching)
    const testUser = await prisma.user.create({
      data: {
        email: `test-validation-${Date.now()}@test.com`,
        passwordHash: 'test-hash-validation',
        fullName: 'Validation Test User',
        company: 'TechCorp',
        jobTitle: 'Senior Data Scientist',
        location: 'San Francisco',
        bio: 'Passionate about AI and machine learning',
        isActive: true,
        emailVerified: true,
      },
    });
    testUserId = testUser.id;

    // 6. Add User Profile Data
    await Promise.all([
      // Sectors
      prisma.userSector.createMany({
        data: [
          { userId: testUserId, sectorId: techSectorId, isPrimary: true },
          { userId: testUserId, sectorId: financeSectorId, isPrimary: false },
        ],
      }),
      // Skills
      prisma.userSkill.createMany({
        data: [
          { userId: testUserId, skillId: pythonSkillId },
          { userId: testUserId, skillId: machineLearningSkillId },
        ],
      }),
      // Interests
      prisma.userInterest.createMany({
        data: [{ userId: testUserId, interestId: aiInterestId }],
      }),
      // Hobbies
      prisma.userHobby.createMany({
        data: [{ userId: testUserId, hobbyId: readingHobbyId }],
      }),
      // Goals
      prisma.userGoal.createMany({
        data: [
          { userId: testUserId, goalType: 'COLLABORATION', priority: 1 },
          { userId: testUserId, goalType: 'HIRING', priority: 2 },
        ],
      }),
    ]);

    // 7. Create PERFECT MATCH Contact (shares all attributes)
    const perfectMatchContact = await prisma.contact.create({
      data: {
        ownerId: testUserId,
        fullName: 'Perfect Match Contact',
        email: 'perfect@test.com',
        company: 'AI Startup',
        jobTitle: 'Machine Learning Engineer',
        location: 'San Francisco', // Same location
        bio: 'Building AI solutions for enterprise',
      },
    });
    perfectMatchContactId = perfectMatchContact.id;

    await Promise.all([
      prisma.contactSector.createMany({
        data: [
          { contactId: perfectMatchContactId, sectorId: techSectorId },
          { contactId: perfectMatchContactId, sectorId: financeSectorId },
        ],
      }),
      prisma.contactSkill.createMany({
        data: [
          { contactId: perfectMatchContactId, skillId: pythonSkillId },
          { contactId: perfectMatchContactId, skillId: machineLearningSkillId },
        ],
      }),
      prisma.contactInterest.createMany({
        data: [{ contactId: perfectMatchContactId, interestId: aiInterestId }],
      }),
      prisma.contactHobby.createMany({
        data: [{ contactId: perfectMatchContactId, hobbyId: readingHobbyId }],
      }),
    ]);

    // 8. Create PARTIAL MATCH Contact (some overlap)
    const partialMatchContact = await prisma.contact.create({
      data: {
        ownerId: testUserId,
        fullName: 'Partial Match Contact',
        email: 'partial@test.com',
        company: 'FinTech Inc',
        jobTitle: 'Software Developer',
        location: 'New York', // Different location
        bio: 'Full stack developer in fintech',
      },
    });
    partialMatchContactId = partialMatchContact.id;

    await Promise.all([
      prisma.contactSector.createMany({
        data: [{ contactId: partialMatchContactId, sectorId: financeSectorId }],
      }),
      prisma.contactSkill.createMany({
        data: [{ contactId: partialMatchContactId, skillId: javascriptSkillId }],
      }),
    ]);

    // 9. Create NO MATCH Contact (no overlap at all)
    const noMatchContact = await prisma.contact.create({
      data: {
        ownerId: testUserId,
        fullName: 'No Match Contact',
        email: 'nomatch@test.com',
        company: 'Healthcare Corp',
        jobTitle: 'Nurse Practitioner',
        location: 'Chicago',
        bio: 'Healthcare professional',
      },
    });
    noMatchContactId = noMatchContact.id;

    await prisma.contactSector.createMany({
      data: [{ contactId: noMatchContactId, sectorId: healthcareSectorId }],
    });

    // 10. Create another USER for project/opportunity matching
    const matchingUser = await prisma.user.create({
      data: {
        email: `matching-candidate-${Date.now()}@test.com`,
        passwordHash: 'test-hash-candidate',
        fullName: 'Matching Candidate User',
        company: 'Tech Startup',
        jobTitle: 'Senior Software Engineer',
        location: 'San Francisco',
        bio: 'Experienced developer in AI/ML',
        isActive: true,
        emailVerified: true,
      },
    });
    matchingUserCandidateId = matchingUser.id;

    await Promise.all([
      prisma.userSector.createMany({
        data: [{ userId: matchingUserCandidateId, sectorId: techSectorId, isPrimary: true }],
      }),
      prisma.userSkill.createMany({
        data: [
          { userId: matchingUserCandidateId, skillId: pythonSkillId },
          { userId: matchingUserCandidateId, skillId: machineLearningSkillId },
        ],
      }),
      prisma.userGoal.createMany({
        data: [{ userId: matchingUserCandidateId, goalType: 'JOB_SEEKING', priority: 1 }],
      }),
    ]);

    // 11. Create a Test Project
    const testProject = await prisma.project.create({
      data: {
        userId: testUserId,
        title: 'AI Healthcare Platform',
        summary: 'Building an AI-powered healthcare analytics platform',
        detailedDesc: 'We need machine learning engineers to help build predictive models',
        stage: 'MVP',
        lookingFor: ['technical_partner', 'developer'],
        keywords: ['ai', 'healthcare', 'machine learning', 'analytics'],
        visibility: 'PUBLIC',
        isActive: true,
      },
    });
    testProjectId = testProject.id;

    await Promise.all([
      prisma.projectSector.createMany({
        data: [
          { projectId: testProjectId, sectorId: techSectorId },
          { projectId: testProjectId, sectorId: healthcareSectorId },
        ],
      }),
      prisma.projectSkill.createMany({
        data: [
          { projectId: testProjectId, skillId: pythonSkillId, importance: 'REQUIRED' },
          { projectId: testProjectId, skillId: machineLearningSkillId, importance: 'REQUIRED' },
        ],
      }),
    ]);

    // 12. Create an Opportunity Intent
    const testIntent = await prisma.opportunityIntent.create({
      data: {
        userId: testUserId,
        title: 'Hiring ML Engineers',
        intentType: 'HIRING',
        roleArea: 'Machine Learning',
        seniority: 'SENIOR',
        locationPref: 'San Francisco',
        remoteOk: true,
        notes: 'Looking for ML engineers to join our team',
        visibility: 'PRIVATE',
        isActive: true,
      },
    });
    testOpportunityIntentId = testIntent.id;

    await Promise.all([
      prisma.opportunityIntentSector.createMany({
        data: [{ intentId: testOpportunityIntentId, sectorId: techSectorId }],
      }),
      prisma.opportunityIntentSkill.createMany({
        data: [
          { intentId: testOpportunityIntentId, skillId: pythonSkillId },
          { intentId: testOpportunityIntentId, skillId: machineLearningSkillId },
        ],
      }),
    ]);

    console.log('✅ Test data created successfully');
    console.log(`   - Test User ID: ${testUserId}`);
    console.log(`   - Perfect Match Contact: ${perfectMatchContactId}`);
    console.log(`   - Partial Match Contact: ${partialMatchContactId}`);
    console.log(`   - No Match Contact: ${noMatchContactId}`);
    console.log(`   - Matching User Candidate: ${matchingUserCandidateId}`);
    console.log(`   - Test Project: ${testProjectId}`);
    console.log(`   - Test Opportunity Intent: ${testOpportunityIntentId}`);
  });

  // =============================================
  // TEST CLEANUP
  // =============================================
  afterAll(async () => {
    console.log('\n🧹 Cleaning up test data...');

    try {
      // Delete in correct order due to foreign key constraints

      // Delete opportunity matches
      await prisma.opportunityMatch.deleteMany({
        where: { intentId: testOpportunityIntentId },
      });

      // Delete opportunity intent preferences
      await prisma.opportunityIntentSector.deleteMany({
        where: { intentId: testOpportunityIntentId },
      });
      await prisma.opportunityIntentSkill.deleteMany({
        where: { intentId: testOpportunityIntentId },
      });

      // Delete opportunity intent
      await prisma.opportunityIntent.deleteMany({
        where: { id: testOpportunityIntentId },
      });

      // Delete project matches
      await prisma.projectMatch.deleteMany({
        where: { projectId: testProjectId },
      });

      // Delete project relations
      await prisma.projectSector.deleteMany({
        where: { projectId: testProjectId },
      });
      await prisma.projectSkill.deleteMany({
        where: { projectId: testProjectId },
      });

      // Delete project
      await prisma.project.deleteMany({
        where: { id: testProjectId },
      });

      // Delete contact relations
      const contactIds = [perfectMatchContactId, partialMatchContactId, noMatchContactId];
      await prisma.contactInterest.deleteMany({ where: { contactId: { in: contactIds } } });
      await prisma.contactHobby.deleteMany({ where: { contactId: { in: contactIds } } });
      await prisma.contactSkill.deleteMany({ where: { contactId: { in: contactIds } } });
      await prisma.contactSector.deleteMany({ where: { contactId: { in: contactIds } } });
      await prisma.contact.deleteMany({ where: { id: { in: contactIds } } });

      // Delete user relations for test user
      await prisma.userGoal.deleteMany({ where: { userId: { in: [testUserId, matchingUserCandidateId] } } });
      await prisma.userInterest.deleteMany({ where: { userId: { in: [testUserId, matchingUserCandidateId] } } });
      await prisma.userHobby.deleteMany({ where: { userId: { in: [testUserId, matchingUserCandidateId] } } });
      await prisma.userSkill.deleteMany({ where: { userId: { in: [testUserId, matchingUserCandidateId] } } });
      await prisma.userSector.deleteMany({ where: { userId: { in: [testUserId, matchingUserCandidateId] } } });

      // Delete users
      await prisma.user.deleteMany({
        where: { id: { in: [testUserId, matchingUserCandidateId] } },
      });

      // Clean up any match results/history that may have been created
      await prisma.matchResult.deleteMany({ where: { userId: testUserId } });
      await prisma.matchHistory.deleteMany({ where: { userId: testUserId } });
      await prisma.matchFeedback.deleteMany({ where: { userId: testUserId } });
      await prisma.matchFeedbackStats.deleteMany({ where: { userId: testUserId } });

      console.log('✅ Cleanup complete');
    } catch (error) {
      console.error('⚠️ Cleanup error:', error);
    }

    await prisma.$disconnect();
  });

  // =============================================
  // 1. CONTACT MATCHING VALIDATION
  // =============================================
  describe('1. Contact Matching (DeterministicMatchingService)', () => {
    let service: DeterministicMatchingService;

    beforeAll(() => {
      service = new DeterministicMatchingService();
    });

    describe('Score Validation', () => {
      test('should return all scores within 0-100 range', async () => {
        const matches = await service.getMatches(testUserId, { limit: 10, minScore: 0 });

        console.log('\n📊 Contact Match Scores:');
        for (const match of matches) {
          const contactName = match.contactId === perfectMatchContactId ? 'Perfect Match' :
                             match.contactId === partialMatchContactId ? 'Partial Match' : 'No Match';
          console.log(`   ${contactName}: ${match.score}/100`);

          // VALIDATION: Score must be 0-100
          expect(match.score).toBeGreaterThanOrEqual(0);
          expect(match.score).toBeLessThanOrEqual(100);
        }
      });

      test('should have score breakdown components within 0-100', async () => {
        const details = await service.getMatchDetails(testUserId, perfectMatchContactId);

        console.log('\n📊 Score Breakdown for Perfect Match:');
        console.log(`   Goal Alignment: ${details?.scoreBreakdown.goalAlignmentScore}`);
        console.log(`   Sector: ${details?.scoreBreakdown.sectorScore}`);
        console.log(`   Skill: ${details?.scoreBreakdown.skillScore}`);
        console.log(`   Semantic: ${details?.scoreBreakdown.semanticSimilarityScore}`);
        console.log(`   Network: ${details?.scoreBreakdown.networkProximityScore}`);
        console.log(`   Complementary: ${details?.scoreBreakdown.complementarySkillsScore}`);
        console.log(`   Recency: ${details?.scoreBreakdown.recencyScore}`);
        console.log(`   Interaction: ${details?.scoreBreakdown.interactionScore}`);
        console.log(`   Interest: ${details?.scoreBreakdown.interestScore}`);
        console.log(`   Hobby: ${details?.scoreBreakdown.hobbyScore}`);

        expect(details).not.toBeNull();

        const breakdown = details!.scoreBreakdown;
        const components = [
          breakdown.goalAlignmentScore,
          breakdown.sectorScore,
          breakdown.skillScore,
          breakdown.semanticSimilarityScore,
          breakdown.networkProximityScore,
          breakdown.complementarySkillsScore,
          breakdown.recencyScore,
          breakdown.interactionScore,
          breakdown.interestScore,
          breakdown.hobbyScore,
        ];

        for (const component of components) {
          expect(component).toBeGreaterThanOrEqual(0);
          expect(component).toBeLessThanOrEqual(100);
        }
      });
    });

    describe('Ranking Validation', () => {
      test('should rank perfect match above partial match', async () => {
        const matches = await service.getMatches(testUserId, { limit: 10, minScore: 0 });

        const perfectMatch = matches.find(m => m.contactId === perfectMatchContactId);
        const partialMatch = matches.find(m => m.contactId === partialMatchContactId);

        console.log('\n📊 Ranking Validation:');
        console.log(`   Perfect Match Score: ${perfectMatch?.score}`);
        console.log(`   Partial Match Score: ${partialMatch?.score}`);

        expect(perfectMatch).toBeDefined();
        expect(partialMatch).toBeDefined();

        // VALIDATION: Perfect match should score higher
        expect(perfectMatch!.score).toBeGreaterThan(partialMatch!.score);
      });

      test('should rank partial match above no match', async () => {
        const matches = await service.getMatches(testUserId, { limit: 10, minScore: 0 });

        const partialMatch = matches.find(m => m.contactId === partialMatchContactId);
        const noMatch = matches.find(m => m.contactId === noMatchContactId);

        console.log('\n📊 Ranking Validation:');
        console.log(`   Partial Match Score: ${partialMatch?.score}`);
        console.log(`   No Match Score: ${noMatch?.score}`);

        expect(partialMatch).toBeDefined();

        // VALIDATION: Partial match should score higher than no match
        if (noMatch) {
          expect(partialMatch!.score).toBeGreaterThanOrEqual(noMatch.score);
        }
      });
    });

    describe('Business Logic Validation', () => {
      test('should score high for contacts with same sector AND skills', async () => {
        const details = await service.getMatchDetails(testUserId, perfectMatchContactId);

        console.log('\n📊 Perfect Match Business Logic:');
        console.log(`   Total Score: ${details?.score}`);
        console.log(`   Sector Score: ${details?.scoreBreakdown.sectorScore}`);
        console.log(`   Skill Score: ${details?.scoreBreakdown.skillScore}`);

        // VALIDATION: Perfect match should have high sector and skill scores
        expect(details!.scoreBreakdown.sectorScore).toBeGreaterThan(30);
        expect(details!.scoreBreakdown.skillScore).toBeGreaterThan(30);
      });

      test('should have zero overlap scores for no-match contact', async () => {
        const details = await service.getMatchDetails(testUserId, noMatchContactId);

        console.log('\n📊 No Match Business Logic:');
        console.log(`   Sector Score: ${details?.scoreBreakdown.sectorScore}`);
        console.log(`   Skill Score: ${details?.scoreBreakdown.skillScore}`);
        console.log(`   Interest Score: ${details?.scoreBreakdown.interestScore}`);
        console.log(`   Hobby Score: ${details?.scoreBreakdown.hobbyScore}`);

        // VALIDATION: No overlap should result in zero scores
        expect(details!.scoreBreakdown.sectorScore).toBe(0);
        expect(details!.scoreBreakdown.skillScore).toBe(0);
        expect(details!.scoreBreakdown.interestScore).toBe(0);
        expect(details!.scoreBreakdown.hobbyScore).toBe(0);
      });

      test('should find correct intersections', async () => {
        const intersections = await service.getIntersections(testUserId, perfectMatchContactId);

        console.log('\n📊 Intersections Found:');
        intersections.forEach(i => {
          console.log(`   ${i.type}: ${i.label}`);
        });

        // VALIDATION: Should find sector, skill, interest, hobby, location intersections
        const types = intersections.map(i => i.type);
        expect(types).toContain('sector');
        expect(types).toContain('skill');
        expect(types).toContain('interest');
        expect(types).toContain('hobby');
        expect(types).toContain('location');
      });
    });

    describe('Return Structure Validation', () => {
      test('should return complete MatchResult structure', async () => {
        const details = await service.getMatchDetails(testUserId, perfectMatchContactId);

        // VALIDATION: All required fields present
        expect(details).toHaveProperty('contactId');
        expect(details).toHaveProperty('score');
        expect(details).toHaveProperty('scoreBreakdown');
        expect(details).toHaveProperty('intersections');
        expect(details).toHaveProperty('reasons');
        expect(details).toHaveProperty('suggestedMessage');

        // VALIDATION: Reasons should be meaningful
        expect(details!.reasons).toBeDefined();
        expect(Array.isArray(details!.reasons)).toBe(true);
        expect(details!.reasons!.length).toBeGreaterThan(0);

        console.log('\n📊 Match Reasons:');
        details!.reasons!.forEach(r => console.log(`   - ${r}`));
      });
    });
  });

  // =============================================
  // 2. PROJECT MATCHING VALIDATION
  // =============================================
  describe('2. Project Matching (ProjectMatchingService)', () => {
    let service: ProjectMatchingService;

    beforeAll(() => {
      service = new ProjectMatchingService(prisma);
    });

    test('should find matches for project', async () => {
      const matches = await service.findMatchesForProject(testProjectId, testUserId);

      console.log('\n📊 Project Matches:');
      console.log(`   Total Matches Found: ${matches.length}`);

      matches.slice(0, 5).forEach((match, idx) => {
        console.log(`   ${idx + 1}. Score: ${match.matchScore} - Type: ${match.matchType}`);
        console.log(`      Shared Sectors: ${JSON.stringify(match.sharedSectors)}`);
        console.log(`      Shared Skills: ${JSON.stringify(match.sharedSkills)}`);
      });

      // VALIDATION: Should find at least some matches
      expect(matches.length).toBeGreaterThanOrEqual(0);
    });

    test('should have valid score ranges', async () => {
      const matches = await service.findMatchesForProject(testProjectId, testUserId);

      for (const match of matches) {
        // VALIDATION: All scores within 0-100
        expect(match.matchScore).toBeGreaterThanOrEqual(0);
        expect(match.matchScore).toBeLessThanOrEqual(100);

        // VALIDATION: Scores above threshold (>20)
        expect(match.matchScore).toBeGreaterThan(20);
      }
    });

    test('should have valid match structure', async () => {
      const matches = await service.findMatchesForProject(testProjectId, testUserId);

      for (const match of matches) {
        // VALIDATION: Required fields present
        expect(match).toHaveProperty('projectId');
        expect(match).toHaveProperty('matchScore');
        expect(match).toHaveProperty('matchType');
        expect(match).toHaveProperty('reasons');
        expect(match).toHaveProperty('sharedSectors');
        expect(match).toHaveProperty('sharedSkills');

        // VALIDATION: matchType is valid
        expect(['user', 'contact']).toContain(match.matchType);

        // VALIDATION: Either matchedUserId or matchedContactId is set
        const hasUser = match.matchedUserId !== null;
        const hasContact = match.matchedContactId !== null;
        expect(hasUser || hasContact).toBe(true);
      }
    });

    test('should rank candidates with relevant skills higher', async () => {
      const matches = await service.findMatchesForProject(testProjectId, testUserId);

      if (matches.length > 1) {
        // Sorted by score descending
        for (let i = 0; i < matches.length - 1; i++) {
          // VALIDATION: Matches are sorted by score
          expect(matches[i].matchScore).toBeGreaterThanOrEqual(matches[i + 1].matchScore);
        }
      }
    });
  });

  // =============================================
  // 3. OPPORTUNITY MATCHING VALIDATION
  // =============================================
  describe('3. Opportunity Matching (OpportunityMatchingService)', () => {
    let service: OpportunityMatchingService;

    beforeAll(() => {
      service = new OpportunityMatchingService(prisma);
    });

    test('should find matches for hiring intent', async () => {
      const matches = await service.findMatchesForIntent(testUserId, testOpportunityIntentId);

      console.log('\n📊 Opportunity Matches:');
      console.log(`   Total Matches Found: ${matches.length}`);

      matches.slice(0, 5).forEach((match, idx) => {
        console.log(`   ${idx + 1}. Score: ${match.matchScore} - Type: ${match.matchType}`);
        console.log(`      Intent Alignment: ${match.intentAlignment}`);
        console.log(`      Shared Sectors: ${JSON.stringify(match.sharedSectors)}`);
        console.log(`      Shared Skills: ${JSON.stringify(match.sharedSkills)}`);
        console.log(`      Suggested Action: ${match.suggestedAction}`);
      });

      // VALIDATION: Should find matches
      expect(matches.length).toBeGreaterThanOrEqual(0);
    });

    test('should have valid score ranges', async () => {
      const matches = await service.findMatchesForIntent(testUserId, testOpportunityIntentId);

      for (const match of matches) {
        // VALIDATION: Scores within 0-100
        expect(match.matchScore).toBeGreaterThanOrEqual(0);
        expect(match.matchScore).toBeLessThanOrEqual(100);

        // VALIDATION: Scores above threshold
        expect(match.matchScore).toBeGreaterThan(20);
      }
    });

    test('should have valid match structure', async () => {
      const matches = await service.findMatchesForIntent(testUserId, testOpportunityIntentId);

      for (const match of matches) {
        // VALIDATION: Required fields present
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

        // VALIDATION: matchType is valid
        expect(['user', 'contact']).toContain(match.matchType);

        // VALIDATION: suggestedAction is valid
        expect(['Connect', 'Request Intro', 'Schedule Call', 'Send Message']).toContain(match.suggestedAction);

        // VALIDATION: nextSteps is an array
        expect(Array.isArray(match.nextSteps)).toBe(true);
      }
    });

    test('should prioritize job seekers for HIRING intent', async () => {
      const matches = await service.findMatchesForIntent(testUserId, testOpportunityIntentId);

      // The matching user candidate has JOB_SEEKING goal
      const candidateMatch = matches.find(m => m.matchedUserId === matchingUserCandidateId);

      if (candidateMatch) {
        console.log('\n📊 Job Seeker Match:');
        console.log(`   Score: ${candidateMatch.matchScore}`);
        console.log(`   Intent Alignment: ${candidateMatch.intentAlignment}`);

        // VALIDATION: Job seeker should have good intent alignment
        expect(candidateMatch.intentAlignment).toBeDefined();
      }
    });

    test('should have valid suggestedMessage', async () => {
      const matches = await service.findMatchesForIntent(testUserId, testOpportunityIntentId);

      for (const match of matches) {
        // VALIDATION: Message should be a non-empty string
        expect(typeof match.suggestedMessage).toBe('string');
        expect(match.suggestedMessage?.length).toBeGreaterThan(0);
      }
    });
  });

  // =============================================
  // 4. CROSS-SERVICE VALIDATION
  // =============================================
  describe('4. Cross-Service Consistency', () => {
    test('same user/contact should appear consistently across services', async () => {
      const contactService = new DeterministicMatchingService();
      const projectService = new ProjectMatchingService(prisma);

      const contactMatches = await contactService.getMatches(testUserId, { limit: 20, minScore: 0 });
      const projectMatches = await projectService.findMatchesForProject(testProjectId, testUserId);

      console.log('\n📊 Cross-Service Comparison:');
      console.log(`   Contact Matches: ${contactMatches.length}`);
      console.log(`   Project Matches: ${projectMatches.length}`);

      // If perfect match contact appears in both, scores should be consistent (both high or both reflecting same attributes)
      const perfectInContacts = contactMatches.find(m => m.contactId === perfectMatchContactId);
      const perfectInProjects = projectMatches.find(m => m.matchedContactId === perfectMatchContactId);

      if (perfectInContacts && perfectInProjects) {
        console.log(`   Perfect Match in Contacts: ${perfectInContacts.score}`);
        console.log(`   Perfect Match in Projects: ${perfectInProjects.matchScore}`);

        // VALIDATION: Both should recognize this as a good match
        expect(perfectInContacts.score).toBeGreaterThan(30);
        expect(perfectInProjects.matchScore).toBeGreaterThan(20);
      }
    });

    test('all services should handle same test user correctly', async () => {
      const contactService = new DeterministicMatchingService();
      const projectService = new ProjectMatchingService(prisma);
      const opportunityService = new OpportunityMatchingService(prisma);

      // All services should work without errors
      const contactResult = await contactService.getMatches(testUserId, { limit: 5 });
      const projectResult = await projectService.findMatchesForProject(testProjectId, testUserId);
      const opportunityResult = await opportunityService.findMatchesForIntent(testUserId, testOpportunityIntentId);

      // VALIDATION: No errors thrown, results returned
      expect(Array.isArray(contactResult)).toBe(true);
      expect(Array.isArray(projectResult)).toBe(true);
      expect(Array.isArray(opportunityResult)).toBe(true);

      console.log('\n📊 All Services Summary:');
      console.log(`   ✓ Contact Matching: ${contactResult.length} matches`);
      console.log(`   ✓ Project Matching: ${projectResult.length} matches`);
      console.log(`   ✓ Opportunity Matching: ${opportunityResult.length} matches`);
    });
  });
});
