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

test('one email carries one snapshot date — an off-session ticker is dropped and named', () => {
  // NQ lagging a session behind must not sit in the table looking current.
  const mixed = [
    ...['SPX', 'SPY', 'QQQ', 'NDX', 'ES'].map((s) => snap(s, FRI_CLOSE)),
    snap('NQ', '2026-09-17T19:59:00+00:00'), // Thursday
  ];
  const m = buildDigestModel({ snapshots: mixed, sessionDate: SESSION, basis: 'prior-session' })!;
  assert.deepEqual(m.rows.map((r) => r.symbol), ['SPX', 'SPY', 'QQQ', 'NDX', 'ES']);
  assert.deepEqual(m.omitted, ['NQ']);
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
