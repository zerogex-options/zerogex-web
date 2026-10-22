#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/move-partner-promo.mts \
//     (--promo-code <CODE> | --email <email>) [--coupon-id <id>] (--dry-run | --yes)
//
// Moves a Creator Partner's typeable audience code (e.g. PCB25) onto another
// Stripe coupon, keeping the same code. By default the target is the coupon the
// partner's ?ref= link already applies (their per-partner override if one is
// set, else STRIPE_COUPON_PARTNER_AUDIENCE), so the link and the typed code give
// the same deal.
//
// When it's needed: after the partner deal changes. Pointing
// STRIPE_COUPON_PARTNER_AUDIENCE at a new coupon moves every partner's LINK to
// the new deal at once, but a code typed at Stripe checkout still applies the
// coupon it was created on, because a promotion code can't change coupons.
// Re-running grant-partner-pro is not the fix: it re-grants 90 days of Pro and
// resets the commission terms to the defaults.
//
// What it does (core/partnerPromoMove.ts decides; this file reads and writes):
//   1. Switches off the partner's active promotion code with that string on any
//      other coupon. Stripe allows one active code per string, so this comes
//      first. Members who already redeemed it keep their discount.
//   2. Creates the same code on the target coupon, with
//      metadata.partner_user_id so the webhook can still credit the partner when
//      a buyer types it. If this fails, step 1 is undone, so a failed run leaves
//      the partner with the working code they started with.
//   3. Keeps the link on the same coupon: with --coupon-id, points
//      users.partner_audience_coupon_id at the target (or clears it when the
//      target is the env coupon).
//   4. Writes a `partner_promo_code_moved` audit row.
//
// Leaves everything else alone: tier, Pro grant, commission rate and window,
// referral code and the commission ledger.
//
// Read-only by default (it still reads Stripe, to show what's there); --yes is
// required to write.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

import {
  describeCoupon,
  executePromoMove,
  isNoOpMove,
  planPromoMove,
  type ExistingPromoCode,
} from '../core/partnerPromoMove.ts';

type Args = {
  email: string | null;
  promoCode: string | null;
  couponId: string | null;
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
    promoCode: null,
    couponId: null,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = argv[++i] ?? null;
    else if (arg === '--promo-code') args.promoCode = argv[++i] ?? null;
    else if (arg === '--coupon-id') args.couponId = argv[++i] ?? null;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/move-partner-promo.mts \\
    (--promo-code <CODE> | --email <email>) [--coupon-id <id>] (--dry-run | --yes)

Moves a Creator Partner's typeable audience code onto another Stripe coupon,
keeping the code: switches off the old Stripe promotion code, creates the same
code on the target coupon with the partner's metadata, and audits it. Leaves
the Pro grant, commission terms and ledger alone.

Options:
      --promo-code <CODE>  The partner's audience code (e.g. PCB25).
  -e, --email <email>      Or pick the partner by account email.
      --coupon-id <id>     Target coupon. Defaults to the coupon the partner's
                           link already applies: their per-partner override if
                           set, else STRIPE_COUPON_PARTNER_AUDIENCE. When given,
                           the link is pointed at it too.
      --dry-run            Show what's in Stripe now and what would change.
  -y, --yes                Apply.
  -h, --help               Show this help.

Requires sqlite3 CLI and STRIPE_SECRET_KEY in env or frontend/.env.local.`);
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

function execSqlite(dbPath: string, sql: string): void {
  runSqlite(dbPath, sql);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (!cliArgs.email === !cliArgs.promoCode) {
  console.error('Error: pass exactly one of --promo-code or --email.');
  usage();
  process.exit(1);
}
if (cliArgs.dryRun && cliArgs.yes) {
  console.error('Error: --dry-run and --yes are mutually exclusive.');
  process.exit(1);
}
if (!cliArgs.dryRun && !cliArgs.yes) {
  console.error('Error: pass --dry-run or --yes.');
  process.exit(1);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
function envOrLocal(key: string): string | undefined {
  return process.env[key] || envLocal[key] || undefined;
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

ensureSqlite3Cli();

const userCols = new Set(
  querySqlite<{ name: string }>(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
const missingCols = [
  'partner_tier',
  'partner_audience_promo_code',
  'partner_audience_coupon_id',
].filter((c) => !userCols.has(c));
if (missingCols.length > 0) {
  console.error(`Error: required users columns are missing: ${missingCols.join(', ')}`);
  console.error('Fix: cd ~/zerogex-web && make migrate');
  process.exit(4);
}

const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY is not set (env or frontend/.env.local).');
  process.exit(1);
}
const envCouponId = envOrLocal('STRIPE_COUPON_PARTNER_AUDIENCE') ?? null;

type PartnerRow = {
  id: string;
  email: string;
  partner_tier: string | null;
  partner_audience_promo_code: string | null;
  partner_audience_coupon_id: string | null;
};
const lookup = cliArgs.email
  ? `email = '${escapeSqlLiteral(cliArgs.email.trim().toLowerCase())}'`
  : `partner_audience_promo_code = '${escapeSqlLiteral(cliArgs.promoCode!.trim().toUpperCase())}'`;
const rows = querySqlite<PartnerRow>(
  dbPath,
  `SELECT id, email, partner_tier, partner_audience_promo_code, partner_audience_coupon_id
   FROM users WHERE ${lookup};`,
);
if (rows.length === 0) {
  console.error(
    cliArgs.email
      ? `No user found with email: ${cliArgs.email}`
      : `No user holds the audience code ${cliArgs.promoCode!.toUpperCase()}. \`make partners\` lists every partner's code.`,
  );
  process.exit(2);
}
const partner = rows[0];
if (partner.partner_tier !== 'creator') {
  console.error(
    `Error: ${partner.email} is not a Creator Partner (partner_tier=${partner.partner_tier ?? 'none'}).`,
  );
  process.exit(2);
}
const code = partner.partner_audience_promo_code;
if (!code) {
  console.error(`Error: ${partner.email} has no audience code to move.`);
  console.error('Give them one with: make grant-partner-pro EMAIL=... PROMO_CODE=<CODE>');
  process.exit(2);
}

