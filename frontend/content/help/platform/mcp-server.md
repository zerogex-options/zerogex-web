# The ZeroGEX MCP Server (free, no key)

*Connect Claude, ChatGPT, Cursor or any other MCP client to ZeroGEX's free delayed gamma levels, and ask where the flip is without leaving the conversation.*

---

## What it is

`https://zerogex.io/mcp` is a hosted [Model Context Protocol](https://modelcontextprotocol.io) server. Point an AI assistant at that URL and it can read ZeroGEX dealer-positioning levels directly — the gamma flip, the call and put walls, max pain, the same-day pin strike, and net dealer gamma at spot — for SPX, SPY, QQQ, NDX, ES and NQ.

There is nothing to install, no key to generate, and no account to create. Reading is free.

It serves the same data as the free [Gamma Levels pages](/spx-gamma-levels): **delayed by up to 15 minutes**. That is the whole tier. The real-time feed is a Pro feature and lives behind the [API](/help/platform/api-access); this endpoint is not a way around that.

This page is about *using* our hosted server. If you want to build your own MCP server against the real-time Pro API, that is [Building an MCP Server on the ZeroGEX API](/help/platform/mcp-integration).

## Connecting

The server speaks the Streamable HTTP transport, which is what current MCP clients expect from a remote server. Most of them just need the URL.

**Claude (desktop and web).** Open your connector settings, add a custom connector, and paste `https://zerogex.io/mcp`. There is no authentication step — if the client asks for a key, leave it blank.

**Claude Code.**

```bash
claude mcp add --transport http zerogex https://zerogex.io/mcp
```

**Cursor.** Add the server to `~/.cursor/mcp.json` (or the project-level `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "zerogex": {
      "url": "https://zerogex.io/mcp"
    }
  }
}
```

**Anything else.** Any client that accepts a remote MCP server URL will work. If yours only supports local `stdio` servers, put a bridge such as `mcp-remote` in front of it.

The server is also listed in the official [Model Context Protocol registry](https://registry.modelcontextprotocol.io) as `io.zerogex/gamma-levels`, so clients that browse the registry can find it by name without the URL.

To check the connection without a client at all:

```bash
curl -sS -X POST https://zerogex.io/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## The two tools

**`get_gamma_levels`** — everything for one symbol: spot, the modeled regime, net dealer gamma at spot, gamma flip, call wall, put wall, max pain, the same-day pin strike, and each level's distance from spot.

**`get_market_gamma_overview`** — spot, regime and flip for all six symbols in one call. Built for the opening question ("what does positioning look like today?") so an assistant answers it once instead of making six calls.

Both are read-only. Nothing you ask can change anything on your account, because the server does not know who you are.

Questions that route to them naturally:

- "Where is the SPX gamma flip right now?"
- "Is QQQ in positive or negative gamma?"
- "Which indices are below their gamma flip today?"
- "How far is SPY from its call wall?"

## What the answers will tell you, and what they will not

Every response leads with its own age and says plainly that the data is delayed. This is deliberate. Hand a language model the number `6412.50` and it will report the gamma flip is at 6412.50 in exactly the confident register it uses for a live quote — so the tool output carries the caveat, not just the number, and a well-behaved assistant will repeat it.

Three things worth knowing before you trade off an answer:

- **The levels are up to 15 minutes old.** On a fast tape the market can be through a level well before the snapshot shows it. These are good for orientation and structure, not for timing an entry at the current price.
- **A missing level is a real answer.** When the modeled book does not support a gamma flip, the server says the level is unavailable. It is not zero, and it is not an error. An assistant that substitutes a number there is making one up — ask it where the number came from.
- **Positioning is not direction.** These levels describe how dealer hedging tends to behave around price. They are not a forecast and not a recommendation, and the server says so on every call.

If the assistant reports levels without mentioning the delay, ask it directly how old the snapshot is. The age is in every response it received.

## Limits and availability

There is no key, so there is no per-user quota. The server answers from the same cache as the public gamma-levels pages and refreshes about every 15 minutes, so calling it more often than that returns the same snapshot — polling faster buys nothing.

When the backend is briefly unavailable, tools return an explicit "temporarily unavailable" result that tells the assistant not to fill the gap from memory. That is a normal transient state, not a sign your configuration is wrong.

Outside market hours the most recent snapshot is the last one of the session, and the response says so rather than flagging perfectly good data as stale.

## Where to go next

- [Free Gamma Levels: SPX](/spx-gamma-levels) — the same data as a page.
- [API Access & Keys (Pro)](/help/platform/api-access) — the real-time feed.
- [Building an MCP Server on the ZeroGEX API](/help/platform/mcp-integration) — roll your own against Pro data.
- [Data Coverage & Refresh](/help/platform/data-coverage) — symbols, hours, cadence.
