/**
 * Project matching eval CLI.
 *
 * Scores a target project against the user's real contacts/network and prints
 * a top-N report with full per-Looking-For breakdown so you can visually
 * verify accuracy.
 *
 * Usage:
 *   npx tsx prisma/eval-project-matches.ts <projectIdOrTitle>
 *   npx tsx prisma/eval-project-matches.ts <projectIdOrTitle> --top 20
 *   npx tsx prisma/eval-project-matches.ts <projectIdOrTitle> --selected investor,technical_partner
 *
 * Notes:
 *   - Reads identical inputs to the live engine (`enrichLookingForResult`)
 *     so the numbers shown here are what the API will return.
 *   - The TARGET FILTER mirrors production: test/seed accounts are excluded
 *     via `EXCLUDE_TEST_ACCOUNTS`.
 *   - Sectors are loaded with their names so the synonym layer fires.
 */

import { PrismaClient } from "@prisma/client";
import {
  enrichLookingForResult,
  LookingForType,
} from "../src/infrastructure/external/projects/lookingForEnhancedScorer";
import { semanticScoreManyContacts } from "../src/infrastructure/external/projects/lookingForSemanticScorer";
import type {
  ContactScoringInput,
  ProjectScoringInput,
} from "../src/infrastructure/external/projects/lookingForRoleScorer";
import {
  EXCLUDE_TEST_ACCOUNTS,
  EXCLUDE_TEST_ACCOUNTS_NULLABLE,
} from "../src/infrastructure/external/projects/test-account-filter";

const prisma = new PrismaClient();

function parseArgs(argv: string[]): {
  projectKey: string;
  top: number;
  selected?: string[];
} {
  const positional: string[] = [];
  let top = 10;
  let selected: string[] | undefined;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--top") {
      top = Number(argv[++i] || 10);
    } else if (a === "--selected") {
      selected = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      positional.push(a);
    }
  }
  if (!positional.length) {
    console.error(
      "Usage: npx tsx prisma/eval-project-matches.ts <projectIdOrTitle> [--top N] [--selected investor,advisor,...]",
    );
    process.exit(1);
  }
  return { projectKey: positional[0], top, selected };
}

async function loadProject(key: string) {
  const byId = await prisma.project.findUnique({
    where: { id: key },
    include: {
      skillsNeeded: { include: { skill: true } },
      sectors: { include: { sector: true } },
    },
  });
  if (byId) return byId;
  return prisma.project.findFirst({
    where: { title: { contains: key } },
    include: {
      skillsNeeded: { include: { skill: true } },
      sectors: { include: { sector: true } },
    },
  });
}

