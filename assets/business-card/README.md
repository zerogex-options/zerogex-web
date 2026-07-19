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
| `zerogex-card.png` | The card — full logo, `Gamma · Dealer Flow · Key Levels` tagline, `zerogex.io`, and the scannable QR panel. 2100×1200 (3.5″×2″ @ 600 DPI). |
| `zerogex-card-vistaprint-cmyk.pdf` | **Upload this to VistaPrint.** Same as below but converted to **CMYK** (DeviceCMYK) — print-ready color. |
| `zerogex-card-vistaprint.pdf` | RGB version for online printers that prefer/convert RGB. Exactly 3.75″×2.25″, full-bleed, **no crop marks**. |
| `zerogex-card-print.pdf` | For a **traditional print shop**: 4.1″×2.6″ sheet, full-bleed art, with crop marks at the 3.5″×2″ trim. |
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
npm i playwright             # one-time
node build-card.js           # writes zerogex-card.png + zerogex-card-mockup.png
node build-print-pdf.js      # writes zerogex-card-print.pdf + zerogex-card-vistaprint.pdf (RGB)
# CMYK version for VistaPrint (needs ghostscript):
gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite \
   -dProcessColorModel=/DeviceCMYK -sColorConversionStrategy=CMYK -dConvertCMYKImagesToRGB=false \
   -dDownsampleColorImages=false -dAutoFilterColorImages=false -dColorImageFilter=/FlateEncode \
   -o zerogex-card-vistaprint-cmyk.pdf zerogex-card-vistaprint.pdf
```

To point the QR at a different URL, edit `CARD.qrUrl` in `build-card.js` and regenerate `qr-zerogex.svg`:

```bash
pip install segno
python -c "import segno; segno.make('https://zerogex.io/register?ref=TARGET', error='h').save('qr-zerogex.svg', scale=10, border=2, dark='#0E1B2A', light=None)"
```

## Activating the promo (`TARGET`)

The app side is **already wired** — `TARGET` is handled as a dedicated *campaign code*
(`frontend/core/campaigns.ts`): scanning `/register?ref=TARGET` stamps `referred_by_code`
on the new account, and checkout auto-applies the matching coupon (see the campaign branch
in `frontend/app/api/billing/checkout/route.ts`). All that's left is Stripe config:

1. In **Stripe**, create the coupon(s): 50% off, restricted to first-time customers, with an
   expiry / max-redemption cap. For "first year": annual → `duration: once`; monthly →
   `duration: repeating, duration_in_months: 12`.
2. Set the coupon IDs in env (see `frontend/.env.example`):
   ```
   STRIPE_CAMPAIGN_TARGET_MONTHLY=<coupon id>   # 50% off, repeating 12 months
   STRIPE_CAMPAIGN_TARGET_ANNUAL=<coupon id>    # 50% off, once
   ```
   The promo is live as soon as either is set; unset = inert. New campaigns need no code
   change — just add `STRIPE_CAMPAIGN_<CODE>_MONTHLY/ANNUAL` and print a card.

**Identifying redeemers:**

```sql
SELECT id, email, created_at FROM users WHERE referred_by_code = 'TARGET';
```

Join to subscription state for conversions. Each such checkout also tags the Stripe
subscription with `metadata.campaign_code = TARGET`, and the coupon's redemption count shows
in the Stripe dashboard.
