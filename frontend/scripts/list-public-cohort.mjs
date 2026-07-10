#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --no-warnings scripts/list-public-cohort.mjs \
//     [--emails] [--cohort <name>] [--since <date>]
//
// Breaks down every user currently on tier='public' into the four sub-
// cohorts that drive a reactivation campaign:
//
//   unverified           — never clicked the verify-email link, so they're
//                          procedurally blocked from checkout regardless
//                          of any incentive.
//   founding-eligible    — has founding_eligible=1 and never redeemed; the
//                          founding rate is a time-bound (FOUNDING_LOCKIN_
//                          DEADLINE_ISO) hook with the strongest pitch.
//   churned              — subscription_lapsed=1; they tried the product
//                          and decided no. Only segment where a fresh
//                          discount via PROMO_END_AT is worth burning.
//   verified-never-paid  — the bulk. Verified email, never opened checkout.
//                          The 7-day trial is the natural ask; no discount.
//
// Classification is priority-ordered: unverified wins because nothing else
// matters until verification is done; founding-eligible beats churned so a
// founding-eligible churner gets the higher-value pitch; verified-never-paid
// is the residual.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const COHORTS = [
  {
    id: 'unverified',
    label: 'Unverified',
    hint:
      'Signed up but never clicked the verification email. Pitch: resend the link, NOT a discount — they\'re blocked at api/billing/checkout/route.ts:102 until verified.',
  },
  {
    id: 'founding-eligible',
    label: 'Founding-eligible, never redeemed',
    hint:
      'Has founding_eligible=1, no founding_member_started_at. Pitch: the founding rate before the FOUNDING_LOCKIN_DEADLINE (2026-07-01). Highest-conversion segment.',
  },
  {
    id: 'churned',
    label: 'Churned',
    hint:
      'subscription_lapsed=1. Automated ~1-month-after-churn win-back email owns this cohort (scripts/send-winback.mts): "what\'s new since you left" + a discount (live PROMO_END_AT promo, else reply-\'discount\'-for-25%-off). Latched via users.winback_email_sent_at.',
  },
  {
    id: 'verified-never-paid',
    label: 'Verified, never subscribed',
    hint:
      'The bulk. Pitch: "your 7-day free trial is one click away — cancel anytime, you won\'t be billed." No discount needed; the trial removes the financial risk.',
  },
];
const COHORT_IDS = new Set(COHORTS.map((c) => c.id));

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

