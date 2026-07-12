# ZeroGEX — Design Intentionality Strategy

*A systematic plan to move the site from "AI-generated" to "designed with intention."*

> **The one-line diagnosis:** It isn't the tokens — the token system is genuinely
> sophisticated. It's that the *composition* never invokes it, and instead repeats a
> single decorated-box recipe ~637 times. The fix is to make shared primitives carry the
> design so **one edit cascades**, and to make the **gamma flip** the spine of both the
> information design and the brand.

This document was produced by diagnosing the live codebase (193 components, grep-verified
counts, real file/line references), synthesising seven expert design critiques and three
competing art directions, then adversarially pressure-testing the result (genericness
score **19/100**, lower is better).

---

## 1. Why it reads AI-generated — two problems wearing one coat

The user's feedback ("typical wrappers and layers and buttons") is precise. There are two
layers to the problem, and only fixing both makes it read as intentional.

**A — Orphaned intention (the chrome).** A good token set exists (`globals.css`: four
editorial palettes × light/dark, a full `.zg-*` type scale, tabular numerals) but no shared
primitive invokes it. Every component independently re-stacks the same five redundant
"this-is-a-card" signals:

1. a soft radius (`rounded-2xl`, and 11 different arbitrary corner values overall),
2. a 1px border drawn in the **body-text** colour (`1px solid var(--text-secondary)`),
3. a coloured glow (`box-shadow … var(--color-info-soft)`),
4. a 135° gradient wash,
5. a tinted icon-in-a-box,

…then floats them in a rhythm-less `gap-2`/`p-6`/`mb-8` grid under a centred eyebrow-pill.
That is the literal default of assembling a Tailwind/shadcn card kit. Because the page shell
(`container mx-auto`, 33×), the section head (redefined 6×) and the buttons (inline-styled
with JS hover, ~7× in one file) are copy-pasted, the layout can only change one file at a
time — **which is exactly why every prior fix felt "onesy-twosy."**

**B — A skin, not an instrument (the product).** It calls itself a terminal but is composed
like a marketing site: spacious equal tiles instead of a strike ladder, no as-of stamp, no
closed-market/pre-market/weekend state, no loading/empty/error surfaces. Those are the
moments a real desk tool proves it isn't a mock — and they're undesigned.

### The evidence, in numbers (grep across `app/` + `components/`)

| Signal | Count | What it means |
|---|---|---|
| `rounded-*` usages | **637** across 129/193 files | Almost everything is a decorated box |
| `linear-gradient` | **125** | Heavy gradient washes on chrome |
| `uppercase tracking` labels | **265** | The eyebrow/label is site-wide texture |
| `container mx-auto` shells | **33** files | No shared layout primitive |
| `gap-2` / `p-6` dominance | 333 / 127 | Rhythm-less, uniform spacing |

---

## 2. The art direction — **READOUT**

*One instrument, two registers, signed by the flip.* This is **not a new theme** — it's a
composition discipline on the tokens you already own.

- **The palette stays the *voice*; a register controls only *density*.** `globals.css`
  already remaps `--font-display` per palette (Libre Baskerville, Playfair, Cormorant,
  Poppins). Do not add a font axis that fights that. Instead:
  - **Terminal register** — dark-native, dense, mono-dominant, hairline-ruled — governs `app/*`.
  - **Editorial register** — paper, generous, display-dominant, wider measure — governs marketing.
  - Both render in whatever `--font-display` the active palette supplies.
- **Dark is the terminal's native surface** (a flow desk's home at 6am), not an afterthought
  toggle. Spec the dark depth ramp first; derive light for Editorial.
