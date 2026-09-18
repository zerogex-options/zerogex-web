#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/scan-duplicate-accounts.mts \
//     [--max-per-ip 20] [--min-accounts 2] [--shape <name>] [--exclude-ip <ip>] \
//     [--since-days N] [--verbose]
//
// Find the people who hold more than one account.
//
// WHY. A member wrote in certain we had charged him, while everything on the
// address he wrote from said we had never collected a penny. Both were true. He
// had hit a full-price, no-trial checkout on his original account — priced that
// way because a lapsed TRIAL had flagged it as a returning paid customer —
// abandoned it, and opened a second account under a second email three and a
// half hours later. That one took a seven-day trial, a 50% campaign code, and
// has been paying since.
//
// Nothing joined the two accounts. Different emails, different Stripe
// customers, and a payment method (Link) that carries no card fingerprint, so
// even a card-level sweep across the whole Stripe account could not have found
// it. The one thing that did join them was already in our own database: both
// were operated from the same IP, stamped on every checkout, login and logout.
//
// This sweep asks how often that has happened.
//
// WHAT IT IS NOT. A shared address is not an identity. Households, offices,
// carriers behind CGNAT and every VPN exit put unrelated people on one address.
// So an address with a crowd behind it is dropped as infrastructure rather than
// reported as a person, every cluster is ranked by what it would cost if real,
// and the output is a list of things to LOOK AT. Nothing here is a finding on
// its own, and the script refuses to pretend otherwise.
//
// STRICTLY READ-ONLY. No Stripe calls, no writes, no email.
//
// Set AUTH_DB_PATH to override the default DB path (data/auth.db).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  classifyCluster,
  closestSignupGapHours,
  compareClusters,
  handoffGapHours,
  DEFAULT_MAX_ACCOUNTS_PER_IP,
  grantedATrial,
  parseTrialGrant,
  type ClusterAccount,
  type ClusterShape,
  type ClusterVerdict,
} from '../core/duplicateAccounts.ts';

const SHAPES: ClusterShape[] = [
  'multiple_paying',
  'trial_recycled',
  'paid_and_dormant',
  'all_free',
];

type Args = {
  maxPerIp: number;
  minAccounts: number;
  shape: ClusterShape | null;
  excludeIps: string[];
  sinceDays: number | null;
  verbose: boolean;
  help: boolean;
};

