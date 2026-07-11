#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/activate-late-founder.mts \
//     --email <addr> [--tier basic|pro] [--cadence monthly|annual] \
//     [--trial-days N | --trial-end <ISO>] [--dry-run | --yes]
//
// One-off: honor a founding member who missed the July-1 lock-in deadline.
//
// The self-serve founding path is closed after FOUNDING_LOCKIN_DEADLINE_ISO on
// three fronts — the /founding page 404s, the checkout API refuses the founding
// code (410), and the deferred-July-1 trial no longer mints. This script goes
// around all three by minting a founding Checkout Session directly, so a single
// hand-picked straggler can still activate at the founding rate.
//
// It reuses the SAME coupons the live flow uses (getFoundingIntroCouponId) and
// stamps subscription_data.metadata.founding='1'. That metadata flag — NOT the
// coupon — is what makes the webhook (app/api/webhooks/stripe/route.ts) treat
// them as a real founder: it stamps founding_member_started_at, sends the
// founding welcome email, and schedules the lifetime 25%-off coupon ~11 months
// later. Applying the intro coupon by hand WITHOUT this flag would give 12
// months at the intro rate and then silently snap back to full rack rate.
//
// The member supplies their own card at the hosted Checkout page (they have
// none on file), so this mints a link rather than creating a bare subscription.
// When the plan isn't decided yet, omit --tier/--cadence and the script emits
// one link per configured plan — the founder picks by clicking. All links point
// at the same Stripe customer, so whichever they complete maps back to their
// user row (the webhook keys off stripe_customer_id, so the customer MUST be
// pre-created and persisted here — a Checkout-autocreated customer would orphan
// the sync).
//
// First charge: by default they're billed the discounted intro rate at
// checkout. Pass --trial-days / --trial-end to defer the first charge (card is
// still collected up front) if you want to preserve the "no charge today"
// spirit of the original offer.
//
// Idempotent-ish: refuses if the user already has a subscription. Records an
// audit_events row per run so re-mints are traceable.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

type Tier = 'basic' | 'pro';
type Cadence = 'monthly' | 'annual';

// Display-only intro prices, mirrored from app/founding/Client.tsx. Source of
// truth for what's actually charged is Stripe (price + coupon). Used only to
// label the generated links so the operator knows which is which.
const PLAN_MATRIX: Array<{
  tier: Tier;
  cadence: Cadence;
  priceEnv: string;
  couponEnv: string;
  introLabel: string;
}> = [
  { tier: 'basic', cadence: 'monthly', priceEnv: 'STRIPE_PRICE_BASIC_MONTHLY', couponEnv: 'STRIPE_COUPON_FOUNDING_BASIC_INTRO', introLabel: '$12/mo' },
  { tier: 'basic', cadence: 'annual', priceEnv: 'STRIPE_PRICE_BASIC_ANNUAL', couponEnv: 'STRIPE_COUPON_FOUNDING_BASIC_INTRO_ANNUAL', introLabel: '$120/yr' },
  { tier: 'pro', cadence: 'monthly', priceEnv: 'STRIPE_PRICE_PRO_MONTHLY', couponEnv: 'STRIPE_COUPON_FOUNDING_PRO_INTRO', introLabel: '$19/mo' },
  { tier: 'pro', cadence: 'annual', priceEnv: 'STRIPE_PRICE_PRO_ANNUAL', couponEnv: 'STRIPE_COUPON_FOUNDING_PRO_INTRO_ANNUAL', introLabel: '$190/yr' },
];

const AUDIT_TYPE = 'billing_late_founder_activation';
// Stripe rejects a trial_end < ~48h out; match the live checkout route's guard.
const MIN_TRIAL_END_BUFFER_MS = 48 * 60 * 60 * 1000;

