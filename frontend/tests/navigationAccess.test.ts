import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV_GROUPS, type NavItem } from '../core/navigation.ts';
import { navItemRequiredTier, requiredTierForRoute } from '../core/auth.ts';

process.env.NEXT_PUBLIC_AUTH_ENABLED = '1';

// Every entry the sidebar/header can render, flattened: top-level items,
// subgroup headers, and subgroup items. External links (absolute URLs) are
// excluded — they are not internal routes and carry their own gating.
type Entry = { id?: string; requiredTier?: NavItem['requiredTier']; external?: boolean };

const entries: Entry[] = [];
for (const group of NAV_GROUPS) {
  for (const item of group.items ?? []) entries.push(item);
  for (const sg of group.subgroups ?? []) {
    entries.push({ id: sg.id, requiredTier: sg.requiredTier });
    for (const item of sg.items) entries.push(item);
  }
}

// The invariant that keeps the menu honest: what the nav *declares* for an
// entry must equal what the route table (core/auth.ts) actually *enforces*.
// When these drift, the nav either advertises a page the middleware then
// blocks, or — worse — shows a paid page to visitors who can open it because
// no rule gates it (the /forced-flow and /premium-heatmap leaks this suite
// was added to prevent regressing).
test('every nav entry declares the same tier the route table enforces', () => {
  for (const entry of entries) {
    if (entry.external || !entry.id) continue;
    const route = requiredTierForRoute(entry.id);
    if (entry.requiredTier) {
      assert.equal(
        route,
        entry.requiredTier,
        `${entry.id}: nav declares '${entry.requiredTier}' but the route rule resolves to '${route}'`,
      );
    } else {
      assert.equal(
        route,
        null,
        `${entry.id}: nav declares no tier (public) but the route rule gates it at '${route}'`,
      );
    }
  }
});

// The gate the nav actually renders against, per current config, must equal the
// enforced rule for every entry — no entry resolves looser (or stricter) than
// the middleware.
test('navItemRequiredTier matches the enforced rule for every nav entry', () => {
  for (const entry of entries) {
    if (entry.external || !entry.id) continue;
    assert.equal(
      navItemRequiredTier(entry.id, entry.requiredTier ?? null),
      requiredTierForRoute(entry.id),
      `${entry.id}: effective nav tier diverges from the route rule`,
    );
  }
});

// The helper is fail-closed: it takes the STRICTER of the declared tier and the
// route rule, so a future nav item with a missing/looser route rule can never
// silently leak into a lower tier's menu.
test('navItemRequiredTier is fail-closed (stricter of declared vs route wins)', () => {
  // Declared stricter than the route rule → declared wins (never under-gates).
  assert.equal(navItemRequiredTier('/gamma-exposure', 'pro'), 'pro'); // route rule: basic
  // Route rule stricter than the declared tier → route wins.
  assert.equal(navItemRequiredTier('/signal-score', 'basic'), 'pro'); // route rule: pro
  // No route rule but a declared tier → the declared tier still holds.
  assert.equal(navItemRequiredTier('/not-a-real-route', 'basic'), 'basic');
  // Neither a rule nor a declaration → public (null).
  assert.equal(navItemRequiredTier('/not-a-real-route', null), null);
  // A known public route with no declaration → public (null).
  assert.equal(navItemRequiredTier('/about', null), null);
});
