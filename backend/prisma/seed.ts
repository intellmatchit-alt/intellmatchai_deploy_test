/**
 * Database Seed Script
 *
 * Populates the database with initial lookup data (sectors, skills, interests).
 * All data is bilingual (English + Arabic).
 *
 * Usage: npx prisma db seed
 *
 * @module prisma/seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Sectors data (bilingual)
 */
const sectors = [
  // Technology
  { name: 'Technology', nameAr: 'التكنولوجيا', icon: 'laptop', displayOrder: 1 },
  { name: 'Software Development', nameAr: 'تطوير البرمجيات', icon: 'code', displayOrder: 2 },
  { name: 'Artificial Intelligence', nameAr: 'الذكاء الاصطناعي', icon: 'brain', displayOrder: 3 },
  { name: 'Cybersecurity', nameAr: 'الأمن السيبراني', icon: 'shield', displayOrder: 4 },
  { name: 'Cloud Computing', nameAr: 'الحوسبة السحابية', icon: 'cloud', displayOrder: 5 },

  // Finance
  { name: 'Finance', nameAr: 'المالية', icon: 'dollar', displayOrder: 10 },
  { name: 'Banking', nameAr: 'الخدمات المصرفية', icon: 'bank', displayOrder: 11 },
  { name: 'Investment', nameAr: 'الاستثمار', icon: 'chart', displayOrder: 12 },
  { name: 'Venture Capital', nameAr: 'رأس المال الاستثماري', icon: 'rocket', displayOrder: 13 },
  { name: 'FinTech', nameAr: 'التقنية المالية', icon: 'creditCard', displayOrder: 14 },

  // Healthcare
  { name: 'Healthcare', nameAr: 'الرعاية الصحية', icon: 'heart', displayOrder: 20 },
  { name: 'Pharmaceuticals', nameAr: 'الصناعات الدوائية', icon: 'pill', displayOrder: 21 },
  { name: 'Medical Devices', nameAr: 'الأجهزة الطبية', icon: 'stethoscope', displayOrder: 22 },
  { name: 'HealthTech', nameAr: 'التقنية الصحية', icon: 'activity', displayOrder: 23 },

  // Business Services
  { name: 'Consulting', nameAr: 'الاستشارات', icon: 'briefcase', displayOrder: 30 },
  { name: 'Legal Services', nameAr: 'الخدمات القانونية', icon: 'scale', displayOrder: 31 },
  { name: 'Accounting', nameAr: 'المحاسبة', icon: 'calculator', displayOrder: 32 },
  { name: 'Human Resources', nameAr: 'الموارد البشرية', icon: 'users', displayOrder: 33 },

  // Real Estate
  { name: 'Real Estate', nameAr: 'العقارات', icon: 'building', displayOrder: 40 },
  { name: 'Property Development', nameAr: 'التطوير العقاري', icon: 'construction', displayOrder: 41 },
  { name: 'PropTech', nameAr: 'التقنية العقارية', icon: 'home', displayOrder: 42 },

  // Media & Entertainment
  { name: 'Media', nameAr: 'الإعلام', icon: 'tv', displayOrder: 50 },
  { name: 'Entertainment', nameAr: 'الترفيه', icon: 'film', displayOrder: 51 },
  { name: 'Gaming', nameAr: 'الألعاب', icon: 'gamepad', displayOrder: 52 },
  { name: 'Advertising', nameAr: 'الإعلان', icon: 'megaphone', displayOrder: 53 },

  // E-commerce & Retail
  { name: 'E-commerce', nameAr: 'التجارة الإلكترونية', icon: 'shoppingCart', displayOrder: 60 },
  { name: 'Retail', nameAr: 'التجزئة', icon: 'store', displayOrder: 61 },
  { name: 'Logistics', nameAr: 'الخدمات اللوجستية', icon: 'truck', displayOrder: 62 },

  // Energy & Environment
  { name: 'Energy', nameAr: 'الطاقة', icon: 'zap', displayOrder: 70 },
  { name: 'Renewable Energy', nameAr: 'الطاقة المتجددة', icon: 'sun', displayOrder: 71 },
  { name: 'Oil & Gas', nameAr: 'النفط والغاز', icon: 'droplet', displayOrder: 72 },
  { name: 'CleanTech', nameAr: 'التقنية النظيفة', icon: 'leaf', displayOrder: 73 },

  // Education
  { name: 'Education', nameAr: 'التعليم', icon: 'book', displayOrder: 80 },
  { name: 'EdTech', nameAr: 'التقنية التعليمية', icon: 'graduationCap', displayOrder: 81 },
  { name: 'Training & Development', nameAr: 'التدريب والتطوير', icon: 'award', displayOrder: 82 },

  // Other
  { name: 'Government', nameAr: 'الحكومة', icon: 'landmark', displayOrder: 90 },
  { name: 'Non-profit', nameAr: 'غير ربحي', icon: 'heart', displayOrder: 91 },
  { name: 'Hospitality', nameAr: 'الضيافة', icon: 'hotel', displayOrder: 92 },
  { name: 'Manufacturing', nameAr: 'التصنيع', icon: 'factory', displayOrder: 93 },
  { name: 'Agriculture', nameAr: 'الزراعة', icon: 'sprout', displayOrder: 94 },
  { name: 'Transportation', nameAr: 'النقل', icon: 'car', displayOrder: 95 },
];

