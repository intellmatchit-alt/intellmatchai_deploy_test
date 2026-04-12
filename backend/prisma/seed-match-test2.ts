/**
 * Match Test 2 Seed Script
 *
 * Creates a comprehensive test user (Dr. Amira Haddad) with contacts, projects,
 * opportunities, deals, and pitches for full match accordion testing.
 *
 * Usage: npm run seed:match-test2
 *
 * Test User: matchtest2@p2p.test / Test123!
 *
 * @module prisma/seed-match-test2
 */

import {
  PrismaClient,
  ProficiencyLevel,
  Intensity,
  GoalType,
  ContactSource,
  SectorSource,
  ProjectStage,
  SkillImportance,
  OpportunityIntentType,
  DealMode,
  DealStatus,
  DealCompanySize,
  DealTargetEntityType,
  PitchStatus,
  PitchSectionType,
  PitchFileType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// =============================================================================
// TEST USER CREDENTIALS
// =============================================================================

const TEST_EMAIL = 'matchtest2@p2p.test';
const TEST_PASSWORD = 'Test123!';

// =============================================================================
// TEST USER DATA - Dr. Amira Haddad (Healthcare & Sustainability)
// =============================================================================

const TEST_USER_DATA = {
  email: TEST_EMAIL,
  fullName: 'Dr. Amira Haddad',
  jobTitle: 'Founder & CEO',
  company: 'GreenHealth Innovations',
  bio: 'Physician-entrepreneur building sustainable healthcare solutions for underserved communities. Founded GreenHealth Innovations to bridge the gap between clean energy, precision agriculture, and rural health delivery. Board member at Jordan Health Initiative and MENA CleanTech Council. Passionate about impact investing and scaling social enterprises across the region.',
  location: 'Amman, Jordan',
  linkedinUrl: 'https://linkedin.com/in/amirahaddad',
  websiteUrl: 'https://greenhealth.jo',
  twitterUrl: 'https://twitter.com/dramirahaddad',
  phone: '+962791234567',
  timezone: 'Asia/Amman',
  avatarUrl: null,
  emailVerified: true,
  isActive: true,
  consentEnrichment: true,
  consentContacts: true,
  consentAnalytics: true,
};

// User's sectors with experience years
const USER_SECTORS = [
  { name: 'Healthcare', isPrimary: true, experienceYears: 18 },
  { name: 'Renewable Energy', isPrimary: false, experienceYears: 8 },
  { name: 'Agriculture', isPrimary: false, experienceYears: 6 },
  { name: 'Education', isPrimary: false, experienceYears: 10 },
  { name: 'Finance', isPrimary: false, experienceYears: 5 },
];

// User's skills with proficiency levels
const USER_SKILLS: { name: string; level: ProficiencyLevel }[] = [
  { name: 'Leadership', level: 'EXPERT' },
  { name: 'Strategic Planning', level: 'EXPERT' },
  { name: 'Business Development', level: 'ADVANCED' },
  { name: 'Project Management', level: 'EXPERT' },
  { name: 'Public Speaking', level: 'ADVANCED' },
  { name: 'Negotiation', level: 'ADVANCED' },
  { name: 'Financial Analysis', level: 'INTERMEDIATE' },
  { name: 'Digital Marketing', level: 'INTERMEDIATE' },
];

// User's interests with intensity
const USER_INTERESTS: { name: string; intensity: Intensity }[] = [
  { name: 'Sustainability', intensity: 'PASSIONATE' },
  { name: 'Social Impact', intensity: 'PASSIONATE' },
  { name: 'Mental Health', intensity: 'PASSIONATE' },
  { name: 'Climate Tech', intensity: 'MODERATE' },
  { name: 'Education Reform', intensity: 'MODERATE' },
  { name: 'Investing', intensity: 'PASSIONATE' },
];

// User's hobbies
const USER_HOBBIES = ['Hiking', 'Gardening', 'Yoga', 'Reading', 'Cooking', 'Volunteering'];

// User's networking goals
const USER_GOALS: { goalType: GoalType; priority: number; description: string }[] = [
  { goalType: 'PARTNERSHIP', priority: 1, description: 'Find partners in cleantech and healthtech to co-develop rural health platforms' },
  { goalType: 'INVESTMENT', priority: 2, description: 'Raise Series A funding for GreenHealth rural health platform expansion' },
  { goalType: 'COLLABORATION', priority: 3, description: 'Collaborate with agritech companies on nutrition and food security projects' },
  { goalType: 'MENTORSHIP', priority: 4, description: 'Mentor women entrepreneurs in healthcare and sustainability sectors' },
];

// =============================================================================
// CONTACT DATA - 25 Contacts with Complete Information
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
// VERY HIGH MATCH CONTACTS (5) - Score 80-100
// Healthcare + sustainability leaders with maximum overlap
// -----------------------------------------------------------------------------

const VERY_HIGH_MATCH_CONTACTS: ContactData[] = [
  {
    fullName: 'Dr. Nabil Khoury',
    email: 'nabil.khoury@menahealth.jo',
    phone: '+962792345678',
    company: 'MENA Health Ventures',
    jobTitle: 'Managing Partner',
    website: 'https://menahealthventures.jo',
    linkedinUrl: 'https://linkedin.com/in/nabilkhoury',
    bio: 'Healthcare-focused VC managing $200M fund across MENA. Former Chief of Medicine at Jordan University Hospital. MD from Johns Hopkins, MBA from Wharton. Invested in 30+ healthtech startups. Advisor to Jordan Ministry of Health on digital health strategy.',
    location: 'Amman, Jordan',
    source: 'LINKEDIN',
    notes: 'Key investor in healthtech. Strong alignment on rural health mission.',
    sectors: ['Healthcare', 'Venture Capital', 'Technology'],
    skills: ['Leadership', 'Strategic Planning', 'Financial Analysis', 'Business Development'],
    interests: ['Mental Health', 'Investing', 'Social Impact'],
    hobbies: ['Hiking', 'Reading', 'Yoga'],
  },
  {
    fullName: 'Lina Barakat',
    email: 'lina.barakat@cleantechjordan.jo',
    phone: '+962793456789',
    company: 'CleanTech Jordan',
    jobTitle: 'CEO & Co-founder',
    website: 'https://cleantechjordan.jo',
    linkedinUrl: 'https://linkedin.com/in/linabarakat',
    bio: 'Building solar-powered healthcare infrastructure for rural communities. Former sustainability director at Aramex. Environmental Engineering from MIT. Won Global CleanTech Innovation Prize. Passionate about bringing clean energy to underserved healthcare facilities.',
    location: 'Amman, Jordan',
    source: 'MANUAL',
    notes: 'Perfect partner for rural health energy needs. Already piloting solar clinics.',
    sectors: ['Renewable Energy', 'Healthcare', 'CleanTech'],
    skills: ['Project Management', 'Strategic Planning', 'Leadership', 'Business Development'],
    interests: ['Sustainability', 'Climate Tech', 'Social Impact', 'Mental Health'],
    hobbies: ['Hiking', 'Gardening', 'Volunteering'],
  },
  {
    fullName: 'Dr. Rania Toukan',
    email: 'rania.toukan@impacthealth.jo',
    phone: '+962794567890',
    company: 'Impact Health Foundation',
    jobTitle: 'Executive Director',
    website: 'https://impacthealth.jo',
    linkedinUrl: 'https://linkedin.com/in/raniatoukan',
    bio: 'Leading the largest health equity foundation in Jordan. Former WHO regional advisor. MPH from Harvard. Managing $50M in health grants targeting maternal and child health. Built network of 200 community health clinics across rural Jordan.',
    location: 'Amman, Jordan',
    source: 'LINKEDIN',
    notes: 'Excellent for rural health partnerships and grant co-applications.',
    sectors: ['Healthcare', 'Education', 'Non-profit'],
    skills: ['Leadership', 'Public Speaking', 'Strategic Planning', 'Project Management'],
    interests: ['Social Impact', 'Mental Health', 'Education Reform'],
    hobbies: ['Yoga', 'Reading', 'Volunteering'],
  },
  {
    fullName: 'Tariq Masri',
    email: 'tariq.masri@agrihealth.jo',
    phone: '+962795678901',
    company: 'AgriHealth Solutions',
    jobTitle: 'Founder & CTO',
    website: 'https://agrihealth.jo',
    linkedinUrl: 'https://linkedin.com/in/tariqmasri',
    bio: 'Building AI-powered agriculture and nutrition platforms. Former research scientist at ICARDA. PhD in Agricultural Science from Wageningen. Focus on linking food systems to health outcomes. Developed precision farming tools used by 5,000+ farmers in Jordan and Lebanon.',
    location: 'Amman, Jordan',
    source: 'MANUAL',
    notes: 'Perfect intersection of agriculture and health. Strong R&D capabilities.',
    sectors: ['Agriculture', 'Healthcare', 'Technology'],
    skills: ['Project Management', 'Leadership', 'Strategic Planning', 'Data Science'],
    interests: ['Sustainability', 'Mental Health', 'Climate Tech'],
    hobbies: ['Gardening', 'Hiking', 'Cooking'],
  },
  {
    fullName: 'Dr. Hanan Abdel-Latif',
    email: 'hanan.abdellatif@sustaincare.ae',
    phone: '+971508234567',
    company: 'SustainCare Global',
    jobTitle: 'Chief Impact Officer',
    website: 'https://sustaincare.ae',
    linkedinUrl: 'https://linkedin.com/in/hananabdellatif',
    bio: 'Designing sustainable healthcare delivery models. Former McKinsey healthcare practice lead. MD from American University of Beirut, MBA from LBS. Published author on health system sustainability. Board member at MENA Social Enterprise Network.',
    location: 'Dubai, UAE',
    source: 'LINKEDIN',
    notes: 'Strong strategic advisor for scaling sustainable health models.',
    sectors: ['Healthcare', 'Consulting', 'Renewable Energy'],
    skills: ['Strategic Planning', 'Leadership', 'Public Speaking', 'Financial Analysis'],
    interests: ['Sustainability', 'Social Impact', 'Investing', 'Mental Health'],
    hobbies: ['Yoga', 'Reading', 'Hiking'],
  },
];

// -----------------------------------------------------------------------------
// HIGH MATCH CONTACTS (6) - Score 60-79
// CleanTech, AgriTech, social enterprise - good but not perfect alignment
// -----------------------------------------------------------------------------

const HIGH_MATCH_CONTACTS: ContactData[] = [
  {
    fullName: 'Ziad Freij',
    email: 'ziad.freij@solaragri.jo',
    phone: '+962796789012',
    company: 'SolarAgri Jordan',
    jobTitle: 'Managing Director',
    website: 'https://solaragri.jo',
    linkedinUrl: 'https://linkedin.com/in/ziadfreij',
    bio: 'Deploying solar-powered irrigation across Jordan Valley. Former World Bank energy specialist. MS in Renewable Energy from TU Berlin. Helping 3,000 farmers reduce water and energy costs by 40%. Advocate for climate-smart agriculture.',
    location: 'Amman, Jordan',
    source: 'LINKEDIN',
    notes: 'Solar irrigation expertise. Potential partner for rural farming communities.',
    sectors: ['Renewable Energy', 'Agriculture', 'CleanTech'],
    skills: ['Project Management', 'Business Development', 'Leadership'],
    interests: ['Sustainability', 'Climate Tech', 'Social Impact'],
    hobbies: ['Cycling', 'Gardening', 'Photography'],
  },
  {
    fullName: 'Dalia Nasser',
    email: 'dalia.nasser@socialimpact.lb',
    phone: '+9611234567',
    company: 'Social Impact Lebanon',
    jobTitle: 'Founder & CEO',
    website: 'https://socialimpact.lb',
    linkedinUrl: 'https://linkedin.com/in/dalianasser',
    bio: 'Running the leading impact accelerator in Lebanon. Former UNICEF program officer. MPP from Oxford. Supported 120+ social enterprises with $25M in blended finance. Passionate about healthcare access and education equity in conflict-affected regions.',
    location: 'Beirut, Lebanon',
    source: 'MANUAL',
    notes: 'Impact ecosystem connector. Access to blended finance instruments.',
    sectors: ['Education', 'Healthcare', 'Finance'],
    skills: ['Leadership', 'Public Speaking', 'Strategic Planning', 'Negotiation'],
    interests: ['Social Impact', 'Investing', 'Education Reform'],
    hobbies: ['Reading', 'Volunteering', 'Cooking'],
  },
  {
    fullName: 'Fares Haddadin',
    email: 'fares.haddadin@waterfund.jo',
    phone: '+962797890123',
    company: 'Jordan Water Innovation Fund',
    jobTitle: 'Investment Director',
    website: 'https://waterfund.jo',
    linkedinUrl: 'https://linkedin.com/in/fareshaddadin',
    bio: 'Investing in water tech and circular economy solutions. Former environmental engineer at GIZ Jordan. MSc in Water Resources from Imperial College. Managing $80M climate adaptation fund. Focus on water-energy-food nexus.',
    location: 'Amman, Jordan',
    source: 'LINKEDIN',
    notes: 'Water-energy-food nexus expert. Aligned on agriculture-health connection.',
    sectors: ['CleanTech', 'Agriculture', 'Finance'],
    skills: ['Financial Analysis', 'Strategic Planning', 'Project Management'],
    interests: ['Sustainability', 'Climate Tech', 'Investing'],
    hobbies: ['Hiking', 'Photography', 'Cooking'],
  },
  {
    fullName: 'Dr. Samar Nassar',
    email: 'samar.nassar@edhealth.jo',
    phone: '+962798901234',
    company: 'EdHealth Academy',
    jobTitle: 'Academic Director',
    website: 'https://edhealth.jo',
    linkedinUrl: 'https://linkedin.com/in/samarnassar',
    bio: 'Building health education programs for rural communities. Former professor at University of Jordan Medical School. EdD from Columbia. Designed community health worker training reaching 5,000 graduates. Focus on preventive care education.',
    location: 'Amman, Jordan',
    source: 'MANUAL',
    notes: 'Health education expert. Can train community health workers for platform.',
    sectors: ['Education', 'Healthcare'],
    skills: ['Public Speaking', 'Project Management', 'Leadership'],
    interests: ['Education Reform', 'Mental Health', 'Social Impact'],
    hobbies: ['Reading', 'Yoga', 'Gardening'],
  },
  {
    fullName: 'Mazen Darwish',
    email: 'mazen.darwish@orgafarms.jo',
    phone: '+962790012345',
    company: 'OrgaFarms MENA',
    jobTitle: 'CEO',
    website: 'https://orgafarms.jo',
    linkedinUrl: 'https://linkedin.com/in/mazendarwish',
    bio: 'Organic farming cooperative spanning Jordan, Palestine, and Lebanon. Agricultural Engineering from University of Jordan. Built supply chain serving 200 organic farms. Pioneering regenerative agriculture in arid climates. Exporting to EU markets.',
    location: 'Amman, Jordan',
    source: 'LINKEDIN',
    notes: 'Organic supply chain leader. Potential collaborator on nutrition projects.',
    sectors: ['Agriculture', 'Retail', 'Logistics'],
    skills: ['Business Development', 'Negotiation', 'Project Management', 'Leadership'],
    interests: ['Sustainability', 'Social Impact'],
    hobbies: ['Gardening', 'Cooking', 'Hiking'],
  },
  {
    fullName: 'Reem Abuqaoud',
    email: 'reem.abuqaoud@impactventures.ps',
    phone: '+970599123456',
    company: 'Impact Ventures Palestine',
    jobTitle: 'General Partner',
    website: 'https://impactventures.ps',
    linkedinUrl: 'https://linkedin.com/in/reemabuqaoud',
    bio: 'Impact-first VC investing in healthcare and education across Palestine and Jordan. Former IFC investment officer. MBA from INSEAD. Managing $30M fund. Focus on companies serving base-of-pyramid communities.',
    location: 'Ramallah, Palestine',
    source: 'MANUAL',
    notes: 'Impact VC with healthcare focus. Potential Series A co-investor.',
    sectors: ['Venture Capital', 'Healthcare', 'Education'],
    skills: ['Financial Analysis', 'Strategic Planning', 'Leadership', 'Negotiation'],
    interests: ['Investing', 'Social Impact', 'Mental Health'],
    hobbies: ['Reading', 'Volunteering', 'Hiking'],
  },
];

// -----------------------------------------------------------------------------
// MEDIUM MATCH CONTACTS (6) - Score 40-59
// Finance, education, consulting - some commonality but different primary focus
// -----------------------------------------------------------------------------

const MEDIUM_MATCH_CONTACTS: ContactData[] = [
  {
    fullName: 'Samer Khalil',
    email: 'samer.khalil@capitaljo.jo',
    phone: '+962791123456',
    company: 'Capital Jordan Group',
    jobTitle: 'Senior Investment Manager',
    website: 'https://capitaljo.jo',
    linkedinUrl: 'https://linkedin.com/in/samerkhalil',
    bio: 'Managing diversified investment portfolio across MENA. CFA charterholder. Former JP Morgan associate. Focus on growth-stage companies in consumer, fintech, and healthcare. Board observer at 4 portfolio companies.',
    location: 'Amman, Jordan',
    source: 'LINKEDIN',
    notes: 'Generalist investor but interested in healthcare deals.',
    sectors: ['Finance', 'Venture Capital', 'Consulting'],
    skills: ['Financial Analysis', 'Strategic Planning', 'Negotiation'],
    interests: ['Investing', 'Business Strategy'],
    hobbies: ['Golf', 'Reading', 'Travel'],
  },
  {
    fullName: 'Dr. Layla Hamdan',
    email: 'layla.hamdan@uniedu.jo',
    phone: '+962792234567',
    company: 'University of Jordan',
    jobTitle: 'Dean of Public Health',
    website: 'https://medicine.ju.edu.jo',
    linkedinUrl: 'https://linkedin.com/in/laylahamdan',
    bio: 'Leading public health education and research. PhD in Epidemiology from Johns Hopkins. Published 80+ papers on communicable diseases in MENA. WHO consultant. Advisor to Jordan Ministry of Health on pandemic preparedness.',
    location: 'Amman, Jordan',
    source: 'MANUAL',
    notes: 'Academic connection. Research collaboration potential.',
    sectors: ['Education', 'Healthcare'],
    skills: ['Public Speaking', 'Leadership', 'Strategic Planning'],
    interests: ['Education Reform', 'Mental Health'],
    hobbies: ['Reading', 'Yoga', 'Travel'],
  },
  {
    fullName: 'Karim Obeid',
    email: 'karim.obeid@consultmena.ae',
    phone: '+971509345678',
    company: 'MENA Strategy Consulting',
    jobTitle: 'Principal',
    website: 'https://menastrategy.ae',
    linkedinUrl: 'https://linkedin.com/in/karimobeid',
    bio: 'Strategy consulting for healthcare and energy sectors. Former BCG manager. MBA from Columbia Business School. Led 40+ engagements across GCC and Levant. Specializes in market entry and growth strategy.',
    location: 'Dubai, UAE',
    source: 'LINKEDIN',
    notes: 'Strategy consulting resource. Useful for market expansion planning.',
    sectors: ['Consulting', 'Healthcare', 'Energy'],
    skills: ['Strategic Planning', 'Business Development', 'Leadership', 'Negotiation'],
    interests: ['Business Strategy', 'Innovation'],
    hobbies: ['Running', 'Travel', 'Photography'],
  },
  {
    fullName: 'Nisreen Sabri',
    email: 'nisreen.sabri@microfinance.jo',
    phone: '+962793345678',
    company: 'Jordan Microfinance Network',
    jobTitle: 'Executive Director',
    website: 'https://jmfn.jo',
    linkedinUrl: 'https://linkedin.com/in/nisreensabri',
    bio: 'Leading microfinance network serving 150,000 borrowers. Former World Bank financial inclusion specialist. MBA from American University of Beirut. Focus on women entrepreneurs and rural lending. Board member at Arab Microfinance Alliance.',
    location: 'Amman, Jordan',
    source: 'MANUAL',
    notes: 'Financial inclusion expert. Access to rural lending networks.',
    sectors: ['Finance', 'Non-profit', 'Education'],
    skills: ['Leadership', 'Public Speaking', 'Project Management'],
    interests: ['Social Impact', 'Investing'],
    hobbies: ['Volunteering', 'Reading', 'Cooking'],
  },
  {
    fullName: 'Hisham Qasem',
    email: 'hisham.qasem@digitaltransform.sa',
    phone: '+966555678901',
    company: 'Digital Transform Saudi',
    jobTitle: 'VP of Operations',
    website: 'https://digitaltransform.sa',
    linkedinUrl: 'https://linkedin.com/in/hishamqasem',
    bio: 'Leading digital transformation programs for Saudi healthcare institutions. Former Deloitte consultant. PMP and ITIL certified. Implemented EMR systems across 15 hospitals. Focus on interoperability and patient data standards.',
    location: 'Riyadh, Saudi Arabia',
    source: 'LINKEDIN',
    notes: 'Healthcare IT expertise. Potential tech partner for EMR integration.',
    sectors: ['Technology', 'Healthcare', 'Consulting'],
    skills: ['Project Management', 'Leadership', 'Strategic Planning'],
    interests: ['Innovation', 'Mental Health'],
    hobbies: ['Running', 'Reading', 'Photography'],
  },
  {
    fullName: 'Lubna Issa',
    email: 'lubna.issa@teachforward.jo',
    phone: '+962794456789',
    company: 'TeachForward Jordan',
    jobTitle: 'Program Director',
    website: 'https://teachforward.jo',
    linkedinUrl: 'https://linkedin.com/in/lubnaissa',
    bio: 'Running teacher training programs across Jordan. Former school principal. MEd from University of Exeter. Trained 2,000+ teachers in STEM education. Building partnerships between schools and tech companies for classroom innovation.',
    location: 'Amman, Jordan',
    source: 'MANUAL',
    notes: 'Education sector connector. Health education curriculum collaboration.',
    sectors: ['Education', 'Technology'],
    skills: ['Public Speaking', 'Project Management', 'Leadership'],
    interests: ['Education Reform', 'Innovation'],
    hobbies: ['Reading', 'Volunteering', 'Yoga'],
  },
];

// -----------------------------------------------------------------------------
// LOW MATCH CONTACTS (5) - Score 20-39
// Tech, media, legal - different industries, minimal overlap
// -----------------------------------------------------------------------------

const LOW_MATCH_CONTACTS: ContactData[] = [
  {
    fullName: 'Basem Rawashdeh',
    email: 'basem.rawashdeh@techstartup.jo',
    phone: '+962795567890',
    company: 'ByteForge Studios',
    jobTitle: 'CTO & Co-founder',
    website: 'https://byteforge.jo',
    linkedinUrl: 'https://linkedin.com/in/basemrawashdeh',
    bio: 'Building mobile gaming platform for MENA market. Former game developer at Ubisoft. CS from Princess Sumaya University. Raised $5M seed. Focus on Arabic-language gaming content and esports infrastructure.',
    location: 'Amman, Jordan',
    source: 'LINKEDIN',
    notes: 'Gaming tech founder. Limited health/sustainability overlap.',
    sectors: ['Technology', 'Entertainment', 'Gaming'],
    skills: ['Leadership', 'Product Management'],
    interests: ['Startups', 'Innovation'],
    hobbies: ['Gaming', 'Photography', 'Travel'],
  },
  {
    fullName: 'Laila Jabr',
    email: 'laila.jabr@mediaco.jo',
    phone: '+962796678901',
    company: 'Jabr Media Group',
    jobTitle: 'Editor-in-Chief',
    website: 'https://jabrmedia.jo',
    linkedinUrl: 'https://linkedin.com/in/lailajabr',
    bio: 'Leading digital media company covering business and politics in MENA. Former Al Jazeera journalist. MA in Journalism from Columbia. Built audience of 2M monthly readers. Focus on investigative journalism and media innovation.',
    location: 'Amman, Jordan',
    source: 'MANUAL',
    notes: 'Media contact for PR and thought leadership.',
    sectors: ['Media', 'Advertising', 'Technology'],
    skills: ['Communication', 'Leadership', 'Public Speaking'],
    interests: ['Innovation', 'Startups'],
    hobbies: ['Reading', 'Photography', 'Travel'],
  },
  {
    fullName: 'Omar Rashdan',
    email: 'omar.rashdan@lawfirm.jo',
    phone: '+962797789012',
    company: 'Rashdan & Partners Law Firm',
    jobTitle: 'Managing Partner',
    website: 'https://rashdanlaw.jo',
    linkedinUrl: 'https://linkedin.com/in/omarrashdan',
    bio: 'Corporate law firm specializing in M&A and foreign investment. LLM from University of London. Former legal counsel at Arab Bank. Advised on $2B+ in transactions. Focus on FDI regulations and commercial arbitration.',
    location: 'Amman, Jordan',
    source: 'LINKEDIN',
    notes: 'Legal advisor for corporate matters.',
    sectors: ['Legal Services', 'Finance', 'Consulting'],
    skills: ['Negotiation', 'Strategic Planning'],
    interests: ['Business Strategy'],
    hobbies: ['Golf', 'Reading', 'Travel'],
  },
  {
    fullName: 'Tala Zureikat',
    email: 'tala.zureikat@propdev.jo',
    phone: '+962798890123',
    company: 'Zureikat Property Development',
    jobTitle: 'Development Director',
    website: 'https://zureikatdev.jo',
    linkedinUrl: 'https://linkedin.com/in/talazureikat',
    bio: 'Luxury residential development in Amman and Aqaba. Architecture from University of Jordan. Former project manager at Consolidated Contractors. Managing $300M portfolio of mixed-use developments.',
    location: 'Amman, Jordan',
    source: 'MANUAL',
    notes: 'Real estate contact. Limited overlap with health/sustainability.',
    sectors: ['Real Estate', 'Manufacturing'],
    skills: ['Project Management', 'Negotiation'],
    interests: ['Real Estate Investment'],
    hobbies: ['Travel', 'Photography', 'Tennis'],
  },
  {
    fullName: 'Yazan Halawani',
    email: 'yazan.halawani@fintechjo.jo',
    phone: '+962799901234',
    company: 'PayJo Financial',
    jobTitle: 'Founder & CEO',
    website: 'https://payjo.jo',
    linkedinUrl: 'https://linkedin.com/in/yazanhalawani',
    bio: 'Building digital payments infrastructure for Jordan. Former software engineer at Fawry. CS from JUST. Processing $50M in monthly transactions. Focus on merchant payments and financial inclusion for SMEs.',
    location: 'Amman, Jordan',
    source: 'LINKEDIN',
    notes: 'Fintech founder. Possible payment integration for health services.',
    sectors: ['FinTech', 'Technology', 'Finance'],
    skills: ['Leadership', 'Business Development', 'Product Management'],
    interests: ['Startups', 'Innovation'],
    hobbies: ['Running', 'Gaming', 'Cooking'],
  },
];

// -----------------------------------------------------------------------------
// VERY LOW MATCH CONTACTS (3) - Score 0-19
// Completely unrelated domains
// -----------------------------------------------------------------------------

const VERY_LOW_MATCH_CONTACTS: ContactData[] = [
  {
    fullName: 'Saif Batayneh',
    email: 'saif.batayneh@carsjo.jo',
    phone: '+962790234567',
    company: 'Jordan Premium Motors',
    jobTitle: 'Showroom Manager',
    website: 'https://jordanpremium.jo',
    linkedinUrl: 'https://linkedin.com/in/saifbatayneh',
    bio: 'Managing luxury car dealership in Amman. 15 years in automotive sales. Authorized dealer for three premium brands. Focus on after-sales service excellence and customer loyalty programs.',
    location: 'Amman, Jordan',
    source: 'CARD_SCAN',
    notes: 'Met at business dinner. Automotive industry.',
    sectors: ['Retail', 'Manufacturing'],
    skills: ['Sales', 'Team Building'],
    interests: [],
    hobbies: ['Football', 'Fishing', 'Camping'],
  },
  {
    fullName: 'Ghada Habashneh',
    email: 'ghada.habashneh@catering.jo',
    phone: '+962791345678',
    company: 'Royal Catering Jordan',
    jobTitle: 'Owner',
    website: 'https://royalcatering.jo',
    linkedinUrl: 'https://linkedin.com/in/ghadahabashneh',
    bio: 'Premium catering company for corporate events and weddings. 20 years in hospitality. Trained at Le Cordon Bleu. Serving 500+ events annually. Known for fusion Arabic-international cuisine.',
    location: 'Amman, Jordan',
    source: 'MANUAL',
    notes: 'Catering vendor for company events.',
    sectors: ['Hospitality', 'Retail'],
    skills: ['Project Management', 'Sales'],
    interests: [],
    hobbies: ['Cooking', 'Travel', 'Photography'],
  },
  {
    fullName: 'Murad Tarawna',
    email: 'murad.tarawna@securityjo.jo',
    phone: '+962792456789',
    company: 'SafeGuard Security Services',
    jobTitle: 'Operations Director',
    website: 'https://safeguardjo.jo',
    linkedinUrl: 'https://linkedin.com/in/muradtarawna',
    bio: 'Physical security services for commercial properties. Former military police officer. Managing 500+ security personnel. Contracts with embassies, hotels, and shopping malls across Jordan.',
    location: 'Amman, Jordan',
    source: 'CARD_SCAN',
    notes: 'Building security vendor.',
    sectors: ['Government'],
    skills: ['Leadership', 'Project Management'],
    interests: [],
    hobbies: ['Football', 'Camping', 'Fishing'],
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
// PROJECT DATA
// =============================================================================

const PROJECT_DATA = {
  title: 'Smart Rural Health Platform',
  summary: 'An integrated mobile platform connecting rural communities in Jordan to healthcare services via telemedicine, AI-powered triage, and IoT-enabled health monitoring stations powered by solar energy.',
  detailedDesc: 'The Smart Rural Health Platform addresses the critical healthcare gap in rural Jordan where 40% of the population lives more than 30km from the nearest hospital. The platform combines three components: (1) Solar-powered health kiosks with basic diagnostic equipment and video consultation capability, (2) A mobile app for community health workers to collect patient data and triage cases, (3) An AI engine that analyzes patient data patterns to predict outbreaks and allocate resources. Phase 1 targets 50 villages in Mafraq and Irbid governorates.',
  category: 'HealthTech',
  stage: 'MVP' as ProjectStage,
  investmentRange: '$500K - $2M',
  timeline: '18 months',
  lookingFor: JSON.stringify(['Technical Co-founder', 'Healthcare Partners', 'Solar Energy Provider', 'Impact Investors']),
  keywords: JSON.stringify(['telemedicine', 'rural health', 'solar energy', 'AI triage', 'community health', 'IoT', 'mobile health']),
  sectors: ['Healthcare', 'Technology', 'Agriculture'],
  skills: [
    { name: 'Project Management', importance: 'REQUIRED' as SkillImportance },
    { name: 'Data Science', importance: 'REQUIRED' as SkillImportance },
    { name: 'Mobile Development', importance: 'REQUIRED' as SkillImportance },
  ],
};

// =============================================================================
// OPPORTUNITY DATA
// =============================================================================

const OPPORTUNITIES_DATA = [
  {
    title: 'Sustainability Director',
    intentType: 'HIRING' as OpportunityIntentType,
    roleArea: 'Sustainability & Environmental Management',
    seniority: 'DIRECTOR' as const,
    locationPref: 'Amman, Jordan',
    remoteOk: false,
    notes: 'Seeking a Sustainability Director to lead our ESG initiatives and ensure all GreenHealth projects meet international sustainability standards. Must have experience with carbon accounting, renewable energy integration, and environmental impact assessments.',
    sectors: ['Renewable Energy', 'Agriculture'],
    skills: ['Strategic Planning', 'Project Management', 'Leadership'],
  },
  {
    title: 'Healthcare Innovation Advisor',
    intentType: 'ADVISORY_BOARD' as OpportunityIntentType,
    roleArea: 'Healthcare Strategy & Innovation',
    seniority: 'C_LEVEL' as const,
    locationPref: 'MENA Region',
    remoteOk: true,
    notes: 'Looking for experienced healthcare leaders to join our advisory board. Must have deep expertise in health systems design, digital health, or medical device regulation in the MENA region.',
    sectors: ['Healthcare', 'Education'],
    skills: ['Public Speaking', 'Strategic Planning'],
  },
];

// =============================================================================
// DEAL DATA
// =============================================================================

const DEALS_DATA = [
  {
    mode: 'SELL' as DealMode,
    title: 'Organic Supply Chain Platform',
    domain: 'Agriculture',
    solutionType: 'Supply Chain SaaS',
    companySize: 'SMALL' as DealCompanySize,
    problemStatement: 'Organic farms in MENA lack a unified platform to manage certification, traceability, and distribution. Our platform digitizes the entire organic supply chain from farm to consumer.',
    targetEntityType: 'COMPANY' as DealTargetEntityType,
    productName: 'OrgaTrace Platform',
    targetDescription: 'Agricultural cooperatives, organic food distributors, and grocery chains looking for supply chain transparency and organic certification management tools.',
    status: 'COMPLETED' as DealStatus,
  },
  {
    mode: 'BUY' as DealMode,
    title: 'Medical Equipment Leasing',
    domain: 'Healthcare',
    solutionType: 'Equipment Leasing',
    companySize: 'MEDIUM' as DealCompanySize,
    problemStatement: 'Rural health clinics cannot afford upfront purchase of diagnostic equipment. We need a leasing partner who provides medical devices on flexible payment terms with maintenance included.',
    targetEntityType: 'COMPANY' as DealTargetEntityType,
    productName: null,
    targetDescription: 'Medical equipment leasing companies or manufacturers offering flexible financing for diagnostic devices including ultrasound, X-ray, and laboratory analyzers.',
    status: 'COMPLETED' as DealStatus,
  },
];

// =============================================================================
// PITCH DATA
// =============================================================================

const PITCH_DATA = {
  fileKey: 'pitches/seed-greenhealth-pitch.pdf',
  fileName: 'GreenHealth_Innovations_Pitch_Deck.pdf',
  fileType: 'PDF' as PitchFileType,
  fileSize: 2048576,
  language: 'en',
  status: 'COMPLETED' as PitchStatus,
  title: 'GreenHealth Innovations Pitch Deck',
  companyName: 'GreenHealth Innovations',
  rawText: 'GreenHealth Innovations - Sustainable Healthcare for Rural Communities...',
  sections: [
    {
      type: 'PROBLEM' as PitchSectionType,
      order: 1,
      title: 'The Rural Healthcare Crisis',
      content: '40% of Jordan\'s rural population lives more than 30km from the nearest hospital. Maternal mortality in rural areas is 3x higher than urban centers. Only 15% of rural clinics have reliable electricity for medical equipment. Chronic disease management is virtually non-existent in communities with fewer than 5,000 people.',
      rawContent: 'The Rural Healthcare Crisis - 40% of Jordan rural population...',
      confidence: 0.95,
      inferredSectors: JSON.stringify(['Healthcare', 'Renewable Energy']),
      inferredSkills: JSON.stringify(['Public Speaking', 'Strategic Planning']),
      keywords: JSON.stringify(['rural healthcare', 'maternal mortality', 'electricity access', 'chronic disease']),
    },
    {
      type: 'SOLUTION' as PitchSectionType,
      order: 2,
      title: 'Solar-Powered Smart Health Kiosks',
      content: 'GreenHealth deploys solar-powered health kiosks in rural villages equipped with telemedicine capability, basic diagnostic tools, and AI-powered triage. Each kiosk connects patients to urban specialists via video consultation. Community health workers use our mobile app to track patient health data and coordinate follow-up care. The platform reduces average diagnosis time from 14 days to 2 hours.',
      rawContent: 'Solar-Powered Smart Health Kiosks - GreenHealth deploys...',
      confidence: 0.93,
      inferredSectors: JSON.stringify(['Healthcare', 'Technology', 'Renewable Energy']),
      inferredSkills: JSON.stringify(['Project Management', 'Data Science', 'Mobile Development']),
      keywords: JSON.stringify(['telemedicine', 'solar powered', 'health kiosks', 'AI triage', 'community health']),
    },
    {
      type: 'MARKET' as PitchSectionType,
      order: 3,
      title: 'Market Opportunity',
      content: 'The global rural health market is projected to reach $45B by 2028. MENA rural healthcare spending is growing at 12% CAGR. Jordan alone has 800+ villages with populations of 1,000-10,000 that lack adequate healthcare. Expansion markets include Iraq, Palestine, and Egypt with similar rural health challenges. Government contracts represent 60% of addressable market.',
      rawContent: 'Market Opportunity - The global rural health market...',
      confidence: 0.91,
      inferredSectors: JSON.stringify(['Healthcare', 'Finance']),
      inferredSkills: JSON.stringify(['Financial Analysis', 'Strategic Planning']),
      keywords: JSON.stringify(['rural health market', 'MENA healthcare', 'government contracts', 'market size']),
    },
    {
      type: 'BUSINESS_MODEL' as PitchSectionType,
      order: 4,
      title: 'Revenue Model',
      content: 'Three revenue streams: (1) B2G contracts with Ministry of Health for kiosk deployment and maintenance at $50K per village per year, (2) SaaS subscription for community health worker platform at $200/month per clinic, (3) Data analytics services for public health authorities at $100K per annual license. Current pipeline of $2M in signed LOIs from Jordan Ministry of Health and two international NGOs.',
      rawContent: 'Revenue Model - Three revenue streams...',
      confidence: 0.90,
      inferredSectors: JSON.stringify(['Healthcare', 'Technology', 'Government']),
      inferredSkills: JSON.stringify(['Financial Analysis', 'Business Development', 'Negotiation']),
      keywords: JSON.stringify(['B2G contracts', 'SaaS subscription', 'data analytics', 'revenue model', 'LOIs']),
    },
    {
      type: 'INVESTMENT_ASK' as PitchSectionType,
      order: 5,
      title: 'Investment Ask',
      content: 'Raising $1.5M Series A to deploy 50 kiosks across Mafraq and Irbid governorates, hire 15 additional engineers and community health coordinators, and expand the AI triage engine. Current runway is 8 months with $300K ARR. Seeking impact-aligned investors who share our vision of making quality healthcare accessible to every community regardless of geography.',
      rawContent: 'Investment Ask - Raising $1.5M Series A...',
      confidence: 0.94,
      inferredSectors: JSON.stringify(['Finance', 'Healthcare']),
      inferredSkills: JSON.stringify(['Financial Analysis', 'Leadership', 'Strategic Planning']),
      keywords: JSON.stringify(['Series A', 'impact investment', 'ARR', 'fundraising', 'kiosk deployment']),
    },
  ],
};

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function main() {
  console.log('🚀 Starting Match Test 2 Seed...\n');

  // -------------------------------------------------------------------------
  // Step 1: Clean up existing test user data
  // -------------------------------------------------------------------------
  console.log('🧹 Cleaning up existing test data...');

  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
  });

  if (existingUser) {
    // Delete all related data (order matters for foreign keys without cascade)
    await prisma.pitchSection.deleteMany({
      where: { pitch: { userId: existingUser.id } },
    });
    await prisma.pitch.deleteMany({ where: { userId: existingUser.id } });
    await prisma.dealRequest.deleteMany({ where: { userId: existingUser.id } });
    await prisma.opportunityIntentSkill.deleteMany({
      where: { intent: { userId: existingUser.id } },
    });
    await prisma.opportunityIntentSector.deleteMany({
      where: { intent: { userId: existingUser.id } },
    });
    await prisma.opportunityIntent.deleteMany({ where: { userId: existingUser.id } });
    await prisma.projectSkill.deleteMany({
      where: { project: { userId: existingUser.id } },
    });
    await prisma.projectSector.deleteMany({
      where: { project: { userId: existingUser.id } },
    });
    await prisma.project.deleteMany({ where: { userId: existingUser.id } });
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
  console.log('\n👤 Creating test user: Dr. Amira Haddad...');

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
  // Step 9: Create all 25 contacts
  // -------------------------------------------------------------------------
  console.log('\n📇 Creating 25 contacts...\n');

  let contactCount = 0;

  for (const contactData of ALL_CONTACTS) {
    contactCount++;

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
        rawSources: JSON.stringify({}),
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
    if (contactCount <= 5) matchLevel = '🔥 VERY HIGH';
    else if (contactCount <= 11) matchLevel = '✨ HIGH';
    else if (contactCount <= 17) matchLevel = '📊 MEDIUM';
    else if (contactCount <= 22) matchLevel = '📉 LOW';
    else matchLevel = '❄️ VERY LOW';

    console.log(`   [${contactCount.toString().padStart(2, '0')}/25] ${matchLevel} | ${contactData.fullName} - ${contactData.jobTitle} @ ${contactData.company}`);
  }

  // -------------------------------------------------------------------------
  // Step 10: Create project
  // -------------------------------------------------------------------------
  console.log('\n🏗️ Creating project: Smart Rural Health Platform...');

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      title: PROJECT_DATA.title,
      summary: PROJECT_DATA.summary,
      detailedDesc: PROJECT_DATA.detailedDesc,
      category: PROJECT_DATA.category,
      stage: PROJECT_DATA.stage,
      investmentRange: PROJECT_DATA.investmentRange,
      timeline: PROJECT_DATA.timeline,
      lookingFor: PROJECT_DATA.lookingFor,
      keywords: PROJECT_DATA.keywords,
    },
  });

  // Add project sectors
  for (const sectorName of PROJECT_DATA.sectors) {
    const sectorId = sectorMap.get(sectorName);
    if (sectorId) {
      await prisma.projectSector.create({
        data: { projectId: project.id, sectorId },
      });
    }
  }

  // Add project skills
  for (const skill of PROJECT_DATA.skills) {
    const skillId = skillMap.get(skill.name);
    if (skillId) {
      await prisma.projectSkill.create({
        data: { projectId: project.id, skillId, importance: skill.importance },
      });
    }
  }

  console.log(`   ✓ Created project: ${project.title} (${PROJECT_DATA.stage})`);

  // -------------------------------------------------------------------------
  // Step 11: Create opportunities
  // -------------------------------------------------------------------------
  console.log('\n💼 Creating opportunity intents...');

  for (const opp of OPPORTUNITIES_DATA) {
    const intent = await prisma.opportunityIntent.create({
      data: {
        userId: user.id,
        title: opp.title,
        intentType: opp.intentType,
        roleArea: opp.roleArea,
        seniority: opp.seniority,
        locationPref: opp.locationPref,
        remoteOk: opp.remoteOk,
        notes: opp.notes,
      },
    });

    // Add opportunity sectors
    for (const sectorName of opp.sectors) {
      const sectorId = sectorMap.get(sectorName);
      if (sectorId) {
        await prisma.opportunityIntentSector.create({
          data: { intentId: intent.id, sectorId },
        });
      }
    }

    // Add opportunity skills
    for (const skillName of opp.skills) {
      const skillId = skillMap.get(skillName);
      if (skillId) {
        await prisma.opportunityIntentSkill.create({
          data: { intentId: intent.id, skillId },
        });
      }
    }

    console.log(`   ✓ Created opportunity: ${intent.title} (${opp.intentType})`);
  }

  // -------------------------------------------------------------------------
  // Step 12: Create deals
  // -------------------------------------------------------------------------
  console.log('\n🤝 Creating deal requests...');

  for (const deal of DEALS_DATA) {
    const dealRequest = await prisma.dealRequest.create({
      data: {
        userId: user.id,
        mode: deal.mode,
        title: deal.title,
        domain: deal.domain,
        solutionType: deal.solutionType,
        companySize: deal.companySize,
        problemStatement: deal.problemStatement,
        targetEntityType: deal.targetEntityType,
        productName: deal.productName,
        targetDescription: deal.targetDescription,
        status: deal.status,
      },
    });

    console.log(`   ✓ Created deal: ${dealRequest.title} (${deal.mode})`);
  }

  // -------------------------------------------------------------------------
  // Step 13: Create pitch
  // -------------------------------------------------------------------------
  console.log('\n📄 Creating pitch deck...');

  const pitch = await prisma.pitch.create({
    data: {
      userId: user.id,
      fileKey: PITCH_DATA.fileKey,
      fileName: PITCH_DATA.fileName,
      fileType: PITCH_DATA.fileType,
      fileSize: PITCH_DATA.fileSize,
      language: PITCH_DATA.language,
      status: PITCH_DATA.status,
      title: PITCH_DATA.title,
      companyName: PITCH_DATA.companyName,
      rawText: PITCH_DATA.rawText,
      processedAt: new Date(),
    },
  });

  // Create pitch sections
  for (const section of PITCH_DATA.sections) {
    await prisma.pitchSection.create({
      data: {
        pitchId: pitch.id,
        type: section.type,
        order: section.order,
        title: section.title,
        content: section.content,
        rawContent: section.rawContent,
        confidence: section.confidence,
        inferredSectors: section.inferredSectors,
        inferredSkills: section.inferredSkills,
        keywords: section.keywords,
      },
    });
  }

  console.log(`   ✓ Created pitch: ${pitch.title} (${PITCH_DATA.sections.length} sections)`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('✅ MATCH TEST 2 SEED COMPLETE');
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

🏗️ Projects Created: 1
   • ${PROJECT_DATA.title} (${PROJECT_DATA.stage})

💼 Opportunities Created: ${OPPORTUNITIES_DATA.length}
   • ${OPPORTUNITIES_DATA.map(o => `${o.title} (${o.intentType})`).join('\n   • ')}

🤝 Deals Created: ${DEALS_DATA.length}
   • ${DEALS_DATA.map(d => `${d.title} (${d.mode})`).join('\n   • ')}

📄 Pitches Created: 1
   • ${PITCH_DATA.title} (${PITCH_DATA.sections.length} sections)

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
