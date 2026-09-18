// "Has this account ever actually paid us?" — separated out because the codebase
// had been answering it with a proxy that is true of people who never paid a
// cent.
//
// THE PROXY THAT WAS WRONG. app/api/billing/checkout/route.ts derived
// `hasPriorPaidSubscription` from `paid_welcome_email_sent_at != null ||
// subscription_lapsed == 1`. Both stamps land on a member who merely STARTED A
// TRIAL: the paid-welcome fires on the `trialing` status (the webhook's
// ACTIVE_STATUSES includes it), and the lapse flag is set when Stripe cancels
// for nonpayment. So an account whose only two invoices are a $0.00 trial
// invoice and a conversion charge that was declined five times reads back as a
// former paying customer.
//
// That is not a naming quibble. It is what `make diagnose-user` prints when an
// operator is deciding what to say to a member — "hasPriorPaidSubscription:
// yes", "prior paid subscription on this account" — about someone from whom we
// have collected exactly $0.00. An operator who trusts that line will tell a
// member their payment history says something it does not.
//
// THE FIX IS TWO NAMES, NOT ONE CORRECTED NAME. The old expression is still
// exactly right for what it GATES:
//
//   - the once-per-account trial gate (a trialer who churns must not farm a
//     fresh free week every cycle), and
//   - the referee-coupon gate, which relies on the trial gate to guarantee the
//     stack-coupon webhook step a pre-first-invoice `trialing` window.
//
// Both want "has this account already had a subscription of any kind", which is
// what the expression computes. So it keeps its meaning under an honest name
// (`hasHeldSubscriptionBefore`), and the claim about MONEY — which nothing
// should have been inferring from it — gets its own signal here.

import type { DatabaseSync } from 'node:sqlite';

export type EverPaidInput = {
  // users.first_payment_at. Stamped by maybeStampFirstPayment on invoice.paid,
  // which already excludes the $0 trial-create invoice, and backfilled at
  // migration time for accounts that were `active` (so: paying) back then.
  firstPaymentAt: string | null;
  // Rows in stripe_invoice_history for this user with amount_paid > 0 and
  // status 'paid' — money Stripe confirms it collected.
  clearedInvoiceCount: number;
};

/**
 * Whether money has ever actually cleared on this account.
 *
 * Two independent sources, OR-ed, because they fail in opposite directions and
 * neither alone is trustworthy:
 *
 *   - `first_payment_at` is real-time (the webhook stamps it as the payment
 *     lands) but can be absent for anyone who paid before that column existed
 *     and was not `active` at migration time.
 *   - `stripe_invoice_history` is authoritative (imported straight from Stripe)
 *     but is refreshed on a timer, so it lags a payment by up to one tick.
 *
 * Deliberately conservative in the SAME direction as the thing it protects: it
 * says "paid" on weak evidence and "never paid" only when both sources are
 * empty. Wrongly believing a payer never paid is how a member gets told their
 * money does not exist.
 */
export function decideEverPaid(input: EverPaidInput): boolean {
  return input.firstPaymentAt != null || input.clearedInvoiceCount > 0;
}

/**
 * Count invoices Stripe confirms it collected money on for this user.
 *
 * Returns 0 — never throws — when `stripe_invoice_history` does not exist yet
 * (a deploy predating that migration, or a test DB built from a narrower
 * schema). A missing import must degrade to "no evidence here", exactly as
 * core/cohortRetentionServer.ts treats it; it must never take down a checkout.
 */
export function countClearedInvoices(db: DatabaseSync, userId: string): number {
  try {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c FROM stripe_invoice_history
          WHERE user_id = ? AND status = 'paid' AND amount_paid > 0`,
      )
      .get(userId) as { c: number | bigint } | undefined;
    return Number(row?.c ?? 0);
  } catch {
    return 0;
  }
}

/** The two sources above, resolved against the live DB. */
export function hasEverPaid(
  db: DatabaseSync,
  userId: string,
  firstPaymentAt: string | null,
): boolean {
  return decideEverPaid({
    firstPaymentAt,
    // Short-circuit: the cheap column already answered it.
    clearedInvoiceCount: firstPaymentAt != null ? 1 : countClearedInvoices(db, userId),
  });
}
