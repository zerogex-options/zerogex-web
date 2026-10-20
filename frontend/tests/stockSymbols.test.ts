// Unit tests for single stocks (NVDA) as a fourth asset class on the picker.
//
// A stock behaves like an ETF almost everywhere: its own price and volume, its
// own option chain, extended hours. What this pins is the short list of places
// it does not:
//
//   * every picker symbol sits in exactly one class, and the grouped dropdowns
//     draw each class under its own heading;
//   * a stock's comparison partner is its benchmark ETF — QQQ for a Nasdaq
//     listing, SPY for anything else — on both two-symbol pages;
//   * a stock reads VIX / VXN as market context but never prices its own range
//     from it, since its implied vol runs well above either index;
//   * a stock is kept off the surfaces it has nothing for yet: the free
//     levels product (no landing page), and the forecast / signal pickers
//     (no model runs on it).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ETF_SYMBOLS,
  FUTURES_SYMBOLS,
  INDEX_SYMBOLS,
  LEVELS_PAGE_SYMBOLS,
  LIKE_PAIR,
  MODELED_SYMBOLS,
  SAME_INDEX_PAIR,
  STOCK_LISTING,
  STOCK_SYMBOLS,
  SYMBOLS,
  SYMBOL_GROUPS,
  assetClassOf,
  isFuturesSymbol,
  isStockSymbol,
  likePairFor,
  resolveSymbol,
  sameIndexPairFor,
  stockBenchmarkFor,
  volIndexPricesSymbol,
  volatilityIndexFor,
} from '../core/symbols.ts';
import { isUnderlyingSymbol } from '../core/symbolPersistence.ts';
import { buildReportModel } from '../app/live-bulletin/bulletinHelpers.ts';

test('the picker is the four classes end to end, each symbol in exactly one', () => {
  assert.deepEqual(
    [...SYMBOLS],
    [...ETF_SYMBOLS, ...INDEX_SYMBOLS, ...FUTURES_SYMBOLS, ...STOCK_SYMBOLS],
  );
  assert.deepEqual([...ETF_SYMBOLS], ['SPY', 'QQQ']);
  assert.deepEqual([...INDEX_SYMBOLS], ['SPX', 'NDX']);
  assert.deepEqual([...FUTURES_SYMBOLS], ['ES', 'NQ']);
  assert.ok(STOCK_SYMBOLS.includes('NVDA'));
  assert.equal(new Set(SYMBOLS).size, SYMBOLS.length, 'no symbol is in two classes');

  const grouped = SYMBOL_GROUPS.flatMap((g) => [...g.symbols]);
  assert.deepEqual(grouped, [...SYMBOLS], 'the grouped dropdown lists every symbol once, in order');
  assert.deepEqual(
    SYMBOL_GROUPS.map((g) => g.assetClass),
    ['etf', 'index', 'future', 'stock'],
  );
});

test('assetClassOf names each class, and nothing else', () => {
  assert.equal(assetClassOf('SPY'), 'etf');
  assert.equal(assetClassOf('ndx'), 'index');
  assert.equal(assetClassOf('ES'), 'future');
  assert.equal(assetClassOf('NVDA'), 'stock');
  assert.equal(assetClassOf('TSLA'), null);
  assert.equal(assetClassOf(null), null);
  assert.equal(isStockSymbol('nvda'), true);
  assert.equal(isStockSymbol('QQQ'), false);
  assert.equal(isFuturesSymbol('NVDA'), false);
});

test('NVDA validates and persists like any other underlying', () => {
  assert.equal(isUnderlyingSymbol('NVDA'), true);
  assert.equal(resolveSymbol('nvda'), 'NVDA');
  // An unlisted ticker still falls back rather than leaking through.
  assert.equal(isUnderlyingSymbol('TSLA'), false);
  assert.equal(resolveSymbol('TSLA'), 'SPY');
});

test('a stock compares against QQQ when Nasdaq-listed, SPY otherwise', () => {
  assert.equal(STOCK_LISTING.NVDA, 'NASDAQ');
  assert.equal(stockBenchmarkFor('NVDA'), 'QQQ');
  assert.equal(stockBenchmarkFor('SPY'), null);
  for (const s of STOCK_SYMBOLS) {
    const expected = STOCK_LISTING[s] === 'NASDAQ' ? 'QQQ' : 'SPY';
    assert.equal(stockBenchmarkFor(s), expected, s);
    // Pair Comparison's second column and the Gamma Terminal's second ladder.
    assert.equal(likePairFor(s), expected, `${s} like-pair`);
    assert.equal(sameIndexPairFor(s), expected, `${s} same-index pair`);
    assert.equal(LIKE_PAIR[s], expected);
    assert.equal(SAME_INDEX_PAIR[s], expected);
  }
  // The ETF keeps its own partner: the stock pairing is one-way.
  assert.equal(likePairFor('QQQ'), 'SPY');
  assert.equal(sameIndexPairFor('QQQ'), 'NDX');
});

test('a stock reads its benchmark vol index but never prices a range from it', () => {
  assert.equal(volatilityIndexFor('NVDA'), 'VXN');
  assert.equal(volIndexPricesSymbol('NVDA'), false);
  for (const s of [...ETF_SYMBOLS, ...INDEX_SYMBOLS, ...FUTURES_SYMBOLS]) {
    assert.equal(volIndexPricesSymbol(s), true, s);
  }

  const inputs = {
    spot: 190,
    priorClose: 188,
    summary: { spot_price: 190, gamma_flip: 185, call_wall: 200, put_wall: 180 },
    vix: 22,
    volIndex: 'VXN' as const,
    horizon: 'daily' as const,
  };
  assert.equal(buildReportModel({ ...inputs, symbol: 'NVDA' }).expectedRange, null);
  assert.notEqual(buildReportModel({ ...inputs, symbol: 'QQQ' }).expectedRange, null);
});

test('a stock stays off the free levels product and the model pickers', () => {
  for (const s of STOCK_SYMBOLS) {
    assert.ok(!(LEVELS_PAGE_SYMBOLS as readonly string[]).includes(s), `${s} has no levels page`);
    assert.ok(!(MODELED_SYMBOLS as readonly string[]).includes(s), `${s} has no signal or forecast model`);
  }
  for (const s of SYMBOLS.filter((x) => !isStockSymbol(x))) {
    assert.ok((LEVELS_PAGE_SYMBOLS as readonly string[]).includes(s), `${s} keeps its levels page`);
    assert.ok((MODELED_SYMBOLS as readonly string[]).includes(s), `${s} keeps its models`);
  }
});
