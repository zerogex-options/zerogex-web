// Pure decision logic for the IN-APP cancellation retention flow
// (app/api/billing/cancel-flow/route.ts + components/CancelRetentionModal). The
// flow intercepts a member at the moment of cancel intent — before they ever
// reach Stripe's one-click portal cancel — and offers to keep them: 25% off for a
// year, or, if they decline, an in-app cancel that still captures WHY.
//
// Kept PURE (no imports at all) so the eligibility and accounting decisions are
// unit-tested without a database or Stripe — the same discipline as
// core/paymentGrace.ts and core/cancellationReason.ts. Feedback-enum validation
// and comment sanitization live in core/cancellationReason.ts (the reason
// vocabulary's home); the route composes the two. Locked down in
// tests/cancelRetention.test.ts.

export type RetentionOfferInput = {
  // The member's Stripe subscription id, or null when none is on file.
  subscriptionId: string | null;
  // Last-synced Stripe status.
  subscriptionStatus: string | null;
  // users.retention_offer_claimed_at — the one-shot latch. Non-null once the
  // member has already claimed the save discount (email-save or in-app), so it
  // can never be offered a second time.
  retentionOfferClaimedAt: string | null;
};

// Only a LIVE subscription can be offered the save discount: a trial about to
// convert, or an active payer (including one who already scheduled a cancel and
// is now being talked out of it). A past_due/canceled sub is handled by the
// payment-update / resubscribe paths, not the retention offer.
const OFFERABLE_STATUSES = new Set(['trialing', 'active']);

// Can we still present the 25%-off save offer to this member? False when there's
// no subscription, when the one-shot offer was already claimed, or when the sub
// isn't in an offerable state. The route enforces this server-side; the modal
// reads the same signal so the two never disagree.
export function canOfferRetentionDiscount(input: RetentionOfferInput): boolean {
  if (!input.subscriptionId) return false;
  if (input.retentionOfferClaimedAt) return false;
  return OFFERABLE_STATUSES.has(input.subscriptionStatus ?? '');
}

export type DiscountAudit = {
  // The audit_events.type to write when the save discount is applied.
  type: string;
  // Whether this save nets out a cancellation the growth-rate dashboard has
  // already COUNTED (see below).
  offsetsCountedCancellation: boolean;
};

// Which audit event a discount acceptance writes — the crux of keeping the
// growth-rate dashboard honest:
//
//   • The member was ALREADY scheduled to cancel (cancel_at_period_end=1) — e.g.
//     they canceled earlier via the portal/email and are now un-canceling.
//     Clearing that is a genuine WIN-BACK save. core/monitoring buildGrowthRates
//     already counted their cancellation and nets saves back out by matching
//     'billing_winback_discount_honored' rows carrying the phrase
//     "cleared cancel_at_period_end". Emit exactly that so the net rate stays
//     correct.
//
//   • The member was intercepted BEFORE any cancel (cancel_at_period_end=0). No
//     cancellation was ever recorded, so there is nothing to net out. Emitting
//     the win-back type here would add a phantom offset and INFLATE net growth by
//     one. Use a distinct type the dashboard does not treat as an offset.
export function discountAuditType(wasCancelling: boolean): DiscountAudit {
  return wasCancelling
    ? { type: 'billing_winback_discount_honored', offsetsCountedCancellation: true }
    : { type: 'billing_retention_offer_accepted', offsetsCountedCancellation: false };
}