/**
 * Skills data (bilingual)
 */
const skills = [
  // Technical Skills
  { name: 'JavaScript', nameAr: 'جافا سكريبت', category: 'Programming' },
  { name: 'TypeScript', nameAr: 'تايب سكريبت', category: 'Programming' },
  { name: 'Python', nameAr: 'بايثون', category: 'Programming' },
  { name: 'Java', nameAr: 'جافا', category: 'Programming' },
  { name: 'C++', nameAr: 'سي بلس بلس', category: 'Programming' },
  { name: 'React', nameAr: 'ريأكت', category: 'Frontend' },
  { name: 'Angular', nameAr: 'أنجولار', category: 'Frontend' },
  { name: 'Vue.js', nameAr: 'فيو جي إس', category: 'Frontend' },
  { name: 'Node.js', nameAr: 'نود جي إس', category: 'Backend' },
  { name: 'Express.js', nameAr: 'إكسبريس', category: 'Backend' },
  { name: 'Django', nameAr: 'جانغو', category: 'Backend' },
  { name: 'PostgreSQL', nameAr: 'بوستجري إس كيو إل', category: 'Database' },
  { name: 'MongoDB', nameAr: 'مونجو دي بي', category: 'Database' },
  { name: 'MySQL', nameAr: 'ماي إس كيو إل', category: 'Database' },
  { name: 'AWS', nameAr: 'أمازون ويب سيرفيسز', category: 'Cloud' },
  { name: 'Azure', nameAr: 'أزور', category: 'Cloud' },
  { name: 'Google Cloud', nameAr: 'جوجل كلاود', category: 'Cloud' },
  { name: 'Docker', nameAr: 'دوكر', category: 'DevOps' },
  { name: 'Kubernetes', nameAr: 'كوبرنيتيس', category: 'DevOps' },
  { name: 'Machine Learning', nameAr: 'تعلم الآلة', category: 'AI/ML' },
  { name: 'Deep Learning', nameAr: 'التعلم العميق', category: 'AI/ML' },
  { name: 'Natural Language Processing', nameAr: 'معالجة اللغة الطبيعية', category: 'AI/ML' },
  { name: 'Data Science', nameAr: 'علم البيانات', category: 'Data' },
  { name: 'Data Analysis', nameAr: 'تحليل البيانات', category: 'Data' },
  { name: 'Blockchain', nameAr: 'بلوكتشين', category: 'Technology' },
  { name: 'Cybersecurity', nameAr: 'الأمن السيبراني', category: 'Security' },

  // Business Skills
  { name: 'Project Management', nameAr: 'إدارة المشاريع', category: 'Management' },
  { name: 'Product Management', nameAr: 'إدارة المنتجات', category: 'Management' },
  { name: 'Agile/Scrum', nameAr: 'أجايل/سكرام', category: 'Management' },
  { name: 'Strategic Planning', nameAr: 'التخطيط الاستراتيجي', category: 'Strategy' },
  { name: 'Business Development', nameAr: 'تطوير الأعمال', category: 'Business' },
  { name: 'Sales', nameAr: 'المبيعات', category: 'Business' },
  { name: 'Marketing', nameAr: 'التسويق', category: 'Marketing' },
  { name: 'Digital Marketing', nameAr: 'التسويق الرقمي', category: 'Marketing' },
  { name: 'SEO/SEM', nameAr: 'تحسين محركات البحث', category: 'Marketing' },
  { name: 'Content Marketing', nameAr: 'تسويق المحتوى', category: 'Marketing' },
  { name: 'Social Media Marketing', nameAr: 'التسويق عبر وسائل التواصل', category: 'Marketing' },
  { name: 'Financial Analysis', nameAr: 'التحليل المالي', category: 'Finance' },
  { name: 'Investment Analysis', nameAr: 'تحليل الاستثمار', category: 'Finance' },
  { name: 'Accounting', nameAr: 'المحاسبة', category: 'Finance' },
  { name: 'Fundraising', nameAr: 'جمع التمويل', category: 'Finance' },
  { name: 'Negotiation', nameAr: 'التفاوض', category: 'Soft Skills' },
  { name: 'Public Speaking', nameAr: 'الخطابة العامة', category: 'Soft Skills' },
  { name: 'Leadership', nameAr: 'القيادة', category: 'Soft Skills' },
  { name: 'Team Building', nameAr: 'بناء الفريق', category: 'Soft Skills' },
  { name: 'Communication', nameAr: 'التواصل', category: 'Soft Skills' },
  { name: 'Problem Solving', nameAr: 'حل المشكلات', category: 'Soft Skills' },
  { name: 'Critical Thinking', nameAr: 'التفكير النقدي', category: 'Soft Skills' },

  // Design Skills
  { name: 'UI/UX Design', nameAr: 'تصميم واجهة المستخدم', category: 'Design' },
  { name: 'Graphic Design', nameAr: 'التصميم الجرافيكي', category: 'Design' },
  { name: 'Figma', nameAr: 'فيجما', category: 'Design Tools' },
  { name: 'Adobe Creative Suite', nameAr: 'أدوبي كريتيف سويت', category: 'Design Tools' },
  { name: 'User Research', nameAr: 'أبحاث المستخدم', category: 'UX' },
];

