/**
 * Seed script: Create test users with full profiles and join them to the UAE AI Event
 *
 * Usage: npx ts-node scripts/seed-event-attendees.ts
 */

import { PrismaClient, GoalType } from '@prisma/client';
import { hashPassword } from '../src/infrastructure/auth/password';

const prisma = new PrismaClient();

const EVENT_CODE = 'p4o5m3af'; // UAE AI Event

// Test users with diverse profiles for rich matching
const TEST_USERS = [
  {
    email: 'sara.alhamad@test.com',
    firstName: 'Sara',
    lastName: 'Al Hamad',
    fullName: 'Sara Al Hamad',
    jobTitle: 'CTO',
    company: 'Dubai FinTech Hub',
    bio: 'Leading technology transformation in financial services across the GCC region. Building AI-powered solutions for banking and payments.',
    phone: '+971501234001',
    location: 'Dubai, UAE',
    goals: ['HIRING', 'PARTNERSHIP'] as GoalType[],
    sectorNames: ['Finance / Investment', 'Technology Services'],
    skillNames: ['TypeScript', 'Node.js', 'Leadership', 'Financial Analysis'],
    interestNames: ['Data Science', 'Business Strategy', 'Leadership'],
    hobbyNames: ['Reading', 'Yoga', 'Hiking'],
  },
  {
    email: 'ahmed.khouri@test.com',
    firstName: 'Ahmed',
    lastName: 'Khouri',
    fullName: 'Ahmed Khouri',
    jobTitle: 'Machine Learning Engineer',
    company: 'AI Labs Abu Dhabi',
    bio: 'Specializing in NLP and computer vision for Arabic language processing. Looking for startup opportunities in the AI space.',
    phone: '+971501234002',
    location: 'Abu Dhabi, UAE',
    goals: ['JOB_SEEKING', 'COLLABORATION'] as GoalType[],
    sectorNames: ['Technology Services', 'Custom Web & Mobile Software Development'],
    skillNames: ['TensorFlow', 'Natural Language Processing', 'scikit-learn', 'JavaScript'],
    interestNames: ['Data Science', 'Digital Innovation in Creative Industries'],
    hobbyNames: ['Gaming', 'Cycling', 'Reading'],
  },
  {
    email: 'fatima.hassan@test.com',
    firstName: 'Fatima',
    lastName: 'Hassan',
    fullName: 'Fatima Hassan',
    jobTitle: 'Venture Capital Partner',
    company: 'Gulf Ventures Capital',
    bio: 'Investing in early-stage AI and deep-tech startups across MENA. Portfolio includes 15+ companies. Always looking for the next big thing.',
    phone: '+971501234003',
    location: 'Dubai, UAE',
    goals: ['INVESTMENT', 'MENTORSHIP'] as GoalType[],
    sectorNames: ['Finance / Investment', 'Business Development'],
    skillNames: ['Financial Analysis', 'Leadership', 'Sales Management'],
    interestNames: ['Business Strategy', 'Strategic growth and sustainability', 'Business Development Strategies'],
    hobbyNames: ['Golf', 'Tennis', 'Reading'],
  },
  {
    email: 'omar.rashid@test.com',
    firstName: 'Omar',
    lastName: 'Rashid',
    fullName: 'Omar Rashid',
    jobTitle: 'Full Stack Developer',
    company: 'Freelance',
    bio: 'Building web and mobile apps for startups. Expert in React, Node.js, and cloud infrastructure. Looking for co-founder opportunities.',
    phone: '+971501234004',
    location: 'Sharjah, UAE',
    goals: ['COLLABORATION', 'JOB_SEEKING'] as GoalType[],
    sectorNames: ['Custom Web & Mobile Software Development', 'Technology Services'],
    skillNames: ['JavaScript', 'TypeScript', 'Node.js', 'CSS', 'Laravel'],
    interestNames: ['Web3 & Crypto', 'Digital Innovation in Creative Industries', 'User-Centric Design'],
    hobbyNames: ['Gaming', 'Cooking', 'Hiking'],
  },
  {
    email: 'layla.nasser@test.com',
    firstName: 'Layla',
    lastName: 'Nasser',
    fullName: 'Layla Nasser',
    jobTitle: 'Director of Digital Marketing',
    company: 'Emirates Media Group',
    bio: 'Driving digital transformation in media and advertising. Expert in content strategy, SEO, and data-driven marketing campaigns.',
    phone: '+971501234005',
    location: 'Dubai, UAE',
    goals: ['PARTNERSHIP', 'SALES'] as GoalType[],
    sectorNames: ['Digital Marketing', 'Media Production'],
    skillNames: ['Content Marketing', 'Digital Marketing Technology', 'Sales Management', 'Leadership'],
    interestNames: ['Business Development Strategies', 'Leadership', 'Writing'],
    hobbyNames: ['Writing', 'Painting', 'Yoga'],
  },
  {
    email: 'khalid.bin.zayed@test.com',
    firstName: 'Khalid',
    lastName: 'Bin Zayed',
    fullName: 'Khalid Bin Zayed',
    jobTitle: 'CEO & Founder',
    company: 'SmartCity Solutions',
    bio: 'Building smart city infrastructure powered by IoT and AI. Looking for investors and government partners to scale across the GCC.',
    phone: '+971501234006',
    location: 'Abu Dhabi, UAE',
    goals: ['INVESTMENT', 'PARTNERSHIP'] as GoalType[],
    sectorNames: ['Technology Services', 'Infrastructure Engineering'],
    skillNames: ['Executive Leadership', 'Technical Leadership', 'Problem Solving', 'Team Building'],
    interestNames: ['Strategic growth and sustainability', 'Business Strategy', 'Green Materials'],
    hobbyNames: ['Golf', 'Running', 'Meditation'],
  },
  {
    email: 'nadia.salim@test.com',
    firstName: 'Nadia',
    lastName: 'Salim',
    fullName: 'Nadia Salim',
    jobTitle: 'HR Director',
    company: 'TechRecruit MENA',
    bio: 'Connecting top tech talent with leading companies in the Middle East. Specialized in AI, blockchain, and fintech recruitment.',
    phone: '+971501234007',
    location: 'Dubai, UAE',
    goals: ['HIRING', 'LEARNING'] as GoalType[],
    sectorNames: ['Business Development', 'Training'],
    skillNames: ['Team Building', 'Leadership', 'Change Management', 'Operations Improvement'],
    interestNames: ['Leadership', 'Education Reform', 'Mental Health'],
    hobbyNames: ['Yoga', 'Volunteering', 'Reading'],
  },
  {
    email: 'youssef.mansour@test.com',
    firstName: 'Youssef',
    lastName: 'Mansour',
    fullName: 'Youssef Mansour',
    jobTitle: 'Data Scientist',
    company: 'Careem (Uber)',
    bio: 'Working on recommendation systems and demand prediction. Passionate about applying ML to real-world transportation and logistics problems.',
    phone: '+971501234008',
    location: 'Dubai, UAE',
    goals: ['MENTORSHIP', 'COLLABORATION'] as GoalType[],
    sectorNames: ['Technology Services', 'Custom Web & Mobile Software Development'],
    skillNames: ['TensorFlow', 'scikit-learn', 'Natural Language Processing', 'TypeScript'],
    interestNames: ['Data Science', 'User-Centric Design'],
    hobbyNames: ['Cycling', 'Language Learning', 'Cooking'],
  },
  {
    email: 'reem.abdullah@test.com',
    firstName: 'Reem',
    lastName: 'Abdullah',
    fullName: 'Reem Abdullah',
    jobTitle: 'Product Manager',
    company: 'Noon.com',
    bio: 'Managing e-commerce platform features for millions of users. Focused on AI-powered personalization and search optimization.',
    phone: '+971501234009',
    location: 'Dubai, UAE',
    goals: ['LEARNING', 'COLLABORATION'] as GoalType[],
    sectorNames: ['Technology Services', 'Digital Marketing'],
    skillNames: ['Leadership', 'Problem Solving', 'Content Marketing', 'JavaScript'],
    interestNames: ['User-Centric Design', 'Data Science', 'Business Strategy'],
    hobbyNames: ['Reading', 'Hiking', 'Crafts & DIY'],
  },
  {
    email: 'tariq.abdelrahman@test.com',
    firstName: 'Tariq',
    lastName: 'Abdelrahman',
    fullName: 'Tariq Abdelrahman',
    jobTitle: 'Blockchain Developer',
    company: 'Web3 Arabia',
    bio: 'Building decentralized applications and smart contracts. Interested in DeFi, NFTs, and blockchain for government services.',
    phone: '+971501234010',
    location: 'Dubai, UAE',
    goals: ['PARTNERSHIP', 'INVESTMENT'] as GoalType[],
    sectorNames: ['Technology Services', 'Finance / Investment'],
    skillNames: ['JavaScript', 'TypeScript', 'Node.js', 'Problem Solving'],
    interestNames: ['Web3 & Crypto', 'Business Strategy', 'Digital Innovation in Creative Industries'],
    hobbyNames: ['Gaming', 'Surfing', 'Running'],
  },
];

