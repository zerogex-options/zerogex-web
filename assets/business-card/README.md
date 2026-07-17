# ZeroGEX Business Card

Print-ready single-sided business card with the ZeroGEX logo and a QR code that carries a
**card-only promo (50% off the first year, code `TARGET`)**. The QR points at
`https://zerogex.io/register?ref=TARGET` so the offer is captured on scan.

![Mockup](zerogex-card-mockup.png)

> **Note:** the QR/code only grants the discount once `TARGET` is wired up in billing
> (see "Activating the promo" below). Until then the card art is final but the rate won't apply.

## Files

| File | What it is |
| --- | --- |
| `zerogex-card.png` | The card — full logo, `GEX · Gamma · Flow Analytics` tagline, `zerogex.io`, and the scannable QR panel. 2100×1200 (3.5″×2″ @ 600 DPI). |
| `zerogex-card-print.pdf` | **Send this to the printer.** Full-bleed artwork (3.75″×2.25″) with crop marks at the 3.5″×2″ trim. |
| `zerogex-card-mockup.png` | Presentation view of the card, for review. |
| `qr-zerogex.svg` | The QR code (vector) encoding `https://zerogex.io/register?ref=TARGET` — the promo link. Error-correction level H, so the center target mark doesn't affect scanning. |
| `build-card.js` | Regenerates the PNGs from the brand assets. |
| `fonts/` | Space Grotesk + JetBrains Mono (OFL) — the brand faces, embedded for offline builds. |

## Specs

- **Trim size:** 3.5″ × 2″ (US standard). Add a 0.125″ bleed when sending to a printer.
- **Colors** (from `assets/branding/README.md`): navy field `#0B1826`→`#1B3D59`, coral accent `#F4645F`, cream text `#F4F1EC`.
- The QR was verified to decode to `https://zerogex.io` at print resolution.

## Customizing

Regenerate after any edit:

```bash
npm i playwright          # one-time
node build-card.js        # writes zerogex-card.png + zerogex-card-mockup.png
```

To point the QR at a different URL, edit `CARD.qrUrl` in `build-card.js` and regenerate `qr-zerogex.svg`:

```bash
pip install segno
python -c "import segno; segno.make('https://zerogex.io/register?ref=TARGET', error='h').save('qr-zerogex.svg', scale=10, border=2, dark='#0E1B2A', light=None)"
```

## Activating the promo (`TARGET`)

A bare marketing code is **not** honored automatically: `recordReferralSignup` in
`frontend/core/referrals.ts` only stamps `referred_by_code` when the code resolves to a real
referrer/partner, and both referral programs sit behind env flags. To make `TARGET` grant
50% off the first year **and** be identifiable, treat it as a dedicated campaign code:

1. In **Stripe**, create a coupon: 50% off, restricted to first-time customers, with an
   expiry / max-redemption cap. For "first year": annual → `duration: once`; monthly →
   `duration: repeating, duration_in_months: 12`.
2. Wire the code into checkout so `?ref=TARGET` (and the typed code) auto-applies that coupon
   and stamps `referred_by_code = 'TARGET'` — mirrors the existing `foundingCode` branch in
   `frontend/app/api/billing/checkout/route.ts`.

**Identifying redeemers** once wired: `SELECT id, email, created_at FROM users WHERE
referred_by_code = 'TARGET'` (signups from the card), joined to subscription state for
conversions. Stripe also shows redemption counts on the coupon/promotion code.
