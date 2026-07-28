// Unit tests for the centralized instrument registry (core/instruments/*).
// Mirrors the backend test_instruments.py contract: static metadata plus the
// NEXT_PUBLIC_* feature-flag-driven runtime availability that gates ES/NQ.
import test from 'node:test';
import assert from 'node:assert/strict';

// Only registry.ts is imported here: it is self-contained (reads process.env
// only), so it loads under the Node type-stripping runner. formatting.ts does
// a runtime import of the registry (which the Node runner can't resolve without
// a `.ts` extension that would break tsc), so it is covered by tsc + real usage
// rather than node:test — the same self-contained-only constraint the existing
// core tests follow. Multiplier/precision are asserted straight off the
// registry, which is exactly what formatting.ts reads.
const {
  INSTRUMENTS,
  getInstrument,
  getAvailability,
  getEffectiveCapabilities,
  enabledSymbols,
  isInstrumentSymbol,
  isFuturesSymbol,
} = await import('../core/instruments/registry.ts');

const { analyticsSourceLabel, capabilityUnavailableMessage } = await import(
  '../core/instruments/labels.ts'
);

const getContractMultiplier = (s: string) => getInstrument(s)!.contractMultiplier;
const getPricePrecision = (s: string) => getInstrument(s)!.pricePrecision;

const FUTURES_FLAGS = [
  'NEXT_PUBLIC_ENABLE_FUTURES_ANALYTICS',
  'NEXT_PUBLIC_ENABLE_ES_ANALYTICS',
  'NEXT_PUBLIC_ENABLE_NQ_ANALYTICS',
  'NEXT_PUBLIC_ENABLE_ES_REFERENCE_MODE',
  'NEXT_PUBLIC_ENABLE_NQ_REFERENCE_MODE',
];

test.beforeEach(() => {
  for (const f of FUTURES_FLAGS) delete process.env[f];
});

test('all six instruments are registered', () => {
  assert.deepEqual(
    new Set(Object.keys(INSTRUMENTS)),
    new Set(['SPY', 'SPX', 'QQQ', 'NDX', 'ES', 'NQ']),
  );
});

test('equity multipliers are 100, futures are CME point values', () => {
  for (const s of ['SPY', 'SPX', 'QQQ', 'NDX']) {
    assert.equal(getContractMultiplier(s), 100);
  }
  assert.equal(getContractMultiplier('ES'), 50);
  assert.equal(getContractMultiplier('NQ'), 20);
});

test('asset classes and analytics sources distinguish CME from OPRA', () => {
  assert.equal(getInstrument('SPX')!.assetClass, 'index');
  assert.equal(getInstrument('SPY')!.assetClass, 'etf');
  assert.equal(getInstrument('ES')!.assetClass, 'future');
  assert.equal(getInstrument('ES')!.analyticsSource, 'cme_futures_options');
  assert.equal(getInstrument('SPX')!.analyticsSource, 'opra_equity_options');
  assert.equal(getInstrument('ES')!.marketCalendar, 'cme_equity_index');
  assert.ok(isFuturesSymbol('NQ'));
  assert.ok(!isFuturesSymbol('SPY'));
  assert.ok(isInstrumentSymbol('es'));
  assert.ok(!isInstrumentSymbol('tsla'));
});

test('futures tick size and reference source', () => {
  assert.equal(getInstrument('ES')!.priceIncrement, 0.25);
  assert.equal(getInstrument('ES')!.referenceSourceSymbol, 'SPX');
  assert.equal(getInstrument('NQ')!.referenceSourceSymbol, null);
});

test('equities always available, futures off by default', () => {
  for (const s of ['SPY', 'SPX', 'QQQ', 'NDX']) {
    assert.equal(getAvailability(s).available, true);
  }
  assert.equal(getAvailability('ES').available, false);
  assert.equal(getAvailability('NQ').available, false);
  assert.deepEqual(enabledSymbols(), ['SPY', 'SPX', 'QQQ', 'NDX']);
});

test('ES true analytics enabled by the futures-analytics flag', () => {
  process.env.NEXT_PUBLIC_ENABLE_FUTURES_ANALYTICS = 'true';
  const a = getAvailability('ES');
  assert.equal(a.trueAnalytics, true);
  assert.equal(a.available, true);
  assert.ok(enabledSymbols().includes('ES'));
  assert.equal(getEffectiveCapabilities('ES')!.gex, true);
  // strategy builder stays off (not recalibrated for futures).
  assert.equal(getEffectiveCapabilities('ES')!.strategyBuilder, false);
});

test('ES reference mode is separate from true analytics', () => {
  process.env.NEXT_PUBLIC_ENABLE_ES_REFERENCE_MODE = 'true';
  const a = getAvailability('ES');
  assert.equal(a.referenceMode, true);
  assert.equal(a.trueAnalytics, false);
  assert.equal(a.available, true);
  assert.equal(getEffectiveCapabilities('ES')!.futuresReferenceMode, true);
  assert.equal(getEffectiveCapabilities('ES')!.gex, false); // not true CME GEX
});

test('NQ reference mode stays off even with the flag (no source wired)', () => {
  process.env.NEXT_PUBLIC_ENABLE_NQ_REFERENCE_MODE = 'true';
  const a = getAvailability('NQ');
  assert.equal(a.referenceMode, false);
  assert.ok(a.reasons.some((r) => r.includes('naive QQQ')));
});

test('effective capabilities are null for unknown, gated for disabled futures', () => {
  assert.equal(getEffectiveCapabilities('TSLA'), null);
  assert.equal(getEffectiveCapabilities('ES')!.gex, false); // disabled by default
  assert.equal(getEffectiveCapabilities('SPY')!.gex, true);
});

test('registry carries the precision/tick that formatting reads', () => {
  assert.equal(getPricePrecision('ES'), 2);
  assert.equal(getInstrument('ES')!.priceIncrement, 0.25);
  assert.equal(getInstrument('SPY')!.priceIncrement, undefined);
});

test('analytics-source labels distinguish CME / OPRA / SPX-derived', () => {
  assert.equal(analyticsSourceLabel('opra_equity_options').title, 'OPRA equity options');
  assert.equal(analyticsSourceLabel('cme_futures_options').title, 'CME futures options');
  const ref = analyticsSourceLabel('cme_futures_options', { referenceMode: true });
  assert.match(ref.title, /SPX-derived ES reference/);
  assert.match(ref.subtitle ?? '', /Not calculated from CME futures options/);
  assert.equal(ref.tone, 'warning');
  // cash_index_projection always reads as reference regardless of opts.
  assert.equal(analyticsSourceLabel('cash_index_projection').tone, 'warning');
});

test('capability unavailable message is futures-aware', () => {
  assert.match(capabilityUnavailableMessage(true), /calibrated for CME futures/);
  assert.equal(capabilityUnavailableMessage(true, ['custom reason']), 'custom reason');
});
