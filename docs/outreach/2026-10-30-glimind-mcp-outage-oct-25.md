# Glimind: /mcp "unreachable for 25 minutes on Oct 25" (2026-10-30)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound, Fri Oct 30, 11:01 AM.** support@glimind.com replied in the thread
"ZeroGEX - SPX/SPY/QQQ/NDX gamma levels was unreachable for 25 minutes on Oct
25", with what their monitor saw:

- Endpoint: `https://zerogex.io/mcp`, "the MCP handshake we run every few
  minutes".
- Window: about 02:45 to 03:10 UTC on Oct 25. That's **Sat Oct 24, 10:45 to
  11:10 PM ET**.
- HTTP 5xx on every check in that window, normal again from 03:10 UTC.
- Other servers on other hosts stayed up. Healthy since, "readiness grade A".
- An offer to "verify the server for free" for outage alerts, through a
  `/claim/` link.

> **Status:** draft, not sent.

## What happened: the Node security upgrade that Saturday night

The window matches, to the minute, the night the site moved to Node 22.23.4
(the Oct 21 security release). Times are UTC, with ET in brackets:

| Time | What |
|---|---|
| 02:27 (10:27 PM Sat) | `release` merge `1a1ad97` brings in `2d0fc43`. Its `040.pm2` ran `pm2 update` to move PM2 onto the new Node. |
| 02:45 (10:45 PM) | Glimind's first failed check. On prod, `pm2 update` had stopped the PM2 daemon that started at boot. systemd's `pm2-ubuntu` unit then ran its own stop command (`pm2 kill`), which killed the new daemon and the site with it, and left `pm2 update` hanging. |
| 02:55 and 03:06 | Fixes `c7a4307` and `98f10d7` on `claude/loving-hypatia-i4fwxd`. The second one's message describes the failure above. |
| 03:10 (11:10 PM) | Site back. Glimind: "answered normally again from 03:10 UTC". |
| 04:04 (12:04 AM Sun) | `release` merge `c807224` puts the fixed step on `release`. |

- **The whole site was down, not just `/mcp`.** `/mcp` is a route in the same
  Next.js app (`frontend/app/mcp/route.ts`), and the handshake Glimind runs
  (`initialize`) never touches the data backend (`frontend/core/mcp/protocol.ts`).
  A 5xx on it means the app itself wasn't answering.
- **Low impact.** Saturday night, with stocks and futures both closed.
- **Already fixed.** `deploy/steps/040.pm2` on `release` now stops a
  boot-started daemon with `systemctl stop`, which waits for that stop command
  to finish, and its comment records this incident. A future Node upgrade still
  takes the site down for a few seconds while PM2 restarts. That's by design,
  and nothing like 25 minutes.
- **Not a scheduled job, so it won't repeat weekly.** The box runs on ET. The
  weekly VACUUM FULL fires Sunday 2:30 AM ET (06:30 UTC), the Cloudflare
  IP-range refresh Sunday 4:30 AM ET, and unattended-upgrade reboots at 3:00 AM
  ET. All of them are hours after this window.

## The read

- **It was us, it was maintenance, and it's fixed.** Nothing to do on the
  server.
- **Replying is optional.** Glimind isn't a customer or a vendor. If you want to
  close the thread, the draft below does it in three sentences.
- **Keep the cause general.** "Maintenance" and "a restart that hung" are true
  and enough. Don't name the Node security fix: there's no reason to tell an
  outside party the box ran a Node version with a published code-execution bug.
- **Pass on the claim link.** A web search on Oct 30 found nothing about
  Glimind, so it's new or obscure. It appears to watch every server in the
  official MCP registry (its links name our listing,
  `mcp-registry/io.zerogex/gamma-levels`) and email the owners. "Verify for
  free" is its sign-up. An alert wouldn't have helped on Oct 24 anyway, because
  you were the one at the keyboard. If you ever want outside alerts for when
  you're not, a mainstream uptime service watching the homepage and `/mcp` is
  the better home for them. That can wait.

## Draft reply

Reply in the same thread.

Hi,

Thanks for sending the details. That was us: we were doing maintenance on the server, and a restart hung and took the site down until 03:10 UTC. The step that hung is fixed now.

We'll pass on verifying the server for now, but I appreciate the heads-up.

Best,
Michael
Founder, ZeroGEX
