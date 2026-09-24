import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NAV_GROUPS } from "../core/navigation.ts";
import { isPublicRoute, requiredTierForRoute } from "../core/auth.ts";
import { LIKE_PAIR, SAME_INDEX_PAIR, SYMBOLS, likePairFor, sameIndexPairFor } from "../core/symbols.ts";

process.env.NEXT_PUBLIC_AUTH_ENABLED = "1";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

const client = read("../app/chart/ChartClient.tsx");
const surface = read("../app/chart/TerminalSurface.tsx");
const page = read("../app/chart/page.tsx");
const snapshot = read("../app/chart/snapshot.ts");
const chart = read("../components/GammaTerminalChart.tsx");
const pair = read("../app/pair-comparison/PairComparisonClient.tsx");
const nextConfig = read("../next.config.ts");

// ── The fold ────────────────────────────────────────────────────────────────
// The Gamma Chart and the Gamma Terminal were one instrument with different
// things beside it, so they are now one page. /chart is the survivor because it
// is the URL with the ranking history; the members-only beta 301s onto it.
test("the Gamma Terminal is one public route, and the beta URL redirects to it", () => {
  const main = NAV_GROUPS.find((g) => g.label === "Main");
  assert.ok(main, "Main group exists");
  const items = main.items ?? [];
  const item = items.find((i) => i.id === "/chart");
  assert.ok(item, "the terminal is in the Main section");
  assert.equal(item.label, "Gamma Terminal");
  // Public dual-mode: no declared tier, and no route rule that would gate it.
  assert.equal(item.requiredTier, undefined);
  assert.equal(item.beta, undefined, "the flagship page is no longer a beta");
  assert.ok(isPublicRoute("/chart"), "/chart stays anonymous-accessible");
  assert.equal(requiredTierForRoute("/chart"), null);

  // The absorbed route is gone from the nav and the route table, and 301s.
  assert.equal(items.find((i) => i.id === "/gamma-terminal"), undefined);
  assert.equal(requiredTierForRoute("/gamma-terminal"), null);
  assert.match(
    nextConfig,
    /source: '\/gamma-terminal',\s*destination: '\/chart',\s*permanent: true,/,
    "the beta URL must 301 rather than 404",
  );
});

// The page is a composition of existing instruments, not a re-implementation:
// the Gamma Chart's own component, the Pair Comparison ladder element, and the
// two readings /chart already shipped above and below them.
test("the page reuses GammaTerminalChart, PairGammaHeatmap and the chart page's own sections", () => {
  assert.match(page, /export default async function GammaTerminalPage/);
  assert.match(surface, /import GammaTerminalChart, \{[\s\S]*?\} from "@\/components\/GammaTerminalChart"/);
  assert.match(surface, /import PairGammaHeatmap/);
  assert.match(surface, /<PairGammaHeatmap left=\{leftInput\} right=\{rightInput\}/);
  assert.match(surface, /fit=\{fit\} maxSide=\{maxSide\}/);
  assert.match(surface, /height: wide && geometry \? geometry\.height : undefined/);
  // Nothing the Gamma Chart carried was dropped in the fold.
  assert.match(client, /<KeyLevelsStrip snapshot=\{snapshot\} delayed=\{delayed\}/);
  assert.match(client, /<GammaExpectationMatrix className="mb-10" snapshot=\{snapshot\} delayed=\{delayed\} \/>/);
  assert.match(client, /<TerminalSurface snapshot=\{snapshot\} delayed=\{delayed\} ladders=\{ladders\} \/>/);
});

// ── The view switch ─────────────────────────────────────────────────────────
// One layout under both views: tape on the left, panel on the right, the chart
// configured identically either way. The switch decides what the PANEL holds,
// not how the chart draws — so nothing about the chart may key off it except
// whether it is also asked to draw its rail into the panel.
test("the switch changes the panel, not the chart", () => {
  assert.match(surface, /export type TerminalView = "ladders" \| "panel";/);
  assert.match(surface, /const laddersView = view === "ladders";/);
  // Terminal mode, spot centering, storage scope and overlay defaults are
  // unconditional — no `laddersView ?` anywhere in the chart's props.
  const mount = surface.slice(surface.indexOf("<GammaTerminalChart"), surface.indexOf("/>", surface.indexOf("<GammaTerminalChart")));
  assert.match(mount, /\n\s+hideRail\n/);
  assert.match(mount, /\n\s+centerPriceOnSpot\n/);
  assert.match(mount, /storageScope="terminal"/);
  assert.match(mount, /overlayDefaults=\{\{ ribbons: true \}\}/);
  assert.match(mount, /onGeometry=\{onGeometry\}/);
  assert.match(mount, /onRewind=\{onRewind\}/);
  // The only view-dependent props are the two portal targets.
  assert.match(mount, /strikePanelTarget=\{laddersView \? null : panelHost\}/);
  assert.match(mount, /railControlsTarget=\{laddersView \? null : panelControlsHost\}/);
  assert.equal((mount.match(/laddersView/g) ?? []).length, 2, "nothing else about the chart keys off the view");
  // A remount per view would throw away the chart's zoom, pan and rewind on
  // every switch; there is one configuration now, so there is nothing to remount.
  assert.doesNotMatch(mount, /key=\{view\}/);
});

