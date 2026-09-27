import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMEBACK_DEFAULT_SYMBOL,
  MAX_SNAPSHOT_AGE_HOURS,
  comebackLevels,
  latestGradedForecast,
  marketFromWelcomeAudit,
  regimeSentence,
  sessionDateLabel,
} from '../core/trialComeback.ts';
import { buildTrialComebackEmail } from '../core/mailer.ts';
import { AUTH_TIERS, requiredTierForRoute } from '../core/auth.ts';
import type { GexSummary } from '../core/gexSummary.ts';

// The day-two email's variant for a trialer who looked once and never came
// back. It brings the product to them, so it must never print stale or
// missing numbers as current, and every link must open for a Basic trialer.

const NOW = Date.parse('2026-09-28T13:00:00.000Z'); // Mon 9:00 AM ET
const HOUR = 3_600_000;

const summary = (over: Partial<GexSummary> = {}): GexSummary =>
  ({
    timestamp: '2026-09-25T19:59:00.000Z', // Fri 3:59 PM ET
    spot_price: 5531.4,
    gamma_flip: 5512.2,
    call_wall: 5600,
    put_wall: 5450,
    max_pain: 5525,
    ...over,
  }) as GexSummary;

test('marketFromWelcomeAudit reads the answer the welcome recorded', () => {
  assert.equal(marketFromWelcomeAudit('User acknowledged the Basic first-run welcome market=ES'), 'ES');
  assert.equal(marketFromWelcomeAudit('User acknowledged the Pro first-run welcome market=NDX'), 'NDX');
  assert.equal(marketFromWelcomeAudit('User acknowledged the Basic first-run welcome'), null);
  assert.equal(marketFromWelcomeAudit('market=TSLA'), null);
  assert.equal(marketFromWelcomeAudit(null), null);
  assert.equal(COMEBACK_DEFAULT_SYMBOL, 'SPX');
});

test('comebackLevels formats a recent snapshot and places price against the flip', () => {
  const levels = comebackLevels('SPX', summary(), NOW);
  assert.ok(levels);
  assert.equal(levels.symbol, 'SPX');
  assert.equal(levels.spot, '5531');
  assert.equal(levels.flip, '5512');
  assert.equal(levels.callWall, '5600');
  assert.equal(levels.putWall, '5450');
  assert.equal(levels.aboveFlip, true);
  assert.match(levels.asOf, /Fri, Sep 25, 3:59\sPM ET/);
  assert.equal(comebackLevels('SPX', summary({ spot_price: 5500 }), NOW)?.aboveFlip, false);
});

test('comebackLevels refuses stale or incomplete data rather than print it as current', () => {
  const stale = new Date(NOW - (MAX_SNAPSHOT_AGE_HOURS + 1) * HOUR).toISOString();
  assert.equal(comebackLevels('SPX', summary({ timestamp: stale }), NOW), null);
  assert.equal(comebackLevels('SPX', summary({ timestamp: 'garbage' }), NOW), null);
  assert.equal(comebackLevels('SPX', summary({ call_wall: null }), NOW), null);
  assert.equal(comebackLevels('SPX', null, NOW), null);
});

test('an unresolved flip drops the flip row and the regime sentence, not the email', () => {
  const levels = comebackLevels('SPX', summary({ gamma_flip: null }), NOW);
  assert.ok(levels);
  assert.equal(levels.flip, null);
  assert.equal(levels.aboveFlip, null);
  assert.equal(regimeSentence(levels.aboveFlip), null);
});

test('latestGradedForecast picks the newest graded session', () => {
  const grade = latestGradedForecast([
    { date: '2026-09-23', has_receipt: true, range_respected: true },
    { date: '2026-09-25', has_receipt: true, range_respected: false },
    { date: '2026-09-28', has_receipt: false, range_respected: null },
    { date: '2026-09-24', has_receipt: true, range_respected: true },
  ]);
  assert.deepEqual(grade, { date: '2026-09-25', held: false });
  assert.equal(latestGradedForecast([]), null);
  assert.equal(latestGradedForecast(null), null);
  assert.equal(sessionDateLabel('2026-09-25'), 'Friday, Sep 25');
});

const levels = comebackLevels('SPX', summary(), NOW)!;
const email = buildTrialComebackEmail({
  trialEndIso: '2026-10-02T20:00:00Z',
  unsubUrl: 'https://zerogex.test/unsubscribe?u=user_x&t=token',
  levels,
  latestGrade: { date: '2026-09-25', held: true },
  trackRecordLine: 'We commit to a SPX forecast before every open and grade it against the close.',
});

const rank = (id: string) => AUTH_TIERS.find((t) => t.id === id)?.rank ?? Infinity;

test('the email carries the numbers, the regime sentence and the graded call', () => {
  assert.equal(email.subject, 'The latest SPX levels, in plain English');
  for (const body of [email.text, email.html]) {
    assert.match(body, /5531/);
    assert.match(body, /5512/);
    assert.match(body, /5600/);
    assert.match(body, /5450/);
    assert.match(body, /Price was above the flip/);
    assert.match(body, /dealers hedge against direction/);
    assert.match(body, /Friday, Sep 25, the SPX forecast range held/);
  }
  assert.match(email.html, /href="[^"]*\/forecast\/SPX\/2026-09-25"/);
  assert.match(email.html, /href="[^"]*\/unsubscribe\?u=user_x&amp;t=token"/);
});

test('every page the email links is open to a Basic trialer', () => {
  const paths = [...email.html.matchAll(/href="([^"]+)"/g)]
    .map((m) => new URL(m[1].replace(/&amp;/g, '&'), 'https://zerogex.test').pathname)
    .filter((p) => p !== '/unsubscribe');
  assert.ok(paths.length >= 3, `expected the forecast, record and signals links, got ${paths.join(', ')}`);
  for (const path of paths) {
    const required = requiredTierForRoute(path) ?? 'public';
    assert.ok(rank(required) <= rank('basic'), `${path} needs ${required}, not open to Basic`);
  }
});

test('without a graded forecast the line and its link are left out', () => {
  const bare = buildTrialComebackEmail({
    trialEndIso: '2026-10-02T20:00:00Z',
    unsubUrl: 'https://zerogex.test/unsubscribe',
    levels,
    latestGrade: null,
    trackRecordLine: null,
  });
  for (const body of [bare.text, bare.html]) {
    assert.doesNotMatch(body, /forecast range/);
    assert.doesNotMatch(body, /\/forecast\//);
    assert.doesNotMatch(body, /track-record/);
    assert.match(body, /basic-signals/);
  }
});
