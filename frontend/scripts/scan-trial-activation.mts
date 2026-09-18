#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/scan-trial-activation.mts
//   node --experimental-strip-types --no-warnings scripts/scan-trial-activation.mts --days 90 --hours 24
//
// Read-only. Answers one question with evidence instead of opinion:
//
//   In their first hours on the platform, what did the people who CONVERTED
//   look at that the people who left during the trial never found?
//
// Why this and not another funnel count. make churn-breakdown says 68% of
// cancels land inside 14 days and the survey's biggest cluster is "wasn't using
// it" + "too complex", with free text saying outright "I don't get most of what
// you're offering and can't figure it out". That is not a content gap — there
// are 37 education pages, a Platform Guide, FAQs and Quick Starts, all in the
// nav. It points at ROUTING: 7 days is not long enough to self-navigate 40+
// tools, and nothing picks a path for a new member. This script tests that by
// comparing what the two outcomes actually did.
//
// The headline is the DIFFERENTIATOR table: for every page, the share of
// converters who saw it in their first window against the share of trial
// leavers. A page high on that list is one that people who stayed found early
// — the shortlist any onboarding should route a new member to, chosen by
// behaviour rather than by whoever built the page.
//
// HONESTY ABOUT SMALL n. The paid book is in the low hundreds, so a gap drawn
// from four people is noise. Raw counts are printed beside every percentage and
// nothing is shown below --min-support (default 4) in BOTH cohorts. Read the
// counts, not the percentages.
//
// This is correlation, not proof: people who were always going to stay may also
// be the people who read more. It tells you where to aim an experiment, not
// what the experiment will conclude.
//
// Admin, partner-grant and comped accounts are held out via
// core/excludedAccounts.ts — the same definition the growth numbers use, so the
// operator's own browsing can't shape the result. Paths are stored already
// normalized to templates by app/api/analytics/page-view/route.ts.
//
// Writes nothing. Calls no external service.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { classifyExclusion } from '../core/excludedAccounts.ts';

type Cohort =
  | 'converted'
  | 'lost_in_trial'
  | 'paid_then_left'
  | 'in_trial_now'
  | 'never_started';

const COHORT_LABEL: Record<Cohort, string> = {
  converted: 'CONVERTED & STAYED',
  lost_in_trial: 'LEFT DURING TRIAL',
  paid_then_left: 'PAID, THEN LEFT',
  in_trial_now: 'IN TRIAL RIGHT NOW',
  // Registered an account and never reached checkout at all. The first run
  // lumped these in with live trials under "STILL DECIDING", which hid the
  // largest group on the page behind a label implying they were mid-decision.
  never_started: 'NEVER STARTED A TRIAL',
};

type Args = {
  days: number;
  hours: number;
  minSupport: number;
  top: number;
  since: string | null;
  until: string | null;
  help: boolean;
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
    days: 60,
    hours: 48,
    minSupport: 4,
    top: 18,
    since: null,
    until: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--days') args.days = Number(argv[(i += 1)]);
    else if (arg === '--hours') args.hours = Number(argv[(i += 1)]);
    else if (arg === '--min-support') args.minSupport = Number(argv[(i += 1)]);
    else if (arg === '--top') args.top = Number(argv[(i += 1)]);
    else if (arg === '--since') args.since = (argv[(i += 1)] ?? '').trim() || null;
    else if (arg === '--until') args.until = (argv[(i += 1)] ?? '').trim() || null;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  if (!Number.isFinite(args.days) || args.days <= 0) args.days = 60;
  // page_view_events is pruned at RETENTION_DAYS (180); asking beyond it would
  // silently report "nobody looked at anything" for the oldest signups.
  args.days = Math.min(args.days, 180);
  if (!Number.isFinite(args.hours) || args.hours <= 0) args.hours = 48;
  if (!Number.isFinite(args.minSupport) || args.minSupport < 1) args.minSupport = 4;
  if (!Number.isFinite(args.top) || args.top < 1) args.top = 18;
  return args;
}

