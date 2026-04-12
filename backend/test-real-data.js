const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRealMatching() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   REAL MATCHING TEST WITH ACTUAL DATABASE RECORDS');
  console.log('═══════════════════════════════════════════════════════════');

  const userId = '776d2251-f6b5-46e1-8b99-017e350a59d8'; // osama

  // Get user profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userSectors: { include: { sector: true } },
      userSkills: { include: { skill: true } },
      userInterests: { include: { interest: true } },
    }
  });

  console.log('');
  console.log('👤 TESTING USER: ' + user.fullName + ' (' + user.email + ')');
  console.log('   Company: ' + (user.company || 'N/A'));
  console.log('   Sectors: ' + user.userSectors.map(s => s.sector.name).join(', '));
  console.log('   Skills: ' + user.userSkills.map(s => s.skill.name).join(', '));
  console.log('   Interests: ' + user.userInterests.map(i => i.interest.name).join(', '));

  // Get contacts
  const contacts = await prisma.contact.findMany({
    where: { ownerId: userId },
    include: {
      contactSectors: { include: { sector: true } },
      contactSkills: { include: { skill: true } },
      contactInterests: { include: { interest: true } },
    }
  });

  console.log('');
  console.log('📋 USER CONTACTS (' + contacts.length + '):');
  contacts.forEach(c => {
    console.log('   - ' + c.fullName + ' (' + (c.company || 'N/A') + ')');
    console.log('     Sectors: ' + (c.contactSectors.map(s => s.sector.name).join(', ') || '❌ NONE'));
    console.log('     Skills: ' + (c.contactSkills.map(s => s.skill.name).join(', ') || '❌ NONE'));
  });

  // Run matching
  console.log('');
  console.log('🔬 RUNNING DETERMINISTIC MATCHING...');

  const { DeterministicMatchingService } = require('./dist/infrastructure/external/matching/DeterministicMatchingService');
  const matchingService = new DeterministicMatchingService();

  const matches = await matchingService.getMatches(userId, { limit: 10, minScore: 0 });

  console.log('');
  console.log('📊 MATCHING RESULTS:');
  if (matches.length === 0) {
    console.log('   ⚠️ No matches returned');
  } else {
    matches.forEach((match, idx) => {
      const contact = contacts.find(c => c.id === match.contactId);
      console.log('   ' + (idx+1) + '. ' + (contact?.fullName || 'Unknown'));
      console.log('      Score: ' + match.score);
      console.log('      Reasons: ' + (match.reasons || []).slice(0,3).join(', '));
    });
  }

  // Analysis
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════');

  if (contacts.length > 0) {
    const contact = contacts[0];

    console.log('');
    console.log('Contact: ' + contact.fullName);
    console.log('   User sectors: ' + user.userSectors.length);
    console.log('   Contact sectors: ' + contact.contactSectors.length);
    console.log('   User skills: ' + user.userSkills.length);
    console.log('   Contact skills: ' + contact.contactSkills.length);
    console.log('');

    if (contact.contactSectors.length === 0 && contact.contactSkills.length === 0) {
      console.log('⚠️  PROBLEM: Contact has NO profile data');
      console.log('   Matching needs sector/skill data to compute similarity.');
      console.log('   Low score is EXPECTED when contact profile is empty.');
    }
  }

  await prisma.$disconnect();
  console.log('');
  console.log('✅ Test complete');
}

testRealMatching().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
