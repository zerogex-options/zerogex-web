#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/send-signup-alarm.mts \
//     [--to <email>] [--window <hours>] [--min <n>] [--force] [--dry-run]
//
// Signup-rate alarm. Reads the auth DB and, during active hours, emails the
// operator if NEW registrations have flatlined — i.e. fewer than --min accounts
// were created in the trailing --window hours. It is the automated version of
// the morning we spent reverse-engineering the "Daily Registrations" chart by
// hand: instead of noticing hours later that signups went quiet, you get one
// email the moment a daytime window comes up empty.
//
// Designed to run hourly via the systemd timer
// deploy/systemd/zerogex-web-signup-alarm.timer. The gating below keeps it
// quiet outside active hours and throttles repeat alerts, so a normal hourly
// tick is a cheap COUNT and an early exit.
//
// WHY a trailing window (not "today's total"): the admin chart buckets by ET
// calendar day, which makes an early-morning bar look empty simply because the
// day is young. A trailing window ("0 in the last 5h") is the honest "signups
// have actually stopped" signal, independent of the day boundary.
//
// Firing rule (all must hold, unless --force):
//   1. Current time is within [ACTIVE_START_ET, ACTIVE_END_ET) — no 3am alarms.
//   2. Registrations in the last WINDOW_HOURS are < MIN (default: 0 in 5h).
//   3. We have not already alerted within COOLDOWN_HOURS (anti-spam latch).
//
// Env (read from process.env, falling back to frontend/.env.local):
//   RESEND_API_KEY, RESEND_FROM_EMAIL       required to actually send
//   SIGNUP_ALARM_EMAIL                       recipient; falls back to
//                                            FOH_REMINDER_EMAIL, then --to
//   AUTH_DB_PATH                             auth DB (default ./data/auth.db)
//   NEXT_PUBLIC_APP_URL                      admin dashboard link (default zerogex.io)
//   SIGNUP_ALARM_WINDOW_HOURS                trailing window, default 5
//   SIGNUP_ALARM_MIN                         floor; alert if window count < this, default 1
//   SIGNUP_ALARM_ACTIVE_START_ET             active-hours start (ET, 0-23), default 10
//   SIGNUP_ALARM_ACTIVE_END_ET               active-hours end   (ET, 0-23), default 22
//   SIGNUP_ALARM_COOLDOWN_HOURS              min gap between alerts, default 12
//   SIGNUP_ALARM_STATE_PATH                  latch file (default <dbdir>/signup-alarm-state.json)
//
// Flags:
//   --to <email>     Override recipient
//   --window <hours> Override SIGNUP_ALARM_WINDOW_HOURS
//   --min <n>        Override SIGNUP_ALARM_MIN
//   --force          Ignore the active-hours + cooldown gates (still honors --dry-run)
//   --dry-run        Print the decision + email to stdout, don't send, don't latch

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Resend } from 'resend';

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

// ── Args ──────────────────────────────────────────────────────────────────────
type Args = { to: string | null; window: number | null; min: number | null; force: boolean; dryRun: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { to: null, window: null, min: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--to': args.to = argv[++i] ?? null; break;
      case '--window': args.window = Number(argv[++i]); break;
      case '--min': args.min = Number(argv[++i]); break;
      case '--force': args.force = true; break;
      case '--dry-run': args.dryRun = true; break;
      case '--help':
      case '-h':
        console.log(`Usage: node --experimental-strip-types --no-warnings \\
  scripts/send-signup-alarm.mts \\
  [--to <email>] [--window <hours>] [--min <n>] [--force] [--dry-run]`);
        process.exit(0);
    }
  }
  return args;
}

// ── Config ──────────────────────────────────────────────────────────────────
function readNumericEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zerogex.io';
const DB_PATH = process.env.AUTH_DB_PATH ?? path.join(process.cwd(), 'data', 'auth.db');
const STATE_PATH =
  process.env.SIGNUP_ALARM_STATE_PATH ?? path.join(path.dirname(DB_PATH), 'signup-alarm-state.json');

// ── ET wall-clock (DST-correct via Intl, no dependency) ───────────────────────
function etParts(d: Date): { date: string; hour: number; clock: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value])) as Record<string, string>;
  // Intl can render midnight as hour "24"; normalize to 0-23.
  const hour = Number(p.hour) % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, hour, clock: `${String(hour).padStart(2, '0')}:${p.minute} ET` };
}

// ── Latch (anti-spam) ─────────────────────────────────────────────────────────
type State = { lastAlertAt?: string };

function readState(): State {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as State;
  } catch {
    return {};
  }
}

function writeState(state: State): void {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (err) {
    // A latch-write failure must not swallow the alert itself, but do surface
    // it — a permanently unwritable state file would turn "alert once" into
    // "alert every hour" until fixed.
    console.error(`[signup-alarm] WARNING: could not write state file ${STATE_PATH}:`, err);
  }
}

// ── DB reads ──────────────────────────────────────────────────────────────────
type DailyCount = { d: string; n: number };