const cliArgs = parseArgs(process.argv.slice(2));

if (cliArgs.help) {
  console.log(`
Usage: scan-trial-activation.mts [--days N] [--hours N] [--min-support N] [--top N]

Compares what converters and trial leavers looked at in their first hours.

  --days N          Signups to include, by age (default 60, max 180 = page-view retention).
  --hours N         The activation window measured after signup (default 48).
  --min-support N   Hide pages seen by fewer than N users in BOTH cohorts (default 4).
  --top N           Rows in the differentiator table (default 18).
  --since DATE      Only signups on/after this date (overrides --days).
  --until DATE      Only signups before this date (overrides --days).

Use --since / --until to compare signup cohorts either side of a change:
  --until 2026-09-18   the members who signed up BEFORE it
  --since 2026-09-18   the members who signed up AFTER it

Read-only. Reads AUTH_DB_PATH from env or .env.local.
`);
  process.exit(0);
}

const cwd = process.cwd();
const envLocal = parseEnvFile(path.join(cwd, '.env.local'));
const dbPath =
  process.env.AUTH_DB_PATH || envLocal.AUTH_DB_PATH || path.join(cwd, 'data', 'auth.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Error: auth DB not found at ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

const sinceIso = cliArgs.since
  ? new Date(cliArgs.since).toISOString()
  : new Date(Date.now() - cliArgs.days * 24 * 60 * 60 * 1000).toISOString();
const untilIso = cliArgs.until ? new Date(cliArgs.until).toISOString() : null;

// A trial runs 7 days, and converting or leaving takes longer still, so a member
// who signed up in the last few weeks has no settled outcome yet.
//
// Judge that per MEMBER, not from the window's end date. A 60-day cohort whose
// window ends today is overwhelmingly mature — only its newest slice is
// undecided — but an end-date test sees "ends today", calls the whole thing
// unsettled and warns on exactly the baseline run the flag exists to produce.
// What actually matters is what SHARE of the cohort is still inside the settling
// period, so that is what gets measured and reported.
const SETTLE_DAYS = 21;
const settleCutoffMs = Date.now() - SETTLE_DAYS * 24 * 60 * 60 * 1000;

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  tier: string | null;
  partner_tier: string | null;
  partner_pro_grant_expires_at: string | null;
  comped: number;
  first_payment_at: string | null;
  subscription_status: string | null;
  cancel_at_period_end: number;
  subscription_lapsed: number;
  stripe_subscription_id: string | null;
  email_verified_at: string | null;
  signup_utm_source: string | null;
};

const users = db
  .prepare(
    `SELECT u.id, u.email, u.created_at, u.tier, u.partner_tier,
            u.partner_pro_grant_expires_at, u.first_payment_at, u.subscription_status,
            u.cancel_at_period_end, u.subscription_lapsed, u.stripe_subscription_id,
            u.email_verified_at, u.signup_utm_source,
            EXISTS(SELECT 1 FROM audit_events a
                    WHERE a.user_id = u.id AND a.type = 'billing_member_comped') AS comped
       FROM users u
      WHERE u.created_at >= ? AND (? IS NULL OR u.created_at < ?) AND u.deleted_at IS NULL`,
  )
  .all(sinceIso, untilIso, untilIso) as unknown as UserRow[];

function cohortOf(u: UserRow): Cohort {
  const gone =
    u.subscription_lapsed === 1 ||
    u.cancel_at_period_end === 1 ||
    ['canceled', 'incomplete_expired', 'unpaid'].includes(u.subscription_status ?? '');
  const paid = u.first_payment_at != null;
  if (gone) return paid ? 'paid_then_left' : 'lost_in_trial';
  if (paid && u.subscription_status === 'active') return 'converted';
  if (u.stripe_subscription_id) return 'in_trial_now';
  return 'never_started';
}

const viewsStmt = db.prepare(
  `SELECT path, duration_ms FROM page_view_events
    WHERE user_id = ? AND created_at >= ? AND created_at < ?`,
);