type Args = {
  email: string | null;
  tier: Tier | null;
  cadence: Cadence | null;
  trialDays: number | null;
  trialEndIso: string | null;
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
    email: null,
    tier: null,
    cadence: null,
    trialDays: null,
    trialEndIso: null,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email') args.email = (argv[++i] ?? '').trim().toLowerCase() || null;
    else if (arg === '--tier') {
      const next = argv[++i];
      if (next === 'basic' || next === 'pro') args.tier = next;
      else {
        console.error(`Error: --tier must be basic|pro (got ${next ?? '<none>'}).`);
        process.exit(1);
      }
    } else if (arg === '--cadence') {
      const next = argv[++i];
      if (next === 'monthly' || next === 'annual') args.cadence = next;
      else {
        console.error(`Error: --cadence must be monthly|annual (got ${next ?? '<none>'}).`);
        process.exit(1);
      }
    } else if (arg === '--trial-days') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 2) {
        console.error('Error: --trial-days must be an integer >= 2 (Stripe needs a ~48h cushion).');
        process.exit(1);
      }
      args.trialDays = n;
    } else if (arg === '--trial-end') {
      args.trialEndIso = argv[++i] ?? null;
    } else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/activate-late-founder.mts \\
    --email <addr> [--tier basic|pro] [--cadence monthly|annual] \\
    [--trial-days N | --trial-end <ISO>] [--dry-run | --yes]

Mints a founding-rate Stripe Checkout link for one member who missed the
July-1 lock-in deadline. The member enters their own card at the link. The
subscription carries metadata.founding=1, so the webhook grants the tier,
sends the founding welcome email, and applies the lifetime 25%-off coupon on
schedule — identical to a normal founding activation.

Plan selection:
      --tier / --cadence      Restrict to one plan. Omit either (or both) to
                              emit a link for every configured plan and let the
                              member pick by clicking.

First charge (optional deferral; card is always collected up front):
      --trial-days N          Defer the first charge N days (N >= 2).
      --trial-end <ISO>       Defer the first charge to an absolute date
                              (must be >= 48h out), e.g. 2026-08-01T13:30:00Z.
                              Mutually exclusive with --trial-days.

Other:
      --dry-run               Print the plan; no Stripe or DB writes.
  -y, --yes                   Create the customer + links and write audit rows.
  -h, --help                  Show this help.

