import { ImageResponse } from 'next/og';
import { serverApiGet } from '@/core/api/serverFetch';
import { captureServer } from '@/core/telemetry/posthog-server';
import { TelemetryEvent } from '@/core/telemetry/events';
import { resolveSymbol } from '@/core/symbols';

// The branded 1200x630 preview for a dated Hedging Flow permalink.
//
// It draws the session's own shape rather than a generic card: the cumulative
// lean as a sparkline, and the number it finished at. A link that previews as
// a logo is a link nobody clicks, and this series has a shape worth showing —
// where pressure built and whether it turned.
//
// Satori renders this, so it is flex-only: no grid, no SVG filters, and every
// element that contains children needs an explicit `display`.

export const runtime = 'nodejs';
export const alt = 'ZeroGEX Hedging Flow - estimated dealer hedging pressure for a session';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

interface HedgingFlowBar {
  bar_start: string;
  cum_net_usd: number;
  net_flow_usd: number;
  is_synthetic: boolean;
}

interface HedgingFlowPayload {
  symbol: string;
  session: string;
  bars: HedgingFlowBar[];
  flips: { bar_start: string; kind: string; direction: string; is_significant: boolean }[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const BULL = '#22D982';
const BEAR = '#FF3855';

function formatHumanDate(raw: string): string {
  try {
    const dt = new Date(`${raw}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  } catch {
    return raw;
  }
}

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '+';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/**
 * The cumulative curve as a column of thin bars.
 *
 * A column chart rather than a path because Satori has no `<path>`: each bar
 * is a div grown from the zero line, up for buying and down for selling. That
 * is enough to read the session's shape — where it leaned, when it turned —
 * which is all a 1200x630 preview can honestly carry.
 */
function Sparkline({ bars }: { bars: HedgingFlowBar[] }) {
  if (bars.length === 0) return null;
  const values = bars.map((b) => Number(b.cum_net_usd) || 0);
  const peak = Math.max(...values.map(Math.abs), 1);
  // Cap the column count so a full session's 82 bars stay legible rather than
  // becoming a grey smear at this width.
  const step = Math.max(1, Math.ceil(values.length / 60));
  const sampled = values.filter((_, i) => i % step === 0);
  const height = 200;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height,
        width: '100%',
        gap: 3,
        marginTop: 8,
      }}
    >
      {sampled.map((value, i) => {
        const magnitude = Math.round((Math.abs(value) / peak) * (height / 2 - 4));
        const positive = value >= 0;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: positive ? 'flex-end' : 'flex-start',
              flex: 1,
              height,
              // Each column is its own half-height box either side of centre,
              // which is how a zero line survives without a grid.
              paddingTop: positive ? 0 : height / 2,
              paddingBottom: positive ? height / 2 : 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: Math.max(2, magnitude),
                background: positive ? BULL : BEAR,
                opacity: 0.85,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// `params` is a PROMISE here, not an object. Every dated OG image on the site
// destructured it synchronously, so `params.date` was undefined: the previews
// rendered with the date missing and the payload fetch skipped, which is why
// a shared permalink card said "SPY ·" and then nothing. Awaiting it is the
// whole fix; the type below is what makes it impossible to forget again.
export default async function Image({
  params,
}: {
  params: Promise<{ symbol: string; date: string }>;
}) {
  const resolvedParams = await params;
  const symbol = resolveSymbol(resolvedParams.symbol);
  const date = resolvedParams.date;
  const payload = ISO_DATE.test(date)
    ? await serverApiGet<HedgingFlowPayload>(
        `/api/flow/hedging?symbol=${symbol}&date=${date}`,
        revalidate,
      )
    : null;

  const human = formatHumanDate(date);
  // The wire order is newest-first; a chart reads left to right.
  const bars = [...(payload?.bars ?? [])].reverse();
  const last = [...bars].reverse().find((b) => !b.is_synthetic) ?? bars[bars.length - 1];
  const closing = last ? Number(last.cum_net_usd) || 0 : null;
  const positive = (closing ?? 0) >= 0;
  const accent = closing == null ? '#FF8531' : positive ? BULL : BEAR;
  const flips = (payload?.flips ?? []).filter(
    (f) => f.kind === 'rate' && f.is_significant,
  ).length;
  const isEmpty = bars.length === 0;

  await captureServer(`og:hedging-flow:${symbol}:${date}`, TelemetryEvent.OgPreviewed, {
    surface: 'hedging-flow',
    date,
    symbol,
    resolved: Boolean(payload),
    is_empty: isEmpty,
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #00202E 0%, #042D3F 100%)',
          color: '#FFF1E6',
          fontFamily: 'sans-serif',
          padding: '56px 64px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            background: 'linear-gradient(90deg, #FF8531 0%, #FFD380 100%)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: 999,
              border: '1px solid #FF853166',
              background: '#FF853115',
              color: '#FF8531',
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Hedging Flow
          </div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700 }}>{symbol}</div>
          <div style={{ display: 'flex', fontSize: 26, color: '#D1B8A6' }}>{human}</div>
        </div>

        {isEmpty ? (
          <div
            style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              fontSize: 34,
              color: '#D1B8A6',
            }}
          >
            No stored session for this day.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, color: accent }}>
                {closing != null ? formatUsd(closing) : '—'}
              </div>
              <div style={{ display: 'flex', fontSize: 28, color: '#D1B8A6' }}>
                {positive ? 'net dealer buying' : 'net dealer selling'}
              </div>
            </div>

            <Sparkline bars={bars} />

            <div
              style={{
                display: 'flex',
                gap: 32,
                marginTop: 10,
                fontSize: 22,
                color: '#D1B8A6',
              }}
            >
              <div style={{ display: 'flex' }}>{bars.length} five-minute bars</div>
              <div style={{ display: 'flex' }}>
                {flips} significant {flips === 1 ? 'reversal' : 'reversals'}
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: 19,
            color: '#A78F7E',
          }}
        >
          <div style={{ display: 'flex', fontWeight: 800, color: '#FFF1E6', fontSize: 24 }}>
            zerogex.io
          </div>
          {/* The estimate caveat travels with the payload everywhere it goes,
              including a social preview — a stored session is still not an
              observation of dealer activity. */}
          <div style={{ display: 'flex', maxWidth: 620, textAlign: 'right' }}>
            Estimated hedging pressure · aggressor-inferred, not observed dealer flow
          </div>
        </div>
      </div>
    ),
    size,
  );
}
