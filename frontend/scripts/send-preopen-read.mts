#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-preopen-read.mts \
//     [--auto | --dry-run | --yes | --preview-to <email>] [--force] \
//     [--limit N] [--throttle-ms N] [--session-date YYYY-MM-DD]
//
// Today's Read by email, before the open, to every member with paid access
// (core/preopenReadRecipients.ts says who). The read is the dashboard's own
// (buildReportModel), word for word, for SPX, with the key levels and a row
// for each of the six symbols. The words are decided in core/preopenRead.ts.
//
// SAFE BY DEFAULT. Without --yes (or --auto with PREOPEN_READ_LIVE=1) it sends
// nothing to members. The timer runs --auto, which until PREOPEN_READ_LIVE=1
// is set in frontend/.env.local mails ONE preview a morning to the operator and
// nobody else (resolveAutoPlan in core/preopenRead.ts).
//
// THE SAME THREE GUARDS AS THE FREE DAILY LEVELS EMAIL (send-daily-levels.mts),
// ALL OF WHICH ABORT THE WHOLE RUN:
//   1. Trading day. Weekends and NYSE holidays (NEXT_PUBLIC_NYSE_HOLIDAYS).
//   2. Send window, 08:30-09:25 ET, against the real clock: a "before the
//      open" email arriving mid-session is worse than none. --force skips this
//      one only.
//   3. Freshness. Each snapshot must be from the session being named or the one
//      before it. Before the open SPX, NDX, ES and NQ are still the prior close
//      and SPY and QQQ have refreshed; every row carries its own time.
//
// SAFE TO RE-RUN. Each member is stamped (users.preopen_read_last_sent_on) the
// moment their email is accepted, and a run skips anyone stamped for that
// session. Sends are paced and retried exactly like the free digest's
// (core/resendRetry.ts): Resend allows 10 requests a second for the whole
// account, and this shares that budget with every other email we send.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { buildDigestModel, DIGEST_SYMBOL_ORDER, type SymbolSnapshot } from '../core/dailyLevelsDigest.ts';
import {
  SEND_WINDOW_END_MIN,
  SEND_WINDOW_START_MIN,
  checkFreshness,
  etParts,
  isTradingDay,
  previousTradingDay,
  type FreshnessBasis,
} from '../core/levelsEmail.ts';
import type { GexSummary } from '../core/gexSummary.ts';
import { buildReportModel } from '../app/live-bulletin/bulletinHelpers.ts';
import {
  buildPreopenRead,
  buildPreopenReadStopUrl,
  renderPreopenReadEmail,
  resolveAutoPlan,
} from '../core/preopenRead.ts';
import { sendPreopenReadEmail } from '../core/mailer.ts';
import { deliverAll, isRetryable } from '../core/resendRetry.ts';

const PRIMARY_SYMBOL = 'SPX';
// At most four Resend requests a second, as for the free digest.
const DEFAULT_THROTTLE_MS = 250;

