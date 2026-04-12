/**
 * Seed Contacts Script
 *
 * Creates ~50 contacts per user with sectors and skills for matching.
 */

import { PrismaClient, ContactSource, SectorSource } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Sample data for generating realistic contacts
const firstNames = [
  'Ahmed', 'Mohammed', 'Omar', 'Ali', 'Hassan', 'Yusuf', 'Ibrahim', 'Khalid', 'Tariq', 'Faisal',
  'Sarah', 'Fatima', 'Aisha', 'Maryam', 'Layla', 'Noor', 'Hana', 'Rania', 'Dina', 'Lina',
  'John', 'Michael', 'David', 'James', 'Robert', 'William', 'Richard', 'Thomas', 'Daniel', 'Matthew',
  'Emma', 'Olivia', 'Sophia', 'Isabella', 'Charlotte', 'Amelia', 'Harper', 'Evelyn', 'Abigail', 'Emily',
  'Wei', 'Chen', 'Li', 'Zhang', 'Wang', 'Liu', 'Yang', 'Huang', 'Zhao', 'Wu',
  'Priya', 'Raj', 'Amit', 'Neha', 'Vikram', 'Ananya', 'Rohan', 'Kavita', 'Arjun', 'Meera'
];

const lastNames = [
  'Al-Farsi', 'Al-Rashid', 'Al-Mansour', 'Al-Zahrani', 'Al-Ghamdi', 'Al-Shahrani', 'Al-Dosari', 'Al-Qahtani',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Thompson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'White',
  'Chen', 'Wang', 'Li', 'Zhang', 'Liu', 'Yang', 'Huang', 'Wu', 'Zhou', 'Xu',
  'Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Reddy', 'Rao', 'Verma', 'Joshi', 'Iyer'
];

const companies = [
  'Tech Solutions Inc', 'Global Innovations', 'Digital Dynamics', 'Cloud Systems Ltd',
  'Data Insights Co', 'AI Ventures', 'Blockchain Labs', 'Cyber Security Pro',
  'FinTech Solutions', 'MedTech Innovations', 'EduTech Global', 'Green Energy Corp',
  'Smart Logistics', 'Urban Development', 'Media Masters', 'Creative Studios',
  'Consulting Partners', 'Legal Associates', 'Investment Group', 'Healthcare Plus',
  'E-Commerce Hub', 'Marketing Experts', 'Research Institute', 'Manufacturing Corp',
  'Hospitality Services', 'Real Estate Ventures', 'Transportation Solutions', 'Agritech Farms',
  'Startup Accelerator', 'Venture Capital Fund', 'Private Equity Partners', 'Angel Investors Network',
  'Saudi Aramco', 'SABIC', 'STC', 'NEOM', 'Red Sea Global', 'Almarai',
  'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Tesla', 'Netflix', 'Uber'
];

const jobTitles = [
  'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'VP of Engineering', 'VP of Sales', 'VP of Marketing',
  'Director of Operations', 'Director of Product', 'Director of HR', 'Director of Finance',
  'Senior Software Engineer', 'Lead Developer', 'Product Manager', 'Project Manager',
  'Data Scientist', 'Machine Learning Engineer', 'DevOps Engineer', 'Cloud Architect',
  'Business Analyst', 'Financial Analyst', 'Marketing Manager', 'Sales Manager',
  'HR Manager', 'Operations Manager', 'Account Manager', 'Customer Success Manager',
  'Consultant', 'Advisor', 'Investor', 'Entrepreneur', 'Founder', 'Co-Founder',
  'Research Scientist', 'Professor', 'Lecturer', 'Trainer', 'Coach', 'Mentor'
];

const locations = [
  'Riyadh, Saudi Arabia', 'Jeddah, Saudi Arabia', 'Dammam, Saudi Arabia', 'Khobar, Saudi Arabia',
  'Dubai, UAE', 'Abu Dhabi, UAE', 'Doha, Qatar', 'Manama, Bahrain', 'Kuwait City, Kuwait',
  'Cairo, Egypt', 'Amman, Jordan', 'Beirut, Lebanon', 'Istanbul, Turkey',
  'London, UK', 'New York, USA', 'San Francisco, USA', 'Singapore', 'Hong Kong',
  'Berlin, Germany', 'Paris, France', 'Tokyo, Japan', 'Sydney, Australia', 'Toronto, Canada'
];

