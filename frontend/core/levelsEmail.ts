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

// ── Previous trading session ────────────────────────────────────────────────

/**
 * The NYSE session immediately before `isoDate`, or null when none can be
 * found. Holiday-aware, so the Friday after Thanksgiving resolves back to the
 * Wednesday rather than the closed Thursday.
 *
 * optionsCalendar.ts has an equivalent internal helper, but does not export
 * it; reimplemented here rather than widening that module's public surface
 * for one caller. Pure UTC arithmetic anchored at noon, so no DST transition
 * can shift a subtraction onto the wrong calendar day.
 */
export function previousTradingDay(
  isoDate: string,
  holidays?: NyseHolidayCalendar,
): string | null {
  const start = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const calendar = holidays ?? defaultHolidayCalendar();
  // Ten days bounds the loop. The longest ordinary US market closure is a
  // holiday adjoining a weekend (four days), so ten never truncates a real
  // gap while still terminating on a pathological holiday list.
  for (let i = 1; i <= 10; i += 1) {
    const day = new Date(start.getTime() - i * 86_400_000);
    const iso = day.toISOString().slice(0, 10);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !calendar.has(iso)) return iso;
  }
  return null;
}

// ── Staleness guard ─────────────────────────────────────────────────────────

/** Which session the snapshot the digest is built on actually came from. */
export type FreshnessBasis = 'current-session' | 'prior-session';

export type FreshnessInput = {
  /** GexSummary.timestamp for the symbol, as the API returned it. */
  snapshotTimestamp: string | null | undefined;
  /** ET session the digest is about — the one checkSendWindow resolved. */
  sessionDate: string;
  /** Evaluation time, for the age calculation. */
  now: Date;
  holidays?: NyseHolidayCalendar;
  /**
   * Optional extra ceiling on snapshot age, in hours. OFF by default, and
   * almost certainly not what you want — see the note on the ceiling below.
   */
  maxAgeHours?: number;
};

export type FreshnessVerdict =
  | { fresh: true; basis: FreshnessBasis; snapshotDate: string; ageMinutes: number }
  | {
      fresh: false;
      reason: 'missing' | 'unparseable' | 'stale-date' | 'too-old' | 'future';
      snapshotDate: string | null;
      ageMinutes: number | null;
    };

/**
 * Is this snapshot the one the digest is entitled to send?
 *
 * WHY THIS IS NOT "IS IT FROM TODAY". Measured against the live API, the GEX
 * summary tracks regular trading hours: the last stamp of a session lands
 * around 15:59 ET and does not move again until the next session. So before
 * the open there IS no snapshot from the current date, and demanding one
 * would abort every single send — safe, and useless.
 *
 * That is also the correct product rather than a compromise. A pre-open
 * positioning map is computed from the prior close's chain, because until the
 * new session trades there is no newer chain to compute from.
 *
 * So the question is whether the snapshot is one of the two sessions it is
 * allowed to be — the current one, or the one immediately before it — and
 * never anything older. A feed frozen since Thursday fails on a Monday,
 * because Monday's permitted prior session is Friday.
 *
 * The verdict reports WHICH session it matched, because the caller must label
 * the email with the snapshot's real timestamp. The levels pages set that
 * convention (gammaLevels.tsx renders "As of <fmtTimestampET>") and the email
 * must not contradict the page a reader can go and check.
 *
 * ON THE AGE CEILING. There is deliberately no default. Friday 15:59 ET to
 * Monday 08:45 ET is ~65 hours, and ~89 across a holiday long weekend, so any
 * ceiling tight enough to catch a stale feed would reject correct sends every
 * Monday. The session-date anchor above is strictly stronger and already
 * holiday-aware; maxAgeHours remains only for a caller that wants an explicit
 * extra bound on the current-session case.
 */
export function checkFreshness(input: FreshnessInput): FreshnessVerdict {
  if (!input.snapshotTimestamp) {
    return { fresh: false, reason: 'missing', snapshotDate: null, ageMinutes: null };
  }
  const ms = Date.parse(input.snapshotTimestamp);
  if (!Number.isFinite(ms)) {
    return { fresh: false, reason: 'unparseable', snapshotDate: null, ageMinutes: null };
  }

  const ageMinutes = Math.round((input.now.getTime() - ms) / 60_000);
  // Compared on the ET calendar, not UTC: a 20:00 ET stamp is already the next
  // day in UTC and would otherwise read as a session ahead of itself.
  const snapshotDate = etParts(new Date(ms)).date;

  // A snapshot from the future is a clock fault somewhere. Five minutes
  // absorbs ordinary skew between the API host and this one.
  if (ageMinutes < -5) {
    return { fresh: false, reason: 'future', snapshotDate, ageMinutes };
  }

  const prior = previousTradingDay(input.sessionDate, input.holidays);
  let basis: FreshnessBasis | null = null;
  if (snapshotDate === input.sessionDate) basis = 'current-session';
  else if (prior && snapshotDate === prior) basis = 'prior-session';

  if (!basis) {
    return { fresh: false, reason: 'stale-date', snapshotDate, ageMinutes };
  }

  if (input.maxAgeHours != null && ageMinutes > input.maxAgeHours * 60) {
    return { fresh: false, reason: 'too-old', snapshotDate, ageMinutes };
  }

  return { fresh: true, basis, snapshotDate, ageMinutes };
}
