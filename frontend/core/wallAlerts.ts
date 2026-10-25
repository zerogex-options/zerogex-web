// Wall alerts — what an alert says, in every channel.
//
// zerogex-oa detects Call/Put Wall hits, breaks and holds (src/alerts/) and
// stores one structured payload per event (src/alerts/wall_payload.py). This
// module turns that payload into words for the in-app bell and toast, the
// email, and the SMS that will follow — from ONE formatter, so the three can
// never disagree about the wall, the price or how strong the wall was.
//
// Localized surfaces pass their own WallAlertCopy; email and SMS use the
// English one (every ZeroGEX email is English).
//
// Pure and import-free on purpose (no '@/' alias, no server-only): the
// delivery worker script and the node test runner import it directly, the same
// constraint core/levelsEmail.ts documents.

export type WallSide = 'call' | 'put';
export type WallRuleSide = WallSide | 'both';
export type WallEventKind = 'hit' | 'break' | 'hold';
export type WallStrengthTier = 'light' | 'moderate' | 'above_typical' | 'strong' | 'very_strong';
export type WallProfile = 'responsive' | 'balanced' | 'conservative';
export type WallChannel = 'in_app' | 'email' | 'sms';

export const WALL_EVENT_KINDS: readonly WallEventKind[] = ['hit', 'break', 'hold'];
export const WALL_PROFILES: readonly WallProfile[] = ['responsive', 'balanced', 'conservative'];
export const WALL_CHANNELS: readonly WallChannel[] = ['in_app', 'email', 'sms'];

export interface WallAlertOdds {
  horizon_minutes: number;
  break_prob: number;
  ci_low?: number | null;
  ci_high?: number | null;
  n_tests?: number | null;
}

/** The stored alert, exactly as src/alerts/wall_payload.py writes it (v1). */
export interface WallAlertPayload {
  v?: number;
  symbol: string;
  side: WallSide;
  kind: WallEventKind;
  wall: number;
  price: number;
  last_price?: number | null;
  /** Signed toward the approach side: >0 still short of the wall, <0 past it. */
  distance?: number | null;
  bar_ts?: string | null;
  session_date?: string | null;
  hit_ts?: string | null;
  hit_price?: number | null;
  minutes_since_hit?: number | null;
  peak?: number | null;
  ordinal?: number | null;
  approach_number?: number | null;
  alerted_hit?: boolean | null;
  profile?: WallProfile | null;
  /** The touch tolerance the alert's stream ran at, in basis points. */
  touch_bp?: number | null;
  touch_band?: number | null;
  break_buffer?: number | null;
  hold_distance?: number | null;
  confirm_minutes?: number | null;
  strength?: number | null;
  strength_pctile?: number | null;
  strength_tier?: WallStrengthTier | null;
  regime?: 'positive' | 'negative' | null;
  current_wall?: number | null;
  odds?: WallAlertOdds[] | null;
}

export interface WallAlertRule {
  id: number;
  symbol: string;
  side: WallRuleSide;
  events: Record<WallEventKind, boolean>;
  min_strength_pctile: number;
  profile: WallProfile;
  /** How close price must come for a hit, in basis points; null = Auto (the profile's own band). */
  touch_bp: number | null;
  channels: Record<WallChannel, boolean>;
  enabled: boolean;
  /** Runs for one session only (false: every trading day until paused or deleted). */
  today_only?: boolean;
  /** A today-only rule's last session, as an ET date ("2026-10-26"); null every day. */
  expires_on?: string | null;
  /** When that session closes (ISO instant). */
  ends_at?: string | null;
  /** That close has passed: the rule no longer runs until it is turned back on. */
  ended?: boolean;
  created_at: string | null;
  updated_at: string | null;
  last_triggered_at: string | null;
}

/** The editable fields of a rule — what the form posts. */
export type WallAlertRuleInput = Omit<
  WallAlertRule,
  'id' | 'created_at' | 'updated_at' | 'last_triggered_at' | 'today_only' | 'expires_on' | 'ends_at' | 'ended'
> & {
  /** Saving with this on (re)arms the rule for the session it would run in now. */
  today_only: boolean;
};

