'use client';

import { useState } from 'react';

import SectionHead from '@/components/layout/SectionHead';
import BetaBadge from '@/components/BetaBadge';
import SymbolPicker from '@/components/SymbolPicker';
import { CASH_SYMBOLS, type PickerSymbol } from '@/core/symbols';
import type { HedgingFlowPayload } from '@/hooks/useHedgingFlow';
import type { GammaRegimeSeriesPayload } from '@/hooks/useGammaRegimeSeries';
import type { GammaWeatherPayload } from '@/hooks/useGammaWeather';
import HedgingFlowPanels, { ZeroDteToggle } from '../../HedgingFlowPanels';

/**
 * The dated permalink's client half — state and nothing else.
 *
 * It fetches NOTHING. Its server component already has the session, which is
 * what makes this page a public permalink rather than a gated tool: the live
 * route's browser calls go through the tier-gated BFF, so a client fetch here
 * would leave an anonymous visitor (or a crawler) looking at a header and an
 * error. A finished session is also immutable, so there is nothing a poll
 * could learn.
 *
 * It owns the header rather than receiving it because the 0DTE toggle belongs
 * beside the symbol picker, and the toggle is state — so the row they share
 * has to be rendered on this side of the boundary.
 *
 * Both scopes arrive together and the toggle switches between them locally.
 * That is the reason the snapshot stores two: on a live session the toggle
 * re-queries, but the trades a past session would be re-queried FROM are
 * pruned at 90 days.
 */
export default function DatedHedgingFlow({
  symbol,
  sessionDateKey,
  humanDate,
  pickerHrefs,
  all,
  zeroDte,
  regime,
  weather,
  weatherNotReady,
}: {
  symbol: PickerSymbol;
  sessionDateKey: string;
  humanDate: string;
  pickerHrefs: Record<PickerSymbol, string>;
  all: HedgingFlowPayload | null;
  /** Null when that session was not an expiry — the toggle then hides. */
  zeroDte: HedgingFlowPayload | null;
  regime: GammaRegimeSeriesPayload | null;
  weather: GammaWeatherPayload | null;
  weatherNotReady: boolean;
}) {
  const [zeroDteOnly, setZeroDteOnly] = useState(false);
  const hasZeroDte = Boolean(zeroDte && zeroDte.bars.length > 0);

  return (
    <>
      <SectionHead
        eyebrow="Options Flow · Past session"
        title={
          <span className="inline-flex items-center gap-2.5">
            Hedging Flow
            <BetaBadge size="md" />
          </span>
        }
        sub={
          <>
            {symbol} · {humanDate}. Dealer hedging pressure from that session&rsquo;s option
            trades, on price&rsquo;s timeline. Positive means the hedge <strong>buys</strong>{' '}
            stock.
          </>
        }
        tooltip="A finished session, served from the stored 5-minute bars rather than recomputed — the trades behind it are pruned at 90 days, so this is the only thing that outlives them. Everything else reads exactly as the live page: for every option that traded, the net customer position change is converted to the stock a delta-flat hedge implies, accumulated across the session, with the dealer gamma structure sharing the window and the crosshair."
        actions={
          <div className="flex items-center gap-2">
            <ZeroDteToggle
              active={zeroDteOnly}
              onChange={setZeroDteOnly}
              disabled={!hasZeroDte}
            />
            <SymbolPicker current={symbol} hrefs={pickerHrefs} symbols={CASH_SYMBOLS} />
          </div>
        }
      />

      <HedgingFlowPanels
        symbol={symbol}
        sessionDateKey={sessionDateKey}
        historical
        data={zeroDteOnly && hasZeroDte ? zeroDte : all}
        regime={regime}
        weather={weather}
        weatherNotReady={weatherNotReady}
        zeroDteOnly={zeroDteOnly}
      />
    </>
  );
}
