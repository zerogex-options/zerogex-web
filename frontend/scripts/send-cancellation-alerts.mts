#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/send-cancellation-alerts.mts \
//     [--to <email>] [--since <iso|YYYY-MM-DD>] [--lookback <hours>] [--limit <n>]
//     [--kind pending|lapsed|both] [--dry-run] [--mark-only] [--preview <email>]
//
// CANCELLATION ALERTS. Emails the operator one message per cancellation, carrying
// the reason the member typed on their way out.
//
// WHY THIS EXISTS: the cancellation survey has been captured into audit_events
// since core/cancellationReason.ts landed — `cancel_feedback=...` and
// `cancel_comment="..."` are folded onto the churn row by the Stripe webhook. But
// nothing ever pushed it anywhere. The only way to see a reason was to go looking
// (`make cancellations`, `make churn-breakdown`, `make diagnose-user`), which
// means in practice you saw it weeks later, if at all — and by then the member
// who wrote "I want data for FUTURES, ES, MES, NASDAQ" the week futures shipped
// had already lost access. The signal was there the whole time; nobody was
// standing at the mailbox. This is the mailbox.
//
// WHY A SWEEPER AND NOT A SEND FROM THE WEBHOOK: an alert that can be silently
// dropped is the same failure mode we are fixing. Emails sent inline from
// app/api/webhooks/stripe/route.ts are best-effort — if Resend is down or the
// process dies mid-handler, that alert is gone, because Stripe considers the
// event delivered and never redelivers. Sweeping the audit log instead means the
// durable record is the source of truth: a failed send simply isn't latched, so
// the next tick retries it. It also keeps the money path (the webhook) free of a
// new outbound-HTTP failure surface, and makes the whole history backfillable —
// `--since` can go pick up cancellations that happened before this script existed.
//
// IDEMPOTENCY: after a successful send we write a `cancellation_alert_sent` audit
// row whose message carries `alert_for=<churn audit id>`. The presence of that
// row is the latch — see core/cancellationAlert.ts for the format ⇄ parse
// contract. Keying on the churn event's own audit id (not the user, not the
// subscription) means a member who cancels, comes back, and cancels again gets an
// alert each time, while a re-run or an overlapping timer fire cannot double-send.
//
// Env (read from process.env, falling back to frontend/.env.local):
//   RESEND_API_KEY, RESEND_FROM_EMAIL   required to actually send
//   CANCELLATION_ALERT_EMAIL            recipient; falls back to SIGNUP_ALARM_EMAIL,
//                                       then FOH_REMINDER_EMAIL, then --to
//   AUTH_DB_PATH                        auth DB (default ./data/auth.db)
//   NEXT_PUBLIC_APP_URL                 admin dashboard link (default zerogex.io)
//   CANCELLATION_ALERT_LOOKBACK_HOURS   trailing window, default 72
//   CANCELLATION_ALERT_LIMIT            max sends per run, default 25
//   CANCELLATION_ALERT_THROTTLE_MS      gap between sends, default 550
//   CANCELLATION_ALERT_INCLUDE_SILENT_LAPSES=1
//                                       alert on lapses that captured no reason
//                                       too (default: they are skipped)
//   CANCELLATION_ALERT_BUSY_TIMEOUT_MS  SQLite lock wait, default 10000
//
// Flags:
//   --to <email>      Override recipient
//   --since <when>    Backfill: scan from this instant instead of the lookback
//                     window. Accepts an ISO stamp or YYYY-MM-DD (ET-naive, so
//                     '2026-08-01' means from the very start of that UTC day).
//   --lookback <h>    Override CANCELLATION_ALERT_LOOKBACK_HOURS
//   --limit <n>       Override the per-run cap (0 = unlimited). The cap exists so
//                     a first run or a wide --since cannot blast the whole churn
//                     history into your inbox in one go. Ignored by --mark-only,
//                     which sends nothing and so always takes the whole backlog.
//   --throttle-ms <n> Gap between sends. Resend rejects above 10 requests/second
//                     with a 429, and a capped run of 25 goes out far faster than
//                     that unthrottled. Default 550 (~1.8/s), matching
//                     send-product-update.mts.
//   --kind <k>        pending | lapsed | both (default both)
//   --include-silent-lapses
//                     Also alert on lapsed subscriptions whose cancellation
//                     survey captured nothing. Off by default: access is already
//                     gone and no reason was given, so there is nothing to act on
//                     — almost always a trial that simply ended. Pending cancels
//                     are NEVER filtered, reason or not; they still have a live
//                     save window. See shouldAlertOnChurn in core/cancellationAlert.ts.
//   --dry-run         Print what would be sent; send nothing, latch nothing
//   --mark-only       Latch WITHOUT sending. The "I have already dealt with this
//                     backlog by hand, don't email me about history" escape hatch:
//                     run it once with a wide --since, then let the timer take
//                     over from a clean slate.
//   --preview <email> Send ONE sample alert built from synthetic data to that
//                     address and exit. Touches no DB rows and latches nothing —
//                     the `PREVIEW_TO=` convention the other send scripts use, so
//                     you can eyeball the layout without waiting for a real churn.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  CHURN_EVENT_TYPES,
  CHURN_EVENT_TYPE_VALUES,
  ALERT_SENT_EVENT_TYPE,
  classifyChurnEvent,
  buildAlertLatchMessage,
  parseAlertLatchEventId,
  buildChurnAlert,
  selectBatch,
  shouldAlertOnChurn,
  alertRunExitCode,
  type ChurnEventKind,
} from '../core/cancellationAlert.ts';
import { sendCancellationAlertEmail } from '../core/mailer.ts';

