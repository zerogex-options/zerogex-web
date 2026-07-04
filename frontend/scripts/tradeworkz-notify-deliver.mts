#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/tradeworkz-notify-deliver.mts \
//     [--dry-run | --yes] [--limit N] [--preview-to <email>]
//
// Drains queued TradeWorkz email notifications:
//   1. GET  /api/tradeworkz/internal/queued-notifications?channel=email
//      -> rows the reconciler wrote when a followed bot opened / closed
//         a position for a user whose channel prefs include 'email'.
//   2. Resolve each row's end_user -> recipient email via the auth SQLite DB.
//   3. Render + send via core/mailer.ts sendTradeworkzNotification().
//   4. POST /api/tradeworkz/internal/mark-notification { id, status }.
//
// Intended to be scheduled by
// zerogex-web-tradeworkz-notify.timer every minute.
//
// Idempotency: the mark-notification call flips the row to 'sent' or
// 'failed' before we move on, so a rerun ignores rows we've already
// processed. A crash between "Resend accepted" and "mark-notification
// returned" leaves the row queued; the next run resends. Resend is
// idempotent enough at the transport level that a duplicate email is
// preferable to a silently-dropped one, so this trade-off is deliberate.
//
// Failure modes handled inline:
//   * Recipient email not found -> mark failed with "unknown recipient".
//   * User's email not verified -> mark failed with "unverified recipient".
//   * Resend throws -> mark failed with the error message; row can be
//     retried by clearing status back to 'queued' from the DB.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import { sendTradeworkzNotification } from '../core/mailer.ts';
import type { TradeworkzEmailPayload } from '../core/mailer.ts';

interface QueuedRow {
  id: number;
  end_user: string;
  bot_id: string;
  bot_display_name: string | null;
  event_type: string;
  trade_id: number | null;
  position_id: number | null;
  channel: string;
  status: string;
  payload: TradeworkzEmailPayload;
  sent_at: string | null;
}

interface QueuedResponse {
  entries: QueuedRow[];
}

type Args = {
  dryRun: boolean;
  yes: boolean;
  help: boolean;
  limit: number;
  previewTo: string | null;
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
    dryRun: false,
    yes: false,
    help: false,
    limit: 50,
    previewTo: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '-y' || a === '--yes') args.yes = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else if (a === '--limit') {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) args.limit = Math.floor(n);
    } else if (a === '--preview-to') {
      args.previewTo = argv[++i] ?? null;
    }
  }
  return args;
}

function usage() {
  console.log(`\nUsage: tradeworkz-notify-deliver.mts [options]

Drains queued TradeWorkz email notifications through Resend.

Options:
      --dry-run             Print eligible rows; no email, no DB writes.
  -y, --yes                 Send emails and mark rows as sent.
      --limit N             Max rows to process this run (default 50).
      --preview-to <email>  Render one sample email and send it to <email>
                            with a synthetic exit-event payload. No DB.
  -h, --help                Show this help.

Reads:
  RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL
  AUTH_DB_PATH               (SQLite; defaults to ./data/auth.db)
  TRADEWORKZ_INTERNAL_API    (defaults to http://127.0.0.1:8000)
  ZEROGEX_API_TOKEN          (Bearer token for the internal endpoints)

Exit codes:
  0 = success (including a successful --dry-run with no rows to send)
  1 = misconfiguration or hard failure that aborts the run
`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH.');
    process.exit(1);
  }
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

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

interface AuthUser {
  id: string;
  email: string;
  email_verified_at: string | null;
}

function loadAuthUsers(dbPath: string, userIds: string[]): Map<string, AuthUser> {
  const map = new Map<string, AuthUser>();
  if (userIds.length === 0) return map;
  const inList = userIds.map((id) => `'${escapeSqlLiteral(id)}'`).join(',');
  const rows = querySqlite<AuthUser>(
    dbPath,
    `SELECT id, email, email_verified_at FROM users WHERE id IN (${inList})`,
  );
  for (const r of rows) map.set(r.id, r);
  return map;
}

async function fetchQueued(
  apiBase: string,
  token: string,
  limit: number,
): Promise<QueuedResponse> {
  const url = `${apiBase.replace(/\/+$/, '')}/api/tradeworkz/internal/queued-notifications?channel=email&limit=${limit}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`queued-notifications ${res.status}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as QueuedResponse;
}

async function markNotification(
  apiBase: string,
  token: string,
  id: number,
  status: 'sent' | 'failed',
  error?: string,
): Promise<void> {
  const url = `${apiBase.replace(/\/+$/, '')}/api/tradeworkz/internal/mark-notification`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ id, status, error }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`mark-notification ${res.status}: ${body.slice(0, 400)}`);
  }
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
  process.exit(0);
}

const exclusiveFlags = [cliArgs.dryRun, cliArgs.yes, !!cliArgs.previewTo].filter(Boolean).length;
if (exclusiveFlags > 1) {
  console.error('Error: --dry-run, --yes, and --preview-to are mutually exclusive.');
  process.exit(1);
}
if (exclusiveFlags === 0) {
  // Default posture when scheduled by systemd — no interactive flag,
  // send for real.
  cliArgs.yes = true;
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));

