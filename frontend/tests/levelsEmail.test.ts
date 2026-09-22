// Unit tests for core/levelsEmail.ts — the decision layer behind the free
// daily levels email.
//
// Three of these rules exist because getting them wrong is silent rather than
// loud, and each has a specific failure in mind:
//
//   • the send window, because systemd's Persistent=true would otherwise
//     replay a missed pre-open send in the afternoon;
//   • the freshness guard, because serverApiGet serves a last-good cached
//     snapshot when the backend is down, so "we got data" is not "we got
//     TODAY's data";
//   • the confirmation policy, because a public unauthenticated form that
//     re-sends on every submit is a mailbomb pointed at whatever address the
//     submitter types.
//
// Everything is evaluated against injected instants and an injected holiday
// calendar, so no test depends on the wall clock or on NEXT_PUBLIC_NYSE_HOLIDAYS.

import test from 'node:test';
import assert from 'node:assert/strict';

// Must be set before any token is minted: levelsToken() throws without it.
process.env.ZEROGEX_END_USER_TOKEN_SECRET =
  process.env.ZEROGEX_END_USER_TOKEN_SECRET || 'test-secret-do-not-use-in-production';

import {
  CONFIRM_RESEND_COOLDOWN_MS,
  buildLevelsConfirmUrl,
  buildLevelsUnsubUrl,
  checkFreshness,
  checkSendWindow,
  etParts,
  isTradingDay,
  levelsToken,
  normalizeEmail,
  previousTradingDay,
  shouldSendConfirmation,
  verifyLevelsToken,
} from '../core/levelsEmail.ts';
import { buildNyseHolidayCalendar, parseNyseHolidays } from '../core/optionsCalendar.ts';

// An explicit calendar so these assertions never depend on deployment env.
const HOLIDAYS = buildNyseHolidayCalendar(
  parseNyseHolidays('2026-01-01,2026-07-03,2026-11-26,2026-12-25'),
);

// ── normalizeEmail ──────────────────────────────────────────────────────────

test('normalizeEmail lowercases and trims so one human cannot subscribe twice', () => {
  assert.equal(normalizeEmail('  Trader@Example.COM  '), 'trader@example.com');
  assert.equal(normalizeEmail('a@b.co'), 'a@b.co');
});

test('normalizeEmail rejects what can never be an address', () => {
  for (const bad of [
    null, undefined, '', '   ', 'nope', 'no@domain', '@example.com', 'a@@b.com',
    'a b@example.com', 'a@exam ple.com', 'Name <a@b.com>', 'a@b.com,c@d.com',
  ]) {
    assert.equal(normalizeEmail(bad as string), null, `should reject: ${String(bad)}`);
  }
});

test('normalizeEmail rejects over-length input before it reaches the index', () => {
  assert.equal(normalizeEmail(`${'a'.repeat(250)}@example.com`), null);
  // 254 is the ceiling, so something just under it still passes.
  const local = 'a'.repeat(254 - '@example.com'.length);
  assert.equal(normalizeEmail(`${local}@example.com`), `${local}@example.com`);
});

test('normalizeEmail accepts unusual but real TLDs and plus-addressing', () => {
  assert.equal(normalizeEmail('trader+spx@example.museum'), 'trader+spx@example.museum');
  assert.equal(normalizeEmail('a.b-c_d@sub.example.co.uk'), 'a.b-c_d@sub.example.co.uk');
});

// ── Tokens ──────────────────────────────────────────────────────────────────

test('tokens round-trip for the id they were minted for', () => {
  const id = 'lvl_abc123';
  assert.equal(verifyLevelsToken('confirm', id, levelsToken('confirm', id)), true);
  assert.equal(verifyLevelsToken('unsub', id, levelsToken('unsub', id)), true);
});

test('a confirm token cannot be replayed as an unsubscribe token, or vice versa', () => {
  // The whole point of namespacing the purposes: an unsubscribe link that
  // leaks (forwarded, in a mailing-list archive) must not be able to CONFIRM
  // a subscription nobody asked for.
  const id = 'lvl_abc123';
  assert.equal(verifyLevelsToken('unsub', id, levelsToken('confirm', id)), false);
  assert.equal(verifyLevelsToken('confirm', id, levelsToken('unsub', id)), false);
});

test('a token for one subscriber does not verify for another', () => {
  assert.equal(verifyLevelsToken('confirm', 'lvl_two', levelsToken('confirm', 'lvl_one')), false);
});

