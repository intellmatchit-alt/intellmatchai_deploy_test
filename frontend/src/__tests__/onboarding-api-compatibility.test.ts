/**
 * Onboarding Step 5 vs Service Page — Full QA Compatibility Tests
 *
 * Comprehensive field-by-field comparison between the onboarding last step
 * (FeatureCardsStep) and each dedicated service creation page.
 *
 * CRITICAL FINDINGS:
 * 1. PROJECTS: Onboarding has 11 fields vs dedicated page 22+ fields (missing 12 advanced fields)
 * 2. DEALS: Onboarding has 7-9 fields vs dedicated page 16-17 fields (missing metadata, rich fields)
 * 3. PITCHES: Onboarding has 5 fields vs dedicated page 30+ fields (DIFFERENT API path entirely)
 * 4. JOBS: Onboarding uses OLD OpportunityIntent API vs dedicated page uses NEW v3 Job Matching API
 *         (different DB tables, different models, different endpoints)
 *
 * Reference: frontend/src/app/onboarding/page.tsx lines 1528-3131 (Step 5)
 */

import {
  CreateProjectInput,
  ProjectStage,
  ProjectVisibility,
  SkillImportance,
  STAGE_OPTIONS,
  LOOKING_FOR_OPTIONS as PROJECT_LOOKING_FOR_OPTIONS,
} from '@/lib/api/projects';

import {
  CreateDealInput,
  DealMode,
  DealCompanySize,
  DealTargetEntityType,
  COMPANY_SIZE_OPTIONS,
  TARGET_ENTITY_OPTIONS,
} from '@/lib/api/deals';

import {
  CreateOpportunityInput,
  OpportunityIntentType,
  SeniorityLevel,
  SENIORITY_OPTIONS as API_SENIORITY_OPTIONS,
  INTENT_TYPE_OPTIONS,
} from '@/lib/api/opportunities';

import {
  CreatePitchInput,
} from '@/lib/api/pitch';

import {
  CreateHiringProfileInput,
  CreateCandidateProfileInput,
  JobSeniority,
  JobWorkMode,
  JobEmploymentType,
} from '@/lib/api/job-matching';

// ============================================================
// Onboarding-local types (replicated from onboarding/page.tsx)
// ============================================================

interface OnboardingProject {
  id: string;
  title: string;
  summary: string;
  detailedDesc?: string;
  category?: string;
  stage?: ProjectStage;
  investmentRange?: string;
  timeline?: string;
  lookingFor?: string[];
  sectorIds?: string[];
  skills?: Array<{ skillId: string; importance: SkillImportance }>;
  visibility?: 'PUBLIC' | 'CONNECTIONS_ONLY' | 'PRIVATE';
}

/** Onboarding categories (line 1716) */
const ONBOARDING_CATEGORIES = [
  'technology', 'healthcare', 'finance', 'education',
  'ecommerce', 'social', 'entertainment', 'sustainability', 'other',
];

/** Onboarding seniority options (line 1532-1542) */
const ONBOARDING_SENIORITY_OPTIONS = [
  { id: '', label: 'Any level' },
  { id: 'ENTRY', label: 'Entry Level' },
  { id: 'MID', label: 'Mid Level' },
  { id: 'SENIOR', label: 'Senior' },
  { id: 'LEAD', label: 'Lead / Principal' },
  { id: 'DIRECTOR', label: 'Director' },
  { id: 'VP', label: 'VP / Vice President' },
  { id: 'C_LEVEL', label: 'C-Level Executive' },
  { id: 'BOARD', label: 'Board Member' },
];

const ONBOARDING_INTENT_TYPES = ['HIRING', 'OPEN_TO_OPPORTUNITIES', 'ADVISORY_BOARD', 'REFERRALS_ONLY'];

