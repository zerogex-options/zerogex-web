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
| **Substack** | **No** | No custom iframes or scripts in posts |
| **Medium** | **No** | Same |
| **Discord / Slack** | **No** | Chat apps. Not a web page. |
| **Email newsletters** | **No** | No mail client executes an iframe |

**Check the prospect's platform before drafting.** Sending "paste this iframe"
to a Substack writer wastes the contact and makes you look like you did not
look at their site. View-source on any post tells you in ten seconds.

For the "No" rows, the offer is different — see §5.

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

## 5. Where the iframe cannot go (Substack, Discord, newsletters)

**Do not send any of the above to these people.** The embed will not render and
you will have asked them to do something impossible.

This segment is currently parked. What would unlock it is a PNG variant of the
card — an image URL that updates daily, which pastes into a Substack post, a
Discord channel or a newsletter the way an iframe cannot. That does not exist
yet.

Until it does, the offer for this segment is the daily share block that already
ships on every levels page (`ShareBlock`, the copy/X/Reddit/StockTwits row):

```
Hey [Name] — Substack won't render a custom embed, so I won't send you
one. But if you're typing SPX levels into your Monday note by hand:
zerogex.io/spx-gamma-levels has a one-click copy of the whole day's
snapshot as plain text, free and no account. Paste-ready.

That's it — no ask attached.
```

---

## 6. What to track, and what "working" looks like

Every snippet carries `utm_source=embed&utm_medium=widget`, plus
`utm_content=<host>` when the embedder filled in the "your site" field. Two
numbers matter and they measure different things:

| Number | Where | What it tells you |
|---|---|---|
| `embed_snippet_copied` | PostHog | Intent. Someone built a snippet. |
| Sessions with `utm_source=embed` | PostHog / GA | Reality. Someone published it and a reader clicked. |

**The gap between them is the whole story.** A high copy count with no referral
sessions means people are taking the snippet and not shipping it — a
product-friction problem (their platform blocked it, the layout broke), not an
outreach problem, and more DMs will not fix it. Check that gap before scaling
the sends.

Referring domains in Search Console is the slower, truer measure; give it 6-8
weeks before reading anything into it.

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
6. **The parked segment** (§5) — only once a PNG variant exists.
