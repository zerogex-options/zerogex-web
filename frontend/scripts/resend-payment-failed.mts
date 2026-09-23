#!/usr/bin/env node
// Run from the frontend/ directory (or via `make resend-payment-failed`):
//   node --experimental-strip-types scripts/resend-payment-failed.mts [--yes] [--preview-to <email>]
//
// Re-sends the payment-failed email, as it reads TODAY, to members who were
// sent it recently and still have not paid.
//
// WHY. Both dunning emails used to button straight to Stripe's hosted invoice
// page, and a long tokenized invoice.stripe.com payment link inside a "your
// payment failed" email is the shape spam filters look for in phishing. Some of
// those emails very likely went to spam, which means the member was never told
// their payment failed. The email now carries our own signed /pay link instead
// (core/payLink.ts). This sends that version to the members who got the old one
// and whose money is still outstanding.
//
// DRY RUN BY DEFAULT. With no flags it sends nothing and prints who would get a
// second copy, who would not, and why.
//
// Who, deliberately narrow (rules in core/paymentFailedResend.ts):
//   - a `payment_failed_email_sent` audit row in the last DAYS days: the member
//     was actually sent the email. Its framing (trial conversion or renewal) is
//     kept, so nobody who got the renewal email is told their trial ended.
//   - not on the SKIP list — people the operator already wrote to by hand.
//   - a live account (not soft-deleted) whose address was verified. The same
//     guard the other batch senders apply: an address that never proved
//     ownership is as likely to bounce or be a spam trap as to be read, and this
//     resend exists because deliverability was already hurting.
//   - the invoice is still `open` with money owed. Paid since: nothing to say.
//     Voided or written off: nothing to pay.
//   - the subscription is still past_due / unpaid / incomplete. Once it is
//     canceled, "Stripe will try again" is false; an open invoice on a
//     subscription Stripe gave up on is `make open-invoice-recovery`'s job.
//   - no earlier resend for the invoice (`payment_failed_email_resent`). One
//     resend per invoice, ever.
//
// Everything in the email is re-read from Stripe at send time — amount, card,
// next retry, grace deadline, and the bank's reason for the LATEST decline — so
// it states today's facts rather than last week's.
//
// WHY THE REASON IS LOOKED UP HERE rather than read from payment_declines. Until
// core/stripeDeclineLookup.ts learned to re-read event-shaped invoices, the
// webhook stored "unknown" for every decline, and rows from that time stay that
// way until `make backfill-payment-declines` refills them. Asking Stripe again
// costs one read and is right either way.
//
// It never charges, retries, voids or changes anything. It reads Stripe and the
// database and sends at most one email per invoice.
//
// Flags / environment:
//   --yes                actually send (default is a dry run that sends nothing)
//   --preview-to <addr>  send the FIRST eligible member's real email to <addr>
//                        instead, and stop (their pay link works; don't pay it)
//   SKIP=<list>          emails or invoice ids to leave alone, comma-separated —
//                        e.g. members you already wrote to. Give it on EVERY run;
//                        the commands this prints carry it forward for you.
//   DAYS=<n>             how far back to look (default 7)
//   BEFORE=<iso>         only emails sent before this instant — e.g. when the
//                        /pay version was deployed, so members who already got
//                        it are not sent it twice
//   LIMIT=<n>            cap sends in one run (default 50)

import { loadEnvLocal } from './env-local.mts';
import crypto from 'node:crypto';
import type Stripe from 'stripe';
import type { DeclineCategory } from '../core/declineReason.ts';
import type { SentPaymentFailedEmail } from '../core/paymentFailedResend.ts';

// Load the WHOLE of .env.local — see scripts/env-local.mts for why an
// allowlist of keys cannot be kept correct here.
loadEnvLocal();

const argv = process.argv.slice(2);
const send = argv.includes('--yes');
const previewIndex = argv.indexOf('--preview-to');
const previewTo = previewIndex >= 0 ? argv[previewIndex + 1] : null;
const days = Number(process.env.DAYS) > 0 ? Number(process.env.DAYS) : 7;
const limit = Number(process.env.LIMIT) > 0 ? Number(process.env.LIMIT) : 50;
const beforeRaw = process.env.BEFORE?.trim() || null;
const before = beforeRaw ? new Date(beforeRaw) : null;
if (before && Number.isNaN(before.getTime())) {
  console.error(`BEFORE=${beforeRaw} is not a date. Use an ISO instant, e.g. BEFORE=2026-09-23T18:00:00Z`);
  process.exit(1);
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set (env or .env.local). Nothing to do.');
  process.exit(1);
}

