#!/usr/bin/env node

// Activate a Creator Partner: flips the user to partner_tier='creator',
// stamps an N-day Pro grant, and (idempotently) ensures they have a
// referral_code so the activation email / DM can include their link.
//
// The Pro grant is just `tier='pro'` with no Stripe subscription — the
// expiry cron (scripts/expire-partner-grants.mjs) downgrades them on or
// after partner_pro_grant_expires_at UNLESS they've since started paying
// for Pro themselves. partner_tier stays set across that expiry so the
// commission ledger keeps accruing on their referrals.
//
// Read-only by default; writes only with --yes.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const DEFAULT_DAYS = 90;
const DEFAULT_COMMISSION_BPS = 3000; // 30%
const DEFAULT_WINDOW_MONTHS = 12;

// Mirror frontend/core/referrals.ts so a partner's pre-minted code obeys the
// same ambiguity rules as one minted lazily by getOrCreateReferralCode.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const args = {
    email: null,
    days: DEFAULT_DAYS,
    commissionBps: DEFAULT_COMMISSION_BPS,
    windowMonths: DEFAULT_WINDOW_MONTHS,
    couponId: null,
    disclosureUrl: null,
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
    else if (arg === '--coupon-id') args.couponId = argv[++i] ?? null;
    else if (arg === '--disclosure-url') args.disclosureUrl = argv[++i] ?? null;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/grant-partner-pro.mjs --email <email> [options] (--dry-run | --yes)

Activates a Creator Partner: flips the user to partner_tier='creator',
grants them <days> of Pro access (tier='pro', no Stripe sub), and pre-mints
a referral_code if one doesn't already exist.

Options:
  -e, --email <email>          Target creator's account email. Required.
      --days <n>               Length of the Pro grant, in days (default ${DEFAULT_DAYS}).
      --commission-bps <bps>   Commission rate in basis points (default ${DEFAULT_COMMISSION_BPS} = 30%).
      --window-months <n>      Commission accrual window per referee, in months from
                               their first paid invoice (default ${DEFAULT_WINDOW_MONTHS}).
      --coupon-id <id>         Stripe coupon ID to apply for this partner's audience.
                               Overrides STRIPE_COUPON_PARTNER_AUDIENCE for this partner
                               only. Leave unset to use the global env coupon.
      --disclosure-url <url>   Where the creator will post the FTC affiliate
                               disclosure (audit trail; not enforced at checkout).
      --dry-run                Show what would change without writing.
  -y, --yes                    Apply the changes.
  -h, --help                   Show this help.

