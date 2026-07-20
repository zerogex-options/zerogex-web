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
  'how-to-trade-around-gamma-flip': [
    {
      q: 'How do you trade around the gamma flip?',
      a: 'Treat the gamma flip as a regime switch, not a signal line. Above it, in positive gamma, lean on mean reversion and fade extremes back toward the walls. Below it, in negative gamma, lean on momentum and trade breakouts and trends. The flip tells you which playbook to run, not which direction to take.',
    },
    {
      q: 'What changes when price crosses the gamma flip intraday?',
      a: 'Crossing the flip switches the dealer-hedging regime, so the tape can change character — from dip-buying and pinning above it to trend-extending, wider-range behavior below it. Many traders change playbooks and widen their range expectations when spot crosses the level.',
    },
    {
      q: 'Why is the zone right at the gamma flip so choppy?',
      a: 'Near the flip, net dealer gamma is close to neutral, so hedging gives little consistent push either way. Neither the mean-reversion nor the momentum playbook works cleanly there, so many traders size down or wait until price commits to one side.',
    },
  ],
  'spy-vs-spx-gamma-levels': [
    {
      q: 'What is the difference between SPY and SPX gamma levels?',
      a: 'SPY and SPX track the same index but trade as two separate options books, each with its own dealer gamma. So each has its own gamma flip, call wall, and put wall — related, but not identical, and they can diverge intraday.',
    },
    {
      q: 'How do you convert SPX levels to SPY?',
      a: 'SPY trades at roughly one-tenth of the S&P 500 index, so divide an SPX level by about 10 for the rough SPY equivalent, and multiply a SPY level by about 10 for the SPX equivalent. The ratio is never exactly 10 because of dividends and tracking drift, so use it for orientation, not to the penny.',
    },
    {
      q: 'Which matters more, SPY or SPX gamma?',
      a: 'SPX is the heavier index-level book, so it usually sets the larger structural levels, while SPY adds granularity and pinning detail. The levels worth the most respect are the ones where both books agree.',
    },
  ],
  'why-spy-pins-near-strikes': [
    {
      q: 'Why does SPY pin near certain strikes?',
      a: 'Pinning is dealer hedging at a heavy-gamma strike, not superstition. When dealers are long gamma at a strike, they buy dips and sell rips around it to stay hedged, and that two-sided hedging mechanically pulls price toward the strike.',
    },
    {
      q: 'Why does pinning get stronger near expiration?',
      a: 'As expiry approaches, gamma at near-the-money strikes spikes, so the hedging required for each point of price movement grows. That intensifying, tightening hedging is why pins often firm up into the close on expiration days.',
    },
    {
      q: 'Does SPY always pin to a strike?',
      a: 'No. Pinning needs concentrated dealer gamma and a positive-gamma regime. In a negative-gamma regime, or when no single strike carries dominant gamma, hedging pushes price away from strikes instead of toward them, and the pin breaks.',
    },
  ],
  'why-spy-reverses-at-levels': [
    {
      q: 'Why does SPY reverse at certain levels?',
      a: 'Many SPY reversals happen at options-positioning levels rather than chart lines. Dealer hedging concentrates at specific strikes, and as price reaches them that hedging flow can absorb and turn the move.',
    },
    {
      q: 'Which levels does SPY tend to reverse at?',
      a: 'Four options-based levels matter most: the call wall, which tends to cap the upside; the put wall, which tends to support the downside; a gamma magnet, a heavy strike price gravitates toward; and the gamma flip, the regime line. Each comes from real positioning, which is why price reacts there.',
    },
    {
      q: 'Do these levels always hold?',
      a: 'No — the regime decides. In a positive-gamma regime, hedging defends the levels and reversals are more likely; in a negative-gamma regime, the same levels tend to give way and breaks extend.',
    },
  ],
  'why-do-breakouts-fail': [
    {
      q: 'Why do breakouts fail?',
      a: 'Failed breakouts are often dealer hedging, not weak momentum. In a long-gamma regime, dealers sell into rallies and buy into dips at concentrated strikes to stay hedged, which absorbs the move and snaps price back before a breakout can extend.',
    },
    {
      q: 'How can you tell a breakout is likely to fail?',
      a: 'The odds rise when all three structural conditions line up: a long-gamma (positive) regime, a strengthening net GEX, and a static gamma wall sitting just beyond the breakout level. When fewer of the three line up, the breakout is more likely to run.',
    },
    {
      q: 'When do breakouts actually hold?',
      a: 'Breakouts extend far more readily in a negative-gamma regime, where dealer hedging reinforces moves instead of fading them, and when net GEX is decaying or there is no heavy wall parked just past the level to cap it.',
    },
  ],
  'how-to-avoid-chasing-0dte': [
    {
      q: 'How do you avoid chasing 0DTE moves?',
      a: 'Replace the urge to chase with a structural read before entering: the gamma regime (spot versus the flip), the nearest wall, whether net GEX is strengthening or decaying, and where price sits in its range. If the structure does not support continuation, the move is likelier a fade than a breakout.',
    },
    {
      q: 'How do you know if you are chasing?',
      a: 'The tells are positional and emotional: entering only because price is already moving fast, buying into a call or put wall, or adding size so you do not miss out. Those are chase signals, not setups — and 0DTE punishes them, because the same gamma reflex that ran a contract up can reverse it just as fast.',
    },
    {
      q: 'When is 0DTE momentum actually real?',
      a: 'It tends to be real in a short-gamma (negative) regime with open room to the next wall and a supportive net-GEX backdrop — conditions where dealer hedging pushes the move along instead of absorbing it.',
    },
  ],
  '0dte-dealer-positioning-explained': [
    {
      q: 'What is 0DTE dealer positioning?',
      a: 'It is how options dealers are hedged in same-day-expiry (0DTE) options. Because 0DTE now makes up a large share of SPX volume, that positioning drives much of the intraday tape through dealers’ minute-to-minute hedging.',
    },
    {
      q: 'Why does 0DTE matter so much for intraday moves?',
      a: '0DTE options carry very high gamma near the money, so dealers must hedge aggressively as price moves. With same-day expiries dominating daily SPX volume, those hedging flows have an outsized effect on intraday support, resistance, and volatility.',
    },
    {
      q: 'How does 0DTE behave in different gamma regimes?',
      a: 'In a positive-gamma regime, 0DTE hedging dampens moves — tighter ranges and pinning into the close. In a negative-gamma regime, it amplifies them — faster trends, wider ranges, and sharper reversals as dealers chase price.',
    },
  ],
  'vanna-and-charm-explained': [
    {
      q: 'What are vanna and charm?',
      a: 'They are two ways an option’s delta changes without the underlying moving. Vanna is how delta shifts when implied volatility changes; charm is how delta shifts as time passes. Both force dealers to trade the underlying to stay hedged, even on a flat tape.',
    },
    {
      q: 'How does vanna move the market?',
      a: 'When priced-in fear drains out and implied volatility falls — often after an event that did not deliver — vanna pushes dealers into a steady bid. That produces the slow "up on no news" grind that shows up in the drift rather than the volume.',
    },
    {
      q: 'How does charm affect the close?',
      a: 'Charm bleeds delta as expiration nears, forcing dealers to hedge as the clock runs down. Because time passes predictably, charm flow is one of the few dealer flows you can anticipate, and it often shapes a directional drift into the final hours of the session.',
    },
  ],
};

export function getArticleFaq(slug: string): FaqItem[] | null {
  return ARTICLE_FAQ[slug] ?? null;
}