type Args = {
  auto: boolean;
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
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    auto: false, dryRun: false, yes: false, force: false, help: false,
    previewTo: null, limit: null, throttleMs: DEFAULT_THROTTLE_MS, sessionDate: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--auto') args.auto = true;
    else if (arg === '--dry-run') args.dryRun = true;
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
  node --experimental-strip-types scripts/send-preopen-read.mts \\
    [--auto | --dry-run | --yes | --preview-to <email>] [--force] \\
    [--limit N] [--throttle-ms N] [--session-date YYYY-MM-DD]

Today's Read by email, before the open, to every member with paid access.
Sends nothing to members unless --yes is passed (or --auto with
PREOPEN_READ_LIVE=1).

Options:
      --auto               What the timer runs. With PREOPEN_READ_LIVE=1 in
                           .env.local: the same as --yes. Without it: ONE
                           preview to PREOPEN_READ_PREVIEW_TO (else
                           CANCELLATION_ALERT_EMAIL, SIGNUP_ALARM_EMAIL,
                           FOH_REMINDER_EMAIL), and nothing to members.
      --dry-run            Print the freshness verdicts, the email and the
                           recipient count. No mail, no writes.
  -y, --yes                Send to members.
      --preview-to <addr>  Send ONE copy to <addr>. No database writes.
      --force              Skip the 08:30-09:25 ET send-window check. Does NOT
                           skip the trading-day or freshness checks.
      --limit N            Send to at most N members this run.
      --throttle-ms N      Minimum gap between Resend requests, in ms (default
                           ${DEFAULT_THROTTLE_MS}).
      --session-date D     Override the ET session being named. Testing only.
  -h, --help               Show this help.

Safe to re-run: anyone already sent this session's email is skipped.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) { usage(); process.exit(0); }

if ([args.auto, args.dryRun, args.yes, !!args.previewTo].filter(Boolean).length > 1) {
  console.error('Error: --auto, --dry-run, --yes and --preview-to are mutually exclusive.');
  process.exit(1);
}

// ── Environment ─────────────────────────────────────────────────────────────
const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
for (const key of [
  'ZEROGEX_API_TOKEN', 'ZEROGEX_API_KEY', 'ZEROGEX_API_BASE_URL',
  'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_NYSE_HOLIDAYS', 'AUTH_DB_PATH', 'ZEROGEX_END_USER_TOKEN_SECRET',
  'PREOPEN_READ_LIVE', 'PREOPEN_READ_PREVIEW_TO',
  'CANCELLATION_ALERT_EMAIL', 'SIGNUP_ALARM_EMAIL', 'FOH_REMINDER_EMAIL',
]) {
  if (!process.env[key] && envLocal[key]) process.env[key] = envLocal[key];
}

const API_BASE = (process.env.ZEROGEX_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const API_TOKEN = process.env.ZEROGEX_API_TOKEN || process.env.ZEROGEX_API_KEY;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://zerogex.io').replace(/\/+$/, '');

// What this run does: 'members', 'preview' (one copy to an address) or 'dry'.
let mode: 'members' | 'preview' | 'dry' | 'plan';
let previewTo: string | null = args.previewTo;
if (args.auto) {
  const plan = resolveAutoPlan(process.env);
  if (plan.mode === 'none') {
    console.log(`--auto: nothing to do. ${plan.reason}`);
    process.exit(0);
  }
  mode = plan.mode;
  if (plan.mode === 'preview') previewTo = plan.to;
  console.log(
    plan.mode === 'members'
      ? '--auto: PREOPEN_READ_LIVE=1, sending to members.'
      : `--auto: PREOPEN_READ_LIVE is not 1, so ONE preview to ${plan.to} and nothing to members.`,
  );
} else if (args.yes) mode = 'members';
else if (args.previewTo) mode = 'preview';
else if (args.dryRun) mode = 'dry';
else mode = 'plan';

if (!API_TOKEN) {
  console.error('Error: ZEROGEX_API_TOKEN (or legacy ZEROGEX_API_KEY) is required to read levels.');
  process.exit(1);
}
if ((mode === 'members' || mode === 'preview') && (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)) {
  console.error('Error: RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send.');
  process.exit(1);
}
if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
  // Every email carries a signed stop link. Mail nobody can stop is worse than
  // no mail.
  console.error('Error: ZEROGEX_END_USER_TOKEN_SECRET is required to sign the stop links.');
  process.exit(1);
}

// ── Guards ──────────────────────────────────────────────────────────────────
const now = new Date();
const et = etParts(now);
const clock = `${String(et.hour).padStart(2, '0')}:${String(et.minute).padStart(2, '0')} ET`;
const sessionDate = args.sessionDate ?? et.date;

console.log(`Now:              ${now.toISOString()}  (${et.date} ${clock})`);
console.log(`Session named:    ${sessionDate}${args.sessionDate ? '  (--session-date override)' : ''}`);
console.log(`Prior session:    ${previousTradingDay(sessionDate) ?? '(none found)'}`);

// Guard 1: a trading day, judged on the session being named. --force does not
// override it.
if (!isTradingDay(sessionDate)) {
  console.log(`\nABORT: ${sessionDate} is not a NYSE trading day. Nothing to send.`);
  process.exit(0);
}

// Guard 2: the clock window, always against the real clock. It stops a
// replayed timer mailing "before the open" mid-session; the retry rounds ask
// the same question before each pass.
function inSendWindow(at: Date): boolean {
  const p = etParts(at);
  return p.date === et.date && p.minutesOfDay >= SEND_WINDOW_START_MIN && p.minutesOfDay <= SEND_WINDOW_END_MIN;
}
if (!inSendWindow(now)) {
  if (!args.force) {
    console.log(`\nABORT: ${clock} is outside the 08:30-09:25 ET send window.`);
    console.log('Pass --force for a deliberate manual run.');
    process.exit(0);
  }
  console.log(`\n--force: proceeding outside the send window (${clock}).`);
}

// ── Levels ──────────────────────────────────────────────────────────────────
// The live summary, not the free pages' delayed one: these are members. A
// plain fetch, as in send-daily-levels.mts (core/api/serverFetch.ts imports
// 'server-only' and cannot load outside Next).
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

console.log('\nSnapshots:');
const snapshots: SymbolSnapshot[] = [];
let primaryBasis: FreshnessBasis | null = null;
for (const symbol of DIGEST_SYMBOL_ORDER) {
  const data = await fetchSummary(symbol);
  // Guard 3: freshness, per symbol.
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

const primaryData = snapshots.find((s) => s.symbol === PRIMARY_SYMBOL)?.data ?? null;
if (!primaryBasis || !primaryData) {
  console.log(`\nABORT: no usable ${PRIMARY_SYMBOL} snapshot for ${sessionDate}.`);
  console.log("A read of a book we can't show is worse than no read.");
  process.exit(mode === 'dry' || mode === 'plan' ? 0 : 1);
}

const digest = buildDigestModel({ snapshots, sessionDate, basis: primaryBasis, primary: PRIMARY_SYMBOL });
if (!digest) {
  console.log('\nABORT: the levels model came back empty.');
  process.exit(mode === 'dry' || mode === 'plan' ? 0 : 1);
}
const report = buildReportModel({
  symbol: PRIMARY_SYMBOL,
  spot: primaryData.spot_price ?? null,
  priorClose: null,
  summary: primaryData,
  vix: null,
  volIndex: 'VIX',
  horizon: 'daily',
});
const model = buildPreopenRead({ digest, snapshots, report });

console.log(`\nSubject:          ${model.subject}`);
console.log(`As of:            ${model.asOf}`);
console.log(`Rows:             ${model.rows.map((r) => `${r.symbol} (${r.asOf})`).join(', ')}`);
if (model.omitted.length) console.log(`Omitted:          ${model.omitted.join(', ')}`);

// ── Preview ─────────────────────────────────────────────────────────────────
if (mode === 'preview') {
  // The first-send version, which every member gets once, so the whole email
  // is on review. A stop link for a member id that cannot exist, so the
  // previewer cannot stop anybody's email by clicking it.
  const stopUrl = buildPreopenReadStopUrl(APP_URL, 'user_preview');
  const rendered = renderPreopenReadEmail(model, { stopUrl, siteUrl: APP_URL, firstSend: true });
  console.log(`\nSending ONE preview to ${previewTo} (no database writes)...`);
  await sendPreopenReadEmail(previewTo as string, { ...rendered, subject: `[Preview] ${rendered.subject}`, stopUrl });
  console.log('Preview sent.');
  process.exit(0);
}

// ── Recipients ──────────────────────────────────────────────────────────────
// Imported late: core/db.ts opens the SQLite file at module load, and a
// --help, an aborted guard or a preview must not touch the database.
const { listPreopenReadRecipients, markPreopenReadSent } = await import('../core/preopenReadRecipients.ts');
const audience = listPreopenReadRecipients(sessionDate, args.limit ?? undefined);
const firstSends = audience.recipients.filter((r) => r.firstSend).length;
console.log(
  `\nMembers:          ${audience.members} with paid access · ${audience.stopped} stopped the email · ` +
    `${audience.alreadySent} already sent ${sessionDate}`,
);
console.log(`This run:         ${audience.recipients.length} (${firstSends} getting their first one)`);

if (audience.recipients.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

if (mode === 'dry' || mode === 'plan') {
  const SHOW = 25;
  console.log('Would send to:');
  for (const r of audience.recipients.slice(0, SHOW)) console.log(`  ${r.email}${r.firstSend ? ' (first)' : ''}`);
  if (audience.recipients.length > SHOW) console.log(`  … and ${audience.recipients.length - SHOW} more`);
  if (mode === 'plan') {
    console.log('\nNothing sent. Re-run with --yes to deliver, --dry-run to see the email, or --preview-to <addr>.');
    process.exit(0);
  }
  console.log('\n[dry-run] No mail sent, no rows written.');
  console.log('--- text body (regular day) ---');
  console.log(renderPreopenReadEmail(model, {
    stopUrl: buildPreopenReadStopUrl(APP_URL, 'user_preview'),
    siteUrl: APP_URL,
    firstSend: false,
  }).text);
  process.exit(0);
}

// ── Send ────────────────────────────────────────────────────────────────────
console.log(`Pace:             one Resend request per ${args.throttleMs} ms at most`);
let unstamped = 0;

const { sent, failed } = await deliverAll(
  audience.recipients,
  async (member) => {
    // Rendered per member: the stop link is theirs, and so is the first-send
    // note. Everything expensive is already done.
    const stopUrl = buildPreopenReadStopUrl(APP_URL, member.id);
    const rendered = renderPreopenReadEmail(model, { stopUrl, siteUrl: APP_URL, firstSend: member.firstSend });
    await sendPreopenReadEmail(member.email, { ...rendered, stopUrl });
    // Delivered. Nothing from here on may throw: deliverAll would take it for
    // a failed send and mail them a second copy.
    try {
      markPreopenReadSent(member.id, sessionDate);
    } catch (err) {
      unstamped += 1;
      console.error(
        `  WARN ${member.email}: sent, but the latch was not recorded ` +
          `(${err instanceof Error ? err.message : 'unknown error'}). A re-run today would mail them again.`,
      );
    }
  },
  {
    throttleMs: args.throttleMs,
    label: (member) => member.email,
    log: (line) => console.log(line),
    // A retry is still a before-the-open email, so the rounds stop at 09:25 ET.
    mayRetryAt: (ms) => args.force || inSendWindow(new Date(ms)),
  },
);

// One audit row per run, as for the free digest: a row per member would bury
// the table.
try {
  const { getDb } = await import('../core/db.ts');
  getDb()
    .prepare(
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (?, 'preopen_read_sent', NULL, NULL, NULL, 'cron-script', ?, ?)`,
    )
    .run(
      `audit_${crypto.randomBytes(12).toString('hex')}`,
      `Today's Read by email for ${sessionDate} (${PRIMARY_SYMBOL} as of ${model.asOf}): ` +
        `${sent.length} sent, ${failed.length} failed` +
        (audience.alreadySent > 0 ? `, ${audience.alreadySent} already sent earlier` : ''),
      new Date().toISOString(),
    );
} catch {
  /* audit is bookkeeping, never a reason to fail a completed send */
}

console.log(`\nDone. ${sent.length} sent, ${failed.length} failed.`);
if (unstamped > 0) {
  console.log(`${unstamped} of those were sent but not recorded, so a re-run today would mail them twice.`);
}
if (failed.length > 0) {
  const temporary = failed.filter((f) => isRetryable(f.error)).length;
  console.log(`\n${failed.length} member(s) did not get the ${sessionDate} read.`);
  if (temporary > 0) {
    console.log(`${temporary} failed for a temporary reason. To send to everyone still missing it, from ~/zerogex-web:`);
    console.log('  make preopen-read YES=1 FORCE=1');
    console.log('Everyone already sent today is skipped. FORCE=1 is only needed after 09:25 ET.');
  }
  if (temporary < failed.length) {
    console.log(
      `${failed.length - temporary} failed for a reason a re-run will not fix (a bad address, the API key, a used-up quota). See the FAIL lines above.`,
    );
  }
}
process.exit(failed.length > 0 ? 1 : 0);
