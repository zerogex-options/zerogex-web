/**
 * Fields of the shared quote row that only the HTTP quote endpoint sends.
 *
 * `applyLiveQuote()` (hooks/useApiData.ts) folds each WebSocket tick into the
 * row the HTTP poll last wrote. A WS frame is the cash index's own bar — the
 * ingestion NOTIFY payload — so it never carries the overnight display-swap
 * fields (`display_source`, `futures_close`, …) or the futures contract and
 * freshness labels. Rebuilding the row from the frame alone dropped them on
 * every tick, so overnight and pre-market the header flipped between the ES
 * price (HTTP poll) and the SPX last close (WS tick) — visible once ThetaData
 * started polling SPX through the night and a WS frame went out every second.
 *
 * These fields are owned by the HTTP response: carry them forward across WS
 * ticks, and let the next poll replace or clear them. At 09:30 ET the poll
 * stops sending the swap fields and the header returns to the cash index
 * within one heartbeat.
 */
import type { MarketQuoteRow } from '@/hooks/useApiData';

const HTTP_ONLY_FIELDS = [
  'display_source',
  'data_symbol',
  'futures_close',
  'futures_reference_close',
  'data_contract',
  'data_contract_expiry',
  'stale',
  'data_age_seconds',
] as const;

export type HttpOnlyQuoteFields = Partial<Pick<MarketQuoteRow, (typeof HTTP_ONLY_FIELDS)[number]>>;

export function httpOnlyQuoteFields(prev: MarketQuoteRow | null | undefined): HttpOnlyQuoteFields {
  const carried: Record<string, unknown> = {};
  if (!prev) return carried;
  for (const key of HTTP_ONLY_FIELDS) {
    if (prev[key] !== undefined) carried[key] = prev[key];
  }
  return carried as HttpOnlyQuoteFields;
}
