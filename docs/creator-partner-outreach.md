# Creator Partner Outreach — DM Templates & Playbook

Internal reference for onboarding creators into the ZeroGEX Creator Partner
Program. Not shipped to the site. Update the templates below as tone,
offer, or platform features change.

---

## The flow at a glance

```
1. Cold DM       → 2. (Maybe) Follow-up 4-5 days later
                   ↓
3. They reply "sure"
                   ↓
4. Ask them to register
                   ↓
5. They register + verify email
                   ↓
6. Operator verifies row + runs make grant-partner-pro
                   ↓
7. Activation DM (Pro is live)
                   ↓
8. ~30-day check-in
                   ↓
9. Pitch affiliate ONLY on positive signal (not on a calendar)
                   ↓
10. Grant expires day 90 unless they subscribe / affiliate
```

Templates for each stage below.

---

## 1. Cold outreach DM

Personalize the opener with something specific from the target's recent
feed (a level they called, a post that landed). If you can't find
something specific in a couple of minutes, use the generic opener but
never send with an unfilled `[NAME]` or template artifact.

```
Hey — [saw your <specific SPX/SPY level> call from <day>, held clean] /
[your SPY/SPX levels feed has been the cleanest actionable-levels
source I've come across].

I built ZeroGEX as a live options positioning map for SPY/SPX/QQQ:
gamma exposure, call/put walls, dealer positioning, and options flow
that updates throughout the session. The goal is to help traders see
where the market may pin, reject, squeeze, or break before price gets
there.

I'd love to offer you free Pro access for 90 days. No posting
requirement and no strings attached. Just genuinely test it during
live sessions and tell me what feels useful, confusing, or missing.

If you're interested, register at https://zerogex.io/register with the
email you'd like to use, click the verification link, and reply here —
I'll flip on Pro as soon as I see the account.
```

**Do NOT** front-load the affiliate deal (30% commission, audience
discount). Save that for after they've tested the tool and expressed
positive signal.

**Do NOT** open with "Hey [YourOwnName]" — the earlier template had this
bug. Either use the target's name or omit the greeting.

---

## 2. Follow-up (send once, 4-5 days later, only if no reply)

```
Hey — just following up in case this got buried.

The offer is genuinely just free ZeroGEX Pro access for 90 days so
you can test the levels during live sessions. Zero obligation to
promote it or say anything positive.

If it becomes useful to your workflow, we can talk about a link/code
afterward. Happy to activate for you.
```

If no reply after this second message, move to the next prospect.

---

## 3. Reply after they say "sure" but haven't registered yet

Only needed if you used an older version of the cold DM that said
"reply with your email" instead of "register first." The current
template asks them to register directly, so this reply is usually
unnecessary.

```
Awesome, thanks. My earlier message was slightly unclear — quick step
on your end: register at https://zerogex.io/register with the email
you want to use, then click the verification link in your inbox.

Reply here with the email once you're through and I'll flip on Pro
right after.
```

---

## 4. Verify + activate (operator side)

Once they DM back with the email they registered under:

```bash
# 1. Verify the account exists AND is verified
sudo sqlite3 /var/lib/zerogex/auth.db \
  "SELECT id, email, tier, email_verified_at, created_at
   FROM users WHERE email='<their-email>';"
# Expect: row exists, email_verified_at populated (not NULL)

# 2. Run the grant. PROMO_CODE should be brand-relevant to them:
#    e.g. @SPY_Levels → SPYLEVELS25, @PCB → PCB25
cd ~/zerogex-web
make grant-partner-pro \
  EMAIL=<their-email> \
  PROMO_CODE=<CODE> \
  YES=1

# 3. Copy the script output — you'll need the expiry date + link for
#    the activation DM.

# 4. Optional: confirm everything landed
make diagnose-user EMAIL=<their-email>
```

---

## 5. Activation DM (deferred-affiliate version — recommended default)

Deliberately does NOT mention the affiliate deal on activation. Wait for
positive signal before introducing revenue-share. See stage 9.

```
[Name] — activated. 90 days of Pro is live, expires [YYYY-MM-DD].

Use it however you normally trade and let me know whenever what
actually adds signal versus feels like noise. No posting expectation,
no timeline — I'd rather get one honest paragraph in month two than
daily "this is great" updates.

For a fast orientation, /help/platform/getting-started walks the
15-minute path from dashboard to first signal read. If you'd prefer
a Loom walkthrough instead, I can record one — just say the word.

Reply here anytime — observations, questions, or "this is useless
because X." Any of it helps.
```

---

## 5b. Activation DM (upfront-affiliate version — use only when the target already knows about the program)

If the target explicitly asked about the affiliate deal in an earlier
exchange, include the details on activation:

```
[Name] — activated. 90 days of Pro is live, expires [YYYY-MM-DD].

Use it however you normally trade and let me know whenever what
actually adds signal versus feels like noise. No posting requirement.

For a fast orientation, /help/platform/getting-started walks the
15-minute path from dashboard to first signal read.

Affiliate setup exists whenever you'd like to use it — fully optional,
completely separate from the 90 days:

  Your link:  https://zerogex.io/register?ref=[8CHAR]
  Your code:  [PROMOCODE]

Audience gets 25% off their first 3 months monthly. You earn 30%
recurring commission for the first 12 months of each conversion. FTC
disclosure required if you mention it — "affiliate link" or "#ad"
is enough.

Reply here anytime.
```

