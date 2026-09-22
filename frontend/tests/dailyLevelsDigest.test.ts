// Unit tests for core/dailyLevelsDigest.ts — what the daily digest actually
// says.
//
// The cases that matter are the honesty ones. This email goes out before the
// open, built on a snapshot that (measured against the live API) is normally
// the PREVIOUS session's close. That is the right product, but only if the
// email says so: a reader who cross-checks against /spx-gamma-levels is the
// likeliest reader there is, and if the numbers look older than the date the
// email claims, the channel is finished. So the provenance line, the
// one-snapshot-per-email rule, and the refusal to send a digest missing its
// own headline ticker are all pinned here.

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ZEROGEX_END_USER_TOKEN_SECRET =
  process.env.ZEROGEX_END_USER_TOKEN_SECRET || 'test-secret-do-not-use-in-production';

import {
  buildDigestModel,
  digestOrderFor,
  renderDailyLevelsEmail,
  type SymbolSnapshot,
} from '../core/dailyLevelsDigest.ts';
import type { GexSummary } from '../core/gexSummary.ts';

// Friday 2026-09-18 15:59 ET — the exact shape the live API returned.
const FRI_CLOSE = '2026-09-18T19:59:00+00:00';
const MON_MORNING = '2026-09-21T12:30:00Z'; // 08:30 EDT Monday
const SESSION = '2026-09-21'; // the Monday being traded

function snap(symbol: string, timestamp: string, over: Partial<GexSummary> = {}): SymbolSnapshot {
  return {
    symbol,
    data: {
      timestamp,
      symbol,
      spot_price: 7650.12,
      total_call_gex: 1,
      total_put_gex: -1,
      net_gex: 1_200_000_000,
      net_gex_at_spot: 1_200_000_000,
      gamma_flip: 7620,
      call_wall: 7700,
      put_wall: 7550,
      max_pain: 7600,
      ...over,
    },
  };
}

const ALL_SIX = ['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ'].map((s) => snap(s, FRI_CLOSE));

const render = (m: NonNullable<ReturnType<typeof buildDigestModel>>) =>
  renderDailyLevelsEmail(m, {
    unsubUrl: 'https://zerogex.io/levels-email/unsubscribe?s=lvl_x&t=tok',
    siteUrl: 'https://zerogex.io',
  });

// ── The model ───────────────────────────────────────────────────────────────

test('a Friday-close snapshot builds a digest for the Monday session ahead', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' });
  assert.ok(m);
  assert.equal(m.sessionLabel, 'Monday');
  assert.equal(m.rows.length, 6);
  assert.equal(m.omitted.length, 0);
  // The stamp is the snapshot's own instant, not the session's.
  assert.match(m.asOf, /Sep 18, 2026/);
});

test('the subject names the session ahead and leads with flip and call wall', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  assert.equal(m.subject, 'SPX gamma map for Monday · flip 7620 · call wall 7700');
});

test('the subject degrades instead of printing a dash where a level should be', () => {
  const partial = [snap('SPX', FRI_CLOSE, { gamma_flip: null, call_wall: null })];
  const m = buildDigestModel({ snapshots: partial, sessionDate: SESSION, basis: 'prior-session' })!;
  assert.equal(m.subject, 'SPX gamma map for Monday');
  assert.ok(!m.subject.includes('—'));
});

test('a fresher ticker is kept and stamped, not dropped — regression, live data', () => {
  // 2026-09-22 08:48 ET, production: SPY and QQQ had refreshed pre-market
  // while SPX/NDX/ES/NQ still carried Monday's close. The original anchor rule
  // required every row to match the PRIMARY's session, so an SPX-led digest
  // dropped SPY and QQQ for being NEWER than the anchor, and a SPY-led one
  // dropped four of six. Two subscribers on the same morning got materially
  // different emails, every trading day.
  const mixed = [
    snap('SPX', FRI_CLOSE), snap('NDX', FRI_CLOSE), snap('ES', FRI_CLOSE), snap('NQ', FRI_CLOSE),
    snap('SPY', MON_MORNING), snap('QQQ', MON_MORNING),
  ];
  const m = buildDigestModel({ snapshots: mixed, sessionDate: SESSION, basis: 'prior-session', primary: 'SPX' })!;
  assert.equal(m.rows.length, 6, 'every ticker with a snapshot must be printed');
  assert.deepEqual(m.omitted, [], 'nothing is dropped for disagreeing about the session');

  // And a SPY subscriber gets all six too, not just the two fresh ones.
  const spyLed = buildDigestModel({ snapshots: mixed, sessionDate: SESSION, basis: 'current-session', primary: 'SPY' })!;
  assert.equal(spyLed.rows.length, 6);
  assert.equal(spyLed.rows[0].symbol, 'SPY');
});

