# Billing & Stripe Portal

*How billing works through Stripe, the difference between monthly and annual, switching tiers, payment methods, and invoices.*

---

## How billing works

ZeroGEX bills through **Stripe**. We do not see or store payment card details — Stripe handles all of that. Every billing action you take happens in the Stripe-hosted billing portal, accessed from your [Account](/account) page.

## Plans and cadences

Two tiers — **Basic** and **Pro** — each available **monthly** or **annual**.

- Annual is offered at a discount to monthly. The exact rate is on the [Pricing](/pricing) page.
- Switching between cadences is supported through the portal.

## Free trial

When you start a paid plan, you get a free trial period (length is shown on the Pricing page). At the end of the trial, the subscription continues automatically at the rate you signed up at — no second confirmation step.

To prevent that auto-renew: cancel in the portal before the trial ends. You keep access through the end of the trial.

## How to manage your subscription

1. Open [Account](/account).
2. Click "Manage subscription" — this opens the Stripe portal in a new tab.
3. From the portal you can:
   - Change tier (Basic ↔ Pro)
   - Change cadence (monthly ↔ annual)
   - Update payment method
   - View and download invoices
   - Cancel the subscription

## Tier upgrades and downgrades

- **Upgrade (Basic → Pro)** — proration is applied. You're billed the prorated difference immediately and tier access updates instantly.
- **Downgrade (Pro → Basic)** — the change takes effect at the end of the current billing period. You keep Pro features until then.
- **Cadence change** — same logic as tier changes.

## Cancellation

- Cancellation takes effect at the **end of the current billing period**. You keep paid access until then.
- After the period ends, your tier reverts to Public. Your account is not deleted; your education progress, referral data, and saved settings remain.
- You can resubscribe anytime.

## Payment methods

Stripe supports cards, Apple Pay, Google Pay, and (in most regions) bank transfers. Manage them all in the portal.

## Invoices and receipts

Every charge produces a Stripe invoice. The portal lists every past invoice with PDF download links. Receipts are also emailed automatically.

## Failed payments

If a charge fails, Stripe retries automatically over several days. During the retry window, your subscription is in "past due" state — paid features stay available temporarily. If all retries fail, the subscription is cancelled and tier reverts.

The most common failure modes: expired card, address verification mismatch, regional restrictions. Update the payment method in the portal to resolve.

## Refunds

Our [Pricing](/pricing) page documents the refund and cancellation policy. Short version: subscriptions are billed in advance and not pro-rated on cancellation, but the trial is unconditional — cancel before it ends, you're never charged.

For exceptions, email [support@zerogex.io](mailto:support@zerogex.io).

## Switching from monthly to annual

Most users hit this around month 3 — the math works out in your favor. The portal handles the switch. Proration applies on the remainder of the monthly cycle.

## Promo and coupon codes

Promo coupons are applied at checkout. If a promo is active, the Pricing page shows the post-coupon rate; otherwise the rack rate.

The **founding-member rate** is a separate, invitation-only path — see the [/founding](/founding) page if you have the access code.

## See also

- [Account Settings](/help/platform/account)
- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Pricing](/pricing)
