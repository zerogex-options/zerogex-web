import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The gamma ladder carries two crowns, drawn whatever the Expiry filter shows:
// teal (the same-day Pin Strike's color) on the heaviest strike in view from
// today's expiration, violet (the GEX King's color) on the heaviest across all
// expirations. See core/crownScope.ts.

const {
  ladderExpiryScope,
  crownFeedsNeeded,
  crownSources,
  pickCrowns,
  crownColor,
  crownScopeShort,
  crownLabel,
  crownKeyTitle,
  CROWN_SCOPES,
  CROWN_TODAY_COLOR,
  CROWN_WIDER_COLOR,
} = await import('../core/crownScope.ts');

const TODAY = '2026-11-17';
const TOMORROW = '2026-11-18';
const FRIDAY = '2026-11-20';

// ── The rows' scope ─────────────────────────────────────────────────────────

test('an empty selection is the whole chain', () => {
  assert.equal(ladderExpiryScope([], TODAY), 'all');
});

test("today's expiration alone is today, whether reconciled or still the rolling token", () => {
  assert.equal(ladderExpiryScope([TODAY], TODAY), 'today');
  assert.equal(ladderExpiryScope(['0DTE'], TODAY), 'today');
});

test('any other selection is a selection, including one that contains today', () => {
  assert.equal(ladderExpiryScope([TOMORROW], TODAY), 'selected');
  assert.equal(ladderExpiryScope([FRIDAY], TODAY), 'selected');
  assert.equal(ladderExpiryScope([TODAY, FRIDAY], TODAY), 'selected');
  assert.equal(ladderExpiryScope(['0DTE', FRIDAY], TODAY), 'selected');
});

test("yesterday's date is not today once the ET date rolls", () => {
  assert.equal(ladderExpiryScope([TODAY], TOMORROW), 'selected');
});

// ── Which crowns need their own read ────────────────────────────────────────

test('the rows serve the crown that shares their scope; the other gets its own read', () => {
  assert.deepEqual(crownFeedsNeeded('all', true, false), { today: true, all: false });
  assert.deepEqual(crownFeedsNeeded('today', true, false), { today: false, all: true });
  assert.deepEqual(crownFeedsNeeded('selected', true, false), { today: true, all: true });
});

test("today's crown is never fetched when nothing expires today", () => {
  assert.deepEqual(crownFeedsNeeded('all', false, false), { today: false, all: false });
  assert.deepEqual(crownFeedsNeeded('selected', false, false), { today: false, all: true });
});

test('rewinding takes no extra read', () => {
  for (const scope of ['all', 'today', 'selected'] as const) {
    assert.deepEqual(crownFeedsNeeded(scope, true, true), { today: false, all: false });
  }
});

test("each crown's source is the rows when it shares their scope, else its own read", () => {
  const rows = [{ strike: 100, net_gex: 1 }];
  const todayFeed = [{ strike: 101, net_gex: 2 }];
  const allFeed = [{ strike: 102, net_gex: 3 }];
  assert.deepEqual(crownSources('all', rows, { today: todayFeed, all: null }), { today: todayFeed, all: rows });
  assert.deepEqual(crownSources('today', rows, { today: null, all: allFeed }), { today: rows, all: allFeed });
  assert.deepEqual(crownSources('selected', rows, { today: todayFeed, all: allFeed }), { today: todayFeed, all: allFeed });
  assert.deepEqual(crownSources('selected', rows, { today: null, all: null }), { today: null, all: null });
});

// ── Where the crowns sit ────────────────────────────────────────────────────

const VIEW = [6720, 6710, 6700, 6690, 6680];

test('each crown takes the largest gamma in size, long or short, in its own scope', () => {
  const picks = pickCrowns(VIEW, {
    // Today's book is heaviest at 6710, short gamma.
    today: [
      { strike: 6720, net_gex: 1e8 },
      { strike: 6710, net_gex: -9e8 },
      { strike: 6700, net_gex: 4e8 },
    ],
    // The whole chain is heaviest at 6700.
    all: [
      { strike: 6710, net_gex: -1e9 },
      { strike: 6700, net_gex: 3e9 },
      { strike: 6690, net_gex: 2e9 },
    ],
  });
  assert.deepEqual(picks.today, { strike: 6710, netGex: -9e8 });
  assert.deepEqual(picks.all, { strike: 6700, netGex: 3e9 });
});

