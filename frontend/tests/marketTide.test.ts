import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  breadthWidths,
  finite,
  formatLabel,
  formatNumber,
  formatSigned,
  markerPosition,
  safePercent,
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
  assert.match(page, /market-tide\?window=\$\{windowMinutes\}/);
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

test("contributors use signed contributions and fractional percentage weights", () => {
  assert.equal(formatSigned(0.12474), "+0.124740");
  assert.equal(formatSigned(-0.021996), "-0.021996");
  assert.match(page, /finite\(row\.weight\).*\* 100/);
  assert.match(page, /No positive contributors in this window\./);
  assert.match(page, /No negative contributors in this window\./);
});

test("loading, retry, insufficient data, and stale disclosure are present", () => {
  assert.match(page, /market-tide-skeleton/);
  assert.match(page, /<ErrorMessage message=\{error\} onRetry=\{refetch\}/);
  assert.match(page, /score === null \|\| data\.label === "insufficient_data"/);
  assert.match(page, /score is withheld until at least 60%/);
  assert.match(page, /Stale or unavailable symbols/);
  assert.doesNotMatch(page, /score \?\? 0/);
});
