# Troubleshooting

*The short list — sign-in problems, missing data, stale charts, payment issues, browser caches, and when to email support.*

---

## Can't sign in

**You forgot your password.** Use [Forgot Password](/forgot-password). A reset link is emailed; click and set a new one. If the email doesn't arrive, check spam.

**You signed up with Google or Apple and don't have a password.** Sign in with the provider you used. From the Account page you can then set a password for future fallback.

**The provider says "no account found".** You may have signed up with a different email. Try the other provider, or email [support@zerogex.io](mailto:support@zerogex.io) — we can look up the account.

**Two-factor or device prompt won't go away.** Sign in fresh from an incognito window. If it persists, support can clear stale sessions on your account.

## Missing or stale data

**The session badge says Closed.** That's the answer — markets are closed. The last computed values are shown.

**A chart says "no data".** Usually a session-window issue (EOD Pressure outside its window, 0DTE on a non-expiration day). Hover the empty-state — the tooltip explains.

**Tile values look frozen.** Check the timestamp on the price tile. If it's older than 30 seconds during regular hours, hard reload the page (Cmd+Shift+R / Ctrl+Shift+R).

**Signal score shows 0.** That usually means "no read", not "neutral". See [Reading the [-1, +1] Score Line](/help/platform/score-line).

## Payments

**Card was declined.** Update the payment method in the Stripe billing portal (linked from your [Account](/account) page). Most declines are expired cards, address mismatches, or regional restrictions.

**Subscription says "past due".** Stripe is retrying the charge. Update the payment method to resolve. Paid features stay live during the retry window.

**Bill is higher than expected.** Open the invoice in the portal — line items are detailed. Common surprises: a plan change mid-cycle is prorated; a switch from monthly to annual is billed upfront.

**Cancellation didn't go through.** Cancellation takes effect at the end of the billing period. Until then, you keep paid access. The portal shows the planned end date.

## Tier and access

**A page redirects to /pricing instead of opening.** That page requires a tier you don't currently have. [Pricing](/pricing) shows what unlocks it.

**You upgraded but a page is still locked.** Hard reload to refresh the session. If still locked after that, sign out and back in. If still locked, email support.

## Browser

**The page is blank.** A browser extension is likely blocking scripts. Try an incognito window with extensions disabled. If it works there, identify the extension by toggling them off one at a time.

**Charts render with weird colors.** Theme cache mismatch. Toggle the theme once (sun/moon icon). The next reload renders cleanly.

**Sign-in cookies don't persist.** You may be in a strict-privacy browser mode (Brave shields on aggressive, Safari with "Prevent cross-site tracking", certain Firefox containers). Allowlist `zerogex.io` for cookies, or sign in fresh each session.

## Charts

**Chart is empty when others have data.** The most common cause is a tier gate — the chart belongs to a tier you don't have. Other times: the underlying signal is intentionally idle (its window isn't open). Hover the empty-state for the explanation.

**Hover tooltips don't show.** A touch device. Use long-press, or switch to a desktop.

## Mobile

**Layout looks cramped.** ZeroGEX is built for desktop. The mobile layout works for monitoring; complex multi-chart pages assume more horizontal room.

**Scrolling locks during a chart drag.** Tap outside the chart area first, then scroll. Charts intentionally capture horizontal drag for zoom/pan.

## When to email support

After you've tried the relevant items above. Include:

- The page URL you were on.
- A screenshot if relevant.
- Browser, OS, and roughly when it happened (with timezone).
- Your account email.

Email [support@zerogex.io](mailto:support@zerogex.io). We respond fast — usually the same trading day.

## See also

- [Streaming & Performance](/help/platform/streaming-and-performance)
- [Account Settings](/help/platform/account)
- [Billing & Stripe Portal](/help/platform/billing)
- [FAQs](/help/faqs)
