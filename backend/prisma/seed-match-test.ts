/**
 * Match Test Seed Script
 *
 * Creates a comprehensive test user with 50 contacts for match algorithm testing.
 * All data is realistic with authentic Arabic names (transliterated) and professional backgrounds.
 *
 * Usage: npm run seed:match-test
 *
 * Test User: matchtest@p2p.test / Test123!
 *
 * @module prisma/seed-match-test
 */

import { PrismaClient, ProficiencyLevel, Intensity, GoalType, ContactSource, SectorSource } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// =============================================================================
// TEST USER CREDENTIALS
// =============================================================================

const TEST_EMAIL = 'matchtest@p2p.test';
const TEST_PASSWORD = 'Test123!';

// =============================================================================
// TEST USER DATA - Khalid Al-Mansouri (Tech Entrepreneur)
// =============================================================================

const TEST_USER_DATA = {
  email: TEST_EMAIL,
  fullName: 'Khalid Al-Mansouri',
  jobTitle: 'Founder & CEO',
  company: 'NexGen Innovations',
  bio: 'Serial entrepreneur with 15+ years in tech. Founded 3 startups with 1 successful exit to a Fortune 500 company. Passionate about AI, blockchain, and sustainable tech. Currently focused on mentoring the next generation of founders, angel investing in early-stage startups, and building strategic partnerships across the Middle East region.',
  location: 'Dubai, UAE',
  linkedinUrl: 'https://linkedin.com/in/khalialmansouri',
  websiteUrl: 'https://nexgeninnovations.io',
  twitterUrl: 'https://twitter.com/khalmansouri',
  phone: '+971501234567',
  timezone: 'Asia/Dubai',
  avatarUrl: null,
  emailVerified: true,
  isActive: true,
  consentEnrichment: true,
  consentContacts: true,
  consentAnalytics: true,
};

// User's sectors with experience years
const USER_SECTORS = [
  { name: 'Technology', isPrimary: true, experienceYears: 15 },
  { name: 'Artificial Intelligence', isPrimary: false, experienceYears: 10 },
  { name: 'Finance', isPrimary: false, experienceYears: 8 },
  { name: 'Venture Capital', isPrimary: false, experienceYears: 5 },
  { name: 'Consulting', isPrimary: false, experienceYears: 12 },
];

// User's skills with proficiency levels
const USER_SKILLS: { name: string; level: ProficiencyLevel }[] = [
  { name: 'Leadership', level: 'EXPERT' },
  { name: 'Strategic Planning', level: 'EXPERT' },
  { name: 'Product Management', level: 'ADVANCED' },
  { name: 'Machine Learning', level: 'ADVANCED' },
  { name: 'Business Development', level: 'EXPERT' },
  { name: 'Fundraising', level: 'EXPERT' },
  { name: 'Python', level: 'INTERMEDIATE' },
  { name: 'Public Speaking', level: 'ADVANCED' },
  { name: 'Negotiation', level: 'EXPERT' },
  { name: 'Team Building', level: 'EXPERT' },
];

// User's interests with intensity
const USER_INTERESTS: { name: string; intensity: Intensity }[] = [
  { name: 'Artificial Intelligence', intensity: 'PASSIONATE' },
  { name: 'Startups', intensity: 'PASSIONATE' },
  { name: 'Venture Capital', intensity: 'PASSIONATE' },
  { name: 'Sustainability', intensity: 'MODERATE' },
  { name: 'Mentorship', intensity: 'PASSIONATE' },
  { name: 'Web3 & Crypto', intensity: 'MODERATE' },
  { name: 'Innovation', intensity: 'PASSIONATE' },
  { name: 'Investing', intensity: 'PASSIONATE' },
];

// User's hobbies
const USER_HOBBIES = ['Golf', 'Reading', 'Travel', 'Photography', 'Wine Tasting', 'Meditation'];

// User's networking goals
const USER_GOALS: { goalType: GoalType; priority: number; description: string }[] = [
  { goalType: 'INVESTMENT', priority: 1, description: 'Looking to invest in early-stage startups in AI, FinTech, and CleanTech sectors' },
  { goalType: 'MENTORSHIP', priority: 2, description: 'Mentor aspiring entrepreneurs and help them navigate their startup journey' },
  { goalType: 'PARTNERSHIP', priority: 3, description: 'Find strategic partners for expansion in the MENA region' },
  { goalType: 'COLLABORATION', priority: 4, description: 'Collaborate on AI projects with technical co-founders' },
];

// =============================================================================
// CONTACT DATA - 50 Contacts with Complete Information
// =============================================================================

interface ContactData {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  website: string;
  linkedinUrl: string;
  bio: string;
  location: string;
  source: ContactSource;
  notes: string | null;
  sectors: string[];
  skills: string[];
  interests: string[];
  hobbies: string[];
}

// -----------------------------------------------------------------------------
// VERY HIGH MATCH CONTACTS (8) - Score 80-100
// These have maximum overlap with Khalid's profile
// -----------------------------------------------------------------------------

