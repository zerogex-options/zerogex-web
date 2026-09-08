// Tests for the hosted MCP server at /mcp.
//
// The endpoint is public and unauthenticated, so its failure modes are not
// crashes — they are a language model confidently telling a trader that a
// 40-minute-old gamma flip is where price is right now, or filling a null level
// with a zero. Most of what is asserted here is about that: the freshness
// header, the wording of an unavailable level, and the sign the regime is read
// from.
//
// The protocol half is exercised through `handleRpcMessage` with a stub
// registry, so the wire contract is checked without a backend, a network or a
// running Next.js server.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROTOCOL_VERSION,
  RPC,
  handleRpcMessage,
  negotiateProtocolVersion,
  isSupportedProtocolVersion,
  type JsonRpcResponse,
  type ToolRegistry,
} from '../core/mcp/protocol.ts';
import {
  formatSnapshot,
  freshnessLine,
  regimeOf,
  structuredSnapshot,
  type GexSnapshot,
} from '../core/mcp/levels.ts';
import { createToolRegistry, TOOL_DEFINITIONS } from '../core/mcp/tools.ts';
import { SYMBOLS } from '../core/symbols.ts';

// --- helpers ---------------------------------------------------------------

const NOW = new Date('2026-09-08T18:00:00Z'); // 14:00 New York — regular hours.

function snapshotAt(agedSeconds: number, over: Partial<GexSnapshot> = {}): GexSnapshot {
  return {
    timestamp: new Date(NOW.getTime() - agedSeconds * 1000).toISOString(),
    symbol: 'SPX',
    spot_price: 6400,
    net_gex: 1.2e9,
    net_gex_at_spot: 8.5e8,
    gamma_flip: 6350,
    call_wall: 6500,
    put_wall: 6300,
    max_pain: 6375,
    pin_strike: 6400,
    put_call_ratio: 1.31,
    ...over,
  };
}

function registryWith(
  fetchSnapshot: (symbol: string) => Promise<GexSnapshot | null>,
  phase: 'open' | 'closed' = 'open',
): ToolRegistry {
  return createToolRegistry({
    fetchSnapshot: (symbol) => fetchSnapshot(symbol),
    marketPhase: () => phase,
    now: () => NOW,
  });
}

const okRegistry = registryWith(async () => snapshotAt(300));

function result(response: JsonRpcResponse | null): Record<string, unknown> {
  assert.ok(response, 'expected a response, got null');
  assert.ok('result' in response, `expected a result, got ${JSON.stringify(response)}`);
  return response.result as Record<string, unknown>;
}

function toolText(response: JsonRpcResponse | null): string {
  const payload = result(response);
  const content = payload.content as Array<{ type: string; text: string }>;
  assert.equal(content[0].type, 'text');
  return content[0].text;
}

function call(name: string, args: Record<string, unknown> = {}, registry = okRegistry) {
  return handleRpcMessage(
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
    registry,
  );
}

// --- lifecycle -------------------------------------------------------------

test('initialize echoes a protocol version the client supports', async () => {
  const res = await handleRpcMessage(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    okRegistry,
  );
  assert.equal(result(res).protocolVersion, '2025-06-18');
});

test('initialize answers an unknown protocol version with our own', async () => {
  const res = await handleRpcMessage(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } },
    okRegistry,
  );
  assert.equal(result(res).protocolVersion, PROTOCOL_VERSION);
  // Same for a client that omits the field entirely.
  assert.equal(negotiateProtocolVersion(undefined), PROTOCOL_VERSION);
  // The transport spec's default for a request with no version header.
  assert.equal(isSupportedProtocolVersion('2025-03-26'), true);
});

test('initialize declares tools only, and warns about the delay up front', async () => {
  const res = await handleRpcMessage(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    okRegistry,
  );
  const payload = result(res);
  const capabilities = payload.capabilities as Record<string, unknown>;

  assert.ok('tools' in capabilities, 'tools capability must be declared');
  // Declaring a capability we do not implement sends clients into
  // method-not-found, so the others must be absent.
  for (const unsupported of ['resources', 'prompts', 'logging', 'completions', 'tasks']) {
    assert.ok(!(unsupported in capabilities), `must not declare ${unsupported}`);
  }

  const instructions = payload.instructions as string;
  assert.match(instructions, /DELAYED/);
  assert.match(instructions, /15 minutes/);
  assert.match(instructions, /not a forecast|not a recommendation/i);
});

