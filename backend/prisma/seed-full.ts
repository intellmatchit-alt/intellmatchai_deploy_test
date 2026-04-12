/**
 * Full Seed Script
 *
 * Seeds users with profiles, updates contacts for high match scores,
 * creates projects, and generates all matches.
 */

import { PrismaClient, GoalType, ProficiencyLevel, ProjectStage, ProjectVisibility } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Goal types for variety
const GOAL_TYPES: GoalType[] = [
  'MENTORSHIP', 'INVESTMENT', 'PARTNERSHIP', 'HIRING',
  'JOB_SEEKING', 'COLLABORATION', 'LEARNING', 'SALES'
];

const PROFICIENCY_LEVELS: ProficiencyLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

// Project templates
const PROJECT_TEMPLATES = [
  {
    title: 'AI-Powered Customer Service Platform',
    summary: 'Building an intelligent chatbot platform that uses NLP to handle customer inquiries automatically.',
    stage: 'MVP' as ProjectStage,
    lookingFor: ['CTO', 'ML Engineer', 'Backend Developer'],
    keywords: ['AI', 'NLP', 'Chatbot', 'Customer Service', 'SaaS'],
  },
  {
    title: 'Sustainable E-commerce Marketplace',
    summary: 'Creating a marketplace connecting eco-friendly brands with conscious consumers.',
    stage: 'VALIDATION' as ProjectStage,
    lookingFor: ['Co-founder', 'Marketing Lead', 'Full Stack Developer'],
    keywords: ['E-commerce', 'Sustainability', 'Marketplace', 'Green Tech'],
  },
  {
    title: 'FinTech Payment Solution for SMEs',
    summary: 'Developing a mobile-first payment and invoicing solution for small businesses in MENA.',
    stage: 'LAUNCHED' as ProjectStage,
    lookingFor: ['Investors', 'Sales Lead', 'Compliance Officer'],
    keywords: ['FinTech', 'Payments', 'SME', 'Mobile', 'MENA'],
  },
  {
    title: 'EdTech Learning Management System',
    summary: 'Building a gamified learning platform for K-12 students with AI-powered personalization.',
    stage: 'IDEA' as ProjectStage,
    lookingFor: ['Educator', 'UI/UX Designer', 'Frontend Developer'],
    keywords: ['EdTech', 'Gamification', 'AI', 'K-12', 'Learning'],
  },
  {
    title: 'Healthcare Telemedicine App',
    summary: 'Creating a telemedicine platform connecting patients with doctors for virtual consultations.',
    stage: 'GROWTH' as ProjectStage,
    lookingFor: ['Healthcare Advisor', 'Mobile Developer', 'Operations Manager'],
    keywords: ['Healthcare', 'Telemedicine', 'Mobile', 'Doctors', 'Patients'],
  },
  {
    title: 'Real Estate Investment Platform',
    summary: 'Fractional real estate investment platform allowing small investors to own property shares.',
    stage: 'MVP' as ProjectStage,
    lookingFor: ['Legal Advisor', 'Real Estate Expert', 'Backend Developer'],
    keywords: ['Real Estate', 'Investment', 'PropTech', 'Fractional Ownership'],
  },
  {
    title: 'Logistics Optimization SaaS',
    summary: 'AI-driven route optimization and fleet management for delivery companies.',
    stage: 'SCALING' as ProjectStage,
    lookingFor: ['Data Scientist', 'Sales Executive', 'DevOps Engineer'],
    keywords: ['Logistics', 'AI', 'Fleet Management', 'Optimization', 'SaaS'],
  },
  {
    title: 'Social Impact Crowdfunding',
    summary: 'Platform connecting social entrepreneurs with impact investors and donors.',
    stage: 'VALIDATION' as ProjectStage,
    lookingFor: ['Community Manager', 'Full Stack Developer', 'Impact Investor'],
    keywords: ['Social Impact', 'Crowdfunding', 'Non-profit', 'Community'],
  },
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function main() {
  console.log('Starting full seed...\n');

  // Get all sectors and skills
  const sectors = await prisma.sector.findMany({ select: { id: true, name: true } });
  const skills = await prisma.skill.findMany({ select: { id: true, name: true } });
  const interests = await prisma.interest.findMany({ select: { id: true, name: true } });

  console.log(`Found ${sectors.length} sectors, ${skills.length} skills, ${interests.length} interests`);

  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true },
  });
  console.log(`Found ${users.length} users\n`);

  // ============================================
  // STEP 1: Add sectors, skills, goals to users
  // ============================================
  console.log('=== STEP 1: Adding profile data to users ===\n');

  for (const user of users) {
    console.log(`Processing user: ${user.fullName}`);

    // Check existing profile data
    const existingSectors = await prisma.userSector.count({ where: { userId: user.id } });
    const existingSkills = await prisma.userSkill.count({ where: { userId: user.id } });
    const existingGoals = await prisma.userGoal.count({ where: { userId: user.id } });

    // Add 2-4 sectors if none
    if (existingSectors === 0) {
      const userSectors = randomElements(sectors, 2, 4);
      for (let i = 0; i < userSectors.length; i++) {
        await prisma.userSector.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            sectorId: userSectors[i].id,
            isPrimary: i === 0,
            experienceYears: Math.floor(Math.random() * 15) + 1,
          },
        }).catch(() => {}); // Ignore duplicates
      }
      console.log(`  Added ${userSectors.length} sectors`);
    }

    // Add 3-6 skills if none
    if (existingSkills === 0) {
      const userSkills = randomElements(skills, 3, 6);
      for (const skill of userSkills) {
        await prisma.userSkill.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            skillId: skill.id,
            proficiencyLevel: randomElement(PROFICIENCY_LEVELS),
            isVerified: Math.random() > 0.7,
          },
        }).catch(() => {}); // Ignore duplicates
      }
      console.log(`  Added ${userSkills.length} skills`);
    }

    // Add 1-3 goals if none
    if (existingGoals === 0) {
      const userGoals = randomElements(GOAL_TYPES, 1, 3);
      for (let i = 0; i < userGoals.length; i++) {
        await prisma.userGoal.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            goalType: userGoals[i],
            priority: i + 1,
            isActive: true,
          },
        }).catch(() => {}); // Ignore duplicates
      }
      console.log(`  Added ${userGoals.length} goals`);
    }

    // Add interests if we have them
    if (interests.length > 0) {
      const existingInterests = await prisma.userInterest.count({ where: { userId: user.id } });
      if (existingInterests === 0) {
        const userInterests = randomElements(interests, 2, 4);
        for (const interest of userInterests) {
          await prisma.userInterest.create({
            data: {
              id: uuidv4(),
              userId: user.id,
              interestId: interest.id,
              intensity: randomElement(['CASUAL', 'MODERATE', 'PASSIONATE'] as const),
            },
          }).catch(() => {}); // Ignore duplicates
        }
        console.log(`  Added ${userInterests.length} interests`);
      }
    }
  }

  // ============================================
  // STEP 2: Update contacts to match user profiles
  // ============================================
  console.log('\n=== STEP 2: Updating contacts to match user profiles ===\n');

  for (const user of users) {
    console.log(`Updating contacts for: ${user.fullName}`);

    // Get user's sectors and skills
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

    // Get user's contacts
    const contacts = await prisma.contact.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });

    let updatedCount = 0;

    for (const contact of contacts) {
      // 70% chance to share at least one sector with user
      if (Math.random() < 0.7 && userSectorIds.length > 0) {
        const sharedSector = randomElement(userSectorIds);
        await prisma.contactSector.upsert({
          where: {
            contactId_sectorId: {
              contactId: contact.id,
              sectorId: sharedSector,
            },
          },
          update: {},
          create: {
            id: uuidv4(),
            contactId: contact.id,
            sectorId: sharedSector,
            confidence: 0.9,
            source: 'USER',
          },
        }).catch(() => {});
      }

      // 60% chance to share 1-2 skills with user
      if (Math.random() < 0.6 && userSkillIds.length > 0) {
        const sharedSkills = randomElements(userSkillIds, 1, 2);
        for (const skillId of sharedSkills) {
          await prisma.contactSkill.upsert({
            where: {
              contactId_skillId: {
                contactId: contact.id,
                skillId: skillId,
              },
            },
            update: {},
            create: {
              id: uuidv4(),
              contactId: contact.id,
              skillId: skillId,
              confidence: 0.85,
              source: 'USER',
            },
          }).catch(() => {});
        }
      }

      updatedCount++;
    }

    console.log(`  Updated ${updatedCount} contacts`);
  }

  // ============================================
  // STEP 3: Regenerate match scores
  // ============================================
  console.log('\n=== STEP 3: Regenerating match scores ===\n');

  // Clear existing match results
  await prisma.matchResult.deleteMany({});
  console.log('Cleared existing match results');

  // Regenerate matches with improved algorithm
  for (const user of users) {
    const userWithProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userGoals: true,
      },
    });

    if (!userWithProfile) continue;

    const contacts = await prisma.contact.findMany({
      where: { ownerId: user.id },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        interactions: { take: 10 },
      },
    });

    let matchCount = 0;

    for (const contact of contacts) {
      const score = calculateEnhancedMatchScore(userWithProfile, contact);
      const reasons = generateReasons(score, userWithProfile, contact);

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
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      matchCount++;
    }

    console.log(`  ${user.fullName}: ${matchCount} matches generated`);
  }

  // ============================================
  // STEP 4: Create projects for users
  // ============================================
  console.log('\n=== STEP 4: Creating projects ===\n');

  // Delete existing projects first
  await prisma.projectMatch.deleteMany({});
  await prisma.projectSkill.deleteMany({});
  await prisma.projectSector.deleteMany({});
  await prisma.project.deleteMany({});
  console.log('Cleared existing projects');

  let projectCount = 0;

  for (const user of users) {
    // 60% chance user has a project
    if (Math.random() < 0.6) {
      const template = randomElement(PROJECT_TEMPLATES);

      // Get some sectors and skills for the project
      const projectSectorIds = randomElements(sectors, 1, 2).map(s => s.id);
      const projectSkillIds = randomElements(skills, 2, 4).map(s => s.id);

      const project = await prisma.project.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          title: template.title,
          summary: template.summary,
          stage: template.stage,
          visibility: randomElement(['PUBLIC', 'PRIVATE', 'CONNECTIONS_ONLY'] as ProjectVisibility[]),
          lookingFor: template.lookingFor,
          keywords: template.keywords,
          isActive: true,
        },
      });

      // Add sectors to project
      for (const sectorId of projectSectorIds) {
        await prisma.projectSector.create({
          data: {
            id: uuidv4(),
            projectId: project.id,
            sectorId: sectorId,
          },
        }).catch(() => {});
      }

      // Add skills to project
      for (const skillId of projectSkillIds) {
        await prisma.projectSkill.create({
          data: {
            id: uuidv4(),
            projectId: project.id,
            skillId: skillId,
            importance: randomElement(['REQUIRED', 'PREFERRED', 'NICE_TO_HAVE'] as const),
          },
        }).catch(() => {});
      }

      projectCount++;
      console.log(`  Created project: "${template.title}" for ${user.fullName}`);
    }
  }

  console.log(`\nTotal projects created: ${projectCount}`);

  // ============================================
  // STEP 5: Generate project matches
  // ============================================
  console.log('\n=== STEP 5: Generating project matches ===\n');

  const projects = await prisma.project.findMany({
    include: {
      sectors: { include: { sector: true } },
      skillsNeeded: { include: { skill: true } },
      user: true,
    },
  });

  let projectMatchCount = 0;

  for (const project of projects) {
    // Get project sector and skill IDs
    const projectSectorIds = new Set(project.sectors.map(s => s.sectorId));
    const projectSkillIds = new Set(project.skillsNeeded.map(s => s.skillId));

    // Find matching contacts (not owned by project owner)
    const matchingContacts = await prisma.contact.findMany({
      where: {
        ownerId: { not: project.userId },
        OR: [
          { contactSectors: { some: { sectorId: { in: [...projectSectorIds] } } } },
          { contactSkills: { some: { skillId: { in: [...projectSkillIds] } } } },
        ],
      },
      include: {
        contactSectors: true,
        contactSkills: true,
        owner: true,
      },
      take: 10,
    });

    // Find matching users (not the project owner)
    const matchingUsers = await prisma.user.findMany({
      where: {
        id: { not: project.userId },
        OR: [
          { userSectors: { some: { sectorId: { in: [...projectSectorIds] } } } },
          { userSkills: { some: { skillId: { in: [...projectSkillIds] } } } },
        ],
      },
      include: {
        userSectors: true,
        userSkills: true,
      },
      take: 10,
    });

    // Create contact matches
    for (const contact of matchingContacts) {
      const contactSectorIds = new Set(contact.contactSectors.map(s => s.sectorId));
      const contactSkillIds = new Set(contact.contactSkills.map(s => s.skillId));

      const sectorOverlap = [...projectSectorIds].filter(id => contactSectorIds.has(id));
      const skillOverlap = [...projectSkillIds].filter(id => contactSkillIds.has(id));

      const score = Math.min(100, 30 + sectorOverlap.length * 20 + skillOverlap.length * 15);

      await prisma.projectMatch.create({
        data: {
          id: uuidv4(),
          projectId: project.id,
          matchedContactId: contact.id,
          matchScore: score,
          matchType: 'CONTACT',
          reasons: [`Matches ${sectorOverlap.length} sectors`, `Has ${skillOverlap.length} relevant skills`],
          sharedSectors: sectorOverlap,
          sharedSkills: skillOverlap,
          sharedInterests: [],
          status: 'PENDING',
        },
      }).catch(() => {});

      projectMatchCount++;
    }

    // Create user matches
    for (const matchUser of matchingUsers) {
      const userSectorIds = new Set(matchUser.userSectors.map(s => s.sectorId));
      const userSkillIds = new Set(matchUser.userSkills.map(s => s.skillId));

      const sectorOverlap = [...projectSectorIds].filter(id => userSectorIds.has(id));
      const skillOverlap = [...projectSkillIds].filter(id => userSkillIds.has(id));

      const score = Math.min(100, 35 + sectorOverlap.length * 20 + skillOverlap.length * 15);

      await prisma.projectMatch.create({
        data: {
          id: uuidv4(),
          projectId: project.id,
          matchedUserId: matchUser.id,
          matchScore: score,
          matchType: 'USER',
          reasons: [`Works in ${sectorOverlap.length} matching sectors`, `Has ${skillOverlap.length} relevant skills`],
          sharedSectors: sectorOverlap,
          sharedSkills: skillOverlap,
          sharedInterests: [],
          status: 'PENDING',
        },
      }).catch(() => {});

      projectMatchCount++;
    }

    console.log(`  Project "${project.title}": ${matchingContacts.length} contact matches, ${matchingUsers.length} user matches`);
  }

  console.log(`\nTotal project matches created: ${projectMatchCount}`);

  // ============================================
  // Final Statistics
  // ============================================
  console.log('\n========================================');
  console.log('SEED COMPLETE - Final Statistics');
  console.log('========================================\n');

  const stats = {
    users: await prisma.user.count(),
    contacts: await prisma.contact.count(),
    userSectors: await prisma.userSector.count(),
    userSkills: await prisma.userSkill.count(),
    userGoals: await prisma.userGoal.count(),
    contactSectors: await prisma.contactSector.count(),
    contactSkills: await prisma.contactSkill.count(),
    matchResults: await prisma.matchResult.count(),
    projects: await prisma.project.count(),
    projectMatches: await prisma.projectMatch.count(),
  };

  console.log('Database counts:');
  Object.entries(stats).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  // Match score statistics
  const matchStats = await prisma.matchResult.aggregate({
    _avg: { finalScore: true },
    _min: { finalScore: true },
    _max: { finalScore: true },
  });

  console.log('\nMatch Score Statistics:');
  console.log(`  Average: ${matchStats._avg.finalScore?.toFixed(1) || 0}`);
  console.log(`  Min: ${matchStats._min.finalScore?.toFixed(1) || 0}`);
  console.log(`  Max: ${matchStats._max.finalScore?.toFixed(1) || 0}`);

  // High score distribution
  const highScores = await prisma.matchResult.count({ where: { finalScore: { gte: 50 } } });
  const mediumScores = await prisma.matchResult.count({ where: { finalScore: { gte: 30, lt: 50 } } });
  const lowScores = await prisma.matchResult.count({ where: { finalScore: { lt: 30 } } });

  console.log('\nScore Distribution:');
  console.log(`  High (50+): ${highScores}`);
  console.log(`  Medium (30-49): ${mediumScores}`);
  console.log(`  Low (<30): ${lowScores}`);
}

