import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { chartSessionLabel } from '../core/chartSessionLabel.ts';

// The Gamma Chart's session chip used to match "pre"/"premarket" while the API
// sends "pre-market", so extended hours fell through to a gray chip spelling
// the raw value. These tests read the session union the API is typed against
// (core/types.ts) and require every value to have a chip of its own.

const CORAL = 'var(--color-brand-coral)';

test('every session the API sends has its own chip, not the fallback', () => {
  const types = readFileSync(new URL('../core/types.ts', import.meta.url), 'utf8');
  const union = types.slice(types.indexOf('export type MarketSession'), types.indexOf(';', types.indexOf('export type MarketSession')));
  const sessions = [...union.matchAll(/\|\s*'([a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(sessions.includes('pre-market') && sessions.includes('after-hours'), `parsed ${sessions.join(', ')}`);
  for (const session of sessions) {
    const chip = chartSessionLabel(session);
    assert.ok(chip, session);
    assert.notEqual(chip.color, 'var(--text-secondary)', `${session} fell through to the fallback chip`);
  }
});

test('extended hours read as pre-market and after hours, in the app-wide session coral', () => {
  assert.deepEqual(chartSessionLabel('pre-market'), { label: '○ PRE-MARKET', color: CORAL });
  assert.deepEqual(chartSessionLabel('after-hours'), { label: '○ AFTER HOURS', color: CORAL });
  // Older spellings still map the same way.
  assert.equal(chartSessionLabel('premarket')?.label, '○ PRE-MARKET');
  assert.equal(chartSessionLabel('post')?.label, '○ AFTER HOURS');
});

test('the regular session is live and every closed state reads CLOSED', () => {
  assert.equal(chartSessionLabel('open')?.label, '● LIVE');
  for (const s of ['closed', 'closed-weekend', 'closed-holiday']) assert.equal(chartSessionLabel(s)?.label, 'CLOSED', s);
});

test('no session means no chip', () => {
  assert.equal(chartSessionLabel(null), null);
  assert.equal(chartSessionLabel(undefined), null);
  assert.equal(chartSessionLabel(''), null);
});