test('both crowns can land on the same strike', () => {
  const book = [
    { strike: 6700, net_gex: 5e9 },
    { strike: 6690, net_gex: 1e9 },
  ];
  const picks = pickCrowns(VIEW, { today: book, all: book });
  assert.equal(picks.today?.strike, 6700);
  assert.equal(picks.all?.strike, 6700);
});

test('a crown is only picked among the strikes in view', () => {
  // The chain's heaviest strike (6500) is far off the ladder; the crown goes
  // to the heaviest one on screen instead.
  const picks = pickCrowns(VIEW, {
    today: null,
    all: [
      { strike: 6500, net_gex: 9e9 },
      { strike: 6690, net_gex: 2e9 },
      { strike: 6680, net_gex: -1e9 },
    ],
  });
  assert.deepEqual(picks.all, { strike: 6690, netGex: 2e9 });
});

test('no data, an empty read or no gamma in view draws no crown', () => {
  assert.equal(pickCrowns(VIEW, { today: null, all: null }).today, null);
  assert.equal(pickCrowns(VIEW, { today: [], all: [] }).all, null);
  const zeros = VIEW.map((strike) => ({ strike, net_gex: 0 }));
  assert.equal(pickCrowns(VIEW, { today: zeros, all: zeros }).today, null);
  assert.equal(pickCrowns([], { today: zeros, all: zeros }).all, null);
});

// ── Colors and words ────────────────────────────────────────────────────────

test('teal is today, violet is the whole chain, in that order', () => {
  assert.deepEqual([...CROWN_SCOPES], ['today', 'all']);
  assert.equal(CROWN_TODAY_COLOR, 'var(--color-pin)');
  assert.equal(CROWN_WIDER_COLOR, 'var(--color-king)');
  assert.equal(crownColor('today'), CROWN_TODAY_COLOR);
  assert.equal(crownColor('all'), CROWN_WIDER_COLOR);
});

test('the header key names each crown in a word or two', () => {
  assert.equal(crownScopeShort('today'), '0DTE');
  assert.equal(crownScopeShort('all'), 'All exp.');
});

test('the crown label names what it marks and over which expirations', () => {
  assert.equal(crownLabel('today'), "Heaviest dealer gamma in view, from today's expiration only (0DTE)");
  assert.equal(crownLabel('all'), 'Heaviest dealer gamma in view, from all expirations');
  assert.equal(crownLabel('today', 'volume'), "Heaviest gamma traded this session, from today's expiration only (0DTE)");
});

test("the key tooltip says what the crown covers, that it ignores the filter, and why it's missing", () => {
  const shown = crownKeyTitle('all', 'shown');
  assert.match(shown, /^Violet crown: the heaviest strike in view across all expirations/);
  assert.match(shown, /whatever the Expiry filter is set to/);
  assert.match(crownKeyTitle('today'), /^Teal crown: the heaviest strike in view from today's expiration only/);
  assert.match(crownKeyTitle('today', 'unavailable'), /nothing expires today/);
  assert.match(crownKeyTitle('all', 'unavailable'), /while rewinding/);
  assert.match(crownKeyTitle('today', 'none-in-view'), /No strike in view carries gamma from today's expiration/);
});

// ── Wiring ──────────────────────────────────────────────────────────────────

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test("every live ladder column gets its chain's expirations, so today's crown knows whether anything expires today", () => {
  const surfaces: Array<[string, number]> = [
    ['../app/chart/TerminalSurface.tsx', 2],
    ['../app/pair-comparison/PairComparisonClient.tsx', 2],
    ['../app/my-dashboard/panels.tsx', 1],
  ];
  for (const [file, columns] of surfaces) {
    const src = read(file);
    assert.equal((src.match(/useGammaLadderColumn\(/g) ?? []).length, columns, `${file}: columns`);
    assert.equal((src.match(/available: \w+\.available,/g) ?? []).length, columns, `${file}: every column`);
  }
});

test('the whole-chain views (free preview, Pair Comparison replay) serve the violet crown only', () => {
  assert.match(read('../app/chart/TerminalSurface.tsx'), /crowns: \{ today: null, all: snap\.cells \}/);
  assert.match(read('../app/pair-comparison/PairComparisonClient.tsx'), /crowns: \{ today: null, all: cells \}/);
});
