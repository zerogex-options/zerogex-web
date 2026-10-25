#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/wall-alerts-webhooks.mts \
//     [--dry-run | --yes] [--limit N] [--preview-to <webhook url>] [--verbose]
//
// Drains queued wall-alert WEBHOOK rows into members' own Discord and Slack
// channels. The email worker's twin (scripts/wall-alerts-deliver.mts), on its
// own timer so a Discord outage can never hold up email:
//   1. GET  /api/alerts/walls/internal/queued?channel=webhook — the backend
//      expires rows older than 20 minutes and cancels rows whose alert was
//      deleted, disabled or had Discord / Slack switched off.
//   2. Resolve each member (plan, deletion) and their saved webhook in the auth
//      SQLite DB, and decide every row's fate: core/wallAlertWebhook.ts
//      planWebhookDeliveries.
//   3. One post per member per pass, up to 10 alerts, worded as the email is.
//   4. POST /api/alerts/walls/internal/mark — sent, 'retry' for a 429, a 5xx or
//      no answer (the backend fails a row after three tries), 'failed' for a
//      refusal. A 401 / 403 / 404 / 410 means the webhook was deleted or
//      revoked: the worker records that on the member's webhook (the one write
//      it makes to the auth DB), the alerts page asks for a new one, and their
//      rows are cancelled instead of posted to a dead address until then.
//
// Idempotency, failure reports and the state file (wall-alerts-webhooks.
// state.json, beside the auth DB) work exactly as the email worker's: see its
// header and core/wallAlertsDelivery.ts. A member's own webhook failing is
// their problem, shown to them on the alerts page, never the operator's; the
// operator hears (at most hourly) only about a missing setting, an unreadable
// auth DB, an outbox down for 5 minutes, an unexpected error, or posts to two
// or more members refused with none landing (which means our message, not
// their webhooks, is wrong).
//
// A pass stops starting posts after PASS_BUDGET_MS, well inside the unit's
// 120-second limit, and stops posting to a provider that rate-limits it or
// fails twice; whatever it did not reach stays queued for the next pass.

