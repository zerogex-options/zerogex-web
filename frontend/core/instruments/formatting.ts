// Instrument-aware price/label formatting. Replaces scattered `.toFixed(2)`
// with registry-driven precision/tick/multiplier so ES/NQ (0.25 tick, $50/$20
// point value) are never rendered as if they were a 2-decimal stock price.

import { getInstrument } from './registry';

/** Decimal places to render a price for `symbol` (registry-driven, default 2). */
export function getPricePrecision(symbol: string): number {
  return getInstrument(symbol)?.pricePrecision ?? 2;
}

/** Options contract multiplier / point value (100 equity, 50 ES, 20 NQ). */
export function getContractMultiplier(symbol: string): number {
  return getInstrument(symbol)?.contractMultiplier ?? 100;
}

/** Underlying minimum price increment (0.25 for ES/NQ; undefined for equities). */
export function getPriceIncrement(symbol: string): number | undefined {
  return getInstrument(symbol)?.priceIncrement;
}

/**
 * Format a price using the instrument's precision. Falls back to 2 decimals
 * for unknown symbols so legacy call-sites are unchanged.
 */
export function formatInstrumentPrice(
  symbol: string,
  value: number | null | undefined,
): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toFixed(getPricePrecision(symbol));
}

/** Round a raw price to the instrument's tick grid (no-op when no tick). */
export function roundToTick(symbol: string, value: number): number {
  const tick = getPriceIncrement(symbol);
  if (!tick || tick <= 0) return value;
  return Math.round(value / tick) * tick;
}

/**
 * Dollar notional of one contract at `price` = price × multiplier.
 * (Frontend display only; the backend uses decimal-safe math for economics.)
 */
export function formatNotional(symbol: string, price: number): string {
  const notional = price * getContractMultiplier(symbol);
  return notional.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
