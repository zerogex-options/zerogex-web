# ZeroGEX Business Card

Print-ready business-card mockups with a QR code to **https://zerogex.io** and the ZeroGEX logo.

![Mockup](zerogex-card-mockup.png)

## Files

| File | What it is |
| --- | --- |
| `zerogex-card-front.png` | Front — logo, tagline, `zerogex.io`, and the scannable QR panel. 2100×1200 (3.5″×2″ @ 600 DPI). |
| `zerogex-card-back.png` | Back — name, title, contact rows, and a second QR. Same dimensions. |
| `zerogex-card-mockup.png` | Presentation view of both sides, for review. |
| `qr-zerogex.svg` | The QR code (vector) encoding `https://zerogex.io`. Error-correction level H, so the center target mark doesn't affect scanning. |
| `build-card.js` | Regenerates all three PNGs from the brand assets. |
| `fonts/` | Space Grotesk + JetBrains Mono (OFL) — the brand faces, embedded for offline builds. |

## Specs

- **Trim size:** 3.5″ × 2″ (US standard). Add a 0.125″ bleed when sending to a printer.
- **Colors** (from `assets/branding/README.md`): navy field `#0B1826`→`#1B3D59`, coral accent `#F4645F`, cream text `#F4F1EC`.
- The QR was verified to decode to `https://zerogex.io` at print resolution.

## Customizing

The name / title / contact details are **placeholders**. Edit the `CARD` object at the top of
`build-card.js`, then regenerate:

```bash
npm i playwright          # one-time
node build-card.js        # writes the three PNGs
```

To point the QR at a different URL, regenerate `qr-zerogex.svg`:

```bash
pip install segno
python -c "import segno; segno.make('https://zerogex.io', error='h').save('qr-zerogex.svg', scale=10, border=2, dark='#0E1B2A', light=None)"
```
