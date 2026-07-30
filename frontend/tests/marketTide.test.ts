import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  breadthWidths,
  buildRead,
  componentRegime,
  finite,
  formatLabel,
  formatNumber,
  formatSigned,
  markerPosition,
  safePercent,
  tideComponents,
  type MarketTideComponent,
  type MarketTideResponse,
} from "../app/market-tide/data.ts";

const page = readFileSync(new URL("../app/market-tide/page.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../core/navigation.ts", import.meta.url), "utf8");

test("Market Tide is a standalone Basic Metrics route with a Beta nav item", () => {
  assert.match(page, /export default function MarketTidePage/);
  const metrics = navigation.slice(navigation.indexOf("label: 'Metrics'"), navigation.indexOf("label: 'Strategy Tools'"));
  assert.match(metrics, /id: '\/market-tide'.*label: 'Market Tide'.*requiredTier: 'basic'.*beta: true/);
});

test("all supported window buttons feed the endpoint query", () => {
  assert.match(page, /const WINDOWS = \[5, 15, 30, 60\] as const/);
  assert.match(page, /\/api\/flow\/market-tide\?window=\$\{windowMinutes\}/);
  assert.match(page, /refreshInterval: 30_000/);
});

test("authoritative and future labels are presented safely", () => {
  assert.equal(formatLabel("strong_bullish"), "Strong Bullish");
  assert.equal(formatLabel("strong_bearish"), "Strong Bearish");
  assert.equal(formatLabel("future_regime"), "Future Regime");
  assert.equal(formatLabel(null), "Unknown");
});

test("invalid numeric data never formats as NaN or Infinity", () => {
  for (const value of [NaN, Infinity, -Infinity, null, "12"]) {
    assert.equal(finite(value), null);
    assert.equal(formatNumber(value), "—");
    assert.equal(markerPosition(value), null);
  }
  assert.equal(safePercent(Infinity), 0);
});

test("gauge positions clamp correctly at -100, zero, and +100", () => {
  assert.equal(markerPosition(-100), 0);
  assert.equal(markerPosition(0), 50);
  assert.equal(markerPosition(100), 100);
  assert.equal(markerPosition(-1000), 0);
  assert.equal(markerPosition(1000), 100);
});

test("breadth widths normalize visual rounding without changing text values", () => {
  const exact = breadthWidths([68.2, 13.6, 18.2]);
  assert.ok(exact.every((value, index) => Math.abs(value - [68.2, 13.6, 18.2][index]) < 1e-9));
  const rounded = breadthWidths([33.3, 33.3, 33.3]);
  assert.ok(Math.abs(rounded.reduce((a, b) => a + b, 0) - 100) < 1e-9);
});

test("by-ticker strip uses signed contributions and per-symbol weights", () => {
  assert.equal(formatSigned(0.12474), "+0.124740");
  assert.equal(formatSigned(-0.021996), "-0.021996");
  assert.match(page, /formatSigned\(contrib, 2\)/);
  assert.match(page, /weight \* 100/);
  assert.match(page, /No eligible symbols in this window\./);
});

test("the page composes the Tide chart, Flow×Gamma map, and the history endpoint", () => {
  assert.match(page, /import MarketTideChart from "\.\/MarketTideChart"/);
  assert.match(page, /import FlowGammaMap from "\.\/FlowGammaMap"/);
  assert.match(page, /\/api\/flow\/market-tide\/history\?window=/);
});

const comp = (
  symbol: string,
  flow: number,
  gamma: number,
  contribution: number,
): MarketTideComponent => ({ symbol, flow_score: flow, gamma_score: gamma, amplifier: 1, weight: 0.25, contribution });

