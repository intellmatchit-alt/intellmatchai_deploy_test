/**
 * Comprehensive Seed Script for Testing
 *
 * Creates:
 * - 5 test users with full profiles
 * - 50+ contacts per main user
 * - Multiple projects
 * - All necessary lookup data
 */

import { PrismaClient, GoalType, ProficiencyLevel, Intensity, ContactSource, ProjectStage, ProjectVisibility, SkillImportance } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================
// LOOKUP DATA
// ============================================

const SECTORS_DATA = [
  { name: 'Technology', nameAr: 'التكنولوجيا', icon: 'laptop' },
  { name: 'Finance', nameAr: 'المالية', icon: 'currency' },
  { name: 'Healthcare', nameAr: 'الرعاية الصحية', icon: 'heart' },
  { name: 'Education', nameAr: 'التعليم', icon: 'book' },
  { name: 'Marketing', nameAr: 'التسويق', icon: 'megaphone' },
  { name: 'Consulting', nameAr: 'الاستشارات', icon: 'briefcase' },
  { name: 'E-commerce', nameAr: 'التجارة الإلكترونية', icon: 'cart' },
  { name: 'Real Estate', nameAr: 'العقارات', icon: 'building' },
  { name: 'Manufacturing', nameAr: 'التصنيع', icon: 'factory' },
  { name: 'Media', nameAr: 'الإعلام', icon: 'video' },
  { name: 'Legal', nameAr: 'القانون', icon: 'scale' },
  { name: 'Energy', nameAr: 'الطاقة', icon: 'bolt' },
  { name: 'Logistics', nameAr: 'اللوجستيات', icon: 'truck' },
  { name: 'Hospitality', nameAr: 'الضيافة', icon: 'hotel' },
  { name: 'Agriculture', nameAr: 'الزراعة', icon: 'leaf' },
];

const SKILLS_DATA = [
  { name: 'Python', category: 'Technical' },
  { name: 'JavaScript', category: 'Technical' },
  { name: 'React', category: 'Technical' },
  { name: 'Node.js', category: 'Technical' },
  { name: 'Machine Learning', category: 'Technical' },
  { name: 'Data Science', category: 'Technical' },
  { name: 'Cloud Computing', category: 'Technical' },
  { name: 'AWS', category: 'Technical' },
  { name: 'Docker', category: 'Technical' },
  { name: 'Kubernetes', category: 'Technical' },
  { name: 'SQL', category: 'Technical' },
  { name: 'MongoDB', category: 'Technical' },
  { name: 'Cybersecurity', category: 'Technical' },
  { name: 'Mobile Development', category: 'Technical' },
  { name: 'UI/UX Design', category: 'Design' },
  { name: 'Graphic Design', category: 'Design' },
  { name: 'Product Management', category: 'Business' },
  { name: 'Project Management', category: 'Business' },
  { name: 'Business Development', category: 'Business' },
  { name: 'Sales', category: 'Business' },
  { name: 'Marketing Strategy', category: 'Business' },
  { name: 'Digital Marketing', category: 'Business' },
  { name: 'SEO', category: 'Business' },
  { name: 'Content Marketing', category: 'Business' },
  { name: 'Financial Analysis', category: 'Finance' },
  { name: 'Investment Banking', category: 'Finance' },
  { name: 'Accounting', category: 'Finance' },
  { name: 'Leadership', category: 'Soft Skills' },
  { name: 'Communication', category: 'Soft Skills' },
  { name: 'Negotiation', category: 'Soft Skills' },
  { name: 'Team Building', category: 'Soft Skills' },
  { name: 'Public Speaking', category: 'Soft Skills' },
  { name: 'Strategic Planning', category: 'Business' },
  { name: 'Operations Management', category: 'Business' },
  { name: 'Supply Chain', category: 'Business' },
  { name: 'HR Management', category: 'Business' },
  { name: 'Legal Compliance', category: 'Legal' },
  { name: 'Contract Negotiation', category: 'Legal' },
  { name: 'Data Visualization', category: 'Technical' },
  { name: 'Blockchain', category: 'Technical' },
];

const INTERESTS_DATA = [
  { name: 'AI & Machine Learning', category: 'Technology' },
  { name: 'Startups', category: 'Business' },
  { name: 'Venture Capital', category: 'Finance' },
  { name: 'Blockchain', category: 'Technology' },
  { name: 'Sustainability', category: 'Environment' },
  { name: 'Innovation', category: 'Business' },
  { name: 'Networking', category: 'Professional' },
  { name: 'Digital Transformation', category: 'Technology' },
  { name: 'Investment', category: 'Finance' },
  { name: 'Data Analytics', category: 'Technology' },
  { name: 'Mentorship', category: 'Professional' },
  { name: 'Research', category: 'Academic' },
  { name: 'Entrepreneurship', category: 'Business' },
  { name: 'Fintech', category: 'Finance' },
  { name: 'Healthtech', category: 'Healthcare' },
  { name: 'Edtech', category: 'Education' },
  { name: 'Climate Tech', category: 'Environment' },
  { name: 'SaaS', category: 'Technology' },
  { name: 'E-commerce', category: 'Business' },
  { name: 'Social Impact', category: 'Social' },
];