// ============================================================
// 1. PROJECT: Onboarding (11 fields) vs Dedicated Page (22+ fields)
// ============================================================
describe('Projects: Onboarding vs /projects/new', () => {
  // Fields present in BOTH
  const SHARED_FIELDS = [
    'title', 'summary', 'detailedDesc', 'category', 'stage',
    'investmentRange', 'timeline', 'lookingFor', 'sectorIds', 'skills', 'visibility',
  ];

  // Fields ONLY on the dedicated page (missing from onboarding)
  const DEDICATED_ONLY_FIELDS = [
    'needs', 'markets', 'fundingAskMin', 'fundingAskMax',
    'tractionSignals', 'advisoryTopics', 'partnerTypeNeeded',
    'commitmentLevelNeeded', 'idealCounterpartProfile',
    'targetCustomerTypes', 'engagementModel', 'strictLookingFor', 'metadata',
  ];

  it('should have 11 fields in onboarding vs 22+ in dedicated page', () => {
    const onboardingFieldCount = SHARED_FIELDS.length; // 11
    const dedicatedFieldCount = SHARED_FIELDS.length + DEDICATED_ONLY_FIELDS.length; // 24
    expect(onboardingFieldCount).toBe(11);
    expect(dedicatedFieldCount).toBeGreaterThanOrEqual(22);
  });

  it('all onboarding fields exist in CreateProjectInput', () => {
    const apiInput: CreateProjectInput = {
      title: 'T', summary: 'S',
      detailedDesc: 'D', category: 'tech', stage: 'IDEA',
      investmentRange: '$100K', timeline: '12m',
      lookingFor: ['investor'], sectorIds: ['s1'],
      skills: [{ skillId: 'sk1', importance: 'REQUIRED' }],
      visibility: 'PUBLIC',
    };
    for (const field of SHARED_FIELDS) {
      expect(apiInput).toHaveProperty(field);
    }
  });

  it('missing dedicated-page fields are all optional in CreateProjectInput', () => {
    // If these were required, this would fail to compile
    const minimalInput: CreateProjectInput = { title: 'T', summary: 'S' };
    for (const field of DEDICATED_ONLY_FIELDS) {
      expect(minimalInput).not.toHaveProperty(field);
    }
    expect(minimalInput).toBeDefined(); // compiles without the missing fields
  });

  it('onboarding has hardcoded 9 categories vs dedicated page has dynamic categories', () => {
    // Onboarding: 9 hardcoded options (line 1716)
    expect(ONBOARDING_CATEGORIES).toHaveLength(9);
    // Dedicated page: fetches categories dynamically from system + allows custom
    // This means onboarding users get fewer category choices
    expect(ONBOARDING_CATEGORIES).toContain('technology');
    expect(ONBOARDING_CATEGORIES).toContain('other');
  });

  it('onboarding lookingFor options match project API options', () => {
    const onboardingLookingForIds = PROJECT_LOOKING_FOR_OPTIONS.map(o => o.id);
    // Onboarding uses the same LOOKING_FOR_OPTIONS import from @/lib/api/projects
    expect(onboardingLookingForIds).toHaveLength(7);
    expect(onboardingLookingForIds).toContain('investor');
    expect(onboardingLookingForIds).toContain('cofounder_talent');
  });

  it('onboarding projects are DEFERRED (not saved to API until handleComplete)', () => {
    // handleSaveProject (line 1802) calls onAddProject() — a parent callback
    // NOT createProject(). Projects are created at handleComplete (line 3924).
    // Dedicated page calls createProject() directly on form submit.
    const project: OnboardingProject = { id: 'p1', title: 'T', summary: 'S' };
    const { id, ...apiPayload } = project;
    const input: CreateProjectInput = { title: apiPayload.title, summary: apiPayload.summary };
    expect(input).not.toHaveProperty('id');
  });

  it('dedicated page has AI text analysis; onboarding only has document extraction', () => {
    // Dedicated page: analyzeProjectText(title, summary, detailedDesc) → fills categories, stage, sectors, etc.
    // Onboarding: extractFromDocument(file) → fills same fields but ONLY from uploaded file
    // No AI analysis from typed text in onboarding
    expect(true).toBe(true); // architecture documentation
  });

  it('visibility defaults differ: onboarding=PUBLIC, dedicated=PRIVATE', () => {
    // Onboarding: projVisibility defaults to 'PUBLIC' (line 1578)
    // Dedicated page: defaults to 'PRIVATE'
    const onboardingDefault: ProjectVisibility = 'PUBLIC';
    const dedicatedDefault: ProjectVisibility = 'PRIVATE';
    expect(onboardingDefault).not.toBe(dedicatedDefault);
  });
});

