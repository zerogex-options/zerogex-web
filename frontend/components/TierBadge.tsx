import { Lock } from "lucide-react";
import type { TierId } from "@/core/auth";

interface TierBadgeProps {
  /** The tier a locked nav entry requires (e.g. "pro"). */
  tier: TierId;
  /** Visual scale. "sm" suits inline nav labels; "md" suits page headings. */
  size?: "sm" | "md";
  className?: string;
}

const TIER_LABEL: Record<TierId, string> = {
  public: "Free",
  basic: "Basic",
  pro: "Pro",
  admin: "Admin",
};

/**
 * Small lock pill (e.g. "🔒 Pro") shown next to a nav entry a signed-in member
 * can see but not open yet — it flags the item as an upgrade rather than
 * hiding it. Clicking such an item routes to /pricing. Uses the brand primary
 * so it reads as an upgrade cue, distinct from the accent-colored BetaBadge.
 */
export default function TierBadge({ tier, size = "sm", className = "" }: TierBadgeProps) {
  const isMd = size === "md";
  return (
    <span
      className={`inline-flex items-center gap-1 uppercase ${
        isMd ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[9px]"
      } ${className}`}
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        letterSpacing: "0.1em",
        color: "var(--color-brand-primary)",
        border: "1px solid var(--color-brand-primary)",
        borderRadius: "var(--radius-control)",
        lineHeight: 1.1,
      }}
    >
      <Lock size={isMd ? 11 : 9} strokeWidth={2.5} aria-hidden />
      {TIER_LABEL[tier]}
    </span>
  );
}
