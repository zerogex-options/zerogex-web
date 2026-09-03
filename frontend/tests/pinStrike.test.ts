// Unit tests for the Pin Strike presentation helpers. Pin Strike is a
// distinct dealer-positioning metric (the reachable 0DTE strike with the
// strongest modeled positive/restoring dealer gamma into expiration); these
// cover the tile value formatting, the confidence-derived strength label, and
// — most importantly — the empty state, which must render a dash and never
// `0` / `NaN` / a misleading fallback strike.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyPinStrength,
  formatPinStrike,
  pinLineLabel,
  pinStrikeSubtitle,
  pinStrengthLabel,
  pinStabilityNote,
  PIN_STRIKE_EMPTY,
  PIN_STRENGTH_STRONG_MIN_CONFIDENCE,
  PIN_STRENGTH_MODERATE_MIN_CONFIDENCE,
} from '../core/pinStrike.ts';

test('formatPinStrike renders a dollar strike for an active pin', () => {
  assert.equal(formatPinStrike(775), '$775.00');
  assert.equal(formatPinStrike(6012.5), '$6012.50');
});

test('formatPinStrike renders the em-dash empty state, never 0/NaN', () => {
  assert.equal(formatPinStrike(null), PIN_STRIKE_EMPTY);
  assert.equal(formatPinStrike(undefined), PIN_STRIKE_EMPTY);
  assert.equal(formatPinStrike(NaN), PIN_STRIKE_EMPTY);
  // A non-positive strike is not a real pin; it must render as empty, never
  // "$0.00" (the spec's "do not display 0" rule).
  assert.equal(formatPinStrike(0), PIN_STRIKE_EMPTY);
  assert.equal(formatPinStrike(-5), PIN_STRIKE_EMPTY);
});

test('classifyPinStrength buckets on confidence and returns none when no pin', () => {
  assert.equal(classifyPinStrength(775, PIN_STRENGTH_STRONG_MIN_CONFIDENCE), 'strong');
  assert.equal(classifyPinStrength(775, PIN_STRENGTH_STRONG_MIN_CONFIDENCE - 0.01), 'moderate');
  assert.equal(classifyPinStrength(775, PIN_STRENGTH_MODERATE_MIN_CONFIDENCE), 'moderate');
  assert.equal(classifyPinStrength(775, PIN_STRENGTH_MODERATE_MIN_CONFIDENCE - 0.01), 'weak');
  assert.equal(classifyPinStrength(775, 0), 'weak');
  // No strike ⇒ none regardless of confidence.
  assert.equal(classifyPinStrength(null, 0.99), 'none');
  assert.equal(classifyPinStrength(undefined, 0.99), 'none');
});

test('pinStrengthLabel maps buckets to human labels', () => {
  assert.equal(pinStrengthLabel('none'), 'No active pin');
  assert.equal(pinStrengthLabel('weak'), 'Weak');
  assert.equal(pinStrengthLabel('moderate'), 'Moderate');
  assert.equal(pinStrengthLabel('strong'), 'Strong');
});

test('pinStrikeSubtitle shows strength + confidence for an active pin', () => {
  assert.equal(pinStrikeSubtitle(775, 0.62), 'Pin strength: Strong · 62%');
  assert.equal(pinStrikeSubtitle(775, 0.4), 'Pin strength: Moderate · 40%');
  assert.equal(pinStrikeSubtitle(775, 0.2), 'Pin strength: Weak · 20%');
});

test('pinStrikeSubtitle degrades gracefully with no confidence', () => {
  assert.equal(pinStrikeSubtitle(775, null), 'Pin strength: Weak');
});

test('pinStrikeSubtitle shows the no-pin state when there is no strike', () => {
  assert.equal(pinStrikeSubtitle(null, null), 'No active pin');
  assert.equal(pinStrikeSubtitle(undefined, 0.9), 'No active pin');
});

// pinLineLabel is what the Daily Replay chart's pin line and the Gamma
// Terminal chart's PIN tag are both built from — the level must not be named
// two different things on two charts showing the same minute.
test('pinLineLabel qualifies the line with the pin strength', () => {
  assert.equal(pinLineLabel(775, 0.62), 'Pin · Strong');
  assert.equal(pinLineLabel(775, 0.4), 'Pin · Moderate');
  assert.equal(pinLineLabel(775, 0.2), 'Pin · Weak');
});

