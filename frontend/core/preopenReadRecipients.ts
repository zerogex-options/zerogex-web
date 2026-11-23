// The database side of Today's Read by email (scripts/send-preopen-read.mts):
// who gets it, the per-day latch, and the stop link's write.
//
// WHO. Every member with paid-tier access: tier basic or pro, account not
// deleted, and not stopped. That is the people who can open the dashboard the
// email links to, so trials are in (it is when "wasn't using it" starts), a
// member whose cancel is scheduled is in until their access ends, and a paused
// member (tier public for the pause) is out until it resumes. Partner and
// comped members hold the tier, so they are in too: this is the product, not a
// growth number, so core/excludedAccounts.ts does not apply.
//
// Relative './x.ts' imports only, so the send script can load it under plain
// `node --experimental-strip-types` as well as Next can.

import { getDb } from './db.ts';

export type PreopenReadRecipient = {
  id: string;
  email: string;
  /** Never sent one before: the email opens by saying what it is. */
  firstSend: boolean;
};

export type PreopenReadAudience = {
  recipients: PreopenReadRecipient[];
  /** Members with access in total. */
  members: number;
  /** Members who clicked "Stop these morning emails". */
  stopped: number;
  /** Members already sent this session's email (a re-run skips them). */
  alreadySent: number;
};

const MEMBER_SQL = `tier IN ('basic', 'pro') AND deleted_at IS NULL AND email IS NOT NULL AND email <> ''`;

export function listPreopenReadRecipients(sessionDate: string, limit?: number): PreopenReadAudience {
  const db = getDb();
  const counts = db
    .prepare(
      `SELECT COUNT(*) AS members,
              SUM(CASE WHEN preopen_read_opt_out_at IS NOT NULL THEN 1 ELSE 0 END) AS stopped,
              SUM(CASE WHEN preopen_read_opt_out_at IS NULL AND preopen_read_last_sent_on = ? THEN 1 ELSE 0 END) AS already_sent
         FROM users
        WHERE ${MEMBER_SQL}`,
    )
    .get(sessionDate) as { members: number; stopped: number | null; already_sent: number | null };

  const rows = db
    .prepare(
      `SELECT id, email, preopen_read_last_sent_on
         FROM users
        WHERE ${MEMBER_SQL}
          AND preopen_read_opt_out_at IS NULL
          AND (preopen_read_last_sent_on IS NULL OR preopen_read_last_sent_on <> ?)
        ORDER BY created_at ASC, id ASC
        ${limit != null ? 'LIMIT ?' : ''}`,
    )
    .all(...(limit != null ? [sessionDate, limit] : [sessionDate])) as Array<{
    id: string;
    email: string;
    preopen_read_last_sent_on: string | null;
  }>;

  return {
    recipients: rows.map((r) => ({ id: r.id, email: r.email, firstSend: r.preopen_read_last_sent_on == null })),
    members: Number(counts?.members ?? 0),
    stopped: Number(counts?.stopped ?? 0),
    alreadySent: Number(counts?.already_sent ?? 0),
  };
}

/** Stamp the latch the moment a member's email is accepted. */
export function markPreopenReadSent(userId: string, sessionDate: string): void {
  getDb()
    .prepare(`UPDATE users SET preopen_read_last_sent_on = ? WHERE id = ?`)
    .run(sessionDate, userId);
}

/**
 * The stop link's write. Idempotent: COALESCE keeps the first stop time on a
 * repeat click. Returns false when there is no such member.
 */
export function stopPreopenRead(userId: string, nowIso = new Date().toISOString()): boolean {
  const result = getDb()
    .prepare(
      `UPDATE users
          SET preopen_read_opt_out_at = COALESCE(preopen_read_opt_out_at, ?),
              updated_at = ?
        WHERE id = ?`,
    )
    .run(nowIso, nowIso, userId) as { changes: number | bigint };
  return Number(result.changes) > 0;
}