/**
 * Interests data (bilingual)
 */
const interests = [
  // Technology & Innovation
  { name: 'Startups', nameAr: 'الشركات الناشئة', category: 'Business', icon: 'rocket' },
  { name: 'Entrepreneurship', nameAr: 'ريادة الأعمال', category: 'Business', icon: 'lightbulb' },
  { name: 'Innovation', nameAr: 'الابتكار', category: 'Technology', icon: 'sparkles' },
  { name: 'Artificial Intelligence', nameAr: 'الذكاء الاصطناعي', category: 'Technology', icon: 'brain' },
  { name: 'Web3 & Crypto', nameAr: 'الويب 3 والعملات الرقمية', category: 'Technology', icon: 'bitcoin' },
  { name: 'IoT', nameAr: 'إنترنت الأشياء', category: 'Technology', icon: 'wifi' },
  { name: 'Robotics', nameAr: 'الروبوتات', category: 'Technology', icon: 'robot' },
  { name: 'Space Technology', nameAr: 'تقنية الفضاء', category: 'Technology', icon: 'rocket' },

  // Business & Finance
  { name: 'Investing', nameAr: 'الاستثمار', category: 'Finance', icon: 'chart' },
  { name: 'Angel Investing', nameAr: 'الاستثمار الملائكي', category: 'Finance', icon: 'angel' },
  { name: 'Venture Capital', nameAr: 'رأس المال الاستثماري', category: 'Finance', icon: 'handshake' },
  { name: 'Stock Market', nameAr: 'سوق الأسهم', category: 'Finance', icon: 'trendingUp' },
  { name: 'Real Estate Investment', nameAr: 'الاستثمار العقاري', category: 'Finance', icon: 'building' },
  { name: 'Business Strategy', nameAr: 'استراتيجية الأعمال', category: 'Business', icon: 'chess' },
  { name: 'M&A', nameAr: 'الاندماج والاستحواذ', category: 'Business', icon: 'merge' },

  // Sustainability & Social
  { name: 'Sustainability', nameAr: 'الاستدامة', category: 'Environment', icon: 'leaf' },
  { name: 'Climate Tech', nameAr: 'تقنية المناخ', category: 'Environment', icon: 'globe' },
  { name: 'Social Impact', nameAr: 'الأثر الاجتماعي', category: 'Social', icon: 'heart' },
  { name: 'Diversity & Inclusion', nameAr: 'التنوع والشمول', category: 'Social', icon: 'users' },
  { name: 'Mental Health', nameAr: 'الصحة النفسية', category: 'Health', icon: 'brain' },
  { name: 'Education Reform', nameAr: 'إصلاح التعليم', category: 'Education', icon: 'book' },

  // Lifestyle & Personal
  { name: 'Travel', nameAr: 'السفر', category: 'Lifestyle', icon: 'plane' },
  { name: 'Fitness & Wellness', nameAr: 'اللياقة والعافية', category: 'Health', icon: 'dumbbell' },
  { name: 'Photography', nameAr: 'التصوير', category: 'Creative', icon: 'camera' },
  { name: 'Writing', nameAr: 'الكتابة', category: 'Creative', icon: 'pen' },
  { name: 'Music', nameAr: 'الموسيقى', category: 'Creative', icon: 'music' },
  { name: 'Art & Design', nameAr: 'الفن والتصميم', category: 'Creative', icon: 'palette' },
  { name: 'Cooking', nameAr: 'الطبخ', category: 'Lifestyle', icon: 'chef' },
  { name: 'Reading', nameAr: 'القراءة', category: 'Personal', icon: 'book' },
  { name: 'Podcasts', nameAr: 'البودكاست', category: 'Media', icon: 'mic' },

  // Networking & Community
  { name: 'Networking', nameAr: 'التواصل المهني', category: 'Professional', icon: 'users' },
  { name: 'Mentorship', nameAr: 'الإرشاد', category: 'Professional', icon: 'userCheck' },
  { name: 'Community Building', nameAr: 'بناء المجتمعات', category: 'Social', icon: 'users' },
  { name: 'Public Speaking', nameAr: 'الخطابة العامة', category: 'Professional', icon: 'mic' },
  { name: 'Volunteering', nameAr: 'العمل التطوعي', category: 'Social', icon: 'heart' },
];

