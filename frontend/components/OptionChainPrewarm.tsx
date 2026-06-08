/**
 * Mounts an invisible global pre-warm for the /api/max-pain/current option
 * chain across the common tickers. Without this, the Strategy Builder pays
 * the full chain fetch (1-3s server-side) every time a user lands on
 * /strategy-builder from a cold tab. The same pattern is used by
 * TechnicalSnapshotPrewarm for VWAP/ORB.
 *
 * The prewarm helper is fire-and-forget and de-duplicates concurrent
 * fetches by symbol, so this component is safe to mount multiple times
 * (e.g. during dev hot-reload) and prewarm calls from elsewhere will not
 * trigger duplicate requests.
 *
 * Deferred to browser idle time so the three concurrent chain fetches
 * (~40 kB each) don't starve the active page's data requests against
 * the browser's 6-connection-per-origin limit.
 */

'use client';

import { useEffect } from 'react';
import { prewarmOptionChain } from '@/core/optionChainCache';
import { scheduleIdle } from '@/core/scheduleIdle';

const PREWARM_SYMBOLS = ['SPY', 'SPX', 'QQQ'] as const;

export default function OptionChainPrewarm() {
  useEffect(() => scheduleIdle(() => {
    PREWARM_SYMBOLS.forEach((symbol) => prewarmOptionChain(symbol));
  }), []);
  return null;
}
