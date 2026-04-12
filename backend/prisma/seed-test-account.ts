import { PrismaClient, GoalType, ProficiencyLevel, Intensity, ContactSource, ProjectStage, ProjectVisibility, SkillImportance } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Test account credentials
const TEST_EMAIL = 'testuser@intellmatch.com';
const TEST_PASSWORD = 'Test123!@#';

// Sector IDs from database
const SECTORS = {
  TECHNOLOGY: 'a77da1b0-fa4c-422d-990f-71db0e8cce5e',
  FINANCE: 'ca536883-2ca4-4e57-ac7d-386987145655',
  HEALTHCARE: '9cd7bc68-e911-4a4f-a124-eb7f8dca848e',
  EDUCATION: '05e07f09-b339-407a-8106-f53c7ac23188',
  MARKETING: '00351583-3139-4e00-93ea-ce0686ed58f3',
  CONSULTING: 'f1d811c1-e9e5-41a9-a650-af26a8f85b99',
  ECOMMERCE: '2152fad9-265a-4721-afb4-2367ee3d54d3',
  REAL_ESTATE: '1cfd4008-ac8b-402b-94c8-f01de8532b53',
  MANUFACTURING: '6d3ee839-46a6-41b8-8b30-945ac90789b9',
  MEDIA: 'adbe0c0e-4245-4889-9d0a-7758a99f2a3b',
  LEGAL: 'a8435dad-abeb-460d-b1b3-7ebbea1e4937',
  ENERGY: '207ee79f-b492-4cde-98ee-c3a45b5bcb51',
};

// Skill IDs from database
const SKILLS = {
  PYTHON: '53575fa6-ad3d-4cac-83d9-ccb9b86d80fe',
  REACT: '9ae841df-ce75-4b58-8b4b-f0be1afd8e3d',
  NODE_JS: '48380ff2-25a9-417e-b24c-10b2d906a988',
  MACHINE_LEARNING: '60bd2a16-5921-4029-8aed-bd56233d252f',
  CLOUD_COMPUTING: '2ad16c8f-d33d-4ef1-836d-e645687b9909',
  PRODUCT_MANAGEMENT: '0305a156-dd4a-494d-b26f-c998dff53e41',
  LEADERSHIP: 'a600253c-7515-4dfd-8ee6-7ffba2435752',
  FINANCIAL_ANALYSIS: 'aeba355e-cdec-499d-879e-608376d534cb',
  PROJECT_MANAGEMENT: 'a607b52b-6c86-440c-85ec-c8003204e5f7',
  UIUX_DESIGN: '62a6f02e-b1be-416e-8217-546240038021',
  MARKETING_STRATEGY: '2cbcf1ff-e5b9-493a-919e-97006b6dc1c1',
  BUSINESS_DEVELOPMENT: '399b74f9-85a7-4cb5-b6df-f0a0c8b2dc2b',
  DATA_VISUALIZATION: 'c0d1f8aa-ac1a-4c1a-9ca6-d9277a8f5f83',
  CYBERSECURITY: '9ebc53b3-680c-4b4a-b1c9-ef377dcb5921',
  DOCKER: '2c7407de-10b2-42c6-ad22-fe174d17b337',
  JAVA: 'a40c1e5d-0e1a-4f04-acaf-1d763e732388',
  POSTGRESQL: '41a8ccb2-d259-4b23-8927-72319d729bed',
  LARAVEL: 'b7d3b0fa-d6f4-498a-b017-00bd641feefe',
  FLUTTER: '143b4efd-18b4-474c-badb-fbccc751f805',
  NEGOTIATION: 'e18b8e82-9122-49f9-be33-ac543d883bec',
  COMMUNICATION: '1b7e7762-0904-4b9c-b4c7-4ac283b9c5e5',
  TEAM_BUILDING: '8e18de48-ea47-4b25-89fb-d5688a32cbb7',
};

