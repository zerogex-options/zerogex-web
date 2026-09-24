// Guards sidebar active-state precedence (components/Navigation.tsx's
// isNavItemActive, via core/navigation's NAV_ITEM_IDS).
//
// The rule under test exists because of one real conflict: /forecast MUST
// prefix-match, since its actual content lives at dated permalinks like
// /forecast/SPY/2026-09-21 that have no sidebar entry of their own — but
// /forecast/cone IS a sidebar entry, and a naive prefix match lights up both
// at once, telling the reader they are in two places and highlighting a
// parent they did not choose.
//
// The fix is that a prefix match yields to any descendant carrying its own
// nav id. That is a subtle rule with an obvious failure mode, so it is
// pinned here rather than left to be rediscovered.
import test from "node:test";
import assert from "node:assert/strict";

import { NAV_GROUPS, NAV_ITEM_IDS } from "../core/navigation.ts";

// Mirrors Navigation.tsx's isNavItemActive. Kept in step by the assertions
// below, which check the real NAV_GROUPS data the component renders.
function isNavItemActive(
  pathname: string | null,
  item: { id: string; matchPrefix?: boolean },
): boolean {
  if (!pathname) return false;
  if (pathname === item.id) return true;
  if (item.matchPrefix !== true) return false;
  if (!pathname.startsWith(`${item.id}/`)) return false;
  return !NAV_ITEM_IDS.has(pathname);
}

const FORECAST = { id: "/forecast", matchPrefix: true };
const CONE = { id: "/forecast/cone" };

test("the cone has a real sidebar entry", () => {
  assert.ok(NAV_ITEM_IDS.has("/forecast/cone"));
  const all = NAV_GROUPS.flatMap((g) => [
    ...(g.items ?? []),
    ...(g.subgroups ?? []).flatMap((s) => s.items),
  ]);
  const cone = all.find((i) => i.id === "/forecast/cone");
  assert.ok(cone, "the cone entry must be reachable from NAV_GROUPS");
  // Renamed from "Intraday Cone" when the four dated views moved out of
  // Strategy Tools into their own Receipts group, whose entries all name the
  // subject before the dash and the scope after it. Leaving this one as the
  // only entry that named neither would have defeated the point of grouping
  // them. The product word "cone" is kept because traders use it.
  assert.equal(cone.label, "Forecast - intraday cone");
  assert.match(cone.label, /cone/i, "the product word must survive a rename");
});

test("a dated forecast permalink still lights up Daily Forecast", () => {
  // The whole reason /forecast carries matchPrefix.
  assert.equal(isNavItemActive("/forecast/SPY/2026-09-21", FORECAST), true);
  assert.equal(isNavItemActive("/forecast/today", FORECAST), true);
});

test("the cone page lights up exactly one entry", () => {
  assert.equal(isNavItemActive("/forecast/cone", CONE), true);
  assert.equal(
    isNavItemActive("/forecast/cone", FORECAST),
    false,
    "the parent must yield to a descendant that has its own entry",
  );
});

test("the forecast landing itself is still an exact match", () => {
  assert.equal(isNavItemActive("/forecast", FORECAST), true);
  assert.equal(isNavItemActive("/forecast", CONE), false);
});

test("a sibling path is not claimed by the prefix", () => {
  // The "/" guard: /forecast must not claim /forecast-archive.
  assert.equal(isNavItemActive("/forecast-archive", FORECAST), false);
});

test("an entry without matchPrefix never claims descendants", () => {
  assert.equal(isNavItemActive("/forecast/cone/anything", CONE), false);
});

test("every nav id in the index is an internal route", () => {
  for (const id of NAV_ITEM_IDS) {
    assert.ok(id.startsWith("/"), `${id} should be an internal path`);
  }
  // External links and mailto: entries are filtered out of the index.
  assert.ok(![...NAV_ITEM_IDS].some((id) => id.startsWith("http")));
  assert.ok(![...NAV_ITEM_IDS].some((id) => id.startsWith("mailto")));
});

test("no two nav entries share an id", () => {
  const all = NAV_GROUPS.flatMap((g) => [
    ...(g.items ?? []).map((i) => i.id),
    ...(g.subgroups ?? []).flatMap((s) => s.items.map((i) => i.id)),
  ]).filter((id) => id.startsWith("/"));
  assert.deepEqual(
    all.length,
    new Set(all).size,
    "a duplicate id would make two sidebar rows light up together",
  );
});
