#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/send-renewal-reminders.mts \
//     [--dry-run | --yes] [--preview-to <email>]
//
// Advance notice before a QUARTERLY or ANNUAL plan renews: 30 days ahead for
// annual, 7 for quarterly (core/renewalReminder.ts has the why). Monthly plans
// are not reminded. Driven daily by the zerogex-web-renewal-reminders systemd
// timer (deploy/steps/099.renewal-reminders); this is what the pricing page
// means by "before a quarterly or annual plan renews, we email you a reminder".
//
// Eligibility (all of):
//   - an active subscription on a quarterly or annual price (mapped through the
//     same STRIPE_PRICE_* table checkout uses), not scheduled to cancel;
//   - current_period_end inside the plan's lead window;
//   - users.renewal_reminder_sent_for is not already that period end (the
//     latch — re-arms by itself when the next period starts).
//
// Each reminder quotes the exact amount from Stripe's upcoming-invoice preview
// (every discount on the subscription applied). Best-effort: without
// STRIPE_SECRET_KEY, or on a per-member Stripe error, it says "at your plan's
// current rate" instead of guessing a figure.
//
// Side effects on send: the email, users.renewal_reminder_sent_for (claimed
// BEFORE sending, so a crash mid-run cannot send twice), and a
// renewal_reminder_email_sent audit row.

import { randomBytes } from 'node:crypto';
import { loadEnvLocal, warnIfPricesUnconfigured } from './env-local.mts';

type Args = { dryRun: boolean; yes: boolean; previewTo: string | null; help: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, yes: false, previewTo: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--preview-to') args.previewTo = argv[++i] ?? null;
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
  node --experimental-strip-types --no-warnings scripts/send-renewal-reminders.mts \\
    [--dry-run | --yes] [--preview-to <email>]

  --dry-run            list who is due; send nothing, write nothing (the default)
  --yes                send and stamp the latch
  --preview-to <addr>  send ONE sample reminder to <addr>; no DB writes`);
  process.exit(0);
}
if ([args.dryRun, args.yes, !!args.previewTo].filter(Boolean).length > 1) {
  console.error('Error: --dry-run, --yes and --preview-to are mutually exclusive.');
  process.exit(1);
}

loadEnvLocal();
warnIfPricesUnconfigured();

const { buildRenewalReminderEmail, sendRenewalReminderEmail } = await import('../core/mailer.ts');

if (args.previewTo) {
  const sample = {
    planLabel: 'Pro (annual)',
    renewalIso: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    amountFormatted: '$299.00',
  };
  await sendRenewalReminderEmail(args.previewTo, sample);
  console.log(`Sent a sample renewal reminder to ${args.previewTo}:`);
  console.log(buildRenewalReminderEmail(sample).text);
  process.exit(0);
}

const { getDb } = await import('../core/db.ts');
const { priceIdToSku } = await import('../core/stripe.ts');
const { isRenewalReminderDue } = await import('../core/renewalReminder.ts');
const { previewNextInvoice } = await import('../core/stripeInvoicePreview.ts');

type Candidate = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number;
  renewal_reminder_sent_for: string | null;
};

const db = getDb();
const nowMs = Date.now();
const candidates = db
  .prepare(
    `SELECT id, email, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status,
            current_period_end, cancel_at_period_end, renewal_reminder_sent_for
       FROM users
      WHERE deleted_at IS NULL
        AND stripe_subscription_id IS NOT NULL
        AND subscription_status = 'active'
        AND cancel_at_period_end = 0
        AND current_period_end IS NOT NULL`,
  )
  .all() as Candidate[];

const TIER_LABEL = { basic: 'Basic', pro: 'Pro' } as const;
const due = candidates
  .map((user) => ({ user, sku: user.stripe_price_id ? priceIdToSku(user.stripe_price_id) : null }))
  .filter(({ user, sku }) =>
    isRenewalReminderDue({
      cadence: sku?.cadence ?? null,
      status: user.subscription_status,
      cancelAtPeriodEnd: Number(user.cancel_at_period_end) === 1,
      periodEndIso: user.current_period_end,
      sentForIso: user.renewal_reminder_sent_for,
      nowMs,
    }),
  );

console.log(`Renewal reminders: ${due.length} due of ${candidates.length} active subscription(s).`);
for (const { user, sku } of due) {
  console.log(`  • ${user.email}  ${sku?.tier}/${sku?.cadence}  renews ${user.current_period_end}`);
}
if (!args.yes) {
  console.log(due.length ? '\n[dry run] Nothing sent. Re-run with --yes to send.' : '');
  process.exit(0);
}
if (due.length === 0) process.exit(0);

let stripe: import('stripe').default | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  const { getStripe } = await import('../core/stripe.ts');
  stripe = getStripe();
}

async function amountFor(user: Candidate): Promise<string | null> {
  if (!stripe) return null;
  try {
    const preview = await previewNextInvoice(stripe, {
      subscription: user.stripe_subscription_id,
      customer: user.stripe_customer_id,
    });
    if (typeof preview.amount_due !== 'number' || preview.amount_due <= 0 || !preview.currency) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: preview.currency.toUpperCase() }).format(
      preview.amount_due / 100,
    );
  } catch {
    return null;
  }
}

let sent = 0;
let failed = 0;
for (const { user, sku } of due) {
  if (!sku || !user.current_period_end) continue;
  // Claim first: a concurrent or repeated run finds the latch set and skips.
  const claim = db
    .prepare(
      `UPDATE users SET renewal_reminder_sent_for = ?, updated_at = ?
        WHERE id = ? AND current_period_end = ?
          AND (renewal_reminder_sent_for IS NULL OR renewal_reminder_sent_for <> ?)`,
    )
    .run(user.current_period_end, new Date().toISOString(), user.id, user.current_period_end, user.current_period_end) as {
    changes: number | bigint;
  };
  if (Number(claim.changes) === 0) continue;

  const planLabel = `${TIER_LABEL[sku.tier]} (${sku.cadence})`;
  try {
    await sendRenewalReminderEmail(user.email, {
      planLabel,
      renewalIso: user.current_period_end,
      amountFormatted: await amountFor(user),
    });
    sent += 1;
    db.prepare(
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (?, 'renewal_reminder_email_sent', ?, NULL, ?, 'renewal-reminders', ?, ?)`,
    ).run(
      `audit_${randomBytes(12).toString('hex')}`,
      user.id,
      user.email,
      `Renewal reminder sent for ${planLabel} renewing ${user.current_period_end} (sub ${user.stripe_subscription_id})`,
      new Date().toISOString(),
    );
    console.log(`  ✓ ${user.email}`);
  } catch (err) {
    failed += 1;
    // Release the latch so the next run retries this member.
    db.prepare('UPDATE users SET renewal_reminder_sent_for = NULL WHERE id = ? AND renewal_reminder_sent_for = ?').run(
      user.id,
      user.current_period_end,
    );
    console.error(`  ✗ ${user.email}: ${err instanceof Error ? err.message : 'send failed'}`);
  }
}

console.log(`Done: ${sent} sent, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
