#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/send-pro-interest-email.mts \
//     [--dry-run | --yes | --preview-to <email>] [--days N] [--exclude a@x.com,b@y.com]
//
// The Pro interest email (core/proInterest.ts): a founder note to Basic members
// who tried to open a Pro page in the last N days (14 by default), saying what
// Pro adds and exactly what switching would mean for each of them today, in the
// same terms the locked Pro screen shows (core/proWall.ts). Sent by hand with
// `make pro-interest-email`, never on a timer.
//
//   --dry-run            list who gets which version, and who is left out and
//                        why; send nothing, write nothing (the default)
//   --yes                send, at most once per member, ever
//   --preview-to <addr>  send one sample of each version to <addr>; no DB writes
//   --days N             how far back to look for locked-screen visits
//   --exclude a,b        leave these addresses out
//
// Side effects on send: the email, users.pro_interest_email_sent_at (claimed
// BEFORE sending so a crash mid-run cannot send twice, released if the send
// fails), and a pro_interest_email_sent audit row.

import { randomBytes } from 'node:crypto';
import { loadEnvLocal, warnIfPricesUnconfigured } from './env-local.mts';

type Args = {
  dryRun: boolean;
  yes: boolean;
  previewTo: string | null;
  days: number | null;
  exclude: string | null;
  help: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, yes: false, previewTo: null, days: null, exclude: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
    else if (arg === '--days') args.days = Number(argv[++i]);
    else if (arg === '--exclude') args.exclude = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else {
      console.error(`Error: unknown argument "${arg}".`);
      process.exit(1);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Usage:
  node --experimental-strip-types --no-warnings scripts/send-pro-interest-email.mts \\
    [--dry-run | --yes | --preview-to <email>] [--days N] [--exclude a@x.com,b@y.com]

  --dry-run            list who gets which version and who is left out; send nothing (the default)
  --yes                send, at most once per member
  --preview-to <addr>  send one sample of each version to <addr>; no DB writes
  --days N             how far back to look for locked-screen visits (default 14)
  --exclude a,b        leave these addresses out`);
  process.exit(0);
}
if ([args.dryRun, args.yes, !!args.previewTo].filter(Boolean).length > 1) {
  console.error('Error: --dry-run, --yes and --preview-to are mutually exclusive.');
  process.exit(1);
}
if (args.days !== null && (!Number.isInteger(args.days) || args.days < 1 || args.days > 180)) {
  console.error('Error: --days must be a whole number from 1 to 180 (page visits are kept 180 days).');
  process.exit(1);
}

loadEnvLocal();
warnIfPricesUnconfigured();

// Checked before anything is claimed, so a missing setting stops the run
// instead of failing every member one by one.
const missing = [
  ...(args.yes || args.previewTo ? ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'] : []),
  // Signs each member's unsubscribe link.
  ...(args.yes ? ['ZEROGEX_END_USER_TOKEN_SECRET'] : []),
].filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Error: ${missing.join(', ')} must be set (frontend/.env.local) to send.`);
  process.exit(1);
}

const { buildProInterestEmail, sendProInterestEmail } = await import('../core/mailer.ts');
const { PRO_FEATURES, proWallCopy, proWallTerms } = await import('../core/proWall.ts');
const { PRO_INTEREST_DEFAULT_DAYS, describeProInterestTerms, parseExcludedEmails, proInterestSkipReason } =
  await import('../core/proInterest.ts');
const { proSwitchPath } = await import('../core/trialProUpgrade.ts');
const { getAppUrl, priceIdToSku } = await import('../core/stripe.ts');
const { buildUnsubUrl } = await import('../core/unsubToken.ts');

type Terms = ReturnType<typeof proWallTerms>;

const appUrl = getAppUrl();
const days = args.days ?? PRO_INTEREST_DEFAULT_DAYS;
// Through /login, which forwards a signed-in member straight on and brings a
// signed-out one back after they sign in: the pricing page only opens the
// switch for a member it knows.
const switchUrl = `${appUrl}/login?next=${encodeURIComponent(proSwitchPath('pro_interest'))}`;
const annualUrl = `${appUrl}/login?next=${encodeURIComponent('/pricing?plan=pro&cadence=annual&from=pro_interest')}`;

function emailFor(terms: Terms, unsubUrl: string) {
  const copy = proWallCopy(terms);
  return {
    priceLine: copy.priceLine,
    termsLine: copy.termsLine,
    annualLine: copy.annual?.line ?? null,
    features: PRO_FEATURES,
    switchUrl,
    annualUrl,
    unsubUrl,
  };
}

if (args.previewTo) {
  const nowMs = Date.now();
  const hours = (h: number) => new Date(nowMs + h * 3_600_000).toISOString();
  const basicMonthly = { tier: 'basic', cadence: 'monthly' } as const;
  const samples: Array<[string, Terms]> = [
    ['trial, last two days', proWallTerms({ status: 'trialing', current: basicMonthly, periodEndIso: hours(30), guaranteeUsed: false, nowMs })],
    ['trial, earlier', proWallTerms({ status: 'trialing', current: basicMonthly, periodEndIso: hours(120), guaranteeUsed: false, nowMs })],
    ['paying Basic', proWallTerms({ status: 'active', current: basicMonthly, periodEndIso: hours(400), guaranteeUsed: false, nowMs })],
  ];
  for (const [label, terms] of samples) {
    const opts = emailFor(terms, `${appUrl}/unsubscribe?u=preview&t=preview`);
    await sendProInterestEmail(args.previewTo, opts);
    console.log(`Sent the "${label}" sample to ${args.previewTo}.`);
  }
  console.log('\nThe "trial, last two days" version reads:\n');
  console.log(buildProInterestEmail(emailFor(samples[0][1], `${appUrl}/unsubscribe?u=preview&t=preview`)).text);
  process.exit(0);
}