test('pinLineLabel falls back to a bare "Pin" when there is no pin', () => {
  // A missing confidence reads as Weak rather than as unqualified — the same
  // answer pinStrikeSubtitle already gives the tiles, so one pin cannot read
  // two ways depending on which surface you are looking at.
  assert.equal(pinLineLabel(775, null), 'Pin · Weak');
  // The bare "Pin" is reserved for having no pin to qualify at all.
  assert.equal(pinLineLabel(null, 0.9), 'Pin');
  assert.equal(pinLineLabel(undefined, undefined), 'Pin');
  // Never a "$0" pin, and so never a strength claimed for one.
  assert.equal(pinLineLabel(0, 0.9), 'Pin');
});

test('pinLineLabel upper-cases into the Gamma Terminal chart tag', () => {
  // That chart's level tags are caps; it upper-cases this result rather than
  // composing its own wording.
  assert.equal(pinLineLabel(775, 0.62).toUpperCase(), 'PIN · STRONG');
  assert.equal(pinLineLabel(null, null).toUpperCase(), 'PIN');
});

// ---------------------------------------------------------------------------
// Pin stability — what the pin has DONE this session
// ---------------------------------------------------------------------------

test('pinStabilityNote reports a settled pin by the time it took hold', () => {
  // 13:41Z is 09:41 ET — the session-open read.
  assert.equal(
    pinStabilityNote({
      held_pin: 7730,
      held_since: '2026-08-31T13:41:00Z',
      net_migration: 0,
      distinct_values: 1,
      current_established: true,
    }),
    'Held since 09:41',
  );
});

test('pinStabilityNote leads with the signed move once the pin has migrated', () => {
  // The session Andres described: the pin walked 30 points DOWN with the tape.
  // The distance is the fact a trader watching the level leave needs first, so
  // it comes before the hold time rather than after it.
  assert.equal(
    pinStabilityNote({
      held_pin: 7700,
      held_since: '2026-08-31T18:05:00Z',
      net_migration: -30,
      distinct_values: 3,
      current_established: true,
    }),
    '\u221230 pts today \u00b7 held since 14:05',
  );
  assert.equal(
    pinStabilityNote({
      held_pin: 7712.5,
      held_since: '2026-08-31T18:05:00Z',
      net_migration: 12.5,
      distinct_values: 2,
      current_established: true,
    }),
    '+12.50 pts today \u00b7 held since 14:05',
  );
});

test('pinStabilityNote treats a zero net move as held even across strikes', () => {
  // A pin that left 7730 and came back has traveled nowhere on net, and
  // "0 pts today" would be a distinction without a difference.
  assert.equal(
    pinStabilityNote({
      held_pin: 7730,
      held_since: '2026-08-31T13:41:00Z',
      net_migration: 0,
      distinct_values: 3,
      current_established: true,
    }),
    'Held since 09:41',
  );
});

test('pinStabilityNote names the settled strike while the current pin is provisional', () => {
  // The live SPX case: 7675 all session, one 7670 print at the bell. The card's
  // headline value is 7670, so a bare "Held since 09:30" would read as if 7670
  // had held all day. Naming the settled strike keeps the two apart, and no
  // migration is claimed for a tick that has not settled.
  assert.equal(
    pinStabilityNote({
      held_pin: 7675,
      held_since: '2026-09-02T13:30:00Z',
      net_migration: 0,
      distinct_values: 1,
      current_established: false,
    }),
    'Held 7675 since 09:30',
  );
});

test('pinStabilityNote renders nothing rather than a zeroed line', () => {
  assert.equal(pinStabilityNote(null), null);
  assert.equal(pinStabilityNote(undefined), null);
  assert.equal(
    pinStabilityNote({
      held_pin: 7675,
      held_since: 'not-a-timestamp',
      net_migration: -30,
      distinct_values: 2,
      current_established: true,
    }),
    null,
  );
});
