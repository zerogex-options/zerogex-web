// Storage for the free daily levels email. The decision rules live next door
// in core/levelsEmail.ts (pure, unit-tested without a database); this module is
// the only thing that touches the levels_subscribers table.
//
// NO `server-only` AND NO '@/' ALIAS, deliberately — the same property
// core/dailyMetrics.ts relies on. Both the send script (a .mts run under
// --experimental-strip-types, outside Next) and the test suite import this
// directly, and either would break on a bundler-only specifier.
//
// Nothing here touches `users`, tiers, Stripe or the lifecycle-email latches. A
// levels subscriber has no account. See the table comment in core/db.ts for why
// that separation is load-bearing rather than merely tidy.

import { randomBytes } from 'crypto';

import { getDb } from './db.ts';
import { SYMBOLS } from './symbols.ts';
import {
  normalizeEmail,
  shouldSendConfirmation,
  verifyLevelsToken,
} from './levelsEmail.ts';

export type LevelsSubscriber = {
  id: string;
  email: string;
  confirmed_at: string | null;
  confirm_sent_at: string | null;
  unsubscribed_at: string | null;
  source: string | null;
  signup_ip: string | null;
  confirm_ip: string | null;
  /** Chosen ticker. Leads their digest's subject, table and paste block. */
  symbol: string;
  created_at: string;
  updated_at: string;
  last_sent_at: string | null;
};

const COLUMNS = `id, email, confirmed_at, confirm_sent_at, unsubscribed_at,
                 source, signup_ip, confirm_ip, symbol, created_at, updated_at, last_sent_at`;

/**
 * Opaque row id. Random rather than sequential because it is what the confirm
 * and unsubscribe links are signed over: a guessable id would let someone
 * enumerate subscribers by walking ids, even though the HMAC still stops them
 * forging a usable link. 16 bytes is 128 bits.
 */
function mintId(): string {
  return `lvl_${randomBytes(16).toString('hex')}`;
}

/**
 * Ticker a subscriber's digest is built around.
 *
 * Validated against the shared SYMBOLS registry rather than a second list, so
 * a ticker added there is immediately choosable here. Falls back to SPX, NOT
 * to core/symbols' DEFAULT_SYMBOL (SPY): that default is "what a signed-in
 * member lands on", which is a different question from "what does an
 * anonymous reader of these SEO pages care about" — and the answer to the
 * second is overwhelmingly SPX.
 */
export const DEFAULT_LEVELS_SYMBOL = 'SPX';

export function normalizeLevelsSymbol(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return DEFAULT_LEVELS_SYMBOL;
  const upper = raw.trim().toUpperCase();
  return (SYMBOLS as readonly string[]).includes(upper) ? upper : DEFAULT_LEVELS_SYMBOL;
}

/** Longest `source` we will store — a route path, not free text. */
const MAX_SOURCE_LENGTH = 64;

function cleanSource(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, MAX_SOURCE_LENGTH);
  return trimmed || null;
}

export function getLevelsSubscriberById(id: string): LevelsSubscriber | null {
  if (!id) return null;
  const row = getDb()
    .prepare(`SELECT ${COLUMNS} FROM levels_subscribers WHERE id = ?`)
    .get(id) as LevelsSubscriber | undefined;
  return row ?? null;
}

export function getLevelsSubscriberByEmail(email: string): LevelsSubscriber | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const row = getDb()
    .prepare(`SELECT ${COLUMNS} FROM levels_subscribers WHERE email = ?`)
    .get(normalized) as LevelsSubscriber | undefined;
  return row ?? null;
}

/**
 * What the submission did. The caller MUST render the same response to the
 * visitor for every one of these — the distinctions are for the server's own
 * decision about whether to send mail, and for logs. Reporting them to the
 * browser would turn a public endpoint into an oracle for whether a given
 * address reads this site.
 */
export type SubscribeOutcome =
  /** New row written. Send the confirmation. */
  | 'created'
  /** Existing pending row, cooldown elapsed. Send the confirmation again. */
  | 'resent'
  /** Existing pending row, asked again too soon. Send nothing. */
  | 'pending-cooldown'
  /** Already opted in. Send nothing — re-mailing would make this a mailbomb. */
  | 'already-confirmed'
  /** Previously opted out. Send nothing; an opt-out is a standing instruction. */
  | 'unsubscribed';

