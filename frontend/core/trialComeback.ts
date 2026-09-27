// The "you haven't been back" variant of the day-two trial email: what goes
// into it, decided without any I/O.
//
// Most trial losses are people who look once on signup day and never return
// (docs/outreach: seven of the trialers written up there never came back after
// day one, or came back once). The ordinary day-two email tells them which
// pages to open, which assumes they will open the app. This variant brings the
// product to them instead: the latest levels for the market they trade, what
// those levels mean in a sentence, and how the last forecast was graded.
//
// scripts/send-trial-value-nudge.mts fetches the data, classifies each trialer
// with core/trialEngagement.ts and picks the variant; core/mailer.ts renders
// it. This module is the part between: pure, relative imports only, so
// tests/trialComeback.test.ts runs it under bare node --test.

import { fmtPrice, type GexSummary } from './gexSummary.ts';
import type { ForecastDateEntry } from './trackRecord.ts';

// Used when the member never answered the first-run welcome's "which market do
// you trade?". SPX because it is what the free levels pages and the daily
// levels email lead with.
export const COMEBACK_DEFAULT_SYMBOL = 'SPX';

const MARKET_SYMBOLS = ['SPX', 'SPY', 'QQQ', 'NDX', 'ES', 'NQ'] as const;

// A snapshot older than this is not "the latest levels" in any sense a reader
// would accept. Four days covers a Friday close read on a Monday after a
// holiday; anything older means the feed is down, and the email falls back to
// the ordinary variant rather than print stale numbers as current.
export const MAX_SNAPSHOT_AGE_HOURS = 96;

// The market a member told the first-run welcome they trade, read back from
// that welcome's audit row ("... first-run welcome market=ES"), or null.
export function marketFromWelcomeAudit(message: string | null | undefined): string | null {
  const match = /\bmarket=([A-Z]{2,4})\b/.exec(message ?? '');
  if (!match) return null;
  return (MARKET_SYMBOLS as readonly string[]).includes(match[1]) ? match[1] : null;
}

export type ComebackLevels = {
  symbol: string;
  // The snapshot's own time in ET, e.g. "Fri, Sep 25, 3:59 PM ET".
  asOf: string;
  spot: string;
  flip: string | null;
  callWall: string;
  putWall: string;
  // Where price sat against the flip at that snapshot; null when the flip is
  // unresolved, in which case no regime sentence is printed.
  aboveFlip: boolean | null;
};

function etLabel(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ms));
  return `${parts} ET`;
}

// The levels block, or null when there is nothing honest to show: no data, a
// snapshot older than MAX_SNAPSHOT_AGE_HOURS, or no spot or walls to print.
export function comebackLevels(
  symbol: string,
  data: GexSummary | null | undefined,
  nowMs: number,
): ComebackLevels | null {
  if (!data) return null;
  const ts = Date.parse(data.timestamp);
  if (!Number.isFinite(ts) || nowMs - ts > MAX_SNAPSHOT_AGE_HOURS * 3_600_000) return null;
  const spot = fmtPrice(data.spot_price);
  const callWall = fmtPrice(data.call_wall);
  const putWall = fmtPrice(data.put_wall);
  if (spot === '—' || callWall === '—' || putWall === '—') return null;
  const flipValue = data.gamma_flip;
  const flipResolved = flipValue != null && Number.isFinite(flipValue);
  return {
    symbol,
    asOf: etLabel(ts),
    spot,
    flip: flipResolved ? fmtPrice(flipValue) : null,
    callWall,
    putWall,
    aboveFlip: flipResolved ? data.spot_price >= (flipValue as number) : null,
  };
}

// The same two sentences the dashboard's Today's Read uses for the regime
// (app/live-bulletin/bulletinHelpers.ts), so the email and the app agree.
export function regimeSentence(aboveFlip: boolean | null): string | null {
  if (aboveFlip === null) return null;
  return aboveFlip
    ? 'Above the flip, dealers hedge against direction: moves get sold into, ranges compress and dips tend to mean-revert.'
    : 'Below the flip, dealer hedging amplifies the tape: moves accelerate, ranges expand and trends extend rather than fade.';
}

export type LatestGrade = { date: string; held: boolean };

// The most recent session whose forecast range was graded, or null.
export function latestGradedForecast(
  entries: readonly ForecastDateEntry[] | null | undefined,
): LatestGrade | null {
  const graded = (entries ?? [])
    .filter((e) => typeof e?.date === 'string' && e.has_receipt && e.range_respected != null)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = graded[0];
  return latest ? { date: latest.date, held: latest.range_respected === true } : null;
}

// "Friday, Sep 25" for a YYYY-MM-DD session date.
export function sessionDateLabel(isoDate: string): string {
  const dt = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(dt);
}