import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { loadEnvLocal } from './env-local.mts';
import {
  WebhookSendError,
  buildWebhookMessage,
  parseWebhookUrl,
  planWebhookDeliveries,
  postWebhook,
  type WebhookDestination,
  type WebhookMember,
  type WebhookProvider,
} from '../core/wallAlertWebhook.ts';
import {
  clearFailure,
  forgetSent,
  noteFailure,
  outageLengthMs,
  parseWorkerState,
  pruneSentLedger,
  recordSent,
  splitAlreadySent,
  type WorkerFailure,
  type WorkerState,
} from '../core/wallAlertsDelivery.ts';
import { describeBatch } from '../core/wallAlertEmail.ts';
import {
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
Usage: wall-alerts-webhooks.mts [options]

Posts queued wall alerts to members' Discord and Slack webhooks.

Options:
      --dry-run                 Show what each queued row would get; no posts, no marks.
  -y, --yes                     Post and mark (the default when no mode flag is given).
      --limit N                 Max rows per pass (default 200).
      --preview-to <webhook>    Post one sample message (two synthetic alerts) to a
                                Discord or Slack webhook. No DB.
      --verbose                 Also report an empty queue.
  -h, --help                    Show this help.

Reads (frontend/.env.local or the environment):
  NEXT_PUBLIC_APP_URL
  ZEROGEX_API_TOKEN (or ZEROGEX_API_KEY), ZEROGEX_ADMIN_TOKEN, ZEROGEX_API_BASE_URL
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

const dbPath = process.env.AUTH_DB_PATH || path.join(process.cwd(), 'data', 'auth.db');
const statePath = path.join(path.dirname(dbPath), 'wall-alerts-webhooks.state.json');

function loadState(): WorkerState {
  try {
    return parseWorkerState(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return parseWorkerState(null);
  }
}

let state = pruneSentLedger(loadState(), new Date());
let savedJson = JSON.stringify(state);

// Same contract as the email worker: only the timer's pass keeps state, a
// write happens only on a change, and it never throws (a send is recorded from
// inside the send loop, where an exception would read as a failed post).
function saveState(next: WorkerState): void {
  if (!args.yes) return;
  const json = JSON.stringify(next);
  if (json === savedJson) return;
  try {
    const tmp = `${statePath}.tmp`;
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, statePath);
    savedJson = json;
  } catch (err) {
    console.error(`  state not saved (${statePath}): ${(err as Error).message}`);
  }
}

function fail(kind: WorkerFailure, message: string): never {
  console.error(message);
  if (!args.yes) process.exit(1);
  const outcome = noteFailure(state, kind, new Date());
  state = outcome.state;
  saveState(state);
  if (!outcome.report) process.exit(0);
  console.error(
    kind === 'outbox'
      ? `Reported: the wall-alert outbox has not answered since ${state.outageSince ?? 'just now'}, so no Discord / Slack alerts can go out. Reported again hourly while it stays down.`
      : 'Reported now; reported again hourly while it continues.',
  );
  process.exit(1);
}

if (args.previewTo) {
  const parsed = parseWebhookUrl(args.previewTo);
  if (!parsed.ok) {
    console.error(`Error: --preview-to must be a Discord or Slack webhook address (${parsed.problem}).`);
    process.exit(1);
  }
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
  console.log(`Posting a preview to the ${parsed.provider} webhook...`);
  try {
    await postWebhook(
      parsed.url,
      buildWebhookMessage(
        parsed.provider,
        [
          { payload: sample('hit', 'put', 'SPX', 7700, 7702.5), at: now },
          { payload: sample('break', 'call', 'SPY', 780, 781.2), at: now },
        ],
        appUrl,
      ),
    );
  } catch (err) {
    console.error(`Preview not posted: ${(err as Error).message}`);
    process.exit(1);
  }
  console.log('Preview posted.');
  process.exit(0);
}

const adminEnvOrNull = wallAlertsAdminEnv();
if (!adminEnvOrNull) {
  fail(
    'config',
    'Error: ZEROGEX_API_TOKEN (or ZEROGEX_API_KEY) and ZEROGEX_ADMIN_TOKEN must both be set to reach the wall-alert outbox.',
  );
}
const adminEnv = adminEnvOrNull;
state = clearFailure(state, 'config');

const ids = (rows: QueuedWallAlert[]) => rows.map((r) => r.id);

function loadMembers(userIds: string[]): {
  members: Map<string, WebhookMember>;
  webhooks: Map<string, WebhookDestination>;
} {
  const members = new Map<string, WebhookMember>();
  const webhooks = new Map<string, WebhookDestination>();
  if (userIds.length === 0) return { members, webhooks };
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec('PRAGMA busy_timeout = 5000;');
    const placeholders = userIds.map(() => '?').join(',');
    const users = db
      .prepare(`SELECT id, tier, deleted_at FROM users WHERE id IN (${placeholders})`)
      .all(...userIds) as unknown as WebhookMember[];
    for (const u of users) members.set(u.id, u);
    try {
      const hooks = db
        .prepare(
          `SELECT user_id, url, provider, failed_at, last_error FROM wall_alert_webhooks WHERE user_id IN (${placeholders})`,
        )
        .all(...userIds) as unknown as Array<WebhookDestination & { provider: WebhookProvider }>;
      for (const h of hooks) webhooks.set(h.user_id, h);
    } catch (err) {
      // The website creates the table when it next starts; until then no one
      // can have saved a webhook.
      if (!/no such table/i.test((err as Error).message)) throw err;
    }
  } finally {
    db.close();
  }
  return { members, webhooks };
}

/**
 * The one thing this worker writes to the auth DB: how the member's webhook is
 * doing, for their alerts page. 'gone' (the provider says it no longer exists)
 * stops posts to it; 'refused' (it would not take the message) is shown but
 * posting goes on; 'ok' clears an earlier refusal. Only while the saved
 * address is still the one posted to, so a webhook replaced mid-pass is never
 * marked. Best-effort: the outbox rows are marked either way.
 */
