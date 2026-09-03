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
import { execFileSync } from 'node:child_process';

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
`.trim());
  process.exit(0);
}

// Mirrors the DB path resolution the other scripts use.
const dbPath = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at ${dbPath}. Set AUTH_DB_PATH.`);
  process.exit(1);
}

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
const dormant = scored.filter((r) => r.engagement === 'dormant');
const wouldSend = scored.filter((r) => r.wouldSend);

console.log(`Auth DB:        ${dbPath}`);
console.log(`Dormancy:       ${cliArgs.dormancyDays}d idle    Lead window: ${cliArgs.leadHours}h`);
console.log(`Active paid:    ${scored.length}`);
console.log(
  `Breakdown:      ${countBy('engaged')} engaged, ${countBy('dormant')} dormant, ` +
    `${countBy('unknown')} unknown`,
);
console.log(`Would send:     ${wouldSend.length} (dormant AND renewing within ${cliArgs.leadHours}h)`);
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
console.log('');
if (dormant.length === 0) {
  console.log('No dormant paying members. The send path has no cohort to serve — do not build it');
  console.log('yet; re-run this as the paid book grows.');
} else {
  console.log(
    `${dormant.length} paying member(s) have not used the product in ` +
      `${cliArgs.dormancyDays}+ days; ${wouldSend.length} would be mailed today.`,
  );
  console.log('Nothing warns them before the renewal charge lands — that is the gap in');
  console.log('docs/renewal-dormancy-reminder-scope.md. Weigh this cohort size against the churn');
  console.log('risk of contacting them at all (scope §2 and §5) before building the send path.');
}
