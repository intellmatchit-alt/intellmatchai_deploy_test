/**
 * Recalculate Project Matches for a User
 *
 * One-shot backfill: re-runs the advanced project matching engine for every
 * non-deleted project owned by the given user. Replaces the persisted
 * ProjectMatch rows for each project with freshly computed ones (the
 * `advancedFindMatches` function deletes-and-replaces internally).
 *
 * Usage:
 *   tsx backend/scripts/recalc-matches-for-user.ts --user-id <userId>
 *   tsx backend/scripts/recalc-matches-for-user.ts --project-id <projectId>   # single project, owner inferred
 *   tsx backend/scripts/recalc-matches-for-user.ts --email <userEmail>
 */

import { PrismaClient } from '@prisma/client';
import { advancedFindMatches } from '../src/infrastructure/external/projects/advanced-matching.adapter';

const prisma = new PrismaClient();

function parseArgs(): { userId?: string; projectId?: string; email?: string } {
  const out: { userId?: string; projectId?: string; email?: string } = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--user-id' && v) { out.userId = v; i++; }
    else if (a === '--project-id' && v) { out.projectId = v; i++; }
    else if (a === '--email' && v) { out.email = v; i++; }
  }
  return out;
}

async function resolveUserId(args: ReturnType<typeof parseArgs>): Promise<string> {
  if (args.userId) return args.userId;
  if (args.email) {
    const u = await prisma.user.findUnique({ where: { email: args.email }, select: { id: true } });
    if (!u) throw new Error(`No user with email ${args.email}`);
    return u.id;
  }
  if (args.projectId) {
    const p = await prisma.project.findUnique({ where: { id: args.projectId }, select: { userId: true } });
    if (!p) throw new Error(`No project with id ${args.projectId}`);
    return p.userId;
  }
  throw new Error('Provide --user-id, --email, or --project-id');
}

async function main() {
  const args = parseArgs();
  const userId = await resolveUserId(args);

  // If --project-id was passed, only process that one project. Otherwise, all
  // of the user's non-deleted projects.
  const projects = args.projectId
    ? await prisma.project.findMany({
        where: { id: args.projectId, userId },
        select: { id: true, title: true, organizationId: true },
      })
    : await prisma.project.findMany({
        where: { userId },
        select: { id: true, title: true, organizationId: true },
        orderBy: { createdAt: 'asc' },
      });

  if (!projects.length) {
    console.log(`No projects found for user ${userId}.`);
    return;
  }

  console.log(`User ${userId} → ${projects.length} project(s) to recalc.\n`);

  let totalMatches = 0;
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const label = `[${i + 1}/${projects.length}] ${p.title || p.id}`;
    process.stdout.write(`${label} ... `);
    try {
      const matches = await advancedFindMatches(
        prisma,
        p.id,
        userId,
        p.organizationId || undefined,
      );
      totalMatches += matches.length;
      console.log(`${matches.length} matches`);
    } catch (err: any) {
      console.log(`FAILED — ${err.message || err}`);
    }
  }

  console.log(`\nDone. Total matches written across ${projects.length} project(s): ${totalMatches}.`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
