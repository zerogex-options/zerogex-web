#!/usr/bin/env node

// Downgrade Creator Partners whose 90-day Pro grant has expired and who
// haven't started a paid subscription on their own. Designed to run daily
// from cron / a scheduled job.
//
// Safe under repeat runs: a partner who was already downgraded has tier
// != 'pro', so the WHERE clause excludes them and the cron is a no-op.
//
// Downgrading out of Pro also REVOKES the partner's API keys, matching every
// other downgrade path (core/serverAuth.ts and the Stripe webhook both call
// revokeApiKeysIfTierDropped). Without it a key minted during the 90-day grant
// keeps authenticating after the grant ends, because the backend does not
// re-derive tier per request. --backfill-revocations sweeps partners already
// downgraded before this was wired in, and retries any revocation that failed.
//
// partner_tier='creator' STAYS SET on downgrade — the partner can still
// refer audience members and accrue commissions; they just no longer get
// comped Pro access. That preserves attribution while reflecting that the
// "free 90 days" is genuinely over.

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
  node scripts/expire-partner-grants.mjs (--dry-run | --yes)

Downgrades partners whose grant has expired AND who don't have an active
paid subscription. Intended as a daily cron.

Downgrading out of Pro also REVOKES the partner's API keys, matching every
other downgrade path. A key minted during the 90-day grant otherwise keeps
authenticating after the grant ends, because the backend does not re-derive
tier per request.

Options:
      --dry-run    List the affected accounts without writing.
  -y, --yes        Apply the downgrade (and revoke keys).
      --backfill-revocations
                   Do NOT downgrade anyone. Instead, revoke keys for partners
                   this script has ALREADY downgraded (a partner_grant_expired
                   audit row) whose tier is still not key-eligible. Use it once
                   to clean up downgrades made before revocation was wired in,
                   and to retry a run where the key service was unreachable —
                   those partners no longer match the downgrade query, so
                   re-running without this flag will not retry them. Combine
                   with --dry-run to list, or --yes to apply.
  -h, --help       Show this help.

Requires the sqlite3 CLI. Set AUTH_DB_PATH (env or frontend/.env.local) to
override the default DB path. Key revocation additionally needs
ZEROGEX_API_TOKEN (or the legacy ZEROGEX_API_KEY) and ZEROGEX_ADMIN_TOKEN;
without them the run reports the skip and exits non-zero rather than quietly
leaving keys live.`);
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

// core/apiKeyAdmin.ts reads credentials from process.env only (it is written for
// the Next runtime, where .env.local is already loaded). This runs from a
// systemd timer with a bare environment, so without seeding, revocation would
// silently no-op. Seed BEFORE the dynamic import: the module captures
// ZEROGEX_API_BASE_URL at load time, and a static import would be hoisted ahead
// of this loop.
for (const key of ['ZEROGEX_API_BASE_URL', 'ZEROGEX_API_TOKEN', 'ZEROGEX_API_KEY', 'ZEROGEX_ADMIN_TOKEN']) {
  if (!process.env[key] && envLocal[key]) process.env[key] = envLocal[key];
}

const { isApiKeyAdminConfigured, revokeAllApiKeys, revokeApiKeysIfTierDropped } = await import(
  '../core/apiKeyAdmin.ts'
);
const { isApiKeyEligibleTier } = await import('../core/auth.ts');
const keyAdminReady = isApiKeyAdminConfigured();

// Never throws: a key-service failure must not unwind or abort the tier change,
// which is the primary job and already committed by the time this runs. The
// caller tallies the outcomes and exits non-zero if anything was missed, so a
// silent failure can't look like success over a live credential.
async function revokeKeysFor(email, previousTier) {
  if (!keyAdminReady) return { status: 'skipped-unconfigured', revoked: 0 };
  try {
    const result = previousTier
      ? await revokeApiKeysIfTierDropped(email, previousTier, 'public')
      : { status: 'revoked', revoked: await revokeAllApiKeys(email) };
    // 'unconfigured' means the drop was real but nothing could be revoked, so
    // the partner keeps a live key. keyAdminReady above should make that
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

// Pre-flight: the partner_* columns are added by the App's lazy migration
// (frontend/core/db.ts initDb), which only runs on first DB touch from the
// PM2 process. If the timer ran before that migration landed (e.g. after a
// --start-from <step> deploy that skipped the rebuild), surface a clear
// remediation instead of the raw "no such column" SQL error.
const userCols = new Set(
  querySqlite(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
if (!userCols.has('partner_pro_grant_expires_at')) {
  console.error('Error: the partner_* columns are not present on the users table yet.');
  console.error('The auth DB schema migration has not run against this database file.');
  console.error('Fix: cd ~/zerogex-web && make migrate   (forces the lazy migration to run)');
  console.error('     or run a full deploy (`make rebuild` or `./deploy/deploy.sh`) and then');
  console.error('     hit any /api/* endpoint to trigger the migration via the app process.');
  process.exit(4);
}

const nowIso = new Date().toISOString();

if (cliArgs.backfillRevocations) {
  // Partners this script already downgraded, identified by the audit row it
  // writes, whose tier is STILL not key-eligible. Anyone who later started a
  // paid Pro subscription is excluded by that second condition — their keys are
  // legitimately theirs again.
  const rows = querySqlite(
    dbPath,
    `SELECT DISTINCT u.id, u.email, u.tier
       FROM users u
       JOIN audit_events a ON a.user_id = u.id
      WHERE a.type = 'partner_grant_expired'
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

