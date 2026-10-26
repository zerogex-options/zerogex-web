# Aaron B: wall alerts through the API are live (2026-10-26)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Aaron signs "Aaron" and shows as *Aaron B* (aabbon@gmail.com). He's on Pro and
works through the API from his own system (a Python app on a VPS that also
takes TradingView webhooks; see `2026-10-12-aaron-1dte-levels-and-es-replay.md`).
Reply in his thread "Here you go Michael".

> **Status:** draft, unsent. Run "Confirm before sending" first.

## Thread since

1. **Fri Oct 23, 7:03 PM, inbound.** "Is it possible that you can enable my API
   key to be able to get wall alerts through my program? Or basically, allow
   alerts to be sent through the API."
2. **Fri Oct 23, 10:17 PM, outbound** (Michael's own). "BRILLIANT idea! I'm
   going to make it happen this weekend. I'll keep you posted."
3. **Mon Oct 26.** The stream and the paged endpoint deployed (zerogex-oa
   `src/api/wall_alert_stream.py`, `src/api/routers/wall_alerts.py`), along
   with every-day vs today-only alerts and the Discord / Slack channel on the
   website.

The earlier Aaron doc lists a third reply (GEX regime history, drafted
2026-10-20) as unsent. If it never went out, it's still ready there.

## The read

- **Lead with "it's live" and "nothing to enable".** He asked for his key to be
  enabled. `/events` and `/stream` sit on the same GEX scope as the levels and
  GEX endpoints he already calls (zerogex-oa `src/api/main.py`,
  `include_router(wall_alerts_router, dependencies=[_scope_gex])`), so his
  current key works as is.
- **The stream fits his system.** He runs a long-lived program on a VPS, so one
  open connection that gets alerts pushed beats polling. The paged endpoint is
  there if his framework only does request/response.
- **The query string is the subscription, not his saved rules.** The stream
  serves every alert the detector records that matches the filter, whether or
  not anyone saved a rule. To hear the same alerts as a rule on the website, he
  uses the same profile, touch and strength settings. There is no daily cap on
  the stream (the 60-a-day cap only applies to delivery to a member).
- **Tell him to reconnect on his own.** The API ends every open stream when it
  restarts, so it drops on each deploy. Resuming with the last id loses
  nothing. Most SSE libraries don't reconnect by themselves, so the email
  doesn't promise they do.
- **Use the documented paths, not `/api/v2/`.** The v2 mirror of `/events`
  works (results inside `data`), and `/stream` is mounted under v2 too, but the
  path that was tested end to end through nginx is `/api/alerts/walls/stream`.
  That's also what the API docs show him.
- **Website changes get one line.** He's a heavy user, so he'll want to know,
  but the email is about the API.

## Confirm before sending

On the EC2 box, from `~/zerogex-oa`. This reads the ops key from `.env` without
printing it, opens the live stream for 8 seconds, and closes it:

```bash
KEY=$(grep -E '^(OPS_API_KEY|API_KEY)=.' .env | head -1 | cut -d= -f2- | tr -d "\"'"); curl -sN -m 8 -H "Authorization: Bearer $KEY" "https://api.zerogex.io/api/alerts/walls/stream"; echo
```

Within a second it should print `retry: 5000`, an `id:` line, `event: ready`
and a `data:` line. The `"symbols"` list in that data line is what the stream
serves; it should be `["SPY","QQQ","SPX","NDX"]`. Then it sits quietly until the
8 seconds run out.

- **Different symbols:** change the symbols line in the draft to match.
- **Nothing prints for the full 8 seconds:** something in front of the API is
  holding the stream back. Don't send; ask Claude.
- **`401` or `403` text instead:** the key in `.env` isn't valid for this.
  Rerun with your own Pro key in place of `$KEY`.

## Draft

**Subject:** Re: Here you go Michael

Hi Aaron,

It's live. Wall alerts now come through the API, and your current API key already has access, so there's nothing to turn on.

**Streaming (best for your system)**

Open one connection and each alert is pushed to you within about a second of firing:

curl -N -H "Authorization: Bearer YOUR_KEY" "https://api.zerogex.io/api/alerts/walls/stream?symbols=SPX,SPY&events=hit,break"

It's standard Server-Sent Events, so most languages have a library for reading it.

**Polling**

If you'd rather poll, /api/alerts/walls/events returns the same alerts in pages. Call it every few seconds with after_id set to the next_after_id from your last response, and you'll get each alert exactly once.

**Choosing which alerts you get**

The query string decides, and each setting works the same as on the website's alerts page:

- symbols: SPY, QQQ, SPX and NDX. For ES and NQ, use SPX and NDX.
- side: call, put or both.
- events: hit, break and hold.
- profile: responsive, balanced (the default) or conservative. This sets how much chop gets filtered out.
- touch_bp: how close price must get to count as a hit, in basis points: 1, 5, 10 or 25. Leave it out to use the profile's own setting.
- min_strength_pctile: 0 to 95. For example, 75 means only walls stronger than 75% of that symbol's readings at the same time of day over the last 30 days.

You don't need to save an alert on the website for any of this, and the stream has no daily limit.

**Two tips**

1. Every alert has an id. If the connection drops, reconnect with the last id you received in a Last-Event-ID header, and you'll get everything you missed. The connection also closes whenever we restart the server, so have your program reconnect on its own.
2. One connection covering all your symbols works better than one per symbol. You can have up to 5 open at once.

Everything is in the API docs under Wall Alerts: https://api.zerogex.io/docs

Two other changes on the website you might like: an alert now stays on every day until you turn it off (or you can set one for today only), and alerts can post to a Discord or Slack channel.

Thanks again for the idea. I'd love to hear how it works with your system.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **He wants alerts posted to his own server, like his TradingView webhooks.**
  Not today. The webhook channel only posts to Discord and Slack addresses, on
  purpose: a server that posts to any address a member types can be pointed at
  internal machines (`frontend/core/wallAlertWebhook.ts`, `parseWebhookUrl`).
  The stream gives him the same thing with his program connecting out. A
  general signed webhook is a real project (address checks, signing, retries).
  No promise or date.
- **He uses `/api/v2/`.** `/api/v2/alerts/walls/events` works, with the page
  inside `data` like his other v2 calls. Point him at
  `/api/alerts/walls/stream` for the stream.
- **He gets a `429`.** More than 5 streams open on his key. One stream with all
  his symbols fixes it.
- **He sees an `event: gap`.** He reconnected more than 500 alerts behind, or
  the replay failed. The frame names the range; he pages those alerts from
  `/events` with `after_id`. The stream carries on live.
- **He asks for `ES` or `NQ` as symbols.** The API answers `422` and says to use
  SPX / NDX. The walls come from the SPX and NDX options books.
- **He got an alert his website rule didn't send him, or the reverse.**
  Different settings (profile, touch, strength floor), or his rule hit the
  60-a-day member cap, which the stream doesn't have. Compare his query string
  with the rule on `/account/alerts`.
- **He wants past alerts for a backtest.** `/events` without `after_id` returns
  the newest page (`limit` up to 500), and `after_id=0` pages forward from the
  first alert recorded. Check `SELECT MIN(detected_at) FROM wall_alert_events;`
  (`make psql` in zerogex-oa) before telling him how far back that goes.
