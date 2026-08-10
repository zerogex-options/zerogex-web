import type { CSSProperties, ReactNode } from "react";
import { Info } from "lucide-react";

/**
 * ChartCaption — the ONE sanctioned attribution strip for every chart card.
 *
 * Renders the "Powered by ZeroGEX" footer consistently across the app so every
 * chart carries the same authorship label (mirrors the flagship Gamma Chart's
 * "Dealer gamma computed by ZeroGEX · updates live" strip: an Info glyph + a
 * tracked mono eyebrow separated from the plot by a single hairline).
 *
 * Two layouts, same label treatment:
 *   - "inset" (default): a hairline-topped row that lives INSIDE a padded card
 *     (`p-4`/`p-5`/`p-6`), inheriting the card's horizontal padding. Drop it in
 *     as the LAST child of the card body.
 *   - "strip": a full-bleed edge-to-edge footer with its own padding + a subtle
 *     fill, for cards whose outer container carries no padding (the flush-strip
 *     charts). Use as the LAST child, flush against the bottom edge.
 *
 * Colors come from global theme tokens, so it adapts to every theme.
 *
 *   <ChartCaption />                                   → "Powered by ZeroGEX"
 *   <ChartCaption live />                              → "Powered by ZeroGEX · updates live"
 *   <ChartCaption live delayed />                      → "Powered by ZeroGEX · delayed ~15 min"
 *   <ChartCaption text="Dealer gamma computed by ZeroGEX" live />
 *   <ChartCaption variant="strip" right="Gamma / Heatmap" />
 */
export default function ChartCaption({
  text = "Powered by ZeroGEX",
  live = false,
  delayed = false,
  icon = true,
  right,
  variant = "inset",
  className = "",
  style,
}: {
  /** Lead attribution text. Defaults to the universal "Powered by ZeroGEX". */
  text?: string;
  /** Append a freshness suffix ("· updates live" / "· delayed ~15 min"). */
  live?: boolean;
  /** When `live`, swap the suffix to the delayed-feed wording. */
  delayed?: boolean;
  /** Show the leading Info glyph. */
  icon?: boolean;
  /** Optional right-pinned descriptor, e.g. a chart category ("Gamma / Heatmap"). */
  right?: ReactNode;
  /** "inset" for padded cards (default); "strip" for flush, edge-to-edge footers. */
  variant?: "inset" | "strip";
  className?: string;
  style?: CSSProperties;
}) {
  const suffix = live ? (delayed ? " · delayed ~15 min" : " · updates live") : "";
  const layout =
    variant === "strip"
      ? "flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2.5"
      : "flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-2.5";
  const baseStyle: CSSProperties =
    variant === "strip"
      ? { borderTop: "1px solid var(--border-default)", background: "var(--bg-subtle)" }
      : { borderTop: "1px solid var(--border-default)" };

  return (
    <div className={`${layout} ${className}`} style={{ ...baseStyle, ...style }}>
      <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        {icon && <Info size={12} aria-hidden />}
        <span className="zg-eyebrow" style={{ fontSize: 9.5 }}>
          {text}
          {suffix}
        </span>
      </span>
      {right != null && (
        <span
          className="ml-auto zg-eyebrow"
          style={{ fontSize: 9.5, color: "var(--text-muted)" }}
        >
          {right}
        </span>
      )}
    </div>
  );
}
