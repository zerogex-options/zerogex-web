import test from 'node:test';
import assert from 'node:assert/strict';
import { impliedDirection, underlyingTrendPct } from '../core/impliedDirection.ts';
import type { FlowSeriesPoint } from '../hooks/useFlowSeries.ts';

const BASE_MS = Date.parse('2026-08-13T15:00:00Z');

function row(minsAgo: number, price: number | null): FlowSeriesPoint {
  return {
    timestamp: new Date(BASE_MS - minsAgo * 60_000).toISOString(),
    underlying_price: price,
  } as unknown as FlowSeriesPoint;
}

// ── impliedDirection: the four canonical cases ──────────────────────────────

test('uptrend + high score => bullish (continuation)', () => {
  const r = impliedDirection(80, 0.01);
  assert.equal(r.tone, 'bull');
  assert.equal(r.sign, 1);
  assert.equal(r.color, 'var(--color-bull)');
});

test('uptrend + low score => bearish (reversal)', () => {
  const r = impliedDirection(10, 0.01);
  assert.equal(r.tone, 'bear');
  assert.equal(r.sign, -1);
  assert.equal(r.color, 'var(--color-bear)');
});

test('downtrend + high score => bearish (continuation)', () => {
  const r = impliedDirection(80, -0.01);
  assert.equal(r.tone, 'bear');
  assert.equal(r.sign, -1);
});

test('downtrend + low score => bullish (reversal)', () => {
  const r = impliedDirection(10, -0.01);
  assert.equal(r.tone, 'bull');
  assert.equal(r.sign, 1);
});

// ── impliedDirection: neutral fallbacks ─────────────────────────────────────

test('flat underlying => neutral', () => {
  assert.equal(impliedDirection(10, 0).tone, 'neutral');
  // A move below the flat threshold is treated as flat.
  assert.equal(impliedDirection(10, 0.0001).tone, 'neutral');
});

test('missing trend => neutral', () => {
  const r = impliedDirection(10, null);
  assert.equal(r.tone, 'neutral');
  assert.equal(r.color, 'var(--color-text-primary)');
});

test('score near 50 => neutral (no continuation/reversal lean)', () => {
  assert.equal(impliedDirection(50, 0.01).tone, 'neutral');
  assert.equal(impliedDirection(51, 0.01).tone, 'neutral');
});

test('missing score => neutral', () => {
  assert.equal(impliedDirection(null, 0.01).tone, 'neutral');
});

// ── underlyingTrendPct ──────────────────────────────────────────────────────

test('rising underlying yields a positive trend', () => {
  const rows = [40, 35, 30, 25, 20, 15, 10, 5, 0].map((m, i) => row(m, 100 + i * 0.2));
  const t = underlyingTrendPct(rows);
  assert.ok(t != null && t > 0, `expected positive trend, got ${t}`);
});

test('falling underlying yields a negative trend', () => {
  const rows = [40, 35, 30, 25, 20, 15, 10, 5, 0].map((m, i) => row(m, 101.6 - i * 0.2));
  const t = underlyingTrendPct(rows);
  assert.ok(t != null && t < 0, `expected negative trend, got ${t}`);
});

test('insufficient price data yields null', () => {
  assert.equal(underlyingTrendPct(null), null);
  assert.equal(underlyingTrendPct([]), null);
  assert.equal(underlyingTrendPct([row(0, 100)]), null); // single point, no baseline
  assert.equal(underlyingTrendPct([row(30, null), row(0, null)]), null); // no prices
});

test('end-to-end: rising price + reversal-regime score reads bearish', () => {
  const rows = [40, 35, 30, 25, 20, 15, 10, 5, 0].map((m, i) => row(m, 100 + i * 0.2));
  const t = underlyingTrendPct(rows);
  const r = impliedDirection(5.66, t);
  assert.equal(r.tone, 'bear');
});
