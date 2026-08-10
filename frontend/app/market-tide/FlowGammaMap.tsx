"use client";

/**
 * Flow × Gamma map — every supported index plotted by its directional flow
 * (x) and dealer gamma (y). Short gamma sits up top (moves amplify), long
 * gamma down low (moves pinned); call-led flow right, put-led left. The four
 * quadrants read as regimes — squeeze fuel, air pocket, capped grind,
 * supported — so which names are primed to run vs. get pinned reads at a
 * glance. Hand-rolled SVG in CSS tokens, matching the Gamma Terminal.
 */

import { useState, type CSSProperties } from "react";
import {
  finite,
  formatNumber,
  formatSigned,
  regimePhrase,
  type MarketTideComponent,
} from "./data";

const VW = 560;
const VH = 470;
const L = 54;
const R = 22;
const T = 26;
const B = 54;
const PW = VW - L - R;
const PH = VH - T - B;
const IT = 12;
const IB = 12;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const SP = " ";

export default function FlowGammaMap({ components }: { components: MarketTideComponent[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const comps = components.filter((c) => c && c.symbol);
  if (comps.length === 0) {
    return (
      <div
        className="flex h-[260px] items-center justify-center text-sm text-[var(--text-secondary)]"
        role="img"
        aria-label="Flow versus gamma map — no eligible symbols"
      >
        No eligible symbols in this window yet.
      </div>
    );
  }

  const x = (f: number) => L + ((clamp(f, -1, 1) + 1) / 2) * PW;
  const y = (g: number) => T + IT + ((clamp(g, -1, 1) + 1) / 2) * (PH - IT - IB);
  const cx = x(0);
  const cy = T + PH / 2;
  const allShort = comps.every((c) => (finite(c.gamma_score) ?? 0) < 0);

  const svgStyle: CSSProperties = { fontFamily: "var(--font-mono)", display: "block", width: "100%", height: "auto" };
  const hoverC = hover != null ? comps[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" style={svgStyle} role="img" aria-label="Flow versus dealer gamma by ticker">
        {/* quadrant tints — top-left air pocket, top-right squeeze fuel */}
        <rect x={L} y={T} width={cx - L} height={PH / 2} fill="var(--color-bear-soft)" />
        <rect x={cx} y={T} width={VW - R - cx} height={PH / 2} fill="var(--color-bull-soft)" />

        {/* region names: top above the frame (clear of the bubble band), bottom in the empty corners */}
        <text x={L} y={16} fontSize="11" fontWeight="700" letterSpacing="1" fill="var(--color-bear)" opacity="0.9">
          AIR POCKET
        </text>
        <text x={VW - R} y={16} textAnchor="end" fontSize="11" fontWeight="700" letterSpacing="1" fill="var(--color-bull)" opacity="0.9">
          SQUEEZE FUEL
        </text>
        <text x={L + 8} y={T + PH - 12} fontSize="10.5" fontWeight="700" letterSpacing="1" fill="var(--text-muted)">
          SUPPORTED
        </text>
        <text x={VW - R - 8} y={T + PH - 12} textAnchor="end" fontSize="10.5" fontWeight="700" letterSpacing="1" fill="var(--text-muted)">
          CAPPED GRIND
        </text>

        {/* frame + centre cross */}
        <rect x={L} y={T} width={PW} height={PH} fill="none" stroke="var(--color-border)" strokeWidth="1" />
        <line x1={L} y1={cy} x2={VW - R} y2={cy} stroke="var(--border-strong)" strokeWidth="1" />
        <line x1={cx} y1={T} x2={cx} y2={T + PH} stroke="var(--border-strong)" strokeWidth="1" />

        {/* axis titles */}
        <text x={cx} y={VH - 28} textAnchor="middle" fontSize="10.5" fill="var(--text-secondary)">
          {`◄${SP}put-led${SP}${SP}FLOW${SP}${SP}call-led${SP}►`}
        </text>
        <text transform={`translate(16,${T + PH / 2}) rotate(-90)`} textAnchor="middle" fontSize="10.5" fill="var(--text-secondary)">
          {`◄${SP}long γ${SP}${SP}GAMMA${SP}${SP}short γ${SP}►`}
        </text>

        {allShort && (
          <text x={cx} y={cy + PH / 4 + 4} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)" opacity="0.85">
            {`—${SP}no index is long-gamma right now${SP}—`}
          </text>
        )}

        {/* bubbles */}
        {comps.map((c, i) => {
          const bx = x(finite(c.flow_score) ?? 0);
          const by = y(finite(c.gamma_score) ?? 0);
          const bull = (finite(c.contribution) ?? 0) >= 0;
          const r = 15 + (finite(c.weight) ?? 0) * 14;
          return (
            <g
              key={`${c.symbol}-${i}`}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(i)}
              onMouseMove={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <circle cx={bx} cy={by} r={r + 2.5} fill="var(--bg-card)" />
              <circle cx={bx} cy={by} r={r} fill={bull ? "var(--color-bull-soft)" : "var(--color-bear-soft)"} stroke={bull ? "var(--color-bull)" : "var(--color-bear)"} strokeWidth="2" />
              <text x={bx} y={by + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-primary)">
                {c.symbol}
              </text>
            </g>
          );
        })}
      </svg>

      {hoverC && (
        <div
          className="pointer-events-none absolute left-1/2 top-2 z-10 max-w-[220px] -translate-x-1/2 rounded-lg border px-3 py-2 text-xs font-mono shadow-lg"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-strong)" }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <b className="text-sm">{hoverC.symbol}</b>
            <span className="tabular-nums">
              {(finite(hoverC.gamma_score) ?? 0) < 0 ? "short γ" : "long γ"}
            </span>
          </div>
          <div className="mt-1 flex justify-between gap-4 tabular-nums">
            <span className="text-[var(--text-secondary)]">Flow</span>
            <b style={{ color: (finite(hoverC.flow_score) ?? 0) >= 0 ? "var(--color-bull)" : "var(--color-bear)" }}>{formatNumber(hoverC.flow_score)}</b>
          </div>
          <div className="flex justify-between gap-4 tabular-nums">
            <span className="text-[var(--text-secondary)]">Contribution</span>
            <b style={{ color: (finite(hoverC.contribution) ?? 0) >= 0 ? "var(--color-bull)" : "var(--color-bear)" }}>{formatSigned(hoverC.contribution, 3)}</b>
          </div>
          <p className="mt-1.5 leading-snug text-[var(--text-secondary)]">{regimePhrase(hoverC)}</p>
        </div>
      )}
    </div>
  );
}
