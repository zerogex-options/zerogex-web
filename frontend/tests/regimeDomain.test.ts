// Unit tests for the Dealer Gamma Structure y-domain.
//
// The panel has put lines off the top of the chart twice. The first cause was
// no cap at all, so the 0DTE close-of-session gamma spike flattened six hours
// of session into a flat line. The fix was a 95th-percentile cap, which then
// clipped the top 5% of EVERY session including the ordinary ones, so lines
// left the chart on days where everything would have fit.
//
// Both failures look the same to a reader and have opposite fixes, which is
// why the rule that chooses between them is tested rather than eyeballed.
import test from 'node:test';
import assert from 'node:assert/strict';

import { robustDomain, DOMAIN_OUTLIER_RATIO } from '../core/regimeDomain.ts';

const row = (stability: number, lean = 0) => ({ stability, lean });

test('an ordinary session fits entirely, clipping nothing', () => {
  // A smooth spread with no spike: every reading must be inside the domain.
  const rows = Array.from({ length: 80 }, (_, i) => row(1e8 + i * 1e6, -5e7));

  const { domain, clipped } = robustDomain(rows);

  assert.equal(clipped, 0);
  const max = Math.max(...rows.flatMap((r) => [Math.abs(r.stability), Math.abs(r.lean)]));
  assert.ok(domain[1] >= max, `domain ${domain[1]} must cover ${max}`);
});

test('a genuine close-of-session spike is still clipped', () => {
  // Seventy-nine ordinary bars and one an order of magnitude above them, which
  // is the shape 0DTE gamma actually takes into the close.
  const rows = [...Array.from({ length: 79 }, () => row(1e8, 5e7)), row(4e9, 5e7)];

  const { domain, clipped } = robustDomain(rows);

  assert.ok(clipped > 0, 'the spike should run off the top');
  assert.ok(domain[1] < 4e9, 'the domain should not be set by the spike');
});

test('the domain is symmetric so zero stays the middle of the panel', () => {
  // Lean and stability are signed, and a reader compares them against zero.
  const { domain } = robustDomain([row(3e8, -9e8), row(1e8, 2e8)]);

  assert.equal(domain[0], -domain[1]);
});

test('an extreme just under the ratio fits rather than clips', () => {
  const bulk = Array.from({ length: 99 }, () => row(1e8, 1e8));
  const justUnder = 1e8 * DOMAIN_OUTLIER_RATIO * 0.9;

  const { clipped } = robustDomain([...bulk, row(justUnder, 1e8)]);

  assert.equal(clipped, 0);
});

test('an extreme well past the ratio clips', () => {
  const bulk = Array.from({ length: 99 }, () => row(1e8, 1e8));
  const wellPast = 1e8 * DOMAIN_OUTLIER_RATIO * 5;

  const { clipped } = robustDomain([...bulk, row(wellPast, 1e8)]);

  assert.ok(clipped > 0);
});

test('nulls and non-finite readings are ignored, not treated as zero', () => {
  const rows = [
    { stability: 2e8, lean: null },
    { stability: null, lean: 1e8 },
    { stability: Number.NaN, lean: Number.POSITIVE_INFINITY },
  ];

  const { domain, clipped } = robustDomain(rows);

  assert.equal(clipped, 0);
  assert.ok(Number.isFinite(domain[1]) && domain[1] >= 2e8);
});

test('an empty session still yields a usable domain', () => {
  assert.deepEqual(robustDomain([]).domain, [-1, 1]);
  assert.deepEqual(robustDomain([{ stability: null, lean: null }]).domain, [-1, 1]);
});

test('an all-zero session does not collapse to a zero-height axis', () => {
  const { domain } = robustDomain([row(0, 0), row(0, 0)]);

  assert.ok(domain[1] > 0, 'a flat session still needs a drawable axis');
});
