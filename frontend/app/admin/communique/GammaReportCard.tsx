'use client';

import { forwardRef } from 'react';
import {
  fmtNetGex,
  fmtPrice,
  fmtRatio,
  fmtSignedPct,
  fmtSignedPts,
  regimeCopy,
  type ReportModel,
} from './communiqueHelpers';

// The card is a fully self-contained dark asset: every color is an explicit
// hex/rgba (never a CSS theme variable) so the exported PNG looks identical
// regardless of the operator's light/dark site theme, and so html-to-image
// never has to resolve a `var(--...)` against the live document.
const C = {
  bgTop: '#04141E',
  bgBottom: '#07212F',
  border: 'rgba(245, 158, 11, 0.22)',
  panel: 'rgba(255, 255, 255, 0.035)',
  panelBorder: 'rgba(255, 255, 255, 0.07)',
  textPrimary: '#F3F7FB',
  textSecondary: '#9DB1C4',
  textFaint: '#5E7689',
  amber: '#F59E0B',
  bull: '#1BC47D',
  bear: '#FF5A66',
  blue: '#3B82F6',
} as const;

const REGIME_ACCENT: Record<ReportModel['regime'], string> = {
  positive: C.bull,
  negative: C.bear,
  neutral: C.amber,
  unresolved: C.textFaint,
};

const FONT_STACK =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export interface GammaReportCardProps {
  model: ReportModel;
  headline: string;
  lead: string;
  asOf: string;
  width?: number;
}