// The GEX ribbons read the TAPE, not the panel, so they are the chart's under
// either view — available, and on by default, in both.
test("the ribbons are available under both views", () => {
  // One storage scope means one saved overlay set, so the default applies to
  // both views rather than only to the one that happened to ask for it.
  assert.equal((surface.match(/storageScope=/g) ?? []).length, 1);
  assert.equal((surface.match(/overlayDefaults=/g) ?? []).length, 1);
  // The pill itself is gated on `live` only — never on the rail or the view.
  assert.match(chart, /\{live && \(\s*<OverlayPill label="Ribbons"/);
  assert.match(chart, /\{live && overlays\.ribbons && \(\s*<RibbonOpacityControl/);
});

// The strike panel is the Gamma Chart's own rail, moved — not a second
// component re-deriving the same numbers beside the tape.
test("the strike panel is the chart's rail, portalled into the panel", () => {
  assert.match(chart, /import \{ createPortal \} from "react-dom";/);
  assert.match(chart, /const inPanel = !!strikePanelTarget;/);
  // One node, two mounts: inline in the chart's SVG, or portalled out.
  assert.match(chart, /const railGroup =/);
  assert.match(chart, /\{!inPanel && railGroup\}/);
  assert.match(chart, /createPortal\(\s*<svg/);
  assert.match(chart, /strikePanelTarget,\s*\)/);
  // The panel's viewBox is expressed in the CHART's own y units, which is the
  // whole trick: `yPrice` is then already correct inside the panel, so a
  // strike's bar lands level with that price on the candles.
  assert.match(chart, /const PANEL_VB_H = PRICE_BOTTOM - PAD_TOP;/);
  assert.match(chart, /viewBox=\{`\$\{railLeft\} \$\{panelVb\.y\} \$\{railRight - railLeft\} \$\{panelVb\.h\}`\}/);
  // One px→y scale for the whole element, taken from the band the page reports.
  // Width and height convert through the SAME number, so the viewBox always
  // carries the element's aspect and nothing is ever stretched.
  assert.match(chart, /const u = PANEL_VB_H \/ strikePanelBand\.height;/);
  assert.match(chart, /y: PAD_TOP - strikePanelBand\.top \* u, h: panelBox\.height \* u, w: Math\.max\(60, panelBox\.width \* u\)/);
  // The page reports where the chart's band falls inside the panel.
  assert.match(surface, /strikePanelBand=\{panelBand\}/);
  assert.match(surface, /geometry\.plotTop - bodyBox\.top/);
  assert.match(surface, /geometry\.plotBottom - geometry\.plotTop/);
});

// The panel FILLS its card rather than floating as a strip across the tape's
// band — and the room left over is not padding: the same scale runs through it,
// so the strikes just above and below the visible tape get drawn.
test("the panel fills its card and draws past the tape at the same scale", () => {
  assert.match(surface, /style=\{\{ left: 8, right: 8, top: 0, bottom: 0 \}\}/);
  assert.match(chart, /const railDomain = useMemo\(/);
  assert.match(chart, /if \(!inPanel\) return \{ min: layout\.dMin, max: layout\.dMax \};/);
  assert.match(chart, /return \{ max: layout\.priceForY\(panelVb\.y\), min: layout\.priceForY\(panelVb\.y \+ panelVb\.h\) \};/);
  // Both the silhouette and the per-strike bars clip to that range, not to the
  // tape's — otherwise the extra room would just be blank.
  assert.match(chart, /profilePoints\.filter\(\(p\) => p\.price >= railDomain\.min && p\.price <= railDomain\.max\)/);
  assert.match(chart, /railStrikes\.filter\(\(s\) => s\.price >= railDomain\.min && s\.price <= railDomain\.max\)/);
});

// The rail's x geometry is per-instance: its own column inline, the whole
// element in a panel. Nothing may still be pinned to the old constants.
test("the rail's geometry follows it out of the chart's column", () => {
  assert.match(chart, /const railLeft = inPanel \? 0 : RAIL_LEFT;/);
  assert.match(chart, /const railRight = inPanel \? panelVb\.w : RAIL_RIGHT;/);
  assert.match(chart, /const railCenter = \(railLeft \+ railRight\) \/ 2;/);
  assert.match(chart, /const railHalf = \(railRight - railLeft\) \/ 2 - 10;/);
  // The drawing code reads the per-instance values only.
  const railSrc = chart.slice(chart.indexOf("const railGroup ="), chart.indexOf("</g>", chart.indexOf("const railGroup =")));
  assert.doesNotMatch(railSrc, /RAIL_CENTER|RAIL_HALF/);
  // Inline, the rail is still an overlay the reader can switch off; panelled,
  // the page's view switch already put it there.
  assert.match(chart, /const railOn = inPanel \|\| \(overlays\.rail && !hideRail\);/);
});

// The rail's four views and its labels pill are controls over the rail, so they
// go wherever the rail is — the panel here, the chart's toolbar on the pages
// that still draw it inline (/dashboard, /my-dashboard, the levels pages).
test("the rail's view controls follow it, and the inline rail keeps them", () => {
  assert.match(chart, /const railViewControls = live \? \(/);
  for (const mode of ["silhouette", "net", "split", "combined"]) {
    assert.match(chart, new RegExp(`\\["${mode}", "`), `${mode} is offered on the rail's controls`);
  }
  assert.match(chart, /railMode !== "silhouette" && \(\s*<OverlayPill label="Labels"/);
  assert.match(chart, /\{railOn && !inPanel && railViewControls\}/);
  assert.match(chart, /inPanel && railControlsTarget \? createPortal\(railViewControls, railControlsTarget\) : null/);
  // The page gives them a home on the panel's control row.
  assert.match(surface, /ref=\{setPanelControlsHost\}/);
});

// ── The public, delayed view ────────────────────────────────────────────────
// The whole premise of /chart is that an anonymous visitor gets the real
// instrument on ~15-minute-delayed SERVER data and the browser makes no API
// call at all. Folding the ladders in must not punch a hole in that: the ladder
// feeds are Basic-gated, so the delayed columns have to be server-rendered.
test("the public view renders both ladders from server snapshots and polls nothing", () => {
  assert.match(page, /const \[snapshot, primary, compare\] = await Promise\.all\(\[/);
  assert.match(page, /loadChartSnapshot\(PUBLIC_SYMBOL, '5min'\)/);
  assert.match(page, /loadLadderSnapshot\(PUBLIC_SYMBOL\)/);
  assert.match(page, /loadLadderSnapshot\(compareSymbol\)/);
  assert.match(page, /const compareSymbol = sameIndexPairFor\(PUBLIC_SYMBOL\);/);
  assert.match(snapshot, /export async function loadLadderSnapshot/);
  // Every delayed fetch runs through the 900s ISR-cached server client.
  const ladderLoader = snapshot.slice(snapshot.indexOf("export async function loadLadderSnapshot"));
  assert.equal((ladderLoader.match(/serverApiGet</g) ?? []).length, 4, "four server feeds, no client ones");
  assert.match(ladderLoader, /DELAY_SECONDS/);
  // Delayed => the columns come from the snapshot, and every live hook is off.
  assert.match(surface, /const left = delayed \? snapshotColumn\(ladders\?\.primary \?\? null, sym1\) : leftLive;/);
  assert.match(surface, /const right = delayed \? snapshotColumn\(ladders\?\.compare \?\? null, sym2\) : rightLive;/);
  assert.match(surface, /const laddersEnabled = live && laddersView;/);
  assert.match(surface, /useChartExpirations\(sym1, live\)/);
  assert.match(surface, /useChartExpirations\(sym2, live\)/);
});

// The frozen snapshot covers exactly one pair, so the delayed view must not let
// a control imply otherwise — the same reason the chart fixes its own symbol
// picker and the Key Levels strip drops its flip there.
test("the delayed view names the snapshot's own pair and freezes the pickers", () => {
  assert.match(surface, /const sym1: UnderlyingSymbol = delayed \? snapSym1 : ctxSymbol;/);
  assert.match(surface, /ladders\?\.compare\?\.symbol \?\? sameIndexPairFor\(sym1\)/);
  assert.equal((surface.match(/disabled=\{delayed\}/g) ?? []).length, 2, "both symbol dropdowns freeze");
  const select = read("../components/SymbolSelect.tsx");
  assert.match(select, /disabled=\{disabled\}/);
  assert.match(select, /title=\{disabled \? disabledTitle : undefined\}/);
});

// ── Symbols ─────────────────────────────────────────────────────────────────
// The chart and the first ladder share the app-wide symbol; the second ladder
// is free-select from every OTHER symbol (never the primary), so the page can
// never compare a symbol against itself.
test("chart + first ladder follow the app symbol; the second ladder excludes it", () => {
  assert.match(surface, /const \{ symbol: ctxSymbol, setSymbol \} = useTimeframe\(\)/);
  assert.match(surface, /const compareOptions = SYMBOLS\.filter\(\(s\) => s !== sym1\)/);
  assert.match(surface, /options=\{compareOptions\}/);
  // The primary's dropdown and the chart's own switcher both write the shared
  // symbol, so picking the comparison symbol as primary swaps the two.
  assert.match(surface, /if \(s === sym2\) setSym2Pref\(sym1\);\s*setSymbol\(s\);/);
  assert.match(surface, /if \(sym2Pref === sym1\) setSym2Pref\(prevSym1\);/);
});

// Pair Comparison's default is the cross-index like-pair, and it is total over
// the picker symbols.
test("likePairFor is total, symmetric and never returns its input", () => {
  for (const s of SYMBOLS) {
    const partner = likePairFor(s);
    assert.notEqual(partner, s, `${s} must not pair with itself`);
    assert.ok((SYMBOLS as readonly string[]).includes(partner), `${s} -> ${partner} is a picker symbol`);
    assert.equal(LIKE_PAIR[partner], s, `${s} <-> ${partner} is symmetric`);
  }
  assert.equal(likePairFor("spy"), "QQQ");
  assert.equal(likePairFor("unknown"), "QQQ");
  assert.match(pair, /likePairFor\(headerSymbol\)/);
});

// The Gamma Terminal opens its second ladder on the SAME index's other book
// (the ETF against its cash index, a future against the index whose chain
// supplies its levels) rather than on Pair Comparison's cross-index like-pair,
// so the page starts on one underlying read through two books.
test("the terminal's second ladder defaults to the same-index counterpart", () => {
  assert.deepEqual(SAME_INDEX_PAIR, {
    SPY: "SPX",
    SPX: "SPY",
    ES: "SPX",
    QQQ: "NDX",
    NDX: "QQQ",
    NQ: "NDX",
  });
  for (const s of SYMBOLS) {
    const partner = sameIndexPairFor(s);
    assert.notEqual(partner, s, `${s} must not pair with itself`);
    assert.ok((SYMBOLS as readonly string[]).includes(partner), `${s} -> ${partner} is a picker symbol`);
  }
  assert.equal(sameIndexPairFor("spy"), "SPX");
  assert.equal(sameIndexPairFor("unknown"), "QQQ", "falls back to the like-pair default");
  // Both the opening default and the collision fallback use it — and Pair
  // Comparison keeps its own like-pair default.
  assert.match(surface, /useState<UnderlyingSymbol>\(\(\) => sameIndexPairFor\(sym1\)\)/);
  assert.match(surface, /sym2Pref === sym1\s*\?\s*sameIndexPairFor\(sym1\)/);
  assert.doesNotMatch(surface, /likePairFor/);
  assert.doesNotMatch(pair, /sameIndexPairFor/);
});

// Both pages render the identical symbol dropdown.
test("Pair Comparison and the Gamma Terminal share one SymbolSelect", () => {
  assert.match(pair, /import SymbolSelect from "@\/components\/SymbolSelect"/);
  assert.match(surface, /import SymbolSelect from "@\/components\/SymbolSelect"/);
  assert.doesNotMatch(pair, /function SymbolSelect\(/);
});

// Rewind drives both ladders: the chart broadcasts its replay clock and each
// column receives it, so the book beside the tape is the book as of the same
// moment rather than the live tip.
test("both ladders follow the chart's rewind clock", () => {
  assert.match(surface, /const rewindTime = rewind\.active \? rewind\.time : null;/);
  assert.equal((surface.match(/rewindTime,\n\s*\}\);/g) ?? []).length, 2, "both ladder columns take the clock");
  assert.match(chart, /onRewind\?\.\(\{ active: rewindActive, time: rewindActive \? rewindTime : null \}\)/);
  const hook = read("../hooks/useGammaLadder.ts");
  assert.match(hook, /bucketAtOrNearest\(history, rewindMs as number\)/);
  assert.match(hook, /positioningKind: "rewind" as const/);
});

// The ribbons' opacity is user-adjustable and persisted, with the default a
// notch under the tuned look.
test("ribbon opacity is adjustable, persisted per surface, and defaults to 90%", () => {
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
  assert.match(chart, /const sessionStart = scope === "session" \? lastSessionStartIndex\(bars, symbol\) : 0;/);
  // The area breaks at that open rather than drawing a cliff off the flat run.
  assert.match(chart, /segments: signedAreaSegments\(values, \[sessionStart\]\)/);
  // A bar before the open has no total to report, so the readout dashes it.
  assert.match(chart, /activeIdx < netVolume\.sessionStart \? \(/);
});
