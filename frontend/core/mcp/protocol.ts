// Model Context Protocol — JSON-RPC dispatch, transport-free.
//
// This module implements the message half of MCP: `initialize`, `ping`,
// `tools/list` and `tools/call`, plus the JSON-RPC framing around them. It
// deliberately knows nothing about HTTP, Next.js, or where the tool data comes
// from — the HTTP endpoint lives in app/mcp/route.ts and the tools are passed
// in as a registry. That split is what lets tests/mcpProtocol.test.ts exercise
// every branch with a stub registry under `node --test`, with no network, no
// backend and no 'server-only' import anywhere in the graph.
//
// Wire format follows the 2025-11-25 schema
// (schema/2025-11-25/schema.json in modelcontextprotocol/modelcontextprotocol).

/** The protocol revision this server implements and prefers. */
export const PROTOCOL_VERSION = '2025-11-25';

/**
 * Revisions we will negotiate down to. A client asking for one of these gets it
 * echoed back; anything else gets PROTOCOL_VERSION and decides for itself
 * whether it can proceed (the spec allows exactly this: "the server MUST respond
 * with another protocol version it supports").
 *
 * 2025-03-26 is included because the transport spec says a request arriving with
 * no `MCP-Protocol-Version` header MUST be assumed to be that revision.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
] as const;

export const SERVER_INFO = {
  name: 'io.zerogex/gamma-levels',
  title: 'ZeroGEX — SPX/SPY/QQQ/NDX gamma levels',
  version: '1.0.0',
  websiteUrl: 'https://zerogex.io',
} as const;

/**
 * Shown to the model as a system-prompt hint. Two jobs: say what the server is
 * for, and pre-empt the failure mode that actually costs users money — a
 * delayed level quoted as if it were live. The per-call text repeats the age,
 * because a hint at connect time is not what the model is looking at ten turns
 * later.
 */
export const SERVER_INSTRUCTIONS = [
  'ZeroGEX publishes modeled options dealer-positioning levels for SPX, SPY, QQQ, NDX, ES and NQ:',
  'the gamma flip, call wall, put wall, max pain, pin strike and net dealer gamma at spot.',
  '',
  'Every number this server returns is FREE DELAYED data, behind the live market by up to',
  '15 minutes, and each response states its own age. Quote the age whenever you quote a level.',
  'Never present these as live or real-time, and never use them to justify an entry or exit at',
  'the current price — during a fast tape the market can be through a level well before the',
  'snapshot shows it. ZeroGEX sells a real-time API separately; this endpoint is not it.',
  '',
  'A null level is a real answer meaning the modeled book does not support that level right now.',
  'It is not zero and not an error. Say the level is unavailable rather than substituting a number.',
  '',
  'These levels describe dealer positioning. They are not a forecast, not a recommendation, and',
  'say nothing on their own about direction.',
].join('\n');

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------

export type JsonRpcId = string | number;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: '2.0';
  id: JsonRpcId | null;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

/** Standard JSON-RPC 2.0 codes; MCP does not add its own at this layer. */
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

