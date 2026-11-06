#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/send-product-update.mts \
//     --audience subscribers|registrants|cancelled \
//     [--campaign <id>] [--dry-run] [--preview-to <email>] [--send --yes] \
//     [--limit N] [--days N] [--since <ISO date>] [--subject "..."] \
//     [--throttle-ms N] [--no-list-unsubscribe] [--csv <path>]
//
// One-shot product-update campaign, sent DIRECTLY per-recipient from the server
// via Resend (emails.send). Computes the cohort from the auth DB, sends the
// matching docs/newsletters/*.html + *.txt to each recipient, and stamps an
// audit row so re-runs resume instead of double-sending.
//
// Campaigns are registered in CAMPAIGNS below and selected with --campaign;
// DEFAULT_CAMPAIGN is what a bare invocation sends. Past campaigns stay
// registered so a finished send can still be counted or re-audited.
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
//   registrants  → signed up ≤N days (default 30) or since --since, verified
//                  email, logged in (proxied by authenticated page-view activity
//                  — no last_login column exists), and never subscribed.
//                  Whether this also skips anyone the automated ~2h onboarding
//                  nudge already reached is per-campaign
//                  (CampaignSpec.excludeOnboardingNudged): July did, August does
//                  not, because in steady state that nudge reaches nearly every
//                  signup within hours and excluding them empties the cohort.
//   cancelled    → churned members (subscription_lapsed=1, no live sub, verified,
//                  not self-deleted, not an account core/excludedAccounts.ts
//                  holds out: the admin, a creator partner or a comped member)
//                  who have NOT already had the automated ~1-month win-back
//                  (winback_email_sent_at IS NULL), so nobody gets two win-back
//                  pitches. Mirrors the eligibility in scripts/send-winback.mts
//                  minus its churn-age window, plus the marketing opt-out every
//                  campaign honors.
//
// WIN-BACK COUPON (cancelled only): the email's CTA is /pricing?winback=1, and
// app/api/billing/checkout/route.ts only attaches the coupon when BOTH
// subscription_lapsed=1 AND users.winback_email_sent_at is set. This sender
// therefore stamps winback_email_sent_at on each successful `cancelled` send —
// which is also what stops the weekly automated win-back from double-touching
// the cohort. Because the promise is worthless without the coupon configured,
// the run refuses to start unless STRIPE_COUPON_WINBACK_* is present (override
// with --allow-missing-coupon when the offer is being honored by hand).
//
// EXTENDED TRIAL (registrants, campaigns flagged grantsExtendedTrial): the
// email's CTA is /pricing?trial=1&reactivate=1, and checkout only grants the
// longer REACTIVATION_TRIAL_DAYS trial when users.reactivation_email_sent_at is
// set. This sender therefore stamps that column on each successful send — the
// same discipline as the win-back latch above. Without it the copy promises an
// extended trial the checkout route will not honor, and the daily reactivation
// timer re-pitches the same offer to people who already have it. The flag is
// cross-checked against the template's own CTA before anything is sent, so a
// campaign can neither promise the offer without claiming the latch nor claim
// the latch without promising the offer.
//
// PROMOTION CODE (registrants, campaigns flagged promoCodeOffer): the email
// offers a Stripe promotion code the reader types at checkout, which shows the
// "Add promotion code" box whenever it applies no discount of its own. The code
// is not written into the copy. It is passed with --promo-code, looked up in
// Stripe, and refused unless it is active, limited to first-time customers,
// usable on every plan and has a real deadline at least two days out, or the
// campaign's minOfferLeadHours for a last call (core/promoCodeOffer.ts). The
// rate, the deadline and the four prices are then filled into the template from
// the code itself, so the email can only state what the code grants.
// --preview-to and --send need the code; a dry run without it still counts the
// cohort. A test-mode code is refused for --send, and so is any send while the
// public promo is open, because checkout then applies the promo and Stripe
// hides the code box. For the same reason the cohort leaves out members who
// signed up through a referral, partner or campaign link.
//
// Idempotency: a `<campaign key>_sent` row is written to audit_events on each
// successful send; already-stamped users are skipped on re-run.
//
// Env (from process.env or .env.local): RESEND_API_KEY, RESEND_FROM_EMAIL.
// A promoCodeOffer campaign also reads STRIPE_SECRET_KEY, the four
// STRIPE_PRICE_{BASIC,PRO}_{MONTHLY,ANNUAL} ids and BILLING_TRIAL_PLANS.
// AUTH_DB_PATH overrides the DB. Requires the sqlite3 CLI on PATH.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import Stripe from 'stripe';
import { buildUnsubUrl } from '../core/unsubToken.ts';
import {
  classifyExclusion,
  exclusionCandidateSql,
  type ExclusionCandidate,
  type ExclusionReason,
} from '../core/excludedAccounts.ts';
import { parseTrialPlans } from '../core/billingPlans.ts';
import {
  REQUIRED_OFFER_PLACEHOLDERS,
  buildOfferPlaceholders,
  offerDeadlineMs,
  promoCodeProblems,
  redemptionsLeft,
  type ListPrice,
  type OfferPlanProduct,
  type OfferPromotionCode,
} from '../core/promoCodeOffer.ts';

type Audience = 'subscribers' | 'registrants' | 'cancelled';

type AudienceContent = { subject: string; html: string; text: string };

