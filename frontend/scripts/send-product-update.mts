#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-product-update.mts \
//     --audience subscribers|registrants \
//     [--dry-run] [--preview-to <email>] [--send --yes] [--limit N] \
//     [--days N] [--subject "..."] [--throttle-ms N] [--no-list-unsubscribe] [--csv <path>]
//
// One-shot July 2026 product update, sent DIRECTLY per-recipient from the server
// via Resend (emails.send). Computes the cohort from the auth DB, sends the
// matching docs/newsletters/*.html + *.txt to each recipient, and stamps an
// audit row so re-runs resume instead of double-sending.
//
// The email body carries a per-recipient Unsubscribe link: the {{UNSUB_URL}}
// placeholder is replaced with a signed /unsubscribe link, and the same URL is
// set as a one-click List-Unsubscribe header (RFC 8058). Users who have
// unsubscribed (users.marketing_unsubscribed_at) are excluded from the cohort.
// --no-list-unsubscribe drops only the header (the body link stays).
// Requires ZEROGEX_END_USER_TOKEN_SECRET (to sign) and NEXT_PUBLIC_APP_URL.
//
// Audiences:
//   subscribers  → active + trialing customers.
//                  WHERE subscription_status IN ('active','trialing')
//   registrants  → signed up ≤N days (default 30), verified email, logged in
//                  (proxied by authenticated page-view activity — no last_login
//                  column exists), never subscribed, and NOT already reached by
//                  the automated verified-never-paid nudge (no double-touch).
//
// Idempotency: a `product_update_2026_07_sent` row is written to audit_events on
// each successful send; already-stamped users are skipped on re-run.
//
// Env (from process.env or .env.local): RESEND_API_KEY, RESEND_FROM_EMAIL.
// AUTH_DB_PATH overrides the DB. Requires the sqlite3 CLI on PATH.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { buildUnsubUrl } from '../core/unsubToken.ts';

type Audience = 'subscribers' | 'registrants';

type Args = {
  audience: Audience | null;
  dryRun: boolean;
  send: boolean;
  yes: boolean;
  previewTo: string | null;
  csvPath: string | null;
  limit: number | null;
  days: number;
  subject: string | null;
  throttleMs: number;
  listUnsub: boolean;
  help: boolean;
};

const CAMPAIGN = 'product_update_2026_07';
const REPLY_TO = 'Michael@zerogex.io';

const SUBJECTS: Record<Audience, string> = {
  subscribers: "What's new at ZeroGEX — and what's coming next",
  registrants: 'Your ZeroGEX account is ready — start with the free levels',
};
const FILES: Record<Audience, { html: string; text: string }> = {
  subscribers: { html: '2026-07-product-update.html', text: '2026-07-product-update.txt' },
  registrants: {
    html: '2026-07-product-update-registrants.html',
    text: '2026-07-product-update-registrants.txt',
  },
};
const DEFAULT_DAYS = 30;
const DEFAULT_THROTTLE_MS = 550; // conservative: ≈1.8 req/s, well under Resend limits

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
    audience: null,
    dryRun: false,
    send: false,
    yes: false,
    previewTo: null,
    csvPath: null,
    limit: null,
    days: DEFAULT_DAYS,
    subject: null,
    throttleMs: DEFAULT_THROTTLE_MS,
    listUnsub: true,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--audience') {
      const v = argv[++i];
      if (v !== 'subscribers' && v !== 'registrants') {
        console.error(`Error: --audience must be "subscribers" or "registrants".`);
        process.exit(1);
      }
      args.audience = v;
    } else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--send') args.send = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--csv') args.csvPath = argv[++i] ?? null;
    else if (arg === '--limit') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isInteger(v) || v <= 0) {
        console.error('Error: --limit expects a positive integer.');
        process.exit(1);
      }
      args.limit = v;
    } else if (arg === '--days') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isFinite(v) || v <= 0) {
        console.error('Error: --days expects a positive number.');
        process.exit(1);
      }
      args.days = v;
    } else if (arg === '--subject') args.subject = argv[++i] ?? null;
    else if (arg === '--throttle-ms') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isFinite(v) || v < 0) {
        console.error('Error: --throttle-ms expects a non-negative number.');
        process.exit(1);
      }
      args.throttleMs = v;
    } else if (arg === '--no-list-unsubscribe') args.listUnsub = false;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-product-update.mts \\
    --audience subscribers|registrants \\
    [--dry-run] [--preview-to <email>] [--send --yes] [--limit N] \\
    [--days N] [--subject "..."] [--throttle-ms N] [--no-list-unsubscribe] [--csv <path>]

Sends the July 2026 product update directly, per-recipient, via Resend.

Modes (default is dry-run — counts only, nothing sent):
      --dry-run                 Print cohort count + sample. No send, no writes.
      --preview-to <email>      Send ONE copy to a test inbox. No DB writes.
      --send --yes              Send to the whole cohort (both flags required).
      --limit N                 With --send: only the first N recipients (test batch).
      --csv <path>              Write the cohort emails to a CSV. No send.
      --days N                  Registrant signup window (default ${DEFAULT_DAYS}).
      --subject "..."           Override the default subject.
      --throttle-ms N           Delay between sends (default ${DEFAULT_THROTTLE_MS}).
      --no-list-unsubscribe     Omit the List-Unsubscribe header (not recommended).
  -h, --help                    Show this help.

