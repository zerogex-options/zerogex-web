# X / Twitter — Folds of Honor Placement Playbook

The one-pass playbook for rolling out the Folds of Honor Proud Supporter
partnership across the @ZeroGEXOptions profile and feed. Do it in one 30-min
sitting or spread across a few sessions — the phases are independent.

**All content already exists in the repo:**

- Announcement tweet (A2 draft) → `docs/launch-tweets-folds-of-honor.md`
- Recurring receipt tweet → printed automatically at the end of
  `make quarterly-receipt`
- Commemorative-day drafts → `docs/launch-tweets-folds-of-honor.md`, Section D
- Proud Supporter badge PNG → https://zerogex.io/folds-of-honor-proud-supporter.png

---

## Phase 1 — Profile setup (~15 minutes, one-time)

### 1a. Bio line

**Where:** x.com → your avatar → Profile → **Edit profile** → Bio field.

**Do:** Append this on a new line at the end of your existing bio:

```
🇺🇸 Folds of Honor Proud Supporter
```

Or plain (no flag): `Folds of Honor Proud Supporter`

**Character count:** 32 (with flag) / 30 (plain). Bio limit is 160.

Save.

---

### 1b. Website link

**Where:** Same Edit profile screen → **Website** field.

**Two options, pick one:**

- **Default (recommended long-term):** keep at `zerogex.io`. Your product
  is the strongest CTA.
- **Launch window (7–14 days after announcement):** switch to
  `zerogex.io/giving` so every profile visit during the announcement
  period lands on the giving page. **Revert to `zerogex.io` after.**

---

### 1c. Profile header banner (biggest single-post impact)

**Where:** Edit profile → **Header photo**.

**Spec:** 1500 × 500 px PNG or JPG.

**Design brief:**

- Left/center 80%: your existing ZeroGEX header (logo mark, tagline,
  gradient — whatever you run today).
- Lower-right corner: the Folds of Honor Proud Supporter round badge,
  ~180px diameter, sitting on a subtle white circle so the badge's own
  white background blends in.
- Padding: ≥40px from the right and bottom edges (X crops slightly on
  some devices).
- **Do not** stretch, recolor, or overlay text on the badge itself.

**Fastest way to make it (~20 min in Canva):**

1. canva.com → search "Twitter Header" → pick a dark trading-themed
   template that matches ZeroGEX.
2. Set canvas to 1500 × 500.
3. Download the badge from https://zerogex.io/folds-of-honor-proud-supporter.png
   and drop it into the lower-right corner.
4. Add a white circle behind it (Elements → Shape → Circle → white fill,
   slightly larger than the badge).
5. Export as PNG.
6. Upload via **Edit profile → Header photo**.

---

## Phase 2 — Announcement post + pin (~10 minutes, one-time)

### 2a. Post the announcement tweet

**Draft:** the A2 variant in `docs/launch-tweets-folds-of-honor.md`.
Reproduced here for convenience:

```
ZeroGEX is now donating 3% of every subscription to @FoldsOfHonor.

A monthly Pro subscriber funds $1.49/mo in scholarships for the families of
fallen and disabled U.S. service members. Annual Pro funds ~$17.97 up front.

Across the subscriber base, that adds up fast.
```

**Steps:**

1. Compose a new post on X.
2. Paste the A2 text.
3. **Attach the badge PNG.** Download from
   https://zerogex.io/folds-of-honor-proud-supporter.png (or upload from
   `assets/branding/folds-of-honor-proud-supporter.png` if you already
   have it locally).
4. Post.

---

### 2b. Post the reply with the link

Immediately after the announcement lands, reply to it (to yourself)
with:

```
Mechanics:

• 3% of every subscription, gross of fees
• Calculated per Stripe invoice
• Donated to @FoldsOfHonor each calendar quarter
• Running total published on /giving
• Your subscription price doesn't change

Full FAQ: https://zerogex.io/giving
```