Idempotent: re-running with the same args either bumps the expiry (if the
new --days lands later) or no-ops (if it doesn't). It will never demote a
partner already on tier='admin'.

Requires the sqlite3 CLI (\`apt-get install sqlite3\` on Ubuntu).
Set AUTH_DB_PATH (env or frontend/.env.local) to override the default DB path.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    console.error('Install it with: sudo apt-get install sqlite3');
    process.exit(1);
  }
}

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function runSqlite(dbPath, sql) {
  try {
    return execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = err.stderr?.toString?.() ?? '';
    throw new Error(stderr.trim() || err.message);
  }
}

function querySqlite(dbPath, sql) {
  const output = runSqlite(dbPath, sql).trim();
  if (!output) return [];
  return JSON.parse(output);
}

function execSqlite(dbPath, sql) {
  runSqlite(dbPath, sql);
}

function mintCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

// Pre-mint a referral code if the user doesn't have one. Retries on UNIQUE
// collision against idx_users_referral_code, matching the runtime logic in
// core/referrals.ts:getOrCreateReferralCode.
function ensureReferralCode(dbPath, userId, existingCode) {
  if (existingCode) return existingCode;
  const nowIso = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = mintCode();
    try {
      execSqlite(
        dbPath,
        `UPDATE users SET referral_code = '${escapeSqlLiteral(code)}',
                          updated_at = '${escapeSqlLiteral(nowIso)}'
         WHERE id = '${escapeSqlLiteral(userId)}';`,
      );
      return code;
    } catch (err) {
      // UNIQUE collision: re-read and retry, or accept whatever raced in.
      const fresh = querySqlite(
        dbPath,
        `SELECT referral_code FROM users WHERE id = '${escapeSqlLiteral(userId)}';`,
      );
      if (fresh[0]?.referral_code) return fresh[0].referral_code;
    }
  }
  throw new Error('Could not generate a unique referral code after 5 attempts');
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
if (!Number.isFinite(cliArgs.days) || cliArgs.days <= 0) {
  console.error('Error: --days must be a positive number.');
  process.exit(1);
}
if (!Number.isFinite(cliArgs.commissionBps) || cliArgs.commissionBps < 0 || cliArgs.commissionBps > 10000) {
  console.error('Error: --commission-bps must be between 0 and 10000.');
  process.exit(1);
}
if (!Number.isFinite(cliArgs.windowMonths) || cliArgs.windowMonths <= 0) {
  console.error('Error: --window-months must be a positive number.');
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

const email = cliArgs.email.trim().toLowerCase();
const rows = querySqlite(
  dbPath,
  `SELECT id, email, tier, partner_tier, partner_pro_grant_expires_at,
          partner_activated_at, referral_code,
          stripe_subscription_id, subscription_status
   FROM users WHERE email = '${escapeSqlLiteral(email)}';`,
);

if (rows.length === 0) {
  console.error(`No user found with email: ${email}`);
  process.exit(2);
}
const user = rows[0];

const now = new Date();
const newExpiry = new Date(now.getTime() + cliArgs.days * 24 * 60 * 60 * 1000);
const existingExpiryMs = user.partner_pro_grant_expires_at
  ? Date.parse(user.partner_pro_grant_expires_at)
  : null;
const effectiveExpiryIso =
  existingExpiryMs && existingExpiryMs > newExpiry.getTime()
    ? user.partner_pro_grant_expires_at
    : newExpiry.toISOString();

// Don't demote admin accounts to pro. Don't try to flip tier=pro for users
// who are already there (incl. anyone paying for Pro). Otherwise grant Pro.
const nextTier =
  user.tier === 'admin' ? 'admin' : user.tier === 'pro' ? 'pro' : 'pro';
const tierChanges = nextTier !== user.tier && user.tier !== 'admin';

const wasAlreadyActivePartner = user.partner_tier === 'creator';
const couponChanges = cliArgs.couponId != null;
const disclosureChanges = cliArgs.disclosureUrl != null;
const expiryChanges = effectiveExpiryIso !== user.partner_pro_grant_expires_at;

console.log(`Auth DB:        ${dbPath}`);
console.log(`User:           ${user.email} (id=${user.id})`);
console.log(`Current tier:   ${user.tier}`);
console.log(`Current state:  partner_tier=${user.partner_tier ?? '(none)'}`);
console.log(`                grant_expires=${user.partner_pro_grant_expires_at ?? '(none)'}`);
console.log(`                referral_code=${user.referral_code ?? '(unminted)'}`);
if (user.stripe_subscription_id) {
  console.log(`                stripe_sub=${user.stripe_subscription_id} status=${user.subscription_status}`);
}

const planned = [];
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
if (couponChanges) planned.push(`partner_audience_coupon_id -> ${cliArgs.couponId}`);
if (disclosureChanges) planned.push(`partner_disclosure_url -> ${cliArgs.disclosureUrl}`);
if (!user.referral_code) planned.push(`referral_code -> (mint)`);

console.log('\nPlanned changes:');
for (const p of planned) console.log(`  - ${p}`);

if (cliArgs.dryRun) {
  console.log('\n[dry-run] No changes written.');
  process.exit(0);
}
if (!cliArgs.yes) {
  console.log('\nRefusing to write without --yes. Re-run with --yes to apply, or --dry-run to preview.');
  process.exit(1);
}

const nowIso = now.toISOString();
const referralCode = ensureReferralCode(dbPath, user.id, user.referral_code);

const setClauses = [
  `partner_tier = 'creator'`,
  `partner_commission_bps = ${cliArgs.commissionBps}`,
  `partner_commission_window_months = ${cliArgs.windowMonths}`,
  `partner_pro_grant_expires_at = '${escapeSqlLiteral(effectiveExpiryIso)}'`,
  `partner_activated_at = COALESCE(partner_activated_at, '${escapeSqlLiteral(nowIso)}')`,
  `updated_at = '${escapeSqlLiteral(nowIso)}'`,
];
if (tierChanges) setClauses.push(`tier = 'pro'`);
if (couponChanges) {
  setClauses.push(`partner_audience_coupon_id = '${escapeSqlLiteral(cliArgs.couponId)}'`);
}
if (disclosureChanges) {
  setClauses.push(`partner_disclosure_url = '${escapeSqlLiteral(cliArgs.disclosureUrl)}'`);
}

execSqlite(
  dbPath,
  `UPDATE users SET ${setClauses.join(', ')} WHERE id = '${escapeSqlLiteral(user.id)}';`,
);

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
     '${escapeSqlLiteral(`grant ${cliArgs.days}d Pro, bps=${cliArgs.commissionBps}, window=${cliArgs.windowMonths}mo, expires=${effectiveExpiryIso}`)}',
     '${escapeSqlLiteral(nowIso)}'
   );`,
);

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const partnerLink = `${appUrl.replace(/\/+$/, '')}/register?ref=${encodeURIComponent(referralCode)}`;

console.log('\nActivated.');
console.log(`  referral_code: ${referralCode}`);
console.log(`  partner link:  ${partnerLink}`);
console.log(`  expires:       ${effectiveExpiryIso}`);
console.log(
  '\nNext: paste the partner link into the activation DM. The 90-day Pro grant',
);
console.log('is live immediately; the expiry cron downgrades them if they do not subscribe.');
