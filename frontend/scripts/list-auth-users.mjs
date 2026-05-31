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

const baseCols = ['id', 'email', 'tier', 'password_hash', 'created_at'];
if (hasLegacyProvider) baseCols.push('provider', 'provider_id');
if (hasDisclaimerCols) baseCols.push('disclaimer_acknowledged_at', 'disclaimer_version_acknowledged');
if (hasFoundingEligible) baseCols.push('founding_eligible');
if (hasFoundingStartedAt) baseCols.push('founding_member_started_at');
if (hasFoundingLifetime) baseCols.push('founding_lifetime_applied_at');
const rows = db.prepare(`SELECT ${baseCols.join(', ')} FROM users ORDER BY created_at DESC`).all();

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

// Founder status compressed to a single char so the column stays narrow.
//   — : not founding-eligible (default for post-seed signups)
//   E : eligible, hasn't redeemed the founding code yet
//   R : redeemed, currently inside the 12-month intro-discount window
//   L : intro window passed, lifetime 25%-off coupon applied by the webhook
function foundingStatus(row) {
  if (!hasFoundingEligible) return null;
  const eligible = Number(row.founding_eligible) === 1;
  if (!eligible) return '—';
  if (hasFoundingLifetime && row.founding_lifetime_applied_at) return 'L';
  if (hasFoundingStartedAt && row.founding_member_started_at) return 'R';
  return 'E';
}

const records = rows
  .map((row) => {
    const flags = authFlags(row);
    return {
      id: shortId(row.id),
      email: String(row.email ?? ''),
      tier: row.tier || 'public',
      flags,
      authString: formatAuthFlags(flags),
      disclaimer: disclaimerAccepted(row),
      founder: foundingStatus(row),
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

const headers = ['User ID', 'Email', 'Tier', 'Auth'];
if (hasFoundingEligible) headers.push('Founder');
headers.push('Disclaimer');
const tierLabelFor = (t) => TIER_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

const tableRows = sortedRecords.map((rec) => {
  const cells = [
    rec.id,
    rec.email,
    tierLabelFor(rec.tier),
    rec.authString,
  ];
  if (hasFoundingEligible) cells.push(rec.founder ?? '');
  cells.push(rec.disclaimer ? '✓' : '');
  return cells;
});

const widths = headers.map((h, i) =>
  Math.max(h.length, ...tableRows.map((r) => [...r[i]].length)),
);

function padCell(text, width) {
  const visualLength = [...text].length;
  return text + ' '.repeat(Math.max(0, width - visualLength));
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