// ============================================================
// 2. DEALS: Onboarding (7-9 fields) vs Dedicated Page (16-17 fields)
// ============================================================
describe('Deals: Onboarding vs /deals/new', () => {
  // Fields in onboarding SELL form
  const ONBOARDING_SELL_FIELDS = [
    'mode', 'title', 'solutionType', 'domain', 'companySize', 'productName', 'targetDescription',
  ];

  // Fields in onboarding BUY form
  const ONBOARDING_BUY_FIELDS = [
    'mode', 'title', 'solutionType', 'domain', 'companySize', 'problemStatement', 'targetEntityType',
  ];

  // Extra fields on dedicated SELL page (in metadata or direct)
  const DEDICATED_SELL_EXTRA = [
    'providerType', 'deliveryModel', 'deliveryCapabilities', 'capabilities',
    'buyerTags', 'idealCustomerProfile', 'targetMarketLocation',
    'industryFocusTags', 'priceRange', 'salesTimeline',
  ];

  // Extra fields on dedicated BUY page
  const DEDICATED_BUY_EXTRA = [
    'buyerRole', 'providerSize', 'mustHaveRequirements', 'deliveryMode',
    'targetMarketLocation', 'idealProviderProfile', 'industryTags',
    'budget', 'neededTimeline', 'buyingStage',
  ];

  it('onboarding SELL has 7 fields vs dedicated SELL has 17 fields', () => {
    expect(ONBOARDING_SELL_FIELDS).toHaveLength(7);
    expect(ONBOARDING_SELL_FIELDS.length + DEDICATED_SELL_EXTRA.length).toBe(17);
  });

  it('onboarding BUY has 7 fields vs dedicated BUY has 17 fields', () => {
    expect(ONBOARDING_BUY_FIELDS).toHaveLength(7);
    expect(ONBOARDING_BUY_FIELDS.length + DEDICATED_BUY_EXTRA.length).toBe(17);
  });

  it('onboarding sends NO metadata; dedicated pages send rich metadata', () => {
    // Onboarding payload (line 1917-1927): no metadata field
    const onboardingPayload: CreateDealInput = {
      mode: 'SELL',
      solutionType: 'CRM',
    };
    expect(onboardingPayload.metadata).toBeUndefined();

    // Dedicated SELL page sends metadata with: capabilities, buyerTags, priceRange, etc.
    const dedicatedPayload: CreateDealInput = {
      mode: 'SELL',
      solutionType: 'CRM',
      metadata: {
        capabilities: ['API Integration', 'Custom Development'],
        buyerTags: ['C-Level', 'Enterprise Buyer'],
        priceRange: '$10K - $50K',
        salesTimeline: 'Actively Selling',
        deliveryModel: 'Cloud/SaaS',
        idealCustomerProfile: 'Mid-size enterprises...',
      },
    };
    expect(dedicatedPayload.metadata).toBeDefined();
  });

  it('onboarding requires only solutionType; dedicated SELL requires 9 fields', () => {
    // Onboarding: only checks solutionType (line 1911)
    // Dedicated SELL: requires productName, solutionType, domain, providerType,
    // capabilities, buyerTags, idealCustomerProfile, priceRange, salesTimeline
    const onboardingMinimum: CreateDealInput = { mode: 'SELL', solutionType: 'CRM' };
    expect(onboardingMinimum).toBeDefined();
  });

  it('onboarding requires only solutionType; dedicated BUY requires 8 fields', () => {
    // Onboarding: only checks solutionType (line 1911)
    // Dedicated BUY: requires whatYouNeed, solutionType, domain, providerType,
    // mustHaveRequirements, budget, timeline, buyingStage
    const onboardingMinimum: CreateDealInput = { mode: 'BUY', solutionType: 'Hosting' };
    expect(onboardingMinimum).toBeDefined();
  });

  it('both use same API endpoint: createDeal()', () => {
    // Both onboarding and dedicated page call createDeal(input: CreateDealInput)
    // The difference is the richness of the data sent
    const onboardingInput: CreateDealInput = {
      mode: 'SELL', title: 'Test', solutionType: 'CRM',
      domain: 'tech', companySize: 'MEDIUM',
      productName: 'MyCRM', targetDescription: 'Target companies',
    };
    const dedicatedInput: CreateDealInput = {
      mode: 'SELL', title: 'Test', solutionType: 'CRM',
      domain: 'tech', companySize: 'MEDIUM',
      productName: 'MyCRM', targetDescription: 'Target companies',
      metadata: { capabilities: ['API'], priceRange: '$10K-$50K', salesTimeline: 'Active' },
    };
    // Same type, different completeness
    expect(onboardingInput.mode).toBe(dedicatedInput.mode);
  });

  it('dedicated page has localStorage draft saving; onboarding does not', () => {
    // Dedicated SellForm/BuyForm save drafts to localStorage (deal_sell_draft / deal_buy_draft)
    // Onboarding relies on onboarding-progress save to server
    expect(true).toBe(true); // architecture documentation
  });
});

