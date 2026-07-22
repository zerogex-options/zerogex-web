/**
 * Central metadata for every education article + landing page that needs
 * SEO/structured-data treatment. Single source of truth for:
 *   - <ArticleJsonLd /> (schema.org Article structured data)
 *   - <RelatedArticles /> (the "Related reading" block on each post)
 *   - opengraph-image route handlers (per-page OG images)
 *
 * Dates match the publish dates surfaced on /articles. Keep this list in
 * sync when a new post lands; nothing breaks if a slug is missing, but
 * the JSON-LD will fall back to site defaults and the related block
 * won't render until the entry is added.
 */
export type ArticleKind = 'pillar' | 'tier1' | 'tier2' | 'article' | 'landing';

export type ArticleMeta = {
  slug: string;
  href: string;
  title: string;
  blurb: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  readMinutes: number;
  kind: ArticleKind;
};

export const SITE_URL = 'https://zerogex.io';
export const SITE_NAME = 'ZeroGEX';
export const SITE_DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

// One-line brand description reused by the Organization JSON-LD node. Kept
// separate from the per-page SITE_DESCRIPTION so the entity description stays
// stable even if a page-level meta description is tuned.
export const SITE_ORG_DESCRIPTION =
  'ZeroGEX is an options analytics platform for real-time gamma exposure (GEX), dealer positioning, gamma walls, and live options flow — with free delayed SPX, SPY, and QQQ gamma levels.';

// Support/contact address surfaced in Organization structured data.
export const SITE_CONTACT_EMAIL = 'support@zerogex.io';

// Canonical brand profile URLs for schema.org `sameAs` — used for Organization
// entity reconciliation (knowledge panel, brand SERP, answer engines). These
// mirror the social profiles linked in components/Footer.tsx; keep the two in
// sync when a profile is added or changed.
export const SITE_SAME_AS = [
  'https://x.com/ZeroGEXOptions',
  'https://www.youtube.com/@ZeroGEX',
  'https://www.reddit.com/user/LopsidedComparison26',
];

