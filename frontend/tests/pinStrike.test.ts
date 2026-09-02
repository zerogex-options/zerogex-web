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
