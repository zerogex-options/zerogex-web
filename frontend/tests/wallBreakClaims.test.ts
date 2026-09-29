import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// Guard on what the site may say about whether a gamma wall holds or breaks.
//
// ZeroGEX measured it (content/articles/how-often-do-gamma-walls-break.md):
// across 737 wall tests, S&P walls held about two times in three within an hour
// and Nasdaq walls about half, and nothing measured about the wall or the tape
// predicted which ones broke. The side of the gamma flip, net GEX and its
// trajectory, wall size, migration and flow at the strike were all tested.
//
// Copy kept saying otherwise anyway: "the Put Wall is more likely to break than
// hold" in negative gamma, "walls are more brittle", "breakouts more often
// stall" above the flip. Each pattern below is one of those AFFIRMATIVE claims,
// written narrowly so the corrected sentences (which negate them, e.g. "none of
// this makes a level more likely to fail than to hold") still pass.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const englishMarkdown = (dir: string) =>
  readdirSync(new URL(dir, import.meta.url))
    .filter((name) => name.endsWith('.md') && !/\.(de|es|fr|it)\.md$/.test(name))
    .map((name) => `${dir}${name}`);

const SURFACES: string[] = [
  '../components/GammaExpectationMatrix.tsx',
  '../core/articleFaq.ts',
  '../core/articleRegistry.ts',
  '../app/articles/page.tsx',
  '../app/live-bulletin/bulletinHelpers.ts',
  '../app/spx-gamma-levels/gammaLevels.tsx',
  '../app/about/Client.i18n.ts',
  '../app/trading-mistakes/Client.tsx',
  '../app/help/faqs/Client.tsx',
  '../app/LandingClient.i18n.ts',
  '../content/methodology.md',
  ...englishMarkdown('../content/articles/'),
  ...englishMarkdown('../content/help/platform/'),
];

const BANNED: Array<[string, RegExp]> = [
  ['a wall "more likely to break than hold"', /more likely to (break|give way) than (to )?hold/i],
  ['a wall "far more likely to give way"', /far more likely to give way/i],
  ['"expect the level to hold"', /expect the level to hold/i],
  ['"buy weakness into the wall"', /buy weakness into the wall/i],
  ['"walls are more brittle"', /walls are more brittle/i],
  ['walls "define the range with high accuracy"', /trading range with high accuracy/i],
  ['levels "tend to give way" by regime', /levels tend to give way/i],
  ['breakouts that fail, stall or fade "more often"', /\bmore often (fail|stall|fade)\b|\b(fail|stall)s? more often\b/i],
  ['breakouts that "extend more often"', /\bextends? more often\b|breakouts have more follow-through/i],
  ['a wall reading that "holds more often" by regime', /holds more often in a (positive|negative)-gamma/i],
  ['a strike that "more / less likely acts as" resistance or a breakout target', /(more|less) likely (to )?acts? as (firm )?(a breakout target|resistance)/i],
  ['"the odds rise when" conditions line up', /the odds rise when/i],
  ['conditions that "predict the fail"', /(conditions|variables) that (predict|flag) the fail|conditions that predict a fail/i],
  ['a "higher-probability fade" or trend path at a wall', /higher-probability \*?fade|trend extension is the higher-probability path/i],
  ['walls that "weaken or invert" by regime', /walls? weakens? or inverts?/i],
  ['walls "less reliable" or "weaker" as resistance / support', /(less reliable|weaker) as (resistance|support)/i],
  ['walls as "genuine" resistance and support by regime', /more like genuine resistance/i],
  ['"more failed breakouts" by regime', /more failed breakouts/i],
  ['walls "not durable" by regime', /walls as durable in a/i],
  ['"walls absorb" / "walls release" by regime', /\bwalls (absorb|release)\b/i],
  ['a chase "high failure rate"', /high failure rate/i],
  ['breakouts "likely to extend or fade"', /breakouts are likely to (extend|fade)/i],
  ['the flip decides "defend it or blow through it"', /defend it or blow through it/i],
  ['a regime table of breakouts that "often fade" / "often extend"', /\| *Often (fade and snap back|extend) *\|/i],
  ['a regime-given "hit rate" for a setup', /\b(setups|trend-following|trend-continuation) (have|has) a (higher|lower) hit rate\b/i],
];

for (const rel of SURFACES) {
  test(`${rel.replace('../', '')}: no wall hold/break odds the study contradicts`, () => {
    const source = read(rel);
    for (const [description, pattern] of BANNED) {
      const hit = source.match(pattern);
      assert.equal(hit, null, `${rel} claims ${description}: ${JSON.stringify(hit?.[0] ?? '')}`);
    }
  });
}

