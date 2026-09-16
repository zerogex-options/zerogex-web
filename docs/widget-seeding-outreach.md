# Widget Seeding — Outreach Playbook

How the free gamma-levels widget (`zerogex.io/embed`) gets onto other people's
sites. Internal reference; not shipped. Update the templates as the offer or
the product changes.

Companion to [creator-partner-outreach.md](creator-partner-outreach.md), which
is a different motion for a different ask — that one asks someone to evaluate a
whole platform over 90 days, this one asks for one paste. Keep them separate.
A creator mid-evaluation should not get a widget pitch in the same week.

---

## What this is actually for

The 4 September Search Console review ended on the finding on-page work cannot
fix: the pillar ranks ~55 for "gamma exposure" because almost nothing outside
the site links here. [backlink-kit.md](seo/backlink-kit.md) is the instrument
for that and it is manual — one placement at a time, mostly nofollow.

The widget is the other lever. Each embed is a link someone chose to keep, next
to a card that refreshes itself every market day. **But the link is not the
iframe.** A link inside a frame points from our origin to our origin and is
worth nothing. The snippet writes a plain `<a>` into the *host's* markup, and
that anchor is the entire SEO mechanism.

Two consequences for how you pitch:

1. **Never ask anyone to keep a specific anchor text.** The builder page tells
   embedders to reword the credit line, and you should repeat that in the DM.
   Distributing one identical optimized anchor at scale is what Google calls a
   link scheme. An editable credit line is not, and it is the only version
   consistent with the white-hat rule the backlink kit already sets.
2. **A placement that drops the credit entirely is still worth having.** It
   still sends referral traffic, and it still puts the brand in front of the
   right audience daily. Do not chase people for attribution.

---

## Before you send anything: can they even embed it?

This is the first qualifying question and it kills a lot of prospects. The
widget is an iframe plus an optional script. Platforms that forbid custom HTML
cannot render it *at all* — no snippet, no workaround.

| Platform | Embed works? | Notes |
|---|---|---|
| Self-hosted WordPress | Yes | Custom HTML block |
| WordPress.com | Business plan and up | Free/Personal tiers block custom HTML |
| Ghost | Yes | HTML card |
| Webflow | Yes | Embed element |
| Squarespace | Business plan and up | Code block |
| Notion | Yes | Embed block takes the frame URL directly |
| Hand-written HTML / static sites | Yes | The easy case |
| **Substack** | No iframe — **image** | No custom iframes or scripts in posts |
| **Medium** | No iframe — **image** | Same |
| **Discord / Slack** | No iframe — **image** | Chat apps. Not a web page. |
| **Email newsletters** | No iframe — **image** | No mail client executes a frame; `<img>` is fine |

**Check the prospect's platform before drafting.** Sending "paste this iframe"
to a Substack writer wastes the contact and makes you look like you did not
look at their site. View-source on any post tells you in ten seconds.

Every "No iframe" row takes the PNG card instead —
`https://zerogex.io/embed/image/SPX.png`, same levels, same 15-minute
schedule. **It is not the same product, and you must not pitch it as one.**
Those platforms copy the file onto their own CDN when the post publishes, so
the reader sees the levels frozen at that moment rather than a card that keeps
updating. The card prints its own "as of" time on its face for exactly this
reason. See §5.

---

## The one-line version of the pitch

> You post SPX levels by hand every morning. This does it for you and never
> goes stale.

Everything below is that sentence, aimed at a specific person.

---

## 1. Existing creator partners (warmest — start here)

Anyone already holding a partner Pro grant. They know the product, they have a
thread with you, and the ask is trivially small. Send into the existing DM
thread, not as a new pitch.

```
Small thing, and genuinely no obligation — I built a free embeddable
version of the gamma levels: zerogex.io/embed

Pick a symbol, copy the HTML, paste it into a page. It shows the flip,
both walls and net GEX, and refreshes itself every 15 minutes through
the session, so it's current every morning without you touching it.

If you keep a levels post or a site page where that would save you
typing numbers in by hand, it's yours. If it doesn't fit anywhere, no
problem at all — not asking you to post about it.
```

