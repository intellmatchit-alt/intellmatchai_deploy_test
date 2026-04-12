/**
 * Generate Match Scores Script
 *
 * Calculates and stores match scores for all user contacts.
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Weights from DeterministicMatchingService
const WEIGHTS = {
  goalAlignment: 0.30,
  sector: 0.20,
  skill: 0.15,
  complementarySkills: 0.10,
  interest: 0.10,
  recency: 0.08,
  interaction: 0.07,
};

// Senior/Leadership patterns
const SENIOR_ROLE_PATTERNS = [
  /\b(ceo|cto|cfo|coo|cmo|cio|chief)\b/i,
  /\b(president|vp|vice\s*president)\b/i,
  /\b(director|head\s+of|lead)\b/i,
  /\b(senior|sr\.?|principal|staff)\b/i,
  /\b(founder|co-?founder|partner)\b/i,
];

// Investor patterns
const INVESTOR_ROLE_PATTERNS = [
  /\b(investor|venture\s*capital|vc)\b/i,
  /\b(angel|seed|funding)\b/i,
  /\b(portfolio|investment|fund)\b/i,
];

// Complementary skills matrix
const COMPLEMENTARY_SKILLS: Record<string, string[]> = {
  'Sales': ['Marketing', 'Business Development', 'Communication'],
  'Marketing': ['Sales', 'Content', 'Analytics', 'SEO'],
  'Frontend Development': ['Backend Development', 'UI/UX Design', 'DevOps'],
  'Backend Development': ['Frontend Development', 'DevOps', 'Cloud', 'Database'],
  'Data Analysis': ['Data Science', 'Business Intelligence', 'Machine Learning'],
  'Data Science': ['Machine Learning', 'Data Analysis', 'AI', 'Python'],
  'Machine Learning': ['Data Science', 'AI', 'Python', 'Deep Learning'],
  'UI/UX Design': ['Product Design', 'Frontend Development', 'Research'],
  'Product Management': ['Engineering', 'Design', 'Marketing', 'Strategy'],
  'Business Development': ['Sales', 'Marketing', 'Strategy', 'Partnerships'],
  'Finance': ['Legal', 'Strategy', 'Operations', 'Accounting'],
  'Leadership': ['Management', 'Strategy', 'Team Building', 'Communication'],
};

function calculateSetOverlap(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 || set2.size === 0) return 0;
  let overlap = 0;
  for (const item of set1) {
    if (set2.has(item)) overlap++;
  }
  const union = set1.size + set2.size - overlap;
  return overlap / union;
}

function calculateComplementarySkills(userSkills: string[], contactSkills: string[]): number {
  if (userSkills.length === 0 || contactSkills.length === 0) return 0;

  let matches = 0;
  const normalizedContactSkills = contactSkills.map((s) => s.toLowerCase());

  for (const userSkill of userSkills) {
    const complements = COMPLEMENTARY_SKILLS[userSkill] || [];
    for (const complement of complements) {
      if (normalizedContactSkills.some((cs) => cs.includes(complement.toLowerCase()))) {
        matches++;
      }
    }
  }

  return Math.min(100, matches * 25);
}

function calculateGoalAlignment(user: any, contact: any): number {
  const userGoals = user.userGoals || [];
  if (userGoals.length === 0) return 0;

  let totalScore = 0;
  const contactJobTitle = (contact.jobTitle || '').toLowerCase();

  const isSeniorRole = SENIOR_ROLE_PATTERNS.some((p) => p.test(contactJobTitle));
  const isInvestorRole = INVESTOR_ROLE_PATTERNS.some((p) => p.test(contactJobTitle));

  const userSectorIds = new Set(user.userSectors?.map((s: any) => s.sectorId) || []);
  const contactSectorIds = new Set(contact.contactSectors?.map((s: any) => s.sectorId) || []);
  const hasSameSector = [...userSectorIds].some((id) => contactSectorIds.has(id));

  const userSkillNames = user.userSkills?.map((s: any) => s.skill?.name || '').filter(Boolean) || [];
  const contactSkillNames = contact.contactSkills?.map((s: any) => s.skill?.name || '').filter(Boolean) || [];
  const hasComplementary = calculateComplementarySkills(userSkillNames, contactSkillNames) > 0;

  for (const goal of userGoals) {
    let goalScore = 0;

    switch (goal.goalType) {
      case 'MENTORSHIP':
        if (isSeniorRole) goalScore += 40;
        if (hasSameSector) goalScore += 30;
        break;
      case 'INVESTMENT':
        if (isInvestorRole) goalScore += 50;
        break;
      case 'PARTNERSHIP':
        if (hasSameSector) goalScore += 30;
        if (hasComplementary) goalScore += 40;
        break;
      case 'COLLABORATION':
        if (hasComplementary) goalScore += 40;
        if (hasSameSector) goalScore += 30;
        break;
      default:
        if (hasSameSector) goalScore += 20;
        if (hasComplementary) goalScore += 20;
        break;
    }

    totalScore += goalScore;
  }

  return Math.min(100, userGoals.length > 0 ? totalScore / userGoals.length : 0);
}

function calculateMatchScore(user: any, contact: any): { score: number; reasons: string[] } {
  const userSectorIds = new Set<string>(user.userSectors.map((s: any) => s.sectorId));
  const userSkillNames = user.userSkills.map((s: any) => s.skill?.name || '').filter(Boolean);
  const userSkillIds = new Set<string>(user.userSkills.map((s: any) => s.skillId));

  const contactSectorIds = new Set<string>(contact.contactSectors.map((s: any) => s.sectorId));
  const contactSkillNames = contact.contactSkills.map((s: any) => s.skill?.name || '').filter(Boolean);
  const contactSkillIds = new Set<string>(contact.contactSkills.map((s: any) => s.skillId));

  // Goal Alignment (30%)
  const goalAlignmentScore = calculateGoalAlignment(user, contact);

  // Sector Overlap (20%)
  const sectorScore = calculateSetOverlap(userSectorIds, contactSectorIds) * 100;

  // Skill Match (15%)
  const skillScore = calculateSetOverlap(userSkillIds, contactSkillIds) * 100;

  // Complementary Skills (10%)
  const complementarySkillsScore = calculateComplementarySkills(userSkillNames, contactSkillNames);

  // Interest Score (10%) - placeholder
  const interestScore = 0;

  // Recency (8%)
  const daysSinceCreated = Math.floor(
    (Date.now() - contact.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const recencyScore = Math.max(0, 100 - daysSinceCreated * 2);

  // Interaction (7%)
  const interactionCount = contact.interactions?.length || 0;
  const interactionScore = Math.min(100, interactionCount * 20);

  // Calculate weighted total
  const totalScore = Math.round(
    goalAlignmentScore * WEIGHTS.goalAlignment +
    sectorScore * WEIGHTS.sector +
    skillScore * WEIGHTS.skill +
    complementarySkillsScore * WEIGHTS.complementarySkills +
    interestScore * WEIGHTS.interest +
    recencyScore * WEIGHTS.recency +
    interactionScore * WEIGHTS.interaction
  );

  // Generate reasons
  const reasons: string[] = [];
  if (goalAlignmentScore > 30) reasons.push('Aligns with your goals');
  if (sectorScore > 30) reasons.push('Shares your industry');
  if (skillScore > 30) reasons.push('Has matching skills');
  if (complementarySkillsScore > 30) reasons.push('Has complementary skills');
  if (recencyScore > 50) reasons.push('Recently added contact');

  if (reasons.length === 0) {
    reasons.push('Potential networking opportunity');
  }

  return {
    score: Math.min(100, totalScore),
    reasons,
  };
}

async function main() {
  console.log('Starting match score generation...\n');

  // Get all users with their profile data
  const users = await prisma.user.findMany({
    include: {
      userSectors: { include: { sector: true } },
      userSkills: { include: { skill: true } },
      userInterests: { include: { interest: true } },
      userGoals: true,
    },
  });

  console.log(`Found ${users.length} users`);

  let totalMatchesCreated = 0;
  let totalMatchesUpdated = 0;

  for (const user of users) {
    console.log(`\nProcessing user: ${user.fullName} (${user.id})`);

    // Get user's contacts
    const contacts = await prisma.contact.findMany({
      where: { ownerId: user.id },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        interactions: {
          orderBy: { occurredAt: 'desc' },
          take: 10,
        },
      },
    });

    console.log(`  Found ${contacts.length} contacts`);

    let userMatchesCreated = 0;
    let userMatchesUpdated = 0;

    for (const contact of contacts) {
      const { score, reasons } = calculateMatchScore(user, contact);

      // Update contact's matchScore field
      await prisma.contact.update({
        where: { id: contact.id },
        data: { matchScore: score },
      });

      // Upsert into match_results table
      const existingMatch = await prisma.matchResult.findUnique({
        where: {
          userId_contactId: {
            userId: user.id,
            contactId: contact.id,
          },
        },
      });

      if (existingMatch) {
        await prisma.matchResult.update({
          where: { id: existingMatch.id },
          data: {
            finalScore: score,
            aiReasons: reasons,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
        userMatchesUpdated++;
      } else {
        await prisma.matchResult.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            contactId: contact.id,
            finalScore: score,
            aiReasons: reasons,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
        userMatchesCreated++;
      }
    }

    console.log(`  Created ${userMatchesCreated} matches, updated ${userMatchesUpdated}`);
    totalMatchesCreated += userMatchesCreated;
    totalMatchesUpdated += userMatchesUpdated;
  }

  console.log(`\n========================================`);
  console.log(`Match generation complete!`);
  console.log(`Total matches created: ${totalMatchesCreated}`);
  console.log(`Total matches updated: ${totalMatchesUpdated}`);
  console.log(`========================================\n`);

  // Show distribution of scores
  const scoreStats = await prisma.matchResult.aggregate({
    _count: true,
    _avg: { finalScore: true },
    _min: { finalScore: true },
    _max: { finalScore: true },
  });

  console.log('Score Statistics:');
  console.log(`  Total matches: ${scoreStats._count}`);
  console.log(`  Average score: ${scoreStats._avg.finalScore?.toFixed(1) || 0}`);
  console.log(`  Min score: ${scoreStats._min.finalScore?.toFixed(1) || 0}`);
  console.log(`  Max score: ${scoreStats._max.finalScore?.toFixed(1) || 0}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
