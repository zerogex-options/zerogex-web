/**
 * A chart's zoom steppers: a label and a minus and plus button, as the Gamma
 * Chart and the Flow Analysis chart both draw them over the plot.
 */

import type { CSSProperties } from "react";

const zoomBtnStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1,
  width: 22,
  height: 20,
  display: "grid",
  placeItems: "center",
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-subtle)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};

export default function ZoomCluster({ label, onIn, onOut, hint, large = false }: { label: string; onIn: () => void; onOut: () => void; hint?: string; large?: boolean }) {
  // A bare wheel scrolls the page now, so the modifier gesture only exists if
  // something tells the reader about it. These buttons are that something.
  const suffix = hint ? `\u00a0- or ${hint}` : "";
  // `large`: finger-sized steppers for the compact canvas.
  const btn = large ? { ...zoomBtnStyle, width: 34, height: 30, fontSize: 17 } : zoomBtnStyle;
  return (
    <div
      className="flex items-center gap-1"
      style={{
        background: "color-mix(in srgb, var(--bg-card) 88%, transparent)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-control)",
        padding: "3px 5px",
        backdropFilter: "blur(3px)",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", width: large ? "auto" : 34, textAlign: "right", paddingRight: 2 }}>
        {label}
      </span>
      <button type="button" onClick={onOut} aria-label={`Zoom out (${label})`} title={`Zoom out (${label})${suffix}`} style={btn}>
        −
      </button>
      <button type="button" onClick={onIn} aria-label={`Zoom in (${label})`} title={`Zoom in (${label})${suffix}`} style={btn}>
        +
      </button>
    </div>
  );
}
