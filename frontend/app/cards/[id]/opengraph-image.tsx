import { ImageResponse } from 'next/og';
import { serverApiGet } from '@/core/api/serverFetch';
import { captureServer } from '@/core/telemetry/posthog-server';
import { TelemetryEvent } from '@/core/telemetry/events';
import type { SignalActionResponse } from '@/hooks/useApiData';

export const runtime = 'nodejs';
export const alt = 'ZeroGEX Action Card — Playbook trade instruction';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Revalidate hourly. Closed cards never change; an open card briefly mid-flight
// will refresh on its own. Crawlers respect cache headers, so we don't need to
// thrash the renderer.
export const revalidate = 3600;

interface CardPayload extends SignalActionResponse {
  id?: number;
}

function humanizeWords(value: string | undefined | null): string {
  if (!value) return '';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function directionAccent(direction: string | undefined): string {
  const d = String(direction ?? '').toLowerCase();
  if (d.includes('bull')) return '#10B981';
  if (d.includes('bear')) return '#F45854';
  return '#FF8531';
}

function fmtPrice(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${Number(value).toFixed(2)}`;
}

export default async function Image({ params }: { params: { id: string } }) {
  const cardId = /^\d+$/.test(params.id) ? Number.parseInt(params.id, 10) : NaN;
  const card = Number.isFinite(cardId) && cardId > 0
    ? await serverApiGet<CardPayload>(`/api/signals/action/${cardId}`, revalidate)
    : null;

  const symbol = (card?.underlying || 'SPY').toUpperCase();
  const action = humanizeWords(card?.action) || 'Action Card';
  const pattern = humanizeWords(card?.pattern);
  const tier = humanizeWords(card?.tier);
  const directionRaw = String(card?.direction ?? '').toLowerCase();
  const isStandDown = String(card?.action ?? '').toUpperCase() === 'STAND_DOWN';
  const accent = isStandDown ? '#FF8531' : directionAccent(directionRaw);
  const confidence = typeof card?.confidence === 'number' ? card.confidence.toFixed(2) : null;
  const entry = card?.entry?.ref_price as number | undefined;
  const stop = card?.stop?.ref_price as number | undefined;
  const target = card?.target?.ref_price as number | undefined;

  // Deterministic distinctId keeps repeat crawler fetches from the same URL
  // collapsed to one PostHog "visitor" — Twitter/Slack retry aggressively.
  await captureServer(`og:card:${Number.isFinite(cardId) ? cardId : 'unknown'}`, TelemetryEvent.OgPreviewed, {
    surface: 'card',
    card_id: Number.isFinite(cardId) ? cardId : null,
    symbol,
    action: card?.action ?? null,
    tier: card?.tier ?? null,
    resolved: Boolean(card),
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

        {/* Header row: ACTION CARD pill + symbol + card id */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
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
            {isStandDown ? 'No Trade · Stand Down' : 'Action Card'}
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
            {symbol}
          </div>
          {Number.isFinite(cardId) && cardId > 0 && (
            <div
              style={{
                marginLeft: 'auto',
                fontSize: 18,
                color: '#7E96A0',
                fontWeight: 600,
                letterSpacing: '0.12em',
                display: 'flex',
              }}
            >
              #{cardId}
            </div>
          )}
        </div>

        {/* Hero: the action verb */}
        <div
          style={{
            fontSize: action.length > 22 ? 76 : 90,
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: '-2px',
            color: accent,
            maxWidth: 1080,
            display: 'flex',
          }}
        >
          {action}
        </div>

        {/* Pattern · Tier subline */}
        {(pattern || tier) && !isStandDown && (
          <div
            style={{
              marginTop: 14,
              fontSize: 26,
              color: '#C8D8DF',
              lineHeight: 1.3,
              display: 'flex',
              gap: 14,
            }}
          >
            {pattern && <span style={{ display: 'flex' }}>{pattern}</span>}
            {pattern && tier && <span style={{ display: 'flex', color: '#5E7480' }}>·</span>}
            {tier && <span style={{ display: 'flex' }}>{tier}</span>}
          </div>
        )}

        {/* Price strip: Stop / Entry / Target — only for trade cards */}
        {!isStandDown && (entry != null || target != null || stop != null) && (
          <div style={{ display: 'flex', marginTop: 36, gap: 18 }}>
            {[
              { label: 'Stop', value: fmtPrice(stop), color: '#F45854' },
              { label: 'Entry', value: fmtPrice(entry), color: '#FF8531' },
              { label: 'Target', value: fmtPrice(target), color: '#10B981' },
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
                    fontSize: 16,
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
                    fontSize: 44,
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
        )}

        {/* Stand-down explainer */}
        {isStandDown && (
          <div
            style={{
              marginTop: 24,
              fontSize: 28,
              color: '#C8D8DF',
              lineHeight: 1.35,
              maxWidth: 1040,
              display: 'flex',
            }}
          >
            No tradable structure right now — the engine refuses to fire when no pattern clears
            its activation gate.
          </div>
        )}

        {/* Footer: ZeroGEX wordmark · permalink · confidence */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
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
              zerogex.io/cards/{Number.isFinite(cardId) ? cardId : '—'}
            </div>
          </div>
          {confidence && !isStandDown && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
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
                Confidence
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: accent,
                  display: 'flex',
                }}
              >
                {confidence}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