Idempotent: successful sends stamp audit_events(type='${CAMPAIGN}_sent'); a
re-run skips anyone already stamped, so an interrupted run resumes cleanly.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH (sudo apt-get install sqlite3).');
    process.exit(1);
  }
}

function esc(v: string): string {
  return v.replace(/'/g, "''");
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  try {
    const out = execFileSync('sqlite3', ['-json', dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return out ? (JSON.parse(out) as T[]) : [];
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr;
    const message =
      typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message;
    throw new Error(message.trim() || (err as Error).message);
  }
}

function execSqlite(dbPath: string, sql: string): void {
  execFileSync('sqlite3', [dbPath, sql], { stdio: ['ignore', 'ignore', 'pipe'] });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Send one email via Resend REST, retrying on 429 (rate limit) with backoff.
async function sendOne(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429 && attempt < 3) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    return { ok: false, status: res.status, body: await res.text() };
  }
  return { ok: false, status: 429, body: 'rate limited' };
}

// ---------------------------------------------------------------------------

const cli = parseArgs(process.argv.slice(2));
if (cli.help || !cli.audience) {
  usage();
  process.exit(cli.help ? 0 : 1);
}
const audience = cli.audience;

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const RESEND_API_KEY = process.env.RESEND_API_KEY || envLocal.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || envLocal.RESEND_FROM_EMAIL || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || envLocal.NEXT_PUBLIC_APP_URL || 'https://zerogex.io';
// unsubToken.ts reads the signing secret from process.env directly.
if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET && envLocal.ZEROGEX_END_USER_TOKEN_SECRET) {
  process.env.ZEROGEX_END_USER_TOKEN_SECRET = envLocal.ZEROGEX_END_USER_TOKEN_SECRET;
}

const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}. Set AUTH_DB_PATH.`);
  process.exit(1);
}
ensureSqlite3Cli();

const docsDir = path.join(cwd, '..', 'docs', 'newsletters');
const htmlPath = path.join(docsDir, FILES[audience].html);
const textPath = path.join(docsDir, FILES[audience].text);
for (const p of [htmlPath, textPath]) {
  if (!fs.existsSync(p)) {
    console.error(`Email file not found: ${p}`);
    process.exit(1);
  }
}
const subject = cli.subject || SUBJECTS[audience];

// ---- Cohort selection ------------------------------------------------------

type Row = { id: string; email: string; created_at: string };

let rows: Row[];
let excludedNudged = 0;
if (audience === 'subscribers') {
  rows = querySqlite<Row>(
    dbPath,
    `SELECT id, email, created_at
       FROM users
      WHERE subscription_status IN ('active','trialing')
        AND marketing_unsubscribed_at IS NULL
      ORDER BY created_at ASC;`,
  );
} else {
  const sinceIso = new Date(Date.now() - cli.days * 86_400_000).toISOString();
  rows = querySqlite<Row>(
    dbPath,
    `SELECT id, email, created_at
       FROM users u
      WHERE email_verified_at IS NOT NULL
        AND tier = 'public'
        AND stripe_subscription_id IS NULL
        AND COALESCE(subscription_lapsed, 0) = 0
        AND (subscription_status IS NULL OR subscription_status NOT IN ('active','trialing'))
        AND verified_never_paid_email_sent_at IS NULL
        AND marketing_unsubscribed_at IS NULL
        AND created_at >= '${esc(sinceIso)}'
        AND EXISTS (SELECT 1 FROM page_view_events pv WHERE pv.user_id = u.id)
      ORDER BY created_at ASC;`,
  );
  excludedNudged =
    querySqlite<{ n: number }>(
      dbPath,
      `SELECT COUNT(*) AS n
         FROM users u
        WHERE email_verified_at IS NOT NULL
          AND tier = 'public'
          AND stripe_subscription_id IS NULL
          AND COALESCE(subscription_lapsed, 0) = 0
          AND (subscription_status IS NULL OR subscription_status NOT IN ('active','trialing'))
          AND verified_never_paid_email_sent_at IS NOT NULL
          AND created_at >= '${esc(sinceIso)}'
          AND EXISTS (SELECT 1 FROM page_view_events pv WHERE pv.user_id = u.id);`,
    )[0]?.n ?? 0;
}

// Idempotency: which cohort members already received this campaign. Computed
// up front so the dry-run / preview and the actual send all report the same
// "to send" set — and we only ever list the recipients that will get an email.
const alreadySent = new Set(
  querySqlite<{ user_id: string }>(
    dbPath,
    `SELECT user_id FROM audit_events WHERE type = '${CAMPAIGN}_sent';`,
  ).map((r) => r.user_id),
);
const toSend = rows.filter((r) => !alreadySent.has(r.id));
const alreadyCount = rows.length - toSend.length;

console.log(`Auth DB:        ${dbPath}`);
console.log(`Audience:       ${audience}`);
console.log(`Email:          ${FILES[audience].html} / ${FILES[audience].text}`);
console.log(`Subject:        ${subject}`);
if (audience === 'registrants') {
  console.log(`Signup window:  last ${cli.days} days`);
  console.log(`Excluded:       ${excludedNudged} already got the verified-never-paid nudge`);
}
console.log(`Cohort size:    ${rows.length}`);
if (alreadyCount > 0) console.log(`Already emailed: ${alreadyCount} (skipped)`);
console.log(`To send:        ${toSend.length}`);

if (toSend.length === 0) {
  console.log(
    rows.length > 0
      ? '\nEveryone in this cohort has already received this update. Nothing to do.'
      : '\nNothing to do.',
  );
  process.exit(0);
}

// Only list the recipients that will actually get an email.
const SAMPLE = 30;
for (const r of toSend.slice(0, SAMPLE)) console.log(`  - ${r.email} (signed up ${r.created_at})`);
if (toSend.length > SAMPLE) console.log(`  ... and ${toSend.length - SAMPLE} more`);

// ---- CSV export ------------------------------------------------------------

if (cli.csvPath) {
  fs.writeFileSync(cli.csvPath, ['email', ...rows.map((r) => r.email)].join('\n') + '\n', 'utf8');
  console.log(`\nWrote ${rows.length} emails to ${cli.csvPath}`);
}

// ---- Load content ----------------------------------------------------------

const html = fs.readFileSync(htmlPath, 'utf8');
const text = fs.readFileSync(textPath, 'utf8');

function buildPayload(to: string, subj: string, unsubUrl: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from: RESEND_FROM_EMAIL,
    to,
    reply_to: REPLY_TO,
    subject: subj,
    html: html.replaceAll('{{UNSUB_URL}}', unsubUrl),
    text: text.replaceAll('{{UNSUB_URL}}', unsubUrl),
  };
  if (cli.listUnsub) {
    // RFC 8058 one-click: the URL must accept a POST with no auth (route does).
    payload.headers = {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }
  return payload;
}

// ---- Preview to a single inbox --------------------------------------------

if (cli.previewTo) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error('\nError: RESEND_API_KEY and RESEND_FROM_EMAIL required for --preview-to.');
    process.exit(1);
  }
  console.log(`\nSending a single preview to ${cli.previewTo}...`);
  // Preview uses a tokenless placeholder unsubscribe URL (real sends get a
  // signed per-recipient link).
  const res = await sendOne(
    RESEND_API_KEY,
    buildPayload(cli.previewTo, `[PREVIEW] ${subject}`, `${APP_URL}/unsubscribe`),
  );
  if (!res.ok) {
    console.error(`Preview failed: ${res.status} ${res.body}`);
    process.exit(1);
  }
  console.log('Preview sent.');
  process.exit(0);
}

// ---- Real send -------------------------------------------------------------

if (cli.send) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error('\nError: RESEND_API_KEY and RESEND_FROM_EMAIL required to send.');
    process.exit(1);
  }
  if (!process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
    console.error('\nError: ZEROGEX_END_USER_TOKEN_SECRET required to sign unsubscribe links.');
    process.exit(1);
  }

  // `toSend` was computed up front (cohort minus already-emailed). Apply --limit.
  const batch = cli.limit ? toSend.slice(0, cli.limit) : toSend;

  console.log(
    `\nWill send to ${batch.length} recipient(s)` +
      (cli.limit && toSend.length > cli.limit
        ? ` (of ${toSend.length} to send; --limit ${cli.limit})`
        : '') +
      `.\nList-Unsubscribe header: ${cli.listUnsub ? 'ON' : 'OFF'}`,
  );

  if (!cli.yes) {
    console.log('\nRefusing to send without --yes. Add --yes to deliver for real.');
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < batch.length; i++) {
    const user = batch[i];
    const res = await sendOne(
      RESEND_API_KEY,
      buildPayload(user.email, subject, buildUnsubUrl(APP_URL, user.id)),
    );
    if (res.ok) {
      const nowIso = new Date().toISOString();
      const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
      // Stamp the audit row as the idempotency source of truth.
      execSqlite(
        dbPath,
        `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
         VALUES ('${esc(auditId)}', '${CAMPAIGN}_sent', '${esc(user.id)}', NULL,
                 '${esc(user.email)}', 'send-product-update',
                 '${esc(`${audience} product update sent`)}', '${esc(nowIso)}');`,
      );
      ok++;
    } else {
      fail++;
      if (fail <= 10) console.error(`  FAIL ${user.email}: ${res.status} ${res.body}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${batch.length} (${ok} ok, ${fail} fail)`);
    if (i < batch.length - 1 && cli.throttleMs > 0) await sleep(cli.throttleMs);
  }

  console.log(`\nDone. ${ok} sent, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

if (!cli.csvPath) {
  console.log(
    '\n[dry-run] Nothing sent. Next: --preview-to <you> to test one, then ' +
      '--send --yes to deliver (add --limit N first for a small test batch).',
  );
}
