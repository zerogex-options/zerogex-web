#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/scan-renewal-engagement.mts
//   node --experimental-strip-types --no-warnings scripts/scan-renewal-engagement.mts --dormant-only
//
// Read-only. Lists every ACTIVE paying subscriber with whether they have used
// the product lately and how close their renewal is, soonest renewal first.
//
// scan-trial-engagement.mts covers the trial boundary. This covers every
// renewal after it — the gap described in
// docs/renewal-dormancy-reminder-scope.md: a member who paid for months and
// stopped logging in is re-billed with no dormancy-aware touch at all.
//
// This is deliberately STEP 0 of that scope, and it sends nothing. The cohort
// size is what decides whether the send path is worth building: three dormant
// renewals means the feature is a doc and a cron nobody needs; three hundred
// means it is the best retention work on the board. Read this output before
// writing a single line of the send path.
//
// Writes nothing and calls neither Stripe nor Resend.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  decideRenewalReminder,
  idleDays,
  clampDormancyDays,
  clampLeadHours,
  DEFAULT_DORMANCY_DAYS,
  DEFAULT_LEAD_HOURS,
  type RenewalEngagement,
  type RenewalSkipReason,
} from '../core/renewalEngagement.ts';

type Args = {
  dormantOnly: boolean;
  help: boolean;
  dormancyDays: number;
  leadHours: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dormantOnly: false,
    help: false,
    dormancyDays: DEFAULT_DORMANCY_DAYS,
    leadHours: DEFAULT_LEAD_HOURS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dormant-only') args.dormantOnly = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--dormancy-days') args.dormancyDays = Number(argv[(i += 1)]);
    else if (arg === '--lead-hours') args.leadHours = Number(argv[(i += 1)]);
  }
  // Clamped by the same helpers the decision uses, so the header cannot claim a
  // window the classifier is not actually applying.
  args.dormancyDays = clampDormancyDays(args.dormancyDays);
  args.leadHours = clampLeadHours(args.leadHours);
  return args;
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  console.log(`
Usage: scan-renewal-engagement.mts [--dormant-only] [--dormancy-days N] [--lead-hours N]

Lists ACTIVE paying subscribers and whether they have used the product lately,
with how close each renewal is. Read-only — sends nothing, writes nothing.

  --dormant-only     Show only members with no activity in the dormancy window.
  --dormancy-days N  Idle days before a member counts as dormant (default ${DEFAULT_DORMANCY_DAYS}, clamped 7-90).
  --lead-hours N     How close a renewal must be to count as in-window (default ${DEFAULT_LEAD_HOURS}, clamped 24-168).

Engagement is classified from users.last_seen_at, which core/serverAuth.ts
rewrites on authenticated requests (throttled to 15m). 'unknown' means the
account predates that column — it is NOT a dormant member, and is excluded from
the eligible count for that reason.

WOULD-SEND counts the members a pre-renewal dormancy reminder would mail today
if the send path existed. It does not exist yet; see
docs/renewal-dormancy-reminder-scope.md.

Reads AUTH_DB_PATH from env or frontend/.env.local, falling back to
frontend/data/auth.db.
`.trim());
  process.exit(0);
}

// Same resolution the other operational scripts use: an explicit env var wins,
// then frontend/.env.local, then the in-repo default. Reading .env.local is the
// load-bearing part — AUTH_DB_PATH lives there in production (/var/lib/zerogex/
// auth.db), and without it this silently falls back to the in-repo path, where
// a leftover empty auth.db passes the existsSync check below and then fails
// deep inside a query with "no such table: users".
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

