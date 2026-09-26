# Account Settings

*Email, password, linked sign-in providers (Google/Apple), tier and plan status, and how to manage them safely.*

---

## What the Account page does

The [Account](/account) page is the single home for everything user-level - your email, your subscription, your sign-in methods, notifications, the referral panel, and account deletion.

## The header

Shows your email and your tier (Public, Basic, Pro, or Admin). Below Pro, an **Upgrade** button next to your tier takes you to [Pricing](/pricing). If your email isn't verified yet, a banner at the top of the page says so.

## Email and verification

- The email address you signed up with is your account ID. It can't be changed without going through support.
- New accounts need to verify the email - a verification link is sent on sign-up and expires after 24 hours. Until you verify, you can't start a trial or subscribe.
- If you didn't get the original, click **Resend** on the verification banner at the top of the Account page.

## Password

- Set a password if you signed up with Google or Apple and want a fallback. Under Sign-in methods, the **Set password** button appears for accounts without a password.
- To change an existing password, click **Reset password** - we email you a link to set a new one.
- Minimum length is 12 characters.
- Use a password manager. We don't do password complexity rules - length and uniqueness matter more than character sets.

## Linked sign-in providers

You can link **Google** and **Apple** sign-in to the same account. The Sign-in methods section shows which providers are connected. If Apple reads "Coming soon", Apple sign-in isn't switched on yet.

- **Linking a new provider** - click **Connect** next to it, or sign in with the provider once; the system auto-links to your existing account if the email matches.
- **Unlinking a provider** - click **Disconnect**. It's only allowed if you have at least one other way to sign in (another provider OR a password). The page enforces this so you can't lock yourself out.

## Tier and subscription

- Your current tier is shown at the top of the page.
- **Manage Subscription**, under Subscription, opens the Stripe-hosted billing portal. Plan switches, payment methods, invoices, and cancellation all happen there.
- You can also cancel with the **Cancel subscription** link under that button, which offers a pause of one to three months instead if a break is all you need.
- If a payment fails, the section says so and the button reads **Open billing portal**, where you can pay the open invoice with any card or update your payment method.
- Within 7 days of your first payment on a plan covered by the 7-day money-back guarantee (Pro, or any quarterly or annual plan), click **Request a full refund** on the Account page. Access ends when the refund is issued; one refund per customer.

For step-by-step, see [Billing & Stripe Portal](/help/platform/billing).

## API access (Pro)

On Pro, the **API Access** section is where you create and revoke personal API keys. Keys are revoked automatically if your plan drops below Pro. See [API Access & Keys (Pro)](/help/platform/api-access).

## Notifications

**Manage notifications** opens a page for the TradeWorkz™ bots you follow, where you choose how each one reaches you: in-app, email, or webhook.

## Social media

Optionally add your **X (formerly Twitter) handle** in the Social Media section so the ZeroGEX team can reach you there. It's never required - you're not asked for it at sign-up, and you can add, change, or remove it anytime from your account.

- Enter the handle with or without the leading `@` - 1-15 characters, letters, numbers, and underscores only.
- Clear the field and save to remove a handle you previously added.

## Referral panel

If the referral program is running, a **Refer a friend** section shows:

- Your referral link, with a **Copy link** button
- **Signed up** - how many people signed up through your link (hover to see their email addresses)
- **Subscribed** - how many of them went on to a paid plan (hover to see who)
- **Free months earned**
- **Months banked** - free months waiting to be applied when you next subscribe (shown only when you have some)
- The credit that will be applied to your next bill, when there is one

For the program rules, see [Referrals](/help/platform/referrals).

## Signing out

Open the profile menu in the header and choose **Logout** (on a phone, **Log out** is in the menu). This clears the session cookie. Sign back in from [/login](/login).

## Deleting your account

Scroll to **Delete account** at the bottom of the Account page, click **Delete my account**, type DELETE, and click **Permanently delete account**. Deleting cancels any active subscription immediately, signs you out, revokes any API keys, and stops all email from us. It can't be undone from the page - to restore access afterward, email [support@zerogex.io](mailto:support@zerogex.io). Our [Privacy](/privacy) policy explains how account data is handled.

## See also

- [Billing & Stripe Portal](/help/platform/billing)
- [Referrals](/help/platform/referrals)
- [Email Preferences](/help/platform/email-preferences)
