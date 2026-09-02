// Fill today's levels into the thinkScript study before handing it over.
//
// thinkScript cannot fetch anything (see docs/thinkorswim-indicator.md), so the
// study has always been manual-entry: paste it once, then type four numbers
// into its settings. Typing four numbers is the part people actually drop out
// on, and it is also the part they have to redo every morning.
//
// Every vendor who ships GEX levels to thinkorswim solves this the same way —
// generate the script with the numbers already in it and have the user paste
// the whole thing again each day. That is strictly less work than typing, and
// it is the only automation the platform allows. This module is that generator.
//
// It rewrites the `input` DEFAULTS in the tracked template rather than
// assembling a second copy of the script, so there is still exactly one source
// of record (frontend/public/thinkorswim/zerogex-daily-gamma-levels.thinkscript)
// and a filled study cannot drift from the blank one.

/** The four drawable levels, as the study's inputs expect them. */
export interface ThinkorswimLevels {
  /** Ticker the levels belong to, e.g. "SPX". Shown in the study's chart label. */
  symbol: string;
  gammaFlip?: number | null;
  callWall?: number | null;
  putWall?: number | null;
  maxPain?: number | null;
  /** Snapshot time (ISO). Rendered as an ET date in the study's label. */
  asOf?: string | null;
}

/**
 * Format a level as a thinkScript double literal.
 *
 * Always emits a decimal point, and that is not cosmetic: thinkScript infers an
 * input's TYPE from its default, so `input callWall = 6100;` produces an
 * integer input that then refuses a fractional value when the user edits it.
 * `6100.0` keeps it a double. Returns null for anything unusable, which the
 * caller leaves at the template's `0.0` — the study's "hide this level"
 * sentinel, and the right outcome for a level the engine could not resolve.
 */
export function formatLevel(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  // Four decimals is past the tick size of anything we publish levels for;
  // trailing zeros are then trimmed so a round strike reads as "6100.0"
  // rather than "6100.0000".
  const fixed = value.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '.0');
  return fixed.includes('.') ? fixed : `${fixed}.0`;
}

/** The snapshot date, as ET, for the study's label. Market data is ET-dated. */
export function formatLevelsDate(asOf: string | null | undefined): string | null {
  if (!asOf) return null;
  const parsed = new Date(asOf);
  if (Number.isNaN(parsed.getTime())) return null;
  // en-CA gives YYYY-MM-DD, which sorts and reads unambiguously for a label
  // that will be looked at next to a chart in any locale.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

/**
 * Replace the default of one `input` declaration.
 *
 * Anchored to the start of a line and to the declaration's terminating
 * semicolon, so it cannot match the word inside a comment or a string. Throws
 * when the input is absent, because a silent miss ships a study that claims to
 * carry today's levels and is actually blank — the failure the caller cannot
 * see and the user discovers on their chart. tests/thinkorswimStudy.test.ts
 * runs this against the real template so a rename there fails in CI.
 */
export function setInputDefault(source: string, name: string, literal: string): string {
  const pattern = new RegExp(`^(\\s*input\\s+${name}\\s*=\\s*)([^;]*)(;)`, 'm');
  if (!pattern.test(source)) {
    throw new Error(`thinkScript template has no "input ${name}" to fill`);
  }
  return source.replace(pattern, `$1${literal}$3`);
}

/** Every input this module writes. Exported so the test can assert the
 *  template still declares all of them. */
export const FILLED_INPUTS = [
  'callWall',
  'gammaFlip',
  'putWall',
  'maxPain',
  'levelsFor',
  'levelsDate',
  'showLevelsDate',
] as const;

/**
 * Return the study source with today's levels written into its inputs.
 *
 * A level that is null, zero or unparseable is left at the template's `0.0`,
 * which the study renders as nothing at all — so a partial snapshot yields a
 * study that draws what it has rather than a line at zero.
 */
export function fillThinkScriptLevels(template: string, levels: ThinkorswimLevels): string {
  let source = template;

  const numeric: ReadonlyArray<readonly [string, number | null | undefined]> = [
    ['callWall', levels.callWall],
    ['gammaFlip', levels.gammaFlip],
    ['putWall', levels.putWall],
    ['maxPain', levels.maxPain],
  ];
  for (const [name, value] of numeric) {
    const literal = formatLevel(value);
    if (literal !== null) source = setInputDefault(source, name, literal);
  }

  // JSON.stringify rather than a hand-built quoted string: it escapes anything
  // that would otherwise terminate the thinkScript string literal early. The
  // symbol is ours, but this function is the only thing standing between an
  // upstream field and a file the user pastes into an editor.
  source = setInputDefault(source, 'levelsFor', JSON.stringify(String(levels.symbol)));

  const date = formatLevelsDate(levels.asOf);
  if (date !== null) {
    source = setInputDefault(source, 'levelsDate', JSON.stringify(date));
    // Only turned on when there is a date to show — otherwise the study would
    // render a "Levels:" chip with nothing after it.
    source = setInputDefault(source, 'showLevelsDate', 'yes');
  }

  return source;
}

/** True when there is at least one level worth pre-filling. Below this the
 *  page should offer the blank template and say so, rather than promising
 *  "today's levels" and handing over four zeros. */
export function hasAnyLevel(levels: ThinkorswimLevels | null | undefined): boolean {
  if (!levels) return false;
  return [levels.gammaFlip, levels.callWall, levels.putWall, levels.maxPain].some(
    (value) => formatLevel(value) !== null,
  );
}