test("buildRead surfaces the index-vs-ETF split and short-gamma amplification", () => {
  const data = {
    timestamp: "2026-07-29T16:00:00Z", score: 1.36, label: "bullish",
    flow_direction: 0.01, gamma_regime: -0.79, gamma_label: "amplifying",
    bullish_breadth_pct: 50, neutral_breadth_pct: 0, bearish_breadth_pct: 50,
    participation_pct: 100, eligible_symbols: 4, configured_symbols: 4, stale_symbols: [],
    components: [comp("NDX", 0.75, -0.8, 0.26), comp("SPX", 0.44, -0.74, 0.15), comp("QQQ", -0.5, -0.73, -0.17), comp("SPY", -0.63, -0.9, -0.23)],
    leaders: [], laggards: [],
  } as unknown as MarketTideResponse;
  const read = buildRead(data);
  assert.ok(read);
  assert.match(read.headline, /mildly bullish/);
  assert.match(read.headline, /short gamma/);
  assert.equal(read.shortGamma, true);
  assert.ok(read.items.some((it) => /Index-vs-ETF split/.test(it.label)));
});

test("buildRead withholds a read when the score is insufficient", () => {
  const read = buildRead({ score: null, label: "insufficient_data", leaders: [], laggards: [] } as unknown as MarketTideResponse);
  assert.ok(read);
  assert.equal(read.items.length, 0);
});

test("tideComponents falls back to leaders+laggards when components is absent", () => {
  const data = { leaders: [comp("AAA", 0.3, -0.2, 0.2)], laggards: [comp("BBB", -0.4, -0.3, -0.1)] } as unknown as MarketTideResponse;
  assert.deepEqual(tideComponents(data).map((r) => r.symbol), ["AAA", "BBB"]);
});

test("componentRegime classifies the four flow×gamma quadrants", () => {
  assert.equal(componentRegime(comp("X", 0.5, -0.5, 0)), "squeeze");
  assert.equal(componentRegime(comp("X", -0.5, -0.5, 0)), "airpocket");
  assert.equal(componentRegime(comp("X", 0.5, 0.5, 0)), "capped");
  assert.equal(componentRegime(comp("X", -0.5, 0.5, 0)), "supported");
});

test("loading, retry, insufficient data, and stale disclosure are present", () => {
  assert.match(page, /market-tide-skeleton/);
  assert.match(page, /<ErrorMessage message=\{error\} onRetry=\{refetch\}/);
  assert.match(page, /score === null \|\| data\.label === "insufficient_data"/);
  assert.match(page, /score is withheld until at least 60%/);
  assert.match(page, /Stale or unavailable symbols/);
  assert.doesNotMatch(page, /score \?\? 0/);
});

test("every authoritative label maps to prominent Title Case copy", () => {
  assert.equal(formatLabel("bullish"), "Bullish");
  assert.equal(formatLabel("bearish"), "Bearish");
  assert.equal(formatLabel("neutral"), "Neutral");
  assert.equal(formatLabel("insufficient_data"), "Insufficient Data");
  assert.equal(formatLabel("amplifying"), "Amplifying");
  assert.equal(formatLabel("dampening"), "Dampening");
});

test("percentages clamp both ends and signed zero keeps a stable sign column", () => {
  assert.equal(safePercent(-50), 0);
  assert.equal(safePercent(150), 100);
  assert.equal(safePercent(91.7), 91.7);
  assert.equal(formatSigned(0), "0.000000");
  assert.equal(formatSigned(0.088508), "+0.088508");
});

test("breadth widths renormalize when returned percentages do not sum to 100", () => {
  const [bull, neutral, bear] = breadthWidths([60, 30, 30]); // sums to 120
  assert.ok(Math.abs(bull + neutral + bear - 100) < 1e-9);
  assert.ok(Math.abs(bull - 50) < 1e-9);
  assert.deepEqual(breadthWidths([0, 0, 0]), [0, 0, 0]);
});

test("the header renders the last-updated time via the shared ET formatter", () => {
  assert.match(page, /formatEtDate/);
  assert.match(page, /formatEtTime/);
  assert.match(page, /return "Unavailable";/);
  assert.doesNotMatch(page, /toLocaleString/);
});

test("gauge, breadth, and window controls expose accessible names and states", () => {
  assert.match(page, /role="meter"/);
  assert.match(page, /aria-valuetext=/);
  assert.match(page, /role: "img"/); // insufficient-state gauge accessible name
  assert.match(page, /role="img"/); // breadth bar announces values, not color alone
  assert.match(page, /minute window/); // per-window screen-reader labels
  assert.match(page, /role="progressbar"/); // participation indicator
});
