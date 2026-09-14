// Shaping the free delayed dealer-positioning snapshot into an MCP tool result.
//
// Pure functions only — no fetching, no 'server-only', no Next.js. The caller
// supplies an already-fetched snapshot; everything here turns it into the two
// halves of a CallToolResult: the `content` text a language model actually
// reads, and the `structuredContent` object a program consumes.
//
// The bias throughout is that this data is DELAYED and a model has no way to
// know that on its own. Hand a model the number 6412.50 and it will tell a
// trader the gamma flip is at 6412.50, in exactly the confident register it
// uses for a live quote. So the age and the delay go in the text, first, every
// call — a JSON field the model may or may not attend to is not good enough.

// Relative rather than '@/...' on purpose: tests/mcpLevels.test.ts runs this
// module under `node --experimental-strip-types`, which has no tsconfig path
// alias to resolve. Both imports are alias-free leaf modules for the same
// reason.
import { formatGexCompact } from '../signalHelpers.ts';
import type { PickerSymbol } from '../symbols.ts';

/**
 * The subset of /api/gex/summary the free gamma-levels pages render. Kept to
 * the derived-levels zone that is already public on those pages — no raw chain,
 * no per-contract quotes, no live price stream.
 */
export interface GexSnapshot {
  timestamp?: string | null;
  symbol?: string | null;
  spot_price?: number | null;
  net_gex?: number | null;
  net_gex_at_spot?: number | null;
  gamma_flip?: number | null;
  call_wall?: number | null;
  put_wall?: number | null;
  max_pain?: number | null;
  pin_strike?: number | null;
  pin_strike_reason?: string | null;
  put_call_ratio?: number | null;
}

/**
 * How far behind live the free tier runs. Matches `revalidate = 900` on the
 * public gamma-levels routes: same data, same cache entry, same delay.
 */
export const DELAY_SECONDS = 900;

/**
 * Past this age during a regular session the snapshot is not merely delayed,
 * it is not refreshing — one missed cache cycle plus headroom. Below it, age is
 * the ordinary free-tier delay and saying "stale" would be crying wolf.
 */
const BEHIND_SECONDS = 2 * DELAY_SECONDS;

/** Past this, do not let a level be quoted as descriptive of now at all. */
const STALE_SECONDS = 4 * DELAY_SECONDS;

export type MarketPhase = 'open' | 'closed';

function ageSeconds(timestamp: string | null | undefined, now: Date): number | null {
  if (!timestamp) return null;
  const then = Date.parse(timestamp);
  if (!Number.isFinite(then)) return null;
  // Clamp at zero: a snapshot stamped slightly ahead of us is clock skew
  // between the API host and this one, not data from the future.
  return Math.max(0, Math.round((now.getTime() - then) / 1000));
}

