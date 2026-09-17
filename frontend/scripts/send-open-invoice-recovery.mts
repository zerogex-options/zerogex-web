#!/usr/bin/env node
// Run from the frontend/ directory (or via `make open-invoice-recovery`):
//   node --experimental-strip-types scripts/send-open-invoice-recovery.mts [--yes] [--preview-to <email>]
//
// Finds money that is STILL COLLECTIBLE and nobody knows about.
//
// When a subscription's payment fails, Stripe retries on its Smart Retry
// schedule and then stops. What it does NOT do is void the invoice: it stays
// `open` on a hosted payment page that remains live indefinitely. So a member
// whose card was short in July has, today, an invoice they could still settle in
// two clicks — and almost certainly does not know their subscription lapsed at
// all, because the only notice was a dunning email sent at the moment their card
// failed.
//
// DRY RUN BY DEFAULT. With no flags this sends nothing and prints what is
// sitting there: how many invoices, how much money, and who. That report is the
// point of the script as much as the email is — run it whenever you want the
// number, without any risk of contacting anyone.
//
// IT NEVER: charges anything, creates or voids an invoice, changes a
// subscription, or alters access. It reads Stripe and sends one email. Access is
// restored by the member paying, through Stripe's own hosted page and the
// ordinary invoice.paid webhook — this script has no part in it.
//
// Eligibility, deliberately narrow:
//   - invoice.status = 'open' and amount_due > 0
//   - no next_payment_attempt: Stripe has STOPPED. An invoice still being
//     retried must not be emailed about; the retry may well collect it, and a
//     nudge in the middle of that is noise at best.
//   - the customer maps to a live local account (not soft-deleted)
//   - that account has actually LOST access. Someone still inside the
//     payment-recovery grace window has not lapsed, and telling them they have
//     is both wrong and alarming.
//   - no prior `open_invoice_recovery_email_sent` audit row for this invoice.
//     One email per invoice, ever.
//   - not unsubscribed from marketing. This invoice is arguably transactional,
//     but a lapse from months ago is close enough to win-back that the
//     conservative read is the right one; MARKETING_OPTOUT=ignore overrides.
//   - users.email_verified_at IS NOT NULL. The same guard every other sender in
//     this repo applies: an address that never proved ownership is as likely to
//     bounce or be a spam trap as to be read, and the cost of that is not this
//     campaign, it is the deliverability of every email the product sends
//     afterwards. Trial-abuse signups on disposable domains cluster in exactly
//     this population, so the guard matters more here than almost anywhere.
//
// Flags / environment:
//   --yes                actually send (default is a dry run that sends nothing)
//   --preview-to <addr>  render one real email to that address and stop
//   DAYS=<n>             how far back to look (default 180)
//   LIMIT=<n>            cap sends in one run (default 50)
//   MARKETING_OPTOUT=ignore   include members who opted out of marketing

import { loadEnvLocal, warnIfPricesUnconfigured } from './env-local.mts';
import crypto from 'node:crypto';
import Stripe from 'stripe';

// Load the WHOLE of .env.local — see scripts/env-local.mts for why an
// allowlist of keys cannot be kept correct here.
loadEnvLocal();

const argv = process.argv.slice(2);
const send = argv.includes('--yes');
const previewIndex = argv.indexOf('--preview-to');
const previewTo = previewIndex >= 0 ? argv[previewIndex + 1] : null;
const days = Number(process.env.DAYS) > 0 ? Number(process.env.DAYS) : 180;
const limit = Number(process.env.LIMIT) > 0 ? Number(process.env.LIMIT) : 50;
const ignoreOptOut = process.env.MARKETING_OPTOUT === 'ignore';

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('STRIPE_SECRET_KEY is not set (env or .env.local). Nothing to do.');
  process.exit(1);
}

const { getDb } = await import('../core/db.ts');
const { sendOpenInvoiceRecoveryEmail, buildOpenInvoiceRecoveryEmail } = await import('../core/mailer.ts');
const { priceIdToSku } = await import('../core/stripe.ts');
const { readInvoicePeriodEndUnix, readInvoicePriceId } = await import('../core/stripeInvoice.ts');

if (previewTo) {
  const preview = buildOpenInvoiceRecoveryEmail({
    amountFormatted: '$29.00',
    hostedInvoiceUrl: 'https://invoice.stripe.com/i/example',
    planLabel: 'Pro monthly',
    raisedLabel: 'in July',
  });
  await sendOpenInvoiceRecoveryEmail(previewTo, {
    amountFormatted: '$29.00',
    hostedInvoiceUrl: 'https://invoice.stripe.com/i/example',
    planLabel: 'Pro monthly',
    raisedLabel: 'in July',
  });
  console.log(`Preview "${preview.subject}" sent to ${previewTo}. Nothing else was touched.`);
  process.exit(0);
}

const db = getDb();
const stripe = new Stripe(secretKey);
const sinceUnix = Math.floor(Date.now() / 1000) - days * 86_400;