// The whole point of the resend is the on-domain pay link, so it must point at
// the live site and be signed.
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? '';
if ((send || previewTo) && !appUrl) {
  console.error('NEXT_PUBLIC_APP_URL is not set (env or .env.local); the pay links would point at localhost.');
  process.exit(1);
}
if ((send || previewTo) && !process.env.ZEROGEX_END_USER_TOKEN_SECRET) {
  console.error('ZEROGEX_END_USER_TOKEN_SECRET is not set (env or .env.local); the /pay links cannot be signed.');
  process.exit(1);
}

const { getDb } = await import('../core/db.ts');
const { classifyDecline } = await import('../core/declineReason.ts');
const { parseSkipList, skipArg, skipEntryFor, suspectSkipEntries } = await import('../core/emailSkipList.ts');
const { sendPaymentFailedEmail, sendTrialConversionFailedEmail } = await import('../core/mailer.ts');
const { buildPayUrl } = await import('../core/payLink.ts');
const { graceWindowEndIso } = await import('../core/paymentGrace.ts');
const { getPaymentGraceDays, getStripe } = await import('../core/stripe.ts');
const { resolveSubscriptionCard } = await import('../core/stripeCard.ts');
const { lookupInvoiceDecline } = await import('../core/stripeDeclineLookup.ts');
const { readInvoiceSubscriptionId } = await import('../core/stripeInvoice.ts');
const {
  RESEND_AUDIT_TYPE,
  decideResend,
  notInDunningLabel,
  parsePaymentFailedAudit,
  parseResendAudit,
  resendAuditMessage,
  toDeclineCategory,
} = await import('../core/paymentFailedResend.ts');

const skip = parseSkipList(process.env.SKIP);
const db = getDb();
// Our pinned API version (core/stripe.ts), not the SDK default: its invoices
// still carry the charge the decline reason is read from.
const stripe = getStripe();
const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();
const beforeIso = before ? before.toISOString() : new Date(Date.now() + 60_000).toISOString();

const money = (cents: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;
  }
};

type Candidate = {
  sent: SentPaymentFailedEmail;
  userId: string;
  email: string;
  amountDue: number;
  currency: string;
  customerId: string | null;
  subscriptionId: string | null;
  nextAttemptIso: string | null;
  graceStartedAt: string | null;
  category: DeclineCategory | null;
};

type ReportRow = {
  sent: SentPaymentFailedEmail;
  sentAt: string;
  email: string | null;
  amount: string | null;
  /** What the bank said, e.g. "insufficient_funds" or "issuer_block (do_not_honor)". */
  reason: string;
  outcome: string;
};

const SKIP_LABEL = {
  paid: 'paid since',
  closed: 'invoice closed (voided / written off)',
} as const;

const resent = new Set<string>();
for (const row of db
  .prepare(`SELECT message FROM audit_events WHERE type = ?`)
  .all(RESEND_AUDIT_TYPE) as Array<{ message: string }>) {
  const id = parseResendAudit(row.message);
  if (id) resent.add(id);
}

const storedCategory = db.prepare(
  `SELECT category FROM payment_declines WHERE invoice_id = ? ORDER BY attempt_count DESC LIMIT 1`,
);

// Newest first, so the de-dup below keeps the most recent send per invoice.
const sentRows = db
  .prepare(
    `SELECT a.user_id, a.message, a.created_at, u.email, u.deleted_at, u.email_verified_at,
            u.payment_grace_started_at
       FROM audit_events a
       LEFT JOIN users u ON u.id = a.user_id
      WHERE a.type = 'payment_failed_email_sent' AND a.created_at >= ? AND a.created_at < ?
      ORDER BY a.created_at DESC`,
  )
  .all(sinceIso, beforeIso) as Array<{
  user_id: string | null;
  message: string;
  created_at: string;
  email: string | null;
  deleted_at: string | null;
  email_verified_at: string | null;
  payment_grace_started_at: string | null;
}>;

console.log(
  `Checking payment-failed emails sent in the last ${days} days${before ? ` and before ${beforeIso}` : ''}…`,
);
if (skip.entries.length > 0) console.log(`Skipping at your request: ${skip.entries.join(', ')}`);
console.log('');

