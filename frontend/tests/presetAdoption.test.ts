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
    constructor(...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      super(...(args.length ? (args as any) : [fixed]));
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
