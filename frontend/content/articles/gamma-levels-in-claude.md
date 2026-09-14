# How to Get SPX Gamma Levels in Claude, ChatGPT and Cursor

*Ask an AI assistant where the gamma flip is and it will usually invent a number. Connecting it to a live source fixes that. Here is how, what to ask, and how to tell a real answer from a fabricated one.*

---

## The problem with asking an assistant for a level

Ask Claude or ChatGPT "where is the SPX gamma flip today?" and you will get an answer. It will be confident, it will be formatted like a real reading, and unless the assistant went and fetched it, it will be made up.

This is not the model being careless. A language model answers from what it learned during training, and a gamma flip is a number that changed this morning and will change again this afternoon. There is nothing in training data that could be right. When a model has no source, plausible-sounding output is the failure mode, and a fabricated level is indistinguishable from a real one at a glance.

The fix is not a better prompt. It is giving the assistant somewhere to look.

## What MCP is, in one paragraph

The [Model Context Protocol](https://modelcontextprotocol.io) is a standard way for an AI assistant to call an outside data source. A publisher runs a small server; you add its address to your assistant once; from then on the assistant can call it when a question needs live data. Claude, ChatGPT and Cursor all speak it. It is the difference between an assistant that guesses at a gamma flip and one that goes and reads it.

## Connecting ZeroGEX

ZeroGEX publishes a free MCP server at `https://zerogex.io/mcp`. It serves the same 15-minute-delayed levels as the public [gamma levels pages](/spx-gamma-levels) — gamma flip, call wall, put wall, max pain, same-day pin strike and net dealer gamma at spot, for SPX, SPY, QQQ, NDX, ES and NQ. There is no key, no account and nothing to install. Reading is free.

**Claude (desktop or web).** Open your connector settings, add a custom connector, paste the URL. If it asks for a key, leave it blank.

**Claude Code.**

```bash
claude mcp add --transport http zerogex https://zerogex.io/mcp
```

**Cursor.** Add it to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "zerogex": {
      "url": "https://zerogex.io/mcp"
    }
  }
}
```

**Anything else.** Any client that accepts a remote MCP server URL will work. Clients that browse the official registry can find it by name as `io.zerogex/gamma-levels`. If yours only supports local `stdio` servers, put a bridge such as `mcp-remote` in front of it.

The full setup notes, including how to check the connection with `curl` and what to do when a client misbehaves, are in [the Help Center](/help/platform/mcp-server).

## What to ask it

The point is not to learn a command syntax. Ask in ordinary language and the assistant picks the tool:

- *"Where is the SPX gamma flip right now, and how far is spot from it?"*
- *"Is QQQ in positive or negative gamma?"*
- *"What does dealer positioning look like across the indices today?"*
- *"How far is SPY from its call wall, and what would a break above it mean?"*
- *"Is there a same-day pin strike on SPX?"*

The last two are where an assistant earns its keep over a page of numbers. It has the level *and* the explanation, so it can tell you the call wall is 1.4% above spot and that in a positive-gamma regime hedging tends to lean against a rally into it — without you switching between a dashboard and an education page.

Two questions it answers well that a page cannot:

- *"Compare SPX and SPY positioning — do the two books agree?"* One call, both books, and the divergence called out.
- *"I'm looking at a breakout above 6450. What's between here and the call wall?"* Your context, its levels.

## Telling a real answer from a fabricated one

This matters more than the setup, because a connected assistant and an unconnected one look identical until you check.

**A real answer states its age.** Every response from the ZeroGEX server leads with the snapshot's timestamp and how old it is, and instructs the assistant to repeat that. If you get a gamma flip with no mention of when it was computed, be suspicious — the number probably came from the model, not the server.

**Ask it directly.** *"Where did that number come from, and how old is it?"* A connected assistant will tell you the snapshot time. An unconnected one will equivocate.

**A missing level should stay missing.** When the modeled book does not support a gamma flip, the server returns "unavailable" rather than a number. An assistant that turns that into `0` or quietly supplies a level is filling a gap. Ask it where the value came from.

**Outages are visible.** If the backend is briefly unreachable, the tool returns an explicit "temporarily unavailable" and tells the assistant not to answer from memory. That is a normal transient state, not a broken configuration.

## What this is not

**It is not real-time.** The free tier is delayed by up to 15 minutes, on purpose. That is good for orientation and structure — where the walls are, which regime you are in, how far spot is from the flip. It is not good for timing an entry at the current price, because on a fast tape the market can be through a level before the snapshot shows it. The real-time feed is a Pro feature behind [an API key](/help/platform/api-access).

**It is not a signal service.** The server returns positioning, not direction. A gamma flip tells you which hedging playbook the modeled book is running, not whether to buy. It says so on every call.

**The levels are modeled, not observed.** Dealer positioning is inferred from public option data under a stated sign convention — nobody publishes their book. The [methodology page](/methodology) is the honest account of what that does and does not support.

**Assistants still get things wrong.** Connecting one to a real source removes the fabricated-number failure. It does not remove misreading, over-confidence, or an assistant carrying an old answer forward in a long conversation. Ask for the age when it matters.

## Is this worth doing?

If you already keep a dashboard open, probably not — you are one glance from the same numbers.

It is worth it if you work inside an assistant already: writing up a trade plan, reasoning through a setup, or asking follow-up questions that need both the level and what it means. The saving is not the lookup, it is not breaking context to do the lookup.

It is also the fastest way to check a level from a phone, on a laptop without your charting setup, or in the middle of a conversation about something else.

## See also

- [The ZeroGEX MCP Server](/help/platform/mcp-server) — full setup and troubleshooting.
- [Free SPX Gamma Levels](/spx-gamma-levels) — the same data as a page.
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) — what the level actually means.
- [Building an MCP Server on the ZeroGEX API](/help/platform/mcp-integration) — for Pro users who want real-time data and their own tool shapes.

Educational content only — none of the above is a trade recommendation.