export interface WallAlertFeedEntry {
  id: number;
  event_id: number;
  rule_id: number | null;
  created_at: string | null;
  read: boolean;
  symbol: string;
  side: WallSide;
  kind: WallEventKind;
  wall: number | null;
  price: number | null;
  payload: WallAlertPayload;
}

export interface WallAlertFeedResponse {
  entries: WallAlertFeedEntry[];
  unread: number;
  signed_in?: boolean;
}

export interface WallAlertProfileConfig {
  name: WallProfile;
  touch_pct: number;
  touch_bp?: number;
  arm_buffers: number;
  cooldown_minutes: number;
  confirm_minutes: number;
  hold_buffers: number;
  resolution_minutes: number;
  open_grace_minutes: number;
}

export interface WallAlertsConfig {
  symbols: string[];
  profiles: WallAlertProfileConfig[];
  default_profile: WallProfile;
  touch_options_bp?: number[];
  channels: Array<{ id: WallChannel; available: boolean; delivery: string }>;
  max_strength_floor: number;
  max_rules: number;
  daily_cap: number;
  /** The session a today-only rule saved now would run in, and its close. */
  today_only?: { session: string; ends_at: string };
}

export interface LiveWallSide {
  strike: number;
  strength: number | null;
  strength_pctile: number | null;
  strength_tier: WallStrengthTier | null;
  distance: number | null;
  distance_pct: number | null;
}

export interface LiveWallsRow {
  symbol: string;
  walls_ts: string | null;
  price: number | null;
  price_ts: string | null;
  stale: boolean;
  regime: 'positive' | 'negative' | null;
  call: LiveWallSide | null;
  put: LiveWallSide | null;
}

export interface LiveWallsResponse {
  as_of: string;
  symbols: LiveWallsRow[];
}

// ── Strength ────────────────────────────────────────────────────────────────

// The slider's stops — the same floors src/alerts/wall_payload.py STRENGTH_TIERS
// uses, so "Strong" on an alert means what "Strong" meant when the member set
// the filter.
export const STRENGTH_STOPS: ReadonlyArray<{ pctile: number; tier: WallStrengthTier | null }> = [
  { pctile: 0, tier: null },
  { pctile: 25, tier: 'moderate' },
  { pctile: 50, tier: 'above_typical' },
  { pctile: 75, tier: 'strong' },
  { pctile: 90, tier: 'very_strong' },
];

export function strengthTierFor(pctile: number | null | undefined): WallStrengthTier | null {
  if (pctile === null || pctile === undefined || !Number.isFinite(pctile)) return null;
  if (pctile >= 90) return 'very_strong';
  if (pctile >= 75) return 'strong';
  if (pctile >= 50) return 'above_typical';
  if (pctile >= 25) return 'moderate';
  return 'light';
}

/** Would a rule with this floor match a wall at this percentile? Mirrors the fan-out. */
export function passesStrengthFloor(floor: number, pctile: number | null | undefined): boolean {
  if (!floor || floor <= 0) return true;
  if (pctile === null || pctile === undefined || !Number.isFinite(pctile)) return false;
  return pctile >= floor;
}

// ── Number formatting ───────────────────────────────────────────────────────

const PRICE_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STRIKE_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** A strike: 7,700 / 577.5 — no trailing zeros. */
export function fmtStrike(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : STRIKE_FMT.format(v);
}

/** A price or distance in points: 7,702.35 / 2.50. */
export function fmtPrice(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : PRICE_FMT.format(v);
}

export function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "Mon, Oct 26, 4:00 PM ET" for an ISO instant: when a today-only alert stops. */
export function fmtEtDayTime(iso: string | null | undefined, locale = 'en-US'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleString(locale, {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })} ET`;
}

/** "10:15 AM ET" for an ISO instant. */
export function fmtEtTime(iso: string | null | undefined, locale = 'en-US'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleTimeString(locale, {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  })} ET`;
}

// ── Copy ────────────────────────────────────────────────────────────────────

