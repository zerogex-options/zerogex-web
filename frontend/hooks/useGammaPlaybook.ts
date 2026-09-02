'use client';

/**
 * useGammaPlaybook — the live inputs behind the Gamma Chart's Playbook
 * ("Where do we expect the underlying to go?").
 *
 * The Playbook's 2×2 is only useful if the highlighted cell is the one the
 * trader is actually IN, for the symbol and expirations they picked on the
 * chart. This hook assembles exactly the levels the chart is drawing —
 * deliberately mirroring GammaTerminalChart's own derivation — and hands them
 * to the pure resolver in core/gammaPlaybook:
 *
 *   • symbol      — the tab-wide underlying (TimeframeContext), or the delayed
 *                   snapshot's symbol in public mode.
 *   • expirations — the tab-shared filter, reconciled per symbol by
 *                   useChartExpirations. The SAME `param` the chart requests, so
 *                   both share one strike-profile-timeseries cache entry.
 *   • levels      — flip / call wall / put wall / max pain from the
 *                   expiration-filtered timeseries bucket when a subset is
 *                   selected (what the chart draws), else the whole-chain
 *                   profile/summary.
 *   • spot/drift  — the chart's tape reading (see core/priceChange).
 *
 * It is also the single source of truth for the Key Levels strip and the Key
 * Levels widget (see core/keyLevels), which is why it returns Max Pain and the
 * Pin Strike alongside the three levels the Playbook's own 2×2 consumes: those
 * surfaces must show exactly the levels the chart above them is drawing, for
 * the same symbol and expirations, without opening a second set of polls.
 *
 * Delayed (public) mode reads the server snapshot and does ZERO client
 * fetching, exactly like the chart it sits under.
 *
 * Polling is deliberately slower than the chart's: the Playbook is a posture
 * read, not a tape, so it doesn't need a 2 Hz refresh of the profile/summary
 * (the quote and timeseries hooks are module-shared with the chart, so they add
 * no extra network at all).
 */

import { useMemo } from 'react';
import { useGEXProfile, useGEXSummary, useMarketQuote, useSessionCloses } from '@/hooks/useApiData';
import { useStrikeProfileTimeseries, type StrikeProfileBucket } from '@/hooks/useStrikeProfileTimeseries';
import { useChartExpirations } from '@/hooks/useChartExpirations';
import { useTimeframe } from '@/core/TimeframeContext';
import { getPrimaryPriceChangeSummary } from '@/core/priceChange';
import { resolvePriceSession } from '@/core/sessionCloses';
import { etTodayDateKey } from '@/core/utils';
import { longGammaAtSpot, netGexAtSpotOrNull } from '@/core/gammaRegime';
import {
  atSpotGammaForPlaybook,
  describePlaybookScenario,
  expirationScopeLabel,
  resolvePlaybookScenario,
  type PlaybookScenario,
} from '@/core/gammaPlaybook';
import { computeMaxPainFromStrikes } from '@/core/keyLevels';
import type { ChartSnapshot } from '@/components/GammaTerminalChart';

// The Playbook's own polls. Slower than the chart's (10s/5s) because a regime
// posture doesn't move tick-to-tick, and this is a second subscriber to the
// same endpoints.
const PROFILE_REFRESH_MS = 30000;
const SUMMARY_REFRESH_MS = 30000;

export interface GammaPlaybookRead {
  symbol: string;
  /** Reconciled expiration selection ([] = all expirations). */
  expirations: string[];
  /** Human label for that selection ("all expirations", "0DTE (…)", …). */
  expirationLabel: string;
  /** True when a strict subset of the chain is selected. */
  filtered: boolean;
  spot: number | null;
  /** Session change behind the spot reading (core/priceChange's tape). */
  spotChange: number | null;
  spotChangePercent: number | null;
  flip: number | null;
  callWall: number | null;
  putWall: number | null;
  /** The options pin, recomputed from the filtered book when one is selected. */
  maxPain: number | null;
  /**
   * Reachable 0DTE positive-gamma pin. Whole-chain by construction (it models
   * into-expiration hedging), so — exactly like the chart's pin line — it is
   * read from the summary and does NOT follow the expiration filter.
   */
  pinStrike: number | null;
  /** Normalized dominance of that pin, for the strength label. */
  pinConfidence: number | null;
  /** At-spot dealer gamma actually used for the regime (null when withheld). */
  netGexAtSpot: number | null;
  /** Modeled long-gamma regime at spot; null when genuinely unknown. */
  longGamma: boolean | null;
  scenario: PlaybookScenario;
  /** One sentence explaining why this cell is the live read. */
  rationale: string;
  /** True while the first levels are still landing (live mode only). */
  loading: boolean;
  /** True in the public delayed mode — the read is ~15 minutes stale. */
  delayed: boolean;
}

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Most-recent bucket that actually carries gamma. Mirrors the chart's
 * `liveGexBucket`: walk back from the tip so an empty / all-zero after-hours
 * bucket doesn't blank the levels.
 */
function lastGammaBucket(buckets: StrikeProfileBucket[]): StrikeProfileBucket | null {
  for (let i = buckets.length - 1; i >= 0; i--) {
    const bucket = buckets[i];
    if (Array.isArray(bucket.strikes) && bucket.strikes.some((s) => num(s.net_gamma))) return bucket;
  }
  return null;
}

