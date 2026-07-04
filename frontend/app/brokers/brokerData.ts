import type { BrokerSlug } from '@/core/attribution';

// v1 broker list. Kept honest and factual — approval speed / commissions
// / API access as reported by each broker's public pages at time of
// writing. Do not fabricate — if a data point is genuinely unknown
// (e.g. tastytrade's public approval SLA), mark it "typically <n> days"
// rather than a hard number. The site owner can tighten these once
// they've onboarded with each affiliate program.

export type Broker = {
  // Matches the BrokerSlug set in @/core/attribution. Excludes 'compare'.
  slug: Exclude<BrokerSlug, 'compare'>;
  name: string;
  tagline: string;
  envKey: string;
  commission: string;
  optionsApproval: string;
  api: 'Yes' | 'Limited' | 'No';
  pro: string;
  con: string;
};

export const BROKER_ROWS: Broker[] = [
  {
    slug: 'tastytrade',
    name: 'tastytrade',
    tagline: 'Options-native platform, built by options traders. Ideal for defined-risk trades on SPX/SPY/QQQ.',
    envKey: 'NEXT_PUBLIC_BROKER_URL_TASTYTRADE',
    commission: '$1 to open / $0 to close per options contract, capped at $10/leg',
    optionsApproval: 'Typically 1–2 business days',
    api: 'Yes',
    pro: 'Options approval is fast and the risk/order tools are best-in-class for spreads and iron condors.',
    con: 'Charting is intentionally sparse — pair it with a separate charting workflow if you rely on TA.',
  },
  {
    slug: 'tradestation',
    name: 'TradeStation',
    tagline: 'Long-tenured pro platform; the same data provider that powers ZeroGEX derivations.',
    envKey: 'NEXT_PUBLIC_BROKER_URL_TRADESTATION',
    commission: '$0.60/contract options; $0 stock; volume tiers available',
    optionsApproval: 'Typically 2–3 business days',
    api: 'Yes',
    pro: 'Deep historical data, strong desktop platform, and full REST + WebSocket API for automation.',
    con: 'Onboarding UX and account funding feel dated compared to the newer app-first brokers.',
  },
  {
    slug: 'ibkr',
    name: 'Interactive Brokers (IBKR)',
    tagline: 'Institutional execution quality, sharpest margin rates, deepest global product menu.',
    envKey: 'NEXT_PUBLIC_BROKER_URL_IBKR',
    commission: 'IBKR Pro: tiered from $0.15 to $0.65 per contract; IBKR Lite: $0 stock, $0.65 options',
    optionsApproval: 'Typically 1–3 business days once documents are complete',
    api: 'Yes',
    pro: 'Best-in-class execution and margin, plus a mature API (TWS + IB Gateway) many quant workflows already speak.',
    con: 'The desktop TWS UI is powerful but steep — first-time options traders lose a weekend to it.',
  },
  {
    slug: 'tradezero',
    name: 'TradeZero',
    tagline: 'Day-trading-focused broker with locate services and no-PDT accounts for international clients.',
    envKey: 'NEXT_PUBLIC_BROKER_URL_TRADEZERO',
    commission: '$0.59/contract standard; commission-free plans available on the ZeroPro tier',
    optionsApproval: 'Typically 1–2 business days',
    api: 'Limited',
    pro: 'Fast fills and no PDT for its international accounts — useful for high-frequency 0DTE day traders.',
    con: 'US customers are served through a US affiliate with a narrower product menu than the offshore parent.',
  },
  {
    slug: 'webull',
    name: 'Webull',
    tagline: 'Mobile-first broker with commission-free options and a clean modern app.',
    envKey: 'NEXT_PUBLIC_BROKER_URL_WEBULL',
    commission: '$0/contract options; regulatory + exchange fees still apply',
    optionsApproval: 'Same-day approval typical for Levels 1–2; higher levels take a few days',
    api: 'Limited',
    pro: 'Frictionless mobile UX, quick approval, and no per-contract commission for retail-size trades.',
    con: 'Fewer risk-management tools than the pro platforms — assignment and spread management are more manual.',
  },
  {
    slug: 'public',
    name: 'Public.com',
    tagline: 'Design-forward brokerage aimed at options-curious retail investors, with rebates instead of PFOF.',
    envKey: 'NEXT_PUBLIC_BROKER_URL_PUBLIC',
    commission: '$0/contract options; earns per-contract rebate from Public (transparent, no PFOF)',
    optionsApproval: 'Typically same day for Level 1–2; higher levels take 1–2 business days',
    api: 'No',
    pro: 'Clean, honest UX with transparent order routing — a comfortable landing pad for someone new to options.',
    con: 'No API access, and advanced multi-leg strategies are more limited than on tastytrade or IBKR.',
  },
];

export function brokerAffiliateUrl(broker: Broker): string {
  const env = process.env[broker.envKey] as string | undefined;
  if (env && env.length > 0) return env;
  return brokerHomepageFallback(broker.slug);
}

// Fallback used when the affiliate env var isn't populated yet — links
// still work, just uncredited. Keeps the /brokers page functional in a
// fresh clone / dev env.
function brokerHomepageFallback(slug: Broker['slug']): string {
  switch (slug) {
    case 'tastytrade':
      return 'https://tastytrade.com';
    case 'tradestation':
      return 'https://www.tradestation.com';
    case 'ibkr':
      return 'https://www.interactivebrokers.com';
    case 'tradezero':
      return 'https://www.tradezero.co';
    case 'webull':
      return 'https://www.webull.com';
    case 'public':
      return 'https://public.com';
  }
}
