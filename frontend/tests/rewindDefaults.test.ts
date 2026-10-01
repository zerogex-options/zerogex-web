// Every rewind opens on the latest point, with Loop on.
//
// Rewind answers "how did we get here", so it opens where the reader already
// is (the newest bar or minute) and they scrub back from it. Play from that
// point replays the window from its start, and Loop keeps it going until
// paused. Four surfaces carry a rewind, each with its own transport: the Gamma
// Terminal, the GEX Strike Profile, Pair Comparison and the Daily Replay. Each
// is checked at the source, the way tests/gammaTerminal.test.ts checks the chart.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const terminal = read('../components/GammaTerminalChart.tsx');
const strikeProfile = read('../components/MarketMakerExposures.tsx');
const pair = read('../app/pair-comparison/PairComparisonClient.tsx');
const replay = read('../app/replay/[symbol]/[date]/ReplayScrubber.tsx');

// The body of a component-level `const name = (...) => { ... };` handler.
function handler(src: string, name: string): string {
  const start = src.indexOf(`  const ${name} = `);
  assert.ok(start >= 0, `${name} exists`);
  return src.slice(start, src.indexOf('\n  };\n', start));
}

test('Gamma Terminal: Rewind opens on the latest bar, with Loop on', () => {
  assert.match(terminal, /const \[playbackLoop, setPlaybackLoop\] = useState\(true\);/);
  assert.match(
    handler(terminal, 'enterRewind'),
    /setRewindTime\(barStartMs\(allBars, allBars\.length - 1\) \+ intervalMinutes \* 60 \* 1000 - 1\);/,
  );
  // Play from there replays from the earliest replayable bar, where Loop wraps.
  assert.match(
    handler(terminal, 'togglePlayback'),
    /if \(rewindTime >= liveEdge\) setRewindTime\(barStartMs\(allBars, rewindMinIdx\)\);/,
  );
  assert.match(terminal, /onClick=\{togglePlayback\}/);
});

test('Strike Profile: Rewind opens on the most recent candle, with Loop on after a Reset too', () => {
  assert.match(strikeProfile, /const \[playbackLoop, setPlaybackLoop\] = useState<boolean>\(true\);/);
  assert.match(handler(strikeProfile, 'resetAll'), /setPlaybackLoop\(true\);/);
  const enter = handler(strikeProfile, 'toggleRewind');
  assert.match(enter, /const last = allCandles\[allCandles\.length - 1\];/);
  assert.match(enter, /setRewindTime\(last \? new Date\(last\.timestamp\)\.getTime\(\) : null\);/);
  assert.match(
    handler(strikeProfile, 'togglePlayback'),
    /if \(rewindValue >= rewindMax\) \{\s*const first = allCandles\[rewindMin\];/,
  );
  assert.match(strikeProfile, /onClick=\{togglePlayback\}/);
});

test('Pair Comparison: Replay opens on the latest minute, with Loop on', () => {
  assert.match(pair, /const \[loop, setLoop\] = useState\(true\);/);
  // A cursor of -1 follows the latest frame, and entering Replay resets to it.
  assert.match(pair, /const effCursor = cursor < 0 \? lastIdx : Math\.min\(cursor, lastIdx\);/);
  assert.match(handler(pair, 'enterReplay'), /setCursor\(-1\);/);
  assert.match(
    handler(pair, 'togglePlay'),
    /if \(!isPlaying && \(cursor < 0 \|\| cursor >= lastIdx\)\) setCursor\(0\);/,
  );
});

test("Daily Replay: opens on the session's last minute and always loops", () => {
  // With no ?t= in the address, the playhead opens on the last frame.
  assert.match(
    replay,
    /const last = frames\.length > 0 \? frames\.length - 1 : 0;\s*if \(!minute \|\| frames\.length === 0\) return last;/,
  );
  assert.match(replay, /useState<number>\(\(\) => frameIndexForMinute\(frames, initialMinute\)\)/);
  // Playing past the last frame wraps to the first.
  assert.match(replay, /return next >= frames\.length \? 0 : next;/);
});
