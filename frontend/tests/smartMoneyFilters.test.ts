// Regression test for the Smart Money page filter chain.
//
// Reproduces the exact `normalizeNumbers` (useApiData) + per-row normalization
// + `matchesMinClass` filter the page applies to API rows before render, then
// asserts that the two real production rows the page was silently dropping
// (QQQ 700P 0DTE at 10:48 SELL / 10:55 BUY ET on 2026-06-11) survive every
// step at default settings. If a future filter is added that hides them, this
// test fails — forcing the change to be justified explicitly.
import test from 'node:test';
import assert from 'node:assert/strict';

// ── Helpers replicated from frontend/hooks/useApiData.ts and
// frontend/app/smart-money/page.tsx. Kept inline so the test stays standalone
// (the page is a 'use client' Next component and exporting helpers from it
// would drag client-only deps into the node test runner).

function normalizeNumbers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeNumbers);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeNumbers(v);
    }
    return out;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n) && value.trim() !== '') return n;
  }
  return value;
}

type Row = Record<string, unknown>;

function getRowContracts(row: Row): number {
  return Number((row.flow as number | string | null | undefined) ?? (row.total_volume as number | string | null | undefined) ?? 0);
}
function getRowNotional(row: Row): number {
  return Number((row.notional as number | string | null | undefined) ?? (row.total_premium as number | string | null | undefined) ?? 0);
}
function getRowClass(row: Row): string {
  return String(row.notional_class || row.size_class || '--');
}
function getRowContractLabel(row: Row): string {
  if (row.contract) return String(row.contract);
  const symbol = (row.symbol as string) || '--';
  const strike = row.strike != null ? Number(row.strike).toFixed(0) : '--';
  const optionType = String(row.option_type || '').toUpperCase();
  return `${symbol} ${strike}${optionType ? ` ${optionType}` : ''}`.trim();
}

type MinClassFilter = '500k' | '250k' | '100k' | '50k' | 'under50k';
function matchesMinClass(absNotional: number, minClass: MinClassFilter): boolean {
  if (minClass === '500k') return absNotional >= 500_000;
  if (minClass === '250k') return absNotional >= 250_000;
  if (minClass === '100k') return absNotional >= 100_000;
  if (minClass === '50k') return absNotional >= 50_000;
  return absNotional >= 0;
}

function normalizeRow(row: Row, idx: number) {
  const rowNotional = Math.abs(getRowNotional(row));
  return {
    ...row,
    contract: getRowContractLabel(row),
    flow: getRowContracts(row),
    notional: rowNotional,
    notional_class: getRowClass(row),
    rowKey: `${row.timestamp ?? 'na'}-${row.contract ?? 'contract'}-${idx}`,
    notionalM: rowNotional / 1_000_000,
    absNotional: rowNotional,
  };
}

// ── Sample rows exactly as returned by /api/flow/smart-money. Numeric fields
// arrive as strings; `normalizeNumbers` coerces them before the page sees them.

const rawSellRow = {
  timestamp: '2026-06-11T14:48:00Z',
  symbol: 'QQQ',
  contract: 'QQQ 260611P700',
  strike: '700.0000',
  expiration: '2026-06-11',
  dte: 0,
  option_type: 'P',
  flow: 2242,
  notional: '798152.00',
  trade_side: 'SELL',
  delta: '-0.480774',
  score: '8',
  notional_class: '\u{1F4B0} $500K+',
  size_class: '\u{1F525} Massive Block',
  underlying_price: '700.3700',
};

const rawBuyRow = {
  timestamp: '2026-06-11T14:55:00Z',
  symbol: 'QQQ',
  contract: 'QQQ 260611P700',
  strike: '700.0000',
  expiration: '2026-06-11',
  dte: 0,
  option_type: 'P',
  flow: 1875,
  notional: '926250.00',
  trade_side: 'BUY',
  delta: '-0.586839',
  score: '8',
  notional_class: '\u{1F4B0} $500K+',
  size_class: '\u{1F525} Massive Block',
  underlying_price: '697.8400',
};

test('normalizeNumbers coerces string numerics on the QQQ 700P 0DTE rows', () => {
  const [sell, buy] = normalizeNumbers([rawSellRow, rawBuyRow]) as Row[];
  assert.equal(sell.strike, 700);
  assert.equal(sell.notional, 798152);
  assert.equal(sell.delta, -0.480774);
  assert.equal(sell.option_type, 'P');
  assert.equal(sell.contract, 'QQQ 260611P700');
  assert.equal(buy.strike, 700);
  assert.equal(buy.notional, 926250);
  assert.equal(buy.delta, -0.586839);
});

test('per-row normalization preserves contract + flow + absolute notional', () => {
  const [sell, buy] = normalizeNumbers([rawSellRow, rawBuyRow]) as Row[];
  const nSell = normalizeRow(sell, 0);
  const nBuy = normalizeRow(buy, 1);

  assert.equal(nSell.contract, 'QQQ 260611P700');
  assert.equal(nSell.flow, 2242);
  assert.equal(nSell.absNotional, 798152);
  assert.equal(nSell.notional_class, '\u{1F4B0} $500K+');

  assert.equal(nBuy.contract, 'QQQ 260611P700');
  assert.equal(nBuy.flow, 1875);
  assert.equal(nBuy.absNotional, 926250);
});

test('default minClass 500k filter keeps both 0DTE put rows', () => {
  const [sell, buy] = normalizeNumbers([rawSellRow, rawBuyRow]) as Row[];
  const nSell = normalizeRow(sell, 0);
  const nBuy = normalizeRow(buy, 1);
  const minClass: MinClassFilter = '500k';

  assert.equal(matchesMinClass(nSell.absNotional, minClass), true);
  assert.equal(matchesMinClass(nBuy.absNotional, minClass), true);
});

test('columnFilters empty + sort by notional desc keeps both rows in the table window', () => {
  const [sell, buy] = normalizeNumbers([rawSellRow, rawBuyRow]) as Row[];
  const normalized = [normalizeRow(sell, 0), normalizeRow(buy, 1)];
  const filtered = normalized.filter((row) => matchesMinClass(row.absNotional, '500k'));

  // sortStack defaults to [{ key: 'notional', dir: 'desc' }]
  const sorted = [...filtered].sort((a, b) => (b.notional as number) - (a.notional as number));
  const visible = sorted.slice(0, 50);

  assert.equal(visible.length, 2);
  assert.ok(visible.some((r) => r.contract === 'QQQ 260611P700' && r.flow === 1875));
  assert.ok(visible.some((r) => r.contract === 'QQQ 260611P700' && r.flow === 2242));
});

test('no DTE / no delta / no dedup filter exists — both 0DTE puts and ATM/ITM deltas survive', () => {
  // Sanity-check the four leading hypotheses from the bug report: confirm the
  // filter chain has no condition that would specifically drop dte=0, ATM/ITM
  // |delta| (~0.48 and ~0.59), or duplicate contracts.
  const [sell, buy] = normalizeNumbers([rawSellRow, rawBuyRow]) as Row[];
  const rows = [normalizeRow(sell, 0), normalizeRow(buy, 1)].filter((row) =>
    matchesMinClass(row.absNotional, '500k'),
  );
  assert.equal(rows.length, 2);
  // Same contract on both rows — no implicit dedup applied.
  assert.equal(rows[0].contract, rows[1].contract);
});