type Member = {
  cohort: Cohort;
  paths: Set<string>;
  minutes: number;
  /** Signup time, for the settled-outcome share below. */
  createdMs: number;
  verified: boolean;
  source: string;
};

const members: Member[] = [];
let excluded = 0;

for (const u of users) {
  if (classifyExclusion(u)) {
    excluded += 1;
    continue;
  }
  const start = new Date(u.created_at).getTime();
  if (!Number.isFinite(start)) continue;
  const end = new Date(start + cliArgs.hours * 60 * 60 * 1000).toISOString();

  const views = viewsStmt.all(u.id, u.created_at, end) as unknown as Array<{
    path: string;
    duration_ms: number;
  }>;

  const paths = new Set<string>();
  let ms = 0;
  for (const v of views) {
    paths.add(v.path);
    ms += v.duration_ms ?? 0;
  }
  members.push({
    cohort: cohortOf(u),
    paths,
    minutes: ms / 60000,
    createdMs: start,
    verified: u.email_verified_at != null,
    source: u.signup_utm_source || '(direct)',
  });
}

db.close();

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const isExplainer = (p: string) =>
  p.startsWith('/education') || p.startsWith('/guides') || p.startsWith('/help');

const byCohort = (c: Cohort) => members.filter((m) => m.cohort === c);
const converted = byCohort('converted');
const lost = byCohort('lost_in_trial');

console.log(`Auth DB: ${dbPath}`);
// Name the bounds actually in force. `--until` on its own does NOT lift the
// lower bound — `--days` still applies — so calling that "the beginning" claimed
// a full-history cohort while quietly reporting a 60-day one.
const day = (iso: string) => iso.slice(0, 10);
const windowLabel =
  cliArgs.since || cliArgs.until
    ? `${day(sinceIso)} to ${untilIso ? day(untilIso) : 'now'}` +
      (cliArgs.since ? '' : ` (lower bound from --days ${cliArgs.days})`)
    : `the last ${cliArgs.days} days`;
console.log(
  `Cohort:  ${members.length} signups, ${windowLabel} (${excluded} admin/partner/comped held out)`,
);
console.log(`Window:  first ${cliArgs.hours}h after each signup\n`);
const unsettled = members.filter((m) => m.createdMs >= settleCutoffMs).length;
const unsettledShare = members.length ? unsettled / members.length : 0;
if (unsettledShare > 0.2) {
  console.log(
    `NOTE: ${unsettled} of ${members.length} members (${Math.round(unsettledShare * 100)}%) signed up within the last`,
  );
  console.log(
    `      ${SETTLE_DAYS} days, so their outcome has not settled — a 7-day trial plus the time it takes`,
  );
  console.log(
    `      to convert or leave. CONVERTED and LEFT are understated here, IN TRIAL RIGHT NOW inflated.`,
  );
  console.log(`      Wait, or compare only against a cohort of similar maturity.\n`);
}

const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
console.log(
  `${pad('COHORT', 22)}${pad('MEMBERS', 9)}${pad('MED. PAGES', 12)}${pad('MED. MINUTES', 14)}SAW AN EXPLAINER`,
);
console.log('-'.repeat(84));
for (const c of [
  'converted',
  'lost_in_trial',
  'paid_then_left',
  'in_trial_now',
  'never_started',
] as Cohort[]) {
  const group = byCohort(c);
  if (group.length === 0) continue;
  const withExplainer = group.filter((m) => [...m.paths].some(isExplainer)).length;
  const pct = group.length ? Math.round((withExplainer / group.length) * 100) : 0;
  console.log(
    pad(COHORT_LABEL[c], 22) +
      pad(String(group.length), 9) +
      pad(median(group.map((m) => m.paths.size)).toFixed(1), 12) +
      pad(median(group.map((m) => m.minutes)).toFixed(1), 14) +
      `${withExplainer}/${group.length} (${pct}%)`,
  );
}