test('each row is stamped with its own session, in a form that distinguishes them', () => {
  const mixed = [snap('SPX', FRI_CLOSE), snap('SPY', MON_MORNING)];
  const m = buildDigestModel({ snapshots: mixed, sessionDate: SESSION, basis: 'prior-session', primary: 'SPX' })!;
  const bySym = Object.fromEntries(m.rows.map((r) => [r.symbol, r]));
  // From the session being named: time only, because the day is not in doubt.
  assert.match(bySym.SPY.asOf, /^\d{1,2}:\d{2} (AM|PM)$/);
  // From an earlier session: the weekday leads, so it cannot be misread.
  assert.match(bySym.SPX.asOf, /^(Mon|Tue|Wed|Thu|Fri) \d{1,2}:\d{2} (AM|PM)$/);
  assert.equal(bySym.SPX.sessionDate, '2026-09-18');
  assert.equal(bySym.SPY.sessionDate, '2026-09-21');
});

test('a mixed-session digest explains why the rows disagree', () => {
  const mixed = [snap('SPX', FRI_CLOSE), snap('SPY', MON_MORNING)];
  const m = buildDigestModel({ snapshots: mixed, sessionDate: SESSION, basis: 'prior-session', primary: 'SPX' })!;
  const { text, html } = render(m);
  for (const body of [text, html]) {
    assert.match(body, /do not trade pre-market/);
    assert.match(body, /stamped with its own snapshot time/);
  }
  // The single-session wording must NOT also appear — it would contradict.
  assert.ok(!text.includes("previous session's closing options chain"));
});

test('a single-session digest keeps the simple provenance line', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const { text } = render(m);
  assert.match(text, /previous session/);
  assert.ok(!text.includes('do not trade pre-market'));
});

test('a symbol with no snapshot at all is omitted, not rendered empty', () => {
  const missing = [...ALL_SIX.slice(0, 5), { symbol: 'NQ', data: null }];
  const m = buildDigestModel({ snapshots: missing, sessionDate: SESSION, basis: 'prior-session' })!;
  assert.equal(m.rows.length, 5);
  assert.deepEqual(m.omitted, ['NQ']);
});

test('no primary snapshot means no digest — the caller aborts the send', () => {
  // Mailing an "SPX gamma map" with no SPX row is worse than mailing nothing.
  assert.equal(
    buildDigestModel({
      snapshots: [{ symbol: 'SPX', data: null }, snap('SPY', FRI_CLOSE)],
      sessionDate: SESSION,
      basis: 'prior-session',
    }),
    null,
  );
  assert.equal(
    buildDigestModel({ snapshots: [], sessionDate: SESSION, basis: 'prior-session' }),
    null,
  );
});

test('rows use the same formatters as the levels pages', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const spx = m.rows[0];
  assert.equal(spx.spot, '7650');      // fmtPrice: whole numbers at four figures
  assert.equal(spx.flip, '7620');
  assert.equal(spx.netGex, '+$1.20B'); // fmtNetGex
});

// ── Provenance: the honesty requirement ─────────────────────────────────────

test("a prior-session digest says the numbers come from the previous close", () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const { text, html } = render(m);
  for (const body of [text, html]) {
    // Matched around the apostrophe: the HTML body escapes it to &#39;, so
    // asserting on the literal character passes for text and fails for html.
    assert.match(body, /previous session/);
    assert.match(body, /closing options chain/);
    assert.match(body, /Sep 18, 2026/);
  }
});

test('a current-session digest does not claim a prior close it did not use', () => {
  const m = buildDigestModel({
    snapshots: [snap('SPX', MON_MORNING)],
    sessionDate: SESSION,
    basis: 'current-session',
  })!;
  const { text } = render(m);
  assert.ok(!text.includes('previous session'));
  assert.match(text, /Sep 21, 2026/);
});

test('the email never asserts the levels are live', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const { text, html } = render(m);
  for (const body of [text, html]) {
    assert.match(body, /delayed ~15 minutes/);
  }
});

// ── Rendering ───────────────────────────────────────────────────────────────

test('both bodies carry every included ticker and no omitted one', () => {
  const mixed = [...['SPX', 'SPY', 'QQQ'].map((s) => snap(s, FRI_CLOSE)), { symbol: 'NQ', data: null }];
  const m = buildDigestModel({ snapshots: mixed, sessionDate: SESSION, basis: 'prior-session' })!;
  const { text, html } = render(m);
  for (const body of [text, html]) {
    for (const s of ['SPX', 'SPY', 'QQQ']) assert.match(body, new RegExp(s));
    assert.match(body, /Not included this morning/);
  }
});

