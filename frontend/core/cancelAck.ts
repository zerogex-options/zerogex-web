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
// Here rather than inline in the webhook so that lifecycle is tested against
// the real schema (tests/cancelAck.test.ts). Loadable outside Next on purpose
// (no `server-only`, no '@/' alias); the webhook passes in the mailer, the
// save-link builder and its audit writer.

import { getDb } from './db.ts';
import { formatCancellationReasonSuffix, type CancellationDetails } from './cancellationReason.ts';

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
  // Typed with our own structurally-compatible shape (Stripe's enum fields
  // widen to string) so this doesn't depend on the Stripe nested type path.
  cancellationDetails?: CancellationDetails;
};

export type CancelAckDeps = {
  send: (
    to: string,
    opts: { periodEndIso: string | null; saveUrl: string | null; conversionChargePending: boolean },
  ) => Promise<unknown>;
  // The member's signed one-click /save link. Throws when the token secret is
  // unset; the acknowledgment then goes out without the offer.
  buildSaveUrl: (userId: string) => string;
  audit: (event: { type: string; userId: string; email: string; message: string }) => void;
  nowIso: () => string;
};

export type CancelAckOutcome =
  | 'sent'
  | 'send_failed'
  // The latch was already held, so nothing was sent.
  | 'already_acknowledged'
  | 'released'
  | 'no_transition';

export async function handleCancelAckTransition(
  member: { id: string; email: string },
  transition: CancelAckTransition,
  deps: CancelAckDeps,
): Promise<CancelAckOutcome> {
  if (transition.previous === 0 && transition.next === 1) {
    // Fold the portal cancellation survey into the audit message (empty suffix
    // when nothing was collected, so a silent cancel keeps a clean message).
    const reasonSuffix = formatCancellationReasonSuffix(transition.cancellationDetails);
    deps.audit({
      type: 'stripe_cancellation_requested',
      userId: member.id,
      email: member.email,
      message: `Cancellation requested for sub ${transition.subscriptionId}${reasonSuffix}`,
    });
    const stamp = deps.nowIso();
    const claim = getDb()
      .prepare(
        `UPDATE users SET cancel_ack_email_sent_at = ?, updated_at = ?
         WHERE id = ? AND cancel_ack_email_sent_at IS NULL`,
      )
      .run(stamp, stamp, member.id) as { changes: number | bigint };

    if (Number(claim.changes) === 0) return 'already_acknowledged';

    try {
      // One-click self-serve save link (25% off + un-cancel via app/save).
      // Best-effort: if the token secret is unset, buildSaveUrl throws and the
      // email goes out with NO discount offer at all — there is no manual
      // fallback any more (see buildCancellationEmail). The acknowledgment and
      // the cancellation survey still send, which is the part that must not be
      // lost to a config problem.
      let saveUrl: string | null = null;
      try {
        saveUrl = deps.buildSaveUrl(member.id);
      } catch {
        saveUrl = null;
      }
      await deps.send(member.email, {
        periodEndIso: transition.periodEndIso,
        saveUrl,
        conversionChargePending: transition.conversionChargePending,
      });
      deps.audit({
        type: 'cancellation_ack_email_sent',
        userId: member.id,
        email: member.email,
        message: `Sent cancellation ack email for sub ${transition.subscriptionId}`,
      });
      return 'sent';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'cancellation ack email send failed';
      deps.audit({
        type: 'cancellation_ack_email_error',
        userId: member.id,
        email: member.email,
        message: `Cancellation ack email send failed for sub ${transition.subscriptionId}: ${message}`,
      });
      return 'send_failed';
    }
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