const VERY_HIGH_MATCH_CONTACTS: ContactData[] = [
  {
    fullName: 'Sara Al-Harbi',
    email: 'sara.alharbi@aiventures.sa',
    phone: '+966551234567',
    company: 'AI Ventures Saudi',
    jobTitle: 'CTO & Co-founder',
    website: 'https://aiventures.sa',
    linkedinUrl: 'https://linkedin.com/in/saraalharbi',
    bio: 'Building AI solutions for government and enterprise clients in Saudi Arabia. Former ML team lead at Aramco. PhD in Computer Science from KAUST. Passionate about responsible AI development and building products that make a real difference in people\'s lives.',
    location: 'Riyadh, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Met at LEAP Summit 2024. Very interested in AI collaboration projects.',
    sectors: ['Technology', 'Artificial Intelligence', 'Cloud Computing'],
    skills: ['Machine Learning', 'Python', 'Leadership', 'Product Management', 'AWS'],
    interests: ['Artificial Intelligence', 'Startups', 'Innovation'],
    hobbies: ['Hiking', 'Reading', 'Photography'],
  },
  {
    fullName: 'Ahmed Al-Rashid',
    email: 'ahmed.alrashid@gulfventures.ae',
    phone: '+971502345678',
    company: 'Gulf Ventures Capital',
    jobTitle: 'Managing Partner',
    website: 'https://gulfventures.ae',
    linkedinUrl: 'https://linkedin.com/in/ahmedalrashid',
    bio: 'Managing a $500M fund focused on MENA tech investments. 20+ years in venture capital and private equity. Board member at 12 portfolio companies. Passionate about building the next generation of tech unicorns in the Middle East.',
    location: 'Abu Dhabi, UAE',
    source: 'MANUAL',
    notes: 'Key investor contact. Met at Dubai FinTech Summit. Interested in co-investing.',
    sectors: ['Venture Capital', 'Finance', 'Technology'],
    skills: ['Investment Analysis', 'Strategic Planning', 'Negotiation', 'Leadership', 'Financial Analysis'],
    interests: ['Venture Capital', 'Startups', 'Investing'],
    hobbies: ['Golf', 'Travel', 'Reading'],
  },
  {
    fullName: 'Mohammed Al-Qasimi',
    email: 'mohammed.alqasimi@serialvc.ae',
    phone: '+971503456789',
    company: 'Serial Ventures MENA',
    jobTitle: 'Founder & General Partner',
    website: 'https://serialventures.ae',
    linkedinUrl: 'https://linkedin.com/in/mohammedalqasimi',
    bio: 'Serial entrepreneur turned VC. Founded 4 startups with 2 successful exits including a $150M acquisition. Now investing in AI, FinTech, and B2B SaaS. Advisor to 25+ startups. MBA from London Business School.',
    location: 'Dubai, UAE',
    source: 'LINKEDIN',
    notes: 'Strong alignment on investment thesis. Potential partner for regional expansion.',
    sectors: ['Technology', 'Artificial Intelligence', 'FinTech'],
    skills: ['Leadership', 'Business Development', 'Fundraising', 'Product Management', 'Strategic Planning'],
    interests: ['Startups', 'Mentorship', 'Artificial Intelligence', 'Venture Capital'],
    hobbies: ['Golf', 'Reading', 'Meditation'],
  },
  {
    fullName: 'Layla Al-Omari',
    email: 'layla.alomari@angelsynd.ae',
    phone: '+971504567890',
    company: 'MENA Angel Syndicate',
    jobTitle: 'Angel Investor & Strategic Advisor',
    website: 'https://laylaomari.vc',
    linkedinUrl: 'https://linkedin.com/in/laylaalomari',
    bio: 'Active angel investor with 40+ portfolio companies. Former VP at Oracle Middle East. Focus on enterprise SaaS and AI startups. Passionate mentor helping founders scale and secure funding. Forbes Most Influential Women in Tech honoree.',
    location: 'Dubai, UAE',
    source: 'MANUAL',
    notes: 'Excellent syndicate lead. Can help with US fundraising round.',
    sectors: ['Venture Capital', 'Technology', 'Consulting'],
    skills: ['Investment Analysis', 'Strategic Planning', 'Mentorship', 'Business Development', 'Leadership'],
    interests: ['Venture Capital', 'Mentorship', 'Startups', 'Innovation'],
    hobbies: ['Yoga', 'Wine Tasting', 'Travel'],
  },
  {
    fullName: 'Tarek Al-Hashmi',
    email: 'tarek.alhashmi@blocksolutions.ae',
    phone: '+971505678901',
    company: 'BlockChain Solutions Gulf',
    jobTitle: 'Founder & CEO',
    website: 'https://blocksolutions.ae',
    linkedinUrl: 'https://linkedin.com/in/tarekalhashmi',
    bio: 'Building enterprise blockchain infrastructure. Former CTO at Binance Middle East. 15 years in distributed systems. Led development of payment solutions processing billions annually. Passionate about Web3 and decentralized finance.',
    location: 'Dubai, UAE',
    source: 'LINKEDIN',
    notes: 'Exploring partnership for blockchain-based supply chain project.',
    sectors: ['Technology', 'FinTech', 'Software Development'],
    skills: ['Blockchain', 'Leadership', 'Business Development', 'Strategic Planning', 'Python'],
    interests: ['Web3 & Crypto', 'Startups', 'Innovation', 'Investing'],
    hobbies: ['Surfing', 'Photography', 'Gaming'],
  },
  {
    fullName: 'Noor Al-Said',
    email: 'noor.alsaid@techcorp.ae',
    phone: '+971506789012',
    company: 'Emirates Tech Corporation',
    jobTitle: 'VP of Innovation',
    website: 'https://emiratestech.ae',
    linkedinUrl: 'https://linkedin.com/in/nooralsaid',
    bio: 'Leading innovation initiatives at a Fortune 500 tech company. Previously founded 2 startups acquired by Emirates Tech. MBA from INSEAD, engineering from American University. Focus on AI integration and digital transformation.',
    location: 'Dubai, UAE',
    source: 'MANUAL',
    notes: 'Interested in corporate partnership opportunities. Strong enterprise network.',
    sectors: ['Technology', 'Artificial Intelligence', 'Consulting'],
    skills: ['Product Management', 'Machine Learning', 'Team Building', 'Strategic Planning', 'Leadership'],
    interests: ['Innovation', 'Artificial Intelligence', 'Mentorship', 'Startups'],
    hobbies: ['Running', 'Reading', 'Travel'],
  },
  {
    fullName: 'Faisal Al-Dossary',
    email: 'faisal.aldossary@techfundgcc.com',
    phone: '+966559876543',
    company: 'GCC Tech Fund',
    jobTitle: 'Investment Director',
    website: 'https://gcctechfund.com',
    linkedinUrl: 'https://linkedin.com/in/faisalaldossary',
    bio: 'Managing early to growth stage investments across GCC. $2B AUM. Former investment banking at Goldman Sachs. Wharton MBA. Focus on cross-border tech deals and helping companies scale regionally.',
    location: 'Riyadh, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Strong LP network in GCC. Potential Series B lead investor.',
    sectors: ['Venture Capital', 'Technology', 'Finance'],
    skills: ['Fundraising', 'Negotiation', 'Strategic Planning', 'Investment Analysis', 'Financial Analysis'],
    interests: ['Venture Capital', 'Investing', 'Startups'],
    hobbies: ['Golf', 'Tennis', 'Wine Tasting'],
  },
  {
    fullName: 'Reem Al-Fahad',
    email: 'reem.alfahad@founderscoach.ae',
    phone: '+971507890123',
    company: 'Founders Academy MENA',
    jobTitle: 'Executive Coach & Startup Mentor',
    website: 'https://foundersacademy.ae',
    linkedinUrl: 'https://linkedin.com/in/reemalfahad',
    bio: 'Executive coach specializing in founder development. Former COO at Careem. Mentored 200+ founders across MENA. MBA from Emirates Business School, ICF certified coach. Passionate about helping founders build resilient companies.',
    location: 'Dubai, UAE',
    source: 'MANUAL',
    notes: 'Excellent mentor resource for portfolio companies. Great regional network.',
    sectors: ['Consulting', 'Technology', 'Education'],
    skills: ['Leadership', 'Public Speaking', 'Team Building', 'Communication', 'Strategic Planning'],
    interests: ['Mentorship', 'Startups', 'Entrepreneurship', 'Innovation'],
    hobbies: ['Yoga', 'Reading', 'Meditation'],
  },
];

// -----------------------------------------------------------------------------
// HIGH MATCH CONTACTS (12) - Score 60-79
// Good overlap but not perfect alignment
// -----------------------------------------------------------------------------

