/**
 * Mounts an invisible global pre-warm for the technicals VWAP/ORB
 * caches across every supported ticker. Without this the caches would
 * only start accumulating snapshots after a user first visits the
 * Intraday Tools page on each ticker — meaning a fresh tab would still
 * show an empty "VWAP VS UNDERLYING PRICE" / "ORB BREAKOUT MAP" chart
 * for any ticker the user hadn't viewed yet today.
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
import { prewarmTechnicalSnapshots } from '@/hooks/useTechnicalSnapshot';

const PREWARM_SYMBOLS = ['SPY', 'SPX', 'QQQ'] as const;

export default function TechnicalSnapshotPrewarm() {
  useEffect(() => {
    PREWARM_SYMBOLS.forEach((symbol) => prewarmTechnicalSnapshots(symbol));
  }, []);
  return null;
}
