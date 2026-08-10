import TradingMistakesClient from './Client';

import type { Metadata } from 'next';
import { alternatesForPath } from '@/core/localizedMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '5 Trading Mistakes ZeroGEX Helps You Avoid',
    description:
      'Five common SPY/SPX trading mistakes that cost retail traders — buying into call walls, fading put walls, chasing pinned ranges, missing gamma flip regime changes, and trapped breakouts. How ZeroGEX surfaces the structural read that prevents them.',
    alternates: await alternatesForPath('/trading-mistakes'),
  };
}

export default function TradingMistakesPage() {
  return <TradingMistakesClient />;
}
