/**
 * Strong Seed Script
 *
 * Ensures ALL users have complete profiles with many skills, goals, interests.
 * Makes contacts highly match their owners for strong match scores.
 */

import { PrismaClient, GoalType, ProficiencyLevel, ProjectStage, ProjectVisibility, Intensity } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const GOAL_TYPES: GoalType[] = [
  'MENTORSHIP', 'INVESTMENT', 'PARTNERSHIP', 'HIRING',
  'JOB_SEEKING', 'COLLABORATION', 'LEARNING', 'SALES'
];

const PROFICIENCY_LEVELS: ProficiencyLevel[] = ['INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const INTENSITIES: Intensity[] = ['MODERATE', 'PASSIONATE'];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

async function main() {
  console.log('=== STRONG SEED: Ensuring all users have complete profiles ===\n');

  // Get all reference data
  const sectors = await prisma.sector.findMany({ select: { id: true, name: true } });
  const skills = await prisma.skill.findMany({ select: { id: true, name: true } });
  const interests = await prisma.interest.findMany({ select: { id: true, name: true } });
  const users = await prisma.user.findMany({ select: { id: true, fullName: true } });

  console.log(`Sectors: ${sectors.length}, Skills: ${skills.length}, Interests: ${interests.length}, Users: ${users.length}\n`);

  // ============================================
  // STEP 1: Give ALL users complete profiles
  // ============================================
  console.log('STEP 1: Adding complete profiles to ALL users\n');

  for (const user of users) {
    console.log(`Processing: ${user.fullName}`);

    // Delete existing and recreate for clean slate
    await prisma.userSector.deleteMany({ where: { userId: user.id } });
    await prisma.userSkill.deleteMany({ where: { userId: user.id } });
    await prisma.userGoal.deleteMany({ where: { userId: user.id } });
    await prisma.userInterest.deleteMany({ where: { userId: user.id } });

    // Add 3-5 sectors
    const userSectors = randomElements(sectors, 3 + Math.floor(Math.random() * 3));
    for (let i = 0; i < userSectors.length; i++) {
      await prisma.userSector.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          sectorId: userSectors[i].id,
          isPrimary: i === 0,
          experienceYears: 3 + Math.floor(Math.random() * 12),
        },
      });
    }

    // Add 5-8 skills
    const userSkills = randomElements(skills, 5 + Math.floor(Math.random() * 4));
    for (const skill of userSkills) {
      await prisma.userSkill.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          skillId: skill.id,
          proficiencyLevel: randomElement(PROFICIENCY_LEVELS),
          isVerified: Math.random() > 0.5,
        },
      });
    }

    // Add 2-4 goals
    const userGoals = randomElements(GOAL_TYPES, 2 + Math.floor(Math.random() * 3));
    for (let i = 0; i < userGoals.length; i++) {
      await prisma.userGoal.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          goalType: userGoals[i],
          priority: i + 1,
          isActive: true,
        },
      });
    }

    // Add 3-5 interests
    if (interests.length > 0) {
      const userInterests = randomElements(interests, 3 + Math.floor(Math.random() * 3));
      for (const interest of userInterests) {
        await prisma.userInterest.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            interestId: interest.id,
            intensity: randomElement(INTENSITIES),
          },
        });
      }
    }

    console.log(`  Added: ${userSectors.length} sectors, ${userSkills.length} skills, ${userGoals.length} goals`);
  }

  // ============================================
  // STEP 2: Update ALL contacts to strongly match owners
  // ============================================
  console.log('\nSTEP 2: Making contacts strongly match their owners\n');

  for (const user of users) {
    console.log(`Updating contacts for: ${user.fullName}`);

    // Get user's profile
    const userSectors = await prisma.userSector.findMany({
      where: { userId: user.id },
      select: { sectorId: true },
    });
    const userSkills = await prisma.userSkill.findMany({
      where: { userId: user.id },
      select: { skillId: true },
    });

    const userSectorIds = userSectors.map(s => s.sectorId);
    const userSkillIds = userSkills.map(s => s.skillId);

    // Get all contacts for this user
    const contacts = await prisma.contact.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });

    for (const contact of contacts) {
      // Clear existing sectors and skills
      await prisma.contactSector.deleteMany({ where: { contactId: contact.id } });
      await prisma.contactSkill.deleteMany({ where: { contactId: contact.id } });

      // 80% of contacts share 2-3 sectors with owner
      if (Math.random() < 0.8 && userSectorIds.length > 0) {
        const sharedSectors = randomElements(userSectorIds, 2 + Math.floor(Math.random() * 2));
        for (const sectorId of sharedSectors) {
          await prisma.contactSector.create({
            data: {
              id: uuidv4(),
              contactId: contact.id,
              sectorId: sectorId,
              confidence: 0.85 + Math.random() * 0.15,
              source: 'USER',
            },
          }).catch(() => {});
        }
        // Add 1-2 random sectors too
        const extraSectors = randomElements(sectors.filter(s => !userSectorIds.includes(s.id)), 1 + Math.floor(Math.random() * 2));
        for (const sector of extraSectors) {
          await prisma.contactSector.create({
            data: {
              id: uuidv4(),
              contactId: contact.id,
              sectorId: sector.id,
              confidence: 0.7 + Math.random() * 0.2,
              source: 'USER',
            },
          }).catch(() => {});
        }
      }

      // 80% of contacts share 3-5 skills with owner
      if (Math.random() < 0.8 && userSkillIds.length > 0) {
        const sharedSkills = randomElements(userSkillIds, 3 + Math.floor(Math.random() * 3));
        for (const skillId of sharedSkills) {
          await prisma.contactSkill.create({
            data: {
              id: uuidv4(),
              contactId: contact.id,
              skillId: skillId,
              confidence: 0.8 + Math.random() * 0.2,
              source: 'USER',
            },
          }).catch(() => {});
        }
        // Add 2-3 random skills too
        const extraSkills = randomElements(skills.filter(s => !userSkillIds.includes(s.id)), 2 + Math.floor(Math.random() * 2));
        for (const skill of extraSkills) {
          await prisma.contactSkill.create({
            data: {
              id: uuidv4(),
              contactId: contact.id,
              skillId: skill.id,
              confidence: 0.6 + Math.random() * 0.3,
              source: 'USER',
            },
          }).catch(() => {});
        }
      }
    }

    console.log(`  Updated ${contacts.length} contacts`);
  }

  // ============================================
  // STEP 3: Regenerate match scores
  // ============================================
  console.log('\nSTEP 3: Regenerating match scores with strong algorithm\n');

  await prisma.matchResult.deleteMany({});
  console.log('Cleared existing match results');

  let totalMatches = 0;

  for (const user of users) {
    const userWithProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userGoals: true,
        userInterests: { include: { interest: true } },
      },
    });

    if (!userWithProfile) continue;

    const contacts = await prisma.contact.findMany({
      where: { ownerId: user.id },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
      },
    });

    for (const contact of contacts) {
      const { score, reasons } = calculateStrongMatchScore(userWithProfile, contact);

      await prisma.contact.update({
        where: { id: contact.id },
        data: { matchScore: score },
      });

      await prisma.matchResult.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          contactId: contact.id,
          finalScore: score,
          aiReasons: reasons,
          intersectionTags: {
            sectors: contact.contactSectors.filter(cs =>
              userWithProfile.userSectors.some(us => us.sectorId === cs.sectorId)
            ).map(cs => cs.sector.name),
            skills: contact.contactSkills.filter(cs =>
              userWithProfile.userSkills.some(us => us.skillId === cs.skillId)
            ).map(cs => cs.skill.name),
          },
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      totalMatches++;
    }

    console.log(`  ${user.fullName}: generated matches`);
  }

  console.log(`\nTotal matches: ${totalMatches}`);

  // ============================================
  // STEP 4: Create projects with strong matches
  // ============================================
  console.log('\nSTEP 4: Creating projects with matches\n');

  await prisma.projectMatch.deleteMany({});
  await prisma.projectSkill.deleteMany({});
  await prisma.projectSector.deleteMany({});
  await prisma.project.deleteMany({});

  const projectTemplates = [
    { title: 'AI-Powered Analytics Platform', summary: 'Building intelligent analytics for business insights', stage: 'MVP' as ProjectStage },
    { title: 'E-commerce Marketplace', summary: 'Creating a next-gen marketplace with AI recommendations', stage: 'LAUNCHED' as ProjectStage },
    { title: 'FinTech Payment Solution', summary: 'Revolutionizing payments for small businesses', stage: 'GROWTH' as ProjectStage },
    { title: 'EdTech Learning Platform', summary: 'Personalized learning with AI tutoring', stage: 'VALIDATION' as ProjectStage },
    { title: 'Healthcare Telemedicine', summary: 'Connecting patients with doctors remotely', stage: 'SCALING' as ProjectStage },
    { title: 'Sustainable Energy Solutions', summary: 'Clean energy management platform', stage: 'IDEA' as ProjectStage },
    { title: 'Smart Logistics Platform', summary: 'AI-driven route optimization', stage: 'MVP' as ProjectStage },
    { title: 'Social Impact Network', summary: 'Connecting changemakers globally', stage: 'LAUNCHED' as ProjectStage },
  ];

  let projectCount = 0;
  let projectMatchCount = 0;

  // Create 1-2 projects per user
  for (const user of users) {
    const numProjects = 1 + Math.floor(Math.random() * 2);

    for (let i = 0; i < numProjects; i++) {
      const template = randomElement(projectTemplates);

      // Get user's sectors and skills for the project
      const userSectors = await prisma.userSector.findMany({
        where: { userId: user.id },
        select: { sectorId: true },
      });
      const userSkills = await prisma.userSkill.findMany({
        where: { userId: user.id },
        select: { skillId: true },
      });

      const projectSectorIds = randomElements(userSectors.map(s => s.sectorId), 2);
      const projectSkillIds = randomElements(userSkills.map(s => s.skillId), 3);

      const project = await prisma.project.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          title: template.title,
          summary: template.summary,
          stage: template.stage,
          visibility: 'PUBLIC',
          lookingFor: ['Developer', 'Designer', 'Marketing Lead'],
          keywords: ['Technology', 'Innovation', 'Growth'],
          isActive: true,
        },
      });

      // Add sectors
      for (const sectorId of projectSectorIds) {
        await prisma.projectSector.create({
          data: { id: uuidv4(), projectId: project.id, sectorId },
        }).catch(() => {});
      }

      // Add skills
      for (const skillId of projectSkillIds) {
        await prisma.projectSkill.create({
          data: { id: uuidv4(), projectId: project.id, skillId, importance: 'REQUIRED' },
        }).catch(() => {});
      }

      projectCount++;

      // Create matches for this project
      // Match with contacts from other users
      const matchingContacts = await prisma.contact.findMany({
        where: {
          ownerId: { not: user.id },
          OR: [
            { contactSectors: { some: { sectorId: { in: projectSectorIds } } } },
            { contactSkills: { some: { skillId: { in: projectSkillIds } } } },
          ],
        },
        include: {
          contactSectors: true,
          contactSkills: true,
        },
        take: 15,
      });

      for (const contact of matchingContacts) {
        const sectorMatches = contact.contactSectors.filter(cs => projectSectorIds.includes(cs.sectorId)).length;
        const skillMatches = contact.contactSkills.filter(cs => projectSkillIds.includes(cs.skillId)).length;
        const score = Math.min(100, 40 + sectorMatches * 15 + skillMatches * 10);

        await prisma.projectMatch.create({
          data: {
            id: uuidv4(),
            projectId: project.id,
            matchedContactId: contact.id,
            matchScore: score,
            matchType: 'CONTACT',
            reasons: [`${sectorMatches} matching sectors`, `${skillMatches} matching skills`],
            sharedSectors: contact.contactSectors.filter(cs => projectSectorIds.includes(cs.sectorId)).map(cs => cs.sectorId),
            sharedSkills: contact.contactSkills.filter(cs => projectSkillIds.includes(cs.skillId)).map(cs => cs.skillId),
            sharedInterests: [],
            status: 'PENDING',
          },
        }).catch(() => {});
        projectMatchCount++;
      }

      // Match with other users
      const matchingUsers = await prisma.user.findMany({
        where: {
          id: { not: user.id },
          OR: [
            { userSectors: { some: { sectorId: { in: projectSectorIds } } } },
            { userSkills: { some: { skillId: { in: projectSkillIds } } } },
          ],
        },
        include: {
          userSectors: true,
          userSkills: true,
        },
        take: 10,
      });

      for (const matchUser of matchingUsers) {
        const sectorMatches = matchUser.userSectors.filter(us => projectSectorIds.includes(us.sectorId)).length;
        const skillMatches = matchUser.userSkills.filter(us => projectSkillIds.includes(us.skillId)).length;
        const score = Math.min(100, 45 + sectorMatches * 15 + skillMatches * 10);

        await prisma.projectMatch.create({
          data: {
            id: uuidv4(),
            projectId: project.id,
            matchedUserId: matchUser.id,
            matchScore: score,
            matchType: 'USER',
            reasons: [`${sectorMatches} matching sectors`, `${skillMatches} matching skills`],
            sharedSectors: matchUser.userSectors.filter(us => projectSectorIds.includes(us.sectorId)).map(us => us.sectorId),
            sharedSkills: matchUser.userSkills.filter(us => projectSkillIds.includes(us.skillId)).map(us => us.skillId),
            sharedInterests: [],
            status: 'PENDING',
          },
        }).catch(() => {});
        projectMatchCount++;
      }
    }

    console.log(`  ${user.fullName}: created projects`);
  }

  console.log(`\nTotal projects: ${projectCount}`);
  console.log(`Total project matches: ${projectMatchCount}`);

  // ============================================
  // Final Statistics
  // ============================================
  console.log('\n========================================');
  console.log('STRONG SEED COMPLETE');
  console.log('========================================\n');

  const matchStats = await prisma.matchResult.aggregate({
    _count: true,
    _avg: { finalScore: true },
    _min: { finalScore: true },
    _max: { finalScore: true },
  });

  const highScores = await prisma.matchResult.count({ where: { finalScore: { gte: 60 } } });
  const mediumScores = await prisma.matchResult.count({ where: { finalScore: { gte: 40, lt: 60 } } });
  const lowScores = await prisma.matchResult.count({ where: { finalScore: { lt: 40 } } });

  console.log('Contact Match Statistics:');
  console.log(`  Total: ${matchStats._count}`);
  console.log(`  Average Score: ${matchStats._avg.finalScore?.toFixed(1)}`);
  console.log(`  Min: ${matchStats._min.finalScore?.toFixed(1)}, Max: ${matchStats._max.finalScore?.toFixed(1)}`);
  console.log(`  High (60+): ${highScores} | Medium (40-59): ${mediumScores} | Low (<40): ${lowScores}`);

  const projectMatchStats = await prisma.projectMatch.aggregate({
    _count: true,
    _avg: { matchScore: true },
    _min: { matchScore: true },
    _max: { matchScore: true },
  });

  console.log('\nProject Match Statistics:');
  console.log(`  Total: ${projectMatchStats._count}`);
  console.log(`  Average Score: ${projectMatchStats._avg.matchScore?.toFixed(1)}`);
  console.log(`  Min: ${projectMatchStats._min.matchScore?.toFixed(1)}, Max: ${projectMatchStats._max.matchScore?.toFixed(1)}`);

  const finalCounts = {
    users: await prisma.user.count(),
    userSectors: await prisma.userSector.count(),
    userSkills: await prisma.userSkill.count(),
    userGoals: await prisma.userGoal.count(),
    userInterests: await prisma.userInterest.count(),
    contacts: await prisma.contact.count(),
    contactSectors: await prisma.contactSector.count(),
    contactSkills: await prisma.contactSkill.count(),
    matchResults: await prisma.matchResult.count(),
    projects: await prisma.project.count(),
    projectMatches: await prisma.projectMatch.count(),
  };

  console.log('\nFinal Database Counts:');
  Object.entries(finalCounts).forEach(([key, val]) => console.log(`  ${key}: ${val}`));
}

