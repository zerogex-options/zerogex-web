#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-daily-levels.mts \
//     [--dry-run | --yes] [--preview-to <email>] [--force] \
//     [--limit N] [--throttle-ms N] [--session-date YYYY-MM-DD]
//
// Sends the free pre-open levels digest to every CONFIRMED, non-unsubscribed
// row in levels_subscribers. Intended to run once per trading morning inside
// the 08:30-09:25 ET window (zerogex-web-daily-levels.timer).
//
// SAFE BY DEFAULT. Without --yes it prints what it would do and sends nothing.
// --dry-run additionally prints the per-symbol freshness verdict, which is the
// diagnostic to reach for when asking "why did this morning's send abort?".
//
// THREE GUARDS, ALL OF WHICH ABORT THE WHOLE RUN:
//
//   1. Trading day. Weekends and NYSE holidays (NEXT_PUBLIC_NYSE_HOLIDAYS).
//   2. Send window. 08:30-09:25 ET, enforced HERE rather than only in the
//      timer, because systemd's Persistent= replays a missed unit as soon as
//      the box is back — which would mail "today's pre-open levels" mid
//      session. The unit sets Persistent=false and this is the second lock.
//      --force bypasses it for a deliberate manual run; it does NOT bypass
//      the other two.
//   3. Freshness. serverApiGet-style reads return a last-good value when the
//      backend is unreachable, so "we got data" is not "we got the right
//      data". The snapshot must be from the current session or the one
//      immediately before it. A feed frozen since Thursday fails on a Monday.
//
// A partial digest is never sent: if SPX has no usable snapshot the run
// aborts, and any OTHER ticker off the anchor date is dropped from the table
// and named in the email rather than printed as if it were current.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  buildDigestModel,
  renderDailyLevelsEmail,
  DIGEST_SYMBOL_ORDER,
  type SymbolSnapshot,
} from '../core/dailyLevelsDigest.ts';
import { summarizeForecastHistory, type ForecastDateEntry, type HistorySummary } from '../core/trackRecord.ts';
import {
  SEND_WINDOW_END_MIN,
  SEND_WINDOW_START_MIN,
  buildLevelsUnsubUrl,
  checkFreshness,
  etParts,
  isTradingDay,
  previousTradingDay,
  type FreshnessBasis,
} from '../core/levelsEmail.ts';
import type { GexSummary } from '../core/gexSummary.ts';
import { sendDailyLevelsEmail } from '../core/mailer.ts';

const PRIMARY_SYMBOL = 'SPX';

type Args = {
  dryRun: boolean;
  yes: boolean;
  force: boolean;
  help: boolean;
  previewTo: string | null;
  limit: number | null;
  throttleMs: number;
  sessionDate: string | null;
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
    dryRun: false, yes: false, force: false, help: false,
    previewTo: null, limit: null, throttleMs: 0, sessionDate: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--session-date') args.sessionDate = argv[++i] ?? null;
    else if (arg === '--limit') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isInteger(v) || v < 1) {
        console.error(`Error: --limit expects a positive integer, got "${argv[i]}".`);
        process.exit(1);
      }
      args.limit = v;
    } else if (arg === '--throttle-ms') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isFinite(v) || v < 0) {
        console.error(`Error: --throttle-ms expects a non-negative number, got "${argv[i]}".`);
        process.exit(1);
      }
      args.throttleMs = v;
    } else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-daily-levels.mts \\
    [--dry-run | --yes] [--preview-to <email>] [--force] \\
    [--limit N] [--throttle-ms N] [--session-date YYYY-MM-DD]

Sends the free pre-open levels digest to every confirmed, non-unsubscribed
subscriber. Sends nothing unless --yes is passed.

Options:
      --dry-run            Print the freshness verdict per symbol, the rendered
                           subject, and the recipient count. No mail, no writes.
  -y, --yes                Actually send.
      --preview-to <addr>  Render the digest and send ONE copy to <addr>.
                           No database writes, no recipient list touched.
      --force              Skip the 08:30-09:25 ET send-window check. Does NOT
                           skip the trading-day or freshness checks.
      --limit N            Send to at most N subscribers this run.
      --throttle-ms N      Pause N ms between sends.
      --session-date D     Override the ET session being named. Testing only.
  -h, --help               Show this help.

