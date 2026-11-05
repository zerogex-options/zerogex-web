# Noah Cox, ConnectTrade: broker API pitch (2026-11-04)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Noah Cox, Chief Customer Officer at ConnectTrade (noah@connecttrade.com,
www.connecttrade.com), wrote to support on Wed Nov 4 at 9:28 PM:

> Hi team,
>
> Let me know if we can help you connect to brokers. We're a normalized broker
> api that connects to 20+ brokers with a single integration including brokers
> like Schwab, Fidelity, Webull, and others.
>
> Happy to share more if that sounds interesting,
> Noah

## The read

- **Not a fit today.** ConnectTrade sells one API that lets an app place trades
  in its users' brokerage accounts and read their balances and positions.
  ZeroGEX does neither. It's analytics: section 5 of the Terms says ZeroGEX
  isn't an investment adviser or broker-dealer, and trade decisions are the
  user's. The TradeWorkz bots record modeled trades in our own database and
  never reach a broker, and Follow sends alerts, not orders.
- **It is the plumbing for your long-term idea.** On Oct 12 you told Rod the
  "pipe dream" is a trading engine: configure what you want, connect your
  brokerage, and ZeroGEX trades it for you, with regulatory and legal work
  first ([2026-10-12-rod-futures-youtube.md](2026-10-12-rod-futures-youtube.md)).
  That is exactly what ConnectTrade is for. One of their case studies is
  Tradetron, a no-code auto-trading platform. So the answer is "not now," with
  the door left open.
- **Their site already answers the usual questions, so the draft doesn't ask
  them.** From the home, pricing, integrations and FAQ pages on
  connecttrade.com, read the night the email arrived:
  - 21 brokers, including Schwab, Fidelity, Webull, Interactive Brokers,
    TradeStation, Tastytrade and Tradier.
  - Single and multi-leg options trading on every plan. Their broker table
    marks multi-leg options as available at Interactive Brokers and
    TradeStation. Futures and crypto are read-only.
  - Public pricing. Builder is $19 a month for 10 connected users, then $1.90
    per extra user. Growth is a $500 monthly minimum on an annual contract,
    covering 500 users, then $1.00 per extra user. Enterprise is custom.
- **The one open question is the legal one.** The site says ConnectTrade
  "handles broker relationships, compliance, and infrastructure." It doesn't
  say who is responsible when an app's users trade off that app's signals, or
  whether that changes when the app places orders automatically instead of the
  user confirming each one. That's the blocker you named to Rod, so it's the
  only thing the draft asks. Treat his answer as background for a lawyer, not
  as legal advice.
- **No call.** None of this is near-term, so the draft says email is enough.

## Draft

**Reply in the same thread** (subject stays "Re: Connect to brokers?").

Hi Noah,

Thanks for reaching out. Right now ZeroGEX is purely analytics: we publish gamma exposure levels and options flow, and traders act on them in their own trading platforms. We don't place trades or connect to anyone's brokerage account, so this isn't something we need today.

Longer term, letting traders connect their brokerage accounts is on my list. It's a ways off, though, and the legal groundwork has to come before the plumbing. When we get there, a single API like yours is exactly what I'd look at.

I had a look at your site, and it covers most of what I'd ask: the broker list, multi-leg options and pricing. The one thing I couldn't find is the regulatory side. How do the signal and analytics companies on your platform usually handle it when their users trade off those signals, and does that change between the user confirming each order and the platform placing orders automatically?

No need for a call yet. I'll keep your details on file and reach out when we get closer.

Best,
Michael
ZeroGEX

**Shorter version:** delete the third paragraph (the one starting "I had a look
at your site"). The rest reads fine without it.

## If Noah replies

- **He answers the regulatory question.** Paste his answer here under a dated
  heading. It's background for a lawyer when the brokerage idea gets real, not
  a green light.
- **He pushes for a call or a demo.** Optional. If you answer at all: "Happy to
  once there's a project on our side. There isn't one yet."
- **He pitches their market data.** It doesn't replace a licensed data vendor.
  Broker data is generally for the account holder's own use, and the vendor
  review turned down Interactive Brokers, Schwab and tastytrade for that reason
  (`oa:docs/design/realtime-market-data-vendors.md`). Ask whose license it
  would be before going any further.
- **Routine sales follow-ups with nothing new.** No reply needed. The door is
  already open.