// ── Env loading (matches other frontend/scripts/*.mts) ────────────────────────
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

const envFromFile = parseEnvFile(path.join(process.cwd(), '.env.local'));
for (const [k, v] of Object.entries(envFromFile)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

// Resend rejects anything above 10 requests/second with a 429. A capped run of
// 25 alerts issued back-to-back clears that easily, so the sends are spaced.
// Matches the value send-product-update.mts settled on.
const DEFAULT_THROTTLE_MS = 550;

// Env override, resolved once. Invalid or negative values fall back to the
// default rather than silently disabling the spacing.
function envThrottleMs(): number {
  const raw = Number(process.env.CANCELLATION_ALERT_THROTTLE_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_THROTTLE_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Args ──────────────────────────────────────────────────────────────────────
type Args = {
  to: string | null;
  since: string | null;
  lookback: number | null;
  limit: number | null;
  kind: 'pending' | 'lapsed' | 'both';
  dryRun: boolean;
  markOnly: boolean;
  preview: string | null;
  throttleMs: number;
  includeSilentLapses: boolean;
};

function usage(): never {
  console.log(`Usage: node --experimental-strip-types scripts/send-cancellation-alerts.mts [options]

  --to <email>     Override recipient (else CANCELLATION_ALERT_EMAIL / SIGNUP_ALARM_EMAIL / FOH_REMINDER_EMAIL)
  --since <when>   Backfill from an ISO stamp or YYYY-MM-DD instead of the lookback window
  --lookback <h>   Trailing window in hours (default 72)
  --limit <n>      Max alerts per run (default 25; 0 = unlimited)
  --kind <k>       pending | lapsed | both (default both)
  --include-silent-lapses
                   Also alert on lapses with no reason captured (default: skipped)
  --dry-run        Print the alerts; send nothing, latch nothing
  --mark-only      Latch without sending (silence a historical backlog)
  --preview <addr> Send one synthetic sample alert to <addr> and exit
  --throttle-ms N  Gap between sends (default ${DEFAULT_THROTTLE_MS}; Resend caps at 10/s)
  -h, --help       This message`);
  process.exit(0);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    to: null,
    since: null,
    lookback: null,
    limit: null,
    kind: 'both',
    dryRun: false,
    markOnly: false,
    preview: null,
    throttleMs: envThrottleMs(),
    includeSilentLapses: process.env.CANCELLATION_ALERT_INCLUDE_SILENT_LAPSES === '1',
  };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--to':
        args.to = argv[++i] ?? null;
        break;
      case '--since':
        args.since = argv[++i] ?? null;
        break;
      case '--lookback':
        args.lookback = Number(argv[++i]);
        break;
      case '--limit':
        args.limit = Number(argv[++i]);
        break;
      case '--kind': {
        const k = argv[++i];
        if (k !== 'pending' && k !== 'lapsed' && k !== 'both') {
          console.error(`[cancellation-alerts] --kind must be pending|lapsed|both, got '${k}'`);
          process.exit(2);
        }
        args.kind = k;
        break;
      }
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--mark-only':
        args.markOnly = true;
        break;
      case '--preview':
        args.preview = argv[++i] ?? null;
        break;
      case '--include-silent-lapses':
        args.includeSilentLapses = true;
        break;
      case '--throttle-ms': {
        const v = Number(argv[++i]);
        if (Number.isFinite(v) && v >= 0) args.throttleMs = v;
        break;
      }
      case '-h':
      case '--help':
        usage();
        break;
      default:
        console.error(`[cancellation-alerts] unknown argument: ${argv[i]}`);
        process.exit(2);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

// Resolve the scan floor. --since wins; otherwise a trailing lookback window
// generous enough (3 days by default) that a weekend of timer downtime still
// gets picked up on the next successful run, without re-scanning all history.
function resolveSince(): string {
  if (args.since) {
    const raw = args.since.trim();
    // Bare YYYY-MM-DD means "from the start of that day".
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) {
      console.error(`[cancellation-alerts] --since is not a date I can parse: ${args.since}`);
      process.exit(2);
    }
    return new Date(ms).toISOString();
  }
  const configured = args.lookback ?? Number(process.env.CANCELLATION_ALERT_LOOKBACK_HOURS);
  const windowHours = Number.isFinite(configured) && configured > 0 ? configured : 72;
  return new Date(Date.now() - windowHours * 3_600_000).toISOString();
}

const SINCE = resolveSince();
const NOW_ISO = new Date().toISOString();

const rawLimit = args.limit ?? Number(process.env.CANCELLATION_ALERT_LIMIT);
const LIMIT = Number.isFinite(rawLimit) && rawLimit >= 0 ? rawLimit : 25;

const DB_PATH = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');

// ── DB ────────────────────────────────────────────────────────────────────────
type ChurnRow = {
  id: string;
  type: string;
  user_id: string | null;
  email: string | null;
  message: string;
  created_at: string;
  tier: string | null;
  account_created_at: string | null;
  current_period_end: string | null;
};

async function main(): Promise<void> {
  if (args.preview) {
    await sendPreview(args.preview);
    return;
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[cancellation-alerts] auth DB not found at ${DB_PATH}. Set AUTH_DB_PATH.`);
    process.exit(1);
  }

  // A dry run must not create the -wal/-shm sidecars in a read-only deploy, and
  // has nothing to write regardless.
  const db = new DatabaseSync(DB_PATH, { readOnly: args.dryRun });

  // Without this SQLite fails the moment anything else holds the write lock,
  // and something else usually does: the Next.js app serves from this same
  // database, and the 15-minute timer can fire mid-run. A long --since backfill
  // died exactly this way ("fatal: database is locked") after latching ~160 of
  // 286 rows. Waiting for the lock is the correct behaviour — these writes are
  // tiny and the contention is milliseconds.
  const busyMs = Number(process.env.CANCELLATION_ALERT_BUSY_TIMEOUT_MS);
  db.exec(`PRAGMA busy_timeout = ${Number.isFinite(busyMs) && busyMs >= 0 ? busyMs : 10_000}`);

  const wantedTypes =
    args.kind === 'both'
      ? [...CHURN_EVENT_TYPE_VALUES]
      : [CHURN_EVENT_TYPES[args.kind as ChurnEventKind]];

  // Churn rows in the window, joined to the member's current row for the
  // context that makes an alert actionable (tier, signup date, when access ends).
  // LEFT JOIN because a deleted account still leaves its churn row behind, and a
  // partial alert beats a dropped one.
  const placeholders = wantedTypes.map(() => '?').join(', ');
  const churnRows = db
    .prepare(
      `SELECT a.id, a.type, a.user_id, a.email, a.message, a.created_at,
              u.tier          AS tier,
              u.created_at    AS account_created_at,
              u.current_period_end AS current_period_end
         FROM audit_events a
         LEFT JOIN users u ON u.id = a.user_id
        WHERE a.type IN (${placeholders})
          AND a.created_at >= ?
        ORDER BY a.created_at ASC`,
    )
    .all(...wantedTypes, SINCE) as unknown as ChurnRow[];

  // The already-alerted set, read in one pass and matched with the same parser
  // the latch is written with. Scanning latches from the same floor is complete:
  // a latch is always written at or after the churn row it latches, so nothing
  // relevant can sit below SINCE.
  const latchRows = db
    .prepare(
      `SELECT message FROM audit_events
        WHERE type = ? AND created_at >= ?`,
    )
    .all(ALERT_SENT_EVENT_TYPE, SINCE) as unknown as Array<{ message: string }>;

  const alreadyAlerted = new Set<string>();
  for (const row of latchRows) {
    const id = parseAlertLatchEventId(row.message);
    if (id) alreadyAlerted.add(id);
  }

  const unalerted = churnRows.filter((r) => !alreadyAlerted.has(r.id) && r.email);
  const pending = unalerted.filter((r) => {
    const kind = classifyChurnEvent(r.type);
    return kind ? shouldAlertOnChurn(kind, r.message, args.includeSilentLapses) : false;
  });
  const suppressed = unalerted.length - pending.length;
  // Count latched rows that belong to THIS window, not every latch in the latch
  // scan. A `--since` backfill writes its latches today, so the raw set size
  // includes events far outside the current window and the three numbers stop
  // adding up ("259 events, 25 already alerted, 259 to send").
  const alreadyInWindow = churnRows.length - unalerted.length;

  console.log(`[cancellation-alerts] db=${DB_PATH}`);
  console.log(`[cancellation-alerts] window since ${SINCE} (kind=${args.kind})`);
  console.log(
    `[cancellation-alerts] ${churnRows.length} churn event(s) in window, ${alreadyInWindow} already alerted, ${pending.length} to send`,
  );
  if (suppressed > 0) {
    console.log(
      `[cancellation-alerts] ${suppressed} lapsed with no reason captured — skipped (--include-silent-lapses to see them)`,
    );
  }

  if (pending.length === 0) {
    db.close();
    return;
  }

  // See selectBatch: the cap is an inbox guard, so it is skipped when the run
  // sends nothing.
  const batch = selectBatch(pending, LIMIT, args.markOnly);
  if (batch.length < pending.length) {
    console.log(
      `[cancellation-alerts] capped at ${LIMIT} this run (${pending.length - batch.length} deferred to the next tick; raise with --limit)`,
    );
  }

  const to =
    args.to ??
    process.env.CANCELLATION_ALERT_EMAIL ??
    process.env.SIGNUP_ALARM_EMAIL ??
    process.env.FOH_REMINDER_EMAIL ??
    null;

  if (!to && !args.dryRun && !args.markOnly) {
    console.error(
      '[cancellation-alerts] no recipient. Set CANCELLATION_ALERT_EMAIL (or SIGNUP_ALARM_EMAIL / FOH_REMINDER_EMAIL), or pass --to.',
    );
    process.exit(1);
  }

  await run(db, batch, to);
}

async function run(db: DatabaseSync, batch: ChurnRow[], to: string | null): Promise<void> {
  const insertLatch = args.dryRun
    ? null
    : db.prepare(
        `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );

  // Mark-only runs as ONE transaction. Silencing a backlog is hundreds of tiny
  // inserts, and doing them one at a time takes and releases the write lock
  // hundreds of times — which is how a 286-row backfill died on "database is
  // locked" after latching ~160, leaving the backlog half-silenced and the timer
  // free to mail the rest. One transaction takes the lock once, for
  // milliseconds, and is all-or-nothing: either the backlog is silenced or
  // nothing changed and you can simply run it again.
  if (args.markOnly && insertLatch) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of batch) {
        const kind = classifyChurnEvent(row.type);
        if (!kind) continue;
        latch(insertLatch, row, kind);
        // Per-row output is useful for a handful and pure noise for hundreds.
        if (batch.length <= 25) console.log(`  MARKED ${row.email} (${kind})`);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    console.log(`\n[cancellation-alerts] ${batch.length} marked, 0 sent — nothing was emailed`);
    db.close();
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const row of batch) {
    const kind = classifyChurnEvent(row.type);
    if (!kind) continue; // Unreachable given the SQL filter; belt and braces.

    const alert = buildChurnAlert(
      {
        churnEventId: row.id,
        kind,
        email: row.email as string,
        userId: row.user_id,
        auditMessage: row.message,
        churnedAtIso: row.created_at,
        accountCreatedAtIso: row.account_created_at,
        tier: row.tier,
        // Only a pending cancel has a live period end to report; the lapse path
        // NULLs it in the same transaction that drops the tier, so reading it
        // there would just print an em dash with extra steps.
        currentPeriodEndIso: kind === 'pending' ? row.current_period_end : null,
      },
      NOW_ISO,
    );

    if (args.dryRun) {
      console.log('');
      console.log(`  --- ${alert.subject}`);
      console.log(`      ${alert.headline}`);
      if (alert.saveWindowNote) console.log(`      ${alert.saveWindowNote}`);
      console.log(`      reason: ${alert.reasonLabel}`);
      console.log(`      comment: ${alert.comment ?? '(none)'}`);
      console.log(`      tenure: ${alert.tenure}`);
      continue;
    }

    // Only reachable as --dry-run --mark-only (the writing path returned above,
    // and dry-run's own branch already `continue`d), so there is nothing to latch.
    if (args.markOnly) {
      console.log(`  WOULD MARK ${row.email} (${kind})`);
      continue;
    }

    try {
      await sendCancellationAlertEmail(to as string, alert);
      // Latch only AFTER the send resolves. A throw leaves the row unlatched so
      // the next tick retries it — the whole reason this is a sweeper.
      latch(insertLatch, row, kind);
      sent += 1;
      console.log(`  SENT ${row.email} (${kind}) — ${alert.reasonLabel}`);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${row.email} (${kind}): ${message}`);
    }

    // Space the sends. Only the network path needs it — dry-run and --mark-only
    // already `continue`d above and never reach here. A failure is throttled the
    // same as a success: a 429 means we are going too fast, so pressing straight
    // on would just earn another one.
    if (row !== batch[batch.length - 1] && args.throttleMs > 0) {
      await sleep(args.throttleMs);
    }
  }

  if (args.dryRun) {
    console.log(`\n[cancellation-alerts] dry run — ${batch.length} alert(s) would be sent to ${to ?? '(no recipient configured)'}`);
  } else if (failed > 0) {
    console.log(
      `\n[cancellation-alerts] ${sent} sent, ${failed} failed — the failures were not latched and retry on the next tick`,
    );
  } else {
    console.log(
      `\n[cancellation-alerts] ${sent} ${args.markOnly ? 'marked' : 'sent'}, 0 failed`,
    );
  }

  db.close();

  // See alertRunExitCode: a partial failure retries next tick and must not fail
  // the unit; a run where nothing succeeded does not self-heal and must.
  process.exit(alertRunExitCode(sent, failed));
}

// One synthetic alert, so the layout can be checked on a real mail client without
// waiting for somebody to actually quit. Deliberately carries a free-text comment
// and a live save window — the richest variant, and the one worth eyeballing.
async function sendPreview(to: string): Promise<void> {
  const churnedAt = new Date(Date.now() - 90 * 60_000).toISOString();
  const alert = buildChurnAlert(
    {
      churnEventId: 'audit_preview',
      kind: 'pending',
      email: 'sample.member@example.com',
      userId: 'user_preview',
      auditMessage:
        'Cancellation requested for sub sub_preview | cancel_feedback=missing_features ' +
        'cancel_comment="I want data for FUTURES, ES, MES, NASDAQ"',
      churnedAtIso: churnedAt,
      accountCreatedAtIso: new Date(Date.now() - 87 * 86_400_000).toISOString(),
      tier: 'pro',
      currentPeriodEndIso: new Date(Date.now() + 26 * 86_400_000).toISOString(),
    },
    NOW_ISO,
  );
  await sendCancellationAlertEmail(to, alert);
  console.log(`[cancellation-alerts] preview sent to ${to}`);
  console.log(`[cancellation-alerts] subject: ${alert.subject}`);
}

function latch(
  stmt: ReturnType<DatabaseSync['prepare']> | null,
  row: ChurnRow,
  kind: ChurnEventKind,
): void {
  if (!stmt) return;
  stmt.run(
    `audit_${crypto.randomBytes(12).toString('hex')}`,
    ALERT_SENT_EVENT_TYPE,
    row.user_id,
    null,
    row.email,
    'send-cancellation-alerts',
    buildAlertLatchMessage(row.id, kind),
    new Date().toISOString(),
  );
}

main().catch((err) => {
  console.error('[cancellation-alerts] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
