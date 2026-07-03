'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, ImageDown, RotateCcw } from 'lucide-react';
import {
  useGEXSummary,
  useMarketQuote,
  useSessionCloses,
  useVolatilityGauge,
} from '@/hooks/useApiData';
import GammaReportCard from './GammaReportCard';
import { buildReportModel, fmtDateET, fmtTimeET, HORIZONS, type HorizonKey } from './bulletinHelpers';
import { nodeToPngBlob, nodeToPngDataUrl, rasterizeSvg } from './imageExport';

const SYMBOLS = ['SPX', 'SPY', 'QQQ'] as const;
type Symbol = (typeof SYMBOLS)[number];

const HORIZON_KEYS = Object.keys(HORIZONS) as HorizonKey[];

type ExportState = 'idle' | 'working' | 'copied' | 'error';

export default function LiveBulletinClient({ watermark = true }: { watermark?: boolean } = {}) {
  const [symbol, setSymbol] = useState<Symbol>('SPX');
  const [horizon, setHorizon] = useState<HorizonKey>('daily');
  // Per-render edits keyed to the current symbol. Cleared on symbol change so
  // the auto-generated prose tracks the freshly selected underlying until the
  // operator deliberately types over it.
  const [edited, setEdited] = useState<{ headline?: string; lead?: string }>({});
  const [downloadState, setDownloadState] = useState<ExportState>('idle');
  const [copyState, setCopyState] = useState<ExportState>('idle');

  const cardRef = useRef<HTMLDivElement>(null);

  // Rasterize the brand wordmark (served from /public) into a PNG data URL once
  // on mount so it both displays crisply and embeds into the exported image.
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

  // QQQ's correct implied-vol input is VXN (Nasdaq-100); SPX/SPY use VIX.
  const volIndex: 'VIX' | 'VXN' = symbol === 'QQQ' ? 'VXN' : 'VIX';

  const { data: summary } = useGEXSummary(symbol, 10000);
  const { data: quote } = useMarketQuote(symbol, 5000);
  const { data: sessionCloses } = useSessionCloses(symbol, 60000, quote?.session ?? null);
  const { data: volGauge } = useVolatilityGauge(30000, volIndex);

  // During RTH the most recent *completed* close is the prior session, so spot
  // vs current_session_close yields today's intraday change; after the close it
  // naturally collapses to ~0 against today's own close.
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

  const headline = edited.headline ?? model.headline;
  const lead = edited.lead ?? model.lead;
  const asOf = useMemo(() => {
    const ts = summary?.timestamp;
    return `${fmtDateET(ts)} · ${fmtTimeET(ts)}`;
  }, [summary?.timestamp]);

  const hasEdits = edited.headline != null || edited.lead != null;
  const fileSafeDate = new Date().toISOString().slice(0, 10);
  const fileName = `zerogex-${symbol.toLowerCase()}-gamma-${fileSafeDate}.png`;

  function changeSymbol(next: Symbol) {
    setSymbol(next);
    setEdited({});
    setDownloadState('idle');
    setCopyState('idle');
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloadState('working');
    try {
      const dataUrl = await nodeToPngDataUrl(cardRef.current);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
      setDownloadState('idle');
    } catch (err) {
      console.error('Failed to render report PNG', err);
      setDownloadState('error');
    }
  }

  async function handleCopy() {
    if (!cardRef.current) return;
    setCopyState('working');
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard image write unsupported');
      }
      const blob = await nodeToPngBlob(cardRef.current);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy report PNG', err);
      setCopyState('error');
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'var(--color-text-secondary)',
    marginBottom: 8,
    display: 'block',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: '10px 12px',
    color: 'var(--color-text-primary)',
    fontSize: 14,
    lineHeight: 1.5,
    resize: 'vertical',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Live Bulletin
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Pick an underlying — the dealer-gamma snapshot is pulled live from the backend. Tweak the
          copy if you like, then download or copy a share-ready PNG for social.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 items-start">
        {/* Controls */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-5"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div>
            <label style={labelStyle}>Underlying</label>
            <div className="flex gap-2">
              {SYMBOLS.map((s) => {
                const active = s === symbol;
                return (
                  <button
                    key={s}
                    onClick={() => changeSymbol(s)}
                    className="flex-1 py-2 rounded-lg text-sm font-bold transition-colors"
                    style={{
                      background: active ? 'var(--color-warning-soft)' : 'transparent',
                      border: `1px solid ${active ? 'var(--color-warning)' : 'var(--color-border)'}`,
                      color: active ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Expected-range horizon</label>
            <div className="flex gap-2">
              {HORIZON_KEYS.map((h) => {
                const active = h === horizon;
                return (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
                    style={{
                      background: active ? 'var(--color-info-soft)' : 'transparent',
                      border: `1px solid ${active ? 'var(--color-info)' : 'var(--color-border)'}`,
                      color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {HORIZONS[h].label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {vix != null
                ? `1σ implied move ${HORIZONS[horizon].phrase} from ${volIndex} ${vix.toFixed(1)} (~68% band). Horizon is a ${HORIZONS[horizon].days}-trading-day span, not a calendar date.`
                : `${volIndex} implied-vol data unavailable — the expected-range band is hidden.`}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label style={labelStyle}>Headline</label>
              {hasEdits && (
                <button
                  onClick={() => setEdited({})}
                  className="flex items-center gap-1 text-xs font-semibold mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <RotateCcw size={12} /> Reset to auto
                </button>
              )}
            </div>
            <textarea
              value={headline}
              onChange={(e) => setEdited((p) => ({ ...p, headline: e.target.value }))}
              rows={2}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Summary</label>
            <textarea
              value={lead}
              onChange={(e) => setEdited((p) => ({ ...p, lead: e.target.value }))}
              rows={5}
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleDownload}
              disabled={downloadState === 'working'}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-opacity disabled:opacity-60"
              style={{ background: 'var(--color-warning)', color: 'var(--text-inverse)' }}
            >
              <Download size={16} />
              {downloadState === 'working' ? 'Rendering…' : 'Download PNG'}
            </button>
            <button
              onClick={handleCopy}
              disabled={copyState === 'working'}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-opacity disabled:opacity-60"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              {copyState === 'copied' ? <ImageDown size={16} /> : <Copy size={16} />}
              {copyState === 'working'
                ? 'Copying…'
                : copyState === 'copied'
                  ? 'Copied to clipboard'
                  : 'Copy to clipboard'}
            </button>
            {(downloadState === 'error' || copyState === 'error') && (
              <p className="text-xs" style={{ color: 'var(--color-bear)' }}>
                {copyState === 'error'
                  ? 'Clipboard image copy isn’t supported here — use Download PNG instead.'
                  : 'Could not render the image. Please try again.'}
              </p>
            )}
          </div>
        </div>

        {/* Live preview */}
        <div className="flex flex-col items-center gap-3">
          <span
            className="self-start text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Live preview
          </span>
          <div className="w-full overflow-x-auto flex justify-center">
            <GammaReportCard
              ref={cardRef}
              model={model}
              headline={headline}
              lead={lead}
              asOf={asOf}
              logoUrl={logoUrl}
              watermark={watermark}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
