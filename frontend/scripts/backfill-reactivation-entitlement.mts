#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types --no-warnings \
//     scripts/backfill-reactivation-entitlement.mts \
//     [--campaign <key>] [--email <addr>] [--dry-run | --yes]
//
// Grants the extended-trial ENTITLEMENT to accounts that were already promised
// it by an email that did not claim the latch.
//
// Why this exists: checkout derives the extended trial from exactly one column
// (app/api/billing/checkout/route.ts, reactivationEligible):
//
//     reactivationRequested && !hasPriorPaidSubscription
//       && users.reactivation_email_sent_at IS NOT NULL
//
// Only scripts/send-reactivation.mts used to write that column. The 2026-08
// product update's `registrants` variant promised "your extended free trial"
// and pointed at /pricing?trial=1&reactivate=1, but stamped nothing — so every
// recipient saw the longer trial on /pricing (the page renders that number
// straight from the URL param) and would have been charged after the standard
// TRIAL_PERIOD_DAYS at Stripe. send-product-update.mts now stamps on send; this
// script repairs the batch that already went out.
//
// Selection:
//   --campaign <key>  every user with a `<key>_sent` audit row (default
//                     product_update_2026_08 — the send that caused this).
//   --email <addr>    one account, for honoring the offer for a member who
//                     wrote in. Warns if they have no matching campaign row,
//                     since then nobody actually promised them anything.
//
// Only trial-eligible accounts are touched: an account with prior paid history
// gets no trial at all (hasPriorPaidSubscription in the checkout route), so
// stamping it would be a lie in the audit log with no effect on billing. An
// account that already has the column set is left alone — its existing
// timestamp is the real one.
//
// That prior-paid filter is also what keeps the two audiences apart. Both write
// the SAME `<key>_sent` audit type, so selecting by campaign picks up the
// `cancelled` recipients too — but every one of them is churned
// (subscription_lapsed=1, the definition of that cohort), so they land in the
// skip bucket rather than being handed an offer their email never made.
//
// The skipped accounts are LISTED, not just counted, because two of them need
// different handling: a recipient who already started the standard trial off
// this campaign was promised the longer one and cannot be fixed by a stamp —
// their trial already exists on the Stripe subscription. Extend it with
// scripts/extend-trial.mts instead.
//
// The stamp is written with the timestamp the offer was actually MADE (the
// campaign audit row's created_at), not "now", so the column keeps meaning
// "when this account was pitched the extended trial".
//
// Side effect, and it is intended: a stamped account is no longer eligible for
// scripts/send-reactivation.mts, which would otherwise send the same
// extended-trial pitch a second time.
//
// Idempotent: re-running stamps nobody twice (the UPDATE is guarded on
// IS NULL, and stamped users drop out of the selection).
//
// AUTH_DB_PATH overrides the DB. Requires the sqlite3 CLI on PATH.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const DEFAULT_CAMPAIGN_KEY = 'product_update_2026_08';

// Mirrors TRIAL_PERIOD_DAYS / REACTIVATION_TRIAL_DAYS_DEFAULT and
// getReactivationTrialDays()'s clamp in app/api/billing/checkout/route.ts. Used
// only to say how much of a promised trial an account is short by.
const TRIAL_PERIOD_DAYS = 7;
const REACTIVATION_TRIAL_DAYS_DEFAULT = 30;