// ============================================
// TEST USERS
// ============================================

const TEST_USERS = [
  {
    email: 'alex@intellmatch.com',
    password: 'Test123!',
    fullName: 'Alex Thompson',
    jobTitle: 'Founder & CEO',
    company: 'TechVentures AI',
    bio: 'Serial entrepreneur building AI-powered products. Looking for investors, technical co-founders, and strategic partners. Passionate about startups, machine learning, and innovation.',
    location: 'San Francisco, CA',
    sectors: ['Technology', 'Finance', 'Consulting'],
    skills: ['Python', 'Machine Learning', 'Product Management', 'Leadership', 'Cloud Computing', 'Business Development'],
    interests: ['AI & Machine Learning', 'Startups', 'Venture Capital', 'Innovation', 'Digital Transformation', 'Investment'],
    goals: ['INVESTMENT', 'PARTNERSHIP', 'HIRING', 'COLLABORATION'],
  },
  {
    email: 'sarah@intellmatch.com',
    password: 'Test123!',
    fullName: 'Sarah Chen',
    jobTitle: 'CTO',
    company: 'DataFlow Systems',
    bio: 'Technical leader with 15 years in big data and ML. Building scalable data platforms. Open to advisory roles and technical partnerships.',
    location: 'Seattle, WA',
    sectors: ['Technology'],
    skills: ['Python', 'Data Science', 'AWS', 'Machine Learning', 'Leadership', 'Docker'],
    interests: ['AI & Machine Learning', 'Data Analytics', 'Mentorship', 'Research'],
    goals: ['MENTORSHIP', 'COLLABORATION', 'PARTNERSHIP'],
  },
  {
    email: 'omar@intellmatch.com',
    password: 'Test123!',
    fullName: 'Omar Hassan',
    jobTitle: 'Managing Partner',
    company: 'Gulf Ventures',
    bio: 'Investor focused on MENA tech startups. $50M+ deployed in AI, fintech, and healthtech. Always looking for promising founders.',
    location: 'Dubai, UAE',
    sectors: ['Finance', 'Technology'],
    skills: ['Financial Analysis', 'Investment Banking', 'Negotiation', 'Strategic Planning', 'Business Development'],
    interests: ['Venture Capital', 'Investment', 'Fintech', 'Startups', 'Entrepreneurship'],
    goals: ['INVESTMENT', 'MENTORSHIP'],
  },
  {
    email: 'maria@intellmatch.com',
    password: 'Test123!',
    fullName: 'Maria Garcia',
    jobTitle: 'Head of Product',
    company: 'HealthTech Pro',
    bio: 'Product leader in digital health. Built products used by 10M+ patients. Passionate about making healthcare accessible through technology.',
    location: 'Boston, MA',
    sectors: ['Healthcare', 'Technology'],
    skills: ['Product Management', 'UI/UX Design', 'Project Management', 'Communication', 'Data Visualization'],
    interests: ['Healthtech', 'Digital Transformation', 'Innovation', 'Social Impact'],
    goals: ['COLLABORATION', 'HIRING', 'PARTNERSHIP'],
  },
  {
    email: 'james@intellmatch.com',
    password: 'Test123!',
    fullName: 'James Wilson',
    jobTitle: 'Senior Consultant',
    company: 'McKinsey & Company',
    bio: 'Strategy consultant specializing in digital transformation. Helped 50+ enterprises modernize their tech stack.',
    location: 'New York, NY',
    sectors: ['Consulting', 'Technology', 'Finance'],
    skills: ['Strategic Planning', 'Business Development', 'Project Management', 'Leadership', 'Communication', 'Financial Analysis'],
    interests: ['Digital Transformation', 'Innovation', 'Networking', 'Mentorship'],
    goals: ['PARTNERSHIP', 'COLLABORATION', 'SALES'],
  },
];

// ============================================
// CONTACTS DATA (50+ diverse contacts)
// ============================================