test('tampered, empty and wrong-length tokens are refused without throwing', () => {
  const id = 'lvl_abc123';
  const good = levelsToken('confirm', id);
  assert.equal(verifyLevelsToken('confirm', id, `${good}x`), false);
  assert.equal(verifyLevelsToken('confirm', id, good.slice(0, -1)), false);
  assert.equal(verifyLevelsToken('confirm', id, ''), false);
  assert.equal(verifyLevelsToken('confirm', id, null), false);
  assert.equal(verifyLevelsToken('confirm', '', good), false);
});

test('tokens are deterministic for a stable secret', () => {
  assert.equal(levelsToken('confirm', 'lvl_x'), levelsToken('confirm', 'lvl_x'));
});

test('links carry the opaque id and never the email address', () => {
  const confirm = buildLevelsConfirmUrl('https://zerogex.io/', 'lvl_abc123');
  const unsub = buildLevelsUnsubUrl('https://zerogex.io', 'lvl_abc123');
  assert.match(confirm, /^https:\/\/zerogex\.io\/levels-email\/confirm\?s=lvl_abc123&t=[\w-]+$/);
  assert.match(unsub, /^https:\/\/zerogex\.io\/levels-email\/unsubscribe\?s=lvl_abc123&t=[\w-]+$/);
  // Trailing slash on the base must not produce a double slash.
  assert.ok(!confirm.includes('//levels-email'));
  assert.ok(!confirm.includes('@'));
});

// ── Confirmation re-send policy ─────────────────────────────────────────────

const NOW = Date.parse('2026-09-19T12:00:00Z');

test('a brand-new pending subscriber gets a confirmation', () => {
  assert.equal(
    shouldSendConfirmation({ confirmedAt: null, confirmSentAt: null, unsubscribedAt: null, nowMs: NOW }),
    true,
  );
});

test('an already-confirmed address is never re-mailed — the form is not a mailbomb', () => {
  assert.equal(
    shouldSendConfirmation({
      confirmedAt: '2026-09-01T00:00:00Z',
      confirmSentAt: '2026-09-01T00:00:00Z',
      unsubscribedAt: null,
      nowMs: NOW,
    }),
    false,
  );
});

test('an opt-out is a standing instruction a third party cannot undo by resubmitting', () => {
  assert.equal(
    shouldSendConfirmation({
      confirmedAt: null,
      confirmSentAt: null,
      unsubscribedAt: '2026-09-02T00:00:00Z',
      nowMs: NOW,
    }),
    false,
  );
});

test('resend is refused inside the cooldown and allowed once past it', () => {
  const sentAt = new Date(NOW - CONFIRM_RESEND_COOLDOWN_MS + 1000).toISOString();
  assert.equal(
    shouldSendConfirmation({ confirmedAt: null, confirmSentAt: sentAt, unsubscribedAt: null, nowMs: NOW }),
    false,
  );
  const older = new Date(NOW - CONFIRM_RESEND_COOLDOWN_MS - 1000).toISOString();
  assert.equal(
    shouldSendConfirmation({ confirmedAt: null, confirmSentAt: older, unsubscribedAt: null, nowMs: NOW }),
    true,
  );
  // Exactly on the boundary counts as elapsed.
  const exact = new Date(NOW - CONFIRM_RESEND_COOLDOWN_MS).toISOString();
  assert.equal(
    shouldSendConfirmation({ confirmedAt: null, confirmSentAt: exact, unsubscribedAt: null, nowMs: NOW }),
    true,
  );
});

test('a corrupt confirm_sent_at waits rather than assuming consent to send', () => {
  assert.equal(
    shouldSendConfirmation({
      confirmedAt: null, confirmSentAt: 'not-a-date', unsubscribedAt: null, nowMs: NOW,
    }),
    false,
  );
});

// ── Eastern time / DST ──────────────────────────────────────────────────────

test('etParts resolves the real Eastern offset on both sides of DST', () => {
  // The bug this prevents: every timer in deploy/systemd that hardcodes a UTC
  // hour drifts by one hour twice a year. For a pre-open email, an hour late
  // is after the open.
  const summer = etParts(new Date('2026-07-15T12:45:00Z')); // EDT, UTC-4
  assert.equal(summer.date, '2026-07-15');
  assert.equal(summer.hour, 8);
  assert.equal(summer.minute, 45);
  assert.equal(summer.minutesOfDay, 8 * 60 + 45);
  assert.equal(summer.weekday, 3); // Wednesday

  const winter = etParts(new Date('2026-01-15T13:45:00Z')); // EST, UTC-5
  assert.equal(winter.date, '2026-01-15');
  assert.equal(winter.hour, 8);
  assert.equal(winter.minute, 45);

  // Same UTC instant, different wall clock across the two seasons.
  assert.equal(etParts(new Date('2026-01-15T12:45:00Z')).hour, 7);
});

