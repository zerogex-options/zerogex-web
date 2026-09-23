#!/usr/bin/env node
// Run from the frontend/ directory:
//   node --experimental-strip-types scripts/forecast-range-width.mts \
//     [--symbol SPX] [--limit 120] [--target 0.8] [--json]
//
// READ-ONLY. Answers one question: by how much is the morning projected range
// wider than it needs to be?
//
// WHY. /api/forecast/stats/rolling reported SPX coverage of 29/29 against an
// 80% target on 2026-09-22. If true coverage were 80%, 29 for 29 has
// probability 0.8^29 ~ 0.0015, and the published CI puts true coverage at
// 88% or better. So the band is padded — but a COVERAGE RATE CANNOT SAY BY
// HOW MUCH. Coverage is a tail probability, so its relationship to width is
// sharply non-linear, and narrowing by feel risks overshooting into
// under-coverage, which is a real failure rather than a cosmetic one.
//
// THE METHOD. For each graded session, find the smallest scale factor k that
// would still have contained the day, where the band is scaled about the
// OPEN SPOT:
//
//     high(k) = open + k * (projected_high - open)
//     low(k)  = open - k * (open - projected_low)
//
// The day is contained iff k >= (actual_high - open) / (projected_high - open)
// AND k >= (open - actual_low) / (open - projected_low), so k_min for that
// session is the larger of the two. Scaled per side rather than as one
// half-width because the band is bounded by the call and put walls, which are
// not equidistant from spot — treating it as symmetric would mis-attribute
// the slack.
//
// Sort k_min across sessions and the p-th percentile is, by construction, the
// scale factor that would have produced exactly p% coverage. That is the
// number to feed back into the range model.
//
// THIS IS IN-SAMPLE. It fits k to the same sessions it measures on, so it is
// a starting estimate and not a validated parameter. Treat the result as "try
// this and watch coverage forward", not as a tuned constant. The script says
// so in its own output.
//
// The range model itself lives in the backend (zerogex-oa), not here. This
// only measures.

import fs from 'node:fs';
import path from 'node:path';

type Args = { symbol: string; limit: number; target: number; model: string | null; since: string | null; json: boolean; help: boolean };