type CampaignSpec = {
  // Idempotency key; the audit row written per send is `${key}_sent`.
  key: string;
  // Only the audiences this campaign actually has content for.
  content: Partial<Record<Audience, AudienceContent>>;
  // Whether the `registrants` cohort skips anyone the automated ~2h onboarding
  // nudge (scripts/send-verified-never-paid.mts) has already reached.
  //
  // July needed this: the nudge automation was new, the campaign existed to
  // reach the backlog that predated it, and a same-week second touch would
  // have read as a double-send. It is wrong in steady state — that timer fires
  // every 2 hours over a 2h..7d window, so it stamps essentially every verified
  // signup within hours, and excluding them leaves a cohort of near zero (a
  // live run in August returned 2 recipients against 146 skipped). A campaign
  // reporting six weeks of shipped work is not a second copy of the onboarding
  // nudge, and the two are weeks apart, so August keeps them.
  //
  // Per-campaign rather than removed outright so re-running a past campaign
  // still reproduces the cohort it actually sent to.
  excludeOnboardingNudged: boolean;
  // Whether this campaign's `registrants` email PROMISES the extended trial and
  // links to /pricing?trial=1&reactivate=1.
  //
  // If it does, the send must claim users.reactivation_email_sent_at, exactly
  // as the `cancelled` path claims winback_email_sent_at: checkout re-derives
  // the extended trial from that column alone
  // (app/api/billing/checkout/route.ts, reactivationEligible), so without the
  // stamp the email promises a longer trial and Stripe still charges after
  // TRIAL_PERIOD_DAYS. Claiming the latch also stops the daily reactivation
  // timer sending the SAME offer again weeks later — one extended-trial pitch
  // per account, whichever sender gets there first.
  //
  // Per-campaign because it is a property of the copy: July's registrant email
  // pitched a bare /pricing link and named no length, so stamping for it would
  // burn the latch on people who were never made the offer. checkTemplateOffer()
  // below cross-checks this flag against what the template actually links to.
  grantsExtendedTrial: boolean;
  // Whether this campaign's `registrants` email offers a Stripe promotion code,
  // passed at send time with --promo-code. The template carries {{PROMO_CODE}}
  // and the offer placeholders core/promoCodeOffer.ts fills from the code; the
  // sender refuses a template with {{PROMO_CODE}} in a campaign without this
  // flag, and the reverse, the same way grantsExtendedTrial is cross-checked.
  // No latch: the code is the entitlement, and Stripe's first-time-customer
  // restriction on it is what bounds who can redeem it.
  promoCodeOffer?: boolean;
  // Leave out registrants who signed up fewer than this many days ago. They are
  // still inside the onboarding emails at full price, and an offer aimed at the
  // members onboarding did not convert should not reach them first.
  minAccountAgeDays?: number;
  // Only registrants another campaign already reached: its key (the audit row is
  // `${key}_sent`). A reminder goes to the people who got the offer, and the
  // cohort's own filters drop anyone who has subscribed since.
  onlyRecipientsOf?: string;
  // How long the promotion code must still have to run when this email goes
  // out. Default MIN_OFFER_LEAD_HOURS (two days); a last call passes less.
  minOfferLeadHours?: number;
  // Set when the copy no longer matches the live offer. The campaign stays
  // registered so its cohort can still be counted with --dry-run, but a live
  // --send is refused: it would promise terms a new recipient can't get.
  retired?: string;
};

type Args = {
  campaign: string;
  audience: Audience | null;
  dryRun: boolean;
  send: boolean;
  yes: boolean;
  previewTo: string | null;
  csvPath: string | null;
  limit: number | null;
  days: number;
  // Explicit signup-window floor for the registrant cohort (ISO date). Takes
  // precedence over --days, which is a relative fallback.
  since: string | null;
  // Send the `cancelled` audience even when no win-back coupon is configured
  // (i.e. the discount will be honored by hand instead of at checkout).
  allowMissingCoupon: boolean;
  // The Stripe promotion code a promoCodeOffer campaign offers.
  promoCode: string | null;
  subject: string | null;
  throttleMs: number;
  listUnsub: boolean;
  help: boolean;
};

const REPLY_TO = 'Michael@zerogex.io';

// Every product-update campaign, newest last. A finished campaign stays
// registered so its cohort can still be counted or re-audited with --campaign.
const CAMPAIGNS: Record<string, CampaignSpec> = {
  '2026-07': {
    key: 'product_update_2026_07',
    excludeOnboardingNudged: true,
    // Its CTA is a bare /pricing and the copy names no trial length.
    grantsExtendedTrial: false,
    retired:
      'its copy says both Basic and Pro start with a free trial. Since the October 2026 pricing, ' +
      'only Basic monthly has a trial; every other plan has the 7-day money-back guarantee.',
    content: {
      subscribers: {
        subject: "What's new at ZeroGEX — and what's coming next",
        html: '2026-07-product-update.html',
        text: '2026-07-product-update.txt',
      },
      registrants: {
        subject: 'Your ZeroGEX account is ready — start with the free levels',
        html: '2026-07-product-update-registrants.html',
        text: '2026-07-product-update-registrants.txt',
      },
    },
  },
  '2026-08': {
    key: 'product_update_2026_08',
    excludeOnboardingNudged: false,
    // "your extended free trial is still on the table", CTA /pricing?trial=1&reactivate=1.
    grantsExtendedTrial: true,
    content: {
      registrants: {
        subject: "What's new at ZeroGEX since you signed up",
        html: '2026-08-product-update-registrants.html',
        text: '2026-08-product-update-registrants.txt',
      },
      cancelled: {
        subject: "What's changed at ZeroGEX since you left",
        html: '2026-08-product-update-cancelled.html',
        text: '2026-08-product-update-cancelled.txt',
      },
    },
  },
  '2026-10': {
    key: 'product_update_2026_10',
    excludeOnboardingNudged: false,
    // Same offer and CTA as August. The October 2026 pricing still honors the
    // reactivation trial on any plan (docs/pricing-october-2026-runbook.md).
    grantsExtendedTrial: true,
    // No `cancelled` variant. August swept the never-win-backed backlog, so what
    // that cohort holds now is mostly members who left in the last few weeks,
    // and the weekly automated win-back reaches each of them a month after they
    // leave. A campaign would only pitch them the same discount sooner.
    content: {
      subscribers: {
        subject: "What's new at ZeroGEX, and our first Folds of Honor donation",
        html: '2026-10-product-update.html',
        text: '2026-10-product-update.txt',
      },
      registrants: {
        subject: "What's new at ZeroGEX this month",
        html: '2026-10-product-update-registrants.html',
        text: '2026-10-product-update-registrants.txt',
      },
    },
  },
  // A one-feature promo, not a monthly update. Members get "set up your first
  // alert"; free registrants get "part of Basic" with a plain /pricing CTA.
  '2026-10-wall-alerts': {
    key: 'product_update_2026_10_wall_alerts',
    excludeOnboardingNudged: false,
    // The registrants copy names no trial or price and links to a bare /pricing,
    // so the send spends no offer latch.
    grantsExtendedTrial: false,
    // No `cancelled` variant: the automated win-back already carries wall
    // alerts, dated, in content/winback-highlights.json.
    content: {
      subscribers: {
        subject: 'New: get alerted when price hits a call or put wall',
        html: '2026-10-wall-alerts.html',
        text: '2026-10-wall-alerts.txt',
      },
      registrants: {
        subject: 'New at ZeroGEX: alerts when price hits a call or put wall',
        html: '2026-10-wall-alerts-registrants.html',
        text: '2026-10-wall-alerts-registrants.txt',
      },
    },
  },
  // A time-boxed discount for free members who never subscribed, carried by a
  // Stripe promotion code they type at checkout. The copy states no rate, date
  // or price of its own: --promo-code names the code, the sender checks it
  // against Stripe and fills all three in from it (core/promoCodeOffer.ts). The
  // runbook's "Free-member offer" section covers creating the code.
  '2026-11-free-member-offer': {
    key: 'offer_2026_11_free_members',
    excludeOnboardingNudged: false,
    // A bare /pricing CTA. The discount rides the code, not the extended trial.
    grantsExtendedTrial: false,
    promoCodeOffer: true,
    minAccountAgeDays: 7,
    // Only free members: churned and trial-canceled accounts belong to the
    // win-back, which carries its own discount.
    content: {
      registrants: {
        html: '2026-11-free-member-offer-registrants.html',
        text: '2026-11-free-member-offer-registrants.txt',
        subject: '{{OFFER_HEADLINE}}, through {{OFFER_DEADLINE_SHORT}}',
      },
    },
  },
  // The reminder, sent the day the code ends, to the members the offer reached
  // who have not subscribed since. Same --promo-code. A short note, not a
  // second copy of the offer email.
  '2026-11-free-member-offer-last-call': {
    key: 'offer_2026_11_free_members_last_call',
    excludeOnboardingNudged: false,
    grantsExtendedTrial: false,
    promoCodeOffer: true,
    minAccountAgeDays: 7,
    onlyRecipientsOf: 'offer_2026_11_free_members',
    // Sent on the last day, so a few hours of runway is the point. Six keeps a
    // late-evening send from landing after the code has stopped working.
    minOfferLeadHours: 6,
    content: {
      registrants: {
        html: '2026-11-free-member-offer-last-call-registrants.html',
        text: '2026-11-free-member-offer-last-call-registrants.txt',
        subject: 'Ends {{OFFER_DEADLINE_SHORT}}: {{OFFER_HEADLINE}}',
      },
    },
  },
};
// Still the October update, not the wall-alerts promo registered after it: a
// bare invocation keeps sending what the runbook's October commands expect,
// and the promo is always named with --campaign.
const DEFAULT_CAMPAIGN = '2026-10';