test('the TradingView paste block is present in the order the script asks for', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const { text, html } = render(m);
  for (const body of [text, html]) {
    assert.match(body, /Gamma Flip \/ Call Wall \/ Put Wall \/ Max Pain/);
    assert.match(body, /SPX: flip 7620 \/ call wall 7700 \/ put wall 7550 \/ max pain 7600/);
  }
});

test('a missing level pastes as 0, never as an em dash — regression, live data', () => {
  // 2026-09-21: NDX and NQ published no gamma flip, and the paste block
  // shipped "flip —" into a field the TradingView script reads as a number.
  // The script's own convention for an absent level is 0 ("Set any level to 0
  // to hide it"), so that is what a missing level becomes. The human table
  // above it keeps the em dash, which is right there.
  const m = buildDigestModel({
    snapshots: [snap('SPX', FRI_CLOSE), snap('NDX', FRI_CLOSE, { gamma_flip: null })],
    sessionDate: SESSION,
    basis: 'prior-session',
  })!;
  const { text, html } = render(m);
  for (const body of [text, html]) {
    assert.match(body, /NDX: flip 0 \/ call wall/);
    assert.ok(!/NDX: flip —/.test(body), 'paste block must not carry an em dash');
  }
  // The readable table still reports the level as absent rather than as zero:
  // "flip 0" would be a false statement about the market.
  assert.match(text, /NDX\s+\S.*spot .* flip —/);
});

test('the zero note appears only when a level actually fell back to 0', () => {
  const complete = buildDigestModel({
    snapshots: [snap('SPX', FRI_CLOSE)], sessionDate: SESSION, basis: 'prior-session',
  })!;
  assert.ok(!render(complete).text.includes('A 0 means'));

  const partial = buildDigestModel({
    snapshots: [snap('SPX', FRI_CLOSE, { max_pain: null })], sessionDate: SESSION, basis: 'prior-session',
  })!;
  const { text, html } = render(partial);
  for (const body of [text, html]) assert.match(body, /A 0 means no level was published/);
});

test('no stray blank run where the omitted-symbols note would go', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  assert.ok(!render(m).text.includes('\n\n\n'), 'text body should not contain a double blank line');
});

test('the unsubscribe link is in both bodies — it is the thing that must never be missing', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const { text, html } = render(m);
  assert.match(text, /Unsubscribe: https:\/\/zerogex\.io\/levels-email\/unsubscribe\?s=lvl_x&t=tok/);
  assert.match(html, /href="https:\/\/zerogex\.io\/levels-email\/unsubscribe\?s=lvl_x&amp;t=tok"/);
});

test('the trial mention is one line at the foot, never the subject', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const { subject, text } = render(m);
  assert.ok(!/trial/i.test(subject));
  assert.equal((text.match(/7-day trial/gi) ?? []).length, 1);
});

test('html output escapes rather than interpolating raw values', () => {
  const m = buildDigestModel({
    snapshots: [snap('SPX', FRI_CLOSE)],
    sessionDate: SESSION,
    basis: 'prior-session',
  })!;
  const { html } = renderDailyLevelsEmail(m, {
    unsubUrl: 'https://zerogex.io/u?s=a&t=b<script>',
    siteUrl: 'https://zerogex.io',
  });
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('a trailing slash on the site URL does not produce a double slash', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const { text, html } = renderDailyLevelsEmail(m, {
    unsubUrl: 'https://zerogex.io/u',
    siteUrl: 'https://zerogex.io/',
  });
  for (const body of [text, html]) assert.ok(!body.includes('zerogex.io//'));
});

// ── Preferred symbol ────────────────────────────────────────────────────────
//
// A subscriber picks the ticker their digest is built around. It leads the
// subject, heads the table (highlighted), and is the first line of the
// TradingView paste block — the three places a reader looks first.

test('the chosen symbol leads the reading order, the rest keep canonical order', () => {
  assert.deepEqual(digestOrderFor('QQQ'), ['QQQ', 'SPX', 'SPY', 'NDX', 'ES', 'NQ']);
  assert.deepEqual(digestOrderFor('SPX'), ['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ']);
  // An unknown ticker must not drop every row; fall back to canonical order.
  assert.deepEqual(digestOrderFor('DOGE'), ['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ']);
});

test("a QQQ subscriber's digest leads with QQQ everywhere it matters", () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session', primary: 'QQQ' })!;
  assert.equal(m.rows[0].symbol, 'QQQ');
  assert.equal(m.rows[0].isPrimary, true);
  assert.equal(m.rows.filter((r) => r.isPrimary).length, 1);
  assert.match(m.subject, /^QQQ gamma map for Monday/);

  const { text, html } = render(m);
  // First data row of the table, and first line of the paste block.
  assert.match(text, /\nQQQ\s+\S.*spot/);
  assert.match(text, /Gamma Flip \/ Call Wall \/ Put Wall \/ Max Pain\):\nQQQ: flip/);
  // The other five are still there — the choice reorders, it does not filter.
  for (const s of ['SPX', 'SPY', 'NDX', 'ES', 'NQ']) assert.match(text, new RegExp(`${s}: flip`));
  assert.equal(html.indexOf('>QQQ<'), html.search(/>(SPX|SPY|QQQ|NDX|ES|NQ)</));
});

