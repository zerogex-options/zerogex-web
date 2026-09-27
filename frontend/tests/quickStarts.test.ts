import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HAS_LIVE_QUICK_STARTS,
  QUICK_START_TRACKS,
  liveQuickStartTracks,
  type Track,
} from '../core/quickStarts.ts';

// Nothing on /help/quickstarts, the Help menu or the Help Center may point at a
// video that does not exist. liveQuickStartTracks is the single filter all
// three read, so lock down what it lets through.

const tracks: Track[] = [
  {
    id: 'onboarding',
    title: 'Onboarding',
    blurb: '',
    walkthroughs: [
      { id: 'a', title: 'A', blurb: '', duration: '1:00', level: 'New trader', tag: 'x', status: 'live', href: '/v/a' },
      { id: 'b', title: 'B', blurb: '', duration: '1:00', level: 'New trader', tag: 'x', status: 'coming-soon' },
      // Marked live but never given a link: must not render a card with nothing to watch.
      { id: 'c', title: 'C', blurb: '', duration: '1:00', level: 'New trader', tag: 'x', status: 'live' },
    ],
  },
  {
    id: 'api',
    title: 'API',
    blurb: '',
    walkthroughs: [
      { id: 'd', title: 'D', blurb: '', duration: '1:00', level: 'Advanced', tag: 'x', status: 'coming-soon' },
    ],
  },
];

test('liveQuickStartTracks keeps only published walkthroughs and drops empty tracks', () => {
  const live = liveQuickStartTracks(tracks);
  assert.deepEqual(
    live.map((t) => [t.id, t.walkthroughs.map((w) => w.id)]),
    [['onboarding', ['a']]],
  );
});

test('the flag matches the real library', () => {
  const anyLive = QUICK_START_TRACKS.some((t) =>
    t.walkthroughs.some((w) => w.status === 'live' && !!w.href),
  );
  assert.equal(HAS_LIVE_QUICK_STARTS, anyLive);
});
