# X / Twitter ad creative

Upload-ready ad images for the ZeroGEX X campaign — see [`../twitter-ad-campaign.md`](../twitter-ad-campaign.md).
Rendered from [`creative-generator.html`](./creative-generator.html) using the real brand
logo (`assets/branding/Dark_Full.svg`) and real product charts (`assets/blog/*.png`).
Exported at 2x, so pixel dimensions are double the ratio below.

| File | Stage | Ratio | Headline | Destination |
|---|---|---|---|---|
| `cold-1-dashboard.png` | COLD | 1:1 | Stop trading SPY blind. | `/spx-gamma-levels` |
| `cold-2-heatmap.png` | COLD | 1:1 | Know the levels that matter. | `/spx-gamma-levels` |
| `cold-3-profile.png` | COLD | 1:1 | Support & resistance that aren't guesses. | `/spx-gamma-levels` |
| `warm-4-market-makers.png` | WARM | 1.91:1 | See what the market makers see. | `/pricing` |
| `convert-5-offer.png` | CONVERT | 1:1 | Trade positioning, not guesswork. | `/pricing` |
| `convert-6-folds-of-honor.png` | CONVERT | 1:1 | Institutional gamma. A cause behind it. | `/pricing` |

Post copy + UTMs: [`../twitter-ad-campaign.md`](../twitter-ad-campaign.md) §6.

## Re-rendering

Each ad is a full-bleed `<section>` in `creative-generator.html`, selected by URL hash
(`#cold1`, `#cold2`, `#cold3`, `#warm4`, `#convert5`, `#convert6`). To regenerate at 2x:

    chromium --headless=new --allow-file-access-from-files \
      --force-device-scale-factor=2 --window-size=1080,1080 \
      --screenshot=cold-1-dashboard.png \
      "file://$PWD/creative-generator.html#cold1"

Use `--window-size=1200,628` for `warm-4-market-makers.png`.
