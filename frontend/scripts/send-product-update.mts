#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-product-update.mts \
//     --audience subscribers|registrants \
//     [--dry-run] [--csv <path>] [--sync-to-audience <resendAudienceId>] \
//     [--preview-to <email>] [--days N] [--subject "..."]
//
// One-shot July 2026 product-update broadcast. Computes a recipient cohort from
// the auth DB and helps you deliver it through **Resend Broadcasts** (the emails
// use the {{{RESEND_UNSUBSCRIBE_URL}}} merge tag, which only Broadcasts resolve;
// Broadcasts also manage the unsubscribe/suppression list for CAN-SPAM).
//
// THIS SCRIPT NEVER SENDS THE BROADCAST. It (a) previews the cohort, (b) can
// write a CSV, (c) can sync the cohort into a Resend Audience, and (d) can send
// a single --preview-to test. You then create the Broadcast in Resend from the
// matching docs/newsletters/*.html + *.txt, review it, and click Send. That
// human review is the intended gate on a mass, irreversible send.
//
// Audiences:
//   subscribers  → active + trialing customers.
//                  WHERE subscription_status IN ('active','trialing')
//                  File: docs/newsletters/2026-07-product-update.html / .txt
//                  Subject: "What's new at ZeroGEX — and what's coming next"
//
//   registrants  → signed up in the last N days (default 30), verified their
//                  email, logged in (proxied by authenticated page-view
//                  activity — there is no last_login column), and never
//                  subscribed. Mirrors the send-verified-never-paid cohort plus
//                  the "logged in" + 30-day filters.
//                  WHERE email_verified_at IS NOT NULL
//                    AND tier = 'public'
//                    AND stripe_subscription_id IS NULL
//                    AND COALESCE(subscription_lapsed,0) = 0
//                    AND subscription_status NOT IN ('active','trialing') (or NULL)
//                    AND created_at >= now - N days
//                    AND EXISTS (page_view_events with this user_id)
//                  File: docs/newsletters/2026-07-product-update-registrants.html / .txt
//                  Subject: "Your ZeroGEX account is ready — start with the free levels"
//
// NOTE ON OVERLAP: the registrant cohort overlaps the automated
// send-verified-never-paid trial nudge. This script does NOT auto-exclude them,
// but the dry run reports how many already received that email so you can decide
// whether to double-touch.
//
// Reads RESEND_API_KEY, RESEND_FROM_EMAIL from env or .env.local (only needed
// for --preview-to and --sync-to-audience). Set AUTH_DB_PATH to override the DB.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

type Audience = 'subscribers' | 'registrants';

type Args = {
  audience: Audience | null;
  dryRun: boolean;
  csvPath: string | null;
  syncAudienceId: string | null;
  previewTo: string | null;
  days: number;
  subject: string | null;
  help: boolean;
};

const SUBJECTS: Record<Audience, string> = {
  subscribers: "What's new at ZeroGEX — and what's coming next",
  registrants: 'Your ZeroGEX account is ready — start with the free levels',
};

const FILES: Record<Audience, { html: string; text: string }> = {
  subscribers: {
    html: '2026-07-product-update.html',
    text: '2026-07-product-update.txt',
  },
  registrants: {
    html: '2026-07-product-update-registrants.html',
    text: '2026-07-product-update-registrants.txt',
  },
};

const DEFAULT_DAYS = 30;

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
    csvPath: null,
    syncAudienceId: null,
    previewTo: null,
    days: DEFAULT_DAYS,
    subject: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--audience') {
      const v = argv[++i];
      if (v !== 'subscribers' && v !== 'registrants') {
        console.error(`Error: --audience must be "subscribers" or "registrants", got "${v}".`);
        process.exit(1);
      }
      args.audience = v;
    } else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--csv') args.csvPath = argv[++i] ?? null;
    else if (arg === '--sync-to-audience') args.syncAudienceId = argv[++i] ?? null;
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--days') {
      const v = Number(argv[++i] ?? '');
      if (!Number.isFinite(v) || v <= 0) {
        console.error(`Error: --days expects a positive number.`);
        process.exit(1);
      }
      args.days = v;
    } else if (arg === '--subject') args.subject = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/send-product-update.mts \\
    --audience subscribers|registrants \\
    [--dry-run] [--csv <path>] [--sync-to-audience <resendAudienceId>] \\
    [--preview-to <email>] [--days N] [--subject "..."]

Computes the recipient cohort and helps deliver the July 2026 product update via
Resend Broadcasts. NEVER sends the broadcast itself — you review + send in Resend.