async function findOrCreateRecord(
  model: 'sector' | 'skill' | 'interest' | 'hobby',
  name: string
): Promise<string> {
  const existing = await (prisma as any)[model].findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await (prisma as any)[model].create({ data: { name } });
  return created.id;
}

async function main() {
  console.log('Finding UAE AI Event...');
  const event = await prisma.event.findUnique({ where: { uniqueCode: EVENT_CODE } });
  if (!event) {
    console.error(`Event with code ${EVENT_CODE} not found!`);
    process.exit(1);
  }
  console.log(`Found event: ${event.name} (${event.id})`);

  const password = await hashPassword('Test1234');

  for (const userData of TEST_USERS) {
    console.log(`\nProcessing ${userData.fullName}...`);

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email: userData.email } });

    if (user) {
      console.log(`  User already exists, skipping creation.`);
    } else {
      // Create user
      user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash: password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          fullName: userData.fullName,
          jobTitle: userData.jobTitle,
          company: userData.company,
          bio: userData.bio,
          phone: userData.phone,
          location: userData.location,
          emailVerified: true,
          isActive: true,
          onboardingStep: 99,
          onboardingCompletedAt: new Date(),
        },
      });
      console.log(`  Created user: ${user.id}`);
    }

    // Add goals
    for (const goalType of userData.goals) {
      await prisma.userGoal.upsert({
        where: { id: `${user.id}-${goalType}` },
        update: {},
        create: { userId: user.id, goalType, priority: 1 },
      }).catch(async () => {
        // If unique constraint fails, try finding existing
        const existing = await prisma.userGoal.findFirst({
          where: { userId: user!.id, goalType },
        });
        if (!existing) {
          await prisma.userGoal.create({ data: { userId: user!.id, goalType, priority: 1 } });
        }
      });
    }
    console.log(`  Goals: ${userData.goals.join(', ')}`);

    // Add sectors
    for (const sectorName of userData.sectorNames) {
      const sectorId = await findOrCreateRecord('sector', sectorName);
      await prisma.userSector.upsert({
        where: { userId_sectorId: { userId: user.id, sectorId } },
        update: {},
        create: { userId: user.id, sectorId },
      });
    }
    console.log(`  Sectors: ${userData.sectorNames.join(', ')}`);

    // Add skills
    for (const skillName of userData.skillNames) {
      const skillId = await findOrCreateRecord('skill', skillName);
      await prisma.userSkill.upsert({
        where: { userId_skillId: { userId: user.id, skillId } },
        update: {},
        create: { userId: user.id, skillId },
      });
    }
    console.log(`  Skills: ${userData.skillNames.join(', ')}`);

    // Add interests
    for (const interestName of userData.interestNames) {
      const interestId = await findOrCreateRecord('interest', interestName);
      await prisma.userInterest.upsert({
        where: { userId_interestId: { userId: user.id, interestId } },
        update: {},
        create: { userId: user.id, interestId },
      });
    }
    console.log(`  Interests: ${userData.interestNames.join(', ')}`);

    // Add hobbies
    for (const hobbyName of userData.hobbyNames) {
      const hobbyId = await findOrCreateRecord('hobby', hobbyName);
      await prisma.userHobby.upsert({
        where: { userId_hobbyId: { userId: user.id, hobbyId } },
        update: {},
        create: { userId: user.id, hobbyId },
      });
    }
    console.log(`  Hobbies: ${userData.hobbyNames.join(', ')}`);

    // Join event as attendee
    const existingAttendee = await prisma.eventAttendee.findFirst({
      where: { eventId: event.id, userId: user.id },
    });

    if (existingAttendee) {
      console.log(`  Already attending event.`);
    } else {
      // Build lookingFor from goals + skills + interests
      const lookingFor = [
        ...userData.goals.map(g => g.replace(/_/g, ' ')),
        ...userData.skillNames,
        ...userData.interestNames,
      ].join(', ');

      await prisma.eventAttendee.create({
        data: {
          eventId: event.id,
          userId: user.id,
          email: userData.email,
          name: userData.fullName,
          mobile: userData.phone,
          company: userData.company,
          role: userData.jobTitle,
          bio: userData.bio,
          lookingFor,
        },
      });
      console.log(`  Joined event as attendee.`);
    }
  }

  // Now run matching between all attendees
  console.log('\n\nRunning matching between all attendees...');

  const attendees = await prisma.eventAttendee.findMany({
    where: { eventId: event.id, userId: { not: null } },
  });

  const userIds = attendees.map(a => a.userId!).filter(Boolean);

  // Load all user profiles
  const userProfiles = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: {
      userGoals: true,
      userSectors: { include: { sector: true } },
      userSkills: { include: { skill: true } },
      userInterests: { include: { interest: true } },
      userHobbies: { include: { hobby: true } },
    },
  });

  const profileMap = new Map(userProfiles.map(u => [u.id, u]));

  // Delete existing matches for clean results
  await prisma.eventAttendeeMatch.deleteMany({
    where: { attendee: { eventId: event.id } },
  });
  console.log('Cleared old matches.');

  // Calculate matches for each pair
  let matchCount = 0;
  const matchData: any[] = [];

  for (let i = 0; i < attendees.length; i++) {
    for (let j = i + 1; j < attendees.length; j++) {
      const a1 = attendees[i];
      const a2 = attendees[j];
      if (!a1.userId || !a2.userId) continue;

      const p1 = profileMap.get(a1.userId);
      const p2 = profileMap.get(a2.userId);
      if (!p1 || !p2) continue;

      const { score, level, reasons } = calculateEventMatchScore(p1, p2);

      // Bidirectional
      matchData.push({
        attendeeId: a1.id,
        matchedAttendeeId: a2.id,
        matchLevel: level,
        score,
        reasons: JSON.stringify(reasons),
      });
      matchData.push({
        attendeeId: a2.id,
        matchedAttendeeId: a1.id,
        matchLevel: level,
        score,
        reasons: JSON.stringify(reasons),
      });

      matchCount++;
      console.log(`  ${a1.name} ↔ ${a2.name}: ${level} (${score}) - ${reasons.join(', ')}`);
    }
  }

  if (matchData.length > 0) {
    await prisma.eventAttendeeMatch.createMany({
      data: matchData,
      skipDuplicates: true,
    });
  }

  console.log(`\nDone! Created ${matchCount} match pairs (${matchData.length} records).`);
  console.log(`\nTest with: https://intellmatch.com/e/${EVENT_CODE}`);
  console.log('Login: any email above / password: Test1234');

  await prisma.$disconnect();
}

