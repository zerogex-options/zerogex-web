import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NAV_GROUPS } from "../core/navigation.ts";
import { requiredTierForRoute } from "../core/auth.ts";
import { LIKE_PAIR, SYMBOLS, likePairFor } from "../core/symbols.ts";

process.env.NEXT_PUBLIC_AUTH_ENABLED = "1";

const client = readFileSync(new URL("../app/gamma-terminal/GammaTerminalClient.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/gamma-terminal/page.tsx", import.meta.url), "utf8");
const pair = readFileSync(new URL("../app/pair-comparison/PairComparisonClient.tsx", import.meta.url), "utf8");

// The Gamma Terminal is a Main-section member page flagged Beta. The nav entry
// and the route rule must agree (navigationAccess covers the general invariant;
// this pins the specific placement the feature was asked for).
test("Gamma Terminal is a Beta, Basic-tier item in the Main section", () => {
  const main = NAV_GROUPS.find((g) => g.label === "Main");
  assert.ok(main, "Main group exists");
  const item = main.items?.find((i) => i.id === "/gamma-terminal");
  assert.ok(item, "nav item is in the Main section");
  assert.equal(item.label, "Gamma Terminal");
  assert.equal(item.beta, true);
  assert.equal(item.requiredTier, "basic");
  assert.equal(requiredTierForRoute("/gamma-terminal"), "basic");
});

// The page is a composition of existing instruments, not a re-implementation:
// the Gamma Chart's own component on the left and the Pair Comparison ladder
// element on the right.
test("the page reuses GammaTerminalChart and PairGammaHeatmap", () => {
  assert.match(page, /export default function GammaTerminalPage/);
  assert.match(page, /\(Beta\)/);
  assert.match(client, /import GammaTerminalChart, \{ type ChartGeometry, type RewindState \} from "@\/components\/GammaTerminalChart"/);
  // Terminal mode: no rail (the ladders carry it), spot held at the tape's
  // center, ribbons on by default under a scoped preference key, and the
  // geometry callback that pins the ladders to the chart.
  assert.match(client, /<GammaTerminalChart\s+hideRail\s+centerPriceOnSpot\s+storageScope="terminal"\s+overlayDefaults=\{\{ ribbons: true \}\}\s+onGeometry=\{onGeometry\}\s+onRewind=\{onRewind\}\s*\/>/);
  assert.match(client, /fit=\{fit\} maxSide=\{maxSide\}/);
  assert.match(client, /height: wide && geometry \? geometry\.height : undefined/);
  assert.match(client, /import PairGammaHeatmap/);
  assert.match(client, /<PairGammaHeatmap left=\{leftInput\} right=\{rightInput\}/);
  assert.match(client, /<BetaBadge size="md" \/>/);
});

