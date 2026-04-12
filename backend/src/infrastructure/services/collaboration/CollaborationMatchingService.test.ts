/**
 * Test file to demonstrate issues with CollaborationMatchingService
 * Run with: npx ts-node CollaborationMatchingService.test.ts
 */

import { CollaborationMatchingService, CollaboratorContact } from './CollaborationMatchingService';
import { MissionCriteria } from '../../../domain/entities/Collaboration';

const matchingService = new CollaborationMatchingService();

// Test contacts
const contacts: CollaboratorContact[] = [
  {
    id: '1',
    fullName: 'John Developer',
    company: 'Tech Corp',
    jobTitle: 'Senior Software Engineer',  // Has "Software" - should match!
    location: 'San Francisco, CA',
    sectors: ['Technology', 'SaaS'],
    skills: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
    bio: 'Experienced software developer with 10 years experience',
  },
  {
    id: '2',
    fullName: 'Jane Designer',
    company: 'Design Studio',
    jobTitle: 'UX/UI Designer',
    location: 'New York, NY',
    sectors: ['Design', 'Creative'],
    skills: ['Figma', 'UI Design', 'User Research'],
    bio: 'Creative designer passionate about user experience',
  },
  {
    id: '3',
    fullName: 'Bob Manager',
    company: 'Finance Inc',
    jobTitle: 'Product Manager',
    location: 'Chicago, IL',
    sectors: ['Finance', 'Banking'],
    skills: ['Product Management', 'Agile', 'Strategy'],
    bio: 'Product leader with fintech background',
  },
];

