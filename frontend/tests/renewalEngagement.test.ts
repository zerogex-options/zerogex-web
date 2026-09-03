import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRenewalEngagement,
  decideRenewalReminder,
  clampDormancyDays,
  clampLeadHours,
  idleDays,
  DEFAULT_DORMANCY_DAYS,
  DEFAULT_LEAD_HOURS,
  MIN_DORMANCY_DAYS,
  MAX_DORMANCY_DAYS,
  type RenewalReminderInput,
} from '../core/renewalEngagement.ts';

// The pre-renewal dormancy notice mails ONLY the dormant cohort, so unlike the
// trial classifier a misread here decides whether a member is contacted at all.
// It must still fail toward skipping: 'unknown' means NULL last_seen_at, which
// is true of every pre-cutover account at once.

const NOW = '2026-09-03T12:00:00.000Z';
const daysBeforeNow = (d: number) =>
  new Date(Date.parse(NOW) - d * 24 * 3600_000).toISOString();
const hoursAfterNow = (h: number) =>
  new Date(Date.parse(NOW) + h * 3600_000).toISOString();

// A member 40 days idle whose renewal is 48h out — the case the whole feature
// exists for.
const DORMANT_RENEWAL: RenewalReminderInput = {
  cancelAtPeriodEnd: false,
  firstPaymentClearedAtIso: '2026-06-01T12:00:00.000Z',
  currentPeriodEndIso: hoursAfterNow(48),
  lastSeenAtIso: daysBeforeNow(40),
  alreadyNotifiedPeriod: null,
  nowIso: NOW,
};

// --- classification ---------------------------------------------------

test('a member idle longer than the window is dormant', () => {
  assert.equal(
    classifyRenewalEngagement({ lastSeenAtIso: daysBeforeNow(40), nowIso: NOW }),
    'dormant',
  );
});

test('a member who logged in yesterday is engaged', () => {
  assert.equal(
    classifyRenewalEngagement({ lastSeenAtIso: daysBeforeNow(1), nowIso: NOW }),
    'engaged',
  );
});

test('exactly at the threshold is still engaged; a hair past it is dormant', () => {
  const exact = daysBeforeNow(DEFAULT_DORMANCY_DAYS);
  assert.equal(classifyRenewalEngagement({ lastSeenAtIso: exact, nowIso: NOW }), 'engaged');
  const past = new Date(Date.parse(exact) - 1).toISOString();
  assert.equal(classifyRenewalEngagement({ lastSeenAtIso: past, nowIso: NOW }), 'dormant');
});

test('NULL last_seen_at is unknown, never dormant', () => {
  // A pre-cutover account. Reading this as dormancy mails the legacy book.
  assert.equal(classifyRenewalEngagement({ lastSeenAtIso: null, nowIso: NOW }), 'unknown');
});

test('unparseable timestamps are unknown, never dormant', () => {
  assert.equal(classifyRenewalEngagement({ lastSeenAtIso: 'not-a-date', nowIso: NOW }), 'unknown');
  assert.equal(
    classifyRenewalEngagement({ lastSeenAtIso: daysBeforeNow(40), nowIso: 'nope' }),
    'unknown',
  );
});

test('last_seen slightly in the future is activity, not dormancy', () => {
  // Clock skew, or a replica written marginally ahead.
  assert.equal(
    classifyRenewalEngagement({ lastSeenAtIso: hoursAfterNow(1), nowIso: NOW }),
    'engaged',
  );
});

test('a tighter dormancy window reclassifies the same member', () => {
  const lastSeen = daysBeforeNow(10);
  assert.equal(classifyRenewalEngagement({ lastSeenAtIso: lastSeen, nowIso: NOW }), 'engaged');
  assert.equal(
    classifyRenewalEngagement({ lastSeenAtIso: lastSeen, nowIso: NOW, dormancyDays: 7 }),
    'dormant',
  );
});

// --- the send decision ------------------------------------------------

test('a dormant member renewing inside the window is eligible', () => {
  const d = decideRenewalReminder(DORMANT_RENEWAL);
  assert.equal(d.shouldSend, true);
  assert.equal(d.reason, 'eligible');
  assert.equal(d.engagement, 'dormant');
  // The latch stamps the period being renewed, so the next cycle re-arms.
  assert.equal(d.notifyPeriod, DORMANT_RENEWAL.currentPeriodEndIso);
});

test('an engaged member is skipped, and says so', () => {
  const d = decideRenewalReminder({ ...DORMANT_RENEWAL, lastSeenAtIso: daysBeforeNow(2) });
  assert.equal(d.shouldSend, false);
  assert.equal(d.reason, 'engaged');
});

test('a member already canceling is never warned about a renewal', () => {
  // No renewal is coming; "renews on DATE" would be false.
  const d = decideRenewalReminder({ ...DORMANT_RENEWAL, cancelAtPeriodEnd: true });
  assert.equal(d.shouldSend, false);
  assert.equal(d.reason, 'canceling');
});

