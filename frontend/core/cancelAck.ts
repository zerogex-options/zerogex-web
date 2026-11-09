// The cancellation acknowledgment: the email a member gets seconds after they
// click Cancel, confirming when access ends and carrying the one-click /save
// offer. The Stripe webhook fires it on the 0→1 transition of
// cancel_at_period_end, latched on users.cancel_ack_email_sent_at so a
// redelivered or racing event can't send it twice.
//
// The latch fails silently: when the claim below finds it already taken, it
// sends nothing and writes no audit row. So every way out of a pending cancel
// has to release it, or the member's NEXT cancel goes unacknowledged:
//   • un-cancel (1→0): released below.
//   • the subscription ends: released by markSubscriptionEnded
//     (core/billingUser.ts), so a member who lapses and comes back is
//     acknowledged when they cancel again.
//   • a save: app/save, the in-app cancel flow, and the honor-winback-discount
//     and set-cancellation scripts clear it themselves.
//
// A member whose payment had already failed is the exception. Their Cancel
// ends the subscription on the spot and voids its bill (core/pastDueCancel.ts),
// so there is no pending cancel and no 0→1 transition: the in-app cancel flow
// acknowledges it itself, through acknowledgeEndedCancel below. A cancel on a
// failed payment that IS scheduled for period end arrives from outside the
// app, and is flagged instead of acknowledged (see paymentFailed).
//
// Here rather than inline in the webhook so that lifecycle is tested against
// the real schema (tests/cancelAck.test.ts). Loadable outside Next on purpose
// (no `server-only`, no '@/' alias); the webhook passes in the mailer, the
// save-link builder and its audit writer.

import { getDb } from './db.ts';
import {
  formatCancellationRequestedMessage,
  type CancellationDetails,
  type EndedOnFailedPayment,
} from './cancellationReason.ts';

// Mirror core/retentionOffer.ts SAVE_PERCENT / PRICE_SAVE_PERCENT. That module
// imports Stripe through the '@/' alias, which this file must not (it loads
// outside Next).
const SAVE_PERCENT = 25;
const PRICE_SAVE_PERCENT = 50;

export type CancelAckTransition = {
  // cancel_at_period_end before and after this sync, as 0 or 1.
  previous: number;
  next: number;
  periodEndIso: string | null;
  subscriptionId: string;
  // True when a trial-conversion charge for this period is already in flight
  // (see core/trialDunning.hasConversionChargeInFlight). Decided at the call
  // site, where the live subscription is in scope.
  conversionChargePending: boolean;
  // True when the subscription was still in its free trial when they canceled
  // (status 'trialing'), so the email doesn't thank a trial member for being
  // "a real part" of the business.
  trialing?: boolean;
  // Typed with our own structurally-compatible shape (Stripe's enum fields
  // widen to string) so this doesn't depend on the Stripe nested type path.
  cancellationDetails?: CancellationDetails;
  // True when the subscription's payment had already failed (past_due or
  // unpaid) when this cancel was scheduled. The in-app flow never schedules
  // one: it ends such a subscription on the spot. So this comes from outside
  // the app (the Stripe Dashboard, or the billing portal if its Cancel is ever
  // turned back on), nothing has been ended or voided, and Stripe is still
  // retrying the bill. The usual email ("full access until …") would be false,
  // so none is sent, and an audit row says what to run.
  paymentFailed?: boolean;
};

export type CancelAckDeps = {
  send: (
    to: string,
    opts: {
      periodEndIso: string | null;
      saveUrl: string | null;
      conversionChargePending: boolean;
      trialing: boolean;
      // The reason the member picked, so the email can answer it.
      cancellationFeedback: string | null;
      // What they typed in the survey's free-text box, so the email thanks them
      // for it instead of asking why again.
      cancellationComment: string | null;
      // The percent off the save link applies (25, or 50 for "Too expensive").
      savePercent: number;
      // Set only for a cancel that ended a subscription whose payment had
      // failed (acknowledgeEndedCancel). See buildCancellationEmail.
      paymentFailed?: { neverPaid: boolean; billVoided: boolean } | null;
    },
  ) => Promise<unknown>;
  // The member's signed one-click /save link for an offer. Throws when the
  // token secret is unset; the acknowledgment then goes out without the offer.
  buildSaveUrl: (userId: string, offer: 'save' | 'price') => string;
  audit: (event: { type: string; userId: string; email: string; message: string }) => void;
  nowIso: () => string;
};

