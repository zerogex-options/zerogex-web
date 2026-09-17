// The query behind the returning-member wall: when did this account's paid
// access actually end, and did they say why on the way out?
//
// Split from core/returningMember.ts (which stays pure and import-free) the same
// way core/excludedAccountsServer.ts is split from core/excludedAccounts.ts. Not
// marked `server-only` for the same reason that module isn't — keeping the guard
// off means a script running under bare Node can reuse it — but it is server
// code: it opens the SQLite DB through ./db.ts.

import { getDb } from './db.ts';
import {
  parseCancellationReasonFromMessage,
  type ParsedCancellationReason,
} from './cancellationReason.ts';

export type ChurnContext = {
  // ISO timestamp of the account's MOST RECENT departure, or null when there is
  // no deletion on record. Most-recent, not first: a member who churned, came
  // back and churned again should be measured from the latest exit, exactly as
  // scripts/send-winback.mts anchors its lag window.
  churnedAt: string | null;
  // The Stripe cancellation survey, read back out of the audit message that
  // core/cancellationReason.ts wrote. Both fields are null when the member
  // cancelled before the survey existed, skipped it, or was cancelled by
  // dunning rather than by choice.
  reason: ParsedCancellationReason;
};

const EMPTY: ChurnContext = { churnedAt: null, reason: { feedback: null, comment: null } };

/**
 * Churn context for one account, or an all-null result when none is on record.
 *
 * Deliberately total: every failure — no such user, no deletion event, an
 * unreadable DB — returns EMPTY rather than throwing. Every caller is a page
 * that must still render, and the correct degradation is to lose the
 * personalisation, not the page. A null churnedAt makes the highlight selector
 * fall back to "everything, newest first, nothing claimed as new"
 * (core/winbackHighlights.ts), which reads correctly for a member whose history
 * we can't date.
 */
export function getChurnContext(userId: string): ChurnContext {
  try {
    const row = getDb()
      .prepare(
        `SELECT message, created_at
           FROM audit_events
          WHERE user_id = ? AND type = 'stripe_subscription_deleted'
          ORDER BY created_at DESC
          LIMIT 1`,
      )
      .get(userId) as { message?: string | null; created_at?: string | null } | undefined;

    if (!row?.created_at) return EMPTY;
    return {
      churnedAt: row.created_at,
      reason: parseCancellationReasonFromMessage(row.message ?? ''),
    };
  } catch {
    return EMPTY;
  }
}
