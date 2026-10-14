#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/wall-alerts-deliver.mts \
//     [--dry-run | --yes] [--limit N] [--preview-to <email>] [--verbose]
//
// Drains queued wall-alert EMAIL rows (Call/Put Wall hit / broke / held):
//   1. GET  /api/alerts/walls/internal/queued?channel=email — the backend first
//      expires rows older than 20 minutes (a wall alert is only worth sending
//      while it is news) and cancels rows whose alert was deleted, disabled or
//      had email switched off.
//   2. Resolve each member in the auth SQLite DB (email, verified, tier,
//      deleted) and decide every row's fate: core/wallAlertsDelivery.ts.
//   3. One email per member per pass, carrying all their alerts, through
//      core/mailer.ts sendWallAlertEmail (one-click unsubscribe included).
//   4. POST /api/alerts/walls/internal/mark — sent / cancelled / failed, or
//      'retry' for a transient Resend failure (429, 5xx, no response): the row
//      stays queued for the next pass and turns 'failed' after three tries.
//
// Scheduled by zerogex-web-wall-alerts-notify.timer every 20 seconds. Silent
// when there is nothing to send (pass --verbose to say so), so the journal is
// not three "nothing to do" lines a minute.
//
// Idempotency: a row moves out of 'queued' only through mark, and mark only
// moves 'queued' rows, so a rerun never resends a sent row and a late mark can
// never resurrect a row a member's unsubscribe cancelled. A crash between
// "Resend accepted" and "mark returned" leaves the row queued and the next pass
// resends it — one duplicate email is the cheaper failure than a dropped alert.
//
// The outbox carries other members' alerts, so the backend requires the admin
// token (ZEROGEX_ADMIN_TOKEN) on top of ZEROGEX_API_TOKEN.

import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { loadEnvLocal } from './env-local.mts';
import { sendWallAlertEmail } from '../core/mailer.ts';
import { deliverAll, isRetryable } from '../core/resendRetry.ts';
import { describeBatch } from '../core/wallAlertEmail.ts';
import { planWallAlertDeliveries, type DeliveryUser } from '../core/wallAlertsDelivery.ts';
import {
  buildWallAlertsUnsubUrl,
  fetchQueuedWallAlerts,
  markWallAlerts,
  purgeWallAlertsForUser,
  wallAlertsAdminEnv,
  type QueuedWallAlert,
} from '../core/wallAlertsServer.ts';
import type { WallAlertPayload } from '../core/wallAlerts.ts';

type Args = { dryRun: boolean; yes: boolean; help: boolean; verbose: boolean; limit: number; previewTo: string | null };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, yes: false, help: false, verbose: false, limit: 200, previewTo: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '-y' || a === '--yes') args.yes = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--limit') {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) args.limit = Math.min(1000, Math.floor(n));
    } else if (a === '--preview-to') {
      args.previewTo = argv[++i] ?? null;
    }
  }
  return args;
}

function usage() {
  console.log(`
Usage: wall-alerts-deliver.mts [options]

Drains queued wall-alert emails through Resend.

Options:
      --dry-run             Show what each queued row would get; no email, no marks.
  -y, --yes                 Send and mark (the default when no mode flag is given).
      --limit N             Max rows per pass (default 200).
      --preview-to <email>  Send one sample email (two synthetic alerts) to <email>. No DB.
      --verbose             Also report an empty queue.
  -h, --help                Show this help.

Reads (frontend/.env.local or the environment):
  RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL
  ZEROGEX_API_TOKEN (or ZEROGEX_API_KEY), ZEROGEX_ADMIN_TOKEN, ZEROGEX_API_BASE_URL
  ZEROGEX_END_USER_TOKEN_SECRET (signs the unsubscribe link)
  AUTH_DB_PATH (default ./data/auth.db)
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}
const modes = [args.dryRun, args.yes, !!args.previewTo].filter(Boolean).length;
if (modes > 1) {
  console.error('Error: --dry-run, --yes and --preview-to are mutually exclusive.');
  process.exit(1);
}
if (modes === 0) args.yes = true;

loadEnvLocal();
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

if ((args.yes || args.previewTo) && (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send.');
  process.exit(1);
}
if ((args.yes || args.previewTo) && !process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
  console.error('Error: ZEROGEX_END_USER_TOKEN_SECRET must be set to sign the unsubscribe link.');
  process.exit(1);
}

if (args.previewTo) {
  const sample = (kind: 'hit' | 'break', side: 'call' | 'put', symbol: string, wall: number, price: number): WallAlertPayload => ({
    v: 1,
    symbol,
    side,
    kind,
    wall,
    price,
    last_price: price,
    distance: side === 'call' ? wall - price : price - wall,
    profile: 'balanced',
    break_buffer: wall * 0.001,
    confirm_minutes: 5,
    strength_pctile: 88,
    strength_tier: 'strong',
    regime: 'positive',
    approach_number: 1,
    odds: [{ horizon_minutes: 60, break_prob: 0.34 }],
  });
  const now = new Date().toISOString();
  console.log(`Sending preview to ${args.previewTo}...`);
  await sendWallAlertEmail(args.previewTo, {
    alerts: [
      { payload: sample('hit', 'put', 'SPX', 7700, 7702.5), at: now },
      { payload: sample('hit', 'put', 'SPY', 770, 770.31), at: now },
    ],
    unsubUrl: buildWallAlertsUnsubUrl(appUrl, 'preview'),
    appUrl,
  });
  console.log('Preview sent.');
  process.exit(0);
}

const adminEnv = wallAlertsAdminEnv();
if (!adminEnv) {
  console.error(
    'Error: ZEROGEX_API_TOKEN (or ZEROGEX_API_KEY) and ZEROGEX_ADMIN_TOKEN must both be set to reach the wall-alert outbox.',
  );
  process.exit(1);
}

const queued = await fetchQueuedWallAlerts(adminEnv, 'email', args.limit);
if (queued.expired || queued.cancelled) {
  console.log(
    `Outbox housekeeping: ${queued.expired} expired unsent (older than the send window), ${queued.cancelled} cancelled (alert turned off or deleted).`,
  );
}
if (queued.entries.length === 0) {
  if (args.verbose) console.log('Nothing to send.');
  process.exit(0);
}

const dbPath = process.env.AUTH_DB_PATH || path.join(process.cwd(), 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}`);
  process.exit(1);
}