const { getDb } = await import('../core/db.ts');
const { hasPriorMoneyBackRefund } = await import('../core/moneyBackServer.ts');

type Row = {
  id: string;
  email: string;
  tier: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number | null;
  paused_until: string | null;
  marketing_unsubscribed_at: string | null;
  pro_interest_email_sent_at: string | null;
  visits: number;
  last_visit: string;
};

const db = getDb();
const nowMs = Date.now();
const sinceIso = new Date(nowMs - days * 86_400_000).toISOString();
// Every Basic member's visits to the locked Pro screen. Tier at the visit, so
// a member who has since upgraded shows up in the dry run as not_basic rather
// than vanishing without a word.
const rows = db
  .prepare(
    `SELECT u.id, u.email, u.tier, u.stripe_subscription_id, u.stripe_price_id, u.subscription_status,
            u.current_period_end, u.cancel_at_period_end, u.paused_until, u.marketing_unsubscribed_at,
            u.pro_interest_email_sent_at,
            COUNT(*) AS visits, MAX(p.created_at) AS last_visit
       FROM page_view_events p
       JOIN users u ON u.id = p.user_id
      WHERE p.path = '/unauthorized'
        AND p.tier = 'basic'
        AND p.created_at >= ?
        AND u.deleted_at IS NULL
      GROUP BY u.id
      ORDER BY visits DESC, last_visit DESC`,
  )
  .all(sinceIso) as Row[];

const excluded = parseExcludedEmails(args.exclude);
const send: Array<{ row: Row; terms: Terms }> = [];
const skipped: Array<{ row: Row; reason: string }> = [];
for (const row of rows) {
  const reason = proInterestSkipReason(
    {
      email: row.email,
      tier: row.tier,
      stripeSubscriptionId: row.stripe_subscription_id,
      subscriptionStatus: row.subscription_status,
      cancelAtPeriodEnd: Number(row.cancel_at_period_end) === 1,
      paused: row.paused_until != null,
      marketingUnsubscribed: row.marketing_unsubscribed_at != null,
      sentAt: row.pro_interest_email_sent_at,
    },
    excluded,
  );
  if (reason) {
    skipped.push({ row, reason });
    continue;
  }
  const terms = proWallTerms({
    status: row.subscription_status,
    current: row.stripe_price_id ? priceIdToSku(row.stripe_price_id) : null,
    periodEndIso: row.current_period_end,
    guaranteeUsed: hasPriorMoneyBackRefund({ userId: row.id, email: row.email, cardFingerprint: null, subscriptionId: '' }),
    nowMs,
  });
  send.push({ row, terms });
}

const visitsLabel = (row: Row) => `${row.visits} visit${row.visits === 1 ? '' : 's'}, last ${row.last_visit.slice(0, 16).replace('T', ' ')} UTC`;
console.log(`Auth DB:   ${process.env.AUTH_DB_PATH ?? 'data/auth.db (AUTH_DB_PATH unset)'}`);
console.log(`Lookback:  ${days} days (since ${sinceIso})`);
console.log(`\nWill send (${send.length}):`);
for (const { row, terms } of send) console.log(`  • ${row.email}  (${visitsLabel(row)})\n      ${describeProInterestTerms(terms)}`);
console.log(`\nLeft out (${skipped.length}):`);
for (const { row, reason } of skipped) console.log(`  • ${row.email}  ${reason}  (${visitsLabel(row)})`);

if (!args.yes) {
  console.log('\n[dry run] Nothing sent. Re-run with YES=1 to send.');
  process.exit(0);
}
if (send.length === 0) process.exit(0);

let sent = 0;
let failed = 0;
for (const { row, terms } of send) {
  // Claim first: a concurrent or repeated run finds the latch set and skips.
  const claimedAt = new Date().toISOString();
  const claim = db
    .prepare('UPDATE users SET pro_interest_email_sent_at = ?, updated_at = ? WHERE id = ? AND pro_interest_email_sent_at IS NULL')
    .run(claimedAt, claimedAt, row.id) as { changes: number | bigint };
  if (Number(claim.changes) === 0) continue;

  try {
    await sendProInterestEmail(row.email, emailFor(terms, buildUnsubUrl(appUrl, row.id)));
    sent += 1;
    db.prepare(
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (?, 'pro_interest_email_sent', ?, NULL, ?, 'pro-interest-email', ?, ?)`,
    ).run(
      `audit_${randomBytes(12).toString('hex')}`,
      row.id,
      row.email,
      `Pro interest email sent (${terms.kind}; ${row.visits} locked-page visit${row.visits === 1 ? '' : 's'} in ${days}d)`,
      new Date().toISOString(),
    );
    console.log(`  ✓ ${row.email}`);
  } catch (err) {
    failed += 1;
    // Release the latch so a later run retries this member.
    db.prepare('UPDATE users SET pro_interest_email_sent_at = NULL WHERE id = ? AND pro_interest_email_sent_at = ?').run(
      row.id,
      claimedAt,
    );
    console.error(`  ✗ ${row.email}: ${err instanceof Error ? err.message : 'send failed'}`);
  }
}

console.log(`\nDone: ${sent} sent, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
