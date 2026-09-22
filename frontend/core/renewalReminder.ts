// When to remind a member that a quarterly or annual plan is about to renew.
//
// Prepaid plans renew for a lot of money at once, months after the member last
// thought about it, which is exactly what state automatic-renewal laws target:
// several require a notice ahead of the renewal of a long-term plan (commonly
// 15–45 days for a year, 30–60 in a few states), and it is simply the honest
// way to bill someone $299. The pricing page promises it ("before a quarterly
// or annual plan renews, we email you a reminder").
//
//   annual     30 days before renewal — inside every state window we know of
//              for a one-year term.
//   quarterly   7 days before — enough time to cancel from the Account page.
//   monthly    none — the renewal is small, frequent and expected.
//
// Have counsel confirm the windows for the states you sell into; they are one
// constant each.
//
// Latched per billing period (users.renewal_reminder_sent_for holds the
// current_period_end it was sent for), so a daily run that fires late still
// sends exactly once per renewal, and the next period re-arms by itself.
//
// Pure (no imports beyond a type) — tests/renewalReminder.test.ts.

import type { BillingCadence } from './billingPlans.ts';

export const RENEWAL_REMINDER_LEAD_DAYS: Record<BillingCadence, number | null> = {
  monthly: null,
  quarterly: 7,
  annual: 30,
};

const DAY_MS = 86_400_000;

export type RenewalReminderInput = {
  cadence: BillingCadence | null;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  // users.current_period_end (ISO) — when the renewal charge will be attempted.
  periodEndIso: string | null;
  // users.renewal_reminder_sent_for — the period end a reminder already went out for.
  sentForIso: string | null;
  nowMs: number;
};

export function isRenewalReminderDue(input: RenewalReminderInput): boolean {
  if (!input.cadence) return false;
  const lead = RENEWAL_REMINDER_LEAD_DAYS[input.cadence];
  if (lead == null) return false;
  // Only a live, renewing subscription. A trial's period end is its conversion
  // (the trial reminder covers that); a scheduled cancel will not renew.
  if (input.status !== 'active' || input.cancelAtPeriodEnd) return false;
  if (!input.periodEndIso) return false;
  const periodEndMs = Date.parse(input.periodEndIso);
  if (!Number.isFinite(periodEndMs)) return false;
  if (input.sentForIso === input.periodEndIso) return false;
  const untilMs = periodEndMs - input.nowMs;
  return untilMs > 0 && untilMs <= lead * DAY_MS;
}
