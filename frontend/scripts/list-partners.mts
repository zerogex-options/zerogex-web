#!/usr/bin/env node

// Roster of every Creator Partner (partner_tier='creator') in the auth DB.
// This is the "who are my partners" view — distinct from
// list-partner-commissions.mjs, which only shows partners who have already
// earned commission rows. Newly-granted partners with no conversions yet
// appear here but not there.
//
// Read-only. Columns: email, X handle, referral code, audience promo code,
// signups and how many of them are paying, commission %, accrual window,
// Pro-grant expiry, activation date, and the FTC disclosure URL.
//
// With --signups (or --email), each partner's signups are listed underneath:
// every member tied to them in the referrals ledger, whether they came in
// through the partner's link or typed the code at checkout, with where they
// stand now (core/partnerSignups.ts) and what they have paid. `make referrals`
// lists the same people, but its status column tracks the refer-a-friend free
// month, which creators never earn, so it reads 'pending' for all of them.
//
// Options:
//   --email <email>   Filter to one partner, and list their signups
//   --signups         List every partner's signups
//   --help            Show this help

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { partnerSignupStatus } from '../core/partnerSignups.ts';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

type Args = { email: string | null; signups: boolean; help: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { email: null, signups: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' || arg === '-e') args.email = argv[++i]?.toLowerCase() ?? null;
    else if (arg === '--signups') args.signups = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/list-partners.mts [--email <email>] [--signups]

List every Creator Partner (partner_tier='creator') with their X handle,
referral + promo codes, signups and how many pay, commission rate/window,
Pro-grant expiry, and FTC disclosure URL. Read-only. --email filters to one
partner; --signups (or --email) lists each partner's signups underneath.`);
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
  usage();
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

// The partner_* columns land via the app's lazy migration (core/db.ts). If
// they're absent the migration hasn't run against this DB file yet — point at
// the fix rather than throwing a raw "no such column" error.
const userCols = new Set(
  (db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map((c) =>
    String(c.name),
  ),
);
if (!userCols.has('partner_tier')) {
  console.error('No `partner_tier` column found. Run `make migrate` to add the partner columns.');
  process.exit(1);
}
const hasXHandle = userCols.has('x_handle');
const hasTable = (name: string) =>
  !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(name);
const hasReferrals = hasTable('referrals');
const hasCommissions = hasTable('partner_commissions');
// The columns core/subscriberBucket.ts needs. A DB that predates them can still
// show the roster; it just can't say who is paying.
const hasBucketCols = [
  'payment_grace_reason',
  'last_paid_subscription_id',
  'last_paid_invoice_at',
  'subscription_lapsed',
].every((c) => userCols.has(c));

// Select x_handle when the column exists; otherwise alias a NULL so the row
// shape is identical on an un-migrated DB. (Guard against the double-'AS' that
// `<col> AS x_handle` would produce for the NULL branch.)
const xHandleCol = hasXHandle ? 'x_handle' : 'NULL AS x_handle';
let sql = `SELECT id, email, ${xHandleCol},
                  referral_code, partner_audience_promo_code,
                  partner_commission_bps, partner_commission_window_months,
                  partner_pro_grant_expires_at, partner_activated_at,
                  partner_disclosure_url
           FROM users
           WHERE partner_tier = 'creator'`;
if (cliArgs.email) sql += ` AND email = ?`;
sql += ` ORDER BY partner_activated_at IS NULL, partner_activated_at`;

type PartnerRow = {
  id: string;
  email: string;
  x_handle: string | null;
  referral_code: string | null;
  partner_audience_promo_code: string | null;
  partner_commission_bps: number;
  partner_commission_window_months: number;
  partner_pro_grant_expires_at: string | null;
  partner_activated_at: string | null;
  partner_disclosure_url: string | null;
};
const rows = (
  cliArgs.email ? db.prepare(sql).all(cliArgs.email) : db.prepare(sql).all()
) as PartnerRow[];

// Everyone tied to a partner in the referrals ledger, newest first. A row is
// written when someone registers through the partner's link, or when the
// webhook credits the partner for a buyer who typed the code at checkout, so
// both ways in are here. Stated rather than inferred because node:sqlite hands
// back `unknown`.
type SignupRow = {
  referrer_user_id: string;
  referee_user_id: string;
  signed_up_at: string;
  email: string | null;
  deleted_at: string | null;
  tier: string | null;
  subscription_status: string | null;
  payment_grace_reason: string | null;
  cancel_at_period_end: number | null;
  subscription_lapsed: number | null;
  stripe_subscription_id: string | null;
  last_paid_subscription_id: string | null;
  last_paid_invoice_at: string | null;
};
const signupsByPartner = new Map<string, SignupRow[]>();
if (hasReferrals && hasBucketCols) {
  const signupRows = db
    .prepare(
      `SELECT r.referrer_user_id, r.referee_user_id, r.created_at AS signed_up_at,
              u.email, u.deleted_at, u.tier, u.subscription_status, u.payment_grace_reason,
              u.cancel_at_period_end, u.subscription_lapsed, u.stripe_subscription_id,
              u.last_paid_subscription_id, u.last_paid_invoice_at
         FROM referrals r
         JOIN users p ON p.id = r.referrer_user_id AND p.partner_tier = 'creator'
         LEFT JOIN users u ON u.id = r.referee_user_id
        ORDER BY r.created_at DESC`,
    )
    .all() as SignupRow[];
  for (const s of signupRows) {
    const list = signupsByPartner.get(s.referrer_user_id) ?? [];
    list.push(s);
    signupsByPartner.set(s.referrer_user_id, list);
  }
}

// What each member has paid through the partner, and the partner's share, from
// the commission ledger. Reversed rows (refunds, disputes) are left out. It only
// holds invoices inside the commission window, so after a member's first 12
// months their later payments don't show here.
type MoneyRow = {
  partner_user_id: string;
  referee_user_id: string;
  billed: number;
  commission: number;
};
const moneyByPair = new Map<string, MoneyRow>();
if (hasCommissions) {
  const moneyRows = db
    .prepare(
      `SELECT partner_user_id, referee_user_id,
              SUM(billed_amount) AS billed, SUM(commission_amount) AS commission
         FROM partner_commissions
        WHERE status <> 'reversed'
        GROUP BY partner_user_id, referee_user_id`,
    )
    .all() as MoneyRow[];
  for (const m of moneyRows) moneyByPair.set(`${m.partner_user_id}:${m.referee_user_id}`, m);
}

function statusOf(s: SignupRow) {
  return partnerSignupStatus({
    deleted: !s.email || !!s.deleted_at,
    tier: s.tier,
    subscriptionStatus: s.subscription_status,
    paymentGraceReason: s.payment_grace_reason,
    cancelAtPeriodEnd: Number(s.cancel_at_period_end) === 1,
    subscriptionLapsed: Number(s.subscription_lapsed) === 1,
    stripeSubscriptionId: s.stripe_subscription_id,
    lastPaidSubscriptionId: s.last_paid_subscription_id,
    lastPaidInvoiceAt: s.last_paid_invoice_at,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso));
  return m ? m[1] : '—';
}
function formatUsd(cents: number | undefined): string {
  return cents ? `$${(Number(cents) / 100).toFixed(2)}` : '—';
}
function padCell(text: string, w: number): string {
  return String(text) + ' '.repeat(Math.max(0, w - String(text).length));
}
function renderTable(headers: string[], tableRows: string[][], indent = ''): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...(tableRows.length ? tableRows.map((row) => String(row[i]).length) : [0])),
  );
  const renderRow = (cells: string[]) => indent + cells.map((c, i) => padCell(c, widths[i])).join('  ');
  console.log(renderRow(headers));
  console.log(indent + widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of tableRows) console.log(renderRow(row));
}

