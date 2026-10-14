// The Session picker on Flow Analysis and Smart Money: which days it offers
// and how each choice is sent to the API.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  flowSessionDateKey,
  flowSessionOptions,
  flowSessionQuery,
  isClosedFlowSession,
} from '../core/flowSessions.ts';

const DAYS = ['2026-10-14', '2026-10-13', '2026-10-12', '2026-10-09'];

test('the newest listed day is the live session; older days are offered by date', () => {
  assert.deepEqual(flowSessionOptions(DAYS, 'current'), [
    { value: 'current', label: 'Current (2026-10-14)' },
    { value: '2026-10-13', label: 'Tue 2026-10-13' },
    { value: '2026-10-12', label: 'Mon 2026-10-12' },
    { value: '2026-10-09', label: 'Fri 2026-10-09' },
  ]);
});

test('without the list the picker falls back to Current / Prior', () => {
  assert.deepEqual(flowSessionOptions(null, 'current', '2026-10-14'), [
    { value: 'current', label: 'Current (2026-10-14)' },
    { value: 'prior', label: 'Prior' },
  ]);
});

test('a pick the list no longer carries stays selectable', () => {
  const options = flowSessionOptions(DAYS, '2026-10-01');
  assert.deepEqual(options.at(-1), { value: '2026-10-01', label: 'Thu 2026-10-01' });
});

test('dates go to the API as date=, session names as session=', () => {
  assert.equal(flowSessionQuery('current'), 'session=current');
  assert.equal(flowSessionQuery('prior'), 'session=prior');
  assert.equal(flowSessionQuery('2026-10-12'), 'date=2026-10-12');
});

test('only a dated session before today is closed', () => {
  assert.equal(isClosedFlowSession('2026-10-13', '2026-10-14'), true);
  assert.equal(isClosedFlowSession('2026-10-14', '2026-10-14'), false);
  assert.equal(isClosedFlowSession('current', '2026-10-14'), false);
  assert.equal(isClosedFlowSession('prior', '2026-10-14'), false);
});

test('the date a selection reads', () => {
  assert.equal(flowSessionDateKey('current', DAYS), '2026-10-14');
  assert.equal(flowSessionDateKey('current', null), null);
  assert.equal(flowSessionDateKey('2026-10-12', null), '2026-10-12');
  assert.equal(flowSessionDateKey('prior', DAYS), null);
});
