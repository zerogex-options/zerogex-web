import GivingClient from './Client';
import { getGivingTotals } from '@/core/giving';

export const metadata = {
  title: 'Giving Back — ZeroGEX Supports Folds of Honor',
  description:
    'ZeroGEX donates 3% of every subscription to Folds of Honor, providing educational scholarships to the families of fallen and disabled U.S. service members.',
  alternates: { canonical: '/giving' },
};

export default function GivingPage() {
  const totals = getGivingTotals();
  return <GivingClient totals={totals} />;
}
