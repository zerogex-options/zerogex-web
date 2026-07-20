/**
 * Per-article FAQ content — the single source for both the visible
 * "Frequently asked questions" block (<ArticleFaq />) and the FAQPage
 * structured data mirrored from it, so the two can never drift.
 *
 * Answers are deliberately plain-English and self-contained: each one stands
 * alone as a quotable definition for a question-style search or an AI Overview
 * ("what is a put wall", "what does negative gamma mean"). The wording matches
 * the hedged, mechanism-first tone of the articles themselves — describing what
 * dealer positioning *tends* to do, never giving trade advice or predictions.
 *
 * Google requires FAQ answers to be visible on the page, which <ArticleFaq />
 * guarantees by rendering these same strings. Only slugs with an entry here
 * get a FAQ block; everything else renders nothing.
 */
export type FaqItem = { q: string; a: string };

export const ARTICLE_FAQ: Record<string, FaqItem[]> = {
  'what-is-a-put-wall': [
    {
      q: 'What is a put wall?',
      a: 'The put wall is the strike below the current price that carries the heaviest concentration of put-side dealer gamma on the options chain. It is the level where dealer hedging is most likely to defend the downside, which is why traders treat it as the structural floor of the current positioning range.',
    },
    {
      q: 'Why does the put wall act as support?',
      a: 'In a positive-gamma regime, the dealers who are short the heavy puts at that strike have to buy the underlying as price falls toward it to stay delta-neutral. That mechanical buying tends to slow or stall declines near the put wall.',
    },
    {
      q: 'Does the put wall always hold?',
      a: 'No. It is a probability zone, not a guarantee. If price breaks below it, especially in a negative-gamma regime, the same hedging can flip to selling and accelerate the move lower.',
    },
    {
      q: 'How is the put wall different from the call wall?',
      a: 'The put wall is the densest put-gamma strike below spot and tends to support price; the call wall is the densest call-gamma strike above spot and tends to cap it. Together they bracket the range dealer hedging tends to defend.',
    },
  ],
  'what-is-a-call-wall': [
    {
      q: 'What is a call wall?',
      a: 'The call wall is the strike above the current price with the heaviest concentration of call-side dealer gamma. It is the level dealer hedging tends to defend on the way up, often acting as resistance or an upside magnet.',
    },
    {
      q: 'Why does price stall at the call wall?',
      a: 'In a positive-gamma regime, dealers short the heavy calls at that strike sell the underlying as price rises toward it to stay hedged. That selling tends to cap rallies near the call wall.',
    },
    {
      q: 'What happens if the call wall breaks?',
      a: 'A clean break above the call wall can signal a positioning or regime change. The hedging that capped the move can reverse into buying, which sometimes fuels an extension higher.',
    },
  ],
  'what-is-gex-in-trading': [
    {
      q: 'What is GEX in trading?',
      a: 'GEX, or gamma exposure, estimates how much stock options dealers must buy or sell to stay hedged as price moves. It is the single number that helps explain why some days pin and mean-revert while others trend and expand.',
    },
    {
      q: 'What is the difference between positive and negative GEX?',
      a: 'In positive GEX, dealer hedging leans against moves — buying dips and selling rips — which tends to produce a calmer, mean-reverting tape. In negative GEX, hedging amplifies moves — selling lower and buying higher — which tends to produce wider ranges and more directional sessions.',
    },
    {
      q: 'Is GEX the same as net GEX?',
      a: 'Net GEX is the market-wide, signed sum of dealer gamma across the whole chain — the aggregate that sets the regime. GEX is often used loosely for the same idea, but net GEX is the precise total.',
    },
  ],
  'gamma-exposure-explained': [
    {
      q: 'What is gamma exposure?',
      a: 'Gamma exposure (GEX) measures how fast options dealers’ hedging needs change as the underlying moves. It translates the options chain into an estimate of dealer buying or selling pressure at each price.',
    },
    {
      q: 'Why does gamma exposure move markets?',
      a: 'Dealers work to stay delta-neutral, so when their gamma is large they must trade the underlying continuously as price moves. Those hedging flows are mechanical and sizable, which is why gamma exposure shapes intraday support, resistance, and volatility.',
    },
    {
      q: 'What is the gamma flip?',
      a: 'The gamma flip is the price where aggregate dealer gamma crosses between positive and negative. Above it, markets tend to be calmer and mean-reverting; below it, they tend to be more volatile and trend-prone.',
    },
  ],
  'how-to-read-a-gamma-flip': [
    {
      q: 'What is a gamma flip?',
      a: 'The gamma flip is the price level where net dealer gamma switches sign — from positive (stabilizing) to negative (amplifying), or vice versa. It is the dividing line between two different market regimes.',
    },
    {
      q: 'What happens above versus below the gamma flip?',
      a: 'Above the flip, dealer hedging dampens moves, so ranges tend to be tighter and dips get bought. Below it, hedging reinforces moves, so ranges widen and breakouts tend to extend.',
    },
    {
      q: 'How do traders use the gamma flip?',
      a: 'Most use it as a regime filter rather than a signal: mean-reversion playbooks above the flip, momentum and breakout playbooks below it, and extra caution when price hovers right at the level, where conditions are choppiest.',
    },
  ],
  'spx-net-gamma-exposure-today': [
    {
      q: 'What is SPX net gamma exposure?',
      a: 'SPX net gamma exposure (net GEX) is the aggregate dealer gamma across SPX options. A positive reading points to a stabilizing, mean-reverting regime; a negative reading points to a more volatile, trending one.',
    },
    {
      q: 'How do I read the current SPX net GEX?',
      a: 'Look at the sign and the distance from the gamma-flip zero-cross. Deep positive means dealers are strongly dampening moves; near or below zero means that cushion is thinning and volatility can pick up.',
    },
    {
      q: 'How often does net GEX change?',
      a: 'It shifts every session as positions and price move, and large expirations can change it sharply. ZeroGEX refreshes free delayed SPX levels through the trading day.',
    },
  ],
  'max-pain-explained': [
    {
      q: 'What is max pain?',
      a: 'Max pain is the strike where the largest dollar amount of options would expire worthless — the price that causes the most aggregate loss to option buyers. It is often cited as a potential price magnet into expiration.',
    },
    {
      q: 'Does max pain actually move price?',
      a: 'The evidence is mixed. Where price does drift toward max pain, the likelier mechanism is dealer gamma hedging around heavy strikes (the gamma-magnet effect), not the option-writer-payout theory usually cited for it.',
    },
    {
      q: 'How should I use max pain?',
      a: 'Treat it as a cross-check rather than a forecast — a rough gravity level to weigh alongside the gamma flip and the walls, not a standalone trade signal.',
    },
  ],
  'gamma-walls-explained': [
    {
      q: 'What are gamma walls?',
      a: 'Gamma walls are the strikes where dealer gamma is most concentrated — the call wall above spot and the put wall below it. Price tends to react at these levels because dealer hedging clusters there.',
    },
    {
      q: 'Why does price react at gamma walls?',
      a: 'Heavy gamma at a strike means dealers must trade more of the underlying as price approaches it. That concentrated hedging tends to slow, pin, or reverse price near the wall.',
    },
    {
      q: 'Do gamma walls move?',
      a: 'Yes. They migrate through the session as positioning and price change, and can jump around large expirations. They are a live map, not fixed lines.',
    },
  ],
  'what-is-negative-gamma': [
    {
      q: 'What does negative gamma mean?',
      a: 'Negative gamma means dealer hedging amplifies price moves instead of dampening them — dealers sell as price falls and buy as it rises. The result tends to be wider ranges, extending breakouts, and broken pins.',
    },
    {
      q: 'How do I know if the market is in negative gamma?',
      a: 'When net GEX is below the gamma flip (negative), the tape is in a negative-gamma regime. Expect trendier, more volatile sessions and less mean reversion.',
    },
    {
      q: 'How does trading change in negative gamma?',
      a: 'Traders typically favor momentum and breakout setups, widen stops and targets for the bigger ranges, and are more cautious fading moves, since dips and rips can accelerate rather than revert.',
    },
  ],
  'best-gex-tools': [
    {
      q: 'What should I look for in a GEX tool?',
      a: 'The criteria that matter most are real-time versus delayed data, 0DTE coverage, a transparent methodology, signal quality, and price. A good tool is clear about how it calculates and signs dealer gamma.',
    },
    {
      q: 'What is the best GEX tool?',
      a: 'There is no single answer — it depends on whether you need real-time or delayed data, 0DTE coverage, and your budget. A fair comparison lays out the category on equal footing so you can match a tool to your workflow.',
    },
    {
      q: 'Are there free GEX tools?',
      a: 'Yes. Some platforms, including ZeroGEX, publish free delayed gamma levels — gamma flip, call wall, put wall, and net GEX — with no signup, while real-time data and deeper analytics are typically paid.',
    },
  ],
};

export function getArticleFaq(slug: string): FaqItem[] | null {
  return ARTICLE_FAQ[slug] ?? null;
}
