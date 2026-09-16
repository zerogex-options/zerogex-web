import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { integrationRoutes } from '../core/integrations.ts';

// IndicatorPageShell and STANDALONE_ROUTES have to agree, and nothing made
// them.
//
// The shell (components/IndicatorPageShell.tsx) renders a page's entire
// chrome: its own LandingHeader, its own 1080px column, its own SiteFooter.
// ClientLayout decides separately, from a hand-maintained path list, whether
// to ALSO wrap a route in the app shell — sidebar, app header, world clocks.
// A page that uses the first and is missing from the second renders both: two
// headers, a nav rail, and a marketing landing that looks like a logged-in
// screen.
//
// That is not hypothetical. /collective2-strategy-data shipped that way, and
// /embed was written the same way and caught only because someone looked at a
// screenshot. The failure is invisible to the type system, to lint, and to
// every other test in this suite — the page renders, it is just wearing two
// sets of clothes. So the pairing is asserted here instead of remembered.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const APP_DIR = path.join(ROOT, 'app');

/** Every app/**\/page.tsx, as [absolute path, route]. */
function pageRoutes(): { file: string; route: string }[] {
  const out: { file: string; route: string }[] = [];
  const walk = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, [...segments, entry.name]);
      } else if (entry.name === 'page.tsx') {
        out.push({ file: abs, route: `/${segments.join('/')}` });
      }
    }
  };
  walk(APP_DIR, []);
  return out;
}

/**
 * The routes ClientLayout renders without app chrome.
 *
 * The literal entries are read out of the source rather than imported:
 * ClientLayout is a client component whose import graph reaches React and the
 * '@/'-aliased context modules, neither of which resolves under node's
 * --experimental-strip-types loader. `integrationRoutes()` IS importable, so
 * the spread is evaluated for real rather than re-listed — which is the half
 * of the list most likely to grow.
 */
function standaloneRoutes(): Set<string> {
  const source = readFileSync(path.join(ROOT, 'components/ClientLayout.tsx'), 'utf8');
  const line = source.split('\n').find((l) => l.includes('const STANDALONE_ROUTES'));
  assert.ok(line, 'STANDALONE_ROUTES is gone from ClientLayout — this test needs rewriting');
  assert.ok(
    line.includes('...integrationRoutes()'),
    'STANDALONE_ROUTES no longer spreads integrationRoutes() — this test would silently under-cover',
  );
  const literals = [...line.matchAll(/'(\/[^']*)'/g)].map((m) => m[1]);
  assert.ok(literals.length > 5, 'failed to parse STANDALONE_ROUTES');
  return new Set([...literals, ...integrationRoutes()]);
}

test('every page using IndicatorPageShell renders standalone', () => {
  const standalone = standaloneRoutes();

  const consumers = pageRoutes().filter(({ file }) =>
    /from '@\/components\/IndicatorPageShell'/.test(readFileSync(file, 'utf8')),
  );

  // A guard against the assertion quietly becoming vacuous — if the import
  // specifier above is ever reworded, the filter matches nothing and this
  // test would pass while checking zero pages.
  assert.ok(consumers.length >= 6, `expected several shell pages, found ${consumers.length}`);

  const missing = consumers
    .map(({ route }) => route)
    // Dynamic and grouped segments would not compare against a literal path.
    // None of the shell's consumers use them today; skip rather than assert
    // something false about a route this check cannot express.
    .filter((route) => !/[[\]()]/.test(route))
    .filter((route) => !standalone.has(route));

  assert.deepEqual(
    missing,
    [],
    `these pages use IndicatorPageShell but are missing from STANDALONE_ROUTES, so they render inside the app chrome: ${missing.join(', ')}`,
  );
});

test('STANDALONE_ROUTES names only routes that exist', () => {
  // The other direction. A renamed or deleted page leaves a dead entry that
  // reads as coverage, which is how a list like this rots into something
  // nobody trusts enough to edit.
  const routes = new Set(pageRoutes().map(({ route }) => route));
  const dead = [...standaloneRoutes()].filter((route) => !routes.has(route));
  assert.deepEqual(dead, [], `STANDALONE_ROUTES entries with no page: ${dead.join(', ')}`);
});