const report: ReportRow[] = [];
const candidates: Candidate[] = [];
const seen = new Set<string>();
const skipMatched = new Set<string>();

for (const row of sentRows) {
  const sent = parsePaymentFailedAudit(row.message);
  if (!sent || seen.has(sent.invoiceId)) continue;
  seen.add(sent.invoiceId);

  const base = { sent, sentAt: row.created_at, email: row.email };
  const noLookup = { amount: null, reason: '' };

  const skippedBy = skipEntryFor(skip, { email: row.email, invoiceId: sent.invoiceId });
  if (skippedBy) {
    skipMatched.add(skippedBy);
    report.push({ ...base, ...noLookup, outcome: 'skipped at your request' });
    continue;
  }
  if (resent.has(sent.invoiceId)) {
    report.push({ ...base, ...noLookup, outcome: 'already resent' });
    continue;
  }
  if (!row.user_id || !row.email || row.deleted_at) {
    report.push({ ...base, ...noLookup, outcome: 'no live account' });
    continue;
  }
  if (!row.email_verified_at) {
    report.push({ ...base, ...noLookup, outcome: 'address never verified' });
    continue;
  }

  let invoice: Stripe.Invoice;
  let subscription: Stripe.Subscription | null = null;
  try {
    invoice = await stripe.invoices.retrieve(sent.invoiceId);
    const subscriptionId = readInvoiceSubscriptionId(invoice);
    if (subscriptionId) subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    report.push({
      ...base,
      ...noLookup,
      outcome: `Stripe lookup failed: ${err instanceof Error ? err.message : err}`,
    });
    continue;
  }

  // The bank's reason for the latest attempt, read live (see the header). Falls
  // back to whatever the webhook stored.
  const lookup = await lookupInvoiceDecline(stripe, invoice);
  const category = lookup.decline
    ? classifyDecline(lookup.decline)
    : toDeclineCategory((storedCategory.get(sent.invoiceId) as { category: string } | undefined)?.category);
  const bankCode = lookup.decline?.declineCode ?? lookup.decline?.code ?? null;
  const reason = `${category ?? 'unknown'}${bankCode && bankCode !== category ? ` (${bankCode})` : ''}`;

  const amountDue = invoice.amount_due ?? 0;
  const currency = invoice.currency ?? 'usd';
  const amount = money(amountDue, currency);
  const decision = decideResend({
    invoiceStatus: invoice.status,
    amountDue: invoice.amount_due,
    subscriptionStatus: subscription?.status ?? null,
  });
  if (!decision.send) {
    const outcome =
      decision.skip === 'not_in_dunning'
        ? notInDunningLabel({
            status: subscription?.status ?? null,
            cancellationReason: subscription?.cancellation_details?.reason ?? null,
          })
        : SKIP_LABEL[decision.skip];
    report.push({ ...base, amount, reason, outcome });
    continue;
  }

  candidates.push({
    sent,
    userId: row.user_id,
    email: row.email,
    amountDue,
    currency,
    customerId: typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? null),
    subscriptionId: subscription?.id ?? null,
    nextAttemptIso:
      typeof invoice.next_payment_attempt === 'number'
        ? new Date(invoice.next_payment_attempt * 1000).toISOString()
        : null,
    graceStartedAt: row.payment_grace_started_at,
    category,
  });
  report.push({ ...base, amount, reason, outcome: 'RESEND' });
}

const total = candidates.reduce((sum, c) => sum + c.amountDue, 0);
const skipped = new Map<string, number>();
for (const r of report) {
  if (r.outcome !== 'RESEND') skipped.set(r.outcome, (skipped.get(r.outcome) ?? 0) + 1);
}

console.log('── Payment-failed emails in the window ──');
console.log(`  ${report.length} invoice(s) were sent one`);
console.log(`  ${candidates.length} still unpaid with Stripe still retrying — would get the new email (${money(total, 'usd')})`);
console.log('');
console.log('── Not resent ──');
if (skipped.size === 0) console.log('  none');
for (const [outcome, count] of skipped) console.log(`  ${count}  ${outcome}`);

console.log("\n── The invoices (reason = what the member's bank said) ──");
for (const r of report) {
  console.log(
    `  ${(r.amount ?? '').padStart(9)}  ${(r.email ?? '(no account)').padEnd(34)} sent ${r.sentAt.slice(0, 10)}  ` +
      `${(r.sent.trialConversion ? 'trial' : 'renewal').padEnd(7)}  ${r.reason.padEnd(38)} ${r.outcome}`,
  );
}

