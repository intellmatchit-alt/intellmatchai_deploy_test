/**
 * Run Matching Tests with Test Data
 *
 * This script runs all matching services against the test data
 * and displays detailed results.
 *
 * Run: npx ts-node src/scripts/run-matching-tests.ts
 */

import { PrismaClient } from '@prisma/client';
import { DeterministicMatchingService } from '../infrastructure/external/matching/DeterministicMatchingService';
import { ProjectMatchingService } from '../infrastructure/external/projects/ProjectMatchingService';
import { OpportunityMatchingService } from '../infrastructure/external/opportunities/OpportunityMatchingService';

const prisma = new PrismaClient();

// Test user email
const TEST_USER_EMAIL = 'testuser@matching.test';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('              RUNNING MATCHING SERVICE TESTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get test user
  const testUser = await prisma.user.findUnique({
    where: { email: TEST_USER_EMAIL },
    include: {
      userSectors: { include: { sector: true } },
      userSkills: { include: { skill: true } },
      userGoals: true,
    },
  });

  if (!testUser) {
    console.error('❌ Test user not found. Run create-test-data.ts first.');
    process.exit(1);
  }

  console.log(`👤 Test User: ${testUser.fullName}`);
  console.log(`   ID: ${testUser.id}`);
  console.log(`   Sectors: ${testUser.userSectors.map(s => s.sector.name).join(', ')}`);
  console.log(`   Skills: ${testUser.userSkills.map(s => s.skill.name).join(', ')}`);
  console.log(`   Goals: ${testUser.userGoals.map(g => g.goalType).join(', ')}\n`);

  // Get test data
  const contacts = await prisma.contact.findMany({
    where: { ownerId: testUser.id },
    include: {
      contactSectors: { include: { sector: true } },
      contactSkills: { include: { skill: true } },
    },
  });

  const project = await prisma.project.findFirst({
    where: { userId: testUser.id },
  });

  const intent = await prisma.opportunityIntent.findFirst({
    where: { userId: testUser.id },
  });

  // =============================================
  // 1. CONTACT MATCHING
  // =============================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    1. CONTACT MATCHING');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const contactService = new DeterministicMatchingService();
  const contactMatches = await contactService.getMatches(testUser.id, { limit: 10, minScore: 0 });

  console.log(`📊 Found ${contactMatches.length} matches:\n`);

  for (const match of contactMatches) {
    const contact = contacts.find(c => c.id === match.contactId);
    const details = await contactService.getMatchDetails(testUser.id, match.contactId);

    console.log(`┌─────────────────────────────────────────────────────────────┐`);
    console.log(`│ ${contact?.fullName || 'Unknown Contact'}`);
    console.log(`│ Score: ${match.score}/100`);
    console.log(`├─────────────────────────────────────────────────────────────┤`);

    if (details?.scoreBreakdown) {
      console.log(`│ SCORE BREAKDOWN:`);
      console.log(`│   Goal Alignment:     ${details.scoreBreakdown.goalAlignmentScore.toString().padStart(3)} (25% weight)`);
      console.log(`│   Sector Overlap:     ${details.scoreBreakdown.sectorScore.toString().padStart(3)} (15% weight)`);
      console.log(`│   Skill Match:        ${details.scoreBreakdown.skillScore.toString().padStart(3)} (12% weight)`);
      console.log(`│   Semantic Similarity:${details.scoreBreakdown.semanticSimilarityScore.toString().padStart(3)} (10% weight)`);
      console.log(`│   Network Proximity:  ${details.scoreBreakdown.networkProximityScore.toString().padStart(3)} (8% weight)`);
      console.log(`│   Complementary:      ${details.scoreBreakdown.complementarySkillsScore.toString().padStart(3)} (7% weight)`);
      console.log(`│   Recency:            ${details.scoreBreakdown.recencyScore.toString().padStart(3)} (7% weight)`);
      console.log(`│   Interaction:        ${details.scoreBreakdown.interactionScore.toString().padStart(3)} (6% weight)`);
      console.log(`│   Interest Overlap:   ${details.scoreBreakdown.interestScore.toString().padStart(3)} (5% weight)`);
      console.log(`│   Hobby Overlap:      ${details.scoreBreakdown.hobbyScore.toString().padStart(3)} (5% weight)`);
    }

    if (details?.intersections && details.intersections.length > 0) {
      console.log(`├─────────────────────────────────────────────────────────────┤`);
      console.log(`│ SHARED ATTRIBUTES:`);
      details.intersections.forEach(i => {
        console.log(`│   [${i.type}] ${i.label}`);
      });
    }

    if (details?.reasons && details.reasons.length > 0) {
      console.log(`├─────────────────────────────────────────────────────────────┤`);
      console.log(`│ REASONS:`);
      details.reasons.forEach(r => {
        console.log(`│   • ${r}`);
      });
    }

    console.log(`└─────────────────────────────────────────────────────────────┘\n`);
  }

  // =============================================
  // 2. PROJECT MATCHING
  // =============================================
  if (project) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    2. PROJECT MATCHING');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`📁 Project: ${project.title}`);
    console.log(`   Looking for: ${JSON.stringify(project.lookingFor)}\n`);

    const projectService = new ProjectMatchingService(prisma);

    try {
      const projectMatches = await projectService.findMatchesForProject(project.id, testUser.id);

      console.log(`📊 Found ${projectMatches.length} matches:\n`);

      for (const match of projectMatches) {
        let candidateName = 'Unknown';
        let candidateType = match.matchType;

        if (match.matchedUserId) {
          const user = await prisma.user.findUnique({ where: { id: match.matchedUserId } });
          candidateName = user?.fullName || 'Unknown User';
        } else if (match.matchedContactId) {
          const contact = await prisma.contact.findUnique({ where: { id: match.matchedContactId } });
          candidateName = contact?.fullName || 'Unknown Contact';
        }

        console.log(`┌─────────────────────────────────────────────────────────────┐`);
        console.log(`│ ${candidateName} (${candidateType})`);
        console.log(`│ Score: ${match.matchScore}/100`);
        console.log(`├─────────────────────────────────────────────────────────────┤`);
        console.log(`│ Shared Sectors: ${JSON.stringify(match.sharedSectors)}`);
        console.log(`│ Shared Skills: ${JSON.stringify(match.sharedSkills)}`);

        const reasons = match.reasons as string[] | undefined;
        if (reasons && Array.isArray(reasons) && reasons.length > 0) {
          console.log(`├─────────────────────────────────────────────────────────────┤`);
          console.log(`│ REASONS:`);
          reasons.forEach((r: string) => {
            console.log(`│   • ${r}`);
          });
        }

        if (match.suggestedMessage) {
          console.log(`├─────────────────────────────────────────────────────────────┤`);
          console.log(`│ SUGGESTED MESSAGE:`);
          const msg = match.suggestedMessage as string;
          console.log(`│   "${msg.substring(0, 60)}..."`);
        }

        console.log(`└─────────────────────────────────────────────────────────────┘\n`);
      }
    } catch (error: any) {
      console.log(`❌ Project matching error: ${error.message}\n`);
    }
  }

  // =============================================
  // 3. OPPORTUNITY MATCHING
  // =============================================
  if (intent) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                   3. OPPORTUNITY MATCHING');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`🎯 Intent: ${intent.title}`);
    console.log(`   Type: ${intent.intentType}`);
    console.log(`   Seniority: ${intent.seniority}`);
    console.log(`   Location: ${intent.locationPref} (Remote OK: ${intent.remoteOk})\n`);

    const opportunityService = new OpportunityMatchingService(prisma);

    try {
      const opportunityMatches = await opportunityService.findMatchesForIntent(testUser.id, intent.id);

      console.log(`📊 Found ${opportunityMatches.length} matches:\n`);

      for (const match of opportunityMatches) {
        let candidateName = 'Unknown';

        if (match.matchedUserId) {
          const user = await prisma.user.findUnique({ where: { id: match.matchedUserId } });
          candidateName = user?.fullName || 'Unknown User';
        } else if (match.matchedContactId) {
          const contact = await prisma.contact.findUnique({ where: { id: match.matchedContactId } });
          candidateName = contact?.fullName || 'Unknown Contact';
        }

        console.log(`┌─────────────────────────────────────────────────────────────┐`);
        console.log(`│ ${candidateName} (${match.matchType})`);
        console.log(`│ Score: ${match.matchScore}/100`);
        console.log(`├─────────────────────────────────────────────────────────────┤`);
        console.log(`│ Intent Alignment: ${match.intentAlignment}`);
        console.log(`│ Shared Sectors: ${JSON.stringify(match.sharedSectors)}`);
        console.log(`│ Shared Skills: ${JSON.stringify(match.sharedSkills)}`);
        console.log(`│ Suggested Action: ${match.suggestedAction}`);

        const oppReasons = match.reasons as string[] | undefined;
        if (oppReasons && Array.isArray(oppReasons) && oppReasons.length > 0) {
          console.log(`├─────────────────────────────────────────────────────────────┤`);
          console.log(`│ REASONS:`);
          oppReasons.forEach((r: string) => {
            console.log(`│   • ${r}`);
          });
        }

        const nextSteps = match.nextSteps as string[] | undefined;
        if (nextSteps && Array.isArray(nextSteps) && nextSteps.length > 0) {
          console.log(`├─────────────────────────────────────────────────────────────┤`);
          console.log(`│ NEXT STEPS:`);
          nextSteps.forEach((s: string) => {
            console.log(`│   → ${s}`);
          });
        }

        console.log(`└─────────────────────────────────────────────────────────────┘\n`);
      }
    } catch (error: any) {
      console.log(`❌ Opportunity matching error: ${error.message}\n`);
    }
  }

  // =============================================
  // SUMMARY
  // =============================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('✅ All matching tests completed.');
  console.log('\n📋 Test data is PRESERVED in the database.');
  console.log('\n🔐 You can login with:');
  console.log('   Email:    testuser@matching.test');
  console.log('   Password: Test123!@#');
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('Error running tests:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