const targetCouponId = cliArgs.couponId || partner.partner_audience_coupon_id || envCouponId;
if (!targetCouponId) {
  console.error('Error: no target coupon. STRIPE_COUPON_PARTNER_AUDIENCE is unset and no');
  console.error('--coupon-id was given.');
  process.exit(1);
}
const targetSource = cliArgs.couponId
  ? '--coupon-id'
  : partner.partner_audience_coupon_id
    ? "this partner's own coupon override"
    : 'STRIPE_COUPON_PARTNER_AUDIENCE';

const stripe = new Stripe(STRIPE_SECRET_KEY);

let target: Stripe.Coupon;
try {
  target = await stripe.coupons.retrieve(targetCouponId);
} catch (err) {
  console.error(`Error: could not read coupon ${targetCouponId} from Stripe: ${errorMessage(err)}`);
  console.error('Check the ID, and that the coupon was made in live mode if this is the live key.');
  process.exit(1);
}
if (!target.valid) {
  console.error(
    `Error: coupon ${target.id} is no longer valid in Stripe (past its redeem-by date, or used up).`,
  );
  process.exit(1);
}

// Every promotion code carrying this string, on any coupon. Stripe matches
// `code` case-insensitively; it is re-checked here so nothing else is touched.
let sameCode: Stripe.PromotionCode[];
try {
  const listed = await stripe.promotionCodes.list({ code, limit: 100 });
  sameCode = listed.data.filter((p) => p.code.toUpperCase() === code.toUpperCase());
} catch (err) {
  console.error(`Error: could not list Stripe promotion codes named ${code}: ${errorMessage(err)}`);
  process.exit(1);
}
const existing: ExistingPromoCode[] = sameCode.map((p) => ({
  id: p.id,
  couponId: p.coupon.id,
  active: p.active,
  partnerUserId: p.metadata?.partner_user_id ?? null,
  timesRedeemed: p.times_redeemed,
}));
const couponById = new Map<string, Stripe.Coupon>([[target.id, target]]);
for (const p of sameCode) couponById.set(p.coupon.id, p.coupon);
const couponLabel = (id: string) => {
  const c = couponById.get(id);
  return c ? `${id} (${describeCoupon(c)})` : id;
};

console.log(`Auth DB:        ${dbPath}`);
console.log(`Partner:        ${partner.email} (id=${partner.id})`);
console.log(`Audience code:  ${code}`);
console.log(`Target coupon:  ${couponLabel(target.id)}${target.name ? ` "${target.name}"` : ''}`);
console.log(`                from ${targetSource}`);
if (!cliArgs.couponId && partner.partner_audience_coupon_id && envCouponId &&
    partner.partner_audience_coupon_id !== envCouponId) {
  console.log(`                (to put this partner's link and code on the standard coupon`);
  console.log(`                instead, add --coupon-id ${envCouponId}, or COUPON_ID= with make)`);
}
console.log(`\nStripe promotion codes named ${code}:`);
if (existing.length === 0) console.log('  (none)');
for (const p of existing) {
  console.log(
    `  ${p.id}  on ${couponLabel(p.couponId)}  ${p.active ? 'active' : 'inactive'}  ` +
      `redeemed ${p.timesRedeemed}x  partner_user_id=${p.partnerUserId ?? '(none)'}`,
  );
}