export type CancelAckOutcome =
  | 'sent'
  | 'send_failed'
  // The latch was already held, so nothing was sent.
  | 'already_acknowledged'
  // Scheduled while the payment had failed (see paymentFailed): nothing sent,
  // flagged for the operator.
  | 'withheld_payment_failed'
  | 'released'
  | 'no_transition';

type SendOptions = Parameters<CancelAckDeps['send']>[1];

// The row every reader of a cancel keys on: Why Members Cancel, the
// cancellation alert, daily metrics, cohort and renewal retention. The portal
// cancellation survey is folded into the message (an empty suffix when nothing
// was collected, so a silent cancel keeps a clean message). A cancel that ended
// the subscription on a failed payment also says so, and whether its bill was
// voided, so the cancellation alert doesn't call it savable
// (formatCancellationRequestedMessage in core/cancellationReason.ts).
function auditCancellationRequested(
  member: { id: string; email: string },
  subscriptionId: string,
  details: CancellationDetails,
  deps: Pick<CancelAckDeps, 'audit'>,
  endedOnFailedPayment: EndedOnFailedPayment | null = null,
): void {
  deps.audit({
    type: 'stripe_cancellation_requested',
    userId: member.id,
    email: member.email,
    message: formatCancellationRequestedMessage(subscriptionId, details, endedOnFailedPayment),
  });
}

async function sendAcknowledgment(
  member: { id: string; email: string },
  subscriptionId: string,
  opts: SendOptions,
  deps: Pick<CancelAckDeps, 'send' | 'audit'>,
): Promise<'sent' | 'send_failed'> {
  try {
    await deps.send(member.email, opts);
    deps.audit({
      type: 'cancellation_ack_email_sent',
      userId: member.id,
      email: member.email,
      message: `Sent cancellation ack email for sub ${subscriptionId}`,
    });
    return 'sent';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cancellation ack email send failed';
    deps.audit({
      type: 'cancellation_ack_email_error',
      userId: member.id,
      email: member.email,
      message: `Cancellation ack email send failed for sub ${subscriptionId}: ${message}`,
    });
    return 'send_failed';
  }
}