// The July send used a 30-day signup window. Later campaigns target only
// registrants who arrived SINCE the previous send, so they pass --since instead.
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
    campaign: DEFAULT_CAMPAIGN,
    audience: null,
    dryRun: false,
    send: false,
    yes: false,
    previewTo: null,
    csvPath: null,
    limit: null,
    days: DEFAULT_DAYS,
    since: null,
    allowMissingCoupon: false,
    promoCode: null,
    subject: null,
    throttleMs: DEFAULT_THROTTLE_MS,
    listUnsub: true,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--audience') {
      const v = argv[++i];
      if (v !== 'subscribers' && v !== 'registrants' && v !== 'cancelled') {
        console.error(`Error: --audience must be "subscribers", "registrants" or "cancelled".`);
        process.exit(1);
      }
      args.audience = v;
    } else if (arg === '--campaign') {
      const v = argv[++i] ?? '';
      if (!Object.prototype.hasOwnProperty.call(CAMPAIGNS, v)) {
        console.error(
          `Error: unknown --campaign "${v}". Known: ${Object.keys(CAMPAIGNS).join(', ')}.`,
        );
        process.exit(1);
      }
      args.campaign = v;
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
    } else if (arg === '--since') {
      const v = argv[++i] ?? '';
      const ts = Date.parse(v);
      if (!Number.isFinite(ts)) {
        console.error('Error: --since expects a parseable date (e.g. 2026-07-20).');
        process.exit(1);
      }
      args.since = new Date(ts).toISOString();
    } else if (arg === '--allow-missing-coupon') args.allowMissingCoupon = true;
    else if (arg === '--promo-code') {
      const v = (argv[++i] ?? '').trim();
      // Stripe promotion codes are letters, digits, dashes and underscores.
      if (!/^[A-Za-z0-9_-]{2,64}$/.test(v)) {
        console.error('Error: --promo-code expects the code as customers type it (e.g. ZGX40).');
        process.exit(1);
      }
      args.promoCode = v;
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
    --audience subscribers|registrants|cancelled \\
    [--campaign <id>] [--dry-run] [--preview-to <email>] [--send --yes] \\
    [--limit N] [--days N] [--since <ISO date>] [--subject "..."] \\
    [--promo-code CODE] [--throttle-ms N] [--no-list-unsubscribe] [--csv <path>]

Sends a product-update campaign directly, per-recipient, via Resend.
Campaigns: ${Object.keys(CAMPAIGNS)
    .map((c) => (c === DEFAULT_CAMPAIGN ? `${c} (default)` : c))
    .join(', ')}

Modes (default is dry-run — counts only, nothing sent):
      --dry-run                 Print cohort count + sample. No send, no writes.
      --preview-to <email>      Send ONE copy to a test inbox. No DB writes.
      --send --yes              Send to the whole cohort (both flags required).
      --limit N                 With --send: only the first N recipients (test batch).
      --csv <path>              Write the cohort emails to a CSV. No send.
      --days N                  Registrant signup window (default ${DEFAULT_DAYS}).
      --since <ISO date>        Registrant signup floor; overrides --days.
      --allow-missing-coupon    Send 'cancelled' with no win-back coupon set.
      --promo-code CODE         The Stripe promotion code an offer campaign
                                offers. Checked against Stripe; the email's
                                rate, deadline and prices come from it.
      --subject "..."           Override the default subject.
      --throttle-ms N           Delay between sends (default ${DEFAULT_THROTTLE_MS}).
      --no-list-unsubscribe     Omit the List-Unsubscribe header (not recommended).
  -h, --help                    Show this help.

Idempotent: successful sends stamp audit_events(type='<campaign key>_sent'); a
re-run skips anyone already stamped, so an interrupted run resumes cleanly.
The 'cancelled' audience additionally stamps users.winback_email_sent_at, which
is what makes the email's /pricing?winback=1 coupon attach at checkout. It
never includes the admin, a creator partner or a comped member (not customers;
core/excludedAccounts.ts), and every run lists the ones it skipped.`);
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

// The live app writes to this database continuously, and the sqlite3 CLI
// defaults to a ZERO busy timeout: any overlap with the app's writer fails
// immediately with "database is locked (5)" rather than waiting. That aborted
// the August cancelled send at recipient 169 of 193 — after the email had gone
// out — and stranded the remaining 24. `.timeout` makes the CLI wait for the
// lock like every other client does. Passed via -cmd so it applies before the
// SQL, and produces no output of its own (unlike a PRAGMA, which would land a
// row in the -json result below).
const SQLITE_BUSY_TIMEOUT_MS = 15_000;

function sqliteArgs(dbPath: string, extra: string[] = []): string[] {
  return ['-cmd', `.timeout ${SQLITE_BUSY_TIMEOUT_MS}`, ...extra, dbPath];
}

function isLockError(message: string): boolean {
  return /database is locked|database table is locked|busy/i.test(message);
}

// Synchronous pause. execSqlite is sync (it runs inside the send loop's
// bookkeeping), so the async sleep() below is unusable here.
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function querySqlite<T = Record<string, unknown>>(dbPath: string, sql: string): T[] {
  try {
    const out = execFileSync('sqlite3', [...sqliteArgs(dbPath, ['-json']), sql], {
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

// Retries on top of the busy timeout: the timeout covers a writer that holds
// the lock briefly, the retries cover a WAL checkpoint or a burst of app writes
// that outlasts it. Anything that is not a lock error fails on the first try —
// a malformed statement will not fix itself.
function execSqlite(dbPath: string, sql: string, attempts = 3): void {
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync('sqlite3', [...sqliteArgs(dbPath), sql], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      return;
    } catch (err) {
      const stderr = (err as { stderr?: Buffer | string }).stderr;
      const message = (
        typeof stderr === 'string' ? stderr : stderr?.toString?.() ?? (err as Error).message
      ).trim();
      if (attempt >= attempts || !isLockError(message)) {
        throw new Error(message || (err as Error).message);
      }
      sleepSync(attempt * 500);
    }
  }
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
const campaignSpec = CAMPAIGNS[cli.campaign]!;
const CAMPAIGN = campaignSpec.key;
if (campaignSpec.retired && cli.send) {
  console.error(`Error: campaign ${cli.campaign} is retired and can't be sent: ${campaignSpec.retired}`);
  console.error('       --dry-run still counts its cohort.');
  process.exit(1);
}
const content = campaignSpec.content[audience];
if (!content) {
  console.error(
    `Error: campaign ${cli.campaign} has no content for audience "${audience}". ` +
      `Available: ${Object.keys(campaignSpec.content).join(', ')}.`,
  );
  process.exit(1);
}

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