Reads ZEROGEX_API_TOKEN, ZEROGEX_API_BASE_URL, RESEND_API_KEY,
RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_NYSE_HOLIDAYS and
AUTH_DB_PATH from the environment or frontend/.env.local.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) { usage(); process.exit(0); }

if ([args.dryRun, args.yes, !!args.previewTo].filter(Boolean).length > 1) {
  console.error('Error: --dry-run, --yes and --preview-to are mutually exclusive.');
  process.exit(1);
}

// ── Environment ─────────────────────────────────────────────────────────────
// .env.local is the source of record on the server; explicit env wins so a
// one-off run can override without editing the file.
const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
for (const key of [
  'ZEROGEX_API_TOKEN', 'ZEROGEX_API_KEY', 'ZEROGEX_API_BASE_URL',
  'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_NYSE_HOLIDAYS', 'AUTH_DB_PATH', 'ZEROGEX_END_USER_TOKEN_SECRET',
]) {
  if (!process.env[key] && envLocal[key]) process.env[key] = envLocal[key];
}

const API_BASE = (process.env.ZEROGEX_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const API_TOKEN = process.env.ZEROGEX_API_TOKEN || process.env.ZEROGEX_API_KEY;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://zerogex.io').replace(/\/+$/, '');

if (!API_TOKEN) {
  console.error('Error: ZEROGEX_API_TOKEN (or legacy ZEROGEX_API_KEY) is required to read levels.');
  process.exit(1);
}
if ((args.yes || args.previewTo) && (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send.');
  process.exit(1);
}
if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
  // Every digest carries a signed unsubscribe link. Sending without one would
  // mean mail nobody can opt out of, which is worse than not sending.
  console.error('Error: ZEROGEX_END_USER_TOKEN_SECRET is required to sign unsubscribe links.');
  process.exit(1);
}

// ── Guards ──────────────────────────────────────────────────────────────────
const now = new Date();
const et = etParts(now);
const clock = `${String(et.hour).padStart(2, '0')}:${String(et.minute).padStart(2, '0')} ET`;

// The session the digest will NAME. Normally today; --session-date overrides
// it for testing. The two guards below are checked independently rather than
// through checkSendWindow(), which answers both at once against the wall
// clock: that conflates "is there a session to write about" with "is it the
// right time of day to write about it", and it left --session-date unable to
// simulate a weekday because the trading-day check fired on today's date
// first.
const sessionDate = args.sessionDate ?? et.date;

console.log(`Now:              ${now.toISOString()}  (${et.date} ${clock})`);
console.log(`Session named:    ${sessionDate}${args.sessionDate ? '  (--session-date override)' : ''}`);
console.log(`Prior session:    ${previousTradingDay(sessionDate) ?? '(none found)'}`);

// Guard 1 — trading day, evaluated against the session being NAMED. --force
// does NOT override it: on a weekend or a holiday there is no session to
// write about, and --session-date only moves which day is checked, never
// disables the check, so a passed-in Christmas still aborts.
if (!isTradingDay(sessionDate)) {
  console.log(`\nABORT: ${sessionDate} is not a NYSE trading day. Nothing to send.`);
  process.exit(0);
}

// Guard 2 — clock window, always against the real clock, never the override.
// This is what stops a systemd timer replayed after a reboot from mailing
// "today's pre-open levels" in the middle of the session.
const inWindow = et.minutesOfDay >= SEND_WINDOW_START_MIN && et.minutesOfDay <= SEND_WINDOW_END_MIN;
if (!inWindow) {
  if (!args.force) {
    console.log(`\nABORT: ${clock} is outside the 08:30-09:25 ET send window.`);
    console.log('This is the guard that stops a replayed systemd timer mailing pre-open');
    console.log('levels mid-session. Pass --force for a deliberate manual run.');
    process.exit(0);
  }
  console.log(`\n--force: proceeding outside the send window (${clock}).`);
}

// ── Levels ──────────────────────────────────────────────────────────────────
// A plain fetch rather than core/api/serverFetch.ts: that module imports
// 'server-only' and cannot be loaded outside a Next runtime. Same base URL,
// same bearer, same endpoint, so it shares nothing but reaches the same data.
async function fetchSummary(symbol: string): Promise<GexSummary | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/gex/summary?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`,
      { headers: { Authorization: `Bearer ${API_TOKEN}` } },
    );
    if (!res.ok) {
      console.warn(`  ${symbol}: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as GexSummary;
  } catch (err) {
    console.warn(`  ${symbol}: ${err instanceof Error ? err.message : 'fetch failed'}`);
    return null;
  }
}