/**
 * Hobbies data (bilingual)
 */
const hobbies = [
  // Sports & Fitness
  { name: 'Running', nameAr: 'الجري', category: 'Sports', icon: 'running' },
  { name: 'Swimming', nameAr: 'السباحة', category: 'Sports', icon: 'swimmer' },
  { name: 'Yoga', nameAr: 'اليوغا', category: 'Fitness', icon: 'yoga' },
  { name: 'Hiking', nameAr: 'المشي لمسافات طويلة', category: 'Outdoor', icon: 'mountain' },
  { name: 'Cycling', nameAr: 'ركوب الدراجات', category: 'Sports', icon: 'bicycle' },
  { name: 'Tennis', nameAr: 'التنس', category: 'Sports', icon: 'tennis' },
  { name: 'Golf', nameAr: 'الجولف', category: 'Sports', icon: 'golf' },
  { name: 'Football', nameAr: 'كرة القدم', category: 'Sports', icon: 'football' },

  // Creative & Arts
  { name: 'Photography', nameAr: 'التصوير', category: 'Creative', icon: 'camera' },
  { name: 'Painting', nameAr: 'الرسم', category: 'Creative', icon: 'palette' },
  { name: 'Drawing', nameAr: 'الرسم بالقلم', category: 'Creative', icon: 'pencil' },
  { name: 'Music Production', nameAr: 'إنتاج الموسيقى', category: 'Creative', icon: 'music' },
  { name: 'Playing Guitar', nameAr: 'العزف على الجيتار', category: 'Music', icon: 'guitar' },
  { name: 'Dancing', nameAr: 'الرقص', category: 'Creative', icon: 'dance' },
  { name: 'Writing', nameAr: 'الكتابة', category: 'Creative', icon: 'pen' },
  { name: 'Crafts & DIY', nameAr: 'الحرف اليدوية', category: 'Creative', icon: 'tools' },

  // Lifestyle
  { name: 'Cooking', nameAr: 'الطبخ', category: 'Lifestyle', icon: 'chef' },
  { name: 'Gardening', nameAr: 'البستنة', category: 'Outdoor', icon: 'plant' },
  { name: 'Travel', nameAr: 'السفر', category: 'Lifestyle', icon: 'plane' },
  { name: 'Reading', nameAr: 'القراءة', category: 'Lifestyle', icon: 'book' },
  { name: 'Gaming', nameAr: 'ألعاب الفيديو', category: 'Entertainment', icon: 'gamepad' },
  { name: 'Movies & TV', nameAr: 'الأفلام والتلفزيون', category: 'Entertainment', icon: 'film' },
  { name: 'Board Games', nameAr: 'ألعاب الطاولة', category: 'Entertainment', icon: 'dice' },

  // Outdoor & Adventure
  { name: 'Camping', nameAr: 'التخييم', category: 'Outdoor', icon: 'tent' },
  { name: 'Fishing', nameAr: 'صيد الأسماك', category: 'Outdoor', icon: 'fish' },
  { name: 'Rock Climbing', nameAr: 'تسلق الصخور', category: 'Adventure', icon: 'mountain' },
  { name: 'Surfing', nameAr: 'ركوب الأمواج', category: 'Sports', icon: 'wave' },
  { name: 'Skiing', nameAr: 'التزلج', category: 'Sports', icon: 'ski' },

  // Wellness & Self-improvement
  { name: 'Meditation', nameAr: 'التأمل', category: 'Wellness', icon: 'lotus' },
  { name: 'Mindfulness', nameAr: 'اليقظة الذهنية', category: 'Wellness', icon: 'brain' },
  { name: 'Language Learning', nameAr: 'تعلم اللغات', category: 'Education', icon: 'globe' },
  { name: 'Personal Finance', nameAr: 'التمويل الشخصي', category: 'Education', icon: 'wallet' },

  // Social
  { name: 'Volunteering', nameAr: 'العمل التطوعي', category: 'Social', icon: 'heart' },
  { name: 'Pet Care', nameAr: 'رعاية الحيوانات الأليفة', category: 'Lifestyle', icon: 'paw' },
  { name: 'Testing', nameAr: 'اختبار', category: 'Lifestyle', icon: 'beaker' },
  { name: 'Coffee Culture', nameAr: 'ثقافة القهوة', category: 'Lifestyle', icon: 'coffee' },
];