**Why in the reply, not the main post:** X down-ranks posts with outbound
links in the primary tweet. Link in the first reply preserves the reach of
the announcement itself.

---

### 2c. Pin the announcement

On the announcement post (not the reply), click **⋯** → **Pin to your
profile**. Locks it at the top of your profile indefinitely — until you
unpin, or post something more important later and pin that instead.

---

## Phase 3 — Recurring receipt tweets (~2 minutes per quarter, 4× a year)

The quarterly-receipt tweet fires four times a year, immediately after
you run `make quarterly-receipt` (the interactive script that publishes
the donation to the site).

At the end of that script it prints the exact tweet text — you don't
draft anything.

**Habit:**

1. Run `make quarterly-receipt` (see `docs/quarterly-receipt-workflow.md`).
2. Copy the printed tweet.
3. Open X → new post → paste.
4. **Attach the badge PNG.**
5. Post.

**Consistency touches:**

- Always attach the badge. Never post the receipt without it — the
  badge IS the visual brand for this content.
- Post in the morning ET (9–10am) for best US-trader engagement.
- Optional: attach the FOH receipt PDF as a second image — screenshot
  the top portion so amount and date are visible but no sensitive
  routing info leaks.

---

## Phase 4 — Commemorative days (~2 minutes each, 4× a year)

Add these four dates to your calendar as recurring reminders (all-day,
"Post FOH commemorative tweet"):

| Date                | Draft location                            |
|---------------------|-------------------------------------------|
| Memorial Day        | `docs/launch-tweets-folds-of-honor.md` §D |
| July 4              | Same file §D                              |
| Veterans Day (Nov 11)| Same file §D                             |
| Pearl Harbor Day (Dec 7) | Same file §D                         |

**Timing rule of thumb:**

- **Memorial Day** (last Monday of May) — post around **8 am ET**
- **July 4** — evening of July 3 (fireworks eve) *or* morning of July 4
- **Veterans Day** — 9 am ET on Nov 11
- **Pearl Harbor Day** — 9 am ET on Dec 7

**Steps each time:** open X → copy draft from the docs file → paste →
**attach the badge** → post. Two minutes.

**Optional flourish (Veterans Day only):** the drafted Veterans Day
tweet mentions doubling the pledge to 6% for that day. If you actually
do that, note it in `frontend/content/giving/totals.json` history when
you next run the receipt script. If you'd rather not commit publicly,
delete the "Today's donation rate is doubled to 6%" line before posting.

---

## Total ongoing time cost

| Phase | Frequency | Time |
|---|---|---|
| Profile setup (Phase 1) | Once | ~15 min |
| Announcement + pin (Phase 2) | Once | ~10 min |
| Receipt tweet (Phase 3) | 4× / year | ~2 min each |
| Commemorative days (Phase 4) | 4× / year | ~2 min each |

**One-time investment:** ~25 minutes. **Steady state:** ~16 minutes / year.

---

## Troubleshooting / FAQ

**"I lost the badge image."** Download from
https://zerogex.io/folds-of-honor-proud-supporter.png. It ships in every
deploy via `make logo`.

**"The A2 tweet doesn't fit in 280 chars."** It's currently 256 chars.
If X ever tightens the limit, use variant A1 (267 chars) or A3 (252
chars) from `docs/launch-tweets-folds-of-honor.md`.

**"I don't have a FOH-branded PDF receipt to attach."** Just post
without one. Text-only receipts are fine — the tweet already carries
the numbers.

**"I don't know when the next commemorative day is."** Google. All four
are federal / civil dates that are trivially lookupable.

**"I forgot to attach the badge to one of the posts."** X doesn't allow
editing media on a posted tweet. Options: leave it, delete-and-repost,
or reply to the post with the badge as a follow-up. Delete-and-repost
loses any early engagement — usually not worth it unless the badge
absence is glaring (e.g. an announcement post).
