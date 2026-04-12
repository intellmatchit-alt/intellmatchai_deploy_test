/**
 * Seed script: Create an AI event hosted by matchtest2@p2p.test
 * with 12 diverse attendees and rich matching data.
 *
 * Usage: npx ts-node scripts/seed-event-for-matchtest2.ts
 */

import { PrismaClient, GoalType, EventMatchLevel } from '@prisma/client';
import { hashPassword } from '../src/infrastructure/auth/password';
import crypto from 'crypto';

const prisma = new PrismaClient();

const HOST_EMAIL = 'matchtest2@p2p.test';

const EVENT_CODE = 'mt2ev' + crypto.randomBytes(2).toString('hex').slice(0, 3); // 8 chars

const ATTENDEES = [
  {
    email: 'sarah.chen@eventtest.com',
    firstName: 'Sarah',
    lastName: 'Chen',
    fullName: 'Sarah Chen',
    jobTitle: 'AI Research Lead',
    company: 'DeepMind Labs',
    bio: 'Leading research in reinforcement learning and multi-agent systems. Published 20+ papers in top AI conferences. Building AI that can reason and plan.',
    phone: '+14155551001',
    location: 'San Francisco, USA',
    goals: ['COLLABORATION', 'MENTORSHIP'] as GoalType[],
    sectorNames: ['Technology Services', 'Custom Web & Mobile Software Development'],
    skillNames: ['TensorFlow', 'Natural Language Processing', 'scikit-learn', 'Leadership'],
    interestNames: ['Data Science', 'Digital Innovation in Creative Industries', 'Education Reform'],
    hobbyNames: ['Reading', 'Hiking', 'Meditation'],
    lookingFor: 'Looking for collaboration on applied AI research, startup co-founders with deep tech background, and mentoring junior researchers.',
  },
  {
    email: 'marcus.johnson@eventtest.com',
    firstName: 'Marcus',
    lastName: 'Johnson',
    fullName: 'Marcus Johnson',
    jobTitle: 'Venture Capital Partner',
    company: 'Horizon Ventures',
    bio: 'Investing in early-stage AI and climate-tech startups. $500M fund focused on transformative technology. Board member of 8 portfolio companies.',
    phone: '+14155551002',
    location: 'New York, USA',
    goals: ['INVESTMENT', 'PARTNERSHIP'] as GoalType[],
    sectorNames: ['Finance / Investment', 'Business Development'],
    skillNames: ['Financial Analysis', 'Leadership', 'Sales Management', 'Executive Leadership'],
    interestNames: ['Business Strategy', 'Strategic growth and sustainability', 'Business Development Strategies'],
    hobbyNames: ['Golf', 'Tennis', 'Wine Tasting'],
    lookingFor: 'Seeking AI startups in Series A/B stage, founders with technical depth, and co-investment opportunities with other VCs.',
  },
  {
    email: 'aisha.rahman@eventtest.com',
    firstName: 'Aisha',
    lastName: 'Rahman',
    fullName: 'Aisha Rahman',
    jobTitle: 'Full Stack Developer',
    company: 'Freelance',
    bio: 'Building SaaS products for startups. 8 years experience in React, Node.js, and cloud infrastructure. Want to join an AI startup as a technical co-founder.',
    phone: '+14155551003',
    location: 'Dubai, UAE',
    goals: ['JOB_SEEKING', 'COLLABORATION'] as GoalType[],
    sectorNames: ['Custom Web & Mobile Software Development', 'Technology Services'],
    skillNames: ['JavaScript', 'TypeScript', 'Node.js', 'CSS', 'Laravel'],
    interestNames: ['Web3 & Crypto', 'User-Centric Design', 'Digital Innovation in Creative Industries'],
    hobbyNames: ['Gaming', 'Cooking', 'Photography'],
    lookingFor: 'Looking for CTO or technical co-founder role at an AI startup, or freelance contracts for building AI-powered web apps.',
  },
  {
    email: 'david.mueller@eventtest.com',
    firstName: 'David',
    lastName: 'Mueller',
    fullName: 'David Mueller',
    jobTitle: 'CEO & Founder',
    company: 'GreenAI Solutions',
    bio: 'Building AI-powered carbon tracking platform for enterprises. Series A startup with 30 employees. Need ML engineers and strategic partners.',
    phone: '+14155551004',
    location: 'Berlin, Germany',
    goals: ['HIRING', 'INVESTMENT'] as GoalType[],
    sectorNames: ['Technology Services', 'Infrastructure Engineering'],
    skillNames: ['Executive Leadership', 'Technical Leadership', 'Problem Solving', 'Team Building'],
    interestNames: ['Strategic growth and sustainability', 'Green Materials', 'Business Strategy'],
    hobbyNames: ['Cycling', 'Running', 'Meditation'],
    lookingFor: 'Hiring ML engineers and data scientists. Also seeking Series B investors and strategic partnerships with enterprise sustainability teams.',
  },
  {
    email: 'priya.patel@eventtest.com',
    firstName: 'Priya',
    lastName: 'Patel',
    fullName: 'Priya Patel',
    jobTitle: 'Product Manager',
    company: 'Microsoft Azure AI',
    bio: 'Leading product strategy for Azure Cognitive Services. Passionate about making AI accessible to every developer. Previously at Google Cloud.',
    phone: '+14155551005',
    location: 'Seattle, USA',
    goals: ['PARTNERSHIP', 'LEARNING'] as GoalType[],
    sectorNames: ['Technology Services', 'Digital Marketing'],
    skillNames: ['Leadership', 'Problem Solving', 'Content Marketing', 'Team Building'],
    interestNames: ['User-Centric Design', 'Data Science', 'Business Strategy'],
    hobbyNames: ['Yoga', 'Reading', 'Painting'],
    lookingFor: 'Want to connect with AI startup founders for partnership opportunities, learn about cutting-edge AI applications, and meet product leaders.',
  },
  {
    email: 'james.okonkwo@eventtest.com',
    firstName: 'James',
    lastName: 'Okonkwo',
    fullName: 'James Okonkwo',
    jobTitle: 'Machine Learning Engineer',
    company: 'HealthAI Inc',
    bio: 'Developing AI models for medical image analysis and drug discovery. PhD in Computer Science from MIT. Looking for my next challenge.',
    phone: '+14155551006',
    location: 'Boston, USA',
    goals: ['JOB_SEEKING', 'LEARNING'] as GoalType[],
    sectorNames: ['Technology Services', 'Life Science / Pharmaceutical'],
    skillNames: ['TensorFlow', 'Natural Language Processing', 'scikit-learn', 'TypeScript'],
    interestNames: ['Data Science', 'Mental Health', 'Education Reform'],
    hobbyNames: ['Running', 'Chess', 'Volunteering'],
    lookingFor: 'Seeking senior ML engineer or research scientist positions at AI-first companies. Interested in healthcare AI and NLP roles.',
  },
  {
    email: 'elena.volkov@eventtest.com',
    firstName: 'Elena',
    lastName: 'Volkov',
    fullName: 'Elena Volkov',
    jobTitle: 'Director of Sales',
    company: 'DataRobot',
    bio: 'Scaling enterprise AI sales across EMEA. 15 years in B2B SaaS. Expert in building sales teams from scratch and closing $1M+ deals.',
    phone: '+14155551007',
    location: 'London, UK',
    goals: ['SALES', 'PARTNERSHIP'] as GoalType[],
    sectorNames: ['Business Development', 'Digital Marketing'],
    skillNames: ['Sales Management', 'Leadership', 'Content Marketing', 'Digital Marketing Technology'],
    interestNames: ['Business Development Strategies', 'Leadership', 'Writing'],
    hobbyNames: ['Writing', 'Wine Tasting', 'Tennis'],
    lookingFor: 'Looking for AI startups needing sales leadership, partnership opportunities with complementary tech companies, and enterprise clients.',
  },
  {
    email: 'yuki.tanaka@eventtest.com',
    firstName: 'Yuki',
    lastName: 'Tanaka',
    fullName: 'Yuki Tanaka',
    jobTitle: 'Data Scientist',
    company: 'Toyota Research Institute',
    bio: 'Working on autonomous driving perception systems and predictive maintenance AI. Strong background in computer vision and time-series analysis.',
    phone: '+14155551008',
    location: 'Tokyo, Japan',
    goals: ['COLLABORATION', 'MENTORSHIP'] as GoalType[],
    sectorNames: ['Technology Services', 'Automotive'],
    skillNames: ['TensorFlow', 'scikit-learn', 'Natural Language Processing', 'Problem Solving'],
    interestNames: ['Data Science', 'User-Centric Design', 'Strategic growth and sustainability'],
    hobbyNames: ['Photography', 'Cycling', 'Cooking'],
    lookingFor: 'Seeking collaborators for open-source AI projects, mentorship for junior data scientists, and cross-industry AI research partnerships.',
  },
  {
    email: 'carlos.rivera@eventtest.com',
    firstName: 'Carlos',
    lastName: 'Rivera',
    fullName: 'Carlos Rivera',
    jobTitle: 'CTO',
    company: 'FinBot AI',
    bio: 'Building conversational AI for financial advisory. YC W24 batch. Raised $5M seed. Need to scale engineering team from 8 to 25 people.',
    phone: '+14155551009',
    location: 'Miami, USA',
    goals: ['HIRING', 'PARTNERSHIP'] as GoalType[],
    sectorNames: ['Finance / Investment', 'Technology Services'],
    skillNames: ['TypeScript', 'Node.js', 'Leadership', 'Technical Leadership'],
    interestNames: ['Business Strategy', 'Data Science', 'Web3 & Crypto'],
    hobbyNames: ['Surfing', 'Gaming', 'Running'],
    lookingFor: 'Hiring senior engineers (full-stack, ML, NLP). Looking for banking API partners and enterprise pilot customers.',
  },
  {
    email: 'nina.berg@eventtest.com',
    firstName: 'Nina',
    lastName: 'Berg',
    fullName: 'Nina Berg',
    jobTitle: 'HR Tech Consultant',
    company: 'PeopleFirst Consulting',
    bio: 'Helping companies implement AI in recruitment and talent management. Advisor to 5 HR-tech startups. Expert in AI ethics and bias mitigation.',
    phone: '+14155551010',
    location: 'Stockholm, Sweden',
    goals: ['MENTORSHIP', 'SALES'] as GoalType[],
    sectorNames: ['Business Development', 'Training'],
    skillNames: ['Change Management', 'Leadership', 'Team Building', 'Operations Improvement'],
    interestNames: ['Leadership', 'Education Reform', 'Mental Health'],
    hobbyNames: ['Yoga', 'Hiking', 'Volunteering'],
    lookingFor: 'Looking for AI startups that need HR-tech advisory, companies wanting to implement ethical AI hiring, and speaking opportunities.',
  },
  {
    email: 'raj.sharma@eventtest.com',
    firstName: 'Raj',
    lastName: 'Sharma',
    fullName: 'Raj Sharma',
    jobTitle: 'Blockchain & AI Developer',
    company: 'Web3 Nexus',
    bio: 'Building decentralized AI marketplaces. Combining blockchain with federated learning for privacy-preserving AI. 12 years in tech.',
    phone: '+14155551011',
    location: 'Bangalore, India',
    goals: ['PARTNERSHIP', 'INVESTMENT'] as GoalType[],
    sectorNames: ['Technology Services', 'Finance / Investment'],
    skillNames: ['JavaScript', 'TypeScript', 'Node.js', 'Problem Solving'],
    interestNames: ['Web3 & Crypto', 'Data Science', 'Digital Innovation in Creative Industries'],
    hobbyNames: ['Gaming', 'Chess', 'Cycling'],
    lookingFor: 'Seeking investors for decentralized AI platform, strategic partners in enterprise blockchain, and co-development opportunities.',
  },
  {
    email: 'lisa.anderson@eventtest.com',
    firstName: 'Lisa',
    lastName: 'Anderson',
    fullName: 'Lisa Anderson',
    jobTitle: 'Chief Marketing Officer',
    company: 'AI Marketing Hub',
    bio: 'Pioneer in AI-driven marketing automation. Built marketing teams at 3 unicorn startups. Speaker at 50+ conferences on AI in marketing.',
    phone: '+14155551012',
    location: 'Austin, USA',
    goals: ['SALES', 'COLLABORATION'] as GoalType[],
    sectorNames: ['Digital Marketing', 'Media Production'],
    skillNames: ['Content Marketing', 'Digital Marketing Technology', 'Sales Management', 'Leadership'],
    interestNames: ['Business Development Strategies', 'Writing', 'User-Centric Design'],
    hobbyNames: ['Writing', 'Painting', 'Yoga'],
    lookingFor: 'Want to find AI startups needing marketing leadership, agencies for partnership on AI marketing tools, and content collaboration.',
  },
];

