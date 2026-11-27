// A plan change the Stripe billing portal is holding until period end, and why
// a cancel has to clear it first.
//
// The portal holds every downgrade (a cheaper price, or a shorter billing
// period) until the end of the current period (schedule_at_period_end,
// scripts/setup-billing-portal.mts). To hold it, Stripe attaches a subscription
// schedule to the subscription ("it creates and attaches a subscription
// schedule to the subscription", docs.stripe.com/customer-management/
// configure-portal). While one is attached, Stripe refuses to set the
// subscription's cancellation through the Subscriptions API: "The subscription
// is managed by the subscription schedule ..., and updating any cancelation
// behavior directly is not allowed. Please update the schedule instead."
//
// So a member who scheduled, say, Pro -> Basic in the portal could not cancel
// from the Account page until the switch took effect: every click came back
// "Something went wrong", and the portal's own Cancel is turned off. A member
// who couldn't cancel for two hours most likely hit this (docs/outreach/
// 2026-11-26-nolan-trial-refund-sandro-cancel-blocked.md).
//
// A cancel makes the waiting change moot: the plan ends at period end, which is
// when the change would have applied. So the cancel releases the schedule
// first. A release "will stop scheduling of its phases, but leave any existing
// subscription in place" (Stripe API reference): the subscription stays on its
// current price, with nothing charged or prorated, and the cancel that follows
// ends it at period end. Never the schedule's /cancel, which cancels the
// subscription itself on the spot.
//
// The one thing lost is the waiting change. A member who later takes the cancel
// back ("Keep my plan") renews on the plan they have now, not the one they had
// scheduled, and makes the switch again in the portal. The audit rows name the
// released schedule, so support can tell.
//
// Pure apart from the one Stripe call, which goes through a narrow interface so
// tests can fake it (tests/pendingPlanChange.test.ts). No path aliases, so
// scripts/set-cancellation.mts can import it as well as the in-app cancel route.

// A subscription's `schedule` as Stripe delivers it: the schedule's id, the
// expanded object, or null when nothing is attached.
export type ScheduleRef = string | { id?: string | null } | null | undefined;

// The id of the schedule holding a waiting plan change, or null if none is
// attached. Stripe clears `schedule` once a schedule is released or completes,
// so any id here is one that still governs the subscription.
export function pendingScheduleId(subscription: { schedule?: ScheduleRef }): string | null {
  const ref = subscription.schedule;
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  return typeof ref.id === 'string' && ref.id ? ref.id : null;
}

export type ScheduleReleaser = {
  subscriptionSchedules: { release(id: string): Promise<unknown> };
};

// How long to wait after a release before setting the cancel. The release
// sends its own customer.subscription.updated, still showing no cancel. Stripe
// stamps events to the second and doesn't promise to deliver them in order. The
// webhook drops a subscription event older than one it has already applied
// (its ordering guard), but it can't order two from the same second, so a
// release event processed after the cancel's would put the site back to "not
// canceling" while Stripe is canceling. Just over a second puts the cancel's
// event in a later second, where the guard drops a late release event.
export const RELEASE_SETTLE_MS = 1_100;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Release the schedule holding a waiting plan change, if there is one, so the
// subscription's cancellation can be set, then wait RELEASE_SETTLE_MS. Returns
// the released schedule's id, or null when none was attached (no Stripe call
// and no wait then). Throws what Stripe throws: the caller has not changed
// anything yet and can say so.
//
// After this, leave cancel_at_period_end on the users row to the webhook. The
// release's own event can land after a local write of 1, read as an un-cancel
// (1→0), clear the cancellation email's latch, and let the cancel's event send
// that email after all. The in-app cancel never writes it, and
// scripts/set-cancellation.mts holds the email it promises not to send.
export async function releasePendingPlanChange(
  stripe: ScheduleReleaser,
  subscription: { schedule?: ScheduleRef },
  sleep: (ms: number) => Promise<void> = wait,
): Promise<string | null> {
  const scheduleId = pendingScheduleId(subscription);
  if (!scheduleId) return null;
  await stripe.subscriptionSchedules.release(scheduleId);
  await sleep(RELEASE_SETTLE_MS);
  return scheduleId;
}