// Interest IDs from database
const INTERESTS = {
  AI_ML: '02483251-5c5c-4b23-938c-2003e8b0f6e6',
  STARTUPS: '96418873-d955-4e58-b219-235c978ae5bd',
  VENTURE_CAPITAL: '8bd007f1-46a2-4596-bbff-7fe779cae070',
  BLOCKCHAIN: 'ad08011c-bf3e-478e-9152-580a8aaa2a56',
  SUSTAINABILITY: '13a19656-d0ee-426c-b617-09f712ff0ba3',
  INNOVATION: '4aaf81c8-0bc6-4d7d-b4e9-0418a439a4e2',
  NETWORKING: '0bc33f58-6ea3-49a9-a701-25c5d1aae150',
  DIGITAL_TRANSFORMATION: '4a5d3f36-cc19-4b20-891e-7ac3ebe57257',
  INVESTMENT: '68f5a29c-40f0-4a50-aaa9-c595b18f7412',
  DATA_ANALYTICS: 'c831fe47-541a-4fe1-aac1-3f68ba4dacb6',
  MENTORSHIP: 'e91d4b89-1d5a-4db8-837d-bb626db3a4b1',
  RESEARCH: '5a178d5b-1a99-45bb-bce6-b8a4e39a225b',
};

// Contact data - diverse profiles for testing matching
const CONTACTS = [
  // HIGH MATCH - Tech + AI (should match user's interests)
  {
    fullName: 'Sarah Chen',
    email: 'sarah.chen@techstartup.io',
    company: 'AI Innovations Inc',
    jobTitle: 'CTO & Co-founder',
    bio: 'Building the future of AI-powered business solutions. Previously at Google AI. Passionate about machine learning and startup ecosystems.',
    location: 'San Francisco, CA',
    sectors: [SECTORS.TECHNOLOGY],
    skills: [SKILLS.PYTHON, SKILLS.MACHINE_LEARNING, SKILLS.CLOUD_COMPUTING, SKILLS.LEADERSHIP],
  },
  {
    fullName: 'Ahmed Al-Rashid',
    email: 'ahmed@venturefund.ae',
    company: 'Gulf Ventures Capital',
    jobTitle: 'Managing Partner',
    bio: 'Investing in MENA tech startups. Focus on AI, fintech, and healthtech. 15+ years in venture capital.',
    location: 'Dubai, UAE',
    sectors: [SECTORS.FINANCE, SECTORS.TECHNOLOGY],
    skills: [SKILLS.FINANCIAL_ANALYSIS, SKILLS.LEADERSHIP, SKILLS.NEGOTIATION, SKILLS.BUSINESS_DEVELOPMENT],
  },
  {
    fullName: 'Dr. Emily Watson',
    email: 'e.watson@healthai.com',
    company: 'HealthAI Solutions',
    jobTitle: 'Chief Medical Officer',
    bio: 'Bridging healthcare and AI. Leading digital health transformation initiatives. Former Stanford Medical.',
    location: 'Boston, MA',
    sectors: [SECTORS.HEALTHCARE, SECTORS.TECHNOLOGY],
    skills: [SKILLS.MACHINE_LEARNING, SKILLS.DATA_VISUALIZATION, SKILLS.LEADERSHIP, SKILLS.PROJECT_MANAGEMENT],
  },
  // MEDIUM-HIGH MATCH - Startup/Tech founders
  {
    fullName: 'Marcus Johnson',
    email: 'marcus@fintech.co',
    company: 'PayFlow Technologies',
    jobTitle: 'CEO',
    bio: 'Serial entrepreneur. Building the next-gen payment infrastructure. Y Combinator alum.',
    location: 'New York, NY',
    sectors: [SECTORS.FINANCE, SECTORS.TECHNOLOGY, SECTORS.ECOMMERCE],
    skills: [SKILLS.PRODUCT_MANAGEMENT, SKILLS.LEADERSHIP, SKILLS.BUSINESS_DEVELOPMENT],
  },
  {
    fullName: 'Fatima Al-Sayed',
    email: 'fatima@edtech.sa',
    company: 'LearnSmart Arabia',
    jobTitle: 'Founder & CEO',
    bio: 'Transforming education in the Arab world through technology. Focus on personalized learning with AI.',
    location: 'Riyadh, Saudi Arabia',
    sectors: [SECTORS.EDUCATION, SECTORS.TECHNOLOGY],
    skills: [SKILLS.PRODUCT_MANAGEMENT, SKILLS.MACHINE_LEARNING, SKILLS.LEADERSHIP],
  },
  {
    fullName: 'David Kim',
    email: 'david.kim@cloudsec.io',
    company: 'CloudSec Systems',
    jobTitle: 'VP of Engineering',
    bio: 'Cybersecurity expert. Building secure cloud infrastructure. AWS certified solutions architect.',
    location: 'Seattle, WA',
    sectors: [SECTORS.TECHNOLOGY],
    skills: [SKILLS.CYBERSECURITY, SKILLS.CLOUD_COMPUTING, SKILLS.DOCKER, SKILLS.PYTHON],
  },
  // MEDIUM MATCH - Related industries
  {
    fullName: 'Lisa Martinez',
    email: 'lisa@digitalagency.com',
    company: 'Digital Growth Agency',
    jobTitle: 'Head of Strategy',
    bio: 'Digital marketing strategist. Helping startups scale through data-driven marketing.',
    location: 'Los Angeles, CA',
    sectors: [SECTORS.MARKETING, SECTORS.TECHNOLOGY],
    skills: [SKILLS.MARKETING_STRATEGY, SKILLS.DATA_VISUALIZATION, SKILLS.COMMUNICATION],
  },
  {
    fullName: 'James O\'Brien',
    email: 'james@consultpro.com',
    company: 'ConsultPro Partners',
    jobTitle: 'Senior Partner',
    bio: 'Management consultant specializing in digital transformation. Former McKinsey.',
    location: 'London, UK',
    sectors: [SECTORS.CONSULTING, SECTORS.TECHNOLOGY],
    skills: [SKILLS.PROJECT_MANAGEMENT, SKILLS.LEADERSHIP, SKILLS.BUSINESS_DEVELOPMENT],
  },
  {
    fullName: 'Priya Sharma',
    email: 'priya@datainsights.in',
    company: 'DataInsights Analytics',
    jobTitle: 'Data Science Lead',
    bio: 'Expert in big data and predictive analytics. Building data products for enterprises.',
    location: 'Bangalore, India',
    sectors: [SECTORS.TECHNOLOGY, SECTORS.CONSULTING],
    skills: [SKILLS.PYTHON, SKILLS.MACHINE_LEARNING, SKILLS.DATA_VISUALIZATION, SKILLS.POSTGRESQL],
  },
  {
    fullName: 'Michael Thompson',
    email: 'michael@proptech.io',
    company: 'PropTech Solutions',
    jobTitle: 'Co-founder',
    bio: 'Disrupting real estate with technology. Focus on AI-powered property valuation.',
    location: 'Austin, TX',
    sectors: [SECTORS.REAL_ESTATE, SECTORS.TECHNOLOGY],
    skills: [SKILLS.MACHINE_LEARNING, SKILLS.PRODUCT_MANAGEMENT, SKILLS.BUSINESS_DEVELOPMENT],
  },
  // LOWER MATCH - Different sectors
  {
    fullName: 'Jennifer Lee',
    email: 'jennifer@legaltech.com',
    company: 'LegalTech Partners',
    jobTitle: 'Legal Operations Director',
    bio: 'Modernizing legal services through technology. Contract automation specialist.',
    location: 'Chicago, IL',
    sectors: [SECTORS.LEGAL, SECTORS.TECHNOLOGY],
    skills: [SKILLS.PROJECT_MANAGEMENT, SKILLS.NEGOTIATION, SKILLS.COMMUNICATION],
  },
  {
    fullName: 'Robert Chen',
    email: 'robert@cleanenergy.com',
    company: 'CleanEnergy Tech',
    jobTitle: 'Head of Innovation',
    bio: 'Sustainable energy solutions. Building smart grid technologies.',
    location: 'Denver, CO',
    sectors: [SECTORS.ENERGY, SECTORS.TECHNOLOGY],
    skills: [SKILLS.PROJECT_MANAGEMENT, SKILLS.LEADERSHIP, SKILLS.PYTHON],
  },
  {
    fullName: 'Anna Kowalski',
    email: 'anna@mediatech.eu',
    company: 'MediaTech Europe',
    jobTitle: 'Creative Director',
    bio: 'Digital media and content creation. Building interactive experiences.',
    location: 'Berlin, Germany',
    sectors: [SECTORS.MEDIA, SECTORS.TECHNOLOGY],
    skills: [SKILLS.UIUX_DESIGN, SKILLS.PROJECT_MANAGEMENT, SKILLS.COMMUNICATION],
  },
  // Additional diverse contacts
  {
    fullName: 'Omar Hassan',
    email: 'omar@financeai.ae',
    company: 'FinanceAI MENA',
    jobTitle: 'Chief Data Officer',
    bio: 'Leading AI adoption in Middle East banking sector. Former JP Morgan.',
    location: 'Abu Dhabi, UAE',
    sectors: [SECTORS.FINANCE, SECTORS.TECHNOLOGY],
    skills: [SKILLS.MACHINE_LEARNING, SKILLS.FINANCIAL_ANALYSIS, SKILLS.DATA_VISUALIZATION, SKILLS.PYTHON],
  },
  {
    fullName: 'Sophie Dubois',
    email: 'sophie@retailtech.fr',
    company: 'RetailTech France',
    jobTitle: 'VP Product',
    bio: 'Building AI-powered retail solutions. E-commerce optimization expert.',
    location: 'Paris, France',
    sectors: [SECTORS.ECOMMERCE, SECTORS.TECHNOLOGY],
    skills: [SKILLS.PRODUCT_MANAGEMENT, SKILLS.MACHINE_LEARNING, SKILLS.UIUX_DESIGN],
  },
  {
    fullName: 'Yuki Tanaka',
    email: 'yuki@robotics.jp',
    company: 'Tokyo Robotics Lab',
    jobTitle: 'Research Director',
    bio: 'Advancing robotics and AI. Focus on industrial automation.',
    location: 'Tokyo, Japan',
    sectors: [SECTORS.MANUFACTURING, SECTORS.TECHNOLOGY],
    skills: [SKILLS.MACHINE_LEARNING, SKILLS.PYTHON, SKILLS.PROJECT_MANAGEMENT],
  },
  {
    fullName: 'Carlos Mendoza',
    email: 'carlos@healthtech.mx',
    company: 'HealthTech Mexico',
    jobTitle: 'Founder',
    bio: 'Making healthcare accessible through technology. Telemedicine pioneer.',
    location: 'Mexico City, Mexico',
    sectors: [SECTORS.HEALTHCARE, SECTORS.TECHNOLOGY],
    skills: [SKILLS.PRODUCT_MANAGEMENT, SKILLS.LEADERSHIP, SKILLS.BUSINESS_DEVELOPMENT],
  },
  {
    fullName: 'Rachel Green',
    email: 'rachel@vcfund.com',
    company: 'Tech Ventures Fund',
    jobTitle: 'Principal',
    bio: 'Early-stage tech investor. Focus on AI/ML, SaaS, and fintech startups.',
    location: 'San Francisco, CA',
    sectors: [SECTORS.FINANCE, SECTORS.TECHNOLOGY],
    skills: [SKILLS.FINANCIAL_ANALYSIS, SKILLS.BUSINESS_DEVELOPMENT, SKILLS.NEGOTIATION],
  },
  {
    fullName: 'Thomas Weber',
    email: 'thomas@autotech.de',
    company: 'AutoTech Germany',
    jobTitle: 'Chief Engineer',
    bio: 'Autonomous vehicle technology. AI and computer vision specialist.',
    location: 'Munich, Germany',
    sectors: [SECTORS.MANUFACTURING, SECTORS.TECHNOLOGY],
    skills: [SKILLS.MACHINE_LEARNING, SKILLS.PYTHON, SKILLS.CLOUD_COMPUTING],
  },
  {
    fullName: 'Nadia Petrov',
    email: 'nadia@cybersec.ru',
    company: 'CyberShield Security',
    jobTitle: 'Security Architect',
    bio: 'Enterprise cybersecurity expert. Protecting critical infrastructure.',
    location: 'Moscow, Russia',
    sectors: [SECTORS.TECHNOLOGY],
    skills: [SKILLS.CYBERSECURITY, SKILLS.CLOUD_COMPUTING, SKILLS.PYTHON],
  },
  {
    fullName: 'Hassan Ibrahim',
    email: 'hassan@agrtech.eg',
    company: 'AgriTech Egypt',
    jobTitle: 'CEO',
    bio: 'Smart agriculture solutions. Using AI to improve crop yields.',
    location: 'Cairo, Egypt',
    sectors: [SECTORS.TECHNOLOGY],
    skills: [SKILLS.MACHINE_LEARNING, SKILLS.DATA_VISUALIZATION, SKILLS.LEADERSHIP],
  },
  {
    fullName: 'Michelle Wu',
    email: 'michelle@aiassist.com',
    company: 'AI Assistant Labs',
    jobTitle: 'Chief Product Officer',
    bio: 'Building conversational AI products. NLP and chatbot specialist.',
    location: 'Toronto, Canada',
    sectors: [SECTORS.TECHNOLOGY],
    skills: [SKILLS.PRODUCT_MANAGEMENT, SKILLS.MACHINE_LEARNING, SKILLS.PYTHON, SKILLS.UIUX_DESIGN],
  },
  {
    fullName: 'Alex Novak',
    email: 'alex@devops.io',
    company: 'DevOps Solutions',
    jobTitle: 'Principal Engineer',
    bio: 'DevOps and SRE expert. Building scalable infrastructure.',
    location: 'Sydney, Australia',
    sectors: [SECTORS.TECHNOLOGY],
    skills: [SKILLS.DOCKER, SKILLS.CLOUD_COMPUTING, SKILLS.PYTHON, SKILLS.POSTGRESQL],
  },
  {
    fullName: 'Elena Rossi',
    email: 'elena@fashiontech.it',
    company: 'FashionTech Milano',
    jobTitle: 'Head of Digital',
    bio: 'Digital transformation in fashion. AI-powered trend prediction.',
    location: 'Milan, Italy',
    sectors: [SECTORS.ECOMMERCE, SECTORS.TECHNOLOGY, SECTORS.MEDIA],
    skills: [SKILLS.MACHINE_LEARNING, SKILLS.MARKETING_STRATEGY, SKILLS.DATA_VISUALIZATION],
  },
  {
    fullName: 'Daniel Brown',
    email: 'daniel@blockchain.io',
    company: 'BlockChain Ventures',
    jobTitle: 'Blockchain Architect',
    bio: 'Web3 and DeFi specialist. Building decentralized applications.',
    location: 'Singapore',
    sectors: [SECTORS.FINANCE, SECTORS.TECHNOLOGY],
    skills: [SKILLS.PYTHON, SKILLS.CYBERSECURITY, SKILLS.CLOUD_COMPUTING],
  },
];