// ========== Matching functions (same as EventController) ==========

const SENIOR_ROLE_PATTERNS = [
  /\b(ceo|cto|cfo|coo|cmo|cio|chief)\b/i,
  /\b(president|vp|vice\s*president)\b/i,
  /\b(director|head\s+of|lead)\b/i,
  /\b(senior|sr\.?|principal|staff)\b/i,
  /\b(founder|co-?founder|partner)\b/i,
];

const INVESTOR_ROLE_PATTERNS = [
  /\b(investor|venture\s*capital|vc)\b/i,
  /\b(angel|seed|funding)\b/i,
  /\b(portfolio|investment|fund)\b/i,
];

const HIRING_ROLE_PATTERNS = [
  /\b(recruiter|recruiting|talent)\b/i,
  /\b(hr|human\s*resources)\b/i,
  /\b(hiring\s*manager)\b/i,
];

const COMPLEMENTARY_SKILLS: Record<string, string[]> = {
  'Sales': ['Marketing', 'Business Development', 'Communication'],
  'Marketing': ['Sales', 'Content', 'Analytics', 'Social Media'],
  'Frontend Development': ['Backend Development', 'UI/UX Design', 'DevOps'],
  'Backend Development': ['Frontend Development', 'DevOps', 'Cloud'],
  'Data Analysis': ['Data Science', 'Machine Learning'],
  'Data Science': ['Machine Learning', 'AI', 'Python'],
  'Machine Learning': ['Data Science', 'AI', 'Deep Learning'],
  'AI': ['Machine Learning', 'Data Science', 'NLP'],
  'UI/UX Design': ['Product Design', 'Frontend Development'],
  'Product Management': ['Engineering', 'Design', 'Marketing'],
  'Leadership': ['Management', 'Strategy', 'Team Building'],
  'Content Marketing': ['Digital Marketing Technology', 'Sales Management', 'SEO'],
  'Digital Marketing Technology': ['Content Marketing', 'Sales Management'],
  'Financial Analysis': ['Leadership', 'Sales Management'],
  'Node.js': ['TypeScript', 'JavaScript', 'CSS'],
  'TypeScript': ['JavaScript', 'Node.js'],
  'JavaScript': ['TypeScript', 'Node.js', 'CSS'],
};

