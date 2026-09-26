# Troubleshooting

*The short list - sign-in problems, missing data, stale charts, payment issues, browser caches, and when to email support.*

---

## Can't sign in

**You forgot your password.** Use [Forgot Password](/forgot-password). A reset link is emailed; click and set a new one. The link works once and expires after 30 minutes. If the email doesn't arrive, check spam.

**You signed up with Google or Apple and don't have a password.** Sign in with the provider you used. From the Account page you can then set a password for future fallback.

**You signed in, but your plan is missing.** You probably signed in with a different email than the one on your subscription - for example, another Google account - which creates a separate account. Sign out and sign back in with the original email, or email [support@zerogex.io](mailto:support@zerogex.io) - we can look up the account.

**A Google or Apple verification prompt won't go away.** That prompt comes from the provider - ZeroGEX has no two-factor step of its own. Sign in fresh from an incognito window. If it persists, email support.

## Missing or stale data

**The session badge says Closed.** That's the answer - markets are closed. The last computed values are shown.

**A panel is empty or reads zero.** Usually a session-window issue: EOD Pressure is only active from 2:30 PM ET to the close, and 0DTE Position Imbalance only during the regular session. Both pages say so on screen while they're inactive.

**Values look frozen.** Hover the price in the header to see when the last quote arrived, or check the "Last updated" time at the bottom of the Main Dashboard. If it's more than a couple of minutes old during regular hours, hard reload the page (Cmd+Shift+R / Ctrl+Shift+R). Dealer-positioning numbers are recomputed about once a minute, so short pauses between changes are normal.

**Signal score shows 0.** That usually means "no read", not "neutral". See [Reading the -100 to +100 Score Line](/help/platform/score-line).

## Payments

**Card was declined.** Update the payment method in the Stripe billing portal (linked from your [Account](/account) page). Most declines are expired cards, address mismatches, or regional restrictions.

**Subscription says "past due".** Stripe is retrying the charge. Update the payment method, or pay the open invoice from your Account page with **Open billing portal**, to resolve. Paid features stay live for a short grace period while it retries.

**Bill is higher than expected.** Open the invoice in the portal - line items are detailed. Common surprises: a mid-period upgrade is prorated - you get a credit for the unused part of the current period plus the new-plan charge, applied to your **next invoice** rather than billed on the spot. Leaving the Basic free trial for Pro or a longer billing period bills the new plan the same day.

**Cancellation didn't go through.** Cancellation takes effect at the end of the billing period. Until then, you keep paid access. The portal and your Account page show the planned end date.

## Tier and access

**A page sends you to Pricing or an unlock screen instead of opening.** That page requires a tier you don't currently have. The unlock screen names the plan that includes it, and [Pricing](/pricing) shows the full breakdown.

**You upgraded but a page is still locked.** Hard reload to refresh the session. If still locked after that, sign out and back in. If still locked, email support.

## Browser

**The page is blank.** A browser extension is likely blocking scripts. Try an incognito window with extensions disabled. If it works there, identify the extension by toggling them off one at a time.

**Charts render with unexpected colors.** Check the palette menu next to the sun/moon icon in the header - a different palette changes every chart's colors. If the palette is right, toggle the theme once (sun/moon icon); the next reload renders cleanly.

**Sign-in cookies don't persist.** You may be in a strict-privacy browser mode (Brave shields on aggressive, Safari with "Prevent cross-site tracking", certain Firefox containers). Allowlist `zerogex.io` for cookies, or sign in fresh each session.

## Charts

**Chart is empty when others have data.** The most common cause is a tier gate - the chart belongs to a tier you don't have, and Pro-only panels show an upgrade prompt in its place. Other times: the underlying signal is intentionally idle (its window isn't open).

**Hover tooltips don't show.** A touch device. Tap or long-press the chart instead, or switch to a desktop.

## Mobile

**Layout looks cramped.** ZeroGEX is built for desktop. The mobile layout works for monitoring; complex multi-chart pages assume more horizontal room.

**The page won't scroll while your finger is on a chart.** Swipe up or down - charts only capture sideways drags (to pan through time), so a vertical swipe scrolls the page.

## When to email support

After you've tried the relevant items above. Include:

- The page URL you were on.
- A screenshot if relevant.
- Browser, OS, and roughly when it happened (with timezone).
- Your account email.

Email [support@zerogex.io](mailto:support@zerogex.io). We respond fast - usually the same trading day.

## See also

- [Streaming & Performance](/help/platform/streaming-and-performance)
- [Account Settings](/help/platform/account)
- [Billing & Stripe Portal](/help/platform/billing)
- [FAQs](/help/faqs)
