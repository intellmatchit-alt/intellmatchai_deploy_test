/**
 * Opportunity V3 Bridge
 *
 * Converts old OpportunityIntent + Contact data to v3 HiringProfile + CandidateProfile,
 * runs the v3 matching engine, and saves results back as OpportunityMatch records.
 */

import { PrismaClient } from '@prisma/client';
import {
  JobMatchingService,
  createJobMatchingService,
  HiringProfile,
  CandidateProfile,
  Seniority,
  WorkMode,
  EmploymentType,
  HiringUrgency,
  FindJobMatchesRequest,
  JobMatchResult,
  DEFAULT_JOB_CONFIG,
} from '../v3';
import { logger } from '../../../../shared/logger';

// Map old seniority enum to v3
const SENIORITY_MAP: Record<string, Seniority> = {
  ENTRY: Seniority.JUNIOR,
  MID: Seniority.MID,
  SENIOR: Seniority.SENIOR,
  LEAD: Seniority.LEAD,
  DIRECTOR: Seniority.DIRECTOR,
  VP: Seniority.VP,
  C_LEVEL: Seniority.C_LEVEL,
  BOARD: Seniority.FOUNDER,
};

// Infer seniority from job title
function inferSeniority(jobTitle: string | null): Seniority {
  if (!jobTitle) return Seniority.MID;
  const t = jobTitle.toLowerCase();
  if (t.includes('intern') || t.includes('trainee')) return Seniority.INTERN;
  if (t.includes('junior') || t.includes('jr') || t.includes('entry')) return Seniority.JUNIOR;
  if (t.includes('senior') || t.includes('sr.') || t.includes('principal')) return Seniority.SENIOR;
  if (t.includes('lead') || t.includes('team lead')) return Seniority.LEAD;
  if (t.includes('manager') || t.includes('head of')) return Seniority.MANAGER;
  if (t.includes('director') || t.includes('dean')) return Seniority.DIRECTOR;
  if (t.includes('vp') || t.includes('vice president')) return Seniority.VP;
  if (t.includes('ceo') || t.includes('cto') || t.includes('cfo') || t.includes('coo') || t.includes('chief')) return Seniority.C_LEVEL;
  if (t.includes('founder') || t.includes('co-founder') || t.includes('owner')) return Seniority.FOUNDER;
  return Seniority.MID;
}

// Infer roleArea from job title
function inferRoleArea(jobTitle: string | null): string {
  if (!jobTitle) return '';
  const t = jobTitle.toLowerCase();
  if (t.includes('engineer') || t.includes('developer') || t.includes('programmer')) return 'Engineering';
  if (t.includes('finance') || t.includes('financial') || t.includes('cfo') || t.includes('accountant') || t.includes('controller')) return 'Finance';
  if (t.includes('market') || t.includes('brand') || t.includes('growth')) return 'Marketing';
  if (t.includes('sales') || t.includes('business development') || t.includes('account')) return 'Sales';
  if (t.includes('design') || t.includes('ux') || t.includes('ui') || t.includes('creative')) return 'Design';
  if (t.includes('data') || t.includes('analyst') || t.includes('analytics')) return 'Data';
  if (t.includes('product') || t.includes('pm')) return 'Product';
  if (t.includes('operations') || t.includes('ops') || t.includes('logistics')) return 'Operations';
  if (t.includes('hr') || t.includes('human resource') || t.includes('people') || t.includes('talent')) return 'HR';
  if (t.includes('legal') || t.includes('compliance') || t.includes('counsel')) return 'Legal';
  if (t.includes('health') || t.includes('medical') || t.includes('clinical') || t.includes('nurse') || t.includes('doctor')) return 'Healthcare';
  if (t.includes('education') || t.includes('professor') || t.includes('teacher') || t.includes('dean') || t.includes('academic')) return 'Education';
  if (t.includes('invest') || t.includes('portfolio') || t.includes('fund')) return 'Investment';
  if (t.includes('consult') || t.includes('advisory') || t.includes('strateg')) return 'Consulting';
  return '';
}

// Map data confidence to quality score
function dataConfidenceToScore(confidence: string | null): number {
  switch (confidence) {
    case 'HIGH': return 80;
    case 'MEDIUM': return 50;
    case 'LOW': return 30;
    default: return 30;
  }
}

