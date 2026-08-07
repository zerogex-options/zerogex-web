import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredApiAccess, type ApiAccess } from '../core/api/apiTierGate.ts';

// The BFF tier gate is the paywall-bypass fix: it decides the consumer tier
// required for each browser /api/* data path. Lock the map down — a wrong
// answer either leaks premium data (too loose) or 403s a paying/anonymous
// page that legitimately needs the endpoint (too tight).

function eq(path: string, expected: ApiAccess | null) {
  assert.equal(requiredApiAccess(path), expected, path);
}

test('public shared-backtest permalink is exempt even under the pro /api/backtest prefix', () => {
  eq('/api/backtest/runs/shared', 'public');
  eq('/api/backtest/runs/shared/tok_123', 'public');
  eq('/api/backtest/runs/shared/tok_123/equity', 'public');
});

test('backtest platform (non-shared) is pro', () => {
  eq('/api/backtest', 'pro');
  eq('/api/backtest/runs', 'pro');
  eq('/api/backtest/runs/42/trades', 'pro');
  eq('/api/backtest/meta', 'pro');
});

test('tradeworkz admin ops are admin; customer follow/feed are ungated (pass through)', () => {
  eq('/api/tradeworkz/admin', 'admin');
  eq('/api/tradeworkz/admin/reset-fleet', 'admin');
  eq('/api/tradeworkz/admin/simulate', 'admin');
  // Per-user prefs are deliberately NOT gated — any logged-in tier uses them.
  eq('/api/tradeworkz/me/feed', null);
  eq('/api/tradeworkz/bots/7/follow', null);
});

test('signals: advanced + trade-bias are pro; the rest (score/action/basic) are basic', () => {
  eq('/api/signals/advanced/eod-pressure', 'pro');
  eq('/api/signals/advanced', 'pro');
  eq('/api/signals/trade-bias', 'pro');
  eq('/api/signals/trade-bias-history', 'pro'); // distinct segment, explicit rule
  // Composite score is fetched by the Basic /my-dashboard → must be basic.
  eq('/api/signals/score', 'basic');
  eq('/api/signals/score-history', 'basic');
  eq('/api/signals/action/card_1', 'basic');
  eq('/api/signals/basic/skew-delta', 'basic');
  eq('/api/signals/trade', 'basic'); // must NOT be swept up by the trade-bias rule
  eq('/api/signals', 'basic');
});

test('derived analytics surfaces are basic', () => {
  for (const p of [
    '/api/gex/summary',
    '/api/flow/series',
    '/api/forced-flow/curve',
    '/api/replay/range',
    '/api/option/contract',
    '/api/max-pain/current',
    '/api/technicals',
  ]) {
    eq(p, 'basic');
  }
});

test('market: volatility gauge is basic; quote/session chrome stays public (ungated)', () => {
  eq('/api/market/volatility', 'basic');
  eq('/api/market/quote', null);
  eq('/api/market/session-closes', null);
  eq('/api/market/historical', null);
});

test('unmapped paths pass through (null) — the denylist fails open', () => {
  eq('/api/news', null);
  eq('/api/health', null);
  eq('/api/auth/session', null);
  eq('/api/billing/status', null);
});

test('segment-safe matching: a prefix never matches a longer sibling segment', () => {
  eq('/api/gexfoo', null); // not /api/gex
  eq('/api/gexfoo/bar', null);
  eq('/api/signals-extra', null); // not /api/signals
  eq('/api/optionality', null); // not /api/option
});
