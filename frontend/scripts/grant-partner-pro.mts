#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/grant-partner-pro.mts \
//     --email <email> [--days 90] [--commission-bps 3000] [--window-months 12] \
//     [--promo-code <CODE>] [--coupon-id <id>] [--disclosure-url <url>] \
//     (--dry-run | --yes)
//
// Activates a Creator Partner end-to-end:
//   1. Flips the user to partner_tier='creator', stamps a Pro grant, and
//      records the commission rate + window for Phase 3 accrual.
//   2. Pre-mints a referral_code if one doesn't exist (so the partner link
//      can ship in the activation DM).
//   3. Creates a Stripe promotion_code attached to the partner audience
//      coupon, with metadata.partner_user_id so the webhook can
//      back-attribute audience members who type the code at Stripe checkout
//      (i.e. didn't click the partner's ?ref= link).
//
// All three are required for "seamless" — without step 3 the typeable code
// works for the discount but not for attribution, and the creator earns
// nothing on that subset of conversions.
//
// Read-only by default; --yes is required to write.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

import Stripe from 'stripe';

const DEFAULT_DAYS = 90;
const DEFAULT_COMMISSION_BPS = 3000; // 30%
const DEFAULT_WINDOW_MONTHS = 12;

// Mirror frontend/core/referrals.ts so a partner's pre-minted referral_code
// follows the same ambiguity rules as one minted lazily by the runtime
// helper. Different alphabet than the audience promo code below — these are
// machine-friendly, the promo code is human-friendly.
const REFERRAL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REFERRAL_LENGTH = 8;

// Audience promo code rules: uppercase A-Z and 0-9, 4-32 chars, no leading
// or trailing digits (so SPYLEVELS25 parses as "brand + year" not noise).
// Validated rather than auto-generated unless the operator opts in by
// omitting --promo-code.
const PROMO_CODE_REGEX = /^[A-Z][A-Z0-9]{2,30}[A-Z0-9]$/;

// X (formerly Twitter) handle rules — mirror frontend/core/serverAuth.ts:
// 1-15 chars, letters/digits/underscore, stored without the leading '@'.
const X_HANDLE_REGEX = /^[A-Za-z0-9_]{1,15}$/;
function normalizeXHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').trim();
}

type Args = {
  email: string | null;
  days: number;
  commissionBps: number;
  windowMonths: number;
  promoCode: string | null;
  couponId: string | null;
  disclosureUrl: string | null;
  xHandle: string | null;
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
    days: DEFAULT_DAYS,
    commissionBps: DEFAULT_COMMISSION_BPS,
    windowMonths: DEFAULT_WINDOW_MONTHS,
    promoCode: null,
    couponId: null,
    disclosureUrl: null,
    xHandle: null,
    dryRun: false,
    yes: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = argv[++i] ?? null;
    else if (arg === '--days') args.days = Number(argv[++i]);
    else if (arg === '--commission-bps') args.commissionBps = Number(argv[++i]);
    else if (arg === '--window-months') args.windowMonths = Number(argv[++i]);
    else if (arg === '--promo-code') args.promoCode = (argv[++i] ?? '').toUpperCase();
    else if (arg === '--coupon-id') args.couponId = argv[++i] ?? null;
    else if (arg === '--disclosure-url') args.disclosureUrl = argv[++i] ?? null;
    else if (arg === '--x-handle' || arg === '--x') args.xHandle = argv[++i] ?? null;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/grant-partner-pro.mts \\
    --email <email> [options] (--dry-run | --yes)

Activates a Creator Partner: flips them to partner_tier='creator', grants
<days> of Pro access, pre-mints a referral_code, and registers a Stripe
promotion_code so the typeable code works at Stripe checkout too.

Options:
  -e, --email <email>          Target creator's account email. Required.
      --days <n>               Pro grant length in days (default ${DEFAULT_DAYS}).
      --commission-bps <bps>   Commission rate, basis points (default ${DEFAULT_COMMISSION_BPS} = 30%).
      --window-months <n>      Commission accrual window per referee, in months
                               from their first paid invoice (default ${DEFAULT_WINDOW_MONTHS}).
      --promo-code <CODE>      Human-readable promo code (e.g. SPYLEVELS25).
                               Uppercase letters + digits, must start with a
                               letter, 4-32 chars. Defaults to an auto-derived
                               code from the email local-part if omitted.
      --coupon-id <id>         Custom Stripe coupon ID for this partner's
                               audience. Overrides STRIPE_COUPON_PARTNER_AUDIENCE
                               for this partner only. Leave unset to use the
                               global env coupon.
      --disclosure-url <url>   Where the creator posts the FTC affiliate
                               disclosure (audit trail; not enforced at checkout).
      --x-handle <handle>      Creator's X (formerly Twitter) handle, with or
                               without a leading '@'. 1-15 chars, letters,
                               numbers, underscores. Pass an empty string to
                               clear a previously set handle. Leave unset to
                               leave the current handle untouched.
      --dry-run                Preview changes without writing.
  -y, --yes                    Apply the changes.
  -h, --help                   Show this help.

Idempotent: re-running bumps the expiry forward if the new --days lands
later, no-ops otherwise. Will not touch admin accounts.

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

function mintReferralCode(): string {
  const bytes = crypto.randomBytes(REFERRAL_LENGTH);
  let out = '';
  for (let i = 0; i < REFERRAL_LENGTH; i += 1) {
    out += REFERRAL_ALPHABET[bytes[i] % REFERRAL_ALPHABET.length];
  }
  return out;
}

// Pre-mint a referral code if absent. Retries on UNIQUE collision against
// idx_users_referral_code (same shape as core/referrals.ts).
function ensureReferralCode(dbPath: string, userId: string, existing: string | null): string {
  if (existing) return existing;
  const nowIso = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = mintReferralCode();
    try {
      execSqlite(
        dbPath,
        `UPDATE users SET referral_code = '${escapeSqlLiteral(code)}',
                          updated_at = '${escapeSqlLiteral(nowIso)}'
         WHERE id = '${escapeSqlLiteral(userId)}';`,
      );
      return code;
    } catch {
      const fresh = querySqlite<{ referral_code: string | null }>(
        dbPath,
        `SELECT referral_code FROM users WHERE id = '${escapeSqlLiteral(userId)}';`,
      );
      if (fresh[0]?.referral_code) return fresh[0].referral_code;
    }
  }
  throw new Error('Could not generate a unique referral_code after 5 attempts');
}