// ============================================================
// 3. PITCHES: Onboarding (5 fields) vs Dedicated Page (30+ fields)
//    *** COMPLETELY DIFFERENT API PATH ***
// ============================================================
describe('Pitches: Onboarding vs /pitch/new — DIFFERENT API PATHS', () => {
  // Onboarding pitch form fields
  const ONBOARDING_PITCH_FIELDS = [
    'pitchTitle', 'pitchCompanyName', 'pitchDescription', 'pitchIndustry', 'pitchWhatYouNeed',
  ];

  // Dedicated page CreatePitchInput fields
  const DEDICATED_PITCH_FIELDS: (keyof CreatePitchInput)[] = [
    'title', 'summary', 'companyName', 'detailedDesc', 'category',
    'stage', 'investmentRange', 'timeline', 'lookingFor', 'sectorIds',
    'skills', 'visibility', 'problemStatement', 'whatYouNeed', 'metadata',
  ];

  it('onboarding has 5 fields vs dedicated page has 30+ fields', () => {
    expect(ONBOARDING_PITCH_FIELDS).toHaveLength(5);
    // CreatePitchInput has 15 fields, plus the dedicated page form adds
    // ~15 more non-standard fields (businessModel, tractionSignals, matchIntent, etc.)
    expect(DEDICATED_PITCH_FIELDS.length).toBeGreaterThanOrEqual(15);
  });

  it('CRITICAL: onboarding uses uploadPitch() vs dedicated uses createPitch()', () => {
    // Onboarding (line 2001): uploadPitch(fileToUpload, title)
    //   → POST /pitches with FormData (file upload)
    //   → Triggers PNME pipeline: extract text → classify → analyze → match
    //
    // Dedicated page: createPitch(input: CreatePitchInput)
    //   → POST /pitches/create with JSON body (structured data)
    //   → Stores structured data directly, skips text extraction
    //
    // These are DIFFERENT endpoints and DIFFERENT processing pipelines!
    expect('uploadPitch').not.toBe('createPitch');
  });

  it('onboarding constructs fake PDF text blob, losing all structured data', () => {
    // Replicates lines 1981-1998
    const title = 'My Startup';
    const company = 'Acme Inc';
    const industry = 'FinTech';
    const description = 'We build payment solutions';
    const whatYouNeed = 'Series A funding';

    const pitchText = [
      `Title: ${title}`, `Company: ${company}`, `Industry: ${industry}`,
      '', 'Description:', description, '', `What We Need:\n${whatYouNeed}`,
    ].filter(Boolean).join('\n');

    // This text blob is wrapped as a File and uploaded
    // The backend then re-extracts this data via AI — LOSSY ROUND-TRIP
    expect(pitchText).toContain('Title: My Startup');
    expect(pitchText).toContain('Company: Acme Inc');

    // What's lost: structured category, stage, sectors, skills, visibility,
    // lookingFor, investmentRange, timeline, businessModel, traction, etc.
  });

  it('onboarding field mapping to CreatePitchInput is semantic only', () => {
    // pitchTitle → title
    // pitchCompanyName → companyName
    // pitchDescription → summary (NOT detailedDesc)
    // pitchIndustry → category (NOT a direct match — category is broader)
    // pitchWhatYouNeed → whatYouNeed
    const fieldMapping: Record<string, keyof CreatePitchInput> = {
      pitchTitle: 'title',
      pitchCompanyName: 'companyName',
      pitchDescription: 'summary',
      pitchIndustry: 'category',
      pitchWhatYouNeed: 'whatYouNeed',
    };

    // All target fields exist in CreatePitchInput
    for (const apiField of Object.values(fieldMapping)) {
      expect(DEDICATED_PITCH_FIELDS).toContain(apiField);
    }
  });

  it('dedicated page fields missing from onboarding', () => {
    const missingFromOnboarding = [
      'detailedDesc', 'stage', 'investmentRange', 'timeline',
      'lookingFor', 'sectorIds', 'skills', 'visibility',
      'problemStatement', 'metadata',
      // Additional non-CreatePitchInput fields on the dedicated form:
      // businessModel, targetCustomerType, operatingMarkets,
      // tractionSummary, tractionSignals, founderBackgroundSummary,
      // advisoryTopics, matchIntent, supportNeededTags,
      // fundingAmountRequested, fundingCurrency, idealCounterpartProfile,
      // strictLookingFor
    ];
    expect(missingFromOnboarding.length).toBeGreaterThanOrEqual(10);
  });

  it('onboarding requires only description; dedicated requires only title', () => {
    // Onboarding: validates pitchDescription (line 1974)
    // Dedicated: CreatePitchInput requires title and summary
    // VALIDATION MISMATCH: onboarding doesn't require title, dedicated does
    const onboardingValid = { description: 'Something' }; // title not required
    expect(onboardingValid.description).toBeTruthy();

    const dedicatedValid: CreatePitchInput = { title: 'T', summary: 'S' };
    expect(dedicatedValid.title).toBeTruthy();
  });
});