test('only the chosen row is highlighted, with inline styles Gmail will keep', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session', primary: 'NDX' })!;
  const { html } = render(m);
  // Gmail strips <style> blocks, so a class-based highlight would vanish.
  assert.equal((html.match(/<tr style="background:#f3f8fb;">/g) ?? []).length, 1);
  assert.match(html, /border-left:3px solid #f5b400/);
});

test('the levels card image is the free embed route for the chosen symbol', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session', primary: 'SPY' })!;
  const { html } = render(m);
  assert.match(html, /<img src="https:\/\/zerogex\.io\/embed\/image\/SPY\.png"/);
  // Never the Basic-gated Live Bulletin: mailing that would give away free,
  // every morning, exactly what the last line of this email asks them to buy.
  assert.ok(!html.includes('live-bulletin'));
});

test('the digest still reads correctly with images blocked', () => {
  // Most clients block images by default. Every number in the card must also
  // exist as text, so the plain-text part is the real test.
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session', primary: 'SPY' })!;
  const { text } = render(m);
  assert.ok(!text.includes('<img'));
  assert.match(text, /SPY\s+\S.*spot .* flip .* call wall .* put wall/);
  assert.match(text, /SPY: flip/);
});

test('a chosen symbol with no snapshot yields no model — the caller substitutes', () => {
  // The "named after a ticker it cannot show" rule is per-subscriber, not
  // just for SPX: an email whose subject reads "NQ gamma map" and whose table
  // has no NQ row is wrong, so the model refuses to build.
  //
  // The subscriber is NOT dropped. send-daily-levels.mts falls back to the
  // SPX-led model for anyone whose preference is unavailable that morning
  // (`modelFor(subscriber.symbol) ?? model`), so they receive a correct
  // digest led by a different ticker rather than nothing at all. Keeping the
  // refusal here and the substitution there means the model can never emit a
  // mislabelled email, and the script can never silently skip a recipient.
  const withoutNq = [...['SPX', 'SPY', 'QQQ', 'NDX', 'ES'].map((s) => snap(s, FRI_CLOSE)), { symbol: 'NQ', data: null }];
  assert.equal(
    buildDigestModel({ snapshots: withoutNq, sessionDate: SESSION, basis: 'prior-session', primary: 'NQ' }),
    null,
  );
  // And the fallback the script reaches for is itself sound.
  const fallback = buildDigestModel({ snapshots: withoutNq, sessionDate: SESSION, basis: 'prior-session', primary: 'SPX' })!;
  assert.equal(fallback.rows[0].symbol, 'SPX');
  assert.deepEqual(fallback.omitted, ['NQ']);
});

// ── Unresolved flip, and the reading list ───────────────────────────────────

test('an unresolved flip is asterisked and explained, not left as a bare dash', () => {
  // A blank reads as a data outage. "We refused to print a number we cannot
  // stand behind" is a reason to trust the other five columns more, and it is
  // what content/methodology.md already commits to.
  const m = buildDigestModel({
    snapshots: [snap('SPX', FRI_CLOSE), snap('NDX', FRI_CLOSE, { gamma_flip: null })],
    sessionDate: SESSION, basis: 'prior-session',
  })!;
  assert.equal(m.rows.find((r) => r.symbol === 'NDX')!.flipUnresolved, true);
  assert.equal(m.rows.find((r) => r.symbol === 'SPX')!.flipUnresolved, false);

  const { text, html } = render(m);
  for (const body of [text, html]) {
    assert.match(body, /Gamma flip unresolved/);
    assert.match(body, /no qualifying zero-crossing/);
    assert.match(body, /zerogex\.io\/methodology/);
  }
  assert.match(text, /flip —\*/);
});