// Derive a sensible default promo code from the email local-part. Keeps
// only [A-Z0-9], trims to 24 chars, prefixes a letter if needed so it
// passes PROMO_CODE_REGEX. Operators can always override via --promo-code.
function defaultPromoCode(email: string): string {
  const local = email.split('@')[0] ?? '';
  let candidate = local.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]/.test(candidate)) candidate = 'P' + candidate;
  if (candidate.length < 4) candidate = candidate + 'PARTNER';
  if (candidate.length > 24) candidate = candidate.slice(0, 24);
  if (!/[A-Z0-9]$/.test(candidate)) candidate += '1';
  return candidate;
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}
if (!cliArgs.email) {
  console.error('Error: --email is required.');
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
if (!Number.isFinite(cliArgs.days) || cliArgs.days <= 0) {
  console.error('Error: --days must be a positive number.');
  process.exit(1);
}
if (
  !Number.isFinite(cliArgs.commissionBps) ||
  cliArgs.commissionBps < 0 ||
  cliArgs.commissionBps > 10000
) {
  console.error('Error: --commission-bps must be between 0 and 10000.');
  process.exit(1);
}
if (!Number.isFinite(cliArgs.windowMonths) || cliArgs.windowMonths <= 0) {
  console.error('Error: --window-months must be a positive number.');
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

// Pre-flight: the partner_* columns land via the App's lazy migration
// (frontend/core/db.ts initDb), which only runs on first DB touch from the
// PM2 process. A grant attempted before that migration has landed would
// fail mid-script with a confusing "no such column" SQL error AFTER the
// preview is printed. Detect it up front and point at the fix.
const userCols = new Set(
  querySqlite<{ name: string }>(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
);
const requiredCols = [
  'partner_tier',
  'partner_audience_promo_code',
  'partner_pro_grant_expires_at',
  // The user SELECT below reads x_handle, so require it too — a DB migrated
  // before this column existed would otherwise fail mid-script.
  'x_handle',
];
const missingCols = requiredCols.filter((c) => !userCols.has(c));
if (missingCols.length > 0) {
  console.error(`Error: required users columns are missing: ${missingCols.join(', ')}`);
  console.error('The auth DB schema migration has not run against this database file.');
  console.error('Fix: cd ~/zerogex-web && make migrate   (forces the lazy migration to run)');
  console.error('     or run a full deploy (`make rebuild` or `./deploy/deploy.sh`) and then');
  console.error('     hit any /api/* endpoint to trigger the migration via the app process.');
  process.exit(4);
}

const STRIPE_SECRET_KEY = envOrLocal('STRIPE_SECRET_KEY');
if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY is not set (env or frontend/.env.local).');
  console.error('Required so the script can create the audience promotion_code with');
  console.error('metadata.partner_user_id — without it, audience members who type the');
  console.error('code at Stripe checkout would not be attributed to the partner.');
  process.exit(1);
}

const audienceCouponId =
  cliArgs.couponId || envOrLocal('STRIPE_COUPON_PARTNER_AUDIENCE') || null;
if (!audienceCouponId) {
  console.error('Error: no audience coupon configured.');
  console.error('Set STRIPE_COUPON_PARTNER_AUDIENCE in env, or pass --coupon-id explicitly.');
  console.error('See .env.example for the recommended Stripe coupon settings.');
  process.exit(1);
}

const email = cliArgs.email.trim().toLowerCase();
type UserRow = {
  id: string;
  email: string;
  tier: string;
  partner_tier: string | null;
  partner_pro_grant_expires_at: string | null;
  partner_activated_at: string | null;
  partner_audience_promo_code: string | null;
  referral_code: string | null;
  x_handle: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
};
const rows = querySqlite<UserRow>(
  dbPath,
  `SELECT id, email, tier, partner_tier, partner_pro_grant_expires_at,
          partner_activated_at, partner_audience_promo_code, referral_code,
          x_handle, stripe_subscription_id, subscription_status
   FROM users WHERE email = '${escapeSqlLiteral(email)}';`,
);
if (rows.length === 0) {
  console.error(`No user found with email: ${email}`);
  process.exit(2);
}
const user = rows[0];

// Resolve the desired promo code:
//   1. --promo-code if provided (must be valid + unique).
//   2. Existing partner_audience_promo_code on the row (re-running for the
//      same partner reuses what's there, so the Stripe promo code we
//      already created at first activation isn't orphaned).
//   3. Auto-derived from email local-part.
let desiredPromoCode = cliArgs.promoCode || user.partner_audience_promo_code;
if (!desiredPromoCode) desiredPromoCode = defaultPromoCode(email);
if (!PROMO_CODE_REGEX.test(desiredPromoCode)) {
  console.error(`Error: promo code "${desiredPromoCode}" is invalid.`);
  console.error('Must start with a letter, be 4-32 chars, uppercase A-Z and 0-9 only.');
  process.exit(1);
}

// Uniqueness check (only meaningful if the code differs from what this user
// already has). Skip the check when re-running with the same code, since
// the row that "owns" it is this user.
if (desiredPromoCode !== user.partner_audience_promo_code) {
  const clash = querySqlite<{ id: string; email: string }>(
    dbPath,
    `SELECT id, email FROM users
     WHERE partner_audience_promo_code = '${escapeSqlLiteral(desiredPromoCode)}'
     LIMIT 1;`,
  );
  if (clash.length > 0 && clash[0].id !== user.id) {
    console.error(
      `Error: promo code "${desiredPromoCode}" is already in use by ${clash[0].email}.`,
    );
    console.error('Pass --promo-code to choose a different one.');
    process.exit(1);
  }
}

// Resolve the desired X handle. `undefined` means "--x-handle not passed, leave
// as-is"; `null` means "explicitly clear it" (operator passed an empty value);
// a string is the validated, normalized handle to store.
let desiredXHandle: string | null | undefined;
if (cliArgs.xHandle != null) {
  const normalized = normalizeXHandle(cliArgs.xHandle);
  if (normalized === '') {
    desiredXHandle = null;
  } else if (X_HANDLE_REGEX.test(normalized)) {
    desiredXHandle = normalized;
  } else {
    console.error(`Error: X handle "${cliArgs.xHandle}" is invalid.`);
    console.error('Must be 1-15 chars, letters/numbers/underscores only (with or without a leading @).');
    process.exit(1);
  }
}
const xHandleChanges = desiredXHandle !== undefined && desiredXHandle !== user.x_handle;
// The handle after this run — the new value if changing, else what's on file.
const finalXHandle = desiredXHandle !== undefined ? desiredXHandle : user.x_handle;

const now = new Date();
const newExpiry = new Date(now.getTime() + cliArgs.days * 24 * 60 * 60 * 1000);
const existingExpiryMs = user.partner_pro_grant_expires_at
  ? Date.parse(user.partner_pro_grant_expires_at)
  : null;
const effectiveExpiryIso =
  existingExpiryMs && existingExpiryMs > newExpiry.getTime()
    ? user.partner_pro_grant_expires_at!
    : newExpiry.toISOString();

const tierChanges = user.tier !== 'pro' && user.tier !== 'admin';
const wasAlreadyActivePartner = user.partner_tier === 'creator';
const promoCodeChanges = desiredPromoCode !== user.partner_audience_promo_code;
const couponChanges = cliArgs.couponId != null;
const disclosureChanges = cliArgs.disclosureUrl != null;
const expiryChanges = effectiveExpiryIso !== user.partner_pro_grant_expires_at;

console.log(`Auth DB:        ${dbPath}`);
console.log(`User:           ${user.email} (id=${user.id})`);
console.log(`Current tier:   ${user.tier}`);
console.log(
  `Current state:  partner_tier=${user.partner_tier ?? '(none)'} grant_expires=${user.partner_pro_grant_expires_at ?? '(none)'}`,
);
console.log(`                referral_code=${user.referral_code ?? '(unminted)'}`);
console.log(
  `                promo_code=${user.partner_audience_promo_code ?? '(unset)'} -> ${desiredPromoCode}`,
);
console.log(
  `                x_handle=${user.x_handle ? '@' + user.x_handle : '(unset)'}${
    desiredXHandle !== undefined ? ` -> ${desiredXHandle ? '@' + desiredXHandle : '(clear)'}` : ''
  }`,
);
if (user.stripe_subscription_id) {
  console.log(`                stripe_sub=${user.stripe_subscription_id} status=${user.subscription_status}`);
}

const planned: string[] = [];
if (tierChanges) planned.push(`tier ${user.tier} -> pro`);
if (!wasAlreadyActivePartner) planned.push(`partner_tier (none) -> creator`);
if (expiryChanges) {
  planned.push(
    `partner_pro_grant_expires_at ${user.partner_pro_grant_expires_at ?? '(none)'} -> ${effectiveExpiryIso}`,
  );
}
if (!user.partner_activated_at) planned.push(`partner_activated_at -> ${now.toISOString()}`);
planned.push(`partner_commission_bps -> ${cliArgs.commissionBps}`);
planned.push(`partner_commission_window_months -> ${cliArgs.windowMonths}`);
if (promoCodeChanges) {
  planned.push(`partner_audience_promo_code -> ${desiredPromoCode}`);
}
if (couponChanges) planned.push(`partner_audience_coupon_id -> ${cliArgs.couponId}`);
if (disclosureChanges) planned.push(`partner_disclosure_url -> ${cliArgs.disclosureUrl}`);
if (xHandleChanges) planned.push(`x_handle -> ${desiredXHandle ? '@' + desiredXHandle : '(clear)'}`);
if (!user.referral_code) planned.push(`referral_code -> (mint)`);
planned.push(`stripe promotion_code "${desiredPromoCode}" -> ensure exists on ${audienceCouponId}`);

console.log('\nPlanned changes:');
for (const p of planned) console.log(`  - ${p}`);

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No changes written.');
  process.exit(0);
}

const nowIso = now.toISOString();
const referralCode = ensureReferralCode(dbPath, user.id, user.referral_code);

const setClauses = [
  `partner_tier = 'creator'`,
  `partner_commission_bps = ${cliArgs.commissionBps}`,
  `partner_commission_window_months = ${cliArgs.windowMonths}`,
  `partner_pro_grant_expires_at = '${escapeSqlLiteral(effectiveExpiryIso)}'`,
  `partner_activated_at = COALESCE(partner_activated_at, '${escapeSqlLiteral(nowIso)}')`,
  `partner_audience_promo_code = '${escapeSqlLiteral(desiredPromoCode)}'`,
  `updated_at = '${escapeSqlLiteral(nowIso)}'`,
];
if (tierChanges) setClauses.push(`tier = 'pro'`);
if (couponChanges) {
  setClauses.push(`partner_audience_coupon_id = '${escapeSqlLiteral(cliArgs.couponId!)}'`);
}
if (disclosureChanges) {
  setClauses.push(`partner_disclosure_url = '${escapeSqlLiteral(cliArgs.disclosureUrl!)}'`);
}
if (xHandleChanges) {
  setClauses.push(
    desiredXHandle === null ? `x_handle = NULL` : `x_handle = '${escapeSqlLiteral(desiredXHandle!)}'`,
  );
}

execSqlite(
  dbPath,
  `UPDATE users SET ${setClauses.join(', ')} WHERE id = '${escapeSqlLiteral(user.id)}';`,
);

// Create the Stripe promotion code AFTER the DB write so a Stripe failure
// is a recoverable retry (rerunning the script with the same args will
// see the persisted promo_code, skip the DB writes, and just re-attempt
// the Stripe side). Inverse ordering would orphan the Stripe promo code
// against a row that doesn't reference it.
const stripe = new Stripe(STRIPE_SECRET_KEY);

async function ensureStripePromotionCode(): Promise<string> {
  // Stripe promotion codes are UNIQUE per (coupon, code). List the existing
  // codes on the coupon and either reuse or create. Active filter weeds out
  // a soft-archived code that would block a re-create.
  const existing = await stripe.promotionCodes.list({
    coupon: audienceCouponId!,
    code: desiredPromoCode!,
    limit: 1,
  });
  if (existing.data.length > 0) {
    const promo = existing.data[0];
    // Stamp/refresh the metadata so a code created manually (without
    // partner_user_id) is now back-attributable.
    const wantedPartnerId = user.id;
    if (promo.metadata?.partner_user_id !== wantedPartnerId) {
      await stripe.promotionCodes.update(promo.id, {
        metadata: { partner_user_id: wantedPartnerId },
      });
    }
    if (!promo.active) {
      console.warn(
        `  ⚠ Stripe promotion code ${promo.id} is INACTIVE on Stripe. Re-enable it manually:`,
      );
      console.warn(`     stripe dashboard -> Coupons -> ${audienceCouponId} -> Codes -> ${desiredPromoCode}`);
    }
    return promo.id;
  }
  const created = await stripe.promotionCodes.create({
    coupon: audienceCouponId!,
    code: desiredPromoCode!,
    metadata: { partner_user_id: user.id },
  });
  return created.id;
}

let stripePromoId: string | null = null;
try {
  stripePromoId = await ensureStripePromotionCode();
} catch (err) {
  const message = err instanceof Error ? err.message : 'unknown Stripe error';
  console.error(`\nStripe promotion code create/update failed: ${message}`);
  console.error('DB changes were applied. Re-run the script (same args) to retry the Stripe side.');
  process.exit(3);
}

const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
execSqlite(
  dbPath,
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (
     '${escapeSqlLiteral(auditId)}',
     'partner_grant_created',
     '${escapeSqlLiteral(user.id)}',
     NULL,
     '${escapeSqlLiteral(user.email)}',
     'grant-partner-pro-script',
     '${escapeSqlLiteral(`grant ${cliArgs.days}d Pro, bps=${cliArgs.commissionBps}, window=${cliArgs.windowMonths}mo, expires=${effectiveExpiryIso}, promo=${desiredPromoCode}, x_handle=${finalXHandle ? '@' + finalXHandle : '(none)'}, stripe_promo=${stripePromoId}`)}',
     '${escapeSqlLiteral(nowIso)}'
   );`,
);

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const partnerLink = `${appUrl.replace(/\/+$/, '')}/register?ref=${encodeURIComponent(referralCode)}`;
const promoLink = `${appUrl.replace(/\/+$/, '')}/register?ref=${encodeURIComponent(desiredPromoCode)}`;

console.log('\nActivated.');
console.log(`  referral_code:       ${referralCode}`);
console.log(`  audience promo code: ${desiredPromoCode}`);
console.log(`  x handle:            ${finalXHandle ? '@' + finalXHandle : '(none)'}`);
console.log(`  partner link:        ${partnerLink}`);
console.log(`  audience-friendly:   ${promoLink}   (same effect, prettier URL)`);
console.log(`  expires:             ${effectiveExpiryIso}`);
console.log(`  stripe promo id:     ${stripePromoId}`);
console.log('');
console.log(
  'Attribution works three ways: clicking either link (sets referred_by_code at register), or',
);
console.log(
  'typing the promo code at Stripe checkout (webhook back-attributes via promotion_code metadata).',
);