/**
 * Convert an OpportunityIntent to a v3 HiringProfile stored in-memory (not in DB).
 */
function intentToHiringProfile(intent: any): HiringProfile {
  const seniority = SENIORITY_MAP[intent.seniority] || Seniority.MID;
  const workMode = intent.remoteOk ? WorkMode.REMOTE : WorkMode.ONSITE;

  return {
    id: intent.id,
    userId: intent.userId,
    organizationId: intent.organizationId || undefined,
    title: intent.title || '',
    roleArea: intent.roleArea || '',
    seniority,
    location: intent.locationPref || '',
    workMode,
    employmentType: EmploymentType.FULL_TIME,
    mustHaveSkills: (intent.skillPrefs || [])
      .filter((sp: any) => sp.isRequired)
      .map((sp: any) => sp.skill?.name || sp.skillName || ''),
    preferredSkills: (intent.skillPrefs || [])
      .filter((sp: any) => !sp.isRequired)
      .map((sp: any) => sp.skill?.name || sp.skillName || ''),
    jobSummaryRequirements: intent.notes || intent.title || '',
    minimumYearsExperience: intent.minExperienceYears || undefined,
    hiringUrgency: HiringUrgency.NORMAL,
    industries: (intent.sectorPrefs || []).map((sp: any) => sp.sector?.name || ''),
    requiredLanguages: [],
    requiredCertifications: [],
    requiredEducationLevels: [],
    salaryRange: undefined,
    tags: [],
    embedding: [],
    dataQualityScore: 60,
    excludedCandidates: [],
    createdAt: intent.createdAt || new Date(),
    updatedAt: intent.updatedAt || new Date(),
  };
}

/**
 * Convert a Contact (with relations) to a v3 CandidateProfile.
 */
function contactToCandidateProfile(contact: any): CandidateProfile {
  const skills = (contact.contactSkills || []).map((cs: any) => cs.skill?.name || '').filter(Boolean);
  const industries = (contact.contactSectors || []).map((cs: any) => cs.sector?.name || '').filter(Boolean);

  return {
    id: contact.id,
    userId: contact.ownerId,
    fullName: contact.fullName || '',
    title: contact.jobTitle || '',
    roleArea: inferRoleArea(contact.jobTitle),
    seniority: inferSeniority(contact.jobTitle),
    location: contact.location || '',
    desiredWorkMode: [WorkMode.REMOTE, WorkMode.HYBRID, WorkMode.ONSITE], // Open to all
    desiredEmploymentType: [EmploymentType.FULL_TIME, EmploymentType.CONTRACT],
    skills,
    profileSummaryPreferences: contact.bio || contact.notes || '',
    yearsOfExperience: undefined,
    availability: undefined,
    languages: [],
    certifications: [],
    industries,
    education: [],
    expectedSalary: undefined,
    noticePeriod: undefined,
    relevantExperience: [],
    tags: [],
    embedding: [],
    dataQualityScore: dataConfidenceToScore(contact.dataConfidence),
    optedOut: false,
    blocked: false,
    createdAt: contact.createdAt || new Date(),
    updatedAt: contact.updatedAt || new Date(),
  };
}

/**
 * Convert an OPEN_TO_OPPORTUNITIES intent to a v3 CandidateProfile.
 * The user IS the candidate — their skills, experience, what they're looking for.
 */
function intentToCandidateProfile(intent: any): CandidateProfile {
  const seniority = SENIORITY_MAP[intent.seniority] || Seniority.MID;
  const skills = (intent.skillPrefs || [])
    .map((sp: any) => sp.skill?.name || sp.skillName || '')
    .filter(Boolean);
  const industries = (intent.sectorPrefs || []).map((sp: any) => sp.sector?.name || '').filter(Boolean);

  return {
    id: intent.id,
    userId: intent.userId,
    fullName: intent.title || '',
    title: intent.title || '',
    roleArea: intent.roleArea || '',
    seniority,
    location: intent.locationPref || '',
    desiredWorkMode: intent.remoteOk
      ? [WorkMode.REMOTE, WorkMode.HYBRID, WorkMode.ONSITE]
      : [WorkMode.ONSITE, WorkMode.HYBRID],
    desiredEmploymentType: [EmploymentType.FULL_TIME, EmploymentType.CONTRACT],
    skills,
    profileSummaryPreferences: intent.notes || intent.title || '',
    yearsOfExperience: intent.minExperienceYears || undefined,
    availability: undefined,
    languages: [],
    certifications: [],
    industries,
    education: [],
    expectedSalary: undefined,
    noticePeriod: undefined,
    relevantExperience: [],
    tags: [],
    embedding: [],
    dataQualityScore: 70,
    optedOut: false,
    blocked: false,
    createdAt: intent.createdAt || new Date(),
    updatedAt: intent.updatedAt || new Date(),
  };
}

