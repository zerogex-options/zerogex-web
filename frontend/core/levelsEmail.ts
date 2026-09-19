// Pure decision logic + token minting for the free DAILY LEVELS EMAIL — the
// pre-open digest an anonymous visitor can subscribe to from the public
// /<ticker>-gamma-levels pages.
//
// WHY THIS EXISTS. Until this shipped there was no way for an anonymous
// visitor to leave an address anywhere on the site outside the auth flow. The
// free levels pages take the overwhelming majority of the organic
// impressions, and every one of those sessions was a one-shot: read the
// numbers, leave, unreachable forever. This module is the decision half of
// the fix. It owns WHETHER to send and WHAT a link is allowed to prove; the
// storage half is core/levelsSubscribers.ts and the delivery half is
// scripts/send-daily-levels.mts.
//
// DELIBERATELY NOT A USER ACCOUNT. A levels subscriber is not a `users` row
// and carries no tier. ~20 sites across billing and lifecycle email treat the
// literal string tier='public' as "not a paying customer" — five of them are
// cohort queries that would silently stop matching if signups landed on a new
// tier. Just as important: a `users` row created by this form would
// immediately fall into the verify-reminder, verified-never-paid and
// reactivation cohorts, so somebody who asked for a levels email would start
// receiving "finish verifying your account" and "try the trial". They never
// asked for an account. Keeping this in its own table means this feature
// cannot reach any of that machinery, by construction.
//
// Kept PURE (no DB, no network, no 'server-only') so every rule below is unit
// tested without infrastructure — same discipline as core/trialOffer.ts and
// core/refereeBonus.ts. Locked down in tests/levelsEmail.test.ts.

import { createHmac, timingSafeEqual } from 'crypto';

// Relative, with the explicit .ts extension, NOT the '@/' alias: this module
// is imported by tests running under node --experimental-strip-types, which
// resolves specifiers itself rather than through the Next bundler and cannot
// see the alias. core/auth.ts carries the same note for the same reason.
// optionsCalendar.ts has no imports of its own, so depending on it is safe here.
import {
  buildNyseHolidayCalendar,
  parseNyseHolidays,
  type NyseHolidayCalendar,
} from './optionsCalendar.ts';

// ── Email normalization ─────────────────────────────────────────────────────

// Deliberately permissive. This is a marketing opt-in form, not an identity
// system: the double opt-in below is what actually proves an address works, so
// the only job here is to reject what can never be an address and to canonicalize
// what can, before it reaches the UNIQUE index. Being stricter than this is how
// you end up bouncing real addresses at unusual TLDs for no benefit — the
// confirmation email is the real filter.
//
// Rules: one @, non-empty local part, a dot-bearing domain, no whitespace, no
// angle brackets or commas (a pasted "Name <a@b.com>" or a comma-separated
// list is a mistake, not an address), and a length ceiling well above RFC 5321's
// 254 practical limit being pointless to exceed.
const MAX_EMAIL_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