const GammaReportCard = forwardRef<HTMLDivElement, GammaReportCardProps>(function GammaReportCard(
  { model, headline, lead, asOf, width = 640 },
  ref,
) {
  const accent = REGIME_ACCENT[model.regime];
  const copy = regimeCopy(model.regime);
  const changeColor =
    model.changePct == null ? C.textSecondary : model.changePct >= 0 ? C.bull : C.bear;

  return (
    <div
      ref={ref}
      style={{
        width,
        fontFamily: FONT_STACK,
        color: C.textPrimary,
        background: `linear-gradient(160deg, ${C.bgTop} 0%, ${C.bgBottom} 100%)`,
        border: `1px solid ${C.border}`,
        borderRadius: 22,
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* faint grid + glow overlays for the "quant terminal" texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -120,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', padding: '28px 30px 22px' }}>
        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: C.amber,
                boxShadow: `0 0 10px ${C.amber}`,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2.5 }}>ZEROGEX</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.6,
                color: C.textFaint,
                textTransform: 'uppercase',
              }}
            >
              · Dealer Gamma Positioning
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: C.textSecondary,
            }}
          >
            <span
              style={{
                fontWeight: 800,
                letterSpacing: 1,
                color: C.textPrimary,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${C.panelBorder}`,
                borderRadius: 7,
                padding: '4px 9px',
                fontSize: 12,
              }}
            >
              {model.symbol}
            </span>
            <span>{asOf}</span>
          </div>
        </div>

        <div style={{ height: 1, background: C.panelBorder, margin: '20px 0 18px' }} />

        {/* Regime badge + headline */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            borderRadius: 999,
            background: `${accent}1f`,
            border: `1px solid ${accent}55`,
            color: accent,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.2,
            marginBottom: 14,
          }}
        >
          {model.regimeBadge}
          <span style={{ color: C.textSecondary, fontWeight: 600, letterSpacing: 0.3 }}>
            {copy.label}
          </span>
        </div>

        <h1
          style={{
            fontSize: 27,
            lineHeight: 1.18,
            fontWeight: 800,
            margin: '0 0 12px',
            letterSpacing: -0.4,
          }}
        >
          {headline}
        </h1>
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          {lead}
        </p>

        {/* Spot price strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 14,
            marginTop: 20,
            paddingTop: 18,
            borderTop: `1px solid ${C.panelBorder}`,
          }}
        >
          <div>
            <div style={CARD_LABEL}>{model.symbol} Spot</div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.5 }}>
              {fmtPrice(model.spot)}
            </div>
          </div>
          <div style={{ color: changeColor, fontSize: 17, fontWeight: 700, paddingBottom: 4 }}>
            {fmtSignedPts(model.changeAbs)}{' '}
            <span style={{ fontSize: 14 }}>({fmtSignedPct(model.changePct)})</span>
          </div>
        </div>

        {/* Metric grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginTop: 18,
          }}
        >
          <Metric label="Gamma Flip" value={fmtPrice(model.gammaFlip)} accent={C.amber} />
          <Metric
            label="Net GEX"
            value={fmtNetGex(model.netGex)}
            accent={model.netGex == null ? C.textPrimary : model.netGex >= 0 ? C.bull : C.bear}
          />
          <Metric label="Put / Call" value={fmtRatio(model.putCallRatio)} accent={C.textPrimary} />
          <Metric label="Call Wall" value={fmtPrice(model.callWall)} accent={C.bear} />
          <Metric label="Put Wall" value={fmtPrice(model.putWall)} accent={C.bull} />
          <Metric label="Max Pain" value={fmtPrice(model.maxPain)} accent={C.blue} />
        </div>

        {/* Gamma map */}
        <GammaMap model={model} />

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 20,
            paddingTop: 16,
            borderTop: `1px solid ${C.panelBorder}`,
            fontSize: 11,
            color: C.textFaint,
          }}
        >
          <span style={{ fontWeight: 700, letterSpacing: 1, color: C.textSecondary }}>
            ZEROGEX
            <span style={{ color: C.textFaint, fontWeight: 500 }}> · zerogex.io · @zerogex</span>
          </span>
          <span>Derived analytics · not financial advice</span>
        </div>
      </div>
    </div>
  );
});

const CARD_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1.3,
  textTransform: 'uppercase',
  color: C.textFaint,
  marginBottom: 5,
};

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 12,
        padding: '12px 13px',
      }}
    >
      <div style={CARD_LABEL}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent, letterSpacing: -0.2 }}>
        {value}
      </div>
    </div>
  );
}

// Horizontal positioning map: lays the put wall, flip, spot and call wall on a
// shared price axis so the viewer can see at a glance where price sits relative
// to the dealer magnets. Markers below the track = structural walls; above the
// track = flip + live spot.
function GammaMap({ model }: { model: ReportModel }) {
  const points = [
    { key: 'put', label: 'Put Wall', value: model.putWall, color: C.bull, side: 'below' as const },
    { key: 'flip', label: 'Flip', value: model.gammaFlip, color: C.amber, side: 'above' as const },
    { key: 'spot', label: 'Spot', value: model.spot, color: C.textPrimary, side: 'above' as const },
    { key: 'call', label: 'Call Wall', value: model.callWall, color: C.bear, side: 'below' as const },
  ].filter((p): p is typeof p & { value: number } => p.value != null && Number.isFinite(p.value));

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = span * 0.08;
  const lo = min - pad;
  const hi = max + pad;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;

  const above = points.filter((p) => p.side === 'above');
  const below = points.filter((p) => p.side === 'below');

  return (
    <div style={{ marginTop: 20 }}>
      <div style={CARD_LABEL}>Positioning Map</div>
      <div style={{ position: 'relative', height: 78, marginTop: 6 }}>
        {/* above-track labels */}
        {above.map((p) => (
          <Marker key={p.key} p={p} left={pos(p.value)} side="above" />
        ))}
        {/* track */}
        <div
          style={{
            position: 'absolute',
            top: 38,
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${C.bull}55, ${C.amber}55, ${C.bear}55)`,
          }}
        />
        {/* ticks */}
        {points.map((p) => (
          <div
            key={`tick-${p.key}`}
            style={{
              position: 'absolute',
              top: 32,
              left: `${pos(p.value)}%`,
              width: 2,
              height: 16,
              marginLeft: -1,
              background: p.color,
              borderRadius: 1,
            }}
          />
        ))}
        {/* below-track labels */}
        {below.map((p) => (
          <Marker key={p.key} p={p} left={pos(p.value)} side="below" />
        ))}
      </div>
    </div>
  );
}

function Marker({
  p,
  left,
  side,
}: {
  p: { label: string; value: number; color: string };
  left: number;
  side: 'above' | 'below';
}) {
  // Clamp the label box so edge markers don't overflow the card.
  const clamped = Math.min(92, Math.max(8, left));
  return (
    <div
      style={{
        position: 'absolute',
        top: side === 'above' ? 0 : 52,
        left: `${clamped}%`,
        transform: 'translateX(-50%)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: C.textFaint,
        }}
      >
        {p.label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: p.color }}>{fmtPrice(p.value)}</div>
    </div>
  );
}

export default GammaReportCard;