const HIGH_MATCH_CONTACTS: ContactData[] = [
  {
    fullName: 'Omar Al-Balushi',
    email: 'omar.albalushi@fintech360.om',
    phone: '+96891234567',
    company: 'FinTech 360 Oman',
    jobTitle: 'Chief Product Officer',
    website: 'https://fintech360.om',
    linkedinUrl: 'https://linkedin.com/in/omaralbalushi',
    bio: 'Building next-gen payment infrastructure. 12 years in fintech product development. Former product lead at an Omani payments startup. CS from Sultan Qaboos University, MBA from INSEAD. Focus on financial inclusion and emerging markets.',
    location: 'Muscat, Oman',
    source: 'LINKEDIN',
    notes: 'Potential partner for payment integration.',
    sectors: ['FinTech', 'Technology', 'Finance'],
    skills: ['Product Management', 'Business Development', 'Strategic Planning', 'Leadership'],
    interests: ['Startups', 'Innovation', 'Investing'],
    hobbies: ['Cycling', 'Photography', 'Cooking'],
  },
  {
    fullName: 'Fatima Al-Hassan',
    email: 'fatima.alhassan@menatechhub.ae',
    phone: '+971508901234',
    company: 'MENA Tech Hub',
    jobTitle: 'Executive Director',
    website: 'https://menatechhub.ae',
    linkedinUrl: 'https://linkedin.com/in/fatimaalhassan',
    bio: 'Building the largest tech ecosystem in MENA. Former government advisor on digital transformation. 15 years in tech policy and startup development. Passionate about bridging the gap between startups and corporates.',
    location: 'Dubai, UAE',
    source: 'MANUAL',
    notes: 'Key ecosystem connector. Can facilitate government partnerships.',
    sectors: ['Technology', 'Consulting', 'Government'],
    skills: ['Strategic Planning', 'Business Development', 'Public Speaking', 'Leadership'],
    interests: ['Startups', 'Innovation', 'Mentorship'],
    hobbies: ['Reading', 'Travel', 'Photography'],
  },
  {
    fullName: 'Yasser Al-Shammari',
    email: 'yasser.alshammari@dataai.sa',
    phone: '+966561234567',
    company: 'DataAI Solutions Saudi',
    jobTitle: 'Founder & CTO',
    website: 'https://dataai.sa',
    linkedinUrl: 'https://linkedin.com/in/yasseralshammari',
    bio: 'Building enterprise AI solutions for data analytics. PhD in Computer Science from KFUPM. Former research scientist at IBM Research. 40+ patents in data processing and machine learning. Advisory board member at 5 AI startups.',
    location: 'Dhahran, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Technical expert for AI due diligence. Great for technical validation.',
    sectors: ['Artificial Intelligence', 'Technology', 'Software Development'],
    skills: ['Machine Learning', 'Deep Learning', 'Python', 'Data Science', 'Leadership'],
    interests: ['Artificial Intelligence', 'Innovation', 'Startups'],
    hobbies: ['Chess', 'Reading', 'Hiking'],
  },
  {
    fullName: 'Hind Al-Kaabi',
    email: 'hind.alkaabi@japanvc.ae',
    phone: '+971509012345',
    company: 'Japan-MENA Ventures',
    jobTitle: 'Partner',
    website: 'https://japanmena.vc',
    linkedinUrl: 'https://linkedin.com/in/hindalkaabi',
    bio: 'Leading investments in deep tech and AI. Former strategy consultant at McKinsey. Harvard MBA. Focus on Japan-MENA tech corridor and helping startups enter Japanese and Gulf markets.',
    location: 'Dubai, UAE',
    source: 'LINKEDIN',
    notes: 'Gateway to Japanese market. Strong corporate network.',
    sectors: ['Venture Capital', 'Technology', 'Finance'],
    skills: ['Investment Analysis', 'Strategic Planning', 'Business Development', 'Negotiation'],
    interests: ['Venture Capital', 'Startups', 'Artificial Intelligence'],
    hobbies: ['Golf', 'Reading', 'Travel'],
  },
  {
    fullName: 'Sultan Al-Nuaimi',
    email: 'sultan.alnuaimi@sustaintech.ae',
    phone: '+971500123456',
    company: 'SustainTech Ventures Gulf',
    jobTitle: 'Managing Partner',
    website: 'https://sustaintech.ae',
    linkedinUrl: 'https://linkedin.com/in/sultanalnuaimi',
    bio: 'Climate-focused VC with $300M under management. Former sustainability lead at Masdar. Yale School of the Environment. Investing in cleantech, sustainable agriculture, and circular economy startups.',
    location: 'Abu Dhabi, UAE',
    source: 'MANUAL',
    notes: 'CleanTech investment expert. Aligned on sustainability focus.',
    sectors: ['Venture Capital', 'CleanTech', 'Finance'],
    skills: ['Investment Analysis', 'Strategic Planning', 'Fundraising', 'Leadership'],
    interests: ['Sustainability', 'Climate Tech', 'Investing', 'Venture Capital'],
    hobbies: ['Hiking', 'Yoga', 'Gardening'],
  },
  {
    fullName: 'Mariam Al-Zaheri',
    email: 'mariam.alzaheri@latamtech.ae',
    phone: '+971501234567',
    company: 'LatAm-MENA Tech Bridge',
    jobTitle: 'Program Director',
    website: 'https://latammena.tech',
    linkedinUrl: 'https://linkedin.com/in/mariamalzaheri',
    bio: 'Running a leading accelerator connecting Latin America with MENA. Former founder of 2 acquired startups. Stanford GSB MBA. Helped 80+ startups raise over $400M in funding.',
    location: 'Dubai, UAE',
    source: 'LINKEDIN',
    notes: 'LatAm market expert. Good for regional expansion strategy.',
    sectors: ['Technology', 'Education', 'Consulting'],
    skills: ['Business Development', 'Mentorship', 'Leadership', 'Public Speaking'],
    interests: ['Startups', 'Mentorship', 'Entrepreneurship'],
    hobbies: ['Football', 'Cooking', 'Travel'],
  },
  {
    fullName: 'Khaled Al-Otaibi',
    email: 'khaled.alotaibi@eufintech.sa',
    phone: '+966562345678',
    company: 'EU-Saudi FinTech Association',
    jobTitle: 'Secretary General',
    website: 'https://eusafintech.org',
    linkedinUrl: 'https://linkedin.com/in/khaledalotaibi',
    bio: 'Leading voice in Saudi-European fintech policy. Former banker turned regulator. London Business School MBA. Advising SAMA on digital finance regulation. Connector between fintech startups and traditional finance.',
    location: 'Riyadh, Saudi Arabia',
    source: 'MANUAL',
    notes: 'Key regulatory insights for Saudi expansion.',
    sectors: ['FinTech', 'Finance', 'Government'],
    skills: ['Strategic Planning', 'Public Speaking', 'Negotiation', 'Leadership'],
    interests: ['Startups', 'Innovation', 'Business Strategy'],
    hobbies: ['Running', 'Reading', 'Music'],
  },
  {
    fullName: 'Dana Al-Shehhi',
    email: 'dana.alshehhi@cyberdefense.ae',
    phone: '+971502345678',
    company: 'CyberDefense Emirates',
    jobTitle: 'CEO & Founder',
    website: 'https://cyberdefense.ae',
    linkedinUrl: 'https://linkedin.com/in/danaalshehhi',
    bio: 'Building enterprise cybersecurity solutions. Former UAE Armed Forces engineer in cyber warfare unit. CS from Khalifa University. Raised $40M Series B. Protecting Fortune 500 companies from advanced threats. Advisor to UAE government on cyber policy.',
    location: 'Abu Dhabi, UAE',
    source: 'LINKEDIN',
    notes: 'Cybersecurity expert. Potential portfolio company synergy.',
    sectors: ['Cybersecurity', 'Technology', 'Software Development'],
    skills: ['Leadership', 'Business Development', 'Strategic Planning', 'Cybersecurity'],
    interests: ['Innovation', 'Startups', 'Artificial Intelligence'],
    hobbies: ['Tennis', 'Photography', 'Travel'],
  },
  {
    fullName: 'Abdullah Al-Mazrouei',
    email: 'abdullah.almazrouei@impactfund.ae',
    phone: '+971503456789',
    company: 'Impact Capital Emirates',
    jobTitle: 'Investment Principal',
    website: 'https://impactcapital.ae',
    linkedinUrl: 'https://linkedin.com/in/abdullahalmazrouei',
    bio: 'Impact investing focused on tech for good. INSEAD MBA. Former BCG consultant. Managing AED 1B fund targeting social enterprises and sustainable startups. Board member at 6 portfolio companies.',
    location: 'Dubai, UAE',
    source: 'MANUAL',
    notes: 'Impact investment expert. ESG-focused investor network.',
    sectors: ['Venture Capital', 'Finance', 'Consulting'],
    skills: ['Investment Analysis', 'Financial Analysis', 'Strategic Planning', 'Leadership'],
    interests: ['Sustainability', 'Social Impact', 'Investing', 'Venture Capital'],
    hobbies: ['Cooking', 'Wine Tasting', 'Reading'],
  },
  {
    fullName: 'Lina Al-Kandari',
    email: 'lina.alkandari@cloudscale.kw',
    phone: '+96599123456',
    company: 'CloudScale Kuwait',
    jobTitle: 'VP of Engineering',
    website: 'https://cloudscale.kw',
    linkedinUrl: 'https://linkedin.com/in/linaalkandari',
    bio: 'Scaling cloud infrastructure at a $3B unicorn. Former engineering lead at AWS Middle East. MIT CS degree. Led teams of 150+ engineers. Expert in distributed systems, Kubernetes, and cloud architecture.',
    location: 'Kuwait City, Kuwait',
    source: 'LINKEDIN',
    notes: 'Technical advisor for cloud infrastructure decisions.',
    sectors: ['Cloud Computing', 'Technology', 'Software Development'],
    skills: ['AWS', 'Kubernetes', 'Leadership', 'Team Building', 'Python'],
    interests: ['Innovation', 'Startups', 'Artificial Intelligence'],
    hobbies: ['Hiking', 'Gaming', 'Photography'],
  },
  {
    fullName: 'Jassim Al-Ansari',
    email: 'jassim.alansari@gcchealth.qa',
    phone: '+97455123456',
    company: 'GCC HealthTech Qatar',
    jobTitle: 'Founder & CEO',
    website: 'https://gcchealth.qa',
    linkedinUrl: 'https://linkedin.com/in/jassimalansari',
    bio: 'Building digital health solutions for the Gulf region. Former physician turned entrepreneur. MD from Johns Hopkins, MBA from INSEAD. Raised $25M to transform healthcare delivery. Advisor to Qatar Ministry of Public Health.',
    location: 'Doha, Qatar',
    source: 'MANUAL',
    notes: 'HealthTech expert in GCC. Potential co-investment target.',
    sectors: ['HealthTech', 'Technology', 'Healthcare'],
    skills: ['Leadership', 'Product Management', 'Business Development', 'Strategic Planning'],
    interests: ['Startups', 'Innovation', 'Mentorship'],
    hobbies: ['Yoga', 'Reading', 'Travel'],
  },
  {
    fullName: 'Noura Al-Badr',
    email: 'noura.albadr@proptech.bh',
    phone: '+97339123456',
    company: 'PropTech Bahrain',
    jobTitle: 'Co-founder & COO',
    website: 'https://proptechbahrain.com',
    linkedinUrl: 'https://linkedin.com/in/nouraalbadr',
    bio: 'Digitizing real estate transactions across the Gulf. Former property developer. Dubai Business School MBA. Built platform processing $500M+ in annual transactions. Expanding to MENA markets.',
    location: 'Manama, Bahrain',
    source: 'LINKEDIN',
    notes: 'PropTech expert. Interested in MENA expansion partnership.',
    sectors: ['PropTech', 'Technology', 'Real Estate'],
    skills: ['Business Development', 'Product Management', 'Negotiation', 'Leadership'],
    interests: ['Real Estate Investment', 'Startups', 'Innovation'],
    hobbies: ['Golf', 'Running', 'Travel'],
  },
];