const plan = planPromoMove({
  partnerUserId: partner.id,
  targetCouponId: target.id,
  envCouponId,
  couponOverride: partner.partner_audience_coupon_id,
  existing,
});
if (plan.kind === 'refuse') {
  console.error(`\nRefusing: ${plan.reason}.`);
  console.error('That code belongs to a different partner. Sort it out in the Stripe Dashboard first.');
  process.exit(1);
}
if (isNoOpMove(plan)) {
  console.log(`\nNothing to do: ${code} is already active on ${target.id}.`);
  process.exit(0);
}

const planned: string[] = [];
for (const p of plan.deactivate) {
  planned.push(
    `switch off ${p.id} (${code} on ${p.couponId})` +
      (p.timesRedeemed > 0
        ? `; the ${p.timesRedeemed} member(s) who already used it keep their discount`
        : ''),
  );
}
if (plan.create) {
  planned.push(`create ${code} on ${target.id} with metadata.partner_user_id=${partner.id}`);
}
if (plan.stampMetadataOn) {
  planned.push(`stamp metadata.partner_user_id=${partner.id} on ${plan.stampMetadataOn}`);
}
if (plan.couponOverride) {
  planned.push(
    `partner_audience_coupon_id ${plan.couponOverride.from ?? '(none)'} -> ` +
      (plan.couponOverride.to ?? '(none: the link uses STRIPE_COUPON_PARTNER_AUDIENCE)'),
  );
}
console.log('\nPlanned changes:');
for (const p of planned) console.log(`  - ${p}`);

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No changes written.');
  process.exit(0);
}

const outcome = await executePromoMove(stripe.promotionCodes, plan, {
  code,
  targetCouponId: target.id,
  partnerUserId: partner.id,
});
if (!outcome.ok) {
  console.error(`\nStripe step failed: ${outcome.error}`);
  if (outcome.restored.length > 0) {
    console.error(
      `Switched ${outcome.restored.join(', ')} back on, so ${code} still works on the old coupon.`,
    );
  }
  if (outcome.notRestored.length > 0) {
    console.error(
      `Could NOT switch ${outcome.notRestored.join(', ')} back on: ${code} gives no discount at checkout right now.`,
    );
    console.error('Re-run this command, or reactivate the code in the Stripe Dashboard.');
  }
  console.error('Nothing was written to the auth DB.');
  process.exit(3);
}

// The DB only records the move, plus the link's override when it has to follow.
// Stripe is already done at this point, so a failure here is reported, not
// rolled back: re-running finds the code on the target and finishes the rest.
const nowIso = new Date().toISOString();
const summary = [
  `${code} -> ${target.id}`,
  outcome.createdId ? `created ${outcome.createdId}` : null,
  plan.stampMetadataOn ? `stamped ${plan.stampMetadataOn}` : null,
  outcome.deactivated.length > 0 ? `switched off ${outcome.deactivated.join(', ')}` : null,
  plan.couponOverride
    ? `override ${plan.couponOverride.from ?? '(none)'} -> ${plan.couponOverride.to ?? '(none)'}`
    : null,
]
  .filter(Boolean)
  .join('; ');
try {
  if (plan.couponOverride) {
    const to = plan.couponOverride.to;
    execSqlite(
      dbPath,
      `UPDATE users SET partner_audience_coupon_id = ${to ? `'${escapeSqlLiteral(to)}'` : 'NULL'},
                        updated_at = '${escapeSqlLiteral(nowIso)}'
       WHERE id = '${escapeSqlLiteral(partner.id)}';`,
    );
  }
  const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
  execSqlite(
    dbPath,
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (
       '${escapeSqlLiteral(auditId)}',
       'partner_promo_code_moved',
       '${escapeSqlLiteral(partner.id)}',
       NULL,
       '${escapeSqlLiteral(partner.email)}',
       'move-partner-promo-script',
       '${escapeSqlLiteral(summary)}',
       '${escapeSqlLiteral(nowIso)}'
     );`,
  );
} catch (err) {
  console.error(`\nStripe was updated (${summary}), but the auth DB write failed: ${errorMessage(err)}`);
  console.error('Re-run the same command to finish.');
  process.exit(5);
}

console.log('\nMoved.');
console.log(`  audience code:   ${code}`);
console.log(`  now on coupon:   ${couponLabel(target.id)}`);
if (outcome.createdId) console.log(`  stripe promo id: ${outcome.createdId}`);
for (const id of outcome.deactivated) console.log(`  switched off:    ${id}`);
