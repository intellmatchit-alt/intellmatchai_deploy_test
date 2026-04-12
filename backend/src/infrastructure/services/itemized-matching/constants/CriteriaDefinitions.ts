/**
 * Criteria Definitions
 *
 * Constants and metadata for all criterion types.
 *
 * @module infrastructure/services/itemized-matching/constants/CriteriaDefinitions
 */

import { CriterionImportance, ItemizedMatchType } from '../../../../domain/services/IItemizedMatchingService';

/**
 * Criterion definition metadata
 */
export interface CriterionDefinition {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  description: string;
  defaultImportance: CriterionImportance;
  applicableMatchTypes: ItemizedMatchType[];
  importanceOverrides?: Partial<Record<ItemizedMatchType, CriterionImportance>>;
}

/**
 * All profile-to-profile criteria
 */
export const PROFILE_CRITERIA: CriterionDefinition[] = [
  {
    id: 'industry',
    name: 'Industry/Sector',
    nameAr: 'القطاع/الصناعة',
    icon: '🏢',
    description: 'Shared industry or sector experience',
    defaultImportance: 'HIGH',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
      'PROJECT_TO_INVESTOR',
      'PROJECT_TO_PARTNER',
      'PROJECT_TO_DYNAMIC',
      'JOB_TO_CANDIDATE',
      'DEAL_TO_BUYER',
      'DEAL_TO_PROVIDER',
    ],
    importanceOverrides: {
      PROJECT_TO_INVESTOR: 'CRITICAL',
      PROJECT_TO_DYNAMIC: 'CRITICAL',
      JOB_TO_CANDIDATE: 'HIGH',
    },
  },
  {
    id: 'skills',
    name: 'Skills',
    nameAr: 'المهارات',
    icon: '🛠️',
    description: 'Matching professional skills',
    defaultImportance: 'HIGH',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
      'PROJECT_TO_TALENT',
      'JOB_TO_CANDIDATE',
    ],
    importanceOverrides: {
      JOB_TO_CANDIDATE: 'CRITICAL',
      PROJECT_TO_TALENT: 'CRITICAL',
    },
  },
  {
    id: 'goals',
    name: 'Goals Alignment',
    nameAr: 'توافق الأهداف',
    icon: '🎯',
    description: 'Complementary or matching networking goals',
    defaultImportance: 'HIGH',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
    ],
  },
  {
    id: 'education',
    name: 'Education',
    nameAr: 'التعليم',
    icon: '🎓',
    description: 'Shared educational background',
    defaultImportance: 'MEDIUM',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
      'JOB_TO_CANDIDATE',
    ],
  },
  {
    id: 'location',
    name: 'Location',
    nameAr: 'الموقع',
    icon: '📍',
    description: 'Geographic proximity',
    defaultImportance: 'MEDIUM',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
      'JOB_TO_CANDIDATE',
      'PROJECT_TO_INVESTOR',
      'PROJECT_TO_DYNAMIC',
    ],
    importanceOverrides: {
      PROJECT_TO_INVESTOR: 'MEDIUM',
      PROJECT_TO_DYNAMIC: 'MEDIUM',
    },
  },
  {
    id: 'company',
    name: 'Company',
    nameAr: 'الشركة',
    icon: '💼',
    description: 'Current or past company overlap',
    defaultImportance: 'MEDIUM',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
    ],
  },
  {
    id: 'experience',
    name: 'Experience Level',
    nameAr: 'مستوى الخبرة',
    icon: '📊',
    description: 'Seniority and experience alignment',
    defaultImportance: 'MEDIUM',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
      'JOB_TO_CANDIDATE',
      'PROJECT_TO_DYNAMIC',
    ],
    importanceOverrides: {
      JOB_TO_CANDIDATE: 'HIGH',
    },
  },
  {
    id: 'interests',
    name: 'Interests',
    nameAr: 'الاهتمامات',
    icon: '💡',
    description: 'Shared professional interests',
    defaultImportance: 'LOW',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
      'EVENT_ATTENDEE_MATCH',
    ],
  },
  {
    id: 'hobbies',
    name: 'Hobbies',
    nameAr: 'الهوايات',
    icon: '🎨',
    description: 'Shared personal hobbies',
    defaultImportance: 'LOW',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
      'EVENT_ATTENDEE_MATCH',
    ],
  },
  {
    id: 'network',
    name: 'Network Proximity',
    nameAr: 'القرب من الشبكة',
    icon: '🔗',
    description: 'Mutual connections and network distance',
    defaultImportance: 'MEDIUM',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
      'PROJECT_TO_DYNAMIC',
    ],
  },
  {
    id: 'languages',
    name: 'Languages',
    nameAr: 'اللغات',
    icon: '🗣️',
    description: 'Common languages spoken',
    defaultImportance: 'LOW',
    applicableMatchTypes: [
      'PROFILE_TO_PROFILE',
      'PROFILE_TO_USER',
      'EVENT_ATTENDEE_MATCH',
    ],
  },
];