// Enhanced match score calculation
function calculateEnhancedMatchScore(user: any, contact: any): number {
  const userSectorIds = new Set(user.userSectors.map((s: any) => s.sectorId));
  const userSkillIds = new Set(user.userSkills.map((s: any) => s.skillId));
  const contactSectorIds = new Set(contact.contactSectors.map((s: any) => s.sectorId));
  const contactSkillIds = new Set(contact.contactSkills.map((s: any) => s.skillId));

  // Sector overlap (0-100)
  let sectorScore = 0;
  for (const id of userSectorIds) {
    if (contactSectorIds.has(id)) sectorScore += 30;
  }
  sectorScore = Math.min(100, sectorScore);

  // Skill overlap (0-100)
  let skillScore = 0;
  for (const id of userSkillIds) {
    if (contactSkillIds.has(id)) skillScore += 20;
  }
  skillScore = Math.min(100, skillScore);

  // Goal alignment
  let goalScore = 0;
  const userGoals = user.userGoals || [];
  const contactJobTitle = (contact.jobTitle || '').toLowerCase();

  for (const goal of userGoals) {
    if (goal.goalType === 'MENTORSHIP' && /\b(ceo|cto|director|senior|lead|founder)\b/i.test(contactJobTitle)) {
      goalScore += 40;
    }
    if (goal.goalType === 'INVESTMENT' && /\b(investor|vc|venture|capital|fund)\b/i.test(contactJobTitle)) {
      goalScore += 50;
    }
    if (goal.goalType === 'PARTNERSHIP' && sectorScore > 0) {
      goalScore += 30;
    }
    if (goal.goalType === 'HIRING' && skillScore > 0) {
      goalScore += 25;
    }
    if (goal.goalType === 'COLLABORATION' && (sectorScore > 0 || skillScore > 0)) {
      goalScore += 30;
    }
  }
  goalScore = Math.min(100, goalScore);

  // Recency bonus
  const daysSinceCreated = Math.floor((Date.now() - contact.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.max(0, 100 - daysSinceCreated * 2);

  // Weighted total
  const totalScore = Math.round(
    goalScore * 0.30 +
    sectorScore * 0.25 +
    skillScore * 0.20 +
    recencyScore * 0.10 +
    Math.random() * 15 // Some randomness for variety
  );

  return Math.min(100, Math.max(10, totalScore));
}

function generateReasons(score: number, user: any, contact: any): string[] {
  const reasons: string[] = [];

  const userSectorIds = new Set(user.userSectors.map((s: any) => s.sectorId));
  const contactSectorIds = new Set(contact.contactSectors.map((s: any) => s.sectorId));
  const sharedSectors = [...userSectorIds].filter(id => contactSectorIds.has(id));

  const userSkillIds = new Set(user.userSkills.map((s: any) => s.skillId));
  const contactSkillIds = new Set(contact.contactSkills.map((s: any) => s.skillId));
  const sharedSkills = [...userSkillIds].filter(id => contactSkillIds.has(id));

  if (sharedSectors.length > 0) {
    const sectorNames = user.userSectors
      .filter((s: any) => sharedSectors.includes(s.sectorId))
      .map((s: any) => s.sector?.name)
      .filter(Boolean);
    if (sectorNames.length > 0) {
      reasons.push(`Works in ${sectorNames.slice(0, 2).join(', ')}`);
    }
  }

  if (sharedSkills.length > 0) {
    const skillNames = user.userSkills
      .filter((s: any) => sharedSkills.includes(s.skillId))
      .map((s: any) => s.skill?.name)
      .filter(Boolean);
    if (skillNames.length > 0) {
      reasons.push(`Shares skills: ${skillNames.slice(0, 2).join(', ')}`);
    }
  }

  if (score >= 60) {
    reasons.push('Strong match potential');
  } else if (score >= 40) {
    reasons.push('Good networking opportunity');
  }

  if (reasons.length === 0) {
    reasons.push('Potential connection');
  }

  return reasons;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