// -----------------------------------------------------------------------------
// MEDIUM MATCH CONTACTS (15) - Score 40-59
// Some commonality but different primary focus
// -----------------------------------------------------------------------------

const MEDIUM_MATCH_CONTACTS: ContactData[] = [
  {
    fullName: 'Dr. Mona Al-Zahrani',
    email: 'mona.alzahrani@biomedresearch.sa',
    phone: '+966563456789',
    company: 'BioMed Research Saudi',
    jobTitle: 'Chief Scientific Officer',
    website: 'https://biomedresearch.sa',
    linkedinUrl: 'https://linkedin.com/in/monaalzahrani',
    bio: 'Leading biotech research with focus on AI-driven drug discovery. PhD in Biochemistry from MIT. Former Pfizer researcher. Published 60+ scientific papers. Building bridges between traditional pharma and tech startups.',
    location: 'Jeddah, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Biotech expert. Can advise on healthtech investments.',
    sectors: ['Healthcare', 'Pharmaceuticals', 'Technology'],
    skills: ['Data Science', 'Leadership', 'Strategic Planning'],
    interests: ['Artificial Intelligence', 'Innovation'],
    hobbies: ['Running', 'Reading', 'Cooking'],
  },
  {
    fullName: 'Sami Al-Qahtani',
    email: 'sami.alqahtani@legaltech.sa',
    phone: '+966564567890',
    company: 'LegalTech Saudi',
    jobTitle: 'Managing Director',
    website: 'https://legaltech.sa',
    linkedinUrl: 'https://linkedin.com/in/samialqahtani',
    bio: 'Transforming legal services through technology. Former law firm partner. Law degree from King Saud University, LBS MBA. Invested in 10+ legaltech startups. Advisory board member at Ministry of Justice tech committee.',
    location: 'Riyadh, Saudi Arabia',
    source: 'MANUAL',
    notes: 'Legal industry connections. Useful for compliance matters.',
    sectors: ['Legal Services', 'Technology', 'Consulting'],
    skills: ['Negotiation', 'Strategic Planning', 'Business Development'],
    interests: ['Innovation', 'Startups', 'Business Strategy'],
    hobbies: ['Golf', 'Reading', 'Travel'],
  },
  {
    fullName: 'Hala Al-Mutairi',
    email: 'hala.almutairi@edtechglobal.kw',
    phone: '+96599234567',
    company: 'EdTech Global Kuwait',
    jobTitle: 'Head of Partnerships',
    website: 'https://edtechglobal.kw',
    linkedinUrl: 'https://linkedin.com/in/halaalmutairi',
    bio: 'Building edtech partnerships across the Gulf. Former teacher turned tech executive. EdD from Columbia University. Passionate about democratizing access to quality education through technology.',
    location: 'Kuwait City, Kuwait',
    source: 'LINKEDIN',
    notes: 'EdTech market insights for Asia.',
    sectors: ['EdTech', 'Education', 'Technology'],
    skills: ['Business Development', 'Public Speaking', 'Strategic Planning'],
    interests: ['Education Reform', 'Innovation', 'Mentorship'],
    hobbies: ['Yoga', 'Photography', 'Travel'],
  },
  {
    fullName: 'Adel Al-Hammadi',
    email: 'adel.alhammadi@hrtech.ae',
    phone: '+971504567890',
    company: 'HRTech Emirates',
    jobTitle: 'VP of Sales',
    website: 'https://hrtech.ae',
    linkedinUrl: 'https://linkedin.com/in/adelalhammadi',
    bio: 'Scaling HR technology solutions regionally. Former enterprise sales at Workday. MBA from Mohammed Bin Rashid School of Government. Built sales organizations from 5 to 50+ people. Expert in B2B go-to-market strategy.',
    location: 'Dubai, UAE',
    source: 'LINKEDIN',
    notes: 'Enterprise B2B sales expertise.',
    sectors: ['Human Resources', 'Technology', 'Software Development'],
    skills: ['Sales', 'Business Development', 'Leadership', 'Team Building'],
    interests: ['Startups', 'Innovation'],
    hobbies: ['Basketball', 'Travel', 'Cooking'],
  },
  {
    fullName: 'Rana Al-Salem',
    email: 'rana.alsalem@marketingai.sa',
    phone: '+966565678901',
    company: 'Marketing AI Arabia',
    jobTitle: 'Chief Marketing Officer',
    website: 'https://marketingai.sa',
    linkedinUrl: 'https://linkedin.com/in/ranaalsalem',
    bio: 'Leading marketing innovation with AI. Former CMO at two unicorn startups. NYU Stern MBA. Built brands from zero to $100M ARR. Advisor to 8+ marketing tech startups.',
    location: 'Riyadh, Saudi Arabia',
    source: 'MANUAL',
    notes: 'Marketing expertise for portfolio companies.',
    sectors: ['Advertising', 'Technology', 'Media'],
    skills: ['Digital Marketing', 'Strategic Planning', 'Leadership', 'Content Marketing'],
    interests: ['Innovation', 'Startups', 'Artificial Intelligence'],
    hobbies: ['Photography', 'Running', 'Travel'],
  },
  {
    fullName: 'Dr. Yousef Al-Mari',
    email: 'yousef.almari@meddevices.qa',
    phone: '+97455234567',
    company: 'Gulf Medical Devices Qatar',
    jobTitle: 'CEO',
    website: 'https://gulfmeddevices.qa',
    linkedinUrl: 'https://linkedin.com/in/yousefalmari',
    bio: 'Building medical device manufacturing in Qatar. Former surgeon. MD from King\'s College London. Raised $35M for manufacturing facility. Focus on making healthcare more accessible and affordable in the region.',
    location: 'Doha, Qatar',
    source: 'MANUAL',
    notes: 'Healthcare manufacturing expert in GCC.',
    sectors: ['Medical Devices', 'Healthcare', 'Manufacturing'],
    skills: ['Leadership', 'Business Development', 'Fundraising'],
    interests: ['Innovation', 'Startups'],
    hobbies: ['Tennis', 'Reading', 'Travel'],
  },
  {
    fullName: 'Sara Al-Ajmi',
    email: 'sara.alajmi@retailtech.kw',
    phone: '+96599345678',
    company: 'RetailTech Kuwait',
    jobTitle: 'Director of Operations',
    website: 'https://retailtech.kw',
    linkedinUrl: 'https://linkedin.com/in/saraalajmi',
    bio: 'Transforming retail operations through technology. Former operations lead at regional e-commerce company. Kuwait Business School MBA. Expert in supply chain optimization and last-mile delivery. Building the future of retail in the Gulf.',
    location: 'Kuwait City, Kuwait',
    source: 'LINKEDIN',
    notes: 'Retail operations expertise for e-commerce investments.',
    sectors: ['Retail', 'E-commerce', 'Logistics'],
    skills: ['Project Management', 'Strategic Planning', 'Business Development'],
    interests: ['Innovation', 'Startups'],
    hobbies: ['Yoga', 'Cooking', 'Photography'],
  },
  {
    fullName: 'Badr Al-Anazi',
    email: 'badr.alanazi@energytech.sa',
    phone: '+966566789012',
    company: 'EnergyTech Saudi',
    jobTitle: 'Senior Principal',
    website: 'https://energytech.sa',
    linkedinUrl: 'https://linkedin.com/in/badralanazi',
    bio: 'Investing in energy transition technologies. Former Saudi Aramco Energy engineer. PhD in Materials Science from Caltech. Focus on battery technology, grid storage, and renewable energy infrastructure.',
    location: 'Dhahran, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Energy tech investment expert.',
    sectors: ['Energy', 'Renewable Energy', 'Venture Capital'],
    skills: ['Investment Analysis', 'Strategic Planning', 'Leadership'],
    interests: ['Sustainability', 'Climate Tech', 'Investing'],
    hobbies: ['Cycling', 'Hiking', 'Photography'],
  },
  {
    fullName: 'Maha Al-Dosari',
    email: 'maha.aldosari@compliance.sa',
    phone: '+966567890123',
    company: 'Compliance Tech Saudi',
    jobTitle: 'Head of Regulatory Affairs',
    website: 'https://compliancetech.sa',
    linkedinUrl: 'https://linkedin.com/in/mahaaldosari',
    bio: 'Navigating complex regulatory landscapes for fintech. Former SAMA regulator. Law degree from King Saud University. Expert in open banking and crypto regulation. Helping startups build compliance-first products.',
    location: 'Riyadh, Saudi Arabia',
    source: 'MANUAL',
    notes: 'Regulatory expertise for fintech investments.',
    sectors: ['FinTech', 'Legal Services', 'Consulting'],
    skills: ['Strategic Planning', 'Negotiation', 'Communication'],
    interests: ['Innovation', 'Business Strategy'],
    hobbies: ['Reading', 'Running', 'Travel'],
  },
  {
    fullName: 'Rashid Al-Harthi',
    email: 'rashid.alharthi@gamingtech.sa',
    phone: '+966568901234',
    company: 'Gaming Tech Arabia',
    jobTitle: 'Co-founder & CPO',
    website: 'https://gamingtech.sa',
    linkedinUrl: 'https://linkedin.com/in/rashidalharthi',
    bio: 'Building next-gen gaming platforms. Former product lead at EA Middle East. CS from KFUPM. Expert in game economics, virtual economies, and player engagement. 5M+ daily active users on platform.',
    location: 'Riyadh, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Gaming industry expert. Web3 gaming potential.',
    sectors: ['Gaming', 'Technology', 'Entertainment'],
    skills: ['Product Management', 'Machine Learning', 'Leadership'],
    interests: ['Web3 & Crypto', 'Innovation', 'Startups'],
    hobbies: ['Gaming', 'Photography', 'Travel'],
  },
  {
    fullName: 'Dima Al-Khalifi',
    email: 'dima.alkhalifi@dataprivacy.bh',
    phone: '+97339234567',
    company: 'DataPrivacy Bahrain',
    jobTitle: 'Founder & CEO',
    website: 'https://dataprivacy.bh',
    linkedinUrl: 'https://linkedin.com/in/dimaalkhalifi',
    bio: 'Data privacy compliance solutions for Gulf tech companies. Former regulatory consultant for Bahrain government. Law degree from University of Bahrain. Helping 300+ companies navigate data protection regulations. Speaker at major privacy conferences.',
    location: 'Manama, Bahrain',
    source: 'MANUAL',
    notes: 'Data privacy expert.',
    sectors: ['Technology', 'Legal Services', 'Consulting'],
    skills: ['Strategic Planning', 'Public Speaking', 'Leadership'],
    interests: ['Innovation', 'Business Strategy'],
    hobbies: ['Dancing', 'Travel', 'Photography'],
  },
  {
    fullName: 'Majed Al-Subaie',
    email: 'majed.alsubaie@supplychainai.sa',
    phone: '+966569012345',
    company: 'SupplyChain AI Saudi',
    jobTitle: 'CTO',
    website: 'https://supplychainai.sa',
    linkedinUrl: 'https://linkedin.com/in/majedalsubaie',
    bio: 'AI-powered supply chain optimization. Former logistics engineer at Amazon Middle East. MS in Operations Research from Georgia Tech. Built systems managing $40B in inventory. Patent holder in predictive logistics.',
    location: 'Riyadh, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Supply chain tech expert.',
    sectors: ['Logistics', 'Technology', 'Artificial Intelligence'],
    skills: ['Machine Learning', 'Python', 'Data Science', 'Leadership'],
    interests: ['Artificial Intelligence', 'Innovation'],
    hobbies: ['Cycling', 'Gaming', 'Photography'],
  },
  {
    fullName: 'Nadia Al-Amadi',
    email: 'nadia.alamadi@insuretech.qa',
    phone: '+97455345678',
    company: 'InsureTech Qatar',
    jobTitle: 'Head of Business Development',
    website: 'https://insuretech.qa',
    linkedinUrl: 'https://linkedin.com/in/nadiaalamadi',
    bio: 'Digitizing insurance across the Gulf. Former actuarial analyst at Allianz. HEC Paris MBA. Building partnerships between insurtech startups and traditional insurers.',
    location: 'Doha, Qatar',
    source: 'MANUAL',
    notes: 'Insurance industry connections in GCC.',
    sectors: ['FinTech', 'Finance', 'Technology'],
    skills: ['Business Development', 'Financial Analysis', 'Negotiation'],
    interests: ['Innovation', 'Startups'],
    hobbies: ['Skiing', 'Travel', 'Reading'],
  },
  {
    fullName: 'Waleed Al-Shehri',
    email: 'waleed.alshehri@africatech.sa',
    phone: '+966560123456',
    company: 'Saudi-Africa Tech Bridge',
    jobTitle: 'Executive Director',
    website: 'https://saudiafricatech.org',
    linkedinUrl: 'https://linkedin.com/in/waleedalshehri',
    bio: 'Building the Saudi-African tech ecosystem. Former Google Africa lead. Lagos Business School MBA. Mentored 400+ African founders. Advocate for investing in African tech talent and startups.',
    location: 'Riyadh, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'African market expert. Gateway to Nigerian tech.',
    sectors: ['Technology', 'Education', 'Consulting'],
    skills: ['Leadership', 'Business Development', 'Public Speaking', 'Mentorship'],
    interests: ['Startups', 'Mentorship', 'Innovation'],
    hobbies: ['Football', 'Reading', 'Travel'],
  },
  {
    fullName: 'Jameela Al-Ghamdi',
    email: 'jameela.alghamdi@roboticslab.sa',
    phone: '+966561234567',
    company: 'Robotics Lab Saudi',
    jobTitle: 'Research Director',
    website: 'https://roboticslab.sa',
    linkedinUrl: 'https://linkedin.com/in/jameelalghamdi',
    bio: 'Leading industrial robotics research. PhD in Robotics from Tsinghua University. Former research scientist at SenseTime. 25+ patents in automation and computer vision. Bridging academic research and commercial applications.',
    location: 'Riyadh, Saudi Arabia',
    source: 'MANUAL',
    notes: 'Robotics and automation expert.',
    sectors: ['Technology', 'Manufacturing', 'Artificial Intelligence'],
    skills: ['Machine Learning', 'Python', 'Leadership', 'Data Science'],
    interests: ['Artificial Intelligence', 'Robotics', 'Innovation'],
    hobbies: ['Painting', 'Reading', 'Hiking'],
  },
];

