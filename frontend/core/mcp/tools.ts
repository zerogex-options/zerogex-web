// The tools the ZeroGEX MCP server exposes, and the registry that runs them.
//
// Two tools, both read-only, both served from the same free 15-minute-delayed
// snapshot the public gamma-levels pages render. Kept deliberately short:
// a small set of task-shaped tools produces better tool selection than one
// wrapper per backend route, and every tool here answers a question a trader
// actually asks out loud.
//
// The snapshot source is injected rather than imported so this module stays
// free of 'server-only' and can be exercised end to end in tests with a stub.

import { SYMBOLS, type PickerSymbol } from '../symbols.ts';
import type { McpToolDefinition, McpToolResult, ToolRegistry } from './protocol.ts';
import {
  DELAY_SECONDS,
  formatSnapshot,
  freshnessLine,
  structuredSnapshot,
  summarizeSnapshot,
  type GexSnapshot,
  type MarketPhase,
} from './levels.ts';

/** Fetches one symbol's delayed snapshot; `null` when it cannot be produced. */
export type SnapshotFetcher = (symbol: PickerSymbol) => Promise<GexSnapshot | null>;

export interface ToolDeps {
  fetchSnapshot: SnapshotFetcher;
  /** Regular-hours check, injected so tests are not clock-dependent. */
  marketPhase: () => MarketPhase;
  now: () => Date;
}

const SYMBOL_ENUM = [...SYMBOLS];

// Spending the description on when NOT to reach for a tool is the highest-value
// prompt real estate available here — a description that only restates the name
// wastes it, and "not a price feed, not a forecast" is the confusion that
// actually shows up in transcripts.
export const TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: 'get_gamma_levels',
    title: 'Get delayed gamma levels',
    description:
      "Modeled options dealer-positioning levels for one underlying: gamma flip, call wall, " +
      'put wall, max pain, same-day pin strike, and net dealer gamma at spot (whose sign is the ' +
      'regime). Use for "where is the gamma flip", "where are the walls", "is SPX in positive ' +
      'gamma". FREE DELAYED DATA — up to 15 minutes behind live, and the response states its own ' +
      'age; quote that age and never call these levels live. Not a price feed, not a forecast, ' +
      'and not a trade recommendation: it describes dealer positioning and says nothing on its ' +
      'own about direction. A null level means the modeled book does not support that level right ' +
      'now — report it as unavailable, never as zero.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          enum: SYMBOL_ENUM,
          description:
            'ES and NQ have no options book of their own; their levels are the SPX and NDX ' +
            'option-derived levels already projected onto the futures price axis.',
        },
      },
      required: ['symbol'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'get_market_gamma_overview',
    title: 'Get delayed gamma levels for every symbol',
    description:
      'One-line dealer-positioning summary for all six covered underlyings (SPX, SPY, QQQ, NDX, ' +
      'ES, NQ) in a single call: spot, modeled regime and gamma flip for each. Use for broad ' +
      'openers like "what does dealer positioning look like today" or "which indices are in ' +
      'negative gamma", instead of calling get_gamma_levels six times. Same free 15-minute-delayed ' +
      'data and the same caveats. When the question is about one symbol, call get_gamma_levels ' +
      'instead — this tool omits the walls, max pain and pin strike.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
];

const FOOTER =
  `Source: ZeroGEX free delayed levels (https://zerogex.io), the same data as the public ` +
  `gamma-levels pages, refreshed about every ${Math.round(DELAY_SECONDS / 60)} minutes. ` +
  'Educational information about modeled dealer positioning, not investment advice.';

function textResult(text: string, structured?: Record<string, unknown>): McpToolResult {
  return structured
    ? { content: [{ type: 'text', text }], structuredContent: structured }
    : { content: [{ type: 'text', text }] };
}

function errorResult(text: string): McpToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function resolveSymbolArg(raw: unknown): PickerSymbol | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return (SYMBOLS as readonly string[]).includes(upper) ? (upper as PickerSymbol) : null;
}

/**
 * The message for "the backend gave us nothing".
 *
 * Written so the model reports an outage rather than inventing a level or
 * falling back on whatever it remembers from training — the two failure modes
 * that turn a transient backend blip into a wrong number quoted with
 * confidence.
 */
