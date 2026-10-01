# Billing & Stripe Portal

*How billing works through Stripe, monthly vs. quarterly vs. annual, the free trial and the money-back guarantee, switching tiers, payment methods, and invoices.*

---

## How billing works

ZeroGEX bills through **Stripe**. We do not see or store payment card details - Stripe handles all of that. Payment methods, invoices and plan changes are handled in the Stripe-hosted billing portal, opened from your [Account](/account) page. Canceling happens on the Account page itself.

## Plans and cadences

Two tiers - **Basic** and **Pro** - each available **monthly**, **quarterly** (billed every 3 months) or **annual**.

- The longer the billing period, the less you pay per month. The [Pricing](/pricing) page shows what each plan bills, with its monthly equivalent underneath, and a comparison table of what you save versus paying monthly.
- You can switch to a longer billing period from the [Pricing](/pricing) page or in the portal (see below).

## Free trial (Basic monthly)

Basic monthly starts with a **7-day free trial**: full access right away, your card on file, and no charge until the trial ends. About 48 hours before it ends, we email you a reminder with the amount that will be charged. At the end of the trial, the subscription continues automatically at the rate you signed up at - no second confirmation step.

To prevent that auto-renew: cancel before the trial ends with **Cancel subscription** on your Account page. You keep access through the end of the trial. One free trial per account.

## 7-day money-back guarantee (every other plan)

Pro, and every quarterly and annual plan, is billed when you subscribe - and covered by a **7-day money-back guarantee** instead of a trial. If it isn't the right fit, open [Account](/account) within 7 days of your first payment and click **Request a full refund**:

- The payment is refunded in full to the card you paid with (it usually appears within 5-10 business days).
- Your subscription is canceled and paid access ends as soon as the refund is issued.
- The guarantee is limited to **one refund per customer** - per account, email address, or card - and doesn't cover renewals.

## How to manage your subscription

1. Open [Account](/account).
2. Click **Manage Subscription** - this opens the Stripe billing portal.

From the portal you can:

- Change tier (Basic ↔ Pro)
- Change billing period (monthly ↔ quarterly ↔ annual)
- Update payment method
- View and download invoices

To cancel, use the **Cancel subscription** link on your Account page instead (see Cancellation below).

## Tier upgrades and downgrades

- **Upgrade (Basic → Pro)** - proration is applied. Tier access updates instantly; the prorated difference (a credit for unused time plus the new-tier charge) appears on your **next invoice** rather than being billed on the spot.
- **Downgrade (Pro → Basic)** - the change takes effect at the end of the current billing period. You keep Pro features until then.
- **Billing-period change** - a move to a longer period (monthly → quarterly → annual) applies right away: the new period starts that day and is billed that day, with a credit for the unused part of your current period. A move to a shorter one takes effect at the end of the current period, like a downgrade.
- **During the Basic free trial** - moving to Pro, or to quarterly or annual billing, ends the trial and bills the new plan that day. From the [Pricing](/pricing) page you'll see the exact amount and confirm it first; that payment is covered by the 7-day money-back guarantee.

## Cancellation

- Cancel with the **Cancel subscription** link under Manage Subscription on your Account page. Before it cancels, it may offer a discount, a switch to a longer billing period, or a pause of one to three months - no charge and no access while it's paused, and it resumes automatically. You can skip every offer and cancel.
- Cancellation takes effect at the **end of the current billing period**. You keep paid access until then, and your Account page shows the date.
- After the period ends, your tier reverts to Public. Your account is not deleted; your referral data and saved settings remain.
- You can resubscribe anytime.

## Payment methods

Stripe handles your payment details. Add, change, or remove the card on file in the portal.

## Invoices and receipts

Every charge produces a Stripe invoice. The portal lists every past invoice with PDF download links. Receipts are also emailed automatically.

## Failed payments

If a charge fails, Stripe retries automatically over several days. During the retry window, your subscription is in "past due" state - paid features stay available temporarily. If all retries fail, the subscription is canceled and tier reverts.

Your Account page flags the failed payment, and its **Open billing portal** button lets you pay the open invoice with any card - no need to sign up again. The most common failure modes: expired card, address verification mismatch, regional restrictions. Update the payment method in the portal to resolve.

## Refunds

Our [Pricing](/pricing) page documents the refund and cancellation policy. Short version: the Basic monthly trial is unconditional - cancel before it ends and you're never charged - and every other plan has the 7-day money-back guarantee above (one refund per customer). Beyond that, subscriptions are billed in advance and not pro-rated on cancellation.

For exceptions, email [support@zerogex.io](mailto:support@zerogex.io).

## Switching to a longer billing period

The math works out in your favor - the longer the period, the lower the monthly equivalent. Choose the longer period on the [Pricing](/pricing) page: you'll see the exact amount charged today - the new plan's price, less a credit for the unused part of your current period - and confirm it first. The new period starts that day. The portal can make the same switch. If you're still in the Basic free trial, the switch ends the trial and bills the new plan that day (see above).

## Renewal reminders

Quarterly and annual plans renew automatically. We email you before they do - 7 days ahead for quarterly, 30 days ahead for annual - with the date and amount, so you can cancel from your Account page or switch plans first if you want to.

## Promo and coupon codes

Promo coupons are applied at checkout. If a promo is active, the Pricing page shows the post-coupon rate; otherwise the rack rate.

The **founding-member rate** was an invitation-only launch offer and is closed to new members. Founding members keep their rate, and if a founding subscription lapses, choosing monthly or annual billing again reapplies it automatically at checkout.

## See also

- [Account Settings](/help/platform/account)
- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Pricing](/pricing)
