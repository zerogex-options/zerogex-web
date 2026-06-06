// Cutoff after which the founding-rate lock-in reminder modal stops showing
// to everyone, regardless of dismissal state. Anchored to 09:30 America/New_York
// on July 1 — the market open. July is in EDT (UTC−4), so 09:30 ET = 13:30 UTC.
export const FOUNDING_LOCKIN_DEADLINE_ISO = '2026-07-01T13:30:00.000Z';

// Display label for the deadline; kept next to the ISO so they can't drift.
export const FOUNDING_LOCKIN_DEADLINE_LABEL = 'July 1, 9:30 AM ET';
