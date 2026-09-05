import assert from "node:assert/strict";
import test from "node:test";
import {
  RIBBON_BUCKET_MS,
  RIBBON_RY_FRACTION,
  RIBBON_RY_MAX,
  RIBBON_TIER_OPACITY,
  buildRibbonLayer,
  ellipsePath,
  inferStrikeStep,
  ribbonBucketKey,
  tierFor,
  type RibbonGeometry,
} from "../core/gexRibbons.ts";

const T0 = Date.parse("2026-09-04T13:30:00Z"); // 09:30 ET, on the 5-min grid
const iso = (ms: number) => new Date(ms).toISOString();

// A linear tape: 1 viewBox px per index, 10 px per $1 with the window 740..760.
const geom: RibbonGeometry = {
  xForIndex: (i) => 20 + i * 8,
  yPrice: (p) => 460 - (p - 740) * 10,
  xStep: 8,
  dMin: 740,
  dMax: 760,
};

// Largest ry in a path group — the arc radii are the 4th/5th tokens after "A".
function maxRy(d: string): number {
  let best = 0;
  for (const m of d.matchAll(/A ([\d.]+) ([\d.]+) /g)) best = Math.max(best, Number(m[2]));
  return best;
}

test("bar starts floor onto the 5-minute bucket grid", () => {
  assert.equal(ribbonBucketKey(T0), T0);
  assert.equal(ribbonBucketKey(T0 + 60_000), T0);
  assert.equal(ribbonBucketKey(T0 + 4 * 60_000 + 59_000), T0);
  assert.equal(ribbonBucketKey(T0 + 5 * 60_000), T0 + RIBBON_BUCKET_MS);
});

test("strike step is the smallest positive gap between distinct strikes", () => {
  assert.equal(inferStrikeStep([748, 749, 750, 751]), 1);
  assert.equal(inferStrikeStep([7500, 7505, 7510, 7510]), 5);
  assert.equal(inferStrikeStep([26300]), null);
  assert.equal(inferStrikeStep([]), null);
});

test("tiers split at 15% and 50% of the strongest orb", () => {
  assert.equal(tierFor(1), "strong");
  assert.equal(tierFor(0.5), "strong");
  assert.equal(tierFor(0.49), "mid");
  assert.equal(tierFor(0.15), "mid");
  assert.equal(tierFor(0.1), "weak");
  assert.ok(RIBBON_TIER_OPACITY.strong > RIBBON_TIER_OPACITY.mid && RIBBON_TIER_OPACITY.mid > RIBBON_TIER_OPACITY.weak);
});

test("an orb is two absolute arcs so many can share one path", () => {
  assert.equal(ellipsePath(100, 50, 4, 2), "M 96.0 50.0 A 4.00 2.00 0 1 0 104.0 50.0 A 4.00 2.00 0 1 0 96.0 50.0 Z");
});

test("bars read the bucket containing their start; 1-min bars repeat the 5-min orb", () => {
  const buckets = [
    { timestamp: iso(T0), strikes: [{ strike: 750, net_gamma: 1_000 }] },
    { timestamp: iso(T0 + RIBBON_BUCKET_MS), strikes: [{ strike: 750, net_gamma: -1_000 }] },
  ];
  const bars = [0, 1, 2, 3, 4, 5, 6].map((m) => ({ timestamp: iso(T0 + m * 60_000) }));
  const layer = buildRibbonLayer(bars, buckets, geom);
  assert.equal(layer.count, 7);
  const pos = layer.paths.find((p) => p.positive);
  const neg = layer.paths.find((p) => !p.positive);
  assert.ok(pos && neg);
  // Five 1-min bars in the first bucket, two in the second.
  assert.equal((pos.d.match(/M /g) ?? []).length, 5);
  assert.equal((neg.d.match(/M /g) ?? []).length, 2);
  // Every orb sits on the strike's price line.
  assert.match(pos.d, /M 16\.5 360\.0 /);
});

test("strikes outside the price window and bars without a bucket draw nothing", () => {
  const buckets = [
    { timestamp: iso(T0), strikes: [{ strike: 750, net_gamma: 500 }, { strike: 770, net_gamma: 9_000 }, { strike: 735, net_gamma: -9_000 }] },
  ];
  const bars = [{ timestamp: iso(T0) }, { timestamp: iso(T0 - RIBBON_BUCKET_MS) }];
  const layer = buildRibbonLayer(bars, buckets, geom);
  assert.equal(layer.count, 1);
  assert.equal(layer.maxAbs, 500); // the off-window strikes never set the scale
  assert.equal(layer.paths.length, 1);
  assert.equal(layer.paths[0].strike, 750);
  assert.deepEqual(buildRibbonLayer(bars, [], geom), { paths: [], maxAbs: 0, strikeStep: null, count: 0 });
});

test("orb height follows magnitude, caps below the strike gap, and the noise floor drops slivers", () => {
  const buckets = [
    {
      timestamp: iso(T0),
      strikes: [
        { strike: 750, net_gamma: 2_000_000 }, // the wall
        { strike: 751, net_gamma: 500_000 },
        { strike: 752, net_gamma: 20_000 }, // 1% of the wall → below the floor
        { strike: 748, net_gamma: "-1000000" }, // string payloads coerce
      ],
    },
  ];
  const layer = buildRibbonLayer([{ timestamp: iso(T0) }], buckets, geom);
  assert.equal(layer.strikeStep, 1);
  assert.equal(layer.count, 3);
  const ry = new Map(layer.paths.map((p) => [p.strike, maxRy(p.d)]));
  assert.ok((ry.get(750) ?? 0) > (ry.get(751) ?? 0), "wall orb is taller");
  assert.ok((ry.get(750) ?? 0) <= 10 * RIBBON_RY_FRACTION + 1e-9, "never taller than the strike gap");
  assert.equal(ry.has(752), false);
  assert.equal(layer.paths.find((p) => p.strike === 748)?.positive, false);
  assert.equal(layer.paths.find((p) => p.strike === 750)?.tier, "strong");
  assert.equal(layer.paths.find((p) => p.strike === 751)?.tier, "mid");
});

// Zooming the price axis in (a 1-min chart a dollar tall) makes a $1 lane
// hundreds of units tall; the orb must stop growing at the absolute cap so
// the ribbon reads the same at every zoom instead of ballooning.
test("orb height stops at the absolute cap when the strike lane is huge", () => {
  const zoomed: RibbonGeometry = { ...geom, yPrice: (p) => 460 - (p - 740) * 200, dMin: 749, dMax: 751 };
  // Two strikes so the $1 lane is known (200 units tall at this zoom).
  const buckets = [{ timestamp: iso(T0), strikes: [{ strike: 750, net_gamma: 1_000 }, { strike: 751, net_gamma: 100 }] }];
  const layer = buildRibbonLayer([{ timestamp: iso(T0) }], buckets, zoomed);
  assert.equal(layer.strikeStep, 1);
  const ry = maxRy(layer.paths.find((p) => p.strike === 750)?.d ?? "");
  assert.ok(ry <= RIBBON_RY_MAX + 1e-9, `capped: ${ry}`);
  assert.ok(ry > RIBBON_RY_MAX - 1, "a wall orb fills the cap");
});
