// Guards the gamma ladder's "Δ since open" primitives (core/sessionDelta.ts):
// the 09:30 ET session-open anchor (DST-correct without a tz library), the
// per-strike baseline summed across an expiration selection from one
// /api/replay/frame snapshot, the noise-gated up/down classification behind
// the green▲/red▼ triangles, and the persisted display preference.
import test from "node:test";
import assert from "node:assert/strict";

// Minimal localStorage stand-in, installed before the module's window-guarded
// reads/writes run (mirrors tests/strikeFilter.test.ts).
class MemoryStorage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
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
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
}

const memory = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: memory };

// Imported AFTER the window stub so any window-guarded path sees it.
const {
  sessionOpenIsoFor,
  baselineNetByStrike,
  sessionDeltaMark,
  sessionDeltaTitle,
  parseSessionDelta,
  readStoredSessionDelta,
  writeStoredSessionDelta,
  SESSION_DELTA_STORAGE_KEY,
} = await import("../core/sessionDelta.ts");

test.beforeEach(() => {
  memory.clear();
});

// ---- session-open anchor ----------------------------------------------------

test("sessionOpenIsoFor resolves 09:30 ET on the instant's ET date (EDT)", () => {
  // 18:00Z on an August day = 14:00 EDT → open is 09:30 EDT = 13:30Z.
  assert.equal(sessionOpenIsoFor("2026-08-20T18:00:00Z"), "2026-08-20T13:30:00.000Z");
});

test("sessionOpenIsoFor resolves 09:30 ET under EST (winter)", () => {
  // January: ET is UTC-5, so 09:30 ET = 14:30Z.
  assert.equal(sessionOpenIsoFor("2026-01-15T18:00:00Z"), "2026-01-15T14:30:00.000Z");
});

test("sessionOpenIsoFor keys off the ET date, not the UTC date", () => {
  // 01:00Z Aug 21 is still 21:00 ET Aug 20 — the session is Aug 20's.
  assert.equal(sessionOpenIsoFor("2026-08-21T01:00:00Z"), "2026-08-20T13:30:00.000Z");
});

test("sessionOpenIsoFor returns null for missing/garbage input", () => {
  assert.equal(sessionOpenIsoFor(null), null);
  assert.equal(sessionOpenIsoFor(undefined), null);
  assert.equal(sessionOpenIsoFor("not-a-time"), null);
});

// ---- baseline aggregation ---------------------------------------------------

const FRAME_ROWS = [
  { strike: 600, expiration: "2026-08-21", net_gex: 100 },
  { strike: 600, expiration: "2026-08-28", net_gex: 40 },
  { strike: 605, expiration: "2026-08-21", net_gex: -30 },
  // PG numerics can arrive as strings; both fields must coerce.
  { strike: "605", expiration: "2026-08-28", net_gex: "-20" },
  { strike: null, expiration: "2026-08-21", net_gex: 999 }, // dropped
  { strike: 610, expiration: "2026-08-21", net_gex: null }, // dropped
];

test("baselineNetByStrike sums every expiration when the selection is All ([])", () => {
  const base = baselineNetByStrike(FRAME_ROWS, []);
  assert.equal(base.get(600), 140);
  assert.equal(base.get(605), -50);
  assert.equal(base.has(610), false);
});

test("baselineNetByStrike restricts to the selected expirations", () => {
  const base = baselineNetByStrike(FRAME_ROWS, ["2026-08-28"]);
  assert.equal(base.get(600), 40);
  assert.equal(base.get(605), -20);
  const both = baselineNetByStrike(FRAME_ROWS, ["2026-08-21", "2026-08-28"]);
  assert.equal(both.get(600), 140);
});

test("baselineNetByStrike tolerates a missing frame", () => {
  assert.equal(baselineNetByStrike(null, []).size, 0);
  assert.equal(baselineNetByStrike(undefined, ["2026-08-21"]).size, 0);
});

// ---- delta classification ---------------------------------------------------

test("sessionDeltaMark marks builds up and erosions down", () => {
  assert.deepEqual(sessionDeltaMark(150, 100, 0), { dir: "up", delta: 50, pct: 0.5 });
  assert.deepEqual(sessionDeltaMark(60, 100, 0), { dir: "down", delta: -40, pct: 0.4 });
  // More-negative net gamma is an erosion too — sign-honest, like Gamma Shift.
  assert.equal(sessionDeltaMark(-150, -100, 0)?.dir, "down");
  assert.equal(sessionDeltaMark(-50, -100, 0)?.dir, "up");
});

test("sessionDeltaMark suppresses moves under the absolute noise floor", () => {
  assert.equal(sessionDeltaMark(104, 100, 5), null);
  assert.notEqual(sessionDeltaMark(110, 100, 5), null);
});

test("sessionDeltaMark suppresses drift under 5% of the strike's own baseline", () => {
  assert.equal(sessionDeltaMark(1030, 1000, 0), null); // +3% — drift
  assert.notEqual(sessionDeltaMark(1060, 1000, 0), null); // +6% — real
});

test("sessionDeltaMark treats a missing/zero baseline as new positioning", () => {
  const mark = sessionDeltaMark(50, undefined, 10);
  assert.equal(mark?.dir, "up");
  assert.equal(mark?.pct, null);
  assert.equal(sessionDeltaMark(0, undefined, 0), null); // nothing → nothing
});

test("sessionDeltaTitle reads as a sentence for both directions", () => {
  const up = sessionDeltaMark(200, 100, 0)!;
  assert.match(sessionDeltaTitle(up), /building/);
  assert.match(sessionDeltaTitle(up), /\+100% vs open/);
  const fresh = sessionDeltaMark(50, 0, 0)!;
  assert.match(sessionDeltaTitle(fresh), /new since open/);
});

// ---- preference persistence -------------------------------------------------

test("parseSessionDelta defaults off for anything but the explicit 'on' opt-in", () => {
  assert.equal(parseSessionDelta("on"), "on");
  assert.equal(parseSessionDelta("off"), "off");
  assert.equal(parseSessionDelta(null), "off");
  assert.equal(parseSessionDelta("garbage"), "off");
});

test("write then read round-trips the preference (survives reload)", () => {
  assert.equal(readStoredSessionDelta(), "off");
  writeStoredSessionDelta("on");
  assert.equal(memory.getItem(SESSION_DELTA_STORAGE_KEY), "on");
  assert.equal(readStoredSessionDelta(), "on");
  writeStoredSessionDelta("off");
  assert.equal(readStoredSessionDelta(), "off");
});