test('notifications get no reply and unknown ones are not an error', async () => {
  assert.equal(
    await handleRpcMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, okRegistry),
    null,
  );
  assert.equal(
    await handleRpcMessage({ jsonrpc: '2.0', method: 'notifications/somethingNew' }, okRegistry),
    null,
  );
});

test('ping returns an empty result', async () => {
  const res = await handleRpcMessage({ jsonrpc: '2.0', id: 7, method: 'ping' }, okRegistry);
  assert.deepEqual(result(res), {});
});

// --- protocol errors -------------------------------------------------------

test('malformed messages produce JSON-RPC errors, not throws', async () => {
  const cases: Array<[unknown, number]> = [
    ['not an object', RPC.INVALID_REQUEST],
    [{ jsonrpc: '2.0', id: 1 }, RPC.INVALID_REQUEST], // no method
    [{ jsonrpc: '1.0', id: 1, method: 'ping' }, RPC.INVALID_REQUEST],
    [{ jsonrpc: '2.0', id: 1, method: 42 }, RPC.INVALID_REQUEST],
    [{ jsonrpc: '2.0', id: 1, method: 'resources/list' }, RPC.METHOD_NOT_FOUND],
  ];
  for (const [message, code] of cases) {
    const res = await handleRpcMessage(message, okRegistry);
    assert.ok(res && 'error' in res, `expected an error for ${JSON.stringify(message)}`);
    assert.equal(res.error.code, code);
  }
});

test('a client response message is ignored rather than answered', async () => {
  // We never send server->client requests, so one of these is a no-op.
  assert.equal(await handleRpcMessage({ jsonrpc: '2.0', id: 3, result: {} }, okRegistry), null);
});

test('an unknown tool is a protocol error, and names the ones that exist', async () => {
  const res = await call('get_the_future');
  assert.ok(res && 'error' in res);
  assert.equal(res.error.code, RPC.INVALID_PARAMS);
  assert.deepEqual((res.error.data as { available: string[] }).available, [
    'get_gamma_levels',
    'get_market_gamma_overview',
  ]);
});

test('a tool that throws becomes an isError result, not a protocol error', async () => {
  // The distinction matters: a protocol error is invisible to the model, so it
  // cannot say what went wrong or retry.
  const exploding = registryWith(async () => {
    throw new Error('backend on fire');
  });
  const res = await call('get_gamma_levels', { symbol: 'SPX' }, exploding);
  assert.ok(res && 'result' in res, 'must be a result, not an error');
  assert.equal(result(res).isError, true);
  assert.match(toolText(res), /backend on fire/);
});

// --- tool definitions ------------------------------------------------------

