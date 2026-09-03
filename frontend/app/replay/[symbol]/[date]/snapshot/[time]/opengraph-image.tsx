import { ImageResponse } from 'next/og';
import { serverApiGet } from '@/core/api/serverFetch';
import { captureServer } from '@/core/telemetry/posthog-server';
import { TelemetryEvent } from '@/core/telemetry/events';
import { resolveSymbol } from '@/core/symbols';
// PIN_STRIKE_COLOR_HEX, not the CSS var: satori resolves no custom properties,
// so this card needs the literal the var is defined from (see core/pinStrike).
import { formatPinStrike, PIN_STRIKE_COLOR_HEX } from '@/core/pinStrike';

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
    // Pin Strike — the reachable 0DTE positive-gamma pin for this minute.
    // /api/replay/frame ships it alongside the walls; null when there was no
    // active pin, which the card prints as the same em-dash the other cells use.
    pin_strike: number | null;
    net_gex: number | null;
  } | null;
  strikes?: Array<{ strike: number | null; net_gex: number | null }>;
}

// Green above / red below by sign — the universal gamma-profile convention.
// (Kept net here rather than the call/put split so the strip doesn't clash
// with the wall cells' green=put / red=call colors in the same image.)
const OG_POS = '#10B981';
const OG_NEG = '#F45854';
const STRIP_H = 120;

interface ProfileCol {
  strike: number;
  net: number;
}

// Down-sample to at most `max` evenly-spaced columns so a wide strike band
// stays legible (and the PNG stays light) instead of rendering 100+ hairline
// bars.
function evenSample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const denom = Math.max(1, max - 1);
  for (let i = 0; i < max; i += 1) {
    out.push(arr[Math.round((i * (arr.length - 1)) / denom)]);
  }
  return out;
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

export default async function Image({ params }: { params: { symbol: string; date: string; time: string } }) {
  const symbol = resolveSymbol(params.symbol);
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

  // Per-strike net-gamma profile for the mini strip below the stats.
  const profile: ProfileCol[] = evenSample(
    (payload?.strikes ?? [])
      .filter(
        (s): s is { strike: number; net_gex: number } =>
          s.strike != null &&
          Number.isFinite(s.strike) &&
          s.net_gex != null &&
          Number.isFinite(s.net_gex),
      )
      .map((s) => ({ strike: s.strike, net: s.net_gex }))
      .sort((a, b) => a.strike - b.strike),
    64,
  );
  const profilePeak =
    profile.reduce((acc, c) => Math.max(acc, Math.abs(c.net)), 0) || 1;

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

            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { label: 'Call wall', value: fmtPrice(summary.call_wall), color: '#F45854' },
                { label: 'Put wall', value: fmtPrice(summary.put_wall), color: '#10B981' },
                { label: 'Gamma flip', value: fmtPrice(summary.gamma_flip), color: '#FF8531' },
                { label: 'Max pain', value: fmtPrice(summary.max_pain), color: '#FFD380' },
                {
                  label: 'Pin strike',
                  value: formatPinStrike(summary.pin_strike),
                  color: PIN_STRIKE_COLOR_HEX,
                },
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
                    padding: '18px 18px',
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
                      fontSize: 30,
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

            {/* Net-gamma-by-strike mini profile: bars rise (green) for
                net-positive strikes and fall (red) for net-negative, low →
                high strike left → right. Pure flexbox so it renders reliably
                under satori. */}
            {profile.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    color: '#7E96A0',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                    display: 'flex',
                  }}
                >
                  Net gamma by strike
                </div>
                <div style={{ display: 'flex', alignItems: 'stretch', height: STRIP_H, gap: 3 }}>
                  {profile.map((c) => {
                    const positive = c.net >= 0;
                    const h = Math.round((Math.abs(c.net) / profilePeak) * (STRIP_H / 2 - 2));
                    return (
                      <div
                        key={c.strike}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                          height: STRIP_H,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            height: STRIP_H / 2,
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                          }}
                        >
                          <div
                            style={{
                              width: '72%',
                              height: positive ? h : 0,
                              background: OG_POS,
                              borderRadius: '2px 2px 0 0',
                              display: 'flex',
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            height: STRIP_H / 2,
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            borderTop: '1px solid #FFFFFF22',
                          }}
                        >
                          <div
                            style={{
                              width: '72%',
                              height: positive ? 0 : h,
                              background: OG_NEG,
                              borderRadius: '0 0 2px 2px',
                              display: 'flex',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
            zerogex.io/replay/{symbol}/{params.date}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