async function main() {
  console.log('🚀 Starting test account seed...\n');

  // Check if test user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_EMAIL }
  });

  if (existingUser) {
    console.log('⚠️  Test user already exists. Deleting and recreating...');
    await prisma.user.delete({ where: { email: TEST_EMAIL } });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // Create test user
  console.log('📝 Creating test user...');
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      fullName: 'Alex Thompson',
      jobTitle: 'Founder & CEO',
      company: 'TechVentures AI',
      bio: 'Serial entrepreneur building AI-powered products. Looking for investors, technical co-founders, and strategic partners. Passionate about startups, machine learning, and innovation.',
      location: 'San Francisco, CA',
      linkedinUrl: 'https://linkedin.com/in/alexthompson',
      emailVerified: true,
      isActive: true,
      consentEnrichment: true,
      consentContacts: true,
      consentAnalytics: true,
    }
  });
  console.log(`✅ Created user: ${user.fullName} (${user.email})`);

  // Add user sectors
  console.log('📂 Adding user sectors...');
  await prisma.userSector.createMany({
    data: [
      { userId: user.id, sectorId: SECTORS.TECHNOLOGY, isPrimary: true, experienceYears: 10 },
      { userId: user.id, sectorId: SECTORS.FINANCE, isPrimary: false, experienceYears: 5 },
      { userId: user.id, sectorId: SECTORS.CONSULTING, isPrimary: false, experienceYears: 3 },
    ]
  });

  // Add user skills
  console.log('🛠️  Adding user skills...');
  await prisma.userSkill.createMany({
    data: [
      { userId: user.id, skillId: SKILLS.PYTHON, proficiencyLevel: 'EXPERT' },
      { userId: user.id, skillId: SKILLS.MACHINE_LEARNING, proficiencyLevel: 'ADVANCED' },
      { userId: user.id, skillId: SKILLS.PRODUCT_MANAGEMENT, proficiencyLevel: 'EXPERT' },
      { userId: user.id, skillId: SKILLS.LEADERSHIP, proficiencyLevel: 'EXPERT' },
      { userId: user.id, skillId: SKILLS.CLOUD_COMPUTING, proficiencyLevel: 'ADVANCED' },
      { userId: user.id, skillId: SKILLS.BUSINESS_DEVELOPMENT, proficiencyLevel: 'ADVANCED' },
    ]
  });

  // Add user interests
  console.log('💡 Adding user interests...');
  await prisma.userInterest.createMany({
    data: [
      { userId: user.id, interestId: INTERESTS.AI_ML, intensity: 'PASSIONATE' },
      { userId: user.id, interestId: INTERESTS.STARTUPS, intensity: 'PASSIONATE' },
      { userId: user.id, interestId: INTERESTS.VENTURE_CAPITAL, intensity: 'PASSIONATE' },
      { userId: user.id, interestId: INTERESTS.INNOVATION, intensity: 'MODERATE' },
      { userId: user.id, interestId: INTERESTS.DIGITAL_TRANSFORMATION, intensity: 'MODERATE' },
      { userId: user.id, interestId: INTERESTS.INVESTMENT, intensity: 'MODERATE' },
    ]
  });

  // Add user goals
  console.log('🎯 Adding user goals...');
  await prisma.userGoal.createMany({
    data: [
      { userId: user.id, goalType: 'INVESTMENT', description: 'Seeking seed funding for AI startup', priority: 1 },
      { userId: user.id, goalType: 'PARTNERSHIP', description: 'Looking for strategic technology partners', priority: 2 },
      { userId: user.id, goalType: 'HIRING', description: 'Building a world-class engineering team', priority: 3 },
      { userId: user.id, goalType: 'COLLABORATION', description: 'Open to collaboration on AI projects', priority: 4 },
    ]
  });

  // Create contacts
  console.log(`\n👥 Creating ${CONTACTS.length} contacts...`);

  for (const contactData of CONTACTS) {
    const contact = await prisma.contact.create({
      data: {
        ownerId: user.id,
        fullName: contactData.fullName,
        email: contactData.email,
        company: contactData.company,
        jobTitle: contactData.jobTitle,
        bio: contactData.bio,
        location: contactData.location,
        source: 'MANUAL',
      }
    });

    // Add contact sectors
    if (contactData.sectors && contactData.sectors.length > 0) {
      await prisma.contactSector.createMany({
        data: contactData.sectors.map((sectorId, index) => ({
          contactId: contact.id,
          sectorId,
          confidence: 1.0,
          source: 'USER',
        }))
      });
    }

    // Add contact skills
    if (contactData.skills && contactData.skills.length > 0) {
      await prisma.contactSkill.createMany({
        data: contactData.skills.map(skillId => ({
          contactId: contact.id,
          skillId,
          confidence: 1.0,
          source: 'USER',
        }))
      });
    }

    console.log(`   ✅ ${contact.fullName} (${contact.jobTitle} at ${contact.company})`);
  }

  // Create a sample project for project matching
  console.log('\n📋 Creating test project...');
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      title: 'AI-Powered Business Intelligence Platform',
      summary: 'Building an intelligent business analytics platform that uses machine learning to provide actionable insights for enterprises. Looking for technical co-founders, investors, and strategic partners.',
      detailedDesc: 'Our platform combines advanced machine learning with intuitive visualization to help businesses make data-driven decisions. We use natural language processing for query interfaces and predictive analytics for forecasting. Target market includes mid-size to enterprise companies in finance, healthcare, and retail sectors.',
      category: 'SaaS',
      stage: 'MVP',
      investmentRange: '$500K - $2M',
      timeline: '12-18 months',
      lookingFor: ['investor', 'technical_partner', 'cofounder'],
      keywords: ['machine learning', 'business intelligence', 'data analytics', 'AI', 'SaaS', 'enterprise', 'predictive analytics'],
      visibility: 'PUBLIC',
      isActive: true,
    }
  });

  // Add project sectors
  await prisma.projectSector.createMany({
    data: [
      { projectId: project.id, sectorId: SECTORS.TECHNOLOGY },
      { projectId: project.id, sectorId: SECTORS.FINANCE },
      { projectId: project.id, sectorId: SECTORS.CONSULTING },
    ]
  });

  // Add project skills
  await prisma.projectSkill.createMany({
    data: [
      { projectId: project.id, skillId: SKILLS.MACHINE_LEARNING, importance: 'REQUIRED' },
      { projectId: project.id, skillId: SKILLS.PYTHON, importance: 'REQUIRED' },
      { projectId: project.id, skillId: SKILLS.DATA_VISUALIZATION, importance: 'REQUIRED' },
      { projectId: project.id, skillId: SKILLS.CLOUD_COMPUTING, importance: 'PREFERRED' },
      { projectId: project.id, skillId: SKILLS.PRODUCT_MANAGEMENT, importance: 'PREFERRED' },
      { projectId: project.id, skillId: SKILLS.BUSINESS_DEVELOPMENT, importance: 'NICE_TO_HAVE' },
    ]
  });

  console.log(`✅ Created project: ${project.title}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SEED COMPLETE - TEST ACCOUNT SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n🔐 Login Credentials:`);
  console.log(`   Email:    ${TEST_EMAIL}`);
  console.log(`   Password: ${TEST_PASSWORD}`);
  console.log(`\n📈 Profile:`);
  console.log(`   Name:     ${user.fullName}`);
  console.log(`   Title:    ${user.jobTitle} at ${user.company}`);
  console.log(`   Sectors:  3 (Technology, Finance, Consulting)`);
  console.log(`   Skills:   6 (Python, ML, Product Mgmt, etc.)`);
  console.log(`   Interests: 6 (AI/ML, Startups, VC, etc.)`);
  console.log(`   Goals:    4 (Investment, Partnership, Hiring, Collaboration)`);
  console.log(`\n👥 Contacts: ${CONTACTS.length} diverse connections`);
  console.log(`   - High match potential: ~8 (AI/Tech founders, VCs)`);
  console.log(`   - Medium match: ~10 (Related tech industries)`);
  console.log(`   - Lower match: ~7 (Different sectors)`);
  console.log(`\n📋 Projects: 1 (AI Business Intelligence Platform)`);
  console.log('\n✨ Ready for matching tests!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