type Candidate = {
  invoiceId: string;
  userId: string;
  email: string;
  amountDue: number;
  currency: string;
  hostedInvoiceUrl: string;
  planLabel: string | null;
  raisedAt: string;
  /**
   * Whether paying this invoice will RESTORE ACCESS on its own.
   *
   * The webhook's orphan-payment recovery re-creates the plan anchored at the
   * end of the period the invoice paid for (core/orphanPayment.ts). When that
   * period has already elapsed there is no future access left to grant and
   * Stripe rejects an anchor in the past, so the payment is recorded as
   * "needs a human" and the member stays on the free tier having paid in full.
   *
   * Which makes this the most important column in the report: emailing somebody
   * to settle an invoice that will silently grant them nothing is worse than not
   * emailing them at all.
   */
  autoRestores: boolean;
  lapsed: boolean;
  optedOut: boolean;
  verified: boolean;
  alreadyEmailed: boolean;
};

const userByCustomer = new Map<
  string,
  { id: string; email: string; tier: string; lapsed: boolean; optedOut: boolean; verified: boolean }
>();
for (const row of db
  .prepare(
    `SELECT id, email, tier, stripe_customer_id, subscription_lapsed, marketing_unsubscribed_at, email_verified_at
       FROM users WHERE stripe_customer_id IS NOT NULL AND deleted_at IS NULL`,
  )
  .all() as Array<{
  id: string;
  email: string;
  tier: string;
  stripe_customer_id: string;
  subscription_lapsed: number;
  marketing_unsubscribed_at: string | null;
  email_verified_at: string | null;
}>) {
  userByCustomer.set(row.stripe_customer_id, {
    id: row.id,
    email: row.email,
    tier: row.tier,
    // Lost access: the lapse latch, or simply no longer holding a paid tier.
    lapsed: Number(row.subscription_lapsed) === 1 || row.tier === 'public',
    optedOut: row.marketing_unsubscribed_at != null,
    verified: row.email_verified_at != null,
  });
}

const emailed = new Set<string>();
for (const row of db
  .prepare(`SELECT message FROM audit_events WHERE type = 'open_invoice_recovery_email_sent'`)
  .all() as Array<{ message: string }>) {
  const id = row.message.match(/\b(in_[A-Za-z0-9]+)\b/)?.[1];
  if (id) emailed.add(id);
}

const money = (cents: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;
  }
};

warnIfPricesUnconfigured();
console.log(`Scanning open Stripe invoices raised in the last ${days} days…\n`);

const candidates: Candidate[] = [];
let stillRetrying = 0;
let noAccount = 0;
let notLapsed = 0;

for await (const invoice of stripe.invoices.list({
  status: 'open',
  created: { gte: sinceUnix },
  limit: 100,
  // Without this the list payload carries no line items, so every invoice
  // resolves to "plan unknown" and the email drops to generic copy.
  expand: ['data.lines'],
})) {
  if ((invoice.amount_due ?? 0) <= 0) continue;
  // Stripe has another attempt queued: leave it alone. The retry may well
  // collect it, and a nudge in the middle of that is noise at best.
  if (typeof invoice.next_payment_attempt === 'number') {
    stillRetrying += 1;
    continue;
  }
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const user = customerId ? userByCustomer.get(customerId) : undefined;
  if (!user) {
    noAccount += 1;
    continue;
  }
  if (!invoice.hosted_invoice_url || !invoice.id) continue;
  if (!user.lapsed) {
    notLapsed += 1;
    continue;
  }
  const priceId = readInvoicePriceId(invoice);
  const sku = priceId ? priceIdToSku(priceId) : null;
  const periodEnd = readInvoicePeriodEndUnix(invoice);
  const autoRestores = periodEnd != null && periodEnd > Math.floor(Date.now() / 1000);
  candidates.push({
    invoiceId: invoice.id,
    userId: user.id,
    email: user.email,
    amountDue: invoice.amount_due ?? 0,
    currency: invoice.currency ?? 'usd',
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    planLabel: sku ? `${sku.tier === 'pro' ? 'Pro' : 'Basic'} ${sku.cadence}` : null,
    raisedAt: new Date((invoice.created ?? 0) * 1000).toISOString(),
    autoRestores,
    lapsed: user.lapsed,
    optedOut: user.optedOut,
    verified: user.verified,
    alreadyEmailed: emailed.has(invoice.id),
  });
}

candidates.sort((a, b) => b.amountDue - a.amountDue);

const total = candidates.reduce((sum, c) => sum + c.amountDue, 0);
const sendable = candidates.filter(
  (c) => !c.alreadyEmailed && c.verified && (ignoreOptOut || !c.optedOut),
);
const unverified = candidates.filter((c) => !c.verified);
const sendableTotal = sendable.reduce((sum, c) => sum + c.amountDue, 0);

const autoRestoring = candidates.filter((c) => c.autoRestores);
const needsHuman = candidates.filter((c) => !c.autoRestores);

