'use client';

// Headless variant of LiveBulletinClient — same GammaReportCard, no controls.
//
// The paid /live-bulletin page is an interactive editor: pick symbol, edit
// headline / lead copy, download PNG. This snapshot variant strips the editor
// and renders ONLY the card, so the Playwright screenshot helper the
// bulletin_tweet cron uses can grab a pixel-identical image of the same card
// the paid page renders — no parallel implementation, no drift, one source of
// truth.
//
// Data flow: all four upstream feeds (GEX summary, market quote, session
// close, volatility gauge) are SSR-fetched in the page.tsx server component
// using the ZEROGEX_API_TOKEN, so this client component is a pure renderer.
// It does NOT call the auth-gated /api/* endpoints from the browser — a
// Playwright session has no user cookie and every hook-based fetch would
// otherwise return 401 and never satisfy the ready selector.
//
// When the logo raster resolves and we have enough data to render a
// complete card, we stamp ``data-bulletin-ready="true"`` on the wrapper
// and set ``window.__zerogexBulletinReady`` so Playwright's
// ``waitForSelector`` and ``waitForFunction`` both work as ready-signals.

import { useEffect, useMemo, useRef, useState } from 'react';
import GammaReportCard from '../../GammaReportCard';
import {
  buildReportModel,
  fmtDateET,
  fmtTimeET,
  type GexSummaryInput,
  type HorizonKey,
} from '../../bulletinHelpers';
import { rasterizeSvg } from '../../imageExport';

interface SnapshotClientProps {
  symbol: 'SPY' | 'SPX' | 'QQQ';
  horizon: HorizonKey;
  dateLabel?: string;
  watermark?: boolean;
  volIndex: 'VIX' | 'VXN';
  /** SSR-fetched GEX summary — becomes the card's level fields. */
  summary: GexSummaryInput | null;
  /** SSR-computed spot: quote.close ?? summary.spot_price ?? null. */
  spot: number | null;
  /** SSR-computed prior close for the change % chip. */
  priorClose: number | null;
  /** SSR-fetched VIX / VXN level for the expected-range band. */
  vix: number | null;
  /** GEX summary's timestamp — drives the "as of" label. */
  timestamp: string | null;
}

declare global {
  interface Window {
    __zerogexBulletinReady?: boolean;
  }
}

export default function SnapshotClient({
  symbol,
  horizon,
  dateLabel,
  watermark = true,
  volIndex,
  summary,
  spot,
  priorClose,
  vix,
  timestamp,
}: SnapshotClientProps) {
  const model = useMemo(
    () =>
      buildReportModel({
        symbol,
        spot,
        priorClose,
        summary,
        vix,
        volIndex,
        horizon,
      }),
    [symbol, spot, priorClose, summary, vix, volIndex, horizon],
  );

  const asOf = useMemo(() => {
    const dateFragment = dateLabel ?? fmtDateET(timestamp ?? undefined);
    return `${dateFragment} · ${fmtTimeET(timestamp ?? undefined)}`;
  }, [timestamp, dateLabel]);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    rasterizeSvg('/title.svg', 960)
      .then((url) => {
        if (!cancelled) setLogoUrl(url);
      })
      .catch((err) => console.error('Failed to rasterize brand logo', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Ready when the logo raster has landed AND the SSR summary was
  // usable.  We accept a null summary (server outage / stale row) but
  // treat that as "still ready to screenshot" so Playwright doesn't
  // hang waiting for data that will never come — the card will render
  // "—" placeholders and the tweet job can decide whether to attach it.
  const ready = summary != null && logoUrl != null;

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ready) {
      window.__zerogexBulletinReady = true;
    }
  }, [ready]);

  return (
    <div
      data-bulletin-ready={ready ? 'true' : 'false'}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: '100vh',
        padding: 24,
        background: 'transparent',
      }}
    >
      <div data-bulletin-card="true" ref={cardRef}>
        <GammaReportCard
          model={model}
          headline={model.headline}
          lead={model.lead}
          asOf={asOf}
          logoUrl={logoUrl}
          watermark={watermark}
        />
      </div>
    </div>
  );
}
