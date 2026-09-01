import TradingMistakesClient from './Client';

export const metadata = {
  title: '5 Trading Mistakes ZeroGEX Helps You Avoid',
  description:
    'Five SPY and SPX trading mistakes that cost retail traders — buying into call walls, fading put walls, chasing pinned ranges, and missing gamma flip regimes.',
  alternates: { canonical: '/trading-mistakes' },
};

export default function TradingMistakesPage() {
  return <TradingMistakesClient />;
}