function humanAge(seconds: number): string {
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min ago`;
  const hours = (minutes / 60).toFixed(1);
  return `${hours} h ago`;
}

/**
 * The first line of every tool result: how old this snapshot is and what the
 * model is allowed to say about it.
 *
 * The instruction half matters as much as the number. Tool output is one of the
 * few places a model reliably follows direction, because it arrives attached to
 * the thing it just asked for — and `age_seconds: 2400` on its own means
 * nothing to something that does not know the refresh cadence.
 */
export function freshnessLine(
  timestamp: string | null | undefined,
  phase: MarketPhase,
  now: Date,
): string {
  const age = ageSeconds(timestamp, now);

  if (age === null) {
    return (
      'UNDATED — this snapshot carries no timestamp, so its age cannot be established. ' +
      'Say so, and do not present these levels as current.'
    );
  }

  const stamp = `computed ${humanAge(age)} (${timestamp})`;

  if (phase === 'closed') {
    // Outside regular hours every age is expected: nothing is recomputing, so
    // the last snapshot of the session is as fresh as this data will ever be.
    // Flagging it would make the model hedge about data that is fine.
    return `Market is closed. Last snapshot of the session, ${stamp}.`;
  }

  if (age > STALE_SECONDS) {
    return (
      `STALE — ${stamp}. This is well past the normal refresh, so the feed is likely behind. ` +
      'The market has probably traded through these levels. Say they are stale; do not present ' +
      'them as describing the market now.'
    );
  }

  if (age > BEHIND_SECONDS) {
    return (
      `RUNNING BEHIND — ${stamp}, past the usual 15-minute delay. Quote the age with every ` +
      'level and treat the read as provisional.'
    );
  }

  return (
    `Free delayed snapshot, ${stamp} — up to 15 minutes behind the live market by design. ` +
    'State the age when you quote these levels, and never call them live or real-time.'
  );
}

function priceLine(label: string, value: number | null | undefined, spot: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return `- ${label}: unavailable (the modeled book does not support this level right now — this is not zero)`;
  }
  const price = value.toFixed(2);
  if (spot == null || !Number.isFinite(spot) || spot === 0) return `- ${label}: ${price}`;
  const delta = value - spot;
  const pct = (delta / spot) * 100;
  const dir = delta >= 0 ? 'above' : 'below';
  return `- ${label}: ${price} (${Math.abs(pct).toFixed(2)}% ${dir} spot)`;
}

/**
 * The modeled regime, from the sign of dealer gamma at spot.
 *
 * Reads `net_gex_at_spot` only. The whole-chain `net_gex` total can carry the
 * opposite sign to the book around spot, and it is the value at spot that
 * describes how hedging behaves at the current price.
 */
export function regimeOf(snapshot: GexSnapshot): 'long' | 'short' | 'unknown' {
  const atSpot = snapshot.net_gex_at_spot;
  if (atSpot == null || !Number.isFinite(atSpot)) return 'unknown';
  return atSpot >= 0 ? 'long' : 'short';
}

function regimeLine(snapshot: GexSnapshot): string {
  switch (regimeOf(snapshot)) {
    case 'long':
      return (
        '- Modeled regime: LONG gamma at spot. Dealer hedging tends to dampen moves ' +
        '(selling strength, buying weakness). A tendency, not a rule.'
      );
    case 'short':
      return (
        '- Modeled regime: SHORT gamma at spot. Dealer hedging tends to amplify moves, ' +
        'so ranges tend to widen. A tendency, not a rule.'
      );
    default:
      return '- Modeled regime: unknown (net dealer gamma at spot is unavailable in this snapshot).';
  }
}

/** Human-readable text block for one symbol, without the freshness header. */
export function formatSnapshot(symbol: PickerSymbol, snapshot: GexSnapshot): string {
  const spot = snapshot.spot_price ?? null;
  const lines: string[] = [];

  lines.push(`${symbol} — modeled options dealer positioning`);
  lines.push(
    spot != null && Number.isFinite(spot)
      ? `- Spot the levels were computed against: ${spot.toFixed(2)}`
      : '- Spot: unavailable',
  );
  lines.push(regimeLine(snapshot));
  lines.push(
    snapshot.net_gex_at_spot != null && Number.isFinite(snapshot.net_gex_at_spot)
      ? `- Net dealer gamma at spot: ${formatGexCompact(snapshot.net_gex_at_spot)}`
      : '- Net dealer gamma at spot: unavailable',
  );
  lines.push(priceLine('Gamma flip', snapshot.gamma_flip, spot));
  lines.push(priceLine('Call wall', snapshot.call_wall, spot));
  lines.push(priceLine('Put wall', snapshot.put_wall, spot));
  lines.push(priceLine('Max pain', snapshot.max_pain, spot));

  if (snapshot.pin_strike != null && Number.isFinite(snapshot.pin_strike)) {
    lines.push(priceLine('Pin strike (same-day)', snapshot.pin_strike, spot));
  } else {
    // The reason code is the difference between "no pin today" and "something
    // is broken", and only one of those is worth mentioning to a user.
    const reason = snapshot.pin_strike_reason;
    lines.push(
      `- Pin strike (same-day): none${reason ? ` (${reason})` : ''} — normal when there is no ` +
        'same-day expiry left or no reachable strike has restoring gamma.',
    );
  }

  if (snapshot.put_call_ratio != null && Number.isFinite(snapshot.put_call_ratio)) {
    lines.push(`- Put/call ratio: ${snapshot.put_call_ratio.toFixed(2)}`);
  }

  // ES and NQ have no options book of their own. Saying "the ES chain" would be
  // false, and a user reading a futures level needs to know it was carried onto
  // the futures axis rather than computed there.
  if (symbol === 'ES' || symbol === 'NQ') {
    const chain = symbol === 'ES' ? 'SPX' : 'NDX';
    lines.push(
      `- Note: ${symbol} has no options chain of its own. These are the ${chain} option-derived ` +
        `levels carried onto the ${symbol} futures price axis. They are already on the right axis ` +
        '— do not apply a basis offset.',
    );
  }

  return lines.join('\n');
}

/** The machine-readable half of the tool result for one symbol. */
export function structuredSnapshot(
  symbol: PickerSymbol,
  snapshot: GexSnapshot,
  phase: MarketPhase,
  now: Date,
): Record<string, unknown> {
  return {
    symbol,
    as_of: snapshot.timestamp ?? null,
    age_seconds: ageSeconds(snapshot.timestamp, now),
    // Named so no consumer can mistake this for the real-time product.
    data_tier: 'free-delayed',
    max_delay_seconds: DELAY_SECONDS,
    market_phase: phase,
    spot: snapshot.spot_price ?? null,
    regime: regimeOf(snapshot),
    net_gex_at_spot: snapshot.net_gex_at_spot ?? null,
    gamma_flip: snapshot.gamma_flip ?? null,
    call_wall: snapshot.call_wall ?? null,
    put_wall: snapshot.put_wall ?? null,
    max_pain: snapshot.max_pain ?? null,
    pin_strike: snapshot.pin_strike ?? null,
    pin_strike_reason: snapshot.pin_strike_reason ?? null,
    put_call_ratio: snapshot.put_call_ratio ?? null,
  };
}

/** One-line summary per symbol, for the multi-symbol overview tool. */
export function summarizeSnapshot(symbol: PickerSymbol, snapshot: GexSnapshot): string {
  const spot = snapshot.spot_price;
  const flip = snapshot.gamma_flip;
  const regime = regimeOf(snapshot);
  const regimeWord = regime === 'unknown' ? 'regime unknown' : `${regime} gamma`;
  const spotText = spot != null && Number.isFinite(spot) ? spot.toFixed(2) : 'n/a';
  const flipText = flip != null && Number.isFinite(flip) ? flip.toFixed(2) : 'unavailable';
  return `- ${symbol}: spot ${spotText}, ${regimeWord}, flip ${flipText}`;
}
