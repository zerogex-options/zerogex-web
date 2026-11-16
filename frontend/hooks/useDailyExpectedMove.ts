'use client';

import { useApiData, type VolatilityGaugeData } from '@/hooks/useApiData';
import { dailyExpectedMove } from '@/app/live-bulletin/bulletinHelpers';
import { volatilityIndexFor, volIndexPricesSymbol } from '@/core/symbols';
import { levelOrNull } from '@/core/levelValue';

/**
 * The ±1σ daily expected move for `symbol` at `spot`, in price units: the
 * half-width of the Daily Expected Range, built from the live VIX (the S&P
 * names) or VXN (the Nasdaq-100 names) with the same math the chart's Expected
 * Range overlay uses. It is the yardstick core/pinStrike `pinDistance` measures
 * a pin against, so every live surface calls the same pin far at the same time.
 *
 * Null when the move can't be priced: `enabled` false (the delayed public
 * snapshot does no client fetching), a single stock (the index measures the
 * market, not the name), no spot, or no reading yet. Hand the null straight to
 * `pinDistance`, which then falls back to its percent-of-spot rule.
 *
 * The endpoint is Basic-gated, and every surface that calls this shows live
 * data only to Basic members and up. It polls on the chart's own 30-second
 * cadence: the vol index moves slowly next to the 0.75-move cutoff.
 */
export function useDailyExpectedMove(
  symbol: string,
  spot: number | null | undefined,
  enabled = true,
): number | null {
  const on = enabled && volIndexPricesSymbol(symbol);
  const { data } = useApiData<VolatilityGaugeData>(
    `/api/market/volatility?ticker=${volatilityIndexFor(symbol)}`,
    { refreshInterval: on ? 30000 : 0, enabled: on },
  );
  return on ? dailyExpectedMove(spot, levelOrNull(data?.index)) : null;
}
