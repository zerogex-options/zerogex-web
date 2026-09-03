import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requiredApiAccess } from '../core/api/apiTierGate.ts';

// STRUCTURAL guard over the BFF tier gate. apiTierGate.test.ts pins the
// decision table — what each path resolves to. This file answers a different
// question: has every proxied namespace been CLASSIFIED at all?
//
// It exists because the gate is a deliberate fail-OPEN denylist. An endpoint
// with no rule is not refused, it is served. That is the right default for
// availability and the wrong one for a paywall, and it is exactly how three
// market endpoints and the whole Pro TradeWorkz surface ended up readable by
// anonymous callers: nobody forgot to write a rule, nobody was ever prompted
// to decide one was needed. A denylist cannot tell you what is missing from
// it — so this test enumerates the proxy routes on disk and demands a
// deliberate answer for each, turning "remember to add a rule" into a build
// failure. Add a proxy route without classifying it here and the deploy stops.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.join(HERE, '..', 'app', 'api');

type Disposition = 'gated' | 'partial' | 'open';

interface Entry {
  disposition: Disposition;
  why: string;
  /** For 'partial': paths under the namespace that MUST resolve to a tier. */
  gated?: string[];
  /** For 'partial': paths that MUST stay ungated. */
  open?: string[];
}

// Every namespace served by core/api/proxy.ts. Keyed by the URL prefix the
// route file maps to. CI fails on any proxy route missing from this map, and
// on any entry here whose route file has been deleted.
const PROXY_NAMESPACES: Record<string, Entry> = {
  '/api/backtest': { disposition: 'gated', why: 'Backtesting platform — Pro. The public /runs/shared permalink is carved out in RULES.' },
  '/api/flow': { disposition: 'gated', why: 'Order-flow analytics — Basic tool pages.' },
  '/api/forced-flow': { disposition: 'gated', why: 'Forced-flow curve — Basic.' },
  '/api/gex': { disposition: 'gated', why: 'Core gamma analytics — Basic.' },
  '/api/max-pain': { disposition: 'gated', why: 'Max-pain — Basic.' },
  '/api/option': { disposition: 'gated', why: 'Per-contract quotes and greeks — Basic.' },
  '/api/replay': { disposition: 'gated', why: 'Session replay — Basic. The public /replay/* pages are server-rendered and never traverse this proxy.' },
  '/api/signals': { disposition: 'gated', why: 'Signal surface — Basic, with advanced/trade-bias escalated to Pro in RULES.' },
  '/api/technicals': { disposition: 'gated', why: 'Technical snapshot — Basic.' },

  '/api/health': {
    disposition: 'open',
    why: 'Liveness probe. Must answer without credentials — ALB targets, systemd ExecStartPost and uptime monitors all poll it, and the backend allowlists it too. Never gate this.',
  },

  '/api/market': {
    disposition: 'partial',
    why: 'Split namespace: the paid series are gated, the anonymous header chrome is not.',
    gated: ['/api/market/historical', '/api/market/open-interest', '/api/market/session-levels', '/api/market/volatility'],
    open: ['/api/market/quote', '/api/market/session-closes'],
  },

  '/api/tradeworkz': {
    disposition: 'partial',
    why: 'Split namespace: the Pro signal product is gated, per-user preferences stay reachable at any tier so a member who downgraded off Pro can still unfollow.',
    gated: ['/api/tradeworkz/bots', '/api/tradeworkz/summary', '/api/tradeworkz/leaderboard', '/api/tradeworkz/equity-curves', '/api/tradeworkz/performance-trend', '/api/tradeworkz/admin'],
    open: ['/api/tradeworkz/me/follows', '/api/tradeworkz/me/feed', '/api/tradeworkz/bots/7/follow'],
  },
};

/** Namespace a route file maps to: the path up to its first dynamic segment. */
function namespaceFor(routeFile: string): string {
  const rel = path.relative(API_DIR, path.dirname(routeFile));
  const segments = rel.split(path.sep).filter((s) => s && !s.startsWith('['));
  return `/api/${segments.join('/')}`;
}

function findProxyRoutes(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findProxyRoutes(full, found);
    else if (entry.name === 'route.ts' && fs.readFileSync(full, 'utf8').includes('proxyToApi')) found.push(full);
  }
  return found;
}

const discovered = findProxyRoutes(API_DIR);
const discoveredNamespaces = [...new Set(discovered.map(namespaceFor))].sort();

test('discovery actually finds the proxy routes (guards the guard)', () => {
  // If the scan silently returns nothing — a moved app dir, a renamed helper —
  // every assertion below would pass vacuously and this file would be theatre.
  assert.ok(discovered.length >= 10, `expected to find the proxy routes, found ${discovered.length}`);
});

test('every proxied namespace is classified', () => {
  const unclassified = discoveredNamespaces.filter((ns) => !(ns in PROXY_NAMESPACES));
  assert.deepEqual(
    unclassified,
    [],
    `\n\nProxy route(s) with no entry in PROXY_NAMESPACES: ${unclassified.join(', ')}\n\n` +
      `These forward to the backend with the shared full-access BFF key, which enforces NO end-user\n` +
      `tier. The gate fails OPEN, so until each is classified it is readable by ANY anonymous caller.\n\n` +
      `Decide, then record it in tests/apiProxyCoverage.test.ts:\n` +
      `  premium        -> add a rule to core/api/apiTierGate.ts, classify 'gated'\n` +
      `  free/public    -> classify 'open' and say why it must answer without a session\n` +
      `  mixed          -> classify 'partial' and list gated[] + open[] paths\n`,
  );
});

test('no stale entries — every classified namespace still has a route', () => {
  const stale = Object.keys(PROXY_NAMESPACES).filter((ns) => !discoveredNamespaces.includes(ns));
  assert.deepEqual(stale, [], `Classified but no proxy route on disk (delete the entry?): ${stale.join(', ')}`);
});

test("'gated' namespaces resolve to a tier at their root", () => {
  for (const [ns, entry] of Object.entries(PROXY_NAMESPACES)) {
    if (entry.disposition !== 'gated') continue;
    assert.notEqual(requiredApiAccess(ns), null, `${ns} is classified 'gated' but has no rule — it is serving to anyone`);
  }
});

test("'open' namespaces are deliberately ungated", () => {
  for (const [ns, entry] of Object.entries(PROXY_NAMESPACES)) {
    if (entry.disposition !== 'open') continue;
    assert.equal(requiredApiAccess(ns), null, `${ns} is classified 'open' but a rule now gates it — intentional?`);
    assert.ok(entry.why.length > 40, `${ns} is served to anonymous callers; justify it properly in \`why\``);
  }
});

test("'partial' namespaces protect what they claim to protect", () => {
  for (const [ns, entry] of Object.entries(PROXY_NAMESPACES)) {
    if (entry.disposition !== 'partial') continue;
    assert.ok(entry.gated?.length, `${ns} is 'partial' but lists no gated paths`);
    assert.ok(entry.open?.length, `${ns} is 'partial' but lists no open paths — should it be 'gated'?`);
    for (const p of entry.gated!) {
      assert.notEqual(requiredApiAccess(p), null, `${p} must be gated but resolves to null — premium data is exposed`);
    }
    for (const p of entry.open!) {
      const access = requiredApiAccess(p);
      assert.ok(access === null || access === 'public', `${p} must stay reachable but resolves to '${access}' — this locks out legitimate callers`);
    }
  }
});