export const ARTICLE_REGISTRY: Record<string, ArticleMeta> = {
  'announcing-folds-of-honor-pledge': {
    slug: 'announcing-folds-of-honor-pledge',
    href: '/education/announcing-folds-of-honor-pledge',
    title: 'Announcing Our 3% Pledge to Folds of Honor',
    blurb:
      'Starting today, ZeroGEX donates 3% of every subscription to Folds of Honor — funding educational scholarships for the families of fallen and disabled U.S. service members. The mechanics, the math, and why.',
    description:
      'ZeroGEX is donating 3% of every subscription to Folds of Honor — quarterly donations, gross-revenue basis, full transparency. Mechanics, math, and the why behind the partner choice.',
    datePublished: '2026-06-24',
    readMinutes: 4,
    kind: 'article',
  },
  'net-volume-vs-directional-flow': {
    slug: 'net-volume-vs-directional-flow',
    href: '/education/net-volume-vs-directional-flow',
    title: 'Net Volume vs Directional Flow: What Matters in Options Tape?',
    blurb:
      'Why raw contract counts can mislead, when directional volume adds signal, and why premium-weighted flow is often the strongest conviction metric on pro desks.',
    description:
      'Net volume vs directional flow explained — why raw contract counts can mislead, when directional volume adds signal, and why premium-weighted flow leads.',
    datePublished: '2026-04-16',
    readMinutes: 11,
    kind: 'article',
  },
  'eod-pressure-and-trap-detection': {
    slug: 'eod-pressure-and-trap-detection',
    href: '/education/eod-pressure-and-trap-detection',
    title: 'Trading the Close: EOD Pressure and Trap Detection',
    blurb:
      'A technical deep-dive on two ZeroGEX Advanced Signals — charm-driven end-of-day drift and the failed-breakout mechanics that snap price back when dealers absorb moves.',
    description:
      'How EOD Pressure and Trap Detection read dealer hedging in real time — charm-driven drift into the close and failed-breakout fades.',
    datePublished: '2026-05-12',
    readMinutes: 14,
    kind: 'article',
  },
  'squeeze-setup-positioning-trap-and-trap-detection': {
    slug: 'squeeze-setup-positioning-trap-and-trap-detection',
    href: '/education/squeeze-setup-positioning-trap-and-trap-detection',
    title: 'Squeeze Setup, Positioning Trap & Trap Detection',
    blurb:
      'Three ZeroGEX Advanced Signals that look almost identical — same number line, same pivots — but answer entirely different questions about the tape.',
    description:
      'Squeeze Setup, Positioning Trap, and Trap Detection — three ZeroGEX Advanced Signals with the same number line answering entirely different questions.',
    datePublished: '2026-05-13',
    readMinutes: 6,
    kind: 'article',
  },
  'how-to-read-a-gamma-flip': {
    slug: 'how-to-read-a-gamma-flip',
    href: '/education/how-to-read-a-gamma-flip',
    title: 'How to Read a Gamma Flip (Gamma Flip Explained)',
    blurb:
      'The practical intraday read on the gamma flip — what changes above versus below, how dealer hedging behavior shifts, and how to use it as a filter.',
    description:
      'How to read a gamma flip intraday — what the flip level is, what changes above vs below, and how dealer hedging behavior shifts. Gamma flip explained for SPX traders.',
    datePublished: '2026-06-11',
    readMinutes: 8,
    kind: 'tier1',
  },
  'gamma-walls-explained': {
    slug: 'gamma-walls-explained',
    href: '/education/gamma-walls-explained',
    title: 'Gamma Walls Explained: Call Wall and Put Wall',
    blurb:
      'What gamma walls actually are, why price tends to react at the call wall and put wall, how the walls migrate, and when they hold versus break.',
    description:
      'Gamma walls explained — what call walls and put walls are, why price reacts at them, how they shift intraday, and when they hold versus break. Practical SPX trader guide.',
    datePublished: '2026-06-11',
    readMinutes: 9,
    kind: 'tier1',
  },
  '0dte-dealer-positioning-explained': {
    slug: '0dte-dealer-positioning-explained',
    href: '/education/0dte-dealer-positioning-explained',
    title: '0DTE Dealer Positioning Explained (Dealer Gamma 0DTE)',
    blurb:
      'Why same-day expiries dominate the intraday dealer book, how positive/negative gamma regimes change the tape for 0DTE, and how to read SPX 0DTE flow.',
    description:
      '0DTE dealer positioning explained — why dealer gamma matters most for same-day expiries, how negative vs positive gamma regimes change the tape, and how to read SPX 0DTE flow.',
    datePublished: '2026-06-11',
    readMinutes: 9,
    kind: 'tier1',
  },
  'gamma-exposure-explained': {
    slug: 'gamma-exposure-explained',
    href: '/education/gamma-exposure-explained',
    title: 'Gamma Exposure (GEX) Explained: The Complete Guide',
    blurb:
      'The comprehensive read on gamma exposure — what GEX is, how dealer gamma is calculated, why regimes differ, and how the gamma flip and walls structure the tape.',
    description:
      'Gamma exposure explained from the ground up — what GEX is, how dealer gamma is calculated, what positive and negative regimes mean, and how to use it intraday.',
    datePublished: '2026-06-11',
    readMinutes: 16,
    kind: 'pillar',
  },
  'max-pain-explained': {
    slug: 'max-pain-explained',
    href: '/education/max-pain-explained',
    title: 'Max Pain Explained — and Does It Actually Work?',
    blurb:
      'The honest version of the max pain question — what it is, the theory, the evidence on whether it moves price, and why gamma is usually the real mechanism.',
    description:
      'Max pain explained honestly — what it is, the theory, and the evidence on whether it actually moves price. Does max pain work? A balanced read.',
    datePublished: '2026-06-11',
    readMinutes: 13,
    kind: 'tier2',
  },
  'vanna-and-charm-explained': {
    slug: 'vanna-and-charm-explained',
    href: '/education/vanna-and-charm-explained',
    title: 'Vanna and Charm Explained for Options Traders',
    blurb:
      'What vanna and charm are, why they drive dealer hedging flows, how vanna produces the vol-compression grind, and how charm shapes the into-close flow.',
    description:
      'Vanna and charm explained — what each Greek is, why they drive dealer hedging flows, how vanna creates the vol-compression grind, and how charm shapes the close.',
    datePublished: '2026-06-11',
    readMinutes: 14,
    kind: 'tier2',
  },
  'best-gex-tools': {
    slug: 'best-gex-tools',
    href: '/education/best-gex-tools',
    title: 'Best Gamma Exposure (GEX) Tools: A Fair Comparison',
    blurb:
      'A balanced comparison of GEX tools and gamma exposure trackers — real-time vs delayed, 0DTE coverage, methodology, signal quality, and price.',
    description:
      'Best GEX tools and gamma exposure trackers compared fairly — what matters in a GEX tool, real-time vs delayed, 0DTE coverage, methodology, signals, and price.',
    datePublished: '2026-06-11',
    readMinutes: 11,
    kind: 'article',
  },
  'real-time-gex-0dte': {
    slug: 'real-time-gex-0dte',
    href: '/real-time-gex-0dte',
    title: 'Real-Time 0DTE GEX: SPX / SPY / QQQ Gamma Flip, Call Walls & Dealer Positioning',
    blurb:
      'Live gamma flip, call and put walls, dealer positioning, and composite signals — built for SPX/0DTE intraday flow. Free dashboard, no signup required.',
    description:
      'Real-time 0DTE GEX for SPX, SPY and QQQ — live gamma flip, call and put walls, dealer positioning, and a 13-signal composite built for intraday 0DTE flow. Free dashboard, no signup required.',
    datePublished: '2026-06-11',
    readMinutes: 0,
    kind: 'landing',
  },
  'squeeze-setup-explained': {
    slug: 'squeeze-setup-explained',
    href: '/education/squeeze-setup-explained',
    title: 'Squeeze Setup Signal Explained: Reading Coiled Markets',
    blurb:
      'The practical deep-dive on the Squeeze Setup signal — what it asks, the five inputs that drive the score, when it triggers, and how to use it as a precondition filter for directional breakouts.',
    description:
      'Squeeze Setup signal explained — what it asks, the five headline inputs, how the score triggers, and how to use it to identify markets coiled for a directional move.',
    datePublished: '2026-06-12',
    readMinutes: 10,
    kind: 'tier2',
  },
  'positioning-trap-explained': {
    slug: 'positioning-trap-explained',
    href: '/education/positioning-trap-explained',
    title: 'Positioning Trap Signal Explained: Fading the Crowd',
    blurb:
      'What the Positioning Trap signal measures, why crowded options trades break, how the score is built from PCR + smart-money imbalance + regime, and how to fade the crowd at the right moment.',
    description:
      'Positioning Trap signal explained — what it measures, how the score is built, why crowded options trades break, and how to fade the crowd instead of being trapped.',
    datePublished: '2026-06-12',
    readMinutes: 9,
    kind: 'tier2',
  },
  'eod-pressure-explained': {
    slug: 'eod-pressure-explained',
    href: '/education/eod-pressure-explained',
    title: 'EOD Pressure Signal Explained: Reading the Close',
    blurb:
      'The trader-facing read on the EOD Pressure signal — how charm decay and pin gravity combine into a directional drift estimator for the final 90 minutes of the cash session.',
    description:
      'EOD Pressure signal explained — how charm decay and pin gravity drive forced hedging into the close, how the score is built, and how to read it in the final 90 minutes.',
    datePublished: '2026-06-12',
    readMinutes: 11,
    kind: 'tier2',
  },
  'why-do-breakouts-fail': {
    slug: 'why-do-breakouts-fail',
    href: '/education/why-do-breakouts-fail',
    title: 'Why Do Breakouts Fail? The Structural Reason Behind Failed Breakouts',
    blurb:
      'Failed breakouts aren\'t random. They\'re driven by dealer hedging at concentrated strikes, regime conditions, and three structural variables that predict the fail before you chase.',
    description:
      'Why do breakouts fail in SPY and SPX? The structural reason behind failed breakouts — dealer hedging, gamma regime, and the three conditions that predict the trap.',
    datePublished: '2026-06-15',
    readMinutes: 10,
    kind: 'tier1',
  },
  'why-spy-reverses-at-levels': {
    slug: 'why-spy-reverses-at-levels',
    href: '/education/why-spy-reverses-at-levels',
    title: 'Why Does SPY Reverse at Certain Levels?',
    blurb:
      'SPY reversals that look random on the chart are tied to options positioning. Here\'s the four kinds of options-based levels SPY actually reverses at, and how to read them in real time.',
    description:
      'Why does SPY reverse at certain levels? The hidden options-positioning map — call walls, put walls, gamma magnet, and the gamma flip — that drives most "random" reversals.',
    datePublished: '2026-06-15',
    readMinutes: 10,
    kind: 'tier1',
  },
  'options-support-and-resistance': {
    slug: 'options-support-and-resistance',
    href: '/education/options-support-and-resistance',
    title: 'How to Identify Support and Resistance from Options Positioning',
    blurb:
      'Options-based support and resistance is mechanics, not psychology. The four kinds of options-based levels, why they\'re sturdier than chart-based S/R, and how to identify them in real time.',
    description:
      'How to identify support and resistance from options positioning — call walls, put walls, gamma magnet, gamma flip. The structural map most chart S/R misses.',
    datePublished: '2026-06-15',
    readMinutes: 11,
    kind: 'tier1',
  },
  'how-to-avoid-chasing-0dte': {
    slug: 'how-to-avoid-chasing-0dte',
    href: '/education/how-to-avoid-chasing-0dte',
    title: 'How to Avoid Chasing 0DTE Moves',
    blurb:
      'The 0DTE chase is the most expensive bad habit in retail trading. Three signs you\'re about to make the mistake, the structural read that overrides the instinct, and the conditions when the momentum is actually real.',
    description:
      'How to avoid chasing 0DTE moves — why same-day chases are structurally dangerous, three signs you\'re about to chase, and the regime read that tells you when to stand down.',
    datePublished: '2026-06-15',
    readMinutes: 11,
    kind: 'tier1',
  },
  'how-to-know-if-spy-is-pinned': {
    slug: 'how-to-know-if-spy-is-pinned',
    href: '/education/how-to-know-if-spy-is-pinned',
    title: 'How to Know If SPY Is Pinned: The Five Signs',
    blurb:
      'Pin recognition is the cleanest day-trade filter. The five structural signs SPY is pinned today, the playbook that works in a pinned tape (fade extremes, skip middle), and when the pin breaks.',
    description:
      'How to know if SPY is pinned today — the five structural signs, the fade-extremes playbook that works in a pinned tape, and the conditions that break the pin.',
    datePublished: '2026-06-15',
    readMinutes: 10,
    kind: 'tier1',
  },
  'what-is-negative-gamma': {
    slug: 'what-is-negative-gamma',
    href: '/education/what-is-negative-gamma',
    title: 'What Does Negative Gamma Mean? A Plain-English Explainer',
    blurb:
      'Negative gamma means dealer hedging amplifies moves instead of dampening them. What the term actually refers to, how to spot a negative-gamma regime in real time, and what changes in your trading.',
    description:
      'What does negative gamma mean? Plain-English explainer — dealers amplify moves, volatility expands, breakouts extend. How to spot a negative-gamma regime in real time.',
    datePublished: '2026-06-15',
    readMinutes: 10,
    kind: 'tier1',
  },
  'why-spy-pins-near-strikes': {
    slug: 'why-spy-pins-near-strikes',
    href: '/education/why-spy-pins-near-strikes',
    title: 'Why Does SPY Pin Near a Strike? Options Pinning Explained',
    blurb:
      'Options pinning isn\'t superstition — it\'s dealer hedging at heavy gamma strikes mechanically pulling price toward the strike. The mechanism, why it intensifies near expiry, and when the pin holds vs. breaks.',
    description:
      'Why does SPY pin near a strike? Options pinning explained — the dealer-hedging mechanism, why it\'s strongest on OPEX and end-of-day, and when the pin holds vs. breaks.',
    datePublished: '2026-06-15',
    readMinutes: 11,
    kind: 'tier1',
  },
  'how-to-trade-around-gamma-flip': {
    slug: 'how-to-trade-around-gamma-flip',
    href: '/education/how-to-trade-around-gamma-flip',
    title: 'How to Trade Around Gamma Flip Levels',
    blurb:
      'The gamma flip is a playbook switch, not a price level. Three setups each regime supports, the workflow for using the flip as a playbook signal, and what to do when spot crosses.',
    description:
      'How to trade around gamma flip levels — what changes when spot crosses, the three setup types each regime supports, and the workflow for using the flip as a playbook switch.',
    datePublished: '2026-06-15',
    readMinutes: 10,
    kind: 'tier1',
  },
  'spy-vs-spx-gamma-levels': {
    slug: 'spy-vs-spx-gamma-levels',
    href: '/education/spy-vs-spx-gamma-levels',
    title: 'SPY vs SPX Options: Which Gamma Levels Matter?',
    blurb:
      'SPY and SPX track the same index through two separate dealer gamma books. How their gamma levels differ, how to translate a level with the ~10x ratio, which book carries more weight, and why the level that matters most is the one where they agree.',
    description:
      'SPY vs SPX options — which gamma levels matter? How the two dealer gamma books differ, translating levels with the ~10x ratio, which carries more weight, and why confluence between SPX and SPY is the strongest signal.',
    datePublished: '2026-07-06',
    readMinutes: 9,
    kind: 'tier1',
  },
  'what-is-a-put-wall': {
    slug: 'what-is-a-put-wall',
    href: '/education/what-is-a-put-wall',
    title: 'What Is a Put Wall? How Options Traders Use Put Walls as Dealer Support',
    blurb:
      'The put wall is the strike where put-side dealer gamma piles up — usually the sturdiest dealer-hedged support on the board. What it is, why price reacts there, how it migrates intraday, when it holds versus breaks, and how to find today’s SPX, SPY, and QQQ put walls.',
    description:
      'What is a put wall? The strike where put gamma concentrates and dealer hedging defends the downside — why it acts as support, how it shifts intraday, and when it breaks. See today’s SPX / SPY / QQQ put walls.',
    datePublished: '2026-07-07',
    readMinutes: 8,
    kind: 'tier1',
  },
  'what-is-a-call-wall': {
    slug: 'what-is-a-call-wall',
    href: '/education/what-is-a-call-wall',
    title: 'What Is a Call Wall? How Dealers Defend the Upside in Options',
    blurb:
      'The call wall is the strike where call-side dealer gamma concentrates — the level dealers defend on the way up. What it is, why it caps rallies in long gamma, how it migrates, when a break signals a regime change, and where to see today’s live SPX, SPY, and QQQ call walls.',
    description:
      'What is a call wall? The strike where call gamma concentrates and dealers defend the upside — why it acts as resistance, how it migrates, and when price breaks through. See today’s SPX / SPY / QQQ call walls.',
    datePublished: '2026-07-07',
    readMinutes: 8,
    kind: 'tier1',
  },
  'what-is-gex-in-trading': {
    slug: 'what-is-gex-in-trading',
    href: '/education/what-is-gex-in-trading',
    title: 'What Is GEX in Trading? Gamma Exposure Explained Simply',
    blurb:
      'GEX — gamma exposure — is the one number that explains why some days pin and others trend. A plain-English, beginner-first explainer: what GEX measures, how dealer gamma moves the tape, and what positive versus negative regimes mean for your trading.',
    description:
      'What is GEX in trading? Gamma exposure explained simply — what GEX measures, why dealer gamma moves markets, and how to read positive vs negative regimes. A beginner’s guide with today’s live levels.',
    datePublished: '2026-07-07',
    readMinutes: 7,
    kind: 'tier1',
  },
  'spx-net-gamma-exposure-today': {
    slug: 'spx-net-gamma-exposure-today',
    href: '/education/spx-net-gamma-exposure-today',
    title: 'SPX Net Gamma Exposure Today: How to Read Current Net GEX',
    blurb:
      '“What’s the current SPX net gamma exposure?” The answer changes every session. What net GEX is, how to read a positive versus negative reading, where the gamma-flip zero-cross sits, and how to pull up today’s live SPX net GEX in one click.',
    description:
      'SPX net gamma exposure today — what current net GEX means, how to read a positive vs negative reading, where the zero-cross (gamma flip) sits, and how to see the live SPX net GEX value now.',
    datePublished: '2026-07-07',
    readMinutes: 9,
    kind: 'tier1',
  },
  'why-market-makers-trade-stock': {
    slug: 'why-market-makers-trade-stock',
    href: '/education/why-market-makers-trade-stock',
    title: 'Why Market Makers Are Forced to Trade Stock',
    blurb:
      'Dealers don’t trade stock because they have a view — they trade it because the delta of the options they hold keeps moving on its own, and every move mechanically forces a hedge. The foundation of forced dealer flow.',
    description:
      'Why market makers are forced to trade stock — delta-hedging, why the option book’s delta never sits still, and how spot, time, and vol force compelled dealer flow with no view attached.',
    datePublished: '2026-07-12',
    readMinutes: 8,
    kind: 'tier1',
  },
  'delta-and-its-three-children': {
    slug: 'delta-and-its-three-children',
    href: '/education/delta-and-its-three-children',
    title: 'Delta and Its Three Children: Gamma, Charm, and Vanna',
    blurb:
      'Delta tells a dealer how much stock to hold, but it never sits still. Intraday, its three dominant drivers are price, time, and volatility. Those sensitivities are gamma, charm, and vanna, and together they help shape Forced Flow.',
    description:
      'Delta and its three children — gamma (delta vs price), charm (delta vs time), and vanna (delta vs vol). Why a dealer hedges the change in delta, and why you reprice the book instead of summing the greeks.',
    datePublished: '2026-07-12',
    readMinutes: 7,
    kind: 'tier2',
  },
  'charm-the-clock-is-a-trader': {
    slug: 'charm-the-clock-is-a-trader',
    href: '/education/charm-the-clock-is-a-trader',
    title: 'Charm: The Clock Is a Trader',
    blurb:
      'Charm is the rate an option’s delta changes as time passes. It forces dealers to trade stock on a dead-flat tape — and because the clock is perfectly predictable, it’s the rare dealer flow you can forecast hours before it prints.',
    description:
      'Charm explained — how time decay alone forces dealer hedging into the close, why the flow accelerates in the final hour, and why charm is a forecast with a deadline you can compute at the open.',
    datePublished: '2026-07-12',
    readMinutes: 8,
    kind: 'tier2',
  },
  'vanna-when-fear-fades': {
    slug: 'vanna-when-fear-fades',
    href: '/education/vanna-when-fear-fades',
    title: 'Vanna: When Fear Fades, Dealers Buy',
    blurb:
      'Vanna is the rate an option’s delta changes when implied vol changes. When priced fear drains out after an event that never delivered, vanna forces dealers into a steady bid — the “up on no news” grind that hides in the slope, not the volume.',
    description:
      'Vanna explained — why a falling IV print forces dealers to buy stock, how the vol-compression grind works, and why the flow shows up in price drift but never in the volume bars.',
    datePublished: '2026-07-12',
    readMinutes: 8,
    kind: 'tier2',
  },
  'why-we-dont-publish-dex': {
    slug: 'why-we-dont-publish-dex',
    href: '/education/why-we-dont-publish-dex',
    title: 'Why We Don’t Publish DEX',
    blurb:
      'Delta Exposure looks like the natural sibling of gamma exposure. We refuse to publish it: it measures the one greek dealers have already hedged to zero, weights the dirtiest strikes in the chain, and is loudest exactly where forced flow is weakest.',
    description:
      'Why we don’t publish DEX (delta exposure = ΣΔ·OI) — dealers hedge delta flat with stock, delta’s weight sits in the illiquid deep-ITM wings, and DEX is loudest where forced flow is weakest. What we publish instead: Forced Flow.',
    datePublished: '2026-07-12',
    readMinutes: 9,
    kind: 'article',
  },
};