Modes (default is dry-run):
      --dry-run                    Print the cohort count + a sample. No writes.
      --csv <path>                 Write the cohort emails to a CSV for Resend
                                   Audience import (one 'email' column).
      --sync-to-audience <id>      Add the cohort as contacts to an existing
                                   Resend Audience (needs RESEND_API_KEY).
      --preview-to <email>         Send ONE rendered copy to a test inbox
                                   (needs RESEND_API_KEY + RESEND_FROM_EMAIL).
      --days N                     Registrant signup window (default ${DEFAULT_DAYS}).
      --subject "..."              Override the default subject.
  -h, --help                       Show this help.`);
}

function ensureSqlite3Cli() {
  const probe = spawnSync('sqlite3', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: sqlite3 CLI not found on PATH (sudo apt-get install sqlite3).');
    process.exit(1);
  }
}

function esc(value: string): string {
  return value.replace(/'/g, "''");
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

async function resendPost(apiKey: string, endpoint: string, body: unknown): Promise<Response> {
  return fetch(`https://api.resend.com${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
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

const dbPath = process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Auth DB not found at: ${dbPath}. Set AUTH_DB_PATH.`);
  process.exit(1);
}
ensureSqlite3Cli();

// Resolve email content (repo-root docs/, one level up from frontend/).
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
        AND created_at >= '${esc(sinceIso)}'
        AND EXISTS (SELECT 1 FROM page_view_events pv WHERE pv.user_id = u.id)
      ORDER BY created_at ASC;`,
  );
  // No double-touch: how many otherwise-eligible registrants we skipped because
  // the automated verified-never-paid trial nudge already reached them.
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

console.log(`Auth DB:        ${dbPath}`);
console.log(`Audience:       ${audience}`);
console.log(`Email:          ${FILES[audience].html} / ${FILES[audience].text}`);
console.log(`Subject:        ${subject}`);
if (audience === 'registrants') console.log(`Signup window:  last ${cli.days} days`);
console.log(`Recipients:     ${rows.length}`);

if (audience === 'registrants') {
  console.log(
    `Excluded:       ${excludedNudged} already got the automated ` +
      `"verified-never-paid" nudge (no double-touch)`,
  );
}

for (const r of rows.slice(0, 10)) console.log(`  - ${r.email} (signed up ${r.created_at})`);
if (rows.length > 10) console.log(`  ... and ${rows.length - 10} more`);

if (rows.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

// ---- CSV export ------------------------------------------------------------

if (cli.csvPath) {
  const csv = ['email', ...rows.map((r) => r.email)].join('\n') + '\n';
  fs.writeFileSync(cli.csvPath, csv, 'utf8');
  console.log(`\nWrote ${rows.length} emails to ${cli.csvPath}`);
}

// ---- Preview to a single test inbox ---------------------------------------

if (cli.previewTo) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error('\nError: RESEND_API_KEY and RESEND_FROM_EMAIL required for --preview-to.');
    process.exit(1);
  }
  // The {{{RESEND_UNSUBSCRIBE_URL}}} tag only resolves inside a Broadcast; for a
  // one-off preview via /emails, point it somewhere harmless so it isn't literal.
  const html = fs.readFileSync(htmlPath, 'utf8').replaceAll('{{{RESEND_UNSUBSCRIBE_URL}}}', 'https://zerogex.io/account');
  const text = fs.readFileSync(textPath, 'utf8').replaceAll('{{{RESEND_UNSUBSCRIBE_URL}}}', 'https://zerogex.io/account');
  console.log(`\nSending a single preview to ${cli.previewTo}...`);
  const res = await resendPost(RESEND_API_KEY, '/emails', {
    from: RESEND_FROM_EMAIL,
    to: cli.previewTo,
    reply_to: 'Michael@zerogex.io',
    subject: `[PREVIEW] ${subject}`,
    html,
    text,
  });
  if (!res.ok) {
    console.error(`Preview failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log('Preview sent.');
}

// ---- Sync contacts into a Resend Audience ---------------------------------

if (cli.syncAudienceId) {
  if (!RESEND_API_KEY) {
    console.error('\nError: RESEND_API_KEY required for --sync-to-audience.');
    process.exit(1);
  }
  console.log(`\nSyncing ${rows.length} contacts into Resend audience ${cli.syncAudienceId}...`);
  let added = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of rows) {
    const res = await resendPost(RESEND_API_KEY, `/audiences/${cli.syncAudienceId}/contacts`, {
      email: r.email,
      unsubscribed: false,
    });
    if (res.ok) added++;
    else if (res.status === 409 || res.status === 422) skipped++; // already present
    else {
      failed++;
      if (failed <= 5) console.error(`  FAIL ${r.email}: ${res.status} ${await res.text()}`);
    }
  }
  console.log(`Done. ${added} added, ${skipped} already present, ${failed} failed.`);
}

if (!cli.csvPath && !cli.previewTo && !cli.syncAudienceId) {
  console.log(
    '\n[dry-run] Nothing written. Next: --preview-to <you> to test, then --csv or ' +
      '--sync-to-audience to stage the cohort, then create + send the Broadcast in Resend.',
  );
}