export interface McpToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/** A CallToolResult. `content` is what the model reads; the rest is for code. */
export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface ToolRegistry {
  definitions: McpToolDefinition[];
  call(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function ok(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result };
}

export function rpcError(
  id: JsonRpcId | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcFailure {
  return { jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A JSON-RPC id is a string or a number. `null` and absent both mean "notification". */
function readId(msg: Record<string, unknown>): JsonRpcId | null {
  const id = msg.id;
  return typeof id === 'string' || typeof id === 'number' ? id : null;
}

/**
 * Negotiate the protocol revision for this session.
 *
 * Echo what the client asked for when we speak it, otherwise answer with our
 * own and let the client decide. A missing or non-string value is treated as
 * "unspecified" rather than an error — the client is about to read our answer
 * either way.
 */
export function negotiateProtocolVersion(requested: unknown): string {
  return typeof requested === 'string' &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : PROTOCOL_VERSION;
}

export function isSupportedProtocolVersion(version: string): boolean {
  return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version);
}

/**
 * The connecting client's software name, reduced to a short slug — `claude-ai`,
 * `cursor`, `claude-code`, or `unknown` when the client sent nothing usable.
 *
 * Read from `initialize`'s `clientInfo`, which is software identity, not a
 * person: this endpoint is unauthenticated and cannot know who anyone is. It is
 * still a string an anonymous caller chose, and it ends up in an analytics
 * property, so it is normalized on the same terms as sanitizeUtmSource() in
 * core/utils.ts — lowercased, restricted to a small charset, and cut short —
 * rather than trusted. That also collapses the casing and spacing variants of
 * one client into a single key, which is what makes the number countable.
 */
export function clientLabel(clientInfo: unknown): string {
  const name = isPlainObject(clientInfo) ? clientInfo.name : undefined;
  if (typeof name !== 'string') return 'unknown';
  const cleaned = name.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 64);
  return cleaned.length > 0 ? cleaned : 'unknown';
}

/**
 * Handle one JSON-RPC message.
 *
 * Returns the response to send, or `null` when the message was a notification
 * or a response (nothing to reply with — the caller answers 202). Never throws:
 * a handler that throws becomes an `isError` tool result, because the spec is
 * explicit that tool-execution failures belong in the result where the model
 * can see and correct them, while protocol-level problems (unknown method,
 * unknown tool, bad params) belong in a JSON-RPC error.
 */
export async function handleRpcMessage(
  message: unknown,
  registry: ToolRegistry,
): Promise<JsonRpcResponse | null> {
  if (!isPlainObject(message)) {
    return rpcError(null, RPC.INVALID_REQUEST, 'Request must be a JSON-RPC 2.0 object.');
  }

  const id = readId(message);

  // A JSON-RPC *response* (the client answering a server request) carries
  // result/error instead of method. We never send server->client requests, so
  // one arriving here is a no-op rather than an error.
  if (!('method' in message)) {
    if ('result' in message || 'error' in message) return null;
    return rpcError(id, RPC.INVALID_REQUEST, 'Missing "method".');
  }

  const method = message.method;
  if (typeof method !== 'string') {
    return rpcError(id, RPC.INVALID_REQUEST, '"method" must be a string.');
  }

  if (message.jsonrpc !== '2.0') {
    return rpcError(id, RPC.INVALID_REQUEST, '"jsonrpc" must be exactly "2.0".');
  }

  const params = isPlainObject(message.params) ? message.params : {};

  // Notifications carry no id and get no reply, whatever they are. Swallowing
  // unknown ones is deliberate: a client is free to emit notifications we do
  // not implement, and replying with an error to something that cannot receive
  // a reply is worse than silence.
  if (id === null) {
    return null;
  }

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: negotiateProtocolVersion(params.protocolVersion),
        // Tools only. No resources, prompts, logging, completions or tasks —
        // declaring a capability we do not implement makes clients call into a
        // method-not-found.
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });

    case 'ping':
      // Liveness probe. The spec's result is an empty object.
      return ok(id, {});

    case 'tools/list':
      // The list is small and fixed, so it is returned whole; omitting
      // nextCursor is how a server says "that is all of them".
      return ok(id, { tools: registry.definitions });

    case 'tools/call': {
      const name = params.name;
      if (typeof name !== 'string') {
        return rpcError(id, RPC.INVALID_PARAMS, 'tools/call requires a string "name".');
      }
      const args = isPlainObject(params.arguments) ? params.arguments : {};

      // "Any errors in *finding* the tool ... should be reported as an MCP
      // error response" — unlike a tool that runs and fails.
      if (!registry.definitions.some((d) => d.name === name)) {
        return rpcError(id, RPC.INVALID_PARAMS, `Unknown tool: ${name}`, {
          available: registry.definitions.map((d) => d.name),
        });
      }

      try {
        return ok(id, await registry.call(name, args));
      } catch (err) {
        // Execution failure. Hand it back inside the result so the model sees
        // what went wrong and can retry or say so, rather than the client
        // surfacing an opaque protocol error.
        const detail = err instanceof Error ? err.message : String(err);
        return ok(id, {
          content: [{ type: 'text', text: `Tool "${name}" failed: ${detail}` }],
          isError: true,
        } satisfies McpToolResult);
      }
    }

    default:
      return rpcError(id, RPC.METHOD_NOT_FOUND, `Unsupported method: ${method}`);
  }
}