async function runTests() {
  console.log('='.repeat(80));
  console.log('COLLABORATION MATCHING SERVICE - ISSUE DEMONSTRATION');
  console.log('='.repeat(80));
  console.log('');

  // =========================================================================
  // TEST 1: More criteria = Lower scores (BROKEN)
  // =========================================================================
  console.log('TEST 1: More criteria = Lower scores (BUG)');
  console.log('-'.repeat(40));

  // Scenario A: Search for 1 skill
  const criteriaA: MissionCriteria = {
    skills: ['JavaScript'],
  };

  // Scenario B: Search for 5 skills (more specific mission)
  const criteriaB: MissionCriteria = {
    skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Python'],
  };

  const resultsA = await matchingService.matchContacts(criteriaA, [contacts[0]]);
  const resultsB = await matchingService.matchContacts(criteriaB, [contacts[0]]);

  console.log('Contact: John Developer (has JavaScript, React, Node.js, TypeScript)');
  console.log('');
  console.log('Scenario A - Search for 1 skill [JavaScript]:');
  console.log(`  Score: ${resultsA[0]?.score || 0}`);
  console.log(`  Expected: 30 (1/1 * 30 = 30)`);
  console.log('');
  console.log('Scenario B - Search for 5 skills [JavaScript, React, Node.js, TypeScript, Python]:');
  console.log(`  Score: ${resultsB[0]?.score || 0}`);
  console.log(`  John has 4 of these skills!`);
  console.log(`  But score: 4/5 * 30 = 24 points`);
  console.log('');
  console.log('🐛 BUG: More specific search = LOWER score!');
  console.log('   John scores HIGHER when we search less specifically.');
  console.log('');

  // =========================================================================
  // TEST 2: Job Title is ignored for role matching
  // =========================================================================
  console.log('TEST 2: Job Title ignored for role matching');
  console.log('-'.repeat(40));

  const criteriaRole: MissionCriteria = {
    keywords: ['Engineer'],  // Only way to search job title
  };

  const resultsRole = await matchingService.matchContacts(criteriaRole, contacts);

  console.log('Searching for "Engineer" in keywords:');
  console.log(`  John (Senior Software Engineer): Score = ${resultsRole.find(r => r.contactId === '1')?.score || 0}`);
  console.log(`  Jane (UX/UI Designer): Score = ${resultsRole.find(r => r.contactId === '2')?.score || 0}`);
  console.log(`  Bob (Product Manager): Score = ${resultsRole.find(r => r.contactId === '3')?.score || 0}`);
  console.log('');
  console.log('🐛 BUG: "Senior Software Engineer" should match, but keyword search');
  console.log('   only gives 20 points max. No dedicated role matching!');
  console.log('');

  // =========================================================================
  // TEST 3: Experience years field is never used
  // =========================================================================
  console.log('TEST 3: Experience years is NEVER used');
  console.log('-'.repeat(40));

  const criteriaExp: MissionCriteria = {
    skills: ['JavaScript'],
    experienceYears: { min: 5, max: 15 },  // This field exists but is ignored!
  };

  const resultsExp = await matchingService.matchContacts(criteriaExp, contacts);

  console.log('Criteria: skills=JavaScript, experienceYears={min: 5, max: 15}');
  console.log(`  Score: ${resultsExp[0]?.score || 0}`);
  console.log('');
  console.log('🐛 BUG: experienceYears field is defined in MissionCriteria');
  console.log('   but CollaborationMatchingService NEVER checks it!');
  console.log('');

  // =========================================================================
  // TEST 4: Threshold too high for specific searches
  // =========================================================================
  console.log('TEST 4: Threshold issue with specific searches');
  console.log('-'.repeat(40));

  const criteriaSpecific: MissionCriteria = {
    sectors: ['Technology', 'SaaS', 'Cloud'],  // 3 sectors
    skills: ['JavaScript', 'React', 'Node.js', 'Python', 'AWS'],  // 5 skills
    locations: ['San Francisco'],
    keywords: ['software', 'developer'],
  };

  const resultsSpecific = await matchingService.matchContacts(criteriaSpecific, contacts);

  console.log('Specific mission searching for:');
  console.log('  - Sectors: Technology, SaaS, Cloud');
  console.log('  - Skills: JavaScript, React, Node.js, Python, AWS');
  console.log('  - Location: San Francisco');
  console.log('  - Keywords: software, developer');
  console.log('');
  console.log('John Developer matches:');
  console.log('  - 2/3 sectors (Technology, SaaS) → 2/3 * 30 = 20 pts');
  console.log('  - 3/5 skills (JavaScript, React, Node.js) → 3/5 * 30 = 18 pts');
  console.log('  - Location match → 20 pts');
  console.log('  - 2/2 keywords → 20 pts');
  console.log('  - Expected total: ~78 pts');
  console.log(`  - Actual score: ${resultsSpecific.find(r => r.contactId === '1')?.score || 0}`);
  console.log('');

  // =========================================================================
  // TEST 5: Empty criteria fields
  // =========================================================================
  console.log('TEST 5: Empty criteria handling');
  console.log('-'.repeat(40));

  const criteriaEmpty: MissionCriteria = {
    sectors: [],  // Empty array
    skills: ['JavaScript'],
  };

  const resultsEmpty = await matchingService.matchContacts(criteriaEmpty, contacts);

  console.log('Criteria with empty sectors array:');
  console.log(`  Score: ${resultsEmpty[0]?.score || 0}`);
  console.log('  Expected: Should still match on skills');
  console.log('');

  // =========================================================================
  // TEST 6: Fuzzy matching strictness
  // =========================================================================
  console.log('TEST 6: Fuzzy matching is too strict');
  console.log('-'.repeat(40));

  const criteriaFuzzy: MissionCriteria = {
    skills: ['Javascript'],  // lowercase 's' - should fuzzy match JavaScript
    sectors: ['Tech'],  // Should fuzzy match Technology
  };

  const resultsFuzzy = await matchingService.matchContacts(criteriaFuzzy, contacts);

  console.log('Searching for:');
  console.log('  - skills: "Javascript" (should match "JavaScript")');
  console.log('  - sectors: "Tech" (should match "Technology")');
  console.log(`  - John\'s score: ${resultsFuzzy.find(r => r.contactId === '1')?.score || 0}`);
  console.log('');
  console.log('Note: "Tech" vs "Technology" - Levenshtein distance = 6');
  console.log('      Threshold = max(4, 10) * 0.3 = 3');
  console.log('      6 > 3, so NO match!');
  console.log('');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('='.repeat(80));
  console.log('SUMMARY OF ISSUES');
  console.log('='.repeat(80));
  console.log('');
  console.log('1. ❌ Score formula penalizes specific searches');
  console.log('   Fix: Score based on matched count, not percentage of criteria');
  console.log('');
  console.log('2. ❌ Job title/role matching is missing');
  console.log('   Fix: Add dedicated role matching with ROLE_MATCH reason');
  console.log('');
  console.log('3. ❌ experienceYears field is never used');
  console.log('   Fix: Extract years from bio/title and compare');
  console.log('');
  console.log('4. ❌ Company matching is missing');
  console.log('   Fix: Add company name matching');
  console.log('');
  console.log('5. ❌ Fuzzy matching threshold too strict');
  console.log('   Fix: Increase threshold or use better similarity');
  console.log('');
  console.log('6. ❌ No AI/semantic enhancement');
  console.log('   Fix: Add LLM-based matching like ProjectMatchingService');
  console.log('');
}

runTests().catch(console.error);
