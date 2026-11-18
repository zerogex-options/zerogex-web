#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types --no-warnings scripts/gmail-duplicates.mts
// or, from the repo root:
//   make gmail-duplicates
//
// WHY THIS EXISTS: Gmail ignores dots and anything after a "+", so
// first.last@gmail.com and firstlast@gmail.com are one inbox. Sign-in used to
// compare addresses exactly, so one member could end up holding two accounts:
// the paid one they registered under one spelling, and a free one that "Sign in
// with Google" created under the spelling Google reported (2026-11-18,
// docs/outreach/2026-11-17-yordan-spx-0dte-oi-heatmap.md). Sign-in now matches
// across spellings (core/mailboxKey.ts), but only onto the ONE live account on
// an inbox, and an account that already has its Google link keeps it. Pairs made
// before the fix stay exactly as they are. This lists them, so a person can look
// at each member and decide what, if anything, to merge. Nothing here merges.
//
// One block per inbox, paid accounts' inboxes first. Per account: the address as
// stored, tier, subscription_status, last_seen_at, when it was created, how it
// signs in (password, google, apple), and whether it is soft-deleted.
//
// STRICTLY READ-ONLY: the database is opened with readOnly:true, so it cannot
// write even if something here is wrong. The inbox is worked out from
// users.email with the same function sign-in uses, not read from
// users.mailbox_key, so the answer is the same before and after the app first
// boots on the code that adds that column.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isGmailAddress, mailboxKey } from '../core/mailboxKey.ts';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
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

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/gmail-duplicates.mts

Lists every Gmail inbox that has more than one account: spellings of one
address that differ only by dots, a +tag, or gmail.com vs googlemail.com.
For each account: tier, subscription status, last seen, created, and how it
signs in. Merges nothing.

Reads AUTH_DB_PATH from env or .env.local (default frontend/data/auth.db).
READ-ONLY — opens the DB with readOnly:true and writes nothing.`);
  process.exit(0);
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

const db = new DatabaseSync(dbPath, { readOnly: true });
// The live site writes to this database whenever a member is active, and
// node:sqlite's busy timeout is zero unless set: a statement that meets the
// site's lock fails on the spot with "database is locked". Wait instead, the
// way the site does (core/db.ts sets busy_timeout too).
db.exec('PRAGMA busy_timeout = 15000;');

// Every column below beyond the original six was added by core/db.ts over time.
// Read each one only if this database has it, so an old copy (a backup, a
// laptop) still reports instead of failing on a missing column.
const userCols = new Set(
  (db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map((c) => String(c.name)),
);
const optional = (name: string) => (userCols.has(name) ? `u.${name}` : 'NULL');
const hasIdentities = !!db
  .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user_identities'")
  .get();

type Account = {
  id: string;
  email: string;
  tier: string | null;
  created_at: string | null;
  has_password: number;
  subscription_status: string | null;
  last_seen_at: string | null;
  deleted_at: string | null;
  providers: string | null;
};

const accounts = (
  db
    .prepare(
      `SELECT u.id, u.email, u.tier, u.created_at,
              u.password_hash IS NOT NULL AS has_password,
              ${optional('subscription_status')} AS subscription_status,
              ${optional('last_seen_at')} AS last_seen_at,
              ${optional('deleted_at')} AS deleted_at,
              ${
                hasIdentities
                  ? `(SELECT group_concat(i.provider, ',') FROM user_identities i WHERE i.user_id = u.id)`
                  : 'NULL'
              } AS providers
         FROM users u`,
    )
    .all() as Account[]
).filter((a) => isGmailAddress(a.email));

const byInbox = new Map<string, Account[]>();
for (const account of accounts) {
  const key = mailboxKey(account.email);
  const group = byInbox.get(key);
  if (group) group.push(account);
  else byInbox.set(key, [account]);
}

const isPaid = (a: Account) => a.deleted_at == null && !!a.tier && a.tier !== 'public';
const groups = [...byInbox.entries()]
  .filter(([, members]) => members.length > 1)
  .map(([inbox, members]) => ({
    inbox,
    members: [...members].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    paid: members.some(isPaid),
    live: members.filter((a) => a.deleted_at == null).length,
    lastSeen: members.reduce((latest, a) => (a.last_seen_at && a.last_seen_at > latest ? a.last_seen_at : latest), ''),
  }))
  // Inboxes holding a paid account first: those are the members a free
  // duplicate can strand behind the paywall. Then the most recently active.
  .sort((a, b) => Number(b.paid) - Number(a.paid) || b.lastSeen.localeCompare(a.lastSeen) || a.inbox.localeCompare(b.inbox));

const minute = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '-');
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '-');
const signIn = (a: Account) =>
  [a.has_password ? 'password' : null, ...(a.providers ? a.providers.split(',').sort() : [])]
    .filter(Boolean)
    .join(', ') || 'none';

console.log(`Gmail inboxes with more than one account — ${dbPath} (read-only)`);
console.log('');

if (groups.length === 0) {
  console.log('None. Every Gmail inbox has at most one account.');
  process.exit(0);
}

const header = ['EMAIL', 'TIER', 'SUBSCRIPTION', 'LAST SEEN (UTC)', 'CREATED', 'SIGN-IN', 'NOTE'];
for (const group of groups) {
  const rows = group.members.map((a) => [
    a.email,
    a.tier ?? '-',
    a.subscription_status ?? '-',
    minute(a.last_seen_at),
    day(a.created_at),
    signIn(a),
    a.deleted_at ? `deleted ${day(a.deleted_at)}` : '',
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => `  ${cells.map((c, i) => c.padEnd(widths[i])).join('  ')}`.trimEnd();
  console.log(`${group.inbox} — ${group.members.length} accounts, ${group.live} live`);
  console.log(line(header));
  for (const row of rows) console.log(line(row));
  console.log('');
}

const accountCount = groups.reduce((n, g) => n + g.members.length, 0);
const severalLive = groups.filter((g) => g.live > 1).length;
console.log(
  `${groups.length} inbox${groups.length === 1 ? '' : 'es'} with more than one account, ` +
    `${accountCount} accounts in all; ${severalLive} with more than one live account.`,
);
console.log(
  'Sign-in only matches across spellings when ONE live account is on the inbox, and an ' +
    'account that already has a Google or Apple link keeps it. Nothing was changed.',
);
