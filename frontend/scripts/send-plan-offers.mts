#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/send-plan-offers.mts \
//     [--dry-run | --yes] [--preview-to <email>]
//
// The first-month plan offer: a few days before a monthly member's FIRST
// renewal, email them the longer plans on their tier (annual, and quarterly when
// it is on sale) and what each costs per month. core/planOffer.ts has who and
// why. The link opens the pricing page on the annual plan, where the switch is
// priced by Stripe and confirmed before anything is charged.
//
// Driven daily by the zerogex-web-plan-offers systemd timer
// (deploy/steps/099.plan-offers).
//
// Eligibility (all of):
//   - an active monthly subscription, not scheduled to cancel, not paused;
//   - exactly one payment on record for that subscription (the first month);
//   - the renewal 1 to 8 days away;
//   - not opted out of marketing email;
//   - users.plan_offer_email_sent_for is not already this subscription (the
//     latch, claimed BEFORE sending so a crash mid-run cannot send twice).
//
// Side effects on send: the email, the latch, and a plan_offer_email_sent
// audit row.

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
  node --experimental-strip-types --no-warnings scripts/send-plan-offers.mts \\
    [--dry-run | --yes] [--preview-to <email>]

  --dry-run            list who is due; send nothing, write nothing (the default)
  --yes                send and stamp the latch
  --preview-to <addr>  send ONE sample offer to <addr>; no DB writes`);
  process.exit(0);
}
if ([args.dryRun, args.yes, !!args.previewTo].filter(Boolean).length > 1) {
  console.error('Error: --dry-run, --yes and --preview-to are mutually exclusive.');
  process.exit(1);
}

loadEnvLocal();
warnIfPricesUnconfigured();

const { buildPlanOfferEmail, sendPlanOfferEmail } = await import('../core/mailer.ts');
const { formatBilledUsd, formatPerMonthUsd } = await import('../core/billingPlans.ts');
const { lengthenOffers } = await import('../core/planSwitch.ts');
const { getAppUrl, isSkuSellable, priceIdToSku } = await import('../core/stripe.ts');
const { buildUnsubUrl } = await import('../core/unsubToken.ts');

const TIER_LABEL = { basic: 'Basic', pro: 'Pro' } as const;
const appUrl = getAppUrl();
// Through /login, which forwards a signed-in member straight on and brings a
// signed-out one back after they sign in: the pricing page only offers the
// switch to a member it knows.
const switchUrl = `${appUrl}/login?next=${encodeURIComponent('/pricing?cadence=annual&from=plan_offer')}`;

function offerLines(tier: 'basic' | 'pro') {
  return lengthenOffers({ current: { tier, cadence: 'monthly' }, status: 'active', paused: false, isSellable: isSkuSellable }).map(
    (offer) => ({
      label: offer.cadence,
      price: offer.cadence === 'annual' ? `${formatBilledUsd(offer.listPrice)} a year` : `${formatBilledUsd(offer.listPrice)} every 3 months`,
      perMonth: formatPerMonthUsd(offer.perMonth),
    }),
  );
}

if (args.previewTo) {
  const sample = {
    tierLabel: 'Pro',
    renewalIso: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    offers: offerLines('pro'),
    switchUrl,
    unsubUrl: `${appUrl}/unsubscribe?u=preview&t=preview`,
  };
  await sendPlanOfferEmail(args.previewTo, sample);
  console.log(`Sent a sample plan offer to ${args.previewTo}:`);
  console.log(buildPlanOfferEmail(sample).text);
  process.exit(0);
}

const { getDb } = await import('../core/db.ts');
const { countPaidPeriods, isPlanOfferDue } = await import('../core/planOffer.ts');

type Candidate = {
  id: string;
  email: string;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number;
  paused_until: string | null;
  marketing_unsubscribed_at: string | null;
  plan_offer_email_sent_for: string | null;
};

const db = getDb();
const nowMs = Date.now();
const candidates = db
  .prepare(
    `SELECT id, email, stripe_subscription_id, stripe_price_id, subscription_status, current_period_end,
            cancel_at_period_end, paused_until, marketing_unsubscribed_at, plan_offer_email_sent_for
       FROM users
      WHERE deleted_at IS NULL
        AND stripe_subscription_id IS NOT NULL
        AND subscription_status = 'active'
        AND cancel_at_period_end = 0
        AND current_period_end IS NOT NULL
        AND (plan_offer_email_sent_for IS NULL OR plan_offer_email_sent_for <> stripe_subscription_id)`,
  )
  .all() as Candidate[];

const paymentRowsFor = db.prepare(
  `SELECT type, message FROM audit_events
    WHERE user_id = ? AND type IN ('stripe_first_payment', 'stripe_invoice_paid')`,
);

const due = candidates
  .map((user) => ({ user, sku: user.stripe_price_id ? priceIdToSku(user.stripe_price_id) : null }))
  .filter(({ sku }) => sku?.cadence === 'monthly')
  .filter(({ user, sku }) =>
    isPlanOfferDue({
      cadence: sku?.cadence ?? null,
      status: user.subscription_status,
      cancelAtPeriodEnd: Number(user.cancel_at_period_end) === 1,
      paused: user.paused_until != null,
      marketingUnsubscribed: user.marketing_unsubscribed_at != null,
      subscriptionId: user.stripe_subscription_id,
      periodEndIso: user.current_period_end,
      paidPeriods: countPaidPeriods(
        paymentRowsFor.all(user.id) as Array<{ type: string; message: string }>,
        user.stripe_subscription_id,
      ),
      sentForSubscriptionId: user.plan_offer_email_sent_for,
      nowMs,
    }),
  )
  .filter(({ sku }) => sku && offerLines(sku.tier).length > 0);

console.log(`Plan offers: ${due.length} due of ${candidates.length} active subscription(s).`);
for (const { user, sku } of due) {
  console.log(`  • ${user.email}  ${sku?.tier}/monthly  renews ${user.current_period_end}`);
}
if (!args.yes) {
  console.log(due.length ? '\n[dry run] Nothing sent. Re-run with --yes to send.' : '');
  process.exit(0);
}
if (due.length === 0) process.exit(0);

let sent = 0;
let failed = 0;
for (const { user, sku } of due) {
  if (!sku || !user.current_period_end) continue;
  // Claim first: a concurrent or repeated run finds the latch set and skips.
  const claim = db
    .prepare(
      `UPDATE users SET plan_offer_email_sent_for = ?, updated_at = ?
        WHERE id = ? AND stripe_subscription_id = ?
          AND (plan_offer_email_sent_for IS NULL OR plan_offer_email_sent_for <> ?)`,
    )
    .run(user.stripe_subscription_id, new Date().toISOString(), user.id, user.stripe_subscription_id, user.stripe_subscription_id) as {
    changes: number | bigint;
  };
  if (Number(claim.changes) === 0) continue;

  try {
    await sendPlanOfferEmail(user.email, {
      tierLabel: TIER_LABEL[sku.tier],
      renewalIso: user.current_period_end,
      offers: offerLines(sku.tier),
      switchUrl,
      unsubUrl: buildUnsubUrl(appUrl, user.id),
    });
    sent += 1;
    db.prepare(
      `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
       VALUES (?, 'plan_offer_email_sent', ?, NULL, ?, 'plan-offers', ?, ?)`,
    ).run(
      `audit_${randomBytes(12).toString('hex')}`,
      user.id,
      user.email,
      `First-month plan offer sent for ${sku.tier}/monthly renewing ${user.current_period_end} (sub ${user.stripe_subscription_id})`,
      new Date().toISOString(),
    );
    console.log(`  ✓ ${user.email}`);
  } catch (err) {
    failed += 1;
    // Release the latch so the next run retries this member.
    db.prepare('UPDATE users SET plan_offer_email_sent_for = NULL WHERE id = ? AND plan_offer_email_sent_for = ?').run(
      user.id,
      user.stripe_subscription_id,
    );
    console.error(`  ✗ ${user.email}: ${err instanceof Error ? err.message : 'send failed'}`);
  }
}

console.log(`Done: ${sent} sent, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
