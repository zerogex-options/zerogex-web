import GivingClient from './Client';
import { getGivingTotals } from '@/core/giving';

import type { Metadata } from 'next';
import { alternatesForPath } from '@/core/localizedMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Giving Back — ZeroGEX Supports Folds of Honor',
    description:
      'ZeroGEX donates 3% of every subscription to Folds of Honor, providing educational scholarships to the families of fallen and disabled U.S. service members.',
    alternates: await alternatesForPath('/giving'),
  };
}

export default function GivingPage() {
  const totals = getGivingTotals();
  return <GivingClient totals={totals} />;
}