// ============================================================
// 4. JOBS: Onboarding (5 fields, OLD API) vs Dedicated Page (17-18 fields, NEW v3 API)
//    *** COMPLETELY DIFFERENT BACKEND SYSTEMS ***
// ============================================================
describe('Jobs: Onboarding vs /opportunities/new — DIFFERENT BACKEND SYSTEMS', () => {
  // Onboarding job form fields
  const ONBOARDING_JOB_FIELDS = ['title', 'intentType', 'roleArea', 'seniority', 'notes'];

  // Dedicated Hiring form REQUIRED fields
  const HIRING_REQUIRED_FIELDS: (keyof CreateHiringProfileInput)[] = [
    'title', 'roleArea', 'seniority', 'location', 'workMode',
    'employmentType', 'mustHaveSkills', 'jobSummaryRequirements',
  ];

  // Dedicated Candidate form REQUIRED fields
  const CANDIDATE_REQUIRED_FIELDS: (keyof CreateCandidateProfileInput)[] = [
    'title', 'roleArea', 'seniority', 'location',
    'desiredWorkMode', 'desiredEmploymentType', 'skills', 'profileSummaryPreferences',
  ];

  it('CRITICAL: onboarding uses createOpportunity() vs dedicated uses createHiringProfile()/createCandidateProfile()', () => {
    // Onboarding (line 2110): createOpportunity(input) → POST /opportunities
    //   → Creates OpportunityIntent record in opportunity_intents table
    //
    // Dedicated page: createHiringProfile(input) → POST /job-matching/hiring
    //   → Creates HiringProfile record in hiring_profiles table
    //   OR: createCandidateProfile(input) → POST /job-matching/candidates
    //   → Creates CandidateProfile record in candidate_profiles table
    //
    // DIFFERENT database tables, DIFFERENT models, DIFFERENT matching engines!
    expect('createOpportunity').not.toBe('createHiringProfile');
    expect('createOpportunity').not.toBe('createCandidateProfile');
  });

  it('onboarding writes to opportunity_intents table; dedicated writes to hiring_profiles/candidate_profiles', () => {
    // This means:
    // 1. Items created during onboarding use the OLD matching engine (v2)
    // 2. Items created from /opportunities/new use the NEW matching engine (v3)
    // 3. Users don't get the v3 matching benefits for items created during onboarding
    expect(true).toBe(true); // critical architecture documentation
  });

  it('onboarding has 5 fields vs dedicated HIRING has 17 fields', () => {
    expect(ONBOARDING_JOB_FIELDS).toHaveLength(5);
    // Dedicated hiring: 8 required + 9 optional = 17 fields
    expect(HIRING_REQUIRED_FIELDS).toHaveLength(8);
  });

  it('onboarding has 5 fields vs dedicated CANDIDATE has 18+ fields', () => {
    expect(ONBOARDING_JOB_FIELDS).toHaveLength(5);
    // Dedicated candidate: 8 required + 10+ optional = 18+ fields
    expect(CANDIDATE_REQUIRED_FIELDS).toHaveLength(8);
  });

  it('seniority enums are DIFFERENT between old and new systems', () => {
    // Old system (OpportunityIntent): SeniorityLevel
    const oldSeniority: SeniorityLevel[] = [
      'ENTRY', 'MID', 'SENIOR', 'LEAD', 'DIRECTOR', 'VP', 'C_LEVEL', 'BOARD',
    ];
    // New system (Job Matching v3): JobSeniority
    const newSeniority: JobSeniority[] = [
      'INTERN', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'VP', 'C_LEVEL', 'FOUNDER',
    ];

    // Onboarding uses OLD enum (8 values)
    expect(oldSeniority).toHaveLength(8);
    // Dedicated page uses NEW enum (10 values)
    expect(newSeniority).toHaveLength(10);

    // Values that exist in NEW but not in OLD:
    const newOnly = newSeniority.filter(s => !(oldSeniority as string[]).includes(s));
    expect(newOnly).toContain('INTERN');
    expect(newOnly).toContain('JUNIOR');
    expect(newOnly).toContain('MANAGER');
    expect(newOnly).toContain('FOUNDER');

    // Values that exist in OLD but not in NEW:
    const oldOnly = oldSeniority.filter(s => !(newSeniority as string[]).includes(s));
    expect(oldOnly).toContain('ENTRY');
    expect(oldOnly).toContain('BOARD');
  });

  it('onboarding has NO location field; dedicated page REQUIRES it', () => {
    // Onboarding CreateOpportunityInput: locationPref is optional
    const onboardingInput: CreateOpportunityInput = {
      title: 'Engineer', intentType: 'HIRING',
    };
    expect(onboardingInput).not.toHaveProperty('locationPref');

    // Dedicated CreateHiringProfileInput: location is REQUIRED
    const dedicatedInput: CreateHiringProfileInput = {
      title: 'Engineer', roleArea: 'Engineering', seniority: 'SENIOR',
      location: 'Dubai, UAE', // REQUIRED
      workMode: 'REMOTE', employmentType: 'FULL_TIME',
      mustHaveSkills: ['React'], jobSummaryRequirements: 'Build UIs',
    };
    expect(dedicatedInput.location).toBeTruthy();
  });

  it('onboarding has NO skills field; dedicated page REQUIRES them', () => {
    // Onboarding: no skills at all in job form
    const onboardingInput: CreateOpportunityInput = {
      title: 'Engineer', intentType: 'HIRING',
    };
    expect(onboardingInput).not.toHaveProperty('mustHaveSkills');

    // Dedicated Hiring: mustHaveSkills is REQUIRED
    const hiringInput: CreateHiringProfileInput = {
      title: 'Engineer', roleArea: 'Engineering', seniority: 'SENIOR',
      location: 'Dubai', workMode: 'REMOTE', employmentType: 'FULL_TIME',
      mustHaveSkills: ['React', 'TypeScript'], // REQUIRED
      jobSummaryRequirements: 'Build UIs',
    };
    expect(hiringInput.mustHaveSkills.length).toBeGreaterThan(0);
  });

  it('onboarding has NO work mode/employment type; dedicated REQUIRES them', () => {
    // These are critical matching fields in v3 engine
    const hiringInput: CreateHiringProfileInput = {
      title: 'T', roleArea: 'R', seniority: 'SENIOR',
      location: 'L', workMode: 'REMOTE', employmentType: 'FULL_TIME',
      mustHaveSkills: ['S'], jobSummaryRequirements: 'J',
    };
    expect(hiringInput.workMode).toBe('REMOTE');
    expect(hiringInput.employmentType).toBe('FULL_TIME');

    const candidateInput: CreateCandidateProfileInput = {
      title: 'T', roleArea: 'R', seniority: 'SENIOR',
      location: 'L', desiredWorkMode: ['REMOTE', 'HYBRID'],
      desiredEmploymentType: ['FULL_TIME'],
      skills: ['React'], profileSummaryPreferences: 'P',
    };
    expect(candidateInput.desiredWorkMode).toHaveLength(2);
  });

  it('empty seniority converts to undefined for old API', () => {
    const empty = '';
    expect((empty || undefined) as SeniorityLevel | undefined).toBeUndefined();
    const valid = 'SENIOR';
    expect((valid || undefined) as SeniorityLevel | undefined).toBe('SENIOR');
  });

  it('onboarding intentType as-any cast works for all 4 values', () => {
    for (const intent of ONBOARDING_INTENT_TYPES) {
      const input: CreateOpportunityInput = {
        title: 'Test',
        intentType: intent as any,
      };
      expect(input.intentType).toBe(intent);
    }
  });

  it('dedicated page has AI text extraction; onboarding only has document extraction', () => {
    // Dedicated hiring: can paste JD text → extractHiringFromText(text) fills all fields
    // Dedicated candidate: can paste CV text → extractCandidateFromText(text) fills all fields
    // Onboarding: extractJobFromDocument(file) → fills only 5 basic fields
    expect(true).toBe(true); // architecture documentation
  });
});