// -----------------------------------------------------------------------------
// LOW MATCH CONTACTS (10) - Score 20-39
// Different industries, minimal overlap
// -----------------------------------------------------------------------------

const LOW_MATCH_CONTACTS: ContactData[] = [
  {
    fullName: 'Nasser Al-Mheiri',
    email: 'nasser.almheiri@constructionpro.ae',
    phone: '+971505678901',
    company: 'Construction Pro Emirates',
    jobTitle: 'Project Manager',
    website: 'https://constructionpro.ae',
    linkedinUrl: 'https://linkedin.com/in/nasseralmheiri',
    bio: 'Managing large-scale commercial construction projects. 20 years in construction industry. PMP certified. Focus on sustainable building practices and green certifications. Built $2B+ in commercial real estate.',
    location: 'Dubai, UAE',
    source: 'CARD_SCAN',
    notes: 'Met at real estate conference. General contractor contact.',
    sectors: ['Real Estate', 'Manufacturing'],
    skills: ['Project Management', 'Negotiation'],
    interests: ['Real Estate Investment'],
    hobbies: ['Fishing', 'Golf', 'Camping'],
  },
  {
    fullName: 'Amal Al-Ketbi',
    email: 'amal.alketbi@fashionhouse.ae',
    phone: '+971506789012',
    company: 'Fashion House Emirates',
    jobTitle: 'Creative Director',
    website: 'https://fashionhouse.ae',
    linkedinUrl: 'https://linkedin.com/in/amalalketbi',
    bio: 'Leading creative direction for luxury fashion brand. Esmod Dubai graduate. Former designer at Elie Saab. Focus on sustainable fashion and ethical manufacturing. Featured in Vogue Arabia and Harper\'s Bazaar.',
    location: 'Dubai, UAE',
    source: 'MANUAL',
    notes: 'Fashion industry contact. Limited tech overlap.',
    sectors: ['Retail', 'Manufacturing'],
    skills: ['Graphic Design', 'Leadership'],
    interests: ['Sustainability', 'Art & Design'],
    hobbies: ['Photography', 'Travel', 'Painting'],
  },
  {
    fullName: 'Hamad Al-Kathiri',
    email: 'hamad.alkathiri@pubgroup.om',
    phone: '+96892234567',
    company: 'Omani Hospitality Group',
    jobTitle: 'Operations Manager',
    website: 'https://omanihospitality.om',
    linkedinUrl: 'https://linkedin.com/in/hamadalkathiri',
    bio: 'Managing a chain of 20 restaurants and cafes in Oman. Former hospitality management at Ritz-Carlton. Focus on authentic Omani hospitality and local sourcing. Expanding to international franchise model.',
    location: 'Muscat, Oman',
    source: 'LINKEDIN',
    notes: 'Hospitality industry contact.',
    sectors: ['Hospitality', 'Retail'],
    skills: ['Project Management', 'Team Building'],
    interests: [],
    hobbies: ['Football', 'Cooking', 'Music Production'],
  },
  {
    fullName: 'Sheikha Al-Mansouri',
    email: 'sheikha.almansouri@interiordesign.ae',
    phone: '+971507890123',
    company: 'Al Mansouri Interior Design',
    jobTitle: 'Principal Designer',
    website: 'https://almansouridesign.ae',
    linkedinUrl: 'https://linkedin.com/in/sheikhalmansouri',
    bio: 'Award-winning interior designer. Parsons School of Design graduate. Focus on luxury residential villas and boutique hospitality. Featured in Architectural Digest Arabia. Projects in 12 countries.',
    location: 'Dubai, UAE',
    source: 'CARD_SCAN',
    notes: 'Design contact for office renovations.',
    sectors: ['Real Estate', 'Consulting'],
    skills: ['Graphic Design', 'Project Management'],
    interests: ['Art & Design', 'Travel'],
    hobbies: ['Painting', 'Photography', 'Yoga'],
  },
  {
    fullName: 'Saud Al-Harbi',
    email: 'saud.alharbi@automotiveparts.sa',
    phone: '+966562345678',
    company: 'Premium Automotive Saudi',
    jobTitle: 'Sales Director',
    website: 'https://premiumauto.sa',
    linkedinUrl: 'https://linkedin.com/in/saudalharbi',
    bio: 'Leading sales for automotive parts distributor. 15 years in automotive industry. Built distribution network across GCC region. Expert in B2B sales and dealer relationships.',
    location: 'Jeddah, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Automotive industry contact.',
    sectors: ['Manufacturing', 'Retail'],
    skills: ['Sales', 'Business Development'],
    interests: [],
    hobbies: ['Golf', 'Football', 'Fishing'],
  },
  {
    fullName: 'Wafa Al-Balushi',
    email: 'wafa.albalushi@eventplanning.om',
    phone: '+96892345678',
    company: 'Elegant Events Oman',
    jobTitle: 'Founder & CEO',
    website: 'https://elegantevents.om',
    linkedinUrl: 'https://linkedin.com/in/wafaalbalushi',
    bio: 'Luxury event planning and management. Former events manager at Shangri-La Hotel. Specialized in corporate retreats and high-end weddings. Planned 400+ events for Fortune 500 companies.',
    location: 'Muscat, Oman',
    source: 'MANUAL',
    notes: 'Event planning contact for company functions.',
    sectors: ['Hospitality', 'Media'],
    skills: ['Project Management', 'Negotiation', 'Team Building'],
    interests: ['Networking'],
    hobbies: ['Travel', 'Wine Tasting', 'Dancing'],
  },
  {
    fullName: 'Hamoud Al-Dhafiri',
    email: 'hamoud.aldhafiri@landscaping.kw',
    phone: '+96599456789',
    company: 'Al Dhafiri Landscaping',
    jobTitle: 'Owner',
    website: 'https://aldhafirilandscaping.kw',
    linkedinUrl: 'https://linkedin.com/in/hamoudaldhafiri',
    bio: 'Premium landscaping services for commercial properties. 18 years in business. Focus on sustainable landscaping and water conservation. Serving Fortune 500 company headquarters.',
    location: 'Kuwait City, Kuwait',
    source: 'CARD_SCAN',
    notes: 'Landscaping vendor for office properties.',
    sectors: ['Real Estate', 'Agriculture'],
    skills: ['Project Management', 'Sales'],
    interests: ['Sustainability'],
    hobbies: ['Gardening', 'Hiking', 'Photography'],
  },
  {
    fullName: 'Hessa Al-Rumaihi',
    email: 'hessa.alrumaihi@artgallery.bh',
    phone: '+97339456789',
    company: 'Al Rumaihi Art Gallery',
    jobTitle: 'Gallery Director',
    website: 'https://alrumaihigallery.bh',
    linkedinUrl: 'https://linkedin.com/in/hessaalrumaihi',
    bio: 'Curating contemporary art exhibitions. Former Christie\'s specialist. Art History degree from Sotheby\'s Institute. Representing emerging artists from across the Arab world. Advisor to private art collectors.',
    location: 'Manama, Bahrain',
    source: 'MANUAL',
    notes: 'Art world contact.',
    sectors: ['Entertainment', 'Retail'],
    skills: ['Communication', 'Negotiation'],
    interests: ['Art & Design'],
    hobbies: ['Painting', 'Travel', 'Photography'],
  },
  {
    fullName: 'Fahad Al-Harthi',
    email: 'fahad.alharthi@printingservices.sa',
    phone: '+966563456789',
    company: 'Al Harthi Commercial Printing',
    jobTitle: 'General Manager',
    website: 'https://alharthiprinting.sa',
    linkedinUrl: 'https://linkedin.com/in/fahadalharthi',
    bio: 'Commercial printing services for businesses. Third generation family business. Focus on eco-friendly printing and packaging. Serving Saudi tech companies for 35 years.',
    location: 'Riyadh, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Printing vendor contact.',
    sectors: ['Manufacturing', 'Media'],
    skills: ['Sales', 'Project Management'],
    interests: [],
    hobbies: ['Fishing', 'Gardening', 'Camping'],
  },
  {
    fullName: 'Alia Al-Majed',
    email: 'alia.almajed@fitnessstudio.kw',
    phone: '+96599567890',
    company: 'Elite Fitness Kuwait',
    jobTitle: 'Franchise Owner',
    website: 'https://elitefitness.kw',
    linkedinUrl: 'https://linkedin.com/in/aliaalmajed',
    bio: 'Operating 4 fitness studio franchises. Former professional athlete. ACE certified personal trainer. Focus on boutique fitness experiences. Building community through health and wellness.',
    location: 'Kuwait City, Kuwait',
    source: 'CARD_SCAN',
    notes: 'Fitness industry contact.',
    sectors: ['Retail', 'Hospitality'],
    skills: ['Leadership', 'Sales'],
    interests: ['Fitness & Wellness'],
    hobbies: ['Running', 'Yoga', 'Cycling'],
  },
];

