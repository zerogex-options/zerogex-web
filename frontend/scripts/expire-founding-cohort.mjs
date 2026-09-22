#!/usr/bin/env node

// Downgrade founding-cohort users (founding_eligible=1) who were comped
// onto tier=pro or tier=basic at cutover (see `make all-to-pro` +
// scripts/seed-founders.mjs) and never redeemed the founding rate at
// checkout. Their deadline to lock in the founding price is
// FOUNDING_LOCKIN_DEADLINE_ISO (2026-07-01T13:30:00Z = July 1, 09:30 ET);
// after that the comp turns off and they revert to tier='public'.
//
// Intended as a one-shot triggered by the systemd timer
// zerogex-web-founding-cohort-demotion.timer at the deadline, but safe
// to re-run: users already downgraded no longer match the WHERE clause,
// and users who later start a founding subscription will have
// founding_member_started_at stamped by the Stripe webhook and be
// excluded on the next tick.
//
// A user is "not subscribed" here means BOTH:
//   - founding_member_started_at IS NULL  (never redeemed the founding
//     rate — that column is stamped only when subMetadata.founding='1'
//     in app/api/webhooks/stripe/route.ts)
//   - no active/trialing Stripe subscription (guards against a founding-
//     eligible user who subscribed at the standard rate; we must NOT
//     yank Pro from a paying customer just because they didn't take the
//     founding coupon)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const args = { dryRun: false, yes: false, backfillRevocations: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--backfill-revocations') args.backfillRevocations = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/expire-founding-cohort.mjs (--dry-run | --yes)

Downgrades founding-eligible users comped onto tier=pro or tier=basic
who never redeemed the founding rate AND have no active/trialing Stripe
subscription. Intended as a one-shot at the FOUNDING_LOCKIN_DEADLINE
(2026-07-01 09:30 ET), driven by the systemd timer of the same name.

Downgrading a member out of Pro also REVOKES their API keys, matching every
other downgrade path (core/serverAuth.ts and the Stripe webhook both call
revokeApiKeysIfTierDropped). Keys outlive the entitlement otherwise: a key
issued while the comp was live keeps authenticating against the backend after
the comp ends, because the backend does not re-derive tier per request.

Options:
      --dry-run    List the affected accounts without writing.
  -y, --yes        Apply the downgrade (and revoke keys).
      --backfill-revocations
                   Do NOT downgrade anyone. Instead, revoke keys for accounts
                   this script has ALREADY downgraded (a founding_cohort_expired
                   audit row) whose tier is still not key-eligible. Use it once
                   to clean up downgrades made before revocation was wired in,
                   and to retry a run where the key service was unreachable —
                   those accounts no longer match the downgrade query, so
                   re-running without this flag will not retry them. Combine
                   with --dry-run to list, or --yes to apply.
  -h, --help       Show this help.

Requires the sqlite3 CLI. Set AUTH_DB_PATH (env or frontend/.env.local) to
override the default DB path. Key revocation additionally needs
ZEROGEX_API_TOKEN and ZEROGEX_ADMIN_TOKEN (env or frontend/.env.local); without
them the run reports the skip and exits non-zero rather than quietly leaving
keys live.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function runSqlite(dbPath, sql) {
  try {
    return execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = err.stderr?.toString?.() ?? '';
    throw new Error(stderr.trim() || err.message);
  }
}

function querySqlite(dbPath, sql) {
  const output = runSqlite(dbPath, sql).trim();
  if (!output) return [];
  return JSON.parse(output);
}