test('etParts normalizes ET midnight to hour 0, not 24', () => {
  const midnight = etParts(new Date('2026-07-15T04:00:00Z'));
  assert.equal(midnight.hour, 0);
  assert.equal(midnight.minutesOfDay, 0);
  assert.equal(midnight.date, '2026-07-15');
});

// ── Trading days ────────────────────────────────────────────────────────────

test('isTradingDay excludes weekends and listed NYSE holidays', () => {
  assert.equal(isTradingDay('2026-07-15', HOLIDAYS), true);  // Wednesday
  assert.equal(isTradingDay('2026-07-18', HOLIDAYS), false); // Saturday
  assert.equal(isTradingDay('2026-07-19', HOLIDAYS), false); // Sunday
  assert.equal(isTradingDay('2026-12-25', HOLIDAYS), false); // Christmas
  assert.equal(isTradingDay('2026-11-26', HOLIDAYS), false); // Thanksgiving
  assert.equal(isTradingDay('2026-07-03', HOLIDAYS), false); // observed Jul 4
});

test('isTradingDay refuses a malformed date instead of guessing', () => {
  assert.equal(isTradingDay('not-a-date', HOLIDAYS), false);
  assert.equal(isTradingDay('', HOLIDAYS), false);
});

test('an empty holiday calendar leaves every weekday looking like a session', () => {
  // Documents the known limitation that makes the freshness guard the real
  // backstop: with NEXT_PUBLIC_NYSE_HOLIDAYS unset, Christmas reads as open.
  const none = buildNyseHolidayCalendar(parseNyseHolidays(''));
  assert.equal(isTradingDay('2026-12-25', none), true);
});

// ── Send window ─────────────────────────────────────────────────────────────

const win = (iso: string) => checkSendWindow({ now: new Date(iso), holidays: HOLIDAYS });

test('the digest may send inside the 08:30-09:25 ET window', () => {
  const v = win('2026-07-15T12:45:00Z'); // 08:45 EDT, Wednesday
  assert.equal(v.ok, true);
  assert.equal(v.ok && v.sessionDate, '2026-07-15');
});

test('the window bounds are inclusive so a tick exactly on 08:30 is not dropped', () => {
  assert.equal(win('2026-07-15T12:30:00Z').ok, true); // 08:30 EDT
  assert.equal(win('2026-07-15T13:25:00Z').ok, true); // 09:25 EDT
});

test('a send before the window or after the open is refused', () => {
  const early = win('2026-07-15T12:29:00Z'); // 08:29 EDT
  assert.equal(early.ok, false);
  assert.equal(!early.ok && early.reason, 'outside-window');

  // The Persistent=true failure this exists to stop: host reboots, systemd
  // replays the missed timer mid-session.
  const late = win('2026-07-15T18:00:00Z'); // 14:00 EDT
  assert.equal(late.ok, false);
  assert.equal(!late.ok && late.reason, 'outside-window');
  assert.equal(!late.ok && late.clock, '14:00 ET');
});

test('the window holds at the same ET wall clock in winter, not the same UTC hour', () => {
  assert.equal(win('2026-01-15T13:45:00Z').ok, true);  // 08:45 EST
  assert.equal(win('2026-01-15T12:45:00Z').ok, false); // 07:45 EST — too early
});

test('no send on weekends or holidays even inside the clock window', () => {
  const sat = win('2026-07-18T12:45:00Z');
  assert.equal(sat.ok, false);
  assert.equal(!sat.ok && sat.reason, 'not-a-trading-day');

  const xmas = win('2026-12-25T13:45:00Z');
  assert.equal(xmas.ok, false);
  assert.equal(!xmas.ok && xmas.reason, 'not-a-trading-day');
});

// ── Previous trading session ────────────────────────────────────────────────

test('previousTradingDay steps back over weekends and holidays', () => {
  assert.equal(previousTradingDay('2026-09-21', HOLIDAYS), '2026-09-18'); // Mon -> Fri
  assert.equal(previousTradingDay('2026-09-18', HOLIDAYS), '2026-09-17'); // Fri -> Thu
  // 2026-11-26 is Thanksgiving, so the Friday after resolves to the Wednesday.
  assert.equal(previousTradingDay('2026-11-27', HOLIDAYS), '2026-11-25');
  // Christmas 2026 falls on a Friday; the next session back from Mon 12-28.
  assert.equal(previousTradingDay('2026-12-28', HOLIDAYS), '2026-12-24');
});

test('previousTradingDay refuses a malformed date', () => {
  assert.equal(previousTradingDay('nope', HOLIDAYS), null);
});