// Eligible to downgrade: partner with an expired grant, currently on tier=pro,
// who is not currently in an active/trialing Stripe subscription. The
// subscription_status filter prevents fighting with the webhook for paying
// users who upgraded mid-grant.
const candidates = querySqlite(
  dbPath,
  `SELECT id, email, tier, partner_pro_grant_expires_at, subscription_status,
          stripe_subscription_id
   FROM users
   WHERE partner_tier = 'creator'
     AND partner_pro_grant_expires_at IS NOT NULL
     AND partner_pro_grant_expires_at < '${escapeSqlLiteral(nowIso)}'
     AND tier = 'pro'
     AND (
       stripe_subscription_id IS NULL
       OR subscription_status IS NULL
       OR subscription_status NOT IN ('active', 'trialing')
     );`,
);

console.log(`Auth DB: ${dbPath}`);
console.log(`Cutoff:  partner_pro_grant_expires_at < ${nowIso}`);
console.log(`Candidates: ${candidates.length}`);

for (const c of candidates) {
  console.log(
    `  - ${c.email}  expired=${c.partner_pro_grant_expires_at}  sub=${c.subscription_status ?? '(none)'}`,
  );
}

if (candidates.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

if (cliArgs.dryRun) {
  console.log(
    `\nWould also revoke API keys for each partner above (key admin: ${
      keyAdminReady ? 'configured' : 'NOT CONFIGURED — revocation would be skipped'
    }).`,
  );
  console.log('[dry-run] No changes written.');
  process.exit(0);
}

let keysRevokedTotal = 0;
const revokeFailures = [];

for (const c of candidates) {
  execSqlite(
    dbPath,
    `UPDATE users SET tier = 'public', updated_at = '${escapeSqlLiteral(nowIso)}'
     WHERE id = '${escapeSqlLiteral(c.id)}' AND tier = 'pro';`,
  );
  const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
  execSqlite(
    dbPath,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (
       '${escapeSqlLiteral(auditId)}',
       'partner_grant_expired',
       '${escapeSqlLiteral(c.id)}',
       NULL,
       '${escapeSqlLiteral(c.email)}',
       'expire-partner-grants-script',
       '${escapeSqlLiteral(`grant expired at ${c.partner_pro_grant_expires_at}; tier pro -> public`)}',
       '${escapeSqlLiteral(nowIso)}'
     );`,
  );

  // Revoke AFTER the tier change commits: the downgrade is the primary job and
  // must stand even if the key service is down. The cost of that ordering is
  // that a failure here is not retried by a later run (the partner no longer
  // matches the candidate query), which is what --backfill-revocations exists
  // to sweep up — so failures are surfaced as a non-zero exit, not logged and
  // forgotten.
  const outcome = await revokeKeysFor(c.email, c.tier);
  if (outcome.status === 'failed') {
    revokeFailures.push(`${c.email}: ${outcome.error}`);
    console.error(`  key revocation FAILED for ${c.email} — ${outcome.error}`);
  } else {
    keysRevokedTotal += outcome.revoked;
  }
}

console.log(`\nDowngraded ${candidates.length} partner(s) to tier='public'.`);
if (keyAdminReady) {
  console.log(`Revoked ${keysRevokedTotal} API key(s) across those partners.`);
} else {
  console.error(
    'WARNING: ZEROGEX_API_TOKEN / ZEROGEX_ADMIN_TOKEN are not set, so NO API keys were revoked.',
  );
  console.error(
    '         Keys minted during the grant still authenticate. Set both, then run:',
  );
  console.error('           make partner-grant-revoke-backfill YES=1');
}
if (revokeFailures.length > 0) {
  console.error(`\n${revokeFailures.length} key revocation(s) FAILED:`);
  for (const f of revokeFailures) console.error(`  - ${f}`);
  console.error('Retry with: make partner-grant-revoke-backfill YES=1');
}
if (!keyAdminReady || revokeFailures.length > 0) {
  // Non-zero so the systemd timer records a failure. The downgrades above are
  // committed and the sweep is idempotent, so a retry is safe.
  process.exit(3);
}