// Pre-flight schema check for the latch this run will claim. These columns come
// from the lazy migration in core/db.ts, which only runs when the Next.js app
// boots and first calls getDb(); on a DB where the app has not restarted since
// the column shipped, the UPDATE would fail mid-send — after the email is
// already delivered — leaving a promise with no entitlement behind it. Mirrors
// the guard in scripts/send-reactivation.mts.
{
  const needed =
    audience === 'cancelled'
      ? ['winback_email_sent_at']
      : audience === 'registrants' && campaignSpec.grantsExtendedTrial
        ? ['reactivation_email_sent_at']
        : [];
  if (needed.length > 0) {
    const userCols = new Set(
      querySqlite<{ name: string }>(dbPath, `PRAGMA table_info(users);`).map((c) => c.name),
    );
    const missing = needed.filter((c) => !userCols.has(c));
    if (missing.length > 0) {
      console.error(
        `\nError: auth DB at ${dbPath} is missing column(s): ${missing.join(', ')}.\n` +
          'This send grants an offer that checkout reads from that column, so it cannot\n' +
          'proceed. Start (or restart) the Next.js app once to run the lazy migration in\n' +
          'core/db.ts, then re-run.',
      );
      process.exit(1);
    }
  }
}

const docsDir = path.join(cwd, '..', 'docs', 'newsletters');
const htmlPath = path.join(docsDir, content.html);
const textPath = path.join(docsDir, content.text);
for (const p of [htmlPath, textPath]) {
  if (!fs.existsSync(p)) {
    console.error(`Email file not found: ${p}`);
    process.exit(1);
  }
}
let subject = cli.subject || content.subject;

// ---- Promotion-code offer --------------------------------------------------
//
// Resolved before the cohort so a bad code stops the run before anything else
// happens, and so the subject printed below is the one that will be sent.

function fillPlaceholders(template: string, values: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) out = out.replaceAll(`{{${key}}}`, value);
  return out;
}

function envValue(key: string): string {
  return process.env[key] || envLocal[key] || '';
}

// What the email will say about the offer, and the Stripe facts behind it.
type ResolvedOffer = {
  promo: OfferPromotionCode;
  placeholders: Record<string, string>;
  deadlineMs: number;
  redemptionsLeft: number | null;
};

const STRIPE_API_VERSION = '2025-02-24.acacia';