/**
 * Editorial mapping of slug → 3 related slugs. Manually curated for topical
 * coherence (the GEX pillar links to the tier-1 trio; max-pain links to
 * the pillar + gamma walls + flip; etc.). When a new article lands, add
 * an entry here and a few entries pointing to it.
 */
const RELATED_BY_SLUG: Record<string, string[]> = {
  'gamma-exposure-explained': [
    'how-to-read-a-gamma-flip',
    'gamma-walls-explained',
    'what-is-gex-in-trading',
  ],
  'how-to-read-a-gamma-flip': [
    'gamma-exposure-explained',
    'gamma-walls-explained',
    'spx-net-gamma-exposure-today',
  ],
  'gamma-walls-explained': [
    'gamma-exposure-explained',
    'what-is-a-put-wall',
    'what-is-a-call-wall',
  ],
  '0dte-dealer-positioning-explained': [
    'gamma-exposure-explained',
    'vanna-and-charm-explained',
    'charm-the-clock-is-a-trader',
  ],
  'max-pain-explained': [
    'gamma-exposure-explained',
    'gamma-walls-explained',
    'how-to-read-a-gamma-flip',
  ],
  'vanna-and-charm-explained': [
    'charm-the-clock-is-a-trader',
    'vanna-when-fear-fades',
    'why-we-dont-publish-dex',
  ],
  'best-gex-tools': [
    'gamma-exposure-explained',
    '0dte-dealer-positioning-explained',
    'how-to-read-a-gamma-flip',
  ],
  'eod-pressure-and-trap-detection': [
    'eod-pressure-explained',
    'vanna-and-charm-explained',
    'squeeze-setup-positioning-trap-and-trap-detection',
  ],
  'net-volume-vs-directional-flow': [
    'gamma-exposure-explained',
    'how-to-read-a-gamma-flip',
    '0dte-dealer-positioning-explained',
  ],
  'squeeze-setup-positioning-trap-and-trap-detection': [
    'squeeze-setup-explained',
    'positioning-trap-explained',
    'eod-pressure-explained',
  ],
  'squeeze-setup-explained': [
    'positioning-trap-explained',
    'eod-pressure-explained',
    'gamma-exposure-explained',
  ],
  'positioning-trap-explained': [
    'squeeze-setup-explained',
    'gamma-exposure-explained',
    'how-to-read-a-gamma-flip',
  ],
  'eod-pressure-explained': [
    'vanna-and-charm-explained',
    'squeeze-setup-explained',
    'eod-pressure-and-trap-detection',
  ],
  'why-do-breakouts-fail': [
    'gamma-walls-explained',
    'how-to-read-a-gamma-flip',
    'eod-pressure-and-trap-detection',
  ],
  'why-spy-reverses-at-levels': [
    'gamma-walls-explained',
    'options-support-and-resistance',
    'how-to-read-a-gamma-flip',
  ],
  'options-support-and-resistance': [
    'gamma-walls-explained',
    'what-is-a-put-wall',
    'why-spy-reverses-at-levels',
  ],
  'how-to-avoid-chasing-0dte': [
    '0dte-dealer-positioning-explained',
    'how-to-trade-around-gamma-flip',
    'eod-pressure-explained',
  ],
  'how-to-know-if-spy-is-pinned': [
    'why-spy-pins-near-strikes',
    'max-pain-explained',
    'eod-pressure-explained',
  ],
  'what-is-negative-gamma': [
    'gamma-exposure-explained',
    'how-to-read-a-gamma-flip',
    'spx-net-gamma-exposure-today',
  ],
  'why-spy-pins-near-strikes': [
    'how-to-know-if-spy-is-pinned',
    'max-pain-explained',
    'eod-pressure-explained',
  ],
  'how-to-trade-around-gamma-flip': [
    'how-to-read-a-gamma-flip',
    'what-is-negative-gamma',
    'gamma-exposure-explained',
  ],
  'spy-vs-spx-gamma-levels': [
    'gamma-walls-explained',
    'options-support-and-resistance',
    'how-to-read-a-gamma-flip',
  ],
  'what-is-a-put-wall': [
    'gamma-walls-explained',
    'what-is-a-call-wall',
    'options-support-and-resistance',
  ],
  'what-is-a-call-wall': [
    'gamma-walls-explained',
    'what-is-a-put-wall',
    'how-to-read-a-gamma-flip',
  ],
  'what-is-gex-in-trading': [
    'gamma-exposure-explained',
    'how-to-read-a-gamma-flip',
    'gamma-walls-explained',
  ],
  'spx-net-gamma-exposure-today': [
    'gamma-exposure-explained',
    'how-to-read-a-gamma-flip',
    'what-is-negative-gamma',
  ],
  'why-market-makers-trade-stock': [
    'delta-and-its-three-children',
    'why-we-dont-publish-dex',
    'vanna-and-charm-explained',
  ],
  'delta-and-its-three-children': [
    'why-market-makers-trade-stock',
    'charm-the-clock-is-a-trader',
    'vanna-when-fear-fades',
  ],
  'charm-the-clock-is-a-trader': [
    'vanna-when-fear-fades',
    'delta-and-its-three-children',
    'eod-pressure-explained',
  ],
  'vanna-when-fear-fades': [
    'charm-the-clock-is-a-trader',
    'delta-and-its-three-children',
    'vanna-and-charm-explained',
  ],
  'why-we-dont-publish-dex': [
    'why-market-makers-trade-stock',
    'delta-and-its-three-children',
    'gamma-exposure-explained',
  ],
};

export function getArticle(slug: string): ArticleMeta | null {
  return ARTICLE_REGISTRY[slug] ?? null;
}

/**
 * Returns the `metadata` object a registered article page should export —
 * title, description, and self-referencing canonical, all pulled from the
 * registry so the page's <title> tag and the ArticleJsonLd structured-data
 * payload can never drift apart. Throws if the slug isn't registered so
 * missed entries surface at build time rather than silently shipping a
 * blank metadata block.
 */
export function articleMetadata(slug: string) {
  const article = ARTICLE_REGISTRY[slug];
  if (!article) {
    throw new Error(`articleMetadata: unknown slug "${slug}"`);
  }
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: article.href },
  };
}

export function getRelatedArticles(slug: string): ArticleMeta[] {
  const related = RELATED_BY_SLUG[slug];
  if (!related) return [];
  return related
    .map((s) => ARTICLE_REGISTRY[s])
    .filter((a): a is ArticleMeta => Boolean(a));
}