/**
 * Convert a Contact to a v3 HiringProfile (for OPEN_TO_OPPORTUNITIES matching).
 * The contact represents a potential employer/connection — their field is the "job".
 */
function contactToHiringProfile(contact: any): HiringProfile {
  const skills = (contact.contactSkills || []).map((cs: any) => cs.skill?.name || '').filter(Boolean);
  const industries = (contact.contactSectors || []).map((cs: any) => cs.sector?.name || '').filter(Boolean);
  const company = contact.company || '';
  const title = contact.jobTitle
    ? `${contact.jobTitle}${company ? ' at ' + company : ''}`
    : company || 'Unknown Role';

  return {
    id: contact.id,
    userId: contact.ownerId,
    fullName: contact.fullName || '',
    title,
    roleArea: inferRoleArea(contact.jobTitle),
    seniority: inferSeniority(contact.jobTitle),
    location: contact.location || '',
    workMode: WorkMode.REMOTE,
    employmentType: EmploymentType.FULL_TIME,
    mustHaveSkills: skills,
    preferredSkills: [],
    jobSummaryRequirements: contact.bio || contact.notes || title,
    minimumYearsExperience: undefined,
    hiringUrgency: HiringUrgency.NORMAL,
    industries,
    requiredLanguages: [],
    requiredCertifications: [],
    requiredEducationLevels: [],
    salaryRange: undefined,
    tags: [],
    embedding: [],
    dataQualityScore: dataConfidenceToScore(contact.dataConfidence),
    excludedCandidates: [],
    createdAt: contact.createdAt || new Date(),
    updatedAt: contact.updatedAt || new Date(),
  };
}

/**
 * Generate perspective-correct ice breaker based on intent type.
 */
function generateIceBreaker(intentType: string, job: HiringProfile, candidate: any): string {
  const firstName = (candidate.fullName || candidate.title || '').split(' ')[0] || 'there';
  const company = candidate.company || '';
  const roleArea = job.roleArea || 'your field';
  const contactTitle = candidate.jobTitle || candidate.title || '';

  switch (intentType) {
    case 'OPEN_TO_OPPORTUNITIES':
      if (company) {
        return `Hi ${firstName}, I'm currently exploring new ${roleArea} opportunities. I noticed you're ${contactTitle ? contactTitle + ' at ' : 'working at '}${company} — I'd love to connect and learn about any openings on your team or in your network. Would you be open to a quick chat?`;
      }
      return `Hi ${firstName}, I'm currently exploring new ${roleArea} opportunities and your background caught my eye. I'd love to connect and hear about any relevant openings in your network. Would you be open to a brief conversation?`;
    case 'HIRING':
      return `Hi ${firstName}, we have an opening for a ${job.title} and your background${contactTitle ? ' as a ' + contactTitle : ''} looks like a strong fit. Would you be interested in learning more about this role?`;
    case 'ADVISORY_BOARD':
      return `Hi ${firstName}, I'm building an advisory board and your expertise${contactTitle ? ' as ' + contactTitle : ''}${company ? ' at ' + company : ''} would be incredibly valuable. Would you be open to discussing a potential advisory role?`;
    case 'REFERRALS_ONLY':
      return `Hi ${firstName}, I'm expanding my professional network in ${roleArea}. Given your experience${company ? ' at ' + company : ''}, I'd love to connect and explore potential synergies.`;
    default:
      return `Hi ${firstName}, I came across your profile and think we could have great synergy. Would you be open to connecting?`;
  }
}

/**
 * Generate perspective-correct next steps based on intent type.
 */