type Args = {
  campaign: string;
  email: string | null;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

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

function parseArgs(argv: string[]): Args {
  const args: Args = {
    campaign: DEFAULT_CAMPAIGN_KEY,
    email: null,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--campaign') args.campaign = argv[++i] ?? '';
    else if (arg === '--email' || arg === '-e') args.email = argv[++i] ?? null;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings \\
    scripts/backfill-reactivation-entitlement.mts [options]

Stamps users.reactivation_email_sent_at for accounts that were promised the
extended trial by a campaign email that did not claim the latch, so the
checkout route will actually grant it.

Options:
  --campaign <key>   Audit-event key of the send to repair
                     (default: ${DEFAULT_CAMPAIGN_KEY}). Users are selected by
                     their '<key>_sent' audit row.
  --email <addr>     Stamp this one account instead of a whole campaign.
  --dry-run          List who would be stamped; change nothing.
  --yes, -y          Apply the stamps.
  --help, -h         Show this help.

Set AUTH_DB_PATH in frontend/.env.local or the shell to override the DB path.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

function runSqlite(dbPath: string, sql: string): string {
  try {
    return execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : (stderr?.toString?.() ?? (err as Error).message);
    throw new Error(message.trim() || (err as Error).message);
  }
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  const output = runSqlite(dbPath, sql).trim();
  if (!output) return [];
  return JSON.parse(output) as T[];
}

function execSqlite(dbPath: string, sql: string) {
  runSqlite(dbPath, sql);
}

const cli = parseArgs(process.argv.slice(2));
if (cli.help) {
  usage();
  process.exit(0);
}
if (cli.dryRun && cli.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}
if (!cli.campaign && !cli.email) {
  console.error('Error: --campaign must not be empty (or pass --email).');
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
ensureSqlite3Cli();

// The column is created by the lazy migration in core/db.ts, which runs when
// the Next.js app boots. Without it every UPDATE below fails; say so plainly.
const userCols = new Set(
  querySqlite<{ name: string }>(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
// These two decide WHO gets stamped, so a DB missing either cannot be reasoned
// about safely — a NULL-for-missing fallback would read as "never paid" and hand
// the offer to accounts that should be skipped.
const required = ['reactivation_email_sent_at', 'paid_welcome_email_sent_at', 'subscription_lapsed'];
const missingRequired = required.filter((c) => !userCols.has(c));
if (missingRequired.length > 0) {
  console.error(
    `Auth DB at ${dbPath} is missing column(s): ${missingRequired.join(', ')}.\n` +
      'Start (or restart) the Next.js app once to run the migration in core/db.ts.',
  );
  process.exit(1);
}

// The rest only feed the report, so an older DB degrades to "unknown" rather
// than failing outright.
const col = (name: string) => (userCols.has(name) ? `u.${name}` : `NULL AS ${name}`);

const auditType = `${cli.campaign}_sent`;

type Candidate = {
  id: string;
  email: string;
  created_at: string | null;
  offered_at: string | null;
  offered_message: string | null;
  reactivation_email_sent_at: string | null;
  paid_welcome_email_sent_at: string | null;
  subscription_lapsed: number | null;
  subscription_status: string | null;
  current_period_end: string | null;
  first_payment_at: string | null;
  // Message of the account's most recent billing_checkout_started audit row.
  // Carries `trial=<n>d`, which is what checkout ACTUALLY granted — the only
  // record of the trial length, since neither the users row nor Stripe's
  // trial_end says how long the trial was, only when it ends.
  checkout_message: string | null;
};

// offered_at is the campaign audit row's timestamp — when the promise was
// actually made. MIN() because a re-run of a send can leave more than one row;
// the first one is when the member was told.
const offeredAtSubquery = `(SELECT MIN(a.created_at) FROM audit_events a
                             WHERE a.user_id = u.id AND a.type = '${esc(auditType)}')`;

// Which audience's copy this account actually received. Both audiences write the
// same audit TYPE, and only the message distinguishes them ('registrants product
// update sent' vs 'cancelled ...'). Current columns cannot: a churned member who
// resubscribed has had subscription_lapsed flipped back to 0 by the webhook, so
// they look exactly like a registrant who converted. The reporting below needs
// that difference — a cancelled recipient charged after their email is a member
// who resubscribed, not someone shortchanged on a promised trial.
const offeredMessageSubquery = `(SELECT a.message FROM audit_events a
                                  WHERE a.user_id = u.id AND a.type = '${esc(auditType)}'
                                  ORDER BY a.created_at ASC LIMIT 1)`;

const selection = cli.email
  ? `LOWER(u.email) = '${esc(cli.email.toLowerCase())}'`
  : `${offeredAtSubquery} IS NOT NULL`;

// deleted_at is a later column than the rest; skip the filter rather than die
// on a DB that predates it (a DB without it has no self-deleted accounts).
const notDeleted = userCols.has('deleted_at') ? 'AND u.deleted_at IS NULL' : '';

// Latest checkout attempt: a member who bounced once and came back has more
// than one row, and the last one is the one that produced the live trial.
const checkoutMessageSubquery = `(SELECT a.message FROM audit_events a
                                   WHERE a.user_id = u.id AND a.type = 'billing_checkout_started'
                                   ORDER BY a.created_at DESC LIMIT 1)`;

const candidates = querySqlite<Candidate>(
  dbPath,
  `SELECT u.id, u.email, u.created_at,
          ${offeredAtSubquery} AS offered_at,
          ${offeredMessageSubquery} AS offered_message,
          u.reactivation_email_sent_at,
          u.paid_welcome_email_sent_at,
          u.subscription_lapsed,
          ${col('subscription_status')},
          ${col('current_period_end')},
          ${col('first_payment_at')},
          ${checkoutMessageSubquery} AS checkout_message
     FROM users u
    WHERE ${selection}
      ${notDeleted}
    ORDER BY u.created_at ASC;`,
);

if (cli.email && candidates.length === 0) {
  console.error(`No user found with email ${cli.email}`);
  process.exit(1);
}

// Mirrors hasPriorPaidSubscription in app/api/billing/checkout/route.ts: these
// accounts get no trial of any length, so a stamp would change nothing.
const hasPriorPaid = (c: Candidate) =>
  c.paid_welcome_email_sent_at != null || Number(c.subscription_lapsed) === 1;
const priorPaid = candidates.filter(hasPriorPaid);
const alreadyStamped = candidates.filter(
  (c) => !hasPriorPaid(c) && c.reactivation_email_sent_at != null,
);
const toStamp = candidates.filter(
  (c) => !hasPriorPaid(c) && c.reactivation_email_sent_at == null,
);

const SAMPLE = 30;

// What the extended trial is worth right now, read the same way checkout reads
// it so the arithmetic below matches what a member would actually be granted.
const rawReactivationDays = Number(process.env.REACTIVATION_TRIAL_DAYS || envLocal.REACTIVATION_TRIAL_DAYS);
const reactivationTrialDays = Number.isFinite(rawReactivationDays)
  ? Math.max(TRIAL_PERIOD_DAYS, Math.min(90, Math.floor(rawReactivationDays)))
  : REACTIVATION_TRIAL_DAYS_DEFAULT;

console.log(`Auth DB:         ${dbPath}`);
console.log(`Selection:       ${cli.email ? `email ${cli.email}` : `audit type ${auditType}`}`);
console.log(`Matched:         ${candidates.length}`);
console.log(`Already stamped: ${alreadyStamped.length} (left as-is)`);
console.log(`Not trial-eligible: ${priorPaid.length} (prior paid subscription — skipped)`);
console.log(`To stamp:        ${toStamp.length}`);

// A stamp cannot help any of the skipped accounts, but two subsets of them are
// still owed something, and both are invisible in a bare count. Split them out
// and list them IN FULL — they are a to-do list, not a sample.
//
//   mid-trial   Started a trial after being promised a longer one, and is on
//               the standard length right now. The trial already exists on the
//               Stripe subscription, so it is fixed by pushing out trial_end:
//               scripts/extend-trial.mts.
//   charged     Already converted off that short trial — billed on day 7 having
//               been told 30. Nothing a script should decide on its own; it is a
//               refund or credit conversation.
//
// Both are restricted to accounts that received the REGISTRANTS copy. A
// cancelled-audience recipient who subscribed after their email correctly got
// no trial (their copy offered a discount, not a longer trial), and would
// otherwise show up here as a false alarm.
{
  const wasRegistrant = (c: Candidate) => (c.offered_message ?? '').startsWith('registrants');
  const midTrial = priorPaid.filter((c) => wasRegistrant(c) && c.subscription_status === 'trialing');
  const chargedAfterOffer = priorPaid.filter(
    (c) =>
      wasRegistrant(c) &&
      c.subscription_status !== 'trialing' &&
      c.first_payment_at != null &&
      c.offered_at != null &&
      c.first_payment_at > c.offered_at,
  );
  const noAction = priorPaid.filter(
    (c) => !midTrial.includes(c) && !chargedAfterOffer.includes(c),
  );

  // How long the trial they are on ACTUALLY is. "Mid-trial" alone does not mean
  // shortchanged: someone the daily reactivation email had already reached
  // before this campaign started a full-length trial, and telling the operator
  // to extend them would push a 30-day trial to 53. trial_end says when the
  // trial ends, never how long it was, so the length comes from the
  // `trial=<n>d` the checkout route writes into its own audit row.
  const grantedTrialDays = (c: Candidate): number | null => {
    const m = /\btrial=(\d+)d\b/.exec(c.checkout_message ?? '');
    return m ? Number(m[1]) : null;
  };

  const owed = midTrial.filter((c) => {
    const days = grantedTrialDays(c);
    return days != null && days < reactivationTrialDays;
  });
  const fullLength = midTrial.filter((c) => {
    const days = grantedTrialDays(c);
    return days != null && days >= reactivationTrialDays;
  });
  const unknownLength = midTrial.filter((c) => grantedTrialDays(c) == null);

  if (owed.length > 0) {
    console.log(
      `\nOWED AN EXTENSION — ${owed.length} ${owed.length === 1 ? 'is' : 'are'} mid-trial on less than the ${reactivationTrialDays} days`,
    );
    console.log('this campaign promised. Run each (add YES=1 in place of DRY_RUN=1 to apply):');
    for (const c of owed) {
      const days = grantedTrialDays(c)!;
      console.log(
        `  # ${c.email}: on ${days}d, ends ${c.current_period_end ?? 'unknown'}\n` +
          `  make extend-trial EMAIL=${c.email} EXTEND_DAYS=${reactivationTrialDays - days} DRY_RUN=1`,
      );
    }
  }

  if (fullLength.length > 0) {
    console.log(
      `\nMid-trial, already on ${reactivationTrialDays} days — ${fullLength.length}, nothing owed`,
    );
    console.log('(the reactivation email had already reached them). Do NOT extend these:');
    for (const c of fullLength) {
      console.log(`  - ${c.email}  (ends ${c.current_period_end ?? 'unknown'})`);
    }
  }

  if (unknownLength.length > 0) {
    console.log(
      `\nMid-trial, length unknown — ${unknownLength.length}. No billing_checkout_started audit`,
    );
    console.log('row to read the granted length from; check each with diagnose-user:');
    for (const c of unknownLength) {
      console.log(`  - ${c.email}  (ends ${c.current_period_end ?? 'unknown'})`);
    }
  }

  if (chargedAfterOffer.length > 0) {
    console.log(
      `\nALREADY CHARGED — ${chargedAfterOffer.length} converted off the standard trial after`,
    );
    console.log('being promised the longer one. Decide refund/credit by hand:');
    for (const c of chargedAfterOffer) {
      console.log(`  - ${c.email}  (first payment ${c.first_payment_at})`);
    }
  }

  if (noAction.length > 0) {
    console.log(`\nSkipped, no action — ${noAction.length} (churned, or paid before this campaign):`);
    for (const c of noAction.slice(0, SAMPLE)) {
      const why = Number(c.subscription_lapsed) === 1 ? 'churned' : 'has paid before';
      console.log(`  - ${c.email}  (${why})`);
    }
    if (noAction.length > SAMPLE) console.log(`  ... and ${noAction.length - SAMPLE} more`);
  }
}

if (cli.email && toStamp.length > 0 && toStamp[0].offered_at == null) {
  console.warn(
    `\nWarning: ${toStamp[0].email} has no '${auditType}' audit row, so this campaign\n` +
      'never promised them the extended trial. Stamping is a manual goodwill grant —\n' +
      'the audit row written below will say so.',
  );
}

if (toStamp.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

console.log('\nWill stamp:');
for (const c of toStamp.slice(0, SAMPLE)) {
  console.log(`  - ${c.email}  (offered ${c.offered_at ?? 'n/a — manual grant'})`);
}
if (toStamp.length > SAMPLE) console.log(`  ... and ${toStamp.length - SAMPLE} more`);

if (!cli.yes) {
  console.log(
    `\n${cli.dryRun ? 'Dry run' : 'Refusing to write'} — nothing changed. ` +
      'Re-run with --yes to apply.',
  );
  process.exit(0);
}

// One transaction for the whole batch: a half-applied backfill is worse than
// none, because the second run cannot tell which half was already honored from
// the users table alone.
const nowIso = new Date().toISOString();
const statements: string[] = [];
for (const c of toStamp) {
  const stampedAt = c.offered_at ?? nowIso;
  const source = c.offered_at ? `campaign ${cli.campaign}` : 'manual grant';
  statements.push(
    `UPDATE users SET reactivation_email_sent_at = '${esc(stampedAt)}'
       WHERE id = '${esc(c.id)}' AND reactivation_email_sent_at IS NULL;`,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES ('audit_${crypto.randomBytes(12).toString('hex')}',
             'reactivation_entitlement_backfilled', '${esc(c.id)}', NULL,
             '${esc(c.email)}', 'backfill-reactivation-entitlement',
             '${esc(`Extended-trial entitlement granted (${source}); reactivation_email_sent_at set to ${stampedAt}`)}',
             '${esc(nowIso)}');`,
  );
}

try {
  execSqlite(dbPath, `BEGIN IMMEDIATE;\n${statements.join('\n')}\nCOMMIT;`);
} catch (err) {
  console.error(`\nBackfill failed, nothing was written: ${(err as Error).message}`);
  process.exit(1);
}

console.log(`\nDone. Stamped ${toStamp.length} account(s).`);
console.log(
  'They now get the extended trial from /pricing?trial=1&reactivate=1, and are no\n' +
    'longer eligible for the automated reactivation email.',
);
