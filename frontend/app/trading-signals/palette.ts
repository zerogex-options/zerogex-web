/**
 * TradeWorkz™ categorical palette.
 *
 * Nine well-separated hues assigned to the 9 bots in a fixed order — a bot
 * always keeps the same color no matter where it lands on the leaderboard.
 * That's the dataviz "color follows the entity, never rank" invariant: if
 * we let the leaderboard reorder tint, the eye can't track a single bot
 * across period switches.
 *
 * The palette deliberately avoids pure red and pure green — those are
 * reserved for bull / bear direction in --color-bull / --color-bear.
 * Every hue passes a CVD-simulation eyeball check against its neighbors
 * in this exact order; if you add a bot, append a new hue at the end
 * rather than inserting one mid-list.
 */

export const BOT_COLORS: Record<string, string> = {
  put_call_wall_bouncer: '#00B8D4',        // teal
  gamma_flip_defender: '#6366F1',           // indigo
  gamma_flip_breaker: '#8B5CF6',            // violet
  eod_pin_drifter: '#D946EF',               // magenta
  dealer_delta_pressure_rider: '#F59E0B',   // amber
  vwap_reversion_scalper: '#F97316',        // orange
  vix_regime_breakout: '#EC4899',           // rose
  opening_range_hunter: '#475569',          // slate
  max_pain_gravitator: '#0EA5E9',           // sky
};

const FALLBACK_COLORS = [
  '#00B8D4', '#6366F1', '#8B5CF6', '#D946EF', '#F59E0B',
  '#F97316', '#EC4899', '#475569', '#0EA5E9',
];

export function botColor(botId: string, index = 0): string {
  return BOT_COLORS[botId] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/** Softened background version of a bot color for hover / chip fills. */
export function botColorSoft(botId: string, index = 0): string {
  const base = botColor(botId, index);
  return `${base}22`; // 13% alpha as hex suffix
}