function unavailableText(subject: string): string {
  return (
    `No delayed snapshot is available for ${subject} right now. Tell the user the data is ` +
    'temporarily unavailable and do not supply levels from memory or from any other source.'
  );
}

export function createToolRegistry(deps: ToolDeps): ToolRegistry {
  async function getGammaLevels(args: Record<string, unknown>): Promise<McpToolResult> {
    const symbol = resolveSymbolArg(args.symbol);
    if (!symbol) {
      return errorResult(
        `Unknown symbol ${JSON.stringify(args.symbol ?? null)}. Supported symbols: ` +
          `${SYMBOL_ENUM.join(', ')}. Retry with one of those.`,
      );
    }

    const snapshot = await deps.fetchSnapshot(symbol);
    if (!snapshot) return errorResult(unavailableText(symbol));

    const now = deps.now();
    const phase = deps.marketPhase();
    const text = [
      freshnessLine(snapshot.timestamp, phase, now),
      '',
      formatSnapshot(symbol, snapshot),
      '',
      FOOTER,
    ].join('\n');

    return textResult(text, structuredSnapshot(symbol, snapshot, phase, now));
  }

  async function getOverview(): Promise<McpToolResult> {
    const now = deps.now();
    const phase = deps.marketPhase();

    // One request per symbol, all in flight together. Each resolves from the
    // same shared 15-minute cache entry the public pages use, so a burst of
    // overview calls costs the backend nothing extra.
    const snapshots = await Promise.all(
      SYMBOLS.map(async (symbol) => ({ symbol, snapshot: await deps.fetchSnapshot(symbol) })),
    );

    const available = snapshots.filter(
      (entry): entry is { symbol: PickerSymbol; snapshot: GexSnapshot } => entry.snapshot !== null,
    );
    if (available.length === 0) return errorResult(unavailableText('any covered symbol'));

    // Freshness is reported against the OLDEST snapshot in the set. Leading
    // with the freshest would let one lagging symbol hide behind five current
    // ones, and the header is the line the model repeats.
    const oldest = available.reduce((acc, entry) => {
      const a = Date.parse(acc.snapshot.timestamp ?? '');
      const b = Date.parse(entry.snapshot.timestamp ?? '');
      if (!Number.isFinite(b)) return entry;
      if (!Number.isFinite(a)) return acc;
      return b < a ? entry : acc;
    });

    const missing = snapshots.filter((entry) => entry.snapshot === null).map((entry) => entry.symbol);

    const lines = [
      freshnessLine(oldest.snapshot.timestamp, phase, now),
      '',
      'Modeled dealer positioning across the covered underlyings:',
      ...available.map((entry) => summarizeSnapshot(entry.symbol, entry.snapshot)),
    ];
    if (missing.length > 0) {
      lines.push(
        `- Unavailable in this snapshot: ${missing.join(', ')}. Say so rather than filling the gap.`,
      );
    }
    lines.push(
      '',
      'Long gamma at spot means dealer hedging tends to dampen moves; short gamma tends to amplify them.',
      'Call get_gamma_levels for one symbol to get its walls, max pain and pin strike.',
      '',
      FOOTER,
    );

    return textResult(lines.join('\n'), {
      as_of: oldest.snapshot.timestamp ?? null,
      data_tier: 'free-delayed',
      max_delay_seconds: DELAY_SECONDS,
      market_phase: phase,
      symbols: available.map((entry) => structuredSnapshot(entry.symbol, entry.snapshot, phase, now)),
      unavailable: missing,
    });
  }

  return {
    definitions: TOOL_DEFINITIONS,
    async call(name, args) {
      switch (name) {
        case 'get_gamma_levels':
          return getGammaLevels(args);
        case 'get_market_gamma_overview':
          return getOverview();
        default:
          // Unreachable: the protocol layer rejects unknown names before it
          // gets here. Kept so adding a definition without a branch fails
          // loudly instead of returning an empty result.
          throw new Error(`Tool "${name}" has a definition but no implementation.`);
      }
    },
  };
}