function recordWebhookOutcome(webhook: WebhookDestination, outcome: 'gone' | 'refused' | 'ok', message = ''): void {
  if (outcome === 'ok' && !webhook.last_error) return; // nothing to clear: no write
  try {
    const db = new DatabaseSync(dbPath);
    try {
      db.exec('PRAGMA busy_timeout = 5000;');
      const now = new Date().toISOString();
      const where = 'WHERE user_id = ? AND url = ?';
      if (outcome === 'gone') {
        db.prepare(`UPDATE wall_alert_webhooks SET failed_at = ?, last_error = ?, updated_at = ? ${where}`).run(
          now,
          message.slice(0, 500),
          now,
          webhook.user_id,
          webhook.url,
        );
      } else if (outcome === 'refused') {
        db.prepare(`UPDATE wall_alert_webhooks SET last_error = ?, updated_at = ? ${where}`).run(
          message.slice(0, 500),
          now,
          webhook.user_id,
          webhook.url,
        );
      } else {
        db.prepare(`UPDATE wall_alert_webhooks SET last_error = NULL, updated_at = ? ${where} AND failed_at IS NULL`).run(
          now,
          webhook.user_id,
          webhook.url,
        );
      }
    } finally {
      db.close();
    }
  } catch (err) {
    console.error(`     could not record the webhook's state for ${webhook.user_id}: ${(err as Error).message}`);
  }
}

// Discord allows a webhook 5 posts per 2 seconds; one post per member per pass
// stays far inside that, and a gap between members keeps the server's own
// address well clear of Discord's global limit.
const GAP_MS = 250;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// No new post starts after this long into a pass. A post can take the full
// WEBHOOK_TIMEOUT_MS, so this keeps a pass inside TimeoutStartSec=120 even when
// a provider is hanging; a pass systemd kills would page and could repost.
const PASS_BUDGET_MS = 75_000;
// Temporary failures from one provider before the pass stops posting to it.
const PROVIDER_TROUBLE_LIMIT = 2;