- **Colour is a signed quantity with locked, non-overlapping semantics:**
  - `--color-bull` / `--color-bear` = **direction** on live data only.
  - `--heat-mid` **amber** = the **gamma flip / zero-gamma zone** — everywhere it appears and
    *only* there. Never "this text is important."
  - `--color-accent-hot` = the single **live-now cursor** (spot / last tick), one per view.
    *(It's defined in all six named palettes but missing from the default `:root` — fix that.)*
  - Everything else is `--text-secondary` monochrome.
- **Surface:** flat tonal steps (`--bg-main`/`-card`/`-elevated`), zero gradients, zero glow;
  depth via tone + rule; drop-shadow only on true floaters. **Radius 2px max.**
- **Layout:** 12-col grid, 8px baseline, two-tier rhythm (4–8px inside panels, 24–96px between
  zones), lead-and-rail asymmetry. **The strike ladder is the spine**, not a card among cards.

---

## 3. The house style — twelve enforceable laws

A rule a reviewer can grep for is a rule that holds.

| # | Principle | The rule |
|---|---|---|
| P01 | **One border deep** | Only a `<Panel>` draws a border/background; a bordered surface never nests inside another. Leaf tiles are naked content on hairline rules. |
| P02 | **Depth by tone & rule; dark is native** | Spec the dark ramp first. One depth cue per element. Ban `linear-gradient` in chrome and coloured `box-shadow`. |
| P03 | **Colour is a locked signal** | bull/bear = direction; amber = the flip only; accent-hot = the one live cursor. Define `--color-accent-hot` in default `:root`. |
| P04 | **Palette is voice; register is density** | Never touch the palette voice. Register controls density only (Terminal vs Editorial). Both inherit the palette's `--font-display`. |
| P05 | **Numbers are typeset like instruments** | Every live/columnar number → `.zg-metric` (mono, tabular-nums, slashed-zero, right-aligned, fixed decimals). Magnitude by alignment/weight, never a `4xl` bold number in a tint. |
| P06 | **The strike ladder is the spine** | A table-first ladder: strikes as rows; call/put/net-GEX/greeks as ruled columns; walls flagged; flip row banded amber; DTE segmented. Dashboards compose from it. |
| P07 | **Freshness is part of the instrument** | Every data surface carries an as-of stamp and a session state (LIVE/DELAYED/CLOSED/PRE-MARKET/WEEKEND). Stale data greys itself; the live accent lights only when LIVE. |
| P08 | **Design the not-happy-path** | Every data primitive ships loading (ruled skeleton), empty ("no chain for {expiry}"), partial and error variants in the same hairline language. No blank cards, no layout shift. |
| P09 | **One type scale; uppercase is rare** | All text routes through `.zg-*`; one `.zg-label` per section on one tracking value; card titles never uppercase. CI-grep bans raw `font-(semibold\|bold\|black)`, bare `uppercase`, `text-[Npx]`. |
| P10 | **Square by default, three radii** | `--radius-control: 2px`, `--radius-panel: 2px`, `--radius-pill: 999px` (status dots only). Retire `rounded-2xl/xl/3xl`. |
| P11 | **Layout lives in primitives** | All width/rhythm from `<PageShell>/<Section>/<Panel>/<SectionHead>`, each with a stated mobile collapse. Pages never set `container`/`gap`/`margin` directly. |
| P12 | **The craft floor ships once** | Global `:focus-visible` ring, `prefers-reduced-motion` guard, motion tokens, CSS states on `.zg-btn`. Delete JS hover handlers. Motion animates real change only; hover shifts edge, never Y. |

---

## 4. Where the changes live — six layers cascading from one file

| Layer | Now → Target | Files |
|---|---|---|
| **1 · Tokens & primitives** | `.zg-feature-shell` hardcodes the glow+radius recipe; `--color-accent-hot` undefined in default; no radius/spacing/motion/state scale → one file governs dark surface, locked accents, rhythm, state. Add `.zg-panel/.zg-datum/.zg-metric/.zg-mark/.zg-freshness`. | `globals.css` (`.zg-feature-shell` 718–723, type scale 742–873) |
| **2 · Surface & depth** | 16 components carry `1px solid ${'var(--text-secondary)'}` + info-soft glow + 135° wash → flat hairline dark panels; depth is tone + rule; keep only a 3px directional left-rule. | `MetricCard`, `ActionCard`, `GexProfileChart`, `GexWallsChart`, `GexRegimeHeader`, `VolatilityCard`, `CharmVannaFlows`, `ProprietarySignalsSynthesis` |
| **3 · Layout & responsive** | `container mx-auto` ×33, `maxWidth:1200` ×13, `SectionTitle` ×6, `gap-2`/`mb-8` monoculture → four primitives own width/rhythm/heads, each with a mobile collapse; 12-col grid with one dominant element; prose capped 66ch. | new `components/layout/{PageShell,Section,Panel,SectionHead}` + ~30 consumers |
| **4 · Components** | No primitive layer: inline JS-hover buttons, one tinted-pill badge, icon-box at 4 sizes, no freshness → `.zg-btn` family (CSS states, flat accent fill), one `.zg-chip`, a `<Freshness>` primitive, loading/empty/error variants. | `MetricCard`, `AdvancedSignalCard`, `BetaBadge`, `SessionBadge`, `Header`, `ThemeDropdown`, `Navigation`; new `{Freshness,StrikeLadder}` |
| **5 · Data & charts** | 6/6 charts use the Recharts default dashed grid; strike table has tabular-nums on one column; regime is pastel pills → a `StrikeLadder` spine + `TerminalGrid` built around the flip (weighted zero baseline, amber flip band, signed bull/bear areas, spot cursor); regime → annunciator strip. | new `{StrikeLadder,TerminalGrid}`; `GexProfileChart`, `GexWallsChart`, `SignalEventsPanel`, `VolSurfaceChart`, `FlipTermStructureChart`, `GexRegimeHeader` |
| **6 · Marketing & brand** | Gradient-clip headlines on 6+ pages, tinted-icon chip everywhere, generic lucide glyphs, emoji in "institutional" copy, live curve demoted to a thumbnail → full-bleed `GammaProfileHero` from real data as the hero; the crosshair deployed as the **flip crosshair**; ink-on-amber reserved for the flip; paper Editorial register. | `app/LandingClient`, `app/about`, `app/pricing`; new `marketing/{GammaProfileHero,Frame}`; `assets/branding/Target.svg` |

---

## 5. Roadmap — five phases ordered by leverage

1. **Foundation — dark-native tokens & primitives in `globals.css`.** *(Medium; 1 file.)*
   Nothing looks different yet, but the accent/dark/register facts become correct and every
   later change is a class swap, not a redesign.
2. **Rewrite the shared primitives.** *(Deep.)* MetricCard → `.zg-panel`; build the `.zg-btn`
   family and delete JS hover; ship `<Freshness>` and loading/empty/error. The decorated-box
   recipe and gradient-glow CTA vanish from every page at once — the biggest visible shift.
3. **Layout primitives + responsive.** *(Deep.)* Build the four primitives; migrate the 33
   shells; convert auto-fit walls to a 12-col grid with a dominant element; implement each
   primitive's mobile collapse. "One border deep" and real rhythm become enforced.
4. **Art-direct the instrument.** *(Deep.)* Build the StrikeLadder spine; rebuild all six
   charts on TerminalGrid; wire session state end-to-end; regime → annunciator. It starts
   reading like a gamma desk, honest even when the market is closed.
5. **Editorial register on marketing.** *(Deep.)* GammaProfileHero as the landing hero; the
   crosshair as the flip marker; kill gradient-clip headlines; paper register with palette
   display type. The first thing a prospect sees carries the terminal's voice.

---

## 6. Quick wins — each names a file and a line

- **`globals.css` `.zg-feature-shell` (718–723):** delete `border-radius:1rem` and the
  `box-shadow … --color-info-soft` glow → flat `--bg-card` + a hairline. **Cascades site-wide.**
- **16-file find-replace:** `1px solid ${'var(--text-secondary)'}` → `1px solid var(--border-default)`.
  Kills the text-as-border *and* the `${'...'}` generation artifact in one pass.
- **`MetricCard.tsx` (52–53):** `text-2xl … font-bold` → `zg-metric`; remove the `boxShadow`
  block at 33–35.
- **default `:root`:** add the missing `--color-accent-hot` (present in all six named palettes).
- **App layout:** default the terminal to the **dark register** — reframes the whole product
  as instrument-native in one change.
- **`GexProfileChart.tsx` (743):** `fill:'#06B6D4'` → `var(--color-hazy)` so the Spot label re-themes.
- **`globals.css`:** ship the global `:focus-visible` ring + `prefers-reduced-motion` guard.
- **`pricing/Client.tsx` (407, 789):** replace `🎉` / `★ Limited Time ★` with bracketed mono
  tags; drop the count-up on constant landing stats.

---

## 7. Signature moves — where the brand and the data become one gesture

The distinctive device is never decoration; it's a functional readout of the **gamma flip**.

- **S1 — The crosshair reads the flip.** The owned `Target.svg` becomes the flip crosshair:
  vertical arm on the flip price, horizontal on zero-gamma, with a live readout of spot's %
  distance to flip.
- **S2 — The register flips at the flip.** When spot crosses the flip price the masthead
  inverts polarity: long-gamma "dealers dampen" (cool) ⇄ short-gamma "dealers accelerate"
  (hot). The product's most important state change, encoded in the chrome.
- **S3 — Amber means the flip.** Ink-on-amber appears on the chart flip band, the readout-rail
  flip cell and the crossing strike row — the same amber every time.
- **S4 — The desk-language rail.** A persistent strip: signed NET GEX + regime word, largest
  call/put walls, flip price and spot's distance to it, session state + as-of stamp — mono
  tabular, live accent lit only when LIVE.
- **S5 — Oversized mono hero figure.** Net GEX / Gamma Flip flush-left in JetBrains Mono at
  `clamp(48px,5vw,72px)`, sign by bull/bear, unit as a mono superscript.
- **S6 — The strike ladder as spine.** A dense instrument silhouette no card kit emits, which
  the dashboards and the marketing hero both derive from.

---

## 8. How we'll know it worked

- **Recipe count → zero.** Grep for `rounded-2xl` on data surfaces, `linear-gradient(135deg`,
  and `box-shadow` with `--color-info-soft` returns ~0 hits in `components/`.
- **Accent semantics hold.** Amber only on flip surfaces; bull/bear only on directional data;
  one live cursor per view; default root defines `--color-accent-hot`.
- **The instrument is real, not skinned.** The strike ladder is the dashboard spine with
  tabular greek columns and an amber flip row; the DTE selector works; charts show a weighted
  zero baseline with signed areas, not a `"3 3"` dashed default.
- **Dark is native and freshness is honest.** The app opens dark; every data panel shows an
  as-of stamp and a real session state; a weekend screenshot reads "last session" with no
  fake-live pulse.
- **The not-happy-path is designed.** Loading, empty and error render in the same hairline
  language — no blank cards, no layout shift.
- **Hierarchy reads before the words do.** The primary read is unambiguously dominant; the
  page opens with one masthead; the dense layout survives a 375px viewport.

---

*Method: diagnosis grounded in the live codebase; strategy synthesised from seven expert
design critiques and three competing art directions, adversarially pressure-tested
(genericness 19/100).*
