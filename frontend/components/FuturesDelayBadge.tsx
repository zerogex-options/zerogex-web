"use client";

import { isFuturesSymbol } from "@/core/symbols";
import { FUTURES_REALTIME_PENDING, futuresDelayLabel } from "@/core/futuresDataStatus";

/**
 * Discloses that an ES / NQ quote is running behind the futures market.
 *
 * Driven by the quote's own freshness fields rather than a hardcoded string,
 * for two reasons:
 *
 *  1. it cannot become a lie. The figure shown is measured from the newest
 *     bar the API actually served, so it tracks whatever the feed is really
 *     doing — and the badge disappears by itself the moment the feed catches
 *     up. Nobody has to remember to take it down.
 *  2. it stays correct after the current situation ends. A hardcoded
 *     "10-minute delay" notice is wrong on a real-time feed that has died;
 *     this one reports that honestly too.
 *
 * Only ES / NQ carry `stale` / `data_age_seconds` — the cash index and ETF
 * quote paths never set them, so this renders for futures alone.
 */

interface Props {
  symbol: string | null | undefined;
  stale?: boolean | null;
  dataAgeSeconds?: number | null;
}

export default function FuturesDelayBadge({ symbol, stale, dataAgeSeconds }: Props) {
  if (!isFuturesSymbol(symbol) || !stale) return null;

  const age = typeof dataAgeSeconds === "number" ? dataAgeSeconds : null;
  const label = futuresDelayLabel(age);
  const exact = age != null ? `about ${Math.round(age / 60)} minutes` : "an unknown amount";

  const title =
    `${symbol} quotes come from a delayed CME feed and are running ${exact} behind the ` +
    `futures market. The dealer levels on this page are computed from live ` +
    `${symbol === "NQ" ? "NDX" : "SPX"} options and are current.` +
    (FUTURES_REALTIME_PENDING
      ? " Real-time futures data is being enabled — this notice will clear itself once it is live."
      : "");

  return (
    <span
      className="px-1.5 py-0.5 rounded font-bold tracking-wide w-fit whitespace-nowrap"
      title={title}
      style={{
        backgroundColor: "var(--color-warning-soft)",
        color: "var(--color-warning)",
        fontSize: "10px",
      }}
    >
      ⏱ {label}
    </span>
  );
}