export async function handleCancelAckTransition(
  member: { id: string; email: string },
  transition: CancelAckTransition,
  deps: CancelAckDeps,
): Promise<CancelAckOutcome> {
  if (transition.previous === 0 && transition.next === 1) {
    auditCancellationRequested(member, transition.subscriptionId, transition.cancellationDetails, deps);

    if (transition.paymentFailed) {
      // The latch is left alone: nothing is sent.
      deps.audit({
        type: 'cancellation_ack_withheld_payment_failed',
        userId: member.id,
        email: member.email,
        message:
          `Sub ${transition.subscriptionId} was set to cancel at period end while its payment had failed, ` +
          'most likely outside the in-app cancel flow (which ends such a subscription on the spot). ' +
          'Stripe is still retrying the bill and no email was sent. ' +
          `End it and void the bill: make cancel-subscription EMAIL=${member.email} VOID_INVOICE=1 DRY_RUN=1, ` +
          'then YES=1, and reply to the member yourself.',
      });
      return 'withheld_payment_failed';
    }

    const stamp = deps.nowIso();
    const claim = getDb()
      .prepare(
        `UPDATE users SET cancel_ack_email_sent_at = ?, updated_at = ?
         WHERE id = ? AND cancel_ack_email_sent_at IS NULL`,
      )
      .run(stamp, stamp, member.id) as { changes: number | bigint };

    if (Number(claim.changes) === 0) return 'already_acknowledged';

    // One-click self-serve save link (25% off + un-cancel via app/save).
    // Best-effort: if the token secret is unset, buildSaveUrl throws and the
    // email goes out with NO discount offer at all — there is no manual
    // fallback any more (see buildCancellationEmail). The acknowledgment and
    // the cancellation survey still send, which is the part that must not be
    // lost to a config problem.
    // "Too expensive" gets the 50% offer the cancel modal made them, not 25%.
    const offer = transition.cancellationDetails?.feedback === 'too_expensive' ? 'price' : 'save';
    let saveUrl: string | null = null;
    try {
      saveUrl = deps.buildSaveUrl(member.id, offer);
    } catch {
      saveUrl = null;
    }
    return sendAcknowledgment(
      member,
      transition.subscriptionId,
      {
        periodEndIso: transition.periodEndIso,
        saveUrl,
        conversionChargePending: transition.conversionChargePending,
        trialing: transition.trialing === true,
        cancellationFeedback: transition.cancellationDetails?.feedback ?? null,
        cancellationComment: transition.cancellationDetails?.comment ?? null,
        savePercent: offer === 'price' ? PRICE_SAVE_PERCENT : SAVE_PERCENT,
      },
      deps,
    );
  }

  if (transition.previous === 1 && transition.next === 0) {
    getDb()
      .prepare(
        `UPDATE users SET cancel_ack_email_sent_at = NULL, updated_at = ?
         WHERE id = ? AND cancel_ack_email_sent_at IS NOT NULL`,
      )
      .run(deps.nowIso(), member.id);
    return 'released';
  }

  return 'no_transition';
}

// A cancel that ended the subscription on the spot because its payment had
// already failed: cancelNowAndVoid in core/pastDueCancel.ts, run by the in-app
// cancel flow (app/api/billing/cancel-flow).
export type EndedCancel = {
  subscriptionId: string;
  // No payment ever cleared on this subscription (subscriptionPaidAt in
  // core/subscriberBucket.ts is null): a trial whose first charge was declined.
  // Only first-time members get a trial, so this member has never paid at all.
  neverPaid: boolean;
  // Its unpaid bill was voided and nothing was left open (billWasVoided), so
  // nothing more can be charged. The email promises that only when this is true.
  billVoided: boolean;
  // The reason the member gave in the cancel modal.
  cancellationDetails?: CancellationDetails;
};

// Records and acknowledges an ended cancel: the same stripe_cancellation_requested
// row a scheduled cancel writes, so every reader counts it with its reason, plus
// a note that the plan ended now and whether the bill was voided, which the
// operator's cancellation alert reports; and the cancellation email in its
// failed-payment version.
//
// No latch, unlike the 0→1 path. The webhook needs one because Stripe can
// deliver the transition more than once; this runs once per click, after a
// Stripe cancel that succeeds only once per subscription. Claiming it here would
// race the customer.subscription.deleted event the cancel just triggered, whose
// markSubscriptionEnded releases it: a claim landing after that release would
// outlive the subscription and swallow the member's next acknowledgment.
//
// No save link either: app/save un-cancels a live subscription, and this one has
// ended.
export async function acknowledgeEndedCancel(
  member: { id: string; email: string },
  cancel: EndedCancel,
  deps: Pick<CancelAckDeps, 'send' | 'audit'>,
): Promise<'sent' | 'send_failed'> {
  auditCancellationRequested(member, cancel.subscriptionId, cancel.cancellationDetails, deps, {
    billVoided: cancel.billVoided,
  });
  return sendAcknowledgment(
    member,
    cancel.subscriptionId,
    {
      periodEndIso: null,
      saveUrl: null,
      conversionChargePending: false,
      trialing: false,
      cancellationFeedback: cancel.cancellationDetails?.feedback ?? null,
      cancellationComment: cancel.cancellationDetails?.comment ?? null,
      savePercent: SAVE_PERCENT,
      paymentFailed: { neverPaid: cancel.neverPaid, billVoided: cancel.billVoided },
    },
    deps,
  );
}
