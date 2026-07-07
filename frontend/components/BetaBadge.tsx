import { colors } from "@/core/colors";

interface BetaBadgeProps {
  /** Visual scale. "sm" suits inline nav labels; "md" suits page headings. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Small "BETA" pill used to flag features that are still under active
 * development (e.g. Backtesting, the Premium Heat Map). Uses the brand
 * accent so it reads as informational rather than a warning.
 */
export default function BetaBadge({ size = "sm", className = "" }: BetaBadgeProps) {
  const isMd = size === "md";
  return (
    <span
      className={`inline-flex items-center rounded font-bold uppercase tracking-wider ${
        isMd ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[9px]"
      } ${className}`}
      style={{
        backgroundColor: `${'var(--color-brand-accent)'}1f`,
        color: 'var(--color-brand-accent)',
        border: `1px solid ${'var(--color-brand-accent)'}55`,
        lineHeight: 1.1,
      }}
    >
      Beta
    </span>
  );
}