function generateNextSteps(intentType: string, candidate: any): string[] {
  const company = candidate.company || '';
  const firstName = (candidate.fullName || '').split(' ')[0] || 'them';
  const contactTitle = candidate.jobTitle || '';

  switch (intentType) {
    case 'OPEN_TO_OPPORTUNITIES':
      return [
        company ? `Check ${company}'s careers page for open roles` : 'Research their company for open positions',
        `Connect with ${firstName} on LinkedIn with a personalized note`,
        `Ask ${firstName} about opportunities in their team or network`,
      ];
    case 'HIRING':
      return [
        `Review ${firstName}'s full profile and experience`,
        contactTitle ? `Assess fit: ${contactTitle} → your open role` : 'Assess their fit for the role',
        `Schedule a 20-minute intro call with ${firstName}`,
      ];
    case 'ADVISORY_BOARD':
      return [
        `Review ${firstName}'s background and domain expertise`,
        `Prepare your advisory board pitch and time commitment`,
        `Schedule a discovery call with ${firstName}`,
      ];
    default:
      return [
        `Send ${firstName} a connection request`,
        `Find common professional ground`,
        `Explore collaboration opportunities`,
      ];
  }
}

/**
 * Generate context-aware explanation prefix based on intent type.
 */
function getExplanationContext(intentType: string, job: HiringProfile, candidate: any): string {
  const contactTitle = candidate.jobTitle || candidate.title || '';
  const company = candidate.company || '';
  const contactDesc = contactTitle && company
    ? `${candidate.fullName || 'This contact'} is a ${contactTitle} at ${company}`
    : contactTitle
      ? `${candidate.fullName || 'This contact'} is a ${contactTitle}`
      : company
        ? `${candidate.fullName || 'This contact'} works at ${company}`
        : `${candidate.fullName || 'This contact'}`;

  switch (intentType) {
    case 'OPEN_TO_OPPORTUNITIES':
      return `You're a ${job.roleArea || ''} professional seeking new opportunities. ${contactDesc} and could be a valuable connection for your job search.`;
    case 'HIRING':
      return `You're hiring a ${job.title}. ${contactDesc}.`;
    case 'ADVISORY_BOARD':
      return `You're looking for advisors for ${job.title}. ${contactDesc}.`;
    default:
      return `${contactDesc}.`;
  }
}

/**
 * Generate intent-aware alignment note.
 */
function getIntentAlignment(intentType: string, candidate: any): string {
  const roleArea = inferRoleArea(candidate.jobTitle);
  const company = candidate.company || '';
  const contactTitle = candidate.jobTitle || '';

  switch (intentType) {
    case 'OPEN_TO_OPPORTUNITIES': {
      const parts: string[] = [];
      if (contactTitle && company) parts.push(`${contactTitle} at ${company}`);
      else if (company) parts.push(`Works at ${company}`);
      else if (contactTitle) parts.push(contactTitle);
      if (roleArea) parts.push(`${roleArea} field`);
      return parts.length > 0
        ? `${parts.join(' — ')}. Could help with your job search through their network and industry connections.`
        : 'Could be a useful professional connection for your job search.';
    }
    case 'HIRING':
      return contactTitle
        ? `Currently ${contactTitle}${company ? ' at ' + company : ''}. Their skills and experience align with your ${candidate.roleArea || 'open'} role.`
        : 'Skills and experience align with your opening.';
    case 'ADVISORY_BOARD':
      return `Has relevant expertise${company ? ' from ' + company : ''} for an advisory role.`;
    default:
      return 'Professional connection with potential synergy.';
  }
}

/**
 * Run v3 matching for an OpportunityIntent using the user's contacts as candidates.
 * Saves results as OpportunityMatch records.
 */