// The largest cohort deserves a second look before anyone spends a week on it.
// "Registered and never reached checkout" reads as a funnel leak, but at a median
// of one page and half a minute it could as easily be addresses that were never
// confirmed — an incomplete or junk registration is not a prospect who bounced,
// and the two want opposite responses. Verification status and signup source
// separate them.
const neverStarted = byCohort('never_started');
if (neverStarted.length > 0) {
  const verified = neverStarted.filter((m) => m.verified).length;
  const oneAndDone = neverStarted.filter((m) => m.paths.size <= 1).length;
  const verifiedOneAndDone = neverStarted.filter((m) => m.verified && m.paths.size <= 1).length;
  const bySource = new Map<string, number>();
  for (const m of neverStarted) bySource.set(m.source, (bySource.get(m.source) ?? 0) + 1);
  const topSources = [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([src, n]) => `${src} ${n}`)
    .join('  ·  ');
  const share = (n: number) => `${n}/${neverStarted.length} (${Math.round((n / neverStarted.length) * 100)}%)`;

  console.log(`\n\nNEVER STARTED A TRIAL — who are these ${neverStarted.length}?`);
  console.log('-'.repeat(84));
  console.log(`${pad('Confirmed their email address', 38)}${share(verified)}`);
  console.log(`${pad('Never confirmed it', 38)}${share(neverStarted.length - verified)}`);
  console.log(`${pad('Opened one page or none', 38)}${share(oneAndDone)}`);
  console.log(`${pad('Confirmed AND still one-page', 38)}${share(verifiedOneAndDone)}`);
  console.log(`${pad('Signup source', 38)}${topSources}`);
  console.log(
    `\n  Confirmed an address and then stopped anyway is the real leak — those people meant it.`,
  );
  console.log(
    `  Never-confirmed is a registration that did not finish, which is a different problem and`,
  );
  console.log(`  sometimes not a problem at all.\n`);
}

if (converted.length < cliArgs.minSupport || lost.length < cliArgs.minSupport) {
  console.log(
    `\nToo few members in one of the two compared cohorts to draw a page-by-page comparison.`,
  );
  console.log(`Widen the window with --days, or lower --min-support if you accept the noise.`);
  process.exit(0);
}

const allPaths = new Set<string>();
for (const m of [...converted, ...lost]) for (const p of m.paths) allPaths.add(p);

type Diff = { path: string; cN: number; lN: number; cPct: number; lPct: number; gap: number };
const diffs: Diff[] = [];
for (const p of allPaths) {
  const cN = converted.filter((m) => m.paths.has(p)).length;
  const lN = lost.filter((m) => m.paths.has(p)).length;
  // Support in EITHER cohort is enough to be worth printing: a page every
  // converter saw and no leaver did is the most interesting row on the table,
  // and requiring support in both would drop exactly that shape.
  if (cN < cliArgs.minSupport && lN < cliArgs.minSupport) continue;
  const cPct = (cN / converted.length) * 100;
  const lPct = (lN / lost.length) * 100;
  diffs.push({ path: p, cN, lN, cPct, lPct, gap: cPct - lPct });
}

diffs.sort((a, b) => b.gap - a.gap);

console.log(`\n\nWHAT CONVERTERS FOUND AND LEAVERS DIDN'T (first ${cliArgs.hours}h)`);
console.log('-'.repeat(84));
console.log(
  `${pad('PAGE', 44)}${pad('CONVERTED', 14)}${pad('LEFT', 14)}GAP`,
);
for (const d of diffs.slice(0, cliArgs.top)) {
  console.log(
    pad(d.path, 44) +
      pad(`${d.cN}/${converted.length} (${Math.round(d.cPct)}%)`, 14) +
      pad(`${d.lN}/${lost.length} (${Math.round(d.lPct)}%)`, 14) +
      `${d.gap > 0 ? '+' : ''}${Math.round(d.gap)}pt`,
  );
}