const EVENT_MATCH_WEIGHTS = {
  goalAlignment: 0.30,
  sector: 0.20,
  skill: 0.18,
  complementarySkills: 0.12,
  interest: 0.10,
  hobby: 0.10,
};

function calculateSetOverlap(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 || set2.size === 0) return 0;
  let overlap = 0;
  for (const item of set1) { if (set2.has(item)) overlap++; }
  return overlap / (set1.size + set2.size - overlap);
}

function hasComplementarySkills(skills1: string[], skills2: string[]): boolean {
  const n2 = skills2.map(s => s.toLowerCase());
  for (const skill of skills1) {
    for (const c of (COMPLEMENTARY_SKILLS[skill] || [])) {
      if (n2.some(cs => cs.includes(c.toLowerCase()))) return true;
    }
  }
  return false;
}

function calculateComplementarySkillsScore(skills1: string[], skills2: string[]): number {
  if (skills1.length === 0 || skills2.length === 0) return 0;
  let matches = 0;
  const n2 = skills2.map(s => s.toLowerCase());
  for (const skill of skills1) {
    for (const c of (COMPLEMENTARY_SKILLS[skill] || [])) {
      if (n2.some(cs => cs.includes(c.toLowerCase()))) matches++;
    }
  }
  return Math.min(100, matches * 25);
}