---

## 6. ~30-day check-in

Send around day 30. Absolutely no affiliate mention. Just an open
question — their answer tells you where they are.

```
Hey — checking in. How's the platform landing so far? Anything that's
actually clicked with your process, or anything that feels off?

No agenda here — just genuinely want to know before your grant clock
gets deeper in.
```

---

## 7. Affiliate pitch DM (only after a positive signal — see below for what counts)

**Positive signals that unlock this pitch:**

- Explicit: "this is actually useful" / "I've been using it" / "the
  gamma flip helped me avoid X"
- Implicit: they ask a substantive feature question (indicates
  engagement, not evaluation)
- Comparative: "cleaner than [competitor]"
- Organic mention in their content

**Non-signals — do NOT pitch:**

- "Haven't had time to dig in yet"
- Terse acknowledgment ("thanks, will try it")
- Silence after the 30-day check-in
- Any negative or neutral feedback (address the feedback, don't pitch)

Once you have a green light:

```
Glad it's landing for you. Since you mentioned it's been useful,
wanted to lay out the option that exists for creators who share
it — fully optional and I don't need a decision either way.

The setup:
  - Your audience gets 25% off their first 3 months on any monthly plan
  - You earn 30% recurring commission on each conversion's first 12
    months
  - Runs off a link or a code — you already have both:
      link: https://zerogex.io/register?ref=[8CHAR]
      code: [PROMOCODE]
  - FTC disclosure required whenever you mention it — "affiliate
    link" or "#ad" is enough

Not asking you to commit to anything, or to post about it if it
doesn't fit your feed. If it's not the right fit or the timing is
off, just say so — the 90-day access stays live regardless.
```

Send once. Do NOT follow up if they don't respond — silence is their
answer.

---

## 8. Grant expiry approaching (day 75-80)

If nothing positive has happened by day 75 and you haven't pitched the
affiliate, this is the last natural moment:

```
Heads up — your Pro grant expires [DATE] (about two weeks). No
pressure either direction, but wanted to give you the options:

  1. Let it expire — no action needed, account drops to public tier.
  2. Subscribe normally at https://zerogex.io/pricing.
  3. Affiliate route: share the tool with your audience via a
     unique code/link (25% off for them, 30% recurring commission
     for you). Details on request if you'd want them.

If you want more time to evaluate, I can extend the grant — just say
so. Whatever fits.
```

---

## 9. Off-boarding a creator (if they ask to leave, or if the grant expires and they don't subscribe)

Automatic: on day 90 the systemd timer `zerogex-web-partner-grant-expiry`
downgrades their tier from `pro` to `public`. `partner_tier='creator'`
stays set so any commissions already accrued keep flowing until the
12-month window expires.

If you want to fully wind down a partner (deactivate their Stripe promo
code, clear partner state, stop new commissions):

```bash
make revoke-partner EMAIL=<their-email> YES=1
```

Historical accrued commissions in `partner_commissions` remain payable
per the original deal — the revoke doesn't clawback anything they've
already earned.

---

## Operator commands cheat sheet

| Command | When |
|---|---|
| `make grant-partner-pro EMAIL=... PROMO_CODE=... YES=1` | Activation after they register |
| `make diagnose-user EMAIL=...` | See tier, subscription state, recent audit events |
| `make partner-commissions` | Month-end payout review — per-partner totals |
| `make partner-commissions EMAIL=... FULL=1` | Full row-by-row ledger for one partner |
| `make revoke-partner EMAIL=... YES=1` | Wind down a partner cleanly |
| `make referrals` | See the full referral ledger (partner + standard) |
| `sudo sqlite3 /var/lib/zerogex/auth.db "SELECT ... WHERE email='...';"` | Ad-hoc DB inspection |

---

## Signal-watching before pitching affiliate

Beyond DM signals, quiet indicators worth watching:

```bash
make diagnose-user EMAIL=<partner-email>
```

Look at recent audit events for `login_success` entries. A partner
logging in 10+ times in the first month is engaged. A partner with
zero logins after week 2 isn't going to convert — pitching the
affiliate to them is throwing effort away.

---

## Known onboarding gotchas

- **They never register.** Send the nudge template from stage 3. Don't
  create their account manually — see the "if PCB won't/can't
  register" section in earlier decisions for why.
- **They register but don't verify email.** DM: "hey, I see the signup —
  one more click on the verification link in your inbox and I'll flip
  on Pro."
- **They give you a different email than what they registered.** Have
  them either resend from the correct email or register a fresh account
  with the address they want to use long-term.
- **The `verified_never_paid` marketing email fires between their
  registration and your grant.** Cosmetic — they get a "here's a trial"
  nudge even though you're about to grant them Pro. Not fixable per-user;
  filed for future work if this program scales past a handful of
  creators.
