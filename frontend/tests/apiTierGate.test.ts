import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isApiTierGateEnabled,
  requiredApiAccess,
  type ApiAccess,
} from '../core/api/apiTierGate.ts';

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
  // vol-expansion is the one advanced signal carved down to basic — the Basic
  // Dealer Positioning page embeds the reading, so gating it at pro left a
  // permanent upsell inside a page Basic already pays for.
  eq('/api/signals/advanced/vol-expansion', 'basic');
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

// The vol-expansion carve-out is a prefix sitting INSIDE a broader pro prefix,
// with a pro sub-path of its own beneath it. covers() matches descendants, so
// rule order is the only thing keeping the Pro analytic out of Basic's hands —
// reorder these and the leak is silent, which is exactly what this gate exists
// to prevent.
test('vol-expansion carve-out: the reading is basic, its accuracy analytics stay pro', () => {
  eq('/api/signals/advanced/vol-expansion', 'basic');
  // Descendants of the reading (e.g. a future sub-resource) follow it to basic.
  eq('/api/signals/advanced/vol-expansion/history', 'basic');
  // ...except /accuracy, which has its own explicit pro rule ordered ahead of
  // the basic prefix. This is the assertion that fails if someone "tidies" the
  // rules into alphabetical or general-to-specific order.
  eq('/api/signals/advanced/vol-expansion/accuracy', 'pro');
  eq('/api/signals/advanced/vol-expansion/accuracy/rollup', 'pro');
  // Sibling advanced signals are untouched by the carve-out.
  eq('/api/signals/advanced/squeeze-setup', 'pro');
  eq('/api/signals/advanced/market-pressure', 'pro');
  // Segment-aware: a path that merely starts with the same characters must not
  // inherit basic.
  eq('/api/signals/advanced/vol-expansionista', 'pro');
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

test('kill-switch: gate is ON by default and only OFF for the exact value "0"', () => {
  // On by default — unset, empty, or anything that is not "0".
  assert.equal(isApiTierGateEnabled(undefined), true);
  assert.equal(isApiTierGateEnabled(''), true);
  assert.equal(isApiTierGateEnabled('1'), true);
  assert.equal(isApiTierGateEnabled('true'), true);
  assert.equal(isApiTierGateEnabled('on'), true);
  // Off only for the exact opt-out value.
  assert.equal(isApiTierGateEnabled('0'), false);
});

// The backend (zerogex-oa) serves every endpoint under BOTH /api/* (v1) and
// /api/v2/* (the freshness-envelope surface). RULES is written in the v1 form
// and `covers()` matches whole segments, so an un-normalized versioned path
// matches nothing — and this gate is fail-open, so "nothing matched" means
// "pass". That would hand every premium surface to any caller the moment a
// /api/v2/[...rest] proxy is added. Lock the equivalence down in both
// directions: premium stays premium, and ungated stays ungated.
test('versioned paths gate identically to their unversioned form', () => {
  const cases: Array<[string, ApiAccess | null]> = [
    ['/api/signals/advanced/vol-expansion', 'basic'],
    ['/api/signals/advanced/vol-expansion/accuracy', 'pro'],
    ['/api/signals/advanced/squeeze-setup', 'pro'],
    ['/api/signals/trade-bias', 'pro'],
    ['/api/signals/trade-bias-history', 'pro'],
    ['/api/signals/score', 'basic'],
    ['/api/backtest/runs', 'pro'],
    ['/api/backtest/runs/shared/tok_1', 'public'],
    ['/api/tradeworkz/admin/reset-fleet', 'admin'],
    ['/api/gex/summary', 'basic'],
    ['/api/flow/smart-money', 'basic'],
    ['/api/forced-flow/curve', 'basic'],
    ['/api/replay/frame', 'basic'],
    ['/api/option/quote', 'basic'],
    ['/api/max-pain/current', 'basic'],
    ['/api/technicals', 'basic'],
    ['/api/market/volatility', 'basic'],
    // Deliberately ungated paths must STAY ungated under a version prefix —
    // over-stripping would 403 the anonymous header chrome.
    ['/api/market/quote', null],
    ['/api/market/session-closes', null],
    ['/api/tradeworkz/me/feed', null],
    ['/api/tradeworkz/bots/7/follow', null],
  ];
  for (const [v1Path, expected] of cases) {
    eq(v1Path, expected);
    for (const version of ['v2', 'v3']) {
      eq(v1Path.replace('/api/', `/api/${version}/`), expected);
    }
  }
});

test('version stripping does not over-match lookalike segments', () => {
  // Only a literal /api/v<digits> segment is a version. Anything else keeps
  // its original (unmatched → pass) answer rather than being rewritten.
  eq('/api/version/foo', null);
  eq('/api/v2x/gex/summary', null);
  eq('/api/versioning/gex', null);
  // A bare /api/v2 with no sub-path matches no rule.
  eq('/api/v2', null);
  // The existing anti-startsWith guard still holds after normalization.
  eq('/api/v2/gexfoo', null);
  // Only a LEADING version segment is stripped.
  eq('/api/gex/v2/summary', 'basic');
});