export type SubscribeResult = {
  outcome: SubscribeOutcome;
  subscriber: LevelsSubscriber;
  /** True only for 'created' and 'resent'. */
  shouldSend: boolean;
};

export type SubscribeInput = {
  email: string;
  /** Chosen ticker; anything unrecognized falls back to SPX. */
  symbol?: string | null;
  source?: string | null;
  ip?: string | null;
  /** Injected for tests; defaults to now. */
  now?: Date;
};

/**
 * Record a subscription request and decide whether a confirmation goes out.
 *
 * Returns null when the address cannot be one — the caller still answers the
 * visitor identically, so a malformed address is not distinguishable from a
 * successful one either.
 *
 * WHY confirm_sent_at IS STAMPED BEFORE THE MAIL IS SENT. The alternative —
 * send first, stamp after — leaves the cooldown unset if the mailer throws
 * midway, and a caller retrying in a loop would deliver a volley to whatever
 * address was typed. Stamping first means a genuine delivery failure costs the
 * visitor one cooldown window; not stamping first means a stranger can be
 * mailed repeatedly. scripts/send-verified-never-paid.mts makes the same
 * choice for the same reason ("stamp the latch FIRST").
 */
export function recordLevelsSubscription(input: SubscribeInput): SubscribeResult | null {
  const email = normalizeEmail(input.email);
  if (!email) return null;

  const db = getDb();
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const source = cleanSource(input.source);
  const symbol = normalizeLevelsSymbol(input.symbol);
  const ip = input.ip ?? null;

  // Insert-or-ignore then read back, rather than SELECT-then-INSERT: two
  // submissions of the same address in the same instant would both see "no
  // row" and the second would hit the UNIQUE index. DO NOTHING makes the
  // loser a no-op and the read below returns whichever row won.
  db.prepare(
    `INSERT INTO levels_subscribers (id, email, symbol, source, signup_ip, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO NOTHING`,
  ).run(mintId(), email, symbol, source, ip, nowIso, nowIso);

  const existing = db
    .prepare(`SELECT ${COLUMNS} FROM levels_subscribers WHERE email = ?`)
    .get(email) as LevelsSubscriber;

  if (existing.confirmed_at) {
    return { outcome: 'already-confirmed', subscriber: existing, shouldSend: false };
  }
  if (existing.unsubscribed_at) {
    return { outcome: 'unsubscribed', subscriber: existing, shouldSend: false };
  }

  const wasJustCreated = existing.created_at === nowIso && existing.confirm_sent_at === null;
  const send = shouldSendConfirmation({
    confirmedAt: existing.confirmed_at,
    confirmSentAt: existing.confirm_sent_at,
    unsubscribedAt: existing.unsubscribed_at,
    nowMs: now.getTime(),
  });

  if (!send) {
    return { outcome: 'pending-cooldown', subscriber: existing, shouldSend: false };
  }

  db.prepare(
    `UPDATE levels_subscribers SET confirm_sent_at = ?, updated_at = ? WHERE id = ?`,
  ).run(nowIso, nowIso, existing.id);

  return {
    outcome: wasJustCreated ? 'created' : 'resent',
    subscriber: { ...existing, confirm_sent_at: nowIso, updated_at: nowIso },
    shouldSend: true,
  };
}

export type ConfirmOutcome = 'confirmed' | 'already-confirmed' | 'invalid' | 'unsubscribed';

/**
 * Complete a double opt-in. Verifies the signed token here rather than trusting
 * the route to have done it, so the check cannot be lost to a refactor.
 *
 * Re-clicking a confirmation link is 'already-confirmed', not an error: mail
 * clients prefetch links, and a scanner following the link must not turn a
 * successful confirmation into a failure the second time.
 */