/**
 * Item-to-contact criteria (Project, Job, Deal)
 */
export const ITEM_CRITERIA: CriterionDefinition[] = [
  {
    id: 'required_skills',
    name: 'Required Skills',
    nameAr: 'المهارات المطلوبة',
    icon: '🎯',
    description: 'Skills required for the opportunity',
    defaultImportance: 'CRITICAL',
    applicableMatchTypes: [
      'JOB_TO_CANDIDATE',
      'PROJECT_TO_TALENT',
    ],
  },
  {
    id: 'industry_experience',
    name: 'Industry Experience',
    nameAr: 'الخبرة في القطاع',
    icon: '🏭',
    description: 'Relevant industry experience',
    defaultImportance: 'HIGH',
    applicableMatchTypes: [
      'JOB_TO_CANDIDATE',
      'PROJECT_TO_INVESTOR',
      'PROJECT_TO_PARTNER',
      'DEAL_TO_BUYER',
      'DEAL_TO_PROVIDER',
    ],
  },
  {
    id: 'stage_fit',
    name: 'Stage Fit',
    nameAr: 'ملاءمة المرحلة',
    icon: '📈',
    description: 'Investment stage alignment',
    defaultImportance: 'CRITICAL',
    applicableMatchTypes: [
      'PROJECT_TO_INVESTOR',
      'PROJECT_TO_DYNAMIC',
    ],
  },
  {
    id: 'check_size',
    name: 'Check Size',
    nameAr: 'حجم الاستثمار',
    icon: '💰',
    description: 'Investment amount alignment',
    defaultImportance: 'CRITICAL',
    applicableMatchTypes: [
      'PROJECT_TO_INVESTOR',
      'PROJECT_TO_DYNAMIC',
    ],
  },
  {
    id: 'geography',
    name: 'Geography Focus',
    nameAr: 'التركيز الجغرافي',
    icon: '🌍',
    description: 'Geographic focus alignment',
    defaultImportance: 'MEDIUM',
    applicableMatchTypes: [
      'PROJECT_TO_INVESTOR',
      'PROJECT_TO_DYNAMIC',
      'DEAL_TO_BUYER',
      'DEAL_TO_PROVIDER',
    ],
  },
  {
    id: 'budget',
    name: 'Budget Alignment',
    nameAr: 'توافق الميزانية',
    icon: '💵',
    description: 'Budget/pricing alignment',
    defaultImportance: 'HIGH',
    applicableMatchTypes: [
      'DEAL_TO_BUYER',
      'DEAL_TO_PROVIDER',
    ],
  },
  {
    id: 'thesis_fit',
    name: 'Thesis Fit',
    nameAr: 'ملاءمة الأطروحة',
    icon: '📋',
    description: 'Investment thesis alignment',
    defaultImportance: 'HIGH',
    applicableMatchTypes: [
      'PROJECT_TO_INVESTOR',
      'PROJECT_TO_DYNAMIC',
    ],
  },
  {
    id: 'project_skills_fit',
    name: 'Skills Fit',
    nameAr: 'ملاءمة المهارات',
    icon: '🛠️',
    description: 'How well the contact\'s skills match the project\'s needs, weighted by importance',
    defaultImportance: 'CRITICAL',
    applicableMatchTypes: [
      'PROJECT_TO_TALENT',
      'PROJECT_TO_DYNAMIC',
    ],
  },
];

/**
 * Event-specific criteria
 */
export const EVENT_CRITERIA: CriterionDefinition[] = [
  {
    id: 'complementary_goals',
    name: 'Complementary Goals',
    nameAr: 'الأهداف المتكاملة',
    icon: '🤝',
    description: 'What one seeks matches what the other offers',
    defaultImportance: 'CRITICAL',
    applicableMatchTypes: [
      'EVENT_ATTENDEE_MATCH',
    ],
  },
  {
    id: 'shared_industry',
    name: 'Shared Industry',
    nameAr: 'القطاع المشترك',
    icon: '🏢',
    description: 'Common industry background',
    defaultImportance: 'HIGH',
    applicableMatchTypes: [
      'EVENT_ATTENDEE_MATCH',
    ],
  },
  {
    id: 'shared_skills',
    name: 'Shared Skills',
    nameAr: 'المهارات المشتركة',
    icon: '🛠️',
    description: 'Overlapping skill sets',
    defaultImportance: 'HIGH',
    applicableMatchTypes: [
      'EVENT_ATTENDEE_MATCH',
    ],
  },
  {
    id: 'shared_education',
    name: 'Shared Education',
    nameAr: 'التعليم المشترك',
    icon: '🎓',
    description: 'Common educational background',
    defaultImportance: 'MEDIUM',
    applicableMatchTypes: [
      'EVENT_ATTENDEE_MATCH',
    ],
  },
];

/**
 * All criteria combined
 */