test('no asterisk and no footnote when every flip resolved', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const { text, html } = render(m);
  for (const body of [text, html]) assert.ok(!body.includes('Gamma flip unresolved'));
  assert.ok(!text.includes('—*'));
});

test('the reading list is present in both bodies and every link is public', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const { text, html } = render(m);
  // /scorecard is here on purpose: the Sept Search Console review found it had
  // no inbound link anywhere, and a daily email is the best one it will get.
  for (const path of [
    '/methodology',
    '/education/how-to-read-a-gamma-flip',
    '/education/gamma-walls-explained',
    '/scorecard',
    '/tradingview-indicator',
  ]) {
    assert.match(text, new RegExp(`zerogex\\.io${path.replace(/\//g, '\\/')}`), `text missing ${path}`);
    assert.match(html, new RegExp(`href="https://zerogex\\.io${path.replace(/\//g, '\\/')}"`), `html missing ${path}`);
  }
  assert.match(text, /Worth reading:/);
  assert.match(html, /Worth reading/);
});

// ── The track-record line ──────────────────────────────────────────────────
//
// Optional by design. This runs in a weekday cron that mails real
// subscribers, and it exists to carry one marketing sentence — so every
// failure path has to end with the email going out unchanged, never with a
// send aborting. These tests are mostly about the absence case.

import {
  summarizeForecastHistory,
  type ForecastDateEntry,
} from '../core/trackRecord.ts';

/** 55 graded SPX sessions with the seven real misses, as on 2026-09-22. */
function spxRecord() {
  const misses = new Set([
    '2026-07-06', '2026-07-07', '2026-07-08',
    '2026-07-15', '2026-07-23', '2026-08-03', '2026-08-04',
  ]);
  const out: ForecastDateEntry[] = [];
  let made = 0;
  for (let i = 0; made < 55; i++) {
    const d = new Date(Date.UTC(2026, 6, 6) + i * 86400000);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const date = d.toISOString().slice(0, 10);
    out.push({ date, has_receipt: true, range_respected: !misses.has(date) });
    made++;
  }
  return summarizeForecastHistory(out, 'SPX');
}

test('with no history passed, the digest is exactly what it was before', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  assert.equal(m.trackRecord, null);
  const r = renderDailyLevelsEmail(m, { unsubUrl: 'https://x/u', siteUrl: 'https://zerogex.io' });
  assert.ok(!r.text.includes('graded sessions'), 'no track-record line in the text body');
  assert.ok(!r.html.includes('See the record'), 'no track-record line in the html body');
});

test('with history, the line carries the FULL record and links the page', () => {
  const m = buildDigestModel({
    snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session', history: spxRecord(),
  })!;
  assert.match(m.trackRecord!, /48 of 55 graded sessions/);
  const r = renderDailyLevelsEmail(m, { unsubUrl: 'https://x/u', siteUrl: 'https://zerogex.io' });
  assert.match(r.text, /48 of 55 graded sessions/);
  assert.match(r.text, /https:\/\/zerogex\.io\/track-record/);
  assert.match(r.html, /48 of 55 graded sessions/);
  assert.match(r.html, /See the record/);
});

test('the email never prints the rolling 29 of 29', () => {
  const m = buildDigestModel({
    snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session', history: spxRecord(),
  })!;
  const r = renderDailyLevelsEmail(m, { unsubUrl: 'https://x/u', siteUrl: 'https://zerogex.io' });
  for (const body of [r.text, r.html]) {
    assert.ok(!body.includes('29 of 29'), 'the rolling window must not reach the email');
    assert.ok(!/\b100%\b/.test(body), 'no 100% claim anywhere in the email');
  }
});

test('a thin record yields no numeric claim rather than a hollow one', () => {
  const thin = summarizeForecastHistory(
    [{ date: '2026-09-18', has_receipt: true, range_respected: true }],
    'SPX',
  );
  const m = buildDigestModel({
    snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session', history: thin,
  })!;
  assert.ok(!/\d+ of \d+/.test(m.trackRecord!), m.trackRecord!);
  assert.match(m.trackRecord!, /Every receipt is published/);
});

test('the reading list always carries the track-record link', () => {
  const m = buildDigestModel({ snapshots: ALL_SIX, sessionDate: SESSION, basis: 'prior-session' })!;
  const r = renderDailyLevelsEmail(m, { unsubUrl: 'https://x/u', siteUrl: 'https://zerogex.io' });
  assert.match(r.text, /zerogex\.io\/track-record/);
  assert.match(r.html, /zerogex\.io\/track-record/);
});