const CONTACTS_DATA = [
  // Tech Founders & CTOs
  { fullName: 'Emily Zhang', email: 'emily.zhang@ailab.io', company: 'AI Lab Inc', jobTitle: 'Co-founder & CTO', bio: 'Building next-gen AI infrastructure. PhD from Stanford. Previously at Google Brain.', location: 'Palo Alto, CA', sectors: ['Technology'], skills: ['Machine Learning', 'Python', 'Cloud Computing', 'Leadership'] },
  { fullName: 'Michael Roberts', email: 'michael@cloudscale.com', company: 'CloudScale', jobTitle: 'Founder & CEO', bio: 'Serial entrepreneur. 3rd startup. Focus on cloud infrastructure optimization.', location: 'Austin, TX', sectors: ['Technology'], skills: ['AWS', 'Docker', 'Kubernetes', 'Business Development'] },
  { fullName: 'Priya Sharma', email: 'priya@datainsights.in', company: 'DataInsights', jobTitle: 'Chief Data Officer', bio: 'Data science leader. Built ML teams at Amazon and Flipkart.', location: 'Bangalore, India', sectors: ['Technology'], skills: ['Data Science', 'Machine Learning', 'Python', 'SQL'] },
  { fullName: 'David Kim', email: 'david.kim@cybershield.io', company: 'CyberShield', jobTitle: 'VP Engineering', bio: 'Cybersecurity expert. Former NSA. Building enterprise security solutions.', location: 'Washington, DC', sectors: ['Technology'], skills: ['Cybersecurity', 'Cloud Computing', 'Leadership', 'Python'] },
  { fullName: 'Lisa Anderson', email: 'lisa@devtools.co', company: 'DevTools Inc', jobTitle: 'Founder', bio: 'Building developer productivity tools. YC alum. 100K+ developers using our platform.', location: 'San Francisco, CA', sectors: ['Technology'], skills: ['JavaScript', 'React', 'Node.js', 'Product Management'] },

  // Investors & VCs
  { fullName: 'Ahmed Al-Rashid', email: 'ahmed@gulfvc.ae', company: 'Gulf Ventures Capital', jobTitle: 'Managing Partner', bio: 'Early stage investor. Focus on AI, SaaS, and fintech. $100M AUM.', location: 'Dubai, UAE', sectors: ['Finance', 'Technology'], skills: ['Financial Analysis', 'Investment Banking', 'Negotiation', 'Strategic Planning'] },
  { fullName: 'Rachel Green', email: 'rachel@techfund.vc', company: 'Tech Fund', jobTitle: 'Principal', bio: 'Series A investor. Focus on enterprise software. Former product at Salesforce.', location: 'San Francisco, CA', sectors: ['Finance', 'Technology'], skills: ['Financial Analysis', 'Business Development', 'Strategic Planning'] },
  { fullName: 'William Chen', email: 'william@angelnetwork.com', company: 'Angel Network', jobTitle: 'Angel Investor', bio: 'Exited 2 startups. Now investing in early-stage tech. Focus on diverse founders.', location: 'New York, NY', sectors: ['Finance'], skills: ['Investment Banking', 'Negotiation', 'Mentorship'] },
  { fullName: 'Fatima Hassan', email: 'fatima@menaventures.sa', company: 'MENA Ventures', jobTitle: 'Investment Director', bio: 'Growth stage investor covering Saudi Arabia and UAE. Fintech specialist.', location: 'Riyadh, Saudi Arabia', sectors: ['Finance', 'Technology'], skills: ['Financial Analysis', 'Strategic Planning', 'Business Development'] },

  // Healthcare Tech
  { fullName: 'Dr. John Smith', email: 'john.smith@medtech.com', company: 'MedTech Solutions', jobTitle: 'Chief Medical Officer', bio: 'MD/MBA. Bridging healthcare and technology. Former Chief of Medicine at Mass General.', location: 'Boston, MA', sectors: ['Healthcare', 'Technology'], skills: ['Leadership', 'Strategic Planning', 'Communication'] },
  { fullName: 'Jennifer Lee', email: 'jennifer@healthai.co', company: 'HealthAI', jobTitle: 'CEO', bio: 'AI-powered diagnostics. FDA approved solutions. Series B startup.', location: 'San Diego, CA', sectors: ['Healthcare', 'Technology'], skills: ['Machine Learning', 'Product Management', 'Leadership', 'Business Development'] },
  { fullName: 'Carlos Mendoza', email: 'carlos@telemedicine.mx', company: 'TeleMed LATAM', jobTitle: 'Founder', bio: 'Making healthcare accessible in Latin America through telemedicine.', location: 'Mexico City, Mexico', sectors: ['Healthcare', 'Technology'], skills: ['Product Management', 'Business Development', 'Leadership'] },

  // Fintech
  { fullName: 'Marcus Johnson', email: 'marcus@payflow.io', company: 'PayFlow', jobTitle: 'CEO', bio: 'Building next-gen payment infrastructure. Previously at Stripe.', location: 'New York, NY', sectors: ['Finance', 'Technology'], skills: ['Product Management', 'Leadership', 'Business Development', 'Blockchain'] },
  { fullName: 'Sophie Dubois', email: 'sophie@neobank.eu', company: 'NeoBank Europe', jobTitle: 'COO', bio: 'Scaling digital banking across Europe. Former Goldman Sachs.', location: 'Paris, France', sectors: ['Finance', 'Technology'], skills: ['Financial Analysis', 'Operations Management', 'Leadership', 'Strategic Planning'] },
  { fullName: 'Raj Patel', email: 'raj@cryptoexchange.in', company: 'CryptoX', jobTitle: 'CTO', bio: 'Building secure crypto trading platform. 1M+ users in India.', location: 'Mumbai, India', sectors: ['Finance', 'Technology'], skills: ['Blockchain', 'Cybersecurity', 'Python', 'Cloud Computing'] },

  // E-commerce
  { fullName: 'Anna Kowalski', email: 'anna@shopify-agency.eu', company: 'E-com Experts', jobTitle: 'Founder', bio: 'Helping brands scale on Shopify. 200+ successful launches.', location: 'Berlin, Germany', sectors: ['E-commerce', 'Marketing'], skills: ['Digital Marketing', 'SEO', 'Business Development', 'Project Management'] },
  { fullName: 'Tom Wilson', email: 'tom@dropship.co', company: 'DropShip Pro', jobTitle: 'CEO', bio: 'E-commerce automation platform. Processing $50M+ GMV monthly.', location: 'London, UK', sectors: ['E-commerce', 'Technology'], skills: ['Product Management', 'Business Development', 'Operations Management'] },
  { fullName: 'Nina Chang', email: 'nina@marketplace.asia', company: 'Asian Marketplace', jobTitle: 'VP Growth', bio: 'Growth expert. Scaled GMV from $1M to $100M in 2 years.', location: 'Singapore', sectors: ['E-commerce', 'Marketing'], skills: ['Marketing Strategy', 'Digital Marketing', 'Data Science', 'Business Development'] },

  // Marketing & Media
  { fullName: 'Jessica Brown', email: 'jessica@brandagency.com', company: 'Brand Agency', jobTitle: 'Creative Director', bio: 'Award-winning creative. Clients include Fortune 500 companies.', location: 'Los Angeles, CA', sectors: ['Marketing', 'Media'], skills: ['Graphic Design', 'Marketing Strategy', 'Communication', 'Leadership'] },
  { fullName: 'Ryan Murphy', email: 'ryan@contentking.io', company: 'Content King', jobTitle: 'Founder', bio: 'Content marketing at scale. Helped 500+ B2B companies grow.', location: 'Chicago, IL', sectors: ['Marketing', 'Technology'], skills: ['Content Marketing', 'SEO', 'Digital Marketing', 'Business Development'] },
  { fullName: 'Elena Rossi', email: 'elena@influencer.it', company: 'Influencer Marketing Italy', jobTitle: 'Managing Director', bio: 'Connecting brands with influencers. Network of 10K+ creators.', location: 'Milan, Italy', sectors: ['Marketing', 'Media'], skills: ['Marketing Strategy', 'Negotiation', 'Communication', 'Business Development'] },

  // Consulting
  { fullName: 'Daniel Brown', email: 'daniel@bcg.com', company: 'BCG', jobTitle: 'Partner', bio: 'Strategy consultant. Tech sector specialist. 20 years experience.', location: 'Boston, MA', sectors: ['Consulting', 'Technology'], skills: ['Strategic Planning', 'Leadership', 'Communication', 'Business Development'] },
  { fullName: 'Michelle Wu', email: 'michelle@deloitte.com', company: 'Deloitte', jobTitle: 'Senior Manager', bio: 'Digital transformation consultant. Helping enterprises modernize.', location: 'Toronto, Canada', sectors: ['Consulting', 'Technology'], skills: ['Project Management', 'Strategic Planning', 'Communication', 'Leadership'] },

  // Real Estate Tech
  { fullName: 'Robert Taylor', email: 'robert@proptech.io', company: 'PropTech Solutions', jobTitle: 'Co-founder', bio: 'AI-powered property valuation. Serving 100+ real estate firms.', location: 'Miami, FL', sectors: ['Real Estate', 'Technology'], skills: ['Machine Learning', 'Business Development', 'Product Management'] },
  { fullName: 'Sarah Miller', email: 'sarah@smartbuildings.com', company: 'Smart Buildings', jobTitle: 'CEO', bio: 'IoT for commercial real estate. Energy savings up to 40%.', location: 'Denver, CO', sectors: ['Real Estate', 'Technology'], skills: ['Product Management', 'Leadership', 'Business Development', 'Strategic Planning'] },

  // Education Tech
  { fullName: 'Fatima Al-Sayed', email: 'fatima@learntech.sa', company: 'LearnSmart Arabia', jobTitle: 'Founder & CEO', bio: 'Transforming education in the Arab world through AI-powered learning.', location: 'Riyadh, Saudi Arabia', sectors: ['Education', 'Technology'], skills: ['Product Management', 'Machine Learning', 'Leadership', 'Business Development'] },
  { fullName: 'Kevin O\'Brien', email: 'kevin@codingcamp.com', company: 'Coding Camp', jobTitle: 'Founder', bio: 'Teaching 100K+ students to code. Bootcamp with 95% job placement.', location: 'Dublin, Ireland', sectors: ['Education', 'Technology'], skills: ['JavaScript', 'React', 'Leadership', 'Communication'] },
  { fullName: 'Yuki Tanaka', email: 'yuki@edtech.jp', company: 'EdTech Japan', jobTitle: 'CEO', bio: 'Corporate training platform. Used by 500+ enterprises in Japan.', location: 'Tokyo, Japan', sectors: ['Education', 'Technology'], skills: ['Product Management', 'Business Development', 'Strategic Planning'] },

  // Energy & Sustainability
  { fullName: 'Emma Johnson', email: 'emma@cleanenergy.com', company: 'Clean Energy Co', jobTitle: 'Chief Sustainability Officer', bio: 'Leading corporate sustainability initiatives. Former UN advisor.', location: 'Stockholm, Sweden', sectors: ['Energy'], skills: ['Strategic Planning', 'Leadership', 'Communication', 'Project Management'] },
  { fullName: 'Hassan Ibrahim', email: 'hassan@solartech.eg', company: 'SolarTech Egypt', jobTitle: 'Founder', bio: 'Solar solutions for MENA region. 100MW+ installed capacity.', location: 'Cairo, Egypt', sectors: ['Energy', 'Technology'], skills: ['Business Development', 'Project Management', 'Negotiation'] },

  // Manufacturing & Supply Chain
  { fullName: 'Thomas Weber', email: 'thomas@smartfactory.de', company: 'Smart Factory', jobTitle: 'CTO', bio: 'Industry 4.0 solutions. Helping manufacturers digitize operations.', location: 'Munich, Germany', sectors: ['Manufacturing', 'Technology'], skills: ['Cloud Computing', 'Data Science', 'Leadership', 'Project Management'] },
  { fullName: 'Linda Chen', email: 'linda@supplychain.cn', company: 'Supply Chain Solutions', jobTitle: 'VP Operations', bio: 'Optimizing global supply chains. 20 years in logistics.', location: 'Shanghai, China', sectors: ['Logistics', 'Manufacturing'], skills: ['Supply Chain', 'Operations Management', 'Strategic Planning', 'Negotiation'] },

  // Legal Tech
  { fullName: 'Amanda Foster', email: 'amanda@legaltech.com', company: 'LegalTech Pro', jobTitle: 'CEO', bio: 'AI-powered contract analysis. Serving 100+ law firms.', location: 'Chicago, IL', sectors: ['Legal', 'Technology'], skills: ['Legal Compliance', 'Product Management', 'Business Development'] },
  { fullName: 'Richard Hayes', email: 'richard@iplaw.co', company: 'IP Law Partners', jobTitle: 'Partner', bio: 'Patent attorney specializing in tech startups. 500+ patents filed.', location: 'San Jose, CA', sectors: ['Legal'], skills: ['Contract Negotiation', 'Legal Compliance', 'Communication'] },

  // More Tech Professionals
  { fullName: 'Chris Martinez', email: 'chris@mlops.io', company: 'MLOps Platform', jobTitle: 'Founder', bio: 'Making ML deployment easy. Open source with 10K+ GitHub stars.', location: 'Seattle, WA', sectors: ['Technology'], skills: ['Machine Learning', 'Python', 'Docker', 'Kubernetes', 'Cloud Computing'] },
  { fullName: 'Amy Liu', email: 'amy@designsystem.co', company: 'Design System Co', jobTitle: 'Head of Design', bio: 'Building design systems for Fortune 500. Former Apple designer.', location: 'Cupertino, CA', sectors: ['Technology'], skills: ['UI/UX Design', 'Graphic Design', 'Leadership', 'Communication'] },
  { fullName: 'Brian Thompson', email: 'brian@devrel.io', company: 'DevRel Agency', jobTitle: 'Founder', bio: 'Developer relations consulting. Helped 50+ companies build developer communities.', location: 'Portland, OR', sectors: ['Technology', 'Marketing'], skills: ['Communication', 'Content Marketing', 'Business Development', 'Public Speaking'] },
  { fullName: 'Nadia Petrov', email: 'nadia@quantumcompute.ru', company: 'Quantum Compute', jobTitle: 'Research Director', bio: 'Quantum computing research. PhD MIT. Building practical quantum solutions.', location: 'Moscow, Russia', sectors: ['Technology'], skills: ['Python', 'Machine Learning', 'Research'] },
  { fullName: 'Alex Novak', email: 'alex@sre.io', company: 'SRE Solutions', jobTitle: 'Principal Engineer', bio: 'Site reliability engineering consultant. Former Google SRE.', location: 'Sydney, Australia', sectors: ['Technology'], skills: ['Kubernetes', 'Docker', 'AWS', 'Python', 'Cloud Computing'] },

  // More Business Professionals
  { fullName: 'Victoria Adams', email: 'victoria@hrtech.com', company: 'HR Tech Solutions', jobTitle: 'CEO', bio: 'Modernizing HR with AI. 500+ enterprise customers.', location: 'Atlanta, GA', sectors: ['Technology'], skills: ['HR Management', 'Product Management', 'Leadership', 'Business Development'] },
  { fullName: 'George Miller', email: 'george@salesforce.com', company: 'Salesforce', jobTitle: 'VP Sales', bio: 'Enterprise sales leader. Consistently exceeding quota by 150%+.', location: 'San Francisco, CA', sectors: ['Technology'], skills: ['Sales', 'Leadership', 'Negotiation', 'Communication'] },
  { fullName: 'Christine Lee', email: 'christine@partnerships.co', company: 'Partnership Strategies', jobTitle: 'Partner', bio: 'Helping startups land enterprise partnerships. Former BD at Microsoft.', location: 'Redmond, WA', sectors: ['Consulting'], skills: ['Business Development', 'Negotiation', 'Strategic Planning', 'Communication'] },
  { fullName: 'Mohammed Ali', email: 'mohammed@mba.ae', company: 'MBA Consulting', jobTitle: 'Managing Director', bio: 'Business strategy for Middle East expansion. Helped 100+ companies enter MENA.', location: 'Abu Dhabi, UAE', sectors: ['Consulting'], skills: ['Strategic Planning', 'Business Development', 'Negotiation', 'Leadership'] },
  { fullName: 'Patricia Davis', email: 'patricia@cmo.io', company: 'CMO Advisory', jobTitle: 'Fractional CMO', bio: 'Marketing leadership for startups. Built marketing at 3 unicorns.', location: 'New York, NY', sectors: ['Marketing'], skills: ['Marketing Strategy', 'Digital Marketing', 'Leadership', 'Communication'] },

  // International Tech Leaders
  { fullName: 'Pedro Santos', email: 'pedro@techbrazil.br', company: 'TechBrazil', jobTitle: 'CEO', bio: 'Building tech ecosystem in Brazil. Largest tech community in LATAM.', location: 'Sao Paulo, Brazil', sectors: ['Technology'], skills: ['Leadership', 'Business Development', 'Communication', 'Strategic Planning'] },
  { fullName: 'Aisha Mohammed', email: 'aisha@africatech.ng', company: 'AfricaTech Hub', jobTitle: 'Founder', bio: 'Tech hub supporting African founders. 200+ startups incubated.', location: 'Lagos, Nigeria', sectors: ['Technology'], skills: ['Leadership', 'Business Development', 'Mentorship', 'Communication'] },
  { fullName: 'Kim Sung-Ho', email: 'kimsh@koreaai.kr', company: 'Korea AI', jobTitle: 'CTO', bio: 'AI research and development. Partnerships with Samsung and LG.', location: 'Seoul, South Korea', sectors: ['Technology'], skills: ['Machine Learning', 'Python', 'Leadership', 'Research'] },
  { fullName: 'Olga Volkova', email: 'olga@techukraine.ua', company: 'TechUkraine', jobTitle: 'CEO', bio: 'Leading tech community in Ukraine. Remote-first company with global clients.', location: 'Kyiv, Ukraine', sectors: ['Technology'], skills: ['Leadership', 'Business Development', 'Project Management'] },
  { fullName: 'Hans Mueller', email: 'hans@industry40.de', company: 'Industry 4.0 Lab', jobTitle: 'Director', bio: 'Research institute for smart manufacturing. Working with BMW, Siemens.', location: 'Stuttgart, Germany', sectors: ['Manufacturing', 'Technology'], skills: ['Research', 'Strategic Planning', 'Leadership', 'Project Management'] },
];