test('tools/list advertises both read-only tools with usable schemas', async () => {
  const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, okRegistry);
  const tools = result(res).tools as typeof TOOL_DEFINITIONS;
  assert.deepEqual(
    tools.map((t) => t.name),
    ['get_gamma_levels', 'get_market_gamma_overview'],
  );

  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} must be read-only`);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.inputSchema.additionalProperties, false);
    // The description is where a model learns not to quote these as live.
    assert.match(tool.description, /DELAYED|delayed/);
  }

  // Enumerating the symbols in the schema stops a bad call before it happens,
  // rather than explaining the failure afterwards.
  const levels = tools[0];
  const props = levels.inputSchema.properties as Record<string, { enum?: string[] }>;
  assert.deepEqual(props.symbol.enum, [...SYMBOLS]);
  assert.deepEqual(levels.inputSchema.required, ['symbol']);
});

// --- freshness -------------------------------------------------------------

test('a normally delayed snapshot is labelled delayed, never live', async () => {
  const line = freshnessLine(snapshotAt(300).timestamp, 'open', NOW);
  assert.match(line, /Free delayed snapshot/);
  assert.match(line, /15 minutes behind/);
  assert.match(line, /never call them live/);
  assert.doesNotMatch(line, /STALE|RUNNING BEHIND/);
});

test('freshness escalates as the snapshot ages during the session', () => {
  // Just past twice the refresh window: behind, but not yet unusable.
  assert.match(freshnessLine(snapshotAt(31 * 60).timestamp, 'open', NOW), /RUNNING BEHIND/);
  // Past four windows: the market has probably traded through the levels.
  assert.match(freshnessLine(snapshotAt(70 * 60).timestamp, 'open', NOW), /STALE/);
});

test('an old snapshot outside market hours is not flagged as stale', () => {
  // Nothing is recomputing when the market is shut, so the last snapshot of the
  // session is as fresh as this data ever gets. Warning here would train the
  // model to hedge about data that is fine.
  const line = freshnessLine(snapshotAt(6 * 3600).timestamp, 'closed', NOW);
  assert.match(line, /Market is closed/);
  assert.doesNotMatch(line, /STALE|RUNNING BEHIND/);
});

test('a snapshot with no timestamp says its age is unknown', () => {
  assert.match(freshnessLine(null, 'open', NOW), /UNDATED/);
  assert.match(freshnessLine(undefined, 'open', NOW), /do not present these levels as current/);
});

test('a snapshot stamped slightly in the future reads as zero age, not negative', () => {
  // Clock skew between the API host and this one, not data from the future.
  const line = freshnessLine(new Date(NOW.getTime() + 4000).toISOString(), 'open', NOW);
  assert.match(line, /computed 0s ago/);
  assert.doesNotMatch(line, /-\d+\s*(s|min|h) ago/);
});

// --- level formatting ------------------------------------------------------

test('a null level is reported as unavailable and never as zero', () => {
  const text = formatSnapshot('SPX', snapshotAt(120, { gamma_flip: null }));
  assert.match(text, /Gamma flip: unavailable/);
  assert.match(text, /this is not zero/);
  assert.doesNotMatch(text, /Gamma flip: 0\.00/);

  const structured = structuredSnapshot('SPX', snapshotAt(120, { gamma_flip: null }), 'open', NOW);
  assert.equal(structured.gamma_flip, null, 'must stay null through to the structured payload');
});

test('the regime comes from gamma at spot, not the whole-chain total', () => {
  // The guard that matters: a chain total can carry the opposite sign to the
  // book around spot, and it is the value at spot that describes hedging now.
  assert.equal(regimeOf({ net_gex: 5e9, net_gex_at_spot: -2e8 }), 'short');
  assert.equal(regimeOf({ net_gex: -5e9, net_gex_at_spot: 2e8 }), 'long');
  // No value at spot is genuinely unknown; it must not default to a direction.
  assert.equal(regimeOf({ net_gex: 5e9, net_gex_at_spot: null }), 'unknown');
  assert.equal(regimeOf({ net_gex: 5e9 }), 'unknown');
});

test('levels are reported with their distance from spot', () => {
  const text = formatSnapshot('SPX', snapshotAt(60));
  assert.match(text, /Call wall: 6500\.00 \(1\.56% above spot\)/);
  assert.match(text, /Put wall: 6300\.00 \(1\.56% below spot\)/);
});

test('a missing pin strike reads as normal, with its reason', () => {
  const text = formatSnapshot(
    'SPX',
    snapshotAt(60, { pin_strike: null, pin_strike_reason: 'REASON_NO_SAME_DAY_EXPIRY' }),
  );
  assert.match(text, /Pin strike \(same-day\): none \(REASON_NO_SAME_DAY_EXPIRY\)/);
  assert.match(text, /normal when/);
});

test('futures levels disclose that they are carried onto the futures axis', () => {
  // ES has no options book; saying "the ES chain" would be false, and a reader
  // who applies a basis offset to an already-projected level gets it wrong.
  const text = formatSnapshot('ES', snapshotAt(60));
  assert.match(text, /no options chain of its own/);
  assert.match(text, /SPX option-derived/);
  assert.match(text, /do not apply a basis offset/);
  // The cash index carries no such note.
  assert.doesNotMatch(formatSnapshot('SPX', snapshotAt(60)), /basis offset/);
});

// --- tool behaviour --------------------------------------------------------

test('get_gamma_levels leads with freshness and carries a structured payload', async () => {
  const res = await call('get_gamma_levels', { symbol: 'SPX' });
  const text = toolText(res);

  // Freshness must be the first line: it is what the model reads first and the
  // caveat it is most likely to carry into its answer.
  assert.match(text.split('\n')[0], /Free delayed snapshot/);
  assert.match(text, /Gamma flip: 6350\.00/);
  assert.match(text, /LONG gamma at spot/);
  assert.match(text, /not investment advice/);

  const structured = result(res).structuredContent as Record<string, unknown>;
  assert.equal(structured.symbol, 'SPX');
  assert.equal(structured.data_tier, 'free-delayed', 'must be unmistakable in machine output too');
  assert.equal(structured.max_delay_seconds, 900);
  assert.equal(structured.age_seconds, 300);
  assert.equal(structured.regime, 'long');
});

test('get_gamma_levels accepts a lowercase symbol', async () => {
  const res = await call('get_gamma_levels', { symbol: 'spy' });
  assert.notEqual(result(res).isError, true);
  assert.match(toolText(res), /^SPY —/m);
});

test('an unsupported symbol is an isError result listing the supported ones', async () => {
  const res = await call('get_gamma_levels', { symbol: 'TSLA' });
  assert.equal(result(res).isError, true);
  const text = toolText(res);
  assert.match(text, /Unknown symbol "TSLA"/);
  for (const symbol of SYMBOLS) assert.match(text, new RegExp(symbol));
});

test('a missing snapshot tells the model not to answer from memory', async () => {
  // The failure that matters is not the outage, it is a model filling the gap
  // with a level it half-remembers from training.
  const empty = registryWith(async () => null);
  const res = await call('get_gamma_levels', { symbol: 'SPX' }, empty);
  assert.equal(result(res).isError, true);
  assert.match(toolText(res), /temporarily unavailable/);
  assert.match(toolText(res), /do not supply levels from memory/);
});

test('the overview covers every symbol in one call', async () => {
  const res = await call('get_market_gamma_overview');
  const text = toolText(res);
  for (const symbol of SYMBOLS) assert.match(text, new RegExp(`- ${symbol}: spot`));
  const structured = result(res).structuredContent as { symbols: unknown[]; unavailable: string[] };
  assert.equal(structured.symbols.length, SYMBOLS.length);
  assert.deepEqual(structured.unavailable, []);
});

test('the overview dates itself by its oldest symbol', async () => {
  // Leading with the freshest would let one lagging symbol hide behind five
  // current ones, and the header is the line the model repeats.
  const mixed = registryWith(async (symbol) =>
    symbol === 'NDX' ? snapshotAt(70 * 60) : snapshotAt(120),
  );
  const res = await call('get_market_gamma_overview', {}, mixed);
  assert.match(toolText(res).split('\n')[0], /STALE/);
});

test('the overview names the symbols it could not fetch', async () => {
  const partial = registryWith(async (symbol) => (symbol === 'NQ' ? null : snapshotAt(120)));
  const res = await call('get_market_gamma_overview', {}, partial);
  assert.notEqual(result(res).isError, true, 'a partial answer is still an answer');
  assert.match(toolText(res), /Unavailable in this snapshot: NQ/);
  assert.match(toolText(res), /rather than filling the gap/);
  const structured = result(res).structuredContent as { unavailable: string[] };
  assert.deepEqual(structured.unavailable, ['NQ']);
});

test('the overview errors only when nothing at all is available', async () => {
  const dead = registryWith(async () => null);
  const res = await call('get_market_gamma_overview', {}, dead);
  assert.equal(result(res).isError, true);
  assert.match(toolText(res), /any covered symbol/);
});

test('every advertised tool has an implementation', async () => {
  // Catches a definition added without a matching branch, which would otherwise
  // surface as a confusing runtime throw on first use.
  for (const definition of TOOL_DEFINITIONS) {
    const res = await call(definition.name, { symbol: 'SPX' });
    assert.ok(res && 'result' in res, `${definition.name} has no implementation`);
    assert.notEqual(result(res).isError, true, `${definition.name} failed on a valid call`);
  }
});