**Do not** attach this to the affiliate pitch, and do not send it in the same
message as the 30-day check-in. It is a favor offered, not a favor requested,
and it stops reading that way the moment it arrives bundled with an ask.

---

## 2. Newsletter and blog writers who publish market notes

The core target: someone who already writes a recurring SPX/SPY/QQQ piece and
is manually typing levels into it. Qualify on their platform first (§0).

Personalize the opener with something specific and recent. If you cannot find
something in two minutes, this is not a warm enough prospect — move on.

```
Hey [Name] — [your Tuesday note on the 6,700 call wall was the only one
I saw that mentioned the flip had moved with it].

I build ZeroGEX. We publish free 15-minute-delayed gamma levels, and I
just shipped an embeddable version of them: zerogex.io/embed

It's one line of HTML — flip, call wall, put wall, net GEX for SPX, SPY,
QQQ, NDX, ES or NQ — and it re-reads the chain every 15 minutes, so a
page you paste it into once stays current on its own. Free, no account,
no API key, and it sets no cookies on your readers.

Offering it because you're already writing these numbers out by hand.
Use it, don't use it, reword the credit line to whatever fits your
voice — all fine. Happy to answer methodology questions either way.
```

**Do not** say "in exchange for a link." The credit line is in the snippet and
they can see it; naming it as the price turns a tool into a transaction and is
the version Google objects to.

---

## 3. Educational pages that explain GEX (the resource-citation angle)

Different pitch. These people are not publishing daily — they have one
evergreen "what is gamma exposure" page and no live data on it. The widget is
the thing their page is missing.

Targets: the glossary and resources list in
[backlink-kit.md §2d](seo/backlink-kit.md), plus anything found with
`"gamma exposure" "what is"` that is not a competitor.

```
Hi [Name] — your explainer on gamma exposure at [url] is one of the
clearer ones out there; I've linked it from our own reading list.

One thing it can't do is show a reader what the levels are *right now*.
I built a free embeddable block for exactly that: zerogex.io/embed —
one line of HTML, shows today's SPX flip and walls, refreshes every 15
minutes on its own.

No account, no key, no cookies, and nothing to maintain. If it belongs
under your definition section, it's yours. If not, the levels are free
on the site regardless: zerogex.io/spx-gamma-levels

(We also publish an even-handed comparison of the category, competitors
included, at zerogex.io/education/best-gex-tools — reuse anything
useful from it.)
```

---

## 4. Listicle authors who already cover the category

The §2b independents in the backlink kit. They have written about GEX tools
before, which makes a new free thing a legitimate reason to re-open the thread
— not a second ask for the same favor.

```
Hi [Name] — following up on [article] rather than asking you to change
it. We shipped something since you wrote it that's relevant to the
"free options" angle: an embeddable gamma-levels block,
zerogex.io/embed — free, no signup, no key, and it updates itself.

Flagging it in case you refresh the piece, and because it's genuinely
useful on its own whether or not we're in it. Full access to evaluate
is available any time — just say the word.
```

Send once. No follow-up.

---

## 5. Substack, Discord and newsletters — pitch the image, not the embed

These are the people most likely to be hand-typing levels into a post every
morning, and the embed is useless to them. The PNG card is the offer.

**Get the framing right or this backfires.** The image is a *snapshot*: correct
when the platform fetched it, frozen afterwards, because Substack re-hosts it,
Gmail proxies it and Discord serves its own copy. For a daily note that is
usually what you want — the levels as of publication, dated on the card. For a
page someone expects to stay live, it is wrong, and promising otherwise gets
noticed the next morning when the numbers have not moved.

**Say "snapshot" in the DM.** Every time.

### 5a. Substack / Medium writers

```
Hey [Name] — [your Thursday note pinned the 6,700 call wall two days
before it actually capped the move].

I build ZeroGEX. Substack won't render a custom embed, so I'm not going
to send you one — but we do publish the levels as an image you can drop
straight into a post:

  https://zerogex.io/embed/image/SPX.png

SPX, SPY, QQQ, NDX, ES or NQ; swap the ticker in the URL, add
?theme=light for a white background. Free, no account.

Worth being precise about what it is: Substack copies the image onto
its own servers when you publish, so it's a snapshot of that morning's
levels rather than something that keeps updating. The card prints its
own "as of" timestamp so it never reads as more current than it is.
For a daily note that's usually exactly right.

Saves you typing four numbers in by hand, and that's the whole pitch.
```

