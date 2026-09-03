#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/scan-trial-engagement.mts
//   node --experimental-strip-types --no-warnings scripts/scan-trial-engagement.mts --dormant-only
//
// Read-only. Lists every member currently on a free trial with whether they
// have actually used the product since signing up, soonest conversion first.
//
// This is the review surface for the cohort that produced dispute
// du_1U6cn34AOiqteMYYYCr2OaKn: a member who signed up, spent half an hour on
// the product, never came back, and disputed the charge when the trial
// converted a week later. The send-trial-reminders cron already mails that
// cohort different copy on its own; this exists so the cohort can be looked at
// directly, before the reminder goes out and before the charge lands.
//
// Writes nothing and calls neither Stripe nor Resend.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  classifyTrialEngagement,
  daysSinceLastSeen,
  RETURN_VISIT_AFTER_HOURS,
  type TrialEngagement,
} from '../core/trialEngagement.ts';

type Args = { dormantOnly: boolean; help: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { dormantOnly: false, help: false };
  for (const arg of argv) {
    if (arg === '--dormant-only') args.dormantOnly = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  console.log(`
Usage: scan-trial-engagement.mts [--dormant-only]

Lists members on a free trial and whether they have used the product since
signing up. Read-only.

  --dormant-only   Show only members with no activity since the signup session.

Engagement is classified from users.last_seen_at against the account's
created_at: activity more than ${RETURN_VISIT_AFTER_HOURS}h after signup counts as a return visit.
'unknown' means the account predates the last_seen_at column — it is NOT a
dormant member, and is reported separately for that reason.
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

type Row = {
  email: string;
  created_at: string | null;
  last_seen_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number | null;
};

const rows = querySqlite<Row>(
  dbPath,
  `SELECT email, created_at, last_seen_at, current_period_end, cancel_at_period_end
   FROM users
   WHERE subscription_status = 'trialing'
     AND deleted_at IS NULL
   ORDER BY current_period_end ASC;`,
);

const nowIso = new Date().toISOString();

type Scored = Row & { engagement: TrialEngagement; idleDays: number | null };
const scored: Scored[] = rows.map((r) => ({
  ...r,
  engagement: classifyTrialEngagement({
    trialStartIso: r.created_at,
    lastSeenAtIso: r.last_seen_at,
  }),
  idleDays: daysSinceLastSeen(r.last_seen_at, nowIso),
}));

const shown = cliArgs.dormantOnly ? scored.filter((r) => r.engagement === 'dormant') : scored;

console.log(`Auth DB:        ${dbPath}`);
console.log(`Trialing now:   ${scored.length}`);
console.log(
  `Breakdown:      ${scored.filter((r) => r.engagement === 'engaged').length} engaged, ` +
    `${scored.filter((r) => r.engagement === 'dormant').length} dormant, ` +
    `${scored.filter((r) => r.engagement === 'unknown').length} unknown`,
);

if (shown.length === 0) {
  console.log(cliArgs.dormantOnly ? '\nNo dormant trials. Nothing to review.' : '\nNo active trials.');
  process.exit(0);
}

console.log('');
console.log(
  `${'EMAIL'.padEnd(34)}${'ENGAGEMENT'.padEnd(12)}${'IDLE'.padEnd(8)}${'CONVERTS'.padEnd(26)}CANCELING`,
);
for (const r of shown) {
  const idle = r.idleDays === null ? '—' : `${r.idleDays}d`;
  console.log(
    r.email.slice(0, 33).padEnd(34) +
      r.engagement.padEnd(12) +
      idle.padEnd(8) +
      (r.current_period_end ?? '—').padEnd(26) +
      (Number(r.cancel_at_period_end) === 1 ? 'yes' : 'no'),
  );
}

const dormant = scored.filter((r) => r.engagement === 'dormant' && Number(r.cancel_at_period_end) !== 1);
if (dormant.length > 0) {
  console.log('');
  console.log(
    `${dormant.length} trial(s) will convert to a paid charge on a member who has not used the`,
  );
  console.log(
    'product since signing up. The 48h reminder sends them charge-first copy with no',
  );
  console.log(
    'annual lock-in offer; beyond that they are ordinary conversions and are not',
  );
  console.log('canceled or held back by anything.');
}