test('a comped or partner-granted member is never told a price renews', () => {
  const d = decideRenewalReminder({ ...DORMANT_RENEWAL, firstPaymentClearedAtIso: null });
  assert.equal(d.shouldSend, false);
  assert.equal(d.reason, 'never-paid');
});

test('a renewal beyond the lead window waits for a later run', () => {
  const d = decideRenewalReminder({ ...DORMANT_RENEWAL, currentPeriodEndIso: hoursAfterNow(240) });
  assert.equal(d.shouldSend, false);
  assert.equal(d.reason, 'outside-window');
});

test('a renewal already in the past is not warned about', () => {
  const d = decideRenewalReminder({ ...DORMANT_RENEWAL, currentPeriodEndIso: hoursAfterNow(-2) });
  assert.equal(d.shouldSend, false);
  assert.equal(d.reason, 'outside-window');
});

test('a missing period end is skipped, not treated as due now', () => {
  const d = decideRenewalReminder({ ...DORMANT_RENEWAL, currentPeriodEndIso: null });
  assert.equal(d.shouldSend, false);
  assert.equal(d.reason, 'no-period-end');
  assert.equal(d.hoursToRenewal, null);
});

test('the latch suppresses a second send for the same period', () => {
  const d = decideRenewalReminder({
    ...DORMANT_RENEWAL,
    alreadyNotifiedPeriod: DORMANT_RENEWAL.currentPeriodEndIso,
  });
  assert.equal(d.shouldSend, false);
  assert.equal(d.reason, 'already-notified');
});

test('the latch re-arms on the next billing period', () => {
  // Warned about September; October is a fresh notice, no new column needed.
  const d = decideRenewalReminder({
    ...DORMANT_RENEWAL,
    alreadyNotifiedPeriod: '2026-08-05T12:00:00.000Z',
  });
  assert.equal(d.shouldSend, true);
  assert.equal(d.reason, 'eligible');
});

test('a pre-cutover account is skipped rather than mailed', () => {
  // The load-bearing case: NULL last_seen_at is a property of every legacy
  // account, so failing the other way is a mass mailing, not a missed notice.
  const d = decideRenewalReminder({ ...DORMANT_RENEWAL, lastSeenAtIso: null });
  assert.equal(d.shouldSend, false);
  assert.equal(d.reason, 'unknown-engagement');
  assert.equal(d.engagement, 'unknown');
});

test('hoursToRenewal is reported even on a skip, for the scan report', () => {
  const d = decideRenewalReminder({ ...DORMANT_RENEWAL, lastSeenAtIso: daysBeforeNow(1) });
  assert.equal(d.reason, 'engaged');
  assert.ok(d.hoursToRenewal !== null && Math.round(d.hoursToRenewal) === 48);
});

test('gates are ordered so a canceling member reports canceling, not engaged', () => {
  // Both gates would fire; the report should name the definitive one.
  const d = decideRenewalReminder({
    ...DORMANT_RENEWAL,
    cancelAtPeriodEnd: true,
    lastSeenAtIso: daysBeforeNow(1),
  });
  assert.equal(d.reason, 'canceling');
});

// --- clamps -----------------------------------------------------------

test('dormancy days clamp into range and fall back on garbage', () => {
  assert.equal(clampDormancyDays(undefined), DEFAULT_DORMANCY_DAYS);
  assert.equal(clampDormancyDays(1), MIN_DORMANCY_DAYS);
  assert.equal(clampDormancyDays(365), MAX_DORMANCY_DAYS);
  assert.equal(clampDormancyDays(Number.NaN), DEFAULT_DORMANCY_DAYS);
  assert.equal(clampDormancyDays(21), 21);
});

test('lead hours clamp into range and fall back on garbage', () => {
  assert.equal(clampLeadHours(undefined), DEFAULT_LEAD_HOURS);
  assert.equal(clampLeadHours(1), 24);
  assert.equal(clampLeadHours(10_000), 168);
  assert.equal(clampLeadHours(Number.NaN), DEFAULT_LEAD_HOURS);
});

test('an out-of-range dormancy override cannot widen the cohort past the clamp', () => {
  // --dormancy-days 1 would otherwise call a daily user dormant.
  assert.equal(
    classifyRenewalEngagement({ lastSeenAtIso: daysBeforeNow(3), nowIso: NOW, dormancyDays: 1 }),
    'engaged',
  );
});

// --- report helper ----------------------------------------------------

test('idleDays floors to whole days and is null when unknown', () => {
  assert.equal(idleDays(daysBeforeNow(40), NOW), 40);
  assert.equal(idleDays(null, NOW), null);
  assert.equal(idleDays('garbage', NOW), null);
});