export async function runV3MatchingForOpportunity(
  prismaClient: PrismaClient,
  userId: string,
  intentId: string,
  organizationId?: string,
): Promise<{ matchCount: number; matches: any[] }> {
  // 1. Load the intent with preferences
  const intent = await prismaClient.opportunityIntent.findUnique({
    where: { id: intentId },
    include: {
      skillPrefs: { include: { skill: true } },
      sectorPrefs: { include: { sector: true } },
    },
  });

  if (!intent) throw new Error('Opportunity intent not found');

  // 2. Load contacts
  const contactWhere: any = {
    OR: [
      { ownerId: userId },
      ...(organizationId ? [{ organizationId }] : []),
    ],
  };

  const contacts = await prismaClient.contact.findMany({
    where: contactWhere,
    include: {
      contactSkills: { include: { skill: true } },
      contactSectors: { include: { sector: true } },
    },
    take: 200,
    orderBy: { updatedAt: 'desc' },
  });

  if (contacts.length === 0) {
    logger.warn('No candidates for v3 matching', { userId, intentId });
    return { matchCount: 0, matches: [] };
  }

  // 3. Branch on intent type: HIRING vs OPEN_TO_OPPORTUNITIES
  //
  // HIRING: User is the employer. Intent → HiringProfile, Contacts → CandidateProfiles.
  //   Scores: "Does this contact fit my job?"
  //
  // OPEN_TO_OPPORTUNITIES: User is the job seeker. Intent → CandidateProfile, Contacts → HiringProfiles.
  //   Scores: "Does my background match this contact's field?"
  //   Each contact is treated as a potential employer/connection in their domain.

  const isOpenToOpportunities = intent.intentType === 'OPEN_TO_OPPORTUNITIES';

  // For HIRING: intent = job, contacts = candidates
  // For OPEN_TO_OPP: intent = candidate (user), contacts = jobs (potential employers)
  const hiringProfile = intentToHiringProfile(intent); // always needed for ice breakers etc.

  let jobProfiles: HiringProfile[];
  let candidateProfiles: CandidateProfile[];
  let scoringPairs: Array<{ contactId: string; job: HiringProfile; candidate: CandidateProfile; contact: any }>;

  if (isOpenToOpportunities) {
    // User is the candidate, contacts are potential employers
    const userAsCandidate = intentToCandidateProfile(intent);
    jobProfiles = contacts.map(contactToHiringProfile);
    candidateProfiles = [userAsCandidate];
    scoringPairs = contacts.map((contact, i) => ({
      contactId: contact.id,
      job: jobProfiles[i],         // contact as "job"
      candidate: userAsCandidate,   // user as "candidate"
      contact,
    }));
  } else {
    // User is the employer, contacts are candidates
    candidateProfiles = contacts.map(contactToCandidateProfile);
    jobProfiles = [hiringProfile];
    scoringPairs = contacts.map((contact, i) => ({
      contactId: contact.id,
      job: hiringProfile,           // user's job
      candidate: candidateProfiles[i], // contact as candidate
      contact,
    }));
  }

  // 4. Config: relaxed thresholds for contact-based matching
  const config = {
    ...DEFAULT_JOB_CONFIG,
    thresholds: {
      ...DEFAULT_JOB_CONFIG.thresholds,
      minDeterministicScore: 15,
      minPostAIScore: 10,
      sparseRecordThreshold: 15,
    },
    features: {
      ...DEFAULT_JOB_CONFIG.features,
      enableHardFilters: false, // contacts are sparse, let scoring handle filtering
    },
  };
  const {
    runJobHardFilters,
    calculateJobDeterministicScore,
    computeSkillOverlap,
    extractKeyReasons,
  } = require('../v3/job-scoring.utils');
  const {
    applyGating,
    applyBoundedAIAdjustment,
    buildExplanation,
    normalizeTag,
    areSectorsRelated,
  } = require('../v3/matching-bands.constants');
  const { HardFilterStatus, MatchLevel } = require('../v3/job-matching.types');

  // 5. Score all pairs using v3 logic
  const scored: any[] = [];
  for (const pair of scoringPairs) {
    const hardFilter = runJobHardFilters(pair.job, pair.candidate, config);
    const breakdown = calculateJobDeterministicScore(pair.job, pair.candidate, config);
    const isSparse = (isOpenToOpportunities ? pair.job.dataQualityScore : pair.candidate.dataQualityScore) < config.thresholds.sparseRecordThreshold;
    const { level, capped, reason } = applyGating(
      breakdown.normalizedScore,
      breakdown.confidence,
      hardFilter.status,
      isSparse,
      config.confidenceGates,
    );

    scored.push({
      pair,
      hardFilter,
      breakdown,
      deterministicScore: breakdown.normalizedScore,
      finalScore: breakdown.normalizedScore,
      confidence: breakdown.confidence,
      matchLevel: level,
      cappedReason: reason,
      isSparse,
    });
  }

  // 7. Filter: remove FAIL, apply threshold
  const eligible = scored.filter(s => s.hardFilter.status !== HardFilterStatus.FAIL);
  const threshold = config.thresholds.minDeterministicScore;
  const passed = eligible
    .filter(s => s.finalScore >= threshold)
    .sort((a: any, b: any) => b.finalScore - a.finalScore);

  logger.info('V3 bridge matching results', {
    intentId,
    totalCandidates: scoringPairs.length,
    hardFilterFailed: scored.filter(s => s.hardFilter.status === HardFilterStatus.FAIL).length,
    eligible: eligible.length,
    passed: passed.length,
  });

  // 8. Delete old matches and save new ones
  await prismaClient.opportunityMatch.deleteMany({ where: { intentId } });

  const savedMatches: any[] = [];
  for (let i = 0; i < Math.min(passed.length, 30); i++) {
    const sc = passed[i];
    const { pair } = sc;
    const contact = pair.contact;

    // For skill overlap: compare the job's required skills vs the candidate's skills
    const mustHave = pair.job.mustHaveSkills || [];
    const preferred = pair.job.preferredSkills || [];
    const candidateSkills = pair.candidate.skills || [];
    const skillOverlap = computeSkillOverlap(mustHave, candidateSkills);
    const prefOverlap = computeSkillOverlap(preferred, candidateSkills);
    const keyReasons = extractKeyReasons(sc.breakdown.components).slice(0, 5);

    // Build explanation
    const explanation = buildExplanation(
      sc.finalScore,
      sc.matchLevel,
      sc.breakdown.components,
      sc.hardFilter.status !== HardFilterStatus.PASS && sc.hardFilter.details ? [sc.hardFilter.details] : [],
      sc.cappedReason,
      sc.confidence,
    );

    const matchedSkills = [...(skillOverlap.matchedSkills || []), ...(prefOverlap.matchedSkills || [])];
    const missingSkills = skillOverlap.missingSkills || [];

    // Map industries: find overlap between job and candidate industries
    const jobInds = pair.job.industries || [];
    const candInds = pair.candidate.industries || [];
    const sharedSectors: string[] = [];
    for (const ji of jobInds) {
      const found = candInds.some((ci: string) => normalizeTag(ci) === normalizeTag(ji) || areSectorsRelated(ji, ci));
      if (found) sharedSectors.push(ji);
    }

    const match = await prismaClient.opportunityMatch.create({
      data: {
        intentId,
        matchedContactId: contact.id,
        matchedUserId: null,
        matchType: 'contact',
        matchScore: Math.round(sc.finalScore),
        matchLevel: sc.matchLevel,
        confidence: sc.confidence > 0.7 ? 'HIGH' : sc.confidence > 0.4 ? 'MEDIUM' : 'LOW',
        confidenceScore: Math.round(sc.confidence * 100),
        hardFilterStatus: sc.hardFilter.status,
        levelCappedReason: sc.cappedReason,
        isSparseProfile: sc.isSparse,
        deterministicScore: sc.finalScore,
        scoreBreakdown: sc.breakdown.components,
        explanation: `${getExplanationContext(intent.intentType, hiringProfile, contact)} ${explanation.summary_explanation || ''}`,
        explanationV3: JSON.stringify(explanation),
        reasons: keyReasons,
        risks: explanation.gaps_or_mismatches || [],
        sharedSkills: matchedSkills,
        sharedSectors,
        missingSkills,
        suggestedAction: sc.finalScore >= 70 ? 'Send Message' : sc.finalScore >= 50 ? 'Review Profile' : 'Consider',
        suggestedMessage: generateIceBreaker(intent.intentType, hiringProfile, contact),
        nextSteps: generateNextSteps(intent.intentType, contact),
        intentAlignment: getIntentAlignment(intent.intentType, contact),
        status: 'PENDING',
      },
    });

    savedMatches.push(match);
  }

  // Update lastMatchedAt
  await prismaClient.opportunityIntent.update({
    where: { id: intentId },
    data: { lastMatchedAt: new Date() },
  });

  return { matchCount: savedMatches.length, matches: savedMatches };
}
