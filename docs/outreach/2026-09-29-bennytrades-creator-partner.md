# Creator Partner prospect: @bennytrades_ (2026-09-29)

Michael found https://x.com/bennytrades_ as a possible Creator Partner. This is
the read on him and a first DM per stage 1 of
[creator-partner-outreach.md](../creator-partner-outreach.md), one line per
paragraph so it pastes straight into X.

Everything below is from his profile and his 38 most recent posts, replies not
included (Thu Sep 24 to Tue Sep 29), read 2026-09-29.

**Update, 2026-09-29: his DMs are closed, so the draft below hasn't gone out.**
If it was tried from an account other than @ZeroGEXOptions, try once from that
one. It has a blue check, and his inbox may take DMs from verified accounts
only. If it's closed there too, move to the next prospect. The only other way
in is a public reply, and that's too visible for a fit this marginal.

## The read

**Worth one DM, for the feedback. Don't count on the affiliate.**

- **Who he is.** "benny ッ", bio "Full time options trader | Analysing GEX, Flow
  & TA daily". 8,549 followers, on X since March 2025, 13,416 posts. A typical
  post gets about 2,300 views and 10 likes. His best post in those six days
  got 21,800 views.
- **He reads GEX daily.** Call walls, put walls, positive and negative gamma
  nodes, flips. His audience asks him for reads: "market is puking, who
  wants some heatmaps? drop your ticker" got 21 replies.
- **He's already a Bullflow affiliate.** His profile link is
  `bullflow.io/?ref=benny`, and 3 of his 38 posts promote Bullflow, one with
  "you can get access to this data for just $39 a month" and his link. Both
  heatmaps I opened are Bullflow screenshots, including the SPY/QQQ one the DM
  below refers to. His "gold GEX channel" is Bullflow's GEX Channels overlay.
- **Almost none of his feed is something ZeroGEX covers.** ZeroGEX does SPY,
  QQQ, SPX, NDX, ES and NQ only (`frontend/core/symbols.ts`). Two of his 38
  posts were in that lane: a premarket SPY/QQQ gamma read on Tuesday and a QQQ
  weekly double-top chart on Monday. The rest are single stocks (RKLB, NBIS,
  CRWV, TSLA, META and others), crypto, or chatter.
- **None of the three Bullflow posts says "#ad" or "affiliate".** Our program
  requires that disclosure. It only matters if he reaches the affiliate stage.
  If he does, spell the requirement out plainly.

What that means: the 90-day grant costs almost nothing, and someone who reads
heatmaps every day is a good tester for the SPY/QQQ side of the product. But he
already earns from a $39/month tool that covers the single names his audience
asks about, so he's unlikely to push ZeroGEX to them. Run the playbook as
written and pitch the affiliate only on a real positive signal (stage 7).

## Draft: cold DM

Two changes from the stage 1 template. The opener cites his SPY/QQQ read, and
one added paragraph says up front that ZeroGEX is index-only, so he doesn't
register expecting RKLB heatmaps and write it off.

Don't mention Bullflow. He'll compare the two on his own, and naming it turns an
offer into a pitch against a tool he earns from.

```
Hey Benny — saw your premarket read on SPY and QQQ: both sitting in positive gamma, with $760 and $735 as the supports that had to hold.

I built ZeroGEX as a live options positioning map for SPY/SPX/QQQ/NDX: gamma exposure, call/put walls, dealer positioning, and options flow that updates throughout the session. The goal is to help traders see where the market may pin, reject, squeeze, or break before price gets there.

One heads-up: it's index-only, so it won't cover RKLB, NBIS or the other single names you post. It's for the SPY/QQQ side of your feed.

I'd love to offer you free Pro access for 90 days. No posting requirement and no strings attached. Just genuinely test it during live sessions and tell me what feels useful, confusing, or missing.

If you're interested, register at https://zerogex.io/register with the email you'd like to use, click the verification link, and reply here — I'll flip on Pro as soon as I see the account.
```

The opener names no day, so it reads fine through Friday. If it goes out next
week, swap in a newer SPY or QQQ post of his.

## Follow-up

Once, 4 to 5 days after the DM if he hasn't replied, using the stage 2 template
unchanged. Sent today, that's Saturday Oct 3 or Sunday Oct 4. After that, move
on.

## When he registers

```bash
# 1. Account exists and email is verified (email_verified_at not NULL)
sudo sqlite3 /var/lib/zerogex/auth.db \
  "SELECT id, email, tier, email_verified_at, created_at
   FROM users WHERE email='<his-email>';"

# 2. Grant 90 days of Pro and set up his partner code
cd ~/zerogex-web
make grant-partner-pro \
  EMAIL=<his-email> \
  PROMO_CODE=BENNY25 \
  X_HANDLE=bennytrades_ \
  YES=1
```

- `BENNY25` follows the house pattern (@PCB → PCB25). The script refuses a code
  another partner already holds. If it does, pick another.
- `X_HANDLE` records @bennytrades_ on his account.
- Then send the stage 5 activation DM (the deferred-affiliate version), with the
  expiry date the script prints.

## If he replies

- **"I already use Bullflow."** Fine. Nothing here asks him to switch or post.
  Something like: "Makes sense, keep using it. This is just 90 days to see
  whether the index read adds anything to your SPY/QQQ calls."
- **He asks whether single stocks are coming.** Don't promise it. The product
  covers no single names today.
- **He asks about an affiliate deal up front.** Use the stage 5b activation DM
  (the upfront-affiliate version) instead of stage 5.