// ============================================
// PROJECTS DATA
// ============================================

const PROJECTS_DATA = [
  {
    title: 'AI-Powered Business Intelligence Platform',
    summary: 'Building an intelligent business analytics platform that uses machine learning to provide actionable insights for enterprises.',
    detailedDesc: 'Our platform combines advanced machine learning with intuitive visualization to help businesses make data-driven decisions. We use natural language processing for query interfaces and predictive analytics for forecasting.',
    category: 'SaaS',
    stage: 'MVP',
    investmentRange: '$500K - $2M',
    timeline: '12-18 months',
    lookingFor: ['investor', 'technical_partner', 'advisor'],
    sectors: ['Technology', 'Finance', 'Consulting'],
    skills: ['Machine Learning', 'Python', 'Data Visualization', 'Cloud Computing', 'Product Management'],
  },
  {
    title: 'HealthTech Telemedicine Platform',
    summary: 'Connecting patients with doctors through secure video consultations and AI-powered triage.',
    detailedDesc: 'Our telemedicine platform aims to make healthcare accessible to everyone. Features include video consultations, AI symptom checker, prescription management, and integration with electronic health records.',
    category: 'HealthTech',
    stage: 'VALIDATION',
    investmentRange: '$1M - $5M',
    timeline: '18-24 months',
    lookingFor: ['investor', 'cofounder', 'advisor'],
    sectors: ['Healthcare', 'Technology'],
    skills: ['Mobile Development', 'Cloud Computing', 'Machine Learning', 'Product Management', 'Leadership'],
  },
  {
    title: 'Sustainable Supply Chain Tracker',
    summary: 'Blockchain-based platform for tracking and verifying sustainable sourcing in supply chains.',
    detailedDesc: 'Using blockchain and IoT to create transparent, verifiable supply chains. Helping companies prove their sustainability claims and comply with regulations.',
    category: 'Enterprise',
    stage: 'IDEA',
    investmentRange: '$250K - $1M',
    timeline: '6-12 months',
    lookingFor: ['cofounder', 'technical_partner'],
    sectors: ['Logistics', 'Technology', 'Manufacturing'],
    skills: ['Blockchain', 'Cloud Computing', 'Business Development', 'Strategic Planning'],
  },
  {
    title: 'EdTech Personalized Learning',
    summary: 'AI-driven adaptive learning platform that personalizes education for each student.',
    detailedDesc: 'Using machine learning to understand each student learning style and pace. Creating personalized learning paths that maximize engagement and outcomes.',
    category: 'EdTech',
    stage: 'LAUNCHED',
    investmentRange: '$2M - $10M',
    timeline: '24+ months',
    lookingFor: ['investor', 'business_partner', 'employee'],
    sectors: ['Education', 'Technology'],
    skills: ['Machine Learning', 'Product Management', 'UI/UX Design', 'Data Science'],
  },
  {
    title: 'Fintech Payment Infrastructure',
    summary: 'Next-generation payment rails for cross-border transactions in emerging markets.',
    detailedDesc: 'Building payment infrastructure that enables instant, low-cost cross-border payments. Focus on MENA and Africa markets.',
    category: 'Fintech',
    stage: 'GROWTH',
    investmentRange: '$5M - $20M',
    timeline: '36+ months',
    lookingFor: ['investor', 'advisor'],
    sectors: ['Finance', 'Technology'],
    skills: ['Financial Analysis', 'Blockchain', 'Cloud Computing', 'Business Development', 'Leadership'],
  },
];

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('🚀 Starting comprehensive seed...\n');

  // Create lookup tables
  console.log('📊 Creating/updating sectors...');
  const sectorMap = new Map<string, string>();
  for (const sector of SECTORS_DATA) {
    const existing = await prisma.sector.findFirst({ where: { name: sector.name } });
    if (existing) {
      sectorMap.set(sector.name, existing.id);
    } else {
      const created = await prisma.sector.create({ data: sector });
      sectorMap.set(sector.name, created.id);
    }
  }
  console.log(`   ✅ ${sectorMap.size} sectors ready`);

  console.log('🛠️  Creating/updating skills...');
  const skillMap = new Map<string, string>();
  for (const skill of SKILLS_DATA) {
    const existing = await prisma.skill.findFirst({ where: { name: skill.name } });
    if (existing) {
      skillMap.set(skill.name, existing.id);
    } else {
      const created = await prisma.skill.create({ data: skill });
      skillMap.set(skill.name, created.id);
    }
  }
  console.log(`   ✅ ${skillMap.size} skills ready`);

  console.log('💡 Creating/updating interests...');
  const interestMap = new Map<string, string>();
  for (const interest of INTERESTS_DATA) {
    const existing = await prisma.interest.findFirst({ where: { name: interest.name } });
    if (existing) {
      interestMap.set(interest.name, existing.id);
    } else {
      const created = await prisma.interest.create({ data: interest });
      interestMap.set(interest.name, created.id);
    }
  }
  console.log(`   ✅ ${interestMap.size} interests ready`);

  // Create test users
  console.log('\n👤 Creating test users...');
  const userMap = new Map<string, string>();

  for (const userData of TEST_USERS) {
    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email: userData.email } });

    if (user) {
      console.log(`   ⚠️  User ${userData.email} exists, updating...`);
      // Delete related data to recreate
      await prisma.userSector.deleteMany({ where: { userId: user.id } });
      await prisma.userSkill.deleteMany({ where: { userId: user.id } });
      await prisma.userInterest.deleteMany({ where: { userId: user.id } });
      await prisma.userGoal.deleteMany({ where: { userId: user.id } });
    } else {
      const passwordHash = await bcrypt.hash(userData.password, 10);
      user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash,
          fullName: userData.fullName,
          jobTitle: userData.jobTitle,
          company: userData.company,
          bio: userData.bio,
          location: userData.location,
          emailVerified: true,
          isActive: true,
          consentEnrichment: true,
          consentContacts: true,
          consentAnalytics: true,
        }
      });
      console.log(`   ✅ Created user: ${user.fullName}`);
    }

    userMap.set(userData.email, user.id);

    // Add sectors
    for (let i = 0; i < userData.sectors.length; i++) {
      const sectorId = sectorMap.get(userData.sectors[i]);
      if (sectorId) {
        await prisma.userSector.create({
          data: { userId: user.id, sectorId, isPrimary: i === 0 }
        }).catch(() => {}); // Ignore duplicates
      }
    }

    // Add skills
    for (const skillName of userData.skills) {
      const skillId = skillMap.get(skillName);
      if (skillId) {
        await prisma.userSkill.create({
          data: { userId: user.id, skillId, proficiencyLevel: 'ADVANCED' }
        }).catch(() => {});
      }
    }

    // Add interests
    for (const interestName of userData.interests) {
      const interestId = interestMap.get(interestName);
      if (interestId) {
        await prisma.userInterest.create({
          data: { userId: user.id, interestId, intensity: 'PASSIONATE' }
        }).catch(() => {});
      }
    }

    // Add goals
    for (let i = 0; i < userData.goals.length; i++) {
      await prisma.userGoal.create({
        data: { userId: user.id, goalType: userData.goals[i] as GoalType, priority: i + 1 }
      }).catch(() => {});
    }
  }

  // Create contacts for the main user (alex@intellmatch.com)
  const mainUserId = userMap.get('alex@intellmatch.com')!;

  console.log(`\n👥 Creating ${CONTACTS_DATA.length} contacts for main user...`);

  // Delete existing contacts for main user
  await prisma.contact.deleteMany({ where: { ownerId: mainUserId } });

  for (const contactData of CONTACTS_DATA) {
    const contact = await prisma.contact.create({
      data: {
        ownerId: mainUserId,
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
    for (const sectorName of contactData.sectors) {
      const sectorId = sectorMap.get(sectorName);
      if (sectorId) {
        await prisma.contactSector.create({
          data: { contactId: contact.id, sectorId, confidence: 1.0, source: 'USER' }
        }).catch(() => {});
      }
    }

    // Add contact skills
    for (const skillName of contactData.skills) {
      const skillId = skillMap.get(skillName);
      if (skillId) {
        await prisma.contactSkill.create({
          data: { contactId: contact.id, skillId, confidence: 1.0, source: 'USER' }
        }).catch(() => {});
      }
    }
  }
  console.log(`   ✅ Created ${CONTACTS_DATA.length} contacts`);

  // Create projects for main user
  console.log(`\n📋 Creating ${PROJECTS_DATA.length} projects...`);

  // Delete existing projects for main user
  await prisma.project.deleteMany({ where: { userId: mainUserId } });

  for (const projectData of PROJECTS_DATA) {
    const project = await prisma.project.create({
      data: {
        userId: mainUserId,
        title: projectData.title,
        summary: projectData.summary,
        detailedDesc: projectData.detailedDesc,
        category: projectData.category,
        stage: projectData.stage as ProjectStage,
        investmentRange: projectData.investmentRange,
        timeline: projectData.timeline,
        lookingFor: projectData.lookingFor, // Already an array
        keywords: [], // Will be extracted by AI
        visibility: 'PUBLIC',
        isActive: true,
      }
    });

    // Add project sectors
    for (const sectorName of projectData.sectors) {
      const sectorId = sectorMap.get(sectorName);
      if (sectorId) {
        await prisma.projectSector.create({
          data: { projectId: project.id, sectorId }
        }).catch(() => {});
      }
    }

    // Add project skills
    for (let i = 0; i < projectData.skills.length; i++) {
      const skillId = skillMap.get(projectData.skills[i]);
      if (skillId) {
        const importance = i === 0 ? 'REQUIRED' : i < 3 ? 'PREFERRED' : 'NICE_TO_HAVE';
        await prisma.projectSkill.create({
          data: { projectId: project.id, skillId, importance: importance as SkillImportance }
        }).catch(() => {});
      }
    }

    console.log(`   ✅ Created project: ${project.title}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SEED COMPLETE - SUMMARY');
  console.log('='.repeat(60));
  console.log('\n🔐 Test Accounts:');
  for (const user of TEST_USERS) {
    console.log(`   • ${user.email} / ${user.password} - ${user.fullName} (${user.jobTitle})`);
  }
  console.log(`\n📈 Main Test Account: alex@intellmatch.com`);
  console.log(`   • ${CONTACTS_DATA.length} contacts`);
  console.log(`   • ${PROJECTS_DATA.length} projects`);
  console.log(`   • Full profile with sectors, skills, interests, goals`);
  console.log(`\n👥 Other Test Users:`);
  console.log(`   • ${TEST_USERS.length - 1} additional users for user-to-user project matching`);
  console.log(`\n📊 Lookup Data:`);
  console.log(`   • ${sectorMap.size} sectors`);
  console.log(`   • ${skillMap.size} skills`);
  console.log(`   • ${interestMap.size} interests`);
  console.log('\n✨ Ready for testing!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
