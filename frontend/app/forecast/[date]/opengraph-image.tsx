import { ImageResponse } from 'next/og';
import { serverApiGet } from '@/core/api/serverFetch';
import { captureServer } from '@/core/telemetry/posthog-server';
import { TelemetryEvent } from '@/core/telemetry/events';

export const runtime = 'nodejs';
export const alt = 'ZeroGEX Gamma Forecast Card — projected range, pin, regime';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 1800;

interface ForecastMorning {
  ts: string | null;
  open_spot: number | null;
  projected_low: number | null;
  projected_high: number | null;
  pin_strike: number | null;
  regime: string | null;
  range_model: string | null;
}

interface ForecastReceipt {
  actual_low: number | null;
  actual_high: number | null;
  actual_close: number | null;
  range_respected: boolean | null;
  pin_hit: boolean | null;
  regime_correct: boolean | null;
}

interface ForecastPayload {
  symbol: string;
  date: string;
  morning: ForecastMorning;
  receipt: ForecastReceipt | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function humanizeRegime(value: string | null): string {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function regimeAccent(value: string | null): string {
  if (value === 'long_gamma') return '#10B981';
  if (value === 'short_gamma') return '#F45854';
  return '#FF8531';
}

function fmtPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

function formatHumanDate(raw: string): string {
  try {
    const dt = new Date(`${raw}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  } catch {
    return raw;
  }
}

export default async function Image({ params }: { params: { date: string } }) {
  const symbol = 'SPY';
  const date = params.date;
  const payload = ISO_DATE.test(date)
    ? await serverApiGet<ForecastPayload>(
        `/api/forecast/${date}?symbol=${symbol}`,
        revalidate,
      )
    : null;

  const human = formatHumanDate(date);
  const morning = payload?.morning;
  const receipt = payload?.receipt;
  const hasReceipt = !!receipt;
  const accent = regimeAccent(morning?.regime ?? null);
  const regimeLabel = humanizeRegime(morning?.regime ?? null);
  const heroLabel = hasReceipt ? 'Forecast Receipt' : 'Morning Forecast';

  await captureServer(`og:forecast:${date}`, TelemetryEvent.OgPreviewed, {
    surface: 'forecast',
    date,
    symbol,
    regime: morning?.regime ?? null,
    range_model: morning?.range_model ?? null,
    has_receipt: hasReceipt,
    resolved: Boolean(payload),
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
          padding: '52px 64px',
          position: 'relative',
        }}
      >
        {/* Brand accent stripe */}
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

        {/* Header: state pill + symbol + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: 999,
              border: `1px solid ${accent}66`,
              background: `${accent}1a`,
              color: accent,
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            {heroLabel}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#C8D8DF',
              letterSpacing: '0.06em',
              display: 'flex',
            }}
          >
            {symbol} · {human}
          </div>
        </div>

        {!payload ? (
          <div
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: '#FFF1E6',
              lineHeight: 1.05,
              letterSpacing: '-1px',
              maxWidth: 1080,
              display: 'flex',
            }}
          >
            Forecast not yet committed.
          </div>
        ) : (
          <>
            {/* Projected range hero */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginBottom: 26,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  color: '#7E96A0',
                  textTransform: 'uppercase',
                  display: 'flex',
                }}
              >
                Projected range {hasReceipt && (
                  <span style={{ marginLeft: 12, color: receipt?.range_respected ? '#10B981' : '#F45854' }}>
                    {receipt?.range_respected ? '✓ HELD' : '✗ BROKEN'}
                  </span>
                )}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 84,
                  fontWeight: 900,
                  letterSpacing: '-2px',
                  color: '#FFF1E6',
                  display: 'flex',
                }}
              >
                {fmtPrice(morning?.projected_low)} – {fmtPrice(morning?.projected_high)}
              </div>
              {hasReceipt && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 22,
                    color: '#C8D8DF',
                    display: 'flex',
                  }}
                >
                  Actual: {fmtPrice(receipt?.actual_low)} – {fmtPrice(receipt?.actual_high)} · Close{' '}
                  {fmtPrice(receipt?.actual_close)}
                </div>
              )}
            </div>

            {/* Pin + Regime row */}
            <div style={{ display: 'flex', gap: 18 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  background: '#0B3344',
                  borderRadius: 12,
                  borderLeft: '4px solid #10B981',
                  padding: '20px 24px',
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    color: '#10B981',
                    textTransform: 'uppercase',
                    display: 'flex',
                  }}
                >
                  Pin strike {hasReceipt && (
                    <span style={{ marginLeft: 10, color: receipt?.pin_hit ? '#10B981' : '#F45854' }}>
                      {receipt?.pin_hit ? '✓' : '✗'}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 54,
                    fontWeight: 900,
                    color: '#FFF1E6',
                    marginTop: 6,
                    letterSpacing: '-0.5px',
                    display: 'flex',
                  }}
                >
                  {fmtPrice(morning?.pin_strike)}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  background: '#0B3344',
                  borderRadius: 12,
                  borderLeft: `4px solid ${accent}`,
                  padding: '20px 24px',
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    color: accent,
                    textTransform: 'uppercase',
                    display: 'flex',
                  }}
                >
                  Regime {hasReceipt && receipt?.regime_correct != null && (
                    <span style={{ marginLeft: 10, color: receipt?.regime_correct ? '#10B981' : '#F45854' }}>
                      {receipt?.regime_correct ? '✓' : '✗'}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 54,
                    fontWeight: 900,
                    color: accent,
                    marginTop: 6,
                    letterSpacing: '-0.5px',
                    textTransform: 'uppercase',
                    display: 'flex',
                  }}
                >
                  {regimeLabel}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer: ZeroGEX wordmark · permalink */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            left: 64,
            right: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: '-0.5px',
              color: '#FFF1E6',
              display: 'flex',
            }}
          >
            ZeroGEX
          </div>
          <div
            style={{
              fontSize: 22,
              color: '#FF8531',
              fontWeight: 700,
              display: 'flex',
            }}
          >
            zerogex.io/forecast/{date}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
