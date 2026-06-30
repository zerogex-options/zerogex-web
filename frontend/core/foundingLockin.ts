// Cutoff after which the founding-rate lock-in reminder modal stops showing
// to everyone, regardless of dismissal state. Anchored to 09:30 America/New_York
// on July 1 — the market open. July is in EDT (UTC−4), so 09:30 ET = 13:30 UTC.
export const FOUNDING_LOCKIN_DEADLINE_ISO = '2026-07-01T13:30:00.000Z';

// Display label for the deadline; kept next to the ISO so they can't drift.
export const FOUNDING_LOCKIN_DEADLINE_LABEL = 'July 1, 9:30 AM ET';

// Single source of truth for "first-charge date" copy on the founding flow.
// Matches the calendar date the checkout API sets as trial_end (derived from
// FOUNDING_LOCKIN_DEADLINE_ISO above, rendered in America/New_York).
export const FOUNDING_BILLING_START_LABEL = 'July 1, 2026';

// One central gate for "is the founding lock-in offer still open?" — used by
// every surface that mentions the founding rate (modal, /founding page,
// checkout API, recovery-email cron) so they all flip together at the deadline
// instead of needing per-call-site `Date.now()` comparisons.
export function isFoundingLockinOpen(now: number = Date.now()): boolean {
  const deadlineMs = Date.parse(FOUNDING_LOCKIN_DEADLINE_ISO);
  return Number.isFinite(deadlineMs) && now < deadlineMs;
}