async function resolvePromoOffer(code: string): Promise<ResolvedOffer> {
  const key = envValue('STRIPE_SECRET_KEY');
  if (!key) {
    console.error('\nError: STRIPE_SECRET_KEY is required to check the promotion code.');
    process.exit(1);
  }
  // While the public promo is open, checkout attaches it to every monthly plan,
  // and Stripe hides the promotion-code box on any checkout that already has a
  // discount. Readers would find no box to type the code into.
  const promoEndMs = Date.parse(envValue('PROMO_END_AT'));
  const publicPromoCoupon =
    envValue('STRIPE_COUPON_PROMO_BASIC_MONTHLY') || envValue('STRIPE_COUPON_PROMO_PRO_MONTHLY');
  if (Number.isFinite(promoEndMs) && promoEndMs > Date.now() && publicPromoCoupon) {
    console.error(
      '\nError: the public promo is open (PROMO_END_AT is in the future), so checkout applies it to\n' +
        'monthly plans and Stripe hides the box for typing a code. Send this after the promo closes.',
    );
    process.exit(1);
  }

  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });

  // Stripe matches `code` case-insensitively. An inactive code can share its
  // text with an active one, so prefer the active match.
  const listed = await stripe.promotionCodes.list({ code, limit: 10 });
  const matches = listed.data.filter((p) => p.code.toLowerCase() === code.toLowerCase());
  const raw = matches.find((p) => p.active) ?? matches[0];
  if (!raw) {
    console.error(
      `\nError: no promotion code "${code}" in this Stripe account ` +
        `(${key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : 'test'} mode). ` +
        'Create it first (runbook: "Free-member offer").',
    );
    process.exit(1);
  }
  // A promotion code carries its coupon, but not the coupon's product limits:
  // applies_to is only returned when asked for.
  const coupon = await stripe.coupons.retrieve(raw.coupon.id, { expand: ['applies_to'] });
  const promo: OfferPromotionCode = {
    id: raw.id,
    code: raw.code,
    active: raw.active,
    livemode: raw.livemode,
    expires_at: raw.expires_at ?? null,
    max_redemptions: raw.max_redemptions ?? null,
    times_redeemed: raw.times_redeemed ?? 0,
    customer: typeof raw.customer === 'string' ? raw.customer : (raw.customer?.id ?? null),
    restrictions: {
      first_time_transaction: raw.restrictions?.first_time_transaction === true,
      minimum_amount: raw.restrictions?.minimum_amount ?? null,
    },
    coupon: {
      id: coupon.id,
      valid: coupon.valid,
      percent_off: coupon.percent_off ?? null,
      amount_off: coupon.amount_off ?? null,
      currency: coupon.currency ?? null,
      duration: coupon.duration,
      duration_in_months: coupon.duration_in_months ?? null,
      redeem_by: coupon.redeem_by ?? null,
      max_redemptions: coupon.max_redemptions ?? null,
      times_redeemed: coupon.times_redeemed ?? 0,
      applies_to: coupon.applies_to ? { products: coupon.applies_to.products ?? [] } : null,
    },
  };

  // The four prices the table quotes, read live, so a list-price change can't
  // leave the email quoting the old one.
  const priceEnv = {
    basicMonthly: 'STRIPE_PRICE_BASIC_MONTHLY',
    proMonthly: 'STRIPE_PRICE_PRO_MONTHLY',
    basicAnnual: 'STRIPE_PRICE_BASIC_ANNUAL',
    proAnnual: 'STRIPE_PRICE_PRO_ANNUAL',
  } as const;
  const planLabel: Record<keyof typeof priceEnv, string> = {
    basicMonthly: 'Basic monthly',
    proMonthly: 'Pro monthly',
    basicAnnual: 'Basic annual',
    proAnnual: 'Pro annual',
  };
  const missingPrices = Object.values(priceEnv).filter((k) => !envValue(k));
  if (missingPrices.length > 0) {
    console.error(`\nError: the price table needs ${missingPrices.join(', ')} in frontend/.env.local.`);
    process.exit(1);
  }
  const productOf = (price: Stripe.Price): string =>
    typeof price.product === 'string' ? price.product : price.product.id;
  const prices = {} as Record<keyof typeof priceEnv, ListPrice>;
  // Every plan "any plan" covers, with the product its price is on, so a
  // coupon limited to products can be checked against all of them.
  const plans: OfferPlanProduct[] = [];
  for (const [slot, envKey] of Object.entries(priceEnv) as Array<[keyof typeof priceEnv, string]>) {
    const price = await stripe.prices.retrieve(envValue(envKey));
    if (typeof price.unit_amount !== 'number' || !price.active) {
      console.error(`\nError: ${envKey} (${price.id}) has no fixed amount or is archived in Stripe.`);
      process.exit(1);
    }
    prices[slot] = { amount: price.unit_amount, currency: price.currency };
    plans.push({ label: planLabel[slot], productId: productOf(price) });
  }
  // Quarterly is sold only once its prices are configured. The email does not
  // price it, but "any plan" includes it, so the code has to work there too.
  for (const [envKey, label] of [
    ['STRIPE_PRICE_BASIC_QUARTERLY', 'Basic quarterly'],
    ['STRIPE_PRICE_PRO_QUARTERLY', 'Pro quarterly'],
  ] as const) {
    if (!envValue(envKey)) continue;
    plans.push({ label, productId: productOf(await stripe.prices.retrieve(envValue(envKey))) });
  }

  const problems = promoCodeProblems(promo, Date.now(), campaignSpec.minOfferLeadHours, plans);
  if (problems.length > 0) {
    console.error(`\nError: promotion code ${promo.code} can't be offered in this email:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  // Production checkout runs on the live key, so a test-mode code would be
  // rejected at the exact moment a reader tries it.
  if (cli.send && !promo.livemode) {
    console.error(
      `\nError: ${promo.code} is a test-mode code. Checkout in production would reject it. ` +
        'Use --preview-to to see the email; send with the live key and a live code.',
    );
    process.exit(1);
  }

  const placeholders = buildOfferPlaceholders({
    promo,
    prices,
    trialPlans: parseTrialPlans(envValue('BILLING_TRIAL_PLANS')),
  });
  return {
    promo,
    placeholders,
    deadlineMs: offerDeadlineMs(promo)!,
    redemptionsLeft: redemptionsLeft(promo),
  };
}

let offer: ResolvedOffer | null = null;
if (campaignSpec.promoCodeOffer) {
  if (!cli.promoCode && (cli.previewTo || cli.send)) {
    console.error(
      `\nError: campaign ${cli.campaign} offers a promotion code. Pass it with --promo-code ` +
        '(a dry run without it only counts the cohort).',
    );
    process.exit(1);
  }
  if (cli.promoCode) {
    offer = await resolvePromoOffer(cli.promoCode);
    subject = fillPlaceholders(subject, offer.placeholders);
  }
} else if (cli.promoCode) {
  console.error(`\nError: campaign ${cli.campaign} doesn't offer a promotion code; drop --promo-code.`);
  process.exit(1);
}

// The cancelled variant promises a discount that only materializes if a
// STRIPE_COUPON_WINBACK_* coupon exists for the plan the member picks — the
// checkout route attaches it, this script only makes them eligible. Sending
// the promise with no coupon configured would be a broken offer, so refuse.
// Mirrors getWinbackCouponId()'s env names in core/stripe.ts.
if (audience === 'cancelled' && !cli.allowMissingCoupon) {
  const couponEnvs = [
    'STRIPE_COUPON_WINBACK_BASIC_MONTHLY',
    'STRIPE_COUPON_WINBACK_BASIC_QUARTERLY',
    'STRIPE_COUPON_WINBACK_BASIC_ANNUAL',
    'STRIPE_COUPON_WINBACK_PRO_MONTHLY',
    'STRIPE_COUPON_WINBACK_PRO_QUARTERLY',
    'STRIPE_COUPON_WINBACK_PRO_ANNUAL',
  ];
  const missing = couponEnvs.filter((k) => !(process.env[k] || envLocal[k]));
  if (missing.length === couponEnvs.length) {
    console.error(
      '\nError: no win-back coupon configured, but the cancelled email promises 25% off.\n' +
        `Set at least one of: ${couponEnvs.join(', ')}\n` +
        'in frontend/.env.local, or pass --allow-missing-coupon if you are honoring\n' +
        'the discount by hand (scripts/honor-winback-discount.mts).',
    );
    process.exit(1);
  }
  if (missing.length > 0) {
    console.warn(`\nWarning: win-back coupon missing for ${missing.join(', ')}.`);
    console.warn('Members who pick one of those plans will not see the discount.\n');
  }
}

// ---- Cohort selection ------------------------------------------------------

type Row = { id: string; email: string; created_at: string };

let rows: Row[];
let excludedNudged = 0;
// Registrants left out for being newer than the campaign's minAccountAgeDays.
let heldBackNew = 0;
// Registrants a promo-code campaign leaves out because checkout would apply
// their referral, partner or campaign discount and hide the code box.
let heldBackReferred = 0;
// Accounts the cohort query matched but that are not customers. Only the
// `cancelled` audience fills this; see below.
const notCustomers: Array<{ row: Row; reason: ExclusionReason }> = [];
if (audience === 'subscribers') {
  rows = querySqlite<Row>(
    dbPath,
    `SELECT id, email, created_at
       FROM users
      WHERE subscription_status IN ('active','trialing')
        AND marketing_unsubscribed_at IS NULL
        AND deleted_at IS NULL
      ORDER BY created_at ASC;`,
  );
} else if (audience === 'cancelled') {
  // Churned members who have NOT already had the automated ~1-month win-back.
  // Deliberately mirrors scripts/send-winback.mts's eligibility (lapsed, no
  // live sub, verified, not self-deleted, never win-backed, not held out)
  // WITHOUT its churn-age window — a campaign sweeps the standing backlog
  // rather than the handful who newly crossed the 30-day line. The marketing
  // opt-out is added on top because this is a campaign, not a transactional
  // nudge. No audit-event join is needed: the winback_email_sent_at latch,
  // not a churn timestamp, is what defines "not yet reached".
  const candidates = querySqlite<Row & ExclusionCandidate>(
    dbPath,
    `SELECT id, email, created_at,
            ${exclusionCandidateSql('users')}
       FROM users
      WHERE COALESCE(subscription_lapsed, 0) = 1
        AND stripe_subscription_id IS NULL
        AND email_verified_at IS NOT NULL
        AND winback_email_sent_at IS NULL
        AND marketing_unsubscribed_at IS NULL
        AND deleted_at IS NULL
      ORDER BY created_at ASC;`,
  );
  // The admin, a creator partner (whose grant never clears subscription_lapsed)
  // and a comped member are not customers, so they get no discount to come
  // back. Held out in code rather than in the WHERE clause so the rule stays
  // the one core/excludedAccounts.ts defines, and so the run can say whom it
  // skipped. They leave the cohort entirely, so --csv omits them too.
  rows = [];
  for (const row of candidates) {
    const reason = classifyExclusion(row);
    if (reason) notCustomers.push({ row, reason });
    else rows.push(row);
  }
} else {
  // --since pins the floor to a date (this campaign: the July send, so only
  // registrants who arrived after it qualify); --days is the relative fallback.
  const sinceIso = cli.since ?? new Date(Date.now() - cli.days * 86_400_000).toISOString();
  const registrantCore = `email_verified_at IS NOT NULL
        AND tier = 'public'
        AND stripe_subscription_id IS NULL
        AND COALESCE(subscription_lapsed, 0) = 0
        AND (subscription_status IS NULL OR subscription_status NOT IN ('active','trialing'))
        AND marketing_unsubscribed_at IS NULL
        AND deleted_at IS NULL
        AND created_at >= '${esc(sinceIso)}'
        AND EXISTS (SELECT 1 FROM page_view_events pv WHERE pv.user_id = u.id)`;
  // A member who signed up through a referral, partner or campaign link gets
  // that link's discount applied by checkout itself, and Stripe hides the
  // promotion-code box whenever checkout applies one. They could not enter the
  // code the email gives them, so a promo-code campaign leaves them out.
  const referredSql = `COALESCE(referred_by_code, '') != ''`;
  // A reminder only reaches members the original offer reached.
  const priorCampaignSql = campaignSpec.onlyRecipientsOf
    ? `
        AND EXISTS (SELECT 1 FROM audit_events pa
                     WHERE pa.user_id = u.id AND pa.type = '${esc(campaignSpec.onlyRecipientsOf)}_sent')`
    : '';
  // Who the campaign is for, before the account-age ceiling below.
  const registrantFilters = campaignSpec.promoCodeOffer
    ? `${registrantCore}
        AND NOT (${referredSql})${priorCampaignSql}`
    : `${registrantCore}${priorCampaignSql}`;
  const newestSignupIso = campaignSpec.minAccountAgeDays
    ? new Date(Date.now() - campaignSpec.minAccountAgeDays * 86_400_000).toISOString()
    : null;
  if (campaignSpec.promoCodeOffer) {
    heldBackReferred =
      querySqlite<{ n: number }>(
        dbPath,
        `SELECT COUNT(*) AS n
           FROM users u
          WHERE ${registrantCore}${priorCampaignSql}
            AND ${referredSql}
            ${newestSignupIso ? `AND created_at <= '${esc(newestSignupIso)}'` : ''};`,
      )[0]?.n ?? 0;
  }
  // Shared by the cohort query and the nudged-count query below, so the two can
  // never drift into reporting on different populations.
  const registrantBase = newestSignupIso
    ? `${registrantFilters}
        AND created_at <= '${esc(newestSignupIso)}'`
    : registrantFilters;
  if (newestSignupIso) {
    heldBackNew =
      querySqlite<{ n: number }>(
        dbPath,
        `SELECT COUNT(*) AS n
           FROM users u
          WHERE ${registrantFilters}
            AND created_at > '${esc(newestSignupIso)}';`,
      )[0]?.n ?? 0;
  }
  rows = querySqlite<Row>(
    dbPath,
    `SELECT id, email, created_at
       FROM users u
      WHERE ${registrantBase}
        ${campaignSpec.excludeOnboardingNudged ? 'AND verified_never_paid_email_sent_at IS NULL' : ''}
      ORDER BY created_at ASC;`,
  );
  // How many of this window already had the ~2h onboarding nudge. When the
  // campaign excludes them it's the size of what we skipped; when it doesn't,
  // it's how much of the cohort is on a second touch. Same population either
  // way, so the number is comparable across campaigns.
  excludedNudged =
    querySqlite<{ n: number }>(
      dbPath,
      `SELECT COUNT(*) AS n
         FROM users u
        WHERE ${registrantBase}
          AND verified_never_paid_email_sent_at IS NOT NULL;`,
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
console.log(`Campaign:       ${cli.campaign} (${CAMPAIGN})`);
console.log(`Audience:       ${audience}`);
console.log(`Email:          ${content.html} / ${content.text}`);
console.log(`Subject:        ${subject}`);
if (audience === 'cancelled') {
  console.log(`Cohort rule:    churned, never win-backed (stamps winback_email_sent_at)`);
}
if (audience === 'registrants') {
  console.log(
    cli.since ? `Signup window:  since ${cli.since}` : `Signup window:  last ${cli.days} days`,
  );
  console.log(
    campaignSpec.excludeOnboardingNudged
      ? `Excluded:       ${excludedNudged} already got the ~2h onboarding nudge`
      : `Second touch:   ${excludedNudged} of these already got the ~2h onboarding nudge`,
  );
  if (campaignSpec.minAccountAgeDays) {
    console.log(
      `Held back:      ${heldBackNew} signed up in the last ${campaignSpec.minAccountAgeDays} days ` +
        '(still in onboarding)',
    );
  }
  if (campaignSpec.promoCodeOffer) {
    console.log(
      `Held back:      ${heldBackReferred} signed up through a referral, partner or campaign link ` +
        '(checkout applies that discount and hides the code box)',
    );
  }
  if (campaignSpec.onlyRecipientsOf) {
    console.log(
      `Reminder of:    ${campaignSpec.onlyRecipientsOf} (only members it reached who still have no plan)`,
    );
  }
  if (campaignSpec.promoCodeOffer) {
    if (offer) {
      const p = offer.placeholders;
      const daysLeft = (offer.deadlineMs - Date.now()) / 86_400_000;
      console.log(`Offer:          code ${p.PROMO_CODE} (${offer.promo.id}, ${offer.promo.livemode ? 'live' : 'TEST'} mode)`);
      console.log(`  Discount:     ${p.OFFER_LABEL}  [coupon ${offer.promo.coupon.id}]`);
      console.log(`  Deadline:     ${p.OFFER_DEADLINE} (${daysLeft.toFixed(1)} days from now)`);
      console.log(`  Redemptions:  ${offer.redemptionsLeft === null ? 'no cap' : `${offer.redemptionsLeft} left`}`);
      console.log(`  Basic monthly ${p.BASIC_MONTHLY_LIST} -> ${p.BASIC_MONTHLY_OFFER}`);
      console.log(`  Pro monthly   ${p.PRO_MONTHLY_LIST} -> ${p.PRO_MONTHLY_OFFER}`);
      console.log(`  Basic annual  ${p.BASIC_ANNUAL_LIST} -> ${p.BASIC_ANNUAL_OFFER}`);
      console.log(`  Pro annual    ${p.PRO_ANNUAL_LIST} -> ${p.PRO_ANNUAL_OFFER}`);
      console.log(`  Plan terms:   ${p.PLAN_TERMS}`);
    } else {
      console.log('Offer:          promotion code, not checked (pass --promo-code to check it and fill the copy)');
    }
  } else {
    console.log(
      campaignSpec.grantsExtendedTrial
        ? `Offer:          extended trial (stamps reactivation_email_sent_at; ` +
            `suppresses the daily reactivation email)`
        : `Offer:          none beyond the standard trial`,
    );
  }
}
console.log(`Cohort size:    ${rows.length}`);
if (alreadyCount > 0) console.log(`Already emailed: ${alreadyCount} (skipped)`);
console.log(`To send:        ${toSend.length}`);
// A cap below the list size means some readers reach checkout after the code
// has run out, and the email does not warn them. Say so before it goes out.
if (offer && offer.redemptionsLeft !== null && offer.redemptionsLeft < toSend.length) {
  console.warn(
    `\nWarning: ${offer.promo.code} can be redeemed ${offer.redemptionsLeft} more time(s) but this run ` +
      `emails ${toSend.length}. The email does not mention a cap, so anyone past it will be told ` +
      'at checkout that the code is invalid. Raise or remove the cap in Stripe unless that is intended.',
  );
}

// Only list the recipients that will actually get an email.
const SAMPLE = 30;
for (const r of toSend.slice(0, SAMPLE)) console.log(`  - ${r.email} (signed up ${r.created_at})`);
if (toSend.length > SAMPLE) console.log(`  ... and ${toSend.length - SAMPLE} more`);

if (notCustomers.length > 0) {
  console.log('\nSkipped, not customers (core/excludedAccounts.ts):');
  for (const { row, reason } of notCustomers) console.log(`  - ${row.email}: ${reason}`);
}

if (toSend.length === 0) {
  console.log(
    rows.length > 0
      ? '\nEveryone in this cohort has already received this update. Nothing to do.'
      : '\nNothing to do.',
  );
  process.exit(0);
}

// ---- CSV export ------------------------------------------------------------

if (cli.csvPath) {
  fs.writeFileSync(cli.csvPath, ['email', ...rows.map((r) => r.email)].join('\n') + '\n', 'utf8');
  console.log(`\nWrote ${rows.length} emails to ${cli.csvPath}`);
}

// ---- Load content ----------------------------------------------------------

// The discount a template promises has to be whatever the configured coupon
// actually grants, and the rate is stated in three places: the Stripe coupon,
// the /pricing welcome-back banner, and the win-back emails. Rather than
// hardcode a percentage into the campaign copy — where it silently rots the
// first time the coupon changes — the cancelled template carries
// {{DISCOUNT_LABEL}} / {{DISCOUNT_SHORT}} and we substitute the SAME
// WINBACK_DISCOUNT_LABEL that scripts/send-winback.mts reads. One value, one
// rate, everywhere.
const DISCOUNT_LABEL =
  process.env.WINBACK_DISCOUNT_LABEL || envLocal.WINBACK_DISCOUNT_LABEL || '';

// Short form for the CTA button and preheader, where the full label reads long:
// the leading "50% off" / "$20 off" when the label starts with one, else a
// rate-free fallback so an unusual label can never render a broken button.
function shortDiscount(label: string): string {
  const m = label.trim().match(/^((?:\d+(?:\.\d+)?\s*%)|(?:[$€£]\s?\d+(?:\.\d+)?))\s*off\b/i);
  return m ? `${m[1].replace(/\s+/g, '')} off` : 'a discount';
}

// Minimal escape: the label is operator-set, not user input, but it lands
// inside markup so a stray & or < would still corrupt the email.
function escapeHtmlText(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

let html = fs.readFileSync(htmlPath, 'utf8');
let text = fs.readFileSync(textPath, 'utf8');

// The copy and the entitlement have to agree, and the only way to be sure is to
// read the template. A campaign promising the extended trial without claiming
// the latch is exactly the August bug: /pricing renders the longer number from
// the URL param while checkout, which reads reactivation_email_sent_at, still
// grants the standard trial — so the member is told 30 days and billed after 7.
// The reverse (claiming the latch with no offer in the copy) silently spends a
// one-shot pitch nobody was made. Refuse both, before a single email goes out.
if (audience === 'registrants') {
  // Matches the raw and the HTML-escaped form, so an entity-encoded href
  // (which is the correct way to write it) still counts as the offer.
  const linksReactivate = /reactivate=1/.test(html) || /reactivate=1/.test(text);
  if (campaignSpec.grantsExtendedTrial && !linksReactivate) {
    console.error(
      `\nError: campaign ${cli.campaign} is flagged grantsExtendedTrial, but neither\n` +
        `${content.html} nor ${content.text} links to /pricing?trial=1&reactivate=1.\n` +
        'Checkout only grants the extended trial for a visitor arriving on that link,\n' +
        'so stamping the latch would spend the offer without ever making it.\n' +
        'Fix the CTA, or set grantsExtendedTrial: false for this campaign.',
    );
    process.exit(1);
  }
  if (!campaignSpec.grantsExtendedTrial && linksReactivate) {
    console.error(
      `\nError: ${content.html} / ${content.text} links to ?reactivate=1, but campaign\n` +
        `${cli.campaign} is not flagged grantsExtendedTrial. Recipients would land on a\n` +
        'pricing page showing the extended trial and then be charged after the standard\n' +
        'one, because checkout reads users.reactivation_email_sent_at and this send\n' +
        'would not set it. Set grantsExtendedTrial: true, or drop ?reactivate=1.',
    );
    process.exit(1);
  }
}

// Same discipline for the promotion code: a template that offers a code belongs
// to a campaign that checks one, and a campaign that checks one has a template
// that states the code, what it gives and until when.
{
  const offersCode = html.includes('{{PROMO_CODE}}') || text.includes('{{PROMO_CODE}}');
  if (offersCode && !campaignSpec.promoCodeOffer) {
    console.error(
      `\nError: ${content.html} / ${content.text} offers a {{PROMO_CODE}}, but campaign\n` +
        `${cli.campaign} is not flagged promoCodeOffer, so nothing would check the code.`,
    );
    process.exit(1);
  }
  if (campaignSpec.promoCodeOffer) {
    const missing = REQUIRED_OFFER_PLACEHOLDERS.filter(
      (k) => !html.includes(`{{${k}}}`) || !text.includes(`{{${k}}}`),
    );
    if (missing.length > 0) {
      console.error(
        `\nError: campaign ${cli.campaign} offers a promotion code, but ${content.html} /\n` +
          `${content.text} do not both carry ${missing.map((k) => `{{${k}}}`).join(', ')}.`,
      );
      process.exit(1);
    }
  }
  if (offer) {
    const escaped = Object.fromEntries(
      Object.entries(offer.placeholders).map(([k, v]) => [k, escapeHtmlText(v)]),
    );
    html = fillPlaceholders(html, escaped);
    text = fillPlaceholders(text, offer.placeholders);
  }
}

const needsDiscountLabel =
  html.includes('{{DISCOUNT_LABEL}}') ||
  html.includes('{{DISCOUNT_SHORT}}') ||
  text.includes('{{DISCOUNT_LABEL}}') ||
  text.includes('{{DISCOUNT_SHORT}}');

if (needsDiscountLabel) {
  // Refuse rather than fall back to a default. A default is exactly the drift
  // this substitution exists to prevent: it would state a rate nobody chose,
  // against a coupon that may grant something else entirely.
  if (!DISCOUNT_LABEL) {
    console.error(
      '\nError: this email states a discount, but WINBACK_DISCOUNT_LABEL is not set.\n' +
        'Set it in frontend/.env.local to match the configured win-back coupon, e.g.\n' +
        '  WINBACK_DISCOUNT_LABEL="50% off your first year"\n' +
        'The same value is read by scripts/send-winback.mts and the /pricing\n' +
        'welcome-back banner, so all three state one rate.',
    );
    process.exit(1);
  }
  html = html
    .replaceAll('{{DISCOUNT_LABEL}}', escapeHtmlText(DISCOUNT_LABEL))
    .replaceAll('{{DISCOUNT_SHORT}}', escapeHtmlText(shortDiscount(DISCOUNT_LABEL)));
  text = text
    .replaceAll('{{DISCOUNT_LABEL}}', DISCOUNT_LABEL)
    .replaceAll('{{DISCOUNT_SHORT}}', shortDiscount(DISCOUNT_LABEL));
  // Echo what the copy will actually claim, so the rate is reviewed rather than
  // assumed — the whole point of routing it through one env value.
  console.log(
    `Discount copy:  "${DISCOUNT_LABEL}"  (button reads "Come back at ${shortDiscount(DISCOUNT_LABEL)}")`,
  );
}

// Last check before anything leaves: every placeholder but the per-recipient
// unsubscribe link has been filled. A literal "{{OFFER_DEADLINE}}" in an inbox
// is the visible failure; the invisible one is a price or a date nobody checked.
// A dry run without --promo-code legitimately leaves the offer unfilled.
if (cli.previewTo || cli.send) {
  const unfilled = [
    ...new Set(
      [...`${subject}\n${html}\n${text}`.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)]
        .map((m) => m[1])
        .filter((k) => k !== 'UNSUB_URL'),
    ),
  ];
  if (unfilled.length > 0) {
    console.error(
      `\nError: the email still has unfilled placeholders: ${unfilled.map((k) => `{{${k}}}`).join(', ')}.`,
    );
    process.exit(1);
  }
}

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
  // Delivered, but whose audit/latch write did not land. Reported at the end.
  const unrecorded: string[] = [];
  for (let i = 0; i < batch.length; i++) {
    const user = batch[i];
    const res = await sendOne(
      RESEND_API_KEY,
      buildPayload(user.email, subject, buildUnsubUrl(APP_URL, user.id)),
    );
    if (res.ok) {
      const nowIso = new Date().toISOString();
      const auditId = `audit_${crypto.randomBytes(12).toString('hex')}`;
      // The cancelled variant IS a win-back, so it claims the same latch the
      // automated sender uses. Two things follow, both intended: the CTA's
      // /pricing?winback=1 coupon becomes attachable for this member (the
      // checkout route requires this column to be set), and the weekly
      // automated win-back will never double-touch them. The Stripe webhook
      // clears it on re-subscribe, so a future re-churn re-qualifies.
      //
      // Both writes go in ONE transaction, so the record of a delivered email
      // is all-or-nothing. Splitting them meant a failure between the two left
      // a member emailed, unlatched and unaudited — re-sent on the next run.
      // One statement is also one lock acquisition instead of two.
      // The registrants variant of a grantsExtendedTrial campaign IS the
      // reactivation offer, so it claims that sender's latch for the same two
      // reasons: checkout requires the column to be set before it will grant
      // the longer trial, and the daily reactivation timer must not pitch the
      // identical offer again a few weeks later. `AND ... IS NULL` so a user
      // the automated sender already reached keeps their original timestamp.
      const latchSql =
        audience === 'cancelled'
          ? `UPDATE users SET winback_email_sent_at = '${esc(nowIso)}'
               WHERE id = '${esc(user.id)}' AND winback_email_sent_at IS NULL;`
          : audience === 'registrants' && campaignSpec.grantsExtendedTrial
            ? `UPDATE users SET reactivation_email_sent_at = '${esc(nowIso)}'
               WHERE id = '${esc(user.id)}' AND reactivation_email_sent_at IS NULL;`
            : '';
      try {
        execSqlite(
          dbPath,
          `BEGIN IMMEDIATE;
           ${latchSql}
           INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
           VALUES ('${esc(auditId)}', '${CAMPAIGN}_sent', '${esc(user.id)}', NULL,
                   '${esc(user.email)}', 'send-product-update',
                   '${esc(`${audience} product update sent`)}', '${esc(nowIso)}');
           COMMIT;`,
        );
        ok++;
      } catch (err) {
        // The email is already delivered; there is no unsending it. Aborting
        // here would strand every remaining recipient to save one bookkeeping
        // row, so record the miss and keep going. These addresses re-qualify on
        // a re-run and would receive a second copy, which is why they are
        // listed at the end for the operator to reconcile.
        unrecorded.push(user.email);
        console.error(`  UNRECORDED ${user.email}: ${(err as Error).message}`);
        ok++;
      }
    } else {
      fail++;
      if (fail <= 10) console.error(`  FAIL ${user.email}: ${res.status} ${res.body}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${batch.length} (${ok} ok, ${fail} fail)`);
    if (i < batch.length - 1 && cli.throttleMs > 0) await sleep(cli.throttleMs);
  }

  console.log(`\nDone. ${ok} sent, ${fail} failed.`);
  if (unrecorded.length > 0) {
    console.error(
      `\n${unrecorded.length} email(s) were DELIVERED but not recorded, so a re-run would ` +
        `send them again. Reconcile before re-running:`,
    );
    for (const email of unrecorded) console.error(`  ${email}`);
  }
  process.exit(fail > 0 || unrecorded.length > 0 ? 1 : 0);
}

if (!cli.csvPath) {
  console.log(
    '\n[dry-run] Nothing sent. Next: --preview-to <you> to test one, then ' +
      '--send --yes to deliver (add --limit N first for a small test batch).',
  );
}
