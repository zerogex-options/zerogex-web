# Christie and Hartshorn: two "Other" cancels, nothing typed (2026-11-17)

American English, and each paragraph in the drafts is a single line with no
hard wrapping, so it can be pasted straight into a mail client.

**Inbound.** No email from either, only the two cancellation alerts. Two paying
members canceled in the app on Tuesday morning, 45 minutes apart. Both picked
"Other" in the survey and typed nothing. Both clicked past 25% off for a year
and a pause in the cancel modal, and the automatic cancel email offered the 25%
again and asked what "Other" meant.

> **Status:** drafts, not sent. **Send Christie's today**: access ends Thu Nov
> 19, 3:42 PM ET, and a yes has to be applied before then. Hartshorn has until
> Tue Nov 24, 11:41 AM ET, so today or tomorrow is fine.

Everything below is from `make diagnose-user`, `make save-url` and
`make honor-winback-discount ... DRY_RUN=1` on each address (run Nov 17).

| | **michaelchristie300@gmail.com** | **bhartshorn042@gmail.com** |
|---|---|---|
| User id | `user_7e25f2cc908bb1be6c44bdf7` | `user_aa3debea5a5e04c4e45431f8` |
| Came from | chatgpt.com | chatgpt.com |
| Plan | **Basic monthly**, $39, no discount | **Pro monthly**, $59, no discount |
| History | 7-day Basic trial from Mon Oct 12, converted Mon Oct 19 | Basic trial from Wed Oct 21. Switched to Pro on Sat Oct 24, which ended the trial and charged $59 that day |
| Paid so far | $39, once (Oct 19) | $59, once (Oct 24) |
| Canceled | Tue Nov 17, 8:36 AM ET | Tue Nov 17, 9:21 AM ET |
| Access ends | **Thu Nov 19, 3:42 PM ET** | **Tue Nov 24, 11:41 AM ET** |
| Last seen | 8:32 AM ET today, the visit where they canceled | 11:12 AM ET today, almost two hours *after* canceling |
| Paying with | Link | Link |
| Stripe | `cus_VQhQhSAsy4Kjdo`, `sub_1UPq2m4AOiqteMYYbvgfTgDP` | `cus_VTwWNQbZqicQiB`, `sub_1USydr4AOiqteMYY6qs0u96C` |

## The read

- **Neither has seen the 50% offer.** The cancel modal only asks "Would half
  price help?" (50% off for 12 months) when someone picks "Too expensive".
  "Other" skips it. So both have only been shown 25% off, twice.
- **Both drafts offer that 50%, if price played any part.** That's $19.50 a
  month for Christie and $29.50 for Hartshorn, for 12 months, then the regular
  price. It's the standing win-back coupon (`B6vo4Qlk`): the same 50% the modal
  gives "Too expensive", and the same offer `make winback` would send them about
  a month after their access ends. So this brings it forward; it isn't a new
  deal. Your dry runs already show it applies cleanly. If you'd rather not offer
  it, delete the paragraph that starts "If price was part of it" and the rest
  still works.
- **Neither draft asks "what was it?" again.** The automatic email already did,
  in those words. Christie's asks what would have made it worth keeping.
  Hartshorn's asks what changed.
