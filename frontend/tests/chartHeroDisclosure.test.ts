import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The Gamma Chart hero folds its own pitch for people who already pay for it.
//
// /chart is two pages wearing one component: an indexable lead magnet for the
// public and the working instrument for members. The lead paragraph and the
// spec row (underlyings, timeframes, live-vs-delayed) are sales copy — they
// earn their screen on the public page and cost a member most of a handset
// screen above the chart they came for. So the disclosure defaults OPEN for
// the public view and FOLDED for members, and either reader can toggle it.
//
// The default is keyed off `delayed`, which is the page's paying-member signal
// rather than a stand-in for one: /chart resolves it from a signed-in basic+
// session. These tests pin that chain together, because the failure mode is
// silent — a refactor that flips the seed, or a gate that stops meaning
// "paying member", still renders a perfectly good-looking page for everyone.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const client = read('../app/chart/ChartClient.tsx');
const page = read('../app/chart/page.tsx');
const css = read('../app/globals.css');

// The hero region, from the disclosure's own container to the end of <header>.
const heroIntro = client.slice(
  client.indexOf('<div id="chart-hero-intro"'),
  client.indexOf('</header>'),
);

test('the hero copy is folded for members and open for the public view', () => {
  // `delayed` is true only on the public path, so seeding the open state with
  // it is the whole rule: public opens, member folds.
  assert.match(client, /const \[introOpen, setIntroOpen\] = useState\(delayed\)/);
  assert.ok(heroIntro.length > 0, 'the hero intro region should exist');
  assert.match(heroIntro, /hidden=\{!introOpen\}/);
});

test('both the pitch and the spec row sit inside the fold', () => {
  // Folding the paragraph but leaving the three stats behind would still leave
  // a member scrolling past marketing to reach the chart.
  assert.match(heroIntro, /Price and modeled dealer gamma on one surface/);
  assert.match(heroIntro, /label="Underlyings"/);
  assert.match(heroIntro, /label="Timeframes"/);
  assert.match(heroIntro, /Dealer gamma overlay/);

  // ...and nothing outside the fold repeats them, which would defeat it.
  const outside = client.replace(heroIntro, '');
  assert.doesNotMatch(outside, /label="Underlyings"/);
});

test('the fold is a real, operable disclosure in both states', () => {
  // A collapsed hero with no way back to the copy is a deletion, not a fold.
  const toggle = client.slice(client.indexOf('<button'), client.indexOf('</button>'));
  assert.match(toggle, /className="zg-disclosure"/);
  assert.match(toggle, /aria-expanded=\{introOpen\}/);
  assert.match(toggle, /aria-controls="chart-hero-intro"/);
  assert.match(toggle, /setIntroOpen\(\(open\) => !open\)/);
  // The region the button claims to control has to exist in both states, which
  // is why it is hidden rather than unmounted.
  assert.match(client, /id="chart-hero-intro"/);
  assert.match(css, /^\.zg-disclosure \{/m, 'the toggle must not ship unstyled');
});

test('"member" here means a paying tier, not merely signed in', () => {
  // The fold rides on `delayed`, so what that resolves from is part of this
  // behavior: basic+ gets the live chart and the folded hero, everyone else —
  // signed out or signed in on the free tier — gets the delayed chart and the
  // full pitch.
  assert.match(page, /hasTierAccess\(session\.user\.tier, 'basic'\)/);
  assert.match(page, /<ChartClient snapshot=\{null\} delayed=\{false\} \/>/);
  assert.match(page, /<ChartClient snapshot=\{snapshot\} delayed \/>/);
});