// The chart and the first ladder share the app-wide symbol; the second ladder
// is free-select from every OTHER symbol (never the primary), so the page can
// never compare a symbol against itself.
test("chart + first ladder follow the app symbol; the second ladder excludes it", () => {
  assert.match(client, /const \{ symbol: sym1, setSymbol \} = useTimeframe\(\)/);
  assert.match(client, /useGammaLadderColumn\(sym1, true/);
  assert.match(client, /useGammaLadderColumn\(sym2, true/);
  assert.match(client, /const compareOptions = SYMBOLS\.filter\(\(s\) => s !== sym1\)/);
  assert.match(client, /options=\{compareOptions\}/);
  // The primary's dropdown and the chart's own switcher both write the shared
  // symbol, so picking the comparison symbol as primary swaps the two.
  assert.match(client, /if \(s === sym2\) setSym2Pref\(sym1\);\s*setSymbol\(s\);/);
  assert.match(client, /if \(sym2Pref === sym1\) setSym2Pref\(prevSym1\);/);
});

// The like-pair default is shared with Pair Comparison so both surfaces open
// on the same comparison, and it is total over the picker symbols.
test("likePairFor is total, symmetric and never returns its input", () => {
  for (const s of SYMBOLS) {
    const pair = likePairFor(s);
    assert.notEqual(pair, s, `${s} must not pair with itself`);
    assert.ok((SYMBOLS as readonly string[]).includes(pair), `${s} -> ${pair} is a picker symbol`);
    assert.equal(LIKE_PAIR[pair], s, `${s} <-> ${pair} is symmetric`);
  }
  assert.equal(likePairFor("spy"), "QQQ");
  assert.equal(likePairFor("unknown"), "QQQ");
  assert.match(pair, /likePairFor\(headerSymbol\)/);
  assert.match(client, /likePairFor\(sym1\)/);
});

// Both pages render the identical symbol dropdown.
test("Pair Comparison and the Gamma Terminal share one SymbolSelect", () => {
  assert.match(pair, /import SymbolSelect from "@\/components\/SymbolSelect"/);
  assert.match(client, /import SymbolSelect from "@\/components\/SymbolSelect"/);
  assert.doesNotMatch(pair, /function SymbolSelect\(/);
});

// Rewind drives both ladders: the chart broadcasts its replay clock and each
// column receives it, so the book beside the tape is the book as of the same
// moment rather than the live tip.
test("both ladders follow the chart's rewind clock", () => {
  assert.match(client, /const rewindTime = rewind\.active \? rewind\.time : null;/);
  assert.equal((client.match(/rewindTime,\n\s*\}\);/g) ?? []).length, 2, "both ladder columns take the clock");
  const chart = readFileSync(new URL("../components/GammaTerminalChart.tsx", import.meta.url), "utf8");
  assert.match(chart, /onRewind\?\.\(\{ active: rewindActive, time: rewindActive \? rewindTime : null \}\)/);
  const hook = readFileSync(new URL("../hooks/useGammaLadder.ts", import.meta.url), "utf8");
  assert.match(hook, /bucketAtOrNearest\(history, rewindMs as number\)/);
  assert.match(hook, /positioningKind: "rewind" as const/);
});

// The ribbons' opacity is user-adjustable and persisted, with the default a
// notch under the tuned look.
test("ribbon opacity is adjustable, persisted per surface, and defaults to 90%", () => {
  const chart = readFileSync(new URL("../components/GammaTerminalChart.tsx", import.meta.url), "utf8");
  assert.match(chart, /const RIBBON_OPACITY_DEFAULT = 0\.9;/);
  assert.match(chart, /<RibbonOpacityControl value=\{ribbonOpacity\} onChange=\{setRibbonOpacity\} \/>/);
  assert.match(chart, /localStorage\.setItem\(ribbonOpacityKey, String\(ribbonOpacity\)\)/);
  assert.match(chart, /RIBBON_TIER_OPACITY\[p\.tier\] \* ribbonOpacity/);
  assert.match(chart, /RIBBON_GLOW_OPACITY\[p\.tier\] \* ribbonOpacity/);
});

// The volume pane has two views: the stacked up/down columns it has always
// drawn, and a running net cumulative (core/netVolumeSeries) in the style of
// the Options Flow chart's directional net volume.
test("the volume pane offers both views, persisted per surface", () => {
  const chart = readFileSync(new URL("../components/GammaTerminalChart.tsx", import.meta.url), "utf8");
  assert.match(chart, /const \[volumeMode, setVolumeMode\] = useState<VolumeMode>\("updown"\)/);
  assert.match(chart, /aria-label="Volume pane"/);
  assert.match(chart, /onClick=\{\(\) => setVolumeMode\(m\)\}/);
  assert.match(chart, /localStorage\.setItem\(volumeModeKey, volumeMode\)/);
  assert.match(chart, /VOLUME_MODE_STORAGE_KEY = "zg\.gammaChart\.volumeMode\.v1"/);
  // The pane's geometry comes from the tested module, not from inline math.
  assert.match(chart, /netVolumeAreaPaths\(netVolume\.segments/);
  assert.match(chart, /netVolumeScale\(values, \{ top: VOL_TOP, bottom: VOL_BOTTOM \}\)/);
});

// The running total has to be accumulated from the session's first bar, so the
// number under a given bar is the same however the view is zoomed or panned.
// Accumulating over the visible slice would restate it at every zoom.
test("the net cumulative is accumulated through the right edge, not from the viewport", () => {
  const chart = readFileSync(new URL("../components/GammaTerminalChart.tsx", import.meta.url), "utf8");
  assert.match(chart, /const throughEdge = allBars\.slice\(0, viewEnd\);/);
  assert.match(chart, /cumulativeNetVolume\(throughEdge, \{ scope, symbol \}\)\.slice\(viewStart, viewEnd\)/);
  // Daily candles are one bar per session already, so they never reset.
  assert.match(chart, /const scope = timeframe === "1day" \? "window" : "session";/);
  // The replay's growing edge candle is substituted the way `bars` does it.
  assert.match(chart, /if \(partialCurrentBar && throughEdge\.length > 0\) throughEdge\[throughEdge\.length - 1\] = partialCurrentBar;/);
});

// Intraday, the pane measures ONE session: the total starts at the most recent
// session's open (resolved through the right edge, so a panned-back or rewound
// view reads the session it is showing) and every bar before it is flat zero.
test("the net cumulative covers the most recent session only", () => {
  const chart = readFileSync(new URL("../components/GammaTerminalChart.tsx", import.meta.url), "utf8");
  assert.match(chart, /const sessionStart = scope === "session" \? lastSessionStartIndex\(bars, symbol\) : 0;/);
  // The area breaks at that open rather than drawing a cliff off the flat run.
  assert.match(chart, /segments: signedAreaSegments\(values, \[sessionStart\]\)/);
  // A bar before the open has no total to report, so the readout dashes it.
  assert.match(chart, /activeIdx < netVolume\.sessionStart \? \(/);
});