### 5b. Discord communities with a levels or premarket channel

No SEO value here at all — these links are nofollow at best and usually
unfurled previews. It is pure distribution, and the audience is exact.

Pitch the **owner or a mod**, never drop it in a channel yourself.

```
Hey — mod question rather than a promo. I build ZeroGEX; we publish
free 15-min-delayed gamma levels for SPX/SPY/QQQ/NDX.

There's a plain image of the day's card here:

  https://zerogex.io/embed/image/SPX.png

If a premarket or levels channel would find that useful, it posts
cleanly and it's dated on the image, so nobody can mistake an old
paste for a live read. Happy for someone to post it manually, or I can
give you the URL list for all six tickers if you want to automate it.

Not asking for a partnership or a pin — if it's not useful, no
problem. And tell me if you'd rather I hadn't DM'd; I won't follow up.
```

If they say yes to automating: the URLs are stable and cacheable, so a webhook
posting one image a morning is a five-line script on their side. Offer it; do
not build it for them unsolicited.

### 5c. Email newsletters

```
Hi [Name] — quick one. If you're putting SPX levels in [newsletter] by
hand, this is an <img> tag you can drop into the template:

  https://zerogex.io/embed/image/SPX.png

Free, no account, and it renders in every mail client because it's a
plain image. One caveat worth knowing up front: mail clients (Gmail
especially) proxy and cache images, so each send captures the levels as
they were when it went out. That's fine for a morning letter — the card
timestamps itself — but it won't refresh inside an already-delivered
email.
```

---

## 6. What to track, and what "working" looks like

Every snippet carries `utm_source=embed&utm_medium=widget`, plus
`utm_content=<host>` when the embedder filled in the "your site" field. Two
numbers matter and they measure different things:

| Number | Where | What it tells you |
|---|---|---|
| `embed_snippet_copied` | PostHog | Intent. Someone took a snippet. `format` splits iframe vs image. |
| Sessions with `utm_source=embed` | PostHog / GA | Reality. Someone published it and a reader clicked. |

**The gap between them is the whole story.** A high copy count with no referral
sessions means people are taking the snippet and not shipping it — a
product-friction problem (their platform blocked it, the layout broke), not an
outreach problem, and more DMs will not fix it. Check that gap before scaling
the sends.

Referring domains in Search Console is the slower, truer measure; give it 6-8
weeks before reading anything into it.

**Watch the `format` split too.** The image exists because a large segment
cannot use the embed; if it turns out most people take the PNG even when they
could have pasted HTML, that is the audience telling you the iframe is more
friction than it looks, and the answer is to make the image the default rather
than to send more DMs.

---

## 7. Guardrails

- **Never** pay for a placement, or offer Pro access *in exchange for* an
  embed. Free access offered unconditionally is fine; conditioned on a link it
  becomes a paid link, which is a Google link-scheme violation and a
  disclosure problem for them.
- **Never** ask for specific anchor text, or send a "please use this exact
  HTML" follow-up if they reworded the credit. That is the difference between
  an attribution line and a link scheme.
- **Never** send the same person a widget pitch and a creator-partner pitch in
  the same week.
- **Never** send to a platform that cannot render it (§0).
- One follow-up maximum, and only for §2. Silence is an answer.
- Disclose that you built it, every time, in every channel.

---

## 8. Sending order

1. **Existing partners** (§1) — warmest, smallest ask, and their placements
   tell you whether the thing survives contact with a real page.
2. **Fix whatever breaks** before widening. The first three embeds are a
   product test, not a campaign.
3. **Newsletter/blog writers** (§2) — the volume segment.
4. **GEX explainer pages** (§3) — slower, but the most on-topic links.
5. **Listicle authors** (§4) — one send each, batched.
6. **Substack / Discord / newsletters** (§5) — the image segment. Largest by
   headcount and the only one where a wrong framing ("it updates itself") gets
   caught the next morning. Send it last, once you have said "snapshot" enough
   times for it to be automatic.