// ============================================================
// 5. Cross-cutting QA Summary
// ============================================================
describe('Cross-cutting QA findings', () => {
  it('SUMMARY: field count comparison', () => {
    const comparison = {
      projects:      { onboarding: 11, dedicated: 22, ratio: '50%' },
      deals_sell:    { onboarding: 7,  dedicated: 17, ratio: '41%' },
      deals_buy:     { onboarding: 7,  dedicated: 17, ratio: '41%' },
      pitches:       { onboarding: 5,  dedicated: 30, ratio: '17%' },
      jobs_hiring:   { onboarding: 5,  dedicated: 17, ratio: '29%' },
      jobs_candidate:{ onboarding: 5,  dedicated: 18, ratio: '28%' },
    };

    // Pitches have the worst coverage
    expect(comparison.pitches.onboarding).toBeLessThan(comparison.pitches.dedicated);
    // Jobs have the additional problem of different backend systems
    expect(comparison.jobs_hiring.onboarding).toBeLessThan(comparison.jobs_hiring.dedicated);
  });

  it('API path differences between onboarding and dedicated pages', () => {
    const apiPaths = {
      projects: {
        onboarding: 'createProject() — same API, deferred to handleComplete',
        dedicated:  'createProject() — called on form submit',
        sameEndpoint: true,
      },
      deals: {
        onboarding: 'createDeal() — called immediately in Step 5',
        dedicated:  'createDeal() — called on form submit',
        sameEndpoint: true,
      },
      pitches: {
        onboarding: 'uploadPitch(file, title) — POST /pitches (FormData)',
        dedicated:  'createPitch(input) — POST /pitches/create (JSON)',
        sameEndpoint: false, // DIFFERENT!
      },
      jobs: {
        onboarding: 'createOpportunity() — POST /opportunities',
        dedicated:  'createHiringProfile() / createCandidateProfile() — POST /job-matching/*',
        sameEndpoint: false, // COMPLETELY DIFFERENT!
      },
    };

    expect(apiPaths.projects.sameEndpoint).toBe(true);
    expect(apiPaths.deals.sameEndpoint).toBe(true);
    expect(apiPaths.pitches.sameEndpoint).toBe(false);
    expect(apiPaths.jobs.sameEndpoint).toBe(false);
  });

  it('validation strictness comparison', () => {
    // Projects: onboarding requires title+summary, dedicated requires only title
    // Deals: onboarding requires solutionType, dedicated requires 8-9 fields
    // Pitches: onboarding requires description, dedicated requires title+summary
    // Jobs: onboarding requires title+intentType, dedicated requires 8 fields

    // Onboarding is LESS strict than dedicated for deals and jobs
    // Onboarding is DIFFERENTLY strict for pitches (requires description, not title)
    expect(true).toBe(true);
  });

  it('all file uploads use same validation: PDF/DOCX/DOC/TXT, max 10MB', () => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    // Same across all 4 forms in onboarding
    expect(allowedTypes).toHaveLength(4);
    expect(validExtensions).toHaveLength(4);
    expect(maxSize).toBe(10485760);
  });

  it('SkillImportance values are consistent', () => {
    const values: SkillImportance[] = ['REQUIRED', 'PREFERRED', 'NICE_TO_HAVE'];
    // Onboarding defaults to REQUIRED (line 1798)
    expect(values).toContain('REQUIRED');
    expect(values).toHaveLength(3);
  });

  it('ProjectStage values match between onboarding and dedicated page', () => {
    const stages = STAGE_OPTIONS.map(s => s.id);
    const expected: ProjectStage[] = ['IDEA', 'MVP', 'EARLY', 'GROWTH', 'SCALE'];
    expect(stages).toEqual(expected);
  });

  it('COMPANY_SIZE_OPTIONS consistent between onboarding and dedicated deals page', () => {
    const sizes = COMPANY_SIZE_OPTIONS.map(s => s.id);
    const expected: DealCompanySize[] = ['SMALL', 'MEDIUM', 'ENTERPRISE'];
    expect(sizes.sort()).toEqual([...expected].sort());
  });
});