export function confirmLevelsSubscriber(
  id: string,
  token: string | null | undefined,
  ip?: string | null,
  now: Date = new Date(),
): { outcome: ConfirmOutcome; subscriber: LevelsSubscriber | null } {
  if (!verifyLevelsToken('confirm', id, token)) {
    return { outcome: 'invalid', subscriber: null };
  }
  const existing = getLevelsSubscriberById(id);
  if (!existing) return { outcome: 'invalid', subscriber: null };
  if (existing.unsubscribed_at) {
    // Confirming after opting out would silently restart mail. Refuse.
    return { outcome: 'unsubscribed', subscriber: existing };
  }
  if (existing.confirmed_at) {
    return { outcome: 'already-confirmed', subscriber: existing };
  }

  const nowIso = now.toISOString();
  getDb()
    .prepare(
      `UPDATE levels_subscribers
          SET confirmed_at = ?, confirm_ip = COALESCE(confirm_ip, ?), updated_at = ?
        WHERE id = ?`,
    )
    .run(nowIso, ip ?? null, nowIso, id);

  return {
    outcome: 'confirmed',
    subscriber: { ...existing, confirmed_at: nowIso, confirm_ip: existing.confirm_ip ?? ip ?? null, updated_at: nowIso },
  };
}

export type UnsubscribeOutcome = 'unsubscribed' | 'already-unsubscribed' | 'invalid';

/**
 * Opt out. Idempotent, and COALESCE keeps the ORIGINAL opt-out instant on a
 * repeat click — the same thing app/unsubscribe/route.ts does for account
 * marketing mail, and the honest record of when consent was actually withdrawn.
 */
export function unsubscribeLevelsSubscriber(
  id: string,
  token: string | null | undefined,
  now: Date = new Date(),
): { outcome: UnsubscribeOutcome; subscriber: LevelsSubscriber | null } {
  if (!verifyLevelsToken('unsub', id, token)) {
    return { outcome: 'invalid', subscriber: null };
  }
  const existing = getLevelsSubscriberById(id);
  if (!existing) return { outcome: 'invalid', subscriber: null };
  if (existing.unsubscribed_at) {
    return { outcome: 'already-unsubscribed', subscriber: existing };
  }

  const nowIso = now.toISOString();
  getDb()
    .prepare(
      `UPDATE levels_subscribers
          SET unsubscribed_at = COALESCE(unsubscribed_at, ?), updated_at = ?
        WHERE id = ?`,
    )
    .run(nowIso, nowIso, id);

  return {
    outcome: 'unsubscribed',
    subscriber: { ...existing, unsubscribed_at: nowIso, updated_at: nowIso },
  };
}

/**
 * Everyone the daily digest may be mailed: confirmed, and not opted out.
 *
 * Matches idx_levels_subscribers_sendable exactly. Ordered by created_at so a
 * throttled or --limit-ed run walks the list in a stable order across ticks
 * instead of re-mailing the same prefix.
 */
export function listSendableLevelsSubscribers(limit?: number): LevelsSubscriber[] {
  const sql = `SELECT ${COLUMNS} FROM levels_subscribers
                WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
                ORDER BY created_at ASC${limit != null ? ' LIMIT ?' : ''}`;
  const stmt = getDb().prepare(sql);
  return (limit != null ? stmt.all(limit) : stmt.all()) as LevelsSubscriber[];
}

/** Stamp a successful digest delivery. Best-effort bookkeeping, not a latch. */
export function markLevelsDigestSent(id: string, now: Date = new Date()): void {
  const nowIso = now.toISOString();
  getDb()
    .prepare(`UPDATE levels_subscribers SET last_sent_at = ?, updated_at = ? WHERE id = ?`)
    .run(nowIso, nowIso, id);
}

export type LevelsSubscriberCounts = {
  total: number;
  confirmed: number;
  pending: number;
  unsubscribed: number;
};

/** Headline counts for the admin readout and the send script's preamble. */
export function countLevelsSubscribers(): LevelsSubscriberCounts {
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN confirmed_at IS NOT NULL AND unsubscribed_at IS NULL THEN 1 ELSE 0 END) AS confirmed,
         SUM(CASE WHEN confirmed_at IS NULL AND unsubscribed_at IS NULL THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) AS unsubscribed
       FROM levels_subscribers`,
    )
    .get() as Record<string, number | null>;
  return {
    total: Number(row.total ?? 0),
    confirmed: Number(row.confirmed ?? 0),
    pending: Number(row.pending ?? 0),
    unsubscribed: Number(row.unsubscribed ?? 0),
  };
}