const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL;
const NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || '';
const TRADEWORKZ_INTERNAL_API =
  process.env.TRADEWORKZ_INTERNAL_API ||
  envLocal.TRADEWORKZ_INTERNAL_API ||
  'http://127.0.0.1:8000';
// Accept either ZEROGEX_API_TOKEN (the current name) or the legacy
// ZEROGEX_API_KEY. The BFF proxy (core/api/proxy.ts) reads both with
// the same precedence, so honoring both here keeps the worker in step
// with the existing deploy.
const ZEROGEX_API_TOKEN =
  process.env.ZEROGEX_API_TOKEN ||
  envLocal.ZEROGEX_API_TOKEN ||
  process.env.ZEROGEX_API_KEY ||
  envLocal.ZEROGEX_API_KEY ||
  '';

if ((cliArgs.yes || cliArgs.previewTo) && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send emails.');
  process.exit(1);
}
// Dry-run also needs the token — it queries the queued-notifications
// endpoint to show what would be sent. Without the token the request
// would fail with 401 further down; fail earlier and clearer.
if ((cliArgs.yes || cliArgs.dryRun) && !ZEROGEX_API_TOKEN) {
  console.error(
    'Error: ZEROGEX_API_TOKEN (or legacy ZEROGEX_API_KEY) must be set to reach the TradeWorkz internal endpoints.',
  );
  process.exit(1);
}

if (RESEND_API_KEY) process.env.RESEND_API_KEY = RESEND_API_KEY;
if (RESEND_FROM_EMAIL) process.env.RESEND_FROM_EMAIL = RESEND_FROM_EMAIL;
if (NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = NEXT_PUBLIC_APP_URL;

if (cliArgs.previewTo) {
  console.log(`Sending preview to ${cliArgs.previewTo}...`);
  await sendTradeworkzNotification(cliArgs.previewTo, {
    botId: 'put_call_wall_bouncer',
    botDisplayName: 'Put/Call Wall Bouncer',
    eventType: 'exit',
    payload: {
      underlying: 'SPY',
      direction: 'bullish',
      strategy_type: 'BUY_CALL_DEBIT',
      contracts: 4,
      entry_price: 3.15,
      exit_price: 4.02,
      realized_pnl: 348,
      pnl_percent: 0.276,
      outcome: 'win',
      reason: 'target',
      conviction: 0.72,
      rationale: 'put-wall rejection at 578 in positive-γ regime',
    },
  });
  console.log('Preview sent.');
  process.exit(0);
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  process.exit(1);
}
ensureSqlite3Cli();

const queued = await fetchQueued(TRADEWORKZ_INTERNAL_API, ZEROGEX_API_TOKEN, cliArgs.limit);
if (queued.entries.length === 0) {
  console.log('Nothing to send.');
  process.exit(0);
}

const uniqueUsers = Array.from(new Set(queued.entries.map((r) => r.end_user)));
const usersById = loadAuthUsers(dbPath, uniqueUsers);
console.log(
  `Fetched ${queued.entries.length} queued row(s) across ${uniqueUsers.length} unique user(s); ${usersById.size} resolved to a recipient.`,
);

let sent = 0;
let skipped = 0;
let failed = 0;

for (const row of queued.entries) {
  const user = usersById.get(row.end_user);
  const label = `#${row.id} ${row.bot_id} -> ${row.end_user} (${row.event_type})`;

  if (!user) {
    console.log(`  SKIP ${label}: unknown recipient`);
    if (cliArgs.yes) {
      try {
        await markNotification(TRADEWORKZ_INTERNAL_API, ZEROGEX_API_TOKEN, row.id, 'failed', 'unknown recipient');
      } catch (err) {
        console.error(`     mark-failed error: ${(err as Error).message}`);
      }
    }
    skipped++;
    continue;
  }
  if (!user.email_verified_at) {
    console.log(`  SKIP ${label}: unverified recipient ${user.email}`);
    if (cliArgs.yes) {
      try {
        await markNotification(TRADEWORKZ_INTERNAL_API, ZEROGEX_API_TOKEN, row.id, 'failed', 'unverified recipient');
      } catch (err) {
        console.error(`     mark-failed error: ${(err as Error).message}`);
      }
    }
    skipped++;
    continue;
  }

  if (cliArgs.dryRun) {
    console.log(`  DRY ${label}: would send to ${user.email}`);
    continue;
  }

  try {
    await sendTradeworkzNotification(user.email, {
      botId: row.bot_id,
      botDisplayName: row.bot_display_name ?? row.bot_id,
      eventType: row.event_type,
      payload: row.payload,
    });
    await markNotification(TRADEWORKZ_INTERNAL_API, ZEROGEX_API_TOKEN, row.id, 'sent');
    console.log(`  SENT ${label} -> ${user.email}`);
    sent++;
  } catch (err) {
    const message = (err as Error).message;
    console.error(`  FAIL ${label} -> ${user.email}: ${message}`);
    try {
      await markNotification(TRADEWORKZ_INTERNAL_API, ZEROGEX_API_TOKEN, row.id, 'failed', message.slice(0, 400));
    } catch (markErr) {
      console.error(`     mark-failed error: ${(markErr as Error).message}`);
    }
    failed++;
  }
}

console.log(
  `Done. sent=${sent} skipped=${skipped} failed=${failed} total=${queued.entries.length}`,
);
