// Who may receive a TradeWorkz trade-alert email.
//
// The backend fans every bot entry and exit out to the bot's followers with no
// plan check, and a follow outlives the plan that made it: a member who churns
// to Public, or deletes the account, still has the row. So the delivery worker
// (scripts/tradeworkz-notify-deliver.mts) decides here, at send time, the same
// way the wall-alert worker does in core/wallAlertsDelivery.ts. The alerts are
// the Pro product itself (direction, entry, target, stop, rationale), so the
// bar is Pro, not Basic.
//
// Pure, so the rule is pinned by tests/tradeworkzDelivery.test.ts.

import { AUTH_TIERS, normalizeTier } from './auth.ts';

export interface TradeworkzRecipient {
  id: string;
  email: string;
  email_verified_at: string | null;
  tier: string | null;
  deleted_at: string | null;
}

const RANK = new Map<string, number>(AUTH_TIERS.map((t) => [t.id, t.rank]));

export function tierIncludesTradeworkzAlerts(tier: string | null | undefined): boolean {
  return (RANK.get(normalizeTier(tier)) ?? 0) >= (RANK.get('pro') ?? Infinity);
}

/**
 * Why this queued alert must not be emailed, or null when it may be. The
 * reason is recorded on the row, so it is written for the operator.
 */
export function tradeworkzSkipReason(user: TradeworkzRecipient | undefined): string | null {
  if (!user) return 'unknown recipient';
  if (user.deleted_at) return 'account deleted';
  if (!tierIncludesTradeworkzAlerts(user.tier)) return 'plan does not include TradeWorkz alerts';
  if (!user.email_verified_at) return 'unverified recipient';
  return null;
}
