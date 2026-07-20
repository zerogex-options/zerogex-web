import RealTimeGexLandingClient from './Client';
import { articleMetadata } from '@/core/articleRegistry';
import { getServerT } from '@/core/localizedContent';
import { dict as metaDict } from './meta.i18n';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const base: Metadata = articleMetadata('real-time-gex-0dte');
  const t = await getServerT(metaDict);
  return {
    ...base,
    title: t('title'),
    description: t('description'),
    openGraph: base.openGraph
      ? { ...base.openGraph, title: t('title'), description: t('description') }
      : base.openGraph,
    twitter: base.twitter
      ? { ...base.twitter, title: t('title'), description: t('description') }
      : base.twitter,
  };
}

export default function RealTimeGex0DTEPage() {
  return <RealTimeGexLandingClient />;
}