function execSqlite(dbPath, sql) {
  runSqlite(dbPath, sql);
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}
if (!cliArgs.dryRun && !cliArgs.yes) {
  console.error('Error: pass --dry-run or --yes.');
  usage();
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

// core/apiKeyAdmin.ts reads its credentials from process.env ONLY — it is
// written for the Next runtime, where .env.local is already loaded. This script
// runs from a systemd timer with a bare environment, so without this seeding
// isApiKeyAdminConfigured() returns false and revocation silently no-ops, which
// is exactly the failure this change exists to remove. Seed before the dynamic
// import below: the module captures ZEROGEX_API_BASE_URL at load time.
for (const key of ['ZEROGEX_API_BASE_URL', 'ZEROGEX_API_TOKEN', 'ZEROGEX_API_KEY', 'ZEROGEX_ADMIN_TOKEN']) {
  if (!process.env[key] && envLocal[key]) process.env[key] = envLocal[key];
}

// Imported dynamically, AFTER the seeding above. A static import is hoisted and
// would evaluate the module before process.env is populated.
const { isApiKeyAdminConfigured, revokeAllApiKeys, revokeApiKeysIfTierDropped } = await import(
  '../core/apiKeyAdmin.ts'
);
const { isApiKeyEligibleTier } = await import('../core/auth.ts');
const keyAdminReady = isApiKeyAdminConfigured();

// Revoke one member's keys, never throwing: a key-service failure must not
// unwind or abort the tier change, which is the primary job and already
// committed by the time this runs. Returns what happened so the caller can
// tally and, crucially, so the run can exit non-zero when anything was missed —
// a silent failure here is indistinguishable from success and leaves a live
// credential on an account that no longer pays for it.
async function revokeKeysFor(email, previousTier) {
  if (!keyAdminReady) return { status: 'skipped-unconfigured', revoked: 0 };
  try {
    const result = previousTier
      ? await revokeApiKeysIfTierDropped(email, previousTier, 'public')
      : { status: 'revoked', revoked: await revokeAllApiKeys(email) };
    // 'unconfigured' means the drop was real but nothing could be revoked, so
    // the member keeps a live key. keyAdminReady above should make that
    // unreachable here, but route it to the failure path rather than trusting
    // that: counting it as a quiet zero is the exact bug this union removed.
    if (result.status === 'unconfigured') {
      return { status: 'failed', revoked: 0, error: 'key administration is not configured' };
    }
    if (result.status !== 'revoked') return { status: result.status, revoked: 0 };
    return { status: 'revoked', revoked: result.revoked ?? 0 };
  } catch (err) {
    return { status: 'failed', revoked: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  process.exit(1);
}

ensureSqlite3Cli();

// Pre-flight: the founding_* columns are added by the App's lazy migration
// in frontend/core/db.ts (initDb). Same failure mode as expire-partner-
// grants.mjs — surface a clear remediation instead of a raw SQL error.
const userCols = new Set(
  querySqlite(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
const requiredCols = [
  'founding_eligible',
  'founding_member_started_at',
  'stripe_subscription_id',
  'subscription_status',
];
const missingCols = requiredCols.filter((c) => !userCols.has(c));
if (missingCols.length > 0) {
  console.error(`Error: users table missing columns: ${missingCols.join(', ')}.`);
  console.error('The auth DB schema migration has not run against this database file.');
  console.error('Fix: cd ~/zerogex-web && make migrate   (forces the lazy migration to run)');
  process.exit(4);
}

const nowIso = new Date().toISOString();

if (cliArgs.backfillRevocations) {
  // Accounts this script already downgraded, identified by the audit row it
  // writes, whose tier is STILL not key-eligible. Anyone who later subscribed
  // to Pro is excluded by that second condition rather than by a guess: their
  // keys are legitimately theirs again.
  const rows = querySqlite(
    dbPath,
    `SELECT DISTINCT u.id, u.email, u.tier
       FROM users u
       JOIN audit_events a ON a.user_id = u.id
      WHERE a.type = 'founding_cohort_expired'
      ORDER BY u.email;`,
  );
  const stale = rows.filter((r) => !isApiKeyEligibleTier(r.tier));

  console.log(`Auth DB:   ${dbPath}`);
  console.log(`Key admin: ${keyAdminReady ? 'configured' : 'NOT CONFIGURED'}`);
  console.log(
    `Downgraded by this script: ${rows.length}; still not key-eligible: ${stale.length}`,
  );
  for (const r of stale) console.log(`  - ${r.email}  tier=${r.tier}`);

  if (stale.length === 0) {
    console.log('\nNothing to do.');
    process.exit(0);
  }
  if (cliArgs.dryRun) {
    console.log('\n[dry-run] No keys revoked.');
    process.exit(0);
  }
  if (!keyAdminReady) {
    console.error(
      '\nError: ZEROGEX_API_TOKEN / ZEROGEX_ADMIN_TOKEN are not set, so no keys can be revoked.',
    );
    process.exit(3);
  }

  let revokedTotal = 0;
  const failures = [];
  for (const r of stale) {
    // previousTier is unknown for a historical downgrade, so revoke outright,
    // gated on the same eligibility predicate the helper would apply.
    const outcome = await revokeKeysFor(r.email, null);
    if (outcome.status === 'failed') {
      failures.push(`${r.email}: ${outcome.error}`);
      console.error(`  FAILED ${r.email} — ${outcome.error}`);
    } else {
      revokedTotal += outcome.revoked;
      console.log(`  ${r.email} — revoked ${outcome.revoked} key(s)`);
    }
  }
  console.log(`\nRevoked ${revokedTotal} key(s) across ${stale.length} account(s).`);
  if (failures.length > 0) {
    console.error(`${failures.length} account(s) FAILED — re-run to retry:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(3);
  }
  process.exit(0);
}

// Eligible to downgrade: founding-cohort user currently comped onto pro/
// basic, who never redeemed the founding rate AND who does not have an
// active/trialing Stripe sub (guards against founding-eligible users who
// subscribed at the standard rate — their founding_member_started_at is
// NULL too, since it's stamped only when subMetadata.founding='1').
const candidates = querySqlite(
  dbPath,
  `SELECT id, email, tier, founding_eligible, founding_member_started_at,
          subscription_status, stripe_subscription_id
   FROM users
   WHERE founding_eligible = 1
     AND founding_member_started_at IS NULL
     AND tier IN ('pro', 'basic')
     AND (
       stripe_subscription_id IS NULL
       OR subscription_status IS NULL
       OR subscription_status NOT IN ('active', 'trialing')
     );`,
);

console.log(`Auth DB: ${dbPath}`);
console.log(`Cutoff:  founding-cohort deadline reached (${nowIso})`);
console.log(`Candidates: ${candidates.length}`);

for (const c of candidates) {
  console.log(
    `  - ${c.email}  tier=${c.tier}  sub=${c.subscription_status ?? '(none)'}`,
  );
}

if (candidates.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log(
    `\nWould also revoke API keys for each account above (key admin: ${
      keyAdminReady ? 'configured' : 'NOT CONFIGURED — revocation would be skipped'
    }).`,
  );
  console.log('[dry-run] No changes written.');
  process.exit(0);
}

let keysRevokedTotal = 0;
const revokeFailures = [];

for (const c of candidates) {
  // Guard the UPDATE with the same predicates from the SELECT so a
  // concurrent Stripe webhook that lands a subscription between the
  // SELECT and the UPDATE can't be clobbered by this sweep.
  execSqlite(
    dbPath,
    `UPDATE users
       SET tier = 'public', updated_at = '${escapeSqlLiteral(nowIso)}'
     WHERE id = '${escapeSqlLiteral(c.id)}'
       AND founding_eligible = 1
       AND founding_member_started_at IS NULL
       AND tier IN ('pro', 'basic')
       AND (
         stripe_subscription_id IS NULL
         OR subscription_status IS NULL
         OR subscription_status NOT IN ('active', 'trialing')
       );`,
  );
  const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
  execSqlite(
    dbPath,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (
       '${escapeSqlLiteral(auditId)}',
       'founding_cohort_expired',
       '${escapeSqlLiteral(c.id)}',
       NULL,
       '${escapeSqlLiteral(c.email)}',
       'expire-founding-cohort-script',
       '${escapeSqlLiteral(`founding deadline passed; tier ${c.tier} -> public`)}',
       '${escapeSqlLiteral(nowIso)}'
     );`,
  );

  // Revoke AFTER the tier change is committed: the downgrade is the primary
  // job and must stand even if the key service is down. The cost of that
  // ordering is that a failure here is not retried by a later run (the account
  // no longer matches the candidate query), which is what
  // --backfill-revocations exists to sweep up — so failures are collected and
  // surfaced as a non-zero exit rather than logged and forgotten.
  const outcome = await revokeKeysFor(c.email, c.tier);
  if (outcome.status === 'failed') {
    revokeFailures.push(`${c.email}: ${outcome.error}`);
    console.error(`  key revocation FAILED for ${c.email} — ${outcome.error}`);
  } else {
    keysRevokedTotal += outcome.revoked;
  }
}

console.log(`\nDowngraded ${candidates.length} founding-cohort user(s) to tier='public'.`);
if (keyAdminReady) {
  console.log(`Revoked ${keysRevokedTotal} API key(s) across those accounts.`);
} else {
  console.error(
    'WARNING: ZEROGEX_API_TOKEN / ZEROGEX_ADMIN_TOKEN are not set, so NO API keys were revoked.',
  );
  console.error(
    '         Keys issued while the comp was live still authenticate. Set both, then run:',
  );
  console.error('           make founding-cohort-revoke-backfill YES=1');
}
if (revokeFailures.length > 0) {
  console.error(`\n${revokeFailures.length} key revocation(s) FAILED:`);
  for (const f of revokeFailures) console.error(`  - ${f}`);
  console.error('Retry with: make founding-cohort-revoke-backfill YES=1');
}
if (!keyAdminReady || revokeFailures.length > 0) {
  // Non-zero so the systemd timer records a failure. The downgrades above are
  // committed and the script is idempotent, so a retry is safe.
  process.exit(3);
}
