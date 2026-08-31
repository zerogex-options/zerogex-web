"use client";

import { isFuturesSymbol } from "@/core/symbols";
import { futuresDelayLabel, futuresDelayTitle } from "@/core/futuresDataStatus";

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
 * Both strings come from core/futuresDataStatus — the label from the measured
 * age, the tooltip from the age AND the entitlement state, since a real-time
 * feed running late is a stalled feed rather than a delayed one. Keeping the
 * copy there is deliberate: that module is the single place to revisit when
 * the CME entitlement changes, and this component renders whatever it says.
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
  // The leading `!symbol` is redundant at runtime — isFuturesSymbol already
  // rejects null and undefined — but it is what narrows the prop to `string`
  // for futuresDelayTitle, which takes one.
  if (!symbol || !isFuturesSymbol(symbol) || !stale) return null;

  const age = typeof dataAgeSeconds === "number" ? dataAgeSeconds : null;
  const label = futuresDelayLabel(age);
  const title = futuresDelayTitle(symbol, age);

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
