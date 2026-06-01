#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const TIER_DISPLAY_ORDER = ['admin', 'pro', 'basic', 'public'];
const TIER_LABEL = { admin: 'Admin', pro: 'Pro', basic: 'Basic', public: 'Public' };
const VALID_TIER_FILTERS = new Set(Object.values(TIER_LABEL).map((v) => v.toLowerCase()));
const VALID_AUTH_FILTERS = new Set(['L', 'G', 'A']);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const env = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    env[key] = value;
  }

  return env;
}

function isTruthy(value) {
  if (!value) return false;
  return ['1', 'yes', 'true', 'y', 'on'].includes(String(value).trim().toLowerCase());
}

function readCurrentDisclaimerVersion(cwd) {
  // Read the version from core/disclaimer.ts so this script automatically
  // tracks the constant rather than drifting from it.
  const versionFile = path.join(cwd, 'core', 'disclaimer.ts');
  if (!fs.existsSync(versionFile)) return null;
  const match = fs.readFileSync(versionFile, 'utf8').match(/DISCLAIMER_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath = process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  console.error('Tip: set AUTH_DB_PATH in frontend/.env.local or export it in your shell.');
  process.exit(1);
}

const emailOnly = isTruthy(process.env.EMAIL_ONLY);
const tierFilterRaw = (process.env.TIER || '').trim().toLowerCase();
const authFilterRaw = (process.env.AUTH || '').trim().toUpperCase();

if (tierFilterRaw && !VALID_TIER_FILTERS.has(tierFilterRaw)) {
  console.error(`Invalid TIER='${process.env.TIER}'. Expected one of: Admin, Pro, Basic.`);
  process.exit(1);
}
if (authFilterRaw && !VALID_AUTH_FILTERS.has(authFilterRaw)) {
  console.error(`Invalid AUTH='${process.env.AUTH}'. Expected one of: L, G, A.`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const userCols = new Set(db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name));
const hasLegacyProvider = userCols.has('provider') && userCols.has('provider_id');
const hasDisclaimerCols =
  userCols.has('disclaimer_acknowledged_at') && userCols.has('disclaimer_version_acknowledged');
const hasFoundingEligible = userCols.has('founding_eligible');
const hasFoundingStartedAt = userCols.has('founding_member_started_at');
const hasFoundingLifetime = userCols.has('founding_lifetime_applied_at');
const hasStripeSub = userCols.has('stripe_subscription_id');
const hasEmailVerified = userCols.has('email_verified_at');

const baseCols = ['id', 'email', 'tier', 'password_hash', 'created_at'];
if (hasLegacyProvider) baseCols.push('provider', 'provider_id');
if (hasDisclaimerCols) baseCols.push('disclaimer_acknowledged_at', 'disclaimer_version_acknowledged');
if (hasFoundingEligible) baseCols.push('founding_eligible');
if (hasFoundingStartedAt) baseCols.push('founding_member_started_at');
if (hasFoundingLifetime) baseCols.push('founding_lifetime_applied_at');
if (hasStripeSub) baseCols.push('stripe_subscription_id');
if (hasEmailVerified) baseCols.push('email_verified_at');
const rows = db.prepare(`SELECT ${baseCols.join(', ')} FROM users ORDER BY created_at DESC`).all();

// Most recent login_success per user. Single grouped query is cheaper than
// N correlated subqueries and the audit_events.user_id index would help if
// it existed. For users who only registered and auto-session'd (Phase 4
// register API) and never explicitly logged in, this map has no entry.
const hasAuditEvents = !!db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='audit_events'`)
  .get();
const lastLoginByUser = new Map();
if (hasAuditEvents) {
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

const hasIdentitiesTable = !!db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_identities'`)
  .get();

const providersByUser = new Map();
if (hasIdentitiesTable) {
  const identityRows = db.prepare(`SELECT user_id, provider FROM user_identities`).all();
  for (const r of identityRows) {
    if (!providersByUser.has(r.user_id)) providersByUser.set(r.user_id, new Set());
    providersByUser.get(r.user_id).add(r.provider);
  }
}

const currentDisclaimerVersion = readCurrentDisclaimerVersion(cwd);

function authFlags(row) {
  const providers = providersByUser.get(row.id);
  const hasGoogle = providers
    ? providers.has('google')
    : hasLegacyProvider && row.provider === 'google' && !!row.provider_id;
  const hasApple = providers
    ? providers.has('apple')
    : hasLegacyProvider && row.provider === 'apple' && !!row.provider_id;
  return {
    L: !!row.password_hash,
    G: hasGoogle,
    A: hasApple,
  };
}

function formatAuthFlags(flags) {
  return `${flags.L ? 'L' : '-'}${flags.G ? 'G' : '-'}${flags.A ? 'A' : '-'}`;
}

function shortId(id) {
  const idx = String(id ?? '').indexOf('_');
  return idx === -1 ? String(id ?? '') : String(id).slice(idx + 1);
}

function disclaimerAccepted(row) {
  if (!hasDisclaimerCols) return false;
  if (!row.disclaimer_acknowledged_at) return false;
  // Only count as "accepted" if they acked the CURRENT version. Older acks
  // don't count once the wording has been materially updated.
  if (currentDisclaimerVersion && row.disclaimer_version_acknowledged !== currentDisclaimerVersion) {
    return false;
  }
  return true;
}

// Three former columns (Paid / Founder / Verified) are now per-user badges
// appended to the Tier cell. Done to keep the table narrower than a 100-col
// terminal — three separate columns + their 2-char separators added ~20 cols
// of width for one bit of info each. ANSI colour only when stdout is a TTY,
// so piping into less/grep doesn't dump escape codes.
//
// Founder collapses the prior E/R/L substates into a single icon: it's still
// "this account is in the founding cohort." Run a webhook-health or audit
// query if you need to break out who's in which window.
const useColor = !!process.stdout.isTTY;
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const GOLD = '\x1b[1;33m';
const wrap = (color, glyph) => (useColor ? `${color}${glyph}${RESET}` : glyph);
const ICON_PAID = wrap(GREEN, '$');
const ICON_FOUNDER = wrap(GOLD, '♔');
const ICON_VERIFIED = wrap(GREEN, '✉');

function tierBadges(row) {
  const badges = [];
  if (hasStripeSub && row.stripe_subscription_id) badges.push(ICON_PAID);
  if (hasFoundingEligible && Number(row.founding_eligible) === 1) badges.push(ICON_FOUNDER);
  if (hasEmailVerified && row.email_verified_at) badges.push(ICON_VERIFIED);
  return badges.join('');
}

// YYYY-MM-DD only (the time-of-day rarely matters for this overview).
function formatDate(iso) {
  if (!iso) return '—';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso));
  return m ? m[1] : '—';
}

