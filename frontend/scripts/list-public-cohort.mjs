#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --no-warnings scripts/list-public-cohort.mjs \
//     [--emails] [--cohort <name>]
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
      'subscription_lapsed=1. Pitch: "we\'ve added X since you left" + a time-boxed coupon via PROMO_END_AT. Skip if the cohort is small — they\'ve already made an informed no.',
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
  const args = { emails: false, cohort: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--emails') args.emails = true;
    else if (arg === '--cohort') args.cohort = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --no-warnings scripts/list-public-cohort.mjs [--emails] [--cohort <name>]

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

const rows = db
  .prepare(
    `SELECT id, email, email_verified_at, stripe_customer_id,
            subscription_lapsed, founding_eligible, founding_member_started_at,
            created_at
     FROM users
     WHERE tier = 'public'
     ORDER BY created_at ASC`,
  )
  .all();

function classify(u) {
  if (!u.email_verified_at) return 'unverified';
  // Founding-eligible only meaningful while they haven't redeemed yet —
  // founding_member_started_at gets stamped at first checkout (see
  // app/api/webhooks/stripe/route.ts:226 stampFoundingStart), so a former
  // founding member who churned falls through to the 'churned' bucket
  // instead of being pitched a discount they've already burned.
  if (Number(u.founding_eligible) === 1 && !u.founding_member_started_at) {
    return 'founding-eligible';
  }
  if (Number(u.subscription_lapsed) === 1) return 'churned';
  return 'verified-never-paid';
}

const buckets = new Map(COHORTS.map((c) => [c.id, []]));
for (const row of rows) {
  buckets.get(classify(row)).push(row);
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
    for (const u of bucket) console.log(u.email);
    console.log('');
  }
  process.exit(0);
}

// Summary mode.
const total = rows.length;
console.log(`Auth DB: ${dbPath}`);
console.log(`Total Public users: ${total}`);
console.log('');
for (const cohort of COHORTS) {
  if (args.cohort && cohort.id !== args.cohort) continue;
  const bucket = buckets.get(cohort.id);
  const pct = total > 0 ? ((bucket.length / total) * 100).toFixed(0) : '0';
  console.log(`  ${cohort.label.padEnd(40)} ${String(bucket.length).padStart(4)}  (${pct}%)`);
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
console.log('Re-run with --emails to print recipient lists.');
console.log('Re-run with --cohort <name> --emails for a single segment.');