// A SKIP entry that matches no account is almost always a typo — and a typo
// means the person it was meant for is about to be emailed.
const accountByEmail = db.prepare('SELECT 1 FROM users WHERE lower(email) = ?');
const suspect = suspectSkipEntries(skip, skipMatched, (email) => accountByEmail.get(email) !== undefined);
if (suspect.length > 0) {
  console.log(`\n⚠ SKIP entries that match no account here: ${suspect.join(', ')} — check the spelling before sending.`);
}

if (candidates.length === 0) {
  console.log('\nNothing to resend.');
  process.exit(0);
}

// Re-read the parts that move — the card and the grace deadline — at send time,
// exactly as the webhook does, so the email states today's facts.
async function emailArgs(c: Candidate) {
  let card: { brand: string | null; last4: string } | null = null;
  try {
    card = await resolveSubscriptionCard(stripe, c.subscriptionId, c.customerId);
  } catch {
    // Same as the webhook: an unresolvable card drops to neutral wording.
  }
  return {
    amountFormatted: money(c.amountDue, c.currency),
    cardBrand: card?.brand ?? null,
    cardLast4: card?.last4 ?? null,
    nextAttemptIso: c.nextAttemptIso,
    graceUntilIso: graceWindowEndIso(c.graceStartedAt, getPaymentGraceDays(), Date.now()),
    declineCategory: c.category,
    payUrl: buildPayUrl(appUrl, c.sent.invoiceId),
  };
}

async function deliver(to: string, c: Candidate) {
  const args = await emailArgs(c);
  if (c.sent.trialConversion) await sendTrialConversionFailedEmail(to, args);
  else await sendPaymentFailedEmail(to, args);
}

if (previewTo) {
  const c = candidates[0];
  await deliver(previewTo, c);
  console.log(
    `\nPreview of ${c.email}'s email (invoice ${c.sent.invoiceId}) sent to ${previewTo}. ` +
      'Its pay link is live for their invoice. Nothing else was touched.',
  );
  process.exit(0);
}

if (!send) {
  // Repeat every setting this run used, so the real send can't quietly drop the
  // SKIP list (or the window) the dry run was checked with.
  const carried = `${process.env.DAYS ? ` DAYS=${days}` : ''}${beforeRaw ? ` BEFORE=${beforeRaw}` : ''}${skipArg(skip)}`;
  console.log(`\nDRY RUN — nothing was sent. ${candidates.length} member(s) would get the new email.`);
  console.log(`Preview one with:  make resend-payment-failed PREVIEW_TO=<you>${carried}`);
  console.log(`Send them with:    make resend-payment-failed YES=1${carried}`);
  process.exit(0);
}

console.log(`\nSending up to ${limit}…`);
// Resend allows 10 requests a second and rejects the rest outright. Pace well
// under it; the latch is written only on a successful send, so a failure here
// is retried by the next run and nobody is emailed twice.
const SEND_INTERVAL_MS = 150;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isRateLimited = (err: unknown) =>
  /rate limit|too many requests/i.test(err instanceof Error ? err.message : String(err));

function latch(c: Candidate) {
  db.prepare(
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (?, ?, ?, NULL, ?, 'script', ?, ?)`,
  ).run(
    `audit_${crypto.randomBytes(12).toString('hex')}`,
    RESEND_AUDIT_TYPE,
    c.userId,
    c.email,
    resendAuditMessage(c.sent),
    new Date().toISOString(),
  );
}

let sentCount = 0;
let failed = 0;
for (const [index, c] of candidates.slice(0, limit).entries()) {
  if (index > 0) await sleep(SEND_INTERVAL_MS);
  try {
    await deliver(c.email, c);
    latch(c);
    sentCount += 1;
  } catch (err) {
    if (isRateLimited(err)) {
      await sleep(1000);
      try {
        await deliver(c.email, c);
        latch(c);
        sentCount += 1;
        continue;
      } catch {
        // Fall through to the failure path.
      }
    }
    failed += 1;
    console.warn(`  ! ${c.email}: ${err instanceof Error ? err.message : 'send failed'}`);
  }
}
console.log(
  `\nSent ${sentCount}, failed ${failed}. The latch is written only on a SUCCESSFUL send, so a failure` +
    ' here is retried by the next run — nobody is emailed twice and nobody is silently skipped.',
);