// Every member-visible phrase, as templates with {placeholders}. The English set
// is what email and SMS use; localized UI surfaces pass their own.
export interface WallAlertCopy {
  side: Record<WallSide, string>;
  kind: Record<WallEventKind, string>;
  /** Short, uppercase-friendly label for a chip. */
  kindChip: Record<WallEventKind, string>;
  tier: Record<WallStrengthTier, string>;
  headline: Record<WallEventKind, string>; // {symbol} {side} {wall}
  hitShort: string; // {extreme_label} {price} · {distance} {relation}
  extremeLabel: Record<WallSide, string>; // High / Low
  relationShort: Record<WallSide, string>; // "below the wall" / "above the wall"
  relationPast: string; // "through the wall"
  atWall: string; // "at the wall"
  approachN: string; // {nth} test today
  breakDetail: Record<WallSide, string>; // {n} {level} {last}
  holdDetail: Record<WallSide, string>; // {price} {off} {peak}
  nextWall: Record<WallSide, string>; // {wall}
  strengthLine: string; // {tier} {pctile}
  strengthUnknown: string;
  regime: Record<'positive' | 'negative', string>;
  odds: string; // {symbol} {side} {horizon} {pct}
  /** A test count as an ordinal: 2nd (en), 2° (it), 2. (de). */
  ordinal: (n: number) => string;
  /** A strength percentile: "88th percentile" (en), "percentil 88" (es). */
  percentile: (n: number) => string;
}

