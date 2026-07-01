import { ImageResponse } from 'next/og';
import { serverApiGet } from '@/core/api/serverFetch';
import { captureServer } from '@/core/telemetry/posthog-server';
import { TelemetryEvent } from '@/core/telemetry/events';

export const runtime = 'nodejs';
export const alt = 'ZeroGEX Replay snapshot — historical dealer gamma surface';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 86400;

interface FramePayload {
  symbol: string;
  frame_ts: string;
  summary: {
    spot: number | null;
    call_wall: number | null;
    put_wall: number | null;
    gamma_flip: number | null;
    max_pain: number | null;
    net_gex: number | null;
  } | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{4}$/;

function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `$${v.toFixed(2)}`;
}

function formatHumanDate(raw: string): string {
  try {
    const dt = new Date(`${raw}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(dt);
  } catch {
    return raw;
  }
}

function hhmmToIsoUtc(date: string, hhmm: string): string | null {
  if (!ISO_DATE.test(date) || !HHMM.test(hhmm)) return null;
  const hh = Number.parseInt(hhmm.slice(0, 2), 10);
  const mm = Number.parseInt(hhmm.slice(2, 4), 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  try {
    const anchorUtc = new Date(`${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`);
    const partsEt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(anchorUtc);
    const get = (t: string) => Number.parseInt(partsEt.find((p) => p.type === t)?.value ?? '0', 10);
    const etHour = get('hour');
    const etMinute = get('minute');
    const deltaMin = (etHour * 60 + etMinute) - (hh * 60 + mm);
    return new Date(anchorUtc.getTime() - deltaMin * 60_000).toISOString();
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: { date: string; time: string } }) {
  const symbol = 'SPY';
  const iso = hhmmToIsoUtc(params.date, params.time);
  const payload = iso
    ? await serverApiGet<FramePayload>(
        `/api/replay/frame?symbol=${symbol}&ts=${encodeURIComponent(iso)}`,
        revalidate,
      )
    : null;

  const human = formatHumanDate(params.date);
  const minute = HHMM.test(params.time)
    ? `${params.time.slice(0, 2)}:${params.time.slice(2, 4)} ET`
    : '—';
  const summary = payload?.summary;

  await captureServer(`og:replay:${params.date}:${params.time}`, TelemetryEvent.OgPreviewed, {
    surface: 'replay_snapshot',
    date: params.date,
    time_hhmm: params.time,
    symbol,
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
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, height: 10,
            background: 'linear-gradient(90deg, #FF8531 0%, #FFD380 100%)',
            display: 'flex',
          }}
        />

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
            Replay Snapshot
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
            {symbol} · {human} @ {minute}
          </div>
        </div>

        {!payload || !summary ? (
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
            No GEX frame at this moment.
          </div>
        ) : (
          <>
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
                Spot
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 96,
                  fontWeight: 900,
                  letterSpacing: '-2.5px',
                  color: '#FFF1E6',
                  display: 'flex',
                }}
              >
                {fmtPrice(summary.spot)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 18 }}>
              {[
                { label: 'Call wall', value: fmtPrice(summary.call_wall), color: '#F45854' },
                { label: 'Put wall', value: fmtPrice(summary.put_wall), color: '#10B981' },
                { label: 'Gamma flip', value: fmtPrice(summary.gamma_flip), color: '#FF8531' },
                { label: 'Max pain', value: fmtPrice(summary.max_pain), color: '#FFD380' },
              ].map((cell) => (
                <div
                  key={cell.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    background: '#0B3344',
                    borderRadius: 12,
                    borderLeft: `4px solid ${cell.color}`,
                    padding: '18px 22px',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: '0.18em',
                      color: cell.color,
                      textTransform: 'uppercase',
                      display: 'flex',
                    }}
                  >
                    {cell.label}
                  </div>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 900,
                      color: '#FFF1E6',
                      marginTop: 6,
                      letterSpacing: '-0.5px',
                      display: 'flex',
                    }}
                  >
                    {cell.value}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

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
            zerogex.io/replay/{params.date}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
