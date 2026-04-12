/**
 * Demo Data Seed Script
 *
 * Creates sectors, skills, interests, and 100 dummy contacts for testing.
 */

import { PrismaClient, ContactSource } from '@prisma/client';

const prisma = new PrismaClient();

// Sectors data
const sectorsData = [
  { name: 'Technology', nameAr: 'التكنولوجيا', icon: 'laptop' },
  { name: 'Finance', nameAr: 'المالية', icon: 'currency' },
  { name: 'Healthcare', nameAr: 'الرعاية الصحية', icon: 'heart' },
  { name: 'Real Estate', nameAr: 'العقارات', icon: 'building' },
  { name: 'E-commerce', nameAr: 'التجارة الإلكترونية', icon: 'cart' },
  { name: 'Education', nameAr: 'التعليم', icon: 'book' },
  { name: 'Manufacturing', nameAr: 'التصنيع', icon: 'factory' },
  { name: 'Consulting', nameAr: 'الاستشارات', icon: 'briefcase' },
  { name: 'Marketing', nameAr: 'التسويق', icon: 'megaphone' },
  { name: 'Legal', nameAr: 'القانون', icon: 'gavel' },
  { name: 'Hospitality', nameAr: 'الضيافة', icon: 'hotel' },
  { name: 'Energy', nameAr: 'الطاقة', icon: 'bolt' },
  { name: 'Transportation', nameAr: 'النقل', icon: 'truck' },
  { name: 'Media', nameAr: 'الإعلام', icon: 'tv' },
  { name: 'Agriculture', nameAr: 'الزراعة', icon: 'leaf' },
];

// Skills data
const skillsData = [
  { name: 'JavaScript', category: 'Technical' },
  { name: 'Python', category: 'Technical' },
  { name: 'React', category: 'Technical' },
  { name: 'Node.js', category: 'Technical' },
  { name: 'Data Analysis', category: 'Technical' },
  { name: 'Machine Learning', category: 'Technical' },
  { name: 'Cloud Computing', category: 'Technical' },
  { name: 'Cybersecurity', category: 'Technical' },
  { name: 'UI/UX Design', category: 'Design' },
  { name: 'Graphic Design', category: 'Design' },
  { name: 'Project Management', category: 'Business' },
  { name: 'Product Management', category: 'Business' },
  { name: 'Sales', category: 'Business' },
  { name: 'Marketing Strategy', category: 'Business' },
  { name: 'Business Development', category: 'Business' },
  { name: 'Financial Analysis', category: 'Business' },
  { name: 'Leadership', category: 'Soft Skills' },
  { name: 'Communication', category: 'Soft Skills' },
  { name: 'Negotiation', category: 'Soft Skills' },
  { name: 'Team Building', category: 'Soft Skills' },
];

// Interests data
const interestsData = [
  { name: 'Startups', nameAr: 'الشركات الناشئة' },
  { name: 'AI & Machine Learning', nameAr: 'الذكاء الاصطناعي' },
  { name: 'Blockchain', nameAr: 'البلوكتشين' },
  { name: 'Sustainability', nameAr: 'الاستدامة' },
  { name: 'Investment', nameAr: 'الاستثمار' },
  { name: 'Venture Capital', nameAr: 'رأس المال المغامر' },
  { name: 'Digital Transformation', nameAr: 'التحول الرقمي' },
  { name: 'Innovation', nameAr: 'الابتكار' },
  { name: 'Networking', nameAr: 'التواصل المهني' },
  { name: 'Mentorship', nameAr: 'الإرشاد' },
];

// Dummy contact names
const firstNames = [
  'Ahmed', 'Mohammed', 'Ali', 'Omar', 'Khalid', 'Faisal', 'Sultan', 'Saad', 'Nasser', 'Abdullah',
  'Sarah', 'Fatima', 'Noura', 'Maha', 'Hala', 'Layla', 'Amal', 'Dana', 'Reem', 'Lina',
  'John', 'Michael', 'David', 'James', 'Robert', 'William', 'Thomas', 'Charles', 'Daniel', 'Matthew',
  'Emma', 'Olivia', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn', 'Abigail',
];