function calculateStrongMatchScore(user: any, contact: any): { score: number; reasons: string[] } {
  const userSectorIds = new Set(user.userSectors.map((s: any) => s.sectorId));
  const userSkillIds = new Set(user.userSkills.map((s: any) => s.skillId));
  const userGoals = user.userGoals || [];

  const contactSectorIds = new Set(contact.contactSectors.map((s: any) => s.sectorId));
  const contactSkillIds = new Set(contact.contactSkills.map((s: any) => s.skillId));

  // Calculate overlaps
  let sectorMatches = 0;
  for (const id of userSectorIds) {
    if (contactSectorIds.has(id)) sectorMatches++;
  }

  let skillMatches = 0;
  for (const id of userSkillIds) {
    if (contactSkillIds.has(id)) skillMatches++;
  }

  // Base score from overlaps (each match = significant points)
  const sectorScore = Math.min(35, sectorMatches * 12);  // Up to 35 points
  const skillScore = Math.min(35, skillMatches * 7);     // Up to 35 points

  // Goal alignment bonus
  let goalScore = 0;
  const jobTitle = (contact.jobTitle || '').toLowerCase();

  for (const goal of userGoals) {
    switch (goal.goalType) {
      case 'MENTORSHIP':
        if (/\b(ceo|cto|cfo|director|senior|lead|founder|vp|chief)\b/i.test(jobTitle)) goalScore += 15;
        break;
      case 'INVESTMENT':
        if (/\b(investor|vc|venture|capital|fund|angel)\b/i.test(jobTitle)) goalScore += 20;
        break;
      case 'PARTNERSHIP':
      case 'COLLABORATION':
        if (sectorMatches > 0 || skillMatches > 0) goalScore += 10;
        break;
      case 'HIRING':
        if (skillMatches > 0) goalScore += 10;
        break;
    }
  }
  goalScore = Math.min(25, goalScore);  // Cap at 25 points

  // Small random factor for variety (5-15 points)
  const randomBonus = 5 + Math.floor(Math.random() * 11);

  const totalScore = Math.min(100, sectorScore + skillScore + goalScore + randomBonus);

  // Generate reasons
  const reasons: string[] = [];
  if (sectorMatches > 0) {
    const sectorNames = contact.contactSectors
      .filter((cs: any) => userSectorIds.has(cs.sectorId))
      .map((cs: any) => cs.sector?.name)
      .filter(Boolean)
      .slice(0, 2);
    if (sectorNames.length > 0) {
      reasons.push(`Shares industry: ${sectorNames.join(', ')}`);
    }
  }
  if (skillMatches > 0) {
    const skillNames = contact.contactSkills
      .filter((cs: any) => userSkillIds.has(cs.skillId))
      .map((cs: any) => cs.skill?.name)
      .filter(Boolean)
      .slice(0, 3);
    if (skillNames.length > 0) {
      reasons.push(`Common skills: ${skillNames.join(', ')}`);
    }
  }
  if (goalScore > 10) {
    reasons.push('Aligns with your networking goals');
  }
  if (totalScore >= 70) {
    reasons.push('Strong connection potential');
  } else if (totalScore >= 50) {
    reasons.push('Good networking opportunity');
  }

  if (reasons.length === 0) {
    reasons.push('Potential connection');
  }

  return { score: totalScore, reasons };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
