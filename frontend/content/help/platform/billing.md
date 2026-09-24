# Billing & Stripe Portal

*How billing works through Stripe, monthly vs. quarterly vs. annual, the free trial and the money-back guarantee, switching tiers, payment methods, and invoices.*

---

## How billing works

ZeroGEX bills through **Stripe**. We do not see or store payment card details - Stripe handles all of that. Every billing action you take happens in the Stripe-hosted billing portal, accessed from your [Account](/account) page.

## Plans and cadences

Two tiers - **Basic** and **Pro** - each available **monthly**, **quarterly** (billed every 3 months) or **annual**.

- The longer the billing period, the less you pay per month. The [Pricing](/pricing) page quotes every plan as a monthly equivalent so they compare directly, with the amount actually billed underneath.
- Switching between billing periods is supported through the portal.

## Free trial (Basic monthly)

Basic monthly starts with a **7-day free trial**: full access right away, your card on file, and no charge until the trial ends. At the end of the trial, the subscription continues automatically at the rate you signed up at - no second confirmation step.

To prevent that auto-renew: cancel in the portal before the trial ends. You keep access through the end of the trial. One free trial per account.

## 7-day money-back guarantee (every other plan)

Pro, and every quarterly and annual plan, is billed when you subscribe - and covered by a **7-day money-back guarantee** instead of a trial. If it isn't the right fit, open [Account](/account) within 7 days of your first payment and click **Request a full refund**:

- The payment is refunded in full to the card you paid with (it usually appears within 5-10 business days).
- Your subscription is canceled and paid access ends as soon as the refund is issued.
- The guarantee is limited to **one refund per customer** - per account, email address, or card - and doesn't cover renewals.

## How to manage your subscription

1. Open [Account](/account).
2. Click "Manage subscription" - this opens the Stripe portal in a new tab.
3. From the portal you can:
   - Change tier (Basic ↔ Pro)
   - Change billing period (monthly ↔ quarterly ↔ annual)
   - Update payment method
   - View and download invoices
   - Cancel the subscription

## Tier upgrades and downgrades

- **Upgrade (Basic → Pro)** - proration is applied. Tier access updates instantly; the prorated difference (a credit for unused time plus the new-tier charge) appears on your **next invoice** rather than being billed on the spot.
- **Downgrade (Pro → Basic)** - the change takes effect at the end of the current billing period. You keep Pro features until then.
- **Billing-period change** - a move to a longer period (monthly → quarterly → annual) applies right away (with proration on your next invoice); a move to a shorter one takes effect at the end of the current period, like a downgrade.
- **During the Basic free trial** - moving to Pro, or to quarterly or annual billing, ends the trial and bills the new plan that day. From the [Pricing](/pricing) page you'll see the exact amount and confirm it first; that payment is covered by the 7-day money-back guarantee.

## Cancellation

- Cancellation takes effect at the **end of the current billing period**. You keep paid access until then.
- After the period ends, your tier reverts to Public. Your account is not deleted; your education progress, referral data, and saved settings remain.
- You can resubscribe anytime.

## Payment methods

Stripe supports cards, Apple Pay, Google Pay, and (in most regions) bank transfers. Manage them all in the portal.

## Invoices and receipts

Every charge produces a Stripe invoice. The portal lists every past invoice with PDF download links. Receipts are also emailed automatically.

## Failed payments

If a charge fails, Stripe retries automatically over several days. During the retry window, your subscription is in "past due" state - paid features stay available temporarily. If all retries fail, the subscription is canceled and tier reverts.

The most common failure modes: expired card, address verification mismatch, regional restrictions. Update the payment method in the portal to resolve.

## Refunds

Our [Pricing](/pricing) page documents the refund and cancellation policy. Short version: the Basic monthly trial is unconditional - cancel before it ends and you're never charged - and every other plan has the 7-day money-back guarantee above (one refund per customer). Beyond that, subscriptions are billed in advance and not pro-rated on cancellation.

For exceptions, email [support@zerogex.io](mailto:support@zerogex.io).

## Switching to a longer billing period

Most users hit this around month 3 - the math works out in your favor. The portal handles the switch: it applies right away, and proration (a credit for the unused part of the current period plus the new charge) lands on your next invoice. If you're still in the Basic free trial, the switch ends the trial and bills the new plan that day (see above).

## Renewal reminders

Quarterly and annual plans renew automatically. We email you before they do - 7 days ahead for quarterly, 30 days ahead for annual - with the date and amount, so you can cancel or switch in the portal first if you want to.

## Promo and coupon codes

Promo coupons are applied at checkout. If a promo is active, the Pricing page shows the post-coupon rate; otherwise the rack rate.

The **founding-member rate** is a separate, invitation-only path - see the [/founding](/founding) page if you have the access code.

## See also

- [Account Settings](/help/platform/account)
- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Pricing](/pricing)
