/**
 * Calculate Match Scores Script
 *
 * Calculates match scores for all contacts for a given user.
 * Usage: npx ts-node scripts/calculate-matches.ts
 */

import { PrismaClient } from '@prisma/client';
import { DeterministicMatchingService } from '../src/infrastructure/external/matching/DeterministicMatchingService';

const prisma = new PrismaClient();
const matchingService = new DeterministicMatchingService();

async function calculateMatchScores(userEmail: string) {
  console.log(`\n=== Calculating Match Scores for ${userEmail} ===\n`);

  // Get the user with full profile
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      userSectors: { include: { sector: true } },
      userSkills: { include: { skill: true } },
      userGoals: true,
      userInterests: { include: { interest: true } },
      userHobbies: { include: { hobby: true } },
    },
  });

  if (!user) {
    console.log('User not found!');
    return;
  }

  console.log(`User: ${user.fullName}`);
  console.log(`Sectors: ${user.userSectors.length}`);
  console.log(`Skills: ${user.userSkills.length}`);
  console.log(`Goals: ${user.userGoals.length}`);

  // Get all contacts for this user
  const contacts = await prisma.contact.findMany({
    where: { ownerId: user.id },
  });

  console.log(`\nCalculating scores for ${contacts.length} contacts...\n`);

  // Calculate individually using recalculateScore
  let updated = 0;
  let highMatches = 0;
  let mediumMatches = 0;
  let lowMatches = 0;

  for (const contact of contacts) {
    try {
      const score = await matchingService.recalculateScore(user.id, contact.id);
      updated++;

      if (score >= 80) highMatches++;
      else if (score >= 50) mediumMatches++;
      else lowMatches++;

      const scoreLabel = score >= 80 ? '🟢 HIGH' :
                        score >= 50 ? '🟡 MEDIUM' :
                        score >= 20 ? '🟠 LOW' : '⚪ VERY LOW';
      console.log(`[${updated}/${contacts.length}] ${contact.fullName}: ${score.toFixed(1)}% ${scoreLabel}`);
    } catch (err: any) {
      console.error(`Failed for ${contact.fullName}:`, err.message || err);
    }
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Updated: ${updated}/${contacts.length} contacts`);
  console.log(`High (80-100): ${highMatches}`);
  console.log(`Medium (50-79): ${mediumMatches}`);
  console.log(`Low (<50): ${lowMatches}`);
}

// Run for test user
calculateMatchScores('matchtest@p2p.test')
  .catch(console.error)
  .finally(() => prisma.$disconnect());