// -----------------------------------------------------------------------------
// VERY LOW MATCH CONTACTS (5) - Score 0-19
// Almost no overlap - different industries entirely
// -----------------------------------------------------------------------------

const VERY_LOW_MATCH_CONTACTS: ContactData[] = [
  {
    fullName: 'Thamer Al-Ajmi',
    email: 'thamer.alajmi@farmco.kw',
    phone: '+96599678901',
    company: 'Al Ajmi Family Farms',
    jobTitle: 'Farm Owner',
    website: 'https://alajmifarms.kw',
    linkedinUrl: 'https://linkedin.com/in/thameralajmi',
    bio: 'Third generation organic vegetable farmer. 3,000 dunams in Kuwait. Focus on sustainable farming practices. Implementing precision agriculture technologies. Board member at local agricultural cooperative.',
    location: 'Kuwait City, Kuwait',
    source: 'CARD_SCAN',
    notes: 'Met at business conference. Agricultural industry.',
    sectors: ['Agriculture'],
    skills: ['Project Management'],
    interests: ['Sustainability'],
    hobbies: ['Fishing', 'Camping', 'Gardening'],
  },
  {
    fullName: 'Munira Al-Shammari',
    email: 'munira.alshammari@libraryservices.sa',
    phone: '+966564567890',
    company: 'Saudi Public Library System',
    jobTitle: 'Library Director',
    website: 'https://publiclibrary.gov.sa',
    linkedinUrl: 'https://linkedin.com/in/muniraalshammari',
    bio: 'Managing regional library system with 12 branches. MLS from Imam University. 25 years in public library service. Focus on community engagement and digital literacy programs.',
    location: 'Riyadh, Saudi Arabia',
    source: 'MANUAL',
    notes: 'Public sector contact.',
    sectors: ['Government', 'Education'],
    skills: ['Leadership', 'Communication'],
    interests: ['Reading', 'Education Reform'],
    hobbies: ['Reading', 'Gardening', 'Crafts & DIY'],
  },
  {
    fullName: 'Saleh Al-Qarni',
    email: 'saleh.alqarni@trucking.sa',
    phone: '+966565678901',
    company: 'Al Qarni Trucking Inc',
    jobTitle: 'Fleet Manager',
    website: 'https://alqarnitrucking.sa',
    linkedinUrl: 'https://linkedin.com/in/salehalqarni',
    bio: 'Managing fleet of 150 commercial trucks. 20 years in transportation industry. Commercial driving license holder. Focus on driver safety and fuel efficiency. Serving customers across the Gulf.',
    location: 'Dammam, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Transportation industry contact.',
    sectors: ['Transportation', 'Logistics'],
    skills: ['Project Management'],
    interests: [],
    hobbies: ['Fishing', 'Football', 'Camping'],
  },
  {
    fullName: 'Noura Al-Mutawa',
    email: 'noura.almutawa@nonprofit.kw',
    phone: '+96599789012',
    company: 'Kuwait Community Food Bank',
    jobTitle: 'Executive Director',
    website: 'https://kuwaitfoodbank.org',
    linkedinUrl: 'https://linkedin.com/in/nouraalmutawa',
    bio: 'Leading regional food bank serving 400,000 people annually. Former social worker. MSW from Kuwait University. Focus on food insecurity and community nutrition programs. Building partnerships with local businesses.',
    location: 'Kuwait City, Kuwait',
    source: 'MANUAL',
    notes: 'Non-profit sector contact. Potential CSR partnership.',
    sectors: ['Non-profit'],
    skills: ['Leadership', 'Public Speaking'],
    interests: ['Social Impact', 'Volunteering'],
    hobbies: ['Gardening', 'Cooking', 'Reading'],
  },
  {
    fullName: 'Abdulrahman Al-Fadli',
    email: 'abdulrahman.alfadli@plumbing.sa',
    phone: '+966566789012',
    company: 'Al Fadli Plumbing Services',
    jobTitle: 'Owner',
    website: 'https://alfadliplumbing.sa',
    linkedinUrl: 'https://linkedin.com/in/abdulrahmanalfadli',
    bio: 'Commercial and residential plumbing services. Master plumber with 25 years experience. Union trained. Focus on quality workmanship and customer satisfaction. Serving greater Riyadh area.',
    location: 'Riyadh, Saudi Arabia',
    source: 'CARD_SCAN',
    notes: 'Building services contact.',
    sectors: ['Manufacturing'],
    skills: ['Project Management', 'Team Building'],
    interests: [],
    hobbies: ['Fishing', 'Football', 'Camping'],
  },
];