/**
 * Main seed function
 */
async function main() {
  console.log('Starting database seed...');

  // Seed Sectors
  console.log('Seeding sectors...');
  for (const sector of sectors) {
    await prisma.sector.upsert({
      where: { id: sector.name.toLowerCase().replace(/\s+/g, '-') },
      update: sector,
      create: {
        id: sector.name.toLowerCase().replace(/\s+/g, '-'),
        ...sector,
      },
    });
  }
  console.log(`Seeded ${sectors.length} sectors`);

  // Seed Skills
  console.log('Seeding skills...');
  for (const skill of skills) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: skill,
      create: skill,
    });
  }
  console.log(`Seeded ${skills.length} skills`);

  // Seed Interests
  console.log('Seeding interests...');
  for (const interest of interests) {
    await prisma.interest.upsert({
      where: { name: interest.name },
      update: interest,
      create: interest,
    });
  }
  console.log(`Seeded ${interests.length} interests`);

  // Seed Hobbies
  console.log('Seeding hobbies...');
  for (const hobby of hobbies) {
    await prisma.hobby.upsert({
      where: { name: hobby.name },
      update: hobby,
      create: hobby,
    });
  }
  console.log(`Seeded ${hobbies.length} hobbies`);

  console.log('Database seed completed!');
}

// Execute seed
main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