const sources: ContactSource[] = ['MANUAL', 'CARD_SCAN', 'IMPORT', 'LINKEDIN'];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateEmail(firstName: string, lastName: string, company: string): string {
  const cleanCompany = company.toLowerCase().replace(/[^a-z]/g, '').slice(0, 15);
  const domain = cleanCompany + '.com';
  const formats = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, '')}@${domain}`,
    `${firstName.toLowerCase()}@${domain}`,
    `${firstName[0].toLowerCase()}${lastName.toLowerCase().replace(/[^a-z]/g, '')}@${domain}`,
  ];
  return randomElement(formats);
}

function generatePhone(): string {
  const prefixes = ['+966', '+971', '+974', '+973', '+965', '+1', '+44'];
  const prefix = randomElement(prefixes);
  const number = Math.floor(Math.random() * 900000000) + 100000000;
  return `${prefix}${number}`;
}

async function main() {
  console.log('Starting contact seeding...');

  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true },
  });
  console.log(`Found ${users.length} users`);

  // Get all sectors and skills
  const sectors = await prisma.sector.findMany({ select: { id: true, name: true } });
  const skills = await prisma.skill.findMany({ select: { id: true, name: true } });

  console.log(`Found ${sectors.length} sectors and ${skills.length} skills`);

  if (sectors.length === 0 || skills.length === 0) {
    console.error('No sectors or skills found. Please seed those first.');
    return;
  }

  let totalCreated = 0;
  const CONTACTS_PER_USER = 50;

  for (const user of users) {
    console.log(`\nCreating contacts for user: ${user.fullName} (${user.id})`);

    // Check existing contacts for this user
    const existingCount = await prisma.contact.count({
      where: { ownerId: user.id },
    });

    const contactsToCreate = Math.max(0, CONTACTS_PER_USER - existingCount);

    if (contactsToCreate === 0) {
      console.log(`  User already has ${existingCount} contacts, skipping...`);
      continue;
    }

    console.log(`  Creating ${contactsToCreate} new contacts (existing: ${existingCount})...`);

    for (let i = 0; i < contactsToCreate; i++) {
      const firstName = randomElement(firstNames);
      const lastName = randomElement(lastNames);
      const company = randomElement(companies);
      const fullName = `${firstName} ${lastName}`;

      try {
        // Create the contact
        const contact = await prisma.contact.create({
          data: {
            id: uuidv4(),
            ownerId: user.id,
            fullName: fullName,
            email: generateEmail(firstName, lastName, company),
            phone: generatePhone(),
            company: company,
            jobTitle: randomElement(jobTitles),
            location: randomElement(locations),
            source: randomElement(sources),
            notes: `Met at ${randomElement(['conference', 'networking event', 'business meeting', 'workshop', 'seminar'])}`,
            lastInteractionAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random date within 90 days
          },
        });

        // Add 1-3 sectors to the contact
        const contactSectors = randomElements(sectors, Math.floor(Math.random() * 3) + 1);
        for (const sector of contactSectors) {
          await prisma.contactSector.create({
            data: {
              id: uuidv4(),
              contactId: contact.id,
              sectorId: sector.id,
              confidence: 0.7 + Math.random() * 0.3,
              source: 'USER' as SectorSource,
            },
          });
        }

        // Add 2-5 skills to the contact
        const contactSkills = randomElements(skills, Math.floor(Math.random() * 4) + 2);
        for (const skill of contactSkills) {
          await prisma.contactSkill.create({
            data: {
              id: uuidv4(),
              contactId: contact.id,
              skillId: skill.id,
              confidence: 0.6 + Math.random() * 0.4,
              source: 'USER' as SectorSource,
            },
          });
        }

        totalCreated++;

        if ((i + 1) % 10 === 0) {
          console.log(`    Created ${i + 1}/${contactsToCreate} contacts...`);
        }
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Duplicate, skip
          continue;
        }
        console.error(`  Error creating contact: ${error.message}`);
      }
    }
  }

  console.log(`\n✓ Total contacts created: ${totalCreated}`);

  // Get final counts
  const finalCount = await prisma.contact.count();
  const contactSectorCount = await prisma.contactSector.count();
  const contactSkillCount = await prisma.contactSkill.count();

  console.log(`\nFinal database state:`);
  console.log(`  - Total contacts: ${finalCount}`);
  console.log(`  - Contact-sector relationships: ${contactSectorCount}`);
  console.log(`  - Contact-skill relationships: ${contactSkillCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
