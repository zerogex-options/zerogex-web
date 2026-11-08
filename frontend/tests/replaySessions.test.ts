// Replay sessions whose per-strike detail has aged out say so, on the /replay
// card and on the session's own page, and nothing else changes.
//
// gex_by_strike is deleted after about 60 days while the gex_summary rows the
// list is built from are kept, so the oldest listed sessions replay the levels
// over an empty strike profile. Seen on 2026-11-07: /replay?symbol=ES listed
// Aug 14 to Nov 6, and every session before Sep 8 had no strike profile under
// a "Full session" label.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  STRIKE_RETENTION_HREF,
  replaySessionStatus,
  strikesAgedOut,
} from '../core/replaySessions.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('a session with its strike detail is labeled exactly as before', () => {
  for (const hasStrikes of [true, undefined, null]) {
    assert.deepEqual(replaySessionStatus(390, hasStrikes), { label: 'Full session', tone: 'full' });
    assert.deepEqual(replaySessionStatus(380, hasStrikes), { label: 'Full session', tone: 'full' });
    assert.deepEqual(replaySessionStatus(379, hasStrikes), { label: 'Partial', tone: 'partial' });
    assert.deepEqual(replaySessionStatus(120, hasStrikes), { label: 'Partial', tone: 'partial' });
    assert.deepEqual(replaySessionStatus(119, hasStrikes), { label: 'Thin', tone: 'thin' });
  }
});

test('only an explicit false marks a session as levels only', () => {
  assert.deepEqual(replaySessionStatus(390, false), { label: 'Levels only', tone: 'levels' });
  assert.deepEqual(replaySessionStatus(95, false), { label: 'Levels only', tone: 'levels' });
  // An API from before the field, or one that could not check, must not
  // relabel a session: that would call a recent session's strikes gone.
  assert.equal(strikesAgedOut(false), true);
  assert.equal(strikesAgedOut(true), false);
  assert.equal(strikesAgedOut(null), false);
  assert.equal(strikesAgedOut(undefined), false);
});

test('the retention link lands on the Historical depth section', () => {
  assert.equal(STRIKE_RETENTION_HREF, '/help/platform/data-coverage#historical-depth');
  const help = read('../content/help/platform/data-coverage.md');
  assert.match(help, /^## Historical depth$/m);
  // The pages say "about 60 days" because the help page does.
  assert.match(help, /per-strike GEX, and contract-level flow are kept for a rolling window of about 60 days/);
});

test('the /replay list labels aged-out sessions and no longer overstates its depth', () => {
  const page = read('../app/replay/page.tsx');
  const card = read('../app/replay/SessionCard.tsx');
  assert.match(page, /replaySessionStatus\(session\.bar_count, session\.has_strikes\)/);
  assert.match(page, /note=\{agedOut \? 'strike detail aged out' : undefined\}/);
  assert.match(card, /\{barCount\} bars\{note \? <> · \{note\}<\/> : null\}/);
  // The sentence that claimed every snapshot in the list was replayable.
  assert.ok(!page.includes('Every per-minute dealer gamma snapshot'));
  assert.match(page, /per-strike GEX\s+is\{' '\}\s+<Link href=\{STRIKE_RETENTION_HREF\}/);
  assert.match(page, />\s+kept for about 60 days\s+<\/Link>/);
});

test('an aged-out session page says so, under every scope', () => {
  const page = read('../app/replay/[symbol]/[date]/page.tsx');
  const scrubber = read('../app/replay/[symbol]/[date]/ReplayScrubber.tsx');
  assert.match(page, /const agedOut = strikesAgedOut\(data\.has_strikes\);/);
  assert.match(page, /Per-strike GEX for this session has aged out/);
  assert.match(page, /strikesAgedOut=\{agedOut\}/);
  // Under 0DTE / Fri an aged-out session's ladders are empty too, and the old
  // note blamed the session for having no such book. It must not fire then.
  assert.match(scrubber, /!strikesAgedOut &&\s+scope !== 'all' &&\s+frames\.length > 0/);
  assert.match(scrubber, /\{scope !== 'all' && strikesAgedOut && \(/);
  assert.match(scrubber, /\{scope !== 'all' && !scopeHasNoContracts && !strikesAgedOut && \(/);
});
