# Free trial without a card: operator runbook

*What it does, how to try it before your members do, how to turn it on and off, and what to watch.*

## 1. What it does

With `BILLING_NO_CARD_TRIAL=1`, the 7-day Basic trial starts **without a card**. Checkout shows no card form.

- **Nothing is charged** during the trial.
- **To keep the plan**, the member adds a card before the trial ends: an **Add a card** button on the Account page, the dashboard banner and the trial-end email all open the billing portal's add-a-card screen. The trial then converts at its end like any other.
- **Without a card**, Stripe cancels the subscription when the trial ends. The member is back on the free plan with their settings kept, exactly as if they had canceled a trial.

Off (the default), nothing changes anywhere.

The code is in `frontend/core/noCardTrial.ts`. Stripe does the two hard parts: Checkout runs with `payment_method_collection: 'if_required'` (a trial is $0 today, so no card form), and the subscription carries `trial_settings.end_behavior.missing_payment_method: 'cancel'`. A card added during the trial arrives through the webhook's existing `setup_intent.succeeded` handler, which makes it the subscription's and the customer's default payment method, so the trial converts.

## 2. Who gets it

Only a **first-time 7-day Basic trial**. These keep the card-first trial, as today:

- **The 30-day reactivation trial** (`/pricing?reactivate=1`). Its email says "you add a card when you activate".
- **A second account on the same inbox.** If another account whose address folds to this one (`+tags` dropped, Gmail dots ignored, deleted accounts included) has already had a trial, checkout asks for a card. A card used to make farming free trials pointless; without one it would be free. Refusals are counted in the report below.
- **Returning members** never get a trial at all, as before.

## 3. What members see when it is on

| Where | With the flag on |
|---|---|
| Pricing page | "No card needed" in the hero, the Basic card and the terms list (all five languages). Not for `?reactivate=1` visitors. |
| Locked page after login | "7-day free trial on Basic monthly, no card needed". |
| Stripe Checkout | No card form. The line above the button says nothing is charged, a card added before the end keeps the plan and starts the renewal, and without one the trial ends. |
| Dashboard after checkout | "No card needed, so nothing is charged. To keep your plan…" |
| Welcome email | Says there is no card, nothing will be charged, and how to keep the plan. |
| Dashboard, every visit | A banner with the trial end date and an **Add a card** button, until a card is added. |
| Account page | An **Add a card** panel. Coming back from the portal shows "Card added". |
| Trial-end email (48h before) | "Your ZeroGEX trial ends in 2 days - add a card to keep it", with the price and one button. No Pro offer. |
| Switching plans during the trial | Asked to add a card first. Nothing changes until they do. |
| ~2h signup note and verify reminder | Describe the trial as needing no card. |

The Terms (section 4), the help article on billing (all five languages) and two comparison articles were reworded so they are true with the flag on **or** off. Please read the Terms sentence: it is the one legal text this touched. The Terms version and effective date were left alone (bumping the version makes every member re-accept).

## 4. Before turning it on: check the portal

The **Add a card** button needs the billing portal to allow payment method updates. `make setup-billing-portal YES=1` turns that on; if you have run it before, it is already on. To check without changing anything:

```
make setup-billing-portal
```

The dry run prints the configuration it would apply. Payment method updates should be enabled.

## 5. Turning it on

Merging this branch changes the app, so it needs one rebuild (`make rebuild`) like any other app change. With the flag unset, the rebuilt app behaves exactly as before.

When you are ready, add the flag and restart:

```
printf '\nBILLING_NO_CARD_TRIAL=1\n' >> ~/zerogex-web/frontend/.env.local
```

```
make -C ~/zerogex-web restart
```

Then walk through it once yourself with a throwaway account. A no-card trial costs nothing, so this is safe in production:

1. Register with an address on a **different inbox** from any account you have used for a trial before (a Gmail `+tag` of an old one counts as the same inbox).
2. Verify the email, open `/pricing`, and start the Basic trial. Checkout should show **no card form**, and the line above the button should say no card is needed.
3. On the dashboard, the welcome banner should say no card is needed. Reload: the **Add a card** banner should appear.
4. On the Account page, **Add a card** should open Stripe's add-a-card screen. Close it without adding one, unless you want this test account to be charged in 7 days.
5. See the trial-end email this account would get:

   ```
   make trial-reminders RENDER=<that address>
   ```

   The text should start "your ZeroGEX free trial ends on … There's no card on your account".
6. Cancel the test trial from the Account page, or let it end: Stripe cancels it by itself.

## 6. Turning it off

Remove the line from `frontend/.env.local` (or set it to `0`) and run `make restart`. New trials ask for a card again. Trials that already started without a card carry on as no-card trials: their subscription carries the setting, and every page and email reads it from the subscription, not from the flag.

## 7. What to watch

```
make no-card-trials
```

Read-only. It shows, since the first no-card checkout, for no-card and card-first trials side by side: checkouts opened, trials started, still in trial (and whether a card was added), paid, and ended without paying. Also how many were refused a no-card trial because the inbox had already had one.

With the flag on, every first-time trial is a no-card one, so after the switch the card-first column holds only inboxes that had already had a trial. The fair comparison is with the card-first trials from **before** the switch. Start the report a month before the first no-card checkout; the default run prints this command with the right date. On this deploy the first no-card checkout was 2026-11-07, so:

```
make no-card-trials SINCE=2026-10-08
```

**Expect** many more trials to start and a smaller share of them to pay. The number that decides whether to keep it is **"Paid … of checkouts"**: paying members per checkout opened. Give it until most trials in the window have ended (two to three weeks) before comparing.

The admin Growth page's trial-to-paid rate mixes both kinds of trial, so it will drop when this is on. That is expected; the report splits them.

## 8. Edge cases

- **A member adds a card and it is declined at the end of the trial.** The ordinary trial-conversion dunning runs, exactly as for a card-first trial.
- **A trial ends without a card.** Stripe deletes the subscription; the webhook returns the member to the free plan. There is no cancellation alert to you (no reason was captured, so the alert treats it as silent churn), and the usual win-back reaches them about a month later, as it does for a canceled trial today.
- **Trial-start analytics** carry `no_card: true|false` on the PostHog `TrialStarted` event, and every checkout's audit line carries `card=0` or `card=1`.