export const ALL_CRITERIA = [
  ...PROFILE_CRITERIA,
  ...ITEM_CRITERIA,
  ...EVENT_CRITERIA,
];

/**
 * Get criterion definition by ID
 */
export function getCriterionById(id: string): CriterionDefinition | undefined {
  return ALL_CRITERIA.find(c => c.id === id);
}

/**
 * Get all criteria applicable to a match type
 */
export function getCriteriaForMatchType(matchType: ItemizedMatchType): CriterionDefinition[] {
  return ALL_CRITERIA.filter(c => c.applicableMatchTypes.includes(matchType));
}

/**
 * Get importance for a criterion and match type
 */
export function getCriterionImportance(
  criterionId: string,
  matchType: ItemizedMatchType
): CriterionImportance {
  const criterion = getCriterionById(criterionId);
  if (!criterion) return 'MEDIUM';

  return criterion.importanceOverrides?.[matchType] || criterion.defaultImportance;
}

/**
 * Skill synonyms for matching
 * Maps common variations to canonical form
 */
export const SKILL_SYNONYMS: Record<string, string[]> = {
  'javascript': ['js', 'ecmascript', 'es6', 'es2015'],
  'typescript': ['ts'],
  'python': ['py'],
  'react': ['reactjs', 'react.js'],
  'node': ['nodejs', 'node.js'],
  'machine learning': ['ml', 'ai/ml'],
  'artificial intelligence': ['ai', 'gen ai', 'generative ai'],
  'data science': ['data analytics', 'data analysis'],
  'product management': ['pm', 'product manager'],
  'project management': ['pmp', 'project manager'],
  'user experience': ['ux', 'ux design', 'ux/ui'],
  'user interface': ['ui', 'ui design', 'ui/ux'],
  'business development': ['bd', 'biz dev'],
  'sales': ['sales & marketing', 'revenue'],
  'marketing': ['digital marketing', 'growth marketing'],
  'devops': ['dev ops', 'sre', 'site reliability'],
  'cloud': ['aws', 'azure', 'gcp', 'cloud computing'],
  'database': ['sql', 'nosql', 'mysql', 'postgresql', 'mongodb'],
  'mobile': ['mobile development', 'ios', 'android', 'react native', 'flutter'],
  'frontend': ['front-end', 'front end', 'client-side'],
  'backend': ['back-end', 'back end', 'server-side'],
  'full stack': ['fullstack', 'full-stack'],
};

/**
 * Related industries for partial matching
 */
export const RELATED_INDUSTRIES: Record<string, string[]> = {
  'technology': ['software', 'saas', 'fintech', 'healthtech', 'edtech', 'ai/ml', 'cybersecurity'],
  'healthcare': ['healthtech', 'biotech', 'pharma', 'medical devices', 'digital health'],
  'finance': ['fintech', 'banking', 'insurance', 'investment', 'wealth management'],
  'education': ['edtech', 'e-learning', 'training', 'higher education'],
  'retail': ['e-commerce', 'consumer goods', 'fashion', 'food & beverage'],
  'media': ['entertainment', 'content', 'advertising', 'gaming', 'streaming'],
  'energy': ['cleantech', 'renewable energy', 'oil & gas', 'utilities'],
  'manufacturing': ['industrial', 'automotive', 'aerospace', 'construction'],
  'logistics': ['supply chain', 'transportation', 'shipping', 'warehousing'],
  'real estate': ['proptech', 'construction', 'property management'],
};

/**
 * Investment stages for project matching
 */
export const INVESTMENT_STAGES = [
  'pre-seed',
  'seed',
  'series a',
  'series b',
  'series c',
  'series d+',
  'growth',
  'late stage',
  'ipo',
] as const;

/**
 * Seniority levels for experience matching
 */
export const SENIORITY_LEVELS = [
  { level: 'ENTRY', labels: ['entry', 'junior', 'associate', 'analyst', 'intern'] },
  { level: 'MID', labels: ['mid', 'intermediate', 'specialist'] },
  { level: 'SENIOR', labels: ['senior', 'sr', 'lead', 'principal', 'staff'] },
  { level: 'LEAD', labels: ['lead', 'manager', 'team lead'] },
  { level: 'DIRECTOR', labels: ['director', 'head of', 'head'] },
  { level: 'VP', labels: ['vp', 'vice president', 'svp', 'evp'] },
  { level: 'C_LEVEL', labels: ['c-level', 'ceo', 'cto', 'cfo', 'coo', 'cmo', 'chief'] },
  { level: 'BOARD', labels: ['board', 'advisor', 'founder', 'co-founder', 'partner'] },
] as const;

export default {
  PROFILE_CRITERIA,
  ITEM_CRITERIA,
  EVENT_CRITERIA,
  ALL_CRITERIA,
  getCriterionById,
  getCriteriaForMatchType,
  getCriterionImportance,
  SKILL_SYNONYMS,
  RELATED_INDUSTRIES,
  INVESTMENT_STAGES,
  SENIORITY_LEVELS,
};
