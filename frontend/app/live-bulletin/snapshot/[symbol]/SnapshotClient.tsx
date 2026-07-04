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
// When the card's underlying data has all resolved (GEX summary, live quote,
// prior close, volatility), we stamp ``data-bulletin-ready="true"`` on the
// wrapper and set ``window.__zerogexBulletinReady`` so Playwright's
// ``waitForSelector`` and ``waitForFunction`` both work as ready-signals.

import { useEffect, useMemo, useRef, useState } from 'react';
import NewsletterCTA from '@/components/NewsletterCTA';
import {
  useGEXSummary,
  useMarketQuote,
  useSessionCloses,
  useVolatilityGauge,
} from '@/hooks/useApiData';
import GammaReportCard from '../../GammaReportCard';
import {
  buildReportModel,
  fmtDateET,
  fmtTimeET,
  HORIZONS,
  type HorizonKey,
} from '../../bulletinHelpers';
import { rasterizeSvg } from '../../imageExport';

interface SnapshotClientProps {
  symbol: 'SPY' | 'SPX' | 'QQQ';
  horizon?: HorizonKey;
  /** Cosmetic — drives the "as-of" date label rather than the underlying data,
   *  which is always the latest snapshot. */
  dateLabel?: string;
  watermark?: boolean;
}

declare global {
  interface Window {
    __zerogexBulletinReady?: boolean;
  }
}

export default function SnapshotClient({
  symbol,
  horizon = 'daily',
  dateLabel,
  watermark = true,
}: SnapshotClientProps) {
  // Same VIX/VXN pairing as LiveBulletinClient — QQQ uses VXN, everything else
  // uses VIX. Keeps the expected-range panel consistent between the paid card
  // and the screenshot.
  const volIndex: 'VIX' | 'VXN' = symbol === 'QQQ' ? 'VXN' : 'VIX';

  const { data: summary } = useGEXSummary(symbol, 10_000);
  const { data: quote } = useMarketQuote(symbol, 5_000);
  const { data: sessionCloses } = useSessionCloses(symbol, 60_000, quote?.session ?? null);
  const { data: volGauge } = useVolatilityGauge(30_000, volIndex);

  const priorClose = sessionCloses?.current_session_close ?? null;
  const spot = quote?.close ?? summary?.spot_price ?? null;
  const vix = volGauge?.index ?? null;

  const model = useMemo(
    () =>
      buildReportModel({
        symbol,
        spot,
        priorClose,
        summary: summary ?? null,
        vix,
        volIndex,
        horizon,
      }),
    [symbol, spot, priorClose, summary, vix, volIndex, horizon],
  );

  const asOf = useMemo(() => {
    const ts = summary?.timestamp;
    // If a caller passed dateLabel explicitly (e.g. backfilling a specific
    // session), honor it; otherwise derive from the summary timestamp so
    // the card reads the actual data freshness.
    const dateFragment = dateLabel ?? fmtDateET(ts);
    return `${dateFragment} · ${fmtTimeET(ts)}`;
  }, [summary?.timestamp, dateLabel]);

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

  // Signal readiness once we've resolved enough data to render a card that
  // isn't visibly loading — Playwright uses this to time its screenshot.
  //
  // We wait for: summary (level fields), quote or a spot from the summary,
  // session close (drives change %), and the logo raster (so the header
  // doesn't screenshot with the fallback text lockup). Volatility is
  // intentionally NOT gated — a VIX outage would otherwise block the whole
  // fire, and the card gracefully hides the expected-range panel when vix
  // is null.
  const ready =
    Boolean(summary) &&
    (spot != null) &&
    Boolean(sessionCloses) &&
    Boolean(logoUrl);

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
      {/* Rendered OUTSIDE [data-bulletin-card] so the tweet-PNG Playwright
          capture never includes it — the CTA is only for the (rare) human
          who lands on this page directly. */}
      <div style={{ maxWidth: 480, width: '100%', marginTop: 32 }}>
        <NewsletterCTA surface="live-bulletin" variant="inline" />
      </div>
    </div>
  );
}