const records = rows
  .map((row) => {
    const flags = authFlags(row);
    return {
      id: shortId(row.id),
      email: String(row.email ?? ''),
      tier: row.tier || 'public',
      badges: tierBadges(row),
      flags,
      authString: formatAuthFlags(flags),
      disclaimer: disclaimerAccepted(row),
      createdAt: formatDate(row.created_at),
      lastLoginAt: formatDate(lastLoginByUser.get(row.id) ?? null),
    };
  })
  .filter((rec) => {
    if (tierFilterRaw && rec.tier.toLowerCase() !== tierFilterRaw) return false;
    if (authFilterRaw && !rec.flags[authFilterRaw]) return false;
    return true;
  });

const tierOrder = (t) => {
  const idx = TIER_DISPLAY_ORDER.indexOf(t);
  return idx === -1 ? TIER_DISPLAY_ORDER.length : idx;
};

const sortedRecords = [...records].sort((a, b) => {
  const ta = tierOrder(a.tier);
  const tb = tierOrder(b.tier);
  if (ta !== tb) return ta - tb;
  return a.email.localeCompare(b.email);
});

if (emailOnly) {
  for (const rec of sortedRecords) console.log(rec.email);
  process.exit(0);
}

const headers = ['User ID', 'Email', 'Tier', 'Auth', 'Disclaimer', 'Created', 'Last login'];
const tierLabelFor = (t) => TIER_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

function tierCell(rec) {
  const label = tierLabelFor(rec.tier);
  return rec.badges ? `${label} ${rec.badges}` : label;
}

const tableRows = sortedRecords.map((rec) => [
  rec.id,
  rec.email,
  tierCell(rec),
  rec.authString,
  rec.disclaimer ? '✓' : '',
  rec.createdAt,
  rec.lastLoginAt,
]);

// CSI escape sequences from ANSI colour are zero-width; strip them before
// counting so the column-width math doesn't over-pad cells that contain
// coloured badge glyphs.
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function visualLength(text) {
  return [...text.replace(ANSI_RE, '')].length;
}

const widths = headers.map((h, i) =>
  Math.max(h.length, ...tableRows.map((r) => visualLength(r[i]))),
);

function padCell(text, width) {
  return text + ' '.repeat(Math.max(0, width - visualLength(text)));
}

function renderRow(cells) {
  return cells.map((cell, i) => padCell(cell, widths[i])).join('  ');
}

function renderDivider() {
  return widths.map((w) => '-'.repeat(w)).join('  ');
}

console.log(renderRow(headers));
console.log(renderDivider());
for (const row of tableRows) console.log(renderRow(row));
console.log('');
console.log(`Total: ${records.length}`);
console.log('');
console.log('Legend:');
console.log('  Tier        Admin / Pro / Basic / Public');
console.log(`              ${ICON_PAID} active Stripe subscription`);
console.log(`              ${ICON_FOUNDER} founding member (eligible, redeemed, or on lifetime discount)`);
console.log(`              ${ICON_VERIFIED} email verified (link clicked, OAuth, or pre-cutover backfill)`);
console.log('  Auth        L = local password, G = Google, A = Apple (- if absent)');
console.log('  Disclaimer  ✓ = acknowledged the current disclaimer version');
console.log('  Last login  Most recent /api/auth/login success; — for users');
console.log('              who only ever auto-session\'d through /register.');
