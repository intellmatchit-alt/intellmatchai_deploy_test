/**
 * Team Plan Seeder
 *
 * Creates an admin user with TEAM subscription, organization, and multiple
 * team members so you can login and test the full team experience.
 *
 * Run: npx ts-node src/scripts/seed-team.ts
 *
 * Login credentials:
 *   Admin:  admin@intellmatch.com / Admin123!
 *   Member: sarah@intellmatch.com / Team123!
 *   Member: omar@intellmatch.com  / Team123!
 *   Member: lina@intellmatch.com  / Team123!
 *   Member: alex@intellmatch.com  / Team123!
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_PASSWORD = 'Admin123!';
const MEMBER_PASSWORD = 'Team123!';

interface TeamMemberSeed {
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  bio: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  contacts: Array<{
    fullName: string;
    email: string;
    company: string;
    jobTitle: string;
    phone?: string;
  }>;
}

async function main() {
  console.log('\n=== Team Plan Seeder ===\n');

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const memberHash = await bcrypt.hash(MEMBER_PASSWORD, 12);

  // Get or create sectors
  console.log('Setting up reference data...');
  const sectorNames = ['Technology', 'Finance', 'Healthcare', 'Marketing', 'Consulting', 'Education'];
  const sectors = await Promise.all(
    sectorNames.map((name) =>
      prisma.sector.upsert({
        where: { id: `seed-sector-${name.toLowerCase()}` },
        create: { id: `seed-sector-${name.toLowerCase()}`, name },
        update: {},
      })
    )
  );

  // Get or create skills
  const skillNames = ['Leadership', 'Sales', 'Marketing', 'Software Development', 'Business Strategy', 'Data Analysis'];
  const skills = await Promise.all(
    skillNames.map((name) =>
      prisma.skill.upsert({
        where: { name },
        create: { name },
        update: {},
      })
    )
  );

  // Get or create interests
  const interestNames = ['AI & Machine Learning', 'Startups', 'Venture Capital', 'Product Management', 'Growth Hacking', 'Blockchain'];
  const interests = await Promise.all(
    interestNames.map((name) =>
      prisma.interest.upsert({
        where: { name },
        create: { name },
        update: {},
      })
    )
  );

  // =============================================
  // 1. CREATE ADMIN USER
  // =============================================
  console.log('Creating admin user...');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@intellmatch.com' },
    create: {
      email: 'admin@intellmatch.com',
      passwordHash: adminHash,
      fullName: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      jobTitle: 'CEO & Founder',
      company: 'IntellMatch',
      bio: 'Building the future of professional networking with AI-powered relationship intelligence.',
      phone: '+1234567890',
      location: 'San Francisco, CA',
      emailVerified: true,
      isActive: true,
      onboardingStep: 10,
      onboardingCompletedAt: new Date(),
    },
    update: {
      passwordHash: adminHash,
      fullName: 'Admin User',
      emailVerified: true,
      isActive: true,
    },
  });

  // Link admin to sectors
  await prisma.userSector.deleteMany({ where: { userId: adminUser.id } });
  await prisma.userSector.createMany({
    data: [
      { userId: adminUser.id, sectorId: sectors[0].id },
      { userId: adminUser.id, sectorId: sectors[1].id },
    ],
  });

  // Link admin to skills
  await prisma.userSkill.deleteMany({ where: { userId: adminUser.id } });
  await prisma.userSkill.createMany({
    data: [
      { userId: adminUser.id, skillId: skills[0].id },
      { userId: adminUser.id, skillId: skills[4].id },
    ],
  });

  // Link admin to interests
  await prisma.userInterest.deleteMany({ where: { userId: adminUser.id } });
  await prisma.userInterest.createMany({
    data: [
      { userId: adminUser.id, interestId: interests[0].id },
      { userId: adminUser.id, interestId: interests[1].id },
    ],
  });

  console.log(`  Admin: ${adminUser.email} (${adminUser.id})`);

  // =============================================
  // 2. CREATE TEAM SUBSCRIPTION
  // =============================================
  console.log('Creating TEAM subscription...');

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription = await prisma.subscription.upsert({
    where: { userId: adminUser.id },
    create: {
      userId: adminUser.id,
      plan: 'TEAM',
      status: 'ACTIVE',
      billingInterval: 'MONTHLY',
      seats: 10,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan: 'TEAM',
      status: 'ACTIVE',
      billingInterval: 'MONTHLY',
      seats: 10,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  console.log(`  Subscription: TEAM plan, 10 seats (${subscription.id})`);

  // =============================================
  // 3. CREATE ORGANIZATION
  // =============================================
  console.log('Creating organization...');

  // Check if org exists for this subscription
  let org = await prisma.organization.findUnique({
    where: { subscriptionId: subscription.id },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'IntellMatch Team',
        slug: 'intellmatch-team',
        website: 'https://intellmatch.com',
        industry: 'Technology',
        size: 'SMALL',
        subscriptionId: subscription.id,
        contactLimit: 30000,
      },
    });
  } else {
    org = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: 'IntellMatch Team',
        website: 'https://intellmatch.com',
        industry: 'Technology',
        size: 'SMALL',
      },
    });
  }

  console.log(`  Organization: ${org.name} (${org.id})`);

  // Add admin as OWNER
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: adminUser.id },
    },
    create: {
      organizationId: org.id,
      userId: adminUser.id,
      role: 'OWNER',
    },
    update: { role: 'OWNER' },
  });

  // =============================================
  // 4. CREATE TEAM MEMBERS
  // =============================================
  console.log('Creating team members...');

  const teamMembers: TeamMemberSeed[] = [
    {
      email: 'sarah@intellmatch.com',
      fullName: 'Sarah Chen',
      firstName: 'Sarah',
      lastName: 'Chen',
      jobTitle: 'VP of Sales',
      company: 'IntellMatch',
      bio: 'Driving revenue growth through intelligent relationship management and strategic partnerships.',
      role: 'ADMIN',
      contacts: [
        { fullName: 'David Park', email: 'david.park@techcorp.com', company: 'TechCorp', jobTitle: 'CTO' },
        { fullName: 'Emily Zhang', email: 'emily.z@innovate.io', company: 'Innovate.io', jobTitle: 'Head of Product' },
        { fullName: 'Michael Torres', email: 'm.torres@venturefund.com', company: 'Venture Fund', jobTitle: 'Partner' },
        { fullName: 'Lisa Wang', email: 'lisa.wang@startupx.com', company: 'StartupX', jobTitle: 'CEO' },
        { fullName: 'James Miller', email: 'james@cloudnine.dev', company: 'CloudNine', jobTitle: 'Lead Developer' },
      ],
    },
    {
      email: 'omar@intellmatch.com',
      fullName: 'Omar Al-Rashid',
      firstName: 'Omar',
      lastName: 'Al-Rashid',
      jobTitle: 'Head of Partnerships',
      company: 'IntellMatch',
      bio: 'Connecting businesses across the Middle East and beyond. Fluent in Arabic and English.',
      role: 'MEMBER',
      contacts: [
        { fullName: 'Fatima Hassan', email: 'fatima@gulftech.ae', company: 'GulfTech', jobTitle: 'Managing Director' },
        { fullName: 'Ahmed Khalil', email: 'ahmed@menavc.com', company: 'MENA VC', jobTitle: 'General Partner' },
        { fullName: 'Nadia Mansour', email: 'nadia@smartcity.sa', company: 'Smart City Solutions', jobTitle: 'VP Engineering' },
        { fullName: 'David Park', email: 'david.park@techcorp.com', company: 'TechCorp', jobTitle: 'CTO' },
        { fullName: 'Rami Sayed', email: 'rami@finbridge.com', company: 'FinBridge', jobTitle: 'CEO' },
        { fullName: 'Youssef Hamdi', email: 'youssef@digitalpay.me', company: 'DigitalPay', jobTitle: 'Founder' },
      ],
    },
    {
      email: 'lina@intellmatch.com',
      fullName: 'Lina Johansson',
      firstName: 'Lina',
      lastName: 'Johansson',
      jobTitle: 'Head of Marketing',
      company: 'IntellMatch',
      bio: 'Growth marketing specialist with a passion for data-driven strategies and brand building.',
      role: 'MEMBER',
      contacts: [
        { fullName: 'Anna Schmidt', email: 'anna@brandlab.eu', company: 'BrandLab Europe', jobTitle: 'Creative Director' },
        { fullName: 'Tom Wilson', email: 'tom@contentpro.co', company: 'ContentPro', jobTitle: 'CEO' },
        { fullName: 'Emily Zhang', email: 'emily.z@innovate.io', company: 'Innovate.io', jobTitle: 'Head of Product' },
        { fullName: 'Sophie Martin', email: 'sophie@adscale.com', company: 'AdScale', jobTitle: 'VP Growth' },
      ],
    },
    {
      email: 'alex@intellmatch.com',
      fullName: 'Alex Rivera',
      firstName: 'Alex',
      lastName: 'Rivera',
      jobTitle: 'Senior Developer',
      company: 'IntellMatch',
      bio: 'Full-stack developer specializing in AI/ML integrations and scalable architectures.',
      role: 'VIEWER',
      contacts: [
        { fullName: 'Chris Lee', email: 'chris@devstudio.com', company: 'DevStudio', jobTitle: 'Tech Lead' },
        { fullName: 'Priya Patel', email: 'priya@airesearch.org', company: 'AI Research Lab', jobTitle: 'Research Scientist' },
        { fullName: 'James Miller', email: 'james@cloudnine.dev', company: 'CloudNine', jobTitle: 'Lead Developer' },
      ],
    },
  ];

  for (const member of teamMembers) {
    // Create user
    const user = await prisma.user.upsert({
      where: { email: member.email },
      create: {
        email: member.email,
        passwordHash: memberHash,
        fullName: member.fullName,
        firstName: member.firstName,
        lastName: member.lastName,
        jobTitle: member.jobTitle,
        company: member.company,
        bio: member.bio,
        location: 'Remote',
        emailVerified: true,
        isActive: true,
        onboardingStep: 10,
        onboardingCompletedAt: new Date(),
      },
      update: {
        passwordHash: memberHash,
        fullName: member.fullName,
        emailVerified: true,
        isActive: true,
      },
    });

    // Create subscription for the member
    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: 'TEAM',
        status: 'ACTIVE',
        billingInterval: 'MONTHLY',
        seats: 1,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      update: {
        plan: 'TEAM',
        status: 'ACTIVE',
      },
    });

    // Link user to sectors
    await prisma.userSector.deleteMany({ where: { userId: user.id } });
    const memberSectors = sectors.slice(0, 2 + Math.floor(Math.random() * 3));
    await prisma.userSector.createMany({
      data: memberSectors.map((s) => ({ userId: user.id, sectorId: s.id })),
      skipDuplicates: true,
    });

    // Link user to skills
    await prisma.userSkill.deleteMany({ where: { userId: user.id } });
    const memberSkills = skills.slice(0, 2 + Math.floor(Math.random() * 3));
    await prisma.userSkill.createMany({
      data: memberSkills.map((s) => ({ userId: user.id, skillId: s.id })),
      skipDuplicates: true,
    });

    // Link user to interests
    await prisma.userInterest.deleteMany({ where: { userId: user.id } });
    const memberInterests = interests.slice(0, 2 + Math.floor(Math.random() * 3));
    await prisma.userInterest.createMany({
      data: memberInterests.map((i) => ({ userId: user.id, interestId: i.id })),
      skipDuplicates: true,
    });

    // Add to organization
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: org.id, userId: user.id },
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        role: member.role,
      },
      update: { role: member.role },
    });

    // Create contacts for this member
    for (const contactData of member.contacts) {
      const existingContact = await prisma.contact.findFirst({
        where: { email: contactData.email, ownerId: user.id },
      });

      if (!existingContact) {
        const contact = await prisma.contact.create({
          data: {
            ownerId: user.id,
            fullName: contactData.fullName,
            email: contactData.email,
            company: contactData.company,
            jobTitle: contactData.jobTitle,
            phone: contactData.phone,
            source: 'MANUAL',
            matchScore: Math.floor(40 + Math.random() * 60),
            rawSources: [],
          } as any,
        });

        // Link contact to a random sector
        const randomSector = sectors[Math.floor(Math.random() * sectors.length)];
        await prisma.contactSector.create({
          data: {
            contactId: contact.id,
            sectorId: randomSector.id,
            confidence: 0.8 + Math.random() * 0.2,
          },
        });

        // Share some contacts with the org
        if (Math.random() > 0.3) {
          await prisma.sharedContact.upsert({
            where: {
              contactId_organizationId: {
                contactId: contact.id,
                organizationId: org.id,
              },
            },
            create: {
              contactId: contact.id,
              organizationId: org.id,
              sharedById: user.id,
              visibility: Math.random() > 0.5 ? 'FULL' : 'BASIC',
            },
            update: {},
          });
        }
      }
    }

    console.log(`  ${member.role.padEnd(6)} ${member.email} (${user.id}) - ${member.contacts.length} contacts`);
  }

  // =============================================
  // 5. CREATE ADMIN'S CONTACTS
  // =============================================
  console.log('Creating admin contacts...');

  const adminContacts = [
    { fullName: 'Richard Branson', email: 'richard@virgin.com', company: 'Virgin Group', jobTitle: 'Founder' },
    { fullName: 'Elon Musk', email: 'elon@spacex.com', company: 'SpaceX', jobTitle: 'CEO' },
    { fullName: 'Satya Nadella', email: 'satya@microsoft.com', company: 'Microsoft', jobTitle: 'CEO' },
    { fullName: 'David Park', email: 'david.park@techcorp.com', company: 'TechCorp', jobTitle: 'CTO' },
    { fullName: 'Jessica Brown', email: 'jessica@globalventures.com', company: 'Global Ventures', jobTitle: 'Managing Partner' },
    { fullName: 'Khalid Al-Fayed', email: 'khalid@gulfcapital.ae', company: 'Gulf Capital', jobTitle: 'Chairman' },
    { fullName: 'Maria Garcia', email: 'maria@latamtech.co', company: 'LatAm Tech', jobTitle: 'CEO' },
    { fullName: 'Raj Patel', email: 'raj@indiabridge.in', company: 'India Bridge', jobTitle: 'Founder' },
  ];

  for (const contactData of adminContacts) {
    const existing = await prisma.contact.findFirst({
      where: { email: contactData.email, ownerId: adminUser.id },
    });

    if (!existing) {
      const contact = await prisma.contact.create({
        data: {
          ownerId: adminUser.id,
          fullName: contactData.fullName,
          email: contactData.email,
          company: contactData.company,
          jobTitle: contactData.jobTitle,
          source: 'MANUAL',
          matchScore: Math.floor(50 + Math.random() * 50),
          rawSources: [],
        } as any,
      });

      // Link to sector
      const randomSector = sectors[Math.floor(Math.random() * sectors.length)];
      await prisma.contactSector.create({
        data: {
          contactId: contact.id,
          sectorId: randomSector.id,
          confidence: 0.85,
        },
      });

      // Share with org
      await prisma.sharedContact.upsert({
        where: {
          contactId_organizationId: {
            contactId: contact.id,
            organizationId: org.id,
          },
        },
        create: {
          contactId: contact.id,
          organizationId: org.id,
          sharedById: adminUser.id,
          visibility: 'FULL',
        },
        update: {},
      });
    }
  }

  console.log(`  Created ${adminContacts.length} admin contacts (shared with org)`);

  // =============================================
  // 6. CREATE SAMPLE ACTIVITY LOG
  // =============================================
  console.log('Creating activity log entries...');

  const activities = [
    { userId: adminUser.id, action: 'ORG_CREATED', resourceType: 'organization', resourceId: org.id, metadata: { name: org.name } },
    { userId: adminUser.id, action: 'MEMBER_INVITED', resourceType: 'member', resourceId: '', metadata: { email: 'sarah@intellmatch.com', role: 'ADMIN' } },
    { userId: adminUser.id, action: 'MEMBER_INVITED', resourceType: 'member', resourceId: '', metadata: { email: 'omar@intellmatch.com', role: 'MEMBER' } },
    { userId: adminUser.id, action: 'MEMBER_INVITED', resourceType: 'member', resourceId: '', metadata: { email: 'lina@intellmatch.com', role: 'MEMBER' } },
    { userId: adminUser.id, action: 'MEMBER_INVITED', resourceType: 'member', resourceId: '', metadata: { email: 'alex@intellmatch.com', role: 'VIEWER' } },
  ];

  for (const activity of activities) {
    await prisma.orgActivityLog.create({
      data: {
        organizationId: org.id,
        userId: activity.userId,
        action: activity.action,
        resourceType: activity.resourceType,
        resourceId: activity.resourceId,
        metadata: activity.metadata,
      },
    });
  }

  console.log(`  Created ${activities.length} activity log entries`);

  // =============================================
  // 7. CREATE A SHARED PROJECT
  // =============================================
  console.log('Creating shared team project...');

  const existingProject = await prisma.project.findFirst({
    where: { userId: adminUser.id, title: 'AI Networking Platform v2' },
  });

  if (!existingProject) {
    const project = await prisma.project.create({
      data: {
        userId: adminUser.id,
        title: 'AI Networking Platform v2',
        summary: 'Next generation AI-powered networking platform with team collaboration features, shared relationship graphs, and warm intro routing.',
        category: 'technology',
        stage: 'GROWTH',
        lookingFor: JSON.stringify(['investor', 'technical_partner', 'advisor']),
        keywords: JSON.stringify(['AI', 'networking', 'SaaS', 'B2B']),
        visibility: 'PUBLIC',
        isActive: true,
        organizationId: org.id,
        isTeamShared: true,
      },
    });

    // Link to sectors
    await prisma.projectSector.createMany({
      data: [
        { projectId: project.id, sectorId: sectors[0].id },
        { projectId: project.id, sectorId: sectors[1].id },
      ],
    });

    console.log(`  Project: ${project.title} (shared with team)`);
  } else {
    // Update existing to be shared
    await prisma.project.update({
      where: { id: existingProject.id },
      data: { organizationId: org.id, isTeamShared: true },
    });
    console.log(`  Project already exists, updated to be team-shared`);
  }

  // =============================================
  // DONE
  // =============================================
  console.log('\n=== Seeding Complete! ===\n');
  console.log('Login credentials:');
  console.log('┌──────────────────────────────────────────────────────┐');
  console.log('│  ADMIN (Owner)                                      │');
  console.log('│  Email:    admin@intellmatch.com                    │');
  console.log('│  Password: Admin123!                                │');
  console.log('├──────────────────────────────────────────────────────┤');
  console.log('│  Sarah Chen (Admin)                                 │');
  console.log('│  Email:    sarah@intellmatch.com                    │');
  console.log('│  Password: Team123!                                 │');
  console.log('├──────────────────────────────────────────────────────┤');
  console.log('│  Omar Al-Rashid (Member)                            │');
  console.log('│  Email:    omar@intellmatch.com                     │');
  console.log('│  Password: Team123!                                 │');
  console.log('├──────────────────────────────────────────────────────┤');
  console.log('│  Lina Johansson (Member)                            │');
  console.log('│  Email:    lina@intellmatch.com                     │');
  console.log('│  Password: Team123!                                 │');
  console.log('├──────────────────────────────────────────────────────┤');
  console.log('│  Alex Rivera (Viewer)                               │');
  console.log('│  Email:    alex@intellmatch.com                     │');
  console.log('│  Password: Team123!                                 │');
  console.log('└──────────────────────────────────────────────────────┘');
  console.log(`\nOrganization: "${org.name}" with ${teamMembers.length + 1} members`);
  console.log('Shared contacts visible in Team Contacts tab');
  console.log('');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