function parseArgs(argv: string[]): Args {
  const a: Args = { symbol: 'SPX', limit: 120, target: 0.8, model: null, since: null, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--symbol') a.symbol = (argv[++i] ?? 'SPX').toUpperCase();
    else if (v === '--limit') a.limit = Number(argv[++i] ?? 120);
    else if (v === '--target') a.target = Number(argv[++i] ?? 0.8);
    else if (v === '--model') a.model = argv[++i] ?? null;
    else if (v === '--since') a.since = argv[++i] ?? null;
    else if (v === '--json') a.json = true;
    else if (v === '--help' || v === '-h') a.help = true;
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Usage:
  node --experimental-strip-types scripts/forecast-range-width.mts \\
    [--symbol SPX] [--limit 120] [--target 0.8] [--model NAME] \\
    [--since YYYY-MM-DD] [--json]

Read-only. Measures how much the morning projected range could be narrowed
and still hit its coverage target. Writes nothing.

  --symbol S   ticker to analyse (default SPX)
  --limit  N   how many recent sessions to pull (default 120)
  --target P   coverage target as a fraction (default 0.8)
  --model  M   only sessions produced by this range model. History spans
               several model generations and a pooled scale factor describes
               a blend that no longer runs -- pass the live model to get a
               number worth acting on.
  --since  D   only sessions on or after YYYY-MM-DD. NEEDED BECAUSE --model
               is not always enough: the persistence anchor shipped on
               2026-08-05 without the range_model string being bumped, so
               rows either side of that date are stamped heuristic_v1_4 and
               are two different models. Those rows are immutable, so a date
               is the only way to separate them after the fact.
  --json       machine-readable output`);
  process.exit(0);
}
if (!Number.isFinite(args.target) || args.target <= 0 || args.target >= 1) {
  console.error('Error: --target must be a fraction strictly between 0 and 1.');
  process.exit(1);
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const env: Record<string, string> = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
const BASE = (process.env.ZEROGEX_API_BASE_URL || envLocal.ZEROGEX_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const TOKEN =
  process.env.ZEROGEX_API_TOKEN || process.env.ZEROGEX_API_KEY ||
  envLocal.ZEROGEX_API_TOKEN || envLocal.ZEROGEX_API_KEY;
if (!TOKEN) {
  console.error('Error: ZEROGEX_API_TOKEN (or legacy ZEROGEX_API_KEY) is required.');
  process.exit(1);
}

async function api<T>(pathname: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${pathname}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type DateEntry = { date: string; has_receipt: boolean; range_respected: boolean | null };
type Payload = {
  morning: {
    open_spot: number | null; projected_low: number | null; projected_high: number | null;
    range_model: string | null;
    // The width the model asked for, before the band was drawn. zerogex-oa
    // clamps it: VOL_RATIO_MAX = 1.90 in src/jobs/forecast_range_model.py. If
    // the sessions that broke the band were sitting ON that cap, the fat right
    // tail is a ceiling rather than a detection failure, and the fix is the
    // clamp instead of the regime model. That is the whole reason this field
    // is here.
    expected_vol_ratio: number | null;
    expected_vol_state: string | null;
  } | null;
  receipt: { actual_low: number | null; actual_high: number | null; range_respected: boolean | null } | null;
};

const dates = await api<{ dates: DateEntry[] }>(
  `/api/forecast/available-dates?symbol=${args.symbol}&limit=${args.limit}`,
);
if (!dates?.dates?.length) {
  console.error(`No forecast dates returned for ${args.symbol}.`);
  process.exit(1);
}

type Row = {
  date: string; k: number; kUp: number; kDown: number;
  contained: boolean; graded: boolean | null; model: string | null;
  upSlackPct: number; downSlackPct: number;
  volRatio: number | null; volState: string | null;
};

const rows: Row[] = [];
const skipped: Array<{ date: string; why: string }> = [];

for (const entry of dates.dates) {
  if (!entry.has_receipt) { skipped.push({ date: entry.date, why: 'no receipt' }); continue; }
  const p = await api<Payload>(`/api/forecast/${entry.date}?symbol=${args.symbol}`);
  const m = p?.morning;
  const r = p?.receipt;
  if (!m || !r || m.open_spot == null || m.projected_low == null || m.projected_high == null
      || r.actual_low == null || r.actual_high == null) {
    skipped.push({ date: entry.date, why: 'incomplete' });
    continue;
  }
  const upHalf = m.projected_high - m.open_spot;
  const downHalf = m.open_spot - m.projected_low;
  if (!(upHalf > 0) || !(downHalf > 0)) { skipped.push({ date: entry.date, why: 'degenerate band' }); continue; }

  // Negative when the day never traded through the open on that side; the
  // other side then governs, which max() handles without clamping.
  const kUp = (r.actual_high - m.open_spot) / upHalf;
  const kDown = (m.open_spot - r.actual_low) / downHalf;
  const k = Math.max(kUp, kDown);
  rows.push({
    date: entry.date, k, kUp, kDown,
    contained: k <= 1,
    graded: r.range_respected,
    model: m.range_model,
    volRatio: m.expected_vol_ratio,
    volState: m.expected_vol_state,
    upSlackPct: (1 - kUp) * 100,
    downSlackPct: (1 - kDown) * 100,
  });
}

if (rows.length === 0) {
  console.error('No gradeable sessions found.');
  process.exit(1);
}

const allRows = rows.slice();
if (args.since) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.since)) {
    console.error(`Error: --since expects YYYY-MM-DD, got "${args.since}".`);
    process.exit(1);
  }
  const keep = rows.filter((r) => r.date >= args.since!);
  if (keep.length === 0) {
    console.error(`No sessions on or after ${args.since}.`);
    process.exit(1);
  }
  rows.length = 0;
  rows.push(...keep);
}
if (args.model) {
  const keep = rows.filter((r) => r.model === args.model);
  if (keep.length === 0) {
    const seen = [...new Set(allRows.map((r) => r.model ?? '(none)'))].join(', ');
    console.error(`No sessions with range model "${args.model}". Models present: ${seen}`);
    process.exit(1);
  }
  rows.length = 0;
  rows.push(...keep);
}

/**
 * The ceiling zerogex-oa puts on the expected-vol ratio
 * (VOL_RATIO_MAX in src/jobs/forecast_range_model.py, release @ 39f2819).
 *
 * Hard-coded here on purpose: this repo cannot import from that one, and an
 * obviously duplicated constant beats a silently drifting one. If the backend
 * raises the cap, raise it here too or the readout below starts lying about
 * which sessions were clipped.
 */
const VOL_RATIO_MAX = 1.90;
const AT_CAP_EPSILON = 0.01;

const atCap = (r: number | null): boolean =>
  r != null && Number.isFinite(r) && r >= VOL_RATIO_MAX - AT_CAP_EPSILON;

/** Nearest-rank percentile: with n=29 the answer must be an observed value. */
function percentile(sorted: number[], p: number): number {
  const rank = Math.max(1, Math.ceil(p * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1];
}

// Does k <= 1 mean the same thing the backend means by range_respected? If it
// does not, k is measuring some other band and every number below is answering
// the wrong question -- so say so loudly rather than quietly reporting a width.
const disagreements = rows.filter((r) => r.graded != null && r.graded !== r.contained);

const ks = rows.map((r) => r.k).sort((a, b) => a - b);
const coverageNow = rows.filter((r) => r.contained).length / rows.length;
const kTarget = percentile(ks, args.target);
const coverageAt = (k: number) => rows.filter((r) => r.k <= k).length / rows.length;
const median = (xs: number[]) => percentile([...xs].sort((a, b) => a - b), 0.5);

if (args.json) {
  console.log(JSON.stringify({
    symbol: args.symbol, model: args.model, since: args.since, n: rows.length, nAll: allRows.length, skipped: skipped.length,
    disagreements: disagreements.map((r) => ({ date: r.date, k: r.k, graded: r.graded })),
    volRatioMax: VOL_RATIO_MAX,
    clippedSessions: allRows.filter((r) => atCap(r.volRatio)).map((r) => r.date),
    missesAtCap: allRows.filter((r) => !r.contained && atCap(r.volRatio)).map((r) => r.date),
    coverageNow, target: args.target, kTarget,
    kPercentiles: Object.fromEntries([10, 25, 50, 75, 80, 90, 95, 100].map((p) => [p, percentile(ks, p / 100)])),
    medianUpSlackPct: median(rows.map((r) => r.upSlackPct)),
    medianDownSlackPct: median(rows.map((r) => r.downSlackPct)),
    rows,
  }, null, 2));
  process.exit(0);
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

console.log(`Projected-range width — ${args.symbol}${args.model ? ` · ${args.model}` : ''}${args.since ? ` · since ${args.since}` : ''}\n`);
console.log(`Graded sessions    ${rows.length}${skipped.length ? `   (${skipped.length} skipped)` : ''}`
  + (args.model || args.since ? `   [filtered from ${allRows.length}]` : ''));
console.log(`Coverage now       ${pct(coverageNow)}  (${rows.filter((r) => r.contained).length}/${rows.length})`);
console.log(`Target             ${pct(args.target)}\n`);

if (disagreements.length) {
  console.log(`!! ${disagreements.length} session(s) where k<=1 disagrees with the graded verdict:`);
  for (const r of disagreements.slice(0, 5)) {
    console.log(`     ${r.date}  k = ${r.k.toFixed(3)}  graded ${r.graded ? 'held' : 'broken'}`);
  }
  console.log('   This band is not the one being graded. Read nothing below until that');
  console.log('   is explained -- the width it reports would be for the wrong band.\n');
}

console.log('Smallest scale factor k that would still have contained each day');
console.log('  (k = 1.00 is the band as published; k = 0.70 is 30% narrower)\n');
for (const p of [10, 25, 50, 75, 80, 90, 95, 100]) {
  const mark = p === Math.round(args.target * 100) ? '  <- target' : '';
  console.log(`  p${String(p).padStart(3)}   k = ${percentile(ks, p / 100).toFixed(3)}${mark}`);
}

console.log(`\nA band scaled to k = ${kTarget.toFixed(3)} would have produced exactly ${pct(args.target)} coverage`);
console.log(`on this sample — i.e. ${((1 - kTarget) * 100).toFixed(0)}% narrower than what shipped.\n`);

console.log('Coverage at a range of widths');
for (const k of [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) {
  const bar = '#'.repeat(Math.round(coverageAt(k) * 40));
  console.log(`  k=${k.toFixed(2)}  ${pct(coverageAt(k)).padStart(6)}  ${bar}`);
}

console.log('\nWhere the slack sits (median unused share of each side)');
console.log(`  upside    ${median(rows.map((r) => r.upSlackPct)).toFixed(1)}%`);
console.log(`  downside  ${median(rows.map((r) => r.downSlackPct)).toFixed(1)}%`);
// Segmented by model, because history spans several generations of the range
// model and a scale factor pooled across them describes a blend that no longer
// runs. A retired model that habitually BROKE its band drags the pooled
// percentile up and makes the live model look less padded than it is.
const byModel = new Map<string, Row[]>();
for (const r of allRows) {
  const key = r.model ?? '(none)';
  if (!byModel.has(key)) byModel.set(key, []);
  byModel.get(key)!.push(r);
}
if (byModel.size > 1) {
  console.log('\nBy range model — the pooled number above is a blend of these');
  console.log('  model                    n   held     p50     p80     p95     max');
  const ordered = [...byModel.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [model, arr] of ordered) {
    const mk = arr.map((r) => r.k).sort((a, b) => a - b);
    const held = arr.filter((r) => r.contained).length;
    const cells = [0.5, 0.8, 0.95, 1].map((q) => percentile(mk, q).toFixed(3).padStart(7)).join(' ');
    const thin = arr.length < 10 ? '  (too few to read percentiles)' : '';
    console.log(
      `  ${model.padEnd(20)} ${String(arr.length).padStart(3)}  ${pct(held / arr.length).padStart(6)} ${cells}${thin}`,
    );
  }
}

const misses = allRows.filter((r) => !r.contained).sort((a, b) => b.k - a.k);
if (misses.length) {
  console.log(`\nSessions that broke the band (${misses.length} of ${allRows.length})`);
  console.log(`  date         needed k    asked for    vs cap ${VOL_RATIO_MAX.toFixed(2)}   model`);
  for (const r of misses) {
    const ratio = r.volRatio != null ? `${r.volRatio.toFixed(3)}x` : '—';
    const flag = atCap(r.volRatio) ? 'AT CAP' : r.volRatio != null ? 'under' : '—';
    console.log(
      `  ${r.date}   ${r.k.toFixed(3).padStart(8)}   ${ratio.padStart(9)}   ${flag.padStart(11)}   ${r.model ?? '(none)'}`,
    );
  }

  // THE QUESTION THIS COLUMN EXISTS TO ANSWER. A band that broke while the
  // model was already asking for the widest ratio it is ALLOWED to ask for was
  // not mispredicted -- it was clipped. No amount of better regime detection
  // helps while that ceiling stands, and no amount of raising the ceiling helps
  // if the model was asking for less than it was already permitted.
  const clipped = misses.filter((r) => atCap(r.volRatio));
  const withRatio = misses.filter((r) => r.volRatio != null);
  console.log('');
  if (withRatio.length === 0) {
    console.log('  No expected_vol_ratio on these payloads, so whether the cap bound them');
    console.log('  cannot be told from here.');
  } else if (clipped.length === withRatio.length) {
    console.log(`  EVERY miss sat at the ${VOL_RATIO_MAX.toFixed(2)}x ceiling. These were not mispredicted, they`);
    console.log('  were CLIPPED: the model asked for the widest band it is allowed and the day');
    console.log('  went further anyway. Raise VOL_RATIO_MAX before touching the regime logic.');
  } else if (clipped.length > 0) {
    console.log(`  ${clipped.length} of ${withRatio.length} misses sat at the ${VOL_RATIO_MAX.toFixed(2)}x ceiling -- clipped, not mispredicted.`);
    console.log(`  The other ${withRatio.length - clipped.length} asked for LESS width than they were already allowed, so`);
    console.log('  those are a prediction problem. Two different faults, two different fixes.');
  } else {
    console.log(`  NO miss sat at the ${VOL_RATIO_MAX.toFixed(2)}x ceiling. The cap is not the binding constraint:`);
    console.log('  on every one of these the model asked for less width than it was allowed, so');
    console.log('  this is a prediction problem, not a clamp problem.');
  }
  const liveModel = [...byModel.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  const stale = misses.filter((r) => (r.model ?? '(none)') !== liveModel).length;
  if (stale) {
    console.log(`  ${stale} of these came from a retired model, not the one running now.`);
  }
} else {
  console.log('\nNo session broke the band. Coverage is 100% and the band is padded by');
  console.log('an amount this sample cannot bound from above -- treat the widths as a floor.');
}

const clippedAll = allRows.filter((r) => atCap(r.volRatio));
if (clippedAll.length) {
  const held = clippedAll.filter((r) => r.contained).length;
  const share = (clippedAll.length / allRows.length) * 100;
  console.log(`\nSessions that hit the ${VOL_RATIO_MAX.toFixed(2)}x width ceiling: ${clippedAll.length} of ${allRows.length} (${share.toFixed(0)}%)`);
  console.log(`  ${held} of those still held. A ceiling that binds this often is SHAPING the`);
  console.log('  published band, not just guarding its tail.');
}

console.log(`\nIN-SAMPLE. k was fitted to the same ${rows.length} sessions it is measured on, so`);
console.log('this is a starting estimate, not a validated parameter. Narrow toward it and');
console.log('watch coverage forward rather than adopting it as a tuned constant — and note');
console.log('that under-coverage is a real failure, where over-coverage is only a wide band.');