test('the Playbook cells describe the hedging, never the odds or a trade', () => {
  const source = read('../components/GammaExpectationMatrix.tsx');
  const start = source.indexOf('const MATRIX');
  const end = source.indexOf('const REGIMES');
  assert.ok(start > 0 && end > start, 'MATRIX block not found');
  const matrix = source.slice(start, end);
  assert.doesNotMatch(matrix, /\blikel(y|ier)\b|\bodds\b|probab/i);
  // "What to watch" is an observation, not an order.
  for (const [, text] of matrix.matchAll(/watch: '([^']*)'/g)) {
    assert.doesNotMatch(text, /^(Buy|Sell|Fade|Short|Trade|Respect|Expect)\b/, text);
  }
});

test('the Playbook shows the measured base rate and links to the study', () => {
  const source = read('../components/GammaExpectationMatrix.tsx');
  assert.match(source, /wallBaseRate\(read\.symbol\)/);
  assert.match(source, /href="\/education\/how-often-do-gamma-walls-break"/);
});

test('the wall study quotes the same SPX break rates in its prose as in its table', () => {
  const article = read('../content/articles/how-often-do-gamma-walls-break.md');
  const thirty = article.match(/^\| 30 min \| ([\d.]+%) \|/m)?.[1];
  const sixty = article.match(/^\| 60 min \| \*\*([\d.]+%)\*\* \|/m)?.[1];
  assert.ok(thirty && sixty, 'SPX rows not found in the break-curve table');
  assert.match(article, new RegExp(`${thirty.replace('.', '\\.')} break rate at a thirty-minute horizon and a ${sixty.replace('.', '\\.')} rate at sixty`));
});

test('the wall study does not put the side of the flip back into the base rate', () => {
  // The article lists "which side of the flip price sat on" among the features
  // that did NOT predict a break, and finds the rate belongs to the index, not
  // the product; its takeaway has to agree with both.
  const article = read('../content/articles/how-often-do-gamma-walls-break.md');
  assert.doesNotMatch(article, /which index, which side of the flip, which product/);
});

test('the banned patterns still catch the sentences they were written for', () => {
  // The claims this guard exists for, as they were published. If a pattern is
  // loosened until one of these slips through, the guard is decoration.
  const ORIGINALS = [
    'The Put Wall is more likely to break than hold',
    'The Call Wall is far more likely to give way',
    'Buy weakness into the wall; expect the level to hold.',
    'moves can accelerate, walls are more brittle, trend extension is the higher-probability path.',
    'Call Wall and Put Wall define the intraday trading range with high accuracy',
    'in a negative-gamma regime, the same levels tend to give way and breaks extend.',
    'Breakouts more often stall and get faded.',
    'Be skeptical of breakouts - they fail more often.',
    'trend-continuation playbooks tend to have the tailwind: breakouts extend more often',
    'That reading holds more often in a positive-gamma regime and less often in a negative one',
    'The structural read inverts: 5,820 more likely acts as resistance',
    'the 5,820 call wall is less likely to act as firm resistance; in this regime it can behave more like a breakout target',
    'The odds rise when all three structural conditions line up',
    'the three structural conditions that predict a fail',
    'The lean: rallies into 5,850 are the higher-probability *fade* zone',
    'Mean-reversion setups have a higher hit rate.',
    'Strengthening in a long-gamma regime suggests the absorbing reflex is intensifying - chases more often fade.',
    'In short-gamma regimes, walls weaken or invert.',
    'Walls become less reliable as resistance and support - they can invert into breakout targets.',
    'Walls behave more like genuine resistance and support.',
    'Tighter ranges, more chop, more failed breakouts.',
    'Treating walls as durable in a negative-gamma regime. They are not.',
    'In a positive-gamma regime, walls absorb.',
    'Long-gamma + chase = high failure rate.',
    'whether breakouts are likely to extend or fade',
    'the gamma flip tells you whether they will defend it or blow through it',
    '| Breakouts | Often fade and snap back | Often extend |',
    'In a negative-gamma regime, they are weaker as resistance and can flip into breakout targets.',
  ];
  for (const sentence of ORIGINALS) {
    assert.ok(
      BANNED.some(([, pattern]) => pattern.test(sentence)),
      `no banned pattern catches: ${sentence}`,
    );
  }
});