function parseArgs(argv) {
  const args = {
    emails: false,
    cohort: null,
    showLastLogin: false,
    warmDays: 30,
    since: null,
    viaMake: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--emails') args.emails = true;
    else if (arg === '--cohort') args.cohort = argv[++i] ?? null;
    else if (arg === '--show-last-login') args.showLastLogin = true;
    else if (arg === '--warm-days') {
      const value = Number(argv[++i] ?? '');
      if (!Number.isFinite(value) || value <= 0) {
        console.error(`Error: --warm-days expects a positive number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.warmDays = value;
    } else if (arg === '--since') args.since = argv[++i] ?? null;
    else if (arg === '--via-make') args.viaMake = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --no-warnings scripts/list-public-cohort.mjs \\
    [--emails] [--cohort <name>] [--show-last-login] [--warm-days N] \\
    [--since <date>]

Prints every tier='public' user broken down by the cohort that drives the
reactivation pitch. Classification is priority-ordered (unverified beats
founding-eligible beats churned beats verified-never-paid), so each user
appears in exactly one cohort.

Modes:
  (default)             Summary table — counts + reactivation hint per
                        cohort. No PII printed.
  --emails              Print emails grouped under cohort-name headers, one
                        per line. Suitable for piping into Resend's UI.
  --cohort <name>       Restrict to one cohort. Names: ${COHORTS.map((c) => c.id).join(', ')}.
                        Combine with --emails for a paste-ready list.
  --show-last-login     Split each cohort into warm / cold / never by latest
                        audit_events login_success row. warm = within
                        --warm-days; cold = older; never = no login_success
                        row at all (registered, never came back, OR pre-
                        audit signup that never logged in explicitly).
  --warm-days N         Threshold (in days) for the warm bucket. Default 30.
  --since <date>        Restrict to users whose users.created_at is on or
                        after the cutoff (signup date). Accepts YYYY-MM-DD
                        or any ISO 8601 timestamp. The whole counts/percent
                        breakdown reflects the filtered cohort.

Reads AUTH_DB_PATH from env or .env.local (default frontend/data/auth.db).`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}
if (args.cohort && !COHORT_IDS.has(args.cohort)) {
  console.error(
    `Error: --cohort "${args.cohort}" is not one of ${[...COHORT_IDS].join(', ')}.`,
  );
  process.exit(1);
}

let sinceMs = null;
if (args.since) {
  // Accept either YYYY-MM-DD (the natural Make-side input via SINCE=) or a
  // full ISO 8601 timestamp. created_at is written as new Date().toISOString()
  // (see core/serverAuth.ts nowIso), so a numeric compare on Date.parse
  // round-trips cleanly.
  const parsed = Date.parse(args.since);
  if (!Number.isFinite(parsed)) {
    console.error(
      `Error: --since "${args.since}" is not a parseable date (try YYYY-MM-DD).`,
    );
    process.exit(1);
  }
  sinceMs = parsed;
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

const db = new DatabaseSync(dbPath);

// Defensive: every column we read was added by an ensureColumn migration
// at boot time. Skipping the check would crash on a pre-migration DB.
const userCols = new Set(
  db.prepare('PRAGMA table_info(users)').all().map((c) => c.name),
);
const requiredCols = [
  'email_verified_at',
  'stripe_customer_id',
  'subscription_lapsed',
  'founding_eligible',
  'founding_member_started_at',
];
const missing = requiredCols.filter((c) => !userCols.has(c));
if (missing.length > 0) {
  console.error(`Auth DB at ${dbPath} is missing columns: ${missing.join(', ')}.`);
  console.error('Boot the app once so core/db.ts migrations run, then re-run this script.');
  process.exit(1);
}

const allRows = db
  .prepare(
    `SELECT id, email, email_verified_at, stripe_customer_id,
            subscription_lapsed, founding_eligible, founding_member_started_at,
            created_at
     FROM users
     WHERE tier = 'public'
     ORDER BY created_at ASC`,
  )
  .all();

const rows = sinceMs == null
  ? allRows
  : allRows.filter((r) => {
      const parsed = Date.parse(r.created_at);
      // Unparseable created_at => exclude from a since-filtered run rather
      // than silently passing the user through; the filter is meant to be
      // a strict cutoff.
      return Number.isFinite(parsed) && parsed >= sinceMs;
    });

// Mirror of core/foundingLockin.ts — this plain `.mjs` (run under `node
// --no-warnings`, no --experimental-strip-types) can't import that .ts
// module the way the .mts senders do. KEEP THIS ISO IN SYNC with
// FOUNDING_LOCKIN_DEADLINE_ISO there; they intentionally encode the same
// instant so this diagnostic and send-verified-never-paid.mts agree on who
// is "founding-eligible" vs "verified-never-paid".
const FOUNDING_LOCKIN_DEADLINE_ISO = '2026-07-01T13:30:00.000Z';
function isFoundingLockinOpen(now = Date.now()) {
  const deadlineMs = Date.parse(FOUNDING_LOCKIN_DEADLINE_ISO);
  return Number.isFinite(deadlineMs) && now < deadlineMs;
}

function classify(u) {
  if (!u.email_verified_at) return 'unverified';
  // Founding-eligible only meaningful while they haven't redeemed yet —
  // founding_member_started_at gets stamped at first checkout (see
  // app/api/webhooks/stripe/route.ts:226 stampFoundingStart), so a former
  // founding member who churned falls through to the 'churned' bucket
  // instead of being pitched a discount they've already burned.
  //
  // AND only while the lock-in offer is still open. send-founding-final-call
  // hard-refuses to send past FOUNDING_LOCKIN_DEADLINE_ISO, so after the
  // deadline a founding-eligible-never-redeemed user has no campaign that
  // targets them here — they're reclassified down-priority (almost always
  // verified-never-paid, which now includes them too). Without this gate the
  // report shows a large 'founding-eligible' bucket that no automated email
  // reaches, which is exactly how the launch cohort went dark.
  if (
    isFoundingLockinOpen() &&
    Number(u.founding_eligible) === 1 &&
    !u.founding_member_started_at
  ) {
    return 'founding-eligible';
  }
  if (Number(u.subscription_lapsed) === 1) return 'churned';
  return 'verified-never-paid';
}

// Latest explicit login per user. Both the local-password /login flow
// (serverAuth.ts:452) and the OAuth callback returning-visit branch
// (serverAuth.ts createOrLoginOAuthUser) write `login_success`, so
// either auth method counts the user as active.
//
// A NULL last_login here means either:
//   - /register signup that auto-sessioned and never explicitly logged in
//     again (the comment in scripts/list-auth-users.mjs:99-102), OR
//   - OAuth signup that never returned (signup writes `oauth_login`, not
//     `login_success`, so the first OAuth callback for a fresh account
//     does NOT count as activity).
// Both are the same lead-quality signal: the user touched the site once
// at signup and has not been back since.
const lastLoginByUser = new Map();
if (args.showLastLogin) {
  const hasAudit = !!db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_events'")
    .get();
  if (!hasAudit) {
    console.error('Auth DB has no audit_events table — --show-last-login is unavailable.');
    process.exit(1);
  }
  const loginRows = db
    .prepare(
      `SELECT user_id, MAX(created_at) AS last_login_at
       FROM audit_events
       WHERE type = 'login_success' AND user_id IS NOT NULL
       GROUP BY user_id`,
    )
    .all();
  for (const r of loginRows) {
    if (r.user_id && r.last_login_at) lastLoginByUser.set(r.user_id, r.last_login_at);
  }
}

const TEMPERATURES = ['warm', 'cold', 'never'];
const warmThresholdMs = args.warmDays * 86_400_000;
function temperature(u) {
  const lastLogin = lastLoginByUser.get(u.id);
  if (!lastLogin) return 'never';
  const parsed = Date.parse(lastLogin);
  if (!Number.isFinite(parsed)) return 'never';
  return Date.now() - parsed <= warmThresholdMs ? 'warm' : 'cold';
}

const buckets = new Map(COHORTS.map((c) => [c.id, []]));
for (const row of rows) {
  buckets.get(classify(row)).push(row);
}

function splitByTemperature(bucket) {
  const split = { warm: [], cold: [], never: [] };
  for (const u of bucket) split[temperature(u)].push(u);
  return split;
}

if (args.emails) {
  const cohortsToPrint = args.cohort
    ? COHORTS.filter((c) => c.id === args.cohort)
    : COHORTS;
  for (const cohort of cohortsToPrint) {
    const bucket = buckets.get(cohort.id);
    if (bucket.length === 0) continue;
    // # comments at the top of each block let the operator paste the whole
    // file into a single mailer and the segmenting is still visible in the
    // recipient list during review, instead of relying on a separate map.
    console.log(`# ${cohort.label} (${bucket.length})`);
    if (args.showLastLogin) {
      // ## sub-headers split each cohort by login-recency so the operator
      // can tailor copy ("you've been away a while" for cold vs "your
      // trial is one click away" for warm) without re-pasting.
      const split = splitByTemperature(bucket);
      for (const temp of TEMPERATURES) {
        if (split[temp].length === 0) continue;
        console.log(`## ${temp} (${split[temp].length})`);
        for (const u of split[temp]) console.log(u.email);
      }
    } else {
      for (const u of bucket) console.log(u.email);
    }
    console.log('');
  }
  process.exit(0);
}

// Summary mode.
const total = rows.length;
console.log(`Auth DB: ${dbPath}`);
console.log(`Total Public users: ${total}${sinceMs == null ? '' : ` (since ${args.since})`}`);
if (args.showLastLogin) {
  console.log(
    `Warm threshold: last login within ${args.warmDays} day${args.warmDays === 1 ? '' : 's'}` +
      ` (now = ${new Date().toISOString()})`,
  );
}
console.log('');
// First column is the cohort id, printed alongside the human label so the
// operator can copy it straight into the next invocation as COHORT=<key>
// (or --cohort <key> when run directly).
const keyColWidth = Math.max(...COHORTS.map((c) => c.id.length)) + 2;
console.log(`  Cohorts (first column = COHORT=<key>):`);
console.log('');
for (const cohort of COHORTS) {
  if (args.cohort && cohort.id !== args.cohort) continue;
  const bucket = buckets.get(cohort.id);
  const pct = total > 0 ? ((bucket.length / total) * 100).toFixed(0) : '0';
  console.log(
    `  ${cohort.id.padEnd(keyColWidth)}${cohort.label.padEnd(40)} ${String(bucket.length).padStart(4)}  (${pct}%)`,
  );
  if (args.showLastLogin && bucket.length > 0) {
    const split = splitByTemperature(bucket);
    console.log(
      `      warm: ${split.warm.length}   cold: ${split.cold.length}   never: ${split.never.length}`,
    );
  }
  // Wrap the hint under each cohort heading at ~78 cols so a terminal user
  // can read it without horizontal scrolling.
  const words = cohort.hint.split(' ');
  let line = '      ';
  for (const word of words) {
    if (line.length + word.length + 1 > 78) {
      console.log(line);
      line = '      ' + word;
    } else {
      line = line === '      ' ? line + word : line + ' ' + word;
    }
  }
  if (line.trim().length > 0) console.log(line);
  console.log('');
}
// Hints are printed in the same syntax the caller used (Make vs raw CLI) so
// a copy-paste of any line below works without translation.
if (args.viaMake) {
  console.log('Re-run with EMAILS=1 to print recipient lists.');
  console.log('Re-run with COHORT=<key> EMAILS=1 for a single segment.');
  if (!args.showLastLogin) {
    console.log('Re-run with SHOW_LAST_LOGIN=1 to split each cohort into warm/cold/never.');
  }
  if (sinceMs == null) {
    console.log('Re-run with SINCE=<YYYY-MM-DD> to filter to users who signed up on/after that date.');
  }
} else {
  console.log('Re-run with --emails to print recipient lists.');
  console.log('Re-run with --cohort <name> --emails for a single segment.');
  if (!args.showLastLogin) {
    console.log('Re-run with --show-last-login to split each cohort into warm/cold/never.');
  }
  if (sinceMs == null) {
    console.log('Re-run with --since <YYYY-MM-DD> to filter to users who signed up on/after that date.');
  }
}