// =============================================================================
// COMBINE ALL CONTACTS
// =============================================================================

const ALL_CONTACTS: ContactData[] = [
  ...VERY_HIGH_MATCH_CONTACTS,
  ...HIGH_MATCH_CONTACTS,
  ...MEDIUM_MATCH_CONTACTS,
  ...LOW_MATCH_CONTACTS,
  ...VERY_LOW_MATCH_CONTACTS,
];

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function main() {
  console.log('🚀 Starting Match Test Seed...\n');

  // -------------------------------------------------------------------------
  // Step 1: Clean up existing test user data
  // -------------------------------------------------------------------------
  console.log('🧹 Cleaning up existing test data...');

  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
  });

  if (existingUser) {
    // Delete all related data first (cascade should handle most, but be explicit)
    await prisma.contact.deleteMany({ where: { ownerId: existingUser.id } });
    await prisma.userSector.deleteMany({ where: { userId: existingUser.id } });
    await prisma.userSkill.deleteMany({ where: { userId: existingUser.id } });
    await prisma.userInterest.deleteMany({ where: { userId: existingUser.id } });
    await prisma.userHobby.deleteMany({ where: { userId: existingUser.id } });
    await prisma.userGoal.deleteMany({ where: { userId: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
    console.log('   ✓ Deleted existing test user and related data');
  }

  // -------------------------------------------------------------------------
  // Step 2: Get taxonomy data for lookups
  // -------------------------------------------------------------------------
  console.log('\n📚 Loading taxonomy data...');

  const [sectors, skills, interests, hobbies] = await Promise.all([
    prisma.sector.findMany(),
    prisma.skill.findMany(),
    prisma.interest.findMany(),
    prisma.hobby.findMany(),
  ]);

  const sectorMap = new Map(sectors.map(s => [s.name, s.id]));
  const skillMap = new Map(skills.map(s => [s.name, s.id]));
  const interestMap = new Map(interests.map(i => [i.name, i.id]));
  const hobbyMap = new Map(hobbies.map(h => [h.name, h.id]));

  console.log(`   ✓ Loaded ${sectors.length} sectors`);
  console.log(`   ✓ Loaded ${skills.length} skills`);
  console.log(`   ✓ Loaded ${interests.length} interests`);
  console.log(`   ✓ Loaded ${hobbies.length} hobbies`);

  // -------------------------------------------------------------------------
  // Step 3: Create test user
  // -------------------------------------------------------------------------
  console.log('\n👤 Creating test user: Khalid Al-Mansouri...');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      ...TEST_USER_DATA,
      passwordHash,
    },
  });

  console.log(`   ✓ Created user: ${user.fullName} (${user.email})`);

  // -------------------------------------------------------------------------
  // Step 4: Create user sectors
  // -------------------------------------------------------------------------
  console.log('\n📊 Adding user sectors...');

  for (const sector of USER_SECTORS) {
    const sectorId = sectorMap.get(sector.name);
    if (sectorId) {
      await prisma.userSector.create({
        data: {
          userId: user.id,
          sectorId,
          isPrimary: sector.isPrimary,
          experienceYears: sector.experienceYears,
        },
      });
      console.log(`   ✓ ${sector.name} (${sector.experienceYears} years${sector.isPrimary ? ', Primary' : ''})`);
    } else {
      console.log(`   ⚠ Sector not found: ${sector.name}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Create user skills
  // -------------------------------------------------------------------------
  console.log('\n🛠️ Adding user skills...');

  for (const skill of USER_SKILLS) {
    const skillId = skillMap.get(skill.name);
    if (skillId) {
      await prisma.userSkill.create({
        data: {
          userId: user.id,
          skillId,
          proficiencyLevel: skill.level,
        },
      });
      console.log(`   ✓ ${skill.name} (${skill.level})`);
    } else {
      console.log(`   ⚠ Skill not found: ${skill.name}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: Create user interests
  // -------------------------------------------------------------------------
  console.log('\n💡 Adding user interests...');

  for (const interest of USER_INTERESTS) {
    const interestId = interestMap.get(interest.name);
    if (interestId) {
      await prisma.userInterest.create({
        data: {
          userId: user.id,
          interestId,
          intensity: interest.intensity,
        },
      });
      console.log(`   ✓ ${interest.name} (${interest.intensity})`);
    } else {
      console.log(`   ⚠ Interest not found: ${interest.name}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 7: Create user hobbies
  // -------------------------------------------------------------------------
  console.log('\n🎯 Adding user hobbies...');

  for (const hobbyName of USER_HOBBIES) {
    const hobbyId = hobbyMap.get(hobbyName);
    if (hobbyId) {
      await prisma.userHobby.create({
        data: {
          userId: user.id,
          hobbyId,
        },
      });
      console.log(`   ✓ ${hobbyName}`);
    } else {
      console.log(`   ⚠ Hobby not found: ${hobbyName}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 8: Create user goals
  // -------------------------------------------------------------------------
  console.log('\n🎯 Adding user goals...');

  for (const goal of USER_GOALS) {
    await prisma.userGoal.create({
      data: {
        userId: user.id,
        goalType: goal.goalType,
        priority: goal.priority,
        description: goal.description,
        isActive: true,
      },
    });
    console.log(`   ✓ ${goal.goalType} (Priority ${goal.priority})`);
  }

  // -------------------------------------------------------------------------
  // Step 9: Create all 50 contacts
  // -------------------------------------------------------------------------
  console.log('\n📇 Creating 50 contacts...\n');

  let contactCount = 0;

  for (const contactData of ALL_CONTACTS) {
    contactCount++;

    // Create the contact
    const contact = await prisma.contact.create({
      data: {
        ownerId: user.id,
        fullName: contactData.fullName,
        email: contactData.email,
        phone: contactData.phone,
        company: contactData.company,
        jobTitle: contactData.jobTitle,
        website: contactData.website,
        linkedinUrl: contactData.linkedinUrl,
        bio: contactData.bio,
        location: contactData.location,
        source: contactData.source,
        notes: contactData.notes,
      },
    });

    // Add contact sectors
    for (const sectorName of contactData.sectors) {
      const sectorId = sectorMap.get(sectorName);
      if (sectorId) {
        await prisma.contactSector.create({
          data: {
            contactId: contact.id,
            sectorId,
            confidence: 0.95,
            source: 'USER' as SectorSource,
          },
        });
      }
    }

    // Add contact skills
    for (const skillName of contactData.skills) {
      const skillId = skillMap.get(skillName);
      if (skillId) {
        await prisma.contactSkill.create({
          data: {
            contactId: contact.id,
            skillId,
            confidence: 0.90,
            source: 'USER' as SectorSource,
          },
        });
      }
    }

    // Add contact interests
    for (const interestName of contactData.interests) {
      const interestId = interestMap.get(interestName);
      if (interestId) {
        await prisma.contactInterest.create({
          data: {
            contactId: contact.id,
            interestId,
            confidence: 0.85,
            source: 'USER' as SectorSource,
          },
        });
      }
    }

    // Add contact hobbies
    for (const hobbyName of contactData.hobbies) {
      const hobbyId = hobbyMap.get(hobbyName);
      if (hobbyId) {
        await prisma.contactHobby.create({
          data: {
            contactId: contact.id,
            hobbyId,
            confidence: 0.80,
            source: 'USER' as SectorSource,
          },
        });
      }
    }

    // Determine match level for logging
    let matchLevel = '';
    if (contactCount <= 8) matchLevel = '🔥 VERY HIGH';
    else if (contactCount <= 20) matchLevel = '✨ HIGH';
    else if (contactCount <= 35) matchLevel = '📊 MEDIUM';
    else if (contactCount <= 45) matchLevel = '📉 LOW';
    else matchLevel = '❄️ VERY LOW';

    console.log(`   [${contactCount.toString().padStart(2, '0')}/50] ${matchLevel} | ${contactData.fullName} - ${contactData.jobTitle} @ ${contactData.company}`);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('✅ MATCH TEST SEED COMPLETE');
  console.log('='.repeat(70));
  console.log(`
📋 Summary:
   • Test User: ${TEST_USER_DATA.fullName}
   • Email: ${TEST_EMAIL}
   • Password: ${TEST_PASSWORD}

   • User Sectors: ${USER_SECTORS.length}
   • User Skills: ${USER_SKILLS.length}
   • User Interests: ${USER_INTERESTS.length}
   • User Hobbies: ${USER_HOBBIES.length}
   • User Goals: ${USER_GOALS.length}

📇 Contacts Created: ${ALL_CONTACTS.length}
   • Very High Match (80-100): ${VERY_HIGH_MATCH_CONTACTS.length}
   • High Match (60-79): ${HIGH_MATCH_CONTACTS.length}
   • Medium Match (40-59): ${MEDIUM_MATCH_CONTACTS.length}
   • Low Match (20-39): ${LOW_MATCH_CONTACTS.length}
   • Very Low Match (0-19): ${VERY_LOW_MATCH_CONTACTS.length}

🔑 Login Credentials:
   Email: ${TEST_EMAIL}
   Password: ${TEST_PASSWORD}
`);
}

// =============================================================================
// EXECUTE
// =============================================================================

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