console.log(`Auth DB: ${dbPath}`);
console.log('');

if (rows.length === 0) {
  console.log(
    cliArgs.email
      ? `No Creator Partner found with email ${cliArgs.email}.`
      : 'No Creator Partners (partner_tier=\'creator\') found.',
  );
  process.exit(0);
}

const countsKnown = hasReferrals && hasBucketCols;
const headers = [
  'Email',
  'X',
  'Referral',
  'Promo',
  'Signups',
  'Paying',
  'Comm%',
  'Window',
  'GrantExpires',
  'Activated',
  'Disclosure',
];
const tableRows = rows.map((r) => {
  const signups = signupsByPartner.get(r.id) ?? [];
  return [
    r.email,
    r.x_handle ? `@${r.x_handle}` : '—',
    r.referral_code ?? '—',
    r.partner_audience_promo_code ?? '—',
    countsKnown ? String(signups.length) : '?',
    countsKnown ? String(signups.filter((s) => statusOf(s).paying).length) : '?',
    `${(Number(r.partner_commission_bps) / 100).toFixed(0)}%`,
    `${r.partner_commission_window_months}mo`,
    formatDate(r.partner_pro_grant_expires_at),
    formatDate(r.partner_activated_at),
    r.partner_disclosure_url ?? '—',
  ];
});
renderTable(headers, tableRows);

console.log('');
console.log(`Total: ${rows.length} Creator Partner(s).`);
if (!hasXHandle) {
  console.log('Note: x_handle column not present in this DB yet — run `make migrate`.');
}
if (!countsKnown) {
  console.log('Note: signups need the referrals ledger and the subscription columns — run `make migrate`.');
}

if (countsKnown && (cliArgs.signups || cliArgs.email)) {
  for (const r of rows) {
    const signups = signupsByPartner.get(r.id) ?? [];
    const label = r.partner_audience_promo_code ? `${r.email} (${r.partner_audience_promo_code})` : r.email;
    console.log('');
    if (signups.length === 0) {
      console.log(`${label}: no signups yet`);
      continue;
    }
    const paying = signups.filter((s) => statusOf(s).paying).length;
    console.log(`${label}: ${signups.length} signup(s), ${paying} paying`);
    renderTable(
      ['Member', 'Signed up', 'Now', 'Paid', 'Commission'],
      signups.map((s) => {
        const money = moneyByPair.get(`${r.id}:${s.referee_user_id}`);
        return [
          s.email ?? `(deleted ${s.referee_user_id.slice(0, 12)})`,
          formatDate(s.signed_up_at),
          statusOf(s).label,
          formatUsd(money?.billed),
          formatUsd(money?.commission),
        ];
      }),
      '  ',
    );
  }
  console.log('');
  console.log("Now: the admin Total Subscribers chart's rule; Full Subscriber = paying right now.");
  console.log("Paid: what the member has paid in the partner's commission window, refunds excluded.");
  console.log('Commission: the partner\'s share of that, owed or already paid out (make partner-commissions).');
} else if (countsKnown) {
  console.log('List each partner\'s signups with: make partners SIGNUPS=1');
}
