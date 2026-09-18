/**
 * Level values as served — one coercion, one fallback rule.
 *
 * Every dealer-positioning level (flip, walls, max pain, pin) reaches the
 * client as a JSON number, a Postgres numeric serialized as a string, an empty
 * string, or null; and several surfaces read the SAME level from more than one
 * endpoint in a precedence order. Both halves of that were open-coded per
 * surface, and the copies disagreed:
 *
 *   • Coercion. `GammaTerminalChart`'s `num` required `typeof v === "number"`,
 *     so it dropped a served `"762.44"` on the floor, while
 *     `useGammaPlaybook`'s `num` and `core/keyLevels`' `finite` both coerced
 *     it. One payload could therefore print a level on the Key Levels strip
 *     and `FLIP UNAVAILABLE` on the chart directly beneath it.
 *
 *   • Fallback. The live surfaces wrote `num(profile ?? summary)`, which puts
 *     the `??` INSIDE the coercion: the second source is tried only when the
 *     first is null/undefined, so any other unusable value (a numeric string
 *     under a strict coercion, a NaN) consumes the `??` and the fallback never
 *     runs. `app/chart/snapshot.ts` had the correct shape —
 *     `num(profile) ?? num(summary)` — which is why the delayed public chart
 *     could draw a flip the live chart could not.
 *
 * {@link firstLevel} is that correct shape generalized: it coerces EACH
 * candidate and returns the first that survives, so the broken nesting cannot
 * be reintroduced by accident. Callers list their sources in precedence order
 * and never pre-combine them with `??`.
 *
 * Pure and runtime-dependency-free, like every module under `core/` the Node
 * test runner covers.
 */

/**
 * A served level coerced to a finite number, or `null` when it is absent or
 * unusable (null, undefined, empty string, NaN, Infinity, non-numeric text).
 *
 * `0` is preserved: it is a legitimate value for the signed quantities that
 * share this coercion (`net_gex_at_spot` is zero exactly at the flip). The
 * separate rule that a *price* level must be positive lives in
 * `core/keyLevels`' `positiveLevel`, so a degraded `0` never renders as
 * `$0.00`; keeping the two apart is what lets one coercion serve both.
 */
export function levelOrNull(value: unknown): number | null {
  // An empty string is absent data, not zero — `Number('')` is `0`, which
  // would put a $0.00 level on the axis.
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * The first usable level among the candidates, in the caller's precedence
 * order — the safe replacement for a hand-written `??` chain.
 *
 * Each candidate is coerced independently, so a source that answers with
 * something unusable is skipped rather than consumed: `firstLevel(profile,
 * summary)` falls through to the summary whether the profile said `null`, a
 * NaN, or a numeric string that a stricter coercion would have rejected.
 *
 * Returns `null` when no candidate survives — the caller draws no level rather
 * than substituting a differently-scoped one.
 */
export function firstLevel(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const level = levelOrNull(candidate);
    if (level != null) return level;
  }
  return null;
}
