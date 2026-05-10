/**
 * Test-account exclusion for project matching.
 *
 * Recognises seed / test / synthetic accounts and produces a Prisma `where`
 * fragment that filters them out of candidate retrieval. The patterns cover:
 *
 *   - RFC 2606 reserved TLD `.test` (e.g. matchtest@p2p.test)
 *   - RFC 2606 reserved domains test.com, example.com / .org / .net
 *   - common synthetic-email prefixes the seed scripts emit
 *     (test-, validation-, qa-, e2e-, demo-, fixture-)
 *   - explicit fullName markers used by validators
 *     ("Validation Test User", "Test User", "QA User")
 *
 * The Prisma fragment is composed inline by callers so it merges cleanly with
 * the rest of their `where` (some sites use `OR`, others nest inside `AND`).
 *
 * @module infrastructure/external/projects/test-account-filter
 */

/**
 * Prisma `NOT` fragment that excludes seed / synthetic accounts.
 * Use as `where: { ...other, ...EXCLUDE_TEST_ACCOUNTS }` so it composes with
 * existing OR/AND clauses without disturbing them.
 *
 * NULL-safe: each email pattern is paired with `not: null` so a contact whose
 * email is missing isn't accidentally excluded by SQL three-valued logic
 * (`NOT (NULL OR ...)` collapses to NULL → row dropped). With this guard the
 * pattern returns FALSE (not NULL) for null-email rows, so they pass through.
 *
 * (Not `as const` — Prisma's `WhereInput` requires mutable arrays for OR.)
 */
// Two variants because User.email is required (non-null) and Contact.email
// is nullable. For Contact we need to explicitly admit null-email rows in
// each clause; for User we don't (and Prisma 5 rejects `{ email: null }` as
// a filter on a non-nullable field).
//
//   EXCLUDE_TEST_ACCOUNTS         — generic; safe for either model
//   EXCLUDE_TEST_ACCOUNTS_NULLABLE — for tables with nullable email (Contact)

const TEST_EMAIL_ENDS = [
  ".test",
  "@test.com",
  "@example.com",
  "@example.org",
  "@example.net",
];
const TEST_EMAIL_STARTS = [
  "test-validation-",
  "validation-",
  "qa-",
  "e2e-",
  "fixture-",
];
const TEST_FULL_NAMES = ["Validation Test User", "Test User", "QA User"];

// User-side: simple OR/NOT — User.email is required so no null branch needed.
export const EXCLUDE_TEST_ACCOUNTS: {
  NOT: { OR: Array<Record<string, unknown>> };
} = {
  NOT: {
    OR: [
      ...TEST_EMAIL_ENDS.map((s) => ({ email: { endsWith: s } })),
      ...TEST_EMAIL_STARTS.map((s) => ({ email: { startsWith: s } })),
      ...TEST_FULL_NAMES.map((n) => ({ fullName: { equals: n } })),
    ],
  },
};

// Contact-side: every email-pattern clause is wrapped in `OR: [{ email: null }, NOT(pattern)]`
// so null-email rows pass through (MySQL three-valued logic would otherwise
// silently drop them).
const notNullableEmailEndsWith = (s: string) => ({
  OR: [{ email: null }, { NOT: { email: { endsWith: s } } }],
});
const notNullableEmailStartsWith = (s: string) => ({
  OR: [{ email: null }, { NOT: { email: { startsWith: s } } }],
});

export const EXCLUDE_TEST_ACCOUNTS_NULLABLE: {
  AND: Array<Record<string, unknown>>;
} = {
  AND: [
    ...TEST_EMAIL_ENDS.map(notNullableEmailEndsWith),
    ...TEST_EMAIL_STARTS.map(notNullableEmailStartsWith),
    ...TEST_FULL_NAMES.map((n) => ({ NOT: { fullName: { equals: n } } })),
  ],
};
