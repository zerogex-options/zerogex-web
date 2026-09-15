import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BROKER_CONNECTIONS,
  brokerById,
  brokersFor,
  platformNames,
} from '../core/brokerConnections.ts';
import { INTEGRATIONS, integrationById } from '../core/integrations.ts';

// core/brokerConnections.ts makes claims about OTHER people's software — that
// NinjaTrader 8 and Sierra Chart each reach an IBKR account — and points them
// at entries in a registry it does not own. Neither half is checkable from
// here; what is checkable is that the two lists agree with each other and that
// the surfaces which promise the answer actually render it.
//
// The failure this exists to stop is quiet: rename or retire an integration
// and the broker note keeps advertising a route to IBKR through a platform
// that is no longer in the registry, on a page that still ranks.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const APP_DIR = path.join(HERE, '../app');

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

test('broker ids are unique', () => {
  const ids = BROKER_CONNECTIONS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate broker id');
});

test('brokerById throws on an unknown id rather than returning undefined', () => {
  assert.throws(() => brokerById('nonexistent' as never), /Unknown broker id/);
});

test('every broker carries the copy each surface renders', () => {
  assert.ok(BROKER_CONNECTIONS.length > 0, 'the list is empty; the note would render nothing');
  for (const broker of BROKER_CONNECTIONS) {
    for (const field of ['broker', 'short', 'whyNoDirect', 'requirement', 'caveat'] as const) {
      assert.ok(broker[field].trim().length > 0, `${broker.id}.${field} is empty`);
    }
    assert.ok(broker.paths.length > 0, `${broker.id} names no platform that reaches it`);
    for (const entry of broker.paths) {
      assert.ok(entry.how.trim().length > 0, `${broker.id} → ${entry.integration} has no 'how'`);
    }
  }
});

// ---------------------------------------------------------------------------
// The claims it makes about the registry
// ---------------------------------------------------------------------------

test('every integration a broker names exists in the registry', () => {
  for (const broker of BROKER_CONNECTIONS) {
    for (const entry of broker.paths) {
      // Throws rather than asserting on a lookup, which is what the page would
      // do at build time — this just turns it into a named failure.
      assert.doesNotThrow(
        () => integrationById(entry.integration),
        `${broker.id} routes through '${entry.integration}', which is not in INTEGRATIONS`,
      );
    }
  }
});

test('a broker only routes through auto-updating integrations', () => {
  // A manual-entry script is four numbers typed into a settings panel. It
  // cannot care what the chart is connected to, so listing a broker behind one
  // would be advertising a connection that does nothing. The auto-updating
  // studies are the ones that run inside a platform the trader has wired to a
  // brokerage.
  for (const broker of BROKER_CONNECTIONS) {
    for (const entry of broker.paths) {
      assert.equal(
        integrationById(entry.integration).updates,
        'auto',
        `${broker.id} routes through '${entry.integration}', which is manual-entry`,
      );
    }
  }
});

test('a broker names each integration at most once', () => {
  for (const broker of BROKER_CONNECTIONS) {
    const ids = broker.paths.map((entry) => entry.integration);
    assert.equal(new Set(ids).size, ids.length, `${broker.id} lists an integration twice`);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

test('brokersFor returns only the path belonging to the integration asked for', () => {
  for (const entry of INTEGRATIONS) {
    for (const { broker, path: connectionPath } of brokersFor(entry.id)) {
      assert.equal(
        connectionPath.integration,
        entry.id,
        `brokersFor('${entry.id}') returned ${broker.id}'s path for '${connectionPath.integration}'`,
      );
    }
  }
});

test('brokersFor is empty for a manual-entry integration', () => {
  // Falls out of the auto-only rule above, but it is the behaviour the shared
  // component relies on to render nothing rather than an empty card.
  for (const entry of INTEGRATIONS.filter((item) => item.updates === 'manual')) {
    assert.deepEqual(brokersFor(entry.id), [], `${entry.id} is manual-entry but has a broker route`);
  }
});

test('platformNames reads the platform names off the registry', () => {
  // Written out by hand this would be the copy that says "NinjaTrader 8 or
  // Sierra Chart" long after one of them was renamed.
  for (const broker of BROKER_CONNECTIONS) {
    const rendered = platformNames(broker.paths);
    for (const entry of broker.paths) {
      assert.ok(
        rendered.includes(integrationById(entry.integration).platform),
        `platformNames(${broker.id}) omits '${entry.integration}'`,
      );
    }
  }
});

test('platformNames speaks only about the routes it is handed', () => {
  // The regression: the landing pages used to read the whole broker, so
  // /sierra-chart-indicator opened with "yes — through NinjaTrader 8 or Sierra
  // Chart" above a list containing Sierra Chart alone. One path in, one
  // platform out, and no "or".
  for (const broker of BROKER_CONNECTIONS) {
    for (const entry of broker.paths) {
      const rendered = platformNames([entry]);
      assert.equal(rendered, integrationById(entry.integration).platform);
      assert.ok(!rendered.includes(' or '), `platformNames([one path]) joined something: ${rendered}`);
    }
  }
});

// ---------------------------------------------------------------------------
// The surfaces that have to render it
// ---------------------------------------------------------------------------

test('every landing a broker routes through renders the note', () => {
  // The point of the entry is to answer "does this work with my broker?" on
  // the page where it is asked. A route claimed in the registry but missing
  // from the landing is an answer nobody sees.
  //
  // Asserted as text for the same reason the sitemap check in
  // integrations.test.ts is: the page is JSX, and importing it here would pull
  // in the whole Next module graph.
  const routed = new Set(
    BROKER_CONNECTIONS.flatMap((broker) => broker.paths.map((entry) => entry.integration)),
  );
  for (const id of routed) {
    const entry = integrationById(id);
    const page = path.join(APP_DIR, entry.href.replace(/^\//, ''), 'page.tsx');
    const source = readFileSync(page, 'utf8');
    assert.ok(
      source.includes('<BrokerConnectionNote'),
      `${entry.href} is a route to a broker but does not render <BrokerConnectionNote />`,
    );
    assert.ok(
      source.includes(`integration="${id}"`),
      `${entry.href} renders <BrokerConnectionNote /> without integration="${id}"`,
    );
  }
});

test('the hub renders the note across every broker', () => {
  // Without an `integration` prop, so it lists every route rather than one
  // platform's. This is the page a visitor lands on not yet knowing which
  // platform they want, which is exactly when the broker question is asked.
  const hub = readFileSync(path.join(APP_DIR, 'integrations/page.tsx'), 'utf8');
  assert.ok(hub.includes('<BrokerConnectionNote />'), '/integrations does not render the broker note');
});
