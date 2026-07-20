import GivingClient from './Client';
import { getGivingTotals } from '@/core/giving';
import { getServerT } from '@/core/localizedContent';
import { dict as metaDict } from './meta.i18n';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT(metaDict);
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/giving' },
  };
}

export default function GivingPage() {
  const totals = getGivingTotals();
  return <GivingClient totals={totals} />;
}
