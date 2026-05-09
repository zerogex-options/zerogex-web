/**
 * Mounts an invisible global pre-warm for the unified `/api/technicals`
 * cache across every supported ticker. Without this the cache would
 * only start filling after a user first visits the Intraday Tools page
 * on each ticker — meaning a fresh tab would show empty charts for any
 * ticker the user hadn't viewed yet today.
 *
 * Pre-warming kicks off the seed fetch and the 5-minute background
 * reload for each ticker, mirroring the lifecycle that
 * `useMarketHistorical` already provides for the underlying-price
 * cache. Once started, the background reload runs forever for the
 * lifetime of the tab, so navigating around the app keeps the cache
 * warm for every ticker rather than just the active one.
 */

'use client';

import { useEffect } from 'react';
import { prewarmTechnicals } from '@/hooks/useTechnicals';

const PREWARM_SYMBOLS = ['SPY', 'SPX', 'QQQ'] as const;

export default function TechnicalSnapshotPrewarm() {
  useEffect(() => {
    PREWARM_SYMBOLS.forEach((symbol) => prewarmTechnicals(symbol));
  }, []);
  return null;
}