export const EN_WALL_ALERT_COPY: WallAlertCopy = {
  side: { call: 'call', put: 'put' },
  kind: { hit: 'Wall hit', break: 'Wall broke', hold: 'Wall held' },
  kindChip: { hit: 'HIT', break: 'BROKE', hold: 'HELD' },
  tier: {
    light: 'Light',
    moderate: 'Moderate',
    above_typical: 'Above typical',
    strong: 'Strong',
    very_strong: 'Very strong',
  },
  headline: {
    hit: '{symbol} {side} wall {wall} hit',
    break: '{symbol} {side} wall {wall} broke',
    hold: '{symbol} {side} wall {wall} held',
  },
  hitShort: '{extreme_label} {price} · {distance} {relation}',
  extremeLabel: { call: 'High', put: 'Low' },
  relationShort: { call: 'below the wall', put: 'above the wall' },
  relationPast: 'through the wall',
  atWall: 'at the wall',
  approachN: '{nth} test today',
  breakDetail: {
    call: '{n} straight 1-min closes above {level} · last {last}',
    put: '{n} straight 1-min closes below {level} · last {last}',
  },
  holdDetail: {
    call: 'Turned back to {price} ({off} off the wall) after peaking at {peak}',
    put: 'Bounced to {price} ({off} off the wall) after a low of {peak}',
  },
  nextWall: { call: 'Next call wall: {wall}', put: 'Next put wall: {wall}' },
  strengthLine: 'Wall strength: {tier} · {pctile} vs. the last 30 days at this time of day',
  strengthUnknown: 'Wall strength not rated yet',
  regime: {
    positive: 'Dealers are long gamma: their hedging leans against moves, so walls tend to hold.',
    negative: 'Dealers are short gamma: their hedging leans with moves, so walls give way more easily.',
  },
  odds: 'History: {symbol} {side} walls broke within {horizon} min of a test {pct} of the time.',
  ordinal: ordinalSuffix,
  percentile: (n) => `${ordinalSuffix(n)} percentile`,
};

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`,
  );
}

export interface FormattedWallAlert {
  headline: string;
  /** The one line that says what price did. */
  detail: string;
  /** Strength, then (where applicable) next wall / test count. */
  facts: string[];
  /** Regime and historical odds — the "why it matters" lines. */
  context: string[];
  kindLabel: string;
  kindChip: string;
  tierLabel: string | null;
  tone: 'info' | 'bull' | 'bear' | 'neutral';
}

/**
 * The words for one alert.
 *
 * ``tone`` is the direction the event points: a call wall breaking or a put
 * wall holding is bullish, the mirror images bearish, a plain hit neutral.
 */
export function formatWallAlert(
  p: WallAlertPayload,
  copy: WallAlertCopy = EN_WALL_ALERT_COPY,
): FormattedWallAlert {
  const side = p.side === 'put' ? 'put' : 'call';
  const kind: WallEventKind = p.kind === 'break' || p.kind === 'hold' ? p.kind : 'hit';
  const headline = fill(copy.headline[kind], {
    symbol: p.symbol,
    side: copy.side[side],
    wall: fmtStrike(p.wall),
  });

  let detail: string;
  if (kind === 'hit') {
    const distance = p.distance ?? (side === 'call' ? p.wall - p.price : p.price - p.wall);
    const relation =
      Math.abs(distance) < 0.005
        ? copy.atWall
        : distance > 0
          ? copy.relationShort[side]
          : copy.relationPast;
    detail =
      Math.abs(distance) < 0.005
        ? `${copy.extremeLabel[side]} ${fmtPrice(p.price)} · ${relation}`
        : fill(copy.hitShort, {
            extreme_label: copy.extremeLabel[side],
            price: fmtPrice(p.price),
            distance: fmtPrice(Math.abs(distance)),
            relation,
          });
  } else if (kind === 'break') {
    const buffer = p.break_buffer ?? 0;
    const level = side === 'call' ? p.wall + buffer : p.wall - buffer;
    detail = fill(copy.breakDetail[side], {
      n: p.confirm_minutes ?? 0,
      level: fmtPrice(level),
      last: fmtPrice(p.last_price ?? p.price),
    });
  } else {
    detail = fill(copy.holdDetail[side], {
      price: fmtPrice(p.price),
      off: fmtPrice(Math.abs(p.wall - p.price)),
      peak: fmtPrice(p.peak ?? p.hit_price ?? p.wall),
    });
  }

  const tier = p.strength_tier ?? strengthTierFor(p.strength_pctile);
  const facts: string[] = [];
  facts.push(
    tier && p.strength_pctile !== null && p.strength_pctile !== undefined
      ? fill(copy.strengthLine, {
          tier: copy.tier[tier],
          tier_lc: copy.tier[tier].toLowerCase(),
          pctile: copy.percentile(Math.round(p.strength_pctile)),
        })
      : copy.strengthUnknown,
  );
  if (kind === 'hit' && p.approach_number && p.approach_number >= 2) {
    facts.push(fill(copy.approachN, { nth: copy.ordinal(p.approach_number) }));
  }
  if (
    kind === 'break' &&
    p.current_wall !== null &&
    p.current_wall !== undefined &&
    Math.abs(p.current_wall - p.wall) > 1e-6
  ) {
    facts.push(fill(copy.nextWall[side], { wall: fmtStrike(p.current_wall) }));
  }

  const context: string[] = [];
  if (p.regime === 'positive' || p.regime === 'negative') context.push(copy.regime[p.regime]);
  if (kind === 'hit' && p.odds && p.odds.length > 0) {
    const sixty = p.odds.find((o) => o.horizon_minutes === 60) ?? p.odds[p.odds.length - 1];
    if (sixty && Number.isFinite(sixty.break_prob)) {
      context.push(
        fill(copy.odds, {
          symbol: p.symbol,
          side: copy.side[side],
          horizon: sixty.horizon_minutes,
          pct: `${Math.round(sixty.break_prob * 100)}%`,
        }),
      );
    }
  }

  const tone: FormattedWallAlert['tone'] =
    kind === 'hit'
      ? 'info'
      : (kind === 'break') === (side === 'call')
        ? 'bull'
        : 'bear';

  return {
    headline,
    detail,
    facts,
    context,
    kindLabel: copy.kind[kind],
    kindChip: copy.kindChip[kind],
    tierLabel: tier ? copy.tier[tier] : null,
    tone,
  };
}

// ── SMS ─────────────────────────────────────────────────────────────────────

export const SMS_MAX_LENGTH = 160;

/**
 * One SMS for one alert, never longer than a single 160-character segment.
 *
 * GSM-7 only (no em dash, no curly quotes): a single non-GSM character makes
 * the carrier fall back to UCS-2 and halves the segment to 70 characters.
 * The detail is dropped before the headline ever is.
 */
export function wallAlertSmsText(p: WallAlertPayload, link = 'zerogex.io/alerts'): string {
  const f = formatWallAlert(p);
  const tier = f.tierLabel ? ` (${f.tierLabel})` : '';
  const ascii = (s: string) => s.replace(/·/g, '-').replace(/[^\x20-\x7E]/g, '');
  const tail = ` ${link} STOP=opt out`;
  const full = ascii(`ZeroGEX: ${f.headline}${tier}. ${f.detail}.${tail}`);
  if (full.length <= SMS_MAX_LENGTH) return full;
  const short = ascii(`ZeroGEX: ${f.headline}${tier}.${tail}`);
  if (short.length <= SMS_MAX_LENGTH) return short;
  return short.slice(0, SMS_MAX_LENGTH);
}

// ── Touch tolerance ─────────────────────────────────────────────────────────
//
// How close price must come for a hit to count, in basis points of the wall
// (1 = 0.01%). A rule either leaves it on Auto (null: the noise filter's own
// band) or picks one of the options the API serves in /config. These
// constants are the fallback while that loads; the detector is the authority
// (zerogex-oa src/alerts/wall_detector.py PROFILES, config.TOUCH_OPTIONS_BP).

export const TOUCH_OPTIONS_BP: readonly number[] = [1, 5, 10, 25];

/** Each noise filter's own touch band (bp): what "Auto" means. */
export const PROFILE_TOUCH_BP: Record<WallProfile, number> = {
  responsive: 8,
  balanced: 5,
  conservative: 3,
};

const INDEX_SYMBOLS = new Set(['SPX', 'NDX']);

/** The tolerance a rule actually runs at. */
export function effectiveTouchBp(
  profile: WallProfile,
  touchBp: number | null | undefined,
  profiles?: readonly WallAlertProfileConfig[] | null,
): number {
  if (typeof touchBp === 'number') return touchBp;
  const configured = profiles?.find((p) => p.name === profile)?.touch_bp;
  return typeof configured === 'number' ? configured : PROFILE_TOUCH_BP[profile];
}

/** 5 → "0.05%". */
export function fmtTouchPct(bp: number): string {
  return `${(bp / 100).toFixed(2)}%`;
}

/**
 * The touch band in price terms on a given wall: dollars on the ETFs, index
 * points on SPX / NDX. "$0.39" on a 772 SPY wall at 5 bp; "3.9" (points) on
 * a 7,700 SPX wall.
 */
export function touchAmount(symbol: string, wall: number, bp: number): { text: string; points: boolean } {
  const value = (Math.abs(wall) * bp) / 10_000;
  if (INDEX_SYMBOLS.has(symbol.toUpperCase())) {
    return { text: value.toFixed(value < 10 ? 1 : 0), points: true };
  }
  return { text: `$${value.toFixed(2)}`, points: false };
}

// ── Rules ───────────────────────────────────────────────────────────────────

export const DEFAULT_RULE_INPUT: WallAlertRuleInput = {
  symbol: 'SPX',
  side: 'both',
  events: { hit: true, break: true, hold: false },
  min_strength_pctile: 0,
  profile: 'balanced',
  touch_bp: null,
  channels: { in_app: true, email: false, sms: false },
  enabled: true,
  today_only: false,
};

/** Normalize a rule as the API returns it into the form's shape. */
export function ruleToInput(rule: WallAlertRule): WallAlertRuleInput {
  return {
    symbol: rule.symbol,
    side: rule.side,
    events: { hit: !!rule.events?.hit, break: !!rule.events?.break, hold: !!rule.events?.hold },
    min_strength_pctile: Number(rule.min_strength_pctile) || 0,
    profile: rule.profile,
    touch_bp: typeof rule.touch_bp === 'number' ? rule.touch_bp : null,
    channels: {
      in_app: !!rule.channels?.in_app,
      email: !!rule.channels?.email,
      sms: !!rule.channels?.sms,
    },
    enabled: rule.enabled !== false,
    today_only: rule.today_only === true,
  };
}

/** Client-side mirror of the API's checks, so the form can explain before it posts. */
export function ruleInputProblem(input: WallAlertRuleInput): 'events' | 'channels' | null {
  if (!WALL_EVENT_KINDS.some((k) => input.events[k])) return 'events';
  if (!WALL_CHANNELS.some((c) => input.channels[c])) return 'channels';
  return null;
}