/**
 * The graded record for one symbol, best-effort.
 *
 * BEST-EFFORT IS THE WHOLE DESIGN. This runs in a weekday cron that mails
 * real subscribers, and it exists to add one marketing sentence. Every
 * failure path returns null, the digest omits the line, and the email goes
 * out exactly as it did before. Nothing here may abort a send.
 */
async function fetchTrackRecord(symbol: string): Promise<HistorySummary | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/forecast/available-dates?symbol=${encodeURIComponent(symbol)}&limit=400`,
      { headers: { Authorization: `Bearer ${API_TOKEN}` } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { dates?: ForecastDateEntry[] };
    if (!json?.dates?.length) return null;
    return summarizeForecastHistory(json.dates, symbol);
  } catch {
    return null;
  }
}

console.log('\nSnapshots:');
const snapshots: SymbolSnapshot[] = [];
let primaryBasis: FreshnessBasis | null = null;

for (const symbol of DIGEST_SYMBOL_ORDER) {
  const data = await fetchSummary(symbol);
  const verdict = checkFreshness({ snapshotTimestamp: data?.timestamp, sessionDate, now });
  const stamp = data?.timestamp ?? '(none)';
  if (verdict.fresh) {
    console.log(`  ${symbol.padEnd(4)} ${stamp}  →  ${verdict.basis}  (${verdict.ageMinutes} min old)`);
    if (symbol === PRIMARY_SYMBOL) primaryBasis = verdict.basis;
    snapshots.push({ symbol, data });
  } else {
    console.log(`  ${symbol.padEnd(4)} ${stamp}  →  REJECTED (${verdict.reason})`);
    snapshots.push({ symbol, data: null });
  }
}

if (!primaryBasis) {
  console.log(`\nABORT: no usable ${PRIMARY_SYMBOL} snapshot for ${sessionDate}.`);
  console.log('A digest named after a ticker it cannot show is worse than no digest.');
  process.exit(args.dryRun ? 0 : 1);
}

// One model per DISTINCT preferred symbol, not per recipient. Everything
// expensive is shared — the six fetches above, the freshness verdicts, the
// formatting — and the only thing a subscriber's choice changes is the order
// of the rows, which ticker is highlighted, and the subject. Six models
// covers every possible preference no matter how long the list gets.
const modelCache = new Map<string, ReturnType<typeof buildDigestModel>>();
const historyCache = new Map<string, HistorySummary | null>();
async function modelFor(symbol: string) {
  if (!modelCache.has(symbol)) {
    if (!historyCache.has(symbol)) historyCache.set(symbol, await fetchTrackRecord(symbol));
    modelCache.set(
      symbol,
      buildDigestModel({
        snapshots,
        sessionDate,
        basis: primaryBasis!,
        primary: symbol,
        history: historyCache.get(symbol) ?? null,
      }),
    );
  }
  return modelCache.get(symbol) ?? null;
}

const model = await modelFor(PRIMARY_SYMBOL);
if (!model) {
  console.log('\nABORT: the digest model came back empty.');
  process.exit(args.dryRun ? 0 : 1);
}

console.log(`\nSubject:          ${model.subject}`);
console.log(`Basis:            ${model.basis}`);
console.log(`As of:            ${model.asOf}`);
console.log(`Rows:             ${model.rows.map((r) => r.symbol).join(', ')}`);
if (model.omitted.length) console.log(`Omitted:          ${model.omitted.join(', ')}`);

// ── Preview ─────────────────────────────────────────────────────────────────
if (args.previewTo) {
  // A real but non-functional unsubscribe id: the preview must LOOK like the
  // real thing, and must not hand the previewer a link that would opt out an
  // actual subscriber.
  const rendered = renderDailyLevelsEmail(model, {
    unsubUrl: buildLevelsUnsubUrl(APP_URL, 'lvl_preview'),
    siteUrl: APP_URL,
  });
  console.log(`\nSending ONE preview to ${args.previewTo} (no database writes)...`);
  await sendDailyLevelsEmail(args.previewTo, { ...rendered, unsubUrl: buildLevelsUnsubUrl(APP_URL, 'lvl_preview') });
  console.log('Preview sent.');
  process.exit(0);
}

// ── Recipients ──────────────────────────────────────────────────────────────
// Imported late and dynamically: core/db.ts opens the SQLite file at module
// load, and a --help or an aborted guard run must not touch the database.
const { listSendableLevelsSubscribers, markLevelsDigestSent, countLevelsSubscribers } =
  await import('../core/levelsSubscribers.ts');

const counts = countLevelsSubscribers();
console.log(`\nSubscribers:      ${counts.confirmed} confirmed · ${counts.pending} pending · ${counts.unsubscribed} unsubscribed`);

const recipients = listSendableLevelsSubscribers(args.limit ?? undefined);
console.log(`This run:         ${recipients.length}`);

if (recipients.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

if (args.dryRun) {
  const bySymbol = new Map<string, number>();
  for (const r of recipients) bySymbol.set(r.symbol, (bySymbol.get(r.symbol) ?? 0) + 1);
  console.log(
    `Preferred symbol: ${[...bySymbol.entries()].map(([sym, n]) => `${sym}×${n}`).join(', ') || '(none)'}`,
  );
  console.log('\n[dry-run] No mail sent, no rows written.');
  console.log('--- text body ---');
  console.log(renderDailyLevelsEmail(model, {
    unsubUrl: buildLevelsUnsubUrl(APP_URL, 'lvl_preview'),
    siteUrl: APP_URL,
  }).text);
  process.exit(0);
}

if (!args.yes) {
  console.log('\nRefusing to send without --yes. Re-run with --yes to deliver, or --dry-run to preview.');
  process.exit(1);
}

// ── Send ────────────────────────────────────────────────────────────────────
let sent = 0;
let failed = 0;

for (const [index, subscriber] of recipients.entries()) {
  try {
    if (args.throttleMs > 0 && index > 0) {
      await new Promise((resolve) => setTimeout(resolve, args.throttleMs));
    }
    // The unsubscribe link is per-subscriber, so the body is rendered per
    // recipient rather than once. Everything expensive (the fetch, the model)
    // is already done; this is string assembly.
    const unsubUrl = buildLevelsUnsubUrl(APP_URL, subscriber.id);
    // Their chosen ticker leads their copy. Falls back to the SPX model if
    // their preference has no usable snapshot this morning — better a digest
    // led by the wrong ticker than no digest at all.
    const theirModel = (await modelFor(subscriber.symbol)) ?? model;
    const rendered = renderDailyLevelsEmail(theirModel, { unsubUrl, siteUrl: APP_URL });
    await sendDailyLevelsEmail(subscriber.email, { ...rendered, unsubUrl });
    markLevelsDigestSent(subscriber.id);
    sent += 1;
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${subscriber.email}: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

// Best-effort audit row, one per run rather than per recipient: this is a bulk
// send and a row each would bury the table.
try {
  const { getDb } = await import('../core/db.ts');
  getDb()
    .prepare(
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (?, 'daily_levels_digest_sent', NULL, NULL, NULL, 'cron-script', ?, ?)`,
    )
    .run(
      `audit_${crypto.randomBytes(12).toString('hex')}`,
      `Daily levels digest for ${sessionDate} (${model.basis}, as of ${model.asOf}): ${sent} sent, ${failed} failed`,
      new Date().toISOString(),
    );
} catch {
  /* audit is bookkeeping, never a reason to fail a completed send */
}

console.log(`\nDone. ${sent} sent, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