function calculateEventMatchScore(user1: any, user2: any): { score: number; level: string; reasons: string[] } {
  const u1SectorIds = new Set<string>((user1.userSectors || []).map((s: any) => s.sectorId));
  const u2SectorIds = new Set<string>((user2.userSectors || []).map((s: any) => s.sectorId));
  const u1SkillIds = new Set<string>((user1.userSkills || []).map((s: any) => s.skillId));
  const u2SkillIds = new Set<string>((user2.userSkills || []).map((s: any) => s.skillId));
  const u1InterestIds = new Set<string>((user1.userInterests || []).map((i: any) => i.interestId));
  const u2InterestIds = new Set<string>((user2.userInterests || []).map((i: any) => i.interestId));
  const u1HobbyIds = new Set<string>((user1.userHobbies || []).map((h: any) => h.hobbyId));
  const u2HobbyIds = new Set<string>((user2.userHobbies || []).map((h: any) => h.hobbyId));

  const u1SkillNames = (user1.userSkills || []).map((s: any) => s.skill?.name || '').filter(Boolean);
  const u2SkillNames = (user2.userSkills || []).map((s: any) => s.skill?.name || '').filter(Boolean);
  const u1Goals = (user1.userGoals || []).map((g: any) => g.goalType);
  const u2Goals = (user2.userGoals || []).map((g: any) => g.goalType);

  // Goal alignment
  const goalResult = calculateGoalAlignment(u1Goals, u2Goals, user1.jobTitle || '', user2.jobTitle || '', u1SectorIds, u2SectorIds, u1SkillNames, u2SkillNames);
  const sectorScore = calculateSetOverlap(u1SectorIds, u2SectorIds) * 100;
  const skillScore = calculateSetOverlap(u1SkillIds, u2SkillIds) * 100;
  const compSkillScore = calculateComplementarySkillsScore(u1SkillNames, u2SkillNames);
  const interestScore = calculateSetOverlap(u1InterestIds, u2InterestIds) * 100;
  const hobbyScore = calculateSetOverlap(u1HobbyIds, u2HobbyIds) * 100;

  const totalScore = Math.min(100, Math.round(
    goalResult.score * EVENT_MATCH_WEIGHTS.goalAlignment +
    sectorScore * EVENT_MATCH_WEIGHTS.sector +
    skillScore * EVENT_MATCH_WEIGHTS.skill +
    compSkillScore * EVENT_MATCH_WEIGHTS.complementarySkills +
    interestScore * EVENT_MATCH_WEIGHTS.interest +
    hobbyScore * EVENT_MATCH_WEIGHTS.hobby
  ));

  const reasons = [...goalResult.reasons];
  if (sectorScore > 0) {
    const shared = (user1.userSectors || []).filter((s: any) => u2SectorIds.has(s.sectorId)).map((s: any) => s.sector?.name).filter(Boolean).slice(0, 3);
    if (shared.length > 0) reasons.push(`Shared sectors: ${shared.join(', ')}`);
  }
  if (skillScore > 0) {
    const shared = (user1.userSkills || []).filter((s: any) => u2SkillIds.has(s.skillId)).map((s: any) => s.skill?.name).filter(Boolean).slice(0, 3);
    if (shared.length > 0) reasons.push(`Shared skills: ${shared.join(', ')}`);
  }

  let level: string;
  if (totalScore >= 40) level = 'HIGH';
  else if (totalScore >= 20) level = 'MEDIUM';
  else level = 'LOW';

  return { score: totalScore, level, reasons: reasons.slice(0, 5) };
}

