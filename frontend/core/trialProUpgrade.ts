// The two-day Pro upgrade.
//
// A Basic monthly trialer who switches to Pro monthly in the last two days of
// the trial keeps the rest of it free: nothing is charged at the switch, the
// trial ends when it was always going to, and the first charge is Pro's price
// instead of Basic's. They can still cancel any time before then and pay
// nothing. Like any trial conversion, that first charge is not covered by the
// money-back guarantee: the free days were the protection.
//
// Earlier in the trial the switch works as it did before (core/planSwitch.ts
// `in_app_start_paid`): the trial ends and Pro is charged today, under the
// guarantee. Two free days of Pro is the offer; a whole free week of it is the
// Pro trial retired in October 2026 (core/billingPlans.ts).
//
// The window opens when the trial-end reminder can go out, because that email
// is what puts the offer in front of the member (scripts/send-trial-reminders.mts).
// The reminder sends when the trial ends TRIAL_REMINDER_LEAD_HOURS from now,
// give or take half of TRIAL_REMINDER_WINDOW_HOURS, so the upgrade opens at
// the far edge: a member who clicks the moment the email lands is inside it.
//
// Pure (no env, no DB, no Stripe) so tests/trialProUpgrade.test.ts and the
// scripts can import it; relative imports with extensions only.

import type { BillableTier, BillingCadence } from './billingPlans.ts';

const HOUR_MS = 3_600_000;

// The trial-end reminder goes out when the trial ends this many hours from
// now, within a window this wide centered on it.
export const TRIAL_REMINDER_LEAD_HOURS = 48;
export const TRIAL_REMINDER_WINDOW_HOURS = 6;

// How long before the trial ends the two-day upgrade opens: 51 hours.
export const TRIAL_PRO_UPGRADE_OPEN_HOURS = TRIAL_REMINDER_LEAD_HOURS + TRIAL_REMINDER_WINDOW_HOURS / 2;

export type TrialProUpgradeInput = {
  // The subscription's status ('trialing', 'active', ...).
  status: string | null;
  // The plan the subscription is on, or null when its price is not one we sell.
  current: { tier: BillableTier; cadence: BillingCadence } | null;
  // When the trial ends (epoch ms), or null when there is none.
  trialEndMs: number | null;
  nowMs: number;
};

export function trialProUpgradeOpensAtMs(trialEndMs: number): number {
  return trialEndMs - TRIAL_PRO_UPGRADE_OPEN_HOURS * HOUR_MS;
}

// Whether the member can switch to Pro monthly now and keep the rest of the
// trial free. Only from Basic monthly, the one plan sold with a trial.
export function isTrialProUpgradeOpen(input: TrialProUpgradeInput): boolean {
  if (input.status !== 'trialing') return false;
  if (input.current?.tier !== 'basic' || input.current.cadence !== 'monthly') return false;
  if (input.trialEndMs == null || !Number.isFinite(input.trialEndMs)) return false;
  if (input.nowMs >= input.trialEndMs) return false;
  return input.nowMs >= trialProUpgradeOpensAtMs(input.trialEndMs);
}

// Where a "switch to Pro" link sends a signed-in member: the pricing page on
// Pro monthly, which opens the switch for a trialer (with the right terms for
// where they are in the trial: keep the free days, or start paying today) and
// highlights the Pro card for anyone else. `from` records which screen or
// email produced the switch (app/api/billing/change-plan SWITCH_SOURCES).
export const PRO_SWITCH_FROM = ['trial_reminder', 'pro_interest', 'locked_page'] as const;
export type ProSwitchFrom = (typeof PRO_SWITCH_FROM)[number];

export function proSwitchPath(from: ProSwitchFrom): string {
  return `/pricing?plan=pro&cadence=monthly&switch=pro&from=${from}`;
}