async function main() {
  const { projectKey, top, selected: cliSelected } = parseArgs(process.argv);
  const project = await loadProject(projectKey);
  if (!project) {
    console.error(`Project not found: ${projectKey}`);
    process.exit(1);
  }

  const persistedLookingFor = Array.isArray(project.lookingFor)
    ? (project.lookingFor as string[])
    : [];
  const selected = cliSelected?.length ? cliSelected : persistedLookingFor;
  if (!selected.length) {
    console.error("Project has no lookingFor and no --selected was passed.");
    process.exit(1);
  }

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(`PROJECT  : ${project.title} (${project.id})`);
  console.log(`OWNER    : ${project.userId}`);
  console.log(`SELECTED : ${selected.join(", ")}`);
  console.log(`SECTORS  : ${project.sectors.map((ps: any) => ps.sector?.name).filter(Boolean).join(", ") || "(none)"}`);
  console.log(`SKILLS   : ${project.skillsNeeded.map((ps: any) => ps.skill?.name).filter(Boolean).join(", ") || "(none)"}`);
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // Mirror the controller's candidate retrieval, but skip cohere/recombee.
  const projectSectorIds = project.sectors.map((s: any) => s.sectorId);
  const projectSkillIds = project.skillsNeeded.map((s: any) => s.skillId);

  const userOR: any[] = [
    ...(projectSectorIds.length ? [{ userSectors: { some: { sectorId: { in: projectSectorIds } } } }] : []),
    ...(projectSkillIds.length ? [{ userSkills: { some: { skillId: { in: projectSkillIds } } } }] : []),
  ];
  const userWhere: any = {
    id: { not: project.userId },
    isActive: true,
    ...EXCLUDE_TEST_ACCOUNTS,
  };
  if (userOR.length) userWhere.OR = userOR;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, fullName: true, email: true, jobTitle: true, company: true, bio: true,
      userSkills: { select: { skillId: true, skill: { select: { name: true } } } },
      userSectors: { select: { sectorId: true, sector: { select: { name: true } } } },
    },
    take: 200,
  });

  const contacts = await prisma.contact.findMany({
    where: { ownerId: project.userId, ...EXCLUDE_TEST_ACCOUNTS_NULLABLE },
    select: {
      id: true, fullName: true, email: true, jobTitle: true, company: true, bio: true,
      contactSkills: { select: { skillId: true, skill: { select: { name: true } } } },
      contactSectors: { select: { sectorId: true, sector: { select: { name: true } } } },
    },
    take: 200,
  });

  console.log(`Candidates: ${users.length} users + ${contacts.length} contacts\n`);

  const projectInput: ProjectScoringInput = {
    skillIds: projectSkillIds,
    skillNames: project.skillsNeeded.map((ps: any) => ps.skill?.name).filter(Boolean),
    sectorIds: projectSectorIds,
    sectorNames: project.sectors.map((ps: any) => ps.sector?.name).filter(Boolean),
  };

  const candidates = [
    ...users.map((u: any) => ({
      type: "user" as const,
      id: u.id,
      ci: {
        fullName: u.fullName,
        jobTitle: u.jobTitle,
        company: u.company,
        bio: u.bio,
        skillIds: u.userSkills.map((s: any) => s.skillId),
        skillNames: u.userSkills.map((s: any) => s.skill?.name).filter(Boolean),
        sectorIds: u.userSectors.map((s: any) => s.sectorId),
        sectorNames: u.userSectors.map((s: any) => s.sector?.name).filter(Boolean),
      } as ContactScoringInput,
      meta: u,
    })),
    ...contacts.map((c: any) => ({
      type: "contact" as const,
      id: c.id,
      ci: {
        fullName: c.fullName,
        jobTitle: c.jobTitle,
        company: c.company,
        bio: c.bio,
        skillIds: c.contactSkills.map((s: any) => s.skillId),
        skillNames: c.contactSkills.map((s: any) => s.skill?.name).filter(Boolean),
        sectorIds: c.contactSectors.map((s: any) => s.sectorId),
        sectorNames: c.contactSectors.map((s: any) => s.sector?.name).filter(Boolean),
      } as ContactScoringInput,
      meta: c,
    })),
  ];

  let semantic: Array<Record<string, number> | null> = candidates.map(() => null);
  try {
    semantic = await semanticScoreManyContacts(selected, candidates.map((c) => c.ci));
  } catch {
    /* embeddings best-effort */
  }

  const enriched = candidates.map((c, idx) => {
    const result = enrichLookingForResult({
      selected,
      contact: c.ci,
      project: projectInput,
      semanticScores: semantic[idx],
    });
    return { ...c, result };
  });

  enriched.sort((a, b) => b.result.totalScore - a.result.totalScore);

  const slice = enriched.slice(0, top);
  console.log(`TOP ${slice.length} (out of ${enriched.length}):\n`);

  for (let i = 0; i < slice.length; i++) {
    const e = slice[i];
    const r = e.result;
    const best = r.lookingForScores.find((d) => d.isBestMatchType);
    const tier = `${e.type.toUpperCase().padEnd(7)}`;
    const score = `${r.totalScore.toString().padStart(3)}/100`;
    const band = best?.matchLevel ?? "—";
    console.log(
      `${(i + 1).toString().padStart(2)}. ${score}  ${band.padEnd(9)} ${tier} ${e.ci.fullName}`,
    );
    console.log(`     ${e.ci.jobTitle ?? "—"} @ ${e.ci.company ?? "—"}`);
    console.log(`     ${r.overallExplanation.summary}`);
    for (const d of r.lookingForScores) {
      const flag = d.isBestMatchType ? "★" : " ";
      console.log(
        `     ${flag} ${d.label.padEnd(22)} ${String(d.finalScore).padStart(3)}/100 ${d.matchLevel.padEnd(9)} (${d.hardFilterStatus})`,
      );
    }
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
