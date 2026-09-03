import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSignalAvailability,
  type SignalAvailabilityInput,
} from '../core/signalAvailability.ts';

// This resolver exists because a tier-gated signal panel with nothing in it
// used to render one undifferentiated "N/A" for five unrelated causes. A Basic
// viewer on Dealer Positioning saw the Pro-only vol-expansion row as "N/A — No
// expansion signal available", read it as broken, and filed a support ticket
// against a feature working exactly as specified — while the identical cell is
// what a real outage would produce. Lock the mapping down: a wrong answer here
// either hides a paywall (lost upgrade, wasted support round-trip) or dresses
// an outage up as a paywall (nobody investigates).

const BASE: SignalAvailabilityInput = {
  entitled: true,
  tierResolving: false,
  hasValue: false,
  loading: false,
  hasError: false,
  errorStatus: null,
  requiredTier: 'pro',
};

const resolve = (over: Partial<SignalAvailabilityInput> = {}) =>
  resolveSignalAvailability({ ...BASE, ...over });

test('a value on hand wins over every failure state', () => {
  // A refresh that 403s or 500s must not blank a reading already on screen.
  assert.equal(resolve({ hasValue: true }).kind, 'ready');
  assert.equal(resolve({ hasValue: true, hasError: true, errorStatus: 500 }).kind, 'ready');
  assert.equal(resolve({ hasValue: true, entitled: false }).kind, 'ready');
  assert.equal(resolve({ hasValue: true, tierResolving: true }).kind, 'ready');
});

test('an unresolved session reports resolving, never locked', () => {
  // The flash fix. useHasTierAccess is fail-closed and reads false until the
  // session lands, so deriving the LABEL from it told every Pro member to
  // upgrade on first paint — and forever if /api/auth/session failed.
  assert.equal(resolve({ entitled: false, tierResolving: true }).kind, 'resolving');
  assert.equal(resolve({ entitled: true, tierResolving: true }).kind, 'resolving');
});

test('the reported bug: a Basic viewer whose request never fires reads as locked', () => {
  // `enabled: hasProAccess` means no request at all, so there is no status to
  // read — just absence. That absence must resolve to the upsell, which is the
  // whole point of the fix.
  const state = resolve({ entitled: false, loading: false, hasError: false });
  assert.equal(state.kind, 'locked');
  assert.equal(state.kind === 'locked' && state.requiredTier, 'pro');
});

test('a 403 locks even when the client believed it was entitled', () => {
  // The BFF is the authority. A session that outlived a downgrade should see
  // the upsell rather than a hard error.
  const state = resolve({ entitled: true, hasError: true, errorStatus: 403 });
  assert.equal(state.kind, 'locked');
});

test('404 is a coverage fact, not a fault', () => {
  assert.equal(resolve({ hasError: true, errorStatus: 404 }).kind, 'unsupported');
});

test('a real failure looks like a failure', () => {
  // The case that used to hide behind "N/A" — if the signal engine stops
  // writing rows, Pro users must not see the same cell a paywall produces.
  assert.equal(resolve({ hasError: true, errorStatus: 500 }).kind, 'error');
  assert.equal(resolve({ hasError: true, errorStatus: 502 }).kind, 'error');
  // Transport failure: no response, so no status to read.
  assert.equal(resolve({ hasError: true, errorStatus: null }).kind, 'error');
});

test('an entitled viewer mid-flight is resolving, not empty', () => {
  assert.equal(resolve({ loading: true }).kind, 'resolving');
});

test('entitled, settled and genuinely empty stays ready', () => {
  // The one case the original bare "N/A" was right about: the request path is
  // healthy and the backend simply had no reading. The caller renders its own
  // empty copy for this.
  assert.equal(resolve().kind, 'ready');
});

test('errorStatus is ignored unless a request actually failed', () => {
  // Guards against a stale status from a previous attempt being read as the
  // current state.
  assert.equal(resolve({ hasError: false, errorStatus: 403 }).kind, 'ready');
  assert.equal(resolve({ hasError: false, errorStatus: 404 }).kind, 'ready');
});

test('requiredTier is carried through so the UI can name the plan', () => {
  const state = resolveSignalAvailability({ ...BASE, entitled: false, requiredTier: 'basic' });
  assert.equal(state.kind === 'locked' && state.requiredTier, 'basic');
});
