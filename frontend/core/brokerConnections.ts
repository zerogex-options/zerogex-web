// Which brokerages the auto-updating integrations already work behind.
//
// This answers the one question core/integrations.ts deliberately does not:
// "does this work with my broker?" It arrives most often as "do you have an
// Interactive Brokers integration?", and the honest answer has two halves that
// are easy to give separately and wrong to give apart:
//
//   1. No, and there cannot be one. IBKR's Trader Workstation runs no user
//      code — no scripting language, no supported way to draw on its charts —
//      so a ZeroGEX indicator *for TWS* is not a thing anyone can build, for
//      us or for themselves.
//   2. Yes, you can already do it today. NinjaTrader 8 and Sierra Chart both
//      connect to an IBKR account, and our studies draw the same levels behind
//      either one.
//
// Give only (1) and we turn away a customer we could serve this afternoon.
// Give only (2) and the next question is "so where's the IBKR download?".
// Both halves, in that order, is the whole answer. The reasoning and the two
// builds that were considered and deferred are in
// docs/integrations-ibkr-collective2-feasibility.md.
//
// WHY A BROKER DOES NOT BELONG IN core/integrations.ts
// ----------------------------------------------------
// An `Integration` is a platform that RUNS OUR CODE, and every field on it —
// `language`, `updates`, `tier` — describes what that platform's scripting
// runtime is permitted to do. A broker runs nothing of ours. Adding IBKR there
// would mean a row with no language, no script, no landing page and a
// meaningless `updates` value: the first dishonest row in a table whose entire
// value is that it is not. It is also what would put "Interactive Brokers" on
// the hub as a fifth card someone could click expecting a download.
//
// So the two lists stay separate and this one references the other by id.
// tests/brokerConnections.test.ts asserts every id here resolves, and that the
// integrations named are the auto-updating ones — a manual-entry script is
// typed in by hand and cannot care what the chart is connected to.

import { integrationById, type IntegrationId } from './integrations.ts';

/** Stable key for one brokerage. Used for React keys and telemetry. */
export type BrokerId = 'ibkr';

export type BrokerConnectionPath = {
  /** The integration that does the connecting. Must exist in INTEGRATIONS. */
  integration: IntegrationId;
  /** How that platform reaches this broker, in one line. */
  how: string;
};

export type BrokerConnection = {
  id: BrokerId;
  /** Full brand name. Stays English in every locale, same as the platforms. */
  broker: string;
  /** The short form people actually type into search and support. */
  short: string;
  /** Why we ship nothing that plugs into the broker directly. One sentence. */
  whyNoDirect: string;
  /** The platforms that do reach it, in registry order. */
  paths: readonly BrokerConnectionPath[];
  /** What the trader has to run themselves. Shared across every path here. */
  requirement: string;
  /**
   * The thing support would otherwise have to say twice a week. Stated up
   * front because it sounds like a problem and is not one for us.
   */
  caveat: string;
};

export const BROKER_CONNECTIONS: readonly BrokerConnection[] = [
  {
    id: 'ibkr',
    broker: 'Interactive Brokers',
    short: 'IBKR',
    whyNoDirect:
      'Trader Workstation has no scripting language and no way to draw on its charts from outside, so there is nothing for an indicator to install into\u00a0- ours or anyone else’s.',
    paths: [
      {
        integration: 'ninjatrader',
        how: 'NinjaTrader 8 connects to an IBKR account through the TWS API, and the indicator runs inside NinjaTrader.',
      },
      {
        integration: 'sierrachart',
        how: 'Sierra Chart has a built-in Interactive Brokers trading service on the same API, and the study runs inside Sierra Chart.',
      },
    ],
    requirement:
      'Both platforms reach IBKR through the same door, so the setup is the same either way: TWS or IB Gateway has to be running on the machine, with its socket API enabled.',
    caveat:
      'IBKR’s own market data is thin by charting standards\u00a0- snapshot ticks and limited history\u00a0- which is why many traders pair a dedicated feed with IBKR for execution. It makes no difference to the levels: those are fetched from the ZeroGEX API over HTTP, and never read off the platform’s quotes.',
  },
] as const;

/** Look one up by id. Throws rather than returning undefined, for the same
 *  reason integrationById does: every call site passes a literal. */
export function brokerById(id: BrokerId): BrokerConnection {
  const found = BROKER_CONNECTIONS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown broker id: ${id}`);
  return found;
}

/**
 * The brokers reachable through one integration, each carrying only the path
 * that belongs to it.
 *
 * This is what the two Pro landings render: on /ninjatrader-indicator the
 * visitor is already on NinjaTrader, so Sierra Chart's route to IBKR is noise.
 * The hub renders the full list instead.
 */
export function brokersFor(
  integration: IntegrationId,
): { broker: BrokerConnection; path: BrokerConnectionPath }[] {
  const out: { broker: BrokerConnection; path: BrokerConnectionPath }[] = [];
  for (const broker of BROKER_CONNECTIONS) {
    const path = broker.paths.find((entry) => entry.integration === integration);
    if (path) out.push({ broker, path });
  }
  return out;
}

/**
 * The platform names behind a set of routes, e.g. "NinjaTrader 8 or Sierra
 * Chart". Reads off the registry so a renamed platform cannot go stale here.
 *
 * Takes the PATHS rather than the broker so the caller decides which routes it
 * is speaking about. The hub passes all of them; a landing page passes only
 * its own, and must — "yes, through NinjaTrader 8 or Sierra Chart" is a
 * strange thing to read on the Sierra Chart page, directly above a list with
 * one entry in it.
 */
export function platformNames(paths: readonly BrokerConnectionPath[]): string {
  const names = paths.map((entry) => integrationById(entry.integration).platform);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}
