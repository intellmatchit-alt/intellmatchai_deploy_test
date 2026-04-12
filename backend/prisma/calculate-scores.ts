/**
 * Calculate Match Scores Script
 *
 * Calculates match scores for all contacts based on profile overlap.
 * Run with: npx ts-node prisma/calculate-scores.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function calculateMatchScores(userEmail: string) {
  console.log(`\n=== Calculating Match Scores for ${userEmail} ===\n`);

  // Get the user with full profile
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      userSectors: { select: { sectorId: true } },
      userSkills: { select: { skillId: true } },
      userGoals: { select: { goalType: true } },
      userInterests: { select: { interestId: true } },
      userHobbies: { select: { hobbyId: true } },
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
  console.log(`Interests: ${user.userInterests.length}`);
  console.log(`Hobbies: ${user.userHobbies.length}`);

  // Create sets for fast lookup
  const userSectorIds = new Set(user.userSectors.map(s => s.sectorId));
  const userSkillIds = new Set(user.userSkills.map(s => s.skillId));
  const userInterestIds = new Set(user.userInterests.map(i => i.interestId));
  const userHobbyIds = new Set(user.userHobbies.map(h => h.hobbyId));
  const userGoals = user.userGoals.map(g => g.goalType);

  // Get all contacts for this user with their profile data
  const contacts = await prisma.contact.findMany({
    where: { ownerId: user.id },
    include: {
      contactSectors: { select: { sectorId: true } },
      contactSkills: { select: { skillId: true } },
      contactInterests: { select: { interestId: true } },
      contactHobbies: { select: { hobbyId: true } },
    },
  });

  console.log(`\nCalculating scores for ${contacts.length} contacts...\n`);

  let updated = 0;
  let highMatches = 0;
  let mediumMatches = 0;
  let lowMatches = 0;
  let veryLowMatches = 0;

  for (const contact of contacts) {
    // Calculate overlaps
    const contactSectorIds = contact.contactSectors.map(s => s.sectorId);
    const contactSkillIds = contact.contactSkills.map(s => s.skillId);
    const contactInterestIds = contact.contactInterests.map(i => i.interestId);
    const contactHobbyIds = contact.contactHobbies.map(h => h.hobbyId);

    const sectorOverlap = contactSectorIds.filter(id => userSectorIds.has(id)).length;
    const skillOverlap = contactSkillIds.filter(id => userSkillIds.has(id)).length;
    const interestOverlap = contactInterestIds.filter(id => userInterestIds.has(id)).length;
    const hobbyOverlap = contactHobbyIds.filter(id => userHobbyIds.has(id)).length;

    // Calculate scores based on weights
    // Goal alignment: 25%, Sector: 20%, Skill: 20%, Interest: 15%, Hobby: 10%, Base: 10%
    const maxSectorScore = Math.min(userSectorIds.size, 3);
    const maxSkillScore = Math.min(userSkillIds.size, 5);
    const maxInterestScore = Math.min(userInterestIds.size, 4);
    const maxHobbyScore = Math.min(userHobbyIds.size, 3);

    const sectorScore = maxSectorScore > 0 ? (sectorOverlap / maxSectorScore) * 20 : 0;
    const skillScore = maxSkillScore > 0 ? (skillOverlap / maxSkillScore) * 20 : 0;
    const interestScore = maxInterestScore > 0 ? (interestOverlap / maxInterestScore) * 15 : 0;
    const hobbyScore = maxHobbyScore > 0 ? (hobbyOverlap / maxHobbyScore) * 10 : 0;

    // Goal alignment based on job title patterns
    let goalScore = 0;
    const jobTitle = (contact.jobTitle || '').toLowerCase();

    if (userGoals.includes('MENTORSHIP')) {
      if (/\b(ceo|cto|cfo|coo|director|senior|lead|founder|vp|chief|partner|head)\b/i.test(jobTitle)) {
        goalScore += 10;
      }
    }
    if (userGoals.includes('INVESTMENT')) {
      if (/\b(investor|vc|venture|capital|fund|angel|partner|principal)\b/i.test(jobTitle)) {
        goalScore += 12;
      }
    }
    if (userGoals.includes('PARTNERSHIP') || userGoals.includes('COLLABORATION')) {
      if (sectorOverlap > 0 || skillOverlap > 0) {
        goalScore += 8;
      }
    }
    if (userGoals.includes('HIRING')) {
      if (skillOverlap > 0) {
        goalScore += 6;
      }
    }
    goalScore = Math.min(goalScore, 25);

    // Base score for having profile data
    const baseScore = (contactSectorIds.length > 0 || contactSkillIds.length > 0) ? 10 : 5;

    // Calculate total score
    let totalScore = baseScore + sectorScore + skillScore + interestScore + hobbyScore + goalScore;

    // Add small random factor for variety (0-5)
    totalScore += Math.random() * 5;

    // Clamp between 0 and 100
    totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

    // Update contact with match score
    await prisma.contact.update({
      where: { id: contact.id },
      data: { matchScore: totalScore },
    });

    // Categorize
    if (totalScore >= 80) highMatches++;
    else if (totalScore >= 50) mediumMatches++;
    else if (totalScore >= 20) lowMatches++;
    else veryLowMatches++;

    updated++;

    const scoreLabel = totalScore >= 80 ? '🟢 HIGH' :
                      totalScore >= 50 ? '🟡 MEDIUM' :
                      totalScore >= 20 ? '🟠 LOW' : '⚪ VERY LOW';
    console.log(`[${updated}/${contacts.length}] ${contact.fullName}: ${totalScore}% ${scoreLabel}`);
    console.log(`   Sectors: ${sectorOverlap}/${contactSectorIds.length}, Skills: ${skillOverlap}/${contactSkillIds.length}, Interests: ${interestOverlap}/${contactInterestIds.length}`);
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Updated: ${updated}/${contacts.length} contacts`);
  console.log(`High (80-100): ${highMatches}`);
  console.log(`Medium (50-79): ${mediumMatches}`);
  console.log(`Low (20-49): ${lowMatches}`);
  console.log(`Very Low (0-19): ${veryLowMatches}`);
}

// Run for test user
calculateMatchScores('matchtest@p2p.test')
  .catch(console.error)
  .finally(() => prisma.$disconnect());
