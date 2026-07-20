# ZeroGEX Branding Assets

## Logo Files (Dark/Light)
- `Dark_Full.png`/`Light_Full.png` - Full Logo
- `Dark_Title.png`/`Light_Title.png` - Title-only
- `Dark_Title_Subtitle.png`/`Light_Title_Subtitle.png` - Title and subtitle
- `Dark_Helmet.png`/`Light_Helmet.png` - Helmet logo
- `Dark_Crosshairs.png`/`Light_Crosshairs.png` - Crosshairs logo
- `favicon.ico` - Mini helmet logo

## Color Palette
- Primary Dark: `#423d3f`
- Muted/Secondary: `#968f92`
- Light: `#f2f2f2`
- Accent/Bearish: `#f45854`
- Bullish: `#10b981`

## Folds of Honor Partner Kit

ZeroGEX is a Folds of Honor **Proud Supporter**. Partner-kit assets ship
under these exact filenames — the `/giving` page and `make logo` both
reference them by name, so keep them stable:

- `folds-of-honor-proud-supporter.png` — official Proud Supporter badge
  (round seal with folded flag). Sourced from the FOH partner kit; do
  not recolor, crop, or alter. Displayed on `/giving` as the charity
  partner spotlight image.
- `folds-of-honor-donation-qr.png` — QR code encoding ZeroGEX's tracked
  donation URL. Displayed on `/giving` in the "Donate directly" section.
  Sourced from the FOH partner kit.
- `folds-of-honor-boilerplate.pdf` — the boilerplate "About Folds of
  Honor" paragraph FOH provides to supporters. Kept for reference; the
  same text appears in prose on `/giving`.
- `folds-of-honor-logo.svg` — legacy typographic name treatment used
  before the official Proud Supporter badge arrived. Currently unused;
  safe to remove in a future cleanup.

`make logo` will skip missing FOH partner-kit files with a warning
rather than fail — new partners can bootstrap without every asset in
place.

## Generating Web Assets
Run `make logo` to copy assets to frontend/public/