// THE CONTROL. A page that converters reached more often is only interesting if
// they reached it more often than their extra browsing alone explains. Converters
// open more pages and stay longer than leavers, so EVERY page inherits a positive
// gap from that difference and the raw table above can rank pages by nothing but
// total usage. Comparing only the members of each cohort who browsed at least as
// much as the pooled median removes that: a gap that survives is about the page,
// a gap that collapses was volume all along.
const pooledMedianPages = median([...converted, ...lost].map((m) => m.paths.size));
const cMatched = converted.filter((m) => m.paths.size >= pooledMedianPages);
const lMatched = lost.filter((m) => m.paths.size >= pooledMedianPages);

function medianGap(list: Array<{ gap: number }>): number {
  return median(list.map((d) => d.gap));
}

if (cMatched.length >= cliArgs.minSupport && lMatched.length >= cliArgs.minSupport) {
  const matched: Diff[] = [];
  for (const p of allPaths) {
    const cN = cMatched.filter((m) => m.paths.has(p)).length;
    const lN = lMatched.filter((m) => m.paths.has(p)).length;
    if (cN < cliArgs.minSupport && lN < cliArgs.minSupport) continue;
    const cPct = (cN / cMatched.length) * 100;
    const lPct = (lN / lMatched.length) * 100;
    matched.push({ path: p, cN, lN, cPct, lPct, gap: cPct - lPct });
  }
  matched.sort((a, b) => b.gap - a.gap);

  console.log(
    `\n\nSAME COMPARISON, ENGAGEMENT MATCHED (both cohorts limited to members who`,
  );
  console.log(
    `opened >= ${pooledMedianPages} pages: ${cMatched.length} converted, ${lMatched.length} left)`,
  );
  console.log('-'.repeat(84));
  console.log(`${pad('PAGE', 44)}${pad('CONVERTED', 14)}${pad('LEFT', 14)}GAP`);
  for (const d of matched.slice(0, 10)) {
    console.log(
      pad(d.path, 44) +
        pad(`${d.cN}/${cMatched.length} (${Math.round(d.cPct)}%)`, 14) +
        pad(`${d.lN}/${lMatched.length} (${Math.round(d.lPct)}%)`, 14) +
        `${d.gap > 0 ? '+' : ''}${Math.round(d.gap)}pt`,
    );
  }
  const rawMed = medianGap(diffs);
  const matchedMed = medianGap(matched);
  console.log(
    `\n  Median gap across every page — raw: ${rawMed > 0 ? '+' : ''}${rawMed.toFixed(1)}pt  ·  ` +
      `engagement-matched: ${matchedMed > 0 ? '+' : ''}${matchedMed.toFixed(1)}pt`,
  );
  console.log(
    `  A raw median well above zero means the untouched table is ranking pages by how much`,
  );
  console.log(
    `  each cohort browsed overall. Read the matched table, and only a page that stays well`,
  );
  console.log(`  clear of the matched median is a real discovery difference.`);
}

const reverse = diffs.filter((d) => d.gap < 0).slice(-6).reverse();
if (reverse.length) {
  console.log(`\nSeen MORE by the people who left:`);
  for (const d of reverse) {
    console.log(
      '  ' +
        pad(d.path, 42) +
        pad(`${d.cN}/${converted.length}`, 10) +
        pad(`${d.lN}/${lost.length}`, 10) +
        `${Math.round(d.gap)}pt`,
    );
  }
}

console.log(`\nRead:`);
console.log(
  `  • The top rows are the shortlist. They are the pages people who stayed reached in their`,
);
console.log(
  `    first ${cliArgs.hours}h — candidates for a first-run path, chosen by what worked rather than by`,
);
console.log(`    whoever built the page.`);
console.log(
  `  • Compare the two SAW AN EXPLAINER figures. A wide gap says the 37 education pages are`,
);
console.log(`    reaching the wrong half of the funnel, which is a routing fix, not a writing one.`);
console.log(
  `  • Correlation only, on a small book: people who would have stayed anyway may simply read`,
);
console.log(`    more. Treat the shortlist as where to aim an experiment, not as its result.`);