function calculateGoalAlignment(
  g1: string[], g2: string[], jt1: string, jt2: string,
  s1: Set<string>, s2: Set<string>, sk1: string[], sk2: string[],
): { score: number; reasons: string[] } {
  if (g1.length === 0 && g2.length === 0) return { score: 0, reasons: [] };

  let totalScore = 0;
  const reasons: string[] = [];
  const hasSameSector = [...s1].some(id => s2.has(id));
  const hasCompSkills = hasComplementarySkills(sk1, sk2);

  const pairs: [string, string, number, string][] = [
    ['HIRING', 'JOB_SEEKING', 80, 'Hiring meets Job Seeker'],
    ['JOB_SEEKING', 'HIRING', 80, 'Job Seeker meets Hiring'],
    ['INVESTMENT', 'PARTNERSHIP', 70, 'Investor meets Entrepreneur'],
    ['PARTNERSHIP', 'INVESTMENT', 70, 'Entrepreneur meets Investor'],
    ['MENTORSHIP', 'LEARNING', 60, 'Mentor meets Learner'],
    ['LEARNING', 'MENTORSHIP', 60, 'Learner meets Mentor'],
    ['COLLABORATION', 'COLLABORATION', 60, 'Both seeking collaboration'],
    ['SALES', 'PARTNERSHIP', 50, 'Sales meets Business Partner'],
    ['PARTNERSHIP', 'SALES', 50, 'Business Partner meets Sales'],
  ];

  for (const goal1 of g1) {
    for (const goal2 of g2) {
      const match = pairs.find(([a, b]) => a === goal1 && b === goal2);
      if (match) { totalScore = Math.max(totalScore, match[2]); reasons.push(match[3]); }
      if (goal1 === goal2 && !match) { totalScore = Math.max(totalScore, 40); reasons.push(`Shared goal: ${goal1.replace(/_/g, ' ')}`); }
    }
  }

  if (totalScore > 0 && hasSameSector) { totalScore = Math.min(100, totalScore + 15); reasons.push('Same industry'); }
  if (totalScore > 0 && hasCompSkills) { totalScore = Math.min(100, totalScore + 10); reasons.push('Complementary skills'); }

  if (totalScore === 0) {
    const isSenior1 = SENIOR_ROLE_PATTERNS.some(p => p.test(jt1));
    const isSenior2 = SENIOR_ROLE_PATTERNS.some(p => p.test(jt2));
    const isInvestor1 = INVESTOR_ROLE_PATTERNS.some(p => p.test(jt1));
    const isInvestor2 = INVESTOR_ROLE_PATTERNS.some(p => p.test(jt2));
    if ((isSenior1 !== isSenior2) && hasSameSector) { totalScore = 30; reasons.push('Senior professional in same industry'); }
    if (isInvestor1 !== isInvestor2) { totalScore = Math.max(totalScore, 35); reasons.push('Potential investor connection'); }
  }

  return { score: totalScore, reasons: [...new Set(reasons)].slice(0, 3) };
}

main().catch(console.error);