/**
 * Canonical storage form of an address, or null when it cannot be one.
 *
 * Lowercased because the UNIQUE index must treat Foo@x.com and foo@x.com as
 * one subscriber — otherwise the same human subscribes twice and gets two
 * copies of every send. Note this lowercases the LOCAL part too, which is
 * technically case-sensitive per RFC 5321; in practice no mail provider in use
 * treats it that way, and the alternative (two rows, two emails, one annoyed
 * reader) is the worse failure.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > MAX_EMAIL_LENGTH) return null;
  if (!EMAIL_SHAPE.test(trimmed)) return null;
  return trimmed;
}

// ── Signed links ────────────────────────────────────────────────────────────
//
// Both the confirm link and the unsubscribe link are HMACs over the
// subscriber's opaque row id — NOT over their email address. Keying on the id
// keeps the address out of the URL, and therefore out of nginx access logs,
// browser history and any Referer header the confirmation page emits. This
// mirrors core/unsubToken.ts, which keys on users.id for the same reason.
//
// The two purposes are namespaced so a token minted for one can never be
// replayed as the other: an unsubscribe link forwarded to a mailing list must
// not be able to CONFIRM a subscription nobody asked for.
//
// Reuses ZEROGEX_END_USER_TOKEN_SECRET rather than introducing another secret
// to deploy, rotate and forget — same choice core/unsubToken.ts made.

export type LevelsTokenPurpose = 'confirm' | 'unsub';

function secret(): string {
  const s = process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  if (!s) throw new Error('ZEROGEX_END_USER_TOKEN_SECRET is not set');
  return s;
}

export function levelsToken(purpose: LevelsTokenPurpose, subscriberId: string): string {
  return createHmac('sha256', secret())
    .update(`levels:${purpose}:v1:${subscriberId}`)
    .digest('base64url');
}

export function verifyLevelsToken(
  purpose: LevelsTokenPurpose,
  subscriberId: string,
  token: string | null | undefined,
): boolean {
  if (!subscriberId || !token) return false;
  const expected = Buffer.from(levelsToken(purpose, subscriberId));
  const given = Buffer.from(token);
  // Length check first: timingSafeEqual throws on a length mismatch rather
  // than returning false, and a wrong-length token is not a secret worth
  // protecting with a constant-time compare anyway.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function joinUrl(appUrl: string, path: string, params: Record<string, string>): string {
  const base = appUrl.replace(/\/+$/, '');
  const qs = new URLSearchParams(params).toString();
  return `${base}${path}?${qs}`;
}

export function buildLevelsConfirmUrl(appUrl: string, subscriberId: string): string {
  return joinUrl(appUrl, '/levels-email/confirm', {
    s: subscriberId,
    t: levelsToken('confirm', subscriberId),
  });
}

export function buildLevelsUnsubUrl(appUrl: string, subscriberId: string): string {
  return joinUrl(appUrl, '/levels-email/unsubscribe', {
    s: subscriberId,
    t: levelsToken('unsub', subscriberId),
  });
}

// ── Confirmation re-send policy ─────────────────────────────────────────────

/** How long before the same unconfirmed address may be mailed another confirm. */
export const CONFIRM_RESEND_COOLDOWN_MS = 15 * 60 * 1000;

export type ConfirmSendInput = {
  /** ISO instant the subscription was confirmed, or null when still pending. */
  confirmedAt: string | null;
  /** ISO instant the last confirmation email went out, or null when none has. */
  confirmSentAt: string | null;
  /** ISO instant the subscriber opted out, or null. */
  unsubscribedAt: string | null;
  /** Evaluation time (epoch ms). */
  nowMs: number;
  cooldownMs?: number;
};

/**
 * Should this submission trigger a confirmation email?
 *
 * The three noes matter as much as the yes, and each one closes an abuse path
 * that a public, unauthenticated form is guaranteed to meet:
 *
 *   • ALREADY CONFIRMED  → never. Otherwise the form is a mailbomb: type a
 *     stranger's address repeatedly and we deliver the volley for you.
 *   • ALREADY UNSUBSCRIBED → never. An opt-out is a standing instruction; a
 *     third party must not be able to restart mail to that address by
 *     re-submitting it. Re-subscribing is a support request, on purpose.
 *   • WITHIN COOLDOWN → not yet. Bounds the same-address volley to one email
 *     per window while a genuine "I didn't get it, resend" still works.
 *
 * The caller must return an identical response to the visitor in all four
 * cases. Saying "already subscribed" would turn this endpoint into an address
 * oracle for whoever wants to know if someone reads this site.
 */
export function shouldSendConfirmation(input: ConfirmSendInput): boolean {
  if (input.confirmedAt) return false;
  if (input.unsubscribedAt) return false;
  if (!input.confirmSentAt) return true;
  const cooldown = input.cooldownMs ?? CONFIRM_RESEND_COOLDOWN_MS;
  const lastMs = Date.parse(input.confirmSentAt);
  // An unparseable stamp is corrupt data, not consent to spam. Treat it as
  // "just sent" and wait out a full cooldown rather than sending now.
  if (!Number.isFinite(lastMs)) return false;
  return input.nowMs - lastMs >= cooldown;
}