const lastNames = [
  'Al-Rashid', 'Al-Farsi', 'Al-Qasimi', 'Al-Maktoum', 'Al-Nahyan', 'Al-Thani', 'Al-Sabah', 'Al-Saud',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
];

const companies = [
  'TechVentures Inc', 'Global Finance Ltd', 'HealthCare Plus', 'RealEstate Pro', 'E-Shop Solutions',
  'EduTech Academy', 'ManufactureCo', 'ConsultPro Group', 'MarketBoost Agency', 'LegalEagle LLP',
  'TravelJoy Hotels', 'GreenEnergy Corp', 'FastLogistics', 'MediaPulse', 'AgriTech Farms',
  'CloudNine Systems', 'DataDriven Analytics', 'AI Innovations', 'FinTech Solutions', 'CyberShield Security',
  'DesignStudio Pro', 'StartupHub', 'VentureWise Capital', 'InnovateLab', 'Digital Dynamics',
  'Smart Solutions', 'NextGen Tech', 'FutureBuild', 'ConnectPro', 'GrowthPartners',
];

const jobTitles = [
  'CEO', 'CTO', 'CFO', 'COO', 'VP of Engineering', 'VP of Sales', 'VP of Marketing',
  'Director of Operations', 'Senior Developer', 'Product Manager', 'Project Manager',
  'Business Analyst', 'Data Scientist', 'UX Designer', 'Marketing Manager',
  'Sales Executive', 'Account Manager', 'HR Director', 'Legal Counsel', 'Financial Analyst',
  'Consultant', 'Advisor', 'Founder', 'Co-Founder', 'Managing Partner',
  'Investment Analyst', 'Portfolio Manager', 'Risk Manager', 'Strategy Director', 'Innovation Lead',
];

const locations = [
  'Dubai, UAE', 'Abu Dhabi, UAE', 'Sharjah, UAE', 'Riyadh, Saudi Arabia', 'Jeddah, Saudi Arabia',
  'Doha, Qatar', 'Kuwait City, Kuwait', 'Manama, Bahrain', 'Muscat, Oman', 'Cairo, Egypt',
  'London, UK', 'New York, USA', 'San Francisco, USA', 'Singapore', 'Hong Kong',
  'Toronto, Canada', 'Sydney, Australia', 'Berlin, Germany', 'Paris, France', 'Amsterdam, Netherlands',
];