Each Checkout link is valid for 24h (Stripe's maximum for a session) — re-run
to mint a fresh one if it lapses. Refuses if the user already has a
subscription. Sets founding_eligible=1 on the user row (reflects reality;
harmless — the deadline gate is closed regardless).

Reads STRIPE_SECRET_KEY, STRIPE_PRICE_* / STRIPE_COUPON_FOUNDING_* and
NEXT_PUBLIC_APP_URL from env or .env.local. Set AUTH_DB_PATH to override the
default DB path (data/auth.db).`);
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

function runSqlite(dbPath: string, sql: string): string {
  try {
    return execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
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

// ---------------------------------------------------------------------------

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  usage();
  process.exit(0);
}

if (!cliArgs.email) {
  console.error('Error: --email is required. See --help.');
  process.exit(1);
}

if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}

if (cliArgs.trialDays != null && cliArgs.trialEndIso != null) {
  console.error('Error: --trial-days and --trial-end are mutually exclusive.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
}

const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY not set in env or .env.local.');
  process.exit(1);
}

const APP_URL = envOrLocal('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000';

// Resolve the trial_end (absolute unix seconds) once, shared across all links
// so every plan defers to the same first-charge moment.
let trialEndUnix: number | null = null;
if (cliArgs.trialDays != null) {
  trialEndUnix = Math.floor((Date.now() + cliArgs.trialDays * 24 * 60 * 60 * 1000) / 1000);
} else if (cliArgs.trialEndIso != null) {
  const ms = Date.parse(cliArgs.trialEndIso);
  if (!Number.isFinite(ms)) {
    console.error(`Error: --trial-end is not a valid date: ${cliArgs.trialEndIso}`);
    process.exit(1);
  }
  if (ms - Date.now() < MIN_TRIAL_END_BUFFER_MS) {
    console.error('Error: --trial-end must be at least 48h in the future.');
    process.exit(1);
  }
  trialEndUnix = Math.floor(ms / 1000);
}

// Which plans to emit. Filter the matrix by the (optional) tier/cadence flags,
// then drop any plan whose price or coupon env isn't configured — that plan
// simply isn't sellable, so it can't be a founding link.
type ResolvedPlan = {
  tier: Tier;
  cadence: Cadence;
  priceId: string;
  couponId: string;
  introLabel: string;
};
const resolvedPlans: ResolvedPlan[] = [];
const unconfigured: string[] = [];
for (const p of PLAN_MATRIX) {
  if (cliArgs.tier && p.tier !== cliArgs.tier) continue;
  if (cliArgs.cadence && p.cadence !== cliArgs.cadence) continue;
  const priceId = envOrLocal(p.priceEnv);
  const couponId = envOrLocal(p.couponEnv);
  if (!priceId || !couponId) {
    unconfigured.push(
      `${p.tier}/${p.cadence} (${!priceId ? p.priceEnv : ''}${!priceId && !couponId ? ' + ' : ''}${!couponId ? p.couponEnv : ''} unset)`,
    );
    continue;
  }
  resolvedPlans.push({ tier: p.tier, cadence: p.cadence, priceId, couponId, introLabel: p.introLabel });
}

if (resolvedPlans.length === 0) {
  console.error('Error: no configured founding plans match the requested tier/cadence.');
  if (unconfigured.length > 0) console.error(`  Unconfigured: ${unconfigured.join('; ')}`);
  process.exit(1);
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

type UserRow = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  founding_eligible: number;
  email_verified_at: string | null;
};

const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, stripe_customer_id, stripe_subscription_id, founding_eligible, email_verified_at
   FROM users WHERE lower(email) = '${escapeSqlLiteral(cliArgs.email)}' LIMIT 1;`,
);
const user = rows[0];
if (!user) {
  console.error(`Error: no user found with email ${cliArgs.email}.`);
  process.exit(1);
}
if (user.stripe_subscription_id) {
  console.error(
    `Error: ${user.email} already has a subscription (${user.stripe_subscription_id}). Use the billing portal to change plans.`,
  );
  process.exit(1);
}

console.log(`Auth DB:        ${dbPath}`);
console.log(`App URL:        ${APP_URL}`);
console.log(`Member:         ${user.email} (id=${user.id})`);
console.log(`Stripe cust:    ${user.stripe_customer_id ?? '<none — will create>'}`);
console.log(`Founding elig:  ${user.founding_eligible ? 'yes' : 'no (will set to 1)'}`);
console.log(`Email verified: ${user.email_verified_at ? 'yes' : 'NO'}`);
console.log(
  `First charge:   ${
    trialEndUnix
      ? `deferred to ${new Date(trialEndUnix * 1000).toISOString()} (card collected now)`
      : 'at checkout, discounted intro rate'
  }`,
);
console.log('Link lifetime:  24h (Stripe max for a checkout session)');
console.log(`Plans:          ${resolvedPlans.map((p) => `${p.tier}/${p.cadence} (${p.introLabel})`).join(', ')}`);
if (unconfigured.length > 0) console.log(`Skipped (unconfigured): ${unconfigured.join('; ')}`);
if (!user.email_verified_at) {
  console.log(
    '\nNote: this account is not email-verified. The founding link still works\n(Stripe collects the card), but the member may see verify nags in-app.',
  );
}

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No customer created, no links minted, no DB writes.');
  process.exit(0);
}

if (!cliArgs.yes) {
  console.log('\nRefusing to write without --yes. Re-run with --yes to mint links, or --dry-run to preview.');
  process.exit(1);
}

// Stripe is imported lazily so --help / --dry-run run without node_modules.
const { default: Stripe } = await import('stripe');
const stripe = new Stripe(STRIPE_SECRET_KEY);