// ── Freshness ───────────────────────────────────────────────────────────────
//
// The scenario these are written against is the real one, measured on the
// live API: the GEX summary tracks regular hours, its last stamp of a session
// lands ~15:59 ET, and it does not move again before the next open. So a
// pre-open send on Monday is legitimately built on Friday's close, and the
// guard's job is to tell that apart from a feed that has actually frozen.

// Monday 2026-09-21, 08:45 EDT — a real pre-open send.
const MON_SEND = new Date('2026-09-21T12:45:00Z');
const monday = (ts: string | null, maxAgeHours?: number) =>
  checkFreshness({
    snapshotTimestamp: ts,
    sessionDate: '2026-09-21',
    now: MON_SEND,
    holidays: HOLIDAYS,
    maxAgeHours,
  });

test("Friday's close is valid input for Monday's pre-open digest", () => {
  // The exact shape the live API returned: Fri 2026-09-18 15:59 ET.
  const v = monday('2026-09-18T19:59:00+00:00');
  assert.equal(v.fresh, true);
  assert.equal(v.fresh && v.basis, 'prior-session');
  assert.equal(v.fresh && v.snapshotDate, '2026-09-18');
  // ~65 hours across the weekend — which is why there is no default ceiling.
  assert.ok(v.fresh && v.ageMinutes > 60 * 60);
});

test('a same-morning snapshot is accepted and reported as current-session', () => {
  // The other possible world: the backend does refresh pre-market.
  const v = monday('2026-09-21T12:30:00Z'); // 08:30 EDT Monday
  assert.equal(v.fresh, true);
  assert.equal(v.fresh && v.basis, 'current-session');
  assert.equal(v.fresh && v.ageMinutes, 15);
});

test('a feed frozen a session too far back is refused', () => {
  // Thursday's close, read on Monday: Monday's permitted prior session is
  // Friday, so this is a genuinely stale feed and the send must abort.
  const v = monday('2026-09-17T19:59:00+00:00');
  assert.equal(v.fresh, false);
  assert.equal(!v.fresh && v.reason, 'stale-date');
  assert.equal(!v.fresh && v.snapshotDate, '2026-09-17');
});

test('the prior session is holiday-aware, not merely yesterday', () => {
  // Friday 2026-11-27, the day after Thanksgiving. Wednesday's close is the
  // correct input; Thursday does not exist as a session.
  const v = checkFreshness({
    snapshotTimestamp: '2026-11-25T20:59:00Z', // Wed 15:59 ET
    sessionDate: '2026-11-27',
    now: new Date('2026-11-27T13:45:00Z'), // Fri 08:45 EST
    holidays: HOLIDAYS,
  });
  assert.equal(v.fresh, true);
  assert.equal(v.fresh && v.basis, 'prior-session');
});

test('a missing or unparseable timestamp is refused, not assumed good', () => {
  const missing = monday(null);
  assert.equal(missing.fresh, false);
  assert.equal(!missing.fresh && missing.reason, 'missing');
  const bad = monday('whenever');
  assert.equal(bad.fresh, false);
  assert.equal(!bad.fresh && bad.reason, 'unparseable');
});

test('a future snapshot is a clock fault, with skew tolerance', () => {
  // Two minutes ahead: ordinary skew between hosts, accepted.
  assert.equal(monday('2026-09-21T12:47:00Z').fresh, true);
  const v = monday('2026-09-21T13:45:00Z'); // an hour ahead
  assert.equal(v.fresh, false);
  assert.equal(!v.fresh && v.reason, 'future');
});

test('the optional age ceiling is off by default and enforced when asked for', () => {
  // Friday's close is ~65h old on Monday; with no ceiling that is fine.
  assert.equal(monday('2026-09-18T19:59:00+00:00').fresh, true);
  // An explicit 24h ceiling rejects it. This is why there is no default: a
  // ceiling tight enough to catch a stale feed rejects every Monday.
  const v = monday('2026-09-18T19:59:00+00:00', 24);
  assert.equal(v.fresh, false);
  assert.equal(!v.fresh && v.reason, 'too-old');
});

test('ET-date comparison, not UTC — a late-session stamp is not tomorrow', () => {
  // 20:00 ET on the 18th is 2026-09-19T00:00Z. Compared in UTC this reads as
  // the 19th and would be wrongly rejected as a session ahead of itself.
  const v = checkFreshness({
    snapshotTimestamp: '2026-09-19T00:00:00Z',
    sessionDate: '2026-09-21',
    now: MON_SEND,
    holidays: HOLIDAYS,
  });
  assert.equal(v.fresh, true);
  assert.equal(v.fresh && v.snapshotDate, '2026-09-18');
});
