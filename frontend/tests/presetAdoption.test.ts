import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';

import {
  notePresetApplied,
  reportPresetRetention,
  __presetAdoptionInternals,
} from '../core/presetAdoption.ts';

const { STORAGE_KEY } = __presetAdoptionInternals;

// Minimal localStorage stand-in; the module is browser-only by design.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

function setToday(iso: string) {
  const fixed = new Date(`${iso}T12:00:00Z`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Date = class extends Date {
    // `new Date()` is the call under test — presetAdoption reads today off it,
    // so with no arguments this must read as `iso`. Every OTHER form has to
    // forward unchanged: setToday builds the next fixed date from a string
    // while this stub is already the global Date, so a pass-through that
    // dropped its argument would silently freeze the clock at the first date
    // the suite ever set.
    //
    // Forwarded per arity rather than by spreading `unknown[]` into `super`:
    // none of Date's overloads takes an array, so an untyped spread is a
    // compile error (TS2556) that only `tsc` sees — the test runner strips
    // types and runs it regardless, which is how it went unnoticed.
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixed);
      } else if (args.length === 1) {
        super(args[0] as string | number | Date);
      } else {
        super(...(args as [number, number, number?, number?, number?, number?, number?]));
      }
    }
    static now() { return fixed.getTime(); }
  } as DateConstructor;
}

const RealDate = Date;

beforeEach(() => {
  globalThis.Date = RealDate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = { localStorage: new MemoryStorage() };
});

test('the day a preset is applied reports nothing', () => {
  setToday('2026-09-14');
  notePresetApplied('0dte-intraday', 'user-1');
  assert.equal(reportPresetRetention('user-1', false), null);
});

test('a later day with a live board reports retention once', () => {
  setToday('2026-09-14');
  notePresetApplied('0dte-intraday', 'user-1');

  setToday('2026-09-17');
  const first = reportPresetRetention('user-1', false);
  assert.deepEqual(first, {
    preset: '0dte-intraday',
    days_since_applied: 3,
    modified: false,
  });

  // Same day again -> already reported.
  assert.equal(reportPresetRetention('user-1', false), null);
});

test('an emptied board is abandonment, not retention', () => {
  setToday('2026-09-14');
  notePresetApplied('0dte-intraday', 'user-1');

  setToday('2026-09-17');
  assert.equal(reportPresetRetention('user-1', true), null);
  // The stamp is gone, so a later non-empty board cannot resurrect it.
  setToday('2026-09-18');
  assert.equal(reportPresetRetention('user-1', false), null);
});

test('scopes do not leak into one another', () => {
  setToday('2026-09-14');
  notePresetApplied('0dte-intraday', 'user-1');
  setToday('2026-09-16');
  assert.equal(reportPresetRetention('user-2', false), null);
  assert.ok(reportPresetRetention('user-1', false));
});

test('no stamp means nothing to report', () => {
  setToday('2026-09-14');
  assert.equal(reportPresetRetention('user-1', false), null);
});

test('corrupt storage degrades to silence rather than throwing', () => {
  setToday('2026-09-14');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window.localStorage.setItem(STORAGE_KEY, '{not json');
  assert.equal(reportPresetRetention('user-1', false), null);
  assert.doesNotThrow(() => notePresetApplied('0dte-intraday', 'user-1'));
});