function nowIso() {
  return new Date().toISOString();
}

// Ensure a Stripe customer that maps back to this user row. Mirror the live
// checkout route: reuse the cached id if it still exists on Stripe, else
// (re)provision and persist. The webhook resolves the user via
// stripe_customer_id, so this linkage is load-bearing.
let customerId = user.stripe_customer_id;
if (customerId) {
  try {
    const existing = await stripe.customers.retrieve(customerId);
    if ((existing as { deleted?: boolean }).deleted) customerId = null;
  } catch (err) {
    const code = (err as { code?: string } | undefined)?.code;
    if (code === 'resource_missing') customerId = null;
    else throw err;
  }
}
if (!customerId) {
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { user_id: user.id },
  });
  customerId = customer.id;
  execSqlite(
    dbPath,
    `UPDATE users SET stripe_customer_id = '${escapeSqlLiteral(customerId)}', updated_at = '${escapeSqlLiteral(nowIso())}' WHERE id = '${escapeSqlLiteral(user.id)}';`,
  );
  console.log(`\nCreated Stripe customer ${customerId} and persisted to user row.`);
}

// Reflect reality on the row. The self-serve deadline gate is closed, so this
// can't reopen anything — it just keeps the founding flag truthful.
if (!user.founding_eligible) {
  execSqlite(
    dbPath,
    `UPDATE users SET founding_eligible = 1, updated_at = '${escapeSqlLiteral(nowIso())}' WHERE id = '${escapeSqlLiteral(user.id)}';`,
  );
}

console.log('\nFounding activation link(s):');
const minted: string[] = [];
for (const plan of resolvedPlans) {
  // Each plan is isolated: a bad coupon/price for one plan logs a FAIL and the
  // remaining plans still mint (Stripe's default 24h session expiry applies —
  // expires_at is capped at 24h for Checkout Sessions, so we leave it default).
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${APP_URL}/dashboard?trial_started=1`,
      cancel_url: `${APP_URL}/pricing?founding=1&checkout_cancelled=1`,
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      // Server-applied founding intro coupon. Setting discounts disallows
      // Stripe's promo-code field, so no second discount can stack on top.
      discounts: [{ coupon: plan.couponId }],
      subscription_data: {
        metadata: {
          user_id: user.id,
          tier: plan.tier,
          cadence: plan.cadence,
          founding: '1',
          late_activation: '1',
        },
        ...(trialEndUnix ? { trial_end: trialEndUnix } : {}),
      },
    });
    if (!session.url) {
      console.error(`  FAIL ${plan.tier}/${plan.cadence}: Stripe returned no checkout URL.`);
      continue;
    }
    console.log(`  ${plan.tier}/${plan.cadence} — ${plan.introLabel}:`);
    console.log(`    ${session.url}`);
    minted.push(`${plan.tier}/${plan.cadence}=${session.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`  FAIL ${plan.tier}/${plan.cadence}: ${message}`);
  }
}

if (minted.length === 0) {
  console.error('\nNo links were minted.');
  process.exit(1);
}

// Audit trail: one row recording the mint so re-runs are traceable.
const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
execSqlite(
  dbPath,
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (
     '${escapeSqlLiteral(auditId)}',
     '${escapeSqlLiteral(AUDIT_TYPE)}',
     '${escapeSqlLiteral(user.id)}',
     NULL,
     '${escapeSqlLiteral(user.email)}',
     'manual-script',
     '${escapeSqlLiteral(`Minted founding activation link(s): ${minted.join(', ')}; trialEnd=${trialEndUnix ? new Date(trialEndUnix * 1000).toISOString() : 'none'}`)}',
     '${escapeSqlLiteral(nowIso())}'
   );`,
);

console.log(
  `\nDone. ${minted.length} link(s) minted (valid ~24h; re-run to refresh if they lapse). Send the member whichever plan(s) apply — the webhook grants the tier, emails the founding welcome, and schedules the lifetime 25% coupon once they complete checkout.`,
);
