// Mapping for the "Regime Triggers · Readiness" card on the dashboard's
// Proprietary Signals panel.
//
// The three regime-readiness advanced signals (vol_expansion,
// range_break_imminence, market_pressure) each expose their headline reading —
// `expansion` / `imminence` / `loading`, plus `label` and `direction` — at the
// TOP LEVEL of their API response. `context_values` carries only the per-pillar
// breakdown (skew / dealer / trap / compression for range break; compression /
// hedging / flow / tension for market pressure) and holds no headline field.
//
// Reading a headline out of `context_values` therefore resolves to undefined
// and pins the row to "awaiting data" forever, which is the bug this module
// exists to prevent recurring. Lives here rather than inline in the component
// so the shape contract is unit-tested.
// Kept runtime-self-contained (type-only imports) so node's --experimental-strip-types
// runner can load this module directly from tests/, matching every other
// unit-tested module under core/. These two narrowings mirror `asObject` and
// `getNumber` in ./signalHelpers.
type GenericObject = Record<string, unknown>;

function asObject(value: unknown): GenericObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as GenericObject;
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export type TriggerDirection = 'bullish' | 'bearish' | 'neutral';

export interface RegimeTrigger {
  key: string;
  label: string;
  // 0–100 readiness / imminence / loading; null when data is genuinely missing.
  magnitude: number | null;
  // Playbook state label — backend-provided where available, else banded.
  state: string | null;
  // Directional tag shown as context only; these are not directional votes.
  direction: TriggerDirection | null;
}

export function extractDirection(raw: unknown): TriggerDirection | null {
  if (typeof raw === 'string') {
    const v = raw.toLowerCase();
    if (v === 'bullish' || v === 'bearish' || v === 'neutral') return v;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw > 0) return 'bullish';
    if (raw < 0) return 'bearish';
    return 'neutral';
  }
  return null;
}

// vol_expansion ships no backend label; band the `expansion` readiness
// (already 0–100). Thresholds match the `triggered` cutoff (|score| ≥ 0.25
// with readiness floor 0.15 ⇒ ~25 as the lower band; readiness saturates at
// 100).
export function deriveVolExpansionState(expansion: number | null): string | null {
  if (expansion == null) return null;
  if (expansion >= 70) return 'Loaded';
  if (expansion >= 40) return 'Building';
  return 'Quiet';
}

// Range break and market pressure normally ship a backend `label`, but it is
// absent on partial snapshots. These mirror the band tables the dedicated
// /range-break-imminence and /market-pressure pages use, so the card reads the
// same as the deep-dive page instead of falling back to a bare dash.
export function deriveImminenceState(imminence: number | null): string | null {
  if (imminence == null) return null;
  if (imminence >= 80) return 'Breakout Mode';
  if (imminence >= 65) return 'Break Watch';
  if (imminence >= 40) return 'Weak Range';
  return 'Range-Bound';
}

export function deriveMarketPressureState(loading: number | null): string | null {
  if (loading == null) return null;
  if (loading >= 75) return 'Critical';
  if (loading >= 50) return 'Loaded';
  if (loading >= 25) return 'Building';
  return 'Discharged';
}

// Top level wins; `context_values` is a defensive fallback in case a snapshot
// nests the headline.
function pickNumber(top: GenericObject | null, ctx: GenericObject | null, key: string): number | null {
  return getNumber(top?.[key]) ?? getNumber(ctx?.[key]);
}

function pickLabel(top: GenericObject | null, ctx: GenericObject | null): string | null {
  if (typeof top?.label === 'string' && top.label) return top.label;
  if (typeof ctx?.label === 'string' && ctx.label) return ctx.label;
  return null;
}

export function buildRegimeTriggers(
  volExpansionData: unknown,
  rangeBreakData: unknown,
  marketPressureData: unknown,
): RegimeTrigger[] {
  const vol = asObject(volExpansionData);
  const volCtx = asObject(vol?.context_values);
  const rb = asObject(rangeBreakData);
  const rbCtx = asObject(rb?.context_values);
  const mp = asObject(marketPressureData);
  const mpCtx = asObject(mp?.context_values);

  const expansion = pickNumber(vol, volCtx, 'expansion');
  const imminence = pickNumber(rb, rbCtx, 'imminence');
  const loading = pickNumber(mp, mpCtx, 'loading');

  return [
    {
      key: 'vol_expansion',
      label: 'Volatility Expansion',
      magnitude: expansion,
      state: pickLabel(vol, volCtx) ?? deriveVolExpansionState(expansion),
      direction: extractDirection(vol?.direction),
    },
    {
      key: 'range_break_imminence',
      label: 'Range Break Imminence',
      magnitude: imminence,
      state: pickLabel(rb, rbCtx) ?? deriveImminenceState(imminence),
      direction: extractDirection(rb?.direction),
    },
    {
      key: 'market_pressure',
      label: 'Market Pressure',
      magnitude: loading,
      state: pickLabel(mp, mpCtx) ?? deriveMarketPressureState(loading),
      // `direction` is the string tag; `direction_value` is the signed
      // magnitude. Prefer the tag, fall back to the sign of the value.
      direction: extractDirection(mp?.direction) ?? extractDirection(mp?.direction_value),
    },
  ];
}