function ensureSqlite3Cli(): void {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

// Existence is not enough: an empty or stale auth.db is a file too. Fail here,
// naming the path, instead of surfacing a raw execFileSync stack trace.
function ensureUsersTable(file: string): void {
  const probe = spawnSync(
    'sqlite3',
    ['-json', file, "SELECT name FROM sqlite_master WHERE type='table' AND name='users';"],
    { encoding: 'utf8' },
  );
  if (probe.status !== 0 || !probe.stdout.trim()) {
    console.error(`No 'users' table in ${file} — that is not the live auth DB.`);
    console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
    process.exit(1);
  }
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}
ensureSqlite3Cli();
ensureUsersTable(dbPath);

function querySqlite<T>(file: string, sql: string): T[] {
  const out = execFileSync('sqlite3', ['-json', file, sql], { encoding: 'utf8' }).trim();
  return out ? (JSON.parse(out) as T[]) : [];
}

// The latch column ships with the send path, not with this scan. Until it
// exists every member reads as never-notified, which is true; once it does,
// selecting it keeps WOULD-SEND honest instead of re-counting members the cron
// already mailed.
const hasLatchColumn = querySqlite<{ name: string }>(dbPath, 'PRAGMA table_info(users);').some(
  (c) => c.name === 'renewal_dormancy_notified_period',
);

type Row = {
  email: string;
  last_seen_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number | null;
  first_payment_at: string | null;
  renewal_dormancy_notified_period: string | null;
};

// Cohort is verbatim from send-card-expiry-reminders.mts: the active paying
// book. status = 'active' is also what keeps this disjoint from the trial cron,
// which selects status = 'trialing'.
const rows = querySqlite<Row>(
  dbPath,
  `SELECT email, last_seen_at, current_period_end, cancel_at_period_end, first_payment_at,
          ${hasLatchColumn ? 'renewal_dormancy_notified_period' : 'NULL AS renewal_dormancy_notified_period'}
   FROM users
   WHERE subscription_status = 'active'
     AND stripe_subscription_id IS NOT NULL
     AND stripe_customer_id IS NOT NULL
     AND deleted_at IS NULL
   ORDER BY current_period_end ASC;`,
);

const nowIso = new Date().toISOString();

type Scored = Row & {
  engagement: RenewalEngagement;
  reason: RenewalSkipReason | 'eligible';
  wouldSend: boolean;
  idle: number | null;
  hoursToRenewal: number | null;
};

const scored: Scored[] = rows.map((r) => {
  const decision = decideRenewalReminder({
    cancelAtPeriodEnd: Number(r.cancel_at_period_end) === 1,
    firstPaymentClearedAtIso: r.first_payment_at,
    currentPeriodEndIso: r.current_period_end,
    lastSeenAtIso: r.last_seen_at,
    alreadyNotifiedPeriod: r.renewal_dormancy_notified_period,
    nowIso,
    leadHours: cliArgs.leadHours,
    dormancyDays: cliArgs.dormancyDays,
  });
  return {
    ...r,
    engagement: decision.engagement,
    reason: decision.reason,
    wouldSend: decision.shouldSend,
    idle: idleDays(r.last_seen_at, nowIso),
    hoursToRenewal: decision.hoursToRenewal,
  };
});

const countBy = (e: RenewalEngagement) => scored.filter((r) => r.engagement === e).length;
const unknownCount = countBy('unknown');

// One monthly billing cycle. WOULD-SEND is a single day's slice of a lead
// window only hours wide, so on a book this size it is nearly always 0 whatever
// the underlying dormancy rate — reading it as "no cohort" is the same mistake
// as reading a truncated history as "no dormancy". The decision-relevant number
// is how many dormant renewals arrive over a whole cycle.
const RENEWAL_HORIZON_DAYS = 30;
const cycleCohort = scored.filter(
  (r) =>
    r.engagement === 'dormant' &&
    Number(r.cancel_at_period_end) !== 1 &&
    r.first_payment_at !== null &&
    r.hoursToRenewal !== null &&
    r.hoursToRenewal > 0 &&
    r.hoursToRenewal <= RENEWAL_HORIZON_DAYS * 24,
);
const dormant = scored.filter((r) => r.engagement === 'dormant');
const wouldSend = scored.filter((r) => r.wouldSend);

console.log(`Auth DB:        ${dbPath}`);
console.log(`Dormancy:       ${cliArgs.dormancyDays}d idle    Lead window: ${cliArgs.leadHours}h`);
console.log(`Active paid:    ${scored.length}`);
console.log(
  `Breakdown:      ${countBy('engaged')} engaged, ${countBy('dormant')} dormant, ` +
    `${countBy('unknown')} unknown`,
);
console.log(`Would send:     ${wouldSend.length} (dormant AND renewing within ${cliArgs.leadHours}h — today only)`);
console.log(
  `${`Next ${RENEWAL_HORIZON_DAYS}d:`.padEnd(16)}${cycleCohort.length} dormant renewal(s) — the per-cycle ` +
    `cohort, and the number to build on`,
);
if (!hasLatchColumn) {
  console.log(`                (no latch column yet — send path unbuilt, nothing suppressed)`);
}

const shown = cliArgs.dormantOnly ? dormant : scored;

if (shown.length === 0) {
  console.log(
    cliArgs.dormantOnly ? '\nNo dormant subscribers. Nothing to review.' : '\nNo active subscribers.',
  );
  process.exit(0);
}

console.log('');
console.log(
  `${'EMAIL'.padEnd(34)}${'ENGAGEMENT'.padEnd(12)}${'IDLE'.padEnd(8)}${'RENEWS IN'.padEnd(12)}` +
    `${'SEND?'.padEnd(7)}REASON`,
);
for (const r of shown) {
  const renewsIn =
    r.hoursToRenewal === null
      ? '—'
      : r.hoursToRenewal < 48
        ? `${Math.round(r.hoursToRenewal)}h`
        : `${Math.floor(r.hoursToRenewal / 24)}d`;
  console.log(
    r.email.slice(0, 33).padEnd(34) +
      r.engagement.padEnd(12) +
      (r.idle === null ? '—' : `${r.idle}d`).padEnd(8) +
      renewsIn.padEnd(12) +
      (r.wouldSend ? 'yes' : 'no').padEnd(7) +
      r.reason,
  );
}

// The number the scope doc says to read before building anything else.
//
// Guarded, because a zero here has two very different meanings. users.last_seen_at
// only started being written when that column shipped, so the observable history
// is as young as the column: until it is older than the dormancy threshold, NO
// member can be classified dormant no matter how inactive they are, and a naked
// "0 dormant" reads as a retention triumph when it is really "not measurable
// yet". The maximum idle actually observed is the tell — if it is below the
// threshold, the window is the binding constraint, not the members' behavior.
const observedIdle = scored.map((r) => r.idle).filter((d): d is number => d !== null);
const maxIdle = observedIdle.length > 0 ? Math.max(...observedIdle) : null;
const historyTooShort = maxIdle !== null && maxIdle < cliArgs.dormancyDays;

console.log('');
if (unknownCount > 0) {
  console.log(
    `${unknownCount} member(s) have no last_seen_at at all — no authenticated request since` +
      ` that column`,
  );
  console.log(
    'shipped. They are excluded from every count above: unknown is not dormant. They are',
  );
  console.log('the closest thing to a dormancy signal available, and the first place to look.');
  console.log('');
}
if (dormant.length === 0 && historyTooShort) {
  console.log(
    `No member can be dormant yet: the longest idle stretch on record is ${maxIdle}d, short of the`,
  );
  console.log(
    `${cliArgs.dormancyDays}d threshold, so last_seen_at history is still younger than the window it is being`,
  );
  console.log('measured against. This is NOT evidence that nobody goes dormant — the question is');
  console.log(
    `not answerable for another ~${cliArgs.dormancyDays - maxIdle}d. Re-run then, or re-cut it now with a threshold`,
  );
  console.log(`inside the history, e.g. DORMANCY_DAYS=${Math.max(7, Math.floor(maxIdle / 2))}.`);
} else if (dormant.length === 0) {
  console.log('No dormant paying members. The send path has no cohort to serve — do not build it');
  console.log('yet; re-run this as the paid book grows.');
} else {
  console.log(
    `${dormant.length} paying member(s) have not used the product in ${cliArgs.dormancyDays}+ days.`,
  );
  console.log(
    `${cycleCohort.length} of them renew within ${RENEWAL_HORIZON_DAYS}d and are not already canceling: that is what the`,
  );
  console.log("send path would mail per cycle, and the number to weigh. Today's would-send");
  console.log(
    `(${wouldSend.length}) is only a ${cliArgs.leadHours}h slice of it and will read 0 on most days regardless.`,
  );
  console.log('');
  console.log('Nothing warns these members before the renewal charge lands — the gap in');
  console.log('docs/renewal-dormancy-reminder-scope.md. Weigh it against the churn risk of');
  console.log('contacting them at all (scope §2 and §5) before building the send path.');
}
