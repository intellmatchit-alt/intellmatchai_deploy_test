/**
 * Inspect what the GET /projects/:id endpoint actually returns for matches.
 *
 * Replicates ProjectController.get's per-match enrichment so we can see the
 * displayed totalScore, lookingFor details, and per-Looking-For "explanation"
 * field for each match — the same data the frontend renders.
 *
 * Usage:
 *   tsx backend/scripts/inspect-live-enrichment.ts <projectId>
 */

import { PrismaClient } from '@prisma/client';
import { enrichLookingForResult } from '../src/infrastructure/external/projects/lookingForEnhancedScorer';

const prisma = new PrismaClient();

function safeJsonArray(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    try { const v = JSON.parse(input); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error('Usage: tsx scripts/inspect-live-enrichment.ts <projectId>');
    process.exit(1);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sectors: { include: { sector: true } },
      skillsNeeded: { include: { skill: true } },
      matches: {
        include: {
          matchedUser: {
            select: {
              id: true, fullName: true, jobTitle: true, company: true, bio: true,
              userSkills: { select: { skillId: true, skill: { select: { name: true } } } },
              userSectors: { select: { sectorId: true, sector: { select: { name: true } } } },
            },
          },
          matchedContact: {
            select: {
              id: true, fullName: true, jobTitle: true, company: true, bio: true,
              contactSkills: { select: { skillId: true, skill: { select: { name: true } } } },
              contactSectors: { select: { sectorId: true, sector: { select: { name: true } } } },
            },
          },
        },
        orderBy: { matchScore: 'desc' },
      },
    },
  });

  if (!project) {
    console.error('Project not found');
    process.exit(1);
  }

  const projectLookingFor = safeJsonArray((project as any).lookingFor) as string[];
  const projectInput = {
    skillIds: project.skillsNeeded.map((ps) => ps.skillId),
    skillNames: project.skillsNeeded.map((ps) => ps.skill?.name).filter(Boolean) as string[],
    sectorIds: project.sectors.map((ps) => ps.sectorId),
    sectorNames: project.sectors.map((ps: any) => ps.sector?.name ?? null).filter(Boolean) as string[],
  };

  console.log(`Project: ${project.title}`);
  console.log(`Looking for: ${projectLookingFor.join(', ')}`);
  console.log(`Project skills: ${projectInput.skillNames.join(', ')}`);
  console.log(`Project sectors: ${projectInput.sectorNames.join(', ')}`);
  console.log('');

  for (const m of project.matches) {
    const u = m.matchedUser as any;
    const c = m.matchedContact as any;
    const person = u || c;
    const skills = (u?.userSkills || c?.contactSkills || []) as Array<{ skillId: string; skill?: { name: string } }>;
    const sectorRows = (u?.userSectors || c?.contactSectors || []) as Array<{ sectorId: string; sector?: { name: string } }>;

    const ci = {
      jobTitle: person?.jobTitle,
      company: person?.company,
      bio: person?.bio ?? null,
      skillIds: skills.map((s) => s.skillId),
      skillNames: skills.map((s) => s.skill?.name).filter(Boolean) as string[],
      sectorIds: sectorRows.map((s) => s.sectorId),
      sectorNames: sectorRows.map((s) => s.sector?.name ?? null).filter(Boolean) as string[],
    };

    const enriched = enrichLookingForResult({
      selected: projectLookingFor,
      contact: ci,
      project: projectInput,
      semanticScores: null,
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log(`Person: ${person?.fullName || '(no name)'} — title: ${person?.jobTitle || '—'}`);
    console.log(`Persisted matchScore: ${m.matchScore}, finalScore: ${(m as any).finalScore}, level: ${(m as any).matchLevel}`);
    console.log(`LIVE totalScore: ${enriched.totalScore}`);
    console.log(`LIVE bestLookingFor: ${enriched.bestLookingFor}`);
    console.log(`LIVE overall summary: ${enriched.overallExplanation?.summary || '(empty)'}`);
    console.log('Per-Looking-For:');
    for (const d of enriched.lookingForScores) {
      console.log(`  • ${d.label}: ${d.finalScore}/100 (${d.matchLevel})`);
      console.log(`    whyParagraph:  ${(d as any).whyParagraph || '(empty)'}`);
      console.log(`    gapsParagraph: ${(d as any).gapsParagraph || '(empty)'}`);
    }
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
