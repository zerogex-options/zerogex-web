import { ImageResponse } from 'next/og';
import { serverApiGet } from '@/core/api/serverFetch';
import { captureServer } from '@/core/telemetry/posthog-server';
import { TelemetryEvent } from '@/core/telemetry/events';
import { resolveSymbol } from '@/core/symbols';

export const runtime = 'nodejs';
export const alt = "ZeroGEX Daily Scorecard — yesterday's Playbook calls + per-signal P&L";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

interface ScorecardSignalRow {
  name: string;
  flips: number;
  wins: number;
  losses: number;
  avg_directional_return: number | null;
}

interface ScorecardPayload {
  date: string;
  symbol: string;
  cards: { total: number; first_card_id: number | null };
  signals: {
    best: ScorecardSignalRow | null;
    worst: ScorecardSignalRow | null;
  };
  regime: { label?: string; normalized_score?: number | null } | null;
  is_empty: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function humanizeName(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const pct = value * 100;
  const sign = pct >= 0 ? '+' : '−';
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

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

function regimeAccent(label: string | undefined): string {
  if (label === 'short gamma') return '#F45854';
  if (label === 'long gamma') return '#10B981';
  return '#FF8531';
}

export default async function Image({ params }: { params: { symbol: string; date: string } }) {
  const symbol = resolveSymbol(params.symbol);
  const date = params.date;
  const payload = ISO_DATE.test(date)
    ? await serverApiGet<ScorecardPayload>(
        `/api/scorecard/daily?date=${date}&symbol=${symbol}`,
        revalidate,
      )
    : null;

  const human = formatHumanDate(date);
  const regimeLabel = payload?.regime?.label || 'unknown';
  const accent = regimeAccent(regimeLabel);
  const isEmpty = !payload || payload.is_empty;
  const cards = payload?.cards.total ?? 0;
  const best = payload?.signals?.best ?? null;
  const worst = payload?.signals?.worst ?? null;

  await captureServer(`og:scorecard:${date}`, TelemetryEvent.OgPreviewed, {
    surface: 'scorecard',
    date,
    symbol,
    regime: regimeLabel,
    cards,
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

        {/* Header: SCORECARD pill + symbol + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
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
            Daily Scorecard
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

        {isEmpty ? (
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: '#FFF1E6',
              lineHeight: 1.05,
              letterSpacing: '-1.5px',
              maxWidth: 1080,
              display: 'flex',
            }}
          >
            Quiet tape — no Playbook calls, no signal flips.
          </div>
        ) : (
          <>
            {/* Hero stat row: cards count + best/worst signal returns */}
            <div style={{ display: 'flex', gap: 18, marginBottom: 32 }}>
              <StatBox
                label="Playbook calls"
                value={cards.toString()}
                accent="#FF8531"
              />
              <StatBox
                label="Best (60m)"
                value={best ? formatPct(best.avg_directional_return) : '—'}
                accent="#10B981"
                sub={best ? humanizeName(best.name) : null}
              />
              <StatBox
                label="Worst (60m)"
                value={worst ? formatPct(worst.avg_directional_return) : '—'}
                accent="#F45854"
                sub={worst ? humanizeName(worst.name) : null}
              />
            </div>

            {/* Regime banner */}
            <div
              style={{
                marginTop: 'auto',
                marginBottom: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#0B3344',
                borderRadius: 14,
                borderLeft: `5px solid ${accent}`,
                padding: '22px 28px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    color: '#7E96A0',
                    textTransform: 'uppercase',
                    display: 'flex',
                  }}
                >
                  Closing regime
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 44,
                    fontWeight: 900,
                    letterSpacing: '-0.5px',
                    textTransform: 'uppercase',
                    color: accent,
                    display: 'flex',
                  }}
                >
                  {regimeLabel === 'unknown' ? 'Transition' : regimeLabel}
                </div>
              </div>
              {typeof payload?.regime?.normalized_score === 'number' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: '0.18em',
                      color: '#7E96A0',
                      textTransform: 'uppercase',
                      display: 'flex',
                    }}
                  >
                    MSI close
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 40,
                      fontWeight: 900,
                      color: accent,
                      display: 'flex',
                    }}
                  >
                    {payload.regime.normalized_score.toFixed(1)}
                  </div>
                </div>
              )}
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
            zerogex.io/scorecard/{date}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function StatBox({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  sub?: string | null;
}) {
  return (
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
        {label}
      </div>
      <div
        style={{
          fontSize: value.length > 8 ? 52 : 64,
          fontWeight: 900,
          color: '#FFF1E6',
          marginTop: 6,
          letterSpacing: '-0.5px',
          display: 'flex',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 4,
            fontSize: 20,
            color: '#C8D8DF',
            display: 'flex',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
