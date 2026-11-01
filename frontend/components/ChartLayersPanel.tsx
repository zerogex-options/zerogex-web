"use client";

/**
 * ChartLayersPanel — everything the Gamma Chart can draw, in one panel that
 * hangs under its toolbar. It replaced the row of overlay pills, which grew to
 * three wrapping lines and moved whenever a control appeared or disappeared
 * beside a pill (the ribbon opacity slider, the Expected Range horizon, the
 * volume view).
 *
 * The panel is presentation only. The chart decides what the layers are, which
 * ones apply to the symbol and timeframe on screen, and what each one's own
 * settings are (components/GammaTerminalChart builds the groups); this lays
 * them out:
 *   • one switch per layer, with its color, its name and a line on what it
 *     draws;
 *   • a layer that can't be drawn here stays in place, dimmed, and says why,
 *     instead of disappearing and moving everything after it;
 *   • a layer's own settings sit under it while it is on;
 *   • Quick looks set every layer at once, and Reset puts the defaults back.
 *
 * It is a non-modal dialog: opening it moves focus to the first switch, Escape
 * or the close button returns focus to the Layers button, and a press
 * anywhere outside it closes it without moving focus.
 */

import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";

export interface LayerPanelRow {
  key: string;
  /** On-screen name. The help guide's overlay table is keyed by it. */
  label: string;
  /** One line on what the layer draws. */
  hint: string;
  color: string;
  /** Whether the layer is drawn. Always false while `unavailable`. */
  on: boolean;
  /** Why the layer can't be drawn on this symbol or timeframe, if it can't. */
  unavailable?: string;
  onToggle: () => void;
  /** The layer's own settings, shown under its switch while it is on. */
  settings?: ReactNode;
}

export interface LayerPanelGroup {
  key: string;
  title: string;
  rows: LayerPanelRow[];
}

export interface LayerPanelPreset {
  id: string;
  label: string;
  title: string;
  active: boolean;
  apply: () => void;
}

export default function ChartLayersPanel({
  id,
  groups,
  presets,
  onReset,
  onClose,
  anchor,
  maxHeight,
  columns,
  narrow,
}: {
  id: string;
  groups: LayerPanelGroup[];
  presets: LayerPanelPreset[];
  onReset: () => void;
  /** Close the panel; `refocus` returns focus to the Layers button. */
  onClose: (refocus: boolean) => void;
  /** The Layers button. A press on it is the button's own toggle, not an outside press. */
  anchor: HTMLElement | null;
  /** The room left in the chart card under the toolbar; the panel scrolls past it. */
  maxHeight: number | null;
  /** The grid's column template, chosen by the chart from the card's width. */
  columns: string;
  /** A phone-width card: the header puts Quick looks on a line of its own. */
  narrow: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // The latest close handler, so the document listener is attached once.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor?.contains(target)) return;
      onCloseRef.current(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [anchor]);

  // Opening lands on the first layer that can be switched.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('.zg-gc-layer-row:not([aria-disabled="true"])')?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    onClose(true);
  };

  const rows = groups.flatMap((g) => g.rows);
  const available = rows.filter((r) => !r.unavailable);
  const onCount = available.filter((r) => r.on).length;
  const custom = !presets.some((p) => p.active);

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-label="Chart layers"
      className="zg-gc-layers"
      data-narrow={narrow}
      style={maxHeight != null ? { maxHeight } : undefined}
      onKeyDown={onKeyDown}
    >
      <div className="zg-gc-layers-head">
        <div className="zg-gc-layers-title">
          <span className="zg-gc-layers-name">Layers</span>
          <span className="zg-gc-layers-count">
            {onCount} of {available.length} on
          </span>
        </div>
        <div className="zg-gc-layers-looks">
          <span className="zg-gc-layers-label">Quick looks</span>
          <div className="zg-gc-seg" role="group" aria-label="Quick looks">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className="zg-gc-seg-btn"
                data-active={p.active}
                aria-pressed={p.active}
                title={p.title}
                onClick={p.apply}
              >
                {p.label}
              </button>
            ))}
          </div>
          {custom && (
            <span className="zg-chip" style={{ ["--chip-color" as string]: "var(--color-brand-primary)" }} title="Your own mix: it doesn't match a quick look">
              Custom
            </span>
          )}
        </div>
        <button type="button" className="zg-gc-tb zg-gc-tb--icon zg-gc-layers-close" aria-label="Close layers" title="Close" onClick={() => onClose(true)}>
          <X size={15} aria-hidden />
        </button>
      </div>

      <div className="zg-gc-layers-grid" style={{ gridTemplateColumns: columns }}>
        {groups.map((g) => (
          <section key={g.key} className="zg-gc-layers-group" aria-label={g.title}>
            <h3 className="zg-gc-layers-group-title">{g.title}</h3>
            {g.rows.map((r) => (
              <div key={r.key} className="zg-gc-layer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.on}
                  aria-disabled={r.unavailable ? true : undefined}
                  aria-label={r.unavailable ? `${r.label} (${r.unavailable})` : r.label}
                  className="zg-gc-layer-row"
                  data-on={r.on}
                  style={{ ["--layer-color" as string]: r.color } as CSSProperties}
                  title={`${r.label}: ${r.unavailable ?? r.hint}`}
                  onClick={r.unavailable ? undefined : r.onToggle}
                >
                  <span className="zg-gc-layer-swatch" aria-hidden />
                  <span className="zg-gc-layer-text">
                    <span className="zg-gc-layer-name">{r.label}</span>
                    <span className="zg-gc-layer-hint">{r.unavailable ?? r.hint}</span>
                  </span>
                  <span className="zg-gc-switch" aria-hidden />
                </button>
                {r.on && !r.unavailable && r.settings ? <div className="zg-gc-layer-settings">{r.settings}</div> : null}
              </div>
            ))}
          </section>
        ))}
      </div>

      <div className="zg-gc-layers-foot">
        <button type="button" className="zg-gc-layers-reset" onClick={onReset}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
