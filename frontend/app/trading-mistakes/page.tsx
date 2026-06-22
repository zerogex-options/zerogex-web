import TradingMistakesClient from './Client';

export const metadata = {
  title: '5 Trading Mistakes ZeroGEX Helps You Avoid',
  description:
    'Five common SPY/SPX trading mistakes that cost retail traders — buying into call walls, fading put walls, chasing pinned ranges, missing gamma flip regime changes, and trapped breakouts. How ZeroGEX surfaces the structural read that prevents them.',
  alternates: { canonical: '/trading-mistakes' },
};

export default function TradingMistakesPage() {
  return <TradingMistakesClient />;
}
