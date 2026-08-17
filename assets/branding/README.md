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
Run `make logo` to deploy assets to frontend/public/:

| Source | Deployed as | Used by |
| --- | --- | --- |
| `Dark_Full.png` / `Light_Full.png` | `logo-dark.png` / `logo-light.png` | footer, collapsed nav card |
| `Dark_Title.png` / `Light_Title.png` | `title-dark.png` / `title-light.png` | header bars, live-bulletin card |
| `Target.svg` | `target.svg` | |
| `favicon.ico`, `og-image.png` | same name | |

The four lockup PNGs are not copied verbatim: `make logo` runs them through
`scripts/trim-png.js`, which crops the transparent margin off the export and
caps the width (1024 for the full lockups, 1280 for the title lockups). The
exports carry different amounts of empty canvas per file — dropping them in
untrimmed would render the same logo at two different sizes depending on the
theme. Re-export from the design tool under the same filenames and re-run
`make logo`; nothing here needs manual cropping.

The frontend picks the variant for the active theme in `frontend/core/brand.ts`,
which also records the deployed pixel sizes for next/image. If a re-export
changes the artwork's proportions, update the sizes there to whatever
`make logo` prints.