const bios = [
  'Passionate about building innovative solutions that solve real-world problems.',
  'Experienced professional with a track record of driving business growth.',
  'Technology enthusiast focused on digital transformation and innovation.',
  'Results-driven leader with expertise in strategic planning and execution.',
  'Dedicated to creating value through collaboration and partnership.',
  'Entrepreneurial mindset with experience in startups and scaling businesses.',
  'Expert in leveraging data and analytics for business insights.',
  'Committed to sustainable business practices and social impact.',
  'Strong background in finance and investment management.',
  'Skilled in building and leading high-performing teams.',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomItems<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateEmail(firstName: string, lastName: string, company: string): string {
  const domain = company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  return `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, '')}@${domain}`;
}

function generatePhone(): string {
  const countryCode = ['+971', '+966', '+974', '+965', '+973', '+968', '+1', '+44'][Math.floor(Math.random() * 8)];
  const number = Math.floor(Math.random() * 900000000) + 100000000;
  return `${countryCode} ${number.toString().replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}`;
}

async function main() {
  console.log('Starting demo data seed...\n');

  // Get a user to own the contacts
  const users = await prisma.user.findMany({ take: 1 });
  if (users.length === 0) {
    console.error('No users found. Please create a user first.');
    process.exit(1);
  }
  const ownerId = users[0].id;
  console.log(`Using user ${users[0].email} as contact owner\n`);

  // Create sectors (check if exists first)
  console.log('Creating sectors...');
  for (const sector of sectorsData) {
    const existing = await prisma.sector.findFirst({ where: { name: sector.name } });
    if (!existing) {
      await prisma.sector.create({ data: sector });
    }
  }
  const sectors = await prisma.sector.findMany();
  console.log(`Created ${sectors.length} sectors\n`);

  // Create skills (check if exists first)
  console.log('Creating skills...');
  for (const skill of skillsData) {
    const existing = await prisma.skill.findFirst({ where: { name: skill.name } });
    if (!existing) {
      await prisma.skill.create({ data: skill });
    }
  }
  const skills = await prisma.skill.findMany();
  console.log(`Created ${skills.length} skills\n`);

  // Create interests (check if exists first)
  console.log('Creating interests...');
  for (const interest of interestsData) {
    const existing = await prisma.interest.findFirst({ where: { name: interest.name } });
    if (!existing) {
      await prisma.interest.create({ data: interest });
    }
  }
  const interests = await prisma.interest.findMany();
  console.log(`Created ${interests.length} interests\n`);

  // Create 100 contacts
  console.log('Creating 100 dummy contacts...');
  const createdContacts: string[] = [];

  for (let i = 0; i < 100; i++) {
    const firstName = getRandomItem(firstNames);
    const lastName = getRandomItem(lastNames);
    const company = getRandomItem(companies);
    const fullName = `${firstName} ${lastName}`;
    const email = generateEmail(firstName, lastName, company);

    try {
      const contact = await prisma.contact.create({
        data: {
          ownerId,
          fullName,
          email,
          phone: generatePhone(),
          company,
          jobTitle: getRandomItem(jobTitles),
          bio: getRandomItem(bios),
          location: getRandomItem(locations),
          linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase().replace(/[^a-z]/g, '')}`,
          source: getRandomItem(['MANUAL', 'CARD_SCAN', 'IMPORT', 'LINKEDIN']) as ContactSource,
          matchScore: Math.floor(Math.random() * 60) + 40, // 40-100
          contactSectors: {
            create: getRandomItems(sectors, 1, 3).map((s) => ({
              sectorId: s.id,
              confidence: 0.8 + Math.random() * 0.2, // 0.8-1.0
            })),
          },
          contactSkills: {
            create: getRandomItems(skills, 2, 5).map(s => ({
              skillId: s.id,
              confidence: 0.7 + Math.random() * 0.3, // 0.7-1.0
            })),
          },
        },
      });
      createdContacts.push(contact.id);

      if ((i + 1) % 10 === 0) {
        console.log(`  Created ${i + 1}/100 contacts...`);
      }
    } catch (error: any) {
      // Skip duplicates
      if (!error.message.includes('Unique constraint')) {
        console.error(`Error creating contact ${i + 1}:`, error.message);
      }
    }
  }

  console.log(`\nCreated ${createdContacts.length} contacts\n`);

  // Also update the owner user with sectors/skills if they don't have any
  const userWithData = await prisma.user.findUnique({
    where: { id: ownerId },
    include: { userSectors: true, userSkills: true, userInterests: true },
  });

  if (userWithData && userWithData.userSectors.length === 0) {
    console.log('Adding sectors/skills to user for better matching...');

    await prisma.userSector.createMany({
      data: getRandomItems(sectors, 2, 4).map((s, idx) => ({
        userId: ownerId,
        sectorId: s.id,
        isPrimary: idx === 0,
      })),
    });

    await prisma.userSkill.createMany({
      data: getRandomItems(skills, 3, 6).map(s => ({
        userId: ownerId,
        skillId: s.id,
        proficiencyLevel: 'ADVANCED',
      })),
    });

    await prisma.userInterest.createMany({
      data: getRandomItems(interests, 2, 4).map(i => ({
        userId: ownerId,
        interestId: i.id,
      })),
    });

    console.log('User profile updated with sectors, skills, and interests\n');
  }

  // Summary
  const finalContactCount = await prisma.contact.count();
  const finalSectorCount = await prisma.sector.count();
  const finalSkillCount = await prisma.skill.count();
  const finalInterestCount = await prisma.interest.count();

  console.log('='.repeat(50));
  console.log('SEED COMPLETE');
  console.log('='.repeat(50));
  console.log(`Total Contacts: ${finalContactCount}`);
  console.log(`Total Sectors: ${finalSectorCount}`);
  console.log(`Total Skills: ${finalSkillCount}`);
  console.log(`Total Interests: ${finalInterestCount}`);
  console.log('='.repeat(50));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