// ========== Matching functions ==========

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
  'TensorFlow': ['scikit-learn', 'Natural Language Processing'],
  'Natural Language Processing': ['TensorFlow', 'scikit-learn'],
  'Sales Management': ['Content Marketing', 'Leadership'],
  'Technical Leadership': ['Executive Leadership', 'Team Building'],
  'Executive Leadership': ['Technical Leadership', 'Leadership'],
};

const GOAL_PAIR_SCORES: Record<string, number> = {
  'HIRING-JOB_SEEKING': 80,
  'JOB_SEEKING-HIRING': 80,
  'INVESTMENT-PARTNERSHIP': 70,
  'PARTNERSHIP-INVESTMENT': 70,
  'MENTORSHIP-LEARNING': 60,
  'LEARNING-MENTORSHIP': 60,
  'COLLABORATION-COLLABORATION': 60,
  'SALES-PARTNERSHIP': 50,
  'PARTNERSHIP-SALES': 50,
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

function calculateEventMatchScore(user1: any, user2: any): { score: number; level: EventMatchLevel; reasons: string[] } {
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
  let goalScore = 0;
  const reasons: string[] = [];
  for (const g1 of u1Goals) {
    for (const g2 of u2Goals) {
      const key = `${g1}-${g2}`;
      if (GOAL_PAIR_SCORES[key]) {
        goalScore = Math.max(goalScore, GOAL_PAIR_SCORES[key]);
        if (g1 === 'HIRING' && g2 === 'JOB_SEEKING') reasons.push(`${user1.fullName} is hiring, ${user2.fullName} is seeking opportunities`);
        else if (g1 === 'JOB_SEEKING' && g2 === 'HIRING') reasons.push(`${user2.fullName} is hiring, ${user1.fullName} is seeking opportunities`);
        else if (g1 === 'INVESTMENT' && g2 === 'PARTNERSHIP') reasons.push('Investment meets partnership opportunity');
        else if (g1 === 'MENTORSHIP' && g2 === 'LEARNING') reasons.push('Mentorship meets learning goals');
        else if (g1 === 'LEARNING' && g2 === 'MENTORSHIP') reasons.push('Learning meets mentorship goals');
        else if (g1 === 'COLLABORATION') reasons.push('Both interested in collaboration');
        else reasons.push(`Complementary goals: ${g1.replace(/_/g, ' ')} + ${g2.replace(/_/g, ' ')}`);
      }
    }
  }

  // Sector overlap
  const sectorOverlap = calculateSetOverlap(u1SectorIds, u2SectorIds);
  if (sectorOverlap > 0) {
    const shared = (user1.userSectors || [])
      .filter((s: any) => u2SectorIds.has(s.sectorId))
      .map((s: any) => s.sector?.name).filter(Boolean);
    if (shared.length > 0) reasons.push(`Shared sectors: ${shared.join(', ')}`);
  }

  // Skill overlap
  const skillOverlap = calculateSetOverlap(u1SkillIds, u2SkillIds);
  if (skillOverlap > 0) {
    const shared = (user1.userSkills || [])
      .filter((s: any) => u2SkillIds.has(s.skillId))
      .map((s: any) => s.skill?.name).filter(Boolean);
    if (shared.length > 0) reasons.push(`Shared skills: ${shared.join(', ')}`);
  }

  // Complementary skills
  const compScore = calculateComplementarySkillsScore(u1SkillNames, u2SkillNames);
  if (compScore > 0) reasons.push('Complementary skill sets');

  // Interest overlap
  const interestOverlap = calculateSetOverlap(u1InterestIds, u2InterestIds);
  if (interestOverlap > 0) {
    const shared = (user1.userInterests || [])
      .filter((i: any) => u2InterestIds.has(i.interestId))
      .map((i: any) => i.interest?.name).filter(Boolean);
    if (shared.length > 0) reasons.push(`Shared interests: ${shared.join(', ')}`);
  }

  // Hobby overlap
  const hobbyOverlap = calculateSetOverlap(u1HobbyIds, u2HobbyIds);
  if (hobbyOverlap > 0) {
    const shared = (user1.userHobbies || [])
      .filter((h: any) => u2HobbyIds.has(h.hobbyId))
      .map((h: any) => h.hobby?.name).filter(Boolean);
    if (shared.length > 0) reasons.push(`Shared hobbies: ${shared.join(', ')}`);
  }

  const rawScore =
    goalScore * EVENT_MATCH_WEIGHTS.goalAlignment +
    (sectorOverlap * 100) * EVENT_MATCH_WEIGHTS.sector +
    (skillOverlap * 100) * EVENT_MATCH_WEIGHTS.skill +
    compScore * EVENT_MATCH_WEIGHTS.complementarySkills +
    (interestOverlap * 100) * EVENT_MATCH_WEIGHTS.interest +
    (hobbyOverlap * 100) * EVENT_MATCH_WEIGHTS.hobby;

  const score = Math.round(Math.min(100, rawScore));
  const level: EventMatchLevel = score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';

  if (reasons.length === 0) reasons.push('General networking opportunity');

  return { score, level, reasons };
}

// ========== Helpers ==========

async function findOrCreateRecord(
  model: 'sector' | 'skill' | 'interest' | 'hobby',
  name: string
): Promise<string> {
  const existing = await (prisma as any)[model].findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await (prisma as any)[model].create({ data: { name } });
  return created.id;
}

// ========== Main ==========

async function main() {
  console.log(`\n=== Seeding AI Event for ${HOST_EMAIL} ===\n`);

  // 1. Find the host user
  const host = await prisma.user.findUnique({ where: { email: HOST_EMAIL } });
  if (!host) {
    console.error(`User ${HOST_EMAIL} not found! Create the account first.`);
    process.exit(1);
  }
  console.log(`Host: ${host.fullName} (${host.id})`);

  // 2. Create the event
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 7); // 1 week from now

  const event = await prisma.event.create({
    data: {
      hostId: host.id,
      name: 'AI Innovation Summit 2026',
      description: 'A premier networking event bringing together AI researchers, engineers, founders, and investors. Join us for a day of lightning talks, demos, and AI-powered matchmaking to find your next collaborator, hire, or investment.',
      dateTime: eventDate,
      location: 'Dubai World Trade Centre, Hall 7',
      locationLat: 25.2285,
      locationLng: 55.2867,
      welcomeMessage: 'Welcome to the AI Innovation Summit! Use IntellMatch to discover the best connections for you among our attendees.',
      uniqueCode: EVENT_CODE,
      isActive: true,
    },
  });
  console.log(`Event created: "${event.name}" (code: ${EVENT_CODE})`);

  // 3. Add host as attendee
  await prisma.eventAttendee.create({
    data: {
      eventId: event.id,
      userId: host.id,
      email: host.email,
      name: host.fullName || 'Host',
      mobile: host.phone || '',
      company: host.company || '',
      role: host.jobTitle || '',
      bio: host.bio || '',
      lookingFor: 'Networking with AI professionals, finding collaboration partners, and discovering new talent.',
      isHost: true,
    },
  });
  console.log(`Host added as attendee.`);

  // 4. Create attendee users with full profiles
  const password = await hashPassword('Test1234');

  for (const data of ATTENDEES) {
    console.log(`\nProcessing ${data.fullName}...`);

    let user = await prisma.user.findUnique({ where: { email: data.email } });

    if (user) {
      console.log(`  User exists, updating profile...`);
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          fullName: data.fullName,
          jobTitle: data.jobTitle,
          company: data.company,
          bio: data.bio,
          phone: data.phone,
          location: data.location,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash: password,
          firstName: data.firstName,
          lastName: data.lastName,
          fullName: data.fullName,
          jobTitle: data.jobTitle,
          company: data.company,
          bio: data.bio,
          phone: data.phone,
          location: data.location,
          emailVerified: true,
          isActive: true,
          onboardingStep: 99,
          onboardingCompletedAt: new Date(),
        },
      });
      console.log(`  Created user: ${user.id}`);
    }

    // Goals
    for (const goalType of data.goals) {
      const existing = await prisma.userGoal.findFirst({ where: { userId: user.id, goalType } });
      if (!existing) {
        await prisma.userGoal.create({ data: { userId: user.id, goalType, priority: 1 } });
      }
    }

    // Sectors
    for (const name of data.sectorNames) {
      const id = await findOrCreateRecord('sector', name);
      await prisma.userSector.upsert({
        where: { userId_sectorId: { userId: user.id, sectorId: id } },
        update: {},
        create: { userId: user.id, sectorId: id },
      });
    }

    // Skills
    for (const name of data.skillNames) {
      const id = await findOrCreateRecord('skill', name);
      await prisma.userSkill.upsert({
        where: { userId_skillId: { userId: user.id, skillId: id } },
        update: {},
        create: { userId: user.id, skillId: id },
      });
    }

    // Interests
    for (const name of data.interestNames) {
      const id = await findOrCreateRecord('interest', name);
      await prisma.userInterest.upsert({
        where: { userId_interestId: { userId: user.id, interestId: id } },
        update: {},
        create: { userId: user.id, interestId: id },
      });
    }

    // Hobbies
    for (const name of data.hobbyNames) {
      const id = await findOrCreateRecord('hobby', name);
      await prisma.userHobby.upsert({
        where: { userId_hobbyId: { userId: user.id, hobbyId: id } },
        update: {},
        create: { userId: user.id, hobbyId: id },
      });
    }

    console.log(`  Profile: ${data.goals.join(', ')} | ${data.sectorNames.join(', ')} | ${data.skillNames.join(', ')}`);

    // Join event as attendee
    const existingAttendee = await prisma.eventAttendee.findFirst({
      where: { eventId: event.id, email: data.email },
    });

    if (!existingAttendee) {
      await prisma.eventAttendee.create({
        data: {
          eventId: event.id,
          userId: user.id,
          email: data.email,
          name: data.fullName,
          mobile: data.phone,
          company: data.company,
          role: data.jobTitle,
          bio: data.bio,
          lookingFor: data.lookingFor,
        },
      });
      console.log(`  Joined event.`);
    }
  }

  // 5. Calculate matches between all attendees
  console.log('\n\n=== Calculating matches between all attendees ===\n');

  const attendees = await prisma.eventAttendee.findMany({
    where: { eventId: event.id, userId: { not: null } },
  });

  const userIds = attendees.map(a => a.userId!).filter(Boolean);

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

  const matchData: any[] = [];
  let highCount = 0, mediumCount = 0, lowCount = 0;

  for (let i = 0; i < attendees.length; i++) {
    for (let j = i + 1; j < attendees.length; j++) {
      const a1 = attendees[i];
      const a2 = attendees[j];
      if (!a1.userId || !a2.userId) continue;

      const p1 = profileMap.get(a1.userId);
      const p2 = profileMap.get(a2.userId);
      if (!p1 || !p2) continue;

      const { score, level, reasons } = calculateEventMatchScore(p1, p2);

      matchData.push(
        { attendeeId: a1.id, matchedAttendeeId: a2.id, matchLevel: level, score, reasons: JSON.stringify(reasons) },
        { attendeeId: a2.id, matchedAttendeeId: a1.id, matchLevel: level, score, reasons: JSON.stringify(reasons) },
      );

      if (level === 'HIGH') highCount++;
      else if (level === 'MEDIUM') mediumCount++;
      else lowCount++;

      console.log(`  ${a1.name} <-> ${a2.name}: ${level} (${score}) - ${reasons.slice(0, 2).join('; ')}`);
    }
  }

  if (matchData.length > 0) {
    await prisma.eventAttendeeMatch.createMany({
      data: matchData,
      skipDuplicates: true,
    });
  }

  console.log(`\n=== Done! ===`);
  console.log(`Event: "${event.name}"`);
  console.log(`Code: ${EVENT_CODE}`);
  console.log(`URL: https://intellmatch.com/e/${EVENT_CODE}`);
  console.log(`Attendees: ${attendees.length} (including host)`);
  console.log(`Match pairs: ${matchData.length / 2} (HIGH: ${highCount}, MEDIUM: ${mediumCount}, LOW: ${lowCount})`);
  console.log(`\nLogin as host: ${HOST_EMAIL}`);
  console.log(`Login as attendee: any @eventtest.com email / password: Test1234`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