console.log('── Still payable right now ──');
console.log(`  ${candidates.length} open invoice(s) Stripe has stopped retrying, on lapsed accounts`);
console.log(`  ${money(total, 'usd')} total, on hosted pages that are still live`);
console.log(`  ${sendable.length} emailable (${money(sendableTotal, 'usd')})`);
if (unverified.length > 0) {
  console.log(
    `  ${unverified.length} held back (${money(unverified.reduce((s, c) => s + c.amountDue, 0), 'usd')}) — address never verified`,
  );
}
console.log('');
console.log('── What happens if they pay ──');
console.log(
  `  ${autoRestoring.length} (${money(autoRestoring.reduce((s, c) => s + c.amountDue, 0), 'usd')}) restore access AUTOMATICALLY —`,
);
console.log('    the period the invoice covers is still ahead, so the webhook re-creates the plan.');
if (needsHuman.length > 0) {
  console.log(
    `  ${needsHuman.length} (${money(needsHuman.reduce((s, c) => s + c.amountDue, 0), 'usd')}) DO NOT — the period they paid for has elapsed.`,
  );
  console.log('    The payment is collected and audited, but the member stays on the free tier until');
  console.log('    you run:  make recover-orphan-payment EMAIL=<them> YES=1');
  console.log('    Watch for them with:  make scan-orphan-payments   (read-only)');
}
console.log('');
console.log('── Held back ──');
console.log(`  ${stillRetrying} invoice(s) Stripe is STILL retrying — left alone on purpose`);
console.log(`  ${notLapsed} on accounts that have not lost access`);
console.log(`  ${noAccount} with no live local account`);

console.log('\n── The invoices ──');
for (const c of candidates.slice(0, 200)) {
  const flags = [
    c.autoRestores ? null : 'needs manual restore if paid',
    c.alreadyEmailed ? 'already emailed' : null,
    c.optedOut ? 'opted out' : null,
    c.verified ? null : 'UNVERIFIED — not emailed',
  ]
    .filter(Boolean)
    .join(', ');
  console.log(
    `  ${money(c.amountDue, c.currency).padStart(9)}  ${c.email.padEnd(34)} ${c.raisedAt.slice(0, 10)}  ${c.planLabel ?? 'plan unknown'}${flags ? `  [${flags}]` : ''}`,
  );
}

if (!send) {
  console.log(`\nDRY RUN — nothing was sent. ${money(sendableTotal, 'usd')} is reachable with one email each.`);
  console.log('Send it with:  make open-invoice-recovery YES=1');
  process.exit(0);
}

console.log(`\nSending up to ${limit}…`);
// Resend allows 10 requests a second and rejects the rest outright. A dropped
// send is not free: the member never hears from us, and only the latch below
// tells the difference — so pace the loop well under the ceiling rather than
// discovering the limit one failure at a time.
const SEND_INTERVAL_MS = 150;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isRateLimited = (err: unknown) =>
  /rate limit|too many requests/i.test(err instanceof Error ? err.message : String(err));

let sent = 0;
let failed = 0;
for (const [index, c] of sendable.slice(0, limit).entries()) {
  if (index > 0) await sleep(SEND_INTERVAL_MS);
  try {
    await sendOpenInvoiceRecoveryEmail(c.email, {
      amountFormatted: money(c.amountDue, c.currency),
      hostedInvoiceUrl: c.hostedInvoiceUrl,
      planLabel: c.planLabel,
      raisedLabel: null,
    });
    db.prepare(
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (?, 'open_invoice_recovery_email_sent', ?, NULL, ?, 'script', ?, ?)`,
    ).run(
      `audit_${crypto.randomBytes(12).toString('hex')}`,
      c.userId,
      c.email,
      `Open-invoice recovery sent for ${c.invoiceId} (${money(c.amountDue, c.currency)})`,
      new Date().toISOString(),
    );
    sent += 1;
  } catch (err) {
    // One retry on a rate limit, after a full second. Anything else is a real
    // failure and is left for the next run — the latch is only written on a
    // SUCCESSFUL send, so nothing is lost by giving up here.
    if (isRateLimited(err)) {
      await sleep(1000);
      try {
        await sendOpenInvoiceRecoveryEmail(c.email, {
          amountFormatted: money(c.amountDue, c.currency),
          hostedInvoiceUrl: c.hostedInvoiceUrl,
          planLabel: c.planLabel,
          raisedLabel: null,
        });
        db.prepare(
          `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
           VALUES (?, 'open_invoice_recovery_email_sent', ?, NULL, ?, 'script', ?, ?)`,
        ).run(
          `audit_${crypto.randomBytes(12).toString('hex')}`,
          c.userId,
          c.email,
          `Open-invoice recovery sent for ${c.invoiceId} (${money(c.amountDue, c.currency)})`,
          new Date().toISOString(),
        );
        sent += 1;
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
  `\nSent ${sent}, failed ${failed}. The latch is written only on a SUCCESSFUL send, so a failure` +
    ' here is retried by the next run — nobody is emailed twice and nobody is silently skipped.',
);