function openDb(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  // Live PM2 writer holds the same WAL file; wait rather than fail on a lock.
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

function countSince(db: DatabaseSync, cutoffIso: string): number {
  // created_at is stored as new Date().toISOString() (…T…Z), so a lexical
  // compare against another toISOString() cutoff is a correct chronological
  // compare. (A SQLite datetime('now',…) string uses a space, not 'T', and
  // would mis-sort — hence we build the cutoff in JS.)
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?')
    .get(cutoffIso) as { n: number };
  return row.n;
}

function dailyCounts(db: DatabaseSync, sinceIso: string): DailyCount[] {
  return db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n
       FROM users WHERE created_at >= ?
       GROUP BY d ORDER BY d DESC`,
    )
    .all(sinceIso) as DailyCount[];
}

// ── Email ─────────────────────────────────────────────────────────────────────
function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

type AlarmContext = {
  windowHours: number;
  min: number;
  windowCount: number;
  last24h: number;
  daily: DailyCount[];
  etClock: string;
};

function buildText(c: AlarmContext): string {
  const dailyLines = c.daily.length
    ? c.daily.map((r) => `  ${r.d}   ${r.n}`)
    : ['  (no registrations in the last 7 days)'];
  return [
    `SIGNUP ALARM — new registrations have flatlined.`,
    ``,
    `Only ${c.windowCount} new account(s) were created in the last ${c.windowHours}h`,
    `(alarm floor: < ${c.min}). Checked at ${c.etClock}.`,
    ``,
    `Last 24h: ${c.last24h} registration(s).`,
    ``,
    `Registrations per day (UTC), last 7 days:`,
    ...dailyLines,
    ``,
    `This means the signup PIPELINE may be fine while the TOP OF FUNNEL dried`,
    `up — the two are diagnosed differently. Fast triage:`,
    ``,
    `  1. Is it acquisition? Check your ad platform: are campaigns DELIVERING`,
    `     and SPENDING right now, and is the click traffic real (not bots)?`,
    `  2. Is it the form? In a fresh incognito window with DevTools open, load`,
    `     ${APP_URL}/register and complete a signup. Watch for a console error`,
    `     on load, a failed /api/auth/csrf, or a non-200 /api/auth/register.`,
    `  3. Is it the backend? On the box:  make webhook-health  and  make status`,
    `     (confirm the BFF is online and on Node 22 — node:sqlite needs 22+).`,
    `  4. Is it just early? The admin chart buckets by ET day; cross-check the`,
    `     trailing-window number above, which ignores the day boundary.`,
    ``,
    `Admin dashboard: ${APP_URL}/admin/monitoring`,
    ``,
    `— scripts/send-signup-alarm.mts (systemd timer: hourly, active hours only,`,
    `  throttled). Tune SIGNUP_ALARM_* in frontend/.env.local, or disable with`,
    `  sudo systemctl disable --now zerogex-web-signup-alarm.timer`,
  ].join('\n');
}

function buildHtml(c: AlarmContext): string {
  const rows = c.daily.length
    ? c.daily
        .map(
          (r) =>
            `<tr><td style="padding:2px 16px 2px 0;color:#555;">${escapeHtml(r.d)}</td><td style="padding:2px 0;font-weight:600;">${r.n}</td></tr>`,
        )
        .join('')
    : `<tr><td style="padding:2px 0;color:#555;">No registrations in the last 7 days</td></tr>`;
  return `<!doctype html>
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 680px; margin: 0 auto; padding: 24px; line-height: 1.55;">
  <h1 style="margin: 0 0 8px; font-size: 22px;">⚠ Signup alarm — registrations have flatlined</h1>
  <p style="margin: 0 0 16px; font-size: 15px;">
    Only <strong>${c.windowCount}</strong> new account(s) were created in the last
    <strong>${c.windowHours}h</strong> (alarm floor: &lt; ${c.min}). Checked at ${escapeHtml(c.etClock)}.
    Last 24h: <strong>${c.last24h}</strong>.
  </p>

  <table style="border-collapse: collapse; font-size: 13.5px; margin: 0 0 20px;">
    <caption style="text-align:left; color:#333; font-weight:600; font-size:13px; padding-bottom:6px;">Registrations per day (UTC), last 7 days</caption>
    ${rows}
  </table>

  <p style="margin: 0 0 8px; color:#333;">
    The signup <em>pipeline</em> may be fine while the <em>top of funnel</em> dried up — they're diagnosed differently. Fast triage:
  </p>
  <ol style="margin: 4px 0 20px 20px; padding: 0; color: #333; font-size: 14px; line-height: 1.7;">
    <li><strong>Acquisition?</strong> Check your ad platform — are campaigns delivering &amp; spending now, and is the click traffic real (not bots)?</li>
    <li><strong>The form?</strong> In fresh incognito with DevTools open, complete a signup at <a href="${escapeHtml(APP_URL + '/register')}" style="color:#f5b400;">${escapeHtml(APP_URL)}/register</a> — watch for a console error on load, a failed <code>/api/auth/csrf</code>, or a non-200 <code>/api/auth/register</code>.</li>
    <li><strong>The backend?</strong> On the box: <code>make webhook-health</code> and <code>make status</code> (BFF online and on Node 22 — <code>node:sqlite</code> needs 22+).</li>
    <li><strong>Just early?</strong> The admin chart buckets by ET day; the trailing-window number above ignores the day boundary.</li>
  </ol>

  <p style="margin: 0 0 20px;">
    <a href="${escapeHtml(APP_URL + '/admin/monitoring')}" style="display:inline-block;padding:10px 16px;background:#f5b400;color:#000;font-weight:700;text-decoration:none;border-radius:8px;">Open admin monitoring</a>
  </p>

  <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 28px 0 16px;">
  <p style="color: #888; font-size: 12px; margin: 0;">
    Sent by scripts/send-signup-alarm.mts (systemd timer: hourly, active hours only, throttled).
    Tune the <code>SIGNUP_ALARM_*</code> vars in <code>frontend/.env.local</code>, or disable with
    <code>sudo systemctl disable --now zerogex-web-signup-alarm.timer</code>.
  </p>
</div>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  const windowHours = args.window ?? readNumericEnv('SIGNUP_ALARM_WINDOW_HOURS', 5);
  const min = args.min ?? readNumericEnv('SIGNUP_ALARM_MIN', 1);
  const activeStart = readNumericEnv('SIGNUP_ALARM_ACTIVE_START_ET', 10);
  const activeEnd = readNumericEnv('SIGNUP_ALARM_ACTIVE_END_ET', 22);
  const cooldownHours = readNumericEnv('SIGNUP_ALARM_COOLDOWN_HOURS', 12);

  if (!(windowHours > 0)) {
    console.error(`[signup-alarm] invalid window hours: ${windowHours}`);
    process.exit(1);
  }

  const now = new Date();
  const et = etParts(now);

  // Gate 1: active hours (skipped by --force). Quietly exit overnight.
  const inActiveHours = et.hour >= activeStart && et.hour < activeEnd;
  if (!args.force && !inActiveHours) {
    console.log(`[signup-alarm] ${et.clock}: outside active hours ${activeStart}:00-${activeEnd}:00 ET — no check.`);
    return;
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[signup-alarm] auth DB not found at ${DB_PATH}. Set AUTH_DB_PATH.`);
    process.exit(1);
  }

  const db = openDb();
  let windowCount: number;
  let last24h: number;
  let daily: DailyCount[];
  try {
    windowCount = countSince(db, new Date(now.getTime() - windowHours * 3600_000).toISOString());
    last24h = countSince(db, new Date(now.getTime() - 24 * 3600_000).toISOString());
    daily = dailyCounts(db, new Date(now.getTime() - 7 * 24 * 3600_000).toISOString());
  } finally {
    db.close();
  }

  // Healthy: signups are flowing. Nothing to do.
  if (windowCount >= min) {
    console.log(`[signup-alarm] ${et.clock}: ${windowCount} registration(s) in last ${windowHours}h (>= ${min}) — healthy.`);
    return;
  }

  // Gate 3: cooldown (skipped by --force). Anti-spam latch.
  const state = readState();
  if (!args.force && state.lastAlertAt) {
    const sinceLastMs = now.getTime() - Date.parse(state.lastAlertAt);
    if (Number.isFinite(sinceLastMs) && sinceLastMs < cooldownHours * 3600_000) {
      const hrs = (sinceLastMs / 3600_000).toFixed(1);
      console.log(`[signup-alarm] ${et.clock}: window low (${windowCount}) but last alert was ${hrs}h ago (< ${cooldownHours}h cooldown) — suppressed.`);
      return;
    }
  }

  const ctx: AlarmContext = { windowHours, min, windowCount, last24h, daily, etClock: et.clock };
  const subject = `[ZeroGEX] ⚠ Signup alarm — ${windowCount} new registration(s) in the last ${windowHours}h`;
  const text = buildText(ctx);
  const html = buildHtml(ctx);

  if (args.dryRun) {
    console.log(`=== would send (dry-run) ===`);
    console.log(`SUBJECT: ${subject}`);
    console.log(text);
    return;
  }

  const to = args.to ?? process.env.SIGNUP_ALARM_EMAIL ?? process.env.FOH_REMINDER_EMAIL;
  if (!to) {
    console.error('[signup-alarm] no recipient. Set SIGNUP_ALARM_EMAIL (or FOH_REMINDER_EMAIL), or pass --to.');
    process.exit(1);
  }
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromAddr) {
    console.error('[signup-alarm] missing RESEND_API_KEY and/or RESEND_FROM_EMAIL — cannot send.');
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({ from: fromAddr, to, subject, text, html });
  if (result.error) {
    console.error(`[signup-alarm] Resend error: ${result.error.message}`);
    process.exit(1);
  }

  // Only latch AFTER a confirmed send, so a send failure retries next tick.
  writeState({ lastAlertAt: now.toISOString() });
  console.log(`[signup-alarm] ${et.clock}: ALERT sent to ${to} — ${windowCount} in last ${windowHours}h.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
