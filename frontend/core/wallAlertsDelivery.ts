// What the wall-alert email worker does with each queued row — pure, so every
// rule is unit-tested without a database or a mail server
// (tests/wallAlerts.test.ts). scripts/wall-alerts-deliver.mts does the I/O.
//
// Each member's rows become ONE email (up to MAX_ALERTS_PER_EMAIL): SPX and SPY
// walls routinely fire within the same minute, and two emails seconds apart is
// the noise this feature exists to remove. Rows that must not be sent are
// resolved here too, each with the reason an operator will read in
// `make wall-alerts-health`.
//
// NO '@/' ALIAS: imported by a --experimental-strip-types script.

import { AUTH_TIERS, normalizeTier } from './auth.ts';
import type { QueuedWallAlert } from './wallAlertsServer.ts';

export const MAX_ALERTS_PER_EMAIL = 10;

const RANK = new Map<string, number>(AUTH_TIERS.map((t) => [t.id, t.rank]));

/**
 * Does this plan include wall alerts (Basic and up)?
 *
 * By rank directly — NOT core/auth.ts hasTierAccess, which answers true for
 * everyone when NEXT_PUBLIC_AUTH_ENABLED is not '1' (its dev-mode bypass). This
 * runs in a cron script whose environment is whatever .env.local happens to
 * hold; an entitlement check that silently passes on a missing flag would mail
 * lapsed members.
 */
export function tierIncludesWallAlerts(tier: string | null | undefined): boolean {
  return (RANK.get(normalizeTier(tier)) ?? 0) >= (RANK.get('basic') ?? Infinity);
}

export interface DeliveryUser {
  id: string;
  email: string;
  email_verified_at: string | null;
  tier: string | null;
  deleted_at: string | null;
}

export type WallAlertDisposition =
  | { action: 'send'; user: DeliveryUser; rows: QueuedWallAlert[] }
  | { action: 'cancel'; rows: QueuedWallAlert[]; reason: string; purgeUser?: string };

/**
 * Decide every queued row's fate.
 *
 * * **Unknown member** (no `users` row): cancelled, never purged. An unknown id
 *   is as likely a misconfigured AUTH_DB_PATH as a vanished account, and
 *   purging on it would wipe every member's alerts the day the path is wrong.
 * * **Deleted account**: cancelled, and the member's rules are purged — they
 *   asked to be forgotten.
 * * **Plan without wall alerts** (below Basic, e.g. lapsed): cancelled, rules
 *   kept, so alerts resume by themselves if they resubscribe.
 * * **Unverified email**: cancelled. Paid checkout requires verification, so
 *   this is rare, and mailing an unproven address is how a domain earns spam
 *   complaints.
 * * **Duplicates**: a member with overlapping rules (say SPX on two
 *   sensitivities) can have the same wall event queued twice in one pass;
 *   the second is cancelled rather than shown twice in one email.
 */
export function planWallAlertDeliveries(
  rows: readonly QueuedWallAlert[],
  usersById: ReadonlyMap<string, DeliveryUser>,
  maxPerEmail = MAX_ALERTS_PER_EMAIL,
): WallAlertDisposition[] {
  const byUser = new Map<string, QueuedWallAlert[]>();
  for (const row of rows) {
    const list = byUser.get(row.end_user);
    if (list) list.push(row);
    else byUser.set(row.end_user, [row]);
  }

  const out: WallAlertDisposition[] = [];
  for (const [userId, userRows] of byUser) {
    const sorted = [...userRows].sort(
      (a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id - b.id,
    );
    const user = usersById.get(userId);
    if (!user) {
      out.push({ action: 'cancel', rows: sorted, reason: 'unknown recipient' });
      continue;
    }
    if (user.deleted_at) {
      out.push({ action: 'cancel', rows: sorted, reason: 'account deleted', purgeUser: userId });
      continue;
    }
    if (!tierIncludesWallAlerts(user.tier)) {
      out.push({ action: 'cancel', rows: sorted, reason: 'plan does not include wall alerts' });
      continue;
    }
    if (!user.email_verified_at) {
      out.push({ action: 'cancel', rows: sorted, reason: 'email not verified' });
      continue;
    }

    const seen = new Set<string>();
    const unique: QueuedWallAlert[] = [];
    const dupes: QueuedWallAlert[] = [];
    for (const row of sorted) {
      const p = row.payload;
      const key = `${p.symbol}|${p.side}|${p.wall}|${p.kind}`;
      if (seen.has(key)) dupes.push(row);
      else {
        seen.add(key);
        unique.push(row);
      }
    }
    if (dupes.length) out.push({ action: 'cancel', rows: dupes, reason: 'duplicate in batch' });
    for (let i = 0; i < unique.length; i += maxPerEmail) {
      out.push({ action: 'send', user, rows: unique.slice(i, i + maxPerEmail) });
    }
  }
  return out;
}