export function useGammaPlaybook({
  snapshot = null,
  delayed: delayedProp = false,
}: {
  snapshot?: ChartSnapshot | null;
  delayed?: boolean;
} = {}): GammaPlaybookRead {
  const delayed = delayedProp || !!snapshot;
  const live = !delayed;

  const { symbol: ctxSymbol } = useTimeframe();
  const symbol = snapshot ? snapshot.symbol : ctxSymbol;

  const { selection, param, filtered } = useChartExpirations(symbol, live);

  const { data: gexProfile, loading: profileLoading } = useGEXProfile(symbol, PROFILE_REFRESH_MS, live);
  const { data: gexSummary, loading: summaryLoading } = useGEXSummary(symbol, SUMMARY_REFRESH_MS, live);
  const { data: quote } = useMarketQuote(symbol, 1000, live);
  const { data: sessionCloses } = useSessionCloses(symbol, 60000, quote?.session ?? null, live);
  // Only subscribed when a subset of expirations is selected — that is the only
  // case whose levels differ from the whole-chain profile. Same cache key the
  // chart uses, so on /chart this is a free ride on its existing fetch.
  const { buckets } = useStrikeProfileTimeseries(symbol, '5min', param, false, live && filtered);

  const levelBucket = useMemo(
    () => (live && filtered ? lastGammaBucket(buckets) : null),
    [live, filtered, buckets],
  );

  // Levels, in the chart's own precedence: the expiration-filtered bucket wins
  // when a subset is chosen (so the Playbook reads the book the chart is
  // drawing), then the delayed snapshot, then the whole-chain profile/summary.
  const flip = levelBucket
    ? num(levelBucket.gamma_flip)
    : snapshot
      ? snapshot.gamma.flip
      : num(gexProfile?.gamma_flip ?? gexSummary?.gamma_flip);
  const callWall = levelBucket
    ? num(levelBucket.call_wall)
    : snapshot
      ? snapshot.gamma.callWall
      : num(gexProfile?.call_wall ?? gexSummary?.call_wall);
  const putWall = levelBucket
    ? num(levelBucket.put_wall)
    : snapshot
      ? snapshot.gamma.putWall
      : num(gexProfile?.put_wall ?? gexSummary?.put_wall);
  // Max Pain is not a stored field on the timeseries buckets, so a filtered
  // book recovers it from that bucket's per-strike OI — the same recovery the
  // chart does, so the strip can never print a whole-chain pin beside a
  // filtered chart line.
  const maxPain = levelBucket
    ? computeMaxPainFromStrikes(levelBucket.strikes)
    : snapshot
      ? snapshot.gamma.maxPain
      : num(gexSummary?.max_pain);
  // Pin Strike is summary-only (see the interface note) and absent from the
  // public snapshot, where it degrades to "no active pin".
  const pinStrike = snapshot ? null : num(gexSummary?.pin_strike);
  const pinConfidence = snapshot ? null : num(gexSummary?.pin_confidence);

  // Spot: the same tape reading the chart's price marker rides (live quote in
  // extended hours, the regular close when the tape is shut).
  const tape = getPrimaryPriceChangeSummary({
    quoteClose: snapshot ? snapshot.quote?.close ?? null : quote?.close ?? null,
    // Read as `open` while the served closes are still a session behind, so the spot
    // keeps tracking the tape across 16:00 (see core/sessionCloses.ts).
    quoteSession: resolvePriceSession(
      snapshot ? snapshot.quote?.session ?? null : quote?.session ?? null,
      snapshot ? snapshot.sessionCloses : sessionCloses,
      snapshot ? snapshot.quote?.timestamp ?? null : quote?.timestamp ?? null,
    ),
    sessionCloses: snapshot ? snapshot.sessionCloses : sessionCloses,
    preferLiveExtendedHours: true,
  });
  const spot = tape.displayPrice ?? num(gexProfile?.spot_price ?? gexSummary?.spot_price);

  // Whole-chain at-spot gamma, withheld when the levels above came from a
  // filtered book (see atSpotGammaForPlaybook).
  const netGexAtSpot = atSpotGammaForPlaybook(
    snapshot ? snapshot.gamma.netGexAtSpot : netGexAtSpotOrNull(gexProfile?.net_gex_at_spot),
    filtered && levelBucket != null,
  );

  // Resolved by the shared regime helper, so neither the Playbook's row nor the
  // Key Levels regime chip can contradict the chart's LONG/SHORT badge. Null
  // when the regime is genuinely unknown — callers render nothing, not a guess.
  const longGamma = longGammaAtSpot(netGexAtSpot, spot, flip);

  const scenario = useMemo(
    () =>
      resolvePlaybookScenario({
        spot,
        callWall,
        putWall,
        netGexAtSpot,
        longGamma,
        drift: tape.change,
      }),
    [spot, callWall, putWall, netGexAtSpot, longGamma, tape.change],
  );

  const expirationLabel = useMemo(
    // The snapshot is a whole-chain build; the public view has no expiry picker.
    () => (delayed ? 'all expirations' : expirationScopeLabel(selection, etTodayDateKey())),
    [delayed, selection],
  );

  const rationale = useMemo(
    () => describePlaybookScenario(scenario, { symbol, expirationLabel, spot, flip }),
    [scenario, symbol, expirationLabel, spot, flip],
  );

  return {
    symbol,
    expirations: delayed ? [] : selection,
    expirationLabel,
    filtered: !delayed && filtered,
    spot,
    spotChange: tape.change,
    spotChangePercent: tape.changePercent,
    flip,
    callWall,
    putWall,
    maxPain,
    pinStrike,
    pinConfidence,
    netGexAtSpot,
    longGamma,
    scenario,
    rationale,
    // Only "still landing" until the first response; an unresolved read after
    // that is a degraded book, not a slow one, and says so.
    loading: live && !scenario.resolved && (profileLoading || summaryLoading),
    delayed,
  };
}