async function runPass(): Promise<void> {
  const passStart = Date.now();
  let queued: Awaited<ReturnType<typeof fetchQueuedWallAlerts>>;
  try {
    queued = await fetchQueuedWallAlerts(adminEnv, 'webhook', args.limit);
  } catch (err) {
    fail('outbox', `Outbox check failed: ${(err as Error).message}`);
  }
  const downMs = outageLengthMs(state, new Date());
  if (downMs !== null) console.log(`Outbox answering again after ${Math.round(downMs / 1000)}s.`);
  state = clearFailure(state, 'outbox');

  if (queued.expired || queued.cancelled) {
    console.log(
      `Outbox housekeeping: ${queued.expired} expired unsent (older than the send window), ${queued.cancelled} cancelled (alert turned off or deleted).`,
    );
  }

  const { alreadySent, fresh } = splitAlreadySent(queued.entries, state);
  if (alreadySent.length > 0) {
    if (args.dryRun) {
      console.log(`  DRY re-mark ${alreadySent.length} row(s) already posted`);
    } else {
      try {
        await markWallAlerts(adminEnv, ids(alreadySent), 'sent');
        state = forgetSent(state, ids(alreadySent));
        console.log(`  MARKED ${alreadySent.length} row(s) posted on an earlier pass`);
      } catch (err) {
        console.error(`  mark-sent for ${alreadySent.length} row(s) already posted failed again: ${(err as Error).message}`);
      }
    }
  }

  if (fresh.length === 0) {
    if (args.verbose && alreadySent.length === 0) console.log('Nothing to post.');
    return;
  }

  if (!fs.existsSync(dbPath)) fail('auth-db', `Auth DB not found at: ${dbPath}`);
  const userIds = Array.from(new Set(fresh.map((r) => r.end_user)));
  let loaded: ReturnType<typeof loadMembers>;
  try {
    loaded = loadMembers(userIds);
  } catch (err) {
    fail('auth-db', `Auth DB unreadable (${dbPath}): ${(err as Error).message}`);
  }
  state = clearFailure(state, 'auth-db');

  const plan = planWebhookDeliveries(fresh, loaded.members, loaded.webhooks);
  const sends = plan.filter((d) => d.action === 'send');
  console.log(
    `Fetched ${fresh.length} queued wall alert(s) for ${userIds.length} member(s); ${sends.length} post(s) to make.`,
  );

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

  let sent = 0;
  let failed = 0;
  let retrying = 0;
  let held = 0;
  let posted = 0;
  let landed = 0;
  const gone = new Set<string>();
  const refusedMembers = new Set<string>();
  const trouble = new Map<string, number>();
  const skipProviders = new Set<string>();
  for (const d of sends) {
    if (d.action !== 'send') continue;
    const items = d.rows.map((r) => ({ payload: r.payload, at: r.created_at }));
    const provider = d.webhook.provider;
    const label = `${d.member.id} (${provider})`;
    if (args.dryRun) {
      console.log(`  DRY post to ${label}: ${describeBatch(items)}`);
      continue;
    }
    if (gone.has(d.member.id)) {
      // An earlier batch this pass found the webhook gone.
      await markWallAlerts(adminEnv, ids(d.rows), 'cancelled', 'webhook stopped working').catch(() => {});
      cancelled += d.rows.length;
      continue;
    }
    if (skipProviders.has(provider) || Date.now() - passStart > PASS_BUDGET_MS) {
      // Left queued, unmarked: the next pass takes them while they are news.
      held += d.rows.length;
      continue;
    }
    let message: Record<string, unknown>;
    try {
      message = buildWebhookMessage(provider, items, appUrl);
    } catch (err) {
      // Our own bug, not the member's webhook and not worth retrying.
      const text = `could not build the message: ${(err as Error)?.message ?? String(err)}`;
      await markWallAlerts(adminEnv, ids(d.rows), 'failed', text).catch(() => {});
      failed += d.rows.length;
      refusedMembers.add(d.member.id);
      console.error(`  FAILED ${label}: ${text}`);
      continue;
    }
    if (posted > 0) await sleep(GAP_MS);
    posted++;
    try {
      await postWebhook(d.webhook.url, message);
    } catch (err) {
      const e =
        err instanceof WebhookSendError
          ? err
          : new WebhookSendError((err as Error)?.message ?? String(err), { status: null, retryable: true, broken: false });
      const status = e.retryable ? 'retry' : 'failed';
      try {
        await markWallAlerts(adminEnv, ids(d.rows), status, e.message);
      } catch (markErr) {
        console.error(`     mark-${status} error: ${(markErr as Error).message}`);
      }
      if (status === 'retry') retrying += d.rows.length;
      else failed += d.rows.length;
      console.error(`  ${e.broken ? 'BROKEN' : status.toUpperCase()} ${label}: ${e.message}`);
      if (e.broken) {
        gone.add(d.member.id);
        recordWebhookOutcome(d.webhook, 'gone', e.message);
      } else if (e.retryable) {
        // The provider (or what is in front of it) is struggling: a 429 says
        // so outright; anything else gets one more chance this pass.
        const count = (trouble.get(provider) ?? 0) + 1;
        trouble.set(provider, count);
        if (e.status === 429 || count >= PROVIDER_TROUBLE_LIMIT) {
          skipProviders.add(provider);
          console.error(`  pausing ${provider} for the rest of this pass`);
        }
      } else {
        refusedMembers.add(d.member.id);
        recordWebhookOutcome(d.webhook, 'refused', e.message);
      }
      continue;
    }
    landed++;
    // Recorded before the mark: if the mark does not land, the next pass
    // marks these rows instead of posting them again.
    state = recordSent(state, ids(d.rows), new Date());
    saveState(state);
    recordWebhookOutcome(d.webhook, 'ok');
    try {
      await markWallAlerts(adminEnv, ids(d.rows), 'sent');
      state = forgetSent(state, ids(d.rows));
      sent += d.rows.length;
      console.log(`  POSTED ${label}: ${describeBatch(items)}`);
    } catch (err) {
      console.error(
        `  POSTED ${label} but mark-sent failed (recorded; the next pass marks without reposting): ${(err as Error).message}`,
      );
    }
  }
  if (args.dryRun) return;

  console.log(
    `Done. sent=${sent} cancelled=${cancelled} retrying=${retrying} failed=${failed} held=${held} total=${fresh.length}`,
  );
  // One member's channel refusing our message is theirs to fix and shown to
  // them. Several refusing, with nothing landing, means the message itself is
  // what the providers will not take: ours to fix, reported at most hourly
  // until a post lands again.
  if (landed > 0) state = clearFailure(state, 'provider');
  if (landed === 0 && refusedMembers.size >= 2) {
    fail(
      'provider',
      `Posts to ${refusedMembers.size} members were refused and none landed: the message format is likely wrong.`,
    );
  }
}

try {
  await runPass();
} catch (err) {
  fail('crash', `Unexpected error: ${(err as Error)?.stack ?? String(err)}`);
}
state = clearFailure(state, 'crash');
saveState(state);
