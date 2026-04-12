/**
 * Create Test Data for Matching Services
 *
 * This script creates persistent test data for validating matching services:
 * - 1 Main test user (the one who logs in)
 * - 3 Contacts (perfect match, partial match, no match)
 * - 3 Other users (for project/opportunity matching)
 * - 1 Project
 * - 1 Opportunity Intent
 *
 * Run: npx ts-node src/scripts/create-test-data.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Test password for all test accounts
const TEST_PASSWORD = 'Test123!@#';

async function main() {
  console.log('\n🚀 Creating Test Data for Matching Services...\n');

  // Hash password
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // =============================================
  // 1. CREATE/GET REFERENCE DATA
  // =============================================
  console.log('📦 Creating reference data (sectors, skills, interests, hobbies)...');

  // Sectors
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
    prisma.sector.upsert({
      where: { id: 'test-sector-education' },
      create: { id: 'test-sector-education', name: 'Education' },
      update: {},
    }),
  ]);
  const [techSector, financeSector, healthcareSector, educationSector] = sectors;

  // Skills
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
    prisma.skill.upsert({
      where: { name: 'Data Analysis' },
      create: { name: 'Data Analysis', category: 'Analytics' },
      update: {},
    }),
    prisma.skill.upsert({
      where: { name: 'Project Management' },
      create: { name: 'Project Management', category: 'Management' },
      update: {},
    }),
    prisma.skill.upsert({
      where: { name: 'Nursing' },
      create: { name: 'Nursing', category: 'Healthcare' },
      update: {},
    }),
  ]);
  const [pythonSkill, jsSkill, mlSkill, dataSkill, pmSkill, nursingSkill] = skills;

  // Interests
  const interests = await Promise.all([
    prisma.interest.upsert({
      where: { name: 'Artificial Intelligence' },
      create: { name: 'Artificial Intelligence', category: 'Technology' },
      update: {},
    }),
    prisma.interest.upsert({
      where: { name: 'Startups' },
      create: { name: 'Startups', category: 'Business' },
      update: {},
    }),
    prisma.interest.upsert({
      where: { name: 'Investing' },
      create: { name: 'Investing', category: 'Finance' },
      update: {},
    }),
  ]);
  const [aiInterest, startupsInterest, investingInterest] = interests;

  // Hobbies
  const hobbies = await Promise.all([
    prisma.hobby.upsert({
      where: { name: 'Reading' },
      create: { name: 'Reading', category: 'Leisure' },
      update: {},
    }),
    prisma.hobby.upsert({
      where: { name: 'Chess' },
      create: { name: 'Chess', category: 'Games' },
      update: {},
    }),
    prisma.hobby.upsert({
      where: { name: 'Hiking' },
      create: { name: 'Hiking', category: 'Outdoor' },
      update: {},
    }),
  ]);
  const [readingHobby, chessHobby, hikingHobby] = hobbies;

  console.log('   ✓ Reference data ready\n');

  // =============================================
  // 2. CREATE MAIN TEST USER
  // =============================================
  console.log('👤 Creating main test user...');

  // Delete existing test user if exists
  await prisma.user.deleteMany({ where: { email: 'testuser@matching.test' } });

  const mainUser = await prisma.user.create({
    data: {
      email: 'testuser@matching.test',
      passwordHash: passwordHash,
      fullName: 'Test User (Main)',
      company: 'TechStartup Inc',
      jobTitle: 'Senior Data Scientist',
      location: 'San Francisco, CA',
      bio: 'Experienced data scientist passionate about AI and machine learning. Looking for collaboration opportunities and talented engineers to join our team.',
      isActive: true,
      emailVerified: true,
    },
  });

  // Add user profile data
  await Promise.all([
    prisma.userSector.createMany({
      data: [
        { userId: mainUser.id, sectorId: techSector.id, isPrimary: true },
        { userId: mainUser.id, sectorId: financeSector.id, isPrimary: false },
      ],
    }),
    prisma.userSkill.createMany({
      data: [
        { userId: mainUser.id, skillId: pythonSkill.id },
        { userId: mainUser.id, skillId: mlSkill.id },
        { userId: mainUser.id, skillId: dataSkill.id },
      ],
    }),
    prisma.userInterest.createMany({
      data: [
        { userId: mainUser.id, interestId: aiInterest.id },
        { userId: mainUser.id, interestId: startupsInterest.id },
      ],
    }),
    prisma.userHobby.createMany({
      data: [
        { userId: mainUser.id, hobbyId: readingHobby.id },
        { userId: mainUser.id, hobbyId: chessHobby.id },
      ],
    }),
    prisma.userGoal.createMany({
      data: [
        { userId: mainUser.id, goalType: 'COLLABORATION', priority: 1 },
        { userId: mainUser.id, goalType: 'HIRING', priority: 2 },
      ],
    }),
  ]);

  console.log(`   ✓ Main User: ${mainUser.email}`);
  console.log(`   ✓ ID: ${mainUser.id}\n`);

  // =============================================
  // 3. CREATE TEST CONTACTS
  // =============================================
  console.log('📇 Creating test contacts...');

  // PERFECT MATCH CONTACT
  const perfectContact = await prisma.contact.create({
    data: {
      owner: { connect: { id: mainUser.id } },
      fullName: 'Sarah Chen (Perfect Match)',
      email: 'sarah.chen@aicompany.test',
      company: 'AI Innovations Lab',
      jobTitle: 'Machine Learning Engineer',
      location: 'San Francisco, CA',
      bio: 'ML engineer with expertise in deep learning and NLP. Interested in AI startups.',
      source: 'MANUAL',
      rawSources: [],
    },
  });

  await Promise.all([
    prisma.contactSector.createMany({
      data: [
        { contactId: perfectContact.id, sectorId: techSector.id },
        { contactId: perfectContact.id, sectorId: financeSector.id },
      ],
    }),
    prisma.contactSkill.createMany({
      data: [
        { contactId: perfectContact.id, skillId: pythonSkill.id },
        { contactId: perfectContact.id, skillId: mlSkill.id },
        { contactId: perfectContact.id, skillId: dataSkill.id },
      ],
    }),
    prisma.contactInterest.createMany({
      data: [
        { contactId: perfectContact.id, interestId: aiInterest.id },
        { contactId: perfectContact.id, interestId: startupsInterest.id },
      ],
    }),
    prisma.contactHobby.createMany({
      data: [
        { contactId: perfectContact.id, hobbyId: readingHobby.id },
        { contactId: perfectContact.id, hobbyId: chessHobby.id },
      ],
    }),
  ]);

  console.log(`   ✓ Perfect Match: ${perfectContact.fullName}`);

  // PARTIAL MATCH CONTACT
  const partialContact = await prisma.contact.create({
    data: {
      owner: { connect: { id: mainUser.id } },
      fullName: 'Mike Johnson (Partial Match)',
      email: 'mike.johnson@fintech.test',
      company: 'FinTech Solutions',
      jobTitle: 'Full Stack Developer',
      location: 'New York, NY',
      bio: 'Web developer focused on fintech applications.',
      source: 'MANUAL',
      rawSources: [],
    },
  });

  await Promise.all([
    prisma.contactSector.createMany({
      data: [{ contactId: partialContact.id, sectorId: financeSector.id }],
    }),
    prisma.contactSkill.createMany({
      data: [
        { contactId: partialContact.id, skillId: jsSkill.id },
        { contactId: partialContact.id, skillId: pythonSkill.id },
      ],
    }),
    prisma.contactInterest.createMany({
      data: [{ contactId: partialContact.id, interestId: investingInterest.id }],
    }),
    prisma.contactHobby.createMany({
      data: [{ contactId: partialContact.id, hobbyId: hikingHobby.id }],
    }),
  ]);

  console.log(`   ✓ Partial Match: ${partialContact.fullName}`);

  // NO MATCH CONTACT
  const noMatchContact = await prisma.contact.create({
    data: {
      owner: { connect: { id: mainUser.id } },
      fullName: 'Emily Davis (No Match)',
      email: 'emily.davis@hospital.test',
      company: 'City General Hospital',
      jobTitle: 'Head Nurse',
      location: 'Chicago, IL',
      bio: 'Healthcare professional with 15 years of experience in patient care.',
      source: 'MANUAL',
      rawSources: [],
    },
  });

  await Promise.all([
    prisma.contactSector.createMany({
      data: [{ contactId: noMatchContact.id, sectorId: healthcareSector.id }],
    }),
    prisma.contactSkill.createMany({
      data: [{ contactId: noMatchContact.id, skillId: nursingSkill.id }],
    }),
  ]);

  console.log(`   ✓ No Match: ${noMatchContact.fullName}\n`);

  // =============================================
  // 4. CREATE OTHER USERS FOR MATCHING
  // =============================================
  console.log('👥 Creating other users for project/opportunity matching...');

  // Delete existing test users
  await prisma.user.deleteMany({
    where: {
      email: { in: ['candidate1@matching.test', 'candidate2@matching.test', 'candidate3@matching.test'] }
    }
  });

  // USER 1: Job Seeker with relevant skills
  const user1 = await prisma.user.create({
    data: {
      email: 'candidate1@matching.test',
      passwordHash: passwordHash,
      fullName: 'Alex Rivera (Job Seeker)',
      company: 'Freelance',
      jobTitle: 'Senior Software Engineer',
      location: 'San Francisco, CA',
      bio: 'Experienced engineer looking for new opportunities in AI/ML.',
      isActive: true,
      emailVerified: true,
    },
  });

  await Promise.all([
    prisma.userSector.createMany({
      data: [{ userId: user1.id, sectorId: techSector.id, isPrimary: true }],
    }),
    prisma.userSkill.createMany({
      data: [
        { userId: user1.id, skillId: pythonSkill.id },
        { userId: user1.id, skillId: mlSkill.id },
        { userId: user1.id, skillId: jsSkill.id },
      ],
    }),
    prisma.userInterest.createMany({
      data: [{ userId: user1.id, interestId: aiInterest.id }],
    }),
    prisma.userGoal.createMany({
      data: [
        { userId: user1.id, goalType: 'JOB_SEEKING', priority: 1 },
        { userId: user1.id, goalType: 'COLLABORATION', priority: 2 },
      ],
    }),
  ]);

  console.log(`   ✓ User 1: ${user1.fullName} (Job Seeker)`);

  // USER 2: Investor
  const user2 = await prisma.user.create({
    data: {
      email: 'candidate2@matching.test',
      passwordHash: passwordHash,
      fullName: 'Jennifer Lee (Investor)',
      company: 'Venture Capital Partners',
      jobTitle: 'Managing Partner / Investor',
      location: 'San Francisco, CA',
      bio: 'Angel investor focused on AI and fintech startups. Looking to fund promising projects.',
      isActive: true,
      emailVerified: true,
    },
  });

  await Promise.all([
    prisma.userSector.createMany({
      data: [
        { userId: user2.id, sectorId: financeSector.id, isPrimary: true },
        { userId: user2.id, sectorId: techSector.id, isPrimary: false },
      ],
    }),
    prisma.userSkill.createMany({
      data: [{ userId: user2.id, skillId: pmSkill.id }],
    }),
    prisma.userInterest.createMany({
      data: [
        { userId: user2.id, interestId: startupsInterest.id },
        { userId: user2.id, interestId: investingInterest.id },
      ],
    }),
    prisma.userGoal.createMany({
      data: [{ userId: user2.id, goalType: 'INVESTMENT', priority: 1 }],
    }),
  ]);

  console.log(`   ✓ User 2: ${user2.fullName} (Investor)`);

  // USER 3: Technical Advisor
  const user3 = await prisma.user.create({
    data: {
      email: 'candidate3@matching.test',
      passwordHash: passwordHash,
      fullName: 'Dr. Robert Kim (Advisor)',
      company: 'Tech Advisory Group',
      jobTitle: 'VP of Engineering / Technical Advisor',
      location: 'Boston, MA',
      bio: 'Former CTO with 20 years experience. Available for advisory board positions.',
      isActive: true,
      emailVerified: true,
    },
  });

  await Promise.all([
    prisma.userSector.createMany({
      data: [
        { userId: user3.id, sectorId: techSector.id, isPrimary: true },
        { userId: user3.id, sectorId: educationSector.id, isPrimary: false },
      ],
    }),
    prisma.userSkill.createMany({
      data: [
        { userId: user3.id, skillId: pythonSkill.id },
        { userId: user3.id, skillId: pmSkill.id },
        { userId: user3.id, skillId: mlSkill.id },
      ],
    }),
    prisma.userInterest.createMany({
      data: [{ userId: user3.id, interestId: aiInterest.id }],
    }),
    prisma.userGoal.createMany({
      data: [
        { userId: user3.id, goalType: 'MENTORSHIP', priority: 1 },
        { userId: user3.id, goalType: 'PARTNERSHIP', priority: 2 },
      ],
    }),
  ]);

  console.log(`   ✓ User 3: ${user3.fullName} (Advisor)\n`);

  // =============================================
  // 5. CREATE TEST PROJECT
  // =============================================
  console.log('📁 Creating test project...');

  // Delete existing test project
  await prisma.project.deleteMany({ where: { userId: mainUser.id } });

  const project = await prisma.project.create({
    data: {
      userId: mainUser.id,
      title: 'AI-Powered Financial Analytics Platform',
      summary: 'Building a machine learning platform for real-time financial data analysis and prediction.',
      detailedDesc: 'We are developing an innovative financial analytics platform that uses machine learning to provide real-time market insights. Looking for talented engineers, potential investors, and technical advisors to help scale the product.',
      stage: 'MVP',
      lookingFor: ['technical_partner', 'developer', 'investor', 'advisor'],
      keywords: ['ai', 'machine learning', 'finance', 'analytics', 'python', 'data science'],
      visibility: 'PUBLIC',
      isActive: true,
    },
  });

  await Promise.all([
    prisma.projectSector.createMany({
      data: [
        { projectId: project.id, sectorId: techSector.id },
        { projectId: project.id, sectorId: financeSector.id },
      ],
    }),
    prisma.projectSkill.createMany({
      data: [
        { projectId: project.id, skillId: pythonSkill.id, importance: 'REQUIRED' },
        { projectId: project.id, skillId: mlSkill.id, importance: 'REQUIRED' },
        { projectId: project.id, skillId: dataSkill.id, importance: 'PREFERRED' },
      ],
    }),
  ]);

  console.log(`   ✓ Project: ${project.title}`);
  console.log(`   ✓ ID: ${project.id}\n`);

  // =============================================
  // 6. CREATE OPPORTUNITY INTENT
  // =============================================
  console.log('🎯 Creating opportunity intent...');

  // Delete existing test intents
  await prisma.opportunityIntent.deleteMany({ where: { userId: mainUser.id } });

  const intent = await prisma.opportunityIntent.create({
    data: {
      userId: mainUser.id,
      title: 'Hiring Senior ML Engineers',
      intentType: 'HIRING',
      roleArea: 'Machine Learning / AI',
      seniority: 'SENIOR',
      locationPref: 'San Francisco, CA',
      remoteOk: true,
      notes: 'Looking for experienced ML engineers to join our growing team. Must have strong Python skills and experience with production ML systems.',
      visibility: 'LIMITED',
      isActive: true,
    },
  });

  await Promise.all([
    prisma.opportunityIntentSector.createMany({
      data: [{ intentId: intent.id, sectorId: techSector.id }],
    }),
    prisma.opportunityIntentSkill.createMany({
      data: [
        { intentId: intent.id, skillId: pythonSkill.id },
        { intentId: intent.id, skillId: mlSkill.id },
      ],
    }),
  ]);

  console.log(`   ✓ Opportunity Intent: ${intent.title}`);
  console.log(`   ✓ ID: ${intent.id}\n`);

  // =============================================
  // SUMMARY
  // =============================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    TEST DATA CREATED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('🔐 LOGIN CREDENTIALS:');
  console.log('   Email:    testuser@matching.test');
  console.log(`   Password: ${TEST_PASSWORD}\n`);

  console.log('👤 MAIN USER:');
  console.log(`   ID:       ${mainUser.id}`);
  console.log(`   Name:     ${mainUser.fullName}`);
  console.log(`   Sectors:  Technology, Finance`);
  console.log(`   Skills:   Python, Machine Learning, Data Analysis`);
  console.log(`   Goals:    COLLABORATION, HIRING\n`);

  console.log('📇 CONTACTS (3):');
  console.log(`   1. ${perfectContact.fullName} - Should score HIGH`);
  console.log(`   2. ${partialContact.fullName} - Should score MEDIUM`);
  console.log(`   3. ${noMatchContact.fullName} - Should score LOW\n`);

  console.log('👥 OTHER USERS (3):');
  console.log(`   1. ${user1.fullName} - Job Seeker with ML skills`);
  console.log(`   2. ${user2.fullName} - Investor in AI/fintech`);
  console.log(`   3. ${user3.fullName} - Technical Advisor\n`);

  console.log('📁 PROJECT:');
  console.log(`   ID:    ${project.id}`);
  console.log(`   Title: ${project.title}\n`);

  console.log('🎯 OPPORTUNITY INTENT:');
  console.log(`   ID:    ${intent.id}`);
  console.log(`   Title: ${intent.title}`);
  console.log(`   Type:  HIRING\n`);

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Return IDs for use in matching tests
  return {
    mainUserId: mainUser.id,
    contacts: {
      perfectMatchId: perfectContact.id,
      partialMatchId: partialContact.id,
      noMatchId: noMatchContact.id,
    },
    users: {
      jobSeekerId: user1.id,
      investorId: user2.id,
      advisorId: user3.id,
    },
    projectId: project.id,
    intentId: intent.id,
  };
}

main()
  .catch((e) => {
    console.error('Error creating test data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