function loadUsers(ids: string[]): Map<string, DeliveryUser> {
  const map = new Map<string, DeliveryUser>();
  if (ids.length === 0) return map;
  // Read-only: this worker never writes the auth DB.
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec('PRAGMA busy_timeout = 5000;');
    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT id, email, email_verified_at, tier, deleted_at FROM users WHERE id IN (${placeholders})`,
      )
      .all(...ids) as unknown as DeliveryUser[];
    for (const r of rows) map.set(r.id, r);
  } finally {
    db.close();
  }
  return map;
}

const userIds = Array.from(new Set(queued.entries.map((r) => r.end_user)));
const users = loadUsers(userIds);
const plan = planWallAlertDeliveries(queued.entries, users);
const sends = plan.filter((d) => d.action === 'send');
console.log(
  `Fetched ${queued.entries.length} queued wall alert(s) for ${userIds.length} member(s); ${sends.length} email(s) to send.`,
);

const ids = (rows: QueuedWallAlert[]) => rows.map((r) => r.id);
let cancelled = 0;
for (const d of plan) {
  if (d.action !== 'cancel') continue;
  const label = `${d.rows.length} row(s) for ${d.rows[0]?.end_user}`;
  if (args.dryRun) {
    console.log(`  DRY cancel ${label}: ${d.reason}`);
    continue;
  }
  try {
    await markWallAlerts(adminEnv, ids(d.rows), 'cancelled', d.reason);
    cancelled += d.rows.length;
    console.log(`  CANCEL ${label}: ${d.reason}`);
    if (d.purgeUser) {
      const purged = await purgeWallAlertsForUser(adminEnv, d.purgeUser);
      console.log(`     purged deleted account's alerts (${purged.rules_deleted} rule(s))`);
    }
  } catch (err) {
    console.error(`     mark-cancelled error: ${(err as Error).message}`);
  }
}

type SendItem = Extract<(typeof plan)[number], { action: 'send' }>;

if (args.dryRun) {
  for (const d of sends as SendItem[]) {
    const items = d.rows.map((r) => ({ payload: r.payload, at: r.created_at }));
    console.log(`  DRY send to ${d.user.email}: ${describeBatch(items)}`);
  }
  process.exit(0);
}

const result = await deliverAll(
  sends as SendItem[],
  async (d) => {
    await sendWallAlertEmail(d.user.email, {
      alerts: d.rows.map((r) => ({ payload: r.payload, at: r.created_at })),
      unsubUrl: buildWallAlertsUnsubUrl(appUrl, d.user.id),
      appUrl,
    });
  },
  {
    // Resend's limit (10/s) is shared with every other sender on the team.
    throttleMs: 150,
    label: (d) => d.user.email,
    log: (line) => console.log(line),
    // No retry rounds inside a pass: the timer fires again in 20 seconds and
    // the backend counts attempts, so a transient failure is retried there.
    retryDelaysMs: [],
  },
);

let sent = 0;
let failed = 0;
let retrying = 0;
for (const d of result.sent) {
  try {
    await markWallAlerts(adminEnv, ids(d.rows), 'sent');
    sent += d.rows.length;
    console.log(`  SENT ${d.user.email}: ${describeBatch(d.rows.map((r) => ({ payload: r.payload, at: r.created_at })))}`);
  } catch (err) {
    console.error(`  SENT ${d.user.email} but mark-sent failed (rows stay queued): ${(err as Error).message}`);
  }
}
for (const { item: d, error } of result.failed) {
  const message = (error as Error)?.message ?? String(error);
  const status = isRetryable(error) ? 'retry' : 'failed';
  try {
    await markWallAlerts(adminEnv, ids(d.rows), status, message);
  } catch (err) {
    console.error(`     mark-${status} error: ${(err as Error).message}`);
  }
  if (status === 'retry') retrying += d.rows.length;
  else failed += d.rows.length;
  console.error(`  ${status.toUpperCase()} ${d.user.email}: ${message}`);
}

console.log(
  `Done. sent=${sent} cancelled=${cancelled} retrying=${retrying} failed=${failed} total=${queued.entries.length}`,
);
// Non-zero only when nothing could be delivered AND nothing will succeed by
// waiting (a revoked Resend key, a bad from-address): that is the
// misconfiguration OnFailure= should page about. A transient outage retries on
// the next pass by itself; paging every 20 seconds through it would be noise.
if (
  sends.length > 0 &&
  result.sent.length === 0 &&
  result.failed.length > 0 &&
  result.failed.every(({ error }) => !isRetryable(error))
) {
  process.exit(1);
}
