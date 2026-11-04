// Guards the gamma ladders' basis (core/ladderBasis.ts): the persisted
// OI / Volume preference, the /api/gex/volume-gamma-by-strike read each
// column makes in volume mode, and the cells it turns into — plus the wiring
// that keeps every ladder surface on the one shared preference and the volume
// rows live-only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Minimal localStorage stand-in, installed before the module's window-guarded
// reads/writes run (mirrors tests/sessionDelta.test.ts).
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

const memory = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: memory };

// Imported AFTER the window stub so any window-guarded path sees it.
const {
  LADDER_BASIS_STORAGE_KEY,
  parseLadderBasis,
  readStoredLadderBasis,
  writeStoredLadderBasis,
  volumeGammaUrl,
  volumeLadderCells,
} = await import("../core/ladderBasis.ts");

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test.beforeEach(() => {
  memory.clear();
});

// ---- persisted preference ---------------------------------------------------

test("only an explicit 'volume' switches the basis; everything else is open interest", () => {
  assert.equal(parseLadderBasis("volume"), "volume");
  for (const raw of ["oi", null, undefined, "", "VOLUME", "vol", "on"]) {
    assert.equal(parseLadderBasis(raw), "oi", `raw=${String(raw)}`);
  }
});

test("the preference round-trips through storage and defaults to open interest", () => {
  assert.equal(readStoredLadderBasis(), "oi");
  writeStoredLadderBasis("volume");
  assert.equal(memory.getItem(LADDER_BASIS_STORAGE_KEY), "volume");
  assert.equal(readStoredLadderBasis(), "volume");
  writeStoredLadderBasis("oi");
  assert.equal(readStoredLadderBasis(), "oi");
});

test("unavailable storage reads as open interest and writes nothing", () => {
  const original = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
    },
  };
  try {
    assert.equal(readStoredLadderBasis(), "oi");
    assert.doesNotThrow(() => writeStoredLadderBasis("volume"));
  } finally {
    (globalThis as { window?: unknown }).window = original;
  }
});

// ---- the read ---------------------------------------------------------------

test("the volume read carries the symbol and the open-interest tip's expirations param", () => {
  const url = new URL(volumeGammaUrl("SPX", "2026-11-03,2026-11-04"), "https://zerogex.io");
  assert.equal(url.pathname, "/api/gex/volume-gamma-by-strike");
  assert.equal(url.searchParams.get("symbol"), "SPX");
  assert.equal(url.searchParams.get("underlying"), "SPX");
  assert.equal(url.searchParams.get("expirations"), "2026-11-03,2026-11-04");
  assert.equal(new URL(volumeGammaUrl("ES", ""), "https://zerogex.io").searchParams.get("expirations"), "all");
});

test("cells are one per strike, the net volume-weighted gamma in the net_gex slot", () => {
  const cells = volumeLadderCells({
    symbol: "SPX",
    timestamp: "2026-11-03T20:59:00+00:00",
    spot_price: 7568.09,
    strikes: [
      { strike: 7565, call_gex: 1.5e8, put_gex: -2.5e8, net_gex: -1.0e8, call_volume: 1200, put_volume: 3400 },
      { strike: "7570", net_gex: "200000000" },
      { strike: 7575, net_gex: null }, // nothing traded: reads 0, which the Active filter hides
      { strike: 0, net_gex: 5 },
      { strike: null, net_gex: 5 },
      { strike: "n/a", net_gex: 5 },
    ],
  });
  assert.deepEqual(cells, [
    { strike: 7565, net_gex: -1.0e8 },
    { strike: 7570, net_gex: 2.0e8 },
    { strike: 7575, net_gex: 0 },
  ]);
});

test("no response, or an empty snapshot, is no cells", () => {
  assert.deepEqual(volumeLadderCells(null), []);
  assert.deepEqual(volumeLadderCells(undefined), []);
  assert.deepEqual(volumeLadderCells({ symbol: "SPY", timestamp: null, spot_price: null, strikes: [] }), []);
  assert.deepEqual(volumeLadderCells({ symbol: "SPY", strikes: null }), []);
});

// ---- wiring -----------------------------------------------------------------

test("the hook reads volume rows live only, and gives them no Session Δ baseline", () => {
  const hook = read("../hooks/useGammaLadder.ts");
  assert.match(hook, /const volumeMode = options\?\.basis === "volume" && !rewinding;/);
  assert.match(hook, /volumeMode \? volumeGammaUrl\(symbol, expParam\) : ""/);
  assert.match(hook, /enabled: enabled && volumeMode,/);
  assert.match(hook, /const sessionDeltaOn = !!options\?\.sessionDelta && !volumeMode;/);
  assert.match(hook, /cells: volumeMode \? volumeLadderCells\(volumeData\) : bucketCells\(liveBucket\),/);
  // A rewinding column is the open-interest book, labeled as such.
  assert.match(hook, /cells: bucketCells\(bucket\),\s*basis: "oi" as const,/);
});

test("every ladder surface passes the one shared basis to its columns", () => {
  const surfaces: Array<[string, number]> = [
    ["../app/chart/TerminalSurface.tsx", 2],
    ["../app/pair-comparison/PairComparisonClient.tsx", 2],
    ["../app/my-dashboard/panels.tsx", 1],
  ];
  for (const [file, columns] of surfaces) {
    const src = read(file);
    assert.match(src, /const \{ ladderBasis \} = useLadderBasis\(\);/, file);
    assert.equal((src.match(/basis: ladderBasis,/g) ?? []).length, columns, `${file}: every column`);
    assert.match(src, /<LadderBasisToggle showHint=\{false\} \/>/, file);
  }
});

test("the delayed Gamma Terminal does not offer the basis toggle", () => {
  const surface = read("../app/chart/TerminalSurface.tsx");
  assert.match(surface, /\{live && \(\s*<div className="flex items-center gap-2">\s*<span className="zg-eyebrow" style=\{\{ fontSize: 10 \}\}>Basis<\/span>/);
});

test("the provider wraps the app, so every surface reads the same preference", () => {
  const layout = read("../app/layout.tsx");
  assert.match(layout, /<LadderBasisProvider>/);
});

test("a volume column relabels its values, so it can't pass for Net GEX", () => {
  const heatmap = read("../components/PairGammaHeatmap.tsx");
  assert.match(heatmap, /input\.basis === "volume" \?/);
  assert.match(heatmap, /Γ × Vol \(\{unitLabel\}\)/);
});