// ── Eastern-time calendar helpers ───────────────────────────────────────────

export type EtParts = {
  /** YYYY-MM-DD in America/New_York. */
  date: string;
  /** 0-23 in America/New_York. */
  hour: number;
  /** 0-59 in America/New_York. */
  minute: number;
  /** Minutes since ET midnight — the comparable form for window checks. */
  minutesOfDay: number;
  /** 0=Sunday … 6=Saturday, in America/New_York. */
  weekday: number;
};

const ET_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hour12: false,
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Wall-clock Eastern time for an instant — DST-correct, because Intl resolves
 * the offset for that specific date rather than assuming a fixed one.
 *
 * Everything scheduling-related here goes through this instead of arithmetic
 * on UTC hours. The repo already learned this lesson: the timers that hardcode
 * a UTC hour drift by an hour twice a year (see the "~12:40 PM ET in summer /
 * 11:40 AM ET in winter" comments on the reactivation and winback units). A
 * pre-open email cannot drift — an hour late is after the open.
 */
export function etParts(date: Date): EtParts {
  const parts = Object.fromEntries(
    ET_DATE_FMT.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  // Intl renders midnight as hour "24" in some ICU versions; normalize to 0-23.
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
    weekday: WEEKDAY_INDEX[parts.weekday] ?? -1,
  };
}

/** Default holiday calendar, read from NEXT_PUBLIC_NYSE_HOLIDAYS. */
export function defaultHolidayCalendar(): NyseHolidayCalendar {
  return buildNyseHolidayCalendar(
    parseNyseHolidays(
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_NYSE_HOLIDAYS : undefined,
    ),
  );
}

/**
 * Is this ET calendar date a NYSE session?
 *
 * Weekends are structural; holidays come from the operator-maintained
 * NEXT_PUBLIC_NYSE_HOLIDAYS list the header badge already uses. An UNSET
 * holiday list means every weekday looks like a session — which is why the
 * staleness guard below is the real backstop and this is only the cheap first
 * filter. On a holiday there is no new session, so the levels the API serves
 * are the previous session's; mailing them under today's date is the exact
 * failure this exists to prevent.
 */
export function isTradingDay(isoDate: string, holidays?: NyseHolidayCalendar): boolean {
  // Parse as UTC noon: the string is already an ET calendar date, and midday
  // avoids any chance of a timezone shift moving it to the adjacent day.
  const dt = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return false;
  const weekday = dt.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const calendar = holidays ?? defaultHolidayCalendar();
  return !calendar.has(isoDate);
}

// ── Send-window guard ───────────────────────────────────────────────────────
//
// systemd's Persistent=true replays a missed timer as soon as the box is back.
// That is right for a weekly win-back digest and WRONG here: a pre-open email
// fired at 14:00 because the host rebooted would carry mid-session numbers
// under a "before the open" subject. The units for this feature therefore set
// Persistent=false, and this window is the second lock — a manual run, a
// mis-set OnCalendar or a badly-timed retry all get refused rather than
// mailing the list at the wrong hour.
//
// Precedent: scripts/send-signup-alarm.mts enforces its active hours in the
// script, ET and DST-correct, for the same reason.

/** Earliest ET minute-of-day the digest may go out (08:30). */
export const SEND_WINDOW_START_MIN = 8 * 60 + 30;
/** Latest ET minute-of-day the digest may go out (09:25 — five before the open). */
export const SEND_WINDOW_END_MIN = 9 * 60 + 25;

export type SendWindowInput = {
  now: Date;
  startMin?: number;
  endMin?: number;
  holidays?: NyseHolidayCalendar;
};

export type SendWindowVerdict =
  | { ok: true; sessionDate: string }
  | { ok: false; reason: 'not-a-trading-day' | 'outside-window'; sessionDate: string; clock: string };

/**
 * May the digest send right now? Inclusive of both bounds so a tick landing
 * exactly on 08:30 ET is not silently dropped.
 */
export function checkSendWindow(input: SendWindowInput): SendWindowVerdict {
  const et = etParts(input.now);
  const clock = `${String(et.hour).padStart(2, '0')}:${String(et.minute).padStart(2, '0')} ET`;
  if (!isTradingDay(et.date, input.holidays)) {
    return { ok: false, reason: 'not-a-trading-day', sessionDate: et.date, clock };
  }
  const start = input.startMin ?? SEND_WINDOW_START_MIN;
  const end = input.endMin ?? SEND_WINDOW_END_MIN;
  if (et.minutesOfDay < start || et.minutesOfDay > end) {
    return { ok: false, reason: 'outside-window', sessionDate: et.date, clock };
  }
  return { ok: true, sessionDate: et.date };
}

// ── Staleness guard ─────────────────────────────────────────────────────────

export type FreshnessInput = {
  /** GexSummary.timestamp for the symbol, as the API returned it. */
  snapshotTimestamp: string | null | undefined;
  /** ET session date the send is claiming to be about (from checkSendWindow). */
  sessionDate: string;
  /** Evaluation time, for the age calculation. */
  now: Date;
  /** Reject a snapshot older than this many hours even when the date matches. */
  maxAgeHours?: number;
};

export type FreshnessVerdict =
  | { fresh: true; ageMinutes: number }
  | { fresh: false; reason: 'missing' | 'unparseable' | 'stale-date' | 'too-old'; ageMinutes: number | null };

/**
 * Default age ceiling. Generous on purpose: the exact pre-open update cadence
 * of the ingestion backend is not knowable from this repo, so this is a
 * backstop against a frozen feed, not a precision instrument. The date check
 * below is the primary guard; calibrate this against real --dry-run output
 * before relying on the number.
 */
export const DEFAULT_MAX_SNAPSHOT_AGE_HOURS = 20;

/**
 * Is this snapshot actually about the session we are claiming?
 *
 * serverApiGet serves a last-good cached value when the backend is unreachable,
 * and the levels pages hold a last-good snapshot in process memory on purpose —
 * both correct for a web page, both catastrophic for an email. A page showing a
 * slightly stale number is a page; an email asserting yesterday's flip as
 * "today's", every morning, silently, destroys the only thing this channel has.
 *
 * So the test is not "did we get data" but "is this data FROM the session we
 * are naming". A failure here aborts the whole send rather than mailing a
 * partial or hedged digest.
 */
export function checkFreshness(input: FreshnessInput): FreshnessVerdict {
  if (!input.snapshotTimestamp) return { fresh: false, reason: 'missing', ageMinutes: null };
  const ms = Date.parse(input.snapshotTimestamp);
  if (!Number.isFinite(ms)) return { fresh: false, reason: 'unparseable', ageMinutes: null };

  const ageMinutes = Math.round((input.now.getTime() - ms) / 60_000);
  // The snapshot's own ET calendar date must be the session we are naming.
  // Compared in ET rather than UTC because a 20:00 ET timestamp is already
  // "tomorrow" in UTC, and would otherwise read as a day ahead.
  const snapshotEtDate = etParts(new Date(ms)).date;
  if (snapshotEtDate !== input.sessionDate) {
    return { fresh: false, reason: 'stale-date', ageMinutes };
  }
  const maxAge = (input.maxAgeHours ?? DEFAULT_MAX_SNAPSHOT_AGE_HOURS) * 60;
  if (ageMinutes > maxAge) return { fresh: false, reason: 'too-old', ageMinutes };
  // A snapshot from the future is a clock problem somewhere; -5 minutes of
  // tolerance absorbs ordinary skew without accepting a genuinely wrong stamp.
  if (ageMinutes < -5) return { fresh: false, reason: 'unparseable', ageMinutes };
  return { fresh: true, ageMinutes };
}
