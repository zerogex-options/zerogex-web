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
  assert.match(client, /import GammaTerminalChart from "@\/components\/GammaTerminalChart"/);
  assert.match(client, /<GammaTerminalChart \/>/);
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