function usage() {
  console.log(`Find members who hold more than one account, by shared IP.

Usage:
  node --experimental-strip-types --no-warnings scripts/scan-duplicate-accounts.mts [options]

Options:
  --max-per-ip <n>    Drop any address with more than n distinct accounts behind
                      it — that is a network, not a person (default ${DEFAULT_MAX_ACCOUNTS_PER_IP}).
  --min-accounts <n>  Only report clusters of at least n accounts (default 2).
  --shape <name>      Only this kind: ${SHAPES.join(' | ')}.
  --exclude-ip <ip>   Ignore an address entirely. Repeatable — use it for your
                      own office and test machines.
  --since-days <n>    Only consider accounts created in the last n days.
  --verbose           Also print every address a cluster was joined on.
  --help              Show this help.

Read-only. No Stripe calls, no writes, no email.

A shared address is a POINTER, not proof. Read every cluster before acting, and
confirm with:  make diagnose-user EMAIL=<one of them>
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    maxPerIp: DEFAULT_MAX_ACCOUNTS_PER_IP,
    minAccounts: 2,
    shape: null,
    excludeIps: [],
    sinceDays: null,
    verbose: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--verbose') args.verbose = true;
    else if (arg === '--exclude-ip') args.excludeIps.push((argv[++i] ?? '').trim());
    else if (arg === '--shape') {
      const raw = (argv[++i] ?? '').trim() as ClusterShape;
      if (!SHAPES.includes(raw)) {
        console.error(`Error: --shape must be one of ${SHAPES.join(', ')}.`);
        process.exit(1);
      }
      args.shape = raw;
    } else if (arg === '--max-per-ip' || arg === '--min-accounts' || arg === '--since-days') {
      const parsed = Number.parseInt(argv[++i] ?? '', 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error(`Error: ${arg} needs a positive number.`);
        process.exit(1);
      }
      if (arg === '--max-per-ip') args.maxPerIp = parsed;
      else if (arg === '--min-accounts') args.minAccounts = parsed;
      else args.sinceDays = parsed;
    } else {
      console.error(`Error: unknown argument ${arg}. See --help.`);
      process.exit(1);
    }
  }
  return args;
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  try {
    const out = execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return out ? (JSON.parse(out) as T[]) : [];
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
}

function money(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  process.exit(1);
}
ensureSqlite3Cli();

// --- Which addresses are people, and which are networks ----------------------

const excluded = new Set(cliArgs.excludeIps);
const ipRows = querySqlite<{ ip: string; users: number }>(
  dbPath,
  `SELECT ip, COUNT(DISTINCT user_id) AS users
     FROM audit_events
    WHERE ip IS NOT NULL AND ip != '' AND ip NOT IN ('manual-script', 'cron', 'script')
      AND user_id IS NOT NULL
    GROUP BY ip
   HAVING users > 1;`,
);
const crowdedIps = ipRows.filter((row) => row.users > cliArgs.maxPerIp);
const usableIps = ipRows.filter((row) => row.users <= cliArgs.maxPerIp && !excluded.has(row.ip));

console.log('=== Duplicate-account sweep (shared IP) ===');
console.log(`  DB                           ${dbPath}`);
console.log(`  Addresses with >1 account    ${ipRows.length}`);
console.log(`  Dropped as networks          ${crowdedIps.length} (more than ${cliArgs.maxPerIp} accounts behind them)`);
if (excluded.size > 0) console.log(`  Excluded by hand             ${[...excluded].join(', ')}`);
console.log(`  Addresses considered         ${usableIps.length}`);
if (cliArgs.verbose && crowdedIps.length > 0) {
  for (const row of crowdedIps) console.log(`    network: ${row.ip} (${row.users} accounts)`);
}

if (usableIps.length === 0) {
  console.log('\nNo shared addresses to group on. Nothing to report.');
  process.exit(0);
}

// --- Group accounts into clusters by transitive IP overlap -------------------
// Union-find, because two accounts can be joined through a third: A and B share
// one address, B and C share another, and all three are one person moving
// between home and phone. Grouping per-IP instead would report that as two
// separate pairs and read as twice the problem.

const parent = new Map<string, string>();
function find(id: string): string {
  let root = parent.get(id) ?? id;
  if (root !== id) {
    root = find(root);
    parent.set(id, root);
  }
  return root;
}
function union(a: string, b: string) {
  const ra = find(a);
  const rb = find(b);
  if (ra !== rb) parent.set(ra, rb);
}

const ipList = usableIps.map((row) => `'${escapeSqlLiteral(row.ip)}'`).join(', ');
const membership = querySqlite<{ ip: string; user_id: string; hits: number; last_seen: string }>(
  dbPath,
  `SELECT ip, user_id, COUNT(*) AS hits, MAX(created_at) AS last_seen
     FROM audit_events
    WHERE ip IN (${ipList}) AND user_id IS NOT NULL
    GROUP BY ip, user_id;`,
);

const ipsByUser = new Map<string, Set<string>>();
const usersByIp = new Map<string, string[]>();
for (const row of membership) {
  (ipsByUser.get(row.user_id) ?? ipsByUser.set(row.user_id, new Set()).get(row.user_id)!).add(row.ip);
  usersByIp.set(row.ip, [...(usersByIp.get(row.ip) ?? []), row.user_id]);
}
for (const users of usersByIp.values()) {
  for (let i = 1; i < users.length; i += 1) union(users[0], users[i]);
}

// --- Load what each account actually is --------------------------------------

const userIds = [...ipsByUser.keys()];
const idList = userIds.map((id) => `'${escapeSqlLiteral(id)}'`).join(', ');
const sinceClause = cliArgs.sinceDays
  ? `AND u.created_at >= '${escapeSqlLiteral(new Date(Date.now() - cliArgs.sinceDays * 86_400_000).toISOString())}'`
  : '';

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  tier: string | null;
  first_payment_at: string | null;
  deleted_at: string | null;
  collected: number | null;
};
const users = querySqlite<UserRow>(
  dbPath,
  `SELECT u.id, u.email, u.created_at, u.tier, u.first_payment_at, u.deleted_at,
          (SELECT SUM(h.amount_paid) FROM stripe_invoice_history h
            WHERE h.user_id = u.id AND h.status = 'paid' AND h.amount_paid > 0) AS collected
     FROM users u
    WHERE u.id IN (${idList}) ${sinceClause};`,
);

// Which accounts were granted a free trial, read off their own checkout rows.
const trialRows = querySqlite<{ user_id: string; message: string }>(
  dbPath,
  `SELECT user_id, message FROM audit_events
    WHERE type = 'billing_checkout_started' AND user_id IN (${idList});`,
);
const tookTrial = new Set<string>();
for (const row of trialRows) {
  if (grantedATrial(parseTrialGrant(row.message))) tookTrial.add(row.user_id);
}

const accountById = new Map<string, ClusterAccount>();
for (const row of users) {
  const collected = Number(row.collected ?? 0);
  accountById.set(row.id, {
    userId: row.id,
    email: row.email,
    createdAt: row.created_at,
    tier: row.tier ?? 'public',
    // Same two sources core/paidHistory.ts uses, for the same reason: they fail
    // in opposite directions and neither may veto the other.
    everPaid: row.first_payment_at != null || collected > 0,
    lifetimeCollectedMinor: collected,
    tookTrial: tookTrial.has(row.id),
    deletedAt: row.deleted_at,
  });
}

// --- Assemble, classify, rank ------------------------------------------------

const clusters = new Map<string, ClusterAccount[]>();
for (const id of userIds) {
  const account = accountById.get(id);
  if (!account) continue; // filtered out by --since-days
  const root = find(id);
  clusters.set(root, [...(clusters.get(root) ?? []), account]);
}

type Report = { verdict: ClusterVerdict; accounts: ClusterAccount[]; ips: string[] };
const reports: Report[] = [];
for (const accounts of clusters.values()) {
  if (accounts.length < cliArgs.minAccounts) continue;
  const verdict = classifyCluster(accounts);
  if (cliArgs.shape && verdict.shape !== cliArgs.shape) continue;
  const ips = [...new Set(accounts.flatMap((a) => [...(ipsByUser.get(a.userId) ?? [])]))];
  reports.push({ verdict, accounts, ips });
}
reports.sort(compareClusters);

const counts = new Map<ClusterShape, number>();
for (const report of reports) {
  counts.set(report.verdict.shape, (counts.get(report.verdict.shape) ?? 0) + 1);
}

console.log('');
console.log(`  Clusters found               ${reports.length}`);
for (const shape of SHAPES) {
  const n = counts.get(shape) ?? 0;
  if (n > 0) console.log(`    ${shape.padEnd(18)} ${n}`);
}

if (reports.length === 0) {
  console.log('\nNothing to look at.');
  process.exit(0);
}

// Event times for the accounts that actually made the report, so the handoff
// gap can be computed. Scoped to reported clusters rather than every account
// touched, because this is the one query that scales with history rather than
// with the number of duplicates.
const reportedIds = [...new Set(reports.flatMap((r) => r.accounts.map((a) => a.userId)))];
const eventTimesByUser = new Map<string, number[]>();
if (reportedIds.length > 0) {
  const list = reportedIds.map((id) => `'${escapeSqlLiteral(id)}'`).join(', ');
  for (const row of querySqlite<{ user_id: string; created_at: string }>(
    dbPath,
    `SELECT user_id, created_at FROM audit_events WHERE user_id IN (${list});`,
  )) {
    const at = Date.parse(row.created_at);
    if (!Number.isFinite(at)) continue;
    eventTimesByUser.set(row.user_id, [...(eventTimesByUser.get(row.user_id) ?? []), at]);
  }
}

console.log('\n=== Clusters, most expensive first ===');
for (const [index, report] of reports.entries()) {
  const gap = closestSignupGapHours(report.accounts);
  const handoff = handoffGapHours(report.accounts, eventTimesByUser);
  console.log('');
  console.log(
    `${String(index + 1).padStart(3)}. ${report.verdict.shape.toUpperCase()}  ` +
      `${report.accounts.length} accounts  collected ${money(report.verdict.collectedMinor)}` +
      `${gap == null ? '' : `  signups ${gap}h apart`}`,
  );
  console.log(`     ${report.verdict.why}`);
  if (handoff) {
    // The strongest single line in the report: one account stopped, another
    // began, this close together.
    console.log(
      `     HANDOFF: ${handoff.fromEmail} last acted ${handoff.hours}h before ` +
        `${handoff.toEmail} was created`,
    );
  }
  for (const account of report.accounts.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const flags = [
      account.everPaid ? `PAID ${money(account.lifetimeCollectedMinor)}` : 'never paid',
      account.tookTrial ? 'took a trial' : null,
      account.deletedAt ? 'DELETED' : null,
    ]
      .filter(Boolean)
      .join(', ');
    console.log(
      `       ${account.email.padEnd(36)} ${(account.tier ?? '').padEnd(7)} ` +
        `created ${account.createdAt.slice(0, 10)}  [${flags}]`,
    );
  }
  if (cliArgs.verbose) console.log(`       joined on: ${report.ips.join(', ')}`);
}

console.log('');
console.log('A shared address is a POINTER, not proof — households, offices, carriers and');
console.log('VPNs all put unrelated people on one address. Read each cluster before acting:');
console.log('  make diagnose-user EMAIL=<one of them>');
console.log('');
