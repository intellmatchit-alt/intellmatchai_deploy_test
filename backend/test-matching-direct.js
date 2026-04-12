/**
 * Direct Matching Test Script
 * Run with: node test-matching-direct.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test data IDs
let testUserId;
let highMatchContactId;
let mediumMatchContactId;
let lowMatchContactId;

async function setupTestData() {
  console.log('\n📊 Setting up test data...\n');

  // Get existing sectors
  const techSector = await prisma.sector.findFirst({ where: { name: { contains: 'Technology' } } }) ||
                     await prisma.sector.findFirst({ where: { name: { contains: 'Artificial' } } });
  const financeSector = await prisma.sector.findFirst({ where: { name: { contains: 'Finance' } } });
  const healthcareSector = await prisma.sector.findFirst({ where: { name: { contains: 'Health' } } }) ||
                           await prisma.sector.findFirst({ where: { name: { contains: 'Education' } } });

  if (!techSector || !financeSector) {
    console.log('❌ Required sectors not found. Using first 3 available sectors.');
    const sectors = await prisma.sector.findMany({ take: 3 });
    if (sectors.length < 3) {
      console.log('❌ Not enough sectors in database');
      return false;
    }
  }

  const sectors = await prisma.sector.findMany({ take: 3 });
  const techSectorId = sectors[0]?.id;
  const financeSectorId = sectors[1]?.id;
  const healthcareSectorId = sectors[2]?.id;

  // Get existing skills
  const skills = await prisma.skill.findMany({ take: 3 });
  const skill1Id = skills[0]?.id;
  const skill2Id = skills[1]?.id;
  const skill3Id = skills[2]?.id;

  // Get existing interests
  const interests = await prisma.interest.findMany({ take: 2 });
  const interest1Id = interests[0]?.id;
  const interest2Id = interests[1]?.id;

  console.log(`Using sectors: ${sectors.map(s => s.name).join(', ')}`);
  console.log(`Using skills: ${skills.map(s => s.name).join(', ')}`);
  console.log(`Using interests: ${interests.map(i => i.name).join(', ')}`);

  // Create test user
  const testUser = await prisma.user.create({
    data: {
      email: `test-matching-${Date.now()}@test.com`,
      passwordHash: 'test-hash-12345',
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
  if (techSectorId) await prisma.userSector.create({ data: { userId: testUserId, sectorId: techSectorId, isPrimary: true } });
  if (financeSectorId) await prisma.userSector.create({ data: { userId: testUserId, sectorId: financeSectorId } });

  // Add user skills
  if (skill1Id) await prisma.userSkill.create({ data: { userId: testUserId, skillId: skill1Id } });
  if (skill2Id) await prisma.userSkill.create({ data: { userId: testUserId, skillId: skill2Id } });

  // Add user interests
  if (interest1Id) await prisma.userInterest.create({ data: { userId: testUserId, interestId: interest1Id } });

  // Add user goals
  await prisma.userGoal.create({ data: { userId: testUserId, goalType: 'COLLABORATION', priority: 1 } });

  // Create HIGH MATCH contact (same sector, skills, interests)
  const highMatchContact = await prisma.contact.create({
    data: {
      ownerId: testUserId,
      fullName: 'Sarah Chen - High Match',
      email: 'sarah.chen@aicompany.com',
      company: 'AI Innovations Inc',
      jobTitle: 'Machine Learning Engineer',
      location: 'San Francisco',
      bio: 'Building cutting-edge AI solutions, passionate about data science and ML',
    },
  });
  highMatchContactId = highMatchContact.id;

  if (techSectorId) await prisma.contactSector.create({ data: { contactId: highMatchContactId, sectorId: techSectorId } });
  if (financeSectorId) await prisma.contactSector.create({ data: { contactId: highMatchContactId, sectorId: financeSectorId } });
  if (skill1Id) await prisma.contactSkill.create({ data: { contactId: highMatchContactId, skillId: skill1Id } });
  if (skill2Id) await prisma.contactSkill.create({ data: { contactId: highMatchContactId, skillId: skill2Id } });
  if (interest1Id) await prisma.contactInterest.create({ data: { contactId: highMatchContactId, interestId: interest1Id } });

  // Create MEDIUM MATCH contact (some overlap)
  const mediumMatchContact = await prisma.contact.create({
    data: {
      ownerId: testUserId,
      fullName: 'Michael Johnson - Medium Match',
      email: 'michael.j@fintech.com',
      company: 'FinTech Solutions',
      jobTitle: 'Software Developer',
      location: 'New York',
      bio: 'Full stack developer interested in financial technology',
    },
  });
  mediumMatchContactId = mediumMatchContact.id;

  if (financeSectorId) await prisma.contactSector.create({ data: { contactId: mediumMatchContactId, sectorId: financeSectorId } });
  if (skill3Id) await prisma.contactSkill.create({ data: { contactId: mediumMatchContactId, skillId: skill3Id } });

  // Create LOW MATCH contact (no overlap)
  const lowMatchContact = await prisma.contact.create({
    data: {
      ownerId: testUserId,
      fullName: 'Emily Davis - Low Match',
      email: 'emily.d@healthcare.org',
      company: 'City Hospital',
      jobTitle: 'Registered Nurse',
      location: 'Miami',
      bio: 'Dedicated healthcare professional with 10 years experience',
    },
  });
  lowMatchContactId = lowMatchContact.id;

  if (healthcareSectorId) await prisma.contactSector.create({ data: { contactId: lowMatchContactId, sectorId: healthcareSectorId } });

  console.log('\n✅ Test data created:');
  console.log(`   Test User: ${testUser.fullName} (${testUserId})`);
  console.log(`   High Match: Sarah Chen (${highMatchContactId})`);
  console.log(`   Medium Match: Michael Johnson (${mediumMatchContactId})`);
  console.log(`   Low Match: Emily Davis (${lowMatchContactId})`);

  return true;
}

async function testDeterministicMatching() {
  console.log('\n' + '='.repeat(60));
  console.log('🔬 TEST 1: DeterministicMatchingService');
  console.log('='.repeat(60));

  const { DeterministicMatchingService } = require('./dist/infrastructure/external/matching/DeterministicMatchingService');
  const service = new DeterministicMatchingService();

  console.log('\n📊 EXPECTED RESULTS:');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ Contact             │ Expected Score │ Reason           │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Sarah (High Match)  │ 70-100         │ Same sector,     │');
  console.log('│                     │                │ skills, interest │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Michael (Medium)    │ 30-60          │ Partial overlap  │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Emily (Low Match)   │ 0-30           │ No overlap       │');
  console.log('└─────────────────────────────────────────────────────────┘');

  try {
    const matches = await service.getMatches(testUserId, { limit: 10, minScore: 0 });

    console.log('\n📊 ACTUAL RESULTS:');
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ Rank │ Contact              │ Score │ Top Reasons               │');
    console.log('├─────────────────────────────────────────────────────────────────┤');

    matches.forEach((match, index) => {
      let contactName = 'Unknown';
      if (match.contactId === highMatchContactId) contactName = 'Sarah (High)';
      else if (match.contactId === mediumMatchContactId) contactName = 'Michael (Medium)';
      else if (match.contactId === lowMatchContactId) contactName = 'Emily (Low)';

      const reasons = (match.reasons || []).slice(0, 2).join(', ').substring(0, 25);
      console.log(`│ ${index + 1}    │ ${contactName.padEnd(20)} │ ${String(match.score).padStart(5)} │ ${reasons.padEnd(25)} │`);
    });
    console.log('└─────────────────────────────────────────────────────────────────┘');

    // Validate
    const highMatch = matches.find(m => m.contactId === highMatchContactId);
    const mediumMatch = matches.find(m => m.contactId === mediumMatchContactId);
    const lowMatch = matches.find(m => m.contactId === lowMatchContactId);

    console.log('\n✅ VALIDATION:');
    console.log(`   High Match found: ${highMatch ? '✓' : '✗'} (Score: ${highMatch?.score || 'N/A'})`);
    console.log(`   High > Medium: ${highMatch && mediumMatch && highMatch.score > mediumMatch.score ? '✓' : '✗'}`);
    console.log(`   Medium >= Low: ${mediumMatch && lowMatch && mediumMatch.score >= lowMatch.score ? '✓' : '✗'}`);

    return matches;
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return [];
  }
}

async function testMatchDetails() {
  console.log('\n' + '='.repeat(60));
  console.log('🔬 TEST 2: getMatchDetails (Score Breakdown)');
  console.log('='.repeat(60));

  const { DeterministicMatchingService } = require('./dist/infrastructure/external/matching/DeterministicMatchingService');
  const service = new DeterministicMatchingService();

  console.log('\n📊 EXPECTED: Detailed breakdown for High Match contact');
  console.log('   - sectorScore: > 0 (shared sectors)');
  console.log('   - skillScore: > 0 (shared skills)');
  console.log('   - interestScore: > 0 (shared interests)');

  try {
    const details = await service.getMatchDetails(testUserId, highMatchContactId);

    console.log('\n📊 ACTUAL SCORE BREAKDOWN:');
    if (details?.scoreBreakdown) {
      console.log('┌───────────────────────────────────────┐');
      console.log('│ Component              │ Score        │');
      console.log('├───────────────────────────────────────┤');
      Object.entries(details.scoreBreakdown).forEach(([key, value]) => {
        console.log(`│ ${key.padEnd(22)} │ ${String(value).padStart(12)} │`);
      });
      console.log('└───────────────────────────────────────┘');
      console.log(`\n   TOTAL SCORE: ${details.score}`);
    }

    if (details?.intersections?.length) {
      console.log('\n📊 INTERSECTIONS (Shared Attributes):');
      details.intersections.forEach(i => {
        console.log(`   ${i.type}: ${i.items?.join(', ') || 'None'}`);
      });
    }

    return details;
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return null;
  }
}

async function testCohereRerank() {
  console.log('\n' + '='.repeat(60));
  console.log('🔬 TEST 3: CohereRerankService');
  console.log('='.repeat(60));

  const { CohereRerankService } = require('./dist/infrastructure/external/rerank/CohereRerankService');
  const service = new CohereRerankService();

  const isAvailable = await service.isAvailable();
  console.log(`\n📊 Service Status: ${isAvailable ? '✅ Available' : '❌ Not Available'}`);

  if (!isAvailable) {
    console.log('   Skipping rerank test - service not configured');
    return;
  }

  const query = 'AI and machine learning expert for data science collaboration in San Francisco';
  const documents = [
    { id: 'high', text: 'Sarah Chen - Machine Learning Engineer at AI Innovations Inc, San Francisco. Building cutting-edge AI solutions, passionate about data science and ML.' },
    { id: 'medium', text: 'Michael Johnson - Software Developer at FinTech Solutions, New York. Full stack developer interested in financial technology.' },
    { id: 'low', text: 'Emily Davis - Registered Nurse at City Hospital, Miami. Dedicated healthcare professional with 10 years experience.' },
  ];

  console.log('\n📊 EXPECTED ORDER (by semantic relevance):');
  console.log('   1. Sarah (High) - AI/ML expert, same location');
  console.log('   2. Michael (Medium) - Tech background');
  console.log('   3. Emily (Low) - Healthcare, different field');

  try {
    const response = await service.rerank(query, documents);
    const results = response.results || [];

    console.log('\n📊 ACTUAL COHERE RERANK RESULTS:');
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│ Rank │ Contact         │ Relevance Score       │');
    console.log('├─────────────────────────────────────────────────┤');
    results.forEach((result, index) => {
      const name = result.id === 'high' ? 'Sarah (High)' :
                   result.id === 'medium' ? 'Michael (Medium)' : 'Emily (Low)';
      console.log(`│ ${index + 1}    │ ${name.padEnd(15)} │ ${result.relevanceScore.toFixed(6).padStart(21)} │`);
    });
    console.log('└─────────────────────────────────────────────────┘');
    console.log(`\n   Processing time: ${response.processingTimeMs}ms`);
    console.log(`   Model: ${response.model}`);

    console.log('\n✅ VALIDATION:');
    console.log(`   Sarah ranked first: ${results[0]?.id === 'high' ? '✓' : '✗'}`);
    console.log(`   Emily ranked last: ${results[results.length - 1]?.id === 'low' ? '✓' : '✗'}`);

    return results;
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return [];
  }
}

async function testFeedbackService() {
  console.log('\n' + '='.repeat(60));
  console.log('🔬 TEST 4: MatchFeedbackService');
  console.log('='.repeat(60));

  const { matchFeedbackService } = require('./dist/infrastructure/external/matching/MatchFeedbackService');

  console.log('\n📊 EXPECTED:');
  console.log('   - ACCEPT action → Positive feedback score (+20)');
  console.log('   - REJECT action → Negative feedback score (-15)');

  try {
    // Record positive feedback for high match
    await matchFeedbackService.recordFeedback({
      userId: testUserId,
      contactId: highMatchContactId,
      matchType: 'CONTACT',
      action: 'ACCEPT',
      matchScoreAtFeedback: 85,
    });

    // Record negative feedback for low match
    await matchFeedbackService.recordFeedback({
      userId: testUserId,
      contactId: lowMatchContactId,
      matchType: 'CONTACT',
      action: 'REJECT',
      matchScoreAtFeedback: 20,
    });

    const feedbackScores = await matchFeedbackService.getBulkFeedbackScores(
      testUserId,
      [highMatchContactId, mediumMatchContactId, lowMatchContactId]
    );

    console.log('\n📊 ACTUAL FEEDBACK SCORES:');
    console.log('┌───────────────────────────────────────────────┐');
    console.log('│ Contact              │ Feedback Score         │');
    console.log('├───────────────────────────────────────────────┤');
    console.log(`│ Sarah (High Match)   │ ${String(feedbackScores.get(highMatchContactId) || 0).padStart(22)} │`);
    console.log(`│ Michael (Medium)     │ ${String(feedbackScores.get(mediumMatchContactId) || 0).padStart(22)} │`);
    console.log(`│ Emily (Low Match)    │ ${String(feedbackScores.get(lowMatchContactId) || 0).padStart(22)} │`);
    console.log('└───────────────────────────────────────────────┘');

    // Test adjustment calculation
    console.log('\n📊 SCORE ADJUSTMENTS:');
    const adjustments = [50, 0, -30];
    adjustments.forEach(score => {
      const adj = matchFeedbackService.calculateFeedbackAdjustment(score);
      const effect = adj > 1 ? 'BOOST' : adj < 1 ? 'PENALTY' : 'NEUTRAL';
      console.log(`   Feedback ${score >= 0 ? '+' : ''}${score} → Multiplier ${adj.toFixed(2)} (${effect})`);
    });

    console.log('\n✅ VALIDATION:');
    const highFeedback = feedbackScores.get(highMatchContactId) || 0;
    const lowFeedback = feedbackScores.get(lowMatchContactId) || 0;
    console.log(`   High match has positive score: ${highFeedback > 0 ? '✓' : '✗'} (${highFeedback})`);
    console.log(`   Low match has negative score: ${lowFeedback < 0 ? '✓' : '✗'} (${lowFeedback})`);

    // Cleanup
    await prisma.matchFeedback.deleteMany({ where: { userId: testUserId } });
    await prisma.matchFeedbackStats.deleteMany({ where: { userId: testUserId } });

    return feedbackScores;
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return new Map();
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  try {
    // Delete in correct order due to foreign keys
    await prisma.matchFeedback.deleteMany({ where: { userId: testUserId } });
    await prisma.matchFeedbackStats.deleteMany({ where: { userId: testUserId } });

    await prisma.contactInterest.deleteMany({ where: { contactId: { in: [highMatchContactId, mediumMatchContactId, lowMatchContactId] } } });
    await prisma.contactSkill.deleteMany({ where: { contactId: { in: [highMatchContactId, mediumMatchContactId, lowMatchContactId] } } });
    await prisma.contactSector.deleteMany({ where: { contactId: { in: [highMatchContactId, mediumMatchContactId, lowMatchContactId] } } });
    await prisma.contact.deleteMany({ where: { id: { in: [highMatchContactId, mediumMatchContactId, lowMatchContactId] } } });

    await prisma.userGoal.deleteMany({ where: { userId: testUserId } });
    await prisma.userInterest.deleteMany({ where: { userId: testUserId } });
    await prisma.userSkill.deleteMany({ where: { userId: testUserId } });
    await prisma.userSector.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });

    console.log('✅ Cleanup complete');
  } catch (error) {
    console.log(`⚠️ Cleanup error: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  console.log('   MATCHING SERVICES INTEGRATION TEST');
  console.log('═'.repeat(60));

  try {
    const setupSuccess = await setupTestData();
    if (!setupSuccess) {
      console.log('❌ Setup failed, aborting tests');
      return;
    }

    await testDeterministicMatching();
    await testMatchDetails();
    await testCohereRerank();
    await testFeedbackService();

    console.log('\n' + '═'.repeat(60));
    console.log('   TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log('\n✅ All tests completed. Review results above for details.');

  } catch (error) {
    console.log(`\n❌ Test suite error: ${error.message}`);
    console.log(error.stack);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

// Run tests
runAllTests();