- **Christie: one email, today.** One paid month, and a deliberate cancel two
  days before the second charge. Light visible use (a sign-in on Nov 3, then
  today's visit), but page views don't write audit rows, so there may have been
  more. With two days left there's no time for a second round, which is why the
  offer goes in the first email.
- **Hartshorn: the likelier save.** They moved up to Pro three days into their
  trial, paying $59 that day rather than waiting out the free days, and they
  were back on the site almost two hours after canceling. Not for the email: on
  Oct 24 their payment was declined twice for insufficient funds before it went
  through a minute later, so money may be tight. The draft gives them an easy
  way to say so ("or something on your side").
- **No refund is owed to Hartshorn.** Their Pro charge came with the 7-day
  money-back guarantee, which ran out Sat Oct 31. If they ask anyway, it's your
  call.

## Verify first

- **Check your inbox.** If either has already replied to the automatic cancel
  email, answer that reply instead of sending these.
- **Re-run `make diagnose-user` right before sending.** If `Cancel at period
  end` reads `no`, they claimed the 25% link or kept their plan on their own.
  Send nothing, or a short thank-you.
- **Names.** "Michael" is read off Christie's address. Check the Stripe customer
  (`cus_VQhQhSAsy4Kjdo`) for a name, and if it's unclear, open with "Hi,".
  Hartshorn's address gives no first name, so that draft opens with "Hi,". If
  their Stripe customer (`cus_VTwWNQbZqicQiB`) has one, use it.

## Draft: Christie

Send both as new emails from your own inbox, not as replies to the automatic
one. Your Gmail signature goes under the sign-off.

**Subject:** What would have made you stay?

Hi Michael,

I saw you canceled your ZeroGEX plan, and I wanted to write to you myself.

One question: what would ZeroGEX have needed to do to be worth keeping? A few words is plenty.

If price was part of it, I can do 50% off: $19.50 a month for the next 12 months, then the regular $39. Same account, nothing to set up again. Just reply before your access ends on Thursday afternoon and I'll set it up.

Best,

## Draft: Hartshorn

**Subject:** A question about Pro

Hi,

I saw you canceled your ZeroGEX Pro plan, and I wanted to write to you myself.

You moved up to Pro three days into your trial, so I'd really like to know what changed. Was it something about ZeroGEX, or something on your side? A few words is plenty.

If price was part of it, I can do 50% off Pro: $29.50 a month for the next 12 months, then the regular $59. Same account, nothing to set up again. Just reply before your access ends on Tuesday, November 24, and I'll set it up.

Best,

## If they say yes before their access ends

Christie by **Thu Nov 19, 3:42 PM ET**, Hartshorn by **Tue Nov 24, 11:41 AM
ET**. In `~/zerogex-web` on the server. Shown for Christie; for Hartshorn, swap
in `bhartshorn042@gmail.com`.

1. **Preview, no writes:**

   ```bash
   make honor-winback-discount EMAIL=michaelchristie300@gmail.com PERCENT=50 DRY_RUN=1
   ```

   The same dry run you already ran, plus `PERCENT=50`, which makes it refuse
   anything but 50% off for 12 months. Check `Coupon to apply: B6vo4Qlk (50%
   off, 12 mo)` and `cancel_at_period_end: true → false`. If they claimed the
   25% link in the meantime, `Current discounts` shows it, and the 50% replaces
   it. The two don't stack.

2. **Apply:**

   ```bash
   make honor-winback-discount EMAIL=michaelchristie300@gmail.com PERCENT=50 YES=1
   ```

   The last line should read `Next charge (after all discounts): 19.50 USD.`
   (`29.50 USD.` for Hartshorn). If it shows another amount, don't send the
   confirmation below.

3. **Confirm (optional):** `make diagnose-user` shows `Cancel at period end` as
   `no` in both sections, and `B6vo4Qlk` under `Discounts`.

Nothing emails them when the cancel is undone, so the confirmation is their
only notice.

**Confirmation: Christie** (in their thread)

Hi Michael,

Done. I've taken off the cancellation and put 50% off on your plan. Your renewal on Thursday will be $19.50 instead of $39, and it stays at $19.50 a month for the next 12 months. After that it goes back to the regular $39.

Nothing changes on your end: same account, same login.

Best,

**Confirmation: Hartshorn** (in their thread)

Hi,

Done. I've taken off the cancellation and put 50% off on your Pro plan. Your renewal on Tuesday, November 24, will be $29.50 instead of $59, and it stays at $29.50 a month for the next 12 months. After that it goes back to the regular $59.

Nothing changes on your end: same account, same login.

Best,

If they also told you why they canceled, add a line about it above "Best,".

## If they say yes after their access has ended

More likely for Christie, given the two days. `honor-winback-discount` refuses
once a subscription has ended, so bring them back the way you did Alexander on
Nov 3 (`2026-11-03-alexander-pro-25-off.md`): `reactivate-member` re-creates the
same plan on the Link account already on file, with three free days, then
`honor-winback-discount` adds the 50%. Three days rather than two, so the
automatic trial-end reminder goes out after the discount is on and quotes the
discounted price. The member also gets the automatic "Welcome back" email.

1. **Preview, then apply, the plan:**

   ```bash
   make reactivate-member EMAIL=michaelchristie300@gmail.com DAYS=3 DRY_RUN=1
   ```

   ```bash
   make reactivate-member EMAIL=michaelchristie300@gmail.com DAYS=3 YES=1
   ```

   It should end with `Webhook landed:` and `status=trialing`. Note the trial
   end date it prints.

2. **Preview, then apply, the discount:**

   ```bash
   make honor-winback-discount EMAIL=michaelchristie300@gmail.com PERCENT=50 DRY_RUN=1
   ```

   ```bash
   make honor-winback-discount EMAIL=michaelchristie300@gmail.com PERCENT=50 YES=1
   ```

   Same checks as above: `Next charge (after all discounts): 19.50 USD.`

Then reply: their plan is back on, free until the trial end date from step 1,
then $19.50 a month for 12 months, then $39. Nothing for them to do.

## If they reply some other way

- **Nothing to set up.** Thank them. If they point at a bug or a data problem,
  look into it before promising anything, and if it's fixed before their access
  ends, tell them.

## Worth knowing (can wait)

- **"Other" with nothing typed tells you nothing, and it keeps happening**
  (Pete on Oct 6, and both of these). The comment box under the reasons in the
  cancel modal always says "Anything else you'd like me to know? (optional)".
  When someone picks "Other", it could ask "What was it?" instead
  (`frontend/components/CancelRetentionModal.tsx`). Small, and it can wait.
